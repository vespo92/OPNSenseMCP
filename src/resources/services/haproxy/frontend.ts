import { z } from 'zod';
import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState, ValidationWarning } from '../../legacy/base.js';

/**
 * HAProxy frontend properties
 */
export interface HaproxyFrontendProperties extends ResourceProperties {
  bind: {
    address: string;
    port: number;
    ssl?: boolean;
    certificate?: string; // Reference to certificate resource
  }[];
  mode: 'http' | 'tcp';
  defaultBackend: string; // Reference to backend resource
  description?: string;
  enabled?: boolean;
}

/**
 * OPNSense HAProxy Frontend Resource
 */
export class HaproxyFrontend extends Resource {
  // Required abstract implementations
  readonly type = 'opnsense:service:haproxy:frontend';
  
  readonly schema = z.object({
    name: z.string().optional(),
    enabled: z.boolean().optional()
  });

  constructor(
    name: string,
    properties: HaproxyFrontendProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:service:haproxy:frontend', name, properties, dependencies);
  }

  validate(): ValidationResult {
    const errors = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'bind',
      'mode',
      'defaultBackend'
    ]);
    errors.push(...requiredErrors);

    // Validate bind addresses
    if (this.properties.bind && Array.isArray(this.properties.bind)) {
      for (let i = 0; i < this.properties.bind.length; i++) {
        const bind = this.properties.bind[i];
        if (!bind.address || !bind.port) {
          errors.push({
            property: `bind[${i}]`,
            message: 'Bind entry must have address and port',
            code: 'INVALID_BIND'
          });
        }
        if (bind.port) {
          const portError = ValidationHelper.validatePort(bind.port, `bind[${i}].port`);
          if (portError) errors.push(portError);
        }
      }
    }

    // Validate mode
    if (this.properties.mode) {
      const modeError = ValidationHelper.validateEnum(this.properties.mode, ['http', 'tcp'], 'mode');
      if (modeError) errors.push(modeError);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  toApiPayload(): any {
    return {
      frontend: {
        name: this.name,
        mode: this.properties.mode,
        defaultBackend: this.properties.defaultBackend,
        description: this.properties.description || '',
        enabled: this.properties.enabled !== false ? '1' : '0',
        bind: this.properties.bind.map((b: any) => ({
          address: b.address,
          port: b.port.toString(),
          ssl: b.ssl ? '1' : '0',
          certificate: b.certificate || ''
        }))
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
