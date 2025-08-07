# OPNSense MCP - IaC Architecture Quick Reference

## Core Concepts

### 1. Resources
Every infrastructure component is a **Resource**:
```typescript
class VlanResource extends IaCResource {
  type = 'opnsense:network:vlan'
  // Properties, validation, API mapping
}
```

### 2. Resource Lifecycle
```
Define → Validate → Plan → Execute → State
   ↓        ↓         ↓        ↓        ↓
Properties  Schema  Diff    API     Persist
```

### 3. Deployment Flow
```
Desired State → Planner → Execution Plan → Engine → Applied State
                   ↓                          ↓
              Current State              Rollback
```

## Resource Types

### Network Resources
- `opnsense:network:vlan` - Virtual LANs
- `opnsense:network:interface` - Network interfaces
- `opnsense:network:route` - Static routes

### Firewall Resources
- `opnsense:firewall:rule` - Firewall rules
- `opnsense:firewall:alias` - IP/Port aliases
- `opnsense:firewall:nat` - NAT rules

### Service Resources
- `opnsense:services:dhcp` - DHCP configuration
- `opnsense:services:dns` - DNS settings
- `opnsense:services:haproxy` - Load balancer

## Key Components

### Resource Registry
```typescript
// Register new resource types
resourceRegistry.register({
  type: 'opnsense:network:vlan',
  category: 'network',
  schema: VlanSchema,
  factory: (id, name, props) => new VlanResource(id, name, props)
});
```

### Deployment Planner
```typescript
// Create execution plan
const plan = await planner.planDeployment(
  'my-deployment',
  desiredResources,
  currentResources
);
```

### Execution Engine
```typescript
// Execute with options
const result = await engine.execute(plan, {
  dryRun: false,
  parallel: true,
  maxConcurrency: 5,
  progressCallback: (progress) => console.log(progress)
});
```

## Resource Definition Pattern

```typescript
export class MyResource extends IaCResource {
  readonly type = 'opnsense:category:resource';
  readonly schema = z.object({
    // Zod schema for validation
  });

  toAPIPayload(): any {
    // Convert to OPNSense API format
  }

  fromAPIResponse(response: any): void {
    // Update from API response
    this.setOutputs({
      // Set resource outputs
    });
  }

  getRequiredPermissions(): string[] {
    // Return required API permissions
  }
}
```

## State Management

### Resource State
```typescript
interface ResourceState {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  outputs: Record<string, any>;
  metadata: ResourceMetadata;
  status: ResourceStatus;
}
```

### State Operations
- **Lock** - Prevent concurrent modifications
- **Read** - Get current infrastructure state
- **Write** - Update state after changes
- **History** - Track all state changes

## Dependencies

### Declaring Dependencies
```typescript
resource.addDependency({
  resourceId: 'other-resource-id',
  type: 'hard',
  outputRef: 'interface'
});
```

### Reference Resolution
```typescript
// Reference another resource's output
properties: {
  interface: '${opnsense:network:vlan:my-vlan.interface}'
}
```

## Execution Waves

Resources are executed in dependency order:
```
Wave 1: Independent resources
Wave 2: Resources depending on Wave 1
Wave 3: Resources depending on Wave 2
...
```

## Rollback Strategy

On failure:
1. Stop execution
2. Identify completed changes
3. Reverse changes in reverse order
4. Restore previous state

## Multi-MCP Future

### Cross-MCP References
```typescript
// Reference resource from another MCP server
firewall: {
  allowFrom: '${aws:ec2:instance:web-server.privateIp}'
}
```

### Unified Deployment
```typescript
// Deploy across multiple MCP servers
resources: [
  { server: 'opnsense', type: 'network:vlan', ... },
  { server: 'aws', type: 'ec2:instance', ... },
  { server: 'kubernetes', type: 'deployment', ... }
]
```

## Best Practices

1. **Always validate** resources before deployment
2. **Use meaningful IDs** for resource identification
3. **Document outputs** for other resources to reference
4. **Handle errors gracefully** with proper rollback
5. **Test in dry-run mode** before applying changes
6. **Version your deployments** for rollback capability
7. **Use dependency declarations** to ensure correct order

## Quick Commands

```bash
# Clean and rebuild
npm run clean && npm run build

# Run tests
npm test

# Start development mode
npm run dev

# Lint code
npm run lint
```

## Next: Phase 5
- Complete resource implementations
- Add state persistence
- Integrate with MCP tools
- Build pattern library
