# Developer Onboarding Guide - OPNSense MCP Server

## 🎯 Welcome to the Team!

This guide will get you productive with the OPNSense MCP Server codebase in under 30 minutes.

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js v18+ installed (`node --version`)
- [ ] npm or yarn installed (`npm --version`)
- [ ] Git configured (`git config --list`)
- [ ] VS Code or preferred IDE
- [ ] Access to an OPNsense instance (or test environment)
- [ ] Basic TypeScript knowledge
- [ ] Understanding of async/await patterns

## 🚀 Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/yourorg/opnsense-mcp-server.git
cd opnsense-mcp-server

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Configure your OPNsense connection
nano .env
# Set:
# OPNSENSE_HOST=https://192.168.1.1
# OPNSENSE_API_KEY=your-key
# OPNSENSE_API_SECRET=your-secret

# 5. Build the project
npm run build

# 6. Run in development mode
npm run dev

# 7. Test the connection
npm run test:connection
```

## 🏗️ Architecture Overview

### Core Concepts

```
┌─────────────┐     ┌──────────┐     ┌────────────┐
│ MCP Client  │────▶│   Tools  │────▶│  Resources │
└─────────────┘     └──────────┘     └────────────┘
                           │                 │
                           ▼                 ▼
                    ┌──────────┐     ┌────────────┐
                    │   Cache  │     │ API Client │
                    └──────────┘     └────────────┘
                                            │
                                            ▼
                                     ┌────────────┐
                                     │  OPNsense  │
                                     └────────────┘
```

### Key Components

1. **Tools** (`src/tools/`): MCP tool implementations that clients call
2. **Resources** (`src/resources/`): Domain objects for CRUD operations
3. **API Client** (`src/api/client.ts`): Handles OPNsense API communication
4. **Cache** (`src/cache/`): Performance optimization layer
5. **State** (`src/state/`): Persistent state management for IaC

## 📁 Project Structure

```
src/
├── api/                 # API client and authentication
├── cache/              # Caching implementations
│   ├── manager.ts      # Basic cache
│   └── enhanced-manager.ts # Advanced with compression
├── resources/          # Domain resources
│   ├── network/        # VLANs, interfaces, ARP
│   ├── firewall/       # Rules, aliases
│   ├── services/       # DHCP, DNS, HAProxy
│   └── base.ts         # Base resource classes
├── tools/              # MCP tool definitions
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── index.ts           # Main entry point
```

## 🔨 Development Workflow

### 1. Creating a New Resource

```typescript
// src/resources/services/new-service.ts
import { BaseResource } from '../base';
import { z } from 'zod';

// Define the schema
const NewServiceSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  port: z.number().min(1).max(65535)
});

export class NewServiceResource extends BaseResource {
  async list(): Promise<NewService[]> {
    return await this.client.get('/api/services/newservice/list');
  }
  
  async create(data: z.infer<typeof NewServiceSchema>): Promise<{uuid: string}> {
    const validated = NewServiceSchema.parse(data);
    return await this.client.post('/api/services/newservice/add', validated);
  }
}
```

### 2. Adding a New Tool

```typescript
// src/tools/new-service.ts
import { z } from 'zod';

// Define input schema
const CreateNewServiceSchema = z.object({
  name: z.string().describe('Service name'),
  port: z.number().describe('Service port')
});

// Register the tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'opnsense_newservice_create') {
    const args = CreateNewServiceSchema.parse(request.params.arguments);
    
    const resource = new NewServiceResource(this.client);
    const result = await resource.create(args);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  }
});
```

### 3. Testing Your Changes

```typescript
// test/unit/resources/new-service.test.ts
import { describe, it, expect, jest } from '@jest/globals';
import { NewServiceResource } from '../../../src/resources/services/new-service';

describe('NewServiceResource', () => {
  it('should create a service', async () => {
    const mockClient = {
      post: jest.fn().mockResolvedValue({ uuid: 'test-123' })
    };
    
    const resource = new NewServiceResource(mockClient);
    const result = await resource.create({
      name: 'test',
      enabled: true,
      port: 8080
    });
    
    expect(result.uuid).toBe('test-123');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/api/services/newservice/add',
      expect.objectContaining({ name: 'test' })
    );
  });
});
```

## 🐛 Debugging Tips

### Enable Debug Logging

```bash
# Set environment variables
export DEBUG=opnsense:*
export LOG_LEVEL=debug

# Run with verbose output
npm run dev -- --verbose
```

### Use VS Code Debugger

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug MCP Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "DEBUG": "opnsense:*",
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### Common Debugging Scenarios

```typescript
// Add debug points in your code
console.log('[DEBUG] API Request:', { endpoint, payload });

// Use the debugger statement
debugger; // Execution will pause here when debugging

// Conditional debugging
if (process.env.DEBUG) {
  console.log('Detailed info:', detailedObject);
}

// Performance debugging
console.time('api-call');
const result = await apiClient.call();
console.timeEnd('api-call');
```

## 📚 Code Style Guide

### TypeScript Best Practices

```typescript
// ✅ DO: Use explicit types
interface VlanConfig {
  tag: number;
  interface: string;
  description?: string;
}

// ❌ DON'T: Use any
let config: any = { tag: 100 };

