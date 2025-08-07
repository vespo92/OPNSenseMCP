# Phase 4: Multi-MCP Integration & Advanced Patterns

## Goal
Enable the OPNSense MCP server to work seamlessly with other MCP servers (AWS, Docker, Kubernetes) to create a unified IaC platform.

## Timeline: Week 7-8

## Prerequisites
- Phases 1-3 completed
- OPNSense MCP fully functional
- At least one other MCP server available

## Core Components

### 1. Cross-MCP Resource References
```typescript
// src/integration/references.ts
export class CrossMCPReference {
  constructor(
    public server: string,
    public resourceType: string,
    public resourceId: string,
    public outputProperty: string
  ) {}
  
  toString(): string {
    return `\${${this.server}:${this.resourceType}:${this.resourceId}.${this.outputProperty}}`;
  }
  
  static parse(reference: string): CrossMCPReference | null {
    const match = reference.match(/\$\{([^:]+):([^:]+):([^.]+)\.([^}]+)\}/);
    if (!match) return null;
    
    return new CrossMCPReference(
      match[1], // server
      match[2], // resourceType  
      match[3], // resourceId
      match[4]  // outputProperty
    );
  }
}

// Example usage in resource properties
const haproxyBackend = {
  type: 'opnsense:service:haproxy:backend',
  name: 'web-backend',
  properties: {
    servers: [
      '${aws:ec2:web-server-1.privateIp}',
      '${aws:ec2:web-server-2.privateIp}'
    ],
    healthCheck: {
      uri: '/health',
      port: '${docker:container:app.exposedPort}'
    }
  }
};
```

### 2. MCP Orchestrator
```typescript
// src/orchestrator/orchestrator.ts
export class MCPOrchestrator {
  private mcpServers: Map<string, MCPServerClient> = new Map();
  private deploymentState: OrchestrationState;
  
  registerServer(name: string, client: MCPServerClient) {
    this.mcpServers.set(name, client);
  }
  
  async deployMultiMCP(
    deployment: MultiMCPDeployment
  ): Promise<OrchestrationResult> {
    // Phase 1: Validate all resources across all servers
    const validation = await this.validateDeployment(deployment);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    
    // Phase 2: Resolve cross-references and build execution plan
    const resolvedDeployment = await this.resolveReferences(deployment);
    const executionPlan = await this.buildExecutionPlan(resolvedDeployment);
    
    // Phase 3: Execute in waves
    const results = await this.executeInWaves(executionPlan);
    
    return {
      success: results.every(r => r.success),
      results,
      state: this.deploymentState
    };
  }
  
  private async resolveReferences(
    deployment: MultiMCPDeployment
  ): Promise<ResolvedDeployment> {
    const resolver = new ReferenceResolver();
    
    // First pass: collect all outputs
    const outputs = new Map<string, any>();
    
    for (const [server, resources] of deployment.serverResources) {
      const serverOutputs = await this.mcpServers
        .get(server)
        ?.getResourceOutputs(resources);
      
      serverOutputs?.forEach((value, key) => {
        outputs.set(`${server}:${key}`, value);
      });
    }
    
    // Second pass: resolve references
    const resolved = JSON.parse(
      JSON.stringify(deployment),
      (key, value) => {
        if (typeof value === 'string') {
          const ref = CrossMCPReference.parse(value);
          if (ref) {
            const outputKey = `${ref.server}:${ref.resourceType}:${ref.resourceId}.${ref.outputProperty}`;
            return outputs.get(outputKey) || value;
          }
        }
        return value;
      }
    );
    
    return resolved;
  }
  
  private async buildExecutionPlan(
    deployment: ResolvedDeployment
  ): Promise<ExecutionWave[]> {
    const waves: ExecutionWave[] = [];
    const completed = new Set<string>();
    
    // Build dependency graph across all servers
    const globalGraph = new DependencyGraph();
    
    for (const [server, resources] of deployment.serverResources) {
      for (const resource of resources) {
        const globalId = `${server}:${resource.id}`;
        globalGraph.addNode(globalId, { server, resource });
        
        // Add dependencies
        for (const dep of resource.dependencies || []) {
          if (dep.includes(':')) {
            // Cross-server dependency
            globalGraph.addEdge(globalId, dep);
          } else {
            // Same-server dependency
            globalGraph.addEdge(globalId, `${server}:${dep}`);
          }
        }
      }
    }
    
    // Create waves based on dependencies
    while (globalGraph.hasNodes()) {
      const wave = globalGraph.getNodesWithoutDependencies();
      if (wave.length === 0) {
        throw new Error('Circular dependency detected across MCP servers');
      }
      
      waves.push({
        resources: wave.map(nodeId => {
          const node = globalGraph.getNode(nodeId);
          return {
            server: node.data.server,
            resource: node.data.resource
          };
        })
      });
      
      // Remove processed nodes
      wave.forEach(nodeId => globalGraph.removeNode(nodeId));
    }
    
    return waves;
  }
}
```

