/**
 * Legacy Resource Base Classes - Compatibility Layer
 * This provides compatibility for existing resource files while migrating to IaC
 */

import { IaCResource, ResourceStatus, ValidationResult } from '../base.js';

// Re-export everything needed
export { IaCResource, ResourceStatus, ValidationResult } from '../base.js';

// Legacy ResourceState enum (maps to ResourceStatus)
export const ResourceState = {
  Updated: ResourceStatus.CREATED, // Legacy compatibility
  Unknown: ResourceStatus.UNKNOWN,
  Pending: ResourceStatus.PENDING,
  Creating: ResourceStatus.CREATING,
  Created: ResourceStatus.CREATED,
  Updating: ResourceStatus.UPDATING,
  Deleting: ResourceStatus.DELETING,
  Deleted: ResourceStatus.DELETED,
  Failed: ResourceStatus.FAILED
};

// Type alias for compatibility
export type ResourceState = ResourceStatus;

// Legacy ValidationHelper
export const ValidationHelper = {
  validateRequired(properties: any, required: string[]) {
    const errors: any[] = [];
    for (const field of required) {
      if (!properties[field]) {
        errors.push({
          path: field,
          message: `${field} is required`
        });
      }
    }
    return errors;
  },
  
  validateIpAddress(ip: string, field: string) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return {
        path: field,
        message: `Invalid IP address format`
      };
    }
    return null;
  },
  
  validateEnum(value: string, validValues: string[], field: string) {
    if (!validValues.includes(value)) {
      return {
        path: field,
        message: `Must be one of: ${validValues.join(', ')}`
      };
    }
    return null;
  },
  
  validatePort(port: number, field: string) {
    if (port < 1 || port > 65535) {
      return {
        path: field,
        message: `Port must be between 1 and 65535`
      };
    }
    return null;
  }
};

// Legacy types
export interface ResourceProperties {
  [key: string]: any;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

// Legacy Resource base class that wraps IaCResource
export abstract class Resource extends IaCResource {
  protected properties: any;
  protected outputs: Record<string, any> = {};
  protected state: ResourceStatus = ResourceStatus.UNKNOWN;
  protected dependencies: string[] = [];

  constructor(id: string, name: string, properties: any, dependencies: string[] = []) {
    super(id, name, properties);
    this.properties = properties;
    this.dependencies = dependencies;
  }

  // Legacy validation method that returns warnings
  validate(): ValidationResult & { warnings?: ValidationWarning[] } {
    const result = super.validate();
    return {
      ...result,
      warnings: []
    };
  }

  // Legacy methods
  protected validateResourceProperties(): any[] {
    return [];
  }

  getOutputs(): Record<string, any> {
    return this.outputs;
  }

  getState(): ResourceStatus {
    return this.state;
  }

  setState(state: ResourceStatus): void {
    this.state = state;
  }

  getResourceProperties(): any {
    return this.properties;
  }

  
  // Get resource summary
  getSummary(): any {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      properties: this.properties,
      outputs: this.outputs
    };
  }

  // Convert to API payload (compatibility)
  toApiPayload(): any {
    return this.toAPIPayload();
  }

  // Update from API response (compatibility)
  fromApiResponse(response: any): void {
    this.fromAPIResponse(response);
  }

  // Abstract methods that need to be implemented
  abstract readonly type: string;
  abstract readonly schema: any;
  abstract toAPIPayload(): any;
  abstract fromAPIResponse(response: any): void;
  abstract getRequiredPermissions(): string[];
}
