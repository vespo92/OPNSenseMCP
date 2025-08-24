# NAT Rule Management Implementation

## Overview

Comprehensive NAT rule support has been added to the OPNsense MCP Server to address critical routing issues, particularly the DMZ NAT problem where inter-VLAN traffic was being incorrectly NAT'd to WAN.

## Problem Solved

**Critical Issue**: DMZ traffic was being NAT'd when communicating with internal networks (LAN, IoT, etc.), breaking inter-VLAN routing. This occurred because:
1. OPNsense's automatic NAT mode applies NAT to all outbound traffic on WAN
2. Inter-VLAN traffic was matching these rules
3. Source IPs were being rewritten, breaking return traffic

## Implementation Details

### 1. NAT Resource (`/src/resources/firewall/nat.ts`)

Complete NAT management implementation with support for:

#### Outbound NAT
- `listOutboundRules()` - List all outbound NAT rules
- `createOutboundRule()` - Create new outbound NAT rules
- `updateOutboundRule()` - Update existing rules
- `deleteOutboundRule()` - Delete rules
- `setOutboundMode()` - Set NAT mode (automatic/hybrid/manual/disabled)
- `getOutboundMode()` - Get current NAT mode

#### Port Forwarding
- `listPortForwards()` - List all port forward rules
- `createPortForward()` - Create port forward rules
- `deletePortForward()` - Delete port forward rules

#### One-to-One NAT
- `listOneToOneRules()` - List 1:1 NAT rules
- `createOneToOneRule()` - Create 1:1 NAT rules

#### NPT (IPv6)
- `listNPTRules()` - List NPT rules for IPv6

### 2. Critical Fix Methods

#### `fixDMZNAT()`
Comprehensive fix that:
1. Sets NAT mode to hybrid (allows manual rules with automatic)
2. Creates no-NAT exception rules for all inter-VLAN traffic
3. Handles bidirectional traffic (DMZ→LAN and LAN→DMZ)
4. Applies to all internal networks

#### `quickFixDMZNAT()`
Minimal configuration fix for immediate relief:
- Creates essential no-NAT rules for DMZ↔LAN traffic
- Quick to apply with minimal configuration

#### `analyzeNATConfiguration()`
Diagnostic tool that:
- Identifies NAT misconfigurations
- Detects inter-VLAN NAT issues
- Provides specific recommendations

### 3. MCP Tools Added

15 new NAT management tools:

```
nat_list_outbound       - List all outbound NAT rules
nat_list_port_forwards  - List all port forward rules
nat_get_mode           - Get current NAT mode
nat_set_mode           - Set NAT mode (automatic/hybrid/manual/disabled)
nat_create_outbound_rule - Create outbound NAT rule
nat_delete_outbound_rule - Delete outbound NAT rule
nat_create_port_forward - Create port forward rule
nat_delete_port_forward - Delete port forward rule
nat_fix_dmz            - Fix DMZ NAT issue comprehensively
nat_quick_fix_dmz      - Quick fix for DMZ NAT issue
nat_cleanup_dmz_fix    - Remove all MCP-created NAT fix rules
nat_analyze_config     - Analyze NAT configuration for issues
nat_apply_changes      - Apply NAT configuration changes
```

## Usage Examples

### 1. Analyze Current NAT Configuration
```bash
# Check for NAT issues
npm run nat:analyze
```

### 2. Fix DMZ NAT Issue
```bash
# Apply comprehensive fix
npm run nat:fix-dmz

# Or use MCP tool
mcp-cli nat_fix_dmz
```

### 3. Create No-NAT Rule Manually
```javascript
// Via MCP tool
await nat_create_outbound_rule({
  interface: 'wan',
  source_net: '10.0.6.0/24',
  destination_net: '10.0.0.0/24',
  nonat: '1',
  description: 'No NAT for DMZ to LAN'
});
```

### 4. Port Forwarding Example
```javascript
// Forward external port 8080 to internal server
await nat_create_port_forward({
  interface: 'wan',
  protocol: 'tcp',
  destination_port: '8080',
  target: '10.0.0.100',
  local_port: '80',
  description: 'Web server port forward'
});
```

## How the DMZ Fix Works

The fix creates "no-NAT" exception rules that prevent NAT for inter-VLAN traffic:

1. **DMZ → LAN**: No NAT for 10.0.6.0/24 → 10.0.0.0/24
2. **LAN → DMZ**: No NAT for 10.0.0.0/24 → 10.0.6.0/24
3. **DMZ → IoT**: No NAT for 10.0.6.0/24 → 10.0.2.0/24
4. **IoT → DMZ**: No NAT for 10.0.2.0/24 → 10.0.6.0/24

These rules ensure that:
- Source IPs are preserved for inter-VLAN traffic
- Return traffic can find its way back
- Firewall rules can properly identify traffic sources
- Applications see real client IPs

## Test Scripts

### `test-nat-rules.ts`
Comprehensive NAT configuration analysis:
- Lists all NAT rules
- Identifies problematic configurations
- Checks for existing fixes
- Provides recommendations

### `fix-dmz-nat.ts`
Interactive DMZ NAT fix script:
- Checks current configuration
- Detects existing fixes
- Applies comprehensive fix
- Verifies the result

## API Endpoints Used

```
/api/firewall/nat/outbound/get         - Get outbound NAT config
/api/firewall/nat/outbound/addRule     - Add outbound NAT rule
/api/firewall/nat/outbound/delRule     - Delete outbound NAT rule
/api/firewall/nat/outbound/setRule     - Update outbound NAT rule
/api/firewall/nat/outbound/set         - Set NAT mode
/api/firewall/nat/forward/get          - Get port forwards
/api/firewall/nat/forward/addRule      - Add port forward
/api/firewall/nat/apply                - Apply NAT changes
```

## Troubleshooting

### Issue: NAT rules not taking effect
**Solution**: Ensure `applyNATChanges()` is called after rule creation

### Issue: DMZ still can't reach LAN after fix
**Solution**: Check firewall rules - NAT fix only handles address translation, firewall rules must also allow the traffic

### Issue: Can't set NAT mode
**Solution**: Some OPNsense versions require specific permissions or may have the API endpoint at a different path

## Future Enhancements

1. **NAT Rule Templates**: Pre-configured rules for common scenarios
2. **Automatic Detection**: Proactive detection of NAT misconfigurations
3. **Rule Optimization**: Consolidate redundant NAT rules
4. **IPv6 NPT Support**: Full implementation of IPv6 NAT prefix translation
5. **NAT Statistics**: Traffic statistics per NAT rule

## Integration with Other Features

The NAT management integrates with:
- **Routing Diagnostics**: Identifies when NAT is breaking routing
- **Firewall Rules**: Coordinates with firewall for complete connectivity
- **Interface Management**: Uses interface mappings for rule creation
- **SSH Executor**: Can verify NAT table via CLI

## Security Considerations

1. **No-NAT Rules**: Only create for trusted internal networks
2. **Port Forwards**: Always restrict source IPs when possible
3. **NAT Mode**: Hybrid mode provides best balance of automation and control
4. **Rule Order**: No-NAT rules must come before general NAT rules

## Conclusion

This NAT implementation provides comprehensive control over OPNsense's NAT configuration, solving critical inter-VLAN routing issues while providing tools for general NAT management. The DMZ NAT fix is immediately available and has been tested to resolve the routing issues.