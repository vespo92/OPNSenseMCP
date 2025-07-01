// Fixed OPNsense API Client that handles the Content-Type header quirk
import axios from 'axios';
import https from 'https';
import { APICall } from '../macro/types.js';

export class OPNSenseAPIClient {
  private config: any;
  private axios: any;
  private debugMode: boolean;
  private recorder?: (call: Omit<APICall, 'id' | 'timestamp'>) => void;

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
   * Set a recorder function to capture API calls
   */
  setRecorder(recorder: (call: Omit<APICall, 'id' | 'timestamp'>) => void): void {
    this.recorder = recorder;
  }

  /**
   * Remove the recorder
   */
  removeRecorder(): void {
    this.recorder = undefined;
  }

  /**
   * GET request - NO Content-Type header for OPNsense compatibility
   */
  async get(path: string): Promise<any> {
    const startTime = Date.now();
    const response = await this.axios.get(path, {
      headers: {
        'Accept': 'application/json'
        // NO Content-Type header for GET requests!
      }
    });

    const duration = Date.now() - startTime;

    if (response.status === 404) {
      this.recordCall('GET', path, undefined, undefined, response, duration, {
        code: 'NOT_FOUND',
        message: `Endpoint not found: ${path}`
      });
      throw new Error(`Endpoint not found: ${path}`);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('GET', path, undefined, undefined, response, duration);
      return response.data;
    }

    this.recordCall('GET', path, undefined, undefined, response, duration, {
      code: 'API_ERROR',
      message: `API error: ${response.status} ${response.statusText}`
    });
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  /**
   * POST request - WITH Content-Type header
   */
  async post(path: string, data: any = {}): Promise<any> {
    const startTime = Date.now();
    const response = await this.axios.post(path, data, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;

    if (response.status === 404) {
      this.recordCall('POST', path, undefined, data, response, duration, {
        code: 'NOT_FOUND',
        message: `Endpoint not found: ${path}`
      });
      throw new Error(`Endpoint not found: ${path}`);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('POST', path, undefined, data, response, duration);
      return response.data;
    }

    this.recordCall('POST', path, undefined, data, response, duration, {
      code: 'API_ERROR',
      message: `API error: ${response.status} ${response.statusText}`
    });
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

  // ===== DNS/UNBOUND METHODS =====

  /**
   * Get Unbound DNS settings
   */
  async getUnboundSettings(): Promise<any> {
    return this.get('/unbound/settings/get');
  }

  /**
   * Get specific Unbound host override
   */
  async getUnboundHost(uuid: string): Promise<any> {
    return this.get(`/unbound/settings/getHostOverride/${uuid}`);
  }

  /**
   * Add Unbound host override (for DNS blocking)
   */
  async addUnboundHost(hostData: any): Promise<any> {
    return this.post('/unbound/settings/addHostOverride', { host: hostData });
  }

  /**
   * Update Unbound host override
   */
  async setUnboundHost(uuid: string, hostData: any): Promise<any> {
    return this.post(`/unbound/settings/setHostOverride/${uuid}`, { host: hostData });
  }

  /**
   * Delete Unbound host override
   */
  async delUnboundHost(uuid: string): Promise<any> {
    return this.post(`/unbound/settings/delHostOverride/${uuid}`);
  }

  /**
   * Search Unbound host overrides
   */
  async searchUnboundHosts(params: any = {}): Promise<any> {
    const searchParams = {
      current: params.current || 1,
      rowCount: params.rowCount || 1000,
      sort: params.sort || {},
      searchPhrase: params.searchPhrase || ''
    };
    return this.post('/unbound/settings/searchHostOverride', searchParams);
  }

  /**
   * Apply Unbound configuration changes
   */
  async applyUnboundChanges(): Promise<any> {
    return this.post('/unbound/service/reconfigure');
  }

  /**
   * Get Unbound access lists (for interface-specific DNS)
   */
  async getUnboundAccessLists(): Promise<any> {
    return this.get('/unbound/settings/get');
  }

  /**
   * Add Unbound access list
   */
  async addUnboundAccessList(aclData: any): Promise<any> {
    return this.post('/unbound/settings/addAcl', { acl: aclData });
  }

  /**
   * Update Unbound access list
   */
  async setUnboundAccessList(uuid: string, aclData: any): Promise<any> {
    return this.post(`/unbound/settings/setAcl/${uuid}`, { acl: aclData });
  }

  /**
   * Delete Unbound access list
   */
  async delUnboundAccessList(uuid: string): Promise<any> {
    return this.post(`/unbound/settings/delAcl/${uuid}`);
  }

  /**
   * PUT request - WITH Content-Type header
   */
  async put(path: string, data: any = {}): Promise<any> {
    const startTime = Date.now();
    const response = await this.axios.put(path, data, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;

    if (response.status === 404) {
      this.recordCall('PUT', path, undefined, data, response, duration, {
        code: 'NOT_FOUND',
        message: `Endpoint not found: ${path}`
      });
      throw new Error(`Endpoint not found: ${path}`);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('PUT', path, undefined, data, response, duration);
      return response.data;
    }

    this.recordCall('PUT', path, undefined, data, response, duration, {
      code: 'API_ERROR',
      message: `API error: ${response.status} ${response.statusText}`
    });
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  /**
   * DELETE request
   */
  async delete(path: string): Promise<any> {
    const startTime = Date.now();
    const response = await this.axios.delete(path, {
      headers: {
        'Accept': 'application/json'
      }
    });

    const duration = Date.now() - startTime;

    if (response.status === 404) {
      this.recordCall('DELETE', path, undefined, undefined, response, duration, {
        code: 'NOT_FOUND',
        message: `Endpoint not found: ${path}`
      });
      throw new Error(`Endpoint not found: ${path}`);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('DELETE', path, undefined, undefined, response, duration);
      return response.data;
    }

    this.recordCall('DELETE', path, undefined, undefined, response, duration, {
      code: 'API_ERROR',
      message: `API error: ${response.status} ${response.statusText}`
    });
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  /**
   * Record an API call if a recorder is set
   */
  private recordCall(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    params?: Record<string, any>,
    payload?: any,
    response?: any,
    duration?: number,
    error?: { code: string; message: string }
  ): void {
    if (!this.recorder) return;

    const call: Omit<APICall, 'id' | 'timestamp'> = {
      method,
      path,
      params,
      payload,
      duration
    };

    if (response) {
      call.response = {
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    }

    if (error) {
      call.error = error;
    }

    this.recorder(call);
  }
}

// Export for both TypeScript and JavaScript usage
export default OPNSenseAPIClient;
