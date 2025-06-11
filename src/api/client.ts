// Fixed OPNsense API Client that handles the Content-Type header quirk
import axios from 'axios';
import https from 'https';

export class OPNSenseAPIClient {
  private config: any;
  private axios: any;
  private debugMode: boolean;

  constructor(config: any) {
    this.config = config;
    this.debugMode = config.debugMode || false;
    
    // Create axios instance
    this.axios = axios.create({
      baseURL: `${this.config.host}/api`,
      auth: {
        username: this.config.apiKey,
        password: this.config.apiSecret
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: this.config.verifySsl !== false
      }),
      timeout: this.config.timeout || 30000,
      // Don't set default headers - we'll add them per request
      validateStatus: () => true // Handle all status codes
    });

    // Add request interceptor for debugging
    this.axios.interceptors.request.use((config: any) => {
      if (this.debugMode) {
        console.log('[API Request]', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
          data: config.data
        });
      }
      return config;
    });

    // Add response interceptor
    this.axios.interceptors.response.use((response: any) => {
      if (this.debugMode) {
        console.log('[API Response]', {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        });
      }
      return response;
    });
  }

  /**
   * GET request - NO Content-Type header for OPNsense compatibility
   */
  async get(path: string): Promise<any> {
    const response = await this.axios.get(path, {
      headers: {
        'Accept': 'application/json'
        // NO Content-Type header for GET requests!
      }
    });

    if (response.status === 404) {
      throw new Error(`Endpoint not found: ${path}`);
    }

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    }

    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  /**
   * POST request - WITH Content-Type header
   */
  async post(path: string, data: any = {}): Promise<any> {
    const response = await this.axios.post(path, data, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 404) {
      throw new Error(`Endpoint not found: ${path}`);
    }

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    }

    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  /**
   * Search for VLANs using the working endpoint
   */
  async searchVlans(params: any = {}): Promise<any> {
    const searchParams = {
      current: params.current || 1,
      rowCount: params.rowCount || 100,
      sort: params.sort || {},
      searchPhrase: params.searchPhrase || ''
    };

    // Use the working endpoint
    return this.post('/interfaces/vlan_settings/searchItem', searchParams);
  }

  /**
   * Get all VLAN settings
   */
  async getVlanSettings(): Promise<any> {
    return this.get('/interfaces/vlan_settings/get');
  }

  /**
   * Add a new VLAN
   */
  async addVlan(vlanData: any): Promise<any> {
    return this.post('/interfaces/vlan_settings/addItem', { vlan: vlanData });
  }

  /**
   * Update a VLAN
   */
  async setVlan(uuid: string, vlanData: any): Promise<any> {
    return this.post(`/interfaces/vlan_settings/setItem/${uuid}`, { vlan: vlanData });
  }

  /**
   * Delete a VLAN
   */
  async delVlan(uuid: string): Promise<any> {
    return this.post(`/interfaces/vlan_settings/delItem/${uuid}`);
  }

  /**
   * Apply VLAN changes
   */
  async applyVlanChanges(): Promise<any> {
    return this.post('/interfaces/vlan_settings/reconfigure');
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<any> {
    try {
      const result = await this.get('/core/firmware/info');
      return { 
        success: true, 
        version: result.product_version,
        product: result.product_name 
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // ===== FIREWALL RULE METHODS =====

  /**
   * Search firewall rules
   */
  async searchFirewallRules(params: any = {}): Promise<any> {
    const searchParams = {
      current: params.current || 1,
      rowCount: params.rowCount || 1000,
      sort: params.sort || {},
      searchPhrase: params.searchPhrase || ''
    };
    return this.post('/firewall/filter/searchRule', searchParams);
  }

  /**
   * Get firewall rule by UUID
   */
  async getFirewallRule(uuid: string): Promise<any> {
    return this.get(`/firewall/filter/getRule/${uuid}`);
  }

  /**
   * Get firewall rule options (for dropdowns)
   */
  async getFirewallRuleOptions(): Promise<any> {
    return this.get('/firewall/filter/getRule');
  }

  /**
   * Add firewall rule
   */
  async addFirewallRule(ruleData: any): Promise<any> {
    return this.post('/firewall/filter/addRule', { rule: ruleData });
  }

  /**
   * Update firewall rule
   */
  async setFirewallRule(uuid: string, ruleData: any): Promise<any> {
    return this.post(`/firewall/filter/setRule/${uuid}`, { rule: ruleData });
  }

  /**
   * Delete firewall rule
   */
  async delFirewallRule(uuid: string): Promise<any> {
    return this.post(`/firewall/filter/delRule/${uuid}`);
  }

  /**
   * Apply firewall changes
   */
  async applyFirewallChanges(): Promise<any> {
    return this.post('/firewall/filter/apply');
  }

  // ===== BACKUP METHODS =====

  /**
   * Download current configuration
   */
  async downloadConfig(): Promise<any> {
    return this.get('/core/backup/download/this');
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<any> {
    return this.get('/core/backup/list');
  }

  /**
   * Upload/restore configuration
   */
  async restoreConfig(configData: any): Promise<any> {
    return this.post('/core/backup/restore', configData);
  }

  /**
   * Get system information for backups
   */
  async getSystemInfo(): Promise<any> {
    return this.get('/core/system/status');
  }

  // ===== DHCP METHODS =====

  /**
   * Search DHCP leases
   */
  async searchDhcpLeases(params: any = {}): Promise<any> {
    const searchParams = {
      current: params.current || 1,
      rowCount: params.rowCount || 1000,
      sort: params.sort || {},
      searchPhrase: params.searchPhrase || ''
    };
    return this.post('/dhcpv4/leases/searchLease', searchParams);
  }

  /**
   * Get DHCP settings
   */
  async getDhcpSettings(): Promise<any> {
    return this.get('/dhcpv4/settings/get');
  }

  /**
   * Search static mappings
   */
  async searchStaticMappings(params: any = {}): Promise<any> {
    const searchParams = {
      current: params.current || 1,
      rowCount: params.rowCount || 1000,
      sort: params.sort || {},
      searchPhrase: params.searchPhrase || ''
    };
    return this.post('/dhcpv4/settings/searchStaticMap', searchParams);
  }

  /**
   * Add static mapping
   */
  async addStaticMapping(mappingData: any): Promise<any> {
    return this.post('/dhcpv4/settings/addStaticMap', { staticmap: mappingData });
  }

  /**
   * Update static mapping
   */
  async setStaticMapping(uuid: string, mappingData: any): Promise<any> {
    return this.post(`/dhcpv4/settings/setStaticMap/${uuid}`, { staticmap: mappingData });
  }

  /**
   * Delete static mapping
   */
  async delStaticMapping(uuid: string): Promise<any> {
    return this.post(`/dhcpv4/settings/delStaticMap/${uuid}`);
  }

  /**
   * Apply DHCP changes
   */
  async applyDhcpChanges(): Promise<any> {
    return this.post('/dhcpv4/service/reconfigure');
  }
}

// Export for both TypeScript and JavaScript usage
export default OPNSenseAPIClient;
