# JSON Schema Reference

Data validation schemas for all MCP tools and resources.

## Overview

All data validation uses JSON Schema (draft-07) with Zod for TypeScript validation.

## Tool Schemas

### Network Management

#### createVlan

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["interface", "tag"],
  "properties": {
    "interface": {
      "type": "string",
      "pattern": "^[a-z]+[0-9]+(_vlan[0-9]+)?$",
      "description": "Physical interface name"
    },
    "tag": {
      "type": "integer",
      "minimum": 1,
      "maximum": 4094,
      "description": "VLAN tag"
    },
    "description": {
      "type": "string",
      "maxLength": 255,
      "description": "VLAN description"
    },
    "priority": {
      "type": "integer",
      "minimum": 0,
      "maximum": 7,
      "description": "802.1p priority"
    }
  }
}
```

### Firewall Management

#### createFirewallRule

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["interface", "action"],
  "properties": {
    "interface": {
      "type": "string",
      "description": "Interface name or alias"
    },
    "action": {
      "type": "string",
      "enum": ["pass", "block", "reject"],
      "description": "Rule action"
    },
    "direction": {
      "type": "string",
      "enum": ["in", "out"],
      "default": "in",
      "description": "Traffic direction"
    },
    "protocol": {
      "type": "string",
      "enum": ["tcp", "udp", "tcp/udp", "icmp", "esp", "ah", "gre", "any"],
      "default": "any",
      "description": "Protocol"
    },
    "source": {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "description": "Source address (IP, network, or alias)"
        },
        "port": {
          "oneOf": [
            {"type": "string"},
            {"type": "integer", "minimum": 1, "maximum": 65535}
          ],
          "description": "Source port or range"
        },
        "not": {
          "type": "boolean",
          "default": false,
          "description": "Negate source"
        }
      }
    },
    "destination": {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "description": "Destination address"
        },
        "port": {
          "oneOf": [
            {"type": "string"},
            {"type": "integer", "minimum": 1, "maximum": 65535}
          ],
          "description": "Destination port or range"
        },
        "not": {
          "type": "boolean",
          "default": false,
          "description": "Negate destination"
        }
      }
    },
    "description": {
      "type": "string",
      "maxLength": 255,
      "description": "Rule description"
    },
    "log": {
      "type": "boolean",
      "default": false,
      "description": "Enable logging"
    },
    "enabled": {
      "type": "boolean",
      "default": true,
      "description": "Enable rule"
    }
  }
}
```

#### createAlias

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "type", "content"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$",
      "maxLength": 32,
      "description": "Alias name"
    },
    "type": {
      "type": "string",
      "enum": ["host", "network", "port", "url", "urltable"],
      "description": "Alias type"
    },
    "content": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string"
      },
      "description": "Alias values"
    },
    "description": {
      "type": "string",
      "maxLength": 255,
      "description": "Alias description"
    },
    "enabled": {
      "type": "boolean",
      "default": true,
      "description": "Enable alias"
    }
  }
}
```

### Service Management

#### configureDhcpServer

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["interface", "enable", "range"],
  "properties": {
    "interface": {
      "type": "string",
      "description": "Interface name"
    },
    "enable": {
      "type": "boolean",
      "description": "Enable DHCP server"
    },
    "range": {
      "type": "object",
      "required": ["from", "to"],
      "properties": {
        "from": {
          "type": "string",
          "format": "ipv4",
          "description": "Start IP"
        },
        "to": {
          "type": "string",
          "format": "ipv4",
          "description": "End IP"
        }
      }
    },
    "gateway": {
      "type": "string",
      "format": "ipv4",
      "description": "Default gateway"
    },
    "dns": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "ipv4"
      },
      "description": "DNS servers"
    },
    "domain": {
      "type": "string",
      "pattern": "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$",
      "description": "Domain name"
    },
    "leaseTime": {
      "type": "integer",
      "minimum": 60,
      "maximum": 86400,
      "default": 7200,
      "description": "Lease time in seconds"
    }
  }
}
```

#### createStaticMapping

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["mac", "ip"],
  "properties": {
    "mac": {
      "type": "string",
      "pattern": "^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$",
      "description": "MAC address"
    },
    "ip": {
      "type": "string",
      "format": "ipv4",
      "description": "IP address"
    },
    "hostname": {
      "type": "string",
      "pattern": "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$",
      "description": "Hostname"
    },
    "description": {
      "type": "string",
      "maxLength": 255,
      "description": "Description"
    }
  }
}
```

### DNS Management

#### blockDomains

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["domains"],
  "properties": {
    "domains": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "pattern": "^([a-z0-9]+(-[a-z0-9]+)*\\.)+[a-z]{2,}$",
        "description": "Domain to block"
      }
    },
    "description": {
      "type": "string",
      "maxLength": 255,
      "description": "Block description"
    }
  }
}
```

### HAProxy Management

