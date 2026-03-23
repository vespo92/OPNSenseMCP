// Routing Diagnostics Resource Implementation
// Provides comprehensive diagnostics and fixes for inter-VLAN routing issues
import { OPNSenseAPIClient } from '../../api/client.js';
import { logger } from '../../utils/logger.js';
import { InterfaceConfigResource } from '../network/interfaces.js';
import { FirewallRuleResource } from '../firewall/rule.js';
import SystemSettingsResource from '../system/settings.js';

export interface RoutingDiagnosticResult {
  timestamp: string;
  issues: RoutingIssue[];
  recommendations: string[];
  canAutoFix: boolean;
  summary: string;
}

export interface RoutingIssue {
  severity: 'critical' | 'warning' | 'info';
  component: string;
  issue: string;
  details: any;
  fixAvailable: boolean;
  fixCommand?: string;
}

export interface InterfaceRoutingStatus {
  name: string;
  ipaddr?: string;
  subnet?: string;
  blockPrivateNetworks: boolean;
  blockBogons: boolean;
  routingEnabled: boolean;
  issues: string[];
}

export interface RouteTableEntry {
  destination: string;
  gateway: string;
  interface: string;
  flags: string;
  metric?: number;
}

export class RoutingDiagnosticsResource {
  private client: OPNSenseAPIClient;
  private interfaceResource: InterfaceConfigResource;
  private firewallResource: FirewallRuleResource;
  private systemResource: SystemSettingsResource;
  private debugMode: boolean = process.env.MCP_DEBUG === 'true' || process.env.DEBUG_ROUTING === 'true';

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
    this.interfaceResource = new InterfaceConfigResource(client);
    this.firewallResource = new FirewallRuleResource(client);
    this.systemResource = new SystemSettingsResource(client);
  }

  /**
   * Run comprehensive routing diagnostics
   */
  async runDiagnostics(sourceNetwork?: string, destNetwork?: string): Promise<RoutingDiagnosticResult> {
    logger.info('OPNsense Inter-VLAN Routing Diagnostics starting');

    const issues: RoutingIssue[] = [];
    const recommendations: string[] = [];
    const timestamp = new Date().toISOString();

    // 1. Check interface blocking settings
    logger.info('1. Checking interface blocking settings...');
    const interfaceIssues = await this.checkInterfaceBlocking();
    issues.push(...interfaceIssues);

    // 2. Check system-level routing settings
    logger.info('2. Checking system-level routing settings...');
    const systemIssues = await this.checkSystemSettings();
    issues.push(...systemIssues);

    // 3. Check firewall rules
    logger.info('3. Checking firewall rules...');
    if (sourceNetwork && destNetwork) {
      const firewallIssues = await this.checkFirewallRules(sourceNetwork, destNetwork);
      issues.push(...firewallIssues);
    }

    // 4. Check routing table
    logger.info('4. Checking routing table...');
    const routingTableIssues = await this.checkRoutingTable();
    issues.push(...routingTableIssues);

    // 5. Check NAT rules that might interfere
    logger.info('5. Checking NAT rules...');
    const natIssues = await this.checkNATRules();
    issues.push(...natIssues);

    // Generate recommendations
    this.generateRecommendations(issues, recommendations);

    // Determine if auto-fix is possible
    const canAutoFix = issues.some(i => i.fixAvailable);

    // Generate summary
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const summary = criticalCount > 0 
      ? `Found ${criticalCount} critical issues blocking inter-VLAN routing`
      : warningCount > 0
      ? `Found ${warningCount} warnings that may affect routing`
      : 'No major routing issues detected';

    logger.info('Diagnostic Summary');
    logger.info(`Total issues found: ${issues.length}`);
    logger.info(`Critical: ${criticalCount}, Warnings: ${warningCount}`);
    logger.info(`Auto-fix available: ${canAutoFix ? 'Yes' : 'No'}`);

    return {
      timestamp,
      issues,
      recommendations,
      canAutoFix,
      summary
    };
  }

  /**
   * Check interface blocking settings
   */
  private async checkInterfaceBlocking(): Promise<RoutingIssue[]> {
    const issues: RoutingIssue[] = [];

    try {
      // Get all interfaces
      const interfaces = await this.interfaceResource.listOverview();
      
      for (const iface of interfaces) {
        // Skip WAN interfaces
        if (iface.name.toLowerCase().includes('wan')) continue;

        // Get detailed config
        const config = await this.interfaceResource.getInterfaceConfig(iface.name);
        
        if (config) {
          const blockPriv = config.blockpriv === '1' || config.blockpriv === 'yes';
          const blockBogons = config.blockbogons === '1' || config.blockbogons === 'yes';

          if (blockPriv || blockBogons) {
            issues.push({
              severity: 'critical',
              component: 'Interface',
              issue: `Interface ${iface.name} is blocking private networks`,
              details: {
                interface: iface.name,
                ipaddr: iface.ipaddr,
                blockPrivateNetworks: blockPriv,
                blockBogons: blockBogons
              },
              fixAvailable: true,
              fixCommand: `enable_intervlan_routing_on_interface("${iface.name}")`
            });

            logger.warn(`${iface.name}: Blocking private networks (blockpriv=${blockPriv}, blockbogons=${blockBogons})`);
          } else {
            logger.info(`${iface.name}: Not blocking private networks`);
          }
        } else {
          logger.warn(`${iface.name}: Unable to retrieve configuration`);
        }
      }
    } catch (error) {
      logger.error('Error checking interface blocking:', error);
      issues.push({
        severity: 'warning',
        component: 'Interface',
        issue: 'Unable to check interface blocking settings',
        details: { error: String(error) },
        fixAvailable: false
      });
    }

    return issues;
  }

  /**
   * Check system-level settings
   */
  private async checkSystemSettings(): Promise<RoutingIssue[]> {
    const issues: RoutingIssue[] = [];

    try {
      const settings = await this.systemResource.getAllSettings();
      
      if (settings.firewall) {
        const blockPriv = settings.firewall.blockprivatenetworks === '1';
        const blockBogons = settings.firewall.blockbogons === '1';
        const allowInterLan = settings.firewall.allowinterlantraffic !== '0';

        if (blockPriv || blockBogons) {
          issues.push({
            severity: 'critical',
            component: 'System',
            issue: 'System-level blocking of private networks enabled',
            details: {
              blockPrivateNetworks: blockPriv,
              blockBogons: blockBogons,
              allowInterLanTraffic: allowInterLan
            },
            fixAvailable: true,
            fixCommand: 'enable_system_intervlan_routing()'
          });
          logger.warn('System: Blocking private networks at system level');
        } else {
          logger.info('System: Not blocking private networks');
        }

        if (!allowInterLan) {
          issues.push({
            severity: 'warning',
            component: 'System',
            issue: 'Inter-LAN traffic may be restricted',
            details: { allowInterLanTraffic: false },
            fixAvailable: true,
            fixCommand: 'enable_system_intervlan_routing()'
          });
          logger.warn('System: Inter-LAN traffic not explicitly allowed');
        }
      }
    } catch (error) {
      logger.error('Error checking system settings:', error);
      issues.push({
        severity: 'warning',
        component: 'System',
        issue: 'Unable to check system settings',
        details: { error: String(error) },
        fixAvailable: false
      });
    }

    return issues;
  }

  /**
   * Check firewall rules between networks
   */
  private async checkFirewallRules(sourceNetwork: string, destNetwork: string): Promise<RoutingIssue[]> {
    const issues: RoutingIssue[] = [];

    try {
      const rules = await this.firewallResource.list();
      
      // Look for allow rules between the networks
      const hasAllowRule = rules.some(rule => {
        const matchesSource = rule.source_net === sourceNetwork || 
                             rule.source_net === 'any' || 
                             rule.source_net?.includes(sourceNetwork.split('/')[0]);
        const matchesDest = rule.destination_net === destNetwork || 
                           rule.destination_net === 'any' || 
                           rule.destination_net?.includes(destNetwork.split('/')[0]);
        return rule.action === 'pass' && matchesSource && matchesDest && rule.enabled === '1';
      });

      if (!hasAllowRule) {
        issues.push({
          severity: 'critical',
          component: 'Firewall',
          issue: `No allow rule found from ${sourceNetwork} to ${destNetwork}`,
          details: {
            source: sourceNetwork,
            destination: destNetwork,
            rulesChecked: rules.length
          },
          fixAvailable: true,
          fixCommand: `create_intervlan_rule("${sourceNetwork}", "${destNetwork}")`
        });
        logger.warn(`Firewall: No allow rule from ${sourceNetwork} to ${destNetwork}`);
      } else {
        logger.info(`Firewall: Allow rule exists from ${sourceNetwork} to ${destNetwork}`);
      }

      // Check for blocking rules
      const blockingRule = rules.find(rule => {
        const matchesSource = rule.source_net === sourceNetwork || 
                             rule.source_net?.includes(sourceNetwork.split('/')[0]);
        const matchesDest = rule.destination_net === destNetwork || 
                           rule.destination_net?.includes(destNetwork.split('/')[0]);
        return rule.action === 'block' && matchesSource && matchesDest && rule.enabled === '1';
      });

      if (blockingRule) {
        issues.push({
          severity: 'critical',
          component: 'Firewall',
          issue: `Blocking rule found that prevents traffic from ${sourceNetwork} to ${destNetwork}`,
          details: {
            ruleId: blockingRule.uuid,
            description: blockingRule.description
          },
          fixAvailable: false
        });
        logger.warn(`Firewall: Blocking rule preventing traffic (${blockingRule.description})`);
      }
    } catch (error) {
      logger.error('Error checking firewall rules:', error);
      issues.push({
        severity: 'warning',
        component: 'Firewall',
        issue: 'Unable to check firewall rules',
        details: { error: String(error) },
        fixAvailable: false
      });
    }

    return issues;
  }

  /**
   * Check routing table
   */
  private async checkRoutingTable(): Promise<RoutingIssue[]> {
    const issues: RoutingIssue[] = [];

    try {
      // Try to get routing table via API
      const response = await this.client.get('/diagnostics/interface/getRoutes');
      
      if (response && response.rows) {
        const routes = response.rows as RouteTableEntry[];
        
        // Check for default route
        const hasDefaultRoute = routes.some(r => r.destination === 'default' || r.destination === '0.0.0.0/0');
        if (!hasDefaultRoute) {
          issues.push({
            severity: 'warning',
            component: 'Routing',
            issue: 'No default route found',
            details: { routes: routes.length },
            fixAvailable: false
          });
          logger.warn('Routing: No default route found');
        } else {
          logger.info('Routing: Default route present');
        }

        // Check for routes to private networks
        const privateNetworks = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
        for (const network of privateNetworks) {
          const hasRoute = routes.some(r => r.destination.startsWith(network.split('/')[0]));
          if (!hasRoute && network.startsWith('10.')) {
            logger.warn(`Routing: No explicit route for ${network}`);
          }
        }
      }
    } catch (error) {
      logger.debug('Routing: Unable to retrieve routing table via API');
      // This is not critical as routing table might not be available via API
    }

    return issues;
  }

  /**
   * Check NAT rules
   */
  private async checkNATRules(): Promise<RoutingIssue[]> {
    const issues: RoutingIssue[] = [];

    try {
      // Try to get NAT rules
      const response = await this.client.get('/firewall/nat/get');
      
      if (response && response.outbound) {
        const rules = response.outbound.rule || [];
        
        // Check for rules that might NAT internal traffic
        const problematicNAT = rules.find((rule: any) => {
          return rule.source?.network?.includes('10.0.') && 
                 rule.destination?.network?.includes('10.0.') &&
                 rule.target !== 'no-nat';
        });

        if (problematicNAT) {
          issues.push({
            severity: 'warning',
            component: 'NAT',
            issue: 'NAT rule may be translating internal traffic',
            details: {
              source: problematicNAT.source,
              destination: problematicNAT.destination
            },
            fixAvailable: false
          });
          logger.warn('NAT: Rule may be translating internal traffic');
        } else {
          logger.info('NAT: No problematic NAT rules found');
        }
      }
    } catch (error) {
      logger.debug('NAT: Unable to check NAT rules');
      // Not critical - NAT might not be the issue
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues found
   */
  private generateRecommendations(issues: RoutingIssue[], recommendations: string[]): void {
    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasInterfaceBlocking = issues.some(i => i.component === 'Interface' && i.severity === 'critical');
    const hasSystemBlocking = issues.some(i => i.component === 'System' && i.severity === 'critical');
    const hasFirewallIssue = issues.some(i => i.component === 'Firewall' && i.severity === 'critical');

    if (hasInterfaceBlocking) {
      recommendations.push('1. Disable "Block private networks" on internal interfaces (especially DMZ/opt8)');
      recommendations.push('   Run: fix_intervlan_routing() to automatically fix this');
    }

    if (hasSystemBlocking) {
      recommendations.push('2. Disable system-level blocking of private networks');
      recommendations.push('   Run: fix_intervlan_routing() to automatically fix this');
    }

    if (hasFirewallIssue) {
      recommendations.push('3. Create firewall rules to allow inter-VLAN traffic');
      recommendations.push('   Run: create_intervlan_rules("10.0.6.0/24", "10.0.0.0/24")');
    }

    if (!hasCritical) {
      recommendations.push('No critical issues found. Routing should be working.');
      recommendations.push('If still having issues, check:');
      recommendations.push('- Client routing configuration');
      recommendations.push('- VLAN tagging on switches');
      recommendations.push('- Gateway settings on clients');
    }
  }

  /**
   * Automatically fix all detected routing issues
   */
  async fixAllRoutingIssues(): Promise<{ success: boolean; actions: string[] }> {
    logger.info('Auto-Fixing Inter-VLAN Routing Issues');

    const actions: string[] = [];
    let success = true;

    // 1. Fix interface blocking
    logger.info('1. Fixing interface blocking settings...');
    try {
      const interfaces = await this.interfaceResource.listOverview();
      for (const iface of interfaces) {
        if (!iface.name.toLowerCase().includes('wan')) {
          const result = await this.interfaceResource.enableInterVLANRoutingOnInterface(iface.name);
          if (result) {
            actions.push(`Enabled inter-VLAN routing on interface ${iface.name}`);
            logger.info(`Fixed ${iface.name}`);
          } else {
            logger.warn(`Could not fix ${iface.name}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error fixing interfaces:', error);
      success = false;
    }

    // 2. Fix system settings
    logger.info('2. Fixing system-level settings...');
    try {
      const result = await this.systemResource.enableInterVLANRouting();
      if (result) {
        actions.push('Enabled inter-VLAN routing at system level');
        logger.info('System settings fixed');
      } else {
        logger.warn('Could not fix system settings');
      }
    } catch (error) {
      logger.error('Error fixing system settings:', error);
      success = false;
    }

    // 3. Apply all changes
    logger.info('3. Applying configuration changes...');
    try {
      await this.applyAllChanges();
      actions.push('Applied all configuration changes');
      logger.info('Changes applied');
    } catch (error) {
      logger.error('Error applying changes:', error);
      success = false;
    }

    logger.info(`Fix ${success ? 'completed successfully' : 'encountered errors'}`);
    logger.info(`Actions taken: ${actions.length}`);

    return { success, actions };
  }

  /**
   * Apply all configuration changes
   */
  private async applyAllChanges(): Promise<void> {
    const endpoints = [
      '/firewall/filter/apply',
      '/firewall/filter/reconfigure',
      '/interfaces/reconfigure',
      '/system/firmware/configctl',
      '/system/firmware/reconfigure'
    ];

    for (const endpoint of endpoints) {
      try {
        await this.client.post(endpoint, endpoint.includes('configctl') ? { action: 'filter reload' } : {});
        if (this.debugMode) {
          logger.debug(`Applied changes via ${endpoint}`);
        }
      } catch (error) {
        // Some endpoints might not exist, that's OK
        if (this.debugMode) {
          logger.debug(`${endpoint} not available`);
        }
      }
    }

    // Wait for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Create specific inter-VLAN routing rules
   */
  async createInterVLANRules(sourceNetwork: string, destNetwork: string, bidirectional: boolean = true): Promise<boolean> {
    logger.info(`Creating inter-VLAN rules between ${sourceNetwork} and ${destNetwork}...`);

    try {
      // Create forward rule
      const forwardRule = await this.firewallResource.create({
        enabled: '1',
        action: 'pass',
        quick: '1',
        interface: 'lan',  // Adjust based on your setup
        direction: 'in',
        ipprotocol: 'inet',
        protocol: 'any',
        source_net: sourceNetwork,
        destination_net: destNetwork,
        description: `Allow ${sourceNetwork} to ${destNetwork}`
      });

      if (forwardRule) {
        logger.info(`Created forward rule: ${sourceNetwork} -> ${destNetwork}`);
      }

      // Create reverse rule if bidirectional
      if (bidirectional) {
        const reverseRule = await this.firewallResource.create({
          enabled: '1',
          action: 'pass',
          quick: '1',
          interface: 'lan',  // Adjust based on your setup
          direction: 'in',
          ipprotocol: 'inet',
          protocol: 'any',
          source_net: destNetwork,
          destination_net: sourceNetwork,
          description: `Allow ${destNetwork} to ${sourceNetwork}`
        });

        if (reverseRule) {
          logger.info(`Created reverse rule: ${destNetwork} -> ${sourceNetwork}`);
        }
      }

      // Apply changes
      await this.firewallResource.applyChanges();
      logger.info('Firewall rules applied');

      return true;
    } catch (error) {
      logger.error('Error creating inter-VLAN rules:', error);
      return false;
    }
  }

  /**
   * Quick fix for DMZ to LAN routing
   */
  async fixDMZRouting(): Promise<boolean> {
    logger.info('Quick Fix: DMZ to LAN Routing');

    // 1. Fix opt8 (DMZ) interface
    logger.info('1. Configuring DMZ interface (opt8)...');
    const dmzFixed = await this.interfaceResource.configureDMZInterface('opt8');
    
    // 2. Fix system settings
    logger.info('2. Enabling system inter-VLAN routing...');
    const systemFixed = await this.systemResource.enableInterVLANRouting();
    
    // 3. Create firewall rules
    logger.info('3. Creating DMZ to LAN firewall rules...');
    const rulesCreated = await this.createInterVLANRules('10.0.6.0/24', '10.0.0.0/24');
    
    // 4. Create NFS-specific rules
    logger.info('4. Creating NFS access rules...');
    const nfsRules = await this.firewallResource.createNFSRules({
      interface: 'opt8',
      sourceNetwork: '10.0.6.0/24',
      truenasIP: '10.0.0.14'
    });
    
    // 5. Apply all changes
    logger.info('5. Applying all changes...');
    await this.applyAllChanges();
    
    const success = dmzFixed && systemFixed && rulesCreated && (!!nfsRules?.tcp || !!nfsRules?.udp);
    
    logger.info(success ? 'DMZ routing fix completed' : 'Some fixes failed');

    if (success) {
      logger.info('Test connectivity from DMZ (10.0.6.2): ping 10.0.0.14, showmount -e 10.0.0.14');
    }
    
    return success;
  }
}

export default RoutingDiagnosticsResource;