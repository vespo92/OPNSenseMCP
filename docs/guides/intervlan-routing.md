# Inter-VLAN Routing Configuration Guide

This guide explains how to enable and configure inter-VLAN routing in OPNsense using the MCP Server.

## Overview

Inter-VLAN routing allows traffic to flow between different VLANs (Virtual LANs) in your network. By default, OPNsense blocks traffic between private networks (RFC1918 addresses) for security. This feature allows you to selectively enable routing between VLANs while maintaining security through firewall rules.

## Components

The MCP Server provides three main components for managing inter-VLAN routing:

### 1. System Settings Resource
Manages system-level firewall and routing settings that affect all interfaces.

### 2. Interface Configuration Resource  
Manages individual interface settings including VLAN-specific routing options.

### 3. Firewall Rules Resource
Creates and manages firewall rules to control traffic flow between VLANs.

## MCP Tools

### System Settings Tools

#### `system_get_settings`
Get current system-level firewall and routing settings.

```javascript
// Example usage
const settings = await callTool('system_get_settings', {});
```

#### `system_enable_intervlan_routing`
Enable inter-VLAN routing at the system level with recommended settings.

```javascript
// Example usage
const result = await callTool('system_enable_intervlan_routing', {});
```

#### `system_update_firewall_settings`
Update specific firewall settings manually.

```javascript
// Example usage
const result = await callTool('system_update_firewall_settings', {
  blockprivatenetworks: '0',  // Allow private networks
  blockbogons: '0',            // Allow bogons
  allowinterlantraffic: '1'    // Enable inter-LAN traffic
});
```

### Interface Configuration Tools

#### `interface_list_overview`
List all network interfaces with their current status.

```javascript
// Example usage
const interfaces = await callTool('interface_list_overview', {});
```

#### `interface_get_config`
Get detailed configuration for a specific interface.

```javascript
// Example usage
const config = await callTool('interface_get_config', {
  interfaceName: 'opt8'  // DMZ interface
});
```

#### `interface_enable_intervlan_routing`
Enable inter-VLAN routing on a specific interface.

```javascript
// Example usage
const result = await callTool('interface_enable_intervlan_routing', {
  interfaceName: 'opt8'  // Enable on DMZ interface
});
```

#### `interface_configure_dmz`
Configure DMZ interface specifically for inter-VLAN routing.

```javascript
// Example usage
const result = await callTool('interface_configure_dmz', {
  dmzInterface: 'opt8'  // Default DMZ interface
});
```

#### `interface_update_config`
Update interface configuration with specific settings.

```javascript
// Example usage
const result = await callTool('interface_update_config', {
  interfaceName: 'opt8',
  blockpriv: '0',      // Allow private networks
  blockbogons: '0',    // Allow bogons
  enable: '1'          // Ensure interface is enabled
});
```

## Quick Start: Enable DMZ to LAN Routing

### Using the Automated Script

The easiest way to enable inter-VLAN routing is using the provided script:

```bash
npm run enable:intervlan
```

This script will:
1. Enable system-level inter-VLAN routing settings
2. Configure the DMZ interface (opt8) 
3. Create firewall rules for DMZ to LAN communication
4. Set up NFS rules for TrueNAS access

### Manual Configuration via MCP Tools

If you prefer manual control, follow these steps:

1. **Enable System Settings**
```javascript
await callTool('system_enable_intervlan_routing', {});
```

2. **Configure DMZ Interface**
```javascript
await callTool('interface_configure_dmz', {
  dmzInterface: 'opt8'
});
```

3. **Create Firewall Rules**
```javascript
// Allow DMZ to LAN
await callTool('create_firewall_rule', {
  interface: 'opt8',
  action: 'pass',
  direction: 'in',
  protocol: 'any',
  source_net: '10.0.6.0/24',
  destination_net: '10.0.0.0/24',
  description: 'Allow DMZ to LAN traffic'
});

// Allow LAN to DMZ (return traffic)
await callTool('create_firewall_rule', {
  interface: 'lan',
  action: 'pass',
  direction: 'in',
  protocol: 'any',
  source_net: '10.0.0.0/24',
  destination_net: '10.0.6.0/24',
  description: 'Allow LAN to DMZ traffic'
});
```

## Common Use Cases

### DMZ to TrueNAS NFS Access

Enable NFS access from DMZ servers to TrueNAS:

