// SSH Executor Resource for OPNsense
// Provides direct SSH access to OPNsense for CLI command execution
// This enables full automation of all OPNsense settings including those not available via API

import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from '../../utils/logger.js';
import { EventEmitter } from 'events';

export interface SSHConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  privateKeyPath?: string;
  passphrase?: string;
  timeout?: number;
  keepaliveInterval?: number;
  readyTimeout?: number;
  algorithms?: any; // SSH2 algorithm configuration
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  duration: number;
  command: string;
  timestamp: string;
}

export interface BatchCommandResult {
  success: boolean;
  results: CommandResult[];
  totalDuration: number;
  timestamp: string;
}

// Command whitelist for security
const COMMAND_WHITELIST = [
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
  'cat',
  'grep',
  'sed',
  'awk',
  'cp',
  'mv',
  'rm',
  'ls',
  'pwd',
  'whoami',
  'date',
  'uptime',
  'df',
  'du',
  'ps',
  'top',
  'kill',
  'service',
  'sysctl',
  '/usr/local/etc/rc.reload_all',
  '/usr/local/opnsense/scripts/'
];

export class SSHExecutor extends EventEmitter {
  private config: SSHConfig;
  private client: Client | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  private lastActivity: number = Date.now();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private commandQueue: Array<{
    command: string;
    resolve: (result: CommandResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingQueue: boolean = false;
  private debugMode: boolean = process.env.MCP_DEBUG === 'true' || process.env.DEBUG_SSH === 'true';

  constructor(config?: Partial<SSHConfig>) {
    super();
    
    // Build configuration from environment variables and provided config
    this.config = this.buildConfig(config);
    
    // Set up auto-disconnect after idle time
    setInterval(() => {
      if (this.isConnected && Date.now() - this.lastActivity > 300000) { // 5 minutes idle
        this.disconnect();
      }
    }, 60000); // Check every minute
  }

  /**
   * Build SSH configuration from environment and provided config
   */
  private buildConfig(config?: Partial<SSHConfig>): SSHConfig {
    const defaultConfig: SSHConfig = {
      host: process.env.OPNSENSE_SSH_HOST || process.env.OPNSENSE_HOST?.replace(/^https?:\/\//, '').split(':')[0] || 'opnsense.local',
      port: parseInt(process.env.OPNSENSE_SSH_PORT || '22'),
      username: process.env.OPNSENSE_SSH_USERNAME || 'root',
      password: process.env.OPNSENSE_SSH_PASSWORD,
      privateKeyPath: process.env.OPNSENSE_SSH_KEY_PATH || join(homedir(), '.ssh', 'id_rsa'),
      passphrase: process.env.OPNSENSE_SSH_PASSPHRASE,
      timeout: parseInt(process.env.OPNSENSE_SSH_TIMEOUT || '30000'),
      keepaliveInterval: parseInt(process.env.OPNSENSE_SSH_KEEPALIVE || '10000'),
      readyTimeout: parseInt(process.env.OPNSENSE_SSH_READY_TIMEOUT || '20000'),
      algorithms: {
        kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group-exchange-sha256'],
        cipher: ['aes128-gcm', 'aes128-gcm@openssh.com', 'aes256-gcm', 'aes256-gcm@openssh.com'],
        serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'],
        hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1']
      }
    };

    return { ...defaultConfig, ...config };
  }

  /**
   * Connect to OPNsense via SSH
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        this.client = new Client();
        
        // Load private key if configured
        let privateKey: Buffer | undefined;
        if (this.config.privateKeyPath && !this.config.password) {
          try {
            privateKey = await fs.readFile(this.config.privateKeyPath);
          } catch (err) {
            logger.warn(`[SSH] Could not load private key from ${this.config.privateKeyPath}, falling back to password auth`);
          }
        }

        const connectConfig: ConnectConfig = {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          password: this.config.password,
          privateKey: privateKey || this.config.privateKey,
          passphrase: this.config.passphrase,
          timeout: this.config.timeout,
          keepaliveInterval: this.config.keepaliveInterval,
          readyTimeout: this.config.readyTimeout,
          algorithms: this.config.algorithms,
          // Accept any host key on first connect (like ssh -o StrictHostKeyChecking=no)
          hostVerifier: () => true
        };

        // Set up event handlers
        this.client.on('ready', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          logger.info(`[SSH] Connected to ${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.client.on('error', (err: Error) => {
          logger.error('[SSH] Connection error:', err);
          this.emit('error', err);
          if (!this.isConnected) {
            reject(err);
          } else {
            this.handleDisconnect();
          }
        });

        this.client.on('end', () => {
          logger.info('[SSH] Connection ended');
          this.handleDisconnect();
        });

        this.client.on('close', () => {
          logger.info('[SSH] Connection closed');
          this.handleDisconnect();
        });

        // Connect
        if (this.debugMode) {
          logger.debug(`[SSH] Connecting to ${this.config.host}:${this.config.port} as ${this.config.username}`);
        }
        
        this.client.connect(connectConfig);
        
      } catch (err) {
        logger.error('[SSH] Failed to initiate connection:', err);
        reject(err);
      }
    });
  }

  /**
   * Handle disconnection and potential reconnection
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.client = null;
    this.emit('disconnected');
    
    // Process any queued commands with error
    while (this.commandQueue.length > 0) {
      const item = this.commandQueue.shift();
      if (item) {
        item.reject(new Error('SSH connection lost'));
      }
    }
  }

  /**
   * Disconnect from SSH
   */
  disconnect(): void {
    if (this.client && this.isConnected) {
      this.client.end();
      this.isConnected = false;
      this.client = null;
      logger.info('[SSH] Disconnected');
    }
  }

  /**
   * Execute a single command via SSH
   */
  async execute(command: string, options?: { timeout?: number; sudo?: boolean }): Promise<CommandResult> {
    // Update last activity
    this.lastActivity = Date.now();
    
    // Validate command against whitelist
    if (!this.isCommandSafe(command)) {
      logger.warn(`[SSH] Command not in whitelist: ${command}`);
      return {
        success: false,
        stdout: '',
        stderr: 'Command not in whitelist for security reasons',
        exitCode: 1,
        duration: 0,
        command,
        timestamp: new Date().toISOString()
      };
    }

    // Ensure connected
    if (!this.isConnected) {
      await this.connect();
    }

    // Add sudo if requested
    const fullCommand = options?.sudo ? `sudo ${command}` : command;
    
    if (this.debugMode) {
      logger.debug(`[SSH] Executing: ${fullCommand}`);
    }

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('SSH client not initialized'));
        return;
      }

      const startTime = Date.now();
      const timeout = options?.timeout || this.config.timeout || 30000;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        resolve({
          success: false,
          stdout,
          stderr: stderr + '\nCommand timed out',
          exitCode: -1,
          signal: 'TIMEOUT',
          duration: Date.now() - startTime,
          command: fullCommand,
          timestamp: new Date().toISOString()
        });
      }, timeout);

