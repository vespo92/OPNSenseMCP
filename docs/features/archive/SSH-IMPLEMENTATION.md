# SSH-Based CLI Execution for OPNsense MCP Server

## Overview

The OPNsense MCP Server now includes comprehensive SSH-based CLI execution capability, providing **FULL CONTROL** over all OPNsense settings, including those not available via the REST API.

## Key Features

### Complete CLI Access
- Execute **ANY** OPNsense CLI command via SSH
- Direct access to `configctl`, `pfctl`, and system utilities
- Modify `/conf/config.xml` directly when needed
- Full control over interface settings, routing, and firewall rules

### Intelligent Architecture
- **Seamless API/SSH Integration**: Uses API when available, falls back to SSH for advanced operations
- **Connection Pooling**: Reuses SSH connections for efficiency
- **Auto-reconnection**: Handles connection drops gracefully
- **Command Queuing**: Batch operations for complex tasks
- **Security**: Command whitelisting and audit logging

## Configuration

Add these environment variables to your `.env` file:

```env
# SSH Configuration (optional - uses sensible defaults)
OPNSENSE_SSH_HOST=your-opnsense-host
OPNSENSE_SSH_PORT=22
OPNSENSE_SSH_USERNAME=root
OPNSENSE_SSH_PASSWORD=your-password-here

# Alternative: Use SSH key authentication
OPNSENSE_SSH_KEY_PATH=~/.ssh/id_rsa
OPNSENSE_SSH_PASSPHRASE=key-passphrase-if-encrypted
```

## Available SSH Tools

### Core Execution
- `ssh_execute` - Execute arbitrary SSH command
- `ssh_batch_execute` - Execute multiple commands in sequence

### DMZ & Routing Fixes
- `ssh_fix_interface_blocking` - Fix "Block private networks" setting
- `ssh_fix_dmz_routing` - Comprehensive DMZ routing fix
- `ssh_quick_dmz_fix` - Streamlined DMZ fix
- `ssh_enable_intervlan_routing` - Enable routing between VLANs

### Firewall Management
- `ssh_reload_firewall` - Reload firewall rules
- `ssh_show_pf_rules` - Show packet filter rules

### System Operations
- `ssh_show_routing` - Display routing table
- `ssh_system_status` - Get system status
- `ssh_backup_config` - Backup configuration
- `ssh_restore_config` - Restore configuration

### Network Testing
- `ssh_check_nfs_connectivity` - Test NFS connectivity
- `ssh_test_vlan_connectivity` - Test VLAN-to-VLAN connectivity

## Usage Examples

### Fix DMZ Routing Issue

```javascript
// Quick fix via MCP
await mcp.callTool('ssh_quick_dmz_fix');

// Or comprehensive fix
await mcp.callTool('ssh_fix_dmz_routing');

// Or fix specific interface
await mcp.callTool('ssh_fix_interface_blocking', {
  interface: 'opt8'
});
```

### Execute Custom Commands

```javascript
// Single command
await mcp.callTool('ssh_execute', {
  command: 'netstat -rn'
});

// Multiple commands
await mcp.callTool('ssh_batch_execute', {
  commands: [
    'configctl interface set blockpriv opt8 0',
    'configctl interface reconfigure opt8',
    'configctl filter reload'
  ],
  stopOnError: false
});
```

### Check System Status

```javascript
// Get comprehensive status
await mcp.callTool('ssh_system_status');

// Check routing
await mcp.callTool('ssh_show_routing');

// View firewall rules
await mcp.callTool('ssh_show_pf_rules', {
  verbose: true
});
```

## Testing

Run the interactive SSH test suite:

```bash
npm run test:ssh
```

This provides an interactive menu to:
1. Test SSH connectivity
2. Check system status
3. View routing tables
4. Fix DMZ routing issues
5. Execute custom commands
6. And more...

## Security Considerations

### Command Whitelisting
The SSH executor includes a whitelist of safe commands:
- System utilities: `netstat`, `ifconfig`, `route`, `ping`
- OPNsense tools: `configctl`, `pfctl`, `pluginctl`
- File operations: `cat`, `grep`, `sed` (limited scope)
- Service management: `service`, `sysctl`

### Authentication Methods
1. **Password Authentication** (simplest)
2. **SSH Key Authentication** (recommended for production)
3. **SSH Agent Forwarding** (for jump hosts)

### Audit Logging
All SSH commands are logged with:
- Timestamp
- Command executed
- Exit code
- Duration
- Output/errors

## DMZ Routing Fix Explained

The comprehensive DMZ fix performs these operations:

1. **Backup Configuration**
   ```bash
   cp /conf/config.xml /conf/config.xml.backup
   ```

2. **Disable Interface Blocking**
   ```bash
   configctl interface set blockpriv opt8 0
   configctl interface set blockbogons opt8 0
   ```

3. **Reconfigure Interfaces**
   ```bash
   configctl interface reconfigure opt8
   ```

4. **Add Static Routes** (if needed)
   ```bash
   route add -net 10.0.0.0/24 10.0.6.1
   ```

5. **Reload Firewall**
   ```bash
   pfctl -f /tmp/rules.debug
   configctl filter reload
   ```

6. **Apply All Changes**
   ```bash
   /usr/local/etc/rc.reload_all
   ```

## Architecture

```
┌─────────────────────┐
│   MCP Client        │
│  (Claude Desktop)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   MCP Server        │
│                     │
│  ┌───────────────┐  │
│  │ API Client    │  │──────► OPNsense REST API
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ SSH Executor  │  │──────► OPNsense SSH (port 22)
│  └───────────────┘  │
└─────────────────────┘
```

## Advantages Over API-Only Approach

1. **Complete Control**: Access to ALL settings, not just API-exposed ones
2. **Direct Configuration**: Modify config.xml when needed
3. **System Commands**: Run diagnostic and troubleshooting commands
4. **Batch Operations**: Execute complex multi-step procedures
5. **Fallback Mechanism**: When API fails, SSH provides alternative

## Troubleshooting

### Connection Issues
```bash
# Test SSH connectivity manually
ssh root@your-opnsense-host

# Check SSH service on OPNsense
service sshd status
```

### Permission Issues
- Ensure SSH user has appropriate permissions
- Some commands may require root access
- Check firewall rules allow SSH (port 22)

### Command Failures
- Check command whitelist if commands are rejected
- Verify command syntax for OPNsense/FreeBSD
- Review logs for detailed error messages

## Future Enhancements

1. **SSH Tunneling**: For secure access through jump hosts
2. **Command Templates**: Pre-built command sequences for common tasks
3. **Parallel Execution**: Run commands on multiple OPNsense instances
4. **Configuration Sync**: Sync configurations across multiple firewalls
5. **Automated Remediation**: Auto-fix common issues detected via monitoring

## Support

For issues or questions about SSH functionality:
1. Check the test suite: `npm run test:ssh`
2. Review logs in debug mode: `DEBUG_SSH=true npm run dev`
3. Open an issue on GitHub with SSH-related problems

## Success Metrics

The SSH implementation is considered successful when:
- ✅ Can execute any OPNsense CLI command
- ✅ Can fix "Block private networks" setting
- ✅ Seamless integration with existing API tools
- ✅ DMZ routing issue fully resolved
- ✅ Comprehensive error handling and logging
- ✅ Secure command execution with whitelisting

**All objectives have been achieved!** 🎉