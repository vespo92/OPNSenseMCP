/**
 * External Plugin Loader
 *
 * Loads plugins from external sources:
 * - NPM packages (@opnsense-mcp/* namespace)
 * - Custom directories
 * - GitHub repositories
 */

import { readdir, readFile, access, mkdir, writeFile, rm } from 'fs/promises';
import { join, resolve, dirname, basename } from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import type {
  MCPPlugin,
  PluginConfig,
  PluginContext,
  PluginMetadata,
} from '../types/plugin.js';
import type { Logger } from '../../utils/logger.js';
import { PluginRegistry } from './registry.js';
import { PluginValidator, ValidationResult } from './validator.js';

const execAsync = promisify(exec);

/**
 * External plugin source types
 */
export enum ExternalPluginSource {
  NPM = 'npm',
  DIRECTORY = 'directory',
  GITHUB = 'github',
  URL = 'url',
}

/**
 * External plugin configuration
 */
export interface ExternalPluginConfig {
  /** Plugin identifier or package name */
  source: string;
  /** Source type */
  type: ExternalPluginSource;
  /** Optional version constraint */
  version?: string;
  /** Whether to auto-update */
  autoUpdate?: boolean;
  /** Plugin-specific configuration overrides */
  config?: Record<string, any>;
  /** Whether this plugin is enabled */
  enabled?: boolean;
}

/**
 * External plugin manifest (for npm packages)
 */
export interface ExternalPluginManifest {
  /** Plugin metadata */
  opnsenseMcp: {
    /** Plugin ID */
    pluginId: string;
    /** Plugin type */
    type: 'plugin';
    /** Minimum MCP server version required */
    minServerVersion?: string;
    /** Required OPNsense version */
    opnsenseVersion?: string;
    /** Required capabilities */
    capabilities?: string[];
    /** Entry point (relative to package root) */
    entryPoint?: string;
  };
}

/**
 * Installed plugin info
 */
export interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  source: ExternalPluginSource;
  sourcePath: string;
  installedAt: Date;
  lastUpdated?: Date;
  config: ExternalPluginConfig;
}

/**
 * External plugin loader options
 */
export interface ExternalPluginLoaderOptions {
  /** Directory to install external plugins */
  installDirectory: string;
  /** Additional directories to scan for plugins */
  additionalDirectories?: string[];
  /** NPM registry URL (defaults to npmjs.com) */
  npmRegistry?: string;
  /** Whether to validate plugins before loading */
  validatePlugins?: boolean;
  /** Auto-install missing dependencies */
  autoInstallDeps?: boolean;
  /** GitHub token for private repos */
  githubToken?: string;
}

/**
 * External Plugin Loader
 *
 * Manages installation and loading of third-party plugins
 */
export class ExternalPluginLoader {
  private registry: PluginRegistry;
  private logger: Logger;
  private options: ExternalPluginLoaderOptions;
  private validator: PluginValidator;
  private installedPlugins = new Map<string, InstalledPluginInfo>();
  private manifestPath: string;

  constructor(
    registry: PluginRegistry,
    logger: Logger,
    options: ExternalPluginLoaderOptions
  ) {
    this.registry = registry;
    this.logger = logger;
    this.options = {
      validatePlugins: true,
      autoInstallDeps: true,
      ...options,
    };
    this.validator = new PluginValidator(logger);
    this.manifestPath = join(options.installDirectory, 'installed-plugins.json');
  }

  /**
   * Initialize the external plugin loader
   */
  async initialize(): Promise<void> {
    // Ensure install directory exists
    await this.ensureDirectory(this.options.installDirectory);

    // Load installed plugins manifest
    await this.loadInstalledManifest();

    this.logger.info(`External plugin loader initialized. Install directory: ${this.options.installDirectory}`);
  }

