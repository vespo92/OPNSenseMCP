#!/usr/bin/env npx tsx

/**
 * Test script to verify the firewall rule persistence fix
 * This tests the complete flow of creating, listing, and deleting rules
 */

import { OPNSenseAPIClient } from './src/api/client.js';
import { FirewallRuleResource } from './src/resources/firewall/rule.js';

// Configuration - Update these values
const CONFIG = {
  host: process.env.OPNSENSE_HOST || 'https://your-opnsense-ip',
  apiKey: process.env.OPNSENSE_API_KEY || 'your-api-key',
  apiSecret: process.env.OPNSENSE_API_SECRET || 'your-api-secret',
  verifySsl: process.env.OPNSENSE_VERIFY_SSL !== 'false'
};

async function testFirewallFix() {
  console.log('\n🔧 Testing Firewall Rule Persistence Fix');
  console.log('=========================================\n');

  // Enable debug mode
  process.env.MCP_DEBUG = 'true';

  const client = new OPNSenseAPIClient({
    ...CONFIG,
    debugMode: false  // Set to true for detailed API logs
  });

  const firewall = new FirewallRuleResource(client);

  try {
    // Test connection
    console.log('📡 Testing connection to OPNsense...');
    const conn = await client.testConnection();
    if (!conn.success) {
      console.error('❌ Cannot connect to OPNsense. Check your configuration.');
      console.log('   Host:', CONFIG.host);
      return;
    }
    console.log(`✅ Connected to ${conn.product} ${conn.version}\n`);

    // Step 1: List current rules (both methods)
    console.log('📋 Step 1: Listing current rules...');
    const initialRules = await firewall.list();
    console.log(`   Found ${initialRules.length} rules via list()`);
    
    const allRules = await firewall.getAllRules();
    console.log(`   Found ${allRules.length} rules via getAllRules()\n`);

    // Step 2: Create test rule
    console.log('➕ Step 2: Creating test rule...');
    const testRule = {
      enabled: '1',
      action: 'pass' as const,
      interface: 'lan',
      direction: 'in' as const,
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '2049',
      description: 'FIX TEST: Allow DMZ to TrueNAS NFS - ' + new Date().toISOString()
    };

    const createResult = await firewall.create(testRule);
    console.log(`   ✅ Rule created with UUID: ${createResult.uuid}\n`);

    // Step 3: Immediate verification
    console.log('🔍 Step 3: Verifying rule persistence...');
    
    // Check via direct get
    const directGet = await firewall.get(createResult.uuid);
    console.log(`   Direct get: ${directGet ? '✅ Found' : '❌ Not found'}`);
    
    // Check via list
    const listAfter = await firewall.list();
    const inList = listAfter.find(r => r.uuid === createResult.uuid);
    console.log(`   In list(): ${inList ? '✅ Found' : '❌ Not found'}`);
    
    // Check via getAllRules
    const allAfter = await firewall.getAllRules();
    const inAll = allAfter.find(r => r.uuid === createResult.uuid);
    console.log(`   In getAllRules(): ${inAll ? '✅ Found' : '❌ Not found'}`);
    
    // Summary
    const success = directGet && (inList || inAll);
    console.log(`\n   Overall: ${success ? '✅ RULE PERSISTED SUCCESSFULLY' : '❌ RULE NOT PERSISTED'}`);

    if (success) {
      console.log('\n📝 Rule Details:');
      const ruleDetails = directGet || inList || inAll;
      console.log(`   Description: ${ruleDetails.description}`);
      console.log(`   Action: ${ruleDetails.action}`);
      console.log(`   Interface: ${ruleDetails.interface}`);
      console.log(`   Source: ${ruleDetails.source_net}`);
      console.log(`   Destination: ${ruleDetails.destination_net}:${ruleDetails.destination_port}`);
    }

    // Step 4: Cleanup
    console.log('\n🧹 Step 4: Cleaning up test rule...');
    try {
      await firewall.delete(createResult.uuid);
      console.log('   ✅ Test rule deleted successfully');
      
      // Verify deletion
      const afterDelete = await firewall.get(createResult.uuid);
      if (!afterDelete) {
        console.log('   ✅ Deletion confirmed');
      } else {
        console.log('   ⚠️  Rule still exists after deletion');
      }
    } catch (error) {
      console.error('   ❌ Error deleting test rule:', error);
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    if (success) {
      console.log('✅ FIX VERIFIED: Firewall rules are persisting correctly!');
    } else {
      console.log('❌ ISSUE REMAINS: Firewall rules are not persisting');
      console.log('\nPossible causes:');
      console.log('1. OPNsense API version incompatibility');
      console.log('2. Missing permissions for the API user');
      console.log('3. Firewall filter service needs manual restart');
      console.log('\nTry manually checking in OPNsense web UI');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.log('\nMake sure to update the configuration at the top of this file');
  }
}

// Check if configuration is set
if (CONFIG.host === 'https://your-opnsense-ip' || CONFIG.apiKey === 'your-api-key') {
  console.log('⚠️  Configuration Required!\n');
  console.log('Please set the following environment variables:');
  console.log('  export OPNSENSE_HOST="https://your-opnsense-ip"');
  console.log('  export OPNSENSE_API_KEY="your-api-key"');
  console.log('  export OPNSENSE_API_SECRET="your-api-secret"');
  console.log('\nOr edit the CONFIG object in this file.');
  console.log('\nThen run: npx tsx test-firewall-fix.ts');
} else {
  // Run the test
  testFirewallFix().catch(console.error);
}