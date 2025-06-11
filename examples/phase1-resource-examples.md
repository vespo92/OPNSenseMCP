# Phase 1 Resource Model Examples

This document shows how to use the resource-based MCP server to manage OPNSense infrastructure.

## 1. Basic Firewall Rule Creation

```json
{
  "tool": "validateResources",
  "arguments": {
    "resources": [
      {
        "type": "opnsense:firewall:rule",
        "name": "allow-web-traffic",
        "properties": {
          "interface": "wan",
          "action": "pass",
          "source": "any",
          "destination": "10.0.150.10",
          "destinationPort": "443",
          "protocol": "tcp",
          "description": "Allow HTTPS to web server"
        }
      }
    ]
  }
}
```

## 2. Create VLAN with Interface

```json
{
  "tool": "planDeployment",
  "arguments": {
    "deploymentId": "network-setup",
    "resources": [
      {
        "type": "opnsense:network:vlan",
        "name": "dmz-vlan",
        "properties": {
          "tag": 150,
          "interface": "igc2",
          "description": "DMZ Network"
        }
      },
      {
        "type": "opnsense:network:interface",
        "name": "dmz-interface",
        "properties": {
          "device": "igc2.150",
          "enabled": true,
          "description": "DMZ Interface",
          "ipv4": {
            "type": "static",
            "address": "10.0.150.1",
            "subnet": 24
          }
        },
        "dependencies": ["opnsense:network:vlan:dmz-vlan:*"]
      }
    ]
  }
}
```

## 3. HAProxy Load Balancer Setup

```json
{
  "tool": "validateResources",
  "arguments": {
    "resources": [
      {
        "type": "opnsense:firewall:alias",
        "name": "web-servers",
        "properties": {
          "type": "host",
          "content": "10.0.150.10\n10.0.150.11\n10.0.150.12",
          "description": "Web server pool"
        }
      },
      {
        "type": "opnsense:service:haproxy:backend",
        "name": "web-backend",
        "properties": {
          "mode": "http",
          "balance": "roundrobin",
          "healthCheck": {
            "type": "http",
            "interval": 5000,
            "timeout": 3000,
            "uri": "/health"
          }
        }
      },
      {
        "type": "opnsense:service:haproxy:server",
        "name": "web-server-1",
        "properties": {
          "backend": "opnsense:service:haproxy:backend:web-backend:*",
          "address": "10.0.150.10",
          "port": 8080,
          "weight": 10
        }
      },
      {
        "type": "opnsense:service:haproxy:server",
        "name": "web-server-2",
        "properties": {
          "backend": "opnsense:service:haproxy:backend:web-backend:*",
          "address": "10.0.150.11",
          "port": 8080,
          "weight": 10
        }
      }
    ]
  }
}
```

## 4. Complete Network Deployment

```json
{
  "tool": "planDeployment",
  "arguments": {
    "deploymentId": "production-network",
    "resources": [
      {
        "type": "opnsense:network:vlan",
        "name": "app-network",
        "properties": {
          "tag": 100,
          "interface": "igc1",
          "description": "Application Network"
        }
      },
      {
        "type": "opnsense:network:interface",
        "name": "app-interface",
        "properties": {
          "device": "igc1.100",
          "ipv4": {
            "type": "static",
            "address": "192.168.100.1",
            "subnet": 24
          }
        },
        "dependencies": ["opnsense:network:vlan:app-network:*"]
      },
      {
        "type": "opnsense:service:dhcp:range",
        "name": "app-dhcp-range",
        "properties": {
          "interface": "igc1.100",
          "from": "192.168.100.100",
          "to": "192.168.100.200"
        },
        "dependencies": ["opnsense:network:interface:app-interface:*"]
      },
      {
        "type": "opnsense:firewall:rule",
        "name": "allow-app-internet",
        "properties": {
          "interface": "igc1.100",
          "action": "pass",
          "source": "192.168.100.0/24",
          "destination": "any",
          "protocol": "any",
          "description": "Allow app network to internet"
        },
        "dependencies": ["opnsense:network:interface:app-interface:*"]
      }
    ]
  }
}
```

## 5. Apply Deployment

After planning, apply the deployment:

```json
{
  "tool": "applyDeployment",
  "arguments": {
    "deploymentId": "production-network",
    "plan": {
      "actions": [
        {
          "type": "create",
          "resource": { /* resource object from plan */ }
        }
      ]
    }
  }
}
```

## 6. Create Checkpoint

Before making changes, create a checkpoint:

```json
{
  "tool": "createCheckpoint",
  "arguments": {
    "deploymentId": "production-network",
    "description": "Before adding new firewall rules"
  }
}
```

## 7. Rollback if Needed

If something goes wrong:

```json
{
  "tool": "rollback",
  "arguments": {
    "deploymentId": "production-network",
    "checkpointId": "checkpoint-1234567890"
  }
}
```

## Resource Type Reference

### Available Resource Types:
- `opnsense:firewall:rule` - Firewall rules
- `opnsense:firewall:alias` - IP/Port aliases
- `opnsense:network:vlan` - VLAN configuration
- `opnsense:network:interface` - Interface configuration
- `opnsense:service:haproxy:backend` - HAProxy backend pools
- `opnsense:service:haproxy:server` - HAProxy backend servers
- `opnsense:service:haproxy:frontend` - HAProxy frontends
- `opnsense:service:dns:override` - DNS host overrides
- `opnsense:service:dhcp:range` - DHCP ranges
- `opnsense:service:dhcp:static` - DHCP static mappings

### Dependencies

Resources can depend on other resources using their ID pattern:
- Exact ID: `opnsense:firewall:alias:web-servers:abc123`
- Pattern: `opnsense:firewall:alias:web-servers:*` (matches any instance with that type and name)

### Validation

All resources are validated before deployment:
- Required fields are checked
- Values are validated (IPs, ports, etc.)
- Warnings are provided for security concerns
- Dependencies are verified
