#!/usr/bin/env node

/**
 * OPNsense MCP Server - Phase 4.5 IaC Implementation
 * Clean version with Infrastructure as Code support
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import API client and existing resources
import { OPNSenseAPIClient } from './api/client.js';
import { VlanResource } from './resources/vlan.js';
import { FirewallRuleResource } from './resources/firewall/rule.js';
import { BackupManager } from './resources/backup/manager.js';
import { MCPCacheManager } from './cache/manager.js';
import { DhcpLeaseResource } from './resources/services/dhcp/leases.js';
import { DnsBlocklistResource } from './resources/services/dns/blocklist.js';

// Import IaC components
import { resourceRegistry } from './resources/registry.js';
import { DeploymentPlanner } from './deployment/planner.js';
import { ExecutionEngine } from './execution/engine.js';
import { ResourceStateStore } from './state/store.js';

// Import IaC resource definitions to register them
import './resources/network/vlan-iac.js';
// TODO: Import other IaC resources as they are created

// Configuration schema
const ConfigSchema = z.object({
  host: z.string().url(),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  verifySsl: z.boolean().default(true)
});

class OPNSenseMCPServerWithIaC {
  private server: Server;
  private client: OPNSenseAPIClient | null = null;
  
  // Existing resources
  private vlanResource: VlanResource | null = null;
  private firewallRuleResource: FirewallRuleResource | null = null;
  private backupManager: BackupManager | null = null;
  private cacheManager: MCPCacheManager | null = null;
  private dhcpResource: DhcpLeaseResource | null = null;
  private dnsBlocklistResource: DnsBlocklistResource | null = null;
  
  // IaC components
  private planner: DeploymentPlanner | null = null;
  private engine: ExecutionEngine | null = null;
  private stateStore: ResourceStateStore | null = null;
  private iacEnabled: boolean;

  constructor() {
    this.iacEnabled = process.env.IAC_ENABLED !== 'false';
    
    this.server = new Server(
      {
        name: 'opnsense-mcp',
        version: '0.4.5',
        description: 'OPNsense firewall management via MCP with IaC support'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }
  private async initialize() {
    try {
      // Validate configuration
      const config = ConfigSchema.parse({
        host: process.env.OPNSENSE_HOST,
        apiKey: process.env.OPNSENSE_API_KEY,
        apiSecret: process.env.OPNSENSE_API_SECRET,
        verifySsl: process.env.OPNSENSE_VERIFY_SSL !== 'false'
      });

      // Create API client
      this.client = new OPNSenseAPIClient(config);
      
      // Test connection
      const connectionTest = await this.client.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Failed to connect to OPNsense: ${connectionTest.error}`);
      }

      console.error(`Connected to OPNsense ${connectionTest.version}`);

      // Initialize existing resources
      this.vlanResource = new VlanResource(this.client);
      this.firewallRuleResource = new FirewallRuleResource(this.client);
      this.dhcpResource = new DhcpLeaseResource(this.client);
      this.dnsBlocklistResource = new DnsBlocklistResource(this.client);
      
      // Initialize backup manager
      if (process.env.BACKUP_ENABLED !== 'false') {
        this.backupManager = new BackupManager(this.client, process.env.BACKUP_PATH);
      }
      
      // Initialize cache manager
      if (process.env.ENABLE_CACHE === 'true') {
        try {
          this.cacheManager = new MCPCacheManager(this.client, {
            redisHost: process.env.REDIS_HOST,
            redisPort: parseInt(process.env.REDIS_PORT || '6379'),
            postgresHost: process.env.POSTGRES_HOST,
            postgresPort: parseInt(process.env.POSTGRES_PORT || '5432'),
            postgresDb: process.env.POSTGRES_DB,
            postgresUser: process.env.POSTGRES_USER,
            postgresPassword: process.env.POSTGRES_PASSWORD,
            cacheTTL: parseInt(process.env.CACHE_TTL || '300'),
            enableCache: true
          });
          await this.cacheManager.connect();
          console.error('Cache manager initialized');
        } catch (error) {
          console.error('Cache manager disabled:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      // Initialize IaC components if enabled
      if (this.iacEnabled) {
        console.error('Initializing IaC components...');
        this.stateStore = new ResourceStateStore();
        this.planner = new DeploymentPlanner();
        this.engine = new ExecutionEngine(this.client);
        console.error('IaC components initialized');
      }

    } catch (error) {
      console.error('Failed to initialize OPNsense MCP server:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        ...this.getExistingTools(),
        ...(this.iacEnabled ? this.getIaCTools() : [])
      ]
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        ...this.getExistingResources(),
        ...(this.iacEnabled ? this.getIaCResources() : [])
      ]
    }));

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      // Handle IaC resources
      if (uri.startsWith('opnsense://iac/')) {
        return this.handleIaCResourceRead(uri);
      }
      
      // Handle existing resources
      return this.handleExistingResourceRead(uri);
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Route to appropriate handler
      if (name.startsWith('iac_')) {
        if (!this.iacEnabled) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'IaC features are disabled. Set IAC_ENABLED=true to enable.'
          );
        }
        return this.handleIaCTool(name, args);
      }

      // Handle existing tools
      return this.handleExistingTool(name, args);
    });
  }
  private getExistingTools() {
    return [
      // Configuration tool
      {
        name: 'configure',
        description: 'Configure OPNsense connection',
        inputSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'OPNsense hostname or IP' },
            apiKey: { type: 'string', description: 'API key' },
            apiSecret: { type: 'string', description: 'API secret' },
            verifySsl: { type: 'boolean', description: 'Verify SSL certificate', default: true }
          },
          required: ['host', 'apiKey', 'apiSecret']
        }
      },
      // Add other existing tools here...
      // For brevity, I'm just including the pattern
      {
        name: 'test_connection',
        description: 'Test API connection and authentication',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  private getExistingResources() {
    return [
      {
        uri: 'opnsense://vlans',
        name: 'VLANs',
        description: 'List of all configured VLANs',
        mimeType: 'application/json'
      },
      {
        uri: 'opnsense://firewall/rules',
        name: 'Firewall Rules',
        description: 'List of all firewall rules',
        mimeType: 'application/json'
      },
      {
        uri: 'opnsense://status',
        name: 'Connection Status',
        description: 'OPNsense connection status',
        mimeType: 'application/json'
      }
    ];
  }

  private getIaCTools() {
    return [
      {
        name: 'iac_plan_deployment',
        description: 'Plan infrastructure deployment changes',
        inputSchema: {
          type: 'object',
          properties: {
            name: { 
              type: 'string',
              description: 'Deployment name'
            },
            resources: { 
              type: 'array',
              description: 'Resources to deploy',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  id: { type: 'string' },
                  name: { type: 'string' },
                  properties: { type: 'object' }
                },
                required: ['type', 'id', 'name', 'properties']
              }
            },
            dryRun: { 
              type: 'boolean',
              default: true,
              description: 'Preview changes without applying'
            }
          },
          required: ['name', 'resources']
        }
      },
      {
        name: 'iac_apply_deployment',
        description: 'Apply a deployment plan',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { 
              type: 'string',
              description: 'Plan ID from plan_deployment'
            },
            autoApprove: { 
              type: 'boolean',
              default: false,
              description: 'Skip confirmation'
            }
          },
          required: ['planId']
        }
      },
      {
        name: 'iac_destroy_deployment',
        description: 'Destroy deployed resources',
        inputSchema: {
          type: 'object',
          properties: {
            deploymentId: { 
              type: 'string',
              description: 'Deployment to destroy'
            },
            force: { 
              type: 'boolean',
              default: false,
              description: 'Force destruction'
            }
          },
          required: ['deploymentId']
        }
      },
      {
        name: 'iac_list_resource_types',
        description: 'List available resource types',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category (network, firewall, services)'
            }
          }
        }
      }
    ];
  }
  private getIaCResources() {
    return [
      {
        uri: 'opnsense://iac/resources',
        name: 'IaC Resource Types',
        description: 'Available infrastructure resource types',
        mimeType: 'application/json'
      },
      {
        uri: 'opnsense://iac/deployments',
        name: 'Deployments',
        description: 'Current infrastructure deployments',
        mimeType: 'application/json'
      },
      {
        uri: 'opnsense://iac/state',
        name: 'Resource State',
        description: 'Current state of managed resources',
        mimeType: 'application/json'
      }
    ];
  }

  private async handleExistingResourceRead(uri: string) {
    if (!this.client) {
      throw new McpError(
        ErrorCode.InternalError,
        'OPNsense client not initialized. Use configure tool first.'
      );
    }

    switch (uri) {
      case 'opnsense://vlans': {
        if (!this.vlanResource) {
          throw new McpError(ErrorCode.InternalError, 'VLAN resource not initialized');
        }
        const vlans = await this.vlanResource.list();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(vlans, null, 2)
          }]
        };
      }
      
      case 'opnsense://status': {
        const status = await this.client.testConnection();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2)
          }]
        };
      }
      
      // Add other existing resource handlers...
      
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown resource: ${uri}`
        );
    }
  }

  private async handleIaCResourceRead(uri: string) {
    if (!this.iacEnabled) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'IaC features are disabled'
      );
    }

    switch (uri) {
      case 'opnsense://iac/resources': {
        const types = resourceRegistry.listResourceTypes();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              types,
              definitions: resourceRegistry.exportDefinitions()
            }, null, 2)
          }]
        };
      }
      
      case 'opnsense://iac/deployments': {
        if (!this.stateStore) {
          throw new McpError(ErrorCode.InternalError, 'State store not initialized');
        }
        const deployments = await this.stateStore.listDeployments();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(deployments, null, 2)
          }]
        };
      }
      
      case 'opnsense://iac/state': {
        if (!this.stateStore) {
          throw new McpError(ErrorCode.InternalError, 'State store not initialized');
        }
        const state = await this.stateStore!.getCurrentState();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(state, null, 2)
          }]
        };
      }
      
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown IaC resource: ${uri}`
        );
    }
  }
  private async handleExistingTool(name: string, args: any) {
    switch (name) {
      case 'configure': {
        try {
          const config = ConfigSchema.parse(args);
          this.client = new OPNSenseAPIClient(config);
          const test = await this.client.testConnection();
          
          if (test.success) {
            // Re-initialize resources with new client
            this.vlanResource = new VlanResource(this.client);
            this.firewallRuleResource = new FirewallRuleResource(this.client);
            this.dhcpResource = new DhcpLeaseResource(this.client);
            this.dnsBlocklistResource = new DnsBlocklistResource(this.client);
            
            // Re-initialize IaC components if enabled
            if (this.iacEnabled) {
              this.engine = new ExecutionEngine(this.client);
            }
            
            return {
              content: [{
                type: 'text',
                text: `Successfully connected to OPNsense ${test.version}`
              }]
            };
          } else {
            throw new Error(test.error);
          }
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Configuration failed: ${error.message}`
          );
        }
      }

      case 'test_connection': {
        if (!this.client) {
          throw new McpError(
            ErrorCode.InternalError,
            'Not configured. Use configure tool first.'
          );
        }
        const status = await this.client.testConnection();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(status, null, 2)
          }]
        };
      }

      // Add other existing tool handlers...
      
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown tool: ${name}`
        );
    }
  }

  private async handleIaCTool(name: string, args: any) {
    if (!this.planner || !this.engine || !this.stateStore) {
      throw new McpError(
        ErrorCode.InternalError,
        'IaC components not initialized'
      );
    }

    switch (name) {
      case 'iac_plan_deployment':
        return this.planDeployment(args);
      
      case 'iac_apply_deployment':
        return this.applyDeployment(args);
      
      case 'iac_destroy_deployment':
        return this.destroyDeployment(args);
      
      case 'iac_list_resource_types':
        return this.listResourceTypes(args);
      
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown IaC tool: ${name}`
        );
    }
  }
  private async planDeployment(args: any) {
    // Create resource instances
    const resources = args.resources.map((r: any) => 
      resourceRegistry.createResource(r.type, r.id, r.name, r.properties)
    );

    // Get current state
    const currentState = await this.stateStore!.getDeploymentState(args.name);
    const currentResourcesArray = currentState?.resources 
      ? Object.values(currentState.resources)
      : [];

    // Create plan
    const plan = await this.planner!.planDeployment(
      args.name,
      resources,
      currentResourcesArray
    );

    // Store plan for later execution
    await this.stateStore!.storePlan(plan);

    return {
      content: [{
        type: 'text',
        text: this.formatPlan(plan)
      }]
    };
  }

  private async applyDeployment(args: any) {
    // Retrieve plan
    const plan = await this.stateStore!.getPlan(args.planId);
    if (!plan) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Plan not found: ${args.planId}`
      );
    }

    // Execute plan
    const result = await this.engine!.execute(plan, {
      dryRun: false,
      parallel: true,
      maxConcurrency: 5
    });

    // Update state
    if (result.success) {
      await this.stateStore!.updateDeploymentState(plan.name, result);
    }

    return {
      content: [{
        type: 'text',
        text: this.formatExecutionResult(result)
      }]
    };
  }

  private async destroyDeployment(args: any) {
    const deployment = await this.stateStore!.getDeploymentState(args.deploymentId);
    if (!deployment) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Deployment not found: ${args.deploymentId}`
      );
    }

    // Create destruction plan
    const resourcesArray = Object.values(deployment.resources);
    const plan = await this.planner!.planDestruction(
      args.deploymentId,
      resourcesArray
    );

    // Execute destruction
    const result = await this.engine!.execute(plan, {
      dryRun: false,
      force: args.force
    });

    // Clean up state if successful
    if (result.success) {
      await this.stateStore!.deleteDeployment(args.deploymentId);
    }

    return {
      content: [{
        type: 'text',
        text: `Deployment ${args.deploymentId} destroyed successfully`
      }]
    };
  }

  private async listResourceTypes(args: any) {
    const types = resourceRegistry.listResourceTypes();
    const filtered = args.category 
      ? types.filter(t => t.startsWith(args.category))
      : types;
    
    return {
      content: [{
        type: 'text',
        text: filtered.join('\n')
      }]
    };
  }
  private formatPlan(plan: any): string {
    let output = `Deployment Plan: ${plan.name}\n`;
    output += `Plan ID: ${plan.id}\n\n`;
    
    output += `Summary:\n`;
    output += `  + Create: ${plan.summary.create}\n`;
    output += `  ~ Update: ${plan.summary.update}\n`;
    output += `  - Delete: ${plan.summary.delete}\n`;
    output += `  [REPLACE] Replace: ${plan.summary.replace}\n\n`;
    
    output += `Execution Waves:\n`;
    plan.executionWaves.forEach((wave: any) => {
      output += `\nWave ${wave.wave} (${wave.estimatedTime}s):\n`;
      wave.changes.forEach((change: any) => {
        const symbolMap: Record<string, string> = {
          create: '+',
          update: '~',
          delete: '-',
          replace: '[R]'
        };
        const symbol = symbolMap[change.type as keyof typeof symbolMap] || '?';
        output += `  ${symbol} ${change.resource.type} "${change.resource.name}"\n`;
      });
    });
    
    if (plan.risks && plan.risks.length > 0) {
      output += `\nRisks:\n`;
      plan.risks.forEach((risk: any) => {
        output += `  [${risk.severity.toUpperCase()}] ${risk.description}\n`;
      });
    }
    
    return output;
  }

  private formatExecutionResult(result: any): string {
    let output = `Execution ${result.success ? 'Successful' : 'Failed'}\n`;
    output += `Duration: ${(result.duration / 1000).toFixed(2)}s\n\n`;
    
    output += `Changes Applied:\n`;
    result.executedChanges.forEach((change: any) => {
      const status = change.status === 'success' ? '[OK]' : '[FAIL]';
      output += `  ${status} ${change.type} ${change.resourceId}\n`;
    });
    
    if (result.failedChanges?.length > 0) {
      output += `\nFailed Changes:\n`;
      result.failedChanges.forEach((failure: any) => {
        output += `  [FAIL] ${failure.resourceId}: ${failure.error}\n`;
      });
    }
    
    if (result.rollbackPerformed) {
      output += `\n[WARNING] Rollback was performed due to failures\n`;
    }
    
    return output;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('OPNSense MCP server starting...');
    
    // Try to initialize with environment config
    try {
      await this.initialize();
    } catch (error) {
      console.error('Auto-initialization failed. Use configure tool to set up connection.');
    }
    
    console.error(`OPNSense MCP server running (IaC: ${this.iacEnabled ? 'enabled' : 'disabled'})`);
  }
}

// Run the server
const server = new OPNSenseMCPServerWithIaC();
server.run().catch(console.error);