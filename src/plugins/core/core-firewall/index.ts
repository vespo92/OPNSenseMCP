/**
 * Core Firewall Plugin
 *
 * Provides comprehensive firewall rule and alias management
 */

import { BasePlugin } from '../../../core/plugin-system/base-plugin.js';
import { PluginCategory, PluginMetadata, MCPTool, MCPResource, MCPPrompt } from '../../../core/types/plugin.js';
import { EventType, EventSeverity } from '../../../core/types/events.js';

/**
 * Firewall plugin for OPNsense
 */
export default class FirewallPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'core-firewall',
    name: 'Core Firewall Plugin',
    version: '1.0.0',
    description: 'Comprehensive firewall rule and alias management for OPNsense',
    category: PluginCategory.CORE,
    author: 'OPNsense MCP Team',
    enabled: true,
    tags: ['firewall', 'security', 'rules', 'aliases'],
  };

  private monitorTimer?: NodeJS.Timeout;
  private ruleCache = new Map<string, any>();

  /**
   * Initialize plugin
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing Firewall Plugin');

    // Load cached rules if enabled
    if (this.context.config.cacheRules) {
      await this.loadRulesFromCache();
    }
  }

  /**
   * Start plugin
   */
  protected async onStart(): Promise<void> {
    this.logger.info('Starting Firewall Plugin');

    // Start monitoring if enabled
    if (this.context.config.enableRuleMonitoring) {
      this.startMonitoring();
    }

    this.emit('firewall.plugin.started', {});
  }

  /**
   * Stop plugin
   */
  protected async onStop(): Promise<void> {
    this.logger.info('Stopping Firewall Plugin');

    // Stop monitoring
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }

    this.emit('firewall.plugin.stopped', {});
  }

  /**
   * Get MCP tools
   */
  getTools(): MCPTool[] {
    return [
      {
        name: 'firewall_list_rules',
        description: 'List all firewall rules',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              description: 'Filter by enabled status',
            },
            interface: {
              type: 'string',
              description: 'Filter by interface',
            },
          },
        },
        handler: this.listRules.bind(this),
      },
      {
        name: 'firewall_get_rule',
        description: 'Get a specific firewall rule by UUID',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: {
              type: 'string',
              description: 'Rule UUID',
            },
          },
          required: ['uuid'],
        },
        handler: this.getRule.bind(this),
      },
      {
        name: 'firewall_create_rule',
        description: 'Create a new firewall rule',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'string' },
            sequence: { type: 'string' },
            action: { type: 'string' },
            quick: { type: 'string' },
            interface: { type: 'string' },
            direction: { type: 'string' },
            ipprotocol: { type: 'string' },
            protocol: { type: 'string' },
            source_net: { type: 'string' },
            source_port: { type: 'string' },
            destination_net: { type: 'string' },
            destination_port: { type: 'string' },
            description: { type: 'string' },
            log: { type: 'string' },
          },
          required: ['interface', 'direction', 'action'],
        },
        handler: this.createRule.bind(this),
      },
      {
        name: 'firewall_update_rule',
        description: 'Update an existing firewall rule',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: {
              type: 'string',
              description: 'Rule UUID',
            },
            rule: {
              type: 'object',
              description: 'Rule properties to update',
            },
          },
          required: ['uuid', 'rule'],
        },
        handler: this.updateRule.bind(this),
      },
      {
        name: 'firewall_delete_rule',
        description: 'Delete a firewall rule',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: {
              type: 'string',
              description: 'Rule UUID',
            },
          },
          required: ['uuid'],
        },
        handler: this.deleteRule.bind(this),
      },
      {
        name: 'firewall_toggle_rule',
        description: 'Toggle a firewall rule enabled/disabled',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: {
              type: 'string',
              description: 'Rule UUID',
            },
          },
          required: ['uuid'],
        },
        handler: this.toggleRule.bind(this),
      },
      {
        name: 'firewall_apply_changes',
        description: 'Apply pending firewall changes',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        handler: this.applyChanges.bind(this),
      },
    ];
  }

  /**
   * Get MCP resources
   */
  getResources(): MCPResource[] {
    return [
      {
        uri: 'firewall://rules',
        name: 'Firewall Rules',
        description: 'All firewall rules',
        mimeType: 'application/json',
        handler: async () => {
          const rules = await this.listRules({});
          return { content: JSON.stringify(rules, null, 2) };
        },
      },
      {
        uri: 'firewall://stats',
        name: 'Firewall Statistics',
        description: 'Firewall rule statistics',
        mimeType: 'application/json',
        handler: async () => {
          const stats = await this.getStats();
          return { content: JSON.stringify(stats, null, 2) };
        },
      },
    ];
  }

  /**
   * Get MCP prompts
   */
  getPrompts(): MCPPrompt[] {
    return [
      {
        name: 'firewall_audit',
        description: 'Audit firewall rules for security issues',
        handler: async (args) => ({
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: 'Analyze firewall rules for security issues, misconfigurations, and best practices.',
              },
            },
          ],
        }),
      },
    ];
  }

  /**
   * Get dependencies
   */
  getDependencies(): string[] {
    return [];
  }

  /**
   * List firewall rules
   */
  private async listRules(params: { enabled?: boolean; interface?: string }): Promise<any> {
    try {
      const response = await this.api.get('/api/firewall/filter/searchRule');
      let rules = response.data?.rows || [];

      // Filter by enabled status
      if (params.enabled !== undefined) {
        const enabledValue = params.enabled ? '1' : '0';
        rules = rules.filter((rule: any) => rule.enabled === enabledValue);
      }

      // Filter by interface
      if (params.interface) {
        rules = rules.filter((rule: any) => rule.interface === params.interface);
      }

      // Update cache
      if (this.context.config.cacheRules) {
        for (const rule of rules) {
          this.ruleCache.set(rule.uuid, rule);
        }
      }

      return { rules, count: rules.length };
    } catch (error) {
      this.logger.error('Error listing firewall rules:', error);
      throw error;
    }
  }

  /**
   * Get specific rule
   */
  private async getRule(params: { uuid: string }): Promise<any> {
    try {
      // Check cache first
      if (this.context.config.cacheRules && this.ruleCache.has(params.uuid)) {
        return this.ruleCache.get(params.uuid);
      }

      const response = await this.api.get(`/api/firewall/filter/getRule/${params.uuid}`);
      const rule = response.data?.rule;

      // Update cache
      if (rule && this.context.config.cacheRules) {
        this.ruleCache.set(params.uuid, rule);
      }

      return rule;
    } catch (error) {
      this.logger.error(`Error getting firewall rule ${params.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Create firewall rule
   */
  private async createRule(params: any): Promise<any> {
    try {
      const response = await this.api.post('/api/firewall/filter/addRule', { rule: params });

      if (response.data?.result === 'saved') {
        // Apply changes
        await this.applyChanges({});

        // Emit event
        this.emit('firewall.rule.created', {
          uuid: response.data.uuid,
          rule: params,
        });

        // Invalidate cache
        this.ruleCache.clear();

        return {
          success: true,
          uuid: response.data.uuid,
          message: 'Firewall rule created successfully',
        };
      }

      throw new Error('Failed to create firewall rule');
    } catch (error) {
      this.logger.error('Error creating firewall rule:', error);
      throw error;
    }
  }

  /**
   * Update firewall rule
   */
  private async updateRule(params: { uuid: string; rule: any }): Promise<any> {
    try {
      const response = await this.api.post(
        `/api/firewall/filter/setRule/${params.uuid}`,
        { rule: params.rule }
      );

      if (response.data?.result === 'saved') {
        // Apply changes
        await this.applyChanges({});

        // Emit event
        this.emit('firewall.rule.updated', {
          uuid: params.uuid,
          changes: params.rule,
        });

        // Invalidate cache
        this.ruleCache.delete(params.uuid);

        return {
          success: true,
          message: 'Firewall rule updated successfully',
        };
      }

      throw new Error('Failed to update firewall rule');
    } catch (error) {
      this.logger.error(`Error updating firewall rule ${params.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Delete firewall rule
   */
  private async deleteRule(params: { uuid: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/firewall/filter/delRule/${params.uuid}`);

      if (response.data?.result === 'deleted') {
        // Apply changes
        await this.applyChanges({});

        // Emit event
        this.emit('firewall.rule.deleted', {
          uuid: params.uuid,
        });

        // Remove from cache
        this.ruleCache.delete(params.uuid);

        return {
          success: true,
          message: 'Firewall rule deleted successfully',
        };
      }

      throw new Error('Failed to delete firewall rule');
    } catch (error) {
      this.logger.error(`Error deleting firewall rule ${params.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Toggle firewall rule
   */
  private async toggleRule(params: { uuid: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/firewall/filter/toggleRule/${params.uuid}`);

      if (response.data?.result === 'saved') {
        // Apply changes
        await this.applyChanges({});

        // Emit event
        this.emit('firewall.rule.toggled', {
          uuid: params.uuid,
          enabled: response.data.enabled,
        });

        // Invalidate cache
        this.ruleCache.delete(params.uuid);

        return {
          success: true,
          enabled: response.data.enabled === '1',
          message: 'Firewall rule toggled successfully',
        };
      }

      throw new Error('Failed to toggle firewall rule');
    } catch (error) {
      this.logger.error(`Error toggling firewall rule ${params.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Apply firewall changes
   */
  private async applyChanges(params: {}): Promise<any> {
    try {
      const response = await this.api.post('/api/firewall/filter/apply');

      // Emit event
      this.emit('firewall.rules.reloaded', {
        timestamp: new Date(),
      });

      return {
        success: true,
        message: 'Firewall changes applied successfully',
        status: response.data?.status || 'ok',
      };
    } catch (error) {
      this.logger.error('Error applying firewall changes:', error);
      throw error;
    }
  }

  /**
   * Get firewall statistics
   */
  private async getStats(): Promise<any> {
    const rules = await this.listRules({});

    const stats = {
      totalRules: rules.count,
      enabledRules: rules.rules.filter((r: any) => r.enabled === '1').length,
      disabledRules: rules.rules.filter((r: any) => r.enabled === '0').length,
      byAction: {} as Record<string, number>,
      byInterface: {} as Record<string, number>,
      cacheSize: this.ruleCache.size,
    };

    for (const rule of rules.rules) {
      stats.byAction[rule.action] = (stats.byAction[rule.action] || 0) + 1;
      stats.byInterface[rule.interface] = (stats.byInterface[rule.interface] || 0) + 1;
    }

    return stats;
  }

  /**
   * Load rules from cache
   */
  private async loadRulesFromCache(): Promise<void> {
    try {
      const cached = await this.cache.getValue<Record<string, any>>('firewall:rules');
      if (cached) {
        this.ruleCache = new Map(Object.entries(cached));
        this.logger.info(`Loaded ${this.ruleCache.size} rules from cache`);
      }
    } catch (error) {
      this.logger.debug('No cached rules found');
    }
  }

  /**
   * Start monitoring firewall rules
   */
  private startMonitoring(): void {
    const interval = this.context.config.monitorInterval || 60000;

    this.monitorTimer = setInterval(async () => {
      try {
        const stats = await this.getStats();

        // Emit metrics event
        this.context.eventBus.createEvent(
          'firewall.metrics.collected' as any,
          this.metadata.id,
          stats,
          EventSeverity.DEBUG,
          'firewall'
        );
      } catch (error) {
        this.logger.error('Error in firewall monitoring:', error);
      }
    }, interval);

    this.logger.info(`Started firewall monitoring (interval: ${interval}ms)`);
  }

  /**
   * Cleanup
   */
  protected async onCleanup(): Promise<void> {
    // Save cache
    if (this.context.config.cacheRules && this.ruleCache.size > 0) {
      try {
        await this.cache.set(
          'firewall:rules',
          Object.fromEntries(this.ruleCache),
          this.context.config.cacheTTL
        );
        this.logger.info(`Saved ${this.ruleCache.size} rules to cache`);
      } catch (error) {
        this.logger.error('Error saving rules to cache:', error);
      }
    }
  }
}
