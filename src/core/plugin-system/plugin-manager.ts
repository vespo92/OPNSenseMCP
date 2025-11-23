/**
 * Plugin Manager
 *
 * High-level plugin management interface that integrates internal and external plugins
 */

import { join, resolve } from 'path';
import { access, readFile, writeFile, mkdir } from 'fs/promises';
import type {
  MCPPlugin,
  PluginContext,
  PluginConfig,
  PluginLoaderOptions,
  MCPTool,
  MCPResource,
  MCPPrompt,
} from '../types/plugin.js';
import type { Logger } from '../../utils/logger.js';
import { PluginRegistry } from './registry.js';
import { PluginLoader } from './loader.js';
import { ExternalPluginLoader, ExternalPluginSource, type ExternalPluginLoaderOptions, type ExternalPluginConfig } from './external-loader.js';

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  /** Directory for built-in plugins */
  builtinPluginsDir: string;

  /** Directory for external plugins */
  externalPluginsDir: string;

  /** Additional directories to scan for plugins */
  additionalDirs?: string[];

  /** External plugin sources to install/load */
  externalPlugins?: ExternalPluginConfig[];

  /** List of enabled plugin IDs (if set, only these are loaded) */
  enabledPlugins?: string[];

  /** List of disabled plugin IDs */
  disabledPlugins?: string[];

  /** Plugin-specific configurations */
  pluginConfigs?: Record<string, any>;

  /** Auto-load plugins on initialization */
  autoLoad?: boolean;

  /** Auto-start plugins after loading */
  autoStart?: boolean;

  /** Validate plugins before loading */
  validatePlugins?: boolean;

  /** NPM registry URL */
  npmRegistry?: string;

  /** GitHub token for private repos */
  githubToken?: string;
}

/**
 * Plugin info for listing
 */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  author: string;
  state: string;
  source: 'builtin' | 'external';
  enabled: boolean;
  tools: string[];
  resources: string[];
}

/**
 * Plugin Manager
 *
 * Unified interface for managing all plugins (builtin and external)
 */
export class PluginManager {
  private registry: PluginRegistry;
  private builtinLoader: PluginLoader;
  private externalLoader: ExternalPluginLoader;
  private logger: Logger;
  private config: PluginManagerConfig;
  private context: PluginContext | null = null;
  private configPath: string;
  private initialized = false;

  constructor(logger: Logger, config: PluginManagerConfig) {
    this.logger = logger;
    this.config = {
      autoLoad: true,
      autoStart: true,
      validatePlugins: true,
      ...config,
    };

    // Initialize registry
    this.registry = new PluginRegistry(logger);

    // Initialize builtin loader
    const builtinOptions: PluginLoaderOptions = {
      pluginsDirectory: config.builtinPluginsDir,
      autoLoad: config.autoLoad ?? true,
      enabled: config.enabledPlugins,
      disabled: config.disabledPlugins,
      configs: config.pluginConfigs,
    };
    this.builtinLoader = new PluginLoader(this.registry, logger, builtinOptions);

    // Initialize external loader
    const externalOptions: ExternalPluginLoaderOptions = {
      installDirectory: config.externalPluginsDir,
      additionalDirectories: config.additionalDirs,
      validatePlugins: config.validatePlugins,
      autoInstallDeps: true,
      npmRegistry: config.npmRegistry,
      githubToken: config.githubToken,
    };
    this.externalLoader = new ExternalPluginLoader(this.registry, logger, externalOptions);

    this.configPath = join(config.externalPluginsDir, 'plugin-manager.json');
  }

  /**
   * Initialize the plugin manager
   */
  async initialize(context: PluginContext): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.context = context;
    this.logger.info('Initializing plugin manager...');

    // Ensure directories exist
    await this.ensureDirectory(this.config.builtinPluginsDir);
    await this.ensureDirectory(this.config.externalPluginsDir);

    // Initialize external loader
    await this.externalLoader.initialize();

    // Load saved configuration
    await this.loadSavedConfig();

    if (this.config.autoLoad) {
      await this.loadAllPlugins();
    }

    if (this.config.autoStart) {
      await this.startAllPlugins();
    }

