# Manual Fix Guide for Phase 4.5 Build Errors

If the automated fix scripts aren't working, here are the manual fixes needed:

## 1. Fix `src/resources/base.ts`

Add `warnings` to the `ValidationResult` interface:

```typescript
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  warnings?: Array<{    // ADD THIS
    path: string;
    message: string;
  }>;
}
```

## 2. Fix `src/resources/legacy/base.ts`

### Change the constructor to accept 4 parameters:

```typescript
constructor(id: string, name: string, properties: any, dependencies: string[] = []) {
  super(id, name, properties);
  this.properties = properties;
  this.dependencies = dependencies;  // ADD THIS
}
```

### Add dependencies property:

```typescript
protected dependencies: string[] = [];  // ADD THIS after state property
```

### Add getSummary method before abstract methods:

```typescript
// Get resource summary
getSummary(): any {
  return {
    id: this.id,
    name: this.name,
    type: this.type,
    state: this.state,
    properties: this.properties,
    outputs: this.outputs
  };
}

// Convert to API payload (compatibility)
toApiPayload(): any {
  return this.toAPIPayload();
}

// Update from API response (compatibility)
fromApiResponse(response: any): void {
  this.fromAPIResponse(response);
}
```

## 3. Fix `src/state/store.ts`

### Add missing import:

```typescript
import path from 'path';  // ADD THIS after other imports
```

### Add plans property to class:

```typescript
private plans: Map<string, any> = new Map();  // ADD THIS after options property
```

### Add these methods before the last closing brace:

```typescript
/**
 * Get state file path for a deployment
 */
private getStateFilePath(deploymentId: string): string {
  return join(this.options.directory, `${deploymentId}.json`);
}

/**
 * Get current state of all deployments
 */
async getCurrentState(): Promise<Record<string, DeploymentState>> {
  const result: Record<string, DeploymentState> = {};
  for (const [id, deployment] of this.state) {
    result[id] = deployment;
  }
  return result;
}

/**
 * Get or create a deployment
 */
private async getOrCreateDeployment(deploymentId: string): Promise<DeploymentState> {
  let deployment = await this.loadDeployment(deploymentId);
  if (!deployment) {
    deployment = await this.createDeployment(deploymentId, deploymentId);
  }
  return deployment;
}

/**
 * Get deployment by name
 */
async getDeployment(name: string): Promise<DeploymentState | null> {
  // First check in-memory cache
  for (const [id, deployment] of this.state) {
    if (deployment.name === name) {
      return deployment;
    }
  }
  
  // Try to load from disk
  try {
    const files = await fs.readdir(this.options.directory);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const deployment = await this.loadDeployment(file.replace('.json', ''));
        if (deployment && deployment.name === name) {
          return deployment;
        }
      }
    }
  } catch (error) {
    // Directory might not exist yet
  }
  
  return null;
}
```

### Fix the updateResourceState method:

Replace this:
```typescript
deployment.resources[resource.id] = {
  id: resource.id,
  type: resource.type,
  name: resource.name,
  state: resource.state,
  properties: resource.properties,
  outputs: resource.outputs,
  metadata: resource.metadata,
  dependencies: resource.dependencies
};
```

With this:
```typescript
const resourceState = resource.toState();
deployment.resources[resource.id] = {
  id: resource.id,
  type: resource.type,
  name: resource.name,
  state: resourceState,
  properties: resource.getProperties(),
  outputs: resource.getOutputs(),
  metadata: resourceState.metadata,
  dependencies: resource.getDependencies().map(d => d.resourceId)
};
```

### Change all `fs.promises.` to just `fs.`:

```typescript
await fs.unlink(filePath);  // not fs.promises.unlink
```

## 4. Fix `src/resources/network/vlan.ts`

### Add import at the top:

```typescript
import { z } from 'zod';
```

### Add these properties after the class declaration:

```typescript
export class Vlan extends Resource {
  // Required abstract implementations
  readonly type = 'opnsense:network:vlan';
  
  readonly schema = z.object({
    tag: z.number().min(1).max(4094),
    device: z.string(),
    description: z.string().optional(),
    pcp: z.string().optional()
  });

  constructor(...) {
    // existing constructor
  }
```

### Add these methods before the last closing brace:

```typescript
/**
 * Convert to API payload
 */
toAPIPayload(): any {
  return this.toApiPayload();
}

/**
 * Update from API response
 */
fromAPIResponse(response: any): void {
  this.fromApiResponse(response);
}

/**
 * Get required permissions
 */
getRequiredPermissions(): string[] {
  return ['interfaces.vlan.manage'];
}
```

## 5. Fix all other resource files similarly

For each resource file in:
- `src/resources/network/interface.ts`
- `src/resources/services/dhcp/range.ts`
- `src/resources/services/dhcp/static.ts`
- `src/resources/services/dns/override.ts`
- `src/resources/services/haproxy/backend.ts`
- `src/resources/services/haproxy/frontend.ts`
- `src/resources/services/haproxy/server.ts`

Apply the same pattern:
1. Add `import { z } from 'zod';`
2. Add `readonly type = 'opnsense:...'`
3. Add `readonly schema = z.object({...})`
4. Add the three methods: `toAPIPayload()`, `fromAPIResponse()`, `getRequiredPermissions()`

## 6. Fix HAProxy validateEnum calls

In HAProxy files, change:
```typescript
ValidationHelper.validateEnum('mode', this.properties.mode, ['http', 'tcp'])
```

To:
```typescript
ValidationHelper.validateEnum(this.properties.mode, ['http', 'tcp'], 'mode')
```

## 7. Fix index-iac files

In both `src/index-iac.ts` and `src/index-iac-clean.ts`, change:

```typescript
const state = await this.stateStore.getCurrentState();
```

To:
```typescript
const state = await this.stateStore!.getCurrentState();
```

## After Making Manual Fixes

Run:
```bash
npm run build
```

If there are still errors, check the error messages and apply similar patterns to fix them.