#### haproxy_backend_create

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "mode", "balance"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-zA-Z][a-zA-Z0-9_-]*$",
      "maxLength": 32,
      "description": "Backend name"
    },
    "mode": {
      "type": "string",
      "enum": ["http", "tcp"],
      "description": "Backend mode"
    },
    "balance": {
      "type": "string",
      "enum": ["roundrobin", "leastconn", "source", "uri", "hdr", "random"],
      "description": "Load balancing algorithm"
    },
    "servers": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "address", "port"],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-zA-Z][a-zA-Z0-9_-]*$",
            "description": "Server name"
          },
          "address": {
            "type": "string",
            "description": "Server IP or hostname"
          },
          "port": {
            "type": "integer",
            "minimum": 1,
            "maximum": 65535,
            "description": "Server port"
          },
          "ssl": {
            "type": "boolean",
            "default": false,
            "description": "Use SSL to backend"
          },
          "verify": {
            "type": "string",
            "enum": ["none", "required"],
            "default": "required",
            "description": "SSL verification"
          },
          "check": {
            "type": "boolean",
            "default": true,
            "description": "Enable health checks"
          },
          "weight": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256,
            "default": 1,
            "description": "Server weight"
          },
          "backup": {
            "type": "boolean",
            "default": false,
            "description": "Backup server"
          }
        }
      }
    },
    "description": {
      "type": "string",
      "maxLength": 255,
      "description": "Backend description"
    }
  }
}
```

## Resource Schemas

### IaC Resource Base Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "type", "properties"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-zA-Z][a-zA-Z0-9-_]*$",
      "description": "Resource identifier"
    },
    "type": {
      "type": "string",
      "pattern": "^[a-z]+:[a-z]+:[a-z]+$",
      "description": "Resource type (provider:category:resource)"
    },
    "name": {
      "type": "string",
      "description": "Human-readable name"
    },
    "properties": {
      "type": "object",
      "description": "Resource-specific properties"
    },
    "dependencies": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["resourceId", "type"],
        "properties": {
          "resourceId": {
            "type": "string",
            "description": "Dependent resource ID"
          },
          "type": {
            "type": "string",
            "enum": ["hard", "soft"],
            "description": "Dependency type"
          },
          "outputRef": {
            "type": "string",
            "description": "Output to reference"
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "labels": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "annotations": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

### Deployment Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "resources"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-zA-Z][a-zA-Z0-9-_]*$",
      "description": "Deployment name"
    },
    "description": {
      "type": "string",
      "description": "Deployment description"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Deployment version"
    },
    "resources": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/definitions/resource"
      }
    },
    "variables": {
      "type": "object",
      "additionalProperties": true,
      "description": "Deployment variables"
    },
    "outputs": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["value"],
        "properties": {
          "value": {
            "type": "string",
            "description": "Output value or reference"
          },
          "description": {
            "type": "string",
            "description": "Output description"
          },
          "sensitive": {
            "type": "boolean",
            "default": false,
            "description": "Sensitive output"
          }
        }
      }
    }
  }
}
```

## Validation Examples

### TypeScript/Zod

```typescript
import { z } from 'zod';

// VLAN schema
const VlanSchema = z.object({
  interface: z.string().regex(/^[a-z]+[0-9]+$/),
  tag: z.number().min(1).max(4094),
  description: z.string().optional(),
  priority: z.number().min(0).max(7).optional()
});

// Validate
const result = VlanSchema.safeParse({
  interface: "igc3",
  tag: 50,
  description: "Guest Network"
});

if (result.success) {
  console.log("Valid:", result.data);
} else {
  console.error("Errors:", result.error.errors);
}
```

### JSON Schema Validation

```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

// Load schema
const schema = require('./schemas/createVlan.json');

// Compile validator
const validate = ajv.compile(schema);

// Validate data
const valid = validate({
  interface: "igc3",
  tag: 50
});

if (!valid) {
  console.error(validate.errors);
}
```

## Common Patterns

### IP Address Validation

```json
{
  "type": "string",
  "oneOf": [
    {"format": "ipv4"},
    {"format": "ipv6"}
  ]
}
```

### Port Range Validation

```json
{
  "type": "string",
  "pattern": "^([0-9]{1,5}|[0-9]{1,5}-[0-9]{1,5}|[0-9]{1,5}:[0-9]{1,5})$"
}
```

### MAC Address Validation

```json
{
  "type": "string",
  "pattern": "^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
}
```

### Hostname Validation

```json
{
  "type": "string",
  "pattern": "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$"
}
```

## Error Messages

Standard error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": "/properties/tag",
        "message": "must be <= 4094",
        "value": 5000
      }
    ]
  }
}
```

## Schema Evolution

### Versioning

Schemas are versioned:
- Major: Breaking changes
- Minor: New optional fields
- Patch: Documentation/fixes

### Backwards Compatibility

- New fields should be optional
- Use defaults for new fields
- Deprecate before removing
- Support multiple versions

## Custom Validators

### Business Logic

```typescript
// Custom validation beyond schema
function validateVlan(data: any): ValidationResult {
  // Schema validation
  const schemaResult = VlanSchema.safeParse(data);
  if (!schemaResult.success) {
    return { valid: false, errors: schemaResult.error.errors };
  }
  
  // Business logic validation
  if (data.tag === 1) {
    return { 
      valid: false, 
      errors: ["VLAN 1 is reserved for native VLAN"] 
    };
  }
  
  if (data.interface === "wan" && data.tag < 100) {
    return { 
      valid: false, 
      errors: ["WAN VLANs must use tags >= 100"] 
    };
  }
  
  return { valid: true };
}
```

## Next Steps

- [Tools Reference](tools.md) - Tool documentation
- [Resources Reference](resources.md) - Resource types
- [Examples](../../examples/) - Usage examples