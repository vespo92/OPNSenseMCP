import { z } from 'zod';
import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState } from '../../legacy/base.js';

/**
 * Server modes
 */
export type ServerMode = 'active' | 'backup' | 'disabled';

/**
 * SSL verification modes
 */
export type SslVerifyMode = 'none' | 'required';

/**
 * HAProxy server properties
 */
export interface HaproxyServerProperties extends ResourceProperties {
  backend: string; // Reference to backend resource ID or name
  address: string;
  port: number;
  mode?: ServerMode;
  weight?: number;
  description?: string;
  enabled?: boolean;
  
  // SSL/TLS options
  ssl?: {
    enabled: boolean;
    verify?: SslVerifyMode;
    verifyHost?: boolean;
    sni?: string;
    caCertificate?: string; // Reference to certificate resource
    clientCertificate?: string; // Reference to certificate resource
  };
  
  // Health check overrides
  checkOverride?: {
    enabled: boolean;
    port?: number;
    interval?: number;
    downInterval?: number;
  };
  
  // Advanced options
  advanced?: {
    maxConnections?: number;
    maxQueuedConnections?: number;
    slowStart?: number;
    cookie?: string;
    customOptions?: string[];
  };
}

/**
 * OPNSense HAProxy Server Resource
 */
export class HaproxyServer extends Resource {
  // Required abstract implementations
  readonly type = 'opnsense:service:haproxy:server';
  
  readonly schema = z.object({
    name: z.string().optional(),
    enabled: z.boolean().optional()
  });

  constructor(
    name: string,
    properties: HaproxyServerProperties,
    dependencies: string[] = []
  ) {
    // Automatically add backend as dependency if not already included
    if (!dependencies.includes(properties.backend)) {
      dependencies = [...dependencies, properties.backend];
    }
    super('opnsense:service:haproxy:server', name, properties, dependencies);
  }

