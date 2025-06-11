import { createHash } from 'crypto';

/**
 * Base class for all OPNSense resources
 */
export abstract class Resource {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  public state: ResourceState = ResourceState.Pending;
  public outputs: Record<string, any> = {};
  public metadata: ResourceMetadata;

  constructor(
    type: string,
    name: string,
    public properties: Record<string, any>,
    public dependencies: string[] = []
  ) {
    this.type = type;
    this.name = name;
    this.id = this.generateId();
    this.metadata = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
  }

  /**
   * Generate a unique ID for this resource
   */
  private generateId(): string {
    const hash = createHash('sha256');
    hash.update(`${this.type}:${this.name}:${Date.now()}`);
    return `${this.type}:${this.name}:${hash.digest('hex').substring(0, 8)}`;
  }

  /**
   * Validate the resource configuration
   */
  abstract validate(): ValidationResult;

  /**
   * Convert resource to API payload
   */
  abstract toApiPayload(): any;

  /**
   * Update resource state from API response
   */
  abstract fromApiResponse(response: any): void;

  /**
   * Get the resource type without namespace
   */
  getResourceType(): string {
    const parts = this.type.split(':');
    return parts[parts.length - 1];
  }

  /**
   * Get the resource namespace
   */
  getNamespace(): string {
    const parts = this.type.split(':');
    return parts.slice(0, -1).join(':');
  }

  /**
   * Check if this resource depends on another
   */
  dependsOn(resourceId: string): boolean {
    return this.dependencies.includes(resourceId);
  }

  /**
   * Get a property value with dot notation support
   */
  getProperty(path: string): any {
    const parts = path.split('.');
    let value = this.properties;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set a property value with dot notation support
   */
  setProperty(path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
    let target = this.properties;
    
    for (const part of parts) {
      if (!(part in target)) {
        target[part] = {};
      }
      target = target[part];
    }
    
    target[lastPart] = value;
    this.metadata.updatedAt = new Date().toISOString();
  }

  /**
   * Get resource summary for display
   */
  getSummary(): ResourceSummary {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      state: this.state,
      dependencies: this.dependencies,
      metadata: this.metadata
    };
  }

  /**
   * Clone the resource with new properties
   */
  clone(newProperties?: Partial<Record<string, any>>): this {
    const Constructor = this.constructor as new (
      name: string,
      properties: Record<string, any>,
      dependencies?: string[]
    ) => this;
    
    return new Constructor(
      this.name,
      { ...this.properties, ...newProperties },
      [...this.dependencies]
    );
  }
}

/**
 * Resource state enum
 */
export enum ResourceState {
  Pending = 'pending',
  Creating = 'creating',
  Created = 'created',
  Updating = 'updating',
  Updated = 'updated',
  Deleting = 'deleting',
  Deleted = 'deleted',
  Failed = 'failed',
  Unknown = 'unknown'
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

/**
 * Validation error interface
 */
export interface ValidationError {
  property: string;
  message: string;
  code?: string;
}

/**
 * Validation warning interface
 */
export interface ValidationWarning {
  property: string;
  message: string;
  code?: string;
}

/**
 * Resource metadata interface
 */
export interface ResourceMetadata {
  createdAt: string;
  updatedAt: string;
  version: number;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Resource summary interface
 */
export interface ResourceSummary {
  id: string;
  type: string;
  name: string;
  state: ResourceState;
  dependencies: string[];
  metadata: ResourceMetadata;
}

/**
 * Resource properties interface (base)
 */
export interface ResourceProperties {
  [key: string]: any;
  _uuid?: string; // Internal UUID from OPNSense
  _revision?: string; // Revision for updates
}

/**
 * Helper class for validation
 */
export class ValidationHelper {
  static validateRequired(
    properties: Record<string, any>,
    required: string[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const field of required) {
      if (!properties[field]) {
        errors.push({
          property: field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD'
        });
      }
    }
    
    return errors;
  }

  static validateEnum(
    value: any,
    property: string,
    allowedValues: string[]
  ): ValidationError | null {
    if (!allowedValues.includes(value)) {
      return {
        property,
        message: `${property} must be one of: ${allowedValues.join(', ')}`,
        code: 'INVALID_ENUM'
      };
    }
    return null;
  }

  static validateIpAddress(
    value: string,
    property: string
  ): ValidationError | null {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      return {
        property,
        message: `${property} must be a valid IP address`,
        code: 'INVALID_IP'
      };
    }
    return null;
  }

  static validatePort(
    value: any,
    property: string
  ): ValidationError | null {
    const port = parseInt(value, 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      return {
        property,
        message: `${property} must be a valid port number (1-65535)`,
        code: 'INVALID_PORT'
      };
    }
    return null;
  }

  static validateCidr(
    value: string,
    property: string
  ): ValidationError | null {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    
    if (!cidrRegex.test(value)) {
      return {
        property,
        message: `${property} must be a valid CIDR notation (e.g., 10.0.0.0/24)`,
        code: 'INVALID_CIDR'
      };
    }
    
    const [ip, mask] = value.split('/');
    const maskNum = parseInt(mask, 10);
    
    if (maskNum < 0 || maskNum > 32) {
      return {
        property,
        message: `${property} subnet mask must be between 0 and 32`,
        code: 'INVALID_SUBNET_MASK'
      };
    }
    
    return null;
  }
}
