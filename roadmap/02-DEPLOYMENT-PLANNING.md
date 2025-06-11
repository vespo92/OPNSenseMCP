# Phase 2: Deployment Planning & State Management

## Goal
Implement deployment planning that can diff desired state vs actual state and generate an execution plan (similar to Terraform plan).

## Timeline: Week 3-4

## Prerequisites
- Phase 1 completed (Resource Model)
- All resources properly defined
- State store implemented

## Core Components

### 1. State Reader
```typescript
// src/state/reader.ts
export class OPNSenseStateReader {
  constructor(private client: OPNSenseClient) {}
  
  async getCurrentState(): Promise<CurrentState> {
    const state: CurrentState = {
      resources: new Map(),
      timestamp: new Date().toISOString()
    };
    
    // Read all resource types
    const [rules, aliases, vlans, haproxyServers] = await Promise.all([
      this.readFirewallRules(),
      this.readAliases(),
      this.readVlans(),
      this.readHaproxyServers()
    ]);
    
    // Convert to resource format
    rules.forEach(rule => {
      const resource = this.convertFirewallRule(rule);
      state.resources.set(resource.id, resource);
    });
    
    return state;
  }
  
  private convertFirewallRule(apiRule: any): Resource {
    return new FirewallRule(apiRule.description || `rule-${apiRule.uuid}`, {
      interface: apiRule.interface,
      action: apiRule.type,
      source: apiRule.source_net,
      destination: apiRule.destination_net,
      destinationPort: apiRule.destination_port,
      protocol: apiRule.protocol,
      _uuid: apiRule.uuid // Store for updates/deletes
    });
  }
}
```

### 2. Deployment Planner
```typescript
// src/deployment/planner.ts
export class DeploymentPlanner {
  constructor(
    private stateReader: OPNSenseStateReader,
    private resourceRegistry: ResourceRegistry
  ) {}
  
  async plan(
    desiredResources: Resource[],
    options: PlanOptions = {}
  ): Promise<DeploymentPlan> {
    // Get current state
    const currentState = await this.stateReader.getCurrentState();
    
    // Build dependency graph
    const graph = this.buildDependencyGraph(desiredResources);
    
    // Calculate changes
    const actions = this.calculateActions(
      currentState,
      desiredResources,
      graph
    );
    
    // Order by dependencies
    const orderedActions = this.orderActions(actions, graph);
    
    return {
      id: generatePlanId(),
      timestamp: new Date().toISOString(),
      actions: orderedActions,
      summary: this.generateSummary(orderedActions),
      estimatedDuration: this.estimateDuration(orderedActions)
    };
  }
  
  private calculateActions(
    current: CurrentState,
    desired: Resource[],
    graph: DependencyGraph
  ): PlannedAction[] {
    const actions: PlannedAction[] = [];
    
    // Find resources to create
    for (const resource of desired) {
      const existing = this.findExistingResource(current, resource);
      
      if (!existing) {
        actions.push({
          type: 'create',
          resource,
          reason: 'Resource does not exist'
        });
      } else if (this.hasChanges(existing, resource)) {
        actions.push({
          type: 'update',
          resource,
          existing,
          changes: this.calculateChanges(existing, resource),
          reason: 'Resource properties changed'
        });
      }
    }
    
    // Find resources to delete
    for (const [id, existing] of current.resources) {
      const stillNeeded = desired.find(r => 
        this.isSameResource(r, existing)
      );
      
      if (!stillNeeded && !options.preserveUnknown) {
        actions.push({
          type: 'delete',
          resource: existing,
          reason: 'Resource not in desired state'
        });
      }
    }
    
    return actions;
  }
  
  private buildDependencyGraph(resources: Resource[]): DependencyGraph {
    const graph = new DependencyGraph();
    
    for (const resource of resources) {
      graph.addNode(resource.id, resource);
      
      for (const dep of resource.dependencies) {
        graph.addEdge(resource.id, dep);
      }
    }
    
    // Validate no cycles
    if (graph.hasCycle()) {
      throw new Error('Circular dependency detected');
    }
    
    return graph;
  }
}
```

### 3. Plan Visualization
```typescript
// src/deployment/visualizer.ts
export class PlanVisualizer {
  static format(plan: DeploymentPlan): string {
    const lines: string[] = [];
    
    lines.push('Deployment Plan');
    lines.push('===============');
    lines.push(`ID: ${plan.id}`);
    lines.push(`Generated: ${plan.timestamp}`);
    lines.push('');
    
    // Summary
    lines.push('Summary:');
    lines.push(`  + ${plan.summary.toCreate} to create`);
    lines.push(`  ~ ${plan.summary.toUpdate} to update`);
    lines.push(`  - ${plan.summary.toDelete} to delete`);
    lines.push('');
    
    // Detailed actions
    lines.push('Actions:');
    for (const [index, action] of plan.actions.entries()) {
      lines.push(`${index + 1}. ${this.formatAction(action)}`);
    }
    
    return lines.join('\n');
  }
  
  private static formatAction(action: PlannedAction): string {
    const icon = {
      create: '+',
      update: '~',
      delete: '-'
    }[action.type];
    
    let line = `${icon} ${action.resource.type} "${action.resource.name}"`;
    
    if (action.type === 'update' && action.changes) {
      line += '\n     Changes:';
      for (const change of action.changes) {
        line += `\n       ${change.property}: ${change.old} → ${change.new}`;
      }
    }
    
    return line;
  }
}
```

