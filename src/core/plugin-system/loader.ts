/**
 * Plugin Loader
 *
 * Discovers and loads plugins from filesystem
 */

import { readdir, readFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import type {
  MCPPlugin,
  PluginConfig,
  PluginLoaderOptions,
  PluginContext,
} from '../types/plugin.js';
import type { Logger } from '../../utils/logger.js';
import { PluginRegistry } from './registry.js';

/**
 * Plugin loader for discovering and loading plugins
 */
export class PluginLoader {
  private registry: PluginRegistry;
  private logger: Logger;
  private options: PluginLoaderOptions;

  constructor(
    registry: PluginRegistry,
    logger: Logger,
    options: PluginLoaderOptions
  ) {
    this.registry = registry;
    this.logger = logger;
    this.options = options;
  }

  /**
   * Discover plugins in directory
   */
  async discover(): Promise<string[]> {
    const pluginDir = resolve(this.options.pluginsDirectory);

    try {
      await access(pluginDir);
    } catch {
      this.logger.warn(`Plugin directory not found: ${pluginDir}`);
      return [];
    }

    const discovered: string[] = [];

    try {
      // Read category directories
      const categories = await readdir(pluginDir, { withFileTypes: true });

      for (const category of categories) {
        if (!category.isDirectory()) continue;

        const categoryPath = join(pluginDir, category.name);
        const plugins = await readdir(categoryPath, { withFileTypes: true });

        for (const plugin of plugins) {
          if (!plugin.isDirectory()) continue;

          const pluginPath = join(categoryPath, plugin.name);
          const configPath = join(pluginPath, 'config.json');

          try {
            await access(configPath);
            discovered.push(pluginPath);
            this.logger.debug(`Discovered plugin: ${plugin.name} in ${category.name}`);
          } catch {
            this.logger.debug(`Skipping ${plugin.name}: no config.json`);
          }
        }
      }

      this.logger.info(`Discovered ${discovered.length} plugins`);
      return discovered;
    } catch (error) {
      this.logger.error('Error discovering plugins:', error);
      return [];
    }
  }

  /**
   * Load plugin from path
   */
  async loadPlugin(pluginPath: string): Promise<MCPPlugin | null> {
    try {
      // Read config
      const configPath = join(pluginPath, 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config: PluginConfig = JSON.parse(configContent);

      // Check if plugin is enabled
      if (!this.isPluginEnabled(config.metadata.id)) {
        this.logger.debug(`Plugin ${config.metadata.id} is disabled`);
        return null;
      }

      // Load plugin module
      const indexPath = join(pluginPath, 'index.js');

      try {
        await access(indexPath);
      } catch {
        // Try TypeScript file if JavaScript doesn't exist
        const tsPath = join(pluginPath, 'index.ts');
        try {
          await access(tsPath);
          this.logger.warn(`Plugin ${config.metadata.id} has TypeScript source but no compiled JS. Please compile first.`);
          return null;
        } catch {
          this.logger.error(`Plugin ${config.metadata.id} missing index.js/index.ts`);
          return null;
        }
      }

      // Import plugin
      const module = await import(indexPath);
      const PluginClass = module.default || module[Object.keys(module)[0]];

      if (!PluginClass) {
        this.logger.error(`Plugin ${config.metadata.id} has no default export`);
        return null;
      }

      // Instantiate plugin
      const pluginConfig = {
        ...config.config,
        ...(this.options.configs?.[config.metadata.id] || {}),
      };

      const plugin: MCPPlugin = new PluginClass(pluginConfig);

      // Validate plugin
      if (!this.validatePlugin(plugin)) {
        this.logger.error(`Plugin ${config.metadata.id} failed validation`);
        return null;
      }

      // Register plugin
      this.registry.register(plugin, config);
      this.logger.info(`Loaded plugin: ${config.metadata.id} v${config.metadata.version}`);

      return plugin;
    } catch (error) {
      this.logger.error(`Error loading plugin from ${pluginPath}:`, error);
      return null;
    }
  }

  /**
   * Load all discovered plugins
   */
  async loadAll(): Promise<MCPPlugin[]> {
    const pluginPaths = await this.discover();
    const loaded: MCPPlugin[] = [];

    for (const path of pluginPaths) {
      const plugin = await this.loadPlugin(path);
      if (plugin) {
        loaded.push(plugin);
      }
    }

    this.logger.info(`Loaded ${loaded.length} plugins`);
    return loaded;
  }

  /**
   * Check if plugin is enabled
   */
  private isPluginEnabled(pluginId: string): boolean {
    // Check disabled list first
    if (this.options.disabled?.includes(pluginId)) {
      return false;
    }

    // If enabled list exists, plugin must be in it
    if (this.options.enabled && this.options.enabled.length > 0) {
      return this.options.enabled.includes(pluginId);
    }

    // Default: enabled
    return true;
  }

  /**
   * Validate plugin implementation
   */
  private validatePlugin(plugin: any): plugin is MCPPlugin {
    // Check required properties
    if (!plugin.metadata) {
      this.logger.error('Plugin missing metadata');
      return false;
    }

    // Check required metadata fields
    const required = ['id', 'name', 'version', 'description', 'category'];
    for (const field of required) {
      if (!plugin.metadata[field]) {
        this.logger.error(`Plugin metadata missing required field: ${field}`);
        return false;
      }
    }

    // Check required methods
    const methods = [
      'initialize',
      'start',
      'stop',
      'healthCheck',
      'getTools',
      'getResources',
      'getPrompts',
      'getDependencies',
    ];

    for (const method of methods) {
      if (typeof plugin[method] !== 'function') {
        this.logger.error(`Plugin missing required method: ${method}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Reload a specific plugin
   */
  async reloadPlugin(pluginId: string, pluginPath: string): Promise<boolean> {
    try {
      // Unregister existing plugin
      await this.registry.unregister(pluginId);

      // Load fresh instance
      const plugin = await this.loadPlugin(pluginPath);

      return plugin !== null;
    } catch (error) {
      this.logger.error(`Error reloading plugin ${pluginId}:`, error);
      return false;
    }
  }
}
