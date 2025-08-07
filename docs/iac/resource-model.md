# Resource Model

Deep dive into the Infrastructure as Code resource system.

## Resource Architecture

### Resource Definition

Every resource follows this structure:

```typescript
interface Resource {
  // Identity
  id: string;                    // Unique identifier
  type: string;                  // Resource type
  name?: string;                 // Human-readable name
  
  // Configuration
  properties: Record<string, any>; // Resource-specific properties
  metadata?: ResourceMetadata;     // Additional metadata
  
  // Relationships
  dependencies?: Dependency[];     // Other resources this depends on
  
  // State
  outputs?: Record<string, any>;   // Values produced by resource
  status?: ResourceStatus;         // Current status
}
```

### Resource Types

Format: `provider:category:resource`

Examples:
- `opnsense:network:vlan`
- `opnsense:firewall:rule`
- `opnsense:services:dhcp`

## Resource Categories

### Network Resources

#### VLAN Resource
```typescript
type: "opnsense:network:vlan"

properties: {
  interface: string;        // Physical interface (e.g., "igc3")
  tag: number;             // VLAN tag (1-4094)
  description?: string;    // Description
  subnet?: string;         // IP subnet (e.g., "192.168.10.0/24")
  gateway?: string;        // Gateway IP
  dhcp?: boolean;          // Enable DHCP
}

outputs: {
  interface: string;       // Created interface name (e.g., "igc3_vlan10")
  subnet: string;          // Configured subnet
  gateway: string;         // Gateway IP
}
```

#### Interface Resource
```typescript
type: "opnsense:network:interface"

properties: {
  name: string;            // Interface name
  enabled: boolean;        // Enable interface
  description?: string;    // Description
  ipv4?: {
    type: "static" | "dhcp" | "none";
    address?: string;      // Static IP
    subnet?: number;       // Subnet mask bits
  };
  ipv6?: {
    type: "static" | "dhcp" | "none";
    address?: string;
    prefix?: number;
  };
}

outputs: {
  mac: string;             // MAC address
  status: string;          // up/down
  ip: string;              // Assigned IP
}
```

### Firewall Resources

#### Rule Resource
```typescript
type: "opnsense:firewall:rule"

properties: {
  interface: string;       // Interface or alias
  direction?: "in" | "out"; // Default: "in"
  action: "pass" | "block" | "reject";
  protocol?: string;       // tcp, udp, icmp, any
  
  source?: {
    address?: string;      // IP, network, or alias
    port?: string | number; // Port or range
    not?: boolean;         // Negate
  };
  
  destination?: {
    address?: string;
    port?: string | number;
    not?: boolean;
  };
  
  description?: string;
  log?: boolean;
  enabled?: boolean;
}

outputs: {
  uuid: string;            // Rule UUID
  position: number;        // Rule position
}
```

#### Alias Resource
```typescript
type: "opnsense:firewall:alias"

properties: {
  name: string;            // Alias name
  type: "host" | "network" | "port" | "url";
  content: string[];       // List of values
  description?: string;
  enabled?: boolean;
}

outputs: {
  uuid: string;
  resolved: string[];      // Resolved values
}
```

#### NAT Resource
```typescript
type: "opnsense:firewall:nat"

properties: {
  interface: string;       // WAN interface
  protocol: string;        // tcp, udp, tcp/udp
  source_port: number;     // External port
  destination: string;     // Internal IP
  destination_port: number; // Internal port
  description?: string;
  reflection?: boolean;    // NAT reflection
}

outputs: {
  uuid: string;
  rule_id: string;         // Associated firewall rule
}
```

### Service Resources

#### DHCP Resource
```typescript
type: "opnsense:services:dhcp"

properties: {
  interface: string;       // Interface name or reference
  enabled: boolean;
  range: {
    from: string;          // Start IP
    to: string;            // End IP
  };
  gateway?: string;        // Default gateway
  dns?: string[];          // DNS servers
  domain?: string;         // Domain name
  lease_time?: number;     // Seconds
  
  static_mappings?: Array<{
    mac: string;           // MAC address
    ip: string;            // Static IP
    hostname?: string;     // Hostname
    description?: string;
  }>;
  
  options?: Array<{
    number: number;        // DHCP option number
    value: string;         // Option value
  }>;
}

outputs: {
  active_leases: number;   // Current lease count
  pool_usage: number;      // Percentage used
}
```

#### DNS Blocklist Resource
```typescript
type: "opnsense:services:dns:blocklist"

properties: {
  domains: string[];       // Domains to block
  categories?: string[];   // Predefined categories
  description?: string;
  enabled?: boolean;
}

outputs: {
  blocked_count: number;   // Total blocked domains
}
```

#### HAProxy Backend Resource
```typescript
type: "opnsense:services:haproxy:backend"

properties: {
  name: string;
  mode: "http" | "tcp";
  balance: "roundrobin" | "leastconn" | "source" | "uri";
  
  servers: Array<{
    name: string;
    address: string;
    port: number;
    ssl?: boolean;
    check?: boolean;
    weight?: number;
  }>;
  
  health_check?: {
    type: "http" | "tcp";
    path?: string;         // HTTP check path
    interval?: number;     // Seconds
    timeout?: number;
  };
}

outputs: {
  uuid: string;
  status: string;          // UP/DOWN
  active_servers: number;
}
```

