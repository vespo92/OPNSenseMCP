/**
 * OPNsense MCP Plugin SDK
 *
 * This module exports all types, classes, and utilities needed to develop
 * third-party plugins for the OPNsense MCP server.
 *
 * Usage in your plugin:
 *   import { BasePlugin, PluginCategory } from 'opnsense-mcp-sdk';
 *
 * @module opnsense-mcp-sdk
 */

// Core plugin types
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
} from '../core/types/plugin.js';

// Event types
export {
  EventType,
  EventSeverity,
  type MCPEvent,
  type EventFilter,
  type EventSubscription,
} from '../core/types/events.js';

// Base plugin class
export { BasePlugin } from '../core/plugin-system/base-plugin.js';

// Validator types (for plugin authors who want to validate their plugins)
export {
  PluginValidator,
  type ValidationResult,
  type SecurityCheckResult,
  type SecurityIssue,
  type PluginCapabilities,
} from '../core/plugin-system/validator.js';

// API Client types (useful for typing API responses)
export type {
  OPNSenseAPIClient,
} from '../api/client.js';

// Re-export common utilities
export {
  createLogger,
  Logger,
  LogLevel,
} from '../utils/logger.js';
export type { LoggerConfig } from '../utils/logger.js';

/**
 * SDK Version
 */
export const SDK_VERSION = '1.0.0';

/**
 * Minimum server version required
 */
export const MIN_SERVER_VERSION = '0.8.0';

/**
 * Plugin development utilities
 */
export namespace PluginUtils {
  /**
   * Generate a unique tool name with plugin prefix
   */
  export function toolName(pluginId: string, name: string): string {
    const prefix = pluginId.replace(/-/g, '_');
    return `${prefix}_${name}`;
  }

  /**
   * Generate a resource URI
   */
  export function resourceUri(category: string, pluginId: string, resource: string): string {
    return `plugin://${category}/${pluginId}/${resource}`;
  }

  /**
   * Generate an event name
   */
  export function eventName(pluginId: string, event: string): string {
    return `${pluginId}.${event}`;
  }

  /**
   * Validate plugin ID format
   */
  export function isValidPluginId(id: string): boolean {
    return /^[a-z][a-z0-9-]*$/.test(id) && id.length <= 50;
  }

  /**
   * Validate semver version
   */
  export function isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
  }

  /**
   * Create a standard tool input schema
   */
  export function createInputSchema(
    properties: Record<string, any>,
    required?: string[]
  ): MCPTool['inputSchema'] {
    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Create a standard success response
   */
  export function successResponse(data: any, message?: string): any {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a standard error response
   */
  export function errorResponse(error: Error | string, code?: string): any {
    return {
      success: false,
      error: error instanceof Error ? error.message : error,
      code,
      timestamp: new Date().toISOString(),
    };
  }
}

// Import types needed for re-export
import type { MCPTool } from '../core/types/plugin.js';

/**
 * Type helpers for plugin development
 */
export namespace Types {
  /**
   * Tool handler function type
   */
  export type ToolHandler<TParams = any, TResult = any> = (params: TParams) => Promise<TResult>;

  /**
   * Resource handler function type
   */
  export type ResourceHandler<TResult = any> = () => Promise<{ content: TResult }>;

  /**
   * Prompt handler function type
   */
  export type PromptHandler = (args: Record<string, string>) => Promise<{
    messages: Array<{
      role: 'user' | 'assistant';
      content: { type: 'text'; text: string };
    }>;
  }>;

  /**
   * Event data type
   */
  export type EventData = Record<string, any>;

  /**
   * API response type
   */
  export interface APIResponse<T = any> {
    data: T;
    status: number;
  }

  /**
   * SSH command result type
   */
  export interface SSHResult {
    stdout: string;
    stderr: string;
    exitCode: number;
  }

  /**
   * Cache options
   */
  export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    namespace?: string;
  }
}

/**
 * Decorators for plugin development (optional usage)
 */
