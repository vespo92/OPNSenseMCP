#!/usr/bin/env ts-node

// Fix DMZ NAT issue - Creates no-NAT rules for inter-VLAN traffic
import { OPNSenseAPIClient } from '../../src/api/client.js';
import { NATResource } from '../../src/resources/firewall/nat.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixDMZNAT() {
  console.log('=== DMZ NAT Fix Script ===\n');
  console.log('This script will fix the DMZ NAT issue by:');
  console.log('1. Setting NAT mode to hybrid (if needed)');
  console.log('2. Creating no-NAT exception rules for inter-VLAN traffic');
  console.log('3. Applying the NAT configuration\n');

  // Initialize API client
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: process.env.OPNSENSE_VERIFY_SSL !== 'false'
  });

  // Test connection
  const connectionTest = await client.testConnection();
  if (!connectionTest.success) {
    console.error('Failed to connect to OPNsense:', connectionTest.error);
    process.exit(1);
  }
  console.log(`✅ Connected to OPNsense ${connectionTest.version}\n`);

  // Initialize NAT resource
  const natResource = new NATResource(client);

  try {
    // Check current state
    console.log('Checking current NAT configuration...');
    const currentMode = await natResource.getOutboundMode();
    const currentRules = await natResource.listOutboundRules();
    
    console.log(`Current NAT mode: ${currentMode}`);
    console.log(`Current outbound rules: ${currentRules.length}`);
    
    // Check for existing fix rules
    const existingFixes = currentRules.filter(r => 
      r.description?.includes('MCP') || 
      r.description?.includes('Quick fix') ||
      r.description?.includes('No NAT')
    );
    
    if (existingFixes.length > 0) {
      console.log(`\n⚠️  Found ${existingFixes.length} existing fix rules:`);
      existingFixes.forEach(r => {
        console.log(`   - ${r.description}`);
      });
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>(resolve => {
        readline.question('\nDo you want to remove existing fixes and apply new ones? (y/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() === 'y') {
        console.log('\nRemoving existing fix rules...');
        const cleanup = await natResource.cleanupDMZNATFix();
        console.log(`Removed ${cleanup.deletedCount} existing rules`);
      } else {
        console.log('Keeping existing rules.');
      }
    }
    
    // Apply the fix
    console.log('\nApplying DMZ NAT fix...');
    const result = await natResource.fixDMZNAT({
      dmzNetwork: '10.0.6.0/24',
      lanNetwork: '10.0.0.0/24',
      otherInternalNetworks: [
        '10.0.2.0/24',  // IoT VLAN
        '10.0.4.0/24'   // Guest VLAN
      ]
    });
    
    if (result.success) {
      console.log('\n✅ DMZ NAT fix applied successfully!');
      console.log(result.message);
      console.log('\nCreated rules:');
      result.rulesCreated.forEach(rule => {
        console.log(`   - ${rule}`);
      });
      
      // Verify the fix
      console.log('\nVerifying configuration...');
      const newMode = await natResource.getOutboundMode();
      const newRules = await natResource.listOutboundRules();
      const mcpRules = newRules.filter(r => r.description?.includes('MCP'));
      
      console.log(`NAT mode: ${newMode}`);
      console.log(`Total rules: ${newRules.length}`);
      console.log(`MCP fix rules: ${mcpRules.length}`);
      
      console.log('\n✅ DMZ NAT issue has been fixed!');
      console.log('\nInter-VLAN routing should now work correctly:');
      console.log('- DMZ (10.0.6.0/24) can reach LAN (10.0.0.0/24) without NAT');
      console.log('- DMZ can reach IoT (10.0.2.0/24) without NAT');
      console.log('- DMZ can reach Guest (10.0.4.0/24) without NAT');
      console.log('- Return traffic will work properly');
      
    } else {
      console.error('\n❌ Failed to apply DMZ NAT fix:');
      console.error(result.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error during DMZ NAT fix:', error);
    process.exit(1);
  }
  
  console.log('\n=== DMZ NAT Fix Complete ===');
}

// Run the fix
fixDMZNAT().catch(console.error);