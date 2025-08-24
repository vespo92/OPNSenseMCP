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
  private debugMode: boolean = process.env.MCP_DEBUG === 'true' || process.env.DEBUG_FIREWALL === 'true';

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
    this.interfaceMapper = new InterfaceMapper();
  }

  /**
   * List all firewall rules
   * PRIMARY METHOD: Uses getAllRules() which reliably fetches from filter.rules.rule
   */
  async list(): Promise<FirewallRule[]> {
    if (this.debugMode) {
      console.log('[FirewallRuleResource] Starting list() operation');
    }
    
    try {
      // ALWAYS use getAllRules() as the primary method
      // The searchRule endpoint is unreliable and often returns 0 results
      const allRules = await this.getAllRules();
      
      if (this.debugMode) {
        console.log(`[FirewallRuleResource] getAllRules() returned ${allRules.length} rules`);
      }
      
      // Update cache with fetched rules
      allRules.forEach(rule => {
        if (rule.uuid) {
          this.rulesCache.set(rule.uuid, rule);
        }
      });
      
      // Sort rules by sequence if available
      allRules.sort((a, b) => {
        const seqA = parseInt(a.sequence || '0', 10);
        const seqB = parseInt(b.sequence || '0', 10);
        return seqA - seqB;
      });
      
      return allRules;
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
    if (this.debugMode) {
      console.log(`[FirewallRuleResource] Getting rule ${uuid}`);
    }
    
    try {
      const response = await this.client.get(`/firewall/filter/getRule/${uuid}`);
      if (response?.rule) {
        if (this.debugMode) {
          console.log(`[FirewallRuleResource] Rule ${uuid} found:`, response.rule);
        }
        return { uuid, ...response.rule };
      }
    } catch (error) {
      console.warn(`Could not get rule ${uuid}:`, error);
    }
    
    if (this.debugMode) {
      console.log(`[FirewallRuleResource] Rule ${uuid} not found`);
    }
    return null;
  }

  /**
   * Get all firewall rules using the get endpoint
   * This is the PRIMARY method that reliably fetches ALL rules including API-created ones
   */
  async getAllRules(): Promise<FirewallRule[]> {
    if (this.debugMode) {
      console.log('[FirewallRuleResource] Fetching all rules via /firewall/filter/get');
    }
    
    try {
      const response = await this.client.get('/firewall/filter/get');
      
      if (this.debugMode) {
        console.log('[FirewallRuleResource] /firewall/filter/get response structure:', {
          hasFilter: !!response?.filter,
          hasRules: !!response?.filter?.rules,
          hasRulesRule: !!response?.filter?.rules?.rule,
          rulesType: typeof response?.filter?.rules,
          rulesRuleType: typeof response?.filter?.rules?.rule
        });
      }
      
      // The rules are stored at filter.rules.rule as an object with UUID keys
      if (response?.filter?.rules?.rule) {
        const rulesObj = response.filter.rules.rule;
        
        // Convert object with UUIDs as keys to array
        if (typeof rulesObj === 'object' && !Array.isArray(rulesObj)) {
          const rulesArray = Object.entries(rulesObj).map(([uuid, rule]: [string, any]) => {
            // Extract simplified rule data from the complex structure
            return {
              uuid,
              enabled: rule.enabled || '0',
              sequence: rule.sequence,
              action: this.extractSelectedValue(rule.action) || 'block',
              quick: rule.quick || '1',
              interface: this.extractSelectedValue(rule.interface) || '',
              direction: this.extractSelectedValue(rule.direction) || 'in',
              ipprotocol: this.extractSelectedValue(rule.ipprotocol) || 'inet',
              protocol: this.extractSelectedValue(rule.protocol) || 'any',
              source_net: rule.source_net || 'any',
              source_port: rule.source_port || '',
              destination_net: rule.destination_net || 'any',
              destination_port: rule.destination_port || '',
              gateway: this.extractSelectedValue(rule.gateway) || '',
              log: rule.log || '0',
              description: rule.description || '',
              category: this.extractSelectedValue(rule.categories) || ''
            };
          });
          
          if (this.debugMode) {
            console.log(`[FirewallRuleResource] Converted ${rulesArray.length} rules from filter.rules.rule`);
          }
          
          return rulesArray;
        }
        
        // If already an array (unlikely), return it
        if (Array.isArray(rulesObj)) {
          if (this.debugMode) {
            console.log(`[FirewallRuleResource] Rules already in array format: ${rulesObj.length} rules`);
          }
          return rulesObj;
        }
      }
      
      // Fallback: check if rules are at filter.rules directly
      if (response?.filter?.rules && typeof response.filter.rules === 'object') {
        const rules = response.filter.rules;
        
        // Skip if it only contains 'rule' key (already handled above)
        if (Object.keys(rules).length === 1 && rules.rule) {
          return [];
        }
        
        // Convert object with UUIDs as keys to array
        const rulesArray = Object.entries(rules)
          .filter(([key]) => key.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i))
          .map(([uuid, rule]: [string, any]) => ({
            uuid,
            ...rule
          }));
        
        if (rulesArray.length > 0) {
          if (this.debugMode) {
            console.log(`[FirewallRuleResource] Found ${rulesArray.length} rules at filter.rules`);
          }
          return rulesArray;
        }
      }
    } catch (error) {
      console.warn('Could not fetch all rules via get endpoint:', error);
    }
    
    return [];
  }

  /**
   * Helper to extract selected value from OPNsense option objects
   */
  private extractSelectedValue(optionObj: any): string {
    if (!optionObj || typeof optionObj !== 'object') {
      return optionObj || '';
    }
    
    // Find the selected option
    for (const [key, value] of Object.entries(optionObj)) {
      if (value && typeof value === 'object' && (value as any).selected === 1) {
        return key;
      }
    }
    
    return '';
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
    if (this.debugMode) {
      console.log('[FirewallRuleResource] Creating rule:', rule);
    }
    
    // Ensure interface mappings are loaded
    await this.ensureInterfacesLoaded();
    
    // Map interface and protocol to OPNsense format
    const mappedRule = { ...rule };
    const originalInterface = rule.interface;
    mappedRule.interface = this.interfaceMapper.mapInterface(rule.interface);
    mappedRule.protocol = InterfaceMapper.mapProtocol(rule.protocol);
    
    if (this.debugMode) {
      console.log('[FirewallRuleResource] Interface mapping:', {
        original: originalInterface,
        mapped: mappedRule.interface
      });
      console.log('[FirewallRuleResource] Protocol mapping:', {
        original: rule.protocol,
        mapped: mappedRule.protocol
      });
    }
    
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
    if (this.debugMode) {
      console.log('[FirewallRuleResource] Sending addRule request:', { rule: ruleData });
    }
    
    const response = await this.client.post('/firewall/filter/addRule', { rule: ruleData });
    
    if (this.debugMode) {
      console.log('[FirewallRuleResource] addRule response:', response);
    }
    
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
        const refreshedRules = await this.getAllRules();
        if (this.debugMode) {
          console.log(`[FirewallRuleResource] After refresh, total rules: ${refreshedRules.length}`);
          const foundInList = refreshedRules.some(r => r.uuid === response.uuid);
          console.log(`[FirewallRuleResource] New rule ${response.uuid} found in list: ${foundInList}`);
        }
      } catch (refreshError) {
        console.warn('Could not refresh rules after creation:', refreshError);
      }
      
      // Verify the rule was created successfully
      const verifyRule = await this.get(response.uuid);
      if (verifyRule) {
        // Update cache with verified rule
        this.rulesCache.set(response.uuid, verifyRule);
        console.log(`Rule ${response.uuid} created and verified successfully`);
        
        // Double-check it appears in the list
        const allRules = await this.list();
        const inList = allRules.some(r => r.uuid === response.uuid);
        
        if (!inList) {
          console.warn(`WARNING: Rule ${response.uuid} exists individually but not in list!`);
          console.warn('This may indicate a persistence issue. Attempting additional apply...');
          
          // Try additional apply methods
          await this.forceApply();
        }
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
    if (this.debugMode) {
      console.log('[FirewallRuleResource] Starting applyChanges()');
    }
    
    try {
      // First apply the firewall changes
      const applyResponse = await this.client.post('/firewall/filter/apply');
      
      if (this.debugMode) {
        console.log('[FirewallRuleResource] apply response:', applyResponse);
      }
      
      // Add a delay to allow changes to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Save and reconfigure to ensure persistence
      // OPNsense requires both apply and reconfigure for full persistence
      try {
        // Try to reconfigure the filter service
        const reconfigureResponse = await this.client.post('/firewall/filter/reconfigure');
        console.log('Firewall filter reconfigured:', reconfigureResponse);
      } catch (reconfigError) {
        if (this.debugMode) {
          console.log('[FirewallRuleResource] reconfigure failed, trying savepoint:', reconfigError);
        }
        
        // If reconfigure fails, try the savepoint approach
        try {
          const savepointResponse = await this.client.post('/firewall/filter/savepoint');
          console.log('Firewall configuration saved via savepoint:', savepointResponse);
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
   * Force apply changes using multiple methods
   */
  async forceApply(): Promise<void> {
    if (this.debugMode) {
      console.log('[FirewallRuleResource] Starting forceApply() - trying all apply methods');
    }
    
    const applyMethods = [
      { endpoint: '/firewall/filter/apply', name: 'apply' },
      { endpoint: '/firewall/filter/reconfigure', name: 'reconfigure' },
      { endpoint: '/firewall/filter/savepoint', name: 'savepoint' },
      { endpoint: '/firewall/filter/reload', name: 'reload' },
      { endpoint: '/firewall/filter/commit', name: 'commit' }
    ];
    
    for (const method of applyMethods) {
      try {
        const response = await this.client.post(method.endpoint);
        console.log(`[FirewallRuleResource] ${method.name} succeeded:`, response);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        if (this.debugMode) {
          console.log(`[FirewallRuleResource] ${method.name} failed:`, error?.message || error);
        }
      }
    }
    
    // Final delay for all changes to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
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
   * Debug method to discover valid interface names
   */
  async debugInterfaces(): Promise<void> {
    console.log('\n[FirewallRuleResource] Discovering interfaces...');
    
    try {
      // Method 1: Get from rule options
      const options = await this.getOptions();
      if (options?.interface?.values) {
        console.log('\nAvailable interfaces from getRule:');
        Object.entries(options.interface.values).forEach(([key, value]: [string, any]) => {
          console.log(`  ${key}: ${value.value}`);
        });
      }
      
      // Method 2: Try common interface names
      const testInterfaces = [
        'lan', 'wan', 'opt1', 'opt2', 'opt3',
        'dmz', 'DMZ',
        'igc3_vlan6', 'igc3_vlan4', 'igc3_vlan2',
        'vlan6', 'vlan4', 'vlan2'
      ];
      
      console.log('\nTesting common interface names:');
      for (const iface of testInterfaces) {
        const mapped = this.interfaceMapper.mapInterface(iface);
        if (mapped !== iface) {
          console.log(`  ${iface} -> ${mapped}`);
        }
      }
      
      // Method 3: Get all current mappings
      console.log('\nCurrent interface mappings:');
      const mappings = this.interfaceMapper.getMappings();
      Object.entries(mappings).forEach(([friendly, internal]) => {
        console.log(`  ${friendly} -> ${internal}`);
      });
      
    } catch (error) {
      console.error('Error discovering interfaces:', error);
    }
  }

  /**
   * Test alternative API endpoints
   */
  async testAlternativeEndpoints(): Promise<void> {
    console.log('\n[FirewallRuleResource] Testing alternative endpoints...');
    
    const endpoints = [
      '/firewall/filter/get',
      '/firewall/filter/listRules',
      '/firewall/filter/searchRule',
      '/firewall/filter/getAllRules',
      '/firewall/filter/status',
      '/firewall/filter/info'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.client.get(endpoint);
        console.log(`\n${endpoint}:`);
        console.log('  Success - Response keys:', Object.keys(response || {}));
        
        // Check for rules in various places
        if (response?.rules) {
          console.log('  Found rules at .rules:', Array.isArray(response.rules) ? `Array(${response.rules.length})` : typeof response.rules);
        }
        if (response?.filter?.rules) {
          console.log('  Found rules at .filter.rules:', Array.isArray(response.filter.rules) ? `Array(${response.filter.rules.length})` : typeof response.filter.rules);
        }
        if (response?.rows) {
          console.log('  Found rules at .rows:', Array.isArray(response.rows) ? `Array(${response.rows.length})` : typeof response.rows);
        }
      } catch (error: any) {
        console.log(`\n${endpoint}:`);
        console.log('  Failed:', error?.message || error);
      }
    }
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

      case 'allow-nfs-tcp':
        return {
          enabled: '1',
          action: 'pass',
          quick: '1',
          direction: 'in',
          ipprotocol: 'inet',
          protocol: 'tcp',
          source_net: params.source || '10.0.6.0/24',
          destination_net: params.destination || '10.0.0.14',
          destination_port: '111,2049',
          description: params.description || 'Allow NFS TCP traffic (RPC portmapper and NFS)'
        };

      case 'allow-nfs-udp':
        return {
          enabled: '1',
          action: 'pass',
          quick: '1',
          direction: 'in',
          ipprotocol: 'inet',
          protocol: 'udp',
          source_net: params.source || '10.0.6.0/24',
          destination_net: params.destination || '10.0.0.14',
          destination_port: '111,2049',
          description: params.description || 'Allow NFS UDP traffic (RPC portmapper and NFS)'
        };

      default:
        throw new Error(`Unknown preset: ${preset}`);
    }
  }

  /**
   * Create NFS connectivity rules for DMZ to TrueNAS
   */
  async createNFSRules(params: {
    interface: string;
    sourceNetwork?: string;
    truenasIP?: string;
  }): Promise<{ tcp: string; udp: string }> {
    const sourceNetwork = params.sourceNetwork || '10.0.6.0/24';
    const truenasIP = params.truenasIP || '10.0.0.14';
    
    console.log(`\n[FirewallRuleResource] Creating NFS rules:`);
    console.log(`  Interface: ${params.interface}`);
    console.log(`  Source: ${sourceNetwork}`);
    console.log(`  Destination: ${truenasIP}`);
    
    // Create TCP rule for NFS
    const tcpRule = await this.create({
      ...this.createPreset('allow-nfs-tcp', {
        source: sourceNetwork,
        destination: truenasIP
      }),
      interface: params.interface
    } as FirewallRule);
    
    // Create UDP rule for NFS
    const udpRule = await this.create({
      ...this.createPreset('allow-nfs-udp', {
        source: sourceNetwork,
        destination: truenasIP
      }),
      interface: params.interface
    } as FirewallRule);
    
    console.log(`\nNFS Rules created:`);
    console.log(`  TCP Rule UUID: ${tcpRule.uuid}`);
    console.log(`  UDP Rule UUID: ${udpRule.uuid}`);
    
    return {
      tcp: tcpRule.uuid,
      udp: udpRule.uuid
    };
  }

  /**
   * Validate NFS connectivity
   */
  async validateNFSConnectivity(): Promise<{
    rulesExist: boolean;
    details: any;
  }> {
    console.log('\n[FirewallRuleResource] Validating NFS connectivity rules...');
    
    const rules = await this.list();
    const nfsRules = rules.filter(r => 
      r.description?.toLowerCase().includes('nfs') ||
      (r.destination_port && (r.destination_port.includes('111') || r.destination_port.includes('2049')))
    );
    
    console.log(`Found ${nfsRules.length} NFS-related rules`);
    
    const details = {
      totalRules: rules.length,
      nfsRules: nfsRules.length,
      rules: nfsRules.map(r => ({
        uuid: r.uuid,
        interface: r.interface,
        protocol: r.protocol,
        source: r.source_net,
        destination: r.destination_net,
        ports: r.destination_port,
        enabled: r.enabled === '1',
        description: r.description
      }))
    };
    
    return {
      rulesExist: nfsRules.length > 0,
      details
    };
  }
}

export default FirewallRuleResource;
