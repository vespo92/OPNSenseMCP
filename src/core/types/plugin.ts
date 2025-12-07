/**
 * Core Plugin System Types
 *
 * Defines interfaces and types for the modular plugin architecture
 */

import type { OPNSenseAPIClient } from '../../api/client.js';
import type { SSHExecutor } from '../../resources/ssh/executor.js';
import type { EventBus } from '../event-bus/bus.js';
import type { MCPCacheManager } from '../../cache/manager.js';
import type { ResourceStateStore } from '../../state/store.js';
import type { Logger } from '../../utils/logger.js';

/**
 * Plugin categories matching OPNsense's organization
 */
export enum PluginCategory {
  CORE = 'core',
  SECURITY = 'security',
  VPN = 'vpn',
  ROUTING = 'routing',
  TRAFFIC = 'traffic',
  SERVICES = 'services',
  MONITORING = 'monitoring',
  PROXY = 'proxy',
  BACKUP = 'backup',
  UTILITY = 'utility',
  CUSTOM = 'custom',
}

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Health check status
 */
export interface HealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Unique plugin identifier (e.g., 'core-firewall', 'vpn-wireguard') */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Semantic version */
  version: string;

  /** Plugin description */
  description: string;

  /** Plugin category */
  category: PluginCategory;

  /** Plugin author/maintainer */
  author: string;

  /** Required OPNsense version (semver range) */
  opnsenseVersion?: string;

  /** Is plugin enabled by default */
  enabled: boolean;

  /** Plugin-specific configuration */
  config?: Record<string, any>;

  /** Plugin tags for discovery */
  tags?: string[];

  /** Homepage or documentation URL */
  homepage?: string;

  /** License identifier */
  license?: string;
}

/**
 * Plugin context provided during initialization
 */
export interface PluginContext {
  /** OPNsense REST API client */
  apiClient: OPNSenseAPIClient;

  /** SSH command executor */
  sshExecutor: SSHExecutor;

  /** Event bus for pub/sub */
  eventBus: EventBus;

  /** Cache manager */
  cache: MCPCacheManager;

  /** State store */
  state: ResourceStateStore;

  /** Logger instance */
  logger: Logger;

  /** Plugin configuration */
  config: Record<string, any>;

  /** Get another plugin by ID */
  getPlugin: (pluginId: string) => MCPPlugin | undefined;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  handler: (params: any) => Promise<any>;
}

/**
 * MCP Resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: () => Promise<any>;
}

/**
 * MCP Prompt definition
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  handler: (args: Record<string, string>) => Promise<{
    messages: Array<{
      role: 'user' | 'assistant';
      content: {
        type: 'text';
        text: string;
      };
    }>;
  }>;
}

/**
 * Event handler type
 */
export type EventHandler = (data: any) => void | Promise<void>;

/**
 * Main plugin interface that all plugins must implement
 */
export interface MCPPlugin {
  /** Plugin metadata */
  readonly metadata: PluginMetadata;

  /** Current plugin state */
  readonly state: PluginState;

  /**
   * Initialize the plugin with provided context
   * Called once when plugin is first loaded
   */
  initialize(context: PluginContext): Promise<void>;

  /**
   * Start the plugin
   * Called when plugin should begin operation
   */
  start(): Promise<void>;

  /**
   * Stop the plugin
   * Called when plugin should cease operation
   */
  stop(): Promise<void>;

  /**
   * Perform health check
   * Called periodically to verify plugin health
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get MCP tools provided by this plugin
   */
  getTools(): MCPTool[];

  /**
   * Get MCP resources provided by this plugin
   */
  getResources(): MCPResource[];

  /**
   * Get MCP prompts provided by this plugin
   */
  getPrompts(): MCPPrompt[];

  /**
   * Get plugin dependencies (other plugin IDs)
   */
  getDependencies(): string[];

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler): void;

  /**
   * Emit an event
   */
  emit(event: string, data: any): void;

  /**
   * Cleanup resources
   * Called before plugin is unloaded
   */
  cleanup?(): Promise<void>;
}

/**
 * Plugin configuration from config file
 */
export interface PluginConfig {
  metadata: PluginMetadata;
  config?: Record<string, any>;
  dependencies?: string[];
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  plugin: MCPPlugin;
  config: PluginConfig;
  loadedAt: Date;
  state: PluginState;
  health?: HealthStatus;
}

/**
 * Plugin loader options
 */
export interface PluginLoaderOptions {
  /** Directory to scan for plugins */
  pluginsDirectory: string;

  /** Auto-load plugins on startup */
  autoLoad: boolean;

  /** List of enabled plugin IDs */
  enabled?: string[];

  /** List of disabled plugin IDs */
  disabled?: string[];

  /** Plugin-specific configurations */
  configs?: Record<string, any>;
}
