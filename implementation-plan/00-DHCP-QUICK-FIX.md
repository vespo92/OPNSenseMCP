# Add DHCP Support - Quick Implementation

Here's the code to add DHCP lease visibility to your MCP server RIGHT NOW:

## 1. First, import the DHCP resource in index.ts

Add this import at the top with the other imports:

```typescript
import { DhcpLeaseResource } from './resources/services/dhcp/leases.js';
```

## 2. Add dhcpResource property to the class

In the OPNSenseMCPServer class, add:

```typescript
private dhcpResource: DhcpLeaseResource | null = null;
```

## 3. Initialize DHCP resource in the initialize() method

After initializing firewallRuleResource, add:

```typescript
// Initialize DHCP resource
this.dhcpResource = new DhcpLeaseResource(this.client);
```

## 4. Add DHCP tools to the tools array

In setupHandlers(), add these tools after the firewall tools:

```typescript
// DHCP Lease Management Tools
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
  name: 'find_device_by_name',
  description: 'Find devices by hostname pattern',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { 
        type: 'string', 
        description: 'Hostname pattern to search (case-insensitive)' 
      }
    },
    required: ['pattern']
  }
},
{
  name: 'find_device_by_mac',
  description: 'Find device by MAC address',
  inputSchema: {
    type: 'object',
    properties: {
      mac: { 
        type: 'string', 
        description: 'MAC address (with or without colons)' 
      }
    },
    required: ['mac']
  }
},
{
  name: 'get_guest_devices',
  description: 'Get all devices on guest network (VLAN 4)',
  inputSchema: {
    type: 'object',
    properties: {}
  }
},
{
  name: 'get_devices_by_interface',
  description: 'Group devices by network interface',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}
```

## 5. Add tool handlers

In the switch statement for handling tools, add these cases:

```typescript
case 'list_dhcp_leases': {
  if (!this.dhcpResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  try {
    const leases = await this.dhcpResource.listLeases();
    
    // Filter by interface if specified
    const filtered = args?.interface 
      ? leases.filter(l => l.if === args.interface)
      : leases;
    
    // Format for display
    const formatted = filtered.map(lease => ({
      hostname: lease.hostname || 'Unknown Device',
      ip: lease.address,
      mac: lease.hwaddr,
      interface: lease.if,
      state: lease.state,
      starts: lease.starts,
      ends: lease.ends,
      deviceInfo: this.dhcpResource!.getDeviceInfo(lease)
    }));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(formatted, null, 2)
      }]
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list DHCP leases: ${error.message}`
    );
  }
}

case 'find_device_by_name': {
  if (!this.dhcpResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  if (!args || !args.pattern) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'pattern parameter is required'
    );
  }
  
  try {
    const results = await this.dhcpResource.findByHostname(args.pattern as string);
    
    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No devices found matching pattern "${args.pattern}"`
        }]
      };
    }
    
    const formatted = results.map(lease => 
      this.dhcpResource!.formatLease(lease)
    );
    
    return {
      content: [{
        type: 'text',
        text: `Found ${results.length} device(s):\n\n${formatted.join('\n')}`
      }]
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search devices: ${error.message}`
    );
  }
}

case 'find_device_by_mac': {
  if (!this.dhcpResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  if (!args || !args.mac) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'mac parameter is required'
    );
  }
  
  try {
    const results = await this.dhcpResource.findByMac(args.mac as string);
    
    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No device found with MAC address "${args.mac}"`
        }]
      };
    }
    
    const formatted = results.map(lease => 
      this.dhcpResource!.formatLease(lease)
    );
    
    return {
      content: [{
        type: 'text',
        text: formatted.join('\n')
      }]
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search by MAC: ${error.message}`
    );
  }
}

case 'get_guest_devices': {
  if (!this.dhcpResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  try {
    const guestDevices = await this.dhcpResource.getGuestLeases();
    
    if (guestDevices.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No devices currently connected to guest network'
        }]
      };
    }
    
    const formatted = guestDevices.map(lease => {
      const info = this.dhcpResource!.getDeviceInfo(lease);
      return `• ${info}`;
    });
    
    return {
      content: [{
        type: 'text',
        text: `${guestDevices.length} device(s) on guest network:\n\n${formatted.join('\n')}`
      }]
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get guest devices: ${error.message}`
    );
  }
}

case 'get_devices_by_interface': {
  if (!this.dhcpResource) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  try {
    const byInterface = await this.dhcpResource.getLeasesByInterface();
    
    let output = 'Devices by Interface:\n\n';
    
    for (const [iface, devices] of byInterface) {
      output += `${iface}: ${devices.length} device(s)\n`;
      
      // Show first few devices per interface
      const preview = devices.slice(0, 3);
      for (const device of preview) {
        const hostname = device.hostname || 'Unknown';
        output += `  • ${hostname} (${device.address})\n`;
      }
      
      if (devices.length > 3) {
        output += `  ... and ${devices.length - 3} more\n`;
      }
      
      output += '\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to group devices: ${error.message}`
    );
  }
}
```

## 6. Also update the configure case

In the 'configure' case, add DHCP resource initialization:

```typescript
this.dhcpResource = new DhcpLeaseResource(this.client);
```

## 7. Add DHCP resource to resources list (optional)

You can also add a resource endpoint for DHCP leases:

```typescript
{
  uri: 'opnsense://dhcp/leases',
  name: 'DHCP Leases',
  description: 'Current DHCP leases',
  mimeType: 'application/json'
}
```

And handle it in the ReadResourceRequestSchema:

```typescript
case 'opnsense://dhcp/leases': {
  const leases = await this.dhcpResource.listLeases();
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(leases, null, 2)
    }]
  };
}
```

## Testing

After making these changes:

1. Rebuild: `npm run build`
2. Restart Claude Desktop
3. Test commands:
   - "List all DHCP leases"
   - "Find devices with 'kyle' in the name"
   - "Show devices on the guest network"
   - "Find device with MAC address 3c:22:fb:aa:bb:cc"
   - "Group devices by network interface"

Now you can ask Claude things like:
- "When did Kyle's TV last connect to the guest WiFi?"
- "Show me all Samsung devices on the network"
- "List all devices on VLAN 4"