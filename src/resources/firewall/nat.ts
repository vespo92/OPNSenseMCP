// NAT Rule Resource Implementation for OPNsense
// Uses SSH/CLI for NAT management since REST API doesn't support NAT operations
import { OPNSenseAPIClient } from '../../api/client.js';
import { InterfaceMapper } from '../../utils/interface-mapper.js';
import SSHExecutor from '../ssh/executor.js';
import { parseStringPromise, Builder } from 'xml2js';

// NAT Rule Types
export interface OutboundNATRule {
  uuid?: string;
  enabled?: string;              // '0' or '1'
  sequence?: string;             // Rule order/priority
  interface?: string;            // Outbound interface (e.g., 'wan')
  source?: any;                  // Source specification object
  source_net?: string;           // Source network (simplified)
  source_port?: string;          // Source port
  destination?: any;             // Destination specification object
  destination_net?: string;      // Destination network (simplified)
  destination_port?: string;     // Destination port
  target?: string;               // NAT target (IP or alias, empty for no NAT)
  targetip?: string;             // Target IP address
  targetip_subnet?: string;      // Target subnet mask
  poolopts?: string;             // Pool options
  sourceHash?: string;           // Source hash for sticky connections
  nonat?: string;                // '1' for no NAT (exception rule)
  log?: string;                  // '0' or '1'
  description?: string;          // Rule description
  created?: any;                 // Creation metadata
  updated?: any;                 // Update metadata
}

export interface PortForwardRule {
  uuid?: string;
  enabled?: string;              // '0' or '1'
  interface?: string;            // Inbound interface
  protocol?: string;             // 'tcp', 'udp', 'tcp/udp'
  source?: any;                  // Source specification
  source_net?: string;           // Source network
  source_port?: string;          // Source port  
  destination?: any;             // Destination specification
  destination_net?: string;      // External destination
  destination_port?: string;     // External port
  target?: string;               // Internal target IP
  local_port?: string;           // Internal port
  description?: string;          // Rule description
  associated_rule?: string;      // Associated filter rule
  nosync?: string;               // Disable state sync
  log?: string;                  // Enable logging
}

export interface OneToOneNATRule {
  uuid?: string;
  enabled?: string;              // '0' or '1'
  interface?: string;            // Interface
  external?: string;             // External IP address
  internal?: string;             // Internal IP address
  description?: string;          // Rule description
}

export interface NPTRule {
  uuid?: string;
  enabled?: string;              // '0' or '1'
  interface?: string;            // Interface
  source?: string;               // Source IPv6 prefix
  destination?: string;          // Destination IPv6 prefix
  description?: string;          // Rule description
}

export type NATMode = 'automatic' | 'hybrid' | 'manual' | 'disabled';

export class NATResource {
  private client: OPNSenseAPIClient;
  private interfaceMapper: InterfaceMapper;
  private sshExecutor: SSHExecutor | null = null;
  private debugMode: boolean = process.env.MCP_DEBUG === 'true' || process.env.DEBUG_NAT === 'true';
  private useSSH: boolean = false;

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
    this.interfaceMapper = new InterfaceMapper();
    
