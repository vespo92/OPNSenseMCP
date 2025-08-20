// Firewall Rule Resource Implementation
import { OPNSenseAPIClient } from '../../api/client.js';
import { InterfaceMapper } from '../../utils/interface-mapper.js';

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
  private interfaceMapper: InterfaceMapper;
  private interfacesLoaded: boolean = false;
  private rulesCache: Map<string, FirewallRule> = new Map();

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
    this.interfaceMapper = new InterfaceMapper();
  }

  /**
   * List all firewall rules
   */
  async list(): Promise<FirewallRule[]> {
    try {
      // First, try to get all rules from the filter configuration
      // This is more reliable for getting all rules including newly created ones
      const allRules = await this.getAllRules();
      
      if (allRules.length > 0) {
        // Update cache with fetched rules
        allRules.forEach(rule => {
          if (rule.uuid) {
            this.rulesCache.set(rule.uuid, rule);
          }
        });
        return allRules;
      }
      
      // Fallback to search endpoint if get method returns no rules
      const response = await this.client.post('/firewall/filter/searchRule', {
        current: 1,
        rowCount: -1,  // Get all rows (-1 means no limit in OPNsense)
        sort: {},
        searchPhrase: ''
      });
      
      // Debug logging to understand response structure
      if (process.env.MCP_DEBUG === 'true') {
        console.log('Firewall searchRule response structure:', {
          hasRows: !!response?.rows,
          rowsIsArray: Array.isArray(response?.rows),
          rowsLength: response?.rows?.length,
          responseIsArray: Array.isArray(response),
          responseKeys: response ? Object.keys(response) : []
        });
      }
      
      // Handle various response formats from OPNsense API
      if (response?.rows && Array.isArray(response.rows)) {
        // Update cache
        response.rows.forEach((rule: FirewallRule) => {
          if (rule.uuid) {
            this.rulesCache.set(rule.uuid, rule);
          }
        });
        return response.rows;
      }
      
      // Sometimes the API returns the rules directly as an array
      if (Array.isArray(response)) {
        response.forEach((rule: FirewallRule) => {
          if (rule.uuid) {
            this.rulesCache.set(rule.uuid, rule);
          }
        });
        return response;
      }
    } catch (error) {
      console.error('Error listing firewall rules:', error);
      
      // Return cached rules as last resort
      if (this.rulesCache.size > 0) {
        console.log('Returning cached rules due to API error');
        return Array.from(this.rulesCache.values());
      }
    }
    
    return [];
  }

  /**
   * Get a specific firewall rule by UUID
   */
  async get(uuid: string): Promise<FirewallRule | null> {
    try {
      const response = await this.client.get(`/firewall/filter/getRule/${uuid}`);
      if (response?.rule) {
        return { uuid, ...response.rule };
      }
    } catch (error) {
      console.warn(`Could not get rule ${uuid}:`, error);
    }
    return null;
  }

  /**
   * Get all firewall rules using the get endpoint
   * This is an alternative method to list() that fetches the entire filter configuration
   */
  async getAllRules(): Promise<FirewallRule[]> {
    try {
      const response = await this.client.get('/firewall/filter/get');
      
      if (response?.filter?.rules) {
        const rules = response.filter.rules;
        
        // Convert object with UUIDs as keys to array
        if (typeof rules === 'object' && !Array.isArray(rules)) {
          return Object.entries(rules).map(([uuid, rule]: [string, any]) => ({
            uuid,
            ...rule
          }));
        }
        
        // If already an array, return it
        if (Array.isArray(rules)) {
          return rules;
        }
      }
    } catch (error) {
      console.warn('Could not fetch all rules via get endpoint:', error);
    }
    
    return [];
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
   * Load interface mappings from API
   */
  private async ensureInterfacesLoaded(): Promise<void> {
    if (this.interfacesLoaded) return;
    
    try {
      // Get available options including interfaces
      const options = await this.client.get('/firewall/filter/getRule');
      if (options?.rule?.interface?.values) {
        this.interfaceMapper = new InterfaceMapper(options.rule.interface.values);
        this.interfacesLoaded = true;
      }
    } catch (error) {
      console.warn('Failed to load interface mappings, using defaults');
    }
  }

  /**
   * Create a new firewall rule
   */
  async create(rule: FirewallRule): Promise<{ uuid: string; success: boolean }> {
    // Ensure interface mappings are loaded
    await this.ensureInterfacesLoaded();
    
    // Map interface and protocol to OPNsense format
    const mappedRule = { ...rule };
    mappedRule.interface = this.interfaceMapper.mapInterface(rule.interface);
    mappedRule.protocol = InterfaceMapper.mapProtocol(rule.protocol);
    
    // Validate rule
    const errors = this.validateRule(mappedRule);
    if (errors.length > 0) {
      throw new Error(`Invalid rule: ${errors.join(', ')}`);
    }

    // Prepare rule data with defaults
    const ruleData = {
      enabled: mappedRule.enabled || '1',
      action: mappedRule.action,
      quick: mappedRule.quick || '1',
      interface: mappedRule.interface,
      direction: mappedRule.direction,
      ipprotocol: mappedRule.ipprotocol || 'inet',
      protocol: mappedRule.protocol,
      source_net: mappedRule.source_net,
      source_port: mappedRule.source_port || '',
      destination_net: mappedRule.destination_net,
      destination_port: mappedRule.destination_port || '',
      gateway: mappedRule.gateway || '',
      log: mappedRule.log || '0',
      description: mappedRule.description || '',
      category: mappedRule.category || ''
    };

    // Add the rule
    const response = await this.client.post('/firewall/filter/addRule', { rule: ruleData });
    
    if (response.uuid) {
      // Store in cache immediately
      const createdRule: FirewallRule = {
        uuid: response.uuid,
        ...ruleData
      };
      this.rulesCache.set(response.uuid, createdRule);
      
      // Apply changes and save configuration to persist
      await this.applyChanges();
      
      // Force a refresh of the rules to ensure consistency
      // This helps ensure the rule is properly loaded in OPNsense's internal state
      try {
        await this.getAllRules();
      } catch (refreshError) {
        console.warn('Could not refresh rules after creation:', refreshError);
      }
      
      // Verify the rule was created successfully
      const verifyRule = await this.get(response.uuid);
      if (verifyRule) {
        // Update cache with verified rule
        this.rulesCache.set(response.uuid, verifyRule);
        console.log(`Rule ${response.uuid} created and verified successfully`);
      } else {
        console.warn(`Warning: Rule ${response.uuid} was created but could not be verified immediately`);
      }
      
      return { uuid: response.uuid, success: true };
    }

    throw new Error('Failed to create firewall rule: No UUID returned');
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
   * Apply firewall changes and save configuration
   */
  async applyChanges(): Promise<any> {
    try {
      // First apply the firewall changes
      const applyResponse = await this.client.post('/firewall/filter/apply');
      
      // Add a delay to allow changes to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Save and reconfigure to ensure persistence
      // OPNsense requires both apply and reconfigure for full persistence
      try {
        // Try to reconfigure the filter service
        const reconfigureResponse = await this.client.post('/firewall/filter/reconfigure');
        console.log('Firewall filter reconfigured:', reconfigureResponse);
      } catch (reconfigError) {
        // If reconfigure fails, try the savepoint approach
        try {
          await this.client.post('/firewall/filter/savepoint');
          console.log('Firewall configuration saved via savepoint');
        } catch (savepointError) {
          console.warn('Could not save firewall configuration:', savepointError);
        }
      }
      
      // Additional delay for the reconfiguration to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return applyResponse;
    } catch (error) {
      console.error('Failed to apply firewall changes:', error);
      throw error;
    }
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

    // Normalize protocol for validation (handle both cases and TCP/UDP)
    const normalizedProtocol = rule.protocol.toLowerCase();
    const isPortAllowedProtocol = ['tcp', 'udp', 'tcp/udp'].includes(normalizedProtocol);

    // Validate ports if specified
    if (rule.source_port && !isPortAllowedProtocol) {
      errors.push('Source port can only be specified for TCP, UDP, or TCP/UDP');
    }

    if (rule.destination_port && !isPortAllowedProtocol) {
      errors.push('Destination port can only be specified for TCP, UDP, or TCP/UDP');
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
