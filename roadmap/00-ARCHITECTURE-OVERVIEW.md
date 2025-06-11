# MCP-Based Infrastructure as Code Platform Architecture

## Vision
Create an AI-native Infrastructure as Code (IaC) platform that uses MCP servers as building blocks, similar to how Pulumi uses providers or SST uses constructs.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Orchestration Layer                    │
│              (Claude/GPT with MCP Client)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol
        ┌─────────────┴─────────────┬──────────────┬──────────┐
        ▼                           ▼              ▼          ▼
┌───────────────┐         ┌───────────────┐  ┌───────────┐  ┌───────────┐
│  OPNSense     │         │   AWS         │  │  Docker   │  │ Kubernetes│
│  MCP Server   │         │  MCP Server   │  │ MCP Server│  │ MCP Server│
└───────────────┘         └───────────────┘  └───────────┘  └───────────┘
        │                         │                │              │
        ▼                         ▼                ▼              ▼
   OPNSense API              AWS SDK          Docker API      K8s API
```

## MCP Server Standards

### 1. State Management Pattern
Every MCP server should implement these standard tools:

```typescript
interface IaCMCPServer {
  // State Management
  planDeployment(config: ResourceConfig): Plan;
  applyDeployment(plan: Plan): DeploymentResult;
  destroyDeployment(deploymentId: string): DestroyResult;
  getDeploymentState(deploymentId: string): State;
  
  // Resource Discovery
  listResources(filter?: Filter): Resource[];
  getResource(id: string): Resource;
  
  // Validation
  validateConfig(config: ResourceConfig): ValidationResult;
  
  // Rollback
  createSnapshot(deploymentId: string): Snapshot;
  rollbackToSnapshot(snapshotId: string): RollbackResult;
}
```

### 2. Standard Response Format
All MCP servers should return consistent responses:

```typescript
interface MCPResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    duration: number;
    server: string;
    version: string;
  };
}
```

### 3. Resource Definition Standard
Like Pulumi's Resource model:

```typescript
interface Resource {
  id: string;
  type: string;          // e.g., "opnsense:firewall:rule"
  name: string;
  properties: Record<string, any>;
  dependencies: string[]; // IDs of resources this depends on
  outputs: Record<string, any>;
  state: 'pending' | 'creating' | 'created' | 'updating' | 'deleting' | 'deleted';
}
```

## OPNSense MCP Server Design

### Resource Types
```typescript
const OPNSenseResourceTypes = {
  // Network
  'opnsense:network:vlan': VlanResource,
  'opnsense:network:interface': InterfaceResource,
  
  // Firewall
  'opnsense:firewall:rule': FirewallRuleResource,
  'opnsense:firewall:alias': AliasResource,
  'opnsense:firewall:nat': NatRuleResource,
  
  // Services
  'opnsense:service:haproxy:backend': HaproxyBackendResource,
  'opnsense:service:haproxy:server': HaproxyServerResource,
  'opnsense:service:haproxy:frontend': HaproxyFrontendResource,
  'opnsense:service:dns:override': DnsOverrideResource,
  'opnsense:service:dhcp:range': DhcpRangeResource,
  'opnsense:service:dhcp:static': DhcpStaticResource,
  
  // Security
  'opnsense:security:certificate': CertificateResource,
  'opnsense:security:user': UserResource,
};
```

### Deployment Tools
```typescript
// Instead of individual CRUD operations, use deployment-focused tools:

tools: [
  {
    name: 'planNetworkDeployment',
    description: 'Plan network infrastructure changes',
    inputSchema: {
      type: 'object',
      properties: {
        resources: {
          type: 'array',
          items: { $ref: '#/definitions/Resource' }
        },
        options: {
          type: 'object',
          properties: {
            dryRun: { type: 'boolean' },
            validateOnly: { type: 'boolean' }
          }
        }
      }
    }
  },
  {
    name: 'applyNetworkDeployment',
    description: 'Apply planned network changes',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            parallelism: { type: 'number', default: 5 },
            continueOnError: { type: 'boolean', default: false }
          }
        }
      }
    }
  }
]
```

## Integration with Other MCP Servers

### Example: Full Stack Deployment

```typescript
// AI receives: "Deploy a web application with load balancing and database"

