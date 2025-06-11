# Phase 3: Execution Engine & Rollback

## Goal
Build a robust execution engine that can apply deployment plans with proper error handling, rollback capabilities, and progress tracking.

## Timeline: Week 5-6

## Prerequisites
- Phase 1 & 2 completed
- Planning engine tested
- State management working

## Core Components

### 1. Execution Engine
```typescript
// src/execution/engine.ts
export class ExecutionEngine {
  private rollbackStack: RollbackAction[] = [];
  private progress: ExecutionProgress;
  
  constructor(
    private client: OPNSenseClient,
    private stateStore: StatePersistence,
    private options: ExecutionOptions = {}
  ) {
    this.progress = new ExecutionProgress();
  }
  
  async execute(plan: DeploymentPlan): Promise<ExecutionResult> {
    this.progress.start(plan);
    const results: ActionResult[] = [];
    
    try {
      // Group actions by stage (respecting dependencies)
      const stages = this.groupIntoStages(plan.actions);
      
      for (const [stageIndex, stage] of stages.entries()) {
        this.progress.startStage(stageIndex, stage);
        
        // Execute stage actions in parallel
        const stageResults = await this.executeStage(stage);
        results.push(...stageResults);
        
        // Check for failures
        const failures = stageResults.filter(r => !r.success);
        if (failures.length > 0 && !this.options.continueOnError) {
          throw new ExecutionError('Stage execution failed', failures);
        }
        
        this.progress.completeStage(stageIndex);
      }
      
      // All successful - commit state
      await this.commitState(plan, results);
      
      return {
        success: true,
        plan,
        results,
        duration: this.progress.getDuration()
      };
      
    } catch (error) {
      // Rollback on failure
      if (this.options.rollbackOnFailure) {
        await this.rollback();
      }
      
      return {
        success: false,
        plan,
        results,
        error,
        duration: this.progress.getDuration()
      };
    } finally {
      this.progress.complete();
    }
  }
  
  private async executeStage(
    actions: PlannedAction[]
  ): Promise<ActionResult[]> {
    const promises = actions.map(action => 
      this.executeAction(action)
        .catch(error => ({
          action,
          success: false,
          error,
          duration: 0
        }))
    );
    
    return Promise.all(promises);
  }
  
  private async executeAction(
    action: PlannedAction
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      let result: any;
      let rollbackAction: RollbackAction | null = null;
      
      switch (action.type) {
        case 'create':
          result = await this.createResource(action.resource);
          rollbackAction = {
            type: 'delete',
            resource: action.resource,
            execute: () => this.deleteResource(action.resource)
          };
          break;
          
        case 'update':
          // Store original state for rollback
          const original = action.existing;
          result = await this.updateResource(action.resource);
          rollbackAction = {
            type: 'restore',
            resource: original,
            execute: () => this.updateResource(original)
          };
          break;
          
        case 'delete':
          // Store state for potential restore
          const backup = await this.backupResource(action.resource);
          result = await this.deleteResource(action.resource);
          rollbackAction = {
            type: 'restore',
            resource: backup,
            execute: () => this.createResource(backup)
          };
          break;
      }
      
      // Add to rollback stack
      if (rollbackAction) {
        this.rollbackStack.push(rollbackAction);
      }
      
      return {
        action,
        success: true,
        result,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        action,
        success: false,
        error,
        duration: Date.now() - startTime
      };
    }
  }
  
  private async rollback(): Promise<void> {
    console.log('Starting rollback...');
    
    // Execute rollback actions in reverse order
    for (const action of this.rollbackStack.reverse()) {
      try {
        await action.execute();
        console.log(`Rolled back: ${action.type} ${action.resource.name}`);
      } catch (error) {
        console.error(`Rollback failed for ${action.resource.name}:`, error);
        // Continue with other rollbacks
      }
    }
  }
}
```