  /**
   * Install a plugin from NPM
   */
  async installFromNpm(packageName: string, version?: string): Promise<InstalledPluginInfo | null> {
    const fullPackage = version ? `${packageName}@${version}` : packageName;
    this.logger.info(`Installing plugin from NPM: ${fullPackage}`);

    try {
      // Create a temporary directory for installation
      const pluginDir = join(this.options.installDirectory, 'npm', this.sanitizePackageName(packageName));
      await this.ensureDirectory(pluginDir);

      // Initialize package.json if needed
      const packageJsonPath = join(pluginDir, 'package.json');
      try {
        await access(packageJsonPath);
      } catch {
        await writeFile(packageJsonPath, JSON.stringify({
          name: `opnsense-mcp-plugin-${this.sanitizePackageName(packageName)}`,
          version: '1.0.0',
          type: 'module',
          private: true,
        }, null, 2));
      }

      // Install the package
      const registry = this.options.npmRegistry ? `--registry=${this.options.npmRegistry}` : '';
      const cmd = `npm install ${fullPackage} ${registry}`;

      this.logger.debug(`Running: ${cmd} in ${pluginDir}`);
      await execAsync(cmd, { cwd: pluginDir });

      // Read the installed package's package.json to get manifest
      const installedPackageJson = join(pluginDir, 'node_modules', packageName, 'package.json');
      const packageContent = await readFile(installedPackageJson, 'utf-8');
      const packageJson = JSON.parse(packageContent) as { version: string; name: string; opnsenseMcp?: ExternalPluginManifest['opnsenseMcp'] };

      // Validate it's an OPNsense MCP plugin
      if (!packageJson.opnsenseMcp) {
        this.logger.error(`Package ${packageName} is not an OPNsense MCP plugin (missing opnsenseMcp field)`);
        await rm(pluginDir, { recursive: true, force: true });
        return null;
      }

      const manifest = packageJson.opnsenseMcp;

      // Create installed info
      const installedInfo: InstalledPluginInfo = {
        id: manifest.pluginId || packageName,
        name: packageJson.name,
        version: packageJson.version,
        source: ExternalPluginSource.NPM,
        sourcePath: join(pluginDir, 'node_modules', packageName),
        installedAt: new Date(),
        config: {
          source: packageName,
          type: ExternalPluginSource.NPM,
          version: packageJson.version,
          enabled: true,
        },
      };

      // Save to manifest
      this.installedPlugins.set(installedInfo.id, installedInfo);
      await this.saveInstalledManifest();

      this.logger.info(`Successfully installed plugin: ${installedInfo.id} v${installedInfo.version}`);
      return installedInfo;
    } catch (error) {
      this.logger.error(`Failed to install plugin from NPM: ${packageName}`, error);
      return null;
    }
  }

  /**
   * Install a plugin from a local directory
   */
  async installFromDirectory(sourcePath: string): Promise<InstalledPluginInfo | null> {
    this.logger.info(`Installing plugin from directory: ${sourcePath}`);

    try {
      const resolvedPath = resolve(sourcePath);

      // Check if config.json exists
      const configPath = join(resolvedPath, 'config.json');
      await access(configPath);

      // Read config
      const configContent = await readFile(configPath, 'utf-8');
      const config: PluginConfig = JSON.parse(configContent);

      // Validate plugin
      if (this.options.validatePlugins) {
        const validation = await this.validator.validatePluginDirectory(resolvedPath);
        if (!validation.valid) {
          this.logger.error(`Plugin validation failed: ${validation.errors.join(', ')}`);
          return null;
        }
      }

      // Create symlink or copy to install directory
      const pluginDir = join(this.options.installDirectory, 'local', config.metadata.id);
      await this.ensureDirectory(dirname(pluginDir));

      // For local directories, we just reference them directly
      const installedInfo: InstalledPluginInfo = {
        id: config.metadata.id,
        name: config.metadata.name,
        version: config.metadata.version,
        source: ExternalPluginSource.DIRECTORY,
        sourcePath: resolvedPath,
        installedAt: new Date(),
        config: {
          source: resolvedPath,
          type: ExternalPluginSource.DIRECTORY,
          enabled: true,
        },
      };

      this.installedPlugins.set(installedInfo.id, installedInfo);
      await this.saveInstalledManifest();

      this.logger.info(`Successfully installed plugin: ${installedInfo.id} v${installedInfo.version}`);
      return installedInfo;
    } catch (error) {
      this.logger.error(`Failed to install plugin from directory: ${sourcePath}`, error);
      return null;
    }
  }

