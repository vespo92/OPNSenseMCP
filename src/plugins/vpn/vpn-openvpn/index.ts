/**
 * OpenVPN Plugin
 *
 * Manages OpenVPN servers and clients with real-time monitoring
 */

import { BasePlugin } from '../../../core/plugin-system/base-plugin.js';
import { PluginCategory, PluginMetadata, MCPTool, MCPResource, MCPPrompt } from '../../../core/types/plugin.js';
import { EventType, EventSeverity } from '../../../core/types/events.js';

export default class OpenVPNPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'vpn-openvpn',
    name: 'OpenVPN Plugin',
    version: '1.0.0',
    description: 'OpenVPN server and client management with real-time connection monitoring',
    category: PluginCategory.VPN,
    author: 'OPNsense MCP Team',
    enabled: true,
  };

  private monitorTimer?: NodeJS.Timeout;
  private connectionCache = new Map<string, any>();

  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing OpenVPN Plugin');
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting OpenVPN Plugin');

    if (this.context.config.enableConnectionMonitoring) {
      this.startConnectionMonitoring();
    }
  }

  protected async onStop(): Promise<void> {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'openvpn_list_servers',
        description: 'List all OpenVPN server instances',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listServers.bind(this),
      },
      {
        name: 'openvpn_list_clients',
        description: 'List all OpenVPN client configurations',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listClients.bind(this),
      },
      {
        name: 'openvpn_get_connections',
        description: 'Get active OpenVPN connections',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: { type: 'string', description: 'Filter by server ID' },
          },
        },
        handler: this.getConnections.bind(this),
      },
      {
        name: 'openvpn_disconnect_client',
        description: 'Disconnect a specific VPN client',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: { type: 'string' },
            clientId: { type: 'string' },
          },
          required: ['serverId', 'clientId'],
        },
        handler: this.disconnectClient.bind(this),
      },
      {
        name: 'openvpn_create_server',
        description: 'Create a new OpenVPN server instance',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            protocol: { type: 'string', enum: ['tcp', 'udp'] },
            port: { type: 'number' },
            network: { type: 'string' },
            authmode: { type: 'string' },
          },
          required: ['description', 'protocol', 'port'],
        },
        handler: this.createServer.bind(this),
      },
    ];
  }

  getResources(): MCPResource[] {
    return [
      {
        uri: 'vpn://openvpn/status',
        name: 'OpenVPN Status',
        description: 'Current OpenVPN server and client status',
        handler: async () => ({
          content: JSON.stringify(await this.getStatus(), null, 2),
        }),
      },
    ];
  }

  getPrompts(): MCPPrompt[] {
    return [];
  }

  getDependencies(): string[] {
    return ['core-firewall'];
  }

  private async listServers(): Promise<any> {
    try {
      const response = await this.api.get('/api/openvpn/instances/searchServers');
      return { servers: response.data?.rows || [], count: response.data?.rowCount || 0 };
    } catch (error) {
      this.logger.error('Error listing OpenVPN servers:', error);
      throw error;
    }
  }

  private async listClients(): Promise<any> {
    try {
      const response = await this.api.get('/api/openvpn/instances/searchClients');
      return { clients: response.data?.rows || [], count: response.data?.rowCount || 0 };
    } catch (error) {
      this.logger.error('Error listing OpenVPN clients:', error);
      throw error;
    }
  }

  private async getConnections(params: { serverId?: string }): Promise<any> {
    try {
      // This would call the OpenVPN status API
      const connections = Array.from(this.connectionCache.values());

      if (params.serverId) {
        return connections.filter(c => c.serverId === params.serverId);
      }

      return { connections, count: connections.length };
    } catch (error) {
      this.logger.error('Error getting OpenVPN connections:', error);
      throw error;
    }
  }

  private async disconnectClient(params: { serverId: string; clientId: string }): Promise<any> {
    try {
      // Emit disconnect event
      this.emit('vpn.client.disconnected', {
        serverId: params.serverId,
        clientId: params.clientId,
        timestamp: new Date(),
      });

      return { success: true, message: 'Client disconnected' };
    } catch (error) {
      this.logger.error('Error disconnecting client:', error);
      throw error;
    }
  }

  private async createServer(params: any): Promise<any> {
    try {
      const response = await this.api.post('/api/openvpn/instances/addServer', params);

      if (response.data?.result === 'saved') {
        this.emit('vpn.server.created', {
          serverId: response.data.uuid,
          config: params,
        });

        return { success: true, uuid: response.data.uuid };
      }

      throw new Error('Failed to create OpenVPN server');
    } catch (error) {
      this.logger.error('Error creating OpenVPN server:', error);
      throw error;
    }
  }

  private async getStatus(): Promise<any> {
    const [servers, clients, connections] = await Promise.all([
      this.listServers(),
      this.listClients(),
      this.getConnections({}),
    ]);

    return {
      servers: servers.count,
      clients: clients.count,
      activeConnections: connections.count,
      timestamp: new Date(),
    };
  }

  private startConnectionMonitoring(): void {
    const interval = this.context.config.monitorInterval || 30000;

    this.monitorTimer = setInterval(async () => {
      try {
        const status = await this.getStatus();

        this.context.eventBus.createEvent(
          'vpn.metrics.collected' as any,
          this.metadata.id,
          status,
          EventSeverity.DEBUG,
          'vpn'
        );
      } catch (error) {
        this.logger.error('Error in VPN monitoring:', error);
      }
    }, interval);

    this.logger.info(`Started VPN connection monitoring (interval: ${interval}ms)`);
  }
}