```javascript
// Create NFS-specific rules
await callTool('create_firewall_rule', {
  interface: 'opt8',
  action: 'pass',
  direction: 'in',
  protocol: 'tcp',
  source_net: '10.0.6.0/24',
  destination_net: '10.0.0.14',
  destination_port: '111,2049',
  description: 'Allow NFS TCP from DMZ to TrueNAS'
});

await callTool('create_firewall_rule', {
  interface: 'opt8',
  action: 'pass',
  direction: 'in',
  protocol: 'udp',
  source_net: '10.0.6.0/24',
  destination_net: '10.0.0.14',
  destination_port: '111,2049',
  description: 'Allow NFS UDP from DMZ to TrueNAS'
});
```

### Guest VLAN Internet-Only Access

Configure guest VLAN with internet access but no local network access:

```javascript
// Block guest to local networks
await callTool('create_firewall_rule', {
  interface: 'opt2',  // Guest VLAN interface
  action: 'block',
  direction: 'in',
  protocol: 'any',
  source_net: '10.0.2.0/24',
  destination_net: '10.0.0.0/16',  // All local networks
  description: 'Block guest to local networks'
});

// Allow guest to internet
await callTool('create_firewall_rule', {
  interface: 'opt2',
  action: 'pass',
  direction: 'in',
  protocol: 'any',
  source_net: '10.0.2.0/24',
  destination_net: 'any',
  description: 'Allow guest to internet'
});
```

## Troubleshooting

### Traffic Still Blocked After Configuration

1. **Verify System Settings**
```javascript
const settings = await callTool('system_get_settings', {});
// Check that blockprivatenetworks = '0'
```

2. **Verify Interface Settings**
```javascript
const config = await callTool('interface_get_config', {
  interfaceName: 'opt8'
});
// Check that blockpriv = '0'
```

3. **Check Firewall Rules**
```javascript
const rules = await callTool('list_firewall_rules', {});
// Verify rules exist and are enabled
```

4. **Check Gateway Settings**
Ensure DMZ hosts have the correct default gateway (10.0.6.1 for DMZ).

### Testing Connectivity

From a DMZ host:
```bash
# Test basic connectivity to gateway
ping 10.0.6.1

# Test routing to LAN
ping 10.0.0.14

# Test NFS access
showmount -e 10.0.0.14
```

## Security Considerations

1. **Principle of Least Privilege**: Only allow necessary traffic between VLANs
2. **Use Specific Rules**: Avoid using "any" for protocols when possible
3. **Log Important Rules**: Enable logging on inter-VLAN rules for auditing
4. **Regular Review**: Periodically review and audit inter-VLAN routing rules

## API Endpoints Used

The inter-VLAN routing features use these OPNsense API endpoints:

- `/api/firewall/settings/get` - Get firewall settings
- `/api/firewall/settings/set` - Update firewall settings  
- `/api/interfaces/overview/list` - List interfaces
- `/api/interfaces/settings/get/{interface}` - Get interface config
- `/api/interfaces/settings/set/{interface}` - Update interface config
- `/api/firewall/filter/addRule` - Create firewall rules
- `/api/firewall/filter/apply` - Apply firewall changes

## Example: Complete DMZ Setup

```javascript
// Complete DMZ setup with inter-VLAN routing
async function setupDMZ() {
  // 1. Enable system-level routing
  await callTool('system_enable_intervlan_routing', {});
  
  // 2. Configure DMZ interface
  await callTool('interface_configure_dmz', {
    dmzInterface: 'opt8'
  });
  
  // 3. Create bidirectional rules
  await callTool('create_firewall_rule', {
    interface: 'opt8',
    action: 'pass',
    direction: 'in',
    protocol: 'any',
    source_net: '10.0.6.0/24',
    destination_net: '10.0.0.0/24',
    description: 'DMZ to LAN access'
  });
  
  await callTool('create_firewall_rule', {
    interface: 'lan',
    action: 'pass',
    direction: 'in',
    protocol: 'any',
    source_net: '10.0.0.0/24',
    destination_net: '10.0.6.0/24',
    description: 'LAN to DMZ access'
  });
  
  console.log('DMZ setup complete!');
}
```

## Related Documentation

- [Firewall Rules Guide](./firewall-rules.md)
- [VLAN Management Guide](./vlan-management.md)
- [Network Architecture](../architecture/ARCHITECTURE.md)