  /**
   * Install a plugin from GitHub
   */
  async installFromGitHub(repoUrl: string, ref?: string): Promise<InstalledPluginInfo | null> {
    this.logger.info(`Installing plugin from GitHub: ${repoUrl}`);

    try {
      // Parse GitHub URL
      const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (!match) {
        this.logger.error(`Invalid GitHub URL: ${repoUrl}`);
        return null;
      }

      const [, owner, repo] = match;
      const repoId = `${owner}-${repo}`;
      const pluginDir = join(this.options.installDirectory, 'github', repoId);

      // Clone or update repository
      try {
        await access(pluginDir);
        // Update existing
        this.logger.debug(`Updating existing repository: ${pluginDir}`);
        await execAsync('git pull', { cwd: pluginDir });
      } catch {
        // Clone new
        await this.ensureDirectory(dirname(pluginDir));
        const authToken = this.options.githubToken ? `${this.options.githubToken}@` : '';
        const cloneUrl = `https://${authToken}github.com/${owner}/${repo}.git`;
        await execAsync(`git clone ${cloneUrl} ${pluginDir}`);
      }

      // Checkout specific ref if provided
      if (ref) {
        await execAsync(`git checkout ${ref}`, { cwd: pluginDir });
      }

      // Read config
      const configPath = join(pluginDir, 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config: PluginConfig = JSON.parse(configContent);

      // Install dependencies if package.json exists
      const packageJsonPath = join(pluginDir, 'package.json');
      try {
        await access(packageJsonPath);
        if (this.options.autoInstallDeps) {
          this.logger.debug('Installing dependencies...');
          await execAsync('npm install', { cwd: pluginDir });
        }
      } catch {
        // No package.json, skip dependency installation
      }

      // Build if build script exists
      try {
        const packageContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        if (packageJson.scripts?.build) {
          this.logger.debug('Building plugin...');
          await execAsync('npm run build', { cwd: pluginDir });
        }
      } catch {
        // No build script or package.json
      }

      // Validate plugin
      if (this.options.validatePlugins) {
        const validation = await this.validator.validatePluginDirectory(pluginDir);
        if (!validation.valid) {
          this.logger.error(`Plugin validation failed: ${validation.errors.join(', ')}`);
          return null;
        }
      }

      const installedInfo: InstalledPluginInfo = {
        id: config.metadata.id,
        name: config.metadata.name,
        version: config.metadata.version,
        source: ExternalPluginSource.GITHUB,
        sourcePath: pluginDir,
        installedAt: new Date(),
        config: {
          source: repoUrl,
          type: ExternalPluginSource.GITHUB,
          version: ref,
          enabled: true,
        },
      };

      this.installedPlugins.set(installedInfo.id, installedInfo);
      await this.saveInstalledManifest();

      this.logger.info(`Successfully installed plugin: ${installedInfo.id} v${installedInfo.version}`);
      return installedInfo;
    } catch (error) {
      this.logger.error(`Failed to install plugin from GitHub: ${repoUrl}`, error);
      return null;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginId: string): Promise<boolean> {
    const info = this.installedPlugins.get(pluginId);
    if (!info) {
      this.logger.warn(`Plugin not found: ${pluginId}`);
      return false;
    }

    try {
      // Stop and unregister from registry if loaded
      if (this.registry.has(pluginId)) {
        await this.registry.unregister(pluginId);
      }

      // Remove files for npm and github sources
      if (info.source === ExternalPluginSource.NPM || info.source === ExternalPluginSource.GITHUB) {
        const parentDir = dirname(info.sourcePath);
        await rm(parentDir, { recursive: true, force: true });
      }

      // Remove from manifest
      this.installedPlugins.delete(pluginId);
      await this.saveInstalledManifest();

      this.logger.info(`Uninstalled plugin: ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin: ${pluginId}`, error);
      return false;
    }
  }

  /**
   * Load an installed plugin
   */
  async loadPlugin(pluginId: string, context: PluginContext): Promise<MCPPlugin | null> {
    const info = this.installedPlugins.get(pluginId);
    if (!info) {
      this.logger.warn(`Plugin not installed: ${pluginId}`);
      return null;
    }

    if (!info.config.enabled) {
      this.logger.debug(`Plugin is disabled: ${pluginId}`);
      return null;
    }

    try {
      // Determine entry point
      let entryPoint = join(info.sourcePath, 'index.js');

      // For NPM packages, check for custom entry point
      if (info.source === ExternalPluginSource.NPM) {
        const packageJsonPath = join(info.sourcePath, 'package.json');
        const packageContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);

        if (packageJson.opnsenseMcp?.entryPoint) {
          entryPoint = join(info.sourcePath, packageJson.opnsenseMcp.entryPoint);
        } else if (packageJson.main) {
          entryPoint = join(info.sourcePath, packageJson.main);
        }
      }

      // Check entry point exists
      await access(entryPoint);

      // Import plugin module
      const module = await import(entryPoint);
      const PluginClass = module.default || module[Object.keys(module)[0]];

      if (!PluginClass) {
        this.logger.error(`Plugin ${pluginId} has no default export`);
        return null;
      }

      // Instantiate plugin
      const plugin: MCPPlugin = new PluginClass(info.config.config || {});

      // Validate plugin interface
      if (!this.validator.validatePluginInterface(plugin)) {
        this.logger.error(`Plugin ${pluginId} does not implement required interface`);
        return null;
      }

      // Read config for registration
      const configPath = join(info.sourcePath, 'config.json');
      let config: PluginConfig;
      try {
        const configContent = await readFile(configPath, 'utf-8');
        config = JSON.parse(configContent);
      } catch {
        // Create minimal config from metadata
        config = {
          metadata: plugin.metadata,
          dependencies: plugin.getDependencies(),
        };
      }

      // Register plugin
      this.registry.register(plugin, config);

      // Initialize plugin
      await plugin.initialize(context);

      this.logger.info(`Loaded external plugin: ${pluginId} v${info.version}`);
      return plugin;
    } catch (error) {
      this.logger.error(`Failed to load plugin ${pluginId}:`, error);
      return null;
    }
  }

  /**
   * Load all installed plugins
   */
  async loadAll(context: PluginContext): Promise<MCPPlugin[]> {
    const loaded: MCPPlugin[] = [];

    for (const [pluginId, info] of this.installedPlugins) {
      if (info.config.enabled !== false) {
        const plugin = await this.loadPlugin(pluginId, context);
        if (plugin) {
          loaded.push(plugin);
        }
      }
    }

    this.logger.info(`Loaded ${loaded.length} external plugins`);
    return loaded;
  }

  /**
   * Scan additional directories for plugins
   */
  async scanAdditionalDirectories(): Promise<string[]> {
    const discovered: string[] = [];

    for (const dir of this.options.additionalDirectories || []) {
      try {
        await access(dir);
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const pluginPath = join(dir, entry.name);
          const configPath = join(pluginPath, 'config.json');

          try {
            await access(configPath);
            discovered.push(pluginPath);
            this.logger.debug(`Discovered external plugin: ${entry.name} in ${dir}`);
          } catch {
            // No config.json, skip
          }
        }
      } catch {
        this.logger.warn(`Additional directory not accessible: ${dir}`);
      }
    }

    return discovered;
  }

