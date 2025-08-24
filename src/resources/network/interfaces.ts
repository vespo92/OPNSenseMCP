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
   */
  async listOverview(): Promise<InterfaceOverview[]> {
    if (this.debugMode) {
      console.log('[InterfaceConfig] Getting interface overview');
    }

    try {
      const response = await this.client.get('/interfaces/overview/list');
      
      if (this.debugMode) {
        console.log('[InterfaceConfig] Overview response:', {
          isArray: Array.isArray(response),
          hasRows: !!response?.rows,
          keys: response ? Object.keys(response) : []
        });
      }

      // Handle different response formats
      if (Array.isArray(response)) {
        return response;
      }
      
      if (response?.rows && Array.isArray(response.rows)) {
        return response.rows;
      }

      // Convert object format to array
      if (response && typeof response === 'object') {
        return Object.entries(response).map(([name, config]: [string, any]) => ({
          name,
          ...config
        }));
      }
    } catch (error) {
      console.error('Error listing interface overview:', error);
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
   * Get interface statistics
   */
  async getInterfaceStatistics(interfaceName: string): Promise<any> {
    try {
      const response = await this.client.get(`/interfaces/overview/getInterface/${interfaceName}`);
      return response?.statistics || response;
    } catch (error) {
      console.error(`Error getting statistics for ${interfaceName}:`, error);
      return null;
    }
  }
}

export default InterfaceConfigResource;