### 2. Resource Operations
```typescript
// src/execution/operations.ts
export class ResourceOperations {
  constructor(private client: OPNSenseClient) {}
  
  async create(resource: Resource): Promise<any> {
    const payload = resource.toApiPayload();
    
    switch (resource.type) {
      case 'opnsense:firewall:rule':
        const rule = await this.client.post('/firewall/filter/addRule', payload);
        await this.client.post('/firewall/filter/apply');
        return rule;
        
      case 'opnsense:firewall:alias':
        const alias = await this.client.post('/firewall/alias/addItem', payload);
        await this.client.post('/firewall/alias/reconfigure');
        return alias;
        
      case 'opnsense:network:vlan':
        const vlan = await this.client.post('/interfaces/vlan/addItem', payload);
        await this.client.post('/interfaces/vlan/reconfigure');
        return vlan;
        
      case 'opnsense:service:haproxy:backend':
        const backend = await this.client.post('/haproxy/settings/addBackend', payload);
        await this.client.post('/haproxy/service/reconfigure');
        return backend;
        
      default:
        throw new Error(`Unknown resource type: ${resource.type}`);
    }
  }
  
  async update(resource: Resource): Promise<any> {
    const payload = resource.toApiPayload();
    const uuid = resource.properties._uuid;
    
    if (!uuid) {
      throw new Error('Cannot update resource without UUID');
    }
    
    switch (resource.type) {
      case 'opnsense:firewall:rule':
        const rule = await this.client.post(`/firewall/filter/setRule/${uuid}`, payload);
        await this.client.post('/firewall/filter/apply');
        return rule;
        
      // Add other resource types...
    }
  }
  
  async delete(resource: Resource): Promise<any> {
    const uuid = resource.properties._uuid;
    
    if (!uuid) {
      throw new Error('Cannot delete resource without UUID');
    }
    
    switch (resource.type) {
      case 'opnsense:firewall:rule':
        await this.client.post(`/firewall/filter/delRule/${uuid}`);
        await this.client.post('/firewall/filter/apply');
        break;
        
      // Add other resource types...
    }
  }
}
```

### 3. Progress Tracking
```typescript
// src/execution/progress.ts
export class ExecutionProgress extends EventEmitter {
  private startTime: number;
  private currentStage: number = -1;
  private stageProgress: Map<number, StageProgress> = new Map();
  
  start(plan: DeploymentPlan) {
    this.startTime = Date.now();
    this.emit('start', {
      totalActions: plan.actions.length,
      plan
    });
  }
  
  startStage(index: number, actions: PlannedAction[]) {
    this.currentStage = index;
    this.stageProgress.set(index, {
      startTime: Date.now(),
      totalActions: actions.length,
      completedActions: 0,
      status: 'running'
    });
    
    this.emit('stage:start', {
      stage: index,
      actions: actions.length
    });
  }
  
  updateAction(action: PlannedAction, status: 'running' | 'complete' | 'failed') {
    const stage = this.stageProgress.get(this.currentStage);
    if (!stage) return;
    
    if (status === 'complete') {
      stage.completedActions++;
    }
    
    this.emit('action:update', {
      stage: this.currentStage,
      action,
      status,
      progress: (stage.completedActions / stage.totalActions) * 100
    });
  }
  
  completeStage(index: number) {
    const stage = this.stageProgress.get(index);
    if (!stage) return;
    
    stage.status = 'complete';
    stage.duration = Date.now() - stage.startTime;
    
    this.emit('stage:complete', {
      stage: index,
      duration: stage.duration
    });
  }
  
  complete() {
    const duration = Date.now() - this.startTime;
    
    this.emit('complete', {
      duration,
      stages: Array.from(this.stageProgress.values())
    });
  }
  
  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

// Usage in MCP tool
const engine = new ExecutionEngine(client, stateStore, {
  rollbackOnFailure: true,
  parallelism: 5,
  continueOnError: false
});

// Subscribe to progress events
engine.progress.on('action:update', (event) => {
  console.log(`Action ${event.action.resource.name}: ${event.status}`);
});

engine.progress.on('stage:complete', (event) => {
  console.log(`Stage ${event.stage} completed in ${event.duration}ms`);
});
```

### 4. Dependency Resolution
```typescript
// src/execution/dependencies.ts
export class DependencyResolver {
  groupIntoStages(actions: PlannedAction[]): PlannedAction[][] {
    const stages: PlannedAction[][] = [];
    const completed = new Set<string>();
    const remaining = [...actions];
    
    while (remaining.length > 0) {
      const stage: PlannedAction[] = [];
      
      // Find actions with satisfied dependencies
      for (let i = remaining.length - 1; i >= 0; i--) {
        const action = remaining[i];
        const deps = action.resource.dependencies || [];
        
        if (deps.every(dep => completed.has(dep))) {
          stage.push(action);
          remaining.splice(i, 1);
        }
      }
      
      if (stage.length === 0 && remaining.length > 0) {
        throw new Error('Circular dependency detected');
      }
      
      // Mark stage resources as completed
      stage.forEach(action => {
        completed.add(action.resource.id);
      });
      
      stages.push(stage);
    }
    
    return stages;
  }
}
```

### 5. Checkpoint & Recovery
```typescript
// src/execution/checkpoint.ts
export class CheckpointManager {
  constructor(private stateStore: StatePersistence) {}
  
  async createCheckpoint(
    deploymentId: string,
    description: string
  ): Promise<Checkpoint> {
    const state = await this.stateStore.loadDeploymentState(deploymentId);
    
    if (!state) {
      throw new Error('No deployment state found');
    }
    
    const checkpoint: Checkpoint = {
      id: generateId(),
      deploymentId,
      timestamp: new Date().toISOString(),
      description,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      resources: new Map(state.resources)
    };
    
    await this.stateStore.saveCheckpoint(checkpoint);
    
    return checkpoint;
  }
  
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await this.stateStore.loadCheckpoint(checkpointId);
    
    if (!checkpoint) {
      throw new Error('Checkpoint not found');
    }
    
    // Create a plan to restore to checkpoint state
    const currentState = await this.stateReader.getCurrentState();
    const desiredState = checkpoint.state;
    
    const plan = await this.planner.plan(
      Array.from(desiredState.resources.values()),
      { preserveUnknown: false }
    );
    
    // Execute the restoration plan
    const result = await this.engine.execute(plan);
    
    if (!result.success) {
      throw new Error('Failed to restore checkpoint');
    }
  }
}
```

