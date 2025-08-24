# OPNsense NAT SSH Implementation

## Overview

The OPNsense MCP Server now includes a hybrid NAT management implementation that uses SSH/CLI commands to manipulate the configuration XML directly, since the OPNsense REST API does not expose NAT endpoints.

## Problem Statement

1. **No NAT API**: OPNsense does not provide REST API endpoints for NAT configuration
2. **XML Configuration**: NAT rules are stored in `/conf/config.xml` on the firewall
3. **Web UI Only**: NAT management is only available through the web interface
4. **Inter-VLAN Issues**: Automatic NAT mode causes issues with inter-VLAN traffic

## Solution Architecture

### Hybrid Approach

The NAT Resource (`src/resources/firewall/nat.ts`) now implements:

1. **SSH-based Configuration** (Primary)
   - Connects via SSH to the OPNsense firewall
   - Reads and modifies `/conf/config.xml` directly
   - Uses `configctl` commands to apply changes
   - Full control over all NAT settings

2. **API Fallback** (Limited)
   - Attempts API calls for compatibility
   - Most operations will fail without SSH
   - Provides graceful degradation

## Configuration

### Environment Variables

```bash
# Required for NAT management
OPNSENSE_SSH_HOST=opnsense.example.com
OPNSENSE_SSH_USERNAME=root
OPNSENSE_SSH_PASSWORD=your_password

# Optional SSH settings
OPNSENSE_SSH_PORT=22
OPNSENSE_SSH_KEY_PATH=/path/to/private/key
OPNSENSE_SSH_TIMEOUT=30000
```

### SSH Requirements

1. SSH must be enabled on OPNsense (System → Settings → Administration)
2. User must have shell access (typically root)
3. Firewall rules must allow SSH from the MCP server

## NAT Features

### Supported Operations

#### Outbound NAT
- **List Rules**: Get all outbound NAT rules from config.xml
- **Get Mode**: Check current NAT mode (automatic/hybrid/manual/disabled)
- **Set Mode**: Change NAT mode
- **Create Rules**: Add new outbound NAT rules
- **Delete Rules**: Remove rules by description
- **No-NAT Rules**: Create exception rules for inter-VLAN traffic

#### Port Forwarding
- Currently placeholder implementation
- Can be extended using same SSH/XML approach

#### One-to-One NAT
- Currently placeholder implementation
- Can be extended using same SSH/XML approach

### XML Structure

The NAT configuration in `/conf/config.xml` follows this structure:

```xml
<opnsense>
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
        <nonat/>
        <descr>No NAT: DMZ to LAN traffic</descr>
      </rule>
    </outbound>
  </nat>
</opnsense>
```

## MCP Tools

### Available NAT Tools

1. **nat_list_outbound** - List all outbound NAT rules
2. **nat_get_mode** - Get current NAT mode
3. **nat_set_mode** - Set NAT mode (automatic/hybrid/manual/disabled)
4. **nat_create_outbound_rule** - Create an outbound NAT rule
5. **nat_delete_outbound_rule** - Delete a rule by description or UUID
6. **nat_fix_dmz** - Fix DMZ NAT issues automatically
7. **nat_quick_fix_dmz** - Quick fix for common DMZ NAT problems
8. **nat_cleanup_dmz_fix** - Remove MCP-created NAT rules
9. **nat_analyze_config** - Analyze NAT configuration for issues

### Tool Examples

#### Fix DMZ NAT Issue
```javascript
// Using MCP tool
await mcp.call('nat_fix_dmz', {
  dmzNetwork: '10.0.6.0/24',
  lanNetwork: '10.0.0.0/24',
  otherInternalNetworks: ['10.0.2.0/24', '10.0.4.0/24']
});
```

#### Create No-NAT Rule
```javascript
// Prevent NAT for inter-VLAN traffic
await mcp.call('nat_create_outbound_rule', {
  interface: 'wan',
  source_net: '10.0.6.0/24',
  destination_net: '10.0.0.0/24',
  nonat: '1',
  description: 'No NAT: DMZ to LAN'
});
```

## Testing

### Test Scripts

