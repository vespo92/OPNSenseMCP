// Firewall Rule Resource Implementation
import { OPNSenseAPIClient } from '../../api/client.js';

export interface FirewallRule {
  uuid?: string;
  enabled: string;              // '0' or '1'
  sequence?: string;            // Rule order/priority
  action: string;               // 'pass', 'block', 'reject'
  quick?: string;               // '0' or '1' - stop processing after match
  interface: string;            // Interface name or alias
  direction: string;            // 'in' or 'out'
  ipprotocol: string;           // 'inet' (IPv4), 'inet6' (IPv6), or 'inet46' (both)
  protocol: string;             // 'any', 'tcp', 'udp', 'icmp', etc.
  source_net: string;           // Source address/network or alias
  source_port?: string;         // Source port or port range
  destination_net: string;      // Destination address/network or alias  
  destination_port?: string;    // Destination port or port range
  gateway?: string;             // Optional gateway for policy routing
  log?: string;                 // '0' or '1' - log packets matching this rule
  description?: string;         // Rule description
  category?: string;            // Rule category for organization
}

export class FirewallRuleResource {
  private client: OPNSenseAPIClient;

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
  }

  /**
   * List all firewall rules
   */
  async list(): Promise<FirewallRule[]> {
    const response = await this.client.post('/firewall/filter/searchRule', {
      current: 1,
      rowCount: 1000,
      sort: {},
      searchPhrase: ''
    });
    return response.rows || [];
  }

  /**
   * Get a specific firewall rule by UUID
   */
  async get(uuid: string): Promise<FirewallRule | null> {
    const response = await this.client.get(`/firewall/filter/getRule/${uuid}`);
    if (response?.rule) {
      return { uuid, ...response.rule };
    }
    return null;
  }

  /**
   * Find rules by description
   */
  async findByDescription(description: string): Promise<FirewallRule[]> {
    const rules = await this.list();
    return rules.filter(r => 
      r.description?.toLowerCase().includes(description.toLowerCase())
    );
  }

  /**
   * Create a new firewall rule
   */
  async create(rule: FirewallRule): Promise<{ uuid: string; success: boolean }> {
    // Validate rule
    const errors = this.validateRule(rule);
    if (errors.length > 0) {
      throw new Error(`Invalid rule: ${errors.join(', ')}`);
    }

    // Prepare rule data with defaults
    const ruleData = {
      enabled: rule.enabled || '1',
      action: rule.action,
      quick: rule.quick || '1',
      interface: rule.interface,
      direction: rule.direction,
      ipprotocol: rule.ipprotocol || 'inet',
      protocol: rule.protocol,
      source_net: rule.source_net,
      source_port: rule.source_port || '',
      destination_net: rule.destination_net,
      destination_port: rule.destination_port || '',
      gateway: rule.gateway || '',
      log: rule.log || '0',
      description: rule.description || '',
      category: rule.category || ''
    };

    // Add the rule
    const response = await this.client.post('/firewall/filter/addRule', { rule: ruleData });
    
    if (response.uuid) {
      // Apply changes
      await this.applyChanges();
      return { uuid: response.uuid, success: true };
    }

    throw new Error('Failed to create firewall rule');
  }

  /**
   * Update a firewall rule
   */
  async update(uuid: string, updates: Partial<FirewallRule>): Promise<boolean> {
    const existing = await this.get(uuid);
    if (!existing) {
      throw new Error(`Firewall rule ${uuid} not found`);
    }

    const updatedRule = {
      ...existing,
      ...updates,
      uuid: undefined // Remove UUID from data
    };

    await this.client.post(`/firewall/filter/setRule/${uuid}`, { rule: updatedRule });
    await this.applyChanges();
    return true;
  }

  /**
   * Delete a firewall rule
   */
  async delete(uuid: string): Promise<boolean> {
    const response = await this.client.post(`/firewall/filter/delRule/${uuid}`);
    if (response.result === 'deleted') {
      await this.applyChanges();
      return true;
    }
    throw new Error(`Failed to delete rule ${uuid}`);
  }

  /**
   * Toggle rule enabled/disabled
   */
  async toggle(uuid: string): Promise<boolean> {
    const rule = await this.get(uuid);
    if (!rule) {
      throw new Error(`Firewall rule ${uuid} not found`);
    }

    const newState = rule.enabled === '1' ? '0' : '1';
    return this.update(uuid, { enabled: newState });
  }

  /**
   * Apply firewall changes
   */
  async applyChanges(): Promise<any> {
    return this.client.post('/firewall/filter/apply');
  }

  /**
   * Get available options for rule creation
   */
  async getOptions(): Promise<any> {
    // This endpoint provides dropdowns for interfaces, protocols, etc.
    const response = await this.client.get('/firewall/filter/getRule');
    return response?.rule || {};
  }

  /**
   * Validate firewall rule
   */
  validateRule(rule: FirewallRule): string[] {
    const errors: string[] = [];

    // Required fields
    if (!rule.action || !['pass', 'block', 'reject'].includes(rule.action)) {
      errors.push('Action must be pass, block, or reject');
    }

    if (!rule.interface) {
      errors.push('Interface is required');
    }

    if (!rule.direction || !['in', 'out'].includes(rule.direction)) {
      errors.push('Direction must be in or out');
    }

    if (!rule.protocol) {
      errors.push('Protocol is required');
    }

    if (!rule.source_net) {
      errors.push('Source network is required');
    }

    if (!rule.destination_net) {
      errors.push('Destination network is required');
    }

    // Validate ports if specified
    if (rule.source_port && !['tcp', 'udp'].includes(rule.protocol)) {
      errors.push('Source port can only be specified for TCP or UDP');
    }

    if (rule.destination_port && !['tcp', 'udp'].includes(rule.protocol)) {
      errors.push('Destination port can only be specified for TCP or UDP');
    }

    return errors;
  }

  /**
   * Create a common firewall rule preset
   */
  createPreset(preset: string, params: any = {}): Partial<FirewallRule> {
    switch (preset) {
      case 'allow-web':
        return {
          enabled: '1',
          action: 'pass',
          quick: '1',
          direction: 'in',
          ipprotocol: 'inet',
          protocol: 'tcp',
          source_net: 'any',
          destination_net: params.destination || 'any',
          destination_port: '80,443',
          description: params.description || 'Allow HTTP/HTTPS traffic'
        };

      case 'allow-ssh':
        return {
          enabled: '1',
          action: 'pass',
          quick: '1',
          direction: 'in',
          ipprotocol: 'inet',
          protocol: 'tcp',
          source_net: params.source || 'any',
          destination_net: params.destination || 'any',
          destination_port: '22',
          description: params.description || 'Allow SSH access'
        };

      case 'allow-minecraft':
        return {
          enabled: '1',
          action: 'pass',
          quick: '1',
          direction: 'in',
          ipprotocol: 'inet',
          protocol: 'tcp',
          source_net: 'any',
          destination_net: params.destination || 'any',
          destination_port: '25565',
          description: params.description || 'Allow Minecraft server'
        };

      case 'block-all':
        return {
          enabled: '1',
          action: 'block',
          quick: '1',
          direction: 'in',
          ipprotocol: 'inet',
          protocol: 'any',
          source_net: 'any',
          destination_net: 'any',
          description: params.description || 'Block all traffic'
        };

      default:
        throw new Error(`Unknown preset: ${preset}`);
    }
  }
}

export default FirewallRuleResource;
