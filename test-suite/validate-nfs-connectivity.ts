#!/usr/bin/env tsx
/**
 * NFS Connectivity Validation Script
 * Validates and tests NFS connectivity between DMZ and TrueNAS
 */

import { config } from 'dotenv';
import { OPNSenseAPIClient } from '../src/api/client.js';
import { FirewallRuleResource } from '../src/resources/firewall/rule.js';

// Load environment variables
config();

// Network configuration
const NETWORK_CONFIG = {
  DMZ: {
    interface: process.env.DMZ_INTERFACE || 'igc3_vlan6',
    network: '10.0.6.0/24',
    testNode: '10.0.6.2'
  },
  TRUENAS: {
    ip: '10.0.0.14',
    nfsPath: '/mnt/tank/kubernetes'
  }
};

class NFSValidator {
  private client: OPNSenseAPIClient;
  private firewall: FirewallRuleResource;

  constructor() {
    this.client = new OPNSenseAPIClient({
      host: process.env.OPNSENSE_HOST!,
      apiKey: process.env.OPNSENSE_API_KEY!,
      apiSecret: process.env.OPNSENSE_API_SECRET!,
      verifySsl: false
    });
    
    this.firewall = new FirewallRuleResource(this.client);
  }

  /**
   * Check existing NFS rules
   */
  async checkExistingRules() {
    console.log('📋 Checking Existing NFS Rules');
    console.log('================================\n');
    
    const validation = await this.firewall.validateNFSConnectivity();
    
    if (!validation.rulesExist) {
      console.log('❌ No NFS rules found!\n');
      return false;
    }
    
    console.log(`✅ Found ${validation.details.nfsRules} NFS-related rules:\n`);
    
    validation.details.rules.forEach((rule: any, index: number) => {
      console.log(`Rule ${index + 1}: ${rule.description}`);
      console.log(`  UUID: ${rule.uuid}`);
      console.log(`  Interface: ${rule.interface}`);
      console.log(`  Direction: IN`);
      console.log(`  Protocol: ${rule.protocol}`);
      console.log(`  Source: ${rule.source}`);
      console.log(`  Destination: ${rule.destination}`);
      console.log(`  Ports: ${rule.ports}`);
      console.log(`  Status: ${rule.enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log('');
    });
    
    return true;
  }

  /**
   * Create missing NFS rules
   */
  async createMissingRules() {
    console.log('🔧 Creating NFS Rules');
    console.log('======================\n');
    
    const validation = await this.firewall.validateNFSConnectivity();
    
    if (validation.rulesExist) {
      console.log('ℹ️  NFS rules already exist. Skipping creation.\n');
      return;
    }
    
    console.log('Creating NFS connectivity rules...\n');
    
    try {
      const rules = await this.firewall.createNFSRules({
        interface: NETWORK_CONFIG.DMZ.interface,
        sourceNetwork: NETWORK_CONFIG.DMZ.network,
        truenasIP: NETWORK_CONFIG.TRUENAS.ip
      });
      
      console.log('✅ NFS rules created successfully:');
      console.log(`  TCP Rule: ${rules.tcp}`);
      console.log(`  UDP Rule: ${rules.udp}\n`);
      
    } catch (error) {
      console.error('❌ Failed to create NFS rules:', error);
      throw error;
    }
  }

  /**
   * Generate test commands
   */
  generateTestCommands() {
    console.log('🧪 Test Commands');
    console.log('=================\n');
    
    console.log('Run these commands from the DMZ node to test NFS connectivity:\n');
    
    console.log('1. Test basic connectivity:');
    console.log(`   ping ${NETWORK_CONFIG.TRUENAS.ip}\n`);
    
    console.log('2. Test RPC portmapper (port 111):');
    console.log(`   nc -zv ${NETWORK_CONFIG.TRUENAS.ip} 111`);
    console.log(`   rpcinfo -p ${NETWORK_CONFIG.TRUENAS.ip}\n`);
    
    console.log('3. Test NFS port (2049):');
    console.log(`   nc -zv ${NETWORK_CONFIG.TRUENAS.ip} 2049\n`);
    
    console.log('4. List available NFS exports:');
    console.log(`   showmount -e ${NETWORK_CONFIG.TRUENAS.ip}\n`);
    
    console.log('5. Test NFS mount:');
    console.log(`   mkdir -p /mnt/test-nfs`);
    console.log(`   mount -t nfs ${NETWORK_CONFIG.TRUENAS.ip}:${NETWORK_CONFIG.TRUENAS.nfsPath} /mnt/test-nfs`);
    console.log(`   ls -la /mnt/test-nfs`);
    console.log(`   umount /mnt/test-nfs\n`);
    
    console.log('6. For Kubernetes nodes, add to /etc/fstab:');
    console.log(`   ${NETWORK_CONFIG.TRUENAS.ip}:${NETWORK_CONFIG.TRUENAS.nfsPath} /mnt/nfs nfs defaults,_netdev 0 0\n`);
  }

  /**
   * Check firewall rule status
   */
  async checkRuleStatus() {
    console.log('📊 Firewall Rule Status');
    console.log('========================\n');
    
    try {
      // Get all rules
      const allRules = await this.firewall.list();
      console.log(`Total firewall rules: ${allRules.length}\n`);
      
      // Check DMZ interface rules
      const dmzRules = allRules.filter(r => 
        r.interface === NETWORK_CONFIG.DMZ.interface ||
        r.interface?.toLowerCase().includes('dmz') ||
        r.interface?.includes('vlan6')
      );
      
      console.log(`DMZ Interface (${NETWORK_CONFIG.DMZ.interface}) rules: ${dmzRules.length}`);
      
      if (dmzRules.length > 0) {
        console.log('\nDMZ Rules Summary:');
        dmzRules.forEach(rule => {
          const status = rule.enabled === '1' ? '✅' : '❌';
          console.log(`  ${status} ${rule.action.toUpperCase()} ${rule.protocol} ${rule.source_net} -> ${rule.destination_net}:${rule.destination_port || 'any'}`);
          if (rule.description) {
            console.log(`      "${rule.description}"`);
          }
        });
      }
      
      // Check for potential issues
      console.log('\n🔍 Diagnostics:');
      
      // Check if interface is recognized
      const options = await this.firewall.getOptions();
      if (options?.interface?.values) {
        const validInterfaces = Object.keys(options.interface.values);
        const interfaceValid = validInterfaces.some(i => 
          i === NETWORK_CONFIG.DMZ.interface ||
          options.interface.values[i]?.value?.includes(NETWORK_CONFIG.DMZ.interface)
        );
        
        console.log(`  Interface "${NETWORK_CONFIG.DMZ.interface}" recognized: ${interfaceValid ? '✅' : '❌'}`);
        
        if (!interfaceValid) {
          console.log('\n  ⚠️  Interface not recognized! Valid interfaces:');
          validInterfaces.forEach(i => {
            console.log(`     - ${i}: ${options.interface.values[i]?.value}`);
          });
        }
      }
      
      // Check for blocking rules
      const blockingRules = allRules.filter(r => 
        r.action === 'block' &&
        r.enabled === '1' &&
        (r.source_net === 'any' || r.source_net === NETWORK_CONFIG.DMZ.network) &&
        (r.destination_net === 'any' || r.destination_net === NETWORK_CONFIG.TRUENAS.ip)
      );
      
      if (blockingRules.length > 0) {
        console.log(`\n  ⚠️  Found ${blockingRules.length} potentially blocking rules!`);
        blockingRules.forEach(rule => {
          console.log(`     - ${rule.description || 'Unnamed rule'} (${rule.uuid})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error checking rule status:', error);
    }
  }

  /**
   * Run full validation
   */
  async runValidation() {
    console.log('🚀 NFS Connectivity Validation Tool');
    console.log('====================================');
    console.log(`OPNsense Host: ${process.env.OPNSENSE_HOST}`);
    console.log(`DMZ Interface: ${NETWORK_CONFIG.DMZ.interface}`);
    console.log(`DMZ Network: ${NETWORK_CONFIG.DMZ.network}`);
    console.log(`TrueNAS Server: ${NETWORK_CONFIG.TRUENAS.ip}`);
    console.log(`NFS Path: ${NETWORK_CONFIG.TRUENAS.nfsPath}\n`);
    
    // Check existing rules
    const hasRules = await this.checkExistingRules();
    
    if (!hasRules) {
      // Prompt to create rules
      console.log('💡 Would you like to create the missing NFS rules?');
      console.log('   Run with --create flag to automatically create rules.\n');
      
      if (process.argv.includes('--create')) {
        await this.createMissingRules();
        // Re-check after creation
        await this.checkExistingRules();
      }
    }
    
    // Check overall status
    await this.checkRuleStatus();
    
    // Generate test commands
    console.log('');
    this.generateTestCommands();
    
    // Final recommendations
    console.log('📝 Troubleshooting Tips');
    console.log('========================\n');
    console.log('If NFS mount fails after rules are in place:');
    console.log('1. Check if rules are actually applied (not just created)');
    console.log('2. Verify no higher-priority blocking rules exist');
    console.log('3. Check TrueNAS NFS service is running');
    console.log('4. Verify TrueNAS allows connections from DMZ network');
    console.log('5. Check for any NAT rules affecting traffic');
    console.log('6. Review OPNsense live firewall logs during connection attempt');
    console.log('\nTo view live firewall logs:');
    console.log('  OPNsense UI → System → Log Files → Live View → Firewall');
  }
}

// Main execution
async function main() {
  const validator = new NFSValidator();
  await validator.runValidation();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { NFSValidator };