# HAProxy Management Guide for OPNsense MCP Server

This guide explains how to use the HAProxy management functionality in the OPNsense MCP server.

## Overview

The OPNsense MCP server now includes comprehensive HAProxy management capabilities, allowing you to:

- Control HAProxy service (start, stop, restart, reload)
- Manage backends and server pools
- Configure frontends with SSL/TLS support
- Create and manage ACLs and actions
- Monitor HAProxy statistics and health status
- Manage SSL certificates

## Available Tools

### Service Control

#### `haproxy_service_control`
Control the HAProxy service.

**Parameters:**
- `action` (required): One of `start`, `stop`, `restart`, `reload`, or `status`

**Example:**
```json
{
  "action": "status"
}
```

### Backend Management

#### `haproxy_backend_create`
Create a new HAProxy backend with server pool.

**Parameters:**
- `name` (required): Backend name
- `mode` (required): Either `http` or `tcp`
- `balance` (required): Load balancing algorithm (`roundrobin`, `leastconn`, `source`, `uri`, `hdr`, `random`)
- `servers` (optional): Array of backend servers
- `description` (optional): Backend description

**Server object properties:**
- `name`: Server name
- `address`: IP address or hostname
- `port`: Port number
- `ssl`: Enable SSL (boolean)
- `verify`: SSL verification mode (`none` or `required`)

**Example:**
```json
{
  "name": "truenas-backend",
  "mode": "http",
  "balance": "roundrobin",
  "servers": [{
    "name": "truenas-server",
    "address": "10.0.0.14",
    "port": 443,
    "ssl": true,
    "verify": "none"
  }],
  "description": "TrueNAS backend servers"
}
```

#### `haproxy_backend_list`
List all configured backends.

#### `haproxy_backend_delete`
Delete a backend.

**Parameters:**
- `uuid` (required): Backend UUID

### Frontend Management

#### `haproxy_frontend_create`
Create a new HAProxy frontend.

**Parameters:**
- `name` (required): Frontend name
- `bind` (required): Bind address (e.g., `0.0.0.0:443`)
- `mode` (required): Either `http` or `tcp`
- `backend` (required): Default backend name
- `ssl` (optional): Enable SSL
- `certificates` (optional): Array of certificate UUIDs or names
- `acls` (optional): Array of ACL definitions
- `description` (optional): Frontend description

**ACL object properties:**
- `name`: ACL name
- `expression`: HAProxy ACL expression

**Example:**
```json
{
  "name": "truenas-frontend",
  "bind": "0.0.0.0:443",
  "mode": "http",
  "backend": "truenas-backend",
  "ssl": true,
  "certificates": ["opnsense-selfsigned"],
  "acls": [{
    "name": "truenas-host",
    "expression": "hdr(host) -i truenas.boonersystems.com"
  }],
  "description": "TrueNAS HTTPS frontend"
}
```

#### `haproxy_frontend_list`
List all configured frontends.

#### `haproxy_frontend_delete`
Delete a frontend.

**Parameters:**
- `uuid` (required): Frontend UUID

### Certificate Management

#### `haproxy_certificate_list`
List available certificates for HAProxy.

#### `haproxy_certificate_create`
Create a new certificate.

**Parameters:**
- `name` (required): Certificate name
- `type` (required): Certificate type (`selfsigned`, `import`, `acme`)
- For self-signed:
  - `cn` (optional): Common name
  - `san` (optional): Array of subject alternative names
- For import:
  - `certificate` (required): Certificate content
  - `key` (required): Private key
  - `ca` (optional): CA certificate

**Example (self-signed):**
```json
{
  "name": "truenas-cert",
  "type": "selfsigned",
  "cn": "truenas.boonersystems.com",
  "san": ["truenas.local", "truenas"]
}
```

### ACL Management

#### `haproxy_acl_create`
Create an ACL for a frontend.

**Parameters:**
- `frontend` (required): Frontend UUID
- `name` (required): ACL name
- `expression` (required): HAProxy ACL expression

**Example:**
```json
{
  "frontend": "frontend-uuid-here",
  "name": "is-truenas",
  "expression": "hdr_dom(host) -i boonersystems.com"
}
```

### Action Management

