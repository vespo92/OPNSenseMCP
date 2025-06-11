import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState } from '../../base.js';

/**
 * HAProxy backend modes
 */
export type BackendMode = 'http' | 'tcp';

/**
 * Load balancing algorithms
 */
export type BalanceAlgorithm = 
  | 'roundrobin'
  | 'static-rr'
  | 'leastconn'
  | 'first'
  | 'source'
  | 'uri'
  | 'url_param'
  | 'hdr'
  | 'random'
  | 'rdp-cookie';

/**
 * Health check types
 */
export type HealthCheckType = 
  | 'none'
  | 'basic'
  | 'http'
  | 'https'
  | 'tcp'
  | 'mysql'
  | 'pgsql'
  | 'redis'
  | 'smtp'
  | 'esmtp'
  | 'ssl';

/**
 * HAProxy backend properties
 */
export interface HaproxyBackendProperties extends ResourceProperties {
  mode: BackendMode;
  balance: BalanceAlgorithm;
  description?: string;
  enabled?: boolean;
  
  // Connection settings
  connectionTimeout?: number;
  serverTimeout?: number;
  retries?: number;
  
  // Health check configuration
  healthCheck?: {
    type: HealthCheckType;
    interval?: number;
    timeout?: number;
    rise?: number;
    fall?: number;
    httpVersion?: string;
    httpMethod?: string;
    uri?: string;
    httpStatusCode?: string;
    checkBody?: boolean;
    checkBodyString?: string;
  };
  
  // HTTP options (only for http mode)
  httpOptions?: {
    forwardFor?: boolean;
    httpClose?: boolean;
    httpServerClose?: boolean;
    httpPretendKeepalive?: boolean;
  };
  
  // Advanced options
  advancedOptions?: {
    customOptions?: string[];
    redispatch?: boolean;
    transparent?: boolean;
    persistentConnections?: boolean;
    httpReuseMode?: 'never' | 'safe' | 'aggressive' | 'always';
  };
  
  // Stick table configuration
  stickTable?: {
    enabled: boolean;
    type: 'sourceip' | 'cookie' | 'rdp-cookie' | 'url_param';
    cookieName?: string;
    cookieMode?: 'insert' | 'prefix' | 'rewrite';
    tableSize?: string;
    expire?: string;
  };
}

/**
 * OPNSense HAProxy Backend Resource
 */
export class HaproxyBackend extends Resource {
  constructor(
    name: string,
    properties: HaproxyBackendProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:service:haproxy:backend', name, properties, dependencies);
  }

