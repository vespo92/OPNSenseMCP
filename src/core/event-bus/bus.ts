/**
 * Event Bus Implementation
 *
 * Provides pub/sub event handling for plugin communication
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  EventSeverity,
  type Event,
  type EventType,
  type EventFilter,
  type EventSubscription,
  type EventStreamConfig,
} from '../types/events.js';

/**
 * Event bus for plugin communication and SSE streaming
 */
export class EventBus extends EventEmitter {
  private subscriptions = new Map<string, EventSubscription>();
  private eventHistory: Event[] = [];
  private config: EventStreamConfig;

  constructor(config?: Partial<EventStreamConfig>) {
    super();

    this.config = {
      enabled: true,
      retention: 24 * 60 * 60 * 1000, // 24 hours
      maxEvents: 10000,
      maxListeners: 100,
      batchSize: 10,
      batchTimeout: 1000,
      ...config,
    };

    // Set max listeners to prevent warning
    this.setMaxListeners(this.config.maxListeners || 100);

    // Start cleanup interval
    if (this.config.enabled) {
      this.startCleanup();
    }
  }

  /**
   * Publish an event to the bus
   */
  public publish(event: Omit<Event, 'id' | 'timestamp'>): void {
    const fullEvent: Event = {
      ...event,
      id: randomUUID(),
      timestamp: new Date(),
    };

    // Add to history
    if (this.config.enabled) {
      this.eventHistory.push(fullEvent);
      this.trimHistory();
    }

    // Emit to EventEmitter (for internal listeners)
    this.emit('event', fullEvent);
    this.emit(fullEvent.type, fullEvent);

    // Emit to category-specific channel
    if (fullEvent.source) {
      this.emit(`${fullEvent.source}:*`, fullEvent);
    }

    // Notify subscribers
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(fullEvent, subscription.filter)) {
        try {
          subscription.handler(fullEvent);
        } catch (error) {
          console.error(`Error in event handler for ${subscription.id}:`, error);
        }
      }
    }
  }

  /**
   * Subscribe to events with optional filter
   */
  public subscribe(
    handler: (event: Event) => void | Promise<void>,
    filter?: EventFilter
  ): string {
    const subscription: EventSubscription = {
      id: randomUUID(),
      handler,
      filter,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscription.id, subscription);
    return subscription.id;
  }

  /**
   * Unsubscribe from events
   */
  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get event history
   */
  public getHistory(filter?: EventFilter, limit?: number): Event[] {
    let events = this.eventHistory;

    if (filter) {
      events = events.filter(event => this.matchesFilter(event, filter));
    }

    if (limit) {
      events = events.slice(-limit);
    }

    return events;
  }

  /**
   * Clear event history
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get subscription count
   */
  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get event count
   */
  public getEventCount(): number {
    return this.eventHistory.length;
  }

  /**
   * Get event statistics
   */
  public getStats(): {
    subscriptions: number;
    events: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    for (const event of this.eventHistory) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    }

    return {
      subscriptions: this.subscriptions.size,
      events: this.eventHistory.length,
      eventsByType,
      eventsBySeverity,
    };
  }

  /**
   * Helper: Create and publish an event
   */
  public createEvent(
    type: EventType | string,
    pluginId: string,
    data: any,
    severity: EventSeverity = EventSeverity.INFO,
    source?: string
  ): void {
    this.publish({
      type,
      pluginId,
      data,
      severity,
      source,
    });
  }

  /**
   * Check if event matches filter
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
   * Trim event history to max size
   */
  private trimHistory(): void {
    if (this.config.maxEvents && this.eventHistory.length > this.config.maxEvents) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxEvents);
    }
  }

  /**
   * Start cleanup interval to remove old events
   */
  private startCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.config.retention;
      this.eventHistory = this.eventHistory.filter(
        event => event.timestamp.getTime() > cutoff
      );
    }, 60000); // Run every minute
  }

  /**
   * Shutdown event bus
   */
  public async shutdown(): Promise<void> {
    this.subscriptions.clear();
    this.eventHistory = [];
    this.removeAllListeners();
  }
}