const deployment = {
  name: "customer-portal",
  resources: [
    // OPNSense Resources
    {
      type: "opnsense:network:vlan",
      name: "app-network",
      properties: { tag: 150, interface: "igc2" }
    },
    {
      type: "opnsense:firewall:rule",
      name: "allow-https",
      properties: { 
        source: "any", 
        destination: "${haproxy.ip}",
        port: 443,
        action: "pass"
      }
    },
    {
      type: "opnsense:service:haproxy:backend",
      name: "app-backend",
      properties: {
        servers: ["${aws:ec2:app-1.ip}", "${aws:ec2:app-2.ip}"]
      }
    },
    
    // AWS Resources (different MCP server)
    {
      type: "aws:ec2:instance",
      name: "app-1",
      properties: {
        instanceType: "t3.medium",
        ami: "ami-12345",
        subnet: "${aws:vpc:subnet.id}"
      }
    },
    {
      type: "aws:rds:instance",
      name: "app-db",
      properties: {
        engine: "postgres",
        instanceClass: "db.t3.micro"
      }
    },
    
    // Docker Resources (different MCP server)
    {
      type: "docker:image:build",
      name: "app-image",
      properties: {
        dockerfile: "./Dockerfile",
        context: "./app"
      }
    }
  ]
};

// The AI orchestrator coordinates across MCP servers
const plan = await orchestrator.plan(deployment);
const result = await orchestrator.apply(plan);
```

## State Management

### Distributed State
Each MCP server maintains its own state, but the orchestrator maintains relationships:

```typescript
interface DeploymentState {
  id: string;
  name: string;
  version: number;
  resources: {
    [resourceId: string]: {
      server: string;        // Which MCP server owns this
      type: string;
      state: ResourceState;
      outputs: Record<string, any>;
    }
  };
  dependencies: DependencyGraph;
  checkpoints: Checkpoint[];
}
```

### Cross-Server Dependencies
Handle dependencies between resources on different MCP servers:

```typescript
class DependencyResolver {
  async resolveDependencies(resources: Resource[]): Promise<ExecutionPlan> {
    const graph = this.buildDependencyGraph(resources);
    const stages = this.topologicalSort(graph);
    
    return {
      stages: stages.map(stage => ({
        resources: stage,
        canParallelize: true,
        servers: this.groupByServer(stage)
      }))
    };
  }
}
```

## Error Handling & Rollback

### Transaction-like Deployments
```typescript
class DeploymentTransaction {
  private rollbackStack: RollbackAction[] = [];
  
  async execute(plan: ExecutionPlan) {
    for (const stage of plan.stages) {
      try {
        const results = await this.executeStage(stage);
        this.rollbackStack.push(...results.rollbackActions);
      } catch (error) {
        await this.rollback();
        throw error;
      }
    }
  }
  
  private async rollback() {
    for (const action of this.rollbackStack.reverse()) {
      await action.execute();
    }
  }
}
```

## Configuration Language

### Option 1: YAML-based (like Kubernetes)
```yaml
apiVersion: iac.mcp/v1
kind: Deployment
metadata:
  name: customer-portal
spec:
  resources:
    - type: opnsense:network:vlan
      name: app-network
      properties:
        tag: 150
        interface: igc2
```

### Option 2: TypeScript-based (like Pulumi)
```typescript
import { Deployment } from '@mcp/iac';
import * as opnsense from '@mcp/opnsense';
import * as aws from '@mcp/aws';

const deployment = new Deployment('customer-portal', {
  network: new opnsense.Vlan('app-network', {
    tag: 150,
    interface: 'igc2'
  }),
  
  servers: [1, 2].map(i => 
    new aws.EC2Instance(`app-${i}`, {
      instanceType: 't3.medium',
      subnet: network.subnet
    })
  ),
  
  loadBalancer: new opnsense.HaproxyBackend('app-lb', {
    servers: servers.map(s => s.privateIp)
  })
});
```

## Implementation Phases

### Phase 1: Standardize OPNSense MCP
1. Implement resource model
2. Add deployment planning
3. Add state management
4. Add rollback capability

### Phase 2: Create Orchestrator
1. Build dependency resolver
2. Implement cross-server coordination
3. Add transaction management
4. Create deployment engine

### Phase 3: Add More MCP Servers
1. AWS MCP Server
2. Docker MCP Server
3. Kubernetes MCP Server
4. Database MCP Servers

### Phase 4: High-Level Abstractions
1. Application templates
2. Best practice patterns
3. Security policies
4. Compliance frameworks

## Benefits Over Traditional IaC

1. **AI-Native**: Natural language to infrastructure
2. **Self-Documenting**: AI explains what it's doing
3. **Adaptive**: AI can handle errors intelligently
4. **Cross-Platform**: Single interface for all infrastructure
5. **Learning**: AI improves deployment patterns over time

## Example Commands

```bash
# Natural language deployment
"Deploy a highly available web app with database backup and DDoS protection"

# The AI understands and orchestrates:
- OPNSense: Network isolation, firewall rules, DDoS protection
- AWS: EC2 instances, RDS with backup
- Docker: Container deployment
- Monitoring: Prometheus/Grafana setup
```

This is the future of infrastructure management! 🚀
