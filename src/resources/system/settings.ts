// System Settings Resource Implementation
// Manages OPNsense system-level settings including inter-VLAN routing
import { OPNSenseAPIClient } from '../../api/client.js';

export interface SystemSettings {
  firewall?: FirewallSettings;
  routing?: RoutingSettings;
  general?: GeneralSettings;
}

export interface FirewallSettings {
  optimization?: string;
  maximumstates?: string;
  maximumtableentries?: string;
  bogonsinterval?: string;
  disablereplyto?: string;
  disablenegate?: string;
  disablenatreflection?: string;
  enablebinatreflection?: string;
  enablenatreflectionhelper?: string;
  reflectiontimeout?: string;
  bypassstaticroutes?: string;
  disablescrub?: string;
  scrubnodf?: string;
  scrubrnid?: string;
  optimization_conservative?: string;
  adaptivestart?: string;
  adaptiveend?: string;
  aliasesresolveinterval?: string;
  checkaliasesurlcert?: string;
  // Inter-VLAN routing specific settings
  blockprivatenetworks?: string;  // '0' to allow inter-VLAN routing
  blockbogons?: string;           // '0' to allow routing
  allowinterlantraffic?: string;  // '1' to enable inter-VLAN routing
}

export interface RoutingSettings {
  gateway_switch_default?: string;
  prefer_ipv4?: string;
  inet6?: string;
  nonat_outbound?: string;
  nonat_rules?: string;
  static_routes?: any[];
}

export interface GeneralSettings {
  hostname?: string;
  domain?: string;
  timezone?: string;
  prefer_ipv4?: string;
  language?: string;
  theme?: string;
}

