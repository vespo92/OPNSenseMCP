/**
 * Traffic Shaper Plugin
 *
 * QoS traffic shaping and bandwidth management
 */

import { BasePlugin } from '../../../core/plugin-system/base-plugin.js';
import { PluginCategory, PluginMetadata, MCPTool, MCPResource, MCPPrompt } from '../../../core/types/plugin.js';
import { EventSeverity } from '../../../core/types/events.js';

export default class TrafficShaperPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'traffic-shaper',
    name: 'Traffic Shaper Plugin',
    version: '1.0.0',
    description: 'QoS traffic shaping and bandwidth management',
    category: PluginCategory.TRAFFIC,
    author: 'OPNsense MCP Team',
    enabled: true,
  };

  getTools(): MCPTool[] {
    return [
      {
        name: 'traffic_list_pipes',
        description: 'List traffic shaper pipes (bandwidth limiters)',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listPipes.bind(this),
      },
      {
        name: 'traffic_create_pipe',
        description: 'Create a traffic shaper pipe',
        inputSchema: {
          type: 'object',
          properties: {
            bandwidth: { type: 'number', description: 'Bandwidth in Kbit/s' },
            bandwidthMetric: { type: 'string', enum: ['Kbit', 'Mbit', 'Gbit'] },
            description: { type: 'string' },
            queue: { type: 'number', description: 'Queue size' },
          },
          required: ['bandwidth', 'description'],
        },
        handler: this.createPipe.bind(this),
      },
      {
        name: 'traffic_update_pipe',
        description: 'Update a traffic shaper pipe',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string' },
            bandwidth: { type: 'number' },
            description: { type: 'string' },
          },
          required: ['uuid'],
        },
        handler: this.updatePipe.bind(this),
      },
      {
        name: 'traffic_delete_pipe',
        description: 'Delete a traffic shaper pipe',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string' },
          },
          required: ['uuid'],
        },
        handler: this.deletePipe.bind(this),
      },
      {
        name: 'traffic_list_queues',
        description: 'List traffic shaper queues',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listQueues.bind(this),
      },
      {
        name: 'traffic_create_queue',
        description: 'Create a traffic shaper queue',
        inputSchema: {
          type: 'object',
          properties: {
            pipe: { type: 'string', description: 'Parent pipe UUID' },
            weight: { type: 'number', description: 'Queue weight/priority' },
            description: { type: 'string' },
          },
          required: ['pipe', 'weight', 'description'],
        },
        handler: this.createQueue.bind(this),
      },
      {
        name: 'traffic_list_rules',
        description: 'List traffic shaper rules',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listRules.bind(this),
      },
      {
        name: 'traffic_create_rule',
        description: 'Create a traffic shaper rule',
        inputSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string' },
            direction: { type: 'string', enum: ['in', 'out'] },
            source: { type: 'string' },
            destination: { type: 'string' },
            target: { type: 'string', description: 'Target pipe/queue UUID' },
            description: { type: 'string' },
          },
          required: ['interface', 'direction', 'target'],
        },
        handler: this.createRule.bind(this),
      },
      {
        name: 'traffic_apply_changes',
        description: 'Apply traffic shaper changes',
        inputSchema: { type: 'object', properties: {} },
        handler: this.applyChanges.bind(this),
      },
      {
        name: 'traffic_get_statistics',
        description: 'Get traffic shaper statistics',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getStatistics.bind(this),
      },
    ];
  }

  getResources(): MCPResource[] {
    return [
      {
        uri: 'traffic://shaper/overview',
        name: 'Traffic Shaper Overview',
        description: 'Complete traffic shaper configuration',
        handler: async () => ({
          content: JSON.stringify(await this.getOverview(), null, 2),
        }),
      },
    ];
  }

  getPrompts(): MCPPrompt[] {
    return [];
  }

  getDependencies(): string[] {
    return ['core-network'];
  }

  private async listPipes(params: {}): Promise<any> {
    try {
      const response = await this.api.get('/api/trafficshaper/settings/searchPipes');
      return {
        pipes: response.data?.rows || [],
        count: response.data?.rowCount || 0,
      };
    } catch (error) {
      this.logger.error('Error listing pipes:', error);
      throw error;
    }
  }

  private async createPipe(params: {
    bandwidth: number;
    bandwidthMetric?: string;
    description: string;
    queue?: number;
  }): Promise<any> {
    try {
      const response = await this.api.post('/api/trafficshaper/settings/addPipe', {
        pipe: {
          bandwidth: params.bandwidth,
          bandwidthMetric: params.bandwidthMetric || 'Mbit',
          description: params.description,
          queue: params.queue || 100,
        },
      });

      if (response.data?.result === 'saved') {
        this.emit('traffic.pipe.created', {
          uuid: response.data.uuid,
          bandwidth: params.bandwidth,
        });

        return {
          success: true,
          uuid: response.data.uuid,
          message: 'Traffic shaper pipe created',
        };
      }

      throw new Error('Failed to create pipe');
    } catch (error) {
      this.logger.error('Error creating pipe:', error);
      throw error;
    }
  }

  private async updatePipe(params: { uuid: string; bandwidth?: number; description?: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/trafficshaper/settings/setPipe/${params.uuid}`, {
        pipe: {
          ...(params.bandwidth && { bandwidth: params.bandwidth }),
          ...(params.description && { description: params.description }),
        },
      });

      if (response.data?.result === 'saved') {
        this.emit('traffic.pipe.updated', { uuid: params.uuid });
        return { success: true, message: 'Pipe updated successfully' };
      }

      throw new Error('Failed to update pipe');
    } catch (error) {
      this.logger.error(`Error updating pipe ${params.uuid}:`, error);
      throw error;
    }
  }

  private async deletePipe(params: { uuid: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/trafficshaper/settings/delPipe/${params.uuid}`);

      if (response.data?.result === 'deleted') {
        this.emit('traffic.pipe.deleted', { uuid: params.uuid });
        return { success: true, message: 'Pipe deleted successfully' };
      }

      throw new Error('Failed to delete pipe');
    } catch (error) {
      this.logger.error(`Error deleting pipe ${params.uuid}:`, error);
      throw error;
    }
  }

  private async listQueues(params: {}): Promise<any> {
    try {
      const response = await this.api.get('/api/trafficshaper/settings/searchQueues');
      return {
        queues: response.data?.rows || [],
        count: response.data?.rowCount || 0,
      };
    } catch (error) {
      this.logger.error('Error listing queues:', error);
      throw error;
    }
  }

  private async createQueue(params: { pipe: string; weight: number; description: string }): Promise<any> {
    try {
      const response = await this.api.post('/api/trafficshaper/settings/addQueue', {
        queue: {
          pipe: params.pipe,
          weight: params.weight,
          description: params.description,
        },
      });

      if (response.data?.result === 'saved') {
        this.emit('traffic.queue.created', {
          uuid: response.data.uuid,
          pipe: params.pipe,
        });

        return {
          success: true,
          uuid: response.data.uuid,
          message: 'Queue created successfully',
        };
      }

      throw new Error('Failed to create queue');
    } catch (error) {
      this.logger.error('Error creating queue:', error);
      throw error;
    }
  }

  private async listRules(params: {}): Promise<any> {
    try {
      const response = await this.api.get('/api/trafficshaper/settings/searchRules');
      return {
        rules: response.data?.rows || [],
        count: response.data?.rowCount || 0,
      };
    } catch (error) {
      this.logger.error('Error listing rules:', error);
      throw error;
    }
  }

  private async createRule(params: {
    interface: string;
    direction: string;
    source?: string;
    destination?: string;
    target: string;
    description?: string;
  }): Promise<any> {
    try {
      const response = await this.api.post('/api/trafficshaper/settings/addRule', {
        rule: {
          interface: params.interface,
          direction: params.direction,
          source: params.source || 'any',
          destination: params.destination || 'any',
          target: params.target,
          description: params.description || '',
        },
      });

      if (response.data?.result === 'saved') {
        this.emit('traffic.rule.created', {
          uuid: response.data.uuid,
          interface: params.interface,
        });

        return {
          success: true,
          uuid: response.data.uuid,
          message: 'Traffic shaper rule created',
        };
      }

      throw new Error('Failed to create rule');
    } catch (error) {
      this.logger.error('Error creating rule:', error);
      throw error;
    }
  }

  private async applyChanges(params: {}): Promise<any> {
    try {
      const response = await this.api.post('/api/trafficshaper/service/reconfigure');

      this.emit('traffic.changes.applied', { timestamp: new Date() });

      return {
        success: true,
        message: 'Traffic shaper changes applied',
        status: response.data?.status || 'ok',
      };
    } catch (error) {
      this.logger.error('Error applying changes:', error);
      throw error;
    }
  }

  private async getStatistics(params: {}): Promise<any> {
    try {
      const [pipes, queues, rules] = await Promise.all([
        this.listPipes({}),
        this.listQueues({}),
        this.listRules({}),
      ]);

      return {
        totalPipes: pipes.count,
        totalQueues: queues.count,
        totalRules: rules.count,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting statistics:', error);
      throw error;
    }
  }

  private async getOverview(): Promise<any> {
    const [pipes, queues, rules, stats] = await Promise.all([
      this.listPipes({}),
      this.listQueues({}),
      this.listRules({}),
      this.getStatistics({}),
    ]);

    return { pipes, queues, rules, stats };
  }
}
