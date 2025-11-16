/**
 * SSE Event Stream Manager
 *
 * Manages Server-Sent Events for real-time updates
 */

import type { Response } from 'express';
import type { Event, EventFilter } from '../types/events.js';
import type { EventBus } from '../event-bus/bus.js';
import type { Logger } from '../../utils/logger.js';

/**
 * SSE client connection
 */
interface SSEClient {
  id: string;
  res: Response;
  filter?: EventFilter;
  connectedAt: Date;
  lastEventId?: string;
}

/**
 * Event stream manager for SSE connections
 */
export class EventStreamManager {
  private clients = new Map<string, SSEClient>();
  private eventBus: EventBus;
  private logger: Logger;
  private subscriptionId?: string;

  constructor(eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus;
    this.logger = logger;
  }

  /**
   * Start listening to event bus
   */
  start(): void {
    this.subscriptionId = this.eventBus.subscribe(
      this.handleEvent.bind(this),
      undefined // No filter - receive all events
    );

    this.logger.info('Event stream manager started');
  }

  /**
   * Stop listening to event bus
   */
  stop(): void {
    if (this.subscriptionId) {
      this.eventBus.unsubscribe(this.subscriptionId);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      this.closeClient(client.id);
    }

    this.logger.info('Event stream manager stopped');
  }

  /**
   * Add SSE client
   */
  addClient(clientId: string, res: Response, filter?: EventFilter): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    const client: SSEClient = {
      id: clientId,
      res,
      filter,
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    // Send initial connection event
    this.sendToClient(client, {
      type: 'connected',
      data: {
        clientId,
        timestamp: new Date(),
        message: 'Connected to OPNsense MCP event stream',
      },
    });

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });

    this.logger.info(`SSE client connected: ${clientId}`);
  }

  /**
   * Remove SSE client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      this.logger.info(`SSE client disconnected: ${clientId}`);
    }
  }

  /**
   * Close client connection
   */
  private closeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch (error) {
        this.logger.debug(`Error closing client ${clientId}:`, error);
      }
      this.removeClient(clientId);
    }
  }

  /**
   * Handle event from event bus
   */
  private handleEvent(event: Event): void {
    for (const client of this.clients.values()) {
      if (this.matchesFilter(event, client.filter)) {
        this.sendToClient(client, {
          type: event.type,
          data: {
            id: event.id,
            timestamp: event.timestamp,
            pluginId: event.pluginId,
            severity: event.severity,
            source: event.source,
            data: event.data,
          },
        });
      }
    }
  }

  /**
   * Send event to specific client
   */
  private sendToClient(
    client: SSEClient,
    event: { type: string; data: any }
  ): void {
    try {
      // Format SSE message
      const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const message = `id: ${eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

      client.res.write(message);
      client.lastEventId = eventId;
    } catch (error) {
      this.logger.error(`Error sending to client ${client.id}:`, error);
      this.removeClient(client.id);
    }
  }

  /**
   * Broadcast event to all clients
   */
  broadcast(event: { type: string; data: any }): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, event);
    }
  }

  /**
   * Send heartbeat to keep connections alive
   */
  sendHeartbeat(): void {
    const heartbeat = ': heartbeat\n\n';

    for (const client of this.clients.values()) {
      try {
        client.res.write(heartbeat);
      } catch (error) {
        this.logger.debug(`Error sending heartbeat to client ${client.id}:`, error);
        this.removeClient(client.id);
      }
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat(interval: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  /**
   * Check if event matches client filter
   */
  private matchesFilter(event: Event, filter?: EventFilter): boolean {
    if (!filter) return true;

    // Check event types
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(event.type as any)) {
        return false;
      }
    }

    // Check plugin IDs
    if (filter.pluginIds && filter.pluginIds.length > 0) {
      if (!filter.pluginIds.includes(event.pluginId)) {
        return false;
      }
    }

    // Check severities
    if (filter.severities && filter.severities.length > 0) {
      if (!filter.severities.includes(event.severity)) {
        return false;
      }
    }

    // Check sources
    if (filter.sources && filter.sources.length > 0) {
      if (!event.source || !filter.sources.includes(event.source)) {
        return false;
      }
    }

    // Custom filter function
    if (filter.filter && !filter.filter(event)) {
      return false;
    }

    return true;
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client list
   */
  getClients(): Array<{ id: string; connectedAt: Date; filter?: EventFilter }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      filter: client.filter,
    }));
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalClients: number;
    clientsByFilter: number;
    oldestConnection?: Date;
  } {
    const clients = Array.from(this.clients.values());

    return {
      totalClients: clients.length,
      clientsByFilter: clients.filter(c => c.filter).length,
      oldestConnection: clients.length > 0
        ? new Date(Math.min(...clients.map(c => c.connectedAt.getTime())))
        : undefined,
    };
  }
}
