# Phase 1: Core Resource Model Implementation

## Goal
Transform the current OPNSense MCP from individual CRUD operations to a resource-based model that aligns with IaC principles.

## Timeline: Week 1-2

## Current State
```typescript
// Current: Direct API wrappers
getFirewallRules()
addFirewallRule(rule)
deleteFirewallRule(uuid)
```

## Target State
```typescript
// Target: Resource-based model
interface OPNSenseResource {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  state: ResourceState;
  dependencies: string[];
}

// Example resource definition
const firewallRule: OPNSenseResource = {
  id: "fw-rule-001",
  type: "opnsense:firewall:rule",
  name: "allow-web-traffic",
  properties: {
    interface: "wan",
    source: "any",
    destination: "10.0.150.10",
    destinationPort: "443",
    protocol: "tcp",
    action: "pass"
  },
  state: "created",
  dependencies: ["vlan-150", "alias-web-servers"]
};
```

## Implementation Steps

### Step 1: Create Resource Base Classes
```typescript
// src/resources/base.ts
export abstract class Resource {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public state: ResourceState = 'pending';
  public outputs: Record<string, any> = {};
  
  constructor(
    type: string,
    name: string,
    public properties: Record<string, any>,
    public dependencies: string[] = []
  ) {
    this.id = `${type}:${name}:${generateHash()}`;
    this.type = type;
    this.name = name;
  }
  
  abstract validate(): ValidationResult;
  abstract toApiPayload(): any;
  abstract fromApiResponse(response: any): void;
}

export enum ResourceState {
  Pending = 'pending',
  Creating = 'creating',
  Created = 'created',
  Updating = 'updating',
  Deleting = 'deleting',
  Deleted = 'deleted',
  Failed = 'failed'
}
```

### Step 2: Implement Concrete Resources
```typescript
// src/resources/firewall.ts
export class FirewallRule extends Resource {
  constructor(name: string, properties: FirewallRuleProperties) {
    super('opnsense:firewall:rule', name, properties);
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.properties.interface) {
      errors.push('Interface is required');
    }
    
    if (!['pass', 'block', 'reject'].includes(this.properties.action)) {
      errors.push('Action must be pass, block, or reject');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  toApiPayload() {
    return {
      rule: {
        interface: this.properties.interface,
        type: this.properties.action,
        protocol: this.properties.protocol || 'any',
        source_net: this.properties.source || 'any',
        destination_net: this.properties.destination || 'any',
        destination_port: this.properties.destinationPort || '',
        description: this.properties.description || this.name,
        enabled: '1'
      }
    };
  }
  
  fromApiResponse(response: any) {
    this.outputs.uuid = response.uuid;
    this.state = ResourceState.Created;
  }
}
```

### Step 3: Resource Registry
```typescript
// src/resources/registry.ts
export class ResourceRegistry {
  private resources = new Map<string, typeof Resource>();
  
  register(type: string, resourceClass: typeof Resource) {
    this.resources.set(type, resourceClass);
  }
  
  create(type: string, name: string, properties: any): Resource {
    const ResourceClass = this.resources.get(type);
    if (!ResourceClass) {
      throw new Error(`Unknown resource type: ${type}`);
    }
    return new ResourceClass(name, properties);
  }
  
  // Initialize with all OPNSense resources
  static initialize(): ResourceRegistry {
    const registry = new ResourceRegistry();
    
    // Firewall
    registry.register('opnsense:firewall:rule', FirewallRule);
    registry.register('opnsense:firewall:alias', FirewallAlias);
    
    // Network
    registry.register('opnsense:network:vlan', Vlan);
    registry.register('opnsense:network:interface', Interface);
    
    // Services
    registry.register('opnsense:service:haproxy:backend', HaproxyBackend);
    registry.register('opnsense:service:haproxy:server', HaproxyServer);
    registry.register('opnsense:service:dns:override', DnsOverride);
    
    return registry;
  }
}
```

### Step 4: Update MCP Tools
```typescript
// Instead of many individual tools, have resource-focused tools
tools: [
  {
    name: 'validateResources',
    description: 'Validate resource configuration',
    inputSchema: {
      type: 'object',
      properties: {
        resources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              name: { type: 'string' },
              properties: { type: 'object' }
            }
          }
        }
      }
    }
  },
  {
    name: 'planDeployment',
    description: 'Plan resource deployment',
    inputSchema: {
      type: 'object',
      properties: {
        resources: { type: 'array' },
        currentState: { type: 'object' }
      }
    }
  },
  {
    name: 'applyResource',
    description: 'Apply a single resource',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'object' },
        action: { 
          type: 'string',
          enum: ['create', 'update', 'delete']
        }
      }
    }
  }
]
```

### Step 5: Resource State Store
```typescript
// src/state/store.ts
export class ResourceStateStore {
  private state: Map<string, ResourceState> = new Map();
  
  async load(deploymentId: string): Promise<void> {
    // Load from file or database
    const statePath = `./state/${deploymentId}.json`;
    if (await fileExists(statePath)) {
      const data = await readFile(statePath);
      this.state = new Map(Object.entries(JSON.parse(data)));
    }
  }
  
  async save(deploymentId: string): Promise<void> {
    const statePath = `./state/${deploymentId}.json`;
    await writeFile(
      statePath,
      JSON.stringify(Object.fromEntries(this.state))
    );
  }
  
  getResource(id: string): ResourceState | undefined {
    return this.state.get(id);
  }
  
  setResource(id: string, state: ResourceState): void {
    this.state.set(id, state);
  }
}
```

## Testing Plan

### Unit Tests
```typescript
describe('FirewallRule Resource', () => {
  it('should validate required properties', () => {
    const rule = new FirewallRule('test-rule', {
      interface: 'wan',
      action: 'pass'
    });
    
    const result = rule.validate();
    expect(result.valid).toBe(true);
  });
  
  it('should generate correct API payload', () => {
    const rule = new FirewallRule('test-rule', {
      interface: 'wan',
      action: 'pass',
      destination: '10.0.0.1',
      destinationPort: '443'
    });
    
    const payload = rule.toApiPayload();
    expect(payload.rule.interface).toBe('wan');
    expect(payload.rule.type).toBe('pass');
  });
});
```

### Integration Tests
```typescript
describe('Resource Deployment', () => {
  it('should deploy a complete firewall ruleset', async () => {
    const resources = [
      new FirewallAlias('web-servers', {
        type: 'host',
        content: '10.0.150.10\n10.0.150.11'
      }),
      new FirewallRule('allow-web', {
        interface: 'wan',
        destination: 'web-servers',
        destinationPort: '443',
        action: 'pass'
      })
    ];
    
    const plan = await planner.plan(resources);
    expect(plan.actions).toHaveLength(2);
    expect(plan.actions[0].resource.type).toBe('opnsense:firewall:alias');
    expect(plan.actions[1].resource.type).toBe('opnsense:firewall:rule');
  });
});
```

## Success Criteria

1. ✅ All current functionality works through resource model
2. ✅ Resources have proper validation
3. ✅ State is tracked and persisted
4. ✅ Dependencies are resolved correctly
5. ✅ API payloads are generated correctly

## Next Phase Preview
Phase 2 will build on this foundation to add:
- Deployment planning and diffing
- Parallel resource creation
- Rollback capabilities
- Cross-resource dependencies
