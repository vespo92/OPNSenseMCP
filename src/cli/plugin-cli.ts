#!/usr/bin/env node
/**
 * OPNsense MCP Plugin CLI
 *
 * Command-line interface for managing OPNsense MCP plugins
 *
 * Usage:
 *   npx opnsense-mcp-plugin create <name> [--category <category>]
 *   npx opnsense-mcp-plugin install <source> [--type npm|github|directory]
 *   npx opnsense-mcp-plugin uninstall <plugin-id>
 *   npx opnsense-mcp-plugin list [--installed] [--available]
 *   npx opnsense-mcp-plugin enable <plugin-id>
 *   npx opnsense-mcp-plugin disable <plugin-id>
 *   npx opnsense-mcp-plugin update <plugin-id>
 *   npx opnsense-mcp-plugin validate <path>
 *   npx opnsense-mcp-plugin info <plugin-id>
 */

import { writeFile, mkdir, access, readFile } from 'fs/promises';
import { join, resolve, basename } from 'path';
import { ExternalPluginLoader, ExternalPluginSource, type ExternalPluginLoaderOptions } from '../core/plugin-system/external-loader.js';
import { PluginValidator } from '../core/plugin-system/validator.js';
import { PluginRegistry } from '../core/plugin-system/registry.js';
import { PluginCategory } from '../core/types/plugin.js';

