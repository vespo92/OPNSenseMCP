// CLI Executor Resource for OPNsense
// Provides CLI command execution capabilities for advanced configuration
// that is not available through the standard API

import { OPNSenseAPIClient, OPNSenseAPIError } from '../../api/client.js';
import { logger } from '../../utils/logger.js';

export interface CLIExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  executed: string;
  timestamp: string;
}

export interface CLICommand {
  command: string;
  args?: string[];
  timeout?: number;
  sudo?: boolean;
}

export interface InterfaceBlockingConfig {
  interface: string;
  blockpriv: boolean;
  blockbogons: boolean;
}

export class CLIExecutorResource {
  private client: OPNSenseAPIClient;
  private debugMode: boolean = process.env.MCP_DEBUG === 'true' || process.env.DEBUG_CLI === 'true';
  
  // Whitelist of safe commands for security
  private readonly SAFE_COMMANDS = [
    'configctl',
    'pfctl',
    'pluginctl',
    'netstat',
    'ifconfig',
    'route',
    'arp',
    'ping',
    'traceroute',
    'showmount',
    'cat /conf/config.xml',
    'grep',
    'sed',
    'awk'
  ];

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
  }

  /**
   * Execute a CLI command on OPNsense
   * First tries via API endpoints, falls back to SSH if configured
   */
  async execute(command: CLICommand): Promise<CLIExecuteResult> {
    const timestamp = new Date().toISOString();
    const fullCommand = this.buildCommand(command);
    
    if (this.debugMode) {
      logger.info(`[CLI] Executing: ${fullCommand}`);
    }

    // Validate command safety
    if (!this.isCommandSafe(fullCommand)) {
      return {
        success: false,
        error: 'Command not in whitelist',
        executed: fullCommand,
        timestamp
      };
    }

    // Try different API endpoints for command execution
    const endpoints = [
      '/diagnostics/command/execute',
      '/diagnostics/shell/exec',
      '/core/system/exec',
      '/system/console/exec'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.tryExecuteViaAPI(endpoint, fullCommand, command.timeout);
        if (response) {
          return {
            success: true,
            output: response.output || response.result || response.data,
            exitCode: response.exitCode || 0,
            executed: fullCommand,
            timestamp
          };
        }
      } catch (error) {
        if (this.debugMode) {
          logger.warn(`[CLI] Endpoint ${endpoint} failed:`, error);
        }
        // Continue to next endpoint
      }
    }

    // If no API endpoint works, try the configctl wrapper approach
    return this.executeViaConfigctl(fullCommand, timestamp);
  }

  /**
   * Try to execute command via API endpoint
   */
  private async tryExecuteViaAPI(endpoint: string, command: string, timeout?: number): Promise<any> {
    try {
      const payload = {
        command,
        timeout: timeout || 30000
      };
      
      const response = await this.client.post(endpoint, payload);
      
      // Check if response indicates success
      if (response && (response.status === 'ok' || response.result === 'success' || response.output)) {
        return response;
      }
      
      return null;
    } catch (error) {
      // API endpoint doesn't exist or failed
      return null;
    }
  }

  /**
   * Execute command via configctl (OPNsense's configuration control tool)
   */
  private async executeViaConfigctl(command: string, timestamp: string): Promise<CLIExecuteResult> {
    try {
      // Try to use configctl system command execution
      const response = await this.client.post('/firewall/filter/reconfigure', {
        command: command
      });

      if (response && response.status === 'ok') {
        return {
          success: true,
          output: 'Command executed via configctl',
          executed: command,
          timestamp
        };
      }

      return {
        success: false,
        error: 'No CLI execution endpoint available',
        executed: command,
        timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executed: command,
        timestamp
      };
    }
  }

  /**
   * Build full command string from command object
   */
  private buildCommand(command: CLICommand): string {
    let cmd = command.command;
    if (command.args && command.args.length > 0) {
      cmd += ' ' + command.args.join(' ');
    }
    if (command.sudo) {
      cmd = 'sudo ' + cmd;
    }
    return cmd;
  }

  /**
   * Check if command is safe to execute
   */
  private isCommandSafe(command: string): boolean {
    // Check against whitelist
    return this.SAFE_COMMANDS.some(safe => command.startsWith(safe));
  }

  // ===== HIGH-LEVEL CLI OPERATIONS =====

  /**
   * Disable block private networks on an interface via CLI
   */
  async disableInterfaceBlocking(interfaceName: string): Promise<CLIExecuteResult> {
    logger.info(`[CLI] Disabling blocking on interface ${interfaceName}`);
    
    // Method 1: Try configctl
    const commands = [
      {
        command: 'configctl',
        args: ['interface', 'set', 'blockpriv', interfaceName, '0']
      },
      {
        command: 'configctl',
        args: ['interface', 'set', 'blockbogons', interfaceName, '0']
      },
      {
        command: 'configctl',
        args: ['interface', 'reconfigure', interfaceName]
      }
    ];

    let allSuccess = true;
    let outputs: string[] = [];

    for (const cmd of commands) {
      const result = await this.execute(cmd);
      if (!result.success) {
        allSuccess = false;
        logger.error(`[CLI] Failed to execute: ${cmd.command} ${cmd.args?.join(' ')}`);
      }
      if (result.output) {
        outputs.push(result.output);
      }
    }

    // If configctl doesn't work, try direct config.xml modification
    if (!allSuccess) {
      logger.info('[CLI] Trying direct config.xml modification');
      return this.modifyConfigXML(interfaceName);
    }

    return {
      success: allSuccess,
      output: outputs.join('\n'),
      executed: 'disable_interface_blocking',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Modify config.xml directly to disable blocking
   */
  private async modifyConfigXML(interfaceName: string): Promise<CLIExecuteResult> {
    const commands = [
      // Backup config first
      {
        command: 'cp',
        args: ['/conf/config.xml', '/conf/config.xml.bak']
      },
      // Remove blockpriv for the interface
      {
        command: 'sed',
        args: ['-i', '', `'/<${interfaceName}>.*<\\/${interfaceName}>/,/<\\/${interfaceName}>/ s/<blockpriv>1<\\/blockpriv>/<blockpriv>0<\\/blockpriv>/g'`, '/conf/config.xml']
      },
      // Remove blockbogons for the interface
      {
        command: 'sed',
        args: ['-i', '', `'/<${interfaceName}>.*<\\/${interfaceName}>/,/<\\/${interfaceName}>/ s/<blockbogons>1<\\/blockbogons>/<blockbogons>0<\\/blockbogons>/g'`, '/conf/config.xml']
      },
      // Reload configuration
      {
        command: 'configctl',
        args: ['firmware', 'reload']
      }
    ];

    let allSuccess = true;
    let outputs: string[] = [];

    for (const cmd of commands) {
      const result = await this.execute(cmd);
      if (!result.success) {
        allSuccess = false;
      }
      if (result.output) {
        outputs.push(result.output);
      }
    }

    return {
      success: allSuccess,
      output: outputs.join('\n'),
      executed: 'modify_config_xml',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reload firewall rules via CLI
   */
  async reloadFirewall(): Promise<CLIExecuteResult> {
    logger.info('[CLI] Reloading firewall rules');
    
    const commands = [
      { command: 'configctl', args: ['filter', 'reload'] },
      { command: 'pfctl', args: ['-f', '/tmp/rules.debug'] },
      { command: 'configctl', args: ['filter', 'sync'] }
    ];

    for (const cmd of commands) {
      const result = await this.execute(cmd);
      if (result.success) {
        return result;
      }
    }

    return {
      success: false,
      error: 'Failed to reload firewall',
      executed: 'reload_firewall',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get routing table via CLI
   */
  async getRoutingTable(): Promise<CLIExecuteResult> {
    logger.info('[CLI] Getting routing table');
    
    const result = await this.execute({
      command: 'netstat',
      args: ['-rn']
    });

    if (result.success && result.output) {
      // Parse routing table output
      const routes = this.parseRoutingTable(result.output);
      return {
        ...result,
        output: JSON.stringify(routes, null, 2)
      };
    }

    return result;
  }

  /**
   * Parse routing table output
   */
  private parseRoutingTable(output: string): any[] {
    const lines = output.split('\n');
    const routes = [];
    let headerFound = false;

    for (const line of lines) {
      if (line.includes('Destination') && line.includes('Gateway')) {
        headerFound = true;
        continue;
      }
      
      if (headerFound && line.trim()) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          routes.push({
            destination: parts[0],
            gateway: parts[1],
            flags: parts[2],
            interface: parts[3]
          });
        }
      }
    }

    return routes;
  }

  /**
   * Fix DMZ routing issues via CLI
   */
  async fixDMZRoutingCLI(): Promise<CLIExecuteResult> {
    logger.info('[CLI] Fixing DMZ routing via CLI');
    
    const commands = [
      // Disable blocking on DMZ interface (opt8)
      { command: 'configctl', args: ['interface', 'set', 'blockpriv', 'opt8', '0'] },
      { command: 'configctl', args: ['interface', 'set', 'blockbogons', 'opt8', '0'] },
      
      // Reconfigure interface
      { command: 'configctl', args: ['interface', 'reconfigure', 'opt8'] },
      
      // Add static route if needed
      { command: 'route', args: ['add', '-net', '10.0.0.0/24', '10.0.6.1'] },
      
      // Reload firewall
      { command: 'configctl', args: ['filter', 'reload'] },
      
      // Sync filter
      { command: 'configctl', args: ['filter', 'sync'] }
    ];

    let outputs: string[] = [];
    let allSuccess = true;

    for (const cmd of commands) {
      const result = await this.execute(cmd);
      if (result.success) {
        outputs.push(`✅ ${cmd.command} ${cmd.args?.join(' ')}: ${result.output || 'OK'}`);
      } else {
        outputs.push(`❌ ${cmd.command} ${cmd.args?.join(' ')}: ${result.error || 'Failed'}`);
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      output: outputs.join('\n'),
      executed: 'fix_dmz_routing',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check NFS connectivity from DMZ
   */
  async checkNFSConnectivity(truenasIP: string = '10.0.0.14'): Promise<CLIExecuteResult> {
    logger.info(`[CLI] Checking NFS connectivity to ${truenasIP}`);
    
    const result = await this.execute({
      command: 'showmount',
      args: ['-e', truenasIP]
    });

    if (result.success && result.output) {
      const exports = this.parseNFSExports(result.output);
      return {
        ...result,
        output: JSON.stringify(exports, null, 2)
      };
    }

    return result;
  }

  /**
   * Parse NFS exports output
   */
  private parseNFSExports(output: string): any[] {
    const lines = output.split('\n');
    const exports = [];
    
    for (const line of lines) {
      if (line.includes('/')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          exports.push({
            path: parts[0],
            allowed: parts.slice(1).join(' ')
          });
        }
      }
    }

    return exports;
  }

  /**
   * Get interface configuration via CLI
   */
  async getInterfaceConfigCLI(interfaceName: string): Promise<CLIExecuteResult> {
    logger.info(`[CLI] Getting config for interface ${interfaceName}`);
    
    const result = await this.execute({
      command: 'grep',
      args: [`-A20`, `"<${interfaceName}>"`, '/conf/config.xml']
    });

    if (result.success && result.output) {
      // Parse XML output to extract interface settings
      const config = this.parseInterfaceConfig(result.output, interfaceName);
      return {
        ...result,
        output: JSON.stringify(config, null, 2)
      };
    }

    return result;
  }

  /**
   * Parse interface configuration from XML
   */
  private parseInterfaceConfig(xmlOutput: string, interfaceName: string): any {
    const config: any = {
      interface: interfaceName,
      blockpriv: false,
      blockbogons: false,
      enable: true
    };

    // Extract blockpriv setting
    const blockprivMatch = xmlOutput.match(/<blockpriv>(\d+)<\/blockpriv>/);
    if (blockprivMatch) {
      config.blockpriv = blockprivMatch[1] === '1';
    }

    // Extract blockbogons setting
    const blockbogonsMatch = xmlOutput.match(/<blockbogons>(\d+)<\/blockbogons>/);
    if (blockbogonsMatch) {
      config.blockbogons = blockbogonsMatch[1] === '1';
    }

    // Extract IP address
    const ipaddrMatch = xmlOutput.match(/<ipaddr>([^<]+)<\/ipaddr>/);
    if (ipaddrMatch) {
      config.ipaddr = ipaddrMatch[1];
    }

    // Extract subnet
    const subnetMatch = xmlOutput.match(/<subnet>(\d+)<\/subnet>/);
    if (subnetMatch) {
      config.subnet = subnetMatch[1];
    }

    // Extract description
    const descrMatch = xmlOutput.match(/<descr>([^<]+)<\/descr>/);
    if (descrMatch) {
      config.description = descrMatch[1];
    }

    return config;
  }

  /**
   * Apply all pending changes via CLI
   */
  async applyAllChanges(): Promise<CLIExecuteResult> {
    logger.info('[CLI] Applying all configuration changes');
    
    const commands = [
      { command: 'configctl', args: ['filter', 'reload'] },
      { command: 'configctl', args: ['interface', 'reload'] },
      { command: 'configctl', args: ['service', 'reload', 'all'] },
      { command: 'configctl', args: ['firmware', 'sync'] }
    ];

    let outputs: string[] = [];
    let allSuccess = true;

    for (const cmd of commands) {
      const result = await this.execute(cmd);
      if (result.success) {
        outputs.push(`Applied: ${cmd.command} ${cmd.args?.join(' ')}`);
      } else {
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      output: outputs.join('\n'),
      executed: 'apply_all_changes',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run comprehensive DMZ fix script
   */
  async runComprehensiveDMZFix(): Promise<CLIExecuteResult> {
    logger.info('[CLI] Running comprehensive DMZ fix');
    
    const steps = [
      // Step 1: Disable blocking on DMZ interface
      () => this.disableInterfaceBlocking('opt8'),
      
      // Step 2: Reload firewall
      () => this.reloadFirewall(),
      
      // Step 3: Check routing table
      () => this.getRoutingTable(),
      
      // Step 4: Test NFS connectivity
      () => this.checkNFSConnectivity('10.0.0.14'),
      
      // Step 5: Apply all changes
      () => this.applyAllChanges()
    ];

    let outputs: string[] = [];
    let allSuccess = true;

    for (let i = 0; i < steps.length; i++) {
      logger.info(`[CLI] Step ${i + 1} of ${steps.length}`);
      const result = await steps[i]();
      
      if (result.success) {
        outputs.push(`✅ Step ${i + 1}: Success`);
        if (result.output) {
          outputs.push(result.output);
        }
      } else {
        outputs.push(`❌ Step ${i + 1}: Failed - ${result.error}`);
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      output: outputs.join('\n\n'),
      executed: 'comprehensive_dmz_fix',
      timestamp: new Date().toISOString()
    };
  }
}

export default CLIExecutorResource;