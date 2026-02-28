// Interface Configuration Resource Implementation
// Manages OPNsense network interface settings including VLAN routing configuration
import { OPNSenseAPIClient } from '../../api/client.js';

export interface InterfaceConfig {
  uuid?: string;
  name?: string;
  descr?: string;
  device?: string;
  enable?: string;              // '1' or '0'
  ipaddr?: string;
  subnet?: string;
  gateway?: string;
  spoofmac?: string;
  mtu?: string;
  media?: string;
  mediaopt?: string;
  // Inter-VLAN routing related settings
  blockpriv?: string;           // '0' to allow private networks (RFC1918)
  blockbogons?: string;         // '0' to allow bogons
  disableftpproxy?: string;
  // VLAN specific
  vlan?: string;
  vlanpcp?: string;
  if?: string;                  // Parent interface for VLANs
}

export interface InterfaceOverview {
  name: string;
  device: string;
  status: string;
  ipaddr?: string;
  subnet?: string;
  gateway?: string;
  media?: string;
  statistics?: {
    packets_in: number;
    packets_out: number;
    bytes_in: number;
    bytes_out: number;
    errors_in: number;
    errors_out: number;
  };
}

export class InterfaceConfigResource {
  private client: OPNSenseAPIClient;
  private debugMode: boolean = process.env.MCP_DEBUG === 'true' || process.env.DEBUG_INTERFACES === 'true';
  private interfaceCache: Map<string, InterfaceConfig> = new Map();

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
  }

  /**
   * List all interfaces with their overview
   * Uses fallback endpoints for compatibility with OPNsense 25.7+
   */
  async listOverview(): Promise<InterfaceOverview[]> {
    if (this.debugMode) {
      console.log('[InterfaceConfig] Getting interface overview');
    }

    // Try primary endpoint first (works on older OPNsense versions)
    try {
      const response = await this.client.get('/interfaces/overview/list');

      if (this.debugMode) {
        console.log('[InterfaceConfig] Overview response:', {
          isArray: Array.isArray(response),
          hasRows: !!response?.rows,
          keys: response ? Object.keys(response) : []
        });
      }

      const result = this.parseInterfaceResponse(response);
      if (result.length > 0) {
        return result;
      }
    } catch (error) {
      if (this.debugMode) {
        console.log('[InterfaceConfig] /interfaces/overview/list failed, trying fallback endpoints');
      }
    }

    // Fallback: Use diagnostics endpoints (OPNsense 25.7+)
    try {
      return await this.listOverviewFromDiagnostics();
    } catch (error) {
      if (this.debugMode) {
        console.log('[InterfaceConfig] Diagnostics fallback failed:', error);
      }
    }

    return [];
  }

  /**
   * Fallback interface discovery using diagnostics endpoints
   * Compatible with OPNsense 25.7+ where /interfaces/overview/list is removed
   */
  private async listOverviewFromDiagnostics(): Promise<InterfaceOverview[]> {
    if (this.debugMode) {
      console.log('[InterfaceConfig] Fetching interfaces via diagnostics endpoints');
    }

    // Get interface names
    let interfaceNames: Record<string, string> = {};
    try {
      const namesResponse = await this.client.get('/diagnostics/interface/getInterfaceNames');
      if (namesResponse && typeof namesResponse === 'object') {
        interfaceNames = namesResponse;
      }
    } catch (error) {
      if (this.debugMode) {
        console.log('[InterfaceConfig] getInterfaceNames failed:', error);
      }
    }

    // Get interface statistics for additional details
    let interfaceStats: Record<string, any> = {};
    try {
      const statsResponse = await this.client.get('/diagnostics/interface/getInterfaceStatistics');
      if (statsResponse && typeof statsResponse === 'object') {
        interfaceStats = statsResponse;
      }
    } catch (error) {
      if (this.debugMode) {
        console.log('[InterfaceConfig] getInterfaceStatistics failed:', error);
      }
    }

    // Also try to get interface config details for IPs
    let interfaceConfig: Record<string, any> = {};
    try {
      const configResponse = await this.client.get('/diagnostics/interface/getInterfaceConfig');
      if (configResponse && typeof configResponse === 'object') {
        interfaceConfig = configResponse;
      }
    } catch (error) {
      if (this.debugMode) {
        console.log('[InterfaceConfig] getInterfaceConfig failed:', error);
      }
    }

    // Merge data from all sources
    const interfaces: InterfaceOverview[] = [];
    const allDevices = new Set([
      ...Object.keys(interfaceNames),
      ...Object.keys(interfaceStats),
      ...Object.keys(interfaceConfig)
    ]);

    for (const device of allDevices) {
      const name = interfaceNames[device] || device;
      const stats = interfaceStats[device] || {};
      const config = interfaceConfig[device] || {};

      interfaces.push({
        name: name,
        device: device,
        status: config.status || stats.status || (stats['packets received'] ? 'up' : 'unknown'),
        ipaddr: config.ipaddr || config.addr || config.ipv4?.[0]?.ipaddr,
        subnet: config.subnet || config.subnetbits || config.ipv4?.[0]?.subnetbits,
        gateway: config.gateway,
        media: config.media || stats.media,
        statistics: stats ? {
          packets_in: parseInt(stats['packets received'] || stats.inpkts || '0', 10),
          packets_out: parseInt(stats['packets transmitted'] || stats.outpkts || '0', 10),
          bytes_in: parseInt(stats['bytes received'] || stats.inbytes || '0', 10),
          bytes_out: parseInt(stats['bytes transmitted'] || stats.outbytes || '0', 10),
          errors_in: parseInt(stats['input errors'] || stats.inerrs || '0', 10),
          errors_out: parseInt(stats['output errors'] || stats.outerrs || '0', 10)
        } : undefined
      });
    }

    if (this.debugMode) {
      console.log(`[InterfaceConfig] Diagnostics fallback found ${interfaces.length} interfaces`);
    }

    return interfaces;
  }

  /**
   * Parse various interface response formats into a consistent array
   */
  private parseInterfaceResponse(response: any): InterfaceOverview[] {
    if (!response) return [];

    // Handle array format
    if (Array.isArray(response)) {
      return response;
    }

    // Handle rows format
    if (response.rows && Array.isArray(response.rows)) {
      return response.rows;
    }

    // Convert object format to array
    if (typeof response === 'object') {
      const entries = Object.entries(response);
      // Check if this looks like an "Endpoint not found" error or empty response
      if (entries.length === 0 || (entries.length === 1 && response.message)) {
        return [];
      }
      return entries.map(([name, config]: [string, any]) => ({
        name,
        ...config
      }));
    }

    return [];
  }

  /**
   * Get detailed configuration for a specific interface
   */
  async getInterfaceConfig(interfaceName: string): Promise<InterfaceConfig | null> {
    if (this.debugMode) {
      console.log(`[InterfaceConfig] Getting config for interface: ${interfaceName}`);
    }

    try {
      // Try multiple endpoints
      const endpoints = [
        `/interfaces/settings/get/${interfaceName}`,
        `/interfaces/${interfaceName}/get`,
        `/interfaces/vlan_settings/getItem/${interfaceName}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.client.get(endpoint);
          
          if (this.debugMode) {
            console.log(`[InterfaceConfig] ${endpoint} response:`, {
              hasInterface: !!response?.interface,
              hasSettings: !!response?.settings,
              keys: Object.keys(response || {})
            });
          }

          const config = response?.interface || response?.settings || response;
          if (config && typeof config === 'object') {
            // Cache the configuration
            this.interfaceCache.set(interfaceName, config);
            return config;
          }
        } catch (error) {
          if (this.debugMode) {
            console.log(`[InterfaceConfig] ${endpoint} failed:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error getting interface config for ${interfaceName}:`, error);
    }

    return null;
  }

  /**
   * Update interface configuration
   */
  async updateInterfaceConfig(interfaceName: string, config: Partial<InterfaceConfig>): Promise<boolean> {
    if (this.debugMode) {
      console.log(`[InterfaceConfig] Updating interface ${interfaceName}:`, config);
    }

    try {
      // Try multiple endpoints
      const endpoints = [
        { path: `/interfaces/settings/set/${interfaceName}`, wrapper: 'interface' },
        { path: `/interfaces/${interfaceName}/set`, wrapper: 'settings' },
        { path: `/interfaces/vlan_settings/setItem/${interfaceName}`, wrapper: 'vlan' }
      ];

      for (const endpoint of endpoints) {
        try {
          const payload = endpoint.wrapper ? { [endpoint.wrapper]: config } : config;
          const response = await this.client.post(endpoint.path, payload);
          
          if (this.debugMode) {
            console.log(`[InterfaceConfig] ${endpoint.path} response:`, response);
          }

          if (response?.result === 'saved' || response?.status === 'ok') {
            // Apply the changes
            await this.applyChanges();
            // Update cache
            this.interfaceCache.set(interfaceName, { ...this.interfaceCache.get(interfaceName), ...config });
            return true;
          }
        } catch (error) {
          if (this.debugMode) {
            console.log(`[InterfaceConfig] ${endpoint.path} failed:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error updating interface ${interfaceName}:`, error);
    }

    return false;
  }

  /**
   * Enable inter-VLAN routing on a specific interface
   * This removes the "Block private networks" and "Block bogons" settings
   */
  async enableInterVLANRoutingOnInterface(interfaceName: string): Promise<boolean> {
    console.log(`[InterfaceConfig] Enabling inter-VLAN routing on ${interfaceName}...`);

    try {
      // Get current configuration
      const currentConfig = await this.getInterfaceConfig(interfaceName);
      
      if (!currentConfig) {
        console.error(`Interface ${interfaceName} not found`);
        return false;
      }

      if (this.debugMode) {
        console.log('[InterfaceConfig] Current interface config:', {
          name: interfaceName,
          blockpriv: currentConfig.blockpriv,
          blockbogons: currentConfig.blockbogons
        });
      }

      // Update settings to enable inter-VLAN routing
      const updatedConfig: Partial<InterfaceConfig> = {
        blockpriv: '0',        // Don't block private networks (RFC1918)
        blockbogons: '0'       // Don't block bogons
      };

      const success = await this.updateInterfaceConfig(interfaceName, updatedConfig);
      
      if (success) {
        console.log(`[InterfaceConfig] Inter-VLAN routing enabled on ${interfaceName}`);
      } else {
        console.log(`[InterfaceConfig] Failed to enable inter-VLAN routing on ${interfaceName}`);
      }

      return success;
    } catch (error) {
      console.error(`Error enabling inter-VLAN routing on ${interfaceName}:`, error);
      return false;
    }
  }

  /**
   * Enable inter-VLAN routing on all interfaces
   */
  async enableInterVLANRoutingOnAllInterfaces(): Promise<{ success: boolean; details: any[] }> {
    console.log('[InterfaceConfig] Enabling inter-VLAN routing on all interfaces...');

    const results: any[] = [];
    const interfaces = await this.listOverview();

    for (const iface of interfaces) {
      const result = {
        interface: iface.name,
        success: false,
        message: ''
      };

      try {
        const success = await this.enableInterVLANRoutingOnInterface(iface.name);
        result.success = success;
        result.message = success ? 'Enabled' : 'Failed';
      } catch (error: any) {
        result.message = error.message || 'Unknown error';
      }

      results.push(result);
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      details: results
    };
  }

  /**
   * Find interface by IP subnet
   */
  async findInterfaceBySubnet(subnet: string): Promise<InterfaceOverview | null> {
    const interfaces = await this.listOverview();
    
    for (const iface of interfaces) {
      if (iface.ipaddr && iface.subnet) {
        const ifaceNetwork = `${iface.ipaddr.split('.').slice(0, 3).join('.')}.0/${iface.subnet}`;
        if (ifaceNetwork === subnet || iface.ipaddr.startsWith(subnet.split('/')[0].split('.').slice(0, 3).join('.'))) {
          return iface;
        }
      }
    }

    return null;
  }

  /**
   * Configure DMZ interface for inter-VLAN routing
   */
  async configureDMZInterface(dmzInterface: string = 'opt8'): Promise<boolean> {
    console.log(`[InterfaceConfig] Configuring DMZ interface ${dmzInterface} for inter-VLAN routing...`);

    try {
      // Enable inter-VLAN routing on DMZ interface
      const success = await this.enableInterVLANRoutingOnInterface(dmzInterface);
      
      if (success) {
        // Additional DMZ-specific configuration if needed
        const dmzConfig: Partial<InterfaceConfig> = {
          enable: '1',           // Ensure interface is enabled
          blockpriv: '0',        // Allow private networks
          blockbogons: '0',      // Allow bogons
          disableftpproxy: '1'   // Disable FTP proxy for better routing
        };

        await this.updateInterfaceConfig(dmzInterface, dmzConfig);
      }

      return success;
    } catch (error) {
      console.error(`Error configuring DMZ interface ${dmzInterface}:`, error);
      return false;
    }
  }

  /**
   * Apply interface changes
   */
  async applyChanges(): Promise<void> {
    if (this.debugMode) {
      console.log('[InterfaceConfig] Applying interface changes');
    }

    const applyEndpoints = [
      '/interfaces/reconfigure',
      '/interfaces/vlan_settings/reconfigure'
    ];

    for (const endpoint of applyEndpoints) {
      try {
        await this.client.post(endpoint);
        if (this.debugMode) {
          console.log(`[InterfaceConfig] Applied changes via ${endpoint}`);
        }
      } catch (error) {
        if (this.debugMode) {
          console.log(`[InterfaceConfig] ${endpoint} failed:`, error);
        }
      }
    }

    // Add delay for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Debug method to discover interface endpoints
   */
  async debugDiscoverEndpoints(): Promise<void> {
    console.log('\n[InterfaceConfig] Discovering interface endpoints...');

    const testEndpoints = [
      '/interfaces/overview/list',
      '/interfaces/overview/status',
      '/interfaces/settings/get',
      '/interfaces/lan/get',
      '/interfaces/wan/get',
      '/interfaces/opt1/get',
      '/interfaces/opt8/get',
      '/interfaces/vlan_settings/get',
      '/interfaces/vlan_settings/searchItem'
    ];

    for (const endpoint of testEndpoints) {
      try {
        const response = await this.client.get(endpoint);
        console.log(`\n${endpoint}:`);
        console.log('  Success - Response structure:', {
          isArray: Array.isArray(response),
          keys: Object.keys(response || {}).slice(0, 10),
          hasRows: !!response?.rows,
          rowCount: response?.rows?.length
        });

        // Check for interface-specific settings
        if (response && typeof response === 'object') {
          const interfaces = Array.isArray(response) ? response : 
                            response.rows ? response.rows : 
                            [response];
          
          for (const iface of interfaces.slice(0, 2)) {
            if (iface.blockpriv !== undefined || iface.blockbogons !== undefined) {
              console.log('  Found interface settings:', {
                name: iface.name || iface.descr,
                blockpriv: iface.blockpriv,
                blockbogons: iface.blockbogons
              });
            }
          }
        }
      } catch (error: any) {
        console.log(`\n${endpoint}:`);
        console.log('  Failed:', error?.message || error);
      }
    }
  }

  /**
   * Get interface statistics with fallback for OPNsense 25.7+
   */
  async getInterfaceStatistics(interfaceName: string): Promise<any> {
    // Try the legacy endpoint first
    try {
      const response = await this.client.get(`/interfaces/overview/getInterface/${interfaceName}`);
      if (response?.statistics || (response && !response.message)) {
        return response?.statistics || response;
      }
    } catch (error) {
      if (this.debugMode) {
        console.log(`[InterfaceConfig] Legacy stats endpoint failed for ${interfaceName}, trying diagnostics`);
      }
    }

    // Fallback to diagnostics endpoint
    try {
      const response = await this.client.get('/diagnostics/interface/getInterfaceStatistics');
      if (response && response[interfaceName]) {
        return response[interfaceName];
      }
    } catch (error) {
      console.error(`Error getting statistics for ${interfaceName}:`, error);
    }

    return null;
  }
}

export default InterfaceConfigResource;