    this.initialized = true;
    this.logger.info('Plugin manager initialized');
  }

  /**
   * Load all plugins (builtin and external)
   */
  async loadAllPlugins(): Promise<void> {
    this.logger.info('Loading plugins...');

    // Load builtin plugins
    const builtinPlugins = await this.builtinLoader.loadAll();
    this.logger.info(`Loaded ${builtinPlugins.length} builtin plugins`);

    // Install and load configured external plugins
    for (const extConfig of this.config.externalPlugins || []) {
      if (extConfig.enabled !== false) {
        await this.installExternalPlugin(extConfig);
      }
    }

    // Load all installed external plugins
    if (this.context) {
      const externalPlugins = await this.externalLoader.loadAll(this.context);
      this.logger.info(`Loaded ${externalPlugins.length} external plugins`);
    }

    // Initialize all plugins
    if (this.context) {
      await this.registry.initializeAll(this.context);
    }
  }

  /**
   * Start all loaded plugins
   */
  async startAllPlugins(): Promise<void> {
    await this.registry.startAll();
  }

  /**
   * Stop all running plugins
   */
  async stopAllPlugins(): Promise<void> {
    await this.registry.stopAll();
  }

  /**
   * Install an external plugin
   */
  async installExternalPlugin(config: ExternalPluginConfig): Promise<boolean> {
    try {
      let result;

      switch (config.type) {
        case ExternalPluginSource.NPM:
          result = await this.externalLoader.installFromNpm(config.source, config.version);
          break;
        case ExternalPluginSource.GITHUB:
          result = await this.externalLoader.installFromGitHub(config.source, config.version);
          break;
        case ExternalPluginSource.DIRECTORY:
          result = await this.externalLoader.installFromDirectory(config.source);
          break;
        default:
          this.logger.error(`Unknown plugin source type: ${config.type}`);
          return false;
      }

      if (result) {
        // Save to config
        await this.addExternalPluginConfig(config);

        // Load the plugin if we have context
        if (this.context) {
          const plugin = await this.externalLoader.loadPlugin(result.id, this.context);
          if (plugin && this.config.autoStart) {
            await plugin.start();
          }
        }

        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to install external plugin: ${config.source}`, error);
      return false;
    }
  }

  /**
   * Uninstall an external plugin
   */
  async uninstallExternalPlugin(pluginId: string): Promise<boolean> {
    const success = await this.externalLoader.uninstall(pluginId);

    if (success) {
      await this.removeExternalPluginConfig(pluginId);
    }

    return success;
  }

  /**
   * Update an external plugin
   */
  async updateExternalPlugin(pluginId: string): Promise<boolean> {
    // Stop the plugin if running
    const plugin = this.registry.get(pluginId);
    if (plugin && plugin.state === 'running') {
      await plugin.stop();
    }

    // Unregister from registry
    await this.registry.unregister(pluginId);

    // Update
    const success = await this.externalLoader.updatePlugin(pluginId);

    // Reload if successful
    if (success && this.context) {
      const reloaded = await this.externalLoader.loadPlugin(pluginId, this.context);
      if (reloaded && this.config.autoStart) {
        await reloaded.start();
      }
    }

    return success;
  }

  /**
   * Enable/disable a plugin
   */
  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<boolean> {
    // Check if it's an external plugin
    const externalInfo = this.externalLoader.getInstalledPlugin(pluginId);
    if (externalInfo) {
      return this.externalLoader.setPluginEnabled(pluginId, enabled);
    }

    // For builtin plugins, update the disabled list
    if (enabled) {
      this.config.disabledPlugins = this.config.disabledPlugins?.filter(id => id !== pluginId);
    } else {
      if (!this.config.disabledPlugins) {
        this.config.disabledPlugins = [];
      }
      if (!this.config.disabledPlugins.includes(pluginId)) {
        this.config.disabledPlugins.push(pluginId);
      }

      // Stop if running
      const plugin = this.registry.get(pluginId);
      if (plugin && plugin.state === 'running') {
        await plugin.stop();
      }
    }

    await this.saveConfig();
    return true;
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): MCPPlugin | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): MCPPlugin[] {
    return this.registry.getAll();
  }

  /**
   * Get plugin info list
   */
  getPluginList(): PluginInfo[] {
    const plugins: PluginInfo[] = [];

    for (const entry of this.registry.getAllEntries()) {
      const plugin = entry.plugin;
      const isExternal = this.externalLoader.getInstalledPlugin(plugin.metadata.id) !== undefined;

      plugins.push({
        id: plugin.metadata.id,
        name: plugin.metadata.name,
        version: plugin.metadata.version,
        description: plugin.metadata.description,
        category: plugin.metadata.category as string,
        author: plugin.metadata.author,
        state: plugin.state as string,
        source: isExternal ? 'external' : 'builtin',
        enabled: plugin.metadata.enabled,
        tools: plugin.getTools().map(t => t.name),
        resources: plugin.getResources().map(r => r.uri),
      });
    }

    return plugins;
  }

  /**
   * Get all tools from all plugins
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const plugin of this.registry.getAll()) {
      if (plugin.state === 'running') {
        tools.push(...plugin.getTools());
      }
    }

    return tools;
  }

  /**
   * Get all resources from all plugins
   */
  getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];

    for (const plugin of this.registry.getAll()) {
      if (plugin.state === 'running') {
        resources.push(...plugin.getResources());
      }
    }

    return resources;
  }

  /**
   * Get all prompts from all plugins
   */
  getAllPrompts(): MCPPrompt[] {
    const prompts: MCPPrompt[] = [];

    for (const plugin of this.registry.getAll()) {
      if (plugin.state === 'running') {
        prompts.push(...plugin.getPrompts());
      }
    }

    return prompts;
  }

  /**
   * Call a tool by name
   */
  async callTool(toolName: string, params: any): Promise<any> {
    for (const plugin of this.registry.getAll()) {
      if (plugin.state !== 'running') continue;

      const tools = plugin.getTools();
      const tool = tools.find(t => t.name === toolName);

      if (tool) {
        return tool.handler(params);
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  /**
   * Get a resource by URI
   */
  async getResource(uri: string): Promise<any> {
    for (const plugin of this.registry.getAll()) {
      if (plugin.state !== 'running') continue;

      const resources = plugin.getResources();
      const resource = resources.find(r => r.uri === uri);

      if (resource) {
        return resource.handler();
      }
    }

    throw new Error(`Resource not found: ${uri}`);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    builtin: number;
    external: number;
    running: number;
    stopped: number;
    error: number;
    tools: number;
    resources: number;
  } {
    const registryStats = this.registry.getStats();
    const externalCount = this.externalLoader.getInstalledPlugins().length;

    return {
      total: registryStats.total,
      builtin: registryStats.total - externalCount,
      external: externalCount,
      running: registryStats.byState['running'] || 0,
      stopped: registryStats.byState['stopped'] || 0,
      error: registryStats.byState['error'] || 0,
      tools: this.getAllTools().length,
      resources: this.getAllResources().length,
    };
  }

  /**
   * Perform health check on all plugins
   */
  async healthCheckAll(): Promise<Map<string, { healthy: boolean; message?: string }>> {
    return this.registry.healthCheckAll();
  }

  /**
   * Shutdown the plugin manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down plugin manager...');
    await this.stopAllPlugins();
    await this.registry.clear();
    await this.saveConfig();
    this.initialized = false;
    this.logger.info('Plugin manager shut down');
  }

  // Private methods

  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await access(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }
  }

  private async loadSavedConfig(): Promise<void> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      const saved = JSON.parse(content);

      // Merge saved external plugins
      if (saved.externalPlugins) {
        this.config.externalPlugins = [
          ...(this.config.externalPlugins || []),
          ...saved.externalPlugins.filter((sp: ExternalPluginConfig) =>
            !this.config.externalPlugins?.some(ep => ep.source === sp.source)
          ),
        ];
      }

      // Merge disabled plugins
      if (saved.disabledPlugins) {
        this.config.disabledPlugins = [
          ...new Set([
            ...(this.config.disabledPlugins || []),
            ...saved.disabledPlugins,
          ]),
        ];
      }
    } catch {
      // No saved config
    }
  }

  private async saveConfig(): Promise<void> {
    const toSave = {
      externalPlugins: this.config.externalPlugins,
      disabledPlugins: this.config.disabledPlugins,
      pluginConfigs: this.config.pluginConfigs,
    };
    await writeFile(this.configPath, JSON.stringify(toSave, null, 2));
  }

  private async addExternalPluginConfig(config: ExternalPluginConfig): Promise<void> {
    if (!this.config.externalPlugins) {
      this.config.externalPlugins = [];
    }

    const existing = this.config.externalPlugins.findIndex(p => p.source === config.source);
    if (existing >= 0) {
      this.config.externalPlugins[existing] = config;
    } else {
      this.config.externalPlugins.push(config);
    }

    await this.saveConfig();
  }

  private async removeExternalPluginConfig(pluginId: string): Promise<void> {
    if (this.config.externalPlugins) {
      this.config.externalPlugins = this.config.externalPlugins.filter(p => {
        const info = this.externalLoader.getInstalledPlugin(pluginId);
        return !info || p.source !== info.config.source;
      });
      await this.saveConfig();
    }
  }
}
