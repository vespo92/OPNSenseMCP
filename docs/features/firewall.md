# Firewall Rules Management

## Overview

The OPNsense MCP Server provides comprehensive firewall rule management with enhanced persistence, caching, and inter-VLAN routing support. This feature addresses the critical issue where API-created rules are stored as "automation rules" in OPNsense.

## Key Features

- **Rule Persistence**: Proper handling of automation rules
- **Inter-VLAN Routing**: Automated rule creation for VLAN communication
- **Rule Caching**: Performance optimization with local caching
- **Batch Operations**: Create multiple rules efficiently
- **Enhanced Validation**: Comprehensive rule validation

## The Automation Rules Issue

### Problem
OPNsense segregates rules into two categories:
1. **Regular rules**: Created via web UI
2. **Automation rules**: Created via API

API-created rules:
- Return UUIDs on creation
- Don't appear in standard rule listings
- Are stored separately in the configuration
- Require different retrieval methods

### Solution
The MCP server now properly handles automation rules by:
- Using `/firewall/filter/get` instead of `searchRule`
- Retrieving all rules including automation rules
- Properly applying changes with multiple fallback methods

## MCP Tools

### firewall_list_rules
List all firewall rules including automation rules.
```javascript
await mcp.call('firewall_list_rules');
```

### firewall_get_rule
Get a specific rule by UUID.
```javascript
await mcp.call('firewall_get_rule', {
  uuid: 'rule-uuid-here'
});
```

### firewall_create_rule
Create a new firewall rule.
```javascript
await mcp.call('firewall_create_rule', {
  action: 'pass',
  interface: 'opt8',
  source: '10.0.6.0/24',
  destination: '10.0.0.14/32',
  protocol: 'tcp',
  destination_port: '2049',
  description: 'Allow NFS from DMZ'
});
```

### firewall_update_rule
Update an existing rule.
```javascript
await mcp.call('firewall_update_rule', {
  uuid: 'rule-uuid',
  action: 'pass',
  log: true
});
```

### firewall_delete_rule
Delete a firewall rule.
```javascript
await mcp.call('firewall_delete_rule', {
  uuid: 'rule-uuid'
});
```

### firewall_apply_changes
Apply pending firewall changes.
```javascript
await mcp.call('firewall_apply_changes');
```

## Enhanced Persistence Flow

The firewall rule resource implements a multi-layered approach to ensure changes persist:

```javascript
// 1. Create/update rule
const rule = await createRule(params);

// 2. Apply changes with fallbacks
await applyChanges(); // Tries multiple methods:
  // a. Standard apply
  // b. Reconfigure with savepoint
  // c. Force reload filter
  // d. System-level filter reload
```

## Inter-VLAN Routing

### Enable Inter-VLAN Communication
```javascript
// Allow DMZ to LAN communication
await mcp.call('firewall_create_intervlan_rules', {
  sourceInterface: 'opt8',      // DMZ
  sourceNetwork: '10.0.6.0/24',
  destNetwork: '10.0.0.0/24',   // LAN
  description: 'DMZ to LAN access'
});
```

### NFS Access Rules
```javascript
// Create comprehensive NFS rules
const nfsRules = [
  { port: 111, protocol: 'tcp', description: 'RPC TCP' },
  { port: 111, protocol: 'udp', description: 'RPC UDP' },
  { port: 2049, protocol: 'tcp', description: 'NFS TCP' },
  { port: 2049, protocol: 'udp', description: 'NFS UDP' }
];

for (const rule of nfsRules) {
  await mcp.call('firewall_create_rule', {
    action: 'pass',
    interface: 'opt8',
    source: '10.0.6.0/24',
    destination: '10.0.0.14/32',
    protocol: rule.protocol,
    destination_port: rule.port.toString(),
    description: `NFS: ${rule.description}`
  });
}
```

## Rule Retrieval Methods

### Get All Rules (Including Automation)
```javascript
// Correct method - retrieves all rules
const response = await client.get('/firewall/filter/get');
const rules = Object.values(response.filter.rules.rule);
```

### Search Rules (Legacy - Misses Automation Rules)
```javascript
// Old method - doesn't show API-created rules
const response = await client.post('/firewall/filter/searchRule');
// This misses automation rules!
```

## Caching System

The firewall resource implements intelligent caching:

```javascript
// Cache structure
{
  rules: Map<uuid, rule>,
  lastSync: timestamp,
  ttl: 300000 // 5 minutes
}

// Automatic cache invalidation on:
- Rule creation
- Rule updates
- Rule deletion
- Manual refresh
```

## Testing

### Test Firewall Persistence
```bash
npx tsx scripts/test/test-rules.ts
```

### Debug Firewall Issues
```bash
npx tsx scripts/debug/debug-persistence.ts
```

### Create Test Rules
```bash
npx tsx scripts/fixes/create-nfs-rules.ts
```

## Common Issues and Solutions

### Rules Not Visible
**Problem**: Created rules return UUID but don't appear in list
**Solution**: Use `getAllRules()` method which fetches from `/firewall/filter/get`

### Changes Not Applied
**Problem**: Rules created but not active
**Solution**: Always call `applyChanges()` after rule operations

### Interface Not Found
**Problem**: Interface name mismatch
**Solution**: Use interface discovery to find correct names (e.g., `opt8` for DMZ)

## Implementation Details

### Rule Validation
```javascript
// Automatic validation includes:
- Valid IP addresses/networks
- Correct port ranges (1-65535)
- Valid protocols (tcp/udp/icmp/any)
- Interface existence
- Action validity (pass/block/reject)
```

### Apply Changes Fallback Chain
```javascript
1. Try: /firewall/filter/apply
2. Fallback: /firewall/filter/reconfigure with savepoint
3. Fallback: configctl filter reload (via SSH)
4. Final: Force filter reload
```

## Version History

- **v0.8.1**: Fixed automation rules visibility issue
- **v0.7.6**: Enhanced persistence with multiple fallbacks
- **v0.7.5**: Added caching and batch operations
- **v0.7.0**: Initial firewall management implementation