  /**
   * Validate server configuration
   */
  validate(): ValidationResult {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'backend',
      'address',
      'port'
    ]);
    errors.push(...requiredErrors);

    // Validate address (IP or hostname)
    if (this.properties.address) {
      const addressError = this.validateAddress(this.properties.address);
      if (addressError) errors.push(addressError);
    }

    // Validate port
    if (this.properties.port !== undefined) {
      const portError = ValidationHelper.validatePort(this.properties.port, 'port');
      if (portError) errors.push(portError);
    }

    // Validate mode
    if (this.properties.mode) {
      const modeError = ValidationHelper.validateEnum(this.properties.mode, ['http', 'tcp'], 'mode');
      if (modeError) errors.push(modeError);
    }

    // Validate weight
    if (this.properties.weight !== undefined) {
      if (!Number.isInteger(this.properties.weight) || 
          this.properties.weight < 0 || 
          this.properties.weight > 256) {
        errors.push({
          path: 'weight',
          message: 'Weight must be an integer between 0 and 256',
          code: 'INVALID_WEIGHT'
        });
      }
    }

    // Validate SSL configuration
    if (this.properties.ssl?.enabled) {
      const sslErrors = this.validateSslConfig();
      errors.push(...sslErrors);
    }

    // Validate check override
    if (this.properties.checkOverride?.enabled) {
      if (this.properties.checkOverride.port !== undefined) {
        const portError = ValidationHelper.validatePort(
          this.properties.checkOverride.port, 
          'checkOverride.port'
        );
        if (portError) errors.push(portError);
      }

      if (this.properties.checkOverride.interval !== undefined &&
          (this.properties.checkOverride.interval < 1000 || 
           this.properties.checkOverride.interval > 3600000)) {
        errors.push({
          property: 'checkOverride.interval',
          message: 'Check interval must be between 1000 and 3600000 milliseconds',
          code: 'INVALID_INTERVAL'
        });
      }
    }

    // Validate advanced options
    if (this.properties.advanced) {
      if (this.properties.advanced.maxConnections !== undefined &&
          (this.properties.advanced.maxConnections < 0 || 
           this.properties.advanced.maxConnections > 100000)) {
        errors.push({
          property: 'advanced.maxConnections',
          message: 'Max connections must be between 0 and 100000',
          code: 'INVALID_MAX_CONNECTIONS'
        });
      }

      if (this.properties.advanced.slowStart !== undefined &&
          (this.properties.advanced.slowStart < 0 || 
           this.properties.advanced.slowStart > 3600)) {
        errors.push({
          property: 'advanced.slowStart',
          message: 'Slow start must be between 0 and 3600 seconds',
          code: 'INVALID_SLOW_START'
        });
      }
    }

    // Warnings
    if (this.properties.mode === 'disabled') {
      warnings.push({
        path: 'mode',
        message: 'Server is disabled and will not receive traffic',
        code: 'SERVER_DISABLED'
      });
    }

    if (this.properties.weight === 0) {
      warnings.push({
        path: 'weight',
        message: 'Server weight is 0, it will not receive traffic unless all other servers are down',
        code: 'ZERO_WEIGHT'
      });
    }

    if (this.properties.ssl?.enabled && this.properties.ssl.verify === 'none') {
      warnings.push({
        path: 'ssl.verify',
        message: 'SSL verification is disabled. This may pose a security risk',
        code: 'SSL_VERIFY_DISABLED'
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
      server: {
        name: this.name,
        address: this.properties.address,
        port: this.properties.port.toString(),
        mode: this.properties.mode || 'active',
        weight: (this.properties.weight ?? 1).toString(),
        description: this.properties.description || '',
        enabled: this.properties.enabled !== false ? '1' : '0'
      }
    };

    // SSL configuration
    if (this.properties.ssl?.enabled) {
      payload.server.ssl = '1';
      
      if (this.properties.ssl.verify) {
        payload.server.sslVerify = this.properties.ssl.verify;
      }
      if (this.properties.ssl.verifyHost !== undefined) {
        payload.server.sslVerifyHost = this.properties.ssl.verifyHost ? '1' : '0';
      }
      if (this.properties.ssl.sni) {
        payload.server.sslSni = this.properties.ssl.sni;
      }
      if (this.properties.ssl.caCertificate) {
        payload.server.sslCA = this.properties.ssl.caCertificate;
      }
      if (this.properties.ssl.clientCertificate) {
        payload.server.sslClientCertificate = this.properties.ssl.clientCertificate;
      }
    }

    // Check override
    if (this.properties.checkOverride?.enabled) {
      payload.server.checkEnabled = '1';
      
      if (this.properties.checkOverride.port !== undefined) {
        payload.server.checkPort = this.properties.checkOverride.port.toString();
      }
      if (this.properties.checkOverride.interval !== undefined) {
        payload.server.checkInterval = this.properties.checkOverride.interval.toString();
      }
      if (this.properties.checkOverride.downInterval !== undefined) {
        payload.server.checkDownInterval = this.properties.checkOverride.downInterval.toString();
      }
    }

    // Advanced options
    if (this.properties.advanced) {
      if (this.properties.advanced.maxConnections !== undefined) {
        payload.server.maxconn = this.properties.advanced.maxConnections.toString();
      }
      if (this.properties.advanced.maxQueuedConnections !== undefined) {
        payload.server.maxqueue = this.properties.advanced.maxQueuedConnections.toString();
      }
      if (this.properties.advanced.slowStart !== undefined) {
        payload.server.slowstart = this.properties.advanced.slowStart.toString();
      }
      if (this.properties.advanced.cookie) {
        payload.server.cookie = this.properties.advanced.cookie;
      }
      if (this.properties.advanced.customOptions) {
        payload.server.advanced = this.properties.advanced.customOptions.join('\n');
      }
    }

    // Link to backend
    payload.server.backend = this.properties.backend;

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
   * Validate address (IP or hostname)
   */
  private validateAddress(address: string): any {
    // Check if it's an IP address
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    if (ipv4Regex.test(address) || ipv6Regex.test(address)) {
      return ValidationHelper.validateIpAddress(address, 'address');
    }
    
    // Check if it's a valid hostname
    const hostnameRegex = /^(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/;
    if (!hostnameRegex.test(address)) {
      return {
        path: 'address',
        message: 'Address must be a valid IP address or hostname',
        code: 'INVALID_ADDRESS'
      };
    }
    
    return null;
  }

  /**
   * Validate SSL configuration
   */
  private validateSslConfig(): any[] {
    const errors = [];
    const ssl = this.properties.ssl!;

    if (ssl.verify && !['none', 'required'].includes(ssl.verify)) {
      errors.push({
        property: 'ssl.verify',
        message: 'SSL verify must be either "none" or "required"',
        code: 'INVALID_SSL_VERIFY'
      });
    }

    if (ssl.sni && !/^(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(ssl.sni)) {
      errors.push({
        property: 'ssl.sni',
        message: 'SNI must be a valid hostname',
        code: 'INVALID_SNI'
      });
    }

    return errors;
  }

  /**
   * Get HAProxy configuration line for this server
   */
  getConfigLine(): string {
    let config = `    server ${this.name} ${this.properties.address}:${this.properties.port}`;
    
    if (this.properties.weight !== undefined && this.properties.weight !== 1) {
      config += ` weight ${this.properties.weight}`;
    }
    
    if (this.properties.mode === 'backup') {
      config += ' backup';
    } else if (this.properties.mode === 'disabled') {
      config += ' disabled';
    }
    
    if (this.properties.ssl?.enabled) {
      config += ' ssl';
      if (this.properties.ssl.verify === 'none') {
        config += ' verify none';
      }
      if (this.properties.ssl.sni) {
        config += ` sni str(${this.properties.ssl.sni})`;
      }
    }
    
    if (this.properties.advanced?.maxConnections) {
      config += ` maxconn ${this.properties.advanced.maxConnections}`;
    }
    
    return config;
  }

  /**
   * Check if this server is active
   */
  isActive(): boolean {
    return this.properties.enabled !== false && 
           this.properties.mode !== 'disabled';
  }

  /**
   * Get effective weight (0 if disabled)
   */
  getEffectiveWeight(): number {
    if (!this.isActive()) return 0;
    return this.properties.weight ?? 1;
  }

  /**
   * Convert to API payload
   */
  toAPIPayload(): any {
    return this.toApiPayload ? this.toApiPayload() : this.properties;
  }

  /**
   * Update from API response
   */
  fromAPIResponse(response: any): void {
    if (this.fromApiResponse) {
      this.fromApiResponse(response);
    }
  }

  /**
   * Get required permissions
   */
  getRequiredPermissions(): string[] {
    return ['haproxy.manage'];
  }
}
