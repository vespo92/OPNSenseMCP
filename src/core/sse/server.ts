/**
 * Enhanced SSE Server
 *
 * Provides HTTP endpoints for SSE event streaming and MCP communication
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import type { EventBus } from '../event-bus/bus.js';
import type { Logger } from '../../utils/logger.js';
import type { PluginRegistry } from '../plugin-system/registry.js';
import { EventStreamManager } from './event-stream.js';
import { EventSeverity, EventType } from '../types/events.js';

/**
 * SSE server configuration
 */
export interface SSEServerConfig {
  host: string;
  port: number;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  heartbeatInterval?: number;
}

/**
 * Enhanced SSE server with event streaming
 */
export class SSEServer {
  private app: express.Application;
  private server?: any;
  private config: SSEServerConfig;
  private eventBus: EventBus;
  private logger: Logger;
  private registry: PluginRegistry;
  private streamManager: EventStreamManager;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    config: SSEServerConfig,
    eventBus: EventBus,
    registry: PluginRegistry,
    logger: Logger
  ) {
    this.config = config;
    this.eventBus = eventBus;
    this.registry = registry;
    this.logger = logger;
    this.streamManager = new EventStreamManager(eventBus, logger);

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    if (this.config.cors) {
      this.app.use(cors(this.config.cors));
    }

    // JSON body parser
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.handleHealth.bind(this));

    // SSE event streams
    this.app.get('/sse/events', this.handleEventStream.bind(this));
    this.app.get('/sse/events/:category', this.handleCategoryStream.bind(this));
    this.app.get('/sse/metrics', this.handleMetricsStream.bind(this));
    this.app.get('/sse/logs', this.handleLogStream.bind(this));

    // Plugin information
    this.app.get('/api/plugins', this.handleListPlugins.bind(this));
    this.app.get('/api/plugins/:id', this.handleGetPlugin.bind(this));
    this.app.get('/api/plugins/:id/health', this.handlePluginHealth.bind(this));

    // Event bus information
    this.app.get('/api/events/history', this.handleEventHistory.bind(this));
    this.app.get('/api/events/stats', this.handleEventStats.bind(this));

    // System information
    this.app.get('/api/system/status', this.handleSystemStatus.bind(this));
    this.app.get('/api/system/stats', this.handleSystemStats.bind(this));

    // SSE client management
    this.app.get('/api/sse/clients', this.handleListClients.bind(this));
    this.app.get('/api/sse/stats', this.handleSSEStats.bind(this));
  }

  /**
   * Handle health check
   */
  private handleHealth(req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
    });
  }

  /**
   * Handle main event stream
   */
  private handleEventStream(req: Request, res: Response): void {
    const clientId = randomUUID();
    const filter = this.parseEventFilter(req);

    this.streamManager.addClient(clientId, res, filter);

    // Send initial message
    this.logger.info(`Event stream client connected: ${clientId}`);
  }

  /**
   * Handle category-specific event stream
   */
  private handleCategoryStream(req: Request, res: Response): void {
    const category = req.params.category;
    const clientId = randomUUID();

    const filter = {
      sources: [category],
      ...this.parseEventFilter(req),
    };

    this.streamManager.addClient(clientId, res, filter);

    this.logger.info(`Category stream (${category}) client connected: ${clientId}`);
  }

  /**
   * Handle metrics stream
   */
  private handleMetricsStream(req: Request, res: Response): void {
    const clientId = randomUUID();

    const filter = {
      types: [EventType.METRICS_COLLECTED],
    };

    this.streamManager.addClient(clientId, res, filter);

    this.logger.info(`Metrics stream client connected: ${clientId}`);
  }

  /**
   * Handle log stream
   */
  private handleLogStream(req: Request, res: Response): void {
    const clientId = randomUUID();

    // Stream all events as logs
    this.streamManager.addClient(clientId, res);

    this.logger.info(`Log stream client connected: ${clientId}`);
  }

  /**
   * Parse event filter from query parameters
   */
  private parseEventFilter(req: Request): any {
    const filter: any = {};

    if (req.query.types) {
      filter.types = Array.isArray(req.query.types)
        ? req.query.types
        : [req.query.types];
    }

    if (req.query.plugins) {
      filter.pluginIds = Array.isArray(req.query.plugins)
        ? req.query.plugins
        : [req.query.plugins];
    }

    if (req.query.severity) {
      filter.severities = Array.isArray(req.query.severity)
        ? req.query.severity
        : [req.query.severity];
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  /**
   * Handle list plugins
   */
  private handleListPlugins(req: Request, res: Response): void {
    const plugins = this.registry.getAllEntries().map(entry => ({
      id: entry.plugin.metadata.id,
      name: entry.plugin.metadata.name,
      version: entry.plugin.metadata.version,
      category: entry.plugin.metadata.category,
      description: entry.plugin.metadata.description,
      state: entry.state,
      loadedAt: entry.loadedAt,
      health: entry.health,
    }));

    res.json({ plugins });
  }

  /**
   * Handle get plugin
   */
  private handleGetPlugin(req: Request, res: Response): void {
    const pluginId = req.params.id;
    const entry = this.registry.getEntry(pluginId);

    if (!entry) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }

    res.json({
      id: entry.plugin.metadata.id,
      metadata: entry.plugin.metadata,
      state: entry.state,
      loadedAt: entry.loadedAt,
      health: entry.health,
      config: entry.config,
      tools: entry.plugin.getTools().map(t => ({
        name: t.name,
        description: t.description,
      })),
      resources: entry.plugin.getResources().map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
      })),
    });
  }

  /**
   * Handle plugin health check
   */
  private async handlePluginHealth(req: Request, res: Response): Promise<void> {
    const pluginId = req.params.id;
    const plugin = this.registry.get(pluginId);

    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }

    try {
      const health = await plugin.healthCheck();
      res.json(health);
    } catch (error) {
      res.status(500).json({
        healthy: false,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle event history
   */
  private handleEventHistory(req: Request, res: Response): void {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const filter = this.parseEventFilter(req);

    const events = this.eventBus.getHistory(filter, limit);

    res.json({ events, count: events.length });
  }

  /**
   * Handle event stats
   */
  private handleEventStats(req: Request, res: Response): void {
    const stats = this.eventBus.getStats();
    res.json(stats);
  }

  /**
   * Handle system status
   */
  private async handleSystemStatus(req: Request, res: Response): Promise<void> {
    const pluginHealth = await this.registry.healthCheckAll();

    const status = {
      healthy: Array.from(pluginHealth.values()).every(h => h.healthy),
      plugins: {
        total: this.registry.getPluginIds().length,
        healthy: Array.from(pluginHealth.values()).filter(h => h.healthy).length,
        unhealthy: Array.from(pluginHealth.values()).filter(h => !h.healthy).length,
      },
      events: this.eventBus.getStats(),
      sse: this.streamManager.getStats(),
      uptime: process.uptime(),
      timestamp: new Date(),
    };

    res.json(status);
  }

  /**
   * Handle system stats
   */
  private handleSystemStats(req: Request, res: Response): void {
    const stats = {
      plugins: this.registry.getStats(),
      events: this.eventBus.getStats(),
      sse: this.streamManager.getStats(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };

    res.json(stats);
  }

  /**
   * Handle list SSE clients
   */
  private handleListClients(req: Request, res: Response): void {
    const clients = this.streamManager.getClients();
    res.json({ clients, count: clients.length });
  }

  /**
   * Handle SSE stats
   */
  private handleSSEStats(req: Request, res: Response): void {
    const stats = this.streamManager.getStats();
    res.json(stats);
  }

  /**
   * Start SSE server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Start event stream manager
        this.streamManager.start();

        // Start heartbeat
        this.heartbeatTimer = this.streamManager.startHeartbeat(
          this.config.heartbeatInterval || 30000
        );

        // Start HTTP server
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.logger.info(
            `SSE server listening on http://${this.config.host}:${this.config.port}`
          );

          // Emit system startup event
          this.eventBus.createEvent(
            EventType.SYSTEM_STARTUP,
            'system',
            { host: this.config.host, port: this.config.port },
            EventSeverity.INFO,
            'system'
          );

          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('SSE server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop SSE server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Clear heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }

      // Stop event stream manager
      this.streamManager.stop();

      // Emit system shutdown event
      this.eventBus.createEvent(
        EventType.SYSTEM_SHUTDOWN,
        'system',
        {},
        EventSeverity.INFO,
        'system'
      );

      // Stop HTTP server
      if (this.server) {
        this.server.close(() => {
          this.logger.info('SSE server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