#### `haproxy_action_create`
Create an action for a frontend.

**Parameters:**
- `frontend` (required): Frontend UUID
- `type` (required): Action type (`use_backend`, `redirect`, `add_header`, `set_header`, `del_header`)
- `backend` (optional): Backend name (for `use_backend`)
- `condition` (optional): ACL condition
- `value` (optional): Action value

**Example:**
```json
{
  "frontend": "frontend-uuid-here",
  "type": "use_backend",
  "backend": "truenas-backend",
  "condition": "is-truenas"
}
```

### Statistics and Monitoring

#### `haproxy_stats`
Get comprehensive HAProxy statistics.

Returns statistics for all frontends and backends including:
- Session counts
- Bytes in/out
- Request rates
- Error rates
- Backend server health status

#### `haproxy_backend_health`
Get health status for a specific backend.

**Parameters:**
- `backend` (required): Backend name

## Common Use Cases

### 1. Setting up HTTPS Load Balancing for TrueNAS

```bash
# 1. Create backend with TrueNAS servers
haproxy_backend_create {
  "name": "truenas-backend",
  "mode": "http",
  "balance": "roundrobin",
  "servers": [{
    "name": "truenas-primary",
    "address": "10.0.0.14",
    "port": 443,
    "ssl": true,
    "verify": "none"
  }]
}

# 2. Create frontend listening on HTTPS
haproxy_frontend_create {
  "name": "truenas-frontend",
  "bind": "0.0.0.0:443",
  "mode": "http",
  "backend": "truenas-backend",
  "ssl": true,
  "certificates": ["existing-cert-uuid"]
}

# 3. Add ACL for hostname matching
haproxy_acl_create {
  "frontend": "frontend-uuid",
  "name": "truenas-host",
  "expression": "hdr(host) -i truenas.example.com"
}

# 4. Add action to use backend based on ACL
haproxy_action_create {
  "frontend": "frontend-uuid",
  "type": "use_backend",
  "backend": "truenas-backend",
  "condition": "truenas-host"
}
```

### 2. TCP Load Balancing for Kubernetes

```bash
# Create TCP backend for Kubernetes ingress
haproxy_backend_create {
  "name": "k8s-ingress",
  "mode": "tcp",
  "balance": "roundrobin",
  "servers": [
    {
      "name": "k8s-node1",
      "address": "10.0.0.10",
      "port": 443
    },
    {
      "name": "k8s-node2",
      "address": "10.0.0.11",
      "port": 443
    }
  ]
}

# Create TCP frontend
haproxy_frontend_create {
  "name": "k8s-frontend",
  "bind": "0.0.0.0:443",
  "mode": "tcp",
  "backend": "k8s-ingress"
}
```

### 3. Simple Port Forwarding Alternative

If HAProxy setup is too complex, consider using the existing NAT port forwarding tools in the OPNsense MCP server instead.

## Resources

The MCP server provides these resources for monitoring:

- `opnsense://haproxy/backends` - List all backend configurations
- `opnsense://haproxy/frontends` - List all frontend configurations
- `opnsense://haproxy/stats` - Real-time HAProxy statistics

## Notes

- After making any configuration changes, the HAProxy service is automatically reconfigured
- SSL verification can be disabled for backend servers using `verify: "none"`
- The `uri`, `hdr`, and `url_param` balance algorithms only work in HTTP mode
- Health checks can be configured at the backend level
- ACLs use standard HAProxy expression syntax

## Error Handling

Common errors and solutions:

1. **"HAProxy resource not initialized"** - Ensure you've configured the OPNsense connection first
2. **"No UUID returned"** - The API call succeeded but OPNsense didn't return expected data
3. **"Failed to reconfigure"** - HAProxy configuration has errors; check your settings

## API Endpoints Used

The MCP server interacts with these OPNsense API endpoints:

- `/api/haproxy/service/*` - Service control
- `/api/haproxy/settings/searchBackends` - Backend management
- `/api/haproxy/settings/searchFrontends` - Frontend management
- `/api/haproxy/settings/searchAcls` - ACL management
- `/api/haproxy/settings/searchActions` - Action management
- `/api/haproxy/stats/show` - Statistics
- `/api/system/certificates/*` - Certificate management