export class SystemSettingsResource {
  private client: OPNSenseAPIClient;
  private debugMode: boolean = process.env.MCP_DEBUG === 'true' || process.env.DEBUG_SYSTEM === 'true';

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
  }

  /**
   * Get current firewall settings
   */
  async getFirewallSettings(): Promise<FirewallSettings | null> {
    if (this.debugMode) {
      console.log('[SystemSettings] Getting firewall settings');
    }

    try {
      // Try multiple endpoints to find firewall settings
      const endpoints = [
        '/firewall/settings/get',
        '/firewall/settings/advanced',
        '/system/settings/get'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.client.get(endpoint);
          
          if (this.debugMode) {
            console.log(`[SystemSettings] ${endpoint} response:`, {
              hasSettings: !!response?.settings,
              hasFirewall: !!response?.firewall,
              keys: Object.keys(response || {})
            });
          }

          // Extract settings from various response formats
          const settings = response?.settings || response?.firewall || response;
          if (settings && typeof settings === 'object') {
            return settings as FirewallSettings;
          }
        } catch (error) {
          if (this.debugMode) {
            console.log(`[SystemSettings] ${endpoint} failed:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error getting firewall settings:', error);
    }

    return null;
  }

  /**
   * Update firewall settings
   */
  async updateFirewallSettings(settings: Partial<FirewallSettings>): Promise<boolean> {
    if (this.debugMode) {
      console.log('[SystemSettings] Updating firewall settings:', settings);
    }

    try {
      // Try to update via different endpoints
      const endpoints = [
        { path: '/firewall/settings/set', wrapper: 'settings' },
        { path: '/firewall/settings/advanced/set', wrapper: 'advanced' },
        { path: '/system/settings/set', wrapper: 'firewall' }
      ];

      for (const endpoint of endpoints) {
        try {
          const payload = endpoint.wrapper ? { [endpoint.wrapper]: settings } : settings;
          const response = await this.client.post(endpoint.path, payload);
          
          if (this.debugMode) {
            console.log(`[SystemSettings] ${endpoint.path} response:`, response);
          }

          if (response?.result === 'saved' || response?.status === 'ok') {
            // Apply the changes
            await this.applySettings();
            return true;
          }
        } catch (error) {
          if (this.debugMode) {
            console.log(`[SystemSettings] ${endpoint.path} failed:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error updating firewall settings:', error);
    }

    return false;
  }

  /**
   * Enable inter-VLAN routing
   * This disables the blocking of private networks and enables routing between VLANs
   */
  async enableInterVLANRouting(): Promise<boolean> {
    console.log('[SystemSettings] Enabling inter-VLAN routing...');

    try {
      // Get current settings
      const currentSettings = await this.getFirewallSettings();
      
      if (this.debugMode) {
        console.log('[SystemSettings] Current settings:', currentSettings);
      }

      // Update settings to enable inter-VLAN routing
      const updatedSettings: Partial<FirewallSettings> = {
        blockprivatenetworks: '0',    // Don't block private networks
        blockbogons: '0',              // Don't block bogons (for internal routing)
        allowinterlantraffic: '1',     // Allow inter-LAN traffic
        bypassstaticroutes: '1',       // Bypass firewall for static routes
        disablereplyto: '1'            // Disable reply-to for proper routing
      };

      const success = await this.updateFirewallSettings(updatedSettings);
      
      if (success) {
        console.log('[SystemSettings] Inter-VLAN routing enabled successfully');
      } else {
        console.log('[SystemSettings] Failed to enable inter-VLAN routing');
      }

      return success;
    } catch (error) {
      console.error('Error enabling inter-VLAN routing:', error);
      return false;
    }
  }

  /**
   * Get routing settings
   */
  async getRoutingSettings(): Promise<RoutingSettings | null> {
    if (this.debugMode) {
      console.log('[SystemSettings] Getting routing settings');
    }

    try {
      const response = await this.client.get('/routing/settings/get');
      return response?.settings || response || null;
    } catch (error) {
      console.error('Error getting routing settings:', error);
      return null;
    }
  }

  /**
   * Update routing settings
   */
  async updateRoutingSettings(settings: Partial<RoutingSettings>): Promise<boolean> {
    if (this.debugMode) {
      console.log('[SystemSettings] Updating routing settings:', settings);
    }

    try {
      const response = await this.client.post('/routing/settings/set', { settings });
      
      if (response?.result === 'saved' || response?.status === 'ok') {
        await this.applySettings();
        return true;
      }
    } catch (error) {
      console.error('Error updating routing settings:', error);
    }

    return false;
  }

  /**
   * Get all system settings
   */
  async getAllSettings(): Promise<SystemSettings> {
    const [firewall, routing, general] = await Promise.all([
      this.getFirewallSettings(),
      this.getRoutingSettings(),
      this.getGeneralSettings()
    ]);

    return {
      firewall: firewall || undefined,
      routing: routing || undefined,
      general: general || undefined
    };
  }

  /**
   * Get general system settings
   */
  async getGeneralSettings(): Promise<GeneralSettings | null> {
    try {
      const response = await this.client.get('/system/settings/general/get');
      return response?.settings || response || null;
    } catch (error) {
      console.error('Error getting general settings:', error);
      return null;
    }
  }

  /**
   * Apply system settings changes
   */
  async applySettings(): Promise<void> {
    if (this.debugMode) {
      console.log('[SystemSettings] Applying settings changes');
    }

    const applyEndpoints = [
      '/firewall/filter/reconfigure',
      '/routing/service/reconfigure',
      '/system/settings/reconfigure'
    ];

    for (const endpoint of applyEndpoints) {
      try {
        await this.client.post(endpoint);
        if (this.debugMode) {
          console.log(`[SystemSettings] Applied changes via ${endpoint}`);
        }
      } catch (error) {
        if (this.debugMode) {
          console.log(`[SystemSettings] ${endpoint} failed:`, error);
        }
      }
    }

    // Add delay for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Debug method to discover available settings endpoints
   */
  async debugDiscoverEndpoints(): Promise<void> {
    console.log('\n[SystemSettings] Discovering settings endpoints...');

    const testEndpoints = [
      '/firewall/settings/get',
      '/firewall/settings/advanced',
      '/firewall/filter/settings',
      '/system/settings/get',
      '/system/settings/advanced',
      '/routing/settings/get',
      '/routing/general/get',
      '/interfaces/settings/get'
    ];

    for (const endpoint of testEndpoints) {
      try {
        const response = await this.client.get(endpoint);
        console.log(`\n${endpoint}:`);
        console.log('  Success - Response structure:', {
          keys: Object.keys(response || {}),
          hasSettings: !!response?.settings,
          hasFirewall: !!response?.firewall,
          hasAdvanced: !!response?.advanced
        });
        
        // Log specific settings if found
        if (response?.settings || response?.firewall || response?.advanced) {
          const settings = response.settings || response.firewall || response.advanced;
          const relevantKeys = Object.keys(settings).filter(key => 
            key.includes('block') || 
            key.includes('route') || 
            key.includes('vlan') ||
            key.includes('inter')
          );
          if (relevantKeys.length > 0) {
            console.log('  Relevant settings found:', relevantKeys);
          }
        }
      } catch (error: any) {
        console.log(`\n${endpoint}:`);
        console.log('  Failed:', error?.message || error);
      }
    }
  }
}

export default SystemSettingsResource;