/**
 * CLI Logger (simple console logger)
 */
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`ℹ️  ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.log(`⚠️  ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`❌ ${msg}`, ...args),
  success: (msg: string, ...args: any[]) => console.log(`✅ ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => {
    if (process.env.DEBUG) console.log(`🔍 ${msg}`, ...args);
  },
};

/**
 * Plugin template content generators
 */
const templates = {
  /**
   * Generate config.json
   */
  config: (name: string, id: string, category: string, description: string, author: string) => ({
    metadata: {
      id,
      name,
      version: '1.0.0',
      description,
      category,
      author,
      enabled: true,
      tags: ['opnsense', category],
      license: 'MIT',
    },
    config: {},
    dependencies: [],
  }),

  /**
   * Generate index.ts
   */
  indexTs: (name: string, id: string, category: string, description: string) => `/**
 * ${name} Plugin
 *
 * ${description}
 */

import { BasePlugin } from 'opnsense-mcp-sdk';
import type {
  PluginCategory,
  PluginMetadata,
  MCPTool,
  MCPResource,
  MCPPrompt,
  HealthStatus,
} from 'opnsense-mcp-sdk';

/**
 * ${name} Plugin
 */
export default class ${toPascalCase(id)}Plugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: '${id}',
    name: '${name}',
    version: '1.0.0',
    description: '${description}',
    category: '${category}' as PluginCategory,
    author: process.env.npm_package_author || 'Unknown',
    enabled: true,
  };

  /**
   * Initialize the plugin
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info(\`Initializing ${name} plugin\`);
    // Add your initialization logic here
  }

  /**
   * Start the plugin
   */
  protected async onStart(): Promise<void> {
    this.logger.info(\`Starting ${name} plugin\`);
    // Add your startup logic here
  }

  /**
   * Stop the plugin
   */
  protected async onStop(): Promise<void> {
    this.logger.info(\`Stopping ${name} plugin\`);
    // Add your cleanup logic here
  }

  /**
   * Health check
   */
  protected async onHealthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      status: 'healthy',
      message: '${name} plugin is running normally',
      timestamp: new Date(),
    };
  }

  /**
   * Get MCP tools provided by this plugin
   */
  getTools(): MCPTool[] {
    return [
      {
        name: '${id.replace(/-/g, '_')}_example',
        description: 'Example tool for ${name}',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'A message to process',
            },
          },
          required: ['message'],
        },
        handler: this.exampleToolHandler.bind(this),
      },
    ];
  }

  /**
   * Get MCP resources provided by this plugin
   */
  getResources(): MCPResource[] {
    return [
      {
        uri: \`plugin://${category}/${id}/status\`,
        name: '${name} Status',
        description: 'Current status of the ${name} plugin',
        mimeType: 'application/json',
        handler: async () => ({
          content: JSON.stringify({
            status: 'active',
            version: this.metadata.version,
            timestamp: new Date().toISOString(),
          }, null, 2),
        }),
      },
    ];
  }

  /**
   * Get MCP prompts provided by this plugin
   */
  getPrompts(): MCPPrompt[] {
    return [];
  }

  /**
   * Get plugin dependencies
   */
  getDependencies(): string[] {
    return [];
  }

  /**
   * Example tool handler
   */
  private async exampleToolHandler(params: { message: string }): Promise<any> {
    this.logger.info(\`Processing message: \${params.message}\`);

    // Example: Make an API call
    // const response = await this.api.get('/api/core/system/status');

    // Emit an event
    this.emit('${id}.example.processed', { message: params.message });

    return {
      success: true,
      message: \`Processed: \${params.message}\`,
      timestamp: new Date().toISOString(),
    };
  }
}
`,

  /**
   * Generate package.json for NPM distribution
   */
  packageJson: (name: string, id: string, category: string, description: string, author: string) => ({
    name: `@opnsense-mcp/${id}`,
    version: '1.0.0',
    description,
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      prepublishOnly: 'npm run build',
      test: 'echo "Tests not configured"',
    },
    keywords: [
      'opnsense',
      'opnsense-mcp',
      'opnsense-mcp-plugin',
      'mcp',
      'firewall',
      category,
    ],
    author,
    license: 'MIT',
    files: [
      'dist/',
      'config.json',
      'README.md',
    ],
    opnsenseMcp: {
      pluginId: id,
      type: 'plugin',
      minServerVersion: '0.8.0',
      entryPoint: 'dist/index.js',
      capabilities: [],
    },
    peerDependencies: {
      'opnsense-mcp-sdk': '^1.0.0',
    },
    devDependencies: {
      'opnsense-mcp-sdk': '^1.0.0',
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    },
  }),

  /**
   * Generate tsconfig.json
   */
  tsconfig: () => ({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }),

  /**
   * Generate README.md
   */
  readme: (name: string, id: string, category: string, description: string) => `# ${name}

${description}

## Installation

\`\`\`bash
# Using the OPNsense MCP CLI
npx opnsense-mcp-plugin install @opnsense-mcp/${id}

# Or using npm directly
npm install @opnsense-mcp/${id}
\`\`\`

## Configuration

Add to your OPNsense MCP configuration:

\`\`\`json
{
  "plugins": {
    "external": [
      {
        "source": "@opnsense-mcp/${id}",
        "type": "npm",
        "enabled": true
      }
    ]
  }
}
\`\`\`

## Tools

### ${id.replace(/-/g, '_')}_example

Example tool for ${name}.

**Parameters:**
- \`message\` (string, required): A message to process

**Example:**
\`\`\`json
{
  "name": "${id.replace(/-/g, '_')}_example",
  "arguments": {
    "message": "Hello, World!"
  }
}
\`\`\`

## Resources

- \`plugin://${category}/${id}/status\` - Current plugin status

## Events

- \`${id}.example.processed\` - Emitted when a message is processed

## Development

\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
npm link
\`\`\`

## License

MIT
`,

  /**
   * Generate .gitignore
   */
  gitignore: () => `# Dependencies
node_modules/

# Build output
dist/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Environment
.env
.env.local
`,
};

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Ensure directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Parse CLI arguments
 */
function parseArgs(args: string[]): { command: string; positional: string[]; options: Record<string, string | boolean> } {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!command && !arg.startsWith('-')) {
      command = arg;
    } else if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        options[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options[key] = args[++i];
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options[key] = args[++i];
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, options };
}

/**
 * Create a new plugin from template
 */
