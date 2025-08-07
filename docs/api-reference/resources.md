# MCP Resources Reference

Complete reference for all MCP resource types used in Infrastructure as Code.

## Resource URI Format

Resources are accessed via URIs:
```
opnsense://category/type
```

Examples:
- `opnsense://network/vlans`
- `opnsense://firewall/rules`
- `opnsense://haproxy/backends`

## Available Resources

### Network Resources

#### opnsense://network/vlans

Virtual LAN configurations.

**Properties:**
```javascript
{
  uuid: "string",
  interface: "igc3",
  tag: 50,
  description: "Guest Network",
  device: "igc3_vlan50",
  priority: 0
}
```

**Operations:**
- `GET` - List all VLANs
- `POST` - Create new VLAN
- `PUT` - Update VLAN
- `DELETE` - Delete VLAN

#### opnsense://network/interfaces

Network interface information.

**Properties:**
```javascript
{
  name: "igc0",
  description: "WAN",
  status: "up",
  ipAddress: "203.0.113.1",
  netmask: "255.255.255.0",
  gateway: "203.0.113.254",
  macAddress: "aa:bb:cc:dd:ee:ff",
  mtu: 1500,
  media: "1000baseT",
  statistics: {
    bytesIn: 1024000,
    bytesOut: 2048000,
    packetsIn: 1000,
    packetsOut: 2000,
    errors: 0,
    collisions: 0
  }
}
```

**Operations:**
- `GET` - List interfaces
- `PUT` - Update interface settings

#### opnsense://network/routes

Static routing table.

**Properties:**
```javascript
{
  uuid: "string",
  network: "10.0.0.0/24",
  gateway: "192.168.1.254",
  interface: "lan",
  description: "Route to branch office",
  metric: 1,
  enabled: true
}
```

**Operations:**
- `GET` - List routes
- `POST` - Add route
- `DELETE` - Remove route

### Firewall Resources

#### opnsense://firewall/rules

Firewall rule configurations.

**Properties:**
```javascript
{
  uuid: "string",
  interface: "wan",
  direction: "in",
  action: "pass",
  protocol: "tcp",
  source: {
    address: "any",
    port: "any",
    not: false
  },
  destination: {
    address: "192.168.1.100",
    port: "80,443",
    not: false
  },
  description: "Allow web traffic",
  log: true,
  enabled: true,
  sequence: 100
}
```

**Operations:**
- `GET` - List rules
- `POST` - Create rule
- `PUT` - Update rule
- `DELETE` - Delete rule

#### opnsense://firewall/aliases

Firewall aliases for grouping.

**Properties:**
```javascript
{
  uuid: "string",
  name: "web_servers",
  type: "host",
  content: [
    "192.168.1.10",
    "192.168.1.11",
    "192.168.1.12"
  ],
  description: "Web server pool",
  enabled: true
}
```

**Types:**
- `host` - IP addresses
- `network` - Network ranges
- `port` - Port numbers
- `url` - URL lists
- `urltable` - URL tables

**Operations:**
- `GET` - List aliases
- `POST` - Create alias
- `PUT` - Update alias
- `DELETE` - Delete alias

#### opnsense://firewall/nat

NAT and port forwarding rules.

**Properties:**
```javascript
{
  uuid: "string",
  interface: "wan",
  protocol: "tcp",
  sourcePort: 8080,
  destination: "192.168.1.100",
  destinationPort: 80,
  description: "Web server port forward",
  reflection: true,
  natPort: "any",
  log: false
}
```

**Operations:**
- `GET` - List NAT rules
- `POST` - Create NAT rule
- `PUT` - Update NAT rule
- `DELETE` - Delete NAT rule

### Service Resources

#### opnsense://services/dhcp

DHCP server configurations.