    // Check if SSH is configured
    if (process.env.OPNSENSE_SSH_HOST && process.env.OPNSENSE_SSH_USERNAME) {
      this.sshExecutor = new SSHExecutor();
      this.useSSH = true;
      if (this.debugMode) {
        console.log('[NATResource] SSH configured, using SSH/CLI for NAT management');
      }
    } else {
      if (this.debugMode) {
        console.log('[NATResource] SSH not configured, limited NAT functionality available');
      }
    }
  }

  // ==================== SSH/XML-based NAT Methods ====================

  /**
   * Get NAT configuration from config.xml via SSH
   */
  private async getNATConfigViaSSH(): Promise<any> {
    if (!this.sshExecutor) {
      throw new Error('SSH not configured. Please set OPNSENSE_SSH_HOST, OPNSENSE_SSH_USERNAME, and OPNSENSE_SSH_PASSWORD in environment variables.');
    }

    const result = await this.sshExecutor.execute('cat /conf/config.xml');
    if (!result.success) {
      throw new Error(`Failed to read config.xml: ${result.stderr}`);
    }

    try {
      const config = await parseStringPromise(result.stdout, {
        explicitArray: false,
        ignoreAttrs: true
      });
      return config.opnsense || config;
    } catch (error) {
      throw new Error(`Failed to parse config.xml: ${error}`);
    }
  }

  /**
   * Save NAT configuration to config.xml via SSH
   */
  private async saveNATConfigViaSSH(config: any): Promise<void> {
    if (!this.sshExecutor) {
      throw new Error('SSH not configured');
    }

    // Convert config back to XML
    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' }
    });
    const xml = builder.buildObject({ opnsense: config });

    // Save to temporary file and then move to config.xml
    const tempFile = `/tmp/config_nat_${Date.now()}.xml`;
    const commands = [
      // Backup current config
      'cp /conf/config.xml /conf/config.xml.backup',
      // Write new config to temp file
      `cat > ${tempFile} << 'EOF'\n${xml}\nEOF`,
      // Validate XML structure
      `xmllint --noout ${tempFile}`,
      // Replace config if valid
      `mv ${tempFile} /conf/config.xml`,
      // Reload configuration
      'configctl firmware reload',
      'configctl filter reload'
    ];

    const batch = await this.sshExecutor.executeBatch(commands, { stopOnError: true });
    if (!batch.success) {
      throw new Error(`Failed to save NAT configuration: ${batch.results.map(r => r.stderr).join('\n')}`);
    }
  }

  /**
   * Generate UUID for new rules
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ==================== Outbound NAT Methods (SSH Implementation) ====================

  /**
   * List all outbound NAT rules (SSH implementation)
   */
  async listOutboundRules(): Promise<OutboundNATRule[]> {
    if (this.debugMode) {
      console.log('[NATResource] Fetching outbound NAT rules via SSH');
    }

    if (!this.sshExecutor) {
      console.warn('[NATResource] SSH not configured, returning empty list');
      return [];
    }

    try {
      const config = await this.getNATConfigViaSSH();
      const natConfig = config.nat || {};
      const outbound = natConfig.outbound || {};
      
      if (this.debugMode) {
        console.log('[NATResource] Outbound NAT mode:', outbound.mode);
      }

      // Handle rules - they might be an array or object
      let rules: OutboundNATRule[] = [];
      if (outbound.rule) {
        if (Array.isArray(outbound.rule)) {
          rules = outbound.rule.map((rule: any) => this.normalizeOutboundRuleFromXML(rule));
        } else if (typeof outbound.rule === 'object') {
          // Single rule as object
          rules = [this.normalizeOutboundRuleFromXML(outbound.rule)];
        }
      }

      if (this.debugMode) {
        console.log(`[NATResource] Found ${rules.length} outbound NAT rules`);
      }

      return rules;
    } catch (error) {
      console.error('Failed to list outbound NAT rules:', error);
      return [];
    }
  }

  /**
   * Get current outbound NAT mode (SSH implementation)
   */
  async getOutboundMode(): Promise<NATMode> {
    if (!this.sshExecutor) {
      console.warn('[NATResource] SSH not configured, returning default mode');
      return 'automatic';
    }

    try {
      const config = await this.getNATConfigViaSSH();
      const mode = config.nat?.outbound?.mode || 'automatic';
      return mode as NATMode;
    } catch (error) {
      console.error('Failed to get outbound NAT mode:', error);
      return 'automatic';
    }
  }

  /**
   * Set outbound NAT mode (SSH implementation)
   */
  async setOutboundMode(mode: NATMode): Promise<boolean> {
    if (this.debugMode) {
      console.log(`[NATResource] Setting outbound NAT mode to: ${mode}`);
    }

    if (!this.sshExecutor) {
      throw new Error('SSH not configured. Cannot modify NAT mode.');
    }

    try {
      const config = await this.getNATConfigViaSSH();
      
      // Ensure NAT structure exists
      if (!config.nat) config.nat = {};
      if (!config.nat.outbound) config.nat.outbound = {};
      
      // Set the mode
      config.nat.outbound.mode = mode;
      
      // Save configuration
      await this.saveNATConfigViaSSH(config);
      
      return true;
    } catch (error) {
      console.error('Failed to set outbound NAT mode:', error);
      return false;
    }
  }

  /**
   * Create an outbound NAT rule (SSH implementation)
   */
  async createOutboundRule(rule: OutboundNATRule): Promise<{ uuid: string; success: boolean }> {
    if (this.debugMode) {
      console.log('[NATResource] Creating outbound NAT rule via SSH:', rule);
    }

    if (!this.sshExecutor) {
      throw new Error('SSH not configured. Cannot create NAT rules.');
    }

    try {
      const config = await this.getNATConfigViaSSH();
      
      // Ensure NAT structure exists
      if (!config.nat) config.nat = {};
      if (!config.nat.outbound) config.nat.outbound = {};
      if (!config.nat.outbound.rule) config.nat.outbound.rule = [];
      
      // Generate UUID for the new rule
      const uuid = this.generateUUID();
      
      // Build the rule XML structure
      const xmlRule: any = {
        interface: rule.interface || 'wan',
        source: {
          network: rule.source_net || 'any'
        },
        destination: rule.destination_net ? {
          network: rule.destination_net
        } : { any: '' },
        descr: rule.description || ''
      };

      // Handle no-NAT rules
      if (rule.nonat === '1' || rule.target === '') {
        xmlRule.nonat = '';
      } else if (rule.target) {
        xmlRule.target = rule.target;
      }

      // Add optional fields
      if (rule.enabled !== undefined) xmlRule.disabled = rule.enabled === '0' ? '' : undefined;
      if (rule.source_port) xmlRule.sourceport = rule.source_port;
      if (rule.destination_port) xmlRule.dstport = rule.destination_port;
      if (rule.poolopts) xmlRule.poolopts = rule.poolopts;
      if (rule.log === '1') xmlRule.log = '';

      // Ensure rule array is an array
      if (!Array.isArray(config.nat.outbound.rule)) {
        config.nat.outbound.rule = config.nat.outbound.rule ? [config.nat.outbound.rule] : [];
      }
      
      // Add the rule
      config.nat.outbound.rule.push(xmlRule);
      
      // Save configuration
      await this.saveNATConfigViaSSH(config);
      
      // Apply changes
      await this.applyNATChanges();
      
      return { uuid, success: true };
    } catch (error) {
      console.error('Failed to create outbound NAT rule:', error);
      throw error;
    }
  }

  /**
   * Delete an outbound NAT rule (SSH implementation)
   */
  async deleteOutboundRule(description: string): Promise<boolean> {
    if (!this.sshExecutor) {
      throw new Error('SSH not configured. Cannot delete NAT rules.');
    }

    try {
      const config = await this.getNATConfigViaSSH();
      
      if (!config.nat?.outbound?.rule) {
        throw new Error('No outbound NAT rules found');
      }

      // Find and remove the rule by description
      let rules = config.nat.outbound.rule;
      if (!Array.isArray(rules)) {
        rules = [rules];
      }

      const filteredRules = rules.filter((r: any) => r.descr !== description);
      
      if (filteredRules.length === rules.length) {
        throw new Error(`Rule with description "${description}" not found`);
      }

      config.nat.outbound.rule = filteredRules;
      
      // Save configuration
      await this.saveNATConfigViaSSH(config);
      
      // Apply changes
      await this.applyNATChanges();
      
      return true;
    } catch (error) {
      console.error('Failed to delete outbound NAT rule:', error);
      throw error;
    }
  }

  /**
   * Update an outbound NAT rule (placeholder for SSH implementation)
   */
  async updateOutboundRule(uuid: string, updates: Partial<OutboundNATRule>): Promise<boolean> {
    // For SSH implementation, we would need to identify rules by description or other fields
    console.warn('[NATResource] Update via SSH not fully implemented. Use delete and create instead.');
    return false;
  }

  /**
   * Toggle outbound rule enabled/disabled (placeholder for SSH implementation)
   */
  async toggleOutboundRule(uuid: string, enabled?: string): Promise<boolean> {
    console.warn('[NATResource] Toggle via SSH not fully implemented');
    return false;
  }

  /**
   * Get a specific outbound NAT rule (placeholder for SSH implementation)
   */
  async getOutboundRule(uuid: string): Promise<OutboundNATRule | null> {
    console.warn('[NATResource] Get specific rule via SSH not implemented');
    return null;
  }

  // ==================== Port Forwarding Methods (SSH/XML Implementation) ====================

  /**
   * List all port forward rules
   */
  async listPortForwards(): Promise<PortForwardRule[]> {
    if (this.debugMode) {
      console.log('[NATResource] Fetching port forward rules via SSH');
    }

    if (!this.sshExecutor) {
      console.warn('[NATResource] SSH not configured, returning empty list');
      return [];
    }

    try {
      const config = await this.getNATConfigViaSSH();
      const natConfig = config.nat || {};

      // Port forwards are stored in nat.rule (not nat.outbound.rule)
      let rules: PortForwardRule[] = [];
      if (natConfig.rule) {
        if (Array.isArray(natConfig.rule)) {
          rules = natConfig.rule.map((rule: any, index: number) =>
            this.normalizePortForwardFromXML(rule, `pf-${index}`)
          );
        } else if (typeof natConfig.rule === 'object') {
          rules = [this.normalizePortForwardFromXML(natConfig.rule, 'pf-0')];
        }
      }

      if (this.debugMode) {
        console.log(`[NATResource] Found ${rules.length} port forward rules`);
      }

      return rules;
    } catch (error) {
      console.error('Failed to list port forward rules:', error);
      return [];
    }
  }

  /**
   * Create a port forward rule
   */
  async createPortForward(rule: PortForwardRule): Promise<{ uuid: string; success: boolean }> {
    if (this.debugMode) {
      console.log('[NATResource] Creating port forward rule via SSH:', rule);
    }

    if (!this.sshExecutor) {
      throw new Error('SSH not configured. Please set OPNSENSE_SSH_HOST, OPNSENSE_SSH_USERNAME, and OPNSENSE_SSH_PASSWORD environment variables.');
    }

    try {
      const config = await this.getNATConfigViaSSH();

      // Ensure NAT structure exists
      if (!config.nat) config.nat = {};
      if (!config.nat.rule) config.nat.rule = [];

      // Generate UUID for the new rule
      const uuid = this.generateUUID();

      // Build the port forward rule XML structure
      // OPNsense port forward format in config.xml
      const xmlRule: any = {
        interface: rule.interface || 'wan',
        protocol: rule.protocol || 'tcp',
        target: rule.target,
        'local-port': rule.local_port || rule.destination_port,
        descr: rule.description || '',
        associated: 'add-associated'  // Auto-create firewall rule
      };

      // Handle source - default to any
      if (rule.source_net && rule.source_net !== 'any') {
        xmlRule.source = { network: rule.source_net };
      } else {
        xmlRule.source = { any: '' };
      }

      // Handle destination (external side)
      if (rule.destination_net && rule.destination_net !== 'any') {
        xmlRule.destination = {
          network: rule.destination_net,
          port: rule.destination_port
        };
      } else {
        // Default to WAN address
        xmlRule.destination = {
          network: `${rule.interface || 'wan'}ip`,
          port: rule.destination_port
        };
      }

      // Handle enabled/disabled
      if (rule.enabled === '0') {
        xmlRule.disabled = '';
      }

      // Handle logging
      if (rule.log === '1') {
        xmlRule.log = '';
      }

      // Ensure rule array is an array
      if (!Array.isArray(config.nat.rule)) {
        config.nat.rule = config.nat.rule ? [config.nat.rule] : [];
      }

      // Add the rule
      config.nat.rule.push(xmlRule);

      // Save configuration
      await this.saveNATConfigViaSSH(config);

      // Apply changes
      await this.applyNATChanges();

      if (this.debugMode) {
        console.log(`[NATResource] Port forward created successfully: ${uuid}`);
      }

      return { uuid, success: true };
    } catch (error) {
      console.error('Failed to create port forward rule:', error);
      throw error;
    }
  }

  /**
   * Delete a port forward rule by description or index
   */
  async deletePortForward(identifier: string): Promise<boolean> {
    if (this.debugMode) {
      console.log('[NATResource] Deleting port forward rule:', identifier);
    }

    if (!this.sshExecutor) {
      throw new Error('SSH not configured. Cannot delete port forward rules.');
    }

    try {
      const config = await this.getNATConfigViaSSH();

      if (!config.nat?.rule) {
        throw new Error('No port forward rules found');
      }

      // Ensure rules is an array
      let rules = config.nat.rule;
      if (!Array.isArray(rules)) {
        rules = [rules];
      }

      // Find the rule by description or UUID-like identifier
      const originalLength = rules.length;
      const filteredRules = rules.filter((r: any) => {
        // Match by description
        if (r.descr === identifier) return false;
        // Match by target:port combination
        if (`${r.target}:${r['local-port']}` === identifier) return false;
        return true;
      });

      if (filteredRules.length === originalLength) {
        throw new Error(`Port forward rule "${identifier}" not found`);
      }

      config.nat.rule = filteredRules;

      // Save configuration
      await this.saveNATConfigViaSSH(config);

      // Apply changes
      await this.applyNATChanges();

      if (this.debugMode) {
        console.log(`[NATResource] Port forward deleted successfully`);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete port forward rule:', error);
      throw error;
    }
  }

  /**
   * Normalize port forward rule from XML config
   */
  private normalizePortForwardFromXML(rule: any, uuid: string): PortForwardRule {
    return {
      uuid,
      enabled: rule.disabled !== undefined ? '0' : '1',
      interface: rule.interface || 'wan',
      protocol: rule.protocol || 'tcp',
      source_net: rule.source?.network || (rule.source?.any !== undefined ? 'any' : 'any'),
      source_port: rule.source?.port,
      destination_net: rule.destination?.network || 'any',
      destination_port: rule.destination?.port || '',
      target: rule.target || '',
      local_port: rule['local-port'] || rule.localport || rule.destination?.port || '',
      description: rule.descr || '',
      associated_rule: rule.associated,
      nosync: rule.nosync !== undefined ? '1' : '0',
      log: rule.log !== undefined ? '1' : '0'
    };
  }

  // ==================== One-to-One NAT Methods (Placeholders) ====================

  async listOneToOneRules(): Promise<OneToOneNATRule[]> {
    return [];
  }

  async createOneToOneRule(rule: OneToOneNATRule): Promise<{ uuid: string; success: boolean }> {
    throw new Error('One-to-One NAT via SSH not yet implemented');
  }

  // ==================== NPT Methods (Placeholders) ====================

  async listNPTRules(): Promise<NPTRule[]> {
    return [];
  }

  // ==================== Critical Fix Methods ====================

  /**
   * Fix DMZ NAT issue - Add exception rules for inter-VLAN traffic
   */
  async fixDMZNAT(params?: {
    dmzNetwork?: string;
    lanNetwork?: string;
    otherInternalNetworks?: string[];
  }): Promise<{ success: boolean; message: string; rulesCreated: string[] }> {
    console.log('\n[NATResource] Starting DMZ NAT fix...');
    
    const dmzNetwork = params?.dmzNetwork || '10.0.6.0/24';
    const lanNetwork = params?.lanNetwork || '10.0.0.0/24';
    const otherNetworks = params?.otherInternalNetworks || [
      '10.0.2.0/24',  // IoT VLAN
      '10.0.4.0/24'   // Guest VLAN
    ];

    const rulesCreated: string[] = [];

    try {
      // Step 1: Check current NAT mode
      const currentMode = await this.getOutboundMode();
      console.log(`Current NAT mode: ${currentMode}`);

      // Step 2: Set to hybrid mode if needed (allows manual rules with automatic)
      if (currentMode === 'automatic') {
        console.log('Switching NAT mode from automatic to hybrid...');
        await this.setOutboundMode('hybrid');
      }

      // Step 3: Create no-NAT exception rules for inter-VLAN traffic
      
      // DMZ to LAN - No NAT
      console.log('Creating DMZ to LAN no-NAT rule...');
      const dmzToLan = await this.createOutboundRule({
        enabled: '1',
        interface: 'wan',
        source_net: dmzNetwork,
        destination_net: lanNetwork,
        nonat: '1',
        target: '',
        description: 'No NAT: DMZ to LAN traffic (MCP auto-fix)'
      });
      rulesCreated.push(`DMZ→LAN`);

      // LAN to DMZ - No NAT (return traffic)
      console.log('Creating LAN to DMZ no-NAT rule...');
      const lanToDmz = await this.createOutboundRule({
        enabled: '1',
        interface: 'wan',
        source_net: lanNetwork,
        destination_net: dmzNetwork,
        nonat: '1',
        target: '',
        description: 'No NAT: LAN to DMZ traffic (MCP auto-fix)'
      });
      rulesCreated.push(`LAN→DMZ`);

      // DMZ to other internal networks
      for (const network of otherNetworks) {
        console.log(`Creating DMZ to ${network} no-NAT rule...`);
        await this.createOutboundRule({
          enabled: '1',
          interface: 'wan',
          source_net: dmzNetwork,
          destination_net: network,
          nonat: '1',
          target: '',
          description: `No NAT: DMZ to ${network} traffic (MCP auto-fix)`
        });
        rulesCreated.push(`DMZ→${network}`);

        // Reverse direction
        await this.createOutboundRule({
          enabled: '1',
          interface: 'wan',
          source_net: network,
          destination_net: dmzNetwork,
          nonat: '1',
          target: '',
          description: `No NAT: ${network} to DMZ traffic (MCP auto-fix)`
        });
        rulesCreated.push(`${network}→DMZ`);
      }

      // Step 4: Apply all NAT changes
      console.log('Applying NAT configuration...');
      await this.applyNATChanges();

      // Step 5: Verify the rules were created
      const rules = await this.listOutboundRules();
      const mcpRules = rules.filter(r => r.description?.includes('MCP auto-fix'));
      
      console.log(`\n✅ DMZ NAT fix completed successfully!`);
      console.log(`Created ${rulesCreated.length} no-NAT exception rules`);
      console.log(`Verified ${mcpRules.length} MCP rules in configuration`);

      return {
        success: true,
        message: `Successfully fixed DMZ NAT issue. Created ${rulesCreated.length} no-NAT exception rules for inter-VLAN traffic.`,
        rulesCreated
      };

    } catch (error) {
      console.error('Failed to fix DMZ NAT:', error);
      return {
        success: false,
        message: `Failed to fix DMZ NAT: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rulesCreated
      };
    }
  }

  /**
   * Quick fix for DMZ NAT issue with minimal configuration
   */
  async quickFixDMZNAT(): Promise<{ success: boolean; message: string }> {
    console.log('\n[NATResource] Quick DMZ NAT fix...');
    
    try {
      // Set to hybrid mode
      await this.setOutboundMode('hybrid');
      
      // Create essential no-NAT rules
      const rules = [
        { src: '10.0.6.0/24', dst: '10.0.0.0/24', desc: 'DMZ to LAN' },
        { src: '10.0.0.0/24', dst: '10.0.6.0/24', desc: 'LAN to DMZ' },
        { src: '10.0.6.0/24', dst: '10.0.2.0/24', desc: 'DMZ to IoT' },
        { src: '10.0.2.0/24', dst: '10.0.6.0/24', desc: 'IoT to DMZ' }
      ];

      for (const rule of rules) {
        await this.createOutboundRule({
          enabled: '1',
          interface: 'wan',
          source_net: rule.src,
          destination_net: rule.dst,
          nonat: '1',
          target: '',
          description: `No NAT: ${rule.desc} (Quick fix)`
        });
      }

      await this.applyNATChanges();
      
      return {
        success: true,
        message: 'DMZ NAT issue fixed! Inter-VLAN traffic will no longer be NAT\'d.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Quick fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove all MCP-created NAT fix rules
   */
  async cleanupDMZNATFix(): Promise<{ success: boolean; deletedCount: number }> {
    console.log('\n[NATResource] Cleaning up MCP NAT fix rules...');
    
    try {
      const rules = await this.listOutboundRules();
      const mcpRules = rules.filter(r => 
        r.description?.includes('MCP auto-fix') || 
        r.description?.includes('Quick fix')
      );

      let deletedCount = 0;
      for (const rule of mcpRules) {
        if (rule.description) {
          console.log(`Deleting rule: ${rule.description}`);
          await this.deleteOutboundRule(rule.description);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        await this.applyNATChanges();
      }

      return { success: true, deletedCount };
    } catch (error) {
      console.error('Cleanup failed:', error);
      return { success: false, deletedCount: 0 };
    }
  }

  // ==================== Diagnostic Methods ====================

  /**
   * Analyze NAT configuration for issues
   */
  async analyzeNATConfiguration(): Promise<{
    mode: NATMode;
    issues: string[];
    recommendations: string[];
    rules: {
      outbound: number;
      portForwards: number;
      oneToOne: number;
      npt: number;
    };
  }> {
    console.log('\n[NATResource] Analyzing NAT configuration...');

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Get current configuration
    const mode = await this.getOutboundMode();
    const outboundRules = await this.listOutboundRules();
    const portForwards = await this.listPortForwards();
    const oneToOneRules = await this.listOneToOneRules();
    const nptRules = await this.listNPTRules();

    // Check for common issues
    if (mode === 'automatic') {
      // Check for internal networks being NAT'd
      const internalNetworks = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
      const hasInternalNAT = outboundRules.some(r => 
        !r.nonat && internalNetworks.some(net => 
          r.destination_net?.includes(net.split('/')[0])
        )
      );

      if (hasInternalNAT) {
        issues.push('Internal traffic may be incorrectly NAT\'d in automatic mode');
        recommendations.push('Switch to hybrid mode and add no-NAT rules for internal traffic');
      }
    }

    // Check for DMZ NAT issues
    const dmzRules = outboundRules.filter(r => 
      r.source_net?.includes('10.0.6') || r.description?.toLowerCase().includes('dmz')
    );

    const hasDMZExceptions = dmzRules.some(r => r.nonat === '1');
    if (!hasDMZExceptions && dmzRules.length > 0) {
      issues.push('DMZ traffic may be NAT\'d when communicating with internal networks');
      recommendations.push('Add no-NAT exception rules for DMZ to internal network traffic');
    }

    // Check for conflicting rules
    const enabledOutbound = outboundRules.filter(r => r.enabled === '1');
    if (enabledOutbound.length > 20) {
      recommendations.push('Consider consolidating NAT rules for better performance');
    }

    // Check if SSH is configured
    if (!this.sshExecutor) {
      issues.push('SSH not configured - NAT management is limited');
      recommendations.push('Configure SSH credentials in environment variables for full NAT management capabilities');
    }

    return {
      mode,
      issues,
      recommendations,
      rules: {
        outbound: outboundRules.length,
        portForwards: portForwards.length,
        oneToOne: oneToOneRules.length,
        npt: nptRules.length
      }
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Apply NAT configuration changes
   */
  async applyNATChanges(): Promise<any> {
    if (this.debugMode) {
      console.log('[NATResource] Applying NAT changes...');
    }

    if (this.sshExecutor) {
      // Apply via SSH
      const result = await this.sshExecutor.execute('configctl filter reload');
      if (!result.success) {
        throw new Error(`Failed to apply NAT changes: ${result.stderr}`);
      }
      return result;
    } else {
      // Try API (may not work)
      try {
        const response = await this.client.post('/firewall/nat/apply');
        return response;
      } catch (error) {
        console.error('Failed to apply NAT changes via API:', error);
        throw new Error('Cannot apply NAT changes without SSH access');
      }
    }
  }

  /**
   * Normalize outbound NAT rule data from XML
   */
  private normalizeOutboundRuleFromXML(rule: any): OutboundNATRule {
    return {
      enabled: rule.disabled ? '0' : '1',
      sequence: rule.sequence,
      interface: rule.interface,
      source_net: rule.source?.network || 'any',
      source_port: rule.sourceport,
      destination_net: rule.destination?.network || 'any',
      destination_port: rule.dstport,
      target: rule.target || '',
      targetip: rule.targetip,
      targetip_subnet: rule.targetip_subnet,
      poolopts: rule.poolopts,
      sourceHash: rule.sourcehash,
      nonat: rule.nonat !== undefined ? '1' : '0',
      log: rule.log !== undefined ? '1' : '0',
      description: rule.descr || ''
    };
  }

  /**
   * Normalize outbound NAT rule data from API
   */
  private normalizeOutboundRule(uuid: string, rule: any): OutboundNATRule {
    return {
      uuid,
      enabled: rule.enabled || '0',
      sequence: rule.sequence,
      interface: this.extractSelectedValue(rule.interface) || rule.interface,
      source_net: this.extractNetworkValue(rule.source),
      source_port: rule.source_port || rule.sourceport,
      destination_net: this.extractNetworkValue(rule.destination),
      destination_port: rule.destination_port || rule.dstport,
      target: rule.target || '',
      targetip: rule.targetip,
      targetip_subnet: rule.targetip_subnet,
      poolopts: rule.poolopts,
      sourceHash: rule.sourcehash || rule.sourceHash,
      nonat: rule.nonat || (rule.target === '' ? '1' : '0'),
      log: rule.log || '0',
      description: rule.description || ''
    };
  }

  /**
   * Extract port forward data
   */
  private extractPortForwardData(rule: any): Partial<PortForwardRule> {
    return {
      enabled: rule.enabled || '0',
      interface: this.extractSelectedValue(rule.interface) || rule.interface,
      protocol: this.extractSelectedValue(rule.protocol) || rule.protocol,
      source_net: this.extractNetworkValue(rule.source),
      source_port: rule.source?.port || rule.source_port,
      destination_net: this.extractNetworkValue(rule.destination),
      destination_port: rule.destination?.port || rule.destination_port,
      target: rule.target,
      local_port: rule.local_port || rule.localport,
      description: rule.description || '',
      associated_rule: rule.associated_rule,
      log: rule.log || '0'
    };
  }

  /**
   * Extract network value from complex object
   */
  private extractNetworkValue(obj: any): string {
    if (!obj || typeof obj !== 'object') {
      return obj || 'any';
    }

    if (obj.any === '1' || obj.any === true || obj.any === '') {
      return 'any';
    }

    return obj.network || obj.address || 'any';
  }

  /**
   * Extract selected value from option object
   */
  private extractSelectedValue(optionObj: any): string {
    if (!optionObj || typeof optionObj !== 'object') {
      return optionObj || '';
    }

    for (const [key, value] of Object.entries(optionObj)) {
      if (value && typeof value === 'object' && (value as any).selected === 1) {
        return key;
      }
    }

    return '';
  }

  /**
   * Create common NAT presets
   */
  createPreset(preset: string, params: any = {}): Partial<OutboundNATRule | PortForwardRule> {
    switch (preset) {
      case 'web-server':
        return {
          enabled: '1',
          interface: params.interface || 'wan',
          protocol: 'tcp',
          destination_port: '80,443',
          target: params.target || '',
          local_port: '80,443',
          description: params.description || 'Web server port forward'
        } as PortForwardRule;

      case 'ssh-forward':
        return {
          enabled: '1',
          interface: params.interface || 'wan',
          protocol: 'tcp',
          destination_port: params.externalPort || '2222',
          target: params.target || '',
          local_port: '22',
          description: params.description || 'SSH port forward'
        } as PortForwardRule;

      case 'no-nat-internal':
        return {
          enabled: '1',
          interface: 'wan',
          source_net: params.source || '10.0.0.0/8',
          destination_net: params.destination || '10.0.0.0/8',
          nonat: '1',
          target: '',
          description: params.description || 'No NAT for internal traffic'
        } as OutboundNATRule;

      default:
        throw new Error(`Unknown NAT preset: ${preset}`);
    }
  }
}

export default NATResource;