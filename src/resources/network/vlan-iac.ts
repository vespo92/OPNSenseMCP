/**
 * VLAN Resource - IaC Implementation
 * Manages OPNSense VLAN configurations
 */

import { z } from 'zod';
import { IaCResource } from '../base.js';
import { resourceRegistry } from '../registry.js';

// VLAN properties schema
export const VlanPropertiesSchema = z.object({
  interface: z.string().describe('Physical interface (e.g., igc0, igc1)'),
  tag: z.number().min(1).max(4094).describe('VLAN tag (1-4094)'),
  description: z.string().optional().describe('VLAN description'),
  pcp: z.number().min(0).max(7).optional().default(0).describe('Priority Code Point (0-7)'),
  enabled: z.boolean().optional().default(true).describe('Enable/disable VLAN')
});

export type VlanProperties = z.infer<typeof VlanPropertiesSchema>;

export class VlanResource extends IaCResource {
  readonly type = 'opnsense:network:vlan';
  readonly schema = VlanPropertiesSchema;

  constructor(id: string, name: string, properties: VlanProperties) {
    super(id, name, properties);
  }

  /**
   * Convert to OPNSense API payload
   */
  toAPIPayload(): any {
    const props = this._properties as VlanProperties;
    return {
      vlan: {
        if: props.interface,
        tag: props.tag.toString(),
        descr: props.description || '',
        pcp: props.pcp?.toString() || '0'
      }
    };
  }

  /**
   * Update resource from API response
   */
  fromAPIResponse(response: any): void {
    if (response.vlan) {
      this._properties = {
        interface: response.vlan.if,
        tag: parseInt(response.vlan.tag),
        description: response.vlan.descr || undefined,
        pcp: response.vlan.pcp ? parseInt(response.vlan.pcp) : 0,
        enabled: true
      };
      
      // Set outputs
      this._outputs = {
        device: response.vlan.vlanif || `${response.vlan.if}_vlan${response.vlan.tag}`,
        interface: response.vlan.if,
        tag: parseInt(response.vlan.tag)
      };
    }
  }

  /**
   * Get required permissions for this resource
   */
  getRequiredPermissions(): string[] {
    return ['interfaces:vlan:edit'];
  }

  /**
   * Helper method to get the VLAN interface name
   */
  getInterfaceName(): string {
    const props = this._properties as VlanProperties;
    return this._outputs.device || `${props.interface}_vlan${props.tag}`;
  }

  /**
   * Helper method to check if this VLAN conflicts with another
   */
  conflictsWith(other: VlanResource): boolean {
    const thisProps = this._properties as VlanProperties;
    const otherProps = other._properties as VlanProperties;
    
    return thisProps.interface === otherProps.interface && 
           thisProps.tag === otherProps.tag;
  }
}

// Register the VLAN resource type
resourceRegistry.register({
  type: 'opnsense:network:vlan',
  category: 'network',
  description: 'Virtual LAN (VLAN) interface configuration',
  schema: VlanPropertiesSchema,
  factory: (id, name, properties) => new VlanResource(id, name, properties as VlanProperties),
  examples: [
    {
      name: 'Guest Network VLAN',
      description: 'Create a VLAN for guest network isolation',
      properties: {
        interface: 'igc1',
        tag: 100,
        description: 'Guest Network VLAN'
      }
    },
    {
      name: 'IoT VLAN',
      description: 'Create a VLAN for IoT devices',
      properties: {
        interface: 'igc1',
        tag: 200,
        description: 'IoT Devices VLAN',
        pcp: 1
      }
    }
  ]
});

// Export for convenience
export const createVlan = (
  id: string,
  name: string,
  properties: VlanProperties
): VlanResource => {
  return new VlanResource(id, name, properties);
};
