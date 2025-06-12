// Example: Using Enhanced Cache Manager in MCP Tools
import { OPNSenseAPIClient } from '../api/client.js';
import { EnhancedCacheManager } from '../cache/enhanced-manager.js';
import { z } from 'zod';

// Example schemas for type safety
const FirewallRuleSchema = z.object({
  uuid: z.string(),
  enabled: z.string(),
  sequence: z.string(),
  action: z.enum(['pass', 'block', 'reject']),
  interface: z.string(),
  direction: z.enum(['in', 'out']),
  protocol: z.string(),
  source: z.object({
    network: z.string(),
    port: z.string().optional(),
  }),
  destination: z.object({
    network: z.string(),
    port: z.string().optional(),
  }),
  description: z.string(),
});

const VlanSchema = z.object({
  vlan: z.string(),
  if: z.string(),
  tag: z.string(),
  pcp: z.string().optional(),
  descr: z.string().optional(),
});

export class CachedOPNSenseTools {
  private client: OPNSenseAPIClient;
  private cache: EnhancedCacheManager;

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
    this.cache = new EnhancedCacheManager(client, {
      redis: {
        keyPrefix: 'opnsense:',
        cluster: process.env.REDIS_CLUSTER === 'true',
      },
      cache: {
        defaultTTL: 300,
        enableSmartInvalidation: true,
        enablePatternAnalysis: true,
      },
      performance: {
        maxConcurrency: 10,
        batchSize: 100,
      }
    });
  }

  /**
   * Get firewall rules with intelligent caching
   */
  async getFirewallRules(options?: {
    forceFetch?: boolean;
    includeDisabled?: boolean;
  }) {
    const cacheKey = `cache:firewall:rules:${options?.includeDisabled ? 'all' : 'enabled'}`;
    
    const result = await this.cache.get(
      cacheKey,
      async () => {
        const response = await this.client.searchFirewallRules();
        const rules = Object.values(response.rows || {});
        
        // Filter and validate
        const validRules = rules
          .filter((rule: any) => options?.includeDisabled || rule.enabled === '1')
          .map(rule => FirewallRuleSchema.parse(rule));
        
        return validRules;
      },
      {
        ttl: 300, // 5 minutes for firewall rules
        pattern: 'cache:firewall:rules:*'
      }
    );

    return result;
  }

  /**
   * Get VLANs with caching
   */
  async getVlans() {
    const result = await this.cache.get(
      'cache:network:vlans',
      async () => {
        const response = await this.client.searchVlans();
        const vlans = Object.values(response.rows || {});
        return vlans.map(vlan => VlanSchema.parse(vlan));
      },
      {
        ttl: 600, // 10 minutes for VLANs (less frequently changed)
      }
    );

    return result;
  }

  /**
   * Create firewall rule and invalidate cache
   */
  async createFirewallRule(rule: any) {
    try {
      // Create the rule
      const result = await this.client.addFirewallRule(rule);
      
      // Invalidate related caches
      await this.cache.invalidate('cache:firewall:*', {
        cascade: true,
        reason: 'firewall_rule_created'
      });

      return result;
    } catch (error) {
      console.error('Failed to create firewall rule:', error);
      throw error;
    }
  }

  /**
   * Batch get multiple resources
   */
  async getDashboardData() {
    const requests = [
      {
        key: 'cache:firewall:rules:enabled',
        fetcher: () => this.getEnabledFirewallRules(),
        ttl: 300
      },
      {
        key: 'cache:network:vlans',
        fetcher: () => this.client.searchVlans(),
        ttl: 600
      },
      {
        key: 'cache:network:interfaces',
        fetcher: () => this.client.get('/interfaces/overview/export'),
        ttl: 1800
      },
      {
        key: 'cache:system:info',
        fetcher: () => this.client.get('/core/system/status'),
        ttl: 60
      }
    ];

    const results = await this.cache.getBatch(requests);
    
    return {
      firewallRules: results.get('cache:firewall:rules:enabled'),
      vlans: results.get('cache:network:vlans'),
      interfaces: results.get('cache:network:interfaces'),
      systemInfo: results.get('cache:system:info'),
    };
  }

  /**
   * Get cache statistics and recommendations
   */
  async getCacheStats() {
    return this.cache.getStatistics();
  }

  /**
   * Pre-warm cache for critical data
   */
  async warmCache() {
    console.log('🔥 Pre-warming cache...');
    
    // Pre-fetch critical data in parallel
    await Promise.all([
      this.getFirewallRules(),
      this.getVlans(),
      this.getInterfaces(),
      this.getSystemInfo(),
    ]);

    console.log('✅ Cache warmed successfully');
  }

  // Private helper methods
  private async getEnabledFirewallRules() {
    const response = await this.client.searchFirewallRules();
    return Object.values(response.rows || {})
      .filter((rule: any) => rule.enabled === '1');
  }

  private async getInterfaces() {
    return this.client.get('/interfaces/overview/export');
  }

  private async getSystemInfo() {
    return this.client.get('/core/system/status');
  }
}

// Example MCP tool implementation
export function createCachedFirewallTools(client: OPNSenseAPIClient) {
  const tools = new CachedOPNSenseTools(client);

  return {
    // List firewall rules with caching
    list_firewall_rules_cached: {
      description: 'List all firewall rules (cached)',
      parameters: z.object({
        forceFetch: z.boolean().optional().describe('Force fetch from API'),
        includeDisabled: z.boolean().optional().describe('Include disabled rules'),
      }),
      execute: async (params: any) => {
        const result = await tools.getFirewallRules(params);
        return {
          rules: result.data,
          metadata: result.metadata,
          cached: result.metadata.source === 'cache',
          cacheAge: result.metadata.source === 'cache' 
            ? Date.now() - result.metadata.timestamp.getTime() 
            : 0
        };
      }
    },

    // Get dashboard data with batch caching
    get_dashboard_data: {
      description: 'Get all dashboard data in one call (optimized)',
      parameters: z.object({}),
      execute: async () => {
        const data = await tools.getDashboardData();
        return {
          data,
          summary: {
            totalRules: data.firewallRules?.data.length || 0,
            totalVlans: data.vlans?.data.rows ? Object.keys(data.vlans.data.rows).length : 0,
            cacheHits: Object.values(data).filter(d => d?.metadata.source === 'cache').length,
          }
        };
      }
    },

    // Get cache performance metrics
    get_cache_metrics: {
      description: 'Get cache performance metrics and recommendations',
      parameters: z.object({}),
      execute: async () => {
        return tools.getCacheStats();
      }
    },

    // Warm cache
    warm_cache: {
      description: 'Pre-warm cache with critical data',
      parameters: z.object({}),
      execute: async () => {
        await tools.warmCache();
        return { success: true, message: 'Cache warmed successfully' };
      }
    }
  };
}

// Usage example in MCP server
/*
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'opnsense-mcp-server',
  version: '0.4.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Initialize client and tools
const apiClient = new OPNSenseAPIClient(config);
const cachedTools = createCachedFirewallTools(apiClient);

// Register tools
Object.entries(cachedTools).forEach(([name, tool]) => {
  server.setRequestHandler({
    method: 'tools/call',
    handler: async (request) => {
      if (request.params.name === name) {
        return tool.execute(request.params.arguments);
      }
    }
  });
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
*/
