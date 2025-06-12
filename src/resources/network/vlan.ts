import { z } from 'zod';
import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState } from '../legacy/base.js';

/**
 * VLAN properties interface
 */
export interface VlanProperties extends ResourceProperties {
  tag: number;
  device: string;  // Changed from 'interface' to match API (e.g., 'igc3')
  description?: string;
  pcp?: string;    // Priority Code Point (0-7) as string for API
  // Note: MTU and advanced options not supported in current API
}

/**
 * OPNSense VLAN Resource
 */
export class Vlan extends Resource {
  // Required abstract implementations
  readonly type = 'opnsense:network:vlan';
  
  readonly schema = z.object({
    name: z.string().optional(),
    enabled: z.boolean().optional()
  });

  constructor(
    name: string,
    properties: VlanProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:network:vlan', name, properties, dependencies);
    
    // Ensure tag and pcp are properly formatted
    if (properties.tag) {
      this.properties.tag = properties.tag;
    }
    if (properties.pcp === undefined) {
      this.properties.pcp = '';
    }
  }

  /**
   * Validate VLAN configuration
   */
  validate(): ValidationResult {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'tag',
      'device',
      'description'
    ]);
    errors.push(...requiredErrors);

    // Validate VLAN tag
    if (this.properties.tag !== undefined) {
      const tag = this.properties.tag;
      if (!Number.isInteger(tag) || tag < 1 || tag > 4094) {
        errors.push({
          path: 'tag',
          message: 'VLAN tag must be an integer between 1 and 4094',
          code: 'INVALID_VLAN_TAG'
        });
      }
    }

    // Validate PCP (Priority Code Point)
    if (this.properties.pcp && this.properties.pcp !== '') {
      const pcp = parseInt(this.properties.pcp, 10);
      if (isNaN(pcp) || pcp < 0 || pcp > 7) {
        errors.push({
          path: 'pcp',
          message: 'Priority Code Point must be between 0 and 7',
          code: 'INVALID_PCP'
        });
      }
    }

    // Note: MTU configuration removed as it's not supported in current API

    // Validate device exists
    if (this.properties.device) {
      const validInterfaces = this.getValidInterfaces();
      if (!validInterfaces.includes(this.properties.device)) {
        warnings.push({
          path: 'device',
          message: `Device '${this.properties.device}' may not exist. Valid interfaces include: ${validInterfaces.join(', ')}`,
          code: 'UNKNOWN_DEVICE'
        });
      }
    }

    // Note: Advanced options removed as they're not supported in current API

    // Warnings
    if (this.properties.tag === 1) {
      warnings.push({
        path: 'tag',
        message: 'VLAN tag 1 is typically reserved for the default VLAN',
        code: 'RESERVED_VLAN'
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
   * Based on actual API discovery from OPNsense web UI
   */
  toApiPayload(): any {
    return {
      vlan: {
        device: this.properties.device,
        tag: String(this.properties.tag),
        pcp: this.properties.pcp || '',
        description: this.properties.description || `VLAN ${this.properties.tag}`
      }
    };
  }

  /**
   * Update resource from API response
   */
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.properties._uuid = response.uuid;
    }

    // Store the VLAN interface name
    this.outputs.interface = this.getInterfaceName();

    if (response.result) {
      this.outputs.result = response.result;
      
      // Update state based on response
      if (response.result === 'saved' || response.result === 'created') {
        this.state = ResourceState.Created;
      } else if (response.result === 'deleted') {
        this.state = ResourceState.Deleted;
      }
    }
  }

  /**
   * Get the VLAN interface name
   */
  getInterfaceName(): string {
    return `${this.properties.device}.${this.properties.tag}`;
  }

  /**
   * Get valid parent interfaces
   * Note: In a real implementation, this would query the actual interfaces
   */
  private getValidInterfaces(): string[] {
    return [
      'igc0', 'igc1', 'igc2', 'igc3', // Intel interfaces
      'em0', 'em1', 'em2', 'em3',     // Intel legacy
      'vmx0', 'vmx1', 'vmx2', 'vmx3', // VMware
      'vtnet0', 'vtnet1', 'vtnet2',   // VirtIO
      'lagg0', 'lagg1',               // Link aggregation
      'bridge0', 'bridge1'            // Bridges
    ];
  }

  /**
   * Check if this VLAN can be created on the specified interface
   */
  canCreateOn(parentInterface: string): boolean {
    // Check if parent interface supports VLANs
    const vlanCapableInterfaces = [
      'igc', 'em', 'vmx', 'vtnet', 'lagg', 'ix', 'ixl'
    ];
    
    return vlanCapableInterfaces.some(prefix => 
      parentInterface.startsWith(prefix)
    );
  }

  /**
   * Get resource summary with VLAN-specific details
   */
  getSummary(): any {
    const summary = super.getSummary();
    return {
      ...summary,
      vlan: {
        tag: this.properties.tag,
        device: this.properties.device,
        vlanInterface: this.getInterfaceName(),
        pcp: this.properties.pcp,
        description: this.properties.description
      }
    };
  }

  /**
   * Check if this VLAN conflicts with another
   */
  conflictsWith(other: Vlan): boolean {
    // VLANs conflict if they have the same tag on the same device
    return this.properties.tag === other.properties.tag &&
           this.properties.device === other.properties.device;
  }

  /**
   * Get IP configuration commands for this VLAN
   * This would be used after VLAN creation to assign IPs
   */
  getIpConfigCommands(ipAddress: string, subnet: number): any {
    return {
      interface: this.getInterfaceName(),
      ipv4: {
        type: 'static',
        address: ipAddress,
        subnet: subnet
      }
    };
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
    return ['interfaces.vlan.manage'];
  }
}
