#!/usr/bin/env node

// OPNsense MCP Server - Phase 3 Implementation
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

// Import our API client and resources
import { OPNSenseAPIClient } from './api/client.js';
import { VlanResource } from './resources/vlan.js';
import { FirewallRuleResource } from './resources/firewall/rule.js';
import { BackupManager } from './resources/backup/manager.js';
import { MCPCacheManager } from './cache/manager.js';
import { DhcpLeaseResource } from './resources/services/dhcp/leases.js';
import { DnsBlocklistResource } from './resources/services/dns/blocklist.js';

// Configuration schema
const ConfigSchema = z.object({
  host: z.string().url(),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  verifySsl: z.boolean().default(true)
});

class OPNSenseMCPServer {
  private server: Server;
  private client: OPNSenseAPIClient | null = null;
  private vlanResource: VlanResource | null = null;
  private firewallRuleResource: FirewallRuleResource | null = null;
  private backupManager: BackupManager | null = null;
  private cacheManager: MCPCacheManager | null = null;
  private dhcpResource: DhcpLeaseResource | null = null;
  private dnsBlocklistResource: DnsBlocklistResource | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'opnsense-mcp',
        version: '0.4.0',
        description: 'OPNsense firewall management via MCP with DNS filtering'
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

      // Initialize resources
      this.vlanResource = new VlanResource(this.client);
      this.firewallRuleResource = new FirewallRuleResource(this.client);
      this.dhcpResource = new DhcpLeaseResource(this.client);
      this.dnsBlocklistResource = new DnsBlocklistResource(this.client);
      
      // Initialize backup manager
      if (process.env.BACKUP_ENABLED !== 'false') {
        this.backupManager = new BackupManager(this.client, process.env.BACKUP_PATH);
      }
      