**Properties:**
```javascript
{
  interface: "lan",
  enabled: true,
  range: {
    from: "192.168.1.100",
    to: "192.168.1.200"
  },
  gateway: "192.168.1.1",
  dns: ["192.168.1.1", "8.8.8.8"],
  domain: "home.local",
  leaseTime: 86400,
  maxLeaseTime: 172800,
  staticMappings: [{
    mac: "aa:bb:cc:dd:ee:ff",
    ip: "192.168.1.50",
    hostname: "printer",
    description: "Office printer"
  }],
  options: [{
    number: 42,
    type: "string",
    value: "192.168.1.1"
  }]
}
```

**Operations:**
- `GET` - Get DHCP config
- `PUT` - Update DHCP config

#### opnsense://services/dhcp/leases

Active DHCP leases.

**Properties:**
```javascript
{
  ip: "192.168.1.100",
  mac: "aa:bb:cc:dd:ee:ff",
  hostname: "laptop",
  starts: "2024-01-15T10:00:00Z",
  ends: "2024-01-15T22:00:00Z",
  state: "active",
  type: "dynamic",
  interface: "lan"
}
```

**Operations:**
- `GET` - List leases
- `DELETE` - Release lease

#### opnsense://services/dns/blocklist

DNS blocking configurations.

**Properties:**
```javascript
{
  uuid: "string",
  domain: "facebook.com",
  type: "host",
  description: "Block social media",
  enabled: true,
  categories: ["social"],
  action: "block",
  redirect: "0.0.0.0"
}
```

**Operations:**
- `GET` - List blocked domains
- `POST` - Add block
- `DELETE` - Remove block

### HAProxy Resources

#### opnsense://haproxy/backends

HAProxy backend configurations.

**Properties:**
```javascript
{
  uuid: "string",
  name: "web_backend",
  mode: "http",
  balance: "roundrobin",
  servers: [{
    uuid: "string",
    name: "web1",
    address: "192.168.1.10",
    port: 80,
    ssl: false,
    sslVerify: "none",
    check: true,
    checkInterval: 5000,
    weight: 1,
    backup: false,
    status: "up"
  }],
  healthCheck: {
    type: "http",
    path: "/health",
    method: "GET",
    expectStatus: 200,
    interval: 5000,
    timeout: 2000,
    rise: 2,
    fall: 3
  },
  persistence: {
    type: "cookie",
    cookieName: "SERVERID",
    mode: "insert"
  },
  description: "Web server backend"
}
```

**Operations:**
- `GET` - List backends
- `POST` - Create backend
- `PUT` - Update backend
- `DELETE` - Delete backend

#### opnsense://haproxy/frontends

HAProxy frontend configurations.

**Properties:**
```javascript
{
  uuid: "string",
  name: "web_frontend",
  bind: "0.0.0.0:443",
  mode: "http",
  defaultBackend: "web_backend",
  ssl: true,
  certificates: ["cert-uuid"],
  sslOptions: {
    minVersion: "TLSv1.2",
    ciphers: "ECDHE+AESGCM",
    preferServerCiphers: true,
    sessionCache: true
  },
  acls: [{
    name: "is_api",
    expression: "path_beg /api"
  }],
  actions: [{
    type: "use_backend",
    backend: "api_backend",
    condition: "is_api"
  }],
  description: "Main web frontend"
}
```

**Operations:**
- `GET` - List frontends
- `POST` - Create frontend
- `PUT` - Update frontend
- `DELETE` - Delete frontend

#### opnsense://haproxy/stats

HAProxy statistics and metrics.

**Properties:**
```javascript
{
  frontends: [{
    name: "web_frontend",
    status: "UP",
    sessions: {
      current: 10,
      max: 100,
      total: 1000
    },
    bytes: {
      in: 1048576,
      out: 2097152
    },
    requests: {
      total: 500,
      rate: 10
    },
    errors: {
      request: 0,
      connection: 0,
      response: 0
    }
  }],
  backends: [{
    name: "web_backend",
    status: "UP",
    servers: {
      active: 3,
      backup: 1,
      total: 4
    },
    sessions: {
      current: 25,
      max: 200,
      total: 5000
    },
    queue: {
      current: 0,
      max: 10
    }
  }]
}
```

