import { z } from 'zod';
import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState, ValidationWarning } from '../../legacy/base.js';

/**
 * DHCP static mapping properties
 */
export interface DhcpStaticMappingProperties extends ResourceProperties {
  interface: string; // Interface name or reference
  mac: string;
  ip: string;
  hostname?: string;
  description?: string;
  enabled?: boolean;
}

/**
 * OPNSense DHCP Static Mapping Resource
 */
export class DhcpStaticMapping extends Resource {
  // Required abstract implementations
  readonly type = 'opnsense:service:dhcp:static';
  
  readonly schema = z.object({
    name: z.string().optional(),
    enabled: z.boolean().optional()
  });

  constructor(
    name: string,
    properties: DhcpStaticMappingProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:service:dhcp:static', name, properties, dependencies);
  }

  validate(): ValidationResult {
    const errors = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'interface',
      'mac',
      'ip'
    ]);
    errors.push(...requiredErrors);

    // Validate MAC address
    if (this.properties.mac) {
      const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
      if (!macRegex.test(this.properties.mac)) {
        errors.push({
          path: 'mac',
          message: 'Invalid MAC address format (use XX:XX:XX:XX:XX:XX)',
          code: 'INVALID_MAC'
        });
      }
    }

    // Validate IP address
    if (this.properties.ip) {
      const ipError = ValidationHelper.validateIpAddress(this.properties.ip, 'ip');
      if (ipError) errors.push(ipError);
    }

    // Validate hostname
    if (this.properties.hostname && !/^[a-zA-Z0-9-]+$/.test(this.properties.hostname)) {
      errors.push({
        path: 'hostname',
        message: 'Hostname must contain only letters, numbers, and hyphens',
        code: 'INVALID_HOSTNAME'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  toApiPayload(): any {
    return {
      staticmap: {
        interface: this.properties.interface,
        mac: this.properties.mac.toLowerCase(),
        ipaddr: this.properties.ip,
        hostname: this.properties.hostname || '',
        descr: this.properties.description || '',
        enabled: this.properties.enabled !== false ? '1' : '0'
      }
    };
  }

  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.properties._uuid = response.uuid;
    }
    if (response.result === 'saved') {
      this.state = ResourceState.Created;
    }
  }

  /**
   * Normalize MAC address to lowercase with colons
   */
  getNormalizedMac(): string {
    return this.properties.mac.toLowerCase();
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
    return ['dhcp.manage'];
  }
}
