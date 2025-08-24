#!/usr/bin/env node

/**
 * Enable Inter-VLAN Routing Script
 * 
 * This script enables inter-VLAN routing in OPNsense by:
 * 1. Updating system-level firewall settings
 * 2. Configuring interface settings (removing "Block private networks")
 * 3. Creating necessary firewall rules for VLAN communication
 */

import { OPNSenseAPIClient } from '../../src/api/client.js';
import SystemSettingsResource from '../../src/resources/system/settings.js';
import InterfaceConfigResource from '../../src/resources/network/interfaces.js';
import { FirewallRuleResource } from '../../src/resources/firewall/rule.js';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const API_CONFIG = {
  host: process.env.OPNSENSE_API_URL || 'https://10.0.0.1',
  apiKey: process.env.OPNSENSE_API_KEY || '',
  apiSecret: process.env.OPNSENSE_API_SECRET || '',
  verifySsl: process.env.OPNSENSE_VERIFY_SSL !== 'false',
  debugMode: true
};

// Target configuration for DMZ to LAN routing
const DMZ_CONFIG = {
  interface: 'opt8',           // DMZ interface
  subnet: '10.0.6.0/24',       // DMZ subnet
  targetSubnet: '10.0.0.0/24', // LAN subnet
  truenasIP: '10.0.0.14'       // TrueNAS server IP
};

