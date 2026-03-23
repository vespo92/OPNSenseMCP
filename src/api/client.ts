// Consolidated OPNsense API Client with enhanced error handling and full functionality
import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { APICall } from '../macro/types.js';
import { logger } from '../utils/logger.js';

/**
 * Custom error class for OPNsense API errors
 */
export class OPNSenseAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiResponse?: any
  ) {
    super(message);
    this.name = 'OPNSenseAPIError';
  }
}

/**
 * OPNsense API Client with comprehensive functionality and error handling
 */
export class OPNSenseAPIClient {
  private axios: AxiosInstance;
  private debugMode: boolean;
  private recorder?: (call: Omit<APICall, 'id' | 'timestamp'>) => void;

  constructor(private config: {
    host: string;
    apiKey: string;
    apiSecret: string;
    verifySsl?: boolean;
    debugMode?: boolean;
    timeout?: number;
  }) {
    this.debugMode = config.debugMode || false;
    
    // Create axios instance with proper configuration
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
      // Don't set default headers - we'll add them per request type
      validateStatus: () => true // Handle all status codes
    });

    // Add request interceptor for debugging
    this.axios.interceptors.request.use(
      (config) => {
        if (this.debugMode) {
          logger.debug('[API Request]', {
            method: config.method?.toUpperCase(),
            url: config.url,
            headers: config.headers,
            data: config.data
          });
        }
        return config;
      },
      (error) => {
        if (this.debugMode) {
          logger.error('[API Request Error]', error);
        }
        return Promise.reject(error);
      }
    );

    // Add response interceptor for debugging and error handling
    this.axios.interceptors.response.use(
      (response) => {
        if (this.debugMode) {
          logger.debug('[API Response]', {
            status: response.status,
            statusText: response.statusText,
            data: response.data
          });
        }
        return response;
      },
      (error: AxiosError) => {
        if (this.debugMode) {
          logger.error('[API Response Error]', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Extract error message from various API response formats
   */
  private extractErrorMessage(data: any): string | null {
    if (typeof data === 'string') {
      return data;
    }
    if (data?.message) {
      return data.message;
    }
    if (data?.errorMessage) {
      return data.errorMessage;
    }
    if (data?.validations) {
      if (typeof data.validations === 'string') {
        return data.validations;
      }
      if (typeof data.validations === 'object') {
        return Object.entries(data.validations)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
    }
    return null;
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

  /**
   * GET request - NO Content-Type header for OPNsense compatibility
   */
  async get<T = any>(path: string): Promise<T> {
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
      throw new OPNSenseAPIError(`Endpoint not found: ${path}`, 404);
    }

    // Handle API errors returned with 200 status
    if (response.data && response.data.result === 'failed') {
      const errorMessage = this.extractErrorMessage(response.data) || 'API operation failed';
      this.recordCall('GET', path, undefined, undefined, response, duration, {
        code: 'API_FAILED',
        message: errorMessage
      });
      throw new OPNSenseAPIError(errorMessage, response.status, response.data);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('GET', path, undefined, undefined, response, duration);
      return response.data;
    }

    const errorMessage = this.extractErrorMessage(response.data) || `API error: ${response.status} ${response.statusText}`;
    this.recordCall('GET', path, undefined, undefined, response, duration, {
      code: 'API_ERROR',
      message: errorMessage
    });
    throw new OPNSenseAPIError(errorMessage, response.status, response.data);
  }

  /**
   * POST request - WITH Content-Type header
   */
  async post<T = any>(path: string, data: any = {}): Promise<T> {
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
      throw new OPNSenseAPIError(`Endpoint not found: ${path}`, 404);
    }

    // Handle API errors returned with 200 status
    if (response.data && response.data.result === 'failed') {
      const errorMessage = this.extractErrorMessage(response.data) || 'API operation failed';
      this.recordCall('POST', path, undefined, data, response, duration, {
        code: 'API_FAILED',
        message: errorMessage
      });
      throw new OPNSenseAPIError(errorMessage, response.status, response.data);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('POST', path, undefined, data, response, duration);
      return response.data;
    }

    const errorMessage = this.extractErrorMessage(response.data) || `API error: ${response.status} ${response.statusText}`;
    this.recordCall('POST', path, undefined, data, response, duration, {
      code: 'API_ERROR',
      message: errorMessage
    });
    throw new OPNSenseAPIError(errorMessage, response.status, response.data);
  }

  /**
   * PUT request - WITH Content-Type header
   */
  async put<T = any>(path: string, data: any = {}): Promise<T> {
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
      throw new OPNSenseAPIError(`Endpoint not found: ${path}`, 404);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('PUT', path, undefined, data, response, duration);
      return response.data;
    }

    const errorMessage = this.extractErrorMessage(response.data) || `API error: ${response.status} ${response.statusText}`;
    this.recordCall('PUT', path, undefined, data, response, duration, {
      code: 'API_ERROR',
      message: errorMessage
    });
    throw new OPNSenseAPIError(errorMessage, response.status, response.data);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string): Promise<T> {
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
      throw new OPNSenseAPIError(`Endpoint not found: ${path}`, 404);
    }

    if (response.status >= 200 && response.status < 300) {
      this.recordCall('DELETE', path, undefined, undefined, response, duration);
      return response.data;
    }

    const errorMessage = this.extractErrorMessage(response.data) || `API error: ${response.status} ${response.statusText}`;
    this.recordCall('DELETE', path, undefined, undefined, response, duration, {
      code: 'API_ERROR',
      message: errorMessage
    });
    throw new OPNSenseAPIError(errorMessage, response.status, response.data);
  }

  // ===== VLAN METHODS =====

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

  /**
   * Reconfigure firewall filter
   */
  async reconfigureFirewall(): Promise<any> {
    return this.post('/firewall/filter/reconfigure');
  }

  /**
   * Get all firewall filter settings
   */
  async getFirewallFilterSettings(): Promise<any> {
    return this.get('/firewall/filter/get');
  }

  /**
   * Save firewall configuration
   */
  async saveFirewallConfig(): Promise<any> {
    return this.post('/firewall/filter/savepoint');
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
   * Get a specific DNSBL entry
   */
  async getDnsbl(uuid: string): Promise<any> {
    return this.get(`/unbound/settings/getDnsbl/${uuid}`);
  }

  /**
   * Add a DNSBL subscription entry
   */
  async addDnsbl(data: Record<string, unknown>): Promise<any> {
    return this.post('/unbound/settings/addDnsbl', { blocklist: data });
  }

  /**
   * Update a DNSBL subscription entry
   */
  async setDnsbl(uuid: string, data: Record<string, unknown>): Promise<any> {
    return this.post(`/unbound/settings/setDnsbl/${uuid}`, { blocklist: data });
  }

  /**
   * Delete a DNSBL subscription entry
   */
  async delDnsbl(uuid: string): Promise<any> {
    return this.post(`/unbound/settings/delDnsbl/${uuid}`);
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

  // ===== ACME CLIENT METHODS =====

  /**
   * Get all ACME client settings (settings, accounts, certificates, validations, actions)
   */
  async getAcmeSettings(): Promise<any> {
    return this.get('/acmeclient/settings/get');
  }

  /**
   * Update ACME settings using the full nested path (the only reliable write endpoint).
   * Auto-wraps in { acmeclient: ... } — callers should pass the inner structure, e.g.:
   * { certificates: { certificate: { "uuid": { renewInterval: "30" } } } }
   */
  async setAcmeSettings(data: Record<string, unknown>): Promise<any> {
    return this.post('/acmeclient/settings/set', { acmeclient: data });
  }

  /**
   * Get ACME service status
   */
  async getAcmeServiceStatus(): Promise<any> {
    return this.get('/acmeclient/service/status');
  }

  /**
   * Apply ACME configuration changes
   */
  async applyAcmeChanges(): Promise<any> {
    return this.post('/acmeclient/service/reconfigure');
  }

  /**
   * Get action template/schema for creating new actions
   */
  async getAcmeActionSchema(): Promise<any> {
    return this.get('/acmeclient/actions/get');
  }

  /**
   * Add a new ACME automation action
   */
  async addAcmeAction(data: Record<string, unknown>): Promise<any> {
    return this.post('/acmeclient/actions/add', { action: data });
  }

  /**
   * Delete an ACME automation action
   */
  async delAcmeAction(uuid: string): Promise<any> {
    return this.post(`/acmeclient/actions/del/${uuid}`);
  }

  /**
   * Trigger renewal of a specific certificate
   */
  async renewAcmeCertificate(uuid: string): Promise<any> {
    return this.post(`/acmeclient/service/renewCert/${uuid}`);
  }

  /**
   * Trigger signing/issuing of a specific certificate
   */
  async signAcmeCertificate(uuid: string): Promise<any> {
    return this.post(`/acmeclient/service/signCert/${uuid}`);
  }

  /**
   * Revoke a certificate
   */
  async revokeAcmeCertificate(uuid: string): Promise<any> {
    return this.post(`/acmeclient/service/revokeCert/${uuid}`);
  }

  // ===== MONIT METHODS =====

  /**
   * Get all Monit settings (general, alerts, services, tests)
   */
  async getMonitSettings(): Promise<any> {
    return this.get('/monit/settings/get');
  }

  /**
   * Get Monit live status (running services and their states)
   */
  async getMonitStatus(): Promise<any> {
    return this.get('/monit/status/get');
  }

  /**
   * Get Monit service runtime status
   */
  async getMonitServiceStatus(): Promise<any> {
    return this.get('/monit/service/status');
  }

  /**
   * Get a specific Monit service by UUID
   */
  async getMonitService(uuid: string): Promise<any> {
    return this.get(`/monit/settings/getService/${uuid}`);
  }

  /**
   * Add a Monit service
   */
  async addMonitService(data: Record<string, unknown>): Promise<any> {
    return this.post('/monit/settings/addService', { service: data });
  }

  /**
   * Update a Monit service
   */
  async setMonitService(uuid: string, data: Record<string, unknown>): Promise<any> {
    return this.post(`/monit/settings/setService/${uuid}`, { service: data });
  }

  /**
   * Delete a Monit service
   */
  async delMonitService(uuid: string): Promise<any> {
    return this.post(`/monit/settings/delService/${uuid}`);
  }

  /**
   * Get a specific Monit test by UUID
   */
  async getMonitTest(uuid: string): Promise<any> {
    return this.get(`/monit/settings/getTest/${uuid}`);
  }

  /**
   * Add a Monit test
   */
  async addMonitTest(data: Record<string, unknown>): Promise<any> {
    return this.post('/monit/settings/addTest', { test: data });
  }

  /**
   * Update a Monit test
   */
  async setMonitTest(uuid: string, data: Record<string, unknown>): Promise<any> {
    return this.post(`/monit/settings/setTest/${uuid}`, { test: data });
  }

  /**
   * Delete a Monit test
   */
  async delMonitTest(uuid: string): Promise<any> {
    return this.post(`/monit/settings/delTest/${uuid}`);
  }

  /**
   * Get a specific Monit alert by UUID
   */
  async getMonitAlert(uuid: string): Promise<any> {
    return this.get(`/monit/settings/getAlert/${uuid}`);
  }

  /**
   * Add a Monit alert recipient
   */
  async addMonitAlert(data: Record<string, unknown>): Promise<any> {
    return this.post('/monit/settings/addAlert', { alert: data });
  }

  /**
   * Update a Monit alert recipient
   */
  async setMonitAlert(uuid: string, data: Record<string, unknown>): Promise<any> {
    return this.post(`/monit/settings/setAlert/${uuid}`, { alert: data });
  }

  /**
   * Delete a Monit alert recipient
   */
  async delMonitAlert(uuid: string): Promise<any> {
    return this.post(`/monit/settings/delAlert/${uuid}`);
  }

  /**
   * Apply Monit configuration changes (reconfigure)
   */
  async applyMonitChanges(): Promise<any> {
    return this.post('/monit/service/reconfigure');
  }

  // ===== ARP TABLE METHODS =====

  /**
   * Get ARP table entries
   */
  async getArpTable(): Promise<any> {
    return this.get('/diagnostics/interface/getArp');
  }

  /**
   * Get network interfaces
   */
  async getInterfaces(): Promise<any> {
    return this.get('/interfaces/overview/list');
  }

  /**
   * Search ARP table entries
   */
  async searchArpTable(params: any = {}): Promise<any> {
    const searchParams = {
      current: params.current || 1,
      rowCount: params.rowCount || 10000,
      sort: params.sort || {},
      searchPhrase: params.searchPhrase || ''
    };
    return this.post('/diagnostics/interface/searchArp', searchParams);
  }

  /**
   * Clear/flush ARP entry
   */
  async flushArpEntry(data: { address: string; interface?: string }): Promise<any> {
    return this.post('/diagnostics/interface/flushArp', data);
  }

  /**
   * Add static ARP entry
   */
  async setArpEntry(data: { address: string; mac: string; interface: string }): Promise<any> {
    return this.post('/diagnostics/interface/setArp', data);
  }

  // ===== COMMON UTILITY METHODS =====

  /**
   * Test connection
   */
  async testConnection(): Promise<{ success: boolean; version?: string; product?: string; error?: string }> {
    try {
      const result = await this.get<any>('/core/firmware/info');
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

  /**
   * Get service status
   */
  async getServiceStatus(serviceName: string): Promise<{ status: 'running' | 'stopped'; pid?: number }> {
    return this.post('/core/service/status', { name: serviceName });
  }

  /**
   * Control service (start/stop/restart)
   */
  async controlService(serviceName: string, action: 'start' | 'stop' | 'restart'): Promise<{ response: string }> {
    return this.post('/core/service/' + action, { name: serviceName });
  }
}

// Type definitions for common API patterns
export interface SearchParams {
  current?: number;
  rowCount?: number;
  sort?: Record<string, string>;
  searchPhrase?: string;
}

export interface SearchResult<T> {
  total: number;
  rowCount: number;
  current: number;
  rows: T[];
}

export interface AddItemResult {
  result: string;
  uuid?: string;
  validations?: Record<string, string>;
}

export interface SetItemResult {
  result: string;
  validations?: Record<string, string>;
}

export interface DeleteResult {
  result: string;
  message?: string;
}

export interface ApplyResult {
  status: string;
}

export interface ReconfigureResult {
  status: string;
}

export interface ToggleResult {
  result: string;
}

// Export for both TypeScript and JavaScript usage
export default OPNSenseAPIClient;