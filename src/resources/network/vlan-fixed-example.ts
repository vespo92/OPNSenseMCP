/**
 * Example of how to fix a legacy resource
 * Copy this pattern to other resources
 */

import { Resource, ResourceState, ValidationHelper, ResourceProperties, ValidationWarning } from '../legacy/base.js';
import { z } from 'zod';

export class VlanFixed extends Resource {
  // Required abstract properties
  readonly type = 'opnsense:network:vlan';
  readonly schema = z.object({
    interface: z.string(),
    tag: z.number().min(1).max(4094),
    description: z.string().optional(),
    pcp: z.number().min(0).max(7).optional()
  });

  constructor(id: string, name: string, properties: any) {
    // Call parent with 3 arguments
    super(id, name, properties);
  }

  // Required abstract methods
  toAPIPayload(): any {
    return {
      if: this.properties.interface,
      tag: this.properties.tag.toString(),
      descr: this.properties.description || '',
      pcp: (this.properties.pcp || 0).toString()
    };
  }

  fromAPIResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
    }
    this.setState(ResourceState.Created);
  }

  getRequiredPermissions(): string[] {
    return ['interfaces', 'vlans'];
  }

  // Override validate to NOT return warnings in result
  validate(): any {
    const errors = ValidationHelper.validateRequired(
      this.properties,
      ['interface', 'tag']
    );

    // Return without warnings property
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