1. **test-nat-ssh.ts** - Interactive NAT testing tool
   ```bash
   ./test-nat-ssh.ts
   ```

2. **test-ssh-executor.ts** - SSH connectivity testing
   ```bash
   ./test-ssh-executor.ts
   ```

### Verification Steps

1. **Check SSH Connection**
   ```bash
   ssh root@opnsense.example.com "whoami"
   ```

2. **Verify NAT Mode**
   ```bash
   ssh root@opnsense.example.com "grep '<mode>' /conf/config.xml"
   ```

3. **List NAT Rules**
   ```bash
   ssh root@opnsense.example.com "grep -A10 '<outbound>' /conf/config.xml"
   ```

## Common Issues and Solutions

### Issue 1: SSH Not Configured
**Problem**: NAT operations fail with "SSH not configured"
**Solution**: Set environment variables:
```bash
export OPNSENSE_SSH_HOST=opnsense.example.com
export OPNSENSE_SSH_USERNAME=root
export OPNSENSE_SSH_PASSWORD=your_password
```

### Issue 2: Inter-VLAN Traffic Being NAT'd
**Problem**: Traffic between VLANs gets NAT'd to WAN IP
**Solution**: Run the DMZ fix:
```bash
./test-nat-ssh.ts
# Select option: Fix DMZ NAT Issue
```

### Issue 3: XML Parse Errors
**Problem**: config.xml parsing fails
**Solution**: Backup and validate XML:
```bash
ssh root@opnsense "cp /conf/config.xml /conf/config.xml.backup"
ssh root@opnsense "xmllint --noout /conf/config.xml"
```

### Issue 4: Changes Not Applied
**Problem**: NAT rules created but not active
**Solution**: Force reload:
```bash
ssh root@opnsense "configctl filter reload"
```

## Security Considerations

1. **SSH Credentials**: Store securely, use environment variables or secrets manager
2. **Limited Commands**: SSH executor uses command whitelist for safety
3. **Config Backups**: Always backup before modifications
4. **XML Validation**: Validate XML before writing to prevent corruption
5. **Access Control**: Limit SSH access to MCP server IP only

## Implementation Details

### Key Files

1. **src/resources/firewall/nat.ts** - Main NAT resource implementation
2. **src/resources/ssh/executor.ts** - SSH command execution
3. **src/index.ts** - MCP tool registrations and handlers
4. **test-nat-ssh.ts** - Interactive testing tool

### Dependencies

- `ssh2` - SSH client library
- `xml2js` - XML parsing and building
- `dotenv` - Environment variable management

### Error Handling

The implementation includes comprehensive error handling:
- SSH connection failures
- XML parsing errors
- Invalid configurations
- Command execution timeouts
- Graceful fallback to API mode

## Future Enhancements

1. **Port Forwarding**: Implement full port forward management via SSH
2. **One-to-One NAT**: Add support for 1:1 NAT rules
3. **NPT (IPv6)**: Implement IPv6 prefix translation
4. **Rule Validation**: Add validation before applying rules
5. **Bulk Operations**: Support batch rule creation/deletion
6. **Rule Ordering**: Implement rule priority management
7. **pfctl Integration**: Direct packet filter manipulation
8. **Config Sync**: Support for HA config synchronization

## Troubleshooting Commands

```bash
# Test SSH connection
ssh root@opnsense "echo 'SSH working'"

# Check NAT mode
ssh root@opnsense "grep '<mode>' /conf/config.xml | sed 's/.*<mode>//;s/<\/mode>.*//' "

# Count NAT rules
ssh root@opnsense "grep -c '<rule>' /conf/config.xml"

# Show NAT rules with descriptions
ssh root@opnsense "grep '<descr>' /conf/config.xml"

# Apply configuration
ssh root@opnsense "configctl filter reload"

# Check firewall status
ssh root@opnsense "pfctl -s info"
```

## Support

For issues or questions:
1. Check this documentation
2. Run the test scripts for diagnostics
3. Enable debug mode: `export MCP_DEBUG=true`
4. Check SSH connectivity first
5. Verify XML structure if modifications fail