**Operations:**
- `GET` - Get statistics

### System Resources

#### opnsense://system/info

System information and status.

**Properties:**
```javascript
{
  hostname: "opnsense.local",
  version: "23.7",
  uptime: "5 days, 3:24:15",
  datetime: "2024-01-15T10:30:00Z",
  cpu: {
    model: "Intel Core i5",
    cores: 4,
    usage: 15,
    temperature: 45
  },
  memory: {
    total: 8192,
    used: 3686,
    free: 4506,
    usage: 45
  },
  disk: {
    total: 120000,
    used: 36000,
    free: 84000,
    usage: 30
  },
  load: {
    avg1: 0.5,
    avg5: 0.7,
    avg15: 0.6
  }
}
```

**Operations:**
- `GET` - Get system info

#### opnsense://system/backups

Configuration backups.

**Properties:**
```javascript
{
  filename: "config-2024-01-15-103000.xml",
  date: "2024-01-15T10:30:00Z",
  size: 102400,
  description: "Before upgrade",
  type: "manual",
  components: ["all"]
}
```

**Operations:**
- `GET` - List backups
- `POST` - Create backup
- `PUT` - Restore backup
- `DELETE` - Delete backup

### Diagnostic Resources

#### opnsense://diagnostics/arp

ARP table entries.

**Properties:**
```javascript
{
  ip: "192.168.1.100",
  mac: "aa:bb:cc:dd:ee:ff",
  interface: "lan",
  type: "dynamic",
  age: 300,
  manufacturer: "Apple Inc.",
  hostname: "MacBook-Pro"
}
```

**Operations:**
- `GET` - List ARP entries
- `POST` - Add static entry
- `DELETE` - Remove entry

## Resource Metadata

All resources include standard metadata:

```javascript
{
  _metadata: {
    created: "2024-01-15T10:00:00Z",
    modified: "2024-01-15T10:30:00Z",
    version: 1,
    etag: "abc123",
    links: {
      self: "opnsense://network/vlans/uuid",
      related: ["opnsense://firewall/rules"]
    }
  }
}
```

## Resource States

Resources can have states:

| State | Description |
|-------|-------------|
| `active` | Resource is operational |
| `pending` | Resource is being created/updated |
| `disabled` | Resource exists but is disabled |
| `error` | Resource has errors |
| `deleted` | Resource marked for deletion |

## Resource Events

Resources emit events:

| Event | Description |
|-------|-------------|
| `created` | Resource was created |
| `updated` | Resource was modified |
| `deleted` | Resource was removed |
| `state_changed` | Resource state changed |
| `error` | Resource error occurred |

## Resource Relationships

Resources can reference each other:

```javascript
{
  type: "opnsense:firewall:rule",
  properties: {
    interface: "${vlan.device}",  // Reference VLAN resource
    destination: "${alias.name}"   // Reference alias resource
  },
  dependencies: [
    "opnsense:network:vlan:guest-vlan",
    "opnsense:firewall:alias:web-servers"
  ]
}
```

## Batch Operations

Some resources support batch operations:

```javascript
// Batch create firewall rules
POST opnsense://firewall/rules/batch
[
  { /* rule 1 */ },
  { /* rule 2 */ },
  { /* rule 3 */ }
]

// Batch delete
DELETE opnsense://firewall/rules/batch
["uuid1", "uuid2", "uuid3"]
```

## Filtering and Queries

Resources support filtering:

```javascript
// Filter by property
GET opnsense://firewall/rules?interface=wan

// Search
GET opnsense://firewall/rules?search=web

// Sort
GET opnsense://firewall/rules?sort=sequence

// Pagination
GET opnsense://firewall/rules?page=1&limit=50
```

## Next Steps

- [Tools Reference](tools.md) - MCP tools documentation
- [Schemas](schemas.md) - Data validation schemas
- [IaC Guide](../iac/overview.md) - Infrastructure as Code