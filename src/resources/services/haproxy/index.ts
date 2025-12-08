import { z } from 'zod';
import { OPNSenseAPIClient, OPNSenseAPIError } from '../../../api/client.js';

// ==================== Custom Error Types ====================

/**
 * Base error class for HAProxy-specific errors
 */
export class HAProxyError extends Error {
  constructor(
    message: string,
    public code: HAProxyErrorCode,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'HAProxyError';
  }
}

/**
 * Error codes for HAProxy operations
 */
export enum HAProxyErrorCode {
  // Validation errors
  INVALID_SERVER_ADDRESS = 'INVALID_SERVER_ADDRESS',
  INVALID_PORT_RANGE = 'INVALID_PORT_RANGE',
  INVALID_ACL_EXPRESSION = 'INVALID_ACL_EXPRESSION',
  INVALID_ACTION_TYPE = 'INVALID_ACTION_TYPE',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Operation errors
  BACKEND_NOT_FOUND = 'BACKEND_NOT_FOUND',
  FRONTEND_NOT_FOUND = 'FRONTEND_NOT_FOUND',
  SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',
  ACL_NOT_FOUND = 'ACL_NOT_FOUND',
  ACTION_NOT_FOUND = 'ACTION_NOT_FOUND',

  // Service errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RECONFIGURE_FAILED = 'RECONFIGURE_FAILED',

