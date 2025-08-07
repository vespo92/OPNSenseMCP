# MCP Tools Reference

Complete reference for all available MCP tools in the OPNSense MCP Server.

## Tool Categories

- [Configuration](#configuration)
- [Network Management](#network-management)
- [Firewall Management](#firewall-management)
- [Service Management](#service-management)
- [Device Discovery](#device-discovery)
- [DNS Management](#dns-management)
- [HAProxy Management](#haproxy-management)
- [Backup & System](#backup--system)

## Configuration

### configure

Configure OPNsense connection settings.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| host | string | Yes | OPNsense host URL |
| apiKey | string | Yes | API key |
| apiSecret | string | Yes | API secret |
| verifySsl | boolean | No | Verify SSL certificate (default: true) |

**Example:**
```javascript
await configure({
  host: "https://192.168.1.1",
  apiKey: "your_api_key",
  apiSecret: "your_api_secret",
  verifySsl: false
});
```

**Returns:** Configuration status

---

## Network Management

### listVlans

List all configured VLANs.

**Parameters:** None

**Returns:**
```javascript
[{
  uuid: "string",
  interface: "igc3",
  tag: 50,
  description: "Guest Network",
  device: "igc3_vlan50"
}]
```

### createVlan

Create a new VLAN.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| interface | string | Yes | Physical interface (e.g., "igc3") |
| tag | number | Yes | VLAN tag (1-4094) |
| description | string | No | VLAN description |
| priority | number | No | 802.1p priority (0-7) |

**Example:**
```javascript
await createVlan({
  interface: "igc3",
  tag: 50,
  description: "Guest WiFi"
});
```

**Returns:** Created VLAN details

### deleteVlan

Delete a VLAN.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| uuid | string | Yes | VLAN UUID |

**Returns:** Deletion status

### listInterfaces

List network interfaces.

**Parameters:** None

**Returns:**
```javascript
[{
  name: "igc0",
  description: "WAN",
  status: "up",
  ipAddress: "203.0.113.1",
  macAddress: "aa:bb:cc:dd:ee:ff"
}]
```

---

## Firewall Management

### listFirewallRules

List firewall rules.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| interface | string | No | Filter by interface |
| direction | string | No | "in" or "out" |

**Returns:**
```javascript
[{
  uuid: "string",
  interface: "wan",
  action: "pass",
  protocol: "tcp",
  source: "any",
  destination: "192.168.1.100",
  port: "443",
  description: "Allow HTTPS"
}]
```

### createFirewallRule

Create a firewall rule.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| interface | string | Yes | Interface name |
| action | string | Yes | "pass", "block", or "reject" |
| direction | string | No | "in" or "out" (default: "in") |
| protocol | string | No | Protocol (tcp, udp, icmp, any) |
| source | object | No | Source address and port |
| destination | object | No | Destination address and port |
| description | string | No | Rule description |
| log | boolean | No | Enable logging |

**Example:**
```javascript
await createFirewallRule({
  interface: "wan",
  action: "pass",
  protocol: "tcp",
  destination: {
    address: "192.168.1.100",
    port: "80,443"
  },
  description: "Allow web traffic"
});
```

### updateFirewallRule

Update existing firewall rule.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| uuid | string | Yes | Rule UUID |
| ...props | object | No | Properties to update |

### deleteFirewallRule

Delete firewall rule.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| uuid | string | Yes | Rule UUID |

### createAlias

Create firewall alias.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Alias name |
| type | string | Yes | "host", "network", "port", or "url" |
| content | array | Yes | List of values |
| description | string | No | Description |

**Example:**
```javascript
await createAlias({
  name: "web_servers",
  type: "host",
  content: ["192.168.1.10", "192.168.1.11"],
  description: "Web server pool"
});
```

---

## Service Management

### listDhcpLeases

List DHCP leases.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| interface | string | No | Filter by interface |
| state | string | No | "active", "expired", or "all" |

**Returns:**
```javascript
[{
  ip: "192.168.1.100",
  mac: "aa:bb:cc:dd:ee:ff",
  hostname: "laptop",
  starts: "2024-01-15 10:00:00",
  ends: "2024-01-15 22:00:00",
  state: "active"
}]
```

### configureDhcpServer

Configure DHCP server.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| interface | string | Yes | Interface name |
| enable | boolean | Yes | Enable/disable DHCP |
| range | object | Yes | IP range (from, to) |
| gateway | string | No | Default gateway |
| dns | array | No | DNS servers |
| domain | string | No | Domain name |
| leaseTime | number | No | Lease time in seconds |

**Example:**
```javascript
await configureDhcpServer({
  interface: "lan",
  enable: true,
  range: {
    from: "192.168.1.100",
    to: "192.168.1.200"
  },
  gateway: "192.168.1.1",
  dns: ["192.168.1.1", "8.8.8.8"],
  leaseTime: 86400
});
```

### createStaticMapping

Create DHCP static mapping.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| mac | string | Yes | MAC address |
| ip | string | Yes | IP address |
| hostname | string | No | Hostname |
| description | string | No | Description |

---

## Device Discovery

### listArpTable

List ARP table entries.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| interface | string | No | Filter by interface |

**Returns:**
```javascript
[{
  ip: "192.168.1.100",
  mac: "aa:bb:cc:dd:ee:ff",
  interface: "lan",
  type: "dynamic",
  manufacturer: "Apple Inc."
}]
```

### findDevicesByName

Find devices by hostname.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| search | string | Yes | Search term |
| source | string | No | "arp", "dhcp", or "all" |

**Example:**
```javascript
await findDevicesByName({
  search: "laptop"
});
```

### findDeviceByMac

Find device by MAC address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| mac | string | Yes | MAC address |

### findDeviceByIp

Find device by IP address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| ip | string | Yes | IP address |

---

## DNS Management

### blockDomains

Block domains in DNS.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| domains | array | Yes | List of domains to block |
| description | string | No | Block description |

**Example:**
```javascript
await blockDomains({
  domains: ["facebook.com", "twitter.com"],
  description: "Social media block"
});
```

### unblockDomains

Remove domain blocks.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| domains | array | Yes | Domains to unblock |

### listBlockedDomains

List blocked domains.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| search | string | No | Search term |

### applyBlocklistCategory

Apply predefined blocklist.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| category | string | Yes | Category name |

**Categories:**
- `adult` - Adult content
- `social` - Social media
- `ads` - Advertising
- `malware` - Malicious sites
- `gambling` - Gambling sites

---

## HAProxy Management

### haproxy_service_control

Control HAProxy service.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | Yes | "start", "stop", "restart", "reload", or "status" |

### haproxy_backend_create

Create HAProxy backend.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Backend name |
| mode | string | Yes | "http" or "tcp" |
| balance | string | Yes | Load balancing algorithm |
| servers | array | No | Backend servers |
| description | string | No | Description |

**Balance algorithms:**
- `roundrobin` - Round robin
- `leastconn` - Least connections
- `source` - Source IP hash
- `uri` - URI hash
- `random` - Random

**Server object:**
```javascript
{
  name: "web1",
  address: "192.168.1.10",
  port: 80,
  ssl: false,
  check: true,
  weight: 1
}
```

### haproxy_frontend_create

Create HAProxy frontend.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Frontend name |
| bind | string | Yes | Bind address (e.g., "0.0.0.0:443") |
| mode | string | Yes | "http" or "tcp" |
| backend | string | Yes | Default backend |
| ssl | boolean | No | Enable SSL |
| certificates | array | No | SSL certificates |

### haproxy_stats

Get HAProxy statistics.

**Parameters:** None

**Returns:**
```javascript
{
  frontends: [{
    name: "string",
    status: "UP",
    sessions: 10,
    bytesIn: 1024000,
    bytesOut: 2048000
  }],
  backends: [{
    name: "string",
    status: "UP",
    activeServers: 3,
    backupServers: 1,
    sessions: 25
  }]
}
```

---

## Backup & System

### createBackup

Create configuration backup.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| description | string | No | Backup description |
| type | string | No | "full" or "partial" |
| components | array | No | Components to backup (partial only) |

**Example:**
```javascript
await createBackup({
  description: "Before upgrade",
  type: "full"
});
```

### listBackups

List available backups.

**Parameters:** None

**Returns:**
```javascript
[{
  filename: "config-2024-01-15.xml",
  date: "2024-01-15T10:00:00Z",
  size: 102400,
  description: "Before upgrade"
}]
```

### restoreBackup

Restore from backup.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| filename | string | Yes | Backup filename |
| components | array | No | Components to restore |

### getSystemInfo

Get system information.

**Parameters:** None

**Returns:**
```javascript
{
  version: "23.7",
  hostname: "opnsense.local",
  uptime: "5 days",
  cpuUsage: 15,
  memoryUsage: 45,
  diskUsage: 30
}
```

---

## Common Patterns

### Error Handling

All tools follow consistent error handling:

```javascript
try {
  const result = await createVlan({
    interface: "igc3",
    tag: 50
  });
} catch (error) {
  // error.code - Error code
  // error.message - Error description
  // error.details - Additional details
}
```

### Pagination

List operations support pagination:

```javascript
await listFirewallRules({
  page: 1,
  limit: 50,
  sort: "description"
});
```

### Filtering

Most list operations support filtering:

```javascript
await listDhcpLeases({
  interface: "lan",
  state: "active",
  search: "laptop"
});
```

### Batch Operations

Some tools support batch operations:

```javascript
await blockDomains({
  domains: [
    "site1.com",
    "site2.com",
    "site3.com"
  ]
});
```

## Rate Limiting

The MCP server implements rate limiting:
- Default: 100 requests per minute
- Burst: 10 concurrent requests
- Retry with backoff on rate limit

## Authentication

All tools use the configured OPNsense API credentials:
- Set via environment variables
- Or configured with `configure` tool
- Credentials are securely stored

## Next Steps

- [Resource Types](resources.md) - IaC resource reference
- [Schemas](schemas.md) - Data validation schemas
- [Examples](../../examples/) - Usage examples