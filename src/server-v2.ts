/**
 * OPNsense MCP Server v2.0
 *
 * Modular plugin-based architecture with SSE event streaming
 */

import { EventBus } from './core/event-bus/bus.js';
import { PluginRegistry } from './core/plugin-system/registry.js';
import { PluginLoader } from './core/plugin-system/loader.js';
import { SSEServer } from './core/sse/server.js';
import { OPNSenseAPIClient } from './api/client.js';
import { SSHExecutor } from './resources/ssh/executor.js';
import { MCPCacheManager } from './cache/manager.js';
import { ResourceStateStore } from './state/store.js';
import { Logger, LogLevel } from './utils/logger.js';
import type { PluginContext } from './core/types/plugin.js';

/**
 * Server configuration
 */
interface ServerConfig {
  server: {
    host: string;
    port: number;
    transport: 'sse' | 'stdio';
  };
  opnsense: {
    host: string;
    apiKey: string;
    apiSecret: string;
    verifySsl: boolean;
  };
  ssh?: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
  };
  plugins: {
    autoLoad: boolean;
    directory: string;
    enabled?: string[];
    disabled?: string[];
    configs?: Record<string, any>;
  };
  events?: {
    enabled: boolean;
    retention: number;
    maxEvents?: number;
    maxListeners?: number;
  };
  sse?: {
    enabled: boolean;
    cors?: any;
    heartbeatInterval?: number;
  };
  logging?: {
    level: string;
  };
}

/**
 * Main server class
 */
export class OPNsenseMCPServerV2 {
  private config: ServerConfig;
  private logger: any;
  private eventBus: EventBus;
  private registry: PluginRegistry;
  private loader: PluginLoader;
  private sseServer?: SSEServer;
  private apiClient!: OPNSenseAPIClient;
  private sshExecutor!: SSHExecutor;
  private cache!: MCPCacheManager;
  private state!: ResourceStateStore;

  constructor(config: ServerConfig) {
    this.config = config;
    const logLevel = config.logging?.level === 'debug' ? LogLevel.DEBUG
      : config.logging?.level === 'warn' ? LogLevel.WARN
      : config.logging?.level === 'error' ? LogLevel.ERROR
      : LogLevel.INFO;
    this.logger = new Logger({ level: logLevel });
    this.eventBus = new EventBus(config.events);
    this.registry = new PluginRegistry(this.logger);
    this.loader = new PluginLoader(this.registry, this.logger, {
      pluginsDirectory: config.plugins.directory,
      autoLoad: config.plugins.autoLoad,
      enabled: config.plugins.enabled,
      disabled: config.plugins.disabled,
      configs: config.plugins.configs,
    });
  }

  /**
   * Initialize server
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing OPNsense MCP Server v2.0');

    // Initialize core services
    await this.initializeServices();

    // Load plugins
    if (this.config.plugins.autoLoad) {
      await this.loadPlugins();
    }

    // Initialize SSE server if enabled
    if (this.config.server.transport === 'sse' && this.config.sse?.enabled) {
      this.initializeSSEServer();
    }

    this.logger.info('Server initialization complete');
  }

  /**
   * Initialize core services
   */
  private async initializeServices(): Promise<void> {
    this.logger.info('Initializing core services');

    // Initialize API client
    this.apiClient = new OPNSenseAPIClient({
      host: this.config.opnsense.host,
      apiKey: this.config.opnsense.apiKey,
      apiSecret: this.config.opnsense.apiSecret,
      verifySsl: this.config.opnsense.verifySsl,
    });

    // Initialize SSH executor
    if (this.config.ssh?.enabled) {
      this.sshExecutor = new SSHExecutor({
        host: this.config.ssh.host,
        port: this.config.ssh.port,
        username: this.config.ssh.username,
        password: this.config.ssh.password,
        privateKey: this.config.ssh.privateKey,
      });
    }

    // Initialize cache
    this.cache = new MCPCacheManager(this.apiClient);

    // Initialize state store
    this.state = new ResourceStateStore();

    this.logger.info('Core services initialized');
  }

  /**
   * Load plugins
   */
  private async loadPlugins(): Promise<void> {
    this.logger.info('Loading plugins');

    // Discover and load all plugins
    const plugins = await this.loader.loadAll();

    this.logger.info(`Loaded ${plugins.length} plugins`);

    // Create plugin context
    const context: PluginContext = {
      apiClient: this.apiClient,
      sshExecutor: this.sshExecutor,
      eventBus: this.eventBus,
      cache: this.cache,
      state: this.state,
      logger: this.logger,
      config: {},
      getPlugin: (id: string) => this.registry.get(id),
    };

    // Initialize all plugins
    await this.registry.initializeAll(context);

    this.logger.info('All plugins initialized');
  }