  // API errors
  API_ERROR = 'API_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// ==================== ACL Expression Types ====================

/**
 * All supported HAProxy ACL expression types in OPNsense
 * These map directly to the OPNsense HAProxy plugin options
 */
export const ACL_EXPRESSION_TYPES = {
  // SNI-based expressions (for TCP/SSL passthrough)
  'ssl_sni': 'SSL SNI exact match',
  'ssl_sni_end': 'SSL SNI ends with (suffix match)',
  'ssl_sni_beg': 'SSL SNI begins with (prefix match)',
  'ssl_sni_sub': 'SSL SNI contains (substring match)',
  'ssl_sni_reg': 'SSL SNI regex match',

  // Host-based expressions (for HTTP)
  'hdr_host': 'Host header exact match',
  'hdr_host_end': 'Host header ends with',
  'hdr_host_beg': 'Host header begins with',
  'hdr_host_sub': 'Host header contains',
  'hdr_host_reg': 'Host header regex match',

  // Path-based expressions
  'path': 'Path exact match',
  'path_beg': 'Path begins with',
  'path_end': 'Path ends with',
  'path_sub': 'Path contains',
  'path_reg': 'Path regex match',
  'path_dir': 'Path directory match',

  // URL-based expressions
  'url': 'URL exact match',
  'url_beg': 'URL begins with',
  'url_end': 'URL ends with',
  'url_sub': 'URL contains',
  'url_reg': 'URL regex match',

  // Source IP expressions
  'src': 'Source IP address',
  'src_port': 'Source port',
  'src_is_local': 'Source is local',

  // Custom expressions
  'custom_acl': 'Custom ACL expression (pass-through)',

  // HTTP method
  'method': 'HTTP method',

  // SSL/TLS
  'ssl_fc': 'SSL frontend connection',
  'ssl_fc_sni': 'SSL frontend SNI',
  'ssl_c_used': 'SSL client certificate used',
  'ssl_c_verify': 'SSL client certificate verify result',

  // Other common expressions
  'nbsrv': 'Number of available servers in backend',
  'connslots': 'Connection slots available',
  'queue': 'Queue size'
} as const;

export type ACLExpressionType = keyof typeof ACL_EXPRESSION_TYPES;

// ==================== Action Types ====================

/**
 * All supported HAProxy action types in OPNsense
 */
export const ACTION_TYPES = {
  // Backend selection
  'use_backend': 'Route to specified backend',

  // HTTP actions
  'redirect': 'HTTP redirect',
  'add_header': 'Add HTTP header',
  'set_header': 'Set/replace HTTP header',
  'del_header': 'Delete HTTP header',
  'replace_header': 'Replace header value with regex',
  'replace_value': 'Replace header value',

  // TCP actions (for SNI routing)
  'tcp-request_content_accept': 'Accept TCP connection',
  'tcp-request_content_reject': 'Reject TCP connection',
  'tcp-request_content_use-server': 'Use specific server',
  'tcp-request_inspect-delay': 'Set TCP inspect delay (required for SNI)',

  // Connection actions
  'http-request_deny': 'Deny HTTP request',
  'http-request_tarpit': 'Tarpit HTTP request',
  'http-request_auth': 'Require HTTP authentication',
  'http-request_set-var': 'Set variable',

  // Logging/tracking
  'http-request_capture': 'Capture request data',
  'http-request_track-sc': 'Track stick counter',

  // Response actions
  'http-response_add-header': 'Add response header',
  'http-response_set-header': 'Set response header',
  'http-response_del-header': 'Delete response header'
} as const;

export type ActionType = keyof typeof ACTION_TYPES;

// ==================== Service Status ====================

export interface HAProxyServiceStatus {
  enabled: boolean;
  running: boolean;
  pid?: number;
  uptime?: string;
  version?: string;
}

// ==================== Backend Management Types ====================

export interface HAProxyBackend {
  uuid?: string;
  name: string;
  mode: 'http' | 'tcp';
  balance: 'roundrobin' | 'leastconn' | 'source' | 'uri' | 'hdr' | 'random' | 'first' | 'static-rr';
  servers: HAProxyServer[];
  description?: string;
  enabled?: boolean;
  healthCheck?: {
    type: string;
    interval?: number;
    timeout?: number;
  };
}

export interface HAProxyServer {
  uuid?: string;
  name: string;
  address: string;
  port: number;
  ssl?: boolean;
  sslVerify?: boolean;  // Changed from 'none' | 'required' to boolean for clarity
  sslSNI?: string;      // SNI hostname to send
  sslCA?: string;       // CA certificate UUID for verification
  weight?: number;
  backup?: boolean;
  enabled?: boolean;
  checkEnabled?: boolean;
  checkInterval?: number;
  maxConnections?: number;
}

// ==================== Frontend Management Types ====================

export interface HAProxyFrontend {
  uuid?: string;
  name: string;
  bind: string;
  bindOptions?: {
    ssl?: boolean;
    certificates?: string[];
    alpn?: string[];           // ALPN protocols
    sslMinVersion?: string;    // Minimum SSL/TLS version
    sslMaxVersion?: string;    // Maximum SSL/TLS version
  };
  mode: 'http' | 'tcp';
  backend: string;
  acls?: HAProxyACL[];
  actions?: HAProxyAction[];
  description?: string;
  enabled?: boolean;
  tcpInspectDelay?: number;   // TCP inspect delay in ms (required for SNI routing)
}

export interface HAProxyACL {
  uuid?: string;
  name: string;
  expression: ACLExpressionType;  // Now typed to valid expression types
  value: string;                   // The value to match against
  negate?: boolean;               // Negate the ACL condition
  enabled?: boolean;
}

export interface HAProxyAction {
  uuid?: string;
  type: ActionType;               // Now typed to all valid action types
  backend?: string;               // For use_backend
  condition?: string;             // ACL condition (e.g., "if acl_name")
  aclNames?: string[];            // ACL names to use in condition
  value?: string;                 // Action-specific value
  operator?: 'if' | 'unless';     // Condition operator
  enabled?: boolean;
}

// Certificate Management Types
export interface HAProxyCertificate {
  uuid?: string;
  name: string;
  type: 'selfsigned' | 'import' | 'acme';
  cn?: string;
  san?: string[];
  certificate?: string;
  key?: string;
  ca?: string;
}

// Stats Types
export interface HAProxyStats {
  frontends: {
    [name: string]: {
      status: string;
      sessions: number;
      bytesIn: number;
      bytesOut: number;
      requestRate: number;
      errorRate: number;
    };
  };
  backends: {
    [name: string]: {
      status: string;
      activeServers: number;
      backupServers: number;
      sessions: number;
      queuedRequests: number;
      health: {
        [serverName: string]: {
          status: 'up' | 'down' | 'maint';
          lastCheck: string;
          weight: number;
          checksPassed: number;
          checksFailed: number;
        };
      };
    };
  };
}

// ==================== Validation Helpers ====================

/**
 * Validate server address (IPv4, IPv6, or hostname)
 */
function validateServerAddress(address: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  // Hostname pattern (RFC 1123)
  const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (ipv4Pattern.test(address)) {
    // Validate each octet is 0-255
    const octets = address.split('.').map(Number);
    return octets.every(o => o >= 0 && o <= 255);
  }

  return ipv6Pattern.test(address) || hostnamePattern.test(address);
}

/**
 * Validate port number
 */
function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate ACL expression type
 */
function validateACLExpression(expression: string): expression is ACLExpressionType {
  return expression in ACL_EXPRESSION_TYPES;
}

/**
 * Validate action type
 */
function validateActionType(type: string): type is ActionType {
  return type in ACTION_TYPES;
}

/**
 * HAProxy Resource Manager for OPNsense
 */
export class HAProxyResource {
  constructor(private client: OPNSenseAPIClient) {}

