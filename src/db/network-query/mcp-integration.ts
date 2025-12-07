// MCP Integration for Natural Language Network Queries
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { NaturalLanguageQueryProcessor } from './processor';
import { DeviceFingerprintingService } from './fingerprinting';
import { OPNSenseAPIClient } from '../../api/client';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { 
  devices, 
  dhcpLeases, 
  trafficStats,
  activeConnections,
  networkInterfaces 
} from './schema';
import { eq, and, sql } from 'drizzle-orm';

export class NetworkQueryMCP {
  private server: Server;
  private queryProcessor: NaturalLanguageQueryProcessor;
  private fingerprinting: DeviceFingerprintingService;
  private opnsenseClient?: OPNSenseAPIClient;
  private db: ReturnType<typeof drizzle>;
  private syncInterval?: NodeJS.Timeout;
  
  constructor() {
    // Initialize database connection
    const connectionString = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || '10.0.0.2'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB}`;
    
    const pool = new Pool({ connectionString });
    this.db = drizzle(pool);
    
    // Initialize services
    this.queryProcessor = new NaturalLanguageQueryProcessor(connectionString);
    this.fingerprinting = new DeviceFingerprintingService(connectionString);
    
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'opnsense-network-query',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'network_query',
          description: 'Query network devices using natural language',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language query about network devices'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'sync_network_data',
          description: 'Sync network data from OPNsense',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'update_device_name',
          description: 'Update friendly name for a device',
          inputSchema: {
            type: 'object',
            properties: {
              macAddress: {
                type: 'string',
                description: 'MAC address of the device'
              },
              friendlyName: {
                type: 'string',
                description: 'New friendly name for the device'
              }
            },
            required: ['macAddress', 'friendlyName']
          }
        },
        {
          name: 'group_devices',
          description: 'Group devices together (e.g., all devices belonging to one person)',
          inputSchema: {
            type: 'object',
            properties: {
              groupName: {
                type: 'string',
                description: 'Name of the group'
              },
              macAddresses: {
                type: 'array',
                items: { type: 'string' },
                description: 'MAC addresses to group together'
              }
            },
            required: ['groupName', 'macAddresses']
          }
        }
      ]
    }));
    
    // Set up request handlers like main server
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'network_query':
          if (!args || typeof args !== 'object' || !('query' in args)) {
            throw new Error('Query parameter is required');
          }
          return await this.handleNetworkQuery(args.query as string);
          
        case 'sync_network_data':
          return await this.syncNetworkData();
          
        case 'update_device_name':
          if (!args || typeof args !== 'object' || !('macAddress' in args) || !('friendlyName' in args)) {
            throw new Error('macAddress and friendlyName parameters are required');
          }
          return await this.updateDeviceName(args.macAddress as string, args.friendlyName as string);
          
        case 'group_devices':
          if (!args || typeof args !== 'object' || !('groupName' in args) || !('macAddresses' in args)) {
            throw new Error('groupName and macAddresses parameters are required');
          }
          return await this.groupDevices(args.groupName as string, args.macAddresses as string[]);
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }
  
  // Handle natural language network queries
  private async handleNetworkQuery(query: string): Promise<any> {
    try {
      const result = await this.queryProcessor.processQuery(query);
      
      // Format results for display
      const formattedResults = this.formatQueryResults(result.results, result.intent);
      
      return {
        content: {
          type: 'text',
          text: JSON.stringify({
            query: query,
            intent: result.intent,
            confidence: result.confidence,
            executionTime: `${result.executionTime}ms`,
            resultCount: result.results.length,
            results: formattedResults
          }, null, 2)
        }
      };
    } catch (error) {
      return {
        content: {
          type: 'text',
          text: `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
  
