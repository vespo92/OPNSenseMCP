# Third-Party Plugin Development Guide

This guide explains how to create, distribute, and install third-party plugins for the OPNsense MCP server.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Plugin Architecture](#plugin-architecture)
- [Creating a Plugin](#creating-a-plugin)
- [Plugin SDK](#plugin-sdk)
- [Distributing Plugins](#distributing-plugins)
- [Installing Third-Party Plugins](#installing-third-party-plugins)
- [Plugin CLI Reference](#plugin-cli-reference)
- [Security Considerations](#security-considerations)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

The OPNsense MCP server supports a modular plugin architecture that allows third-party developers to extend functionality. Plugins can:

- Add new MCP tools for interacting with OPNsense
- Expose resources for data access
- Provide prompts for common workflows
- Integrate with external services
- React to events from other plugins

### Plugin Sources

Plugins can be installed from:

1. **NPM** - Published packages (recommended for distribution)
2. **GitHub** - Git repositories
3. **Local directories** - Development or private plugins

## Quick Start

### Create a New Plugin

```bash
# Using the CLI
npx opnsense-mcp-plugin create "My Plugin" --category monitoring

# Or using npm scripts
npm run plugin:create "My Plugin" --category monitoring
```

This creates a plugin scaffold with:

```
my-plugin/
├── config.json          # Plugin metadata
├── src/
│   └── index.ts        # Main plugin class
├── package.json        # NPM package config
├── tsconfig.json       # TypeScript config
├── README.md           # Documentation
└── .gitignore
```

### Build and Test

```bash
cd my-plugin
npm install
npm run build
```

### Install a Third-Party Plugin

```bash
# From NPM
npx opnsense-mcp-plugin install @opnsense-mcp/example-plugin

# From GitHub
npx opnsense-mcp-plugin install https://github.com/user/opnsense-mcp-plugin

# From local directory
npx opnsense-mcp-plugin install ./path/to/plugin --type directory
```

## Plugin Architecture

### Plugin Lifecycle

```
                    ┌─────────────┐
                    │ uninitialized│
                    └──────┬──────┘
                           │ new Plugin()
                           ▼
                    ┌─────────────┐
                    │ initializing │◄─── initialize(context)
                    └──────┬──────┘
                           │ onInitialize()
                           ▼
                    ┌─────────────┐
                    │ initialized  │
                    └──────┬──────┘
                           │ start()
                           ▼
                    ┌─────────────┐
                    │  starting   │◄─── onStart()
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
         ┌─────────│   running   │◄─── healthCheck()
         │         └──────┬──────┘
         │                │ stop()
         │                ▼
    error│         ┌─────────────┐
         │         │  stopping   │◄─── onStop()
         │         └──────┬──────┘
         │                │
         │                ▼
         │         ┌─────────────┐
         └────────►│   stopped   │
                   └─────────────┘
```

### Plugin Context

When initialized, plugins receive a context object with:

```typescript
interface PluginContext {
  apiClient: OPNsenseAPIClient;  // REST API access
  sshExecutor: SSHExecutor;       // SSH command execution
  eventBus: EventBus;             // Pub/sub messaging
  cache: CacheManager;            // Caching layer
  state: StateStore;              // Persistent state
  logger: Logger;                 // Logging
  config: Record<string, any>;    // Plugin configuration
  getPlugin: (id: string) => MCPPlugin | undefined;  // Access other plugins
}
```

## Creating a Plugin

### Step 1: Create Plugin Structure

```bash
npx opnsense-mcp-plugin create "Network Scanner" --category monitoring
```

### Step 2: Implement Plugin Class

Edit `src/index.ts`:

```typescript
import { BasePlugin, PluginCategory, PluginUtils, CommonSchemas } from 'opnsense-mcp-sdk';
import type { PluginMetadata, MCPTool, MCPResource, MCPPrompt, HealthStatus } from 'opnsense-mcp-sdk';

export default class NetworkScannerPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'monitoring-network-scanner',
    name: 'Network Scanner',
    version: '1.0.0',
    description: 'Scan and discover devices on your network',
    category: PluginCategory.MONITORING,
    author: 'Your Name',
    enabled: true,
    tags: ['network', 'scanner', 'discovery'],
  };

  private scanInterval?: NodeJS.Timeout;

  protected async onInitialize(): Promise<void> {
    this.logger.info('Network Scanner initializing...');

    // Load saved state
    const state = await this.stateStore.get(`${this.metadata.id}:lastScan`);
    if (state) {
      this.logger.info(`Last scan: ${state.timestamp}`);
    }
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Network Scanner starting...');

    // Start periodic scanning (if configured)
    const interval = this.context.config.scanInterval || 300000; // 5 min default
    this.scanInterval = setInterval(() => {
      this.performScan();
    }, interval);
  }

  protected async onStop(): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
  }

  protected async onHealthCheck(): Promise<HealthStatus> {
    // Check if we can reach OPNsense
    try {
      await this.api.get('/api/core/system/status');
      return {
        healthy: true,
        status: 'healthy',
        message: 'Network Scanner is operational',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'unhealthy',
        message: 'Cannot reach OPNsense API',
        timestamp: new Date(),
      };
    }
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'network_scan_subnet',
        description: 'Scan a subnet for active devices',
        inputSchema: {
          type: 'object',
          properties: {
            subnet: CommonSchemas.cidr('Subnet to scan (e.g., 192.168.1.0/24)'),
            timeout: CommonSchemas.integer('Scan timeout in seconds', { default: 30 }),
          },
          required: ['subnet'],
        },
        handler: this.scanSubnet.bind(this),
      },
      {
        name: 'network_get_devices',
        description: 'Get list of discovered devices',
        inputSchema: {
          type: 'object',
          properties: {
            subnet: CommonSchemas.cidr('Filter by subnet'),
          },
        },
        handler: this.getDevices.bind(this),
      },
    ];
  }

  getResources(): MCPResource[] {
    return [
      {
        uri: 'plugin://monitoring/network-scanner/devices',
        name: 'Discovered Devices',
        description: 'List of all discovered network devices',
        mimeType: 'application/json',
        handler: async () => ({
          content: JSON.stringify(await this.getDevices({}), null, 2),
        }),
      },
    ];
  }

  getPrompts(): MCPPrompt[] {
    return [];
  }

  getDependencies(): string[] {
    return []; // Or ['core-firewall'] if you need the firewall plugin
  }

  // Tool handlers

  private async scanSubnet(params: { subnet: string; timeout?: number }): Promise<any> {
    this.logger.info(`Scanning subnet: ${params.subnet}`);

    // Use SSH to run nmap or similar
    const result = await this.ssh.execute(
      `arp-scan --interface=em0 ${params.subnet}`,
      { timeout: (params.timeout || 30) * 1000 }
    );

    // Parse results
    const devices = this.parseArpScan(result.stdout);

    // Save to state
    await this.stateStore.set(`${this.metadata.id}:devices`, {
      devices,
      timestamp: new Date().toISOString(),
    });

    // Emit event
    this.emit('network.scan.completed', {
      subnet: params.subnet,
      deviceCount: devices.length,
    });

    return PluginUtils.successResponse(devices, `Found ${devices.length} devices`);
  }

  private async getDevices(params: { subnet?: string }): Promise<any> {
    const state = await this.stateStore.get(`${this.metadata.id}:devices`);

    if (!state?.devices) {
      return PluginUtils.successResponse([], 'No devices found. Run a scan first.');
    }

    let devices = state.devices;
    if (params.subnet) {
      devices = devices.filter((d: any) => d.subnet === params.subnet);
    }

    return PluginUtils.successResponse(devices);
  }

  private async performScan(): Promise<void> {
    // Auto-scan configured subnets
    const subnets = this.context.config.subnets || [];
    for (const subnet of subnets) {
      await this.scanSubnet({ subnet });
    }
  }

  private parseArpScan(output: string): any[] {
    const devices: any[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:]+)\s+(.*)$/i);
      if (match) {
        devices.push({
          ip: match[1],
          mac: match[2],
          vendor: match[3].trim(),
          discoveredAt: new Date().toISOString(),
        });
      }
    }

    return devices;
  }
}
```

### Step 3: Configure Plugin

Edit `config.json`:

```json
{
  "metadata": {
    "id": "monitoring-network-scanner",
    "name": "Network Scanner",
    "version": "1.0.0",
    "description": "Scan and discover devices on your network",
    "category": "monitoring",
    "author": "Your Name",
    "enabled": true,
    "tags": ["network", "scanner", "discovery"],
    "license": "MIT"
  },
  "config": {
    "scanInterval": 300000,
    "subnets": ["192.168.1.0/24", "192.168.2.0/24"]
  },
  "dependencies": []
}
```

### Step 4: Build and Test

```bash
npm run build

# Validate the plugin
npx opnsense-mcp-plugin validate .

# Install locally for testing
npx opnsense-mcp-plugin install . --type directory
```

## Plugin SDK

### Importing the SDK

```typescript
// Import base class and types
import {
  BasePlugin,
  PluginCategory,
  PluginUtils,
  CommonSchemas,
  Types,
} from 'opnsense-mcp-sdk';

import type {
  PluginMetadata,
  PluginContext,
  MCPTool,
  MCPResource,
  MCPPrompt,
  HealthStatus,
  EventHandler,
} from 'opnsense-mcp-sdk';
```

### Plugin Utilities

```typescript
// Generate tool names with plugin prefix
const toolName = PluginUtils.toolName('my-plugin', 'action');
// Result: 'my_plugin_action'

// Generate resource URIs
const uri = PluginUtils.resourceUri('monitoring', 'my-plugin', 'status');
// Result: 'plugin://monitoring/my-plugin/status'

// Create success/error responses
return PluginUtils.successResponse(data, 'Operation successful');
return PluginUtils.errorResponse(new Error('Failed'), 'ERR_001');
```

### Common Schemas

```typescript
// Pre-defined input schemas
const toolSchema = {
  type: 'object',
  properties: {
    ipAddress: CommonSchemas.ipAddress('Target IP address'),
    port: CommonSchemas.port('Target port'),
    protocol: CommonSchemas.protocol('Network protocol'),
    cidr: CommonSchemas.cidr('Network in CIDR notation'),
    uuid: CommonSchemas.uuid('Resource identifier'),
    enabled: CommonSchemas.boolean('Enable feature', { default: true }),
    count: CommonSchemas.integer('Number of items', { minimum: 1, maximum: 100 }),
  },
  required: ['ipAddress'],
};
```

### Event Handling

```typescript
// Emit events
this.emit('plugin.action.completed', { result: 'success' });

// Listen to events from other plugins
this.on('firewall.rule.created', (data) => {
  this.logger.info('New firewall rule:', data);
});

// Listen to all events via event bus
this.context.eventBus.subscribe((event) => {
  if (event.type === 'vpn.connected') {
    // Handle VPN connection
  }
});
```

## Distributing Plugins

### Publishing to NPM

1. **Configure package.json**:

```json
{
  "name": "@opnsense-mcp/your-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist/", "config.json", "README.md"],
  "keywords": ["opnsense-mcp-plugin", "opnsense", "mcp"],
  "opnsenseMcp": {
    "pluginId": "category-your-plugin",
    "type": "plugin",
    "minServerVersion": "0.9.0",
    "capabilities": ["api", "ssh"]
  },
  "peerDependencies": {
    "opnsense-mcp-sdk": "^1.0.0"
  }
}
```

2. **Publish**:

```bash
npm login
npm publish --access public
```

### Publishing to GitHub

1. Create a public repository
2. Ensure `config.json` is in the root
3. Tag releases with semver versions
4. Users can install via URL

### Private Distribution

For private plugins:

1. Use private NPM registry
2. Use private GitHub repos (with token)
3. Distribute as tarballs

## Installing Third-Party Plugins

### From NPM

```bash
# Install
npx opnsense-mcp-plugin install @opnsense-mcp/example-plugin

# Install specific version
npx opnsense-mcp-plugin install @opnsense-mcp/example-plugin --version 1.2.0
```

### From GitHub

```bash
# Install from public repo
npx opnsense-mcp-plugin install https://github.com/user/plugin

# Install specific branch/tag
npx opnsense-mcp-plugin install https://github.com/user/plugin --ref v1.0.0

# Install from private repo (set GITHUB_TOKEN env var)
GITHUB_TOKEN=xxx npx opnsense-mcp-plugin install https://github.com/private/plugin
```

### From Directory

```bash
npx opnsense-mcp-plugin install /path/to/plugin --type directory
```

### Configuration

Add external plugins to your MCP server configuration:

```json
{
  "plugins": {
    "external": [
      {
        "source": "@opnsense-mcp/network-scanner",
        "type": "npm",
        "version": "^1.0.0",
        "enabled": true,
        "config": {
          "scanInterval": 600000
        }
      },
      {
        "source": "https://github.com/user/custom-plugin",
        "type": "github",
        "ref": "main",
        "enabled": true
      }
    ]
  }
}
```

## Plugin CLI Reference

```bash
# Create a new plugin
opnsense-mcp-plugin create <name> [options]
  --category <cat>     Plugin category (default: custom)
  --description <desc> Plugin description
  --author <name>      Author name
  --output <dir>       Output directory

# Install a plugin
opnsense-mcp-plugin install <source> [options]
  --type <type>        Source type: npm, github, directory
  --version <ver>      Version constraint
  --ref <ref>          Git ref (branch/tag)
  --skip-validation    Skip plugin validation

# Uninstall a plugin
opnsense-mcp-plugin uninstall <plugin-id>

# List installed plugins
opnsense-mcp-plugin list

# Enable/disable a plugin
opnsense-mcp-plugin enable <plugin-id>
opnsense-mcp-plugin disable <plugin-id>

# Update a plugin
opnsense-mcp-plugin update <plugin-id>

# Validate a plugin
opnsense-mcp-plugin validate <path>

# Show plugin info
opnsense-mcp-plugin info <plugin-id>
```

## Security Considerations

### Plugin Validation

All plugins are validated before loading:

1. **Structure validation** - Required files present
2. **Metadata validation** - Valid config.json
3. **Code analysis** - Checks for dangerous patterns
4. **Version compatibility** - Server version requirements

### Dangerous Patterns Detected

- `eval()` usage
- Dynamic `require()`
- `process.exit()` calls
- File system sync operations
- Child process spawning

### Best Security Practices

1. **Review code** before installing third-party plugins
2. **Use trusted sources** (official @opnsense-mcp packages)
3. **Check permissions** - understand what capabilities the plugin needs
4. **Keep updated** - regularly update plugins for security fixes
5. **Isolate sensitive data** - don't store credentials in plugins

## Best Practices

### Plugin Development

1. **Follow naming conventions**:
   - Plugin ID: `category-descriptive-name`
   - Tool names: `plugin_prefix_action`
   - Resources: `plugin://category/plugin-id/resource`

2. **Handle errors gracefully**:
```typescript
try {
  const result = await this.api.get('/api/endpoint');
  return PluginUtils.successResponse(result.data);
} catch (error) {
  this.logger.error('API call failed:', error);
  return PluginUtils.errorResponse(error, 'API_ERROR');
}
```

3. **Use caching**:
```typescript
const cached = await this.cache.get('my-key');
if (cached) return cached;

const fresh = await this.fetchData();
await this.cache.set('my-key', fresh, 300); // 5 min TTL
return fresh;
```

4. **Document thoroughly**:
   - Tool descriptions should be clear
   - Include examples in README
   - Document configuration options

5. **Test extensively**:
   - Unit tests for handlers
   - Integration tests with mock context
   - Validation tests

### Performance

1. Avoid blocking operations
2. Use caching for expensive API calls
3. Implement proper cleanup in `onStop()`
4. Don't poll too frequently

## Examples

### Minimal Plugin

```typescript
import { BasePlugin } from 'opnsense-mcp-sdk';
import type { PluginMetadata, MCPTool, MCPResource, MCPPrompt } from 'opnsense-mcp-sdk';

export default class MinimalPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'custom-minimal',
    name: 'Minimal Plugin',
    version: '1.0.0',
    description: 'A minimal plugin example',
    category: 'custom',
    author: 'Example',
    enabled: true,
  };

  getTools(): MCPTool[] {
    return [{
      name: 'minimal_hello',
      description: 'Say hello',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ message: 'Hello from minimal plugin!' }),
    }];
  }

  getResources(): MCPResource[] { return []; }
  getPrompts(): MCPPrompt[] { return []; }
  getDependencies(): string[] { return []; }
}
```

### Plugin with Dependencies

```typescript
export default class DependentPlugin extends BasePlugin {
  // ... metadata ...

  getDependencies(): string[] {
    return ['core-firewall', 'monitoring-system'];
  }

  protected async onInitialize(): Promise<void> {
    // Access dependent plugins
    const firewall = this.context.getPlugin('core-firewall');
    if (!firewall) {
      throw new Error('Firewall plugin required');
    }

    // Use firewall plugin's tools
    const rules = await firewall.getTools()
      .find(t => t.name === 'list_firewall_rules')
      ?.handler({});
  }
}
```

## Troubleshooting

### Plugin Not Loading

1. Check `config.json` exists and is valid JSON
2. Verify `index.js` exists (compile TypeScript)
3. Check plugin ID matches in config and class
4. Look for validation errors in logs

### Tools Not Appearing

1. Ensure plugin state is `running`
2. Check `getTools()` returns valid array
3. Verify tool schema is valid JSON Schema

### API Calls Failing

1. Check OPNsense credentials are configured
2. Verify API endpoint exists
3. Check for permission issues

### Events Not Received

1. Ensure plugin is subscribed in `onInitialize()`
2. Check event name matches exactly
3. Verify event bus is available in context

### Debug Mode

Enable debug logging:

```bash
DEBUG=1 opnsense-mcp-plugin validate ./my-plugin
```

---

## Contributing

We welcome plugin contributions! Please:

1. Follow the development guidelines
2. Include tests
3. Document your plugin
4. Submit to the community plugin registry

## Support

- GitHub Issues: https://github.com/vespo92/OPNSenseMCP/issues
- Documentation: https://github.com/vespo92/OPNSenseMCP

## License

MIT License - see individual plugins for their licenses.
