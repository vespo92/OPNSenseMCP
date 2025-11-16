/**
 * Integration Tests for SSE Server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EventBus } from '../../src/core/event-bus/bus.js';
import { PluginRegistry } from '../../src/core/plugin-system/registry.js';
import { SSEServer } from '../../src/core/sse/server.js';
import { EventSeverity } from '../../src/core/types/events.js';

describe('SSE Server Integration', () => {
  let server: SSEServer;
  let eventBus: EventBus;
  let registry: PluginRegistry;

  const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  };

  beforeAll(async () => {
    eventBus = new EventBus();
    registry = new PluginRegistry(mockLogger as any);

    server = new SSEServer(
      {
        host: 'localhost',
        port: 3001,
      },
      eventBus,
      registry,
      mockLogger as any
    );

    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should respond to health check', async () => {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
  });

  it('should list plugins', async () => {
    const response = await fetch('http://localhost:3001/api/plugins');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('plugins');
    expect(Array.isArray(data.plugins)).toBe(true);
  });

  it('should get event history', async () => {
    // Publish some events
    eventBus.createEvent(
      'test.event',
      'test-plugin',
      { message: 'test' },
      EventSeverity.INFO,
      'test'
    );

    const response = await fetch('http://localhost:3001/api/events/history?limit=10');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('events');
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.events.length).toBeGreaterThan(0);
  });

  it('should get event statistics', async () => {
    const response = await fetch('http://localhost:3001/api/events/stats');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('events');
    expect(data).toHaveProperty('eventsByType');
    expect(data).toHaveProperty('eventsBySeverity');
  });

  it('should get system status', async () => {
    const response = await fetch('http://localhost:3001/api/system/status');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('plugins');
    expect(data).toHaveProperty('events');
    expect(data).toHaveProperty('uptime');
  });

  it('should get system stats', async () => {
    const response = await fetch('http://localhost:3001/api/system/stats');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('plugins');
    expect(data).toHaveProperty('events');
    expect(data).toHaveProperty('memory');
  });
});