// ✅ DO: Use async/await
async function createVlan(config: VlanConfig) {
  try {
    const result = await client.createVlan(config);
    return result;
  } catch (error) {
    handleError(error);
  }
}

// ❌ DON'T: Use callbacks or .then()
function createVlan(config, callback) {
  client.createVlan(config).then(callback);
}
```

### Error Handling

```typescript
// ✅ DO: Throw typed errors
class VlanNotFoundError extends Error {
  constructor(public readonly tag: number) {
    super(`VLAN ${tag} not found`);
    this.name = 'VlanNotFoundError';
  }
}

// ✅ DO: Handle specific errors
try {
  await vlanResource.delete(tag);
} catch (error) {
  if (error instanceof VlanNotFoundError) {
    console.log('VLAN already deleted');
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

### Validation

```typescript
// ✅ DO: Validate inputs with Zod
const schema = z.object({
  port: z.number().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp'])
});

const validated = schema.parse(input); // Throws if invalid

// ✅ DO: Use safeParse for user input
const result = schema.safeParse(userInput);
if (!result.success) {
  return { error: result.error.errors };
}
```

## 🧪 Testing Guidelines

### Test Structure

```typescript
describe('Component/Feature', () => {
  describe('methodName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = setupTestData();
      
      // Act
      const result = performAction(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });
    
    it('should handle error case', () => {
      // Test error scenarios
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- new-service.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Debug tests
npm run test:debug
```

## 🔄 Git Workflow

### Branch Naming

```bash
feature/add-dns-management
bugfix/vlan-validation-error
hotfix/api-connection-timeout
refactor/consolidate-cache-managers
docs/update-api-examples
```

### Commit Messages

```bash
# Format: <type>(<scope>): <subject>

feat(vlan): add support for QoS priority
fix(firewall): correct rule ordering issue
docs(api): update examples for new endpoints
refactor(cache): consolidate manager implementations
test(resources): add unit tests for DHCP resource
```

### Pull Request Process

1. Create feature branch
2. Make changes with tests
3. Run linting: `npm run lint`
4. Run tests: `npm test`
5. Commit with conventional message
6. Push and create PR
7. Address review comments
8. Merge after approval

## 🚢 Deployment

### Local Development

```bash
npm run dev          # Development with hot reload
npm run build        # Build for production
npm start           # Run production build
```

### Docker

```bash
# Build image
docker build -t opnsense-mcp .

# Run container
docker run -d \
  -e OPNSENSE_HOST=$OPNSENSE_HOST \
  -e OPNSENSE_API_KEY=$OPNSENSE_API_KEY \
  -e OPNSENSE_API_SECRET=$OPNSENSE_API_SECRET \
  -p 3000:3000 \
  opnsense-mcp
```

### Production

```bash
# Using PM2
pm2 start ecosystem.config.js
pm2 logs opnsense-mcp
pm2 monit

# Health check
curl http://localhost:3000/health
```

## 📖 Learning Resources

### Internal Documentation
- [Architecture Overview](./ARCHITECTURE.md)
- [API Examples](./API-EXAMPLES.md)
- [Security Guide](./SECURITY-AUDIT.md)
- [Performance Guide](./PERFORMANCE-ANALYSIS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

### External Resources
- [MCP SDK Documentation](https://modelcontextprotocol.io)
- [OPNsense API Docs](https://docs.opnsense.org/development/api.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Zod Documentation](https://zod.dev)

### Code Examples

Check the `examples/` directory for:
- Basic CRUD operations
- Batch processing
- Error handling patterns
- Testing examples
- Performance optimization

## 🤝 Getting Help

### Team Contacts
- **Tech Lead**: @techlead (Slack)
- **DevOps**: @devops-team (Slack)
- **Code Reviews**: #code-reviews (Slack)

### Resources
- **Wiki**: [Internal Wiki](https://wiki.company.com/opnsense-mcp)
- **Issues**: [GitHub Issues](https://github.com/yourorg/opnsense-mcp/issues)
- **CI/CD**: [Jenkins Dashboard](https://jenkins.company.com/opnsense-mcp)

### Office Hours
- **Monday**: 2-3 PM - Architecture discussions
- **Wednesday**: 10-11 AM - Code review session
- **Friday**: 3-4 PM - Open Q&A

## 🎉 Your First Tasks

As a new developer, here are good first issues to tackle:

1. **Add input validation** to an existing tool
2. **Write unit tests** for a resource class
3. **Fix a documentation** issue
4. **Implement a simple tool** (like listing operations)
5. **Improve error messages** in a specific module

Look for issues tagged with `good-first-issue` in GitHub.

## 📈 Performance Tips

1. **Always use the cache** for read operations
2. **Batch API calls** when possible
3. **Use compression** for large payloads (already implemented)
4. **Profile before optimizing** - don't guess
5. **Monitor memory usage** in production

## 🔐 Security Reminders

1. **Never log sensitive data** (API keys, passwords)
2. **Validate all inputs** with Zod schemas
3. **Use encryption** for state storage (implemented)
4. **Follow OWASP guidelines** for web security
5. **Regular dependency updates** with `npm audit`

---

*Welcome aboard! We're excited to have you contributing to the OPNSense MCP Server. Don't hesitate to ask questions - we're here to help you succeed!*