### 3. Deployment Patterns
```typescript
// src/patterns/patterns.ts
export abstract class DeploymentPattern {
  abstract name: string;
  abstract description: string;
  
  abstract generate(params: any): MultiMCPDeployment;
  
  validate(params: any): ValidationResult {
    // Default validation
    return { valid: true };
  }
}

export class LoadBalancedWebAppPattern extends DeploymentPattern {
  name = 'load-balanced-web-app';
  description = 'Deploy a web app with load balancing, SSL, and auto-scaling';
  
  generate(params: {
    appName: string;
    domain: string;
    minInstances: number;
    maxInstances: number;
    vlanTag?: number;
  }): MultiMCPDeployment {
    const vlanTag = params.vlanTag || 100;
    
    return {
      name: params.appName,
      serverResources: new Map([
        // OPNSense resources
        ['opnsense', [
          {
            type: 'opnsense:network:vlan',
            name: `${params.appName}-vlan`,
            properties: {
              tag: vlanTag,
              interface: 'igc2',
              description: `${params.appName} network`
            }
          },
          {
            type: 'opnsense:firewall:alias',
            name: `${params.appName}-servers`,
            properties: {
              type: 'host',
              content: '${aws:asg:' + params.appName + '-asg.instanceIps}'
            }
          },
          {
            type: 'opnsense:firewall:rule',
            name: `${params.appName}-allow-https`,
            properties: {
              interface: 'wan',
              source: 'any',
              destination: '${opnsense:service:haproxy:frontend:' + params.appName + '-frontend.bindAddress}',
              destinationPort: '443',
              protocol: 'tcp',
              action: 'pass'
            }
          },
          {
            type: 'opnsense:service:haproxy:backend',
            name: `${params.appName}-backend`,
            properties: {
              mode: 'http',
              balance: 'leastconn',
              httpCheck: {
                uri: '/health',
                version: 'HTTP/1.1'
              }
            }
          },
          {
            type: 'opnsense:service:haproxy:frontend',
            name: `${params.appName}-frontend`,
            properties: {
              bind: '0.0.0.0:443',
              mode: 'http',
              defaultBackend: `${params.appName}-backend`,
              sslCertificate: '${aws:acm:certificate:' + params.appName + '-cert.arn}'
            }
          }
        ]],
        
        // AWS resources
        ['aws', [
          {
            type: 'aws:acm:certificate',
            name: `${params.appName}-cert`,
            properties: {
              domainName: params.domain,
              validationMethod: 'DNS'
            }
          },
          {
            type: 'aws:ec2:launchTemplate',
            name: `${params.appName}-template`,
            properties: {
              imageId: 'ami-12345678',
              instanceType: 't3.micro',
              userData: Buffer.from(`#!/bin/bash
                docker run -p 8080:8080 ${params.appName}:latest
              `).toString('base64')
            }
          },
          {
            type: 'aws:autoscaling:group',
            name: `${params.appName}-asg`,
            properties: {
              minSize: params.minInstances,
              maxSize: params.maxInstances,
              launchTemplate: '${aws:ec2:launchTemplate:' + params.appName + '-template.id}',
              targetGroupArns: ['${aws:elb:targetGroup:' + params.appName + '-tg.arn}']
            }
          }
        ]],
        
        // Docker resources
        ['docker', [
          {
            type: 'docker:image:build',
            name: `${params.appName}-image`,
            properties: {
              context: './app',
              dockerfile: 'Dockerfile',
              tags: [`${params.appName}:latest`]
            }
          },
          {
            type: 'docker:registry:push',
            name: `${params.appName}-push`,
            properties: {
              image: '${docker:image:build:' + params.appName + '-image.id}',
              registry: 'ecr.amazonaws.com/mycompany'
            },
            dependencies: [`${params.appName}-image`]
          }
        ]]
      ])
    };
  }
}

// Pattern registry
export class PatternRegistry {
  private patterns = new Map<string, DeploymentPattern>();
  
  register(pattern: DeploymentPattern) {
    this.patterns.set(pattern.name, pattern);
  }
  
  get(name: string): DeploymentPattern | undefined {
    return this.patterns.get(name);
  }
  
  list(): PatternInfo[] {
    return Array.from(this.patterns.values()).map(p => ({
      name: p.name,
      description: p.description
    }));
  }
}
```

