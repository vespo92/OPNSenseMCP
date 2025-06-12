# Manual Fix for Remaining 8 Errors

If the automated scripts aren't working, here are the exact manual fixes needed:

## 1. Fix HAProxy validateEnum calls (4 errors)

### In `src/resources/services/haproxy/backend.ts`:

**Line 135** - Change:
```typescript
errors.push(ValidationHelper.validateEnum(
  'mode',
  this.properties.mode,
  ['http', 'tcp']
));
```

To:
```typescript
errors.push(ValidationHelper.validateEnum(
  this.properties.mode,
  ['http', 'tcp'],
  'mode'
));
```

**Line 149** - Change:
```typescript
errors.push(ValidationHelper.validateEnum(
  'balance',
  this.properties.balance,
  validBalanceMethods
));
```

To:
```typescript
errors.push(ValidationHelper.validateEnum(
  this.properties.balance,
  validBalanceMethods,
  'balance'
));
```

### In `src/resources/services/haproxy/frontend.ts`:

**Line 74** - Make the same change for 'mode'

### In `src/resources/services/haproxy/server.ts`:

**Line 109** - Make the same change for 'mode'

## 2. Fix warnings property name (2 errors)

### In `src/resources/network/interface.ts`:

Find all places where warnings are defined with `property:` and change to `path:`. For example:

Change:
```typescript
warnings.push({
  property: 'ipv4.address',
  message: 'Static IP requires subnet mask',
  code: 'MISSING_SUBNET'
});
```

To:
```typescript
warnings.push({
  path: 'ipv4.address',
  message: 'Static IP requires subnet mask',
  code: 'MISSING_SUBNET'
});
```

### In `src/resources/services/haproxy/server.ts`:

Do the same - change all `property:` to `path:` in warning objects

## 3. Fix state store (2 errors)

### In `src/state/store.ts`:

Replace the entire `updateDeploymentState` method (around line 190) with:

```typescript
async updateDeploymentState(name: string, result: any): Promise<void> {
  // Get existing deployment or create new one
  let deployment = await this.getDeployment(name);
  
  if (!deployment) {
    // Create proper deployment structure
    deployment = {
      id: name,
      name: name,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resources: {},
      checkpoints: []
    };
  }
  
  // Update deployment
  deployment.updatedAt = new Date().toISOString();
  deployment.version++;
  
  // Update resources if provided
  if (result.resources) {
    if (Array.isArray(result.resources)) {
      // Convert array to object map
      const resourceMap: Record<string, any> = {};
      result.resources.forEach((res: any) => {
        resourceMap[res.id || res.name] = res;
      });
      deployment.resources = resourceMap;
    } else {
      deployment.resources = result.resources;
    }
  }
  
  await this.saveDeployment(deployment);
}
```

## Quick Summary:

1. **validateEnum**: Change parameter order from `(field, value, options)` to `(value, options, field)`
2. **warnings**: Change `property:` to `path:` in all warning objects
3. **state store**: Replace the updateDeploymentState method with the proper implementation

After making these changes, run `npm run build` and it should succeed!
