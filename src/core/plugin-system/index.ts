/**
 * Plugin System Index
 *
 * Exports all plugin system components
 */

// Core components
export { BasePlugin } from './base-plugin.js';
export { PluginRegistry } from './registry.js';
export { PluginLoader } from './loader.js';
export { PluginValidator } from './validator.js';
export { ExternalPluginLoader } from './external-loader.js';
export { PluginManager } from './plugin-manager.js';

// Types from plugin manager
export {
  type PluginManagerConfig,
  type PluginInfo,
} from './plugin-manager.js';

// Types from external loader
export {
  ExternalPluginSource,
  type ExternalPluginConfig,
  type ExternalPluginManifest,
  type InstalledPluginInfo,
  type ExternalPluginLoaderOptions,
} from './external-loader.js';

// Types from validator
export {
  type ValidationResult,
  type SecurityCheckResult,
  type SecurityIssue,
  type PluginCapabilities,
} from './validator.js';

// Re-export core types
export {
  PluginCategory,
  PluginState,
  type HealthStatus,
  type PluginMetadata,
  type PluginContext,
  type MCPTool,
  type MCPResource,
  type MCPPrompt,
  type EventHandler,
  type MCPPlugin,
  type PluginConfig,
  type PluginRegistryEntry,
  type PluginLoaderOptions,
} from '../types/plugin.js';
