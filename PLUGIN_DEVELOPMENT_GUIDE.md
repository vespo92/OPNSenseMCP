# Plugin Development Guide

## Overview

This guide explains how to create custom plugins for the OPNsense MCP server using the modular plugin architecture.

## Table of Contents

- [Quick Start](#quick-start)
- [Plugin Structure](#plugin-structure)
- [Plugin Lifecycle](#plugin-lifecycle)
- [Creating Tools](#creating-tools)
- [Using Resources](#using-resources)
- [Event System](#event-system)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Quick Start

### 1. Create Plugin Directory

```bash
mkdir -p src/plugins/{category}/{plugin-name}
cd src/plugins/{category}/{plugin-name}
```

Categories:
- `core` - Essential firewall functionality
- `vpn` - VPN protocols and clients
- `security` - IDS/IPS, antivirus, certificates
- `monitoring` - Metrics and monitoring tools
- `services` - DNS, DHCP, NTP, proxies
- `routing` - Dynamic routing protocols
- `traffic` - QoS and traffic shaping
- `proxy` - Web proxies and caching
- `utility` - System utilities

### 2. Create Config File

Create `config.json`:

```json
{
  "metadata": {
    "id": "category-pluginname",
    "name": "Plugin Display Name",
    "version": "1.0.0",
    "description": "What your plugin does",
    "category": "category",
    "author": "Your Name",
    "enabled": true,
    "tags": ["tag1", "tag2"]
  },
  "config": {
    "customOption": "value"
  },
  "dependencies": []
}
```

### 3. Create Plugin Class

Create `index.ts`:

```typescript
import { BasePlugin } from '../../../core/plugin-system/base-plugin.js';
import {
  PluginCategory,
  PluginMetadata,
  MCPTool,
  MCPResource,
  MCPPrompt,
} from '../../../core/types/plugin.js';

export default class MyPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'category-pluginname',
    name: 'Plugin Display Name',
    version: '1.0.0',
    description: 'What your plugin does',
    category: PluginCategory.CORE,
    author: 'Your Name',
    enabled: true,
  };

  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing plugin');
    // Setup code here
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting plugin');
    // Start background tasks, monitoring, etc.
  }

  protected async onStop(): Promise<void> {
    // Cleanup background tasks
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'my_tool',
        description: 'What this tool does',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'Parameter description' },
          },
          required: ['param1'],
        },
        handler: this.myToolHandler.bind(this),
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

  private async myToolHandler(params: { param1: string }): Promise<any> {
    // Tool implementation
    return { success: true };
  }
}
```

### 4. Compile and Test

```bash
# Compile TypeScript
npm run build

# Plugin will be automatically discovered and loaded
npm run dev
```

## Plugin Structure

### Required Files

```
src/plugins/{category}/{plugin-name}/
├── config.json          # Plugin metadata and configuration
├── index.ts            # Main plugin class
└── README.md           # Plugin documentation (optional)
```

### Optional Structure

```
src/plugins/{category}/{plugin-name}/
├── config.json
├── index.ts
├── tools/              # Tool implementations
│   ├── list.ts
│   ├── create.ts
│   └── delete.ts
├── resources/          # Resource handlers
│   └── status.ts
├── utils/              # Helper functions
│   └── parser.ts
└── types.ts            # TypeScript types
```

## Plugin Lifecycle

### Lifecycle States

1. **uninitialized** - Plugin class instantiated
2. **initializing** - `initialize()` called
3. **initialized** - Ready to start
4. **starting** - `start()` called
5. **running** - Actively processing
6. **stopping** - `stop()` called
7. **stopped** - Gracefully stopped
8. **error** - Error occurred

### Lifecycle Methods

```typescript
// Called once when plugin is loaded
protected async onInitialize(): Promise<void> {
  // - Load configuration
  // - Setup data structures
  // - Register event handlers
  // - Initialize connections (don't start yet)
}

// Called when plugin should begin operation
protected async onStart(): Promise<void> {
  // - Start background tasks
  // - Begin monitoring
  // - Open connections
  // - Start timers
}

// Called when plugin should stop
protected async onStop(): Promise<void> {
  // - Stop timers
  // - Close connections
  // - Cleanup background tasks
}

// Called periodically for health checks
protected async onHealthCheck(): Promise<HealthStatus> {
  return {
    healthy: true,
    status: 'healthy',
    message: 'All systems operational',
    timestamp: new Date(),
  };
}

// Called before plugin is unloaded
protected async onCleanup(): Promise<void> {
  // - Release resources
  // - Save state
  // - Final cleanup
}
```

## Creating Tools

### Tool Definition

```typescript
getTools(): MCPTool[] {
  return [
    {
      name: 'plugin_action_name',  // Prefix with plugin domain
      description: 'Clear description of what this tool does',
      inputSchema: {
        type: 'object',
        properties: {
          requiredParam: {
            type: 'string',
            description: 'Description of parameter',
          },
          optionalParam: {
            type: 'number',
            description: 'Optional parameter',
          },
        },
        required: ['requiredParam'],
      },
      handler: this.toolHandler.bind(this),
    },
  ];
}
```

### Input Schema Types

```typescript
// String
{ type: 'string', description: 'Text input' }

// Number
{ type: 'number', description: 'Numeric input' }

// Boolean
{ type: 'boolean', description: 'True/false' }

// Enum
{ type: 'string', enum: ['option1', 'option2'] }

// Object
{
  type: 'object',
  properties: {
    key: { type: 'string' }
  }
}

// Array
{
  type: 'array',
  items: { type: 'string' }
}
```

### Tool Handler

```typescript
private async toolHandler(params: {
  requiredParam: string;
  optionalParam?: number;
}): Promise<any> {
  try {
    // Validate inputs
    if (!params.requiredParam) {
      throw new Error('Missing required parameter');
    }

    // Call OPNsense API
    const response = await this.api.get('/api/endpoint');

    // Or use SSH
    const result = await this.ssh.execute('command');

    // Emit event
    this.emit('action.completed', { result });

    // Return result
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    this.logger.error('Tool error:', error);
    throw error;
  }
}
```

## Using Resources

### Resource Definition

```typescript
getResources(): MCPResource[] {
  return [
    {
      uri: 'plugin://category/resource-name',
      name: 'Resource Display Name',
      description: 'What this resource provides',
      mimeType: 'application/json',
      handler: async () => {
        const data = await this.getData();
        return {
          content: JSON.stringify(data, null, 2),
        };
      },
    },
  ];
}
```

### Resource Types

- `application/json` - JSON data
- `text/plain` - Plain text
- `text/csv` - CSV data
- `text/html` - HTML content

## Event System

### Emitting Events

```typescript
// Emit custom event
this.emit('plugin.something.happened', {
  details: 'Event data',
  timestamp: new Date(),
});

// Use predefined event types
this.emit(EventType.FIREWALL_RULE_CREATED, {
  ruleId: 'uuid',
  rule: ruleData,
});
```

### Listening to Events

```typescript
protected async onInitialize(): Promise<void> {
  // Listen to events from other plugins
  this.on('firewall.rule.created', (data) => {
    this.logger.info('Firewall rule created:', data);
  });

  // Listen to event bus directly
  this.context.eventBus.subscribe((event) => {
    if (event.type === 'vpn.connected') {
      // Handle VPN connection
    }
  });
}
```

### Event Severity Levels

- `DEBUG` - Detailed debugging information
- `INFO` - General information
- `WARNING` - Warning conditions
- `ERROR` - Error conditions
- `CRITICAL` - Critical failures

## Configuration

### Accessing Configuration

```typescript
protected async onInitialize(): Promise<void> {
  // Access plugin config from config.json
  const option = this.context.config.customOption;

  // Access global config
  const apiKey = this.context.config.apiKey;
}
```

### Context Available Properties

```typescript
this.context = {
  apiClient,      // OPNsense REST API client
  sshExecutor,    // SSH command executor
  eventBus,       // Event bus for pub/sub
  cache,          // Cache manager (Redis/memory)
  state,          // State store for persistence
  logger,         // Logger instance
  config,         // Plugin configuration
  getPlugin,      // Get other plugin instances
};
```

### Helper Shortcuts

```typescript
this.api          // OPNsense API client
this.ssh          // SSH executor
this.cache        // Cache manager
this.stateStore   // State store
this.logger       // Logger
```

## Best Practices

### 1. Error Handling

```typescript
private async myTool(params: any): Promise<any> {
  try {
    // Do work
    return { success: true };
  } catch (error) {
    // Log error
    this.logger.error('Operation failed:', error);

    // Emit error event
    this.emit('error', { error, params });

    // Re-throw or return error
    throw new Error(`Failed to complete operation: ${error.message}`);
  }
}
```

### 2. Caching

```typescript
private async getData(): Promise<any> {
  const cacheKey = `${this.metadata.id}:data`;

  // Try cache first
  const cached = await this.cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await this.api.get('/api/endpoint');

  // Cache for 5 minutes
  await this.cache.set(cacheKey, data, 300);

  return data;
}
```

### 3. Background Tasks

```typescript
private timer?: NodeJS.Timeout;

protected async onStart(): Promise<void> {
  // Start periodic task
  this.timer = setInterval(async () => {
    await this.periodicTask();
  }, 60000); // Every minute
}

protected async onStop(): Promise<void> {
  // Clean up timer
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
```

### 4. Dependencies

```typescript
getDependencies(): string[] {
  return ['core-firewall', 'core-network'];
}

protected async onInitialize(): Promise<void> {
  // Access dependent plugin
  const firewallPlugin = this.context.getPlugin('core-firewall');
  if (!firewallPlugin) {
    throw new Error('Firewall plugin required but not loaded');
  }
}
```

### 5. State Management

```typescript
private async saveState(): Promise<void> {
  await this.stateStore.set(`${this.metadata.id}:state`, {
    lastRun: new Date(),
    count: this.processCount,
  });
}

private async loadState(): Promise<void> {
  const state = await this.stateStore.get(`${this.metadata.id}:state`);
  if (state) {
    this.processCount = state.count;
  }
}
```

## Examples

### Example 1: Simple Status Plugin

```typescript
export default class StatusPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'utility-status',
    name: 'System Status',
    version: '1.0.0',
    description: 'Get system status information',
    category: PluginCategory.UTILITY,
    author: 'You',
    enabled: true,
  };

  getTools(): MCPTool[] {
    return [
      {
        name: 'get_system_status',
        description: 'Get overall system status',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          const response = await this.api.get('/api/core/system/status');
          return response.data;
        },
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
```

### Example 2: Monitoring Plugin with Events

```typescript
export default class MonitorPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'monitoring-cpu',
    name: 'CPU Monitor',
    version: '1.0.0',
    description: 'Monitor CPU usage and alert on high usage',
    category: PluginCategory.MONITORING,
    author: 'You',
    enabled: true,
  };

  private timer?: NodeJS.Timeout;

  protected async onStart(): Promise<void> {
    this.timer = setInterval(() => this.checkCPU(), 10000);
  }

  protected async onStop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
  }

  private async checkCPU(): Promise<void> {
    const usage = await this.getCPUUsage();

    if (usage > 80) {
      this.emit('cpu.high', { usage, threshold: 80 });
    }

    this.context.eventBus.createEvent(
      'cpu.checked',
      this.metadata.id,
      { usage },
      EventSeverity.DEBUG,
      'monitoring'
    );
  }

  private async getCPUUsage(): Promise<number> {
    const result = await this.ssh.execute('top -b -n 1');
    // Parse result and return CPU %
    return 50;
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'get_cpu_usage',
        description: 'Get current CPU usage',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ usage: await this.getCPUUsage() }),
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
```

## Testing Your Plugin

### 1. Unit Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import MyPlugin from './index.js';

describe('MyPlugin', () => {
  let plugin: MyPlugin;

  beforeEach(() => {
    plugin = new MyPlugin();
  });

  it('should have correct metadata', () => {
    expect(plugin.metadata.id).toBe('category-myplugin');
  });

  it('should provide tools', () => {
    const tools = plugin.getTools();
    expect(tools.length).toBeGreaterThan(0);
  });
});
```

### 2. Manual Testing

```bash
# Start server in development mode
npm run dev

# Server will auto-load your plugin
# Check logs for:
# "Registered plugin: category-myplugin"
# "Initializing plugin"
# "Starting plugin"

# Use MCP inspector to test tools
npx @modelcontextprotocol/inspector
```

## Publishing Your Plugin

1. Create a README.md
2. Add examples
3. Document configuration options
4. Create a LICENSE file
5. Submit PR to main repository or publish as separate package

## Getting Help

- Check the [Architecture Documentation](./ARCHITECTURE_V2.md)
- Review [existing plugins](./src/plugins/)
- Ask in GitHub Issues
- Join the community Discord

## Plugin Checklist

- [ ] Created plugin directory structure
- [ ] Added config.json with metadata
- [ ] Implemented plugin class extending BasePlugin
- [ ] Defined metadata property
- [ ] Implemented lifecycle methods (onInitialize, onStart, onStop)
- [ ] Created tools with proper schemas
- [ ] Added error handling
- [ ] Emitted events for important actions
- [ ] Added health check logic
- [ ] Documented configuration options
- [ ] Tested plugin functionality
- [ ] Created README.md
- [ ] Compiled TypeScript (npm run build)
