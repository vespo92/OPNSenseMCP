# Immediate Fixes & Quick Wins

## 1. Expose DHCP Lease Management (1-2 hours)

The DHCP lease resource already exists but isn't exposed in the MCP interface. Here's what needs to be done:

### Add DHCP Tools to index.ts

```typescript
// Add to the tools array in setupHandlers():

// DHCP Management Tools
{
  name: 'list_dhcp_leases',
  description: 'List all DHCP leases',
  inputSchema: {
    type: 'object',
    properties: {
      interface: { 
        type: 'string', 
        description: 'Filter by interface (optional)' 
      }
    }
  }
},
{
  name: 'find_device',
  description: 'Find devices by hostname or MAC address',
  inputSchema: {
    type: 'object',
    properties: {
      search: { 
        type: 'string', 
        description: 'Hostname pattern or MAC address to search' 
      },
      searchType: {
        type: 'string',
        enum: ['hostname', 'mac'],
        default: 'hostname'
      }
    },
    required: ['search']
  }
},
{
  name: 'get_guest_devices',
  description: 'Get all devices on guest network (VLAN 4)',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}
```

### Add Tool Handlers

```typescript
// Add these cases to the tool handler switch:

case 'list_dhcp_leases': {
  if (!this.dhcpResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  const leases = await this.dhcpResource.listLeases();
  
  // Filter by interface if specified
  const filtered = args?.interface 
    ? leases.filter(l => l.if === args.interface)
    : leases;
  
  // Format nicely
  const formatted = filtered.map(lease => ({
    hostname: lease.hostname || 'Unknown',
    ip: lease.address,
    mac: lease.hwaddr,
    interface: lease.if,
    state: lease.state,
    manufacturer: this.dhcpResource.getMacManufacturer(lease.hwaddr),
    lastSeen: lease.ends || 'Active'
  }));
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(formatted, null, 2)
    }]
  };
}

case 'find_device': {
  if (!this.dhcpResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  const searchType = args.searchType || 'hostname';
  const results = searchType === 'mac'
    ? await this.dhcpResource.findByMac(args.search as string)
    : await this.dhcpResource.findByHostname(args.search as string);
  
  const formatted = results.map(lease => 
    this.dhcpResource.getDeviceInfo(lease)
  );
  
  return {
    content: [{
      type: 'text',
      text: results.length > 0
        ? `Found ${results.length} devices:\n${formatted.join('\n')}`
        : `No devices found matching "${args.search}"`
    }]
  };
}
```

## 2. Add Network Topology Discovery (2-3 hours)

Create a new resource for network topology:

```typescript
// src/resources/network/topology.ts
export class NetworkTopologyResource {
  async getTopology(): Promise<NetworkTopology> {
    // Combine data from:
    // - VLANs
    // - Interfaces
    // - DHCP leases
    // - Firewall rules
    // - HAProxy configs (if available)
    
    return {
      networks: [...],
      devices: [...],
      connections: [...],
      services: [...]
    };
  }
  
  async exportToMermaid(): Promise<string> {
    // Generate Mermaid diagram of network
  }
}
```

## 3. Add Resource Dependencies (1 hour)

Update existing resources to track dependencies:

```typescript
// When creating a firewall rule that references a VLAN:
const rule = await this.firewallRuleResource.create({
  ...ruleConfig,
  _metadata: {
    dependencies: [`vlan:${vlanTag}`]
  }
});
```

## Quick Claude Commands to Test

Once implemented, you can ask Claude:

- "Find all of Kyle's devices on the network"
- "Show me what's connected to the guest WiFi"
- "When did the TV last connect?"
- "List all Samsung devices"
- "Show network topology diagram"