### 4. Policy Engine
```typescript
// src/policies/engine.ts
export class PolicyEngine {
  private policies: Policy[] = [];
  
  addPolicy(policy: Policy) {
    this.policies.push(policy);
  }
  
  async evaluate(
    deployment: MultiMCPDeployment
  ): Promise<PolicyEvaluationResult> {
    const violations: PolicyViolation[] = [];
    
    for (const policy of this.policies) {
      const result = await policy.evaluate(deployment);
      if (!result.compliant) {
        violations.push(...result.violations);
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations,
      policies: this.policies.length
    };
  }
}

// Example policies
export class SecurityGroupPolicy implements Policy {
  name = 'security-group-restrictions';
  
  async evaluate(deployment: MultiMCPDeployment): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    
    // Check all firewall rules
    const firewallRules = deployment.serverResources
      .get('opnsense')
      ?.filter(r => r.type === 'opnsense:firewall:rule') || [];
    
    for (const rule of firewallRules) {
      // No wide-open rules
      if (rule.properties.source === 'any' && 
          rule.properties.destination === 'any') {
        violations.push({
          resource: rule.name,
          policy: this.name,
          severity: 'high',
          message: 'Firewall rule allows any-to-any traffic'
        });
      }
      
      // No SSH from internet
      if (rule.properties.source === 'any' && 
          rule.properties.destinationPort === '22') {
        violations.push({
          resource: rule.name,
          policy: this.name,
          severity: 'critical',
          message: 'SSH exposed to internet'
        });
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations
    };
  }
}

export class ResourceTaggingPolicy implements Policy {
  name = 'required-tags';
  requiredTags = ['Environment', 'Owner', 'CostCenter'];
  
  async evaluate(deployment: MultiMCPDeployment): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];
    
    for (const [server, resources] of deployment.serverResources) {
      for (const resource of resources) {
        const tags = resource.properties.tags || {};
        
        for (const required of this.requiredTags) {
          if (!tags[required]) {
            violations.push({
              resource: `${server}:${resource.name}`,
              policy: this.name,
              severity: 'medium',
              message: `Missing required tag: ${required}`
            });
          }
        }
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations
    };
  }
}
```

### 5. MCP Communication Protocol
```typescript
// src/protocol/protocol.ts
export interface MCPDeploymentProtocol {
  // Planning phase
  planDeployment(resources: Resource[]): Promise<DeploymentPlan>;
  validatePlan(plan: DeploymentPlan): Promise<ValidationResult>;
  
  // Execution phase
  beginDeployment(deploymentId: string): Promise<void>;
  applyResources(resources: Resource[]): Promise<ApplyResult[]>;
  commitDeployment(deploymentId: string): Promise<void>;
  rollbackDeployment(deploymentId: string): Promise<void>;
  
  // State management
  getResourceOutputs(resourceIds: string[]): Promise<Map<string, any>>;
  getDeploymentState(deploymentId: string): Promise<DeploymentState>;
  
  // Health & monitoring
  healthCheck(): Promise<HealthStatus>;
  getMetrics(): Promise<Metrics>;
}

// Standard implementation for all MCP servers
export abstract class MCPServerBase implements MCPDeploymentProtocol {
  protected deployments = new Map<string, DeploymentContext>();
  
  async beginDeployment(deploymentId: string): Promise<void> {
    this.deployments.set(deploymentId, {
      id: deploymentId,
      startTime: Date.now(),
      resources: new Map(),
      status: 'in-progress'
    });
  }
  
  async commitDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');
    
    deployment.status = 'committed';
    await this.saveState(deployment);
  }
  
  async rollbackDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) throw new Error('Deployment not found');
    
    // Rollback all resources in reverse order
    const resources = Array.from(deployment.resources.values()).reverse();
    for (const resource of resources) {
      await this.rollbackResource(resource);
    }
    
    deployment.status = 'rolled-back';
  }
  
  abstract planDeployment(resources: Resource[]): Promise<DeploymentPlan>;
  abstract applyResources(resources: Resource[]): Promise<ApplyResult[]>;
  abstract rollbackResource(resource: Resource): Promise<void>;
  abstract saveState(deployment: DeploymentContext): Promise<void>;
}
```