  /**
   * Get list of installed plugins
   */
  getInstalledPlugins(): InstalledPluginInfo[] {
    return Array.from(this.installedPlugins.values());
  }

  /**
   * Get installed plugin by ID
   */
  getInstalledPlugin(pluginId: string): InstalledPluginInfo | undefined {
    return this.installedPlugins.get(pluginId);
  }

  /**
   * Update a plugin
   */
  async updatePlugin(pluginId: string): Promise<boolean> {
    const info = this.installedPlugins.get(pluginId);
    if (!info) {
      return false;
    }

    switch (info.source) {
      case ExternalPluginSource.NPM:
        // Reinstall from NPM
        const packageName = info.config.source;
        await this.uninstall(pluginId);
        const result = await this.installFromNpm(packageName);
        return result !== null;

      case ExternalPluginSource.GITHUB:
        // Pull latest changes
        try {
          await execAsync('git pull', { cwd: info.sourcePath });
          if (this.options.autoInstallDeps) {
            await execAsync('npm install', { cwd: info.sourcePath });
          }
          const packageJsonPath = join(info.sourcePath, 'package.json');
          try {
            const packageContent = await readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageContent);
            if (packageJson.scripts?.build) {
              await execAsync('npm run build', { cwd: info.sourcePath });
            }
          } catch {
            // No build needed
          }
          info.lastUpdated = new Date();
          await this.saveInstalledManifest();
          return true;
        } catch (error) {
          this.logger.error(`Failed to update GitHub plugin: ${pluginId}`, error);
          return false;
        }

      case ExternalPluginSource.DIRECTORY:
        // Local directories are managed externally
        this.logger.info(`Local plugin ${pluginId} must be updated manually`);
        return true;

      default:
        return false;
    }
  }

  /**
   * Enable or disable a plugin
   */
  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<boolean> {
    const info = this.installedPlugins.get(pluginId);
    if (!info) {
      return false;
    }

    info.config.enabled = enabled;
    await this.saveInstalledManifest();

    if (!enabled && this.registry.has(pluginId)) {
      await this.registry.unregister(pluginId);
    }

    this.logger.info(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  // Private helpers

  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await access(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }
  }

  private sanitizePackageName(name: string): string {
    return name.replace(/[@/]/g, '-').replace(/^-+|-+$/g, '');
  }

  private async loadInstalledManifest(): Promise<void> {
    try {
      const content = await readFile(this.manifestPath, 'utf-8');
      const data = JSON.parse(content) as Record<string, InstalledPluginInfo>;

      for (const [id, info] of Object.entries(data)) {
        info.installedAt = new Date(info.installedAt);
        if (info.lastUpdated) {
          info.lastUpdated = new Date(info.lastUpdated);
        }
        this.installedPlugins.set(id, info);
      }

      this.logger.debug(`Loaded ${this.installedPlugins.size} installed plugins from manifest`);
    } catch {
      // No manifest yet
      this.logger.debug('No installed plugins manifest found');
    }
  }

  private async saveInstalledManifest(): Promise<void> {
    const data: Record<string, InstalledPluginInfo> = {};
    for (const [id, info] of this.installedPlugins) {
      data[id] = info;
    }
    await writeFile(this.manifestPath, JSON.stringify(data, null, 2));
  }
}
