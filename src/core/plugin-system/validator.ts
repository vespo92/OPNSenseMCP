/**
 * Plugin Validator
 *
 * Validates plugins for security, compatibility, and correctness
 */

import { readFile, access, readdir } from 'fs/promises';
import { join } from 'path';
import type { MCPPlugin, PluginConfig, PluginMetadata } from '../types/plugin.js';
import type { Logger } from '../../utils/logger.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: PluginMetadata;
}

/**
 * Plugin capability requirements
 */
export interface PluginCapabilities {
  /** Requires OPNsense API access */
  requiresApi?: boolean;
  /** Requires SSH access */
  requiresSsh?: boolean;
  /** Requires cache access */
  requiresCache?: boolean;
  /** Requires state persistence */
  requiresState?: boolean;
  /** Required OPNsense modules */
  requiredModules?: string[];
}

/**
 * Security check result
 */
export interface SecurityCheckResult {
  passed: boolean;
  issues: SecurityIssue[];
}

/**
 * Security issue
 */
export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  location?: string;
}

/**
 * Plugin Validator
 *
 * Validates plugin structure, security, and compatibility
 */
export class PluginValidator {
  private logger: Logger;

  // Dangerous patterns to check for in plugin code
  private static readonly DANGEROUS_PATTERNS = [
    { pattern: /eval\s*\(/, description: 'Use of eval()', severity: 'high' as const },
    { pattern: /new\s+Function\s*\(/, description: 'Dynamic function creation', severity: 'medium' as const },
    { pattern: /process\.env\[/, description: 'Dynamic environment access', severity: 'low' as const },
    { pattern: /child_process/, description: 'Child process usage', severity: 'medium' as const },
    { pattern: /fs\..*Sync\s*\(/, description: 'Synchronous file operations', severity: 'low' as const },
    { pattern: /require\s*\(\s*[^'"`]/, description: 'Dynamic require', severity: 'medium' as const },
    { pattern: /__dirname|__filename/, description: 'Node.js path globals', severity: 'low' as const },
    { pattern: /process\.exit/, description: 'Process termination', severity: 'high' as const },
    { pattern: /rm\s+-rf|rmdir/, description: 'Recursive deletion', severity: 'critical' as const },
  ];

  // Required metadata fields
  private static readonly REQUIRED_METADATA = ['id', 'name', 'version', 'description', 'category', 'author'];

  // Valid plugin categories
  private static readonly VALID_CATEGORIES = [
    'core', 'security', 'vpn', 'routing', 'traffic',
    'services', 'monitoring', 'proxy', 'backup', 'utility', 'custom',
  ];

  // Semver pattern
  private static readonly SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validate a plugin directory
   */
  async validatePluginDirectory(pluginPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Check config.json exists
      const configPath = join(pluginPath, 'config.json');
      try {
        await access(configPath);
      } catch {
        result.errors.push('Missing config.json');
        result.valid = false;
        return result;
      }

      // Validate config.json
      const configResult = await this.validateConfig(configPath);
      result.errors.push(...configResult.errors);
      result.warnings.push(...configResult.warnings);
      result.metadata = configResult.metadata;

      // Check for entry point
      const hasJs = await this.fileExists(join(pluginPath, 'index.js'));
      const hasTs = await this.fileExists(join(pluginPath, 'index.ts'));

      if (!hasJs && !hasTs) {
        result.errors.push('Missing entry point (index.js or index.ts)');
      } else if (hasTs && !hasJs) {
        result.warnings.push('TypeScript source found but not compiled (index.js missing)');
      }

      // Security check on source files
      const securityResult = await this.performSecurityCheck(pluginPath);
      for (const issue of securityResult.issues) {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          result.errors.push(`Security: ${issue.description}${issue.location ? ` in ${issue.location}` : ''}`);
        } else {
          result.warnings.push(`Security: ${issue.description}${issue.location ? ` in ${issue.location}` : ''}`);
        }
      }

      // Check for package.json
      const packageJsonPath = join(pluginPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageResult = await this.validatePackageJson(packageJsonPath);
        result.warnings.push(...packageResult.warnings);
      }

      result.valid = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
      return result;
    }
  }

  /**
   * Validate plugin config.json
   */
  async validateConfig(configPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      const content = await readFile(configPath, 'utf-8');
      let config: PluginConfig;

      try {
        config = JSON.parse(content);
      } catch {
        result.errors.push('Invalid JSON in config.json');
        result.valid = false;
        return result;
      }

      // Check metadata exists
      if (!config.metadata) {
        result.errors.push('Missing metadata in config.json');
        result.valid = false;
        return result;
      }

      result.metadata = config.metadata;

      // Check required metadata fields
      for (const field of PluginValidator.REQUIRED_METADATA) {
        if (!(field in config.metadata) || !config.metadata[field as keyof PluginMetadata]) {
          result.errors.push(`Missing required metadata field: ${field}`);
        }
      }

      // Validate category
      if (config.metadata.category && !PluginValidator.VALID_CATEGORIES.includes(config.metadata.category as string)) {
        result.errors.push(`Invalid category: ${config.metadata.category}. Must be one of: ${PluginValidator.VALID_CATEGORIES.join(', ')}`);
      }

      // Validate version format
      if (config.metadata.version && !PluginValidator.SEMVER_PATTERN.test(config.metadata.version)) {
        result.warnings.push(`Version "${config.metadata.version}" is not in semver format`);
      }

      // Validate plugin ID format
      if (config.metadata.id) {
        if (!/^[a-z][a-z0-9-]*$/.test(config.metadata.id)) {
          result.errors.push('Plugin ID must be lowercase alphanumeric with hyphens, starting with a letter');
        }
        if (config.metadata.id.length > 50) {
          result.errors.push('Plugin ID must be 50 characters or less');
        }
      }

      // Check dependencies are valid
      if (config.dependencies) {
        if (!Array.isArray(config.dependencies)) {
          result.errors.push('dependencies must be an array');
        } else {
          for (const dep of config.dependencies) {
            if (typeof dep !== 'string') {
              result.errors.push(`Invalid dependency: ${dep} (must be string)`);
            }
          }
        }
      }

      result.valid = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(`Config validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
      return result;
    }
  }

  /**
   * Validate package.json for NPM distribution
   */
  async validatePackageJson(packageJsonPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // Check for OPNsense MCP plugin marker
      if (!packageJson.opnsenseMcp) {
        result.warnings.push('package.json missing opnsenseMcp field for NPM distribution');
      } else {
        if (!packageJson.opnsenseMcp.pluginId) {
          result.errors.push('opnsenseMcp.pluginId is required');
        }
        if (!packageJson.opnsenseMcp.type || packageJson.opnsenseMcp.type !== 'plugin') {
          result.warnings.push('opnsenseMcp.type should be "plugin"');
        }
      }

      // Check main entry point
      if (!packageJson.main) {
        result.warnings.push('package.json missing main entry point');
      }

      // Check type is module
      if (packageJson.type !== 'module') {
        result.warnings.push('package.json should have "type": "module" for ES modules');
      }

      // Check for recommended keywords
      const keywords = packageJson.keywords || [];
      if (!keywords.includes('opnsense-mcp') && !keywords.includes('opnsense-mcp-plugin')) {
        result.warnings.push('Consider adding "opnsense-mcp-plugin" to keywords for discoverability');
      }

      result.valid = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(`Package.json validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
      return result;
    }
  }

  /**
   * Perform security check on plugin source files
   */
  async performSecurityCheck(pluginPath: string): Promise<SecurityCheckResult> {
    const result: SecurityCheckResult = {
      passed: true,
      issues: [],
    };

    try {
      const files = await this.getSourceFiles(pluginPath);

      for (const file of files) {
        const content = await readFile(file, 'utf-8');
        const relativePath = file.replace(pluginPath, '');

        for (const check of PluginValidator.DANGEROUS_PATTERNS) {
          if (check.pattern.test(content)) {
            result.issues.push({
              severity: check.severity,
              type: 'dangerous-pattern',
              description: check.description,
              location: relativePath,
            });
            if (check.severity === 'critical' || check.severity === 'high') {
              result.passed = false;
            }
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.warn('Security check failed:', error);
      return result;
    }
  }

  /**
   * Validate plugin runtime interface
   */
  validatePluginInterface(plugin: any): plugin is MCPPlugin {
    const requiredMethods = [
      'initialize',
      'start',
      'stop',
      'healthCheck',
      'getTools',
      'getResources',
      'getPrompts',
      'getDependencies',
      'on',
      'emit',
    ];

    // Check metadata
    if (!plugin.metadata) {
      this.logger.error('Plugin missing metadata property');
      return false;
    }

    for (const field of PluginValidator.REQUIRED_METADATA) {
      if (!(field in plugin.metadata)) {
        this.logger.error(`Plugin metadata missing: ${field}`);
        return false;
      }
    }

    // Check methods
    for (const method of requiredMethods) {
      if (typeof plugin[method] !== 'function') {
        this.logger.error(`Plugin missing method: ${method}`);
        return false;
      }
    }

    // Check state property
    if (!('state' in plugin)) {
      this.logger.error('Plugin missing state property');
      return false;
    }

    return true;
  }

  /**
   * Check version compatibility
   */
  checkVersionCompatibility(
    pluginVersion: string,
    requiredVersion?: string,
    serverVersion?: string
  ): { compatible: boolean; message?: string } {
    if (!requiredVersion) {
      return { compatible: true };
    }

    // Simple semver comparison (major.minor compatibility)
    const parseVersion = (v: string) => {
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
      return match ? { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]) } : null;
    };

    const required = parseVersion(requiredVersion);
    const current = serverVersion ? parseVersion(serverVersion) : null;

    if (!required) {
      return { compatible: true, message: 'Unable to parse required version' };
    }

    if (!current) {
      return { compatible: true, message: 'Server version unknown, assuming compatible' };
    }

    // Check major version match and minor >= required
    if (current.major === required.major && current.minor >= required.minor) {
      return { compatible: true };
    }

    if (current.major > required.major) {
      return { compatible: true, message: 'Plugin may need update for newer server version' };
    }

    return {
      compatible: false,
      message: `Requires server version ${requiredVersion}, but running ${serverVersion}`,
    };
  }

  // Private helpers

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async getSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Skip node_modules and hidden directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          const subFiles = await this.getSourceFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors in subdirectories
    }

    return files;
  }
}
