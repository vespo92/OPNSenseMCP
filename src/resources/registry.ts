/**
 * Resource Registry for IaC Resource Management
 * Manages all available resource types and their factories
 */

import { IaCResource } from './base';
import { z } from 'zod';

export type ResourceFactory<T extends IaCResource = IaCResource> = (
  id: string,
  name: string,
  properties: Record<string, any>
) => T;

export interface ResourceTypeDefinition {
  type: string;
  category: string;
  description: string;
  schema: z.ZodSchema<any>;
  factory: ResourceFactory;
  examples?: Array<{
    name: string;
    description: string;
    properties: Record<string, any>;
  }>;
}

export class ResourceRegistry {
  private static instance: ResourceRegistry;
  private resources = new Map<string, ResourceTypeDefinition>();

  private constructor() {}

  static getInstance(): ResourceRegistry {
    if (!ResourceRegistry.instance) {
      ResourceRegistry.instance = new ResourceRegistry();
    }
    return ResourceRegistry.instance;
  }

  /**
   * Register a new resource type
   */
  register(definition: ResourceTypeDefinition): void {
    if (this.resources.has(definition.type)) {
      throw new Error(`Resource type ${definition.type} is already registered`);
    }
    this.resources.set(definition.type, definition);
  }

  /**
   * Get a resource type definition
   */
  getDefinition(type: string): ResourceTypeDefinition | undefined {
    return this.resources.get(type);
  }

  /**
   * Create a resource instance
   */
  createResource(
    type: string,
    id: string,
    name: string,
    properties: Record<string, any>
  ): IaCResource {
    const definition = this.getDefinition(type);
    if (!definition) {
      throw new Error(`Unknown resource type: ${type}`);
    }
    return definition.factory(id, name, properties);
  }

  /**
   * List all registered resource types
   */
  listResourceTypes(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Get resource types by category
   */
  getResourcesByCategory(category: string): ResourceTypeDefinition[] {
    return Array.from(this.resources.values()).filter(
      def => def.category === category
    );
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.resources.forEach(def => categories.add(def.category));
    return Array.from(categories);
  }

  /**
   * Validate properties for a resource type
   */
  validateProperties(
    type: string,
    properties: Record<string, any>
  ): { valid: boolean; errors?: Array<{ path: string; message: string }> } {
    const definition = this.getDefinition(type);
    if (!definition) {
      return {
        valid: false,
        errors: [{ path: '', message: `Unknown resource type: ${type}` }]
      };
    }

    try {
      definition.schema.parse(properties);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        };
      }
      return {
        valid: false,
        errors: [{ path: '', message: 'Unknown validation error' }]
      };
    }
  }

  /**
   * Export registry as JSON for documentation
   */
  exportDefinitions(): Record<string, any> {
    const definitions: Record<string, any> = {};
    this.resources.forEach((def, type) => {
      definitions[type] = {
        category: def.category,
        description: def.description,
        schema: def.schema._def,
        examples: def.examples
      };
    });
    return definitions;
  }

  /**
   * Clear all registrations (mainly for testing)
   */
  clear(): void {
    this.resources.clear();
  }
}

// Export singleton instance
export const resourceRegistry = ResourceRegistry.getInstance();
