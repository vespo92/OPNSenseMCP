# Phase 4: IaC Implementation Guide

## Core IaC Components to Build

### 1. Resource Model Implementation (Week 1)

```typescript
// src/iac/models/resource.ts
export interface Resource {
  id: string;
  type: string;  // e.g., "opnsense:firewall:rule"
  name: string;
  properties: Record<string, any>;
  dependencies: string[];
  outputs: Record<string, any>;
  state: ResourceState;
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    tags: Record<string, string>;
  };
}

export interface DeploymentPlan {
  id: string;
  name: string;
  resources: Resource[];
  executionWaves: ExecutionWave[];
  estimatedTime: number;
  changes: {
    create: Resource[];
    update: Resource[];
    delete: Resource[];
    unchanged: Resource[];
  };
}

// src/iac/planner.ts
export class DeploymentPlanner {
  async planDeployment(
    desired: Resource[],
    current: Resource[]
  ): Promise<DeploymentPlan> {
    // 1. Diff current vs desired state
    // 2. Build dependency graph
    // 3. Create execution waves
    // 4. Validate plan
    return plan;
  }
}
```

### 2. State Management (Week 1)

```typescript
// src/state/manager.ts
export class StateManager {
  private storage: StateStorage;
  
  async getCurrentState(deploymentId: string): Promise<DeploymentState> {
    // Fetch from PostgreSQL or file storage
  }
  
  async updateState(deploymentId: string, updates: StateUpdate): Promise<void> {
    // Atomic state updates with locking
  }
  
  async lockState(deploymentId: string): Promise<StateLock> {
    // Distributed locking for multi-user scenarios
  }
}

// src/state/storage/postgres.ts
export class PostgresStateStorage implements StateStorage {
  async init() {
    // Create tables:
    // - deployments
    // - resources
    // - resource_outputs
    // - deployment_history
  }
}
```

### 3. Cross-Reference Resolution (Week 2)

```typescript
// src/iac/references.ts
export class ReferenceResolver {
  // Parse references like ${aws:ec2:web-server.privateIp}
  parseReference(ref: string): CrossReference | null {
    const pattern = /\$\{([^:]+):([^:]+):([^.]+)\.([^}]+)\}/;
    const match = ref.match(pattern);
    if (!match) return null;
    
    return {
      server: match[1],
      resourceType: match[2],
      resourceId: match[3],
      outputProperty: match[4]
    };
  }
  
  async resolveReferences(
    resources: Resource[],
    outputProviders: Map<string, OutputProvider>
  ): Promise<Resource[]> {
    // Deep clone resources
    const resolved = JSON.parse(JSON.stringify(resources));
    
    // Walk through all properties
    for (const resource of resolved) {
      await this.resolveObjectReferences(
        resource.properties,
        outputProviders
      );
    }
    
    return resolved;
  }
}
```

### 4. Deployment Engine (Week 2)

```typescript
// src/iac/engine.ts
export class DeploymentEngine {
  private planner: DeploymentPlanner;
  private executor: ResourceExecutor;
  private stateManager: StateManager;
  
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    // 1. Lock state
    const lock = await this.stateManager.lockState(config.deploymentId);
    
    try {
      // 2. Get current state
      const currentState = await this.stateManager.getCurrentState(
        config.deploymentId
      );
      
      // 3. Plan deployment
      const plan = await this.planner.planDeployment(
        config.resources,
        currentState.resources
      );
      
      // 4. Execute plan
      const result = await this.executor.executePlan(plan);
      
      // 5. Update state
      await this.stateManager.updateState(
        config.deploymentId,
        result
      );
      
      return result;
    } finally {
      await lock.release();
    }
  }
}
```

### 5. MCP Tool Updates (Week 3)

Add these IaC-focused tools to the MCP server:

```typescript
// New tools for index.ts
{
  name: 'plan_deployment',
  description: 'Plan infrastructure deployment',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      resources: { 
        type: 'array',
        items: { $ref: '#/definitions/Resource' }
      },
      dryRun: { type: 'boolean', default: true }
    },
    required: ['name', 'resources']
  }
},
{
  name: 'apply_deployment',
  description: 'Apply a deployment plan',
  inputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
      autoApprove: { type: 'boolean', default: false }
    },
    required: ['planId']
  }
},
{
  name: 'destroy_deployment',
  description: 'Destroy deployed resources',
  inputSchema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'string' },
      force: { type: 'boolean', default: false }
    },
    required: ['deploymentId']
  }
},
{
  name: 'get_deployment_state',
  description: 'Get current deployment state',
  inputSchema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'string' }
    },
    required: ['deploymentId']
  }
}
```

## Natural Language Examples

Once implemented, Claude could handle:

```
"Deploy a secure web application environment with:
- Isolated VLAN for the app servers
- Load balancer with SSL termination
- Firewall rules allowing only HTTPS from internet
- Internal database access only from app VLAN"

"Show me the current state of the customer-portal deployment"

"What would happen if I applied this network configuration?"

"Rollback the last change to the production firewall"
```

## Integration Points

### 1. Output Sharing Between Resources

```typescript
// When creating a VLAN
const vlan = await deploy({
  type: 'opnsense:network:vlan',
  name: 'app-network',
  properties: { tag: 100 },
  outputs: {
    interface: 'igc2_vlan100',
    subnet: '10.100.0.0/24'
  }
});

// Firewall rule can reference it
const rule = await deploy({
  type: 'opnsense:firewall:rule',
  properties: {
    interface: '${opnsense:network:vlan:app-network.interface}',
    source: '${opnsense:network:vlan:app-network.subnet}'
  }
});
```

### 2. Transaction Support

```typescript
// All changes in a deployment are atomic
try {
  await deployment.begin();
  await deployment.createVlan(...);
  await deployment.createFirewallRules(...);
  await deployment.createHaproxyBackend(...);
  await deployment.commit();
} catch (error) {
  await deployment.rollback();
}
```

### 3. Policy Enforcement

```typescript
// Before applying any deployment
const policyResults = await policyEngine.evaluate(plan);
if (!policyResults.compliant) {
  throw new PolicyViolationError(policyResults.violations);
}
```

## Next Steps

1. **Week 1**: Implement basic resource model and state management
2. **Week 2**: Add deployment planning and execution
3. **Week 3**: Integrate with existing MCP tools
4. **Week 4**: Add cross-reference resolution
5. **Week 5**: Create deployment patterns library
6. **Week 6**: Build policy engine

This foundation will enable the multi-MCP orchestration vision!