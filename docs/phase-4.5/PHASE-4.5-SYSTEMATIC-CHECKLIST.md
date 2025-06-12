# Phase 4.5 Systematic Completion Checklist

## Overview
This checklist provides a systematic approach to completing Phase 4.5 - adding Infrastructure as Code (IaC) capabilities to the OPNSense MCP server.

## Pre-requisites ✅
- [x] Phase 3 completed (basic MCP functionality working)
- [x] Node.js and TypeScript environment set up
- [x] OPNSense API access configured
- [ ] Test environment available for IaC testing

## 1. Project Structure Setup

### 1.1 Create IaC Directory Structure
- [ ] Create `src/resources/base.ts` (IaC base classes)
- [ ] Create `src/resources/legacy/base.ts` (compatibility layer)
- [ ] Create `src/resources/registry.ts` (resource registry)
- [ ] Create `src/deployment/` directory
- [ ] Create `src/execution/` directory
- [ ] Create `src/state/` directory
- [ ] Create `src/integration/` directory (for future multi-MCP)
- [ ] Create `src/policies/` directory (for future policy engine)

### 1.2 Update Configuration Files
- [ ] Update `package.json` with new dependencies:
  ```json
  "dependencies": {
    "zod": "^3.25.62"
  },
  "devDependencies": {
    "rimraf": "^6.0.1",
    "jest": "^30.0.0",
    "@types/jest": "^29.5.14"
  }
  ```
- [ ] Update `.env.example` with IaC settings:
  ```
  # IaC Configuration
  IAC_ENABLED=true
  STATE_STORE_PATH=./state
  DEPLOYMENT_HISTORY=./deployments
  ```
- [ ] Update `tsconfig.json` if needed

## 2. Core IaC Components Implementation

### 2.1 Base Resource Classes
- [ ] Implement `IaCResource` abstract class
- [ ] Implement `ResourceState` enum
- [ ] Implement `ValidationResult` interface
- [ ] Implement `ResourceDependency` interface
- [ ] Create unit tests for base classes

### 2.2 Resource Registry
- [ ] Implement `ResourceRegistry` class
- [ ] Add resource type registration
- [ ] Add resource factory methods
- [ ] Add resource type discovery
- [ ] Create unit tests

### 2.3 Deployment Planner
- [ ] Implement `DeploymentPlanner` class
- [ ] Add dependency resolution
- [ ] Add change detection logic
- [ ] Add execution wave planning
- [ ] Add risk assessment
- [ ] Create unit tests

### 2.4 Execution Engine
- [ ] Implement `ExecutionEngine` class
- [ ] Add parallel execution support
- [ ] Add rollback capabilities
- [ ] Add progress tracking
- [ ] Add error handling
- [ ] Create unit tests

### 2.5 State Store
- [ ] Implement `ResourceStateStore` class
- [ ] Add state persistence (file-based initially)
- [ ] Add state comparison methods
- [ ] Add deployment history tracking
- [ ] Add state locking mechanism
- [ ] Create unit tests

## 3. Resource Migration

### 3.1 Create IaC Resource Implementations
- [ ] Migrate VLAN resource to IaC pattern
  - [ ] Create `src/resources/network/vlan-iac.ts`
  - [ ] Register with resource registry
  - [ ] Add validation logic
  - [ ] Add dependency handling
- [ ] Migrate Firewall Rule resource
- [ ] Migrate Interface resource
- [ ] Migrate DHCP resources
- [ ] Migrate DNS resources
- [ ] Migrate HAProxy resources

### 3.2 Maintain Backward Compatibility
- [ ] Ensure legacy resource files still work
- [ ] Create migration guide for resources
- [ ] Document breaking changes (if any)

## 4. MCP Server Integration

### 4.1 Update Main Server File
- [ ] Replace `src/index-iac.ts` with clean version
- [ ] Add IaC tool definitions
- [ ] Add IaC resource definitions
- [ ] Add tool handlers for IaC operations
- [ ] Add resource handlers for IaC state

### 4.2 Add IaC Tools
- [ ] `iac_plan_deployment` - Plan resource changes
- [ ] `iac_apply_deployment` - Apply planned changes
- [ ] `iac_destroy_deployment` - Destroy resources
- [ ] `iac_list_resource_types` - List available types
- [ ] `iac_validate_resources` - Validate configurations
- [ ] `iac_import_existing` - Import existing resources

### 4.3 Add IaC Resources
- [ ] `opnsense://iac/resources` - Available resource types
- [ ] `opnsense://iac/deployments` - Current deployments
- [ ] `opnsense://iac/state` - Current resource state
- [ ] `opnsense://iac/history` - Deployment history

## 5. Testing

### 5.1 Unit Tests
- [ ] Test base resource classes
- [ ] Test resource registry
- [ ] Test deployment planner
- [ ] Test execution engine
- [ ] Test state store
- [ ] Test individual IaC resources

### 5.2 Integration Tests
- [ ] Test end-to-end deployment flow
- [ ] Test rollback scenarios
- [ ] Test parallel execution
- [ ] Test state persistence
- [ ] Test error handling

### 5.3 Manual Testing
- [ ] Test VLAN deployment via MCP
- [ ] Test firewall rule deployment
- [ ] Test multi-resource deployment
- [ ] Test deployment destruction
- [ ] Test state import/export

## 6. Documentation

### 6.1 API Documentation
- [ ] Document IaC tool schemas
- [ ] Document resource schemas
- [ ] Document state format
- [ ] Create API examples

### 6.2 User Documentation
- [ ] Create IaC quick start guide
- [ ] Create resource authoring guide
- [ ] Create deployment examples
- [ ] Create troubleshooting guide

### 6.3 Developer Documentation
- [ ] Document IaC architecture
- [ ] Document extension points
- [ ] Document resource lifecycle
- [ ] Create contribution guide

## 7. Build and Deployment

### 7.1 Fix Build Issues
- [ ] Resolve all TypeScript errors
- [ ] Ensure clean compilation
- [ ] Update build scripts if needed
- [ ] Test production build

### 7.2 Package and Release
- [ ] Update version to 0.4.5
- [ ] Update CHANGELOG
- [ ] Create release notes
- [ ] Tag release in git

## 8. Future Preparation

### 8.1 Multi-MCP Integration Points
- [ ] Design cross-MCP communication protocol
- [ ] Create integration interfaces
- [ ] Document integration patterns

### 8.2 Policy Engine Foundation
- [ ] Design policy schema
- [ ] Create policy interfaces
- [ ] Document policy patterns

## Completion Criteria

The phase is complete when:
1. ✅ All IaC components are implemented and tested
2. ✅ At least 3 resource types support IaC pattern
3. ✅ End-to-end deployment workflow functions correctly
4. ✅ State management works reliably
5. ✅ All tests pass
6. ✅ Documentation is complete
7. ✅ Build succeeds without errors
8. ✅ Backward compatibility is maintained

## Next Steps (Phase 5)

After completing Phase 4.5:
1. Implement remaining resource types
2. Add advanced features (drift detection, etc.)
3. Integrate with other MCP servers
4. Build policy engine
5. Create web UI for deployment visualization