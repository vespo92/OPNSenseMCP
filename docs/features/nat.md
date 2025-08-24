# NAT (Network Address Translation) Management

## Overview

The OPNsense MCP Server provides comprehensive NAT management capabilities through SSH-based configuration, as OPNsense doesn't expose NAT configuration through its REST API.

## Implementation Approach

### SSH/XML Configuration
Since OPNsense's NAT API endpoints don't exist (`/api/firewall/nat/*` returns 404), the MCP server uses:
1. Direct XML configuration manipulation via SSH
2. Parsing and modifying `/conf/config.xml`
3. Applying changes with `configctl filter reload`

### Architecture
```
MCP Client → NAT Tool → SSH Executor → OPNsense Config XML → Apply Changes
```

## Features

### NAT Modes
- **Automatic**: Default mode, automatically NATs all outbound traffic
- **Hybrid**: Combines automatic rules with manual exceptions
- **Manual**: Only user-defined rules are applied
- **Disabled**: No NAT applied (for transparent bridges)

### Outbound NAT Rules
- Create no-NAT rules for inter-VLAN traffic
- Define source and destination networks
- Support for interface selection
- Rule descriptions and logging

### DMZ Fix Capability
Automated fix for common DMZ NAT issues where inter-VLAN traffic gets incorrectly NAT'd to WAN.

## Configuration

### Required Environment Variables
```bash
OPNSENSE_SSH_HOST=opnsense.example.com
OPNSENSE_SSH_USERNAME=root
OPNSENSE_SSH_PASSWORD=your_password
# Or use SSH key
OPNSENSE_SSH_KEY_PATH=~/.ssh/id_rsa
```

## MCP Tools

### nat_list_outbound
List all outbound NAT rules.
```javascript
await mcp.call('nat_list_outbound');
```

### nat_get_mode
Get current NAT mode.
```javascript
await mcp.call('nat_get_mode');
// Returns: { mode: 'hybrid' }
```

### nat_set_mode
Set NAT mode.
```javascript
await mcp.call('nat_set_mode', {
  mode: 'hybrid' // automatic|hybrid|manual|disabled
});
```

### nat_create_outbound_rule
Create an outbound NAT rule.
```javascript
await mcp.call('nat_create_outbound_rule', {
  interface: 'wan',
  source: '10.0.6.0/24',
  destination: '10.0.0.0/24',
  nonat: true,
  description: 'No NAT for DMZ to LAN'
});
```

### nat_fix_dmz
Comprehensive DMZ NAT fix.
```javascript
await mcp.call('nat_fix_dmz', {
  dmzNetwork: '10.0.6.0/24',
  lanNetwork: '10.0.0.0/24',
  iotNetwork: '10.0.2.0/24' // optional
});
```

### nat_quick_fix_dmz
Quick DMZ fix with default networks.
```javascript
await mcp.call('nat_quick_fix_dmz');
```

### nat_analyze_config
Analyze NAT configuration for issues.
```javascript
await mcp.call('nat_analyze_config');
```

## XML Configuration Structure

The NAT configuration in `/conf/config.xml`:
```xml
<nat>
  <outbound>
    <mode>hybrid</mode>
    <rule>
      <interface>wan</interface>
      <source>
        <network>10.0.6.0/24</network>
      </source>
      <destination>
        <network>10.0.0.0/24</network>
      </destination>
      <nonat>1</nonat>
      <descr>No NAT: DMZ to LAN</descr>
    </rule>
  </outbound>
</nat>
```

## Common Use Cases

### Fix DMZ Inter-VLAN Routing
```javascript
// Problem: DMZ can't reach internal networks
// Solution: Create no-NAT rules
await mcp.call('nat_fix_dmz', {
  dmzNetwork: '10.0.6.0/24',
  lanNetwork: '10.0.0.0/24'
});
```

### Enable Hybrid NAT Mode
```javascript
// Allow manual rules alongside automatic ones
await mcp.call('nat_set_mode', { mode: 'hybrid' });
```

### Create Port Forward (Future)
```javascript
// Note: Port forwarding implementation pending
await mcp.call('nat_create_port_forward', {
  interface: 'wan',
  protocol: 'tcp',
  destination_port: '443',
  target: '10.0.0.100',
  local_port: '443'
});
```

## Troubleshooting

### SSH Not Configured
If you see "SSH not configured" errors:
1. Add SSH credentials to `.env`
2. Ensure SSH access is enabled on OPNsense
3. Test with: `npx tsx scripts/test/test-ssh.ts`

### Changes Not Applied
If NAT changes don't take effect:
1. Check SSH connectivity
2. Verify user has root/admin privileges
3. Manually run `configctl filter reload` via SSH

### API Fallback
When SSH isn't configured, limited functionality is available through graceful degradation to API mode (list operations only).

## Testing

Use the interactive NAT test tool:
```bash
npx tsx scripts/test/test-nat-ssh.ts
```

This provides options to:
- Test SSH connection
- View/modify NAT mode
- Create no-NAT rules
- Fix DMZ issues
- Analyze configuration

## Implementation Details

The NAT resource (`src/resources/firewall/nat.ts`) implements:
- XML parsing with `xml2js`
- SSH command execution
- Configuration backup before changes
- Atomic operations with rollback capability
- Comprehensive error handling

## Version History

- **v0.8.2**: Complete SSH-based NAT implementation
- **v0.8.1**: Initial NAT API attempts (failed)
- **v0.8.0**: SSH executor added for CLI operations