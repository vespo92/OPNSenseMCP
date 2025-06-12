// OPNSense Network Resources Implementation

import { Resource, ValidationResult } from '../base.js';

/**
 * VLAN Properties
 */
export interface VlanProperties {
  interface: string;
  tag: number;
  description?: string;
  pcp?: number; // Priority Code Point (0-7)
}

/**
 * OPNSense VLAN Resource
 */
export class Vlan extends Resource {
  constructor(name: string, properties: VlanProperties) {
    super('opnsense:network:vlan', name, properties);
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    const props = this.properties as VlanProperties;
    
    if (!props.interface) {
      errors.push('Interface is required');
    }
    
    if (!props.tag || props.tag < 1 || props.tag > 4094) {
      errors.push('VLAN tag must be between 1 and 4094');
    }
    
    if (props.pcp !== undefined && (props.pcp < 0 || props.pcp > 7)) {
      errors.push('Priority Code Point must be between 0 and 7');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  toApiPayload(): any {
    const props = this.properties as VlanProperties;
    
    return {
      vlan: {
        if: props.interface,
        tag: props.tag.toString(),
        descr: props.description || `VLAN ${props.tag}`,
        pcp: (props.pcp || 0).toString()
      }
    };
  }
  
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.outputs.vlanif = response.vlanif; // e.g., "igc3_vlan150"
      this.outputs.tag = this.properties.tag;
    }
  }
}

/**
 * Interface Assignment Properties
 */
export interface InterfaceProperties {
  device: string; // Physical device or VLAN interface
  description?: string;
  enabled?: boolean;
  blockPrivate?: boolean;
  blockBogons?: boolean;
  // IPv4 Configuration
  ipv4Type?: 'none' | 'static' | 'dhcp';
  ipv4Address?: string;
  ipv4Subnet?: number;
  // IPv6 Configuration
  ipv6Type?: 'none' | 'static' | 'dhcp6' | 'slaac';
  ipv6Address?: string;
  ipv6Prefix?: number;
}

/**
 * OPNSense Interface Assignment Resource
 */
export class Interface extends Resource {
  constructor(name: string, properties: InterfaceProperties) {
    super('opnsense:network:interface', name, properties);
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    const props = this.properties as InterfaceProperties;
    
    if (!props.device) {
      errors.push('Device is required');
    }
    
    // Validate IPv4 configuration
    if (props.ipv4Type === 'static') {
      if (!props.ipv4Address) {
        errors.push('IPv4 address is required for static configuration');
      }
      if (!props.ipv4Subnet || props.ipv4Subnet < 0 || props.ipv4Subnet > 32) {
        errors.push('IPv4 subnet must be between 0 and 32');
      }
    }
    
    // Validate IPv6 configuration
    if (props.ipv6Type === 'static') {
      if (!props.ipv6Address) {
        errors.push('IPv6 address is required for static configuration');
      }
      if (!props.ipv6Prefix || props.ipv6Prefix < 0 || props.ipv6Prefix > 128) {
        errors.push('IPv6 prefix must be between 0 and 128');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  toApiPayload(): any {
    const props = this.properties as InterfaceProperties;
    
    const payload: any = {
      interface: {
        if: props.device,
        descr: props.description || this.name,
        enable: props.enabled !== false ? '1' : '0',
        blockpriv: props.blockPrivate ? '1' : '0',
        blockbogons: props.blockBogons ? '1' : '0'
      }
    };
    
    // IPv4 configuration
    if (props.ipv4Type) {
      payload.interface.ipaddr = props.ipv4Type;
      if (props.ipv4Type === 'static') {
        payload.interface.ipaddr = props.ipv4Address;
        payload.interface.subnet = props.ipv4Subnet;
      }
    }
    
    // IPv6 configuration
    if (props.ipv6Type) {
      payload.interface.ipaddrv6 = props.ipv6Type;
      if (props.ipv6Type === 'static') {
        payload.interface.ipaddrv6 = props.ipv6Address;
        payload.interface.subnetv6 = props.ipv6Prefix;
      }
    }
    
    return payload;
  }
  
  fromApiResponse(response: any): void {
    if (response.interface) {
      this.outputs.name = this.name;
      this.outputs.device = response.interface.if;
      if (response.interface.ipaddr) {
        this.outputs.ipv4Address = response.interface.ipaddr;
      }
      if (response.interface.ipaddrv6) {
        this.outputs.ipv6Address = response.interface.ipaddrv6;
      }
    }
  }
}

/**
 * Static Route Properties
 */
export interface StaticRouteProperties {
  network: string;
  gateway: string;
  interface?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * OPNSense Static Route Resource
 */
export class StaticRoute extends Resource {
  constructor(name: string, properties: StaticRouteProperties) {
    super('opnsense:network:route', name, properties);
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    const props = this.properties as StaticRouteProperties;
    
    if (!props.network) {
      errors.push('Network is required');
    }
    
    if (!props.gateway) {
      errors.push('Gateway is required');
    }
    
    // Validate network format
    if (props.network && !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(props.network)) {
      errors.push('Network must be in CIDR format (e.g., 192.168.1.0/24)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  toApiPayload(): any {
    const props = this.properties as StaticRouteProperties;
    
    return {
      route: {
        network: props.network,
        gateway: props.gateway,
        interface: props.interface || '',
        descr: props.description || this.name,
        disabled: props.disabled ? '1' : '0'
      }
    };
  }
  
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
    }
  }
}

/**
 * NAT Rule Properties
 */
export interface NatRuleProperties {
  interface: string;
  source: string;
  destination?: string;
  target?: string;
  targetPort?: string;
  protocol?: string;
  description?: string;
  noNat?: boolean; // For NAT exclusions
}

/**
 * OPNSense NAT Rule Resource
 */
export class NatRule extends Resource {
  constructor(name: string, properties: NatRuleProperties) {
    super('opnsense:network:nat', name, properties);
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    const props = this.properties as NatRuleProperties;
    
    if (!props.interface) {
      errors.push('Interface is required');
    }
    
    if (!props.source) {
      errors.push('Source is required');
    }
    
    if (!props.noNat && !props.target) {
      errors.push('Target is required for NAT rules');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  toApiPayload(): any {
    const props = this.properties as NatRuleProperties;
    
    return {
      rule: {
        interface: props.interface,
        source: props.source,
        destination: props.destination || 'any',
        target: props.noNat ? '' : props.target,
        target_port: props.targetPort || '',
        protocol: props.protocol || 'any',
        descr: props.description || this.name,
        no_nat: props.noNat ? '1' : '0'
      }
    };
  }
  
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
    }
  }
}