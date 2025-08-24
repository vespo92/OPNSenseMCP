#!/usr/bin/env node

// OPNsense MCP Server - Phase 3 Implementation with Dual Transport Support
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
import { logger } from './utils/logger.js';

// Environment variables are provided by Claude Desktop/Code
// No need for dotenv - configuration comes from MCP client

// Import transport management
import { TransportManager } from './transports/TransportManager.js';
import { SSETransportServer } from './transports/SSETransportServer.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// Import our API client and resources
import { OPNSenseAPIClient } from './api/client.js';
import { VlanResource } from './resources/vlan.js';
import { FirewallRuleResource } from './resources/firewall/rule.js';
import { NATResource } from './resources/firewall/nat.js';
import { BackupManager } from './resources/backup/manager.js';
import { MCPCacheManager } from './cache/manager.js';
import { DhcpLeaseResource } from './resources/services/dhcp/leases.js';
import { DnsBlocklistResource } from './resources/services/dns/blocklist.js';
import { HAProxyResource } from './resources/services/haproxy/index.js';
import { MacroRecorder } from './macro/index.js';
import { ArpTableResource } from './resources/network/arp.js';
import SystemSettingsResource from './resources/system/settings.js';
import InterfaceConfigResource from './resources/network/interfaces.js';
import RoutingDiagnosticsResource from './resources/diagnostics/routing.js';
import CLIExecutorResource from './resources/cli/executor.js';
import SSHExecutor from './resources/ssh/executor.js';

// Import IaC components
import { resourceRegistry } from './resources/registry.js';
import { DeploymentPlanner } from './deployment/planner.js';
import { ExecutionEngine } from './execution/engine.js';
import { ResourceStateStore } from './state/store.js';

