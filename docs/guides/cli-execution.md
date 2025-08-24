# CLI Execution Guide

## Overview

The OPNsense MCP Server now includes CLI execution capabilities to handle advanced configuration tasks that are not exposed through the standard API. This is particularly critical for resolving issues like "Block private networks" settings on interfaces, which can prevent inter-VLAN routing.

## Why CLI Execution?

OPNsense's API is comprehensive but doesn't expose every configuration option available in the web UI. Critical settings like:
- Interface-level "Block private networks" (`blockpriv`)
- Interface-level "Block bogon networks" (`blockbogons`)
- Direct configuration file modifications
- Advanced routing table manipulations

...require CLI access to modify.

## Architecture

The CLI Executor Resource (`src/resources/cli/executor.ts`) provides:

1. **Safe Command Execution**: Whitelist-based command filtering
2. **Multiple Execution Paths**: Tries various API endpoints, falls back gracefully
3. **High-Level Operations**: Compound operations for common tasks
4. **Structured Output**: Parses CLI output into JSON when possible

## Available CLI Tools

### Basic CLI Execution

#### `cli_execute`
Execute any whitelisted CLI command on OPNsense.

```javascript
// Example: Get routing table
await mcp.callTool('cli_execute', {
  command: 'netstat',
  args: ['-rn']
});
```

### Interface Management

#### `cli_fix_interface_blocking`
Disable "Block private networks" and "Block bogons" on an interface.

```javascript
// Fix DMZ interface to allow private network routing
await mcp.callTool('cli_fix_interface_blocking', {
  interfaceName: 'opt8'  // DMZ interface
});
```

### Firewall Operations

#### `cli_reload_firewall`
Reload firewall rules via CLI (more thorough than API reload).

```javascript
await mcp.callTool('cli_reload_firewall', {});
```

### Routing Diagnostics

#### `cli_show_routing`
Display the current routing table.

```javascript
const routes = await mcp.callTool('cli_show_routing', {});
// Returns parsed routing table in JSON format
```

### DMZ Fixes

#### `cli_fix_dmz_routing`
Comprehensive fix for DMZ to LAN routing issues.

```javascript
// Applies multiple fixes in sequence
await mcp.callTool('cli_fix_dmz_routing', {});
```

This tool:
1. Disables blocking on DMZ interface (opt8)
2. Reloads firewall rules
3. Checks routing table
4. Tests NFS connectivity
5. Applies all changes

#### `cli_check_nfs`
Check NFS connectivity from DMZ to TrueNAS.

```javascript
await mcp.callTool('cli_check_nfs', {
  truenasIP: '10.0.0.14'  // Optional, defaults to 10.0.0.14
});
```

### Configuration Management

#### `cli_apply_changes`
Apply all pending configuration changes.

```javascript
await mcp.callTool('cli_apply_changes', {});
```

## Implementation Details

### Command Execution Flow

1. **API Endpoint Attempts**: The executor first tries these endpoints:
   - `/diagnostics/command/execute`
   - `/diagnostics/shell/exec`
   - `/core/system/exec`
   - `/system/console/exec`

2. **Configctl Fallback**: If no API endpoint works, attempts to use `configctl`

3. **Direct Config Modification**: For interface blocking, can modify `/conf/config.xml` directly

### Security

#### Command Whitelist
Only these commands are allowed:
- `configctl` - OPNsense configuration control
- `pfctl` - Packet filter control
- `pluginctl` - Plugin control
- `netstat` - Network statistics
- `ifconfig` - Interface configuration
- `route` - Routing table management
- `arp` - ARP table management
- `ping` - Network connectivity test
- `traceroute` - Network path discovery
- `showmount` - NFS mount discovery
- `cat /conf/config.xml` - View configuration
- `grep`, `sed`, `awk` - Text processing

#### Input Sanitization
All command arguments are validated and sanitized before execution.

## Common Use Cases

### Fix DMZ to LAN Routing

```javascript
// Step 1: Run diagnostics
const diagnostics = await mcp.callTool('routing_diagnostics', {
  sourceNetwork: '10.0.6.0/24',  // DMZ
  destNetwork: '10.0.0.0/24'      // LAN
});

// Step 2: If interface blocking detected, fix via CLI
if (diagnostics.includes('blocking private networks')) {
  await mcp.callTool('cli_fix_interface_blocking', {
    interfaceName: 'opt8'
  });
}

// Step 3: Reload firewall
await mcp.callTool('cli_reload_firewall', {});

// Step 4: Verify routing
const routes = await mcp.callTool('cli_show_routing', {});
console.log('Routing table:', routes);
```

### Complete DMZ Fix (One Command)

```javascript
// Comprehensive fix that handles all common issues
await mcp.callTool('cli_fix_dmz_routing', {});
```

## Troubleshooting

### No CLI Endpoint Available

If you see "No CLI execution endpoint available", it means:
1. OPNsense doesn't have the required API endpoints
2. The API user lacks necessary permissions
3. The command is not in the whitelist

**Solution**: Ensure your API user has full administrative privileges.

### Command Not in Whitelist

For security, only whitelisted commands can be executed.

**Solution**: If you need a new command, add it to the `SAFE_COMMANDS` array in `cli/executor.ts`.

### Interface Blocking Still Active

If interface blocking persists after running the fix:

1. Check if changes were applied:
   ```javascript
   await mcp.callTool('cli_apply_changes', {});
   ```

2. Verify interface configuration:
   ```javascript
   await mcp.callTool('cli_execute', {
     command: 'grep',
     args: ['-A20', '"<opt8>"', '/conf/config.xml']
   });
   ```

3. Force a full system reconfigure:
   ```javascript
   await mcp.callTool('cli_execute', {
     command: 'configctl',
     args: ['firmware', 'reload']
   });
   ```

## Testing

Use the provided test script to verify CLI functionality:

```bash
# Test CLI executor (read-only operations)
npm run test:cli

# Apply DMZ routing fix
npm run test:cli -- --fix
```

## Future Enhancements

1. **SSH Fallback**: Direct SSH execution when API endpoints unavailable
2. **Custom Plugin**: OPNsense plugin to expose CLI via secure API
3. **Batch Operations**: Execute multiple commands in transaction
4. **Output Streaming**: Real-time output for long-running commands
5. **Audit Logging**: Complete audit trail of all CLI operations

## Security Considerations

- **Never** expose CLI execution to untrusted users
- **Always** use the whitelist for command validation
- **Audit** all CLI operations in production
- **Limit** API user permissions to minimum required
- **Monitor** for unusual CLI activity patterns

## Conclusion

The CLI Executor bridges the gap between OPNsense's API and full configurability, enabling complete automation of firewall management through the MCP protocol. Use it judiciously for operations that cannot be performed via the standard API.