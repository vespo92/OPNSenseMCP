# Test Structure Plan - OPNSense MCP Server

## 🎯 Testing Strategy Overview

### Testing Philosophy
- **Test Pyramid**: Many unit tests, fewer integration tests, minimal E2E tests
- **Coverage Target**: 80% minimum, 95% for critical paths
- **Test Types**: Unit, Integration, E2E, Performance, Security
- **Automation**: All tests run in CI/CD pipeline

## 📁 Test Directory Structure

```
test/
├── unit/                      # Unit tests (isolated components)
│   ├── api/                   # API client tests
│   │   ├── client.test.ts
│   │   └── auth.test.ts
│   ├── resources/             # Resource tests
│   │   ├── vlan.test.ts
│   │   ├── firewall.test.ts
│   │   └── haproxy.test.ts
│   ├── tools/                 # MCP tool tests
│   │   ├── vlan-tool.test.ts
│   │   └── backup-tool.test.ts
│   ├── cache/                 # Cache tests
│   │   └── manager.test.ts
│   └── utils/                 # Utility tests
│       ├── retry.test.ts
│       └── validation.test.ts
├── integration/               # Integration tests
│   ├── api-integration.test.ts
│   ├── db-integration.test.ts
│   └── mcp-integration.test.ts
├── e2e/                       # End-to-end tests
│   ├── vlan-workflow.test.ts
│   └── firewall-workflow.test.ts
├── performance/               # Performance tests
│   ├── cache-perf.test.ts
│   └── api-perf.test.ts
├── fixtures/                  # Test data
│   ├── api-responses/
│   ├── configs/
│   └── mocks/
├── helpers/                   # Test utilities
│   ├── setup.ts
│   ├── teardown.ts
│   └── factories.ts
└── config/                    # Test configuration
    ├── jest.config.js
    └── test-env.ts
```

## 🧪 Test Implementation Templates

### 1. Unit Test Template
```typescript
// test/unit/resources/vlan.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { VlanResource } from '../../../src/resources/vlan';
import { OPNSenseAPIClient } from '../../../src/api/client';

describe('VlanResource', () => {
  let vlanResource: VlanResource;
  let mockClient: jest.Mocked<OPNSenseAPIClient>;
  
  beforeEach(() => {
    mockClient = createMockAPIClient();
    vlanResource = new VlanResource(mockClient);
  });
  
  describe('create', () => {
    it('should create a new VLAN', async () => {
      // Arrange
      const config = {
        if: 'igc1',
        tag: '100',
        descr: 'Test VLAN'
      };
      mockClient.addVlan.mockResolvedValue({ uuid: 'test-uuid' });
      mockClient.applyVlanChanges.mockResolvedValue(true);
      
      // Act
      const result = await vlanResource.create(config);
      
      // Assert
      expect(result).toEqual({
        uuid: 'test-uuid',
        success: true
      });
      expect(mockClient.addVlan).toHaveBeenCalledWith(config);
      expect(mockClient.applyVlanChanges).toHaveBeenCalled();
    });
    
    it('should throw error if VLAN tag already exists', async () => {
      // Arrange
      const existing = { uuid: 'existing', tag: '100' };
      mockClient.searchVlans.mockResolvedValue({ rows: [existing] });
      
      // Act & Assert
      await expect(
        vlanResource.create({ if: 'igc1', tag: '100' })
      ).rejects.toThrow('VLAN 100 already exists');
    });
  });
});
```

### 2. Integration Test Template
```typescript
// test/integration/api-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { OPNSenseAPIClient } from '../../src/api/client';
import { TestServer } from '../helpers/test-server';

describe('API Integration', () => {
  let client: OPNSenseAPIClient;
  let testServer: TestServer;
  
  beforeAll(async () => {
    testServer = await TestServer.start();
    client = new OPNSenseAPIClient({
      host: 'localhost',
      port: testServer.port,
      apiKey: 'test-key',
      apiSecret: 'test-secret'
    });
  });
  
  afterAll(async () => {
    await testServer.stop();
  });
  
  describe('VLAN Operations', () => {
    it('should complete VLAN lifecycle', async () => {
      // Create
      const createResult = await client.addVlan({
        if: 'igc1',
        tag: '100'
      });
      expect(createResult.uuid).toBeDefined();
      
      // Read
      const vlan = await client.getVlan(createResult.uuid);
      expect(vlan.tag).toBe('100');
      
      // Update
      await client.setVlan(createResult.uuid, {
        descr: 'Updated description'
      });
      
      // Delete
      await client.delVlan(createResult.uuid);
      
      // Verify deletion
      const vlans = await client.searchVlans();
      expect(vlans.rows).not.toContainEqual(
        expect.objectContaining({ uuid: createResult.uuid })
      );
    });
  });
});
```

