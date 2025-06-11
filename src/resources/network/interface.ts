import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState } from '../base.js';

/**
 * Interface configuration types
 */
export type InterfaceType = 'static' | 'dhcp' | 'pppoe' | 'none';
export type InterfaceIPv6Type = 'static' | 'dhcp6' | 'slaac' | 'none';

/**
 * Interface properties
 */
export interface InterfaceProperties extends ResourceProperties {
  device: string; // Physical device (e.g., igc0, igc1.100 for VLAN)
  enabled?: boolean;
  description?: string;
  
  // IPv4 Configuration
  ipv4?: {
    type: InterfaceType;
    address?: string; // For static configuration
    subnet?: number;  // Subnet mask bits (e.g., 24 for /24)
    gateway?: string;
    
    // DHCP options
    dhcp?: {
      hostname?: string;
      rejectFrom?: string[];
      defaultGateway?: boolean;
    };
  };
  
  // IPv6 Configuration
  ipv6?: {
    type: InterfaceIPv6Type;
    address?: string;
    subnet?: number;
    gateway?: string;
    
    // DHCPv6 options
    dhcp6?: {
      prefixInterface?: string;
      prefixId?: string;
      sendPrefix?: boolean;
    };
  };
  
  // Advanced options
  mtu?: number;
  mss?: number;
  spoofmac?: string;
  blockPrivate?: boolean;
  blockBogons?: boolean;
}

/**
 * OPNSense Interface Resource
 */
export class Interface extends Resource {
  constructor(
    name: string,
    properties: InterfaceProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:network:interface', name, properties, dependencies);
  }

  /**
   * Validate interface configuration
   */
  validate(): ValidationResult {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, ['device']);
    errors.push(...requiredErrors);

    // Validate IPv4 configuration
    if (this.properties.ipv4) {
      const ipv4Errors = this.validateIpv4Config();
      errors.push(...ipv4Errors);
    }

    // Validate IPv6 configuration
    if (this.properties.ipv6) {
      const ipv6Errors = this.validateIpv6Config();
      errors.push(...ipv6Errors);
    }

    // Validate MTU
    if (this.properties.mtu !== undefined) {
      const mtu = this.properties.mtu;
      if (!Number.isInteger(mtu) || mtu < 576 || mtu > 9000) {
        errors.push({
          property: 'mtu',
          message: 'MTU must be an integer between 576 and 9000',
          code: 'INVALID_MTU'
        });
      }
    }

    // Validate MSS
    if (this.properties.mss !== undefined) {
      const mss = this.properties.mss;
      if (!Number.isInteger(mss) || mss < 536 || mss > 65495) {
        errors.push({
          property: 'mss',
          message: 'MSS must be an integer between 536 and 65495',
          code: 'INVALID_MSS'
        });
      }
    }

    // Validate MAC address
    if (this.properties.spoofmac) {
      const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
      if (!macRegex.test(this.properties.spoofmac)) {
        errors.push({
          property: 'spoofmac',
          message: 'Invalid MAC address format (use XX:XX:XX:XX:XX:XX)',
          code: 'INVALID_MAC'
        });
      }
    }

    // Warnings
    if (!this.properties.ipv4 && !this.properties.ipv6) {
      warnings.push({
        property: 'ipv4/ipv6',
        message: 'Interface has no IP configuration',
        code: 'NO_IP_CONFIG'
      });
    }