## Resource Relationships

### Dependencies

Resources can depend on others:

```yaml
resources:
  - id: vlan-10
    type: opnsense:network:vlan
    properties:
      tag: 10
      
  - id: dhcp-vlan-10
    type: opnsense:services:dhcp
    dependencies:
      - resourceId: vlan-10
        type: hard
        outputRef: interface
    properties:
      interface: "${vlan-10.interface}"
```

### Dependency Types

**Hard Dependencies**: Must exist before creation
```typescript
{
  type: "hard",
  resourceId: "other-resource",
  outputRef: "interface"
}
```

**Soft Dependencies**: Preferred order but not required
```typescript
{
  type: "soft",
  resourceId: "monitoring-setup"
}
```

### Reference Resolution

Reference other resource outputs:

```yaml
properties:
  # Direct reference
  interface: "${vlan-10.interface}"
  
  # Nested reference
  subnet: "${dhcp-config.outputs.subnet}"
  
  # Function reference
  ip: "${cidr_host(vlan-10.subnet, 1)}"
```

## Resource Validation

### Schema Validation

Each resource type has a Zod schema:

```typescript
const VlanSchema = z.object({
  interface: z.string().regex(/^[a-z]+[0-9]+$/),
  tag: z.number().min(1).max(4094),
  description: z.string().optional(),
  subnet: z.string().ip({ version: "v4" }).optional(),
  gateway: z.string().ip({ version: "v4" }).optional(),
  dhcp: z.boolean().optional()
});
```

### Custom Validation

Resources can implement custom validation:

```typescript
class VlanResource extends IaCResource {
  validate(): ValidationResult {
    const schemaResult = this.schema.safeParse(this.properties);
    
    if (!schemaResult.success) {
      return { valid: false, errors: schemaResult.error.errors };
    }
    
    // Custom validation
    if (this.properties.gateway && !this.properties.subnet) {
      return { 
        valid: false, 
        errors: ["Gateway requires subnet to be defined"] 
      };
    }
    
    return { valid: true };
  }
}
```

## Resource Lifecycle

### Creation Flow

1. **Validation**: Schema and custom validation
2. **Dependency Resolution**: Ensure dependencies exist
3. **Reference Resolution**: Replace references with values
4. **API Mapping**: Convert to API format
5. **Execution**: Call OPNsense API
6. **Output Collection**: Gather resource outputs
7. **State Update**: Save to state database

### Update Flow

1. **Diff Calculation**: Compare desired vs current
2. **Validation**: Validate changes
3. **Update Plan**: Determine update strategy
4. **Execution**: Apply changes
5. **Verification**: Confirm changes applied
6. **State Update**: Update state database

### Deletion Flow

1. **Dependency Check**: Ensure no resources depend on this
2. **Pre-deletion**: Run cleanup tasks
3. **API Call**: Delete from OPNsense
4. **State Removal**: Remove from state database
5. **Cascade**: Handle dependent deletions

## State Management

### State Structure

```typescript
interface ResourceState {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  outputs: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: number;
  };
  status: {
    state: "creating" | "active" | "updating" | "deleting" | "failed";
    message?: string;
    lastError?: string;
  };
}
```

### State Operations

**Read State**: Get current infrastructure state
```typescript
const state = await stateManager.readState("deployment-id");
```

**Write State**: Update after changes
```typescript
await stateManager.writeState("deployment-id", newState);
```

**Lock State**: Prevent concurrent modifications
```typescript
const lock = await stateManager.acquireLock("deployment-id");
try {
  // Make changes
} finally {
  await lock.release();
}
```

## Resource Registry

### Registration

Register custom resources:

```typescript
resourceRegistry.register({
  type: "opnsense:custom:myresource",
  category: "custom",
  schema: MyResourceSchema,
  factory: (id, name, props) => new MyResource(id, name, props),
  validator: (props) => validateMyResource(props),
  apiMapper: (props) => mapToAPI(props)
});
```

### Discovery

Find available resources:

```typescript
// List all resource types
const types = resourceRegistry.listTypes();

// Get resource by type
const resourceClass = resourceRegistry.get("opnsense:network:vlan");

// Filter by category
const networkResources = resourceRegistry.getByCategory("network");
```

## Best Practices

### 1. Resource Naming
- Use descriptive IDs: `web-server-vlan` not `vlan1`
- Include environment: `prod-database-vlan`
- Be consistent: always use hyphens or underscores

### 2. Property Organization
- Group related properties
- Use consistent naming
- Provide sensible defaults
- Document required vs optional

### 3. Output Design
- Output useful values
- Keep outputs minimal
- Use consistent naming
- Document output types

### 4. Dependency Management
- Minimize dependencies
- Use soft dependencies when possible
- Avoid circular dependencies
- Document dependency reasons

### 5. Validation
- Validate early and often
- Provide clear error messages
- Check business logic
- Validate references

## Next Steps

- [Deployment Guide](deployment.md) - How to deploy resources
- [Patterns](patterns.md) - Common resource patterns
- [Examples](examples/) - Complete resource examples

## Related Documentation

- [IaC Overview](overview.md)
- [API Reference](../api-reference/resources.md)
- [Troubleshooting](../troubleshooting/common-issues.md#iac)