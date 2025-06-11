# OPNSense Natural Language Query Engine - IaC Integration Guide

## Overview

This Natural Language Query Engine for OPNSense is designed as a foundational component for your larger Infrastructure as Code (IaC) vision. It demonstrates how MCP servers can provide intelligent, natural language interfaces to infrastructure components.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User Natural Language                  │
│           "Is the Nintendo Switch online?"               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              MCP Orchestrator (Future)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │  OPNSense   │ │   Proxmox   │ │    AWS      │      │
│  │   Query     │ │     MCP     │ │    MCP      │      │
│  │   Engine    │ │   Server    │ │   Server    │      │
│  └─────────────┘ └─────────────┘ └─────────────┘      │
└─────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Infrastructure Layer                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │  OPNSense   │ │   Proxmox   │ │    AWS      │      │
│  │  Firewall   │ │    VMs      │ │   Cloud     │      │
│  └─────────────┘ └─────────────┘ └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

## Key Features for IaC Integration

### 1. **Natural Language Infrastructure Queries**
Instead of complex CLI commands or API calls, ask questions naturally:
- "Is the game server VM running?"
- "How much bandwidth is the media server using?"
- "Are there any unknown devices on the IoT network?"

### 2. **Cross-Platform Intelligence**
The query engine can be extended to understand relationships across platforms:
```typescript
// Future capability
"Which VMs are accessible from the guest network?"
// → Combines OPNSense firewall rules + Proxmox VM data

"Show me all resources tagged as 'production'"
// → Queries OPNSense VLANs + Proxmox VMs + AWS instances
```

### 3. **Infrastructure State Tracking**
Real-time tracking of all infrastructure components:
- Device status and locations
- Network topology and segmentation
- Resource utilization and performance
- Security posture and compliance

### 4. **Intelligent Automation Triggers**
Natural language can trigger infrastructure changes:
```typescript
// Future examples
"Block all unknown devices on the guest network"
// → Creates firewall rules automatically

"Spin up a new game server when the current one reaches 80% CPU"
// → Triggers Proxmox VM creation with predefined template

"Move the backup traffic to the overnight window"
// → Updates QoS rules and backup schedules
```

## Integration with Pulumi/SST Pattern

### 1. **Infrastructure Definition**
```typescript
// Future: Natural language to Pulumi code
const query = "Create a new isolated network for development with its own firewall rules";

// Translates to:
const devNetwork = new opnsense.VLAN("dev-network", {
  tag: 10,
  interface: "igc3",
  description: "Development Network"
});

const devFirewall = new opnsense.FirewallRule("dev-access", {
  interface: devNetwork.interface,
  source: devNetwork.subnet,
  destination: "any",
  action: "pass"
});
```

### 2. **State Queries Across Stack**
```typescript
// Query infrastructure state naturally
const state = await mcp.query(
  "Show me all development resources and their current status"
);

// Returns unified view:
{
  networks: [
    { name: "dev-network", vlan: 10, devices: 12, status: "active" }
  ],
  vms: [
    { name: "dev-api", host: "proxmox1", cpu: "45%", status: "running" }
  ],
  services: [
    { name: "dev-database", type: "RDS", region: "us-east-1", status: "available" }
  ]
}
```

## Implementation Roadmap

### Phase 1: Foundation (Current) ✅
- OPNSense natural language queries
- Device fingerprinting and tracking
- Real-time network state
- Performance optimization (<100ms queries)

### Phase 2: Multi-Platform Integration
- Proxmox MCP server with VM queries
- Unifi MCP server for WiFi management
- Docker/Kubernetes MCP for container queries
- Cross-platform relationship mapping

### Phase 3: Intelligent Automation
- Natural language to IaC translation
- Automated infrastructure provisioning
- Policy-based auto-remediation
- Predictive scaling and optimization

### Phase 4: Full IaC Platform
- Visual infrastructure designer
- Git-based infrastructure versioning
- Compliance and security scanning
- Cost optimization recommendations

## Example Use Cases

### Home Lab Management
```typescript
// Morning routine
"Show me what ran overnight"
// → Backup status, update logs, bandwidth usage

"Prepare the network for gaming night"
// → Prioritize gaming traffic, check latency, ensure consoles online
```

### Security Monitoring
```typescript
"Alert me if any new devices join the network"
"Show me all devices that haven't been seen in 30 days"
"Which devices are talking to suspicious IPs?"
```

### Resource Optimization
```typescript
"Which VMs can be consolidated?"
"Show me underutilized resources"
"Predict next month's bandwidth needs"
```

## Technical Benefits

1. **Unified Query Language**: One natural language interface for all infrastructure
2. **Real-time State**: Always know what's happening across your infrastructure
3. **Predictable Performance**: All queries optimized for <100ms response
4. **Extensible Architecture**: Easy to add new infrastructure providers
5. **Git-Friendly**: All configurations and queries can be version controlled

## Next Steps

1. **Extend Device Detection**: Add more device types and patterns
2. **Build Proxmox MCP**: Create similar query engine for VM management
3. **Create MCP Orchestrator**: Unified interface for all MCP servers
4. **Implement IaC Translation**: Convert natural language to Pulumi/Terraform
5. **Add ML Predictions**: Predict infrastructure needs based on patterns

## Conclusion

This Natural Language Query Engine for OPNSense demonstrates the power of combining MCP servers with intelligent query processing. It's the first step toward a future where infrastructure can be managed entirely through natural language, making complex network and system administration accessible to everyone.

The vision: "Hey Claude, make sure my home lab is secure, efficient, and ready for anything" - and it just happens.