// Updated API client that properly handles error responses
import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';

/**
 * OPNsense API Client with fixed error handling
 */
export class OPNSenseAPIClient {
  private axios: AxiosInstance;
  private debugMode: boolean;
  
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for debugging
    this.axios.interceptors.request.use(
      (config) => {
        if (this.debugMode) {
          console.error('[API Request]', {
            method: config.method?.toUpperCase(),
            url: config.url,
            data: config.data
          });
        }
        return config;
      },
      (error) => {
        if (this.debugMode) {
          console.error('[API Request Error]', error);
        }
        return Promise.reject(error);
      }
    );

    // Add response interceptor for debugging and error handling
    this.axios.interceptors.response.use(
      (response) => {
        if (this.debugMode) {
          console.error('[API Response]', {
            status: response.status,
            statusText: response.statusText,
            data: response.data
          });
        }

        // Check if response status indicates an error
        if (response.status >= 400) {
          const error = new OPNSenseAPIError(
            this.extractErrorMessage(response.data) || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response.data
          );
          throw error;
        }

        // Handle API errors returned with 200 status
        if (response.data && response.data.result === 'failed') {
          const error = new OPNSenseAPIError(
            response.data.validations || 'API operation failed',
            response.status,
            response.data
          );
          throw error;
        }

        return response;
      },
      (error: AxiosError) => {
        if (this.debugMode) {
          console.error('[API Response Error]', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          });
        }

        // Enhanced error handling
        if (error.response) {
          const apiError = new OPNSenseAPIError(
            this.extractErrorMessage(error.response.data) || error.message,
            error.response.status,
            error.response.data
          );
          throw apiError;
        } else if (error.request) {
          throw new OPNSenseAPIError(
            'No response received from OPNsense API',
            0
          );
        } else {
          throw new OPNSenseAPIError(
            error.message,
            0
          );
        }
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
   * GET request following OPNsense API patterns
   */
  async get<T = any>(path: string): Promise<T> {
    const response = await this.axios.get<T>(path);
    return response.data;
  }

  /**
   * POST request following OPNsense API patterns
   */
  async post<T = any>(path: string, data?: any): Promise<T> {
    const response = await this.axios.post<T>(path, data || {});
    return response.data;
  }

  /**
   * Search for items (common OPNsense pattern)
   */
  async search<T = any>(module: string, controller: string, params?: SearchParams): Promise<SearchResult<T>> {
    const searchParams = {
      current: params?.current || 1,
      rowCount: params?.rowCount || 100,
      sort: params?.sort || {},
      searchPhrase: params?.searchPhrase || ''
    };

    return this.post<SearchResult<T>>(
      `/${module}/${controller}/search`,
      searchParams
    );
  }

  /**
   * Get a single item by UUID
   */
  async getItem<T = any>(module: string, controller: string, uuid: string): Promise<T> {
    return this.get<T>(`/${module}/${controller}/getItem/${uuid}`);
  }

  /**
   * Add a new item
   */
  async addItem<T = any>(module: string, controller: string, data: any): Promise<AddItemResult> {
    return this.post<AddItemResult>(`/${module}/${controller}/addItem`, data);
  }

  /**
   * Update an existing item
   */
  async setItem<T = any>(module: string, controller: string, uuid: string, data: any): Promise<SetItemResult> {
    return this.post<SetItemResult>(`/${module}/${controller}/setItem/${uuid}`, data);
  }

  /**
   * Delete an item
   */
  async delItem(module: string, controller: string, uuid: string): Promise<DeleteResult> {
    return this.post<DeleteResult>(`/${module}/${controller}/delItem/${uuid}`);
  }

  /**
   * Apply changes (common pattern after modifications)
   */
  async applyChanges(module: string, controller: string): Promise<ApplyResult> {
    return this.post<ApplyResult>(`/${module}/${controller}/apply`);
  }

  /**
   * Reconfigure service (alternative to apply for some services)
   */
  async reconfigure(module: string, controller: string): Promise<ReconfigureResult> {
    return this.post<ReconfigureResult>(`/${module}/${controller}/reconfigure`);
  }

  /**
   * Toggle item enabled/disabled
   */
  async toggleItem(module: string, controller: string, uuid: string, enabled?: boolean): Promise<ToggleResult> {
    const action = 'toggleItem';
    return this.post<ToggleResult>(`/${module}/${controller}/${action}/${uuid}/${enabled ? '1' : '0'}`);
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatus> {
    return this.post<ServiceStatus>('/core/service/status', { name: serviceName });
  }

  /**
   * Control service (start/stop/restart)
   */
  async controlService(serviceName: string, action: 'start' | 'stop' | 'restart'): Promise<ServiceControlResult> {
    return this.post<ServiceControlResult>('/core/service/' + action, { name: serviceName });
  }
}

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

export interface ServiceStatus {
  status: 'running' | 'stopped';
  pid?: number;
}

export interface ServiceControlResult {
  response: string;
}

// Common API endpoint patterns for different resource types
export const API_ENDPOINTS = {
  firewall: {
    alias: {
      search: '/firewall/alias/search',
      add: '/firewall/alias/addItem',
      set: (uuid: string) => `/firewall/alias/setItem/${uuid}`,
      get: (uuid: string) => `/firewall/alias/getItem/${uuid}`,
      del: (uuid: string) => `/firewall/alias/delItem/${uuid}`,
      toggle: (uuid: string, enabled: boolean) => `/firewall/alias/toggleItem/${uuid}/${enabled ? '1' : '0'}`,
      apply: '/firewall/alias/reconfigure'
    },
    filter: {
      search: '/firewall/filter/search',
      add: '/firewall/filter/addRule',
      set: (uuid: string) => `/firewall/filter/setRule/${uuid}`,
      get: (uuid: string) => `/firewall/filter/getRule/${uuid}`,
      del: (uuid: string) => `/firewall/filter/delRule/${uuid}`,
      toggle: (uuid: string, enabled: boolean) => `/firewall/filter/toggleRule/${uuid}/${enabled ? '1' : '0'}`,
      apply: '/firewall/filter/apply'
    }
  },
  interfaces: {
    vlan: {
      search: '/interfaces/vlan_settings/search',
      add: '/interfaces/vlan_settings/addItem',
      set: (uuid: string) => `/interfaces/vlan_settings/setItem/${uuid}`,
      get: (uuid: string) => `/interfaces/vlan_settings/getItem/${uuid}`,
      del: (uuid: string) => `/interfaces/vlan_settings/delItem/${uuid}`,
      apply: '/interfaces/vlan_settings/reconfigure'
    }
  },
  dhcpv4: {
    search: '/dhcpv4/leases/search',
    staticmap: {
      add: (iface: string) => `/dhcpv4/${iface}/staticmap/add`,
      set: (iface: string, uuid: string) => `/dhcpv4/${iface}/staticmap/set/${uuid}`,
      del: (iface: string, uuid: string) => `/dhcpv4/${iface}/staticmap/del/${uuid}`
    }
  },
  unbound: {
    override: {
      search: '/unbound/settings/searchHostOverride',
      add: '/unbound/settings/addHostOverride',
      set: (uuid: string) => `/unbound/settings/setHostOverride/${uuid}`,
      del: (uuid: string) => `/unbound/settings/delHostOverride/${uuid}`,
      apply: '/unbound/service/reconfigure'
    }
  },
  haproxy: {
    server: {
      search: '/haproxy/settings/searchServers',
      add: '/haproxy/settings/addServer',
      set: (uuid: string) => `/haproxy/settings/setServer/${uuid}`,
      del: (uuid: string) => `/haproxy/settings/delServer/${uuid}`
    },
    backend: {
      search: '/haproxy/settings/searchBackends',
      add: '/haproxy/settings/addBackend',
      set: (uuid: string) => `/haproxy/settings/setBackend/${uuid}`,
      del: (uuid: string) => `/haproxy/settings/delBackend/${uuid}`
    },
    frontend: {
      search: '/haproxy/settings/searchFrontends',
      add: '/haproxy/settings/addFrontend',
      set: (uuid: string) => `/haproxy/settings/setFrontend/${uuid}`,
      del: (uuid: string) => `/haproxy/settings/delFrontend/${uuid}`
    },
    apply: '/haproxy/service/reconfigure'
  }
};