      // Initialize cache manager (optional)
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
          console.error('Cache manager initialized');
        } catch (error) {
          console.error('Cache manager disabled:', error instanceof Error ? error.message : 'Unknown error');
        }
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

        // VLAN Management Tools
        {
          name: 'list_vlans',
          description: 'List all VLANs',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_vlan',
          description: 'Get VLAN details',
          inputSchema: {
            type: 'object',
            properties: {
              tag: { type: 'string', description: 'VLAN tag number' }
            },
            required: ['tag']
          }
        },
        {
          name: 'create_vlan',
          description: 'Create a new VLAN',
          inputSchema: {
            type: 'object',
            properties: {
              interface: { type: 'string', description: 'Physical interface (e.g., igc3)' },
              tag: { type: 'string', description: 'VLAN tag (1-4094)' },
              description: { type: 'string', description: 'VLAN description' },
              pcp: { type: 'string', description: 'Priority Code Point (0-7)', default: '0' }
            },
            required: ['interface', 'tag']
          }
        },
        {
          name: 'delete_vlan',
          description: 'Delete a VLAN',
          inputSchema: {
            type: 'object',
            properties: {
              tag: { type: 'string', description: 'VLAN tag to delete' }
            },
            required: ['tag']
          }
        },
        {
          name: 'update_vlan',
          description: 'Update VLAN description',
          inputSchema: {
            type: 'object',
            properties: {
              tag: { type: 'string', description: 'VLAN tag' },
              description: { type: 'string', description: 'New description' }
            },
            required: ['tag', 'description']
          }
        },

        // Firewall Rule Management Tools
        {
          name: 'list_firewall_rules',
          description: 'List all firewall rules',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_firewall_rule',
          description: 'Get firewall rule details',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'Firewall rule UUID' }
            },
            required: ['uuid']
          }
        },
        {
          name: 'create_firewall_rule',
          description: 'Create a new firewall rule',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Rule action (pass/block/reject)', enum: ['pass', 'block', 'reject'] },
              interface: { type: 'string', description: 'Interface name' },
              direction: { type: 'string', description: 'Traffic direction', enum: ['in', 'out'] },
              protocol: { type: 'string', description: 'Protocol (any/tcp/udp/icmp)' },
              source: { type: 'string', description: 'Source address/network or "any"' },
              sourcePort: { type: 'string', description: 'Source port (for TCP/UDP)' },
              destination: { type: 'string', description: 'Destination address/network or "any"' },
              destinationPort: { type: 'string', description: 'Destination port (for TCP/UDP)' },
              description: { type: 'string', description: 'Rule description' },
              enabled: { type: 'boolean', description: 'Enable rule', default: true }
            },
            required: ['action', 'interface', 'direction', 'protocol', 'source', 'destination']
          }
        },
        {
          name: 'create_firewall_preset',
          description: 'Create a firewall rule from a preset',
          inputSchema: {
            type: 'object',
            properties: {
              preset: { 
                type: 'string', 
                description: 'Preset name', 
                enum: ['allow-web', 'allow-ssh', 'allow-minecraft', 'block-all'] 
              },
              interface: { type: 'string', description: 'Interface name' },
              source: { type: 'string', description: 'Source override (optional)' },
              destination: { type: 'string', description: 'Destination override (optional)' },
              description: { type: 'string', description: 'Description override (optional)' }
            },
            required: ['preset', 'interface']
          }
        },
        {
          name: 'update_firewall_rule',
          description: 'Update a firewall rule',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'Firewall rule UUID' },
              enabled: { type: 'boolean', description: 'Enable/disable rule' },
              description: { type: 'string', description: 'New description' },
              source: { type: 'string', description: 'New source' },
              destination: { type: 'string', description: 'New destination' },
              sourcePort: { type: 'string', description: 'New source port' },
              destinationPort: { type: 'string', description: 'New destination port' }
            },
            required: ['uuid']
          }
        },
        {
          name: 'delete_firewall_rule',
          description: 'Delete a firewall rule',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'Firewall rule UUID' }
            },
            required: ['uuid']
          }
        },
        {
          name: 'toggle_firewall_rule',
          description: 'Toggle firewall rule enabled/disabled',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'Firewall rule UUID' }
            },
            required: ['uuid']
          }
        },
        {
          name: 'find_firewall_rules',
          description: 'Find firewall rules by description',
          inputSchema: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Description to search for' }
            },
            required: ['description']
          }
        },

        // Backup Management Tools
        {
          name: 'create_backup',
          description: 'Create a configuration backup',
          inputSchema: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Backup description' }
            }
          }
        },
        {
          name: 'list_backups',
          description: 'List available backups',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'restore_backup',
          description: 'Restore a configuration backup',
          inputSchema: {
            type: 'object',
            properties: {
              backupId: { type: 'string', description: 'Backup ID to restore' }
            },
            required: ['backupId']
          }
        },

        // Utility tools
        {
          name: 'test_connection',
          description: 'Test API connection and authentication',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_interfaces',
          description: 'List available network interfaces',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },

        // DHCP Lease Management Tools
        {
          name: 'list_dhcp_leases',
          description: 'List all DHCP leases',
          inputSchema: {
            type: 'object',
            properties: {
              interface: { 
                type: 'string', 
                description: 'Filter by interface (optional)' 
              }
            }
          }
        },
        {
          name: 'find_device_by_name',
          description: 'Find devices by hostname pattern',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: { 
                type: 'string', 
                description: 'Hostname pattern to search (case-insensitive)' 
              }
            },
            required: ['pattern']
          }
        },
        {
          name: 'find_device_by_mac',
          description: 'Find device by MAC address',
          inputSchema: {
            type: 'object',
            properties: {
              mac: { 
                type: 'string', 
                description: 'MAC address (with or without colons)' 
              }
            },
            required: ['mac']
          }
        },
        {
          name: 'get_guest_devices',
          description: 'Get all devices on guest network (VLAN 4)',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_devices_by_interface',
          description: 'Group devices by network interface',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },

        // DNS Blocklist Management Tools
        {
          name: 'list_dns_blocklist',
          description: 'List all DNS blocklist entries',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'block_domain',
          description: 'Add a domain to the DNS blocklist',
          inputSchema: {
            type: 'object',
            properties: {
              domain: { 
                type: 'string', 
                description: 'Domain to block (e.g., pornhub.com)' 
              },
              description: {
                type: 'string',
                description: 'Optional description for the block'
              }
            },
            required: ['domain']
          }
        },
        {
          name: 'unblock_domain',
          description: 'Remove a domain from the DNS blocklist',
          inputSchema: {
            type: 'object',
            properties: {
              domain: { 
                type: 'string', 
                description: 'Domain to unblock' 
              }
            },
            required: ['domain']
          }
        },
        {
          name: 'block_multiple_domains',
          description: 'Block multiple domains at once',
          inputSchema: {
            type: 'object',
            properties: {
              domains: { 
                type: 'array',
                items: { type: 'string' },
                description: 'List of domains to block' 
              },
              description: {
                type: 'string',
                description: 'Optional description for the blocks'
              }
            },
            required: ['domains']
          }
        },
        {
          name: 'apply_blocklist_category',
          description: 'Apply a predefined category of domain blocks',
          inputSchema: {
            type: 'object',
            properties: {
              category: { 
                type: 'string',
                enum: ['adult', 'malware', 'ads', 'social'],
                description: 'Category of domains to block' 
              }
            },
            required: ['category']
          }
        },
        {
          name: 'search_dns_blocklist',
          description: 'Search DNS blocklist entries',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: { 
                type: 'string', 
                description: 'Pattern to search for in domains or descriptions' 
              }
            },
            required: ['pattern']
          }
        },
        {
          name: 'toggle_blocklist_entry',
          description: 'Enable/disable a DNS blocklist entry',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { 
                type: 'string', 
                description: 'UUID of the blocklist entry' 
              }
            },
            required: ['uuid']
          }
        }
      ]
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
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
          uri: 'opnsense://interfaces',
          name: 'Network Interfaces',
          description: 'Available network interfaces',
          mimeType: 'application/json'
        },
        {
          uri: 'opnsense://status',
          name: 'Connection Status',
          description: 'OPNsense connection status',
          mimeType: 'application/json'
        },
        {
          uri: 'opnsense://dhcp/leases',
          name: 'DHCP Leases',
          description: 'Current DHCP leases',
          mimeType: 'application/json'
        },
        {
          uri: 'opnsense://dns/blocklist',
          name: 'DNS Blocklist',
          description: 'DNS blocklist entries',
          mimeType: 'application/json'
        }
      ]
    }));

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (!this.client || !this.vlanResource || !this.firewallRuleResource) {
        throw new McpError(
          ErrorCode.InternalError,
          'OPNsense client not initialized. Use configure tool first.'
        );
      }

      const uri = request.params.uri;

      switch (uri) {
        case 'opnsense://vlans': {
          const vlans = await this.vlanResource.list();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(vlans, null, 2)
            }]
          };
        }

        case 'opnsense://firewall/rules': {
          const rules = await this.firewallRuleResource.list();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(rules, null, 2)
            }]
          };
        }

        case 'opnsense://interfaces': {
          const interfaces = await this.vlanResource.getAvailableInterfaces();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(interfaces, null, 2)
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

        case 'opnsense://dhcp/leases': {
          if (!this.dhcpResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'DHCP resource not initialized'
            );
          }
          const leases = await this.dhcpResource.listLeases();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(leases, null, 2)
            }]
          };
        }

        case 'opnsense://dns/blocklist': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'DNS blocklist resource not initialized'
            );
          }
          const blocklist = await this.dnsBlocklistResource.list();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(blocklist, null, 2)
            }]
          };
        }

        default:
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource: ${uri}`
          );
      }
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'configure': {
          if (!args) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Configuration parameters are required'
            );
          }
          
          try {
            const config = ConfigSchema.parse(args);
            this.client = new OPNSenseAPIClient(config);
            const test = await this.client.testConnection();
            
            if (test.success) {
              this.vlanResource = new VlanResource(this.client);
              this.firewallRuleResource = new FirewallRuleResource(this.client);
              this.dhcpResource = new DhcpLeaseResource(this.client);
              this.dnsBlocklistResource = new DnsBlocklistResource(this.client);
              
              // Optional backup manager
              if (process.env.BACKUP_ENABLED !== 'false') {
                this.backupManager = new BackupManager(this.client, process.env.BACKUP_PATH);
              }
              
              // Optional cache manager
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
                } catch (error) {
                  console.error('Cache not available');
                }
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

        case 'list_vlans': {
          if (!this.vlanResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          const vlans = await this.vlanResource.list();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(vlans, null, 2)
            }]
          };
        }

        case 'get_vlan': {
          if (!this.vlanResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          if (!args || !args.tag) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'tag parameter is required'
            );
          }
          const vlan = await this.vlanResource.findByTag(args.tag as string);
          if (!vlan) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `VLAN ${args.tag} not found`
            );
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(vlan, null, 2)
            }]
          };
        }

        case 'create_vlan': {
          if (!this.vlanResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.interface || !args.tag) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interface and tag parameters are required'
            );
          }
          
          try {
            const result = await this.vlanResource.create({
              if: args.interface as string,
              tag: args.tag as string,
              descr: args.description as string || '',
              pcp: args.pcp as string || '0'
            });
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created VLAN ${args.tag} with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'delete_vlan': {
          if (!this.vlanResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.tag) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'tag parameter is required'
            );
          }
          
          try {
            await this.vlanResource.deleteByTag(args.tag as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully deleted VLAN ${args.tag}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'update_vlan': {
          if (!this.vlanResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.tag || !args.description) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'tag and description parameters are required'
            );
          }
          
          try {
            const vlan = await this.vlanResource.findByTag(args.tag as string);
            if (!vlan || !vlan.uuid) {
              throw new Error(`VLAN ${args.tag} not found`);
            }
            
            await this.vlanResource.update(vlan.uuid, {
              descr: args.description as string
            });
            
            return {
              content: [{
                type: 'text',
                text: `Successfully updated VLAN ${args.tag}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'get_interfaces': {
          if (!this.vlanResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          const interfaces = await this.vlanResource.getAvailableInterfaces();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(interfaces, null, 2)
            }]
          };
        }

        // Firewall Rule Management
        case 'list_firewall_rules': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          const rules = await this.firewallRuleResource.list();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(rules, null, 2)
            }]
          };
        }

        case 'get_firewall_rule': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          const rule = await this.firewallRuleResource.get(args.uuid as string);
          if (!rule) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Firewall rule ${args.uuid} not found`
            );
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(rule, null, 2)
            }]
          };
        }

        case 'create_firewall_rule': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.action || !args.interface || !args.direction || 
              !args.protocol || !args.source || !args.destination) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'action, interface, direction, protocol, source, and destination are required'
            );
          }
          
          try {
            const result = await this.firewallRuleResource.create({
              enabled: args.enabled !== false ? '1' : '0',
              action: args.action as string,
              interface: args.interface as string,
              direction: args.direction as string,
              ipprotocol: 'inet',  // Default to IPv4
              protocol: args.protocol as string,
              source_net: args.source as string,
              source_port: args.sourcePort as string || '',
              destination_net: args.destination as string,
              destination_port: args.destinationPort as string || '',
              description: args.description as string || ''
            });
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created firewall rule with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'create_firewall_preset': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.preset || !args.interface) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'preset and interface parameters are required'
            );
          }
          
          try {
            const presetRule = this.firewallRuleResource.createPreset(
              args.preset as string,
              {
                source: args.source,
                destination: args.destination,
                description: args.description
              }
            );
            
            const result = await this.firewallRuleResource.create({
              ...presetRule,
              interface: args.interface as string
            } as any);
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created ${args.preset} firewall rule with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'update_firewall_rule': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            const updates: any = {};
            
            if (args.enabled !== undefined) {
              updates.enabled = args.enabled ? '1' : '0';
            }
            if (args.description !== undefined) {
              updates.description = args.description;
            }
            if (args.source !== undefined) {
              updates.source_net = args.source;
            }
            if (args.destination !== undefined) {
              updates.destination_net = args.destination;
            }
            if (args.sourcePort !== undefined) {
              updates.source_port = args.sourcePort;
            }
            if (args.destinationPort !== undefined) {
              updates.destination_port = args.destinationPort;
            }
            
            await this.firewallRuleResource.update(args.uuid as string, updates);
            
            return {
              content: [{
                type: 'text',
                text: `Successfully updated firewall rule ${args.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'delete_firewall_rule': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.firewallRuleResource.delete(args.uuid as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully deleted firewall rule ${args.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'toggle_firewall_rule': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.firewallRuleResource.toggle(args.uuid as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully toggled firewall rule ${args.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'find_firewall_rules': {
          if (!this.firewallRuleResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.description) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'description parameter is required'
            );
          }
          
          try {
            const rules = await this.firewallRuleResource.findByDescription(args.description as string);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(rules, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // Backup Management
        case 'create_backup': {
          if (!this.backupManager) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          try {
            const backup = await this.backupManager.createBackup({
              description: args?.description as string || 'Manual backup from Claude'
            });
            return {
              content: [{
                type: 'text',
                text: `Backup created successfully:\nID: ${backup.id}\nDescription: ${backup.description}\nTimestamp: ${backup.timestamp}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'list_backups': {
          if (!this.backupManager) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          const backups = await this.backupManager.listBackups();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(backups, null, 2)
            }]
          };
        }

        case 'restore_backup': {
          if (!this.backupManager) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.backupId) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'backupId parameter is required'
            );
          }
          
          try {
            const success = await this.backupManager.restoreBackup(args.backupId as string);
            return {
              content: [{
                type: 'text',
                text: success ? 
                  `Backup ${args.backupId} restored successfully` :
                  `Failed to restore backup ${args.backupId}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // DHCP Lease Management
        case 'list_dhcp_leases': {
          if (!this.dhcpResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          try {
            const leases = await this.dhcpResource.listLeases();
            
            // Filter by interface if specified
            const filtered = args?.interface 
              ? leases.filter(l => l.if === args.interface)
              : leases;
            
            // Format for display
            const formatted = filtered.map(lease => ({
              hostname: lease.hostname || 'Unknown Device',
              ip: lease.address,
              mac: lease.hwaddr,
              interface: lease.if,
              state: lease.state,
              starts: lease.starts,
              ends: lease.ends,
              deviceInfo: this.dhcpResource!.getDeviceInfo(lease)
            }));
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(formatted, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to list DHCP leases: ${error.message}`
            );
          }
        }

        case 'find_device_by_name': {
          if (!this.dhcpResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.pattern) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'pattern parameter is required'
            );
          }
          
          try {
            const results = await this.dhcpResource.findByHostname(args.pattern as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No devices found matching pattern "${args.pattern}"`
                }]
              };
            }
            
            const formatted = results.map(lease => 
              this.dhcpResource!.formatLease(lease)
            );
            
            return {
              content: [{
                type: 'text',
                text: `Found ${results.length} device(s):\n\n${formatted.join('\n')}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search devices: ${error.message}`
            );
          }
        }

        case 'find_device_by_mac': {
          if (!this.dhcpResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.mac) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'mac parameter is required'
            );
          }
          
          try {
            const results = await this.dhcpResource.findByMac(args.mac as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No device found with MAC address "${args.mac}"`
                }]
              };
            }
            
            const formatted = results.map(lease => 
              this.dhcpResource!.formatLease(lease)
            );
            
            return {
              content: [{
                type: 'text',
                text: formatted.join('\n')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search by MAC: ${error.message}`
            );
          }
        }

        case 'get_guest_devices': {
          if (!this.dhcpResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          try {
            const guestDevices = await this.dhcpResource.getGuestLeases();
            
            if (guestDevices.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: 'No devices currently connected to guest network'
                }]
              };
            }
            
            const formatted = guestDevices.map(lease => {
              const info = this.dhcpResource!.getDeviceInfo(lease);
              return `• ${info}`;
            });
            
            return {
              content: [{
                type: 'text',
                text: `${guestDevices.length} device(s) on guest network:\n\n${formatted.join('\n')}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get guest devices: ${error.message}`
            );
          }
        }

        case 'get_devices_by_interface': {
          if (!this.dhcpResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          try {
            const byInterface = await this.dhcpResource.getLeasesByInterface();
            
            let output = 'Devices by Interface:\n\n';
            
            for (const [iface, devices] of byInterface) {
              output += `${iface}: ${devices.length} device(s)\n`;
              
              // Show first few devices per interface
              const preview = devices.slice(0, 3);
              for (const device of preview) {
                const hostname = device.hostname || 'Unknown';
                output += `  • ${hostname} (${device.address})\n`;
              }
              
              if (devices.length > 3) {
                output += `  ... and ${devices.length - 3} more\n`;
              }
              
              output += '\n';
            }
            
            return {
              content: [{
                type: 'text',
                text: output
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to group devices: ${error.message}`
            );
          }
        }

        // DNS Blocklist Management
        case 'list_dns_blocklist': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          try {
            const blocklist = await this.dnsBlocklistResource.list();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(blocklist, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to list DNS blocklist: ${error.message}`
            );
          }
        }

        case 'block_domain': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.domain) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'domain parameter is required'
            );
          }
          
          try {
            const result = await this.dnsBlocklistResource.blockDomain(
              args.domain as string,
              args.description as string
            );
            
            return {
              content: [{
                type: 'text',
                text: `Successfully blocked domain ${args.domain} with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'unblock_domain': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.domain) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'domain parameter is required'
            );
          }
          
          try {
            await this.dnsBlocklistResource.unblockDomain(args.domain as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully unblocked domain ${args.domain}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'block_multiple_domains': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.domains || !Array.isArray(args.domains)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'domains array parameter is required'
            );
          }
          
          try {
            const result = await this.dnsBlocklistResource.blockMultipleDomains(
              args.domains as string[],
              args.description as string
            );
            
            return {
              content: [{
                type: 'text',
                text: `Blocked ${result.blocked.length} domains successfully.\n` +
                      (result.failed.length > 0 ? `Failed to block: ${result.failed.join(', ')}` : '')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'apply_blocklist_category': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.category) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'category parameter is required'
            );
          }
          
          try {
            const result = await this.dnsBlocklistResource.applyBlocklistCategory(
              args.category as 'adult' | 'malware' | 'ads' | 'social'
            );
            
            return {
              content: [{
                type: 'text',
                text: `Applied ${args.category} blocklist category.\n` +
                      `Blocked ${result.blocked.length} domains successfully.\n` +
                      (result.failed.length > 0 ? `Failed to block: ${result.failed.join(', ')}` : '')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'search_dns_blocklist': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.pattern) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'pattern parameter is required'
            );
          }
          
          try {
            const results = await this.dnsBlocklistResource.searchBlocklist(args.pattern as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No blocklist entries found matching pattern "${args.pattern}"`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: `Found ${results.length} blocklist entries:\n\n` +
                      results.map(entry => 
                        `• ${entry.host} ${entry.enabled ? '(enabled)' : '(disabled)'}` +
                        (entry.description ? ` - ${entry.description}` : '')
                      ).join('\n')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search blocklist: ${error.message}`
            );
          }
        }

        case 'toggle_blocklist_entry': {
          if (!this.dnsBlocklistResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'Not configured. Use configure tool first.'
            );
          }
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.dnsBlocklistResource.toggleBlocklistEntry(args.uuid as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully toggled blocklist entry ${args.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    });
  }

  async start() {
    try {
      // Try to initialize with environment variables
      await this.initialize();
    } catch (error) {
      console.error('Auto-initialization failed. Use configure tool to set up connection.');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OPNsense MCP server running on stdio');
  }
}

// Start the server
const server = new OPNSenseMCPServer();
server.start().catch(console.error);