async function main() {
  console.log('===========================================');
  console.log('    OPNsense Inter-VLAN Routing Enabler   ');
  console.log('===========================================\n');

  // Initialize API client
  const client = new OPNSenseAPIClient(API_CONFIG);

  // Test connection
  console.log('Testing API connection...');
  const connectionTest = await client.testConnection();
  if (!connectionTest.success) {
    console.error('Failed to connect to OPNsense API:', connectionTest.error);
    process.exit(1);
  }
  console.log(`✓ Connected to OPNsense ${connectionTest.version}\n`);

  // Initialize resources
  const systemSettings = new SystemSettingsResource(client);
  const interfaceConfig = new InterfaceConfigResource(client);
  const firewallRules = new FirewallRuleResource(client);

  // Step 1: Enable system-level inter-VLAN routing
  console.log('Step 1: Enabling system-level inter-VLAN routing...');
  console.log('----------------------------------------');
  
  const systemSuccess = await systemSettings.enableInterVLANRouting();
  if (systemSuccess) {
    console.log('✓ System-level inter-VLAN routing enabled');
  } else {
    console.log('✗ Failed to enable system-level settings');
    console.log('  Continuing with interface configuration...');
  }
  console.log();

  // Step 2: Configure interfaces for inter-VLAN routing
  console.log('Step 2: Configuring interfaces...');
  console.log('----------------------------------------');

  // Configure DMZ interface specifically
  console.log(`Configuring DMZ interface (${DMZ_CONFIG.interface})...`);
  const dmzConfigSuccess = await interfaceConfig.configureDMZInterface(DMZ_CONFIG.interface);
  if (dmzConfigSuccess) {
    console.log(`✓ DMZ interface ${DMZ_CONFIG.interface} configured`);
  } else {
    console.log(`✗ Failed to configure DMZ interface ${DMZ_CONFIG.interface}`);
  }

  // Also ensure LAN interface allows inter-VLAN traffic
  console.log('Configuring LAN interface...');
  const lanConfigSuccess = await interfaceConfig.enableInterVLANRoutingOnInterface('lan');
  if (lanConfigSuccess) {
    console.log('✓ LAN interface configured');
  } else {
    console.log('✗ Failed to configure LAN interface');
  }
  console.log();

  // Step 3: Create firewall rules for DMZ to LAN communication
  console.log('Step 3: Creating firewall rules...');
  console.log('----------------------------------------');

  // Rule 1: Allow DMZ to LAN traffic
  console.log('Creating DMZ to LAN allow rule...');
  try {
    const dmzToLanRule = await firewallRules.create({
      enabled: '1',
      action: 'pass',
      quick: '1',
      interface: DMZ_CONFIG.interface,
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'any',
      source_net: DMZ_CONFIG.subnet,
      destination_net: DMZ_CONFIG.targetSubnet,
      description: 'Allow DMZ to LAN traffic (Inter-VLAN routing)'
    });
    console.log(`✓ DMZ to LAN rule created: ${dmzToLanRule.uuid}`);
  } catch (error: any) {
    console.log(`✗ Failed to create DMZ to LAN rule: ${error.message}`);
  }

  // Rule 2: Allow return traffic from LAN to DMZ
  console.log('Creating LAN to DMZ allow rule...');
  try {
    const lanToDmzRule = await firewallRules.create({
      enabled: '1',
      action: 'pass',
      quick: '1',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'any',
      source_net: DMZ_CONFIG.targetSubnet,
      destination_net: DMZ_CONFIG.subnet,
      description: 'Allow LAN to DMZ traffic (Inter-VLAN routing)'
    });
    console.log(`✓ LAN to DMZ rule created: ${lanToDmzRule.uuid}`);
  } catch (error: any) {
    console.log(`✗ Failed to create LAN to DMZ rule: ${error.message}`);
  }

  // Rule 3: Specific NFS rules for TrueNAS access
  console.log('Creating NFS rules for TrueNAS access...');
  try {
    const nfsRules = await firewallRules.createNFSRules({
      interface: DMZ_CONFIG.interface,
      sourceNetwork: DMZ_CONFIG.subnet,
      truenasIP: DMZ_CONFIG.truenasIP
    });
    console.log(`✓ NFS TCP rule created: ${nfsRules.tcp}`);
    console.log(`✓ NFS UDP rule created: ${nfsRules.udp}`);
  } catch (error: any) {
    console.log(`✗ Failed to create NFS rules: ${error.message}`);
  }
  console.log();

  // Step 4: Verify configuration
  console.log('Step 4: Verifying configuration...');
  console.log('----------------------------------------');

  // Check system settings
  const currentSettings = await systemSettings.getFirewallSettings();
  if (currentSettings) {
    console.log('System settings:');
    console.log(`  Block private networks: ${currentSettings.blockprivatenetworks === '0' ? 'Disabled ✓' : 'Enabled ✗'}`);
    console.log(`  Block bogons: ${currentSettings.blockbogons === '0' ? 'Disabled ✓' : 'Enabled ✗'}`);
    console.log(`  Allow inter-LAN traffic: ${currentSettings.allowinterlantraffic === '1' ? 'Enabled ✓' : 'Disabled ✗'}`);
  }

  // Check interface configuration
  const dmzInterface = await interfaceConfig.getInterfaceConfig(DMZ_CONFIG.interface);
  if (dmzInterface) {
    console.log(`\nDMZ Interface (${DMZ_CONFIG.interface}) settings:`);
    console.log(`  Block private networks: ${dmzInterface.blockpriv === '0' ? 'Disabled ✓' : 'Enabled ✗'}`);
    console.log(`  Block bogons: ${dmzInterface.blockbogons === '0' ? 'Disabled ✓' : 'Enabled ✗'}`);
  }

  // Check firewall rules
  const allRules = await firewallRules.list();
  const interVlanRules = allRules.filter(r => 
    r.description?.toLowerCase().includes('inter-vlan') ||
    r.description?.toLowerCase().includes('dmz to lan') ||
    r.description?.toLowerCase().includes('lan to dmz')
  );
  console.log(`\nFirewall rules for inter-VLAN routing: ${interVlanRules.length} rules found`);

  console.log('\n===========================================');
  console.log('         Configuration Complete!           ');
  console.log('===========================================');
  console.log('\nNext steps:');
  console.log('1. Test connectivity from DMZ to LAN:');
  console.log(`   ping ${DMZ_CONFIG.truenasIP} (from DMZ host)`);
  console.log('2. Test NFS mount:');
  console.log(`   showmount -e ${DMZ_CONFIG.truenasIP} (from DMZ host)`);
  console.log('3. If issues persist, check:');
  console.log('   - Gateway settings on DMZ hosts');
  console.log('   - Static routes in OPNsense');
  console.log('   - NAT rules that might interfere');
}

// Run the script
main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});