### 6. MCP Tool Implementation
```typescript
case 'applyDeployment':
  if (!args) throw new Error('Arguments required');
  
  // Load the plan
  const plan = await this.statePersistence.loadPlan(args.planId);
  if (!plan) {
    throw new Error('Plan not found');
  }
  
  // Create execution engine
  const engine = new ExecutionEngine(
    this.client,
    this.statePersistence,
    {
      rollbackOnFailure: args.rollbackOnFailure ?? true,
      parallelism: args.parallelism ?? 5,
      continueOnError: args.continueOnError ?? false
    }
  );
  
  // Track progress
  const progressUpdates: any[] = [];
  engine.progress.on('action:update', (update) => {
    progressUpdates.push(update);
    // Could send real-time updates via WebSocket
  });
  
  // Execute the plan
  const result = await engine.execute(plan);
  
  // Format result
  const output = [
    `Deployment ${result.success ? 'succeeded' : 'failed'}`,
    `Duration: ${result.duration}ms`,
    '',
    'Results:'
  ];
  
  for (const actionResult of result.results) {
    const status = actionResult.success ? '✓' : '✗';
    output.push(
      `${status} ${actionResult.action.type} ${actionResult.action.resource.name}`
    );
    
    if (!actionResult.success) {
      output.push(`  Error: ${actionResult.error.message}`);
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: output.join('\n')
    }]
  };

case 'createCheckpoint':
  if (!args) throw new Error('Arguments required');
  
  const checkpoint = await this.checkpointManager.createCheckpoint(
    args.deploymentId,
    args.description
  );
  
  return {
    content: [{
      type: 'text',
      text: `Checkpoint created: ${checkpoint.id}\n${checkpoint.description}`
    }]
  };
```

## Testing Strategy

### Unit Tests
```typescript
describe('ExecutionEngine', () => {
  it('should execute actions in dependency order', async () => {
    const plan = {
      actions: [
        { resource: { id: 'rule-1', dependencies: ['alias-1'] }},
        { resource: { id: 'alias-1', dependencies: [] }}
      ]
    };
    
    const executionOrder: string[] = [];
    engine.on('action:start', (action) => {
      executionOrder.push(action.resource.id);
    });
    
    await engine.execute(plan);
    
    expect(executionOrder).toEqual(['alias-1', 'rule-1']);
  });
  
  it('should rollback on failure', async () => {
    const plan = {
      actions: [
        { type: 'create', resource: mockResource1 },
        { type: 'create', resource: mockResource2 } // This will fail
      ]
    };
    
    mockClient.create
      .mockResolvedValueOnce({ uuid: '123' })
      .mockRejectedValueOnce(new Error('API Error'));
    
    const result = await engine.execute(plan);
    
    expect(result.success).toBe(false);
    expect(mockClient.delete).toHaveBeenCalledWith('123');
  });
});
```

### Integration Tests
```typescript
describe('Full deployment cycle', () => {
  it('should deploy, checkpoint, and rollback', async () => {
    // Deploy initial state
    const deployment1 = await deployResources([
      firewallRule('allow-ssh', { port: 22 }),
      firewallRule('allow-http', { port: 80 })
    ]);
    
    // Create checkpoint
    const checkpoint = await createCheckpoint(deployment1.id, 'Before changes');
    
    // Make changes
    await deployResources([
      firewallRule('allow-ssh', { port: 2222 }), // Changed
      firewallRule('allow-https', { port: 443 }) // New
      // allow-http removed
    ]);
    
    // Rollback to checkpoint
    await restoreCheckpoint(checkpoint.id);
    
    // Verify original state restored
    const rules = await getFirewallRules();
    expect(rules).toHaveLength(2);
    expect(rules[0].port).toBe(22);
  });
});
```

## Success Criteria

1. ✅ Executes plans respecting dependencies
2. ✅ Handles parallel execution within stages
3. ✅ Provides real-time progress updates
4. ✅ Rolls back on failure
5. ✅ Creates and restores checkpoints
6. ✅ Handles partial failures gracefully

## Next Phase Preview
Phase 4 will add:
- Cross-MCP server coordination
- Advanced deployment patterns
- Policy enforcement
- Compliance validation
