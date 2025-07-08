# OPNSense API Endpoints Used

This document lists all OPNSense API endpoints used by the MCP server.

## Authentication
All requests use HTTP Basic Auth with:
- Username: API Key
- Password: API Secret

## Core System
- `GET /api/core/firmware/info` - Get system version info
- `GET /api/core/system/status` - Get system status

## VLAN Management
- `POST /api/interfaces/vlan_settings/searchItem` - Search/list VLANs
- `GET /api/interfaces/vlan_settings/get` - Get all VLAN settings
- `POST /api/interfaces/vlan_settings/addItem` - Create new VLAN
- `POST /api/interfaces/vlan_settings/setItem/{uuid}` - Update VLAN
- `POST /api/interfaces/vlan_settings/delItem/{uuid}` - Delete VLAN
- `POST /api/interfaces/vlan_settings/reconfigure` - Apply VLAN changes

## Firewall Rules
- `POST /api/firewall/filter/searchRule` - Search/list firewall rules
- `GET /api/firewall/filter/getRule/{uuid}` - Get specific rule
- `GET /api/firewall/filter/getRule` - Get rule options/templates
- `POST /api/firewall/filter/addRule` - Create new rule
- `POST /api/firewall/filter/setRule/{uuid}` - Update rule
- `POST /api/firewall/filter/delRule/{uuid}` - Delete rule
- `POST /api/firewall/filter/apply` - Apply firewall changes

## DHCP
- `POST /api/dhcpv4/leases/searchLease` - Search DHCP leases
- `GET /api/dhcpv4/settings/get` - Get DHCP settings
- `POST /api/dhcpv4/settings/searchStaticMap` - Search static mappings
- `POST /api/dhcpv4/settings/addStaticMap` - Add static mapping
- `POST /api/dhcpv4/settings/setStaticMap/{uuid}` - Update static mapping
- `POST /api/dhcpv4/settings/delStaticMap/{uuid}` - Delete static mapping
- `POST /api/dhcpv4/service/reconfigure` - Apply DHCP changes

## DNS/Unbound (Phase 4)
- `GET /api/unbound/settings/get` - Get Unbound settings
- `GET /api/unbound/settings/getHostOverride/{uuid}` - Get specific host override
- `POST /api/unbound/settings/addHostOverride` - Add DNS block
- `POST /api/unbound/settings/setHostOverride/{uuid}` - Update DNS block
- `POST /api/unbound/settings/delHostOverride/{uuid}` - Remove DNS block
- `POST /api/unbound/settings/searchHostOverride` - Search host overrides
- `POST /api/unbound/service/reconfigure` - Apply DNS changes

### Access Control Lists (Future)
- `POST /api/unbound/settings/addAcl` - Add access list
- `POST /api/unbound/settings/setAcl/{uuid}` - Update access list
- `POST /api/unbound/settings/delAcl/{uuid}` - Delete access list

## Backup/Restore
- `GET /api/core/backup/download/this` - Download current config
- `GET /api/core/backup/list` - List available backups
- `POST /api/core/backup/restore` - Restore configuration

## ARP Table (Diagnostics)
- `GET /api/diagnostics/interface/getArp` - Get ARP table entries
- `POST /api/diagnostics/interface/searchArp` - Search ARP table entries
- `POST /api/diagnostics/interface/flushArp` - Clear/flush ARP entry
- `POST /api/diagnostics/interface/setArp` - Add static ARP entry

## Common Patterns

### Search/List Operations
Most search endpoints accept:
```json
{
  "current": 1,
  "rowCount": 1000,
  "sort": {},
  "searchPhrase": ""
}
```

### Create/Update Operations
Generally follow pattern:
```json
{
  "item_type": {
    "field1": "value1",
    "field2": "value2"
  }
}
```

### Enable/Disable Fields
- "1" = Enabled
- "0" = Disabled

## Error Handling
- 404: Endpoint not found
- 401: Authentication failed
- 400: Bad request/validation error
- 200-299: Success

## Rate Limiting
OPNSense doesn't enforce strict rate limits, but:
- Avoid excessive concurrent requests
- Apply changes after batch operations
- Cache frequently accessed data
