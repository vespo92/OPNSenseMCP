# OPNsense MCP v2.0 - Modular Plugin Architecture

## Overview

This document describes the v2.0 architecture for OPNsense MCP, featuring a modular plugin system with SSE-based real-time event streaming for comprehensive cloud firewall management.

## Design Principles

1. **Modularity** - Each OPNsense feature area is a separate plugin
2. **Extensibility** - Easy to add new plugins without modifying core
3. **Real-time** - SSE event bus for live monitoring and updates
4. **Type Safety** - Full TypeScript support with strict typing
5. **Discoverability** - Automatic plugin discovery and registration
6. **Lifecycle Management** - Plugin initialization, health checks, cleanup
7. **Event-Driven** - Pub/sub pattern for cross-plugin communication

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (Claude)                      │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Transport Layer (SSE/STDIO)                │
│  - SSE Server with EventSource                              │
│  - Real-time event streaming                                │
│  - Connection management                                     │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server Core                          │
│  - Tool routing                                             │
│  - Resource management                                       │
│  - Plugin orchestration                                      │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Plugin System Core                        │
│  - Plugin Registry & Discovery                              │
│  - Lifecycle Management (init, start, stop, health)         │
│  - Event Bus (pub/sub)                                      │
│  - Dependency Resolution                                     │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Plugin Modules                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Firewall  │  │  Network │  │   VPN    │  │ Security │  │
│  │ Plugin   │  │  Plugin  │  │  Plugin  │  │  Plugin  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Routing  │  │Monitoring│  │ Services │  │  Proxy   │  │
│  │ Plugin   │  │  Plugin  │  │  Plugin  │  │  Plugin  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  - Cache Manager                                            │
│  - State Store                                              │
│  - Backup Manager                                           │
│  - Event Stream Manager                                     │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│  - OPNsense REST API Client                                 │
│  - SSH Executor                                             │
│  - WebSocket Client (future)                                │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   OPNsense Firewall                         │
└─────────────────────────────────────────────────────────────┘
```

## Plugin Categories

Based on OPNsense's native plugin ecosystem:

### 1. Core Plugins (Always Loaded)
- **Firewall Plugin** - Rules, aliases, schedules
- **Network Plugin** - Interfaces, VLANs, bridges, LAGGs
- **NAT Plugin** - Port forwarding, outbound NAT, NPt

### 2. Security Plugins
- **IDS/IPS Plugin** - Suricata integration
- **Antivirus Plugin** - ClamAV integration
- **Certificate Plugin** - Let's Encrypt, cert management
- **2FA Plugin** - Two-factor authentication

### 3. VPN Plugins
- **OpenVPN Plugin** - Server and client configuration
- **IPsec Plugin** - Site-to-site, remote access
- **WireGuard Plugin** - Modern VPN protocol
- **VPN Client Plugins** - Tailscale, OpenConnect, ZeroTier

### 4. Routing Plugins
- **FRRouting Plugin** - BGP, OSPF, RIP
- **Static Routes Plugin** - Route management
- **Policy Routing Plugin** - Advanced routing rules

### 5. Traffic Management Plugins
- **Traffic Shaper Plugin** - QoS, bandwidth limits
- **Captive Portal Plugin** - Guest network authentication
- **Netflow Plugin** - Traffic analysis

### 6. Service Plugins
- **DNS Plugin** - Unbound, DNS blocklists, DNSSEC
- **DHCP Plugin** - DHCPv4/v6, static mappings
- **NTP Plugin** - Chrony time synchronization
- **HAProxy Plugin** - Load balancing (already implemented)

### 7. Monitoring Plugins
- **Netdata Plugin** - Real-time performance monitoring
- **Zabbix Plugin** - Enterprise monitoring
- **Telegraf Plugin** - Metrics collection
- **SNMP Plugin** - Network management protocol

### 8. Proxy Plugins
- **Squid Plugin** - Web caching proxy
- **Nginx Plugin** - Reverse proxy, web server
- **Caddy Plugin** - Modern web server

### 9. Backup & HA Plugins
- **Backup Plugin** - Configuration backup (already implemented)
- **CARP Plugin** - High availability failover
- **Config Sync Plugin** - Multi-firewall synchronization

### 10. Utility Plugins
- **Diagnostics Plugin** - Network diagnostics, packet capture
- **System Plugin** - Updates, settings, logs
- **Reporting Plugin** - Traffic reports, health reports

## Plugin Interface

```typescript
interface MCPPlugin {
  // Metadata
  metadata: PluginMetadata;

