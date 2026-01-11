/**
 * Unit Tests for Plugin System
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/event-bus/bus.js';
import { BasePlugin } from '../../src/core/plugin-system/base-plugin.js';
import { PluginRegistry } from '../../src/core/plugin-system/registry.js';
import {
  type MCPPrompt,
  type MCPResource,
  type MCPTool,
  PluginCategory,
  type PluginMetadata,
} from '../../src/core/types/plugin.js';

// Mock plugin for testing
class TestPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    category: PluginCategory.CUSTOM,
    author: 'Test',
    enabled: true,
  };

  getTools(): MCPTool[] {
    return [
      {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ success: true }),
      },
    ];
  }

  getResources(): MCPResource[] {
    return [];
  }

  getPrompts(): MCPPrompt[] {
    return [];
  }

  getDependencies(): string[] {
    return [];
  }
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    registry = new PluginRegistry(mockLogger);
  });

  it('should register a plugin', () => {
    const plugin = new TestPlugin();
    registry.register(plugin, {});

    expect(registry.has('test-plugin')).toBe(true);
    expect(registry.get('test-plugin')).toBe(plugin);
  });

  it('should throw error when registering duplicate plugin', () => {
    const plugin = new TestPlugin();
    registry.register(plugin, {});

    expect(() => registry.register(plugin, {})).toThrow('Plugin already registered');
  });

  it('should unregister a plugin', async () => {
    const plugin = new TestPlugin();
    registry.register(plugin, {});

    const result = await registry.unregister('test-plugin');

    expect(result).toBe(true);
    expect(registry.has('test-plugin')).toBe(false);
  });

  it('should return all registered plugins', () => {
    const plugin1 = new TestPlugin();
    const plugin2 = new TestPlugin();
    plugin2.metadata.id = 'test-plugin-2';

    registry.register(plugin1, {});
    registry.register(plugin2, {});

    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });

  it('should get plugins by category', () => {
    const plugin = new TestPlugin();
    registry.register(plugin, {});

    const custom = registry.getByCategory('custom');
    expect(custom).toHaveLength(1);
    expect(custom[0]).toBe(plugin);
  });

  it('should resolve plugin dependencies', () => {
    class PluginWithDeps extends TestPlugin {
      getDependencies() {
        return ['test-plugin'];
      }
    }

    const plugin1 = new TestPlugin();
    const plugin2 = new PluginWithDeps();
    plugin2.metadata.id = 'plugin-with-deps';

    registry.register(plugin1, {});
    registry.register(plugin2, {});

    // Should not throw
    expect(() => registry.resolveDependencies()).not.toThrow();
  });

  it('should detect circular dependencies', () => {
    class Plugin1 extends TestPlugin {
      getDependencies() {
        return ['plugin-2'];
      }
    }

    class Plugin2 extends TestPlugin {
      getDependencies() {
        return ['test-plugin'];
      }
    }

    const p1 = new Plugin1();
    const p2 = new Plugin2();
    p2.metadata.id = 'plugin-2';

    registry.register(p1, {});
    registry.register(p2, {});

    expect(() => registry.resolveDependencies()).toThrow('Circular dependency');
  });

  it('should get plugin stats', () => {
    const plugin = new TestPlugin();
    registry.register(plugin, {});

    const stats = registry.getStats();
    expect(stats.total).toBe(1);
    expect(stats.byCategory.custom).toBe(1);
  });
});

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it('should publish and subscribe to events', () => {
    const handler = vi.fn();
    eventBus.subscribe(handler);

    eventBus.publish({
      type: 'test.event',
      pluginId: 'test',
      data: { message: 'hello' },
      severity: 'info' as any,
    });

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe('test.event');
    expect(event.data.message).toBe('hello');
  });

  it('should filter events by type', () => {
    const handler = vi.fn();
    eventBus.subscribe(handler, {
      types: ['test.specific'],
    });

    eventBus.publish({
      type: 'test.specific',
      pluginId: 'test',
      data: {},
      severity: 'info' as any,
    });

    eventBus.publish({
      type: 'test.other',
      pluginId: 'test',
      data: {},
      severity: 'info' as any,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe from events', () => {
    const handler = vi.fn();
    const subscriptionId = eventBus.subscribe(handler);

    eventBus.publish({
      type: 'test.event',
      pluginId: 'test',
      data: {},
      severity: 'info' as any,
    });

    eventBus.unsubscribe(subscriptionId);

    eventBus.publish({
      type: 'test.event',
      pluginId: 'test',
      data: {},
      severity: 'info' as any,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should maintain event history', () => {
    eventBus.publish({
      type: 'test.event',
      pluginId: 'test',
      data: {},
      severity: 'info' as any,
    });

    const history = eventBus.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('test.event');
  });

  it('should get event statistics', () => {
    eventBus.publish({
      type: 'test.event',
      pluginId: 'test',
      data: {},
      severity: 'info' as any,
    });

    eventBus.publish({
      type: 'test.event',
      pluginId: 'test',
      data: {},
      severity: 'warning' as any,
    });

    const stats = eventBus.getStats();
    expect(stats.events).toBe(2);
    expect(stats.eventsByType['test.event']).toBe(2);
    expect(stats.eventsBySeverity.info).toBe(1);
    expect(stats.eventsBySeverity.warning).toBe(1);
  });
});

describe('BasePlugin', () => {
  let plugin: TestPlugin;
  let mockContext: any;

  beforeEach(() => {
    plugin = new TestPlugin();
    mockContext = {
      apiClient: {},
      sshExecutor: {},
      eventBus: new EventBus(),
      cache: { get: vi.fn(), set: vi.fn() },
      state: { get: vi.fn(), set: vi.fn() },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      config: {},
      getPlugin: vi.fn(),
    };
  });

  it('should initialize plugin', async () => {
    await plugin.initialize(mockContext);
    expect(plugin.state).toBe('initialized');
  });

  it('should start plugin', async () => {
    await plugin.initialize(mockContext);
    await plugin.start();
    expect(plugin.state).toBe('running');
  });

  it('should stop plugin', async () => {
    await plugin.initialize(mockContext);
    await plugin.start();
    await plugin.stop();
    expect(plugin.state).toBe('stopped');
  });

  it('should perform health check', async () => {
    await plugin.initialize(mockContext);
    await plugin.start();

    const health = await plugin.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.status).toBe('healthy');
  });

  it('should emit events', async () => {
    await plugin.initialize(mockContext);

    const handler = vi.fn();
    mockContext.eventBus.subscribe(handler);

    plugin.emit('test.event', { data: 'test' });

    expect(handler).toHaveBeenCalled();
  });

  it('should listen to events', async () => {
    await plugin.initialize(mockContext);

    const handler = vi.fn();
    plugin.on('test.event', handler);

    mockContext.eventBus.publish({
      type: 'test.event',
      pluginId: 'test',
      data: {},
      severity: 'info' as any,
    });

    expect(handler).toHaveBeenCalled();
  });
});