export namespace Decorators {
  /**
   * Mark a method as a tool handler
   * Note: This is a documentation decorator, not functional
   */
  export function Tool(name: string, description: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      // Store metadata for documentation
      if (!target.constructor._tools) {
        target.constructor._tools = [];
      }
      target.constructor._tools.push({ name, description, handler: propertyKey });
      return descriptor;
    };
  }

  /**
   * Mark a method as requiring specific capability
   * Note: This is a documentation decorator, not functional
   */
  export function RequiresCapability(capability: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      if (!target.constructor._capabilities) {
        target.constructor._capabilities = new Set();
      }
      target.constructor._capabilities.add(capability);
      return descriptor;
    };
  }
}

/**
 * Common schema definitions for tool inputs
 */
export const CommonSchemas = {
  /** String input */
  string: (description: string, options?: { enum?: string[]; default?: string }) => ({
    type: 'string' as const,
    description,
    ...(options?.enum && { enum: options.enum }),
    ...(options?.default && { default: options.default }),
  }),

  /** Number input */
  number: (description: string, options?: { minimum?: number; maximum?: number; default?: number }) => ({
    type: 'number' as const,
    description,
    ...(options?.minimum !== undefined && { minimum: options.minimum }),
    ...(options?.maximum !== undefined && { maximum: options.maximum }),
    ...(options?.default !== undefined && { default: options.default }),
  }),

  /** Integer input */
  integer: (description: string, options?: { minimum?: number; maximum?: number; default?: number }) => ({
    type: 'integer' as const,
    description,
    ...(options?.minimum !== undefined && { minimum: options.minimum }),
    ...(options?.maximum !== undefined && { maximum: options.maximum }),
    ...(options?.default !== undefined && { default: options.default }),
  }),

  /** Boolean input */
  boolean: (description: string, options?: { default?: boolean }) => ({
    type: 'boolean' as const,
    description,
    ...(options?.default !== undefined && { default: options.default }),
  }),

  /** Array input */
  array: (description: string, items: any) => ({
    type: 'array' as const,
    description,
    items,
  }),

  /** Object input */
  object: (description: string, properties: Record<string, any>, required?: string[]) => ({
    type: 'object' as const,
    description,
    properties,
    ...(required && { required }),
  }),

  /** UUID input */
  uuid: (description: string) => ({
    type: 'string' as const,
    description,
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  }),

  /** IP address input */
  ipAddress: (description: string) => ({
    type: 'string' as const,
    description,
    pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
  }),

  /** CIDR notation input */
  cidr: (description: string) => ({
    type: 'string' as const,
    description,
    pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/(?:3[0-2]|[12]?[0-9])$',
  }),

  /** MAC address input */
  macAddress: (description: string) => ({
    type: 'string' as const,
    description,
    pattern: '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$',
  }),

  /** Port number input */
  port: (description: string) => ({
    type: 'integer' as const,
    description,
    minimum: 1,
    maximum: 65535,
  }),

  /** Protocol input */
  protocol: (description: string) => ({
    type: 'string' as const,
    description,
    enum: ['tcp', 'udp', 'icmp', 'any'],
  }),
};

/**
 * Example plugin implementation
 *
 * @example
 * ```typescript
 * import { BasePlugin, PluginCategory, PluginUtils, CommonSchemas } from 'opnsense-mcp-sdk';
 * import type { PluginMetadata, MCPTool, MCPResource, MCPPrompt, HealthStatus } from 'opnsense-mcp-sdk';
 *
 * export default class MyPlugin extends BasePlugin {
 *   readonly metadata: PluginMetadata = {
 *     id: 'custom-my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'A custom plugin',
 *     category: PluginCategory.CUSTOM,
 *     author: 'Author Name',
 *     enabled: true,
 *   };
 *
 *   getTools(): MCPTool[] {
 *     return [{
 *       name: PluginUtils.toolName(this.metadata.id, 'action'),
 *       description: 'Perform an action',
 *       inputSchema: PluginUtils.createInputSchema({
 *         target: CommonSchemas.ipAddress('Target IP address'),
 *       }, ['target']),
 *       handler: this.actionHandler.bind(this),
 *     }];
 *   }
 *
 *   getResources(): MCPResource[] { return []; }
 *   getPrompts(): MCPPrompt[] { return []; }
 *   getDependencies(): string[] { return []; }
 *
 *   private async actionHandler(params: { target: string }) {
 *     const result = await this.api.get(`/api/status/${params.target}`);
 *     return PluginUtils.successResponse(result.data);
 *   }
 * }
 * ```
 */