  /**
   * Initialize SSE server
   */
  private initializeSSEServer(): void {
    this.logger.info('Initializing SSE server');

    this.sseServer = new SSEServer(
      {
        host: this.config.server.host,
        port: this.config.server.port,
        cors: this.config.sse?.cors,
        heartbeatInterval: this.config.sse?.heartbeatInterval,
      },
      this.eventBus,
      this.registry,
      this.logger
    );

    this.logger.info('SSE server initialized');
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    this.logger.info('Starting OPNsense MCP Server v2.0');

    // Start all plugins
    await this.registry.startAll();

    // Start SSE server
    if (this.sseServer) {
      await this.sseServer.start();
    }

    // Start health check timer
    this.startHealthCheck();

    this.logger.info('Server started successfully');
    this.logServerInfo();
  }

  /**
   * Stop server
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping OPNsense MCP Server v2.0');

    // Stop SSE server
    if (this.sseServer) {
      await this.sseServer.stop();
    }

    // Stop all plugins
    await this.registry.stopAll();

    // Shutdown event bus
    await this.eventBus.shutdown();

    this.logger.info('Server stopped');
  }

  /**
   * Start health check timer
   */
  private startHealthCheck(): void {
    setInterval(async () => {
      const health = await this.registry.healthCheckAll();

      const unhealthy = Array.from(health.entries())
        .filter(([, status]) => !status.healthy);

      if (unhealthy.length > 0) {
        this.logger.warn(`${unhealthy.length} unhealthy plugins:`, unhealthy);
      }
    }, 60000); // Every minute
  }

  /**
   * Log server info
   */
  private logServerInfo(): void {
    const stats = this.registry.getStats();

    this.logger.info('\n' + [
      '='.repeat(60),
      '  OPNsense MCP Server v2.0 - Ready',
      '='.repeat(60),
      `  Plugins Loaded:    ${stats.total}`,
      `  Running Plugins:   ${stats.byState.running || 0}`,
      `  Categories:        ${Object.keys(stats.byCategory).length}`,
      '',
      this.sseServer
        ? `  SSE Server:        http://${this.config.server.host}:${this.config.server.port}`
        : '',
      this.sseServer
        ? `  Event Stream:      http://${this.config.server.host}:${this.config.server.port}/sse/events`
        : '',
      this.sseServer
        ? `  API Docs:          http://${this.config.server.host}:${this.config.server.port}/api/plugins`
        : '',
      '='.repeat(60),
    ].filter(Boolean).join('\n'));
  }

  /**
   * Get server statistics
   */
  getStats(): any {
    return {
      plugins: this.registry.getStats(),
      events: this.eventBus.getStats(),
      uptime: process.uptime(),
    };
  }
}

/**
 * Example usage
 */
export async function createServer(configPath?: string): Promise<OPNsenseMCPServerV2> {
  // Load configuration
  const config: ServerConfig = configPath
    ? require(configPath)
    : {
        server: {
          host: process.env.SERVER_HOST || '0.0.0.0',
          port: parseInt(process.env.SERVER_PORT || '3000'),
          transport: (process.env.TRANSPORT as any) || 'sse',
        },
        opnsense: {
          host: process.env.OPNSENSE_HOST!,
          apiKey: process.env.OPNSENSE_API_KEY!,
          apiSecret: process.env.OPNSENSE_API_SECRET!,
          verifySsl: process.env.OPNSENSE_VERIFY_SSL === 'true',
        },
        ssh: {
          enabled: process.env.SSH_ENABLED === 'true',
          host: process.env.OPNSENSE_HOST!,
          port: parseInt(process.env.SSH_PORT || '22'),
          username: process.env.SSH_USER!,
          password: process.env.SSH_PASSWORD,
        },
        plugins: {
          autoLoad: true,
          directory: './src/plugins',
          enabled: process.env.PLUGINS_ENABLED?.split(','),
        },
        events: {
          enabled: true,
          retention: 24 * 60 * 60 * 1000, // 24 hours
        },
        sse: {
          enabled: true,
          heartbeatInterval: 30000,
        },
      };

  const server = new OPNsenseMCPServerV2(config);
  await server.initialize();

  return server;
}

/**
 * Main entry point
 */
if (require.main === module) {
  (async () => {
    try {
      const server = await createServer();
      await server.start();

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}