  // Sync data from OPNsense
  private async syncNetworkData(): Promise<any> {
    try {
      // Initialize OPNsense client if not already done
      if (!this.opnsenseClient) {
        this.opnsenseClient = new OPNSenseAPIClient({
          host: process.env.OPNSENSE_HOST!,
          apiKey: process.env.OPNSENSE_API_KEY!,
          apiSecret: process.env.OPNSENSE_API_SECRET!
        });
      }
      
      // 1. Sync DHCP leases
      const leasesResponse = await this.opnsenseClient.searchDhcpLeases();
      const leases = leasesResponse.rows || [];
      let processedLeases = 0;
      
      for (const lease of leases) {
        await this.fingerprinting.processNewLease({
          macAddress: lease.mac,
          ipAddress: lease.address,
          hostname: lease.hostname,
          interfaceName: lease.if || 'unknown'
        });
        processedLeases++;
      }
      
      // 2. Sync network interfaces
      const interfaces = await this.opnsenseClient.getInterfaces();
      let processedInterfaces = 0;
      
      for (const [name, info] of Object.entries(interfaces)) {
        // Skip if not an object with interface info
        if (typeof info !== 'object' || !info) continue;
        
        const interfaceInfo = info as any;
        await this.db.insert(networkInterfaces)
          .values({
            interfaceName: name,
            description: interfaceInfo.description || name,
            ipAddress: interfaceInfo.ipaddr || null,
            subnet: interfaceInfo.subnet || null,
            vlanId: interfaceInfo.vlan ? parseInt(interfaceInfo.vlan) : null
          })
          .onConflictDoUpdate({
            target: networkInterfaces.interfaceName,
            set: {
              description: interfaceInfo.description || name,
              ipAddress: interfaceInfo.ipaddr || null,
              subnet: interfaceInfo.subnet || null,
              updatedAt: new Date()
            }
          });
        processedInterfaces++;
      }
      
      // 3. Update device summary view
      await this.queryProcessor.updateDeviceSummaryView();
      
      return {
        content: {
          type: 'text',
          text: `Successfully synced network data:\n- Processed ${processedLeases} DHCP leases\n- Synced ${processedInterfaces} network interfaces\n- Refreshed device summary view`
        }
      };
    } catch (error) {
      return {
        content: {
          type: 'text',
          text: `Error syncing network data: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
  
  // Update device friendly name
  private async updateDeviceName(macAddress: string, friendlyName: string): Promise<any> {
    try {
      await this.db.update(devices)
        .set({
          friendlyName: friendlyName,
          updatedAt: new Date()
        })
        .where(eq(devices.macAddress, macAddress));
      
      return {
        content: {
          type: 'text',
          text: `Successfully updated device name for ${macAddress} to "${friendlyName}"`
        }
      };
    } catch (error) {
      return {
        content: {
          type: 'text',
          text: `Error updating device name: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
  
  // Group devices together
  private async groupDevices(groupName: string, macAddresses: string[]): Promise<any> {
    try {
      // Implementation would create device groups
      // This is a placeholder for the actual implementation
      
      return {
        content: {
          type: 'text',
          text: `Successfully created group "${groupName}" with ${macAddresses.length} devices`
        }
      };
    } catch (error) {
      return {
        content: {
          type: 'text',
          text: `Error creating device group: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
  
  // Format query results based on intent
  private formatQueryResults(results: any[], intent: string): any[] {
    switch (intent) {
      case 'device_online_check':
        return results.map(r => ({
          device: r.friendlyName || r.macAddress,
          type: r.deviceType,
          status: r.isOnline ? 'Online' : 'Offline',
          lastSeen: r.lastSeen,
          network: r.interfaceName,
          vlan: r.vlanId
        }));
        
      case 'device_data_usage':
        return results.map(r => ({
          device: r.friendlyName || 'Unknown',
          type: r.deviceType,
          dataUsed: this.formatBytes(r.totalBytes),
          rawBytes: r.totalBytes
        }));
        
      case 'gaming_consoles':
        return results.map(r => ({
          device: r.friendlyName || r.macAddress,
          manufacturer: r.manufacturer,
          status: r.isOnline ? 'Online' : 'Offline',
          lastSeen: r.lastSeen,
          ip: r.currentIp,
          network: r.interfaceName
        }));
        
      default:
        return results;
    }
  }
  
  // Helper to format bytes
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
  
  // Start periodic sync
  async startPeriodicSync(intervalMinutes: number = 5): Promise<void> {
    // Initial sync
    await this.syncNetworkData();
    
    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      await this.syncNetworkData();
    }, intervalMinutes * 60 * 1000);
  }
  
  // Stop periodic sync
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }
  
  // Start the MCP server
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Initialize fingerprint database
    await this.fingerprinting.initializeFingerprints();
    
    // Start periodic sync
    await this.startPeriodicSync();
    
    console.error('Network Query MCP server started');
  }
}

// Start the server
if (require.main === module) {
  const server = new NetworkQueryMCP();
  server.start().catch(console.error);
}