      this.client.exec(fullCommand, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }

        stream.on('close', (code: number, signal?: string) => {
          clearTimeout(timer);
          if (!timedOut) {
            const duration = Date.now() - startTime;
            const result: CommandResult = {
              success: code === 0,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: code,
              signal,
              duration,
              command: fullCommand,
              timestamp: new Date().toISOString()
            };
            
            if (this.debugMode) {
              logger.debug(`[SSH] Command completed in ${duration}ms with exit code ${code}`);
              if (stdout) logger.debug(`[SSH] stdout: ${stdout.substring(0, 200)}`);
              if (stderr) logger.debug(`[SSH] stderr: ${stderr.substring(0, 200)}`);
            }
            
            resolve(result);
          }
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeBatch(commands: string[], options?: { stopOnError?: boolean; timeout?: number }): Promise<BatchCommandResult> {
    const startTime = Date.now();
    const results: CommandResult[] = [];
    let allSuccess = true;

    for (const command of commands) {
      try {
        const result = await this.execute(command, { timeout: options?.timeout });
        results.push(result);
        
        if (!result.success) {
          allSuccess = false;
          if (options?.stopOnError) {
            break;
          }
        }
      } catch (err) {
        const errorResult: CommandResult = {
          success: false,
          stdout: '',
          stderr: err instanceof Error ? err.message : 'Unknown error',
          exitCode: -1,
          duration: 0,
          command,
          timestamp: new Date().toISOString()
        };
        results.push(errorResult);
        allSuccess = false;
        
        if (options?.stopOnError) {
          break;
        }
      }
    }

    return {
      success: allSuccess,
      results,
      totalDuration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute a command with retries
   */
  async executeWithRetry(command: string, maxRetries: number = 3, retryDelay: number = 1000): Promise<CommandResult> {
    let lastError: Error | null = null;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const result = await this.execute(command);
        if (result.success) {
          return result;
        }
        
        // If command failed but executed, don't retry
        if (result.exitCode !== -1) {
          return result;
        }
        
        lastError = new Error(result.stderr || 'Command failed');
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
      }
      
      if (i < maxRetries) {
        logger.warn(`[SSH] Retry ${i + 1}/${maxRetries} for command: ${command}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Reconnect if not connected
        if (!this.isConnected) {
          try {
            await this.connect();
          } catch (connectErr) {
            logger.error('[SSH] Failed to reconnect:', connectErr);
          }
        }
      }
    }
    
    return {
      success: false,
      stdout: '',
      stderr: lastError?.message || 'Max retries exceeded',
      exitCode: -1,
      duration: 0,
      command,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if command is safe to execute
   */
  private isCommandSafe(command: string): boolean {
    // Allow any command that starts with a whitelisted command
    return COMMAND_WHITELIST.some(safe => 
      command.startsWith(safe) || 
      command.startsWith(`sudo ${safe}`)
    );
  }

  // ===== HIGH-LEVEL OPNSENSE OPERATIONS =====

  /**
   * Fix interface blocking settings via SSH
   */
  async fixInterfaceBlocking(interfaceName: string): Promise<CommandResult> {
    logger.info(`[SSH] Fixing interface blocking for ${interfaceName}`);
    
    const commands = [
      `configctl interface set blockpriv ${interfaceName} 0`,
      `configctl interface set blockbogons ${interfaceName} 0`,
      `configctl interface reconfigure ${interfaceName}`,
      'configctl filter reload'
    ];
    
    const batch = await this.executeBatch(commands, { stopOnError: false });
    
    return {
      success: batch.success,
      stdout: batch.results.map(r => r.stdout).filter(s => s).join('\n'),
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'fix_interface_blocking',
      timestamp: batch.timestamp
    };
  }

  /**
   * Fix DMZ routing completely via SSH
   */
  async fixDMZRouting(): Promise<CommandResult> {
    logger.info('[SSH] Applying comprehensive DMZ routing fix');
    
    const commands = [
      // Backup config first
      'cp /conf/config.xml /conf/config.xml.backup',
      
      // Fix interface blocking
      'configctl interface set blockpriv opt8 0',
      'configctl interface set blockbogons opt8 0',
      
      // Also fix for other interfaces that might affect routing
      'configctl interface set blockpriv opt1 0',  // LAN
      'configctl interface set blockbogons opt1 0',
      
      // Reconfigure interfaces
      'configctl interface reconfigure opt8',
      'configctl interface reconfigure opt1',
      
      // Add static routes if needed
      'route add -net 10.0.0.0/24 10.0.6.1 2>/dev/null || true',
      'route add -net 10.0.6.0/24 10.0.0.1 2>/dev/null || true',
      
      // Reload firewall with proper rules
      'pfctl -f /tmp/rules.debug',
      'configctl filter reload',
      
      // Ensure filter is synced
      'configctl filter sync',
      
      // Reload all services to apply changes
      '/usr/local/etc/rc.reload_all'
    ];
    
    const batch = await this.executeBatch(commands, { stopOnError: false });
    
    return {
      success: batch.success,
      stdout: `DMZ Routing Fix Results:\n${batch.results.map((r, i) => 
        `${r.success ? '✅' : '❌'} Step ${i + 1}: ${commands[i]}\n${r.stdout || r.stderr}`
      ).join('\n')}`,
      stderr: batch.results.filter(r => !r.success).map(r => r.stderr).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'fix_dmz_routing',
      timestamp: batch.timestamp
    };
  }

  /**
   * Enable inter-VLAN routing via SSH
   */
  async enableInterVLANRouting(): Promise<CommandResult> {
    logger.info('[SSH] Enabling inter-VLAN routing');
    
    const commands = [
      // Enable IP forwarding
      'sysctl net.inet.ip.forwarding=1',
      'sysctl net.inet6.ip6.forwarding=1',
      
      // Disable blocking on all VLAN interfaces
      'for iface in opt1 opt2 opt3 opt4 opt5 opt6 opt7 opt8; do configctl interface set blockpriv $iface 0; done',
      'for iface in opt1 opt2 opt3 opt4 opt5 opt6 opt7 opt8; do configctl interface set blockbogons $iface 0; done',
      
      // Reconfigure all interfaces
      'for iface in opt1 opt2 opt3 opt4 opt5 opt6 opt7 opt8; do configctl interface reconfigure $iface; done',
      
      // Reload firewall
      'configctl filter reload',
      'pfctl -f /tmp/rules.debug',
      
      // Apply all changes
      '/usr/local/etc/rc.reload_all'
    ];
    
    const batch = await this.executeBatch(commands, { stopOnError: false });
    
    return {
      success: batch.success,
      stdout: batch.results.map(r => r.stdout).filter(s => s).join('\n'),
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'enable_intervlan_routing',
      timestamp: batch.timestamp
    };
  }

  /**
   * Get routing table via SSH
   */
  async getRoutingTable(): Promise<CommandResult> {
    const result = await this.execute('netstat -rn');
    
    if (result.success && result.stdout) {
      // Parse routing table
      const routes = this.parseRoutingTable(result.stdout);
      result.stdout = JSON.stringify(routes, null, 2);
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
            interface: parts[3],
            refs: parts[4],
            use: parts[5]
          });
        }
      }
    }
    
    return routes;
  }

  /**
   * Show packet filter rules via SSH
   */
  async showPfRules(options?: { verbose?: boolean }): Promise<CommandResult> {
    const command = options?.verbose ? 'pfctl -s rules -v' : 'pfctl -s rules';
    return this.execute(command);
  }

  /**
   * Backup configuration via SSH
   */
  async backupConfig(backupName?: string): Promise<CommandResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = backupName || `config-backup-${timestamp}.xml`;
    
    const commands = [
      `cp /conf/config.xml /conf/backup/${filename}`,
      `ls -la /conf/backup/${filename}`
    ];
    
    const batch = await this.executeBatch(commands);
    
    return {
      success: batch.success,
      stdout: `Configuration backed up to /conf/backup/${filename}`,
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'backup_config',
      timestamp: batch.timestamp
    };
  }

  /**
   * Restore configuration via SSH
   */
  async restoreConfig(backupPath: string): Promise<CommandResult> {
    const commands = [
      `cp /conf/config.xml /conf/config.xml.before-restore`,
      `cp ${backupPath} /conf/config.xml`,
      'configctl firmware reload',
      '/usr/local/etc/rc.reload_all'
    ];
    
    const batch = await this.executeBatch(commands, { stopOnError: true });
    
    return {
      success: batch.success,
      stdout: batch.success ? `Configuration restored from ${backupPath}` : 'Restore failed',
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'restore_config',
      timestamp: batch.timestamp
    };
  }

  /**
   * Check NFS connectivity
   */
  async checkNFSConnectivity(targetIP: string = '10.0.0.14'): Promise<CommandResult> {
    const commands = [
      `ping -c 1 ${targetIP}`,
      `showmount -e ${targetIP}`
    ];
    
    const batch = await this.executeBatch(commands);
    
    // Parse NFS exports if successful
    if (batch.success && batch.results[1]?.stdout) {
      const exports = this.parseNFSExports(batch.results[1].stdout);
      batch.results[1].stdout = JSON.stringify(exports, null, 2);
    }
    
    return {
      success: batch.success,
      stdout: batch.results.map(r => r.stdout).filter(s => s).join('\n\n'),
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'check_nfs_connectivity',
      timestamp: batch.timestamp
    };
  }

  /**
   * Parse NFS exports output
   */
  private parseNFSExports(output: string): any[] {
    const lines = output.split('\n');
    const exports = [];
    
    for (const line of lines) {
      if (line.includes('/')) {
        const match = line.match(/^(\/[^\s]+)\s+(.+)$/);
        if (match) {
          exports.push({
            path: match[1],
            allowed: match[2]
          });
        }
      }
    }
    
    return exports;
  }

  /**
   * Modify config.xml directly via SSH
   */
  async modifyConfigXML(xpath: string, value: string): Promise<CommandResult> {
    const commands = [
      'cp /conf/config.xml /conf/config.xml.backup',
      `sed -i '' 's|${xpath}|${value}|g' /conf/config.xml`,
      'configctl firmware reload'
    ];
    
    const batch = await this.executeBatch(commands, { stopOnError: true });
    
    return {
      success: batch.success,
      stdout: batch.success ? 'Configuration modified successfully' : 'Modification failed',
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'modify_config_xml',
      timestamp: batch.timestamp
    };
  }

  /**
   * Get system status via SSH
   */
  async getSystemStatus(): Promise<CommandResult> {
    const commands = [
      'uptime',
      'df -h',
      'top -b -n 1 | head -20',
      'pfctl -s info',
      'netstat -s | head -20'
    ];
    
    const batch = await this.executeBatch(commands);
    
    const sections = [
      '=== System Uptime ===',
      batch.results[0]?.stdout || '',
      '\n=== Disk Usage ===',
      batch.results[1]?.stdout || '',
      '\n=== Process Status ===',
      batch.results[2]?.stdout || '',
      '\n=== Firewall Status ===',
      batch.results[3]?.stdout || '',
      '\n=== Network Statistics ===',
      batch.results[4]?.stdout || ''
    ];
    
    return {
      success: batch.success,
      stdout: sections.join('\n'),
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'get_system_status',
      timestamp: batch.timestamp
    };
  }

  /**
   * Test connectivity between VLANs
   */
  async testVLANConnectivity(sourceInterface: string, targetIP: string): Promise<CommandResult> {
    const commands = [
      `ping -c 3 -S \`ifconfig ${sourceInterface} | grep 'inet ' | awk '{print $2}'\` ${targetIP}`,
      `traceroute -i ${sourceInterface} -m 5 ${targetIP}`
    ];
    
    const batch = await this.executeBatch(commands);
    
    return {
      success: batch.success,
      stdout: batch.results.map(r => r.stdout).filter(s => s).join('\n\n'),
      stderr: batch.results.map(r => r.stderr).filter(s => s).join('\n'),
      exitCode: batch.success ? 0 : 1,
      duration: batch.totalDuration,
      command: 'test_vlan_connectivity',
      timestamp: batch.timestamp
    };
  }

  /**
   * Apply quick DMZ fix (streamlined version)
   */
  async quickDMZFix(): Promise<CommandResult> {
    logger.info('[SSH] Applying quick DMZ fix');
    
    // Single command chain for speed
    const command = [
      'configctl interface set blockpriv opt8 0',
      'configctl interface set blockbogons opt8 0',
      'configctl interface reconfigure opt8',
      'configctl filter reload'
    ].join(' && ');
    
    return this.execute(command, { timeout: 60000 });
  }
}

export default SSHExecutor;