async function createPlugin(name: string, options: Record<string, string | boolean>): Promise<void> {
  const category = (options.category as string) || 'custom';
  const description = (options.description as string) || `${name} plugin for OPNsense MCP`;
  const author = (options.author as string) || process.env.USER || 'Unknown';
  const outputDir = (options.output as string) || `./${name.toLowerCase().replace(/\s+/g, '-')}`;

  // Generate plugin ID
  const id = `${category}-${name.toLowerCase().replace(/\s+/g, '-')}`;

  logger.info(`Creating new plugin: ${name}`);
  logger.info(`  ID: ${id}`);
  logger.info(`  Category: ${category}`);
  logger.info(`  Output: ${outputDir}`);

  // Validate category
  if (!Object.values(PluginCategory).includes(category as PluginCategory)) {
    logger.warn(`Unknown category "${category}". Valid categories: ${Object.values(PluginCategory).join(', ')}`);
  }

  // Create directory structure
  const pluginDir = resolve(outputDir);
  const srcDir = join(pluginDir, 'src');

  await ensureDir(pluginDir);
  await ensureDir(srcDir);

  // Write files
  const files = [
    { path: join(pluginDir, 'config.json'), content: JSON.stringify(templates.config(name, id, category, description, author), null, 2) },
    { path: join(srcDir, 'index.ts'), content: templates.indexTs(name, id, category, description) },
    { path: join(pluginDir, 'package.json'), content: JSON.stringify(templates.packageJson(name, id, category, description, author), null, 2) },
    { path: join(pluginDir, 'tsconfig.json'), content: JSON.stringify(templates.tsconfig(), null, 2) },
    { path: join(pluginDir, 'README.md'), content: templates.readme(name, id, category, description) },
    { path: join(pluginDir, '.gitignore'), content: templates.gitignore() },
  ];

  for (const file of files) {
    await writeFile(file.path, file.content);
    logger.debug(`Created: ${file.path}`);
  }

  logger.success(`Plugin created successfully!`);
  console.log(`
Next steps:
  1. cd ${outputDir}
  2. npm install
  3. Edit src/index.ts to implement your plugin
  4. npm run build
  5. Test your plugin locally

To publish to NPM:
  npm publish --access public
`);
}

/**
 * Install a plugin
 */
async function installPlugin(source: string, options: Record<string, string | boolean>): Promise<void> {
  const type = (options.type as string)?.toLowerCase() || 'auto';
  const installDir = (options.dir as string) || join(process.cwd(), '.opnsense-mcp-plugins');

  logger.info(`Installing plugin from: ${source}`);

  // Create external loader
  const registry = new PluginRegistry(logger as any);
  const loaderOptions: ExternalPluginLoaderOptions = {
    installDirectory: installDir,
    validatePlugins: !options['skip-validation'],
    autoInstallDeps: !options['no-deps'],
    githubToken: process.env.GITHUB_TOKEN,
  };

  const loader = new ExternalPluginLoader(registry, logger as any, loaderOptions);
  await loader.initialize();

  // Determine source type
  let sourceType = type;
  if (type === 'auto') {
    if (source.includes('github.com')) {
      sourceType = 'github';
    } else if (source.startsWith('@') || source.match(/^[a-z][-a-z0-9]*$/)) {
      sourceType = 'npm';
    } else if (source.startsWith('/') || source.startsWith('.')) {
      sourceType = 'directory';
    } else {
      sourceType = 'npm';
    }
  }

  let result;
  switch (sourceType) {
    case 'npm':
      result = await loader.installFromNpm(source, options.version as string);
      break;
    case 'github':
      result = await loader.installFromGitHub(source, options.ref as string);
      break;
    case 'directory':
      result = await loader.installFromDirectory(source);
      break;
    default:
      logger.error(`Unknown source type: ${sourceType}`);
      process.exit(1);
  }

  if (result) {
    logger.success(`Plugin installed: ${result.id} v${result.version}`);
  } else {
    logger.error('Failed to install plugin');
    process.exit(1);
  }
}

/**
 * Uninstall a plugin
 */
async function uninstallPlugin(pluginId: string, options: Record<string, string | boolean>): Promise<void> {
  const installDir = (options.dir as string) || join(process.cwd(), '.opnsense-mcp-plugins');

  logger.info(`Uninstalling plugin: ${pluginId}`);

  const registry = new PluginRegistry(logger as any);
  const loaderOptions: ExternalPluginLoaderOptions = {
    installDirectory: installDir,
  };

  const loader = new ExternalPluginLoader(registry, logger as any, loaderOptions);
  await loader.initialize();

  const success = await loader.uninstall(pluginId);
  if (success) {
    logger.success(`Plugin uninstalled: ${pluginId}`);
  } else {
    logger.error(`Plugin not found: ${pluginId}`);
    process.exit(1);
  }
}