  // ==================== Service Control Methods ====================

  async getServiceStatus(): Promise<HAProxyServiceStatus> {
    try {
      const response = await this.client.get('/haproxy/service/status');
      return {
        enabled: response.status === 'enabled',
        running: response.running === true,
        pid: response.pid,
        uptime: response.uptime,
        version: response.version
      };
    } catch (error) {
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to get HAProxy service status: ${error.message}`,
          HAProxyErrorCode.SERVICE_UNAVAILABLE,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to get HAProxy service status: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  async controlService(action: 'start' | 'stop' | 'restart' | 'reload'): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/service/${action}`);
      return response.result === 'ok';
    } catch (error) {
      throw new Error(`Failed to ${action} HAProxy service: ${error}`);
    }
  }

  async reconfigure(): Promise<boolean> {
    try {
      const response = await this.client.post('/haproxy/service/reconfigure');
      return response.result === 'ok';
    } catch (error) {
      throw new Error(`Failed to reconfigure HAProxy: ${error}`);
    }
  }

  // Backend Management Methods
  async listBackends(): Promise<HAProxyBackend[]> {
    try {
      const response = await this.client.get('/haproxy/settings/searchBackends');
      if (!response.rows || !Array.isArray(response.rows)) {
        return [];
      }
      return response.rows.map((row: any) => this.parseBackend(row));
    } catch (error) {
      throw new Error(`Failed to list HAProxy backends: ${error}`);
    }
  }

  async getBackend(uuid: string): Promise<HAProxyBackend | null> {
    try {
      const response = await this.client.get(`/haproxy/settings/getBackend/${uuid}`);
      if (!response.backend) {
        return null;
      }
      return this.parseBackend(response.backend);
    } catch (error) {
      throw new Error(`Failed to get HAProxy backend: ${error}`);
    }
  }

