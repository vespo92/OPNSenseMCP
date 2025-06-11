// Core Resource Model for MCP-based IaC Platform
// This provides the foundation for all MCP servers to implement IaC patterns

import crypto from 'crypto';

/**
 * Resource states following standard IaC lifecycle
 */
export enum ResourceState {
  Pending = 'pending',      // Resource defined but not created
  Creating = 'creating',    // Resource creation in progress
  Created = 'created',      // Resource exists and is active
  Updating = 'updating',    // Resource update in progress
  Deleting = 'deleting',    // Resource deletion in progress
  Deleted = 'deleted',      // Resource has been deleted
  Failed = 'failed'         // Resource operation failed
}

/**
 * Standard validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Resource metadata for tracking
 */
export interface ResourceMetadata {
  createdAt?: Date;
  updatedAt?: Date;
  version: number;
  checksum?: string;
}

/**
 * Base class for all IaC resources across MCP servers
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
    this.id = this.generateId(type, name);
    this.type = type;
    this.name = name;
    this.metadata = {
      version: 1,
      createdAt: new Date()
    };
  }
  
  /**
   * Generate unique resource ID
   */
  private generateId(type: string, name: string): string {
    const hash = crypto.createHash('sha256')
      .update(`${type}:${name}`)
      .digest('hex')
      .substring(0, 8);
    return `${type}:${name}:${hash}`;
  }
  
  /**
   * Validate resource configuration
   */
  abstract validate(): ValidationResult;
  
  /**
   * Convert to API-specific payload
   */
  abstract toApiPayload(): any;
  
  /**
   * Update resource state from API response
   */
  abstract fromApiResponse(response: any): void;
  
  /**
   * Get resource references (for dependency resolution)
   */
  getReferences(): string[] {
    const refs: string[] = [];
    
    // Scan properties for ${resource.output} patterns
    const scanValue = (value: any): void => {
      if (typeof value === 'string') {
        const matches = value.matchAll(/\$\{([^}]+)\}/g);
        for (const match of matches) {
          refs.push(match[1].split('.')[0]);
        }
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(scanValue);
      }
    };
    
    Object.values(this.properties).forEach(scanValue);
    return [...new Set(refs)];
  }
  
  /**
   * Resolve references in properties
   */
  resolveReferences(resources: Map<string, Resource>): void {
    const resolveValue = (value: any): any => {
      if (typeof value === 'string') {
        return value.replace(/\$\{([^}]+)\}/g, (match, ref) => {
          const [resourceName, outputKey] = ref.split('.');
          const resource = resources.get(resourceName);
          if (resource && outputKey && resource.outputs[outputKey]) {
            return resource.outputs[outputKey];
          }
          return match;
        });
      } else if (Array.isArray(value)) {
        return value.map(resolveValue);
      } else if (typeof value === 'object' && value !== null) {
        const resolved: any = {};
        for (const [key, val] of Object.entries(value)) {
          resolved[key] = resolveValue(val);
        }
        return resolved;
      }
      return value;
    };
    
    // Create new properties object with resolved references
    const resolved: any = {};
    for (const [key, value] of Object.entries(this.properties)) {
      resolved[key] = resolveValue(value);
    }
    this.properties = resolved;
  }
  
  /**
   * Get resource display info
   */
  getDisplayInfo(): string {
    return `${this.type} "${this.name}" [${this.state}]`;
  }
  
  /**
   * Clone resource with new properties
   */
  clone(newProperties?: Partial<Record<string, any>>): Resource {
    const ResourceClass = this.constructor as any;
    return new ResourceClass(
      this.name,
      { ...this.properties, ...newProperties }
    );
  }
}

/**
 * Resource action for execution planning
 */
export interface ResourceAction {
  type: 'create' | 'update' | 'delete' | 'read';
  resource: Resource;
  reason?: string;
  requiresRecreate?: boolean;
}

/**
 * Deployment plan containing all actions
 */
export interface DeploymentPlan {
  id: string;
  name: string;
  actions: ResourceAction[];
  summary: {
    create: number;
    update: number;
    delete: number;
    unchanged: number;
  };
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  success: boolean;
  plan: DeploymentPlan;
  appliedActions: ResourceAction[];
  failedActions: Array<{
    action: ResourceAction;
    error: string;
  }>;
  duration: number;
}

/**
 * Resource registry for dynamic resource creation
 */
export class ResourceRegistry {
  private resources = new Map<string, typeof Resource>();
  
  /**
   * Register a resource type
   */
  register(type: string, resourceClass: typeof Resource): void {
    this.resources.set(type, resourceClass);
  }
  
  /**
   * Create a resource instance
   */
  create(type: string, name: string, properties: any): Resource {
    const ResourceClass = this.resources.get(type);
    if (!ResourceClass) {
      throw new Error(`Unknown resource type: ${type}`);
    }
    return new (ResourceClass as any)(name, properties);
  }
  
  /**
   * Check if resource type is registered
   */
  has(type: string): boolean {
    return this.resources.has(type);
  }
  
  /**
   * Get all registered types
   */
  getTypes(): string[] {
    return Array.from(this.resources.keys());
  }
}

/**
 * Cross-MCP resource reference
 */
export interface CrossMCPReference {
  server: string;
  resourceId: string;
  outputKey: string;
}

/**
 * Resolve cross-MCP references
 */
export function parseCrossMCPReference(ref: string): CrossMCPReference | null {
  // Format: ${server:resource.output}
  const match = ref.match(/\$\{([^:]+):([^.]+)\.([^}]+)\}/);
  if (match) {
    return {
      server: match[1],
      resourceId: match[2],
      outputKey: match[3]
    };
  }
  return null;
}
