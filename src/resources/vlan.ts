// VLAN Resource Implementation
import { OPNSenseAPIClient } from '../api/client.js';

export interface VlanConfig {
  uuid?: string;
  if: string;           // Interface (e.g., 'igc3')
  tag: string;          // VLAN tag (e.g., '120')
  descr?: string;       // Description
  pcp?: string;         // Priority Code Point (default '0')
  proto?: string;       // Protocol (default '')
  vlanif?: string;      // Generated VLAN interface name
}

export class VlanResource {
  private client: OPNSenseAPIClient;

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
  }

  /**
   * List all VLANs
   */
  async list(): Promise<VlanConfig[]> {
    const response = await this.client.searchVlans();
    return response.rows || [];
  }

  /**
   * Get a specific VLAN by UUID
   */
  async get(uuid: string): Promise<VlanConfig | null> {
    const settings = await this.client.getVlanSettings();
    if (settings?.vlan?.vlan?.[uuid]) {
      return { uuid, ...settings.vlan.vlan[uuid] };
    }
    return null;
  }

  /**
   * Find VLAN by tag
   */
  async findByTag(tag: string): Promise<VlanConfig | null> {
    const vlans = await this.list();
    return vlans.find(v => v.tag === tag) || null;
  }

  /**
   * Create a new VLAN
   */
  async create(config: VlanConfig): Promise<{ uuid: string; success: boolean }> {
    // Check if VLAN tag already exists
    const existing = await this.findByTag(config.tag);
    if (existing) {
      throw new Error(`VLAN ${config.tag} already exists with UUID ${existing.uuid}`);
    }

    // Prepare VLAN data
    const vlanData = {
      if: config.if,
      tag: config.tag,
      descr: config.descr || '',
      pcp: config.pcp || '0',
      proto: config.proto || ''
    };

    // Add the VLAN
    const response = await this.client.addVlan(vlanData);
    
    if (response.uuid) {
      // Apply changes
      await this.client.applyVlanChanges();
      return { uuid: response.uuid, success: true };
    }

    throw new Error('Failed to create VLAN');
  }

  /**
   * Update a VLAN
   */
  async update(uuid: string, config: Partial<VlanConfig>): Promise<boolean> {
    const existing = await this.get(uuid);
    if (!existing) {
      throw new Error(`VLAN ${uuid} not found`);
    }

    const updatedData = {
      ...existing,
      ...config,
      uuid: undefined // Remove UUID from data
    };

    await this.client.setVlan(uuid, updatedData);
    await this.client.applyVlanChanges();
    return true;
  }

  /**
   * Delete a VLAN
   */
  async delete(uuid: string): Promise<boolean> {
    await this.client.delVlan(uuid);
    await this.client.applyVlanChanges();
    return true;
  }

  /**
   * Delete VLAN by tag
   */
  async deleteByTag(tag: string): Promise<boolean> {
    const vlan = await this.findByTag(tag);
    if (!vlan || !vlan.uuid) {
      throw new Error(`VLAN ${tag} not found`);
    }
    return this.delete(vlan.uuid);
  }

  /**
   * Get available interfaces for VLAN creation
   */
  async getAvailableInterfaces(): Promise<any> {
    const settings = await this.client.getVlanSettings();
    // Extract interface options from the first VLAN's 'if' field
    if (settings?.vlan?.vlan) {
      const firstVlan = Object.values(settings.vlan.vlan)[0] as any;
      if (firstVlan?.if) {
        return firstVlan.if;
      }
    }
    return {};
  }

  /**
   * Validate VLAN configuration
   */
  validateConfig(config: VlanConfig): string[] {
    const errors: string[] = [];

    if (!config.if) {
      errors.push('Interface is required');
    }

    if (!config.tag) {
      errors.push('VLAN tag is required');
    } else {
      const tag = parseInt(config.tag);
      if (isNaN(tag) || tag < 1 || tag > 4094) {
        errors.push('VLAN tag must be between 1 and 4094');
      }
    }

    return errors;
  }
}

export default VlanResource;
