/**
 * Base Plugin Class
 *
 * Abstract base class that all plugins extend
 */

import type {
  MCPPlugin,
  PluginMetadata,
  PluginState,
  PluginContext,
  HealthStatus,
  MCPTool,
  MCPResource,
  MCPPrompt,
  EventHandler,
} from '../types/plugin.js';
import { EventSeverity, EventType } from '../types/events.js';

/**
 * Abstract base plugin class
 */
export abstract class BasePlugin implements MCPPlugin {
  protected context!: PluginContext;
  private _state: PluginState = 'uninitialized' as PluginState;
  private eventHandlers = new Map<string, Set<EventHandler>>();

  /**
   * Plugin metadata - must be implemented by subclass
   */
  abstract readonly metadata: PluginMetadata;

  /**
   * Get current plugin state
   */
  get state(): PluginState {
    return this._state;
  }

  /**
   * Set plugin state and emit event
   */
  protected setState(state: PluginState): void {
    const oldState = this._state;
    this._state = state;

    if (this.context?.eventBus) {
      this.context.eventBus.createEvent(
        EventType.PLUGIN_HEALTH_CHANGED,
        this.metadata.id,
        { oldState, newState: state },
        EventSeverity.INFO,
        'plugin'
      );
    }
  }

  /**
   * Initialize plugin
   */
  async initialize(context: PluginContext): Promise<void> {
    this.setState('initializing' as PluginState);
    this.context = context;

    try {
      await this.onInitialize();
      this.setState('initialized' as PluginState);

      this.context.eventBus.createEvent(
        EventType.PLUGIN_LOADED,
        this.metadata.id,
        { name: this.metadata.name, version: this.metadata.version },
        EventSeverity.INFO,
        'plugin'
      );
    } catch (error) {
      this.setState('error' as PluginState);
      this.context.logger.error(`Failed to initialize plugin ${this.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Start plugin
   */
  async start(): Promise<void> {
    if (this._state !== 'initialized' && this._state !== 'stopped') {
      throw new Error(`Cannot start plugin in state: ${this._state}`);
    }

    this.setState('starting' as PluginState);

    try {
      await this.onStart();
      this.setState('running' as PluginState);

      this.context.eventBus.createEvent(
        EventType.PLUGIN_STARTED,
        this.metadata.id,
        { name: this.metadata.name },
        EventSeverity.INFO,
        'plugin'
      );
    } catch (error) {
      this.setState('error' as PluginState);
      this.context.logger.error(`Failed to start plugin ${this.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Stop plugin
   */
  async stop(): Promise<void> {
    if (this._state !== 'running') {
      return; // Already stopped
    }

    this.setState('stopping' as PluginState);

    try {
      await this.onStop();
      this.setState('stopped' as PluginState);

      this.context.eventBus.createEvent(
        EventType.PLUGIN_STOPPED,
        this.metadata.id,
        { name: this.metadata.name },
        EventSeverity.INFO,
        'plugin'
      );
    } catch (error) {
      this.setState('error' as PluginState);
      this.context.logger.error(`Failed to stop plugin ${this.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const health = await this.onHealthCheck();
      return health;
    } catch (error) {
      return {
        healthy: false,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Subscribe to event
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Subscribe to event bus
    if (this.context?.eventBus) {
      this.context.eventBus.on(event, handler);
    }
  }

  /**
   * Emit event
   */
  emit(event: string, data: any): void {
    // Emit to local handlers
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          this.context?.logger.error(`Error in event handler for ${event}:`, error);
        }
      }
    }

    // Emit to event bus
    if (this.context?.eventBus) {
      this.context.eventBus.createEvent(
        event,
        this.metadata.id,
        data,
        EventSeverity.INFO,
        this.metadata.category
      );
    }
  }

  /**
   * Get logger
   */
  protected get logger() {
    return this.context?.logger || console;
  }

  /**
   * Get API client
   */
  protected get api() {
    return this.context?.apiClient;
  }

  /**
   * Get SSH executor
   */
  protected get ssh() {
    return this.context?.sshExecutor;
  }

  /**
   * Get cache
   */
  protected get cache() {
    return this.context?.cache;
  }

  /**
   * Get state store
   */
  protected get stateStore() {
    return this.context?.state;
  }

  /**
   * Lifecycle hooks - to be implemented by subclasses
   */
  protected async onInitialize(): Promise<void> {
    // Override in subclass
  }

  protected async onStart(): Promise<void> {
    // Override in subclass
  }

  protected async onStop(): Promise<void> {
    // Override in subclass
  }

  protected async onHealthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      status: 'healthy',
      message: 'Plugin is running normally',
      timestamp: new Date(),
    };
  }

  /**
   * Abstract methods - must be implemented by subclasses
   */
  abstract getTools(): MCPTool[];

  abstract getResources(): MCPResource[];

  abstract getPrompts(): MCPPrompt[];

  abstract getDependencies(): string[];

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Clear event handlers
    this.eventHandlers.clear();

    // Override in subclass for additional cleanup
    await this.onCleanup();
  }

  protected async onCleanup(): Promise<void> {
    // Override in subclass
  }
}
