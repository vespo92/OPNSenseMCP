import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState, ValidationWarning } from '../../base.js';

/**
 * DNS override properties
 */
export interface DnsOverrideProperties extends ResourceProperties {
  host: string;
  domain: string;
  ip: string;
  description?: string;
  enabled?: boolean;
}

/**
 * OPNSense DNS Override Resource
 */
export class DnsOverride extends Resource {
  constructor(
    name: string,
    properties: DnsOverrideProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:service:dns:override', name, properties, dependencies);
  }

  validate(): ValidationResult {
    const errors = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'host',
      'domain',
      'ip'
    ]);
    errors.push(...requiredErrors);

    // Validate hostname
    if (this.properties.host && !/^[a-zA-Z0-9-]+$/.test(this.properties.host)) {
      errors.push({
        property: 'host',
        message: 'Host must contain only letters, numbers, and hyphens',
        code: 'INVALID_HOST'
      });
    }

    // Validate domain
    if (this.properties.domain && !/^(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(this.properties.domain)) {
      errors.push({
        property: 'domain',
        message: 'Invalid domain format',
        code: 'INVALID_DOMAIN'
      });
    }

    // Validate IP
    if (this.properties.ip) {
      const ipError = ValidationHelper.validateIpAddress(this.properties.ip, 'ip');
      if (ipError) errors.push(ipError);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  toApiPayload(): any {
    return {
      override: {
        host: this.properties.host,
        domain: this.properties.domain,
        ip: this.properties.ip,
        description: this.properties.description || '',
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
   * Get the full hostname
   */
  getFullHostname(): string {
    return `${this.properties.host}.${this.properties.domain}`;
  }
}