  // Lifecycle hooks
  initialize(context: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;

  // MCP Tool registration
  getTools(): MCPTool[];
  getResources(): MCPResource[];
  getPrompts(): MCPPrompt[];

  // Event handling
  on(event: string, handler: EventHandler): void;
  emit(event: string, data: any): void;

  // Dependencies
  getDependencies(): string[];
}

interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  category: PluginCategory;
  author: string;
  opnsenseVersion?: string;
  enabled: boolean;
  config?: Record<string, any>;
}

interface PluginContext {
  apiClient: OPNsenseAPIClient;
  sshExecutor: SSHExecutor;
  eventBus: EventBus;
  cache: CacheManager;
  state: StateStore;
  logger: Logger;
}
```

## SSE Event System

### Event Types

```typescript
enum EventType {
  // System events
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  PLUGIN_LOADED = 'plugin.loaded',
  PLUGIN_ERROR = 'plugin.error',

  // Firewall events
  FIREWALL_RULE_CREATED = 'firewall.rule.created',
  FIREWALL_RULE_UPDATED = 'firewall.rule.updated',
  FIREWALL_RULE_DELETED = 'firewall.rule.deleted',
  FIREWALL_RULE_TRIGGERED = 'firewall.rule.triggered',

  // Network events
  INTERFACE_UP = 'network.interface.up',
  INTERFACE_DOWN = 'network.interface.down',
  VLAN_CREATED = 'network.vlan.created',
  ARP_ENTRY_ADDED = 'network.arp.added',

  // VPN events
  VPN_CONNECTED = 'vpn.connected',
  VPN_DISCONNECTED = 'vpn.disconnected',
  VPN_CLIENT_CONNECTED = 'vpn.client.connected',

  // Security events
  IDS_ALERT = 'security.ids.alert',
  AUTH_FAILED = 'security.auth.failed',
  CERT_EXPIRING = 'security.cert.expiring',

  // Monitoring events
  CPU_HIGH = 'monitor.cpu.high',
  MEMORY_HIGH = 'monitor.memory.high',
  DISK_HIGH = 'monitor.disk.high',
  BANDWIDTH_HIGH = 'monitor.bandwidth.high',

  // Service events
  SERVICE_STARTED = 'service.started',
  SERVICE_STOPPED = 'service.stopped',
  SERVICE_FAILED = 'service.failed',
}

interface Event {
  type: EventType;
  timestamp: Date;
  pluginId: string;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}
```

### SSE Endpoint Structure

```
GET /sse/events          - All events stream
GET /sse/events/firewall - Firewall events only
GET /sse/events/vpn      - VPN events only
GET /sse/events/security - Security events only
GET /sse/metrics         - Real-time metrics stream
GET /sse/logs            - Live log stream
```

## Plugin Discovery & Loading

1. **Scan** - Scan `src/plugins/` directory
2. **Validate** - Check plugin metadata and dependencies
3. **Resolve** - Resolve dependency order
4. **Initialize** - Call `initialize()` with context
5. **Register** - Register tools, resources, prompts
6. **Start** - Call `start()` to begin operation
7. **Monitor** - Periodic health checks

## Configuration

### Global Config (`config/opnsense-mcp.json`)

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "transport": "sse"
  },
  "opnsense": {
    "host": "192.168.1.1",
    "apiKey": "${OPNSENSE_API_KEY}",
    "apiSecret": "${OPNSENSE_API_SECRET}",
    "verifySsl": false
  },
  "plugins": {
    "autoLoad": true,
    "directory": "src/plugins",
    "enabled": [
      "core-firewall",
      "core-network",
      "core-nat",
      "vpn-openvpn",
      "security-ids",
      "monitoring-netdata",
      "services-dns"
    ],
    "disabled": []
  },
  "events": {
    "enabled": true,
    "retention": "24h",
    "maxListeners": 100
  },
  "cache": {
    "type": "redis",
    "ttl": 300,
    "enabled": true
  }
}
```

### Plugin Config (`src/plugins/vpn-openvpn/config.json`)

```json
{
  "metadata": {
    "id": "vpn-openvpn",
    "name": "OpenVPN Plugin",
    "version": "1.0.0",
    "category": "vpn",
    "description": "OpenVPN server and client management"
  },
  "config": {
    "enableAutoReconnect": true,
    "monitorInterval": 30000,
    "maxClients": 100
  },
  "dependencies": [
    "core-network",
    "core-firewall"
  ]
}
```