  /**
   * Validate backend configuration
   */
  validate(): ValidationResult {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'mode',
      'balance'
    ]);
    errors.push(...requiredErrors);

    // Validate mode
    if (this.properties.mode) {
      const modeError = ValidationHelper.validateEnum(
        this.properties.mode,
        'mode',
        ['http', 'tcp']
      );
      if (modeError) errors.push(modeError);
    }

    // Validate balance algorithm
    if (this.properties.balance) {
      const validAlgorithms: BalanceAlgorithm[] = [
        'roundrobin', 'static-rr', 'leastconn', 'first',
        'source', 'uri', 'url_param', 'hdr', 'random', 'rdp-cookie'
      ];
      const balanceError = ValidationHelper.validateEnum(
        this.properties.balance,
        'balance',
        validAlgorithms
      );
      if (balanceError) errors.push(balanceError);
    }

    // Validate HTTP-specific algorithms in TCP mode
    if (this.properties.mode === 'tcp') {
      const httpOnlyAlgorithms = ['uri', 'url_param', 'hdr'];
      if (httpOnlyAlgorithms.includes(this.properties.balance)) {
        errors.push({
          property: 'balance',
          message: `Balance algorithm '${this.properties.balance}' is only valid for HTTP mode`,
          code: 'INVALID_ALGORITHM_FOR_MODE'
        });
      }
    }

    // Validate timeouts
    if (this.properties.connectionTimeout !== undefined) {
      if (this.properties.connectionTimeout < 1 || this.properties.connectionTimeout > 3600000) {
        errors.push({
          property: 'connectionTimeout',
          message: 'Connection timeout must be between 1 and 3600000 milliseconds',
          code: 'INVALID_TIMEOUT'
        });
      }
    }

    if (this.properties.serverTimeout !== undefined) {
      if (this.properties.serverTimeout < 1 || this.properties.serverTimeout > 3600000) {
        errors.push({
          property: 'serverTimeout',
          message: 'Server timeout must be between 1 and 3600000 milliseconds',
          code: 'INVALID_TIMEOUT'
        });
      }
    }

    // Validate health check
    if (this.properties.healthCheck) {
      const healthErrors = this.validateHealthCheck();
      errors.push(...healthErrors);
    }

    // Validate HTTP options only in HTTP mode
    if (this.properties.httpOptions && this.properties.mode !== 'http') {
      errors.push({
        property: 'httpOptions',
        message: 'HTTP options are only valid for HTTP mode',
        code: 'HTTP_OPTIONS_IN_TCP_MODE'
      });
    }

    // Validate stick table
    if (this.properties.stickTable?.enabled) {
      const stickErrors = this.validateStickTable();
      errors.push(...stickErrors);
    }

    // Warnings
    if (!this.properties.healthCheck || this.properties.healthCheck.type === 'none') {
      warnings.push({
        property: 'healthCheck',
        message: 'No health check configured. Consider adding health checks for better reliability',
        code: 'NO_HEALTH_CHECK'
      });
    }

    if (this.properties.retries === 0) {
      warnings.push({
        property: 'retries',
        message: 'Retries set to 0. Failed connections will not be retried',
        code: 'NO_RETRIES'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Convert to OPNSense API payload
   */
  toApiPayload(): any {
    const payload: any = {
      backend: {
        name: this.name,
        mode: this.properties.mode,
        algorithm: this.properties.balance,
        description: this.properties.description || '',
        enabled: this.properties.enabled !== false ? '1' : '0'
      }
    };

    // Connection settings
    if (this.properties.connectionTimeout !== undefined) {
      payload.backend.connectionTimeout = this.properties.connectionTimeout.toString();
    }
    if (this.properties.serverTimeout !== undefined) {
      payload.backend.serverTimeout = this.properties.serverTimeout.toString();
    }
    if (this.properties.retries !== undefined) {
      payload.backend.retries = this.properties.retries.toString();
    }

    // Health check
    if (this.properties.healthCheck && this.properties.healthCheck.type !== 'none') {
      payload.backend.healthCheckEnabled = '1';
      payload.backend.healthCheck = this.properties.healthCheck.type;
      
      if (this.properties.healthCheck.interval) {
        payload.backend.healthCheckInterval = this.properties.healthCheck.interval.toString();
      }
      if (this.properties.healthCheck.timeout) {
        payload.backend.healthCheckTimeout = this.properties.healthCheck.timeout.toString();
      }
      if (this.properties.healthCheck.rise) {
        payload.backend.healthCheckRise = this.properties.healthCheck.rise.toString();
      }
      if (this.properties.healthCheck.fall) {
        payload.backend.healthCheckFall = this.properties.healthCheck.fall.toString();
      }
      
      // HTTP health check options
      if (this.properties.healthCheck.type === 'http' || this.properties.healthCheck.type === 'https') {
        if (this.properties.healthCheck.uri) {
          payload.backend.healthCheckUri = this.properties.healthCheck.uri;
        }
        if (this.properties.healthCheck.httpVersion) {
          payload.backend.healthCheckHttpVersion = this.properties.healthCheck.httpVersion;
        }
        if (this.properties.healthCheck.httpStatusCode) {
          payload.backend.healthCheckStatusCode = this.properties.healthCheck.httpStatusCode;
        }
      }
    }

    // HTTP options
    if (this.properties.httpOptions && this.properties.mode === 'http') {
      if (this.properties.httpOptions.forwardFor !== undefined) {
        payload.backend.forwardFor = this.properties.httpOptions.forwardFor ? '1' : '0';
      }
      if (this.properties.httpOptions.httpClose !== undefined) {
        payload.backend.httpClose = this.properties.httpOptions.httpClose ? '1' : '0';
      }
      if (this.properties.httpOptions.httpServerClose !== undefined) {
        payload.backend.httpServerClose = this.properties.httpOptions.httpServerClose ? '1' : '0';
      }
      if (this.properties.httpOptions.httpPretendKeepalive !== undefined) {
        payload.backend.httpPretendKeepalive = this.properties.httpOptions.httpPretendKeepalive ? '1' : '0';
      }
    }

    // Stick table
    if (this.properties.stickTable?.enabled) {
      payload.backend.stickiness_pattern = '1';
      payload.backend.stickiness_pattern_type = this.properties.stickTable.type;
      
      if (this.properties.stickTable.type === 'cookie') {
        payload.backend.stickiness_cookie_name = this.properties.stickTable.cookieName || 'SERVERID';
        payload.backend.stickiness_cookie_mode = this.properties.stickTable.cookieMode || 'insert';
      }
      
      if (this.properties.stickTable.tableSize) {
        payload.backend.stickiness_size = this.properties.stickTable.tableSize;
      }
      if (this.properties.stickTable.expire) {
        payload.backend.stickiness_expire = this.properties.stickTable.expire;
      }
    }

    // Advanced options
    if (this.properties.advancedOptions) {
      if (this.properties.advancedOptions.customOptions) {
        payload.backend.advanced = this.properties.advancedOptions.customOptions.join('\n');
      }
      if (this.properties.advancedOptions.redispatch !== undefined) {
        payload.backend.redispatch = this.properties.advancedOptions.redispatch ? '1' : '0';
      }
      if (this.properties.advancedOptions.transparent !== undefined) {
        payload.backend.transparent = this.properties.advancedOptions.transparent ? '1' : '0';
      }
      if (this.properties.advancedOptions.httpReuseMode) {
        payload.backend.http_reuse = this.properties.advancedOptions.httpReuseMode;
      }
    }

    return payload;
  }

  /**
   * Update resource from API response
   */
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.properties._uuid = response.uuid;
    }

    if (response.result) {
      this.outputs.result = response.result;
      
      // Update state
      if (response.result === 'saved') {
        this.state = this.state === ResourceState.Creating ? ResourceState.Created : ResourceState.Updated;
      }
    }
  }

  /**
   * Validate health check configuration
   */
  private validateHealthCheck(): any[] {
    const errors = [];
    const hc = this.properties.healthCheck!;

    // Validate health check type
    const validTypes: HealthCheckType[] = [
      'none', 'basic', 'http', 'https', 'tcp',
      'mysql', 'pgsql', 'redis', 'smtp', 'esmtp', 'ssl'
    ];
    if (!validTypes.includes(hc.type)) {
      errors.push({
        property: 'healthCheck.type',
        message: `Invalid health check type: ${hc.type}`,
        code: 'INVALID_HEALTH_CHECK_TYPE'
      });
    }

    // Validate intervals
    if (hc.interval !== undefined && (hc.interval < 1000 || hc.interval > 3600000)) {
      errors.push({
        property: 'healthCheck.interval',
        message: 'Health check interval must be between 1000 and 3600000 milliseconds',
        code: 'INVALID_INTERVAL'
      });
    }

    if (hc.timeout !== undefined && (hc.timeout < 1000 || hc.timeout > 3600000)) {
      errors.push({
        property: 'healthCheck.timeout',
        message: 'Health check timeout must be between 1000 and 3600000 milliseconds',
        code: 'INVALID_TIMEOUT'
      });
    }

    // Validate rise and fall
    if (hc.rise !== undefined && (hc.rise < 1 || hc.rise > 100)) {
      errors.push({
        property: 'healthCheck.rise',
        message: 'Health check rise must be between 1 and 100',
        code: 'INVALID_RISE'
      });
    }

    if (hc.fall !== undefined && (hc.fall < 1 || hc.fall > 100)) {
      errors.push({
        property: 'healthCheck.fall',
        message: 'Health check fall must be between 1 and 100',
        code: 'INVALID_FALL'
      });
    }

    // HTTP-specific validations
    if ((hc.type === 'http' || hc.type === 'https') && hc.uri && !hc.uri.startsWith('/')) {
      errors.push({
        property: 'healthCheck.uri',
        message: 'Health check URI must start with /',
        code: 'INVALID_URI'
      });
    }

    return errors;
  }

  /**
   * Validate stick table configuration
   */
  private validateStickTable(): any[] {
    const errors = [];
    const st = this.properties.stickTable!;

    // Validate stick type
    const validTypes = ['sourceip', 'cookie', 'rdp-cookie', 'url_param'];
    if (!validTypes.includes(st.type)) {
      errors.push({
        property: 'stickTable.type',
        message: `Invalid stick table type: ${st.type}`,
        code: 'INVALID_STICK_TYPE'
      });
    }

    // Cookie-specific validations
    if (st.type === 'cookie') {
      if (!st.cookieName) {
        errors.push({
          property: 'stickTable.cookieName',
          message: 'Cookie name is required for cookie persistence',
          code: 'MISSING_COOKIE_NAME'
        });
      }
      
      if (st.cookieMode && !['insert', 'prefix', 'rewrite'].includes(st.cookieMode)) {
        errors.push({
          property: 'stickTable.cookieMode',
          message: 'Invalid cookie mode',
          code: 'INVALID_COOKIE_MODE'
        });
      }
    }

    return errors;
  }

  /**
   * Get HAProxy configuration snippet
   */
  getConfigSnippet(): string {
    let config = `backend ${this.name}\n`;
    config += `    mode ${this.properties.mode}\n`;
    config += `    balance ${this.properties.balance}\n`;
    
    if (this.properties.connectionTimeout) {
      config += `    timeout connect ${this.properties.connectionTimeout}ms\n`;
    }
    if (this.properties.serverTimeout) {
      config += `    timeout server ${this.properties.serverTimeout}ms\n`;
    }
    
    return config;
  }
}