### 6. Integration Tests
```typescript
describe('Multi-MCP Deployment', () => {
  let orchestrator: MCPOrchestrator;
  let opnsenseMCP: MockMCPServer;
  let awsMCP: MockMCPServer;
  let dockerMCP: MockMCPServer;
  
  beforeEach(() => {
    orchestrator = new MCPOrchestrator();
    
    opnsenseMCP = new MockMCPServer('opnsense');
    awsMCP = new MockMCPServer('aws');
    dockerMCP = new MockMCPServer('docker');
    
    orchestrator.registerServer('opnsense', opnsenseMCP);
    orchestrator.registerServer('aws', awsMCP);
    orchestrator.registerServer('docker', dockerMCP);
  });
  
  it('should deploy web app pattern', async () => {
    const pattern = new LoadBalancedWebAppPattern();
    const deployment = pattern.generate({
      appName: 'test-app',
      domain: 'test.example.com',
      minInstances: 2,
      maxInstances: 10
    });
    
    const result = await orchestrator.deployMultiMCP(deployment);
    
    expect(result.success).toBe(true);
    
    // Verify order of operations
    const opnsenseOps = opnsenseMCP.getOperations();
    const awsOps = awsMCP.getOperations();
    
    // VLAN should be created before firewall rules
    const vlanOp = opnsenseOps.find(op => op.resource.type === 'opnsense:network:vlan');
    const ruleOp = opnsenseOps.find(op => op.resource.type === 'opnsense:firewall:rule');
    expect(vlanOp.timestamp).toBeLessThan(ruleOp.timestamp);
    
    // Certificate should be created before HAProxy frontend
    const certOp = awsOps.find(op => op.resource.type === 'aws:acm:certificate');
    const frontendOp = opnsenseOps.find(op => 
      op.resource.type === 'opnsense:service:haproxy:frontend'
    );
    expect(certOp.timestamp).toBeLessThan(frontendOp.timestamp);
  });
  
  it('should handle cross-MCP references', async () => {
    const deployment = {
      serverResources: new Map([
        ['aws', [{
          type: 'aws:ec2:instance',
          name: 'web-server',
          properties: {
            instanceType: 't3.micro'
          },
          outputs: {
            privateIp: '10.0.1.100' // Simulated output
          }
        }]],
        ['opnsense', [{
          type: 'opnsense:firewall:rule',
          name: 'allow-web',
          properties: {
            destination: '${aws:ec2:web-server.privateIp}',
            action: 'pass'
          }
        }]]
      ])
    };
    
    const result = await orchestrator.deployMultiMCP(deployment);
    
    // Check that reference was resolved
    const rule = opnsenseMCP.getResource('allow-web');
    expect(rule.properties.destination).toBe('10.0.1.100');
  });
  
  it('should enforce policies', async () => {
    const policyEngine = new PolicyEngine();
    policyEngine.addPolicy(new SecurityGroupPolicy());
    
    const deployment = {
      serverResources: new Map([
        ['opnsense', [{
          type: 'opnsense:firewall:rule',
          name: 'bad-rule',
          properties: {
            source: 'any',
            destination: 'any',
            action: 'pass'
          }
        }]]
      ])
    };
    
    const evaluation = await policyEngine.evaluate(deployment);
    
    expect(evaluation.compliant).toBe(false);
    expect(evaluation.violations).toHaveLength(1);
    expect(evaluation.violations[0].message).toContain('any-to-any traffic');
  });
});
```

## Success Criteria

1. ✅ Can deploy resources across multiple MCP servers
2. ✅ Handles cross-server dependencies correctly
3. ✅ Resolves references between servers
4. ✅ Supports deployment patterns
5. ✅ Enforces policies across all resources
6. ✅ Provides unified deployment experience

## Benefits Achieved

1. **Unified IaC Platform**: Single interface for all infrastructure
2. **AI-Native**: Natural language to complex deployments
3. **Pattern-Based**: Reusable deployment patterns
4. **Policy-Driven**: Automatic compliance enforcement
5. **Cross-Platform**: Works with any MCP-compatible service

## Future Enhancements

1. **Visual Deployment Designer**: Drag-and-drop interface
2. **Cost Estimation**: Predict deployment costs
3. **Performance Optimization**: Intelligent resource placement
4. **Disaster Recovery**: Automated backup and restore
5. **GitOps Integration**: Version control for deployments
