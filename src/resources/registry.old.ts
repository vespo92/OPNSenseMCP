import { Resource } from './base.js';
import { FirewallRule } from './firewall/rule.js';
import { FirewallAlias } from './firewall/alias.js';
import { Vlan } from './network/vlan.js';
import { Interface } from './network/interface.js';
import { HaproxyBackend } from './services/haproxy/backend.js';
import { HaproxyServer } from './services/haproxy/server.js';
import { HaproxyFrontend } from './services/haproxy/frontend.js';
import { DnsOverride } from './services/dns/override.js';
import { DhcpRange } from './services/dhcp/range.js';
import { DhcpStaticMapping } from './services/dhcp/static.js';

/**
 * Resource type definitions
 */
export const ResourceTypes = {
  // Firewall
  FIREWALL_RULE: 'opnsense:firewall:rule',
  FIREWALL_ALIAS: 'opnsense:firewall:alias',
  FIREWALL_NAT: 'opnsense:firewall:nat',
  
  // Network
  NETWORK_VLAN: 'opnsense:network:vlan',
  NETWORK_INTERFACE: 'opnsense:network:interface',
  
  // Services - HAProxy
  SERVICE_HAPROXY_BACKEND: 'opnsense:service:haproxy:backend',
  SERVICE_HAPROXY_SERVER: 'opnsense:service:haproxy:server',
  SERVICE_HAPROXY_FRONTEND: 'opnsense:service:haproxy:frontend',
  
  // Services - DNS
  SERVICE_DNS_OVERRIDE: 'opnsense:service:dns:override',
  
  // Services - DHCP
  SERVICE_DHCP_RANGE: 'opnsense:service:dhcp:range',
  SERVICE_DHCP_STATIC: 'opnsense:service:dhcp:static',
} as const;

export type ResourceType = typeof ResourceTypes[keyof typeof ResourceTypes];

/**
 * Resource constructor type
 */
type ResourceConstructor = new (
  name: string,
  properties: any,
  dependencies?: string[]
) => Resource;

/**
 * Resource Registry - Manages resource type registration and instantiation
 */
export class ResourceRegistry {
  private resources = new Map<string, ResourceConstructor>();
  private instances = new Map<string, Resource>();
  
  /**
   * Register a resource type
   */
  register(type: string, resourceClass: ResourceConstructor): void {
    if (this.resources.has(type)) {
      throw new Error(`Resource type '${type}' is already registered`);
    }
    this.resources.set(type, resourceClass);
  }
  
  /**
   * Create a resource instance
   */
  create(type: string, name: string, properties: any, dependencies: string[] = []): Resource {
    const ResourceClass = this.resources.get(type);
    if (!ResourceClass) {
      throw new Error(`Unknown resource type: ${type}`);
    }
    
    const resource = new ResourceClass(name, properties, dependencies);
    this.instances.set(resource.id, resource);
    return resource;
  }
  
  /**
   * Get a resource by ID
   */
  get(id: string): Resource | undefined {
    return this.instances.get(id);
  }
  
  /**
   * Get all instances of a specific type
   */
  getByType(type: string): Resource[] {
    return Array.from(this.instances.values()).filter(r => r.type === type);
  }
  
  /**
   * Get all resource instances
   */
  getAll(): Resource[] {
    return Array.from(this.instances.values());
  }
  
  /**
   * Remove a resource instance
   */
  remove(id: string): boolean {
    return this.instances.delete(id);
  }
  
  /**
   * Clear all instances
   */
  clearInstances(): void {
    this.instances.clear();
  }
  
  /**
   * Check if a resource type is registered
   */
  hasType(type: string): boolean {
    return this.resources.has(type);
  }
  
  /**
   * Get all registered types
   */
  getTypes(): string[] {
    return Array.from(this.resources.keys());
  }
  
  /**
   * Initialize registry with all OPNSense resources
   */
  static initialize(): ResourceRegistry {
    const registry = new ResourceRegistry();
    
    // Firewall resources
    registry.register(ResourceTypes.FIREWALL_RULE, FirewallRule);
    registry.register(ResourceTypes.FIREWALL_ALIAS, FirewallAlias);
    
    // Network resources
    registry.register(ResourceTypes.NETWORK_VLAN, Vlan);
    registry.register(ResourceTypes.NETWORK_INTERFACE, Interface);
    
    // HAProxy resources
    registry.register(ResourceTypes.SERVICE_HAPROXY_BACKEND, HaproxyBackend);
    registry.register(ResourceTypes.SERVICE_HAPROXY_SERVER, HaproxyServer);
    registry.register(ResourceTypes.SERVICE_HAPROXY_FRONTEND, HaproxyFrontend);
    
    // DNS resources
    registry.register(ResourceTypes.SERVICE_DNS_OVERRIDE, DnsOverride);
    
    // DHCP resources
    registry.register(ResourceTypes.SERVICE_DHCP_RANGE, DhcpRange);
    registry.register(ResourceTypes.SERVICE_DHCP_STATIC, DhcpStaticMapping);
    
    return registry;
  }
  
  /**
   * Create resources from configuration
   */
  createFromConfig(config: ResourceConfig[]): Resource[] {
    const resources: Resource[] = [];
    
    for (const cfg of config) {
      try {
        const resource = this.create(
          cfg.type,
          cfg.name,
          cfg.properties,
          cfg.dependencies
        );
        resources.push(resource);
      } catch (error) {
        throw new Error(`Failed to create resource '${cfg.name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return resources;
  }
  
  /**
   * Validate all resources
   */
  validateAll(): ValidationReport {
    const report: ValidationReport = {
      valid: true,
      resources: []
    };
    
    for (const resource of this.instances.values()) {
      const result = resource.validate();
      report.resources.push({
        id: resource.id,
        name: resource.name,
        type: resource.type,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings
      });
      
      if (!result.valid) {
        report.valid = false;
      }
    }
    
    return report;
  }
  
  /**
   * Build dependency graph
   */
  buildDependencyGraph(): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: []
    };
    
    // Add all resources as nodes
    for (const resource of this.instances.values()) {
      graph.nodes.set(resource.id, {
        id: resource.id,
        resource,
        dependsOn: resource.dependencies,
        dependedBy: []
      });
    }
    
    // Build edges and reverse dependencies
    for (const node of graph.nodes.values()) {
      for (const depId of node.dependsOn) {
        const depNode = graph.nodes.get(depId);
        if (depNode) {
          depNode.dependedBy.push(node.id);
          graph.edges.push({
            from: node.id,
            to: depId
          });
        }
      }
    }
    
    return graph;
  }
}

/**
 * Resource configuration interface
 */
export interface ResourceConfig {
  type: string;
  name: string;
  properties: Record<string, any>;
  dependencies?: string[];
}

/**
 * Validation report interface
 */
export interface ValidationReport {
  valid: boolean;
  resources: ResourceValidation[];
}

/**
 * Resource validation interface
 */
export interface ResourceValidation {
  id: string;
  name: string;
  type: string;
  valid: boolean;
  errors: any[];
  warnings?: any[];
}

/**
 * Dependency graph interfaces
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  resource: Resource;
  dependsOn: string[];
  dependedBy: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
}