### 3. E2E Test Template
```typescript
// test/e2e/vlan-workflow.test.ts
import { describe, it, expect } from '@jest/globals';
import { MCPClient } from '../helpers/mcp-client';

describe('VLAN E2E Workflow', () => {
  let mcp: MCPClient;
  
  beforeAll(async () => {
    mcp = await MCPClient.connect();
  });
  
  it('should manage VLANs through MCP tools', async () => {
    // List existing VLANs
    const initialList = await mcp.callTool('opnsense_vlan_list');
    const initialCount = initialList.vlans.length;
    
    // Create new VLAN
    const createResult = await mcp.callTool('opnsense_vlan_create', {
      interface: 'igc1',
      tag: 100,
      description: 'E2E Test VLAN'
    });
    expect(createResult.success).toBe(true);
    
    // Verify creation
    const afterCreate = await mcp.callTool('opnsense_vlan_list');
    expect(afterCreate.vlans).toHaveLength(initialCount + 1);
    
    // Update VLAN
    const updateResult = await mcp.callTool('opnsense_vlan_update', {
      uuid: createResult.uuid,
      description: 'Updated E2E Test'
    });
    expect(updateResult.success).toBe(true);
    
    // Delete VLAN
    const deleteResult = await mcp.callTool('opnsense_vlan_delete', {
      uuid: createResult.uuid
    });
    expect(deleteResult.success).toBe(true);
    
    // Verify deletion
    const afterDelete = await mcp.callTool('opnsense_vlan_list');
    expect(afterDelete.vlans).toHaveLength(initialCount);
  });
});
```

## 🔧 Test Utilities

### 1. Mock Factories
```typescript
// test/helpers/factories.ts
export function createMockAPIClient(): jest.Mocked<OPNSenseAPIClient> {
  return {
    searchVlans: jest.fn(),
    addVlan: jest.fn(),
    getVlan: jest.fn(),
    setVlan: jest.fn(),
    delVlan: jest.fn(),
    applyVlanChanges: jest.fn(),
    // ... other methods
  } as any;
}

export function createVlanFixture(overrides = {}): VlanConfig {
  return {
    uuid: 'test-uuid',
    if: 'igc1',
    tag: '100',
    descr: 'Test VLAN',
    pcp: '0',
    ...overrides
  };
}
```

### 2. Test Server
```typescript
// test/helpers/test-server.ts
import express from 'express';
import { Server } from 'http';

export class TestServer {
  private app: express.Application;
  private server: Server;
  public port: number;
  
  static async start(): Promise<TestServer> {
    const server = new TestServer();
    await server.initialize();
    return server;
  }
  
  private async initialize() {
    this.app = express();
    this.setupRoutes();
    
    return new Promise<void>((resolve) => {
      this.server = this.app.listen(0, () => {
        this.port = (this.server.address() as any).port;
        resolve();
      });
    });
  }
  
  private setupRoutes() {
    // Mock OPNsense API endpoints
    this.app.get('/api/interfaces/vlan/searchItem', (req, res) => {
      res.json({ rows: [] });
    });
    
    this.app.post('/api/interfaces/vlan/addItem', (req, res) => {
      res.json({ uuid: 'mock-uuid' });
    });
    
    // ... other endpoints
  }
  
  async stop() {
    return new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
```

## 📊 Test Coverage Configuration

### Jest Configuration
```javascript
// test/config/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/examples/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/api/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/test/helpers/setup.ts'],
  globalTeardown: '<rootDir>/test/helpers/teardown.ts'
};
```

## 🚀 Test Scripts

### package.json Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest test/unit",
    "test:integration": "jest test/integration",
    "test:e2e": "jest test/e2e",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:debug": "node --inspect-brk ./node_modules/.bin/jest --runInBand"
  }
}
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## 📋 Implementation Checklist

### Phase 1: Setup (Week 1)
- [ ] Create test directory structure
- [ ] Install testing dependencies (Jest, ts-jest)
- [ ] Configure Jest
- [ ] Create test helpers and factories
- [ ] Set up test database

### Phase 2: Unit Tests (Week 2)
- [ ] Write API client tests
- [ ] Write resource tests
- [ ] Write MCP tool tests
- [ ] Write utility tests
- [ ] Achieve 80% unit test coverage

### Phase 3: Integration Tests (Week 3)
- [ ] Create test server mock
- [ ] Write API integration tests
- [ ] Write database integration tests
- [ ] Write MCP integration tests
- [ ] Test error scenarios

### Phase 4: E2E Tests (Week 4)
- [ ] Set up E2E test environment
- [ ] Write critical path E2E tests
- [ ] Write workflow tests
- [ ] Performance tests
- [ ] Security tests

## 🎯 Success Metrics

1. **Coverage**: 80% overall, 90% for critical paths
2. **Test Speed**: Unit tests < 5s, Integration < 30s, E2E < 2min
3. **Reliability**: Zero flaky tests
4. **Maintainability**: Tests as documentation
5. **CI/CD**: All tests run on every commit

## 📚 Testing Best Practices

### DO's
- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Keep tests isolated and independent
- ✅ Use factories for test data
- ✅ Test edge cases and error paths
- ✅ Mock external dependencies

### DON'Ts
- ❌ Test private methods directly
- ❌ Share state between tests
- ❌ Use real network calls in unit tests
- ❌ Ignore failing tests
- ❌ Write tests after bugs (write them to prevent bugs)

---

*This test plan provides a comprehensive strategy for achieving high-quality, maintainable test coverage.*