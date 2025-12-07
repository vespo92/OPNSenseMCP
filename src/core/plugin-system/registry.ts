/**
 * Plugin Registry
 *
 * Manages plugin lifecycle and registration
 */

import {
  PluginState,
  type MCPPlugin,
  type PluginRegistryEntry,
  type PluginContext,
  type HealthStatus,
} from '../types/plugin.js';
import type { Logger } from '../../utils/logger.js';
import { EventType, EventSeverity } from '../types/events.js';

/**
 * Plugin registry for managing loaded plugins
 */
export class PluginRegistry {
  private plugins = new Map<string, PluginRegistryEntry>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a plugin
   */
  register(plugin: MCPPlugin, config: any): void {
    if (this.plugins.has(plugin.metadata.id)) {
      throw new Error(`Plugin already registered: ${plugin.metadata.id}`);
    }

    const entry: PluginRegistryEntry = {
      plugin,
      config,
      loadedAt: new Date(),
      state: plugin.state,
    };

    this.plugins.set(plugin.metadata.id, entry);
    this.logger.info(`Registered plugin: ${plugin.metadata.id} (${plugin.metadata.name})`);
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<boolean> {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      return false;
    }

    // Stop plugin if running
    if (entry.state === 'running') {
      await entry.plugin.stop();
    }

    // Cleanup
    if (entry.plugin.cleanup) {
      await entry.plugin.cleanup();
    }

    this.plugins.delete(pluginId);
    this.logger.info(`Unregistered plugin: ${pluginId}`);
    return true;
  }

  /**
   * Get plugin by ID
   */
  get(pluginId: string): MCPPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Get plugin entry (with metadata)
   */
  getEntry(pluginId: string): PluginRegistryEntry | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if plugin exists
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAll(): MCPPlugin[] {
    return Array.from(this.plugins.values()).map(entry => entry.plugin);
  }

  /**
   * Get all plugin entries
   */
  getAllEntries(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by category
   */
  getByCategory(category: string): MCPPlugin[] {
    return Array.from(this.plugins.values())
      .filter(entry => entry.plugin.metadata.category === category)
      .map(entry => entry.plugin);
  }

  /**
   * Get all plugin IDs
   */
  getPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Initialize all registered plugins
   */
  async initializeAll(context: PluginContext): Promise<void> {
    // Resolve dependency order
    const sorted = this.resolveDependencies();

    for (const pluginId of sorted) {
      const entry = this.plugins.get(pluginId);
      if (!entry) continue;

      try {
        this.logger.info(`Initializing plugin: ${pluginId}`);
        await entry.plugin.initialize(context);
        entry.state = entry.plugin.state;
      } catch (error) {
        this.logger.error(`Failed to initialize plugin ${pluginId}:`, error);
        entry.state = PluginState.ERROR;
      }
    }
  }

  /**
   * Start all initialized plugins
   */
  async startAll(): Promise<void> {
    for (const entry of this.plugins.values()) {
      if (entry.state === 'initialized' || entry.state === 'stopped') {
        try {
          this.logger.info(`Starting plugin: ${entry.plugin.metadata.id}`);
          await entry.plugin.start();
          entry.state = entry.plugin.state;
        } catch (error) {
          this.logger.error(`Failed to start plugin ${entry.plugin.metadata.id}:`, error);
          entry.state = PluginState.ERROR;
        }
      }
    }
  }

  /**
   * Stop all running plugins
   */
  async stopAll(): Promise<void> {
    // Stop in reverse dependency order
    const sorted = this.resolveDependencies().reverse();

    for (const pluginId of sorted) {
      const entry = this.plugins.get(pluginId);
      if (!entry) continue;

      if (entry.state === 'running') {
        try {
          this.logger.info(`Stopping plugin: ${pluginId}`);
          await entry.plugin.stop();
          entry.state = entry.plugin.state;
        } catch (error) {
          this.logger.error(`Failed to stop plugin ${pluginId}:`, error);
        }
      }
    }
  }

  /**
   * Health check all plugins
   */
  async healthCheckAll(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    for (const [pluginId, entry] of this.plugins) {
      try {
        const health = await entry.plugin.healthCheck();
        entry.health = health;
        results.set(pluginId, health);
      } catch (error) {
        const health: HealthStatus = {
          healthy: false,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date(),
        };
        entry.health = health;
        results.set(pluginId, health);
      }
    }

    return results;
  }

  /**
   * Resolve plugin dependencies and return sorted list
   */
  private resolveDependencies(): string[] {
    const visited = new Set<string>();
    const sorted: string[] = [];
    const visiting = new Set<string>();

    const visit = (pluginId: string) => {
      if (visited.has(pluginId)) return;
      if (visiting.has(pluginId)) {
        throw new Error(`Circular dependency detected: ${pluginId}`);
      }

      const entry = this.plugins.get(pluginId);
      if (!entry) return;

      visiting.add(pluginId);

      const dependencies = entry.plugin.getDependencies();
      for (const depId of dependencies) {
        if (!this.plugins.has(depId)) {
          throw new Error(`Missing dependency: ${depId} for plugin ${pluginId}`);
        }
        visit(depId);
      }

      visiting.delete(pluginId);
      visited.add(pluginId);
      sorted.push(pluginId);
    };

    // Visit all plugins
    for (const pluginId of this.plugins.keys()) {
      visit(pluginId);
    }

    return sorted;
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    total: number;
    byState: Record<string, number>;
    byCategory: Record<string, number>;
    healthy: number;
    unhealthy: number;
  } {
    const stats = {
      total: this.plugins.size,
      byState: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      healthy: 0,
      unhealthy: 0,
    };

    for (const entry of this.plugins.values()) {
      // Count by state
      stats.byState[entry.state] = (stats.byState[entry.state] || 0) + 1;

      // Count by category
      const category = entry.plugin.metadata.category;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Count health
      if (entry.health) {
        if (entry.health.healthy) {
          stats.healthy++;
        } else {
          stats.unhealthy++;
        }
      }
    }

    return stats;
  }

  /**
   * Clear all plugins
   */
  async clear(): Promise<void> {
    await this.stopAll();

    for (const entry of this.plugins.values()) {
      if (entry.plugin.cleanup) {
        await entry.plugin.cleanup();
      }
    }

    this.plugins.clear();
  }
}