### 4. Diff Engine
```typescript
// src/deployment/diff.ts
export class DiffEngine {
  static diff(
    current: Resource,
    desired: Resource
  ): PropertyChange[] {
    const changes: PropertyChange[] = [];
    
    // Check all desired properties
    for (const [key, desiredValue] of Object.entries(desired.properties)) {
      const currentValue = current.properties[key];
      
      if (!this.deepEqual(currentValue, desiredValue)) {
        changes.push({
          property: key,
          old: currentValue,
          new: desiredValue,
          action: currentValue === undefined ? 'add' : 'update'
        });
      }
    }
    
    // Check for removed properties
    for (const [key, currentValue] of Object.entries(current.properties)) {
      if (!(key in desired.properties)) {
        changes.push({
          property: key,
          old: currentValue,
          new: undefined,
          action: 'remove'
        });
      }
    }
    
    return changes;
  }
  
  private static deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (typeof a !== typeof b) return false;
    
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      return a.every((item, index) => this.deepEqual(item, b[index]));
    }
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => this.deepEqual(a[key], b[key]));
    }
    
    return false;
  }
}
```

### 5. State Persistence
```typescript
// src/state/persistence.ts
export class StatePersistence {
  constructor(private basePath: string = './state') {}
  
  async saveDeploymentState(
    deploymentId: string,
    state: DeploymentState
  ): Promise<void> {
    const path = `${this.basePath}/${deploymentId}`;
    
    // Save main state file
    await this.writeJson(`${path}/state.json`, {
      version: 1,
      deployment: state.deployment,
      resources: Array.from(state.resources.entries()),
      lastUpdated: new Date().toISOString()
    });
    
    // Save individual resource states for quick lookup
    for (const [id, resource] of state.resources) {
      await this.writeJson(
        `${path}/resources/${this.sanitizeId(id)}.json`,
        resource
      );
    }
    
    // Save plan history
    if (state.lastPlan) {
      await this.writeJson(
        `${path}/plans/${state.lastPlan.id}.json`,
        state.lastPlan
      );
    }
  }
  
  async loadDeploymentState(
    deploymentId: string
  ): Promise<DeploymentState | null> {
    const path = `${this.basePath}/${deploymentId}/state.json`;
    
    if (!await this.fileExists(path)) {
      return null;
    }
    
    const data = await this.readJson(path);
    
    return {
      deployment: data.deployment,
      resources: new Map(data.resources),
      lastUpdated: data.lastUpdated,
      version: data.version
    };
  }
}
```

### 6. MCP Tool Implementation
```typescript
// Update the MCP server with planning tools
case 'planDeployment':
  if (!args) throw new Error('Arguments required');
  
  // Parse resources
  const resources = args.resources.map(r => 
    this.resourceRegistry.create(r.type, r.name, r.properties)
  );
  
  // Validate all resources
  const validationErrors = [];
  for (const resource of resources) {
    const result = resource.validate();
    if (!result.valid) {
      validationErrors.push({
        resource: resource.name,
        errors: result.errors
      });
    }
  }
  
  if (validationErrors.length > 0) {
    return {
      content: [{
        type: 'text',
        text: `Validation failed:\n${JSON.stringify(validationErrors, null, 2)}`
      }]
    };
  }
  
  // Create plan
  const planner = new DeploymentPlanner(
    new OPNSenseStateReader(this.client),
    this.resourceRegistry
  );
  
  const plan = await planner.plan(resources, args.options);
  
  // Save plan
  await this.statePersistence.savePlan(plan);
  
  // Return formatted plan
  return {
    content: [{
      type: 'text',
      text: PlanVisualizer.format(plan)
    }]
  };
```

## Testing Strategy

### Unit Tests
```typescript
describe('DeploymentPlanner', () => {
  it('should detect new resources', async () => {
    const current = new CurrentState();
    const desired = [
      new FirewallRule('test-rule', { interface: 'wan', action: 'pass' })
    ];
    
    const plan = await planner.plan(desired);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe('create');
  });
  
  it('should detect changes', async () => {
    const current = new CurrentState();
    current.resources.set('test-id', 
      new FirewallRule('test-rule', { 
        interface: 'wan', 
        action: 'pass',
        _uuid: '123'
      })
    );
    
    const desired = [
      new FirewallRule('test-rule', { 
        interface: 'wan', 
        action: 'block' // Changed
      })
    ];
    
    const plan = await planner.plan(desired);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe('update');
    expect(plan.actions[0].changes[0].property).toBe('action');
  });
});
```

### Integration Tests
```typescript
describe('End-to-end planning', () => {
  it('should plan complex deployment', async () => {
    const deployment = {
      resources: [
        {
          type: 'opnsense:network:vlan',
          name: 'app-vlan',
          properties: { tag: 100, interface: 'igc2' }
        },
        {
          type: 'opnsense:firewall:alias',
          name: 'app-servers',
          properties: { type: 'host', content: '10.0.100.10' }
        },
        {
          type: 'opnsense:firewall:rule',
          name: 'allow-app',
          properties: {
            interface: 'wan',
            destination: 'app-servers',
            action: 'pass'
          },
          dependencies: ['app-servers']
        }
      ]
    };
    
    const result = await mcpClient.planDeployment(deployment);
    expect(result).toContain('3 to create');
    expect(result).toContain('vlan → alias → rule');
  });
});
```

## Success Criteria

1. ✅ Can read current OPNSense state
2. ✅ Can diff current vs desired state
3. ✅ Can generate ordered execution plan
4. ✅ Respects resource dependencies
5. ✅ Plan is human-readable
6. ✅ State is persisted and versioned

## Next Phase Preview
Phase 3 will implement:
- Plan execution engine
- Parallel resource creation
- Error handling and rollback
- Progress tracking
