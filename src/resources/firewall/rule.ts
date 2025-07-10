// Firewall Rule Resource Implementation - FIXED VERSION
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

    // Normalize interface name
    const normalizedInterface = this.normalizeInterface(rule.interface);
    console.log(`Normalizing interface: ${rule.interface} -> ${normalizedInterface}`);

    // Prepare rule data - try simple string format first
    const ruleData = {
      enabled: rule.enabled || '1',
      action: rule.action,
      quick: rule.quick || '1',
      interface: normalizedInterface,
      direction: rule.direction,
      ipprotocol: rule.ipprotocol || 'inet',
      protocol: rule.protocol,
      source_net: rule.source_net,
      source_not: '0',
      source_port: rule.source_port || '',
      destination_net: rule.destination_net,
      destination_not: '0',
      destination_port: rule.destination_port || '',
      gateway: '',  // Empty string for default gateway
      log: rule.log || '0',
      description: rule.description || '',
      category: rule.category || ''
    };

    // Add the rule
    const response = await this.client.post('/firewall/filter/addRule', { rule: ruleData });
    
    // Log response for debugging
    console.log('Firewall rule creation response:', JSON.stringify(response, null, 2));
    
    // Check various response formats
    const uuid = response.uuid || response.result || response.id;
    
    if (uuid && uuid !== 'failed') {
      // Apply changes
      await this.applyChanges();
      return { uuid, success: true };
    }
    
    // If UUID is "failed" or missing, check for validation errors
    if (response.validations) {
      const errors = Object.entries(response.validations)
        .map(([field, error]: [string, any]) => `${field}: ${error}`)
        .join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }
    
    // Check if response has an error message
    if (response.message || response.error) {
      throw new Error(`Failed to create firewall rule: ${response.message || response.error}`);
    }

    throw new Error(`Failed to create firewall rule - unexpected response: ${JSON.stringify(response)}`);
  }
  /**
   * Format a value as OPNsense expects (object with value/selected)
   */
  private formatSelection(value: string): any {
    if (!value || value === '') {
      return { '': { value: 'default', selected: 1 } };
    }
    
    // Special handling for different field types
    const fieldMappings: Record<string, Record<string, any>> = {
      // Actions - lowercase keys
      'pass': { 'pass': { value: 'Pass', selected: 1 } },
      'block': { 'block': { value: 'Block', selected: 1 } },
      'reject': { 'reject': { value: 'Reject', selected: 1 } },
      
      // Directions - lowercase keys  
      'in': { 'in': { value: 'in', selected: 1 } },
      'out': { 'out': { value: 'out', selected: 1 } },
      
      // Protocols - exact case
      'any': { 'any': { value: 'any', selected: 1 } },
      'tcp': { 'TCP': { value: 'TCP', selected: 1 } },
      'udp': { 'UDP': { value: 'UDP', selected: 1 } },
      'icmp': { 'ICMP': { value: 'ICMP', selected: 1 } },
      
      // IP protocols
      'inet': { 'inet': { value: 'IPv4', selected: 1 } },
      'inet6': { 'inet6': { value: 'IPv6', selected: 1 } },
      'inet46': { 'inet46': { value: 'IPv4+IPv6', selected: 1 } },
      
      // Interfaces - use internal names
      'lan': { 'lan': { value: 'LAN', selected: 1 } },
      'wan': { 'wan': { value: 'WAN', selected: 1 } },
      'opt1': { 'opt1': { value: 'OPT1', selected: 1 } },
      'opt2': { 'opt2': { value: 'OPT2', selected: 1 } },
      'opt3': { 'opt3': { value: 'OPT3', selected: 1 } },
      'opt4': { 'opt4': { value: 'OPT4', selected: 1 } },
      'opt5': { 'opt5': { value: 'OPT5', selected: 1 } },
      'opt6': { 'opt6': { value: 'OPT6', selected: 1 } },
      
      // VLAN interfaces - map to opt interfaces
      'igc3_vlan6': { 'opt6': { value: 'opt6', selected: 1 } },
      'igc2_vlan4': { 'opt4': { value: 'opt4', selected: 1 } },
      'igc2_vlan2': { 'opt2': { value: 'opt2', selected: 1 } },
      
      // DMZ specific
      'dmz': { 'opt6': { value: 'opt6', selected: 1 } }
    };
    
    // Check if we have a specific mapping
    const lowerValue = value.toLowerCase();
    if (fieldMappings[lowerValue]) {
      return fieldMappings[lowerValue];
    }
    
    // Default format if no specific mapping
    return {
      [value]: {
        value: value,
        selected: 1
      }
    };
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

    // Format fields properly
    const formattedRule = {
      ...updatedRule,
      action: this.formatSelection(updatedRule.action),
      interface: this.formatSelection(updatedRule.interface),
      direction: this.formatSelection(updatedRule.direction),
      ipprotocol: this.formatSelection(updatedRule.ipprotocol),
      protocol: this.formatSelection(updatedRule.protocol),
      gateway: this.formatSelection(updatedRule.gateway || '')
    };

    await this.client.post(`/firewall/filter/setRule/${uuid}`, { rule: formattedRule });
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
   * Normalize interface name for firewall rules
   * Converts friendly names to internal names
   */
  private normalizeInterface(interfaceName: string): string {
    // Common interface mappings - MUST match your actual OPNsense configuration!
    const interfaceMappings: Record<string, string> = {
      'lan': 'lan',
      'wan': 'wan',
      // DMZ is on opt8, not opt6!
      'dmz': 'opt8',
      'opt8': 'opt8',
      'igc3_vlan6': 'opt8',  // VLAN 6 is mapped to opt8
      // Guest is on opt6
      'guest': 'opt6',
      'opt6': 'opt6',
      'igc2_vlan4': 'opt6',  // Assuming VLAN 4 is Guest
      // IoT is on opt4
      'iot': 'opt4',
      'opt4': 'opt4',
      'igc2_vlan2': 'opt4'   // Assuming VLAN 2 is IoT
    };
    
    // Check if we have a mapping
    const normalized = interfaceMappings[interfaceName.toLowerCase()];
    if (normalized) {
      return normalized;
    }
    
    // Return as-is if no mapping found
    return interfaceName;
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
    const protocolLower = rule.protocol?.toLowerCase();
    if (rule.source_port && rule.source_port !== '' && !['tcp', 'udp'].includes(protocolLower)) {
      errors.push('Source port can only be specified for TCP or UDP');
    }

    if (rule.destination_port && rule.destination_port !== '' && !['tcp', 'udp'].includes(protocolLower)) {
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