## File Structure

```
src/
├── plugins/
│   ├── core/
│   │   ├── core-firewall/
│   │   │   ├── index.ts
│   │   │   ├── config.json
│   │   │   ├── tools/
│   │   │   ├── resources/
│   │   │   └── events.ts
│   │   ├── core-network/
│   │   └── core-nat/
│   │
│   ├── vpn/
│   │   ├── vpn-openvpn/
│   │   ├── vpn-ipsec/
│   │   └── vpn-wireguard/
│   │
│   ├── security/
│   │   ├── security-ids/
│   │   ├── security-av/
│   │   └── security-cert/
│   │
│   ├── routing/
│   │   ├── routing-frr/
│   │   └── routing-static/
│   │
│   ├── monitoring/
│   │   ├── monitoring-netdata/
│   │   ├── monitoring-zabbix/
│   │   └── monitoring-telegraf/
│   │
│   ├── services/
│   │   ├── services-dns/
│   │   ├── services-dhcp/
│   │   └── services-haproxy/
│   │
│   └── proxy/
│       ├── proxy-squid/
│       └── proxy-nginx/
│
├── core/
│   ├── plugin-system/
│   │   ├── registry.ts
│   │   ├── loader.ts
│   │   ├── lifecycle.ts
│   │   └── base-plugin.ts
│   │
│   ├── event-bus/
│   │   ├── bus.ts
│   │   ├── stream.ts
│   │   └── types.ts
│   │
│   ├── sse/
│   │   ├── server.ts
│   │   ├── connection-manager.ts
│   │   └── event-stream.ts
│   │
│   └── types/
│       ├── plugin.ts
│       ├── events.ts
│       └── config.ts
│
├── api/
│   └── client.ts
│
├── transports/
│   ├── sse-server.ts  (enhanced)
│   └── stdio.ts
│
└── index.ts  (orchestrator)
```

## Benefits

1. **Separation of Concerns** - Each plugin handles one aspect
2. **Easy Testing** - Plugins can be tested in isolation
3. **Gradual Migration** - Can migrate existing code incrementally
4. **Community Extensions** - Third parties can create plugins
5. **Real-time Updates** - SSE provides live monitoring
6. **Scalability** - Load only needed plugins
7. **Maintainability** - Clear boundaries and responsibilities
8. **Type Safety** - Full TypeScript support

## Migration Path

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create plugin system core
- [ ] Implement event bus
- [ ] Enhance SSE server with event streaming
- [ ] Create base plugin class and interfaces

### Phase 2: Core Plugins (Week 2)
- [ ] Migrate firewall features to core-firewall plugin
- [ ] Migrate network features to core-network plugin
- [ ] Migrate NAT features to core-nat plugin

### Phase 3: New Plugins (Week 3-4)
- [ ] VPN plugins (OpenVPN, IPsec, WireGuard)
- [ ] Security plugins (IDS/IPS)
- [ ] Monitoring plugins (Netdata, Zabbix)

### Phase 4: Advanced Features (Week 5-6)
- [ ] Routing plugins (FRRouting)
- [ ] Proxy plugins (Squid, Nginx)
- [ ] Real-time metrics and dashboards

## Example: Creating a New Plugin

```typescript
// src/plugins/vpn/vpn-wireguard/index.ts
import { BasePlugin } from '@/core/plugin-system/base-plugin';

export class WireGuardPlugin extends BasePlugin {
  async initialize(context: PluginContext) {
    this.context = context;
    this.logger.info('Initializing WireGuard plugin');
  }

  async start() {
    // Start monitoring WireGuard connections
    this.startMonitoring();
    this.emit('vpn.wireguard.started', {});
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'wireguard_list_tunnels',
        description: 'List all WireGuard tunnels',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listTunnels.bind(this)
      },
      {
        name: 'wireguard_create_tunnel',
        description: 'Create a new WireGuard tunnel',
        inputSchema: { /* ... */ },
        handler: this.createTunnel.bind(this)
      }
    ];
  }

  private async listTunnels() {
    // Implementation
  }

  private async createTunnel(params: any) {
    const result = await this.context.apiClient.post(/* ... */);
    this.emit('vpn.tunnel.created', result);
    return result;
  }
}
```

## Conclusion

This modular architecture provides a solid foundation for comprehensive OPNsense management with:
- Easy extensibility through plugins
- Real-time monitoring via SSE
- Clear separation of concerns
- Type-safe development
- Community contribution support