  async createBackend(backend: Omit<HAProxyBackend, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = this.buildBackendPayload(backend);
      const response = await this.client.post('/haproxy/settings/addBackend', payload);
      
      if (!response.uuid) {
        throw new Error('No UUID returned from create backend');
      }

      // Add servers if provided
      if (backend.servers && backend.servers.length > 0) {
        for (const server of backend.servers) {
          await this.addServerToBackend(response.uuid, server);
        }
      }

      // Apply configuration
      await this.reconfigure();

      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to create HAProxy backend: ${error}`);
    }
  }

  async updateBackend(uuid: string, updates: Partial<HAProxyBackend>): Promise<boolean> {
    try {
      const payload = this.buildBackendPayload(updates as HAProxyBackend);
      const response = await this.client.post(`/haproxy/settings/setBackend/${uuid}`, payload);
      
      if (response.result !== 'saved') {
        throw new Error('Failed to save backend updates');
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy backend: ${error}`);
    }
  }

  async deleteBackend(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delBackend/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete backend');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy backend: ${error}`);
    }
  }

  // ==================== Server Management Methods ====================

  /**
   * Add a server to a backend with full validation
   */
  async addServerToBackend(backendUuid: string, server: Omit<HAProxyServer, 'uuid'>): Promise<{ uuid: string }> {
    // Validate required fields
    if (!server.name || server.name.trim() === '') {
      throw new HAProxyError(
        'Server name is required',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'name' }
      );
    }

    if (!server.address || server.address.trim() === '') {
      throw new HAProxyError(
        'Server address is required',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'address' }
      );
    }

    // Validate server address format
    if (!validateServerAddress(server.address)) {
      throw new HAProxyError(
        `Invalid server address: ${server.address}. Must be a valid IPv4, IPv6, or hostname.`,
        HAProxyErrorCode.INVALID_SERVER_ADDRESS,
        { address: server.address }
      );
    }

    // Validate port range
    if (!validatePort(server.port)) {
      throw new HAProxyError(
        `Invalid port number: ${server.port}. Must be between 1 and 65535.`,
        HAProxyErrorCode.INVALID_PORT_RANGE,
        { port: server.port }
      );
    }

    try {
      const payload = this.buildServerPayload(server);
      payload.server.backend = backendUuid;

      const response = await this.client.post('/haproxy/settings/addServer', payload);
      if (!response.uuid) {
        throw new HAProxyError(
          'No UUID returned from add server',
          HAProxyErrorCode.API_ERROR,
          { response }
        );
      }

      return { uuid: response.uuid };
    } catch (error) {
      if (error instanceof HAProxyError) {
        throw error;
      }
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to add server to backend: ${error.message}`,
          HAProxyErrorCode.API_ERROR,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to add server to backend: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  async updateServer(uuid: string, updates: Partial<HAProxyServer>): Promise<boolean> {
    try {
      const payload = this.buildServerPayload(updates as HAProxyServer);
      const response = await this.client.post(`/haproxy/settings/setServer/${uuid}`, payload);
      
      if (response.result !== 'saved') {
        throw new Error('Failed to save server updates');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy server: ${error}`);
    }
  }

  async deleteServer(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delServer/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete server');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy server: ${error}`);
    }
  }

  // Frontend Management Methods
  async listFrontends(): Promise<HAProxyFrontend[]> {
    try {
      const response = await this.client.get('/haproxy/settings/searchFrontends');
      if (!response.rows || !Array.isArray(response.rows)) {
        return [];
      }
      return response.rows.map((row: any) => this.parseFrontend(row));
    } catch (error) {
      throw new Error(`Failed to list HAProxy frontends: ${error}`);
    }
  }

  async getFrontend(uuid: string): Promise<HAProxyFrontend | null> {
    try {
      const response = await this.client.get(`/haproxy/settings/getFrontend/${uuid}`);
      if (!response.frontend) {
        return null;
      }
      return this.parseFrontend(response.frontend);
    } catch (error) {
      throw new Error(`Failed to get HAProxy frontend: ${error}`);
    }
  }

  async createFrontend(frontend: Omit<HAProxyFrontend, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = this.buildFrontendPayload(frontend);
      const response = await this.client.post('/haproxy/settings/addFrontend', payload);
      
      if (!response.uuid) {
        throw new Error('No UUID returned from create frontend');
      }

      // Add ACLs if provided
      if (frontend.acls && frontend.acls.length > 0) {
        for (const acl of frontend.acls) {
          await this.addACLToFrontend(response.uuid, acl);
        }
      }

      // Add actions if provided
      if (frontend.actions && frontend.actions.length > 0) {
        for (const action of frontend.actions) {
          await this.addActionToFrontend(response.uuid, action);
        }
      }

      await this.reconfigure();
      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to create HAProxy frontend: ${error}`);
    }
  }

  async updateFrontend(uuid: string, updates: Partial<HAProxyFrontend>): Promise<boolean> {
    try {
      const payload = this.buildFrontendPayload(updates as HAProxyFrontend);
      const response = await this.client.post(`/haproxy/settings/setFrontend/${uuid}`, payload);
      
      if (response.result !== 'saved') {
        throw new Error('Failed to save frontend updates');
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy frontend: ${error}`);
    }
  }

  async deleteFrontend(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delFrontend/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete frontend');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy frontend: ${error}`);
    }
  }

  // ==================== ACL Management Methods ====================

  /**
   * Add an ACL to a frontend with validation
   * Supports all OPNsense HAProxy ACL expression types including SNI matching
   */
  async addACLToFrontend(frontendUuid: string, acl: Omit<HAProxyACL, 'uuid'>): Promise<{ uuid: string }> {
    // Validate required fields
    if (!acl.name || acl.name.trim() === '') {
      throw new HAProxyError(
        'ACL name is required',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'name' }
      );
    }

    if (!acl.expression) {
      throw new HAProxyError(
        'ACL expression type is required',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'expression' }
      );
    }

    // Validate expression type
    if (!validateACLExpression(acl.expression)) {
      throw new HAProxyError(
        `Invalid ACL expression type: ${acl.expression}. Valid types are: ${Object.keys(ACL_EXPRESSION_TYPES).join(', ')}`,
        HAProxyErrorCode.INVALID_ACL_EXPRESSION,
        { expression: acl.expression, validTypes: Object.keys(ACL_EXPRESSION_TYPES) }
      );
    }

    if (!acl.value || acl.value.trim() === '') {
      throw new HAProxyError(
        'ACL value is required',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'value' }
      );
    }

    try {
      const payload = this.buildACLPayload(acl, frontendUuid);

      const response = await this.client.post('/haproxy/settings/addAcl', payload);
      if (!response.uuid) {
        throw new HAProxyError(
          'No UUID returned from add ACL',
          HAProxyErrorCode.API_ERROR,
          { response }
        );
      }

      return { uuid: response.uuid };
    } catch (error) {
      if (error instanceof HAProxyError) {
        throw error;
      }
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to add ACL to frontend: ${error.message}`,
          HAProxyErrorCode.API_ERROR,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to add ACL to frontend: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  async updateACL(uuid: string, updates: Partial<HAProxyACL>): Promise<boolean> {
    // Validate expression type if provided
    if (updates.expression && !validateACLExpression(updates.expression)) {
      throw new HAProxyError(
        `Invalid ACL expression type: ${updates.expression}. Valid types are: ${Object.keys(ACL_EXPRESSION_TYPES).join(', ')}`,
        HAProxyErrorCode.INVALID_ACL_EXPRESSION,
        { expression: updates.expression, validTypes: Object.keys(ACL_EXPRESSION_TYPES) }
      );
    }

    try {
      const payload = {
        acl: {
          ...(updates.name && { name: updates.name }),
          ...(updates.expression && { expression: updates.expression }),
          ...(updates.value && { value: updates.value }),
          ...(updates.negate !== undefined && { negate: updates.negate ? '1' : '0' }),
          enabled: updates.enabled !== false ? '1' : '0'
        }
      };

      const response = await this.client.post(`/haproxy/settings/setAcl/${uuid}`, payload);
      if (response.result !== 'saved') {
        throw new HAProxyError(
          'Failed to save ACL updates',
          HAProxyErrorCode.API_ERROR,
          { response }
        );
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      if (error instanceof HAProxyError) {
        throw error;
      }
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to update HAProxy ACL: ${error.message}`,
          HAProxyErrorCode.API_ERROR,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to update HAProxy ACL: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  async deleteACL(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delAcl/${uuid}`);
      if (response.result !== 'deleted') {
        throw new HAProxyError(
          'Failed to delete ACL',
          HAProxyErrorCode.API_ERROR,
          { response }
        );
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      if (error instanceof HAProxyError) {
        throw error;
      }
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to delete HAProxy ACL: ${error.message}`,
          HAProxyErrorCode.API_ERROR,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to delete HAProxy ACL: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  // ==================== Action Management Methods ====================

  /**
   * Add an action to a frontend with validation
   * Supports all OPNsense HAProxy action types including tcp-request for SNI routing
   */
  async addActionToFrontend(frontendUuid: string, action: Omit<HAProxyAction, 'uuid'>): Promise<{ uuid: string }> {
    // Validate required fields
    if (!action.type) {
      throw new HAProxyError(
        'Action type is required',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'type' }
      );
    }

    // Validate action type
    if (!validateActionType(action.type)) {
      throw new HAProxyError(
        `Invalid action type: ${action.type}. Valid types are: ${Object.keys(ACTION_TYPES).join(', ')}`,
        HAProxyErrorCode.INVALID_ACTION_TYPE,
        { type: action.type, validTypes: Object.keys(ACTION_TYPES) }
      );
    }

    // Validate backend is provided for use_backend action
    if (action.type === 'use_backend' && !action.backend) {
      throw new HAProxyError(
        'Backend is required for use_backend action',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'backend', actionType: action.type }
      );
    }

    // Validate value is provided for tcp-request_inspect-delay
    if (action.type === 'tcp-request_inspect-delay' && !action.value) {
      throw new HAProxyError(
        'Value (delay in ms) is required for tcp-request_inspect-delay action',
        HAProxyErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'value', actionType: action.type }
      );
    }

    try {
      const payload = this.buildActionPayload(action, frontendUuid);

      const response = await this.client.post('/haproxy/settings/addAction', payload);
      if (!response.uuid) {
        throw new HAProxyError(
          'No UUID returned from add action',
          HAProxyErrorCode.API_ERROR,
          { response }
        );
      }

      return { uuid: response.uuid };
    } catch (error) {
      if (error instanceof HAProxyError) {
        throw error;
      }
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to add action to frontend: ${error.message}`,
          HAProxyErrorCode.API_ERROR,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to add action to frontend: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  async updateAction(uuid: string, updates: Partial<HAProxyAction>): Promise<boolean> {
    // Validate action type if provided
    if (updates.type && !validateActionType(updates.type)) {
      throw new HAProxyError(
        `Invalid action type: ${updates.type}. Valid types are: ${Object.keys(ACTION_TYPES).join(', ')}`,
        HAProxyErrorCode.INVALID_ACTION_TYPE,
        { type: updates.type, validTypes: Object.keys(ACTION_TYPES) }
      );
    }

    try {
      const payload = {
        action: {
          ...(updates.type && { type: updates.type }),
          ...(updates.backend && { backend: updates.backend }),
          ...(updates.condition && { condition: updates.condition }),
          ...(updates.value && { value: updates.value }),
          ...(updates.operator && { operator: updates.operator }),
          ...(updates.aclNames && { linkedAcls: updates.aclNames.join(',') }),
          enabled: updates.enabled !== false ? '1' : '0'
        }
      };

      const response = await this.client.post(`/haproxy/settings/setAction/${uuid}`, payload);
      if (response.result !== 'saved') {
        throw new HAProxyError(
          'Failed to save action updates',
          HAProxyErrorCode.API_ERROR,
          { response }
        );
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      if (error instanceof HAProxyError) {
        throw error;
      }
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to update HAProxy action: ${error.message}`,
          HAProxyErrorCode.API_ERROR,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to update HAProxy action: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  async deleteAction(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delAction/${uuid}`);
      if (response.result !== 'deleted') {
        throw new HAProxyError(
          'Failed to delete action',
          HAProxyErrorCode.API_ERROR,
          { response }
        );
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      if (error instanceof HAProxyError) {
        throw error;
      }
      if (error instanceof OPNSenseAPIError) {
        throw new HAProxyError(
          `Failed to delete HAProxy action: ${error.message}`,
          HAProxyErrorCode.API_ERROR,
          { statusCode: error.statusCode, apiResponse: error.apiResponse }
        );
      }
      throw new HAProxyError(
        `Failed to delete HAProxy action: ${error}`,
        HAProxyErrorCode.UNKNOWN_ERROR
      );
    }
  }

  // Certificate Management Methods
  async listCertificates(): Promise<HAProxyCertificate[]> {
    try {
      const response = await this.client.get('/system/certificates/searchCertificate');
      if (!response.rows || !Array.isArray(response.rows)) {
        return [];
      }
      return response.rows.map((row: any) => ({
        uuid: row.uuid,
        name: row.descr,
        type: row.method,
        cn: row.dn?.CN,
        san: row.altnames ? row.altnames.split(',') : []
      }));
    } catch (error) {
      throw new Error(`Failed to list certificates: ${error}`);
    }
  }

  async createCertificate(cert: Omit<HAProxyCertificate, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = {
        cert: {
          descr: cert.name,
          method: cert.type
        }
      };

      if (cert.type === 'selfsigned') {
        Object.assign(payload.cert, {
          keylen: '2048',
          digest_alg: 'sha256',
          lifetime: '825',
          dn_commonname: cert.cn || cert.name,
          dn_country: 'US',
          dn_state: 'State',
          dn_city: 'City',
          dn_organization: 'Organization'
        });

        if (cert.san && cert.san.length > 0) {
          (payload.cert as any).altnames = cert.san.join(',');
        }
      } else if (cert.type === 'import') {
        Object.assign(payload.cert, {
          crt: cert.certificate,
          prv: cert.key,
          ca: cert.ca
        });
      }

      const response = await this.client.post('/system/certificates/addCertificate', payload);
      if (!response.uuid) {
        throw new Error('No UUID returned from create certificate');
      }
      
      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to create certificate: ${error}`);
    }
  }

  // Stats Methods
  async getStats(): Promise<HAProxyStats> {
    try {
      const response = await this.client.get('/haproxy/stats/show');
      return this.parseStats(response);
    } catch (error) {
      throw new Error(`Failed to get HAProxy stats: ${error}`);
    }
  }

  async getBackendHealth(backendName: string): Promise<any> {
    try {
      const stats = await this.getStats();
      return stats.backends[backendName]?.health || {};
    } catch (error) {
      throw new Error(`Failed to get backend health: ${error}`);
    }
  }

  // Helper Methods
  private parseBackend(data: any): HAProxyBackend {
    return {
      uuid: data.uuid,
      name: data.name,
      mode: data.mode || 'http',
      balance: data.algorithm || 'roundrobin',
      description: data.description,
      enabled: data.enabled === '1',
      servers: [],
      healthCheck: data.healthCheckEnabled === '1' ? {
        type: data.healthCheck,
        interval: parseInt(data.healthCheckInterval) || undefined,
        timeout: parseInt(data.healthCheckTimeout) || undefined
      } : undefined
    };
  }

  private parseFrontend(data: any): HAProxyFrontend {
    return {
      uuid: data.uuid,
      name: data.name,
      bind: data.bind || '',
      mode: data.mode || 'http',
      backend: data.defaultBackend || '',
      description: data.description,
      enabled: data.enabled === '1',
      acls: [],
      actions: [],
      bindOptions: {
        ssl: data.ssl === '1',
        certificates: data.certificates ? data.certificates.split(',') : []
      }
    };
  }

  private buildBackendPayload(backend: HAProxyBackend): any {
    return {
      backend: {
        name: backend.name,
        mode: backend.mode,
        algorithm: backend.balance,
        description: backend.description || '',
        enabled: backend.enabled !== false ? '1' : '0',
        healthCheckEnabled: backend.healthCheck ? '1' : '0',
        healthCheck: backend.healthCheck?.type || '',
        healthCheckInterval: backend.healthCheck?.interval?.toString() || '',
        healthCheckTimeout: backend.healthCheck?.timeout?.toString() || ''
      }
    };
  }

  /**
   * Build server payload with proper sslVerify handling
   * FIX: sslVerify now properly converts boolean to '1'/'0' format
   */
  private buildServerPayload(server: HAProxyServer): any {
    const payload: any = {
      server: {
        name: server.name,
        address: server.address,
        port: server.port.toString(),
        ssl: server.ssl ? '1' : '0',
        // FIX: Convert boolean sslVerify to OPNsense's expected '1'/'0' format
        sslVerify: server.sslVerify ? '1' : '0',
        weight: (server.weight || 1).toString(),
        backup: server.backup ? '1' : '0',
        enabled: server.enabled !== false ? '1' : '0'
      }
    };

    // Add optional SSL-related fields
    if (server.sslSNI) {
      payload.server.sni = server.sslSNI;
    }
    if (server.sslCA) {
      payload.server.sslCA = server.sslCA;
    }

    // Add optional server settings
    if (server.checkEnabled !== undefined) {
      payload.server.checkEnabled = server.checkEnabled ? '1' : '0';
    }
    if (server.checkInterval) {
      payload.server.checkInterval = server.checkInterval.toString();
    }
    if (server.maxConnections) {
      payload.server.maxconn = server.maxConnections.toString();
    }

    return payload;
  }

  private buildFrontendPayload(frontend: HAProxyFrontend): any {
    const payload: any = {
      frontend: {
        name: frontend.name,
        bind: frontend.bind,
        mode: frontend.mode,
        defaultBackend: frontend.backend,
        description: frontend.description || '',
        enabled: frontend.enabled !== false ? '1' : '0'
      }
    };

    if (frontend.bindOptions?.ssl) {
      payload.frontend.ssl = '1';
      if (frontend.bindOptions.certificates && frontend.bindOptions.certificates.length > 0) {
        payload.frontend.certificates = frontend.bindOptions.certificates.join(',');
      }
      if (frontend.bindOptions.alpn && frontend.bindOptions.alpn.length > 0) {
        payload.frontend.alpn = frontend.bindOptions.alpn.join(',');
      }
      if (frontend.bindOptions.sslMinVersion) {
        payload.frontend.sslMinVersion = frontend.bindOptions.sslMinVersion;
      }
      if (frontend.bindOptions.sslMaxVersion) {
        payload.frontend.sslMaxVersion = frontend.bindOptions.sslMaxVersion;
      }
    }

    // Add TCP inspect delay for SNI routing
    if (frontend.tcpInspectDelay) {
      payload.frontend.tcpInspectDelay = frontend.tcpInspectDelay.toString();
    }

    return payload;
  }

  /**
   * Build ACL payload for OPNsense HAProxy API
   * Supports all expression types including SNI matching
   */
  private buildACLPayload(acl: Omit<HAProxyACL, 'uuid'>, frontendUuid: string): any {
    return {
      acl: {
        name: acl.name,
        expression: acl.expression,
        value: acl.value,
        negate: acl.negate ? '1' : '0',
        frontend: frontendUuid,
        enabled: acl.enabled !== false ? '1' : '0'
      }
    };
  }

  /**
   * Build action payload for OPNsense HAProxy API
   * Supports all action types including tcp-request for SNI routing
   */
  private buildActionPayload(action: Omit<HAProxyAction, 'uuid'>, frontendUuid: string): any {
    const payload: any = {
      action: {
        type: action.type,
        frontend: frontendUuid,
        enabled: action.enabled !== false ? '1' : '0'
      }
    };

    // Add type-specific fields
    if (action.backend) {
      payload.action.backend = action.backend;
    }
    if (action.condition) {
      payload.action.condition = action.condition;
    }
    if (action.value) {
      payload.action.value = action.value;
    }
    if (action.operator) {
      payload.action.operator = action.operator;
    }
    if (action.aclNames && action.aclNames.length > 0) {
      payload.action.linkedAcls = action.aclNames.join(',');
    }

    return payload;
  }

  private parseStats(data: any): HAProxyStats {
    const stats: HAProxyStats = {
      frontends: {},
      backends: {}
    };

    // Parse the stats data from HAProxy
    // This would need to be implemented based on the actual response format
    // For now, returning a basic structure
    if (data.stats) {
      // Parse frontend stats
      if (data.stats.frontends) {
        for (const [name, frontendData] of Object.entries(data.stats.frontends)) {
          stats.frontends[name] = {
            status: (frontendData as any).status || 'unknown',
            sessions: (frontendData as any).scur || 0,
            bytesIn: (frontendData as any).bin || 0,
            bytesOut: (frontendData as any).bout || 0,
            requestRate: (frontendData as any).req_rate || 0,
            errorRate: (frontendData as any).ereq || 0
          };
        }
      }

      // Parse backend stats
      if (data.stats.backends) {
        for (const [name, backendData] of Object.entries(data.stats.backends)) {
          const backend = backendData as any;
          stats.backends[name] = {
            status: backend.status || 'unknown',
            activeServers: backend.act || 0,
            backupServers: backend.bck || 0,
            sessions: backend.scur || 0,
            queuedRequests: backend.qcur || 0,
            health: {}
          };

          // Parse server health
          if (backend.servers) {
            for (const [serverName, serverData] of Object.entries(backend.servers)) {
              const server = serverData as any;
              stats.backends[name].health[serverName] = {
                status: server.status === 'UP' ? 'up' : server.status === 'DOWN' ? 'down' : 'maint',
                lastCheck: server.check_status || '',
                weight: server.weight || 0,
                checksPassed: server.chkpass || 0,
                checksFailed: server.chkfail || 0
              };
            }
          }
        }
      }
    }

    return stats;
  }
}