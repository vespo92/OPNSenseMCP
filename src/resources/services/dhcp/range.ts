import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState, ValidationWarning } from '../../base.js';

/**
 * DHCP range properties
 */
export interface DhcpRangeProperties extends ResourceProperties {
  interface: string; // Interface name or reference
  from: string;
  to: string;
  enabled?: boolean;
}

/**
 * OPNSense DHCP Range Resource
 */
export class DhcpRange extends Resource {
  constructor(
    name: string,
    properties: DhcpRangeProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:service:dhcp:range', name, properties, dependencies);
  }

  validate(): ValidationResult {
    const errors = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'interface',
      'from',
      'to'
    ]);
    errors.push(...requiredErrors);

    // Validate IP addresses
    if (this.properties.from) {
      const fromError = ValidationHelper.validateIpAddress(this.properties.from, 'from');
      if (fromError) errors.push(fromError);
    }

    if (this.properties.to) {
      const toError = ValidationHelper.validateIpAddress(this.properties.to, 'to');
      if (toError) errors.push(toError);
    }

    // Validate range order
    if (this.properties.from && this.properties.to) {
      const fromParts = this.properties.from.split('.').map((p: string) => parseInt(p, 10));
      const toParts = this.properties.to.split('.').map((p: string) => parseInt(p, 10));
      
      // Simple check - just compare last octet for now
      if (fromParts[3] >= toParts[3]) {
        errors.push({
          property: 'from/to',
          message: 'Range start must be less than range end',
          code: 'INVALID_RANGE'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  toApiPayload(): any {
    return {
      range: {
        interface: this.properties.interface,
        from: this.properties.from,
        to: this.properties.to,
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
   * Get the number of IPs in this range
   */
  getRangeSize(): number {
    const fromParts = this.properties.from.split('.').map((p: string) => parseInt(p, 10));
    const toParts = this.properties.to.split('.').map((p: string) => parseInt(p, 10));
    
    // Simple calculation for same subnet
    return toParts[3] - fromParts[3] + 1;
  }
}