// Import IaC resource definitions to register them
import './resources/network/vlan-iac.js';
import './resources/firewall/rule-iac.js';

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
  private natResource: NATResource | null = null;
  private backupManager: BackupManager | null = null;
  private cacheManager: MCPCacheManager | null = null;
  private dhcpResource: DhcpLeaseResource | null = null;
  private dnsBlocklistResource: DnsBlocklistResource | null = null;
  private haproxyResource: HAProxyResource | null = null;
  private macroRecorder: MacroRecorder | null = null;
  private arpResource: ArpTableResource | null = null;
  private systemSettingsResource: SystemSettingsResource | null = null;
  private interfaceConfigResource: InterfaceConfigResource | null = null;
  private routingDiagnosticsResource: RoutingDiagnosticsResource | null = null;
  private cliExecutor: CLIExecutorResource | null = null;
  private sshExecutor: SSHExecutor | null = null;
  
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
        version: '0.8.0',
        description: 'OPNsense firewall management via MCP with CLI execution, IaC, ARP table, DNS filtering and HAProxy support'
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

  private formatHostUrl(host: string): string {
    // If host doesn't start with http:// or https://, add https://
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      return `https://${host}`;
    }
    return host;
  }

  private async initialize() {
    try {
      // Check if we have environment variables configured
      if (!process.env.OPNSENSE_HOST || !process.env.OPNSENSE_API_KEY || !process.env.OPNSENSE_API_SECRET) {
        logger.info('OPNsense environment variables not configured. Server will start but requires configure tool to be called.');
        return false;
      }

      // Validate configuration
      const config = ConfigSchema.parse({
        host: this.formatHostUrl(process.env.OPNSENSE_HOST),
        apiKey: process.env.OPNSENSE_API_KEY,
        apiSecret: process.env.OPNSENSE_API_SECRET,
        verifySsl: process.env.OPNSENSE_VERIFY_SSL !== 'false'
      });

      // Create API client
      this.client = new OPNSenseAPIClient(config);
      
      // Initialize macro recorder
      this.macroRecorder = new MacroRecorder(this.client, process.env.MACRO_STORAGE_PATH);
      
      // Set up recording in the API client
      this.client.setRecorder((call) => this.macroRecorder?.recordAPICall(call));
      
      // Test connection
      const connectionTest = await this.client.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Failed to connect to OPNsense: ${connectionTest.error}`);
      }

      logger.info(`Connected to OPNsense ${connectionTest.version}`);

      // Initialize resources
      this.vlanResource = new VlanResource(this.client);
      this.firewallRuleResource = new FirewallRuleResource(this.client);
      this.natResource = new NATResource(this.client);
      this.dhcpResource = new DhcpLeaseResource(this.client);
      this.dnsBlocklistResource = new DnsBlocklistResource(this.client);
      this.haproxyResource = new HAProxyResource(this.client);
      this.arpResource = new ArpTableResource(this.client);
      this.systemSettingsResource = new SystemSettingsResource(this.client);
      this.interfaceConfigResource = new InterfaceConfigResource(this.client);
      this.routingDiagnosticsResource = new RoutingDiagnosticsResource(this.client);
      this.cliExecutor = new CLIExecutorResource(this.client);
      
      // Initialize SSH executor for direct CLI access
      this.sshExecutor = new SSHExecutor();
      
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
          logger.info('Cache manager initialized');
        } catch (error) {
          logger.warn('Cache manager disabled:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      // Initialize IaC components if enabled
      if (this.iacEnabled) {
        logger.info('Initializing IaC components...');
        this.stateStore = new ResourceStateStore();
        this.planner = new DeploymentPlanner();
        this.engine = new ExecutionEngine(this.client);
        logger.info('IaC components initialized');
      }

      return true;
    } catch (error) {
      logger.error('Failed to initialize OPNsense MCP server:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.client) {
      // Try to initialize with environment variables
      const initialized = await this.initialize();
      if (!initialized) {
        throw new McpError(
          ErrorCode.InternalError,
          'OPNsense client not initialized. Use configure tool first.'
        );
      }
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

        // ARP Table Management Tools
        {
          name: 'list_arp_entries',
          description: 'List all ARP table entries',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'find_arp_by_ip',
          description: 'Find ARP entries by IP address or subnet',
          inputSchema: {
            type: 'object',
            properties: {
              ipPattern: {
                type: 'string',
                description: 'IP address, prefix, or subnet (e.g., "10.0.6", "10.0.6.0/24")'
              }
            },
            required: ['ipPattern']
          }
        },
        {
          name: 'find_arp_by_mac',
          description: 'Find ARP entries by MAC address',
          inputSchema: {
            type: 'object',
            properties: {
              macPattern: {
                type: 'string',
                description: 'MAC address or partial MAC (with or without colons)'
              }
            },
            required: ['macPattern']
          }
        },
        {
          name: 'find_arp_by_interface',
          description: 'Find ARP entries on specific interface',
          inputSchema: {
            type: 'object',
            properties: {
              interface: {
                type: 'string',
                description: 'Interface name (e.g., "igc3_vlan6", "lan")'
              }
            },
            required: ['interface']
          }
        },
        {
          name: 'find_arp_by_hostname',
          description: 'Find ARP entries by hostname pattern',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'Hostname pattern to search'
              }
            },
            required: ['pattern']
          }
        },
        {
          name: 'get_arp_stats',
          description: 'Get ARP table statistics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'find_devices_on_vlan',
          description: 'Find devices on specific VLAN',
          inputSchema: {
            type: 'object',
            properties: {
              vlanTag: {
                type: 'string',
                description: 'VLAN tag number (e.g., "6" for DMZ)'
              }
            },
            required: ['vlanTag']
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
        },

        // HAProxy Service Control
        {
          name: 'haproxy_service_control',
          description: 'Control HAProxy service (start, stop, restart, reload)',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['start', 'stop', 'restart', 'reload', 'status'],
                description: 'Service action to perform'
              }
            },
            required: ['action']
          }
        },

        // System Settings Management
        {
          name: 'system_get_settings',
          description: 'Get system-level firewall and routing settings',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'system_enable_intervlan_routing',
          description: 'Enable inter-VLAN routing at the system level',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'system_update_firewall_settings',
          description: 'Update system firewall settings',
          inputSchema: {
            type: 'object',
            properties: {
              blockprivatenetworks: { type: 'string', description: '0 to allow private networks, 1 to block' },
              blockbogons: { type: 'string', description: '0 to allow bogons, 1 to block' },
              allowinterlantraffic: { type: 'string', description: '1 to enable inter-LAN traffic' },
              bypassstaticroutes: { type: 'string', description: '1 to bypass firewall for static routes' },
              disablereplyto: { type: 'string', description: '1 to disable reply-to' }
            }
          }
        },

        // Interface Configuration Management
        {
          name: 'interface_list_overview',
          description: 'List all network interfaces with their overview',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'interface_get_config',
          description: 'Get detailed configuration for a specific interface',
          inputSchema: {
            type: 'object',
            properties: {
              interfaceName: { type: 'string', description: 'Interface name (e.g., lan, wan, opt8)' }
            },
            required: ['interfaceName']
          }
        },
        {
          name: 'interface_enable_intervlan_routing',
          description: 'Enable inter-VLAN routing on a specific interface',
          inputSchema: {
            type: 'object',
            properties: {
              interfaceName: { type: 'string', description: 'Interface name (e.g., opt8 for DMZ)' }
            },
            required: ['interfaceName']
          }
        },
        {
          name: 'interface_enable_intervlan_all',
          description: 'Enable inter-VLAN routing on all interfaces',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'interface_configure_dmz',
          description: 'Configure DMZ interface for inter-VLAN routing',
          inputSchema: {
            type: 'object',
            properties: {
              dmzInterface: { type: 'string', description: 'DMZ interface name', default: 'opt8' }
            }
          }
        },
        {
          name: 'interface_update_config',
          description: 'Update interface configuration',
          inputSchema: {
            type: 'object',
            properties: {
              interfaceName: { type: 'string', description: 'Interface name' },
              blockpriv: { type: 'string', description: '0 to allow private networks, 1 to block' },
              blockbogons: { type: 'string', description: '0 to allow bogons, 1 to block' },
              enable: { type: 'string', description: '1 to enable interface, 0 to disable' },
              disableftpproxy: { type: 'string', description: '1 to disable FTP proxy' }
            },
            required: ['interfaceName']
          }
        },

        // Routing Diagnostics and Fixes
        {
          name: 'routing_diagnostics',
          description: 'Run comprehensive inter-VLAN routing diagnostics',
          inputSchema: {
            type: 'object',
            properties: {
              sourceNetwork: { 
                type: 'string', 
                description: 'Source network (e.g., 10.0.6.0/24 for DMZ)' 
              },
              destNetwork: { 
                type: 'string', 
                description: 'Destination network (e.g., 10.0.0.0/24 for LAN)' 
              }
            }
          }
        },
        {
          name: 'routing_fix_all',
          description: 'Automatically fix all detected inter-VLAN routing issues',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'routing_fix_dmz',
          description: 'Quick fix for DMZ to LAN routing (includes NFS rules)',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'routing_create_intervlan_rules',
          description: 'Create firewall rules for inter-VLAN routing',
          inputSchema: {
            type: 'object',
            properties: {
              sourceNetwork: { 
                type: 'string', 
                description: 'Source network (e.g., 10.0.6.0/24)' 
              },
              destNetwork: { 
                type: 'string', 
                description: 'Destination network (e.g., 10.0.0.0/24)' 
              },
              bidirectional: { 
                type: 'boolean', 
                description: 'Create rules in both directions',
                default: true
              }
            },
            required: ['sourceNetwork', 'destNetwork']
          }
        },

        // CLI Execution Tools
        {
          name: 'cli_execute',
          description: 'Execute a CLI command on OPNsense for advanced configuration',
          inputSchema: {
            type: 'object',
            properties: {
              command: { 
                type: 'string', 
                description: 'Command to execute (e.g., configctl, pfctl, netstat)' 
              },
              args: { 
                type: 'array',
                items: { type: 'string' },
                description: 'Command arguments' 
              },
              timeout: { 
                type: 'number', 
                description: 'Timeout in milliseconds',
                default: 30000
              }
            },
            required: ['command']
          }
        },
        {
          name: 'cli_fix_interface_blocking',
          description: 'Fix interface blocking settings via CLI (for DMZ routing issues)',
          inputSchema: {
            type: 'object',
            properties: {
              interfaceName: { 
                type: 'string', 
                description: 'Interface name (e.g., opt8 for DMZ)' 
              }
            },
            required: ['interfaceName']
          }
        },
        {
          name: 'cli_reload_firewall',
          description: 'Reload firewall rules via CLI',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'cli_show_routing',
          description: 'Show routing table via CLI',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'cli_fix_dmz_routing',
          description: 'Comprehensive DMZ routing fix via CLI',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'cli_check_nfs',
          description: 'Check NFS connectivity from DMZ',
          inputSchema: {
            type: 'object',
            properties: {
              truenasIP: { 
                type: 'string', 
                description: 'TrueNAS IP address',
                default: '10.0.0.14'
              }
            }
          }
        },
        {
          name: 'cli_apply_changes',
          description: 'Apply all configuration changes via CLI',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },

        // HAProxy Backend Management
        {
          name: 'haproxy_backend_create',
          description: 'Create a new HAProxy backend',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Backend name' },
              mode: { type: 'string', enum: ['http', 'tcp'], description: 'Backend mode' },
              balance: {
                type: 'string',
                enum: ['roundrobin', 'leastconn', 'source', 'uri', 'hdr', 'random'],
                description: 'Load balancing algorithm'
              },
              servers: {
                type: 'array',
                description: 'List of backend servers',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    address: { type: 'string' },
                    port: { type: 'number' },
                    ssl: { type: 'boolean' },
                    verify: { type: 'string', enum: ['none', 'required'] }
                  },
                  required: ['name', 'address', 'port']
                }
              },
              description: { type: 'string' }
            },
            required: ['name', 'mode', 'balance']
          }
        },
        {
          name: 'haproxy_backend_list',
          description: 'List all HAProxy backends',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'haproxy_backend_delete',
          description: 'Delete an HAProxy backend',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'Backend UUID' }
            },
            required: ['uuid']
          }
        },

        // HAProxy Frontend Management
        {
          name: 'haproxy_frontend_create',
          description: 'Create a new HAProxy frontend',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Frontend name' },
              bind: { type: 'string', description: 'Bind address (e.g., 0.0.0.0:443)' },
              ssl: { type: 'boolean', description: 'Enable SSL' },
              certificates: {
                type: 'array',
                items: { type: 'string' },
                description: 'Certificate UUIDs or names'
              },
              mode: { type: 'string', enum: ['http', 'tcp'], description: 'Frontend mode' },
              backend: { type: 'string', description: 'Default backend name' },
              acls: {
                type: 'array',
                description: 'Access control lists',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    expression: { type: 'string' }
                  },
                  required: ['name', 'expression']
                }
              },
              description: { type: 'string' }
            },
            required: ['name', 'bind', 'mode', 'backend']
          }
        },
        {
          name: 'haproxy_frontend_list',
          description: 'List all HAProxy frontends',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'haproxy_frontend_delete',
          description: 'Delete an HAProxy frontend',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'Frontend UUID' }
            },
            required: ['uuid']
          }
        },

        // HAProxy Certificate Management
        {
          name: 'haproxy_certificate_list',
          description: 'List available certificates for HAProxy',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'haproxy_certificate_create',
          description: 'Create a certificate for HAProxy',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Certificate name' },
              type: {
                type: 'string',
                enum: ['selfsigned', 'import', 'acme'],
                description: 'Certificate type'
              },
              cn: { type: 'string', description: 'Common name (for self-signed)' },
              san: {
                type: 'array',
                items: { type: 'string' },
                description: 'Subject alternative names'
              },
              certificate: { type: 'string', description: 'Certificate content (for import)' },
              key: { type: 'string', description: 'Private key (for import)' },
              ca: { type: 'string', description: 'CA certificate (for import)' }
            },
            required: ['name', 'type']
          }
        },

        // HAProxy ACL Management
        {
          name: 'haproxy_acl_create',
          description: 'Create an ACL for HAProxy frontend',
          inputSchema: {
            type: 'object',
            properties: {
              frontend: { type: 'string', description: 'Frontend UUID' },
              name: { type: 'string', description: 'ACL name' },
              expression: { type: 'string', description: 'ACL expression' }
            },
            required: ['frontend', 'name', 'expression']
          }
        },

        // HAProxy Action Management
        {
          name: 'haproxy_action_create',
          description: 'Create an action for HAProxy frontend',
          inputSchema: {
            type: 'object',
            properties: {
              frontend: { type: 'string', description: 'Frontend UUID' },
              type: {
                type: 'string',
                enum: ['use_backend', 'redirect', 'add_header', 'set_header', 'del_header'],
                description: 'Action type'
              },
              backend: { type: 'string', description: 'Backend name (for use_backend)' },
              condition: { type: 'string', description: 'ACL condition' },
              value: { type: 'string', description: 'Action value' }
            },
            required: ['frontend', 'type']
          }
        },

        // HAProxy Stats
        {
          name: 'haproxy_stats',
          description: 'Get HAProxy statistics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'haproxy_backend_health',
          description: 'Get health status of a specific backend',
          inputSchema: {
            type: 'object',
            properties: {
              backend: { type: 'string', description: 'Backend name' }
            },
            required: ['backend']
          }
        },

        // Macro Recording Tools
        {
          name: 'macro_start_recording',
          description: 'Start recording API calls to create a macro',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Macro name' },
              description: { type: 'string', description: 'Macro description' }
            },
            required: ['name', 'description']
          }
        },
        {
          name: 'macro_stop_recording',
          description: 'Stop recording and save the macro',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'macro_list',
          description: 'List all saved macros',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'macro_play',
          description: 'Play a saved macro',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Macro ID' },
              parameters: { 
                type: 'object', 
                description: 'Parameters to substitute in the macro',
                additionalProperties: true
              },
              dryRun: { 
                type: 'boolean', 
                description: 'Execute in dry-run mode without making actual API calls',
                default: false
              }
            },
            required: ['id']
          }
        },
        {
          name: 'macro_delete',
          description: 'Delete a saved macro',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Macro ID' }
            },
            required: ['id']
          }
        },
        {
          name: 'macro_analyze',
          description: 'Analyze a macro to detect patterns and parameters',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Macro ID' }
            },
            required: ['id']
          }
        },
        {
          name: 'macro_generate_tool',
          description: 'Generate an MCP tool definition from a macro',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Macro ID' },
              save: { 
                type: 'boolean', 
                description: 'Save the generated tool to a file',
                default: false
              }
            },
            required: ['id']
          }
        },
        {
          name: 'macro_export',
          description: 'Export all macros to a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Export file path' }
            },
            required: ['path']
          }
        },
        {
          name: 'macro_import',
          description: 'Import macros from a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Import file path' },
              overwrite: { 
                type: 'boolean', 
                description: 'Overwrite existing macros',
                default: false
              }
            },
            required: ['path']
          }
        },
        
        // IaC Tools (only if enabled)
        ...(this.iacEnabled ? [
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
        ] : []),
        
        // SSH Execution Tools
        {
          name: 'ssh_execute',
          description: 'Execute arbitrary command via SSH on OPNsense (full CLI access)',
          inputSchema: {
            type: 'object',
            properties: {
              command: { 
                type: 'string', 
                description: 'Command to execute via SSH' 
              },
              timeout: { 
                type: 'number', 
                description: 'Timeout in milliseconds',
                default: 30000
              },
              sudo: {
                type: 'boolean',
                description: 'Execute command with sudo',
                default: false
              }
            },
            required: ['command']
          }
        },
        {
          name: 'ssh_fix_interface_blocking',
          description: 'Fix interface blocking settings via SSH (resolves DMZ routing issues)',
          inputSchema: {
            type: 'object',
            properties: {
              interface: { 
                type: 'string', 
                description: 'Interface name (e.g., opt8 for DMZ)' 
              }
            },
            required: ['interface']
          }
        },
        {
          name: 'ssh_fix_dmz_routing',
          description: 'Apply comprehensive DMZ routing fix via SSH',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ssh_enable_intervlan_routing',
          description: 'Enable inter-VLAN routing via SSH',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ssh_reload_firewall',
          description: 'Reload firewall rules via SSH',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ssh_show_routing',
          description: 'Show routing table via SSH',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ssh_show_pf_rules',
          description: 'Show packet filter rules via SSH',
          inputSchema: {
            type: 'object',
            properties: {
              verbose: {
                type: 'boolean',
                description: 'Show verbose output',
                default: false
              }
            }
          }
        },
        {
          name: 'ssh_backup_config',
          description: 'Backup OPNsense configuration via SSH',
          inputSchema: {
            type: 'object',
            properties: {
              backupName: {
                type: 'string',
                description: 'Optional backup filename'
              }
            }
          }
        },
        {
          name: 'ssh_restore_config',
          description: 'Restore OPNsense configuration via SSH',
          inputSchema: {
            type: 'object',
            properties: {
              backupPath: {
                type: 'string',
                description: 'Path to backup file to restore'
              }
            },
            required: ['backupPath']
          }
        },
        {
          name: 'ssh_check_nfs_connectivity',
          description: 'Check NFS connectivity from OPNsense',
          inputSchema: {
            type: 'object',
            properties: {
              targetIP: {
                type: 'string',
                description: 'Target NFS server IP',
                default: '10.0.0.14'
              }
            }
          }
        },
        {
          name: 'ssh_system_status',
          description: 'Get comprehensive system status via SSH',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },

        // NAT Management Tools
        {
          name: 'nat_list_outbound',
          description: 'List all outbound NAT rules',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'nat_list_port_forwards',
          description: 'List all port forward rules',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'nat_get_mode',
          description: 'Get current NAT mode (automatic, hybrid, manual, disabled)',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'nat_set_mode',
          description: 'Set NAT mode (automatic, hybrid, manual, disabled)',
          inputSchema: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                enum: ['automatic', 'hybrid', 'manual', 'disabled'],
                description: 'NAT mode to set'
              }
            },
            required: ['mode']
          }
        },
        {
          name: 'nat_create_outbound_rule',
          description: 'Create an outbound NAT rule',
          inputSchema: {
            type: 'object',
            properties: {
              interface: { type: 'string', description: 'Outbound interface (e.g., wan)' },
              source_net: { type: 'string', description: 'Source network (e.g., 10.0.6.0/24)' },
              destination_net: { type: 'string', description: 'Destination network (e.g., any)' },
              target: { type: 'string', description: 'NAT target IP (empty for no NAT)' },
              nonat: { type: 'string', description: 'Set to "1" for no NAT (exception rule)' },
              description: { type: 'string', description: 'Rule description' },
              enabled: { type: 'string', description: '1 to enable, 0 to disable', default: '1' }
            },
            required: ['interface', 'source_net', 'destination_net']
          }
        },
        {
          name: 'nat_delete_outbound_rule',
          description: 'Delete an outbound NAT rule by description (SSH mode) or UUID (API mode)',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'NAT rule UUID (for API mode)' },
              description: { type: 'string', description: 'NAT rule description (for SSH mode)' }
            }
          }
        },
        {
          name: 'nat_create_port_forward',
          description: 'Create a port forward rule',
          inputSchema: {
            type: 'object',
            properties: {
              interface: { type: 'string', description: 'Inbound interface (e.g., wan)' },
              protocol: { type: 'string', enum: ['tcp', 'udp', 'tcp/udp'], description: 'Protocol' },
              destination_port: { type: 'string', description: 'External port(s)' },
              target: { type: 'string', description: 'Internal target IP' },
              local_port: { type: 'string', description: 'Internal port(s)' },
              description: { type: 'string', description: 'Rule description' },
              enabled: { type: 'string', description: '1 to enable, 0 to disable', default: '1' }
            },
            required: ['interface', 'protocol', 'destination_port', 'target']
          }
        },
        {
          name: 'nat_delete_port_forward',
          description: 'Delete a port forward rule',
          inputSchema: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'Port forward UUID to delete' }
            },
            required: ['uuid']
          }
        },
        {
          name: 'nat_fix_dmz',
          description: 'Fix DMZ NAT issue - adds no-NAT rules for inter-VLAN traffic',
          inputSchema: {
            type: 'object',
            properties: {
              dmzNetwork: { type: 'string', description: 'DMZ network', default: '10.0.6.0/24' },
              lanNetwork: { type: 'string', description: 'LAN network', default: '10.0.0.0/24' },
              otherInternalNetworks: { 
                type: 'array',
                items: { type: 'string' },
                description: 'Other internal networks to exclude from NAT',
                default: ['10.0.2.0/24', '10.0.4.0/24']
              }
            }
          }
        },
        {
          name: 'nat_quick_fix_dmz',
          description: 'Quick fix for DMZ NAT issue with minimal configuration',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'nat_cleanup_dmz_fix',
          description: 'Remove all MCP-created NAT fix rules',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'nat_analyze_config',
          description: 'Analyze NAT configuration for issues',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'nat_apply_changes',
          description: 'Apply NAT configuration changes',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ssh_test_vlan_connectivity',
          description: 'Test connectivity between VLANs',
          inputSchema: {
            type: 'object',
            properties: {
              sourceInterface: {
                type: 'string',
                description: 'Source interface name'
              },
              targetIP: {
                type: 'string',
                description: 'Target IP to test connectivity to'
              }
            },
            required: ['sourceInterface', 'targetIP']
          }
        },
        {
          name: 'ssh_quick_dmz_fix',
          description: 'Apply quick DMZ fix (streamlined version)',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ssh_batch_execute',
          description: 'Execute multiple commands in sequence via SSH',
          inputSchema: {
            type: 'object',
            properties: {
              commands: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of commands to execute'
              },
              stopOnError: {
                type: 'boolean',
                description: 'Stop execution if a command fails',
                default: false
              }
            },
            required: ['commands']
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
        },
        {
          uri: 'opnsense://haproxy/backends',
          name: 'HAProxy Backends',
          description: 'HAProxy backend configurations',
          mimeType: 'application/json'
        },
        {
          uri: 'opnsense://haproxy/frontends',
          name: 'HAProxy Frontends',
          description: 'HAProxy frontend configurations',
          mimeType: 'application/json'
        },
        {
          uri: 'opnsense://haproxy/stats',
          name: 'HAProxy Statistics',
          description: 'HAProxy statistics and health status',
          mimeType: 'application/json'
        },
        {
          uri: 'opnsense://macros',
          name: 'Recorded Macros',
          description: 'List of recorded API macros',
          mimeType: 'application/json'
        },
        {
          uri: 'opnsense://arp',
          name: 'ARP Table',
          description: 'ARP table entries showing IP to MAC mappings',
          mimeType: 'application/json'
        },
        
        // IaC Resources (only if enabled)
        ...(this.iacEnabled ? [
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
        ] : [])
      ]
    }));

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      await this.ensureInitialized();

      const uri = request.params.uri;
      
      // Handle IaC resources
      if (uri.startsWith('opnsense://iac/')) {
        if (!this.iacEnabled) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'IaC features are disabled. Set IAC_ENABLED=true to enable.'
          );
        }
        return this.handleIaCResourceRead(uri);
      }

      switch (uri) {
        case 'opnsense://vlans': {
          const vlans = await this.vlanResource!.list();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(vlans, null, 2)
            }]
          };
        }

        case 'opnsense://firewall/rules': {
          const rules = await this.firewallRuleResource!.list();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(rules, null, 2)
            }]
          };
        }

        case 'opnsense://interfaces': {
          const interfaces = await this.vlanResource!.getAvailableInterfaces();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(interfaces, null, 2)
            }]
          };
        }

        case 'opnsense://status': {
          const status = await this.client!.testConnection();
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
          const leases = await this.dhcpResource!.listLeases();
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
          const blocklist = await this.dnsBlocklistResource!.list();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(blocklist, null, 2)
            }]
          };
        }

        case 'opnsense://haproxy/backends': {
          if (!this.haproxyResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'HAProxy resource not initialized'
            );
          }
          const backends = await this.haproxyResource!.listBackends();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(backends, null, 2)
            }]
          };
        }

        case 'opnsense://haproxy/frontends': {
          if (!this.haproxyResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'HAProxy resource not initialized'
            );
          }
          const frontends = await this.haproxyResource!.listFrontends();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(frontends, null, 2)
            }]
          };
        }

        case 'opnsense://haproxy/stats': {
          if (!this.haproxyResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'HAProxy resource not initialized'
            );
          }
          const stats = await this.haproxyResource!.getStats();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(stats, null, 2)
            }]
          };
        }

        case 'opnsense://macros': {
          if (!this.macroRecorder) {
            throw new McpError(
              ErrorCode.InternalError,
              'Macro recorder not initialized'
            );
          }
          const macros = await this.macroRecorder!.listMacros();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(macros, null, 2)
            }]
          };
        }

        case 'opnsense://arp': {
          if (!this.arpResource) {
            throw new McpError(
              ErrorCode.InternalError,
              'ARP resource not initialized'
            );
          }
          const arpEntries = await this.arpResource!.list();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(arpEntries, null, 2)
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
      
      // Route IaC tools
      if (name.startsWith('iac_')) {
        if (!this.iacEnabled) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'IaC features are disabled. Set IAC_ENABLED=true to enable.'
          );
        }
        return this.handleIaCTool(name, args);
      }

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
              this.natResource = new NATResource(this.client);
              this.dhcpResource = new DhcpLeaseResource(this.client);
              this.dnsBlocklistResource = new DnsBlocklistResource(this.client);
              this.haproxyResource = new HAProxyResource(this.client);
              this.arpResource = new ArpTableResource(this.client);
              
              // Initialize macro recorder
              this.macroRecorder = new MacroRecorder(this.client, process.env.MACRO_STORAGE_PATH);
              this.client.setRecorder((call) => this.macroRecorder?.recordAPICall(call));
              
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
                  logger.debug('Cache not available');
                }
              }
              
              // Re-initialize IaC components if enabled
              if (this.iacEnabled) {
                this.stateStore = new ResourceStateStore();
                this.planner = new DeploymentPlanner();
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
          await this.ensureInitialized();
          const status = await this.client!.testConnection();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }]
          };
        }

        case 'list_vlans': {
          await this.ensureInitialized();
          const vlans = await this.vlanResource!.list();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(vlans, null, 2)
            }]
          };
        }

        case 'get_vlan': {
          await this.ensureInitialized();
          if (!args || !args.tag) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'tag parameter is required'
            );
          }
          const vlan = await this.vlanResource!.findByTag(args.tag as string);
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
          await this.ensureInitialized();
          
          if (!args || !args.interface || !args.tag) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interface and tag parameters are required'
            );
          }
          
          try {
            const result = await this.vlanResource!.create({
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
          await this.ensureInitialized();
          
          if (!args || !args.tag) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'tag parameter is required'
            );
          }
          
          try {
            await this.vlanResource!.deleteByTag(args.tag as string);
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
          await this.ensureInitialized();
          
          if (!args || !args.tag || !args.description) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'tag and description parameters are required'
            );
          }
          
          try {
            const vlan = await this.vlanResource!.findByTag(args.tag as string);
            if (!vlan || !vlan.uuid) {
              throw new Error(`VLAN ${args.tag} not found`);
            }
            
            await this.vlanResource!.update(vlan.uuid, {
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
          await this.ensureInitialized();
          const interfaces = await this.vlanResource!.getAvailableInterfaces();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(interfaces, null, 2)
            }]
          };
        }

        // Firewall Rule Management
        case 'list_firewall_rules': {
          await this.ensureInitialized();
          const rules = await this.firewallRuleResource!.list();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(rules, null, 2)
            }]
          };
        }

        case 'get_firewall_rule': {
          await this.ensureInitialized();
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          const rule = await this.firewallRuleResource!.get(args.uuid as string);
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
          await this.ensureInitialized();
          
          if (!args || !args.action || !args.interface || !args.direction || 
              !args.protocol || !args.source || !args.destination) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'action, interface, direction, protocol, source, and destination are required'
            );
          }
          
          try {
            const result = await this.firewallRuleResource!.create({
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
          await this.ensureInitialized();
          
          if (!args || !args.preset || !args.interface) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'preset and interface parameters are required'
            );
          }
          
          try {
            const presetRule = this.firewallRuleResource!.createPreset(
              args.preset as string,
              {
                source: args.source,
                destination: args.destination,
                description: args.description
              }
            );
            
            const result = await this.firewallRuleResource!.create({
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
          await this.ensureInitialized();
          
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
            
            await this.firewallRuleResource!.update(args.uuid as string, updates);
            
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
          await this.ensureInitialized();
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.firewallRuleResource!.delete(args.uuid as string);
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
          await this.ensureInitialized();
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.firewallRuleResource!.toggle(args.uuid as string);
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
          await this.ensureInitialized();
          
          if (!args || !args.description) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'description parameter is required'
            );
          }
          
          try {
            const rules = await this.firewallRuleResource!.findByDescription(args.description as string);
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
          await this.ensureInitialized();
          if (!this.backupManager) {
            throw new McpError(
              ErrorCode.InternalError,
              'Backup manager not enabled.'
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
          await this.ensureInitialized();
          if (!this.backupManager) {
            throw new McpError(
              ErrorCode.InternalError,
              'Backup manager not enabled.'
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
          await this.ensureInitialized();
          if (!this.backupManager) {
            throw new McpError(
              ErrorCode.InternalError,
              'Backup manager not enabled.'
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
          await this.ensureInitialized();
          
          try {
            const leases = await this.dhcpResource!.listLeases();
            
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
          await this.ensureInitialized();
          
          if (!args || !args.pattern) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'pattern parameter is required'
            );
          }
          
          try {
            const results = await this.dhcpResource!.findByHostname(args.pattern as string);
            
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
          await this.ensureInitialized();
          
          if (!args || !args.mac) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'mac parameter is required'
            );
          }
          
          try {
            const results = await this.dhcpResource!.findByMac(args.mac as string);
            
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
          await this.ensureInitialized();
          
          try {
            const guestDevices = await this.dhcpResource!.getGuestLeases();
            
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
          await this.ensureInitialized();
          
          try {
            const byInterface = await this.dhcpResource!.getLeasesByInterface();
            
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

        // ARP Table Management
        case 'list_arp_entries': {
          await this.ensureInitialized();
          
          try {
            const entries = await this.arpResource!.list();
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(entries, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to list ARP entries: ${error.message}`
            );
          }
        }

        case 'find_arp_by_ip': {
          await this.ensureInitialized();
          
          if (!args || !args.ipPattern) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'ipPattern parameter is required'
            );
          }
          
          try {
            const results = await this.arpResource!.findByIp(args.ipPattern as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No ARP entries found for IP pattern "${args.ipPattern}"`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: `Found ${results.length} ARP entries:\n\n` +
                      results.map(entry => this.arpResource!.formatEntry(entry)).join('\n')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search ARP by IP: ${error.message}`
            );
          }
        }

        case 'find_arp_by_mac': {
          await this.ensureInitialized();
          
          if (!args || !args.macPattern) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'macPattern parameter is required'
            );
          }
          
          try {
            const results = await this.arpResource!.findByMac(args.macPattern as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No ARP entries found for MAC pattern "${args.macPattern}"`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: `Found ${results.length} ARP entries:\n\n` +
                      results.map(entry => this.arpResource!.formatEntry(entry)).join('\n')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search ARP by MAC: ${error.message}`
            );
          }
        }

        case 'find_arp_by_interface': {
          await this.ensureInitialized();
          
          if (!args || !args.interface) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interface parameter is required'
            );
          }
          
          try {
            const results = await this.arpResource!.findByInterface(args.interface as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No ARP entries found on interface "${args.interface}"`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: `Found ${results.length} ARP entries on ${args.interface}:\n\n` +
                      results.map(entry => this.arpResource!.formatEntry(entry)).join('\n')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search ARP by interface: ${error.message}`
            );
          }
        }

        case 'find_arp_by_hostname': {
          await this.ensureInitialized();
          
          if (!args || !args.pattern) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'pattern parameter is required'
            );
          }
          
          try {
            const results = await this.arpResource!.findByHostname(args.pattern as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No ARP entries found with hostname pattern "${args.pattern}"`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: `Found ${results.length} ARP entries:\n\n` +
                      results.map(entry => this.arpResource!.formatEntry(entry)).join('\n')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to search ARP by hostname: ${error.message}`
            );
          }
        }

        case 'get_arp_stats': {
          await this.ensureInitialized();
          
          try {
            const stats = await this.arpResource!.getStats();
            
            return {
              content: [{
                type: 'text',
                text: `ARP Table Statistics:\n\n` +
                      `Total entries: ${stats.totalEntries}\n` +
                      `Dynamic entries: ${stats.dynamicEntries}\n` +
                      `Static entries: ${stats.staticEntries}\n` +
                      `Interfaces: ${stats.interfaces.join(', ')}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get ARP stats: ${error.message}`
            );
          }
        }

        case 'find_devices_on_vlan': {
          await this.ensureInitialized();
          
          if (!args || !args.vlanTag) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'vlanTag parameter is required'
            );
          }
          
          try {
            const results = await this.arpResource!.findOnVlan(args.vlanTag as string);
            
            if (results.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: `No devices found on VLAN ${args.vlanTag}`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: `Found ${results.length} devices on VLAN ${args.vlanTag}:\n\n` +
                      results.map(entry => this.arpResource!.formatEntry(entry)).join('\n')
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to find devices on VLAN: ${error.message}`
            );
          }
        }

        // DNS Blocklist Management
        case 'list_dns_blocklist': {
          await this.ensureInitialized();
          
          try {
            const blocklist = await this.dnsBlocklistResource!.list();
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
          await this.ensureInitialized();
          
          if (!args || !args.domain) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'domain parameter is required'
            );
          }
          
          try {
            const result = await this.dnsBlocklistResource!.blockDomain(
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
          await this.ensureInitialized();
          
          if (!args || !args.domain) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'domain parameter is required'
            );
          }
          
          try {
            await this.dnsBlocklistResource!.unblockDomain(args.domain as string);
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
          await this.ensureInitialized();
          
          if (!args || !args.domains || !Array.isArray(args.domains)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'domains array parameter is required'
            );
          }
          
          try {
            const result = await this.dnsBlocklistResource!.blockMultipleDomains(
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
          await this.ensureInitialized();
          
          if (!args || !args.category) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'category parameter is required'
            );
          }
          
          try {
            const result = await this.dnsBlocklistResource!.applyBlocklistCategory(
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
          await this.ensureInitialized();
          
          if (!args || !args.pattern) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'pattern parameter is required'
            );
          }
          
          try {
            const results = await this.dnsBlocklistResource!.searchBlocklist(args.pattern as string);
            
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
          await this.ensureInitialized();
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.dnsBlocklistResource!.toggleBlocklistEntry(args.uuid as string);
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

        // HAProxy Service Control
        case 'haproxy_service_control': {
          await this.ensureInitialized();
          
          if (!args || !args.action) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'action parameter is required'
            );
          }
          
          try {
            if (args.action === 'status') {
              const status = await this.haproxyResource!.getServiceStatus();
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(status, null, 2)
                }]
              };
            } else {
              const result = await this.haproxyResource!.controlService(args.action as any);
              return {
                content: [{
                  type: 'text',
                  text: `HAProxy service ${args.action} completed: ${result ? 'success' : 'failed'}`
                }]
              };
            }
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              error.message
            );
          }
        }

        // System Settings Management
        case 'system_get_settings': {
          await this.ensureInitialized();
          
          try {
            const settings = await this.systemSettingsResource!.getAllSettings();
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(settings, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get system settings: ${error.message}`
            );
          }
        }

        case 'system_enable_intervlan_routing': {
          await this.ensureInitialized();
          
          try {
            const success = await this.systemSettingsResource!.enableInterVLANRouting();
            
            return {
              content: [{
                type: 'text',
                text: success ? 
                  'Inter-VLAN routing enabled successfully at system level' : 
                  'Failed to enable inter-VLAN routing at system level'
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to enable inter-VLAN routing: ${error.message}`
            );
          }
        }

        case 'system_update_firewall_settings': {
          await this.ensureInitialized();
          
          try {
            const settings: any = {};
            if (args?.blockprivatenetworks !== undefined) settings.blockprivatenetworks = args.blockprivatenetworks;
            if (args?.blockbogons !== undefined) settings.blockbogons = args.blockbogons;
            if (args?.allowinterlantraffic !== undefined) settings.allowinterlantraffic = args.allowinterlantraffic;
            if (args?.bypassstaticroutes !== undefined) settings.bypassstaticroutes = args.bypassstaticroutes;
            if (args?.disablereplyto !== undefined) settings.disablereplyto = args.disablereplyto;
            
            const success = await this.systemSettingsResource!.updateFirewallSettings(settings);
            
            return {
              content: [{
                type: 'text',
                text: success ? 
                  'Firewall settings updated successfully' : 
                  'Failed to update firewall settings'
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to update firewall settings: ${error.message}`
            );
          }
        }

        // Interface Configuration Management
        case 'interface_list_overview': {
          await this.ensureInitialized();
          
          try {
            const interfaces = await this.interfaceConfigResource!.listOverview();
            
            const formatted = interfaces.map(iface => 
              `${iface.name}: ${iface.device} - ${iface.status} (${iface.ipaddr || 'no IP'}/${iface.subnet || ''})`
            );
            
            return {
              content: [{
                type: 'text',
                text: `Found ${interfaces.length} interface(s):\n\n${formatted.join('\n')}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to list interfaces: ${error.message}`
            );
          }
        }

        case 'interface_get_config': {
          await this.ensureInitialized();
          
          if (!args || !args.interfaceName) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interfaceName parameter is required'
            );
          }
          
          try {
            const config = await this.interfaceConfigResource!.getInterfaceConfig(args.interfaceName as string);
            
            if (!config) {
              return {
                content: [{
                  type: 'text',
                  text: `Interface ${args.interfaceName} not found`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(config, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get interface config: ${error.message}`
            );
          }
        }

        case 'interface_enable_intervlan_routing': {
          await this.ensureInitialized();
          
          if (!args || !args.interfaceName) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interfaceName parameter is required'
            );
          }
          
          try {
            const success = await this.interfaceConfigResource!.enableInterVLANRoutingOnInterface(
              args.interfaceName as string
            );
            
            return {
              content: [{
                type: 'text',
                text: success ? 
                  `Inter-VLAN routing enabled on interface ${args.interfaceName}` : 
                  `Failed to enable inter-VLAN routing on interface ${args.interfaceName}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to enable inter-VLAN routing: ${error.message}`
            );
          }
        }

        case 'interface_enable_intervlan_all': {
          await this.ensureInitialized();
          
          try {
            const result = await this.interfaceConfigResource!.enableInterVLANRoutingOnAllInterfaces();
            
            const summary = result.details.map(d => 
              `${d.interface}: ${d.success ? '✓' : '✗'} ${d.message}`
            );
            
            return {
              content: [{
                type: 'text',
                text: `Inter-VLAN routing configuration:\n\n${summary.join('\n')}\n\nOverall: ${result.success ? 'Success' : 'Some interfaces failed'}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to enable inter-VLAN routing on all interfaces: ${error.message}`
            );
          }
        }

        case 'interface_configure_dmz': {
          await this.ensureInitialized();
          
          const dmzInterface = args?.dmzInterface || 'opt8';
          
          try {
            const success = await this.interfaceConfigResource!.configureDMZInterface(dmzInterface as string);
            
            return {
              content: [{
                type: 'text',
                text: success ? 
                  `DMZ interface ${dmzInterface} configured for inter-VLAN routing` : 
                  `Failed to configure DMZ interface ${dmzInterface}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to configure DMZ interface: ${error.message}`
            );
          }
        }

        case 'interface_update_config': {
          await this.ensureInitialized();
          
          if (!args || !args.interfaceName) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interfaceName parameter is required'
            );
          }
          
          try {
            const config: any = {};
            if (args?.blockpriv !== undefined) config.blockpriv = args.blockpriv;
            if (args?.blockbogons !== undefined) config.blockbogons = args.blockbogons;
            if (args?.enable !== undefined) config.enable = args.enable;
            if (args?.disableftpproxy !== undefined) config.disableftpproxy = args.disableftpproxy;
            
            const success = await this.interfaceConfigResource!.updateInterfaceConfig(
              args.interfaceName as string,
              config
            );
            
            return {
              content: [{
                type: 'text',
                text: success ? 
                  `Interface ${args.interfaceName} configuration updated` : 
                  `Failed to update interface ${args.interfaceName} configuration`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to update interface config: ${error.message}`
            );
          }
        }

        // Routing Diagnostics and Fixes
        case 'routing_diagnostics': {
          await this.ensureInitialized();
          
          try {
            const result = await this.routingDiagnosticsResource!.runDiagnostics(
              args?.sourceNetwork as string,
              args?.destNetwork as string
            );
            
            let output = `Routing Diagnostics Report\n`;
            output += `==========================\n\n`;
            output += `Summary: ${result.summary}\n\n`;
            
            if (result.issues.length > 0) {
              output += `Issues Found:\n`;
              for (const issue of result.issues) {
                const icon = issue.severity === 'critical' ? '❌' : 
                            issue.severity === 'warning' ? '⚠️' : 'ℹ️';
                output += `${icon} [${issue.component}] ${issue.issue}\n`;
                if (issue.fixAvailable) {
                  output += `   Fix available: ${issue.fixCommand}\n`;
                }
              }
              output += `\n`;
            }
            
            if (result.recommendations.length > 0) {
              output += `Recommendations:\n`;
              for (const rec of result.recommendations) {
                output += `• ${rec}\n`;
              }
            }
            
            if (result.canAutoFix) {
              output += `\nAuto-fix available: Run 'routing_fix_all' to fix issues automatically`;
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
              `Routing diagnostics failed: ${error.message}`
            );
          }
        }

        case 'routing_fix_all': {
          await this.ensureInitialized();
          
          try {
            const result = await this.routingDiagnosticsResource!.fixAllRoutingIssues();
            
            let output = `Inter-VLAN Routing Fix Results\n`;
            output += `===============================\n\n`;
            output += `Status: ${result.success ? '✅ Success' : '⚠️ Partial Success'}\n\n`;
            
            if (result.actions.length > 0) {
              output += `Actions Taken:\n`;
              for (const action of result.actions) {
                output += `• ${action}\n`;
              }
            }
            
            if (result.success) {
              output += `\nRouting should now be working. Test with:\n`;
              output += `• ping 10.0.0.14 (from DMZ)\n`;
              output += `• showmount -e 10.0.0.14 (for NFS)\n`;
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
              `Routing fix failed: ${error.message}`
            );
          }
        }

        case 'routing_fix_dmz': {
          await this.ensureInitialized();
          
          try {
            const success = await this.routingDiagnosticsResource!.fixDMZRouting();
            
            return {
              content: [{
                type: 'text',
                text: success ? 
                  '✅ DMZ routing fixed successfully! Test with: ping 10.0.0.14 from DMZ' :
                  '⚠️ Some DMZ routing fixes failed. Run routing_diagnostics for details.'
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `DMZ routing fix failed: ${error.message}`
            );
          }
        }

        case 'routing_create_intervlan_rules': {
          await this.ensureInitialized();
          
          if (!args || !args.sourceNetwork || !args.destNetwork) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'sourceNetwork and destNetwork parameters are required'
            );
          }
          
          try {
            const success = await this.routingDiagnosticsResource!.createInterVLANRules(
              args.sourceNetwork as string,
              args.destNetwork as string,
              args.bidirectional !== false
            );
            
            return {
              content: [{
                type: 'text',
                text: success ? 
                  `✅ Inter-VLAN rules created between ${args.sourceNetwork} and ${args.destNetwork}` :
                  '❌ Failed to create inter-VLAN rules'
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to create inter-VLAN rules: ${error.message}`
            );
          }
        }

        // CLI Execution Tools
        case 'cli_execute': {
          await this.ensureInitialized();
          
          if (!args || !args.command) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'command parameter is required'
            );
          }
          
          try {
            const result = await this.cliExecutor!.execute({
              command: args.command as string,
              args: args.args as string[] || [],
              timeout: args.timeout as number || 30000
            });
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `Command executed successfully:\n${result.output || 'No output'}` :
                  `Command failed: ${result.error}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to execute CLI command: ${error.message}`
            );
          }
        }

        case 'cli_fix_interface_blocking': {
          await this.ensureInitialized();
          
          if (!args || !args.interfaceName) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interfaceName parameter is required'
            );
          }
          
          try {
            const result = await this.cliExecutor!.disableInterfaceBlocking(
              args.interfaceName as string
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ Successfully disabled blocking on interface ${args.interfaceName}` :
                  `❌ Failed to fix interface blocking: ${result.error}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fix interface blocking: ${error.message}`
            );
          }
        }

        case 'cli_reload_firewall': {
          await this.ensureInitialized();
          
          try {
            const result = await this.cliExecutor!.reloadFirewall();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  '✅ Firewall rules reloaded successfully' :
                  `❌ Failed to reload firewall: ${result.error}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to reload firewall: ${error.message}`
            );
          }
        }

        case 'cli_show_routing': {
          await this.ensureInitialized();
          
          try {
            const result = await this.cliExecutor!.getRoutingTable();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `Routing Table:\n${result.output}` :
                  `Failed to get routing table: ${result.error}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get routing table: ${error.message}`
            );
          }
        }

        case 'cli_fix_dmz_routing': {
          await this.ensureInitialized();
          
          try {
            const result = await this.cliExecutor!.runComprehensiveDMZFix();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ DMZ Routing Fix Completed\n\n${result.output}` :
                  `❌ DMZ Fix Failed\n\n${result.output}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fix DMZ routing: ${error.message}`
            );
          }
        }

        case 'cli_check_nfs': {
          await this.ensureInitialized();
          
          try {
            const result = await this.cliExecutor!.checkNFSConnectivity(
              args?.truenasIP as string || '10.0.0.14'
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `NFS Exports Available:\n${result.output}` :
                  `Failed to check NFS: ${result.error}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to check NFS connectivity: ${error.message}`
            );
          }
        }

        case 'cli_apply_changes': {
          await this.ensureInitialized();
          
          try {
            const result = await this.cliExecutor!.applyAllChanges();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ All configuration changes applied successfully\n${result.output}` :
                  `❌ Failed to apply changes: ${result.error}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to apply changes: ${error.message}`
            );
          }
        }

        // SSH Execution Tools
        case 'ssh_execute': {
          await this.ensureInitialized();
          
          if (!args || !args.command) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'command parameter is required'
            );
          }
          
          try {
            const result = await this.sshExecutor!.execute(
              args.command as string,
              {
                timeout: args.timeout as number,
                sudo: args.sudo as boolean
              }
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ SSH Command executed successfully (exit code: ${result.exitCode}):\n${result.stdout}\n${result.stderr ? `\nStderr:\n${result.stderr}` : ''}` :
                  `❌ SSH Command failed (exit code: ${result.exitCode}):\n${result.stderr || 'No error output'}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to execute SSH command: ${error.message}`
            );
          }
        }

        case 'ssh_fix_interface_blocking': {
          await this.ensureInitialized();
          
          if (!args || !args.interface) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interface parameter is required'
            );
          }
          
          try {
            const result = await this.sshExecutor!.fixInterfaceBlocking(
              args.interface as string
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ Successfully fixed interface blocking on ${args.interface} via SSH:\n${result.stdout}` :
                  `❌ Failed to fix interface blocking: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fix interface blocking via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_fix_dmz_routing': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.fixDMZRouting();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ DMZ Routing Fix Applied Successfully via SSH:\n${result.stdout}` :
                  `❌ DMZ Routing Fix Failed:\n${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fix DMZ routing via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_enable_intervlan_routing': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.enableInterVLANRouting();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ Inter-VLAN routing enabled successfully via SSH:\n${result.stdout}` :
                  `❌ Failed to enable inter-VLAN routing:\n${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to enable inter-VLAN routing via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_reload_firewall': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.execute('configctl filter reload && pfctl -f /tmp/rules.debug');
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ Firewall reloaded successfully via SSH` :
                  `❌ Failed to reload firewall: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to reload firewall via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_show_routing': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.getRoutingTable();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `Routing Table (via SSH):\n${result.stdout}` :
                  `Failed to get routing table: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get routing table via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_show_pf_rules': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.showPfRules({
              verbose: args?.verbose as boolean
            });
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `Packet Filter Rules:\n${result.stdout}` :
                  `Failed to get PF rules: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get PF rules via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_backup_config': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.backupConfig(
              args?.backupName as string
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ Configuration backed up successfully:\n${result.stdout}` :
                  `❌ Backup failed: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to backup config via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_restore_config': {
          await this.ensureInitialized();
          
          if (!args || !args.backupPath) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'backupPath parameter is required'
            );
          }
          
          try {
            const result = await this.sshExecutor!.restoreConfig(
              args.backupPath as string
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ Configuration restored successfully:\n${result.stdout}` :
                  `❌ Restore failed: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to restore config via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_check_nfs_connectivity': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.checkNFSConnectivity(
              args?.targetIP as string
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `NFS Connectivity Check:\n${result.stdout}` :
                  `NFS connectivity check failed: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to check NFS connectivity via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_system_status': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.getSystemStatus();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `System Status:\n${result.stdout}` :
                  `Failed to get system status: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get system status via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_test_vlan_connectivity': {
          await this.ensureInitialized();
          
          if (!args || !args.sourceInterface || !args.targetIP) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'sourceInterface and targetIP parameters are required'
            );
          }
          
          try {
            const result = await this.sshExecutor!.testVLANConnectivity(
              args.sourceInterface as string,
              args.targetIP as string
            );
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `VLAN Connectivity Test:\n${result.stdout}` :
                  `Connectivity test failed: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to test VLAN connectivity via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_quick_dmz_fix': {
          await this.ensureInitialized();
          
          try {
            const result = await this.sshExecutor!.quickDMZFix();
            
            return {
              content: [{
                type: 'text',
                text: result.success ? 
                  `✅ Quick DMZ fix applied successfully via SSH` :
                  `❌ Quick DMZ fix failed: ${result.stderr}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to apply quick DMZ fix via SSH: ${error.message}`
            );
          }
        }

        case 'ssh_batch_execute': {
          await this.ensureInitialized();
          
          if (!args || !args.commands || !Array.isArray(args.commands)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'commands array parameter is required'
            );
          }
          
          try {
            const result = await this.sshExecutor!.executeBatch(
              args.commands as string[],
              {
                stopOnError: args.stopOnError as boolean
              }
            );
            
            const commands = args.commands as string[];
            const output = result.results.map((r, i) => 
              `Command ${i + 1}: ${commands[i]}\n` +
              `Status: ${r.success ? '✅ Success' : '❌ Failed'}\n` +
              `Exit Code: ${r.exitCode}\n` +
              `${r.stdout ? `Output:\n${r.stdout}\n` : ''}` +
              `${r.stderr ? `Error:\n${r.stderr}\n` : ''}`
            ).join('\n---\n');
            
            return {
              content: [{
                type: 'text',
                text: `Batch Execution ${result.success ? 'Completed' : 'Failed'}:\n\n${output}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to execute batch commands via SSH: ${error.message}`
            );
          }
        }

        // HAProxy Backend Management
        case 'haproxy_backend_create': {
          await this.ensureInitialized();
          
          if (!args || !args.name || !args.mode || !args.balance) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'name, mode, and balance parameters are required'
            );
          }
          
          try {
            const result = await this.haproxyResource!.createBackend({
              name: args.name as string,
              mode: args.mode as 'http' | 'tcp',
              balance: args.balance as any,
              servers: args.servers as any[] || [],
              description: args.description as string
            });
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created HAProxy backend ${args.name} with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'haproxy_backend_list': {
          await this.ensureInitialized();
          
          try {
            const backends = await this.haproxyResource!.listBackends();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(backends, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              error.message
            );
          }
        }

        case 'haproxy_backend_delete': {
          await this.ensureInitialized();
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.haproxyResource!.deleteBackend(args.uuid as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully deleted HAProxy backend ${args.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // HAProxy Frontend Management
        case 'haproxy_frontend_create': {
          await this.ensureInitialized();
          
          if (!args || !args.name || !args.bind || !args.mode || !args.backend) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'name, bind, mode, and backend parameters are required'
            );
          }
          
          try {
            const result = await this.haproxyResource!.createFrontend({
              name: args.name as string,
              bind: args.bind as string,
              mode: args.mode as 'http' | 'tcp',
              backend: args.backend as string,
              acls: args.acls as any[] || [],
              description: args.description as string,
              bindOptions: {
                ssl: args.ssl as boolean,
                certificates: args.certificates as string[] || []
              }
            });
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created HAProxy frontend ${args.name} with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'haproxy_frontend_list': {
          await this.ensureInitialized();
          
          try {
            const frontends = await this.haproxyResource!.listFrontends();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(frontends, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              error.message
            );
          }
        }

        case 'haproxy_frontend_delete': {
          await this.ensureInitialized();
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.haproxyResource!.deleteFrontend(args.uuid as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully deleted HAProxy frontend ${args.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // HAProxy Certificate Management
        case 'haproxy_certificate_list': {
          await this.ensureInitialized();
          
          try {
            const certificates = await this.haproxyResource!.listCertificates();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(certificates, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              error.message
            );
          }
        }

        case 'haproxy_certificate_create': {
          await this.ensureInitialized();
          
          if (!args || !args.name || !args.type) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'name and type parameters are required'
            );
          }
          
          try {
            const result = await this.haproxyResource!.createCertificate({
              name: args.name as string,
              type: args.type as any,
              cn: args.cn as string,
              san: args.san as string[],
              certificate: args.certificate as string,
              key: args.key as string,
              ca: args.ca as string
            });
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created certificate ${args.name} with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // HAProxy ACL Management
        case 'haproxy_acl_create': {
          await this.ensureInitialized();
          
          if (!args || !args.frontend || !args.name || !args.expression) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'frontend, name, and expression parameters are required'
            );
          }
          
          try {
            const result = await this.haproxyResource!.addACLToFrontend(
              args.frontend as string,
              {
                name: args.name as string,
                expression: args.expression as string
              }
            );
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created ACL ${args.name} with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // HAProxy Action Management
        case 'haproxy_action_create': {
          await this.ensureInitialized();
          
          if (!args || !args.frontend || !args.type) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'frontend and type parameters are required'
            );
          }
          
          try {
            const result = await this.haproxyResource!.addActionToFrontend(
              args.frontend as string,
              {
                type: args.type as any,
                backend: args.backend as string,
                condition: args.condition as string,
                value: args.value as string
              }
            );
            
            return {
              content: [{
                type: 'text',
                text: `Successfully created action with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // HAProxy Stats
        case 'haproxy_stats': {
          await this.ensureInitialized();
          
          try {
            const stats = await this.haproxyResource!.getStats();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(stats, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              error.message
            );
          }
        }

        case 'haproxy_backend_health': {
          await this.ensureInitialized();
          
          if (!args || !args.backend) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'backend parameter is required'
            );
          }
          
          try {
            const health = await this.haproxyResource!.getBackendHealth(args.backend as string);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(health, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              error.message
            );
          }
        }

        // Macro Recording Tools
        case 'macro_start_recording': {
          await this.ensureInitialized();
          
          if (!args || !args.name || !args.description) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'name and description parameters are required'
            );
          }
          
          try {
            this.macroRecorder!.startRecording(args.name as string, args.description as string);
            return {
              content: [{
                type: 'text',
                text: `Started recording macro: ${args.name}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'macro_stop_recording': {
          await this.ensureInitialized();
          
          try {
            const recording = this.macroRecorder!.stopRecording();
            if (!recording) {
              throw new Error('No recording in progress');
            }
            
            await this.macroRecorder!.saveMacro(recording);
            
            return {
              content: [{
                type: 'text',
                text: `Stopped recording and saved macro: ${recording.name}\nID: ${recording.id}\nCalls recorded: ${recording.calls.length}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'macro_list': {
          await this.ensureInitialized();
          
          try {
            const macros = await this.macroRecorder!.listMacros();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(macros.map(m => ({
                  id: m.id,
                  name: m.name,
                  description: m.description,
                  created: m.created,
                  callCount: m.calls.length,
                  parameters: m.parameters.length
                })), null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              error.message
            );
          }
        }

        case 'macro_play': {
          await this.ensureInitialized();
          
          if (!args || !args.id) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'id parameter is required'
            );
          }
          
          try {
            const results = await this.macroRecorder!.playMacro(args.id as string, {
              parameters: args.parameters as Record<string, any>,
              dryRun: args.dryRun as boolean
            });
            
            const summary = results.map((r, i) => ({
              step: i + 1,
              method: r.call.method,
              path: r.call.path,
              success: !r.error,
              dryRun: r.dryRun,
              duration: r.duration
            }));
            
            return {
              content: [{
                type: 'text',
                text: `Macro playback ${args.dryRun ? '(dry run) ' : ''}completed:\n${JSON.stringify(summary, null, 2)}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'macro_delete': {
          await this.ensureInitialized();
          
          if (!args || !args.id) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'id parameter is required'
            );
          }
          
          try {
            await this.macroRecorder!.deleteMacro(args.id as string);
            return {
              content: [{
                type: 'text',
                text: `Successfully deleted macro ${args.id}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'macro_analyze': {
          await this.ensureInitialized();
          
          if (!args || !args.id) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'id parameter is required'
            );
          }
          
          try {
            const macro = await this.macroRecorder!.loadMacro(args.id as string);
            if (!macro) {
              throw new Error(`Macro ${args.id} not found`);
            }
            
            const analysis = this.macroRecorder!.analyzeMacro(macro);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(analysis, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'macro_generate_tool': {
          await this.ensureInitialized();
          
          if (!args || !args.id) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'id parameter is required'
            );
          }
          
          try {
            const macro = await this.macroRecorder!.loadMacro(args.id as string);
            if (!macro) {
              throw new Error(`Macro ${args.id} not found`);
            }
            
            const tool = this.macroRecorder!.generateTool(macro);
            
            if (args.save) {
              // Save to a file
              const fs = await import('fs/promises');
              const path = await import('path');
              const filename = path.default.join(
                process.cwd(),
                'generated-tools',
                `${tool.name}.ts`
              );
              
              await fs.mkdir(path.default.dirname(filename), { recursive: true });
              await fs.writeFile(filename, tool.implementation || '');
              
              return {
                content: [{
                  type: 'text',
                  text: `Generated tool saved to: ${filename}\n\nTool Definition:\n${JSON.stringify(tool, null, 2)}`
                }]
              };
            }
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(tool, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'macro_export': {
          await this.ensureInitialized();
          
          if (!args || !args.path) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'path parameter is required'
            );
          }
          
          try {
            const storage = (this.macroRecorder as any).storage;
            await storage.exportAll(args.path as string);
            
            return {
              content: [{
                type: 'text',
                text: `Successfully exported macros to: ${args.path}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        case 'macro_import': {
          await this.ensureInitialized();
          
          if (!args || !args.path) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'path parameter is required'
            );
          }
          
          try {
            const storage = (this.macroRecorder as any).storage;
            const imported = await storage.importAll(
              args.path as string,
              args.overwrite as boolean
            );
            
            return {
              content: [{
                type: 'text',
                text: `Successfully imported ${imported} macro(s) from: ${args.path}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.message
            );
          }
        }

        // NAT Management Handlers
        case 'nat_list_outbound': {
          await this.ensureInitialized();
          
          try {
            const rules = await this.natResource!.listOutboundRules();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(rules, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to list outbound NAT rules: ${error.message}`
            );
          }
        }

        case 'nat_list_port_forwards': {
          await this.ensureInitialized();
          
          try {
            const rules = await this.natResource!.listPortForwards();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(rules, null, 2)
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to list port forward rules: ${error.message}`
            );
          }
        }

        case 'nat_get_mode': {
          await this.ensureInitialized();
          
          try {
            const mode = await this.natResource!.getOutboundMode();
            return {
              content: [{
                type: 'text',
                text: `Current NAT mode: ${mode}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get NAT mode: ${error.message}`
            );
          }
        }

        case 'nat_set_mode': {
          await this.ensureInitialized();
          
          if (!args || !args.mode) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'mode parameter is required'
            );
          }
          
          try {
            const success = await this.natResource!.setOutboundMode(args.mode as any);
            return {
              content: [{
                type: 'text',
                text: success ? 
                  `✅ NAT mode set to: ${args.mode}` :
                  `❌ Failed to set NAT mode to: ${args.mode}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to set NAT mode: ${error.message}`
            );
          }
        }

        case 'nat_create_outbound_rule': {
          await this.ensureInitialized();
          
          if (!args || !args.interface || !args.source_net || !args.destination_net) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interface, source_net, and destination_net parameters are required'
            );
          }
          
          try {
            const result = await this.natResource!.createOutboundRule({
              interface: args.interface as string,
              source_net: args.source_net as string,
              destination_net: args.destination_net as string,
              target: args.target as string,
              nonat: args.nonat as string,
              description: args.description as string,
              enabled: args.enabled as string || '1'
            });
            
            return {
              content: [{
                type: 'text',
                text: `✅ Created outbound NAT rule with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to create outbound NAT rule: ${error.message}`
            );
          }
        }

        case 'nat_delete_outbound_rule': {
          await this.ensureInitialized();
          
          if (!args || (!args.uuid && !args.description)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'Either uuid (for API mode) or description (for SSH mode) parameter is required'
            );
          }
          
          try {
            // Use description for SSH mode, UUID for API mode
            const identifier = args.description || args.uuid;
            await this.natResource!.deleteOutboundRule(identifier as string);
            return {
              content: [{
                type: 'text',
                text: `✅ Deleted outbound NAT rule: ${identifier}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to delete outbound NAT rule: ${error.message}`
            );
          }
        }

        case 'nat_create_port_forward': {
          await this.ensureInitialized();
          
          if (!args || !args.interface || !args.protocol || !args.destination_port || !args.target) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'interface, protocol, destination_port, and target parameters are required'
            );
          }
          
          try {
            const result = await this.natResource!.createPortForward({
              interface: args.interface as string,
              protocol: args.protocol as string,
              destination_port: args.destination_port as string,
              target: args.target as string,
              local_port: args.local_port as string || args.destination_port as string,
              description: args.description as string,
              enabled: args.enabled as string || '1'
            });
            
            return {
              content: [{
                type: 'text',
                text: `✅ Created port forward rule with UUID: ${result.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to create port forward: ${error.message}`
            );
          }
        }

        case 'nat_delete_port_forward': {
          await this.ensureInitialized();
          
          if (!args || !args.uuid) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              'uuid parameter is required'
            );
          }
          
          try {
            await this.natResource!.deletePortForward(args.uuid as string);
            return {
              content: [{
                type: 'text',
                text: `✅ Deleted port forward rule: ${args.uuid}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to delete port forward: ${error.message}`
            );
          }
        }

        case 'nat_fix_dmz': {
          await this.ensureInitialized();
          
          try {
            const result = await this.natResource!.fixDMZNAT({
              dmzNetwork: args?.dmzNetwork as string,
              lanNetwork: args?.lanNetwork as string,
              otherInternalNetworks: args?.otherInternalNetworks as string[]
            });
            
            return {
              content: [{
                type: 'text',
                text: result.success ?
                  `✅ ${result.message}\n\nCreated rules:\n${result.rulesCreated.join('\n')}` :
                  `❌ ${result.message}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fix DMZ NAT: ${error.message}`
            );
          }
        }

        case 'nat_quick_fix_dmz': {
          await this.ensureInitialized();
          
          try {
            const result = await this.natResource!.quickFixDMZNAT();
            return {
              content: [{
                type: 'text',
                text: result.success ?
                  `✅ ${result.message}` :
                  `❌ ${result.message}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to apply quick DMZ NAT fix: ${error.message}`
            );
          }
        }

        case 'nat_cleanup_dmz_fix': {
          await this.ensureInitialized();
          
          try {
            const result = await this.natResource!.cleanupDMZNATFix();
            return {
              content: [{
                type: 'text',
                text: `✅ Cleanup complete. Removed ${result.deletedCount} MCP-created NAT rules.`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to cleanup NAT fix rules: ${error.message}`
            );
          }
        }

        case 'nat_analyze_config': {
          await this.ensureInitialized();
          
          try {
            const analysis = await this.natResource!.analyzeNATConfiguration();
            return {
              content: [{
                type: 'text',
                text: `NAT Configuration Analysis:
                
Mode: ${analysis.mode}

Rules:
- Outbound: ${analysis.rules.outbound}
- Port Forwards: ${analysis.rules.portForwards}
- One-to-One: ${analysis.rules.oneToOne}
- NPT (IPv6): ${analysis.rules.npt}

Issues:
${analysis.issues.length > 0 ? analysis.issues.map(i => `- ${i}`).join('\n') : '- No issues detected'}

Recommendations:
${analysis.recommendations.length > 0 ? analysis.recommendations.map(r => `- ${r}`).join('\n') : '- No recommendations'}`
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to analyze NAT configuration: ${error.message}`
            );
          }
        }

        case 'nat_apply_changes': {
          await this.ensureInitialized();
          
          try {
            await this.natResource!.applyNATChanges();
            return {
              content: [{
                type: 'text',
                text: '✅ NAT configuration changes applied successfully'
              }]
            };
          } catch (error: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to apply NAT changes: ${error.message}`
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
      logger.warn('Auto-initialization failed. Use configure tool to set up connection.');
    }

    // Get transport configuration
    const transportType = TransportManager.getTransportType();
    const transportOptions = TransportManager.getTransportOptions();

    // Create and connect transport
    const transportOrServer = await TransportManager.createTransport(transportType, transportOptions);
    
    if (transportType === 'stdio') {
      // For STDIO, connect directly
      await this.server.connect(transportOrServer as Transport);
      logger.info('OPNsense MCP server running on stdio');
    } else if (transportType === 'sse') {
      // For SSE, set up connection handler
      const sseServer = transportOrServer as SSETransportServer;
      sseServer.onConnection(async (transport) => {
        // Connect each new SSE client
        await this.server.connect(transport);
        logger.info('New SSE client connected');
      });
      logger.info(`OPNsense MCP server running on SSE (port: ${transportOptions.port || 3000})`);
      logger.info('Waiting for SSE client connections...');
    }
  }
  
  // IaC Handler Methods
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
        const state = await this.stateStore.getCurrentState();
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
}

// Start the server
const server = new OPNSenseMCPServer();
server.start().catch(error => logger.error('Server startup failed:', error));