    if (this.properties.device.startsWith('wan') && !this.properties.blockPrivate) {
      warnings.push({
        property: 'blockPrivate',
        message: 'Consider enabling "Block private networks" on WAN interfaces',
        code: 'WAN_SECURITY'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Convert to OPNSense API payload
   */
  toApiPayload(): any {
    const payload: any = {
      interface: {
        if: this.properties.device,
        enable: this.properties.enabled !== false ? '1' : '0',
        descr: this.properties.description || this.name
      }
    };

    // IPv4 configuration
    if (this.properties.ipv4) {
      const ipv4 = this.properties.ipv4;
      
      if (ipv4.type === 'static') {
        payload.interface.ipaddr = ipv4.address;
        payload.interface.subnet = ipv4.subnet?.toString();
        if (ipv4.gateway) {
          payload.interface.gateway = ipv4.gateway;
        }
      } else if (ipv4.type === 'dhcp') {
        payload.interface.ipaddr = 'dhcp';
        if (ipv4.dhcp?.hostname) {
          payload.interface.dhcphostname = ipv4.dhcp.hostname;
        }
      } else if (ipv4.type === 'none') {
        payload.interface.ipaddr = 'none';
      }
    }

    // IPv6 configuration
    if (this.properties.ipv6) {
      const ipv6 = this.properties.ipv6;
      
      if (ipv6.type === 'static') {
        payload.interface.ipaddrv6 = ipv6.address;
        payload.interface.subnetv6 = ipv6.subnet?.toString();
        if (ipv6.gateway) {
          payload.interface.gatewayv6 = ipv6.gateway;
        }
      } else if (ipv6.type === 'dhcp6') {
        payload.interface.ipaddrv6 = 'dhcp6';
      } else if (ipv6.type === 'slaac') {
        payload.interface.ipaddrv6 = 'slaac';
      } else if (ipv6.type === 'none') {
        payload.interface.ipaddrv6 = 'none';
      }
    }

    // Advanced options
    if (this.properties.mtu) {
      payload.interface.mtu = this.properties.mtu.toString();
    }
    if (this.properties.mss) {
      payload.interface.mss = this.properties.mss.toString();
    }
    if (this.properties.spoofmac) {
      payload.interface.spoofmac = this.properties.spoofmac;
    }
    if (this.properties.blockPrivate !== undefined) {
      payload.interface.blockpriv = this.properties.blockPrivate ? '1' : '0';
    }
    if (this.properties.blockBogons !== undefined) {
      payload.interface.blockbogons = this.properties.blockBogons ? '1' : '0';
    }

    return payload;
  }

  /**
   * Update resource from API response
   */
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.properties._uuid = response.uuid;
    }

    if (response.interface) {
      this.outputs.assignedInterface = response.interface;
    }

    if (response.result) {
      this.outputs.result = response.result;
      
      // Update state
      if (response.result === 'saved' || response.result === 'applied') {
        this.state = ResourceState.Created;
      }
    }
  }

  /**
   * Validate IPv4 configuration
   */
  private validateIpv4Config(): any[] {
    const errors = [];
    const ipv4 = this.properties.ipv4!;

    // Validate type
    const validTypes: InterfaceType[] = ['static', 'dhcp', 'pppoe', 'none'];
    if (!validTypes.includes(ipv4.type)) {
      errors.push({
        property: 'ipv4.type',
        message: `IPv4 type must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_IPV4_TYPE'
      });
    }

    // Validate static configuration
    if (ipv4.type === 'static') {
      if (!ipv4.address) {
        errors.push({
          property: 'ipv4.address',
          message: 'IPv4 address is required for static configuration',
          code: 'MISSING_IPV4_ADDRESS'
        });
      } else {
        const ipError = ValidationHelper.validateIpAddress(ipv4.address, 'ipv4.address');
        if (ipError) errors.push(ipError);
      }

      if (!ipv4.subnet) {
        errors.push({
          property: 'ipv4.subnet',
          message: 'Subnet mask is required for static configuration',
          code: 'MISSING_SUBNET'
        });
      } else if (ipv4.subnet < 0 || ipv4.subnet > 32) {
        errors.push({
          property: 'ipv4.subnet',
          message: 'Subnet must be between 0 and 32',
          code: 'INVALID_SUBNET'
        });
      }

      if (ipv4.gateway) {
        const gwError = ValidationHelper.validateIpAddress(ipv4.gateway, 'ipv4.gateway');
        if (gwError) errors.push(gwError);
      }
    }

    return errors;
  }

  /**
   * Validate IPv6 configuration
   */
  private validateIpv6Config(): any[] {
    const errors = [];
    const ipv6 = this.properties.ipv6!;

    // Validate type
    const validTypes: InterfaceIPv6Type[] = ['static', 'dhcp6', 'slaac', 'none'];
    if (!validTypes.includes(ipv6.type)) {
      errors.push({
        property: 'ipv6.type',
        message: `IPv6 type must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_IPV6_TYPE'
      });
    }

    // Validate static configuration
    if (ipv6.type === 'static') {
      if (!ipv6.address) {
        errors.push({
          property: 'ipv6.address',
          message: 'IPv6 address is required for static configuration',
          code: 'MISSING_IPV6_ADDRESS'
        });
      }

      if (!ipv6.subnet) {
        errors.push({
          property: 'ipv6.subnet',
          message: 'Subnet prefix length is required for static configuration',
          code: 'MISSING_PREFIX'
        });
      } else if (ipv6.subnet < 0 || ipv6.subnet > 128) {
        errors.push({
          property: 'ipv6.subnet',
          message: 'IPv6 prefix length must be between 0 and 128',
          code: 'INVALID_PREFIX'
        });
      }
    }

    return errors;
  }

  /**
   * Get the interface type (physical, vlan, etc.)
   */
  getInterfaceType(): string {
    const device = this.properties.device;
    
    if (device.includes('.')) {
      return 'vlan';
    } else if (device.startsWith('lagg')) {
      return 'lagg';
    } else if (device.startsWith('bridge')) {
      return 'bridge';
    } else if (device.startsWith('lo')) {
      return 'loopback';
    } else {
      return 'physical';
    }
  }

  /**
   * Check if this is a WAN interface
   */
  isWan(): boolean {
    return this.name.toLowerCase().includes('wan') || 
           this.properties.description?.toLowerCase().includes('wan') || false;
  }

  /**
   * Get network address in CIDR notation
   */
  getNetwork(): string | null {
    if (this.properties.ipv4?.type === 'static' && 
        this.properties.ipv4.address && 
        this.properties.ipv4.subnet) {
      return `${this.properties.ipv4.address}/${this.properties.ipv4.subnet}`;
    }
    return null;
  }
}
