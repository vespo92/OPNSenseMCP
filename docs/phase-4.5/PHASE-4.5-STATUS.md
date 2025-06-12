# Phase 4.5 Current Status & Action Plan

## What We've Accomplished ✅
1. Created clean `index-iac.ts` with IaC support
2. Set up proper directory structure
3. Created placeholder implementations:
   - `src/deployment/planner.ts` 
   - `src/execution/engine.ts`
   - `src/state/store.ts`
4. Created legacy compatibility layer
5. Fixed major structural issues

## Current Build Errors Summary

### 1. Missing Type Exports (High Priority)
- [ ] Export DeploymentPlan, ExecutionWave, ResourceChange from planner.ts
- [ ] Fix type imports in execution/engine.ts

### 2. State Store Missing Methods (High Priority)
- [ ] Add getDeploymentState()
- [ ] Add storePlan() 
- [ ] Add getPlan()
- [ ] Add updateDeploymentState()
- [ ] Add deleteDeployment()
- [ ] Fix getCurrentState() implementation

### 3. Legacy Resource Issues (Medium Priority)
- [ ] All legacy resources need to implement:
  - `type` property
  - `schema` property
  - `toAPIPayload()` method
  - `fromAPIResponse()` method
  - `getRequiredPermissions()` method
- [ ] Fix constructor calls (3 args instead of 4)
- [ ] Add validateEnum to ValidationHelper
- [ ] Fix ResourceState.Updated reference

### 4. Minor Issues (Low Priority)
- [ ] Remove 'warnings' from ValidationResult returns
- [ ] Fix getSummary() method calls
- [ ] Add proper types to reduce functions

## Recommended Next Steps

### Step 1: Fix Critical Type Issues
```bash
# 1. Add missing exports to planner.ts
# 2. Fix state store methods
# 3. Run build to verify progress
npm run build
```

### Step 2: Create Stub Implementations
For each legacy resource, add minimal implementations:
```typescript
readonly type = 'opnsense:network:vlan';
readonly schema = z.object({ /* ... */ });
toAPIPayload() { return this.properties; }
fromAPIResponse(response: any) { /* ... */ }
getRequiredPermissions() { return ['interfaces']; }
```

### Step 3: Test Basic Functionality
```bash
# Test that the server starts
npm run dev

# In another terminal, test MCP connection
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | node dist/index-iac.js
```

## File Modification Priority

1. **src/deployment/planner.ts** - Add type exports
2. **src/state/store.ts** - Implement missing methods
3. **src/resources/legacy/base.ts** - Add validateEnum
4. **One test resource** (e.g., vlan.ts) - Implement abstract methods

## Quick Wins

1. The build errors have decreased from 400+ to ~65
2. Core IaC structure is in place
3. Legacy compatibility allows gradual migration
4. Clean separation between old and new code

## Risk Areas

1. State store has mixed implementations (needs consolidation)
2. Legacy resources need significant updates
3. Some circular dependency risks

## Success Metrics for Today

- [ ] Build completes without errors
- [ ] Server starts successfully  
- [ ] At least one IaC tool responds to MCP calls
- [ ] Basic deployment plan can be created

## Commands to Run

```bash
# After fixes
npm run build

# Test the server
npm run dev

# Run systematic tests
npx tsx tests/integration/test-iac-components.ts
```

Remember: The goal is to get a working foundation, not perfection. Focus on making the build pass, then iterate!