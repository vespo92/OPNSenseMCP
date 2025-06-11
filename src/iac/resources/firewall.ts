// OPNSense Firewall Rule Resource Implementation

import { Resource, ValidationResult } from '../base.js';

/**
 * Firewall rule properties matching OPNSense API
 */
export interface FirewallRuleProperties {
  interface: string;
  direction: 'in' | 'out';
  action: 'pass' | 'block' | 'reject';
  protocol: string;
  source?: string;
  sourcePort?: string;
  destination?: string;
  destinationPort?: string;
  description?: string;
  enabled?: boolean;
  log?: boolean;
  quick?: boolean;
}

/**
 * OPNSense Firewall Rule Resource
 */
export class FirewallRule extends Resource {
  constructor(name: string, properties: FirewallRuleProperties) {
    super('opnsense:firewall:rule', name, properties);
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    const props = this.properties as FirewallRuleProperties;
    
    // Required fields
    if (!props.interface) {
      errors.push('Interface is required');
    }
    
    if (!props.direction || !['in', 'out'].includes(props.direction)) {
      errors.push('Direction must be "in" or "out"');
    }
    
    if (!props.action || !['pass', 'block', 'reject'].includes(props.action)) {
      errors.push('Action must be "pass", "block", or "reject"');
    }
    
    if (!props.protocol) {
      errors.push('Protocol is required');
    }
    
    // Validate port numbers
    const validatePort = (port: string | undefined, field: string) => {
      if (port && !/^\d+(-\d+)?$/.test(port)) {
        errors.push(`${field} must be a number or range (e.g., "80" or "8080-8090")`);
      }
    };
    
    validatePort(props.sourcePort, 'Source port');
    validatePort(props.destinationPort, 'Destination port');
    
    // Validate IP addresses/networks
    const validateAddress = (addr: string | undefined, field: string) => {
      if (addr && addr !== 'any') {
        // Simple validation - could be enhanced
        if (!/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(addr) && 
            !addr.startsWith('$')) { // Allow aliases starting with $
          errors.push(`${field} must be an IP address, network, or "any"`);
        }
      }
    };
    
    validateAddress(props.source, 'Source');
    validateAddress(props.destination, 'Destination');
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  toApiPayload(): any {
    const props = this.properties as FirewallRuleProperties;
    
    return {
      rule: {
        enabled: props.enabled !== false ? '1' : '0',
        action: props.action,
        interface: props.interface,
        direction: props.direction,
        ipprotocol: 'inet', // IPv4 by default
        protocol: props.protocol,
        source_net: props.source || 'any',
        source_port: props.sourcePort || '',
        destination_net: props.destination || 'any',
        destination_port: props.destinationPort || '',
        description: props.description || this.name,
        log: props.log ? '1' : '0',
        quick: props.quick !== false ? '1' : '0'
      }
    };
  }
  
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.outputs.sequence = response.sequence;
    }
    
    // Map API response back to properties
    if (response.rule) {
      const rule = response.rule;
      this.properties.enabled = rule.enabled === '1';
      this.properties.log = rule.log === '1';
      this.properties.quick = rule.quick === '1';
    }
  }
}

/**
 * Firewall rule presets for common scenarios
 */
export class FirewallRulePresets {
  static readonly ALLOW_WEB = {
    name: 'allow-web',
    properties: {
      direction: 'in' as const,
      action: 'pass' as const,
      protocol: 'tcp',
      source: 'any',
      destinationPort: '80,443',
      description: 'Allow HTTP and HTTPS traffic'
    }
  };
  
  static readonly ALLOW_SSH = {
    name: 'allow-ssh',
    properties: {
      direction: 'in' as const,
      action: 'pass' as const,
      protocol: 'tcp',
      source: 'any',
      destinationPort: '22',
      description: 'Allow SSH access'
    }
  };
  
  static readonly ALLOW_MINECRAFT = {
    name: 'allow-minecraft',
    properties: {
      direction: 'in' as const,
      action: 'pass' as const,
      protocol: 'tcp',
      source: 'any',
      destinationPort: '25565',
      description: 'Allow Minecraft server'
    }
  };
  
  static readonly BLOCK_ALL = {
    name: 'block-all',
    properties: {
      direction: 'in' as const,
      action: 'block' as const,
      protocol: 'any',
      source: 'any',
      destination: 'any',
      description: 'Block all traffic',
      quick: true
    }
  };
  
  /**
   * Create a firewall rule from a preset
   */
  static createFromPreset(
    presetName: string,
    interface_: string,
    overrides?: Partial<FirewallRuleProperties>
  ): FirewallRule {
    const presets: Record<string, any> = {
      'allow-web': FirewallRulePresets.ALLOW_WEB,
      'allow-ssh': FirewallRulePresets.ALLOW_SSH,
      'allow-minecraft': FirewallRulePresets.ALLOW_MINECRAFT,
      'block-all': FirewallRulePresets.BLOCK_ALL
    };
    
    const preset = presets[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    
    return new FirewallRule(preset.name, {
      ...preset.properties,
      interface: interface_,
      ...overrides
    });
  }
}

/**
 * Firewall Alias Resource (for named IP/port groups)
 */
export interface FirewallAliasProperties {
  type: 'host' | 'network' | 'port' | 'url';
  content: string | string[];
  description?: string;
  updateFreq?: number; // For URL type
}

export class FirewallAlias extends Resource {
  constructor(name: string, properties: FirewallAliasProperties) {
    super('opnsense:firewall:alias', name, properties);
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    const props = this.properties as FirewallAliasProperties;
    
    if (!props.type || !['host', 'network', 'port', 'url'].includes(props.type)) {
      errors.push('Type must be "host", "network", "port", or "url"');
    }
    
    if (!props.content || 
        (Array.isArray(props.content) && props.content.length === 0)) {
      errors.push('Content is required');
    }
    
    // Type-specific validation
    if (props.type === 'port') {
      const ports = Array.isArray(props.content) ? props.content : [props.content];
      for (const port of ports) {
        if (!/^\d+(-\d+)?$/.test(port)) {
          errors.push(`Invalid port format: ${port}`);
        }
      }
    }
    
    if (props.type === 'url' && !props.updateFreq) {
      errors.push('Update frequency is required for URL aliases');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  toApiPayload(): any {
    const props = this.properties as FirewallAliasProperties;
    const content = Array.isArray(props.content) 
      ? props.content.join('\n') 
      : props.content;
    
    return {
      alias: {
        name: this.name,
        type: props.type,
        content,
        description: props.description || this.name,
        ...(props.type === 'url' && { updatefreq: props.updateFreq })
      }
    };
  }
  
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.outputs.name = this.name;
    }
  }
}