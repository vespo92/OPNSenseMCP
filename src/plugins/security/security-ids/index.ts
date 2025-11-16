/**
 * IDS/IPS Plugin (Suricata)
 *
 * Manages Suricata IDS/IPS for threat detection and prevention
 */

import { BasePlugin } from '../../../core/plugin-system/base-plugin.js';
import { PluginCategory, PluginMetadata, MCPTool, MCPResource, MCPPrompt } from '../../../core/types/plugin.js';
import { EventType, EventSeverity } from '../../../core/types/events.js';

export default class IDSPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'security-ids',
    name: 'IDS/IPS Plugin (Suricata)',
    version: '1.0.0',
    description: 'Intrusion Detection and Prevention System using Suricata',
    category: PluginCategory.SECURITY,
    author: 'OPNsense MCP Team',
    enabled: true,
  };

  private alertMonitorTimer?: NodeJS.Timeout;
  private alertCache = new Map<string, any>();

  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing IDS/IPS Plugin');
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting IDS/IPS Plugin');

    if (this.context.config.enableAlertMonitoring) {
      this.startAlertMonitoring();
    }
  }

  protected async onStop(): Promise<void> {
    if (this.alertMonitorTimer) {
      clearInterval(this.alertMonitorTimer);
    }
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'ids_get_status',
        description: 'Get IDS/IPS service status',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getStatus.bind(this),
      },
      {
        name: 'ids_start',
        description: 'Start IDS/IPS service',
        inputSchema: { type: 'object', properties: {} },
        handler: this.startService.bind(this),
      },
      {
        name: 'ids_stop',
        description: 'Stop IDS/IPS service',
        inputSchema: { type: 'object', properties: {} },
        handler: this.stopService.bind(this),
      },
      {
        name: 'ids_restart',
        description: 'Restart IDS/IPS service',
        inputSchema: { type: 'object', properties: {} },
        handler: this.restartService.bind(this),
      },
      {
        name: 'ids_list_alerts',
        description: 'List recent IDS alerts',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of alerts' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            category: { type: 'string', description: 'Alert category' },
          },
        },
        handler: this.listAlerts.bind(this),
      },
      {
        name: 'ids_get_alert',
        description: 'Get detailed alert information',
        inputSchema: {
          type: 'object',
          properties: {
            alertId: { type: 'string', description: 'Alert ID' },
          },
          required: ['alertId'],
        },
        handler: this.getAlert.bind(this),
      },
      {
        name: 'ids_update_rules',
        description: 'Update IDS/IPS rule sets',
        inputSchema: { type: 'object', properties: {} },
        handler: this.updateRules.bind(this),
      },
      {
        name: 'ids_list_rule_sets',
        description: 'List available rule sets',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listRuleSets.bind(this),
      },
      {
        name: 'ids_enable_rule_set',
        description: 'Enable a rule set',
        inputSchema: {
          type: 'object',
          properties: {
            ruleSetId: { type: 'string' },
          },
          required: ['ruleSetId'],
        },
        handler: this.enableRuleSet.bind(this),
      },
      {
        name: 'ids_disable_rule_set',
        description: 'Disable a rule set',
        inputSchema: {
          type: 'object',
          properties: {
            ruleSetId: { type: 'string' },
          },
          required: ['ruleSetId'],
        },
        handler: this.disableRuleSet.bind(this),
      },
      {
        name: 'ids_get_statistics',
        description: 'Get IDS/IPS statistics',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getStatistics.bind(this),
      },
      {
        name: 'ids_block_ip',
        description: 'Block an IP address detected by IDS',
        inputSchema: {
          type: 'object',
          properties: {
            ipAddress: { type: 'string', description: 'IP address to block' },
            duration: { type: 'number', description: 'Block duration in seconds' },
          },
          required: ['ipAddress'],
        },
        handler: this.blockIP.bind(this),
      },
    ];
  }

  getResources(): MCPResource[] {
    return [
      {
        uri: 'security://ids/alerts',
        name: 'IDS Alerts',
        description: 'Recent IDS/IPS alerts',
        handler: async () => ({
          content: JSON.stringify(await this.listAlerts({ limit: 100 }), null, 2),
        }),
      },
      {
        uri: 'security://ids/statistics',
        name: 'IDS Statistics',
        description: 'IDS/IPS statistics and metrics',
        handler: async () => ({
          content: JSON.stringify(await this.getStatistics({}), null, 2),
        }),
      },
    ];
  }

  getPrompts(): MCPPrompt[] {
    return [
      {
        name: 'ids_analyze_alerts',
        description: 'Analyze recent IDS alerts for patterns',
        handler: async () => ({
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: 'Analyze recent IDS alerts for attack patterns, trends, and recommended actions.',
              },
            },
          ],
        }),
      },
    ];
  }

  getDependencies(): string[] {
    return ['core-firewall'];
  }

  private async getStatus(params: {}): Promise<any> {
    try {
      const response = await this.api.get('/api/ids/service/status');
      return {
        running: response.data?.running === 'true',
        enabled: response.data?.enabled === 'true',
        status: response.data,
      };
    } catch (error) {
      this.logger.error('Error getting IDS status:', error);
      throw error;
    }
  }

  private async startService(params: {}): Promise<any> {
    try {
      const response = await this.api.post('/api/ids/service/start');

      this.emit('service.started', { service: 'ids' });

      return {
        success: true,
        message: 'IDS/IPS service started',
        status: response.data,
      };
    } catch (error) {
      this.logger.error('Error starting IDS:', error);
      throw error;
    }
  }

  private async stopService(params: {}): Promise<any> {
    try {
      const response = await this.api.post('/api/ids/service/stop');

      this.emit('service.stopped', { service: 'ids' });

      return {
        success: true,
        message: 'IDS/IPS service stopped',
        status: response.data,
      };
    } catch (error) {
      this.logger.error('Error stopping IDS:', error);
      throw error;
    }
  }

  private async restartService(params: {}): Promise<any> {
    try {
      const response = await this.api.post('/api/ids/service/restart');

      this.emit('service.restarted', { service: 'ids' });

      return {
        success: true,
        message: 'IDS/IPS service restarted',
        status: response.data,
      };
    } catch (error) {
      this.logger.error('Error restarting IDS:', error);
      throw error;
    }
  }

  private async listAlerts(params: { limit?: number; severity?: string; category?: string }): Promise<any> {
    try {
      // In real implementation, this would call OPNsense IDS alerts API
      const alerts = Array.from(this.alertCache.values());

      let filtered = alerts;

      if (params.severity) {
        filtered = filtered.filter(a => a.severity === params.severity);
      }

      if (params.category) {
        filtered = filtered.filter(a => a.category === params.category);
      }

      if (params.limit) {
        filtered = filtered.slice(0, params.limit);
      }

      return {
        alerts: filtered,
        count: filtered.length,
        total: alerts.length,
      };
    } catch (error) {
      this.logger.error('Error listing alerts:', error);
      throw error;
    }
  }

  private async getAlert(params: { alertId: string }): Promise<any> {
    try {
      const alert = this.alertCache.get(params.alertId);

      if (!alert) {
        throw new Error(`Alert not found: ${params.alertId}`);
      }

      return alert;
    } catch (error) {
      this.logger.error(`Error getting alert ${params.alertId}:`, error);
      throw error;
    }
  }

  private async updateRules(params: {}): Promise<any> {
    try {
      const response = await this.api.post('/api/ids/service/updateRules');

      this.emit('ids.rules.updated', { timestamp: new Date() });

      return {
        success: true,
        message: 'IDS rules updated successfully',
        status: response.data,
      };
    } catch (error) {
      this.logger.error('Error updating IDS rules:', error);
      throw error;
    }
  }

  private async listRuleSets(params: {}): Promise<any> {
    try {
      const response = await this.api.get('/api/ids/settings/searchInstalledRules');

      return {
        ruleSets: response.data?.rows || [],
        count: response.data?.rowCount || 0,
      };
    } catch (error) {
      this.logger.error('Error listing rule sets:', error);
      throw error;
    }
  }

  private async enableRuleSet(params: { ruleSetId: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/ids/settings/toggleRule/${params.ruleSetId}/1`);

      this.emit('ids.ruleset.enabled', { ruleSetId: params.ruleSetId });

      return {
        success: true,
        message: `Rule set ${params.ruleSetId} enabled`,
      };
    } catch (error) {
      this.logger.error(`Error enabling rule set ${params.ruleSetId}:`, error);
      throw error;
    }
  }

  private async disableRuleSet(params: { ruleSetId: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/ids/settings/toggleRule/${params.ruleSetId}/0`);

      this.emit('ids.ruleset.disabled', { ruleSetId: params.ruleSetId });

      return {
        success: true,
        message: `Rule set ${params.ruleSetId} disabled`,
      };
    } catch (error) {
      this.logger.error(`Error disabling rule set ${params.ruleSetId}:`, error);
      throw error;
    }
  }

  private async getStatistics(params: {}): Promise<any> {
    try {
      // Get statistics from cache and live data
      const alerts = await this.listAlerts({ limit: 1000 });

      const stats = {
        totalAlerts: alerts.total,
        bySeverity: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        topSourceIPs: [] as Array<{ ip: string; count: number }>,
        topDestIPs: [] as Array<{ ip: string; count: number }>,
        timestamp: new Date(),
      };

      for (const alert of alerts.alerts) {
        stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
        stats.byCategory[alert.category] = (stats.byCategory[alert.category] || 0) + 1;
      }

      return stats;
    } catch (error) {
      this.logger.error('Error getting IDS statistics:', error);
      throw error;
    }
  }

  private async blockIP(params: { ipAddress: string; duration?: number }): Promise<any> {
    try {
      // Get firewall plugin to create blocking rule
      const firewallPlugin = this.context.getPlugin('core-firewall');

      if (!firewallPlugin) {
        throw new Error('Firewall plugin not available');
      }

      // Create blocking rule
      const tools = firewallPlugin.getTools();
      const createRuleTool = tools.find(t => t.name === 'firewall_create_rule');

      if (createRuleTool) {
        await createRuleTool.handler({
          enabled: '1',
          action: 'block',
          interface: 'wan',
          direction: 'in',
          ipprotocol: 'inet',
          source_net: params.ipAddress,
          destination_net: 'any',
          description: `IDS Auto-block: ${params.ipAddress}`,
          log: '1',
        });
      }

      this.emit('ids.ip.blocked', {
        ipAddress: params.ipAddress,
        duration: params.duration,
        timestamp: new Date(),
      });

      return {
        success: true,
        message: `IP address ${params.ipAddress} blocked`,
        ipAddress: params.ipAddress,
      };
    } catch (error) {
      this.logger.error(`Error blocking IP ${params.ipAddress}:`, error);
      throw error;
    }
  }

  private startAlertMonitoring(): void {
    const interval = this.context.config.monitorInterval || 30000;

    this.alertMonitorTimer = setInterval(async () => {
      try {
        // Simulate alert monitoring (in real impl, would poll IDS API)
        const stats = await this.getStatistics({});

        this.context.eventBus.createEvent(
          'ids.metrics.collected' as any,
          this.metadata.id,
          stats,
          EventSeverity.DEBUG,
          'security'
        );

        // Check for critical alerts
        if (stats.bySeverity.critical > 0) {
          this.context.eventBus.createEvent(
            EventType.IDS_ALERT,
            this.metadata.id,
            { severity: 'critical', count: stats.bySeverity.critical },
            EventSeverity.CRITICAL,
            'security'
          );
        }
      } catch (error) {
        this.logger.error('Error in alert monitoring:', error);
      }
    }, interval);

    this.logger.info(`Started IDS alert monitoring (interval: ${interval}ms)`);
  }
}