/**
 * List plugins
 */
async function listPlugins(options: Record<string, string | boolean>): Promise<void> {
  const installDir = (options.dir as string) || join(process.cwd(), '.opnsense-mcp-plugins');

  const registry = new PluginRegistry(logger as any);
  const loaderOptions: ExternalPluginLoaderOptions = {
    installDirectory: installDir,
  };

  const loader = new ExternalPluginLoader(registry, logger as any, loaderOptions);
  await loader.initialize();

  const plugins = loader.getInstalledPlugins();

  if (plugins.length === 0) {
    logger.info('No plugins installed');
    return;
  }

  console.log('\nInstalled Plugins:\n');
  console.log('ID'.padEnd(30) + 'Version'.padEnd(12) + 'Source'.padEnd(12) + 'Enabled');
  console.log('-'.repeat(70));

  for (const plugin of plugins) {
    const enabled = plugin.config.enabled !== false ? 'Yes' : 'No';
    console.log(
      plugin.id.padEnd(30) +
      plugin.version.padEnd(12) +
      plugin.source.padEnd(12) +
      enabled
    );
  }

  console.log(`\nTotal: ${plugins.length} plugins`);
}

/**
 * Validate a plugin
 */
async function validatePlugin(path: string, _options: Record<string, string | boolean>): Promise<void> {
  const pluginPath = resolve(path);
  logger.info(`Validating plugin: ${pluginPath}`);

  const validator = new PluginValidator(logger as any);
  const result = await validator.validatePluginDirectory(pluginPath);

  console.log('\nValidation Results:\n');

  if (result.errors.length > 0) {
    console.log('Errors:');
    for (const error of result.errors) {
      console.log(`  ❌ ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of result.warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
  }

  if (result.valid) {
    logger.success('Plugin is valid!');
    if (result.metadata) {
      console.log(`\nPlugin Info:`);
      console.log(`  ID: ${result.metadata.id}`);
      console.log(`  Name: ${result.metadata.name}`);
      console.log(`  Version: ${result.metadata.version}`);
      console.log(`  Category: ${result.metadata.category}`);
    }
  } else {
    logger.error('Plugin validation failed');
    process.exit(1);
  }
}

/**
 * Show plugin info
 */
async function showPluginInfo(pluginId: string, options: Record<string, string | boolean>): Promise<void> {
  const installDir = (options.dir as string) || join(process.cwd(), '.opnsense-mcp-plugins');

  const registry = new PluginRegistry(logger as any);
  const loaderOptions: ExternalPluginLoaderOptions = {
    installDirectory: installDir,
  };

  const loader = new ExternalPluginLoader(registry, logger as any, loaderOptions);
  await loader.initialize();

  const plugin = loader.getInstalledPlugin(pluginId);

  if (!plugin) {
    logger.error(`Plugin not found: ${pluginId}`);
    process.exit(1);
  }

  console.log(`\nPlugin Information:\n`);
  console.log(`  ID:          ${plugin.id}`);
  console.log(`  Name:        ${plugin.name}`);
  console.log(`  Version:     ${plugin.version}`);
  console.log(`  Source:      ${plugin.source}`);
  console.log(`  Source Path: ${plugin.sourcePath}`);
  console.log(`  Installed:   ${plugin.installedAt.toISOString()}`);
  if (plugin.lastUpdated) {
    console.log(`  Updated:     ${plugin.lastUpdated.toISOString()}`);
  }
  console.log(`  Enabled:     ${plugin.config.enabled !== false ? 'Yes' : 'No'}`);
}

/**
 * Enable/disable a plugin
 */
async function setPluginEnabled(pluginId: string, enabled: boolean, options: Record<string, string | boolean>): Promise<void> {
  const installDir = (options.dir as string) || join(process.cwd(), '.opnsense-mcp-plugins');

  const registry = new PluginRegistry(logger as any);
  const loaderOptions: ExternalPluginLoaderOptions = {
    installDirectory: installDir,
  };

  const loader = new ExternalPluginLoader(registry, logger as any, loaderOptions);
  await loader.initialize();

  const success = await loader.setPluginEnabled(pluginId, enabled);
  if (success) {
    logger.success(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
  } else {
    logger.error(`Plugin not found: ${pluginId}`);
    process.exit(1);
  }
}

/**
 * Update a plugin
 */
async function updatePlugin(pluginId: string, options: Record<string, string | boolean>): Promise<void> {
  const installDir = (options.dir as string) || join(process.cwd(), '.opnsense-mcp-plugins');

  logger.info(`Updating plugin: ${pluginId}`);

  const registry = new PluginRegistry(logger as any);
  const loaderOptions: ExternalPluginLoaderOptions = {
    installDirectory: installDir,
    autoInstallDeps: true,
  };

  const loader = new ExternalPluginLoader(registry, logger as any, loaderOptions);
  await loader.initialize();

  const success = await loader.updatePlugin(pluginId);
  if (success) {
    logger.success(`Plugin updated: ${pluginId}`);
  } else {
    logger.error(`Failed to update plugin: ${pluginId}`);
    process.exit(1);
  }
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
OPNsense MCP Plugin CLI

Usage:
  opnsense-mcp-plugin <command> [options]

Commands:
  create <name>              Create a new plugin from template
    --category <cat>         Plugin category (default: custom)
    --description <desc>     Plugin description
    --author <name>          Author name
    --output <dir>           Output directory

  install <source>           Install a plugin
    --type <type>            Source type: npm, github, directory (auto-detected)
    --version <ver>          Version constraint (for npm)
    --ref <ref>              Git ref (for github)
    --dir <dir>              Installation directory
    --skip-validation        Skip plugin validation
    --no-deps                Don't install dependencies

  uninstall <plugin-id>      Uninstall a plugin
    --dir <dir>              Installation directory

  list                       List installed plugins
    --dir <dir>              Installation directory

  enable <plugin-id>         Enable a plugin
    --dir <dir>              Installation directory

  disable <plugin-id>        Disable a plugin
    --dir <dir>              Installation directory

  update <plugin-id>         Update a plugin
    --dir <dir>              Installation directory

  validate <path>            Validate a plugin directory

  info <plugin-id>           Show plugin information
    --dir <dir>              Installation directory

  help                       Show this help message

Examples:
  # Create a new plugin
  opnsense-mcp-plugin create "My Plugin" --category monitoring

  # Install from NPM
  opnsense-mcp-plugin install @opnsense-mcp/plugin-name

  # Install from GitHub
  opnsense-mcp-plugin install https://github.com/user/repo

  # Install from local directory
  opnsense-mcp-plugin install ./my-plugin --type directory

  # Validate a plugin
  opnsense-mcp-plugin validate ./my-plugin
`);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const { command, positional, options } = parseArgs(args);

  try {
    switch (command) {
      case 'create':
        if (!positional[0]) {
          logger.error('Plugin name required');
          process.exit(1);
        }
        await createPlugin(positional[0], options);
        break;

      case 'install':
        if (!positional[0]) {
          logger.error('Plugin source required');
          process.exit(1);
        }
        await installPlugin(positional[0], options);
        break;

      case 'uninstall':
        if (!positional[0]) {
          logger.error('Plugin ID required');
          process.exit(1);
        }
        await uninstallPlugin(positional[0], options);
        break;

      case 'list':
        await listPlugins(options);
        break;

      case 'enable':
        if (!positional[0]) {
          logger.error('Plugin ID required');
          process.exit(1);
        }
        await setPluginEnabled(positional[0], true, options);
        break;

      case 'disable':
        if (!positional[0]) {
          logger.error('Plugin ID required');
          process.exit(1);
        }
        await setPluginEnabled(positional[0], false, options);
        break;

      case 'update':
        if (!positional[0]) {
          logger.error('Plugin ID required');
          process.exit(1);
        }
        await updatePlugin(positional[0], options);
        break;

      case 'validate':
        if (!positional[0]) {
          logger.error('Plugin path required');
          process.exit(1);
        }
        await validatePlugin(positional[0], options);
        break;

      case 'info':
        if (!positional[0]) {
          logger.error('Plugin ID required');
          process.exit(1);
        }
        await showPluginInfo(positional[0], options);
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error('Command failed:', error instanceof Error ? error.message : error);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run CLI
main();
