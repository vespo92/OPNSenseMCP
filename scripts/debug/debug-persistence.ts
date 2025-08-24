#!/usr/bin/env tsx
/**
 * Quick Debug Script for Firewall Rule Persistence
 * Tests the current state and tries various persistence methods
 */

import { config } from 'dotenv';
import { OPNSenseAPIClient } from '../../src/api/client.js';
import { FirewallRuleResource, FirewallRule } from '../../src/resources/firewall/rule.js';

config();

// Enable debug mode
process.env.MCP_DEBUG = 'true';
process.env.DEBUG_FIREWALL = 'true';

async function debugPersistence() {
  console.log('🔍 Firewall Rule Persistence Debugger');
  console.log('======================================\n');
  
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });
  
  const firewall = new FirewallRuleResource(client);
  
  // Step 1: Check current state
  console.log('📊 Current State Check');
  console.log('----------------------');
  
  const allRules = await firewall.list();
  console.log(`Total rules in system: ${allRules.length}\n`);
  
  // Step 2: Create a test rule
  console.log('🧪 Creating Test Rule');
  console.log('---------------------');
  
  const testRule: FirewallRule = {
    enabled: '1',
    action: 'pass',
    interface: 'lan',  // Using simple interface name for testing
    direction: 'in',
    ipprotocol: 'inet',
    protocol: 'tcp',
    source_net: 'any',
    destination_net: 'any',
    destination_port: '12345',
    description: `DEBUG TEST - ${new Date().toISOString()}`
  };
  
  console.log('Creating rule with:', {
    interface: testRule.interface,
    protocol: testRule.protocol,
    port: testRule.destination_port,
    description: testRule.description
  });
  
  const createResult = await firewall.create(testRule);
  console.log(`\n✅ Rule created with UUID: ${createResult.uuid}\n`);
  
  // Step 3: Immediate verification
  console.log('🔎 Immediate Verification');
  console.log('-------------------------');
  
  const getRule = await firewall.get(createResult.uuid);
  console.log(`Rule exists via get(): ${!!getRule}`);
  
  const listRules = await firewall.list();
  const inList = listRules.some(r => r.uuid === createResult.uuid);
  console.log(`Rule in list(): ${inList}`);
  console.log(`Total rules now: ${listRules.length}\n`);
  
  if (!inList) {
    console.log('⚠️  Rule not in list! Testing persistence methods...\n');
    
    // Step 4: Test various API endpoints for persistence
    console.log('🔧 Testing Persistence Methods');
    console.log('-------------------------------');
    
    const persistenceMethods = [
      { endpoint: '/firewall/filter/apply', name: 'Filter Apply' },
      { endpoint: '/firewall/filter/reconfigure', name: 'Filter Reconfigure' },
      { endpoint: '/firewall/filter/savepoint', name: 'Filter Savepoint' },
      { endpoint: '/firewall/filter/reload', name: 'Filter Reload' },
      { endpoint: '/core/firmware/configsave', name: 'Config Save' },
      { endpoint: '/core/system/applyConfig', name: 'System Apply' },
      { endpoint: '/filter/reload', name: 'Direct Filter Reload' },
      { endpoint: '/api/firewall/filter/apply', name: 'API Filter Apply' }
    ];
    
    for (const method of persistenceMethods) {
      try {
        console.log(`Testing ${method.name}...`);
        const response = await client.post(method.endpoint);
        console.log(`  ✅ Success:`, response?.status || 'OK');
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if rule appears now
        const checkList = await firewall.list();
        const nowInList = checkList.some(r => r.uuid === createResult.uuid);
        
        if (nowInList) {
          console.log(`  🎉 Rule appeared in list after ${method.name}!\n`);
          break;
        } else {
          console.log(`  ❌ Rule still not in list\n`);
        }
      } catch (error: any) {
        console.log(`  ❌ Failed: ${error?.message || 'Unknown error'}\n`);
      }
    }
  }
  
  // Step 5: Final check
  console.log('📋 Final Status');
  console.log('---------------');
  
  const finalGet = await firewall.get(createResult.uuid);
  const finalList = await firewall.list();
  const finalInList = finalList.some(r => r.uuid === createResult.uuid);
  
  console.log(`Rule exists via get(): ${!!finalGet}`);
  console.log(`Rule in list(): ${finalInList}`);
  console.log(`Total rules: ${finalList.length}`);
  
  // Step 6: Cleanup
  console.log('\n🧹 Cleanup');
  console.log('-----------');
  
  try {
    await firewall.delete(createResult.uuid);
    console.log('Test rule deleted successfully');
  } catch (error) {
    console.log('Could not delete test rule:', error);
  }
  
  // Step 7: Recommendations
  console.log('\n💡 Recommendations');
  console.log('------------------');
  
  if (!finalInList) {
    console.log('The rule persistence issue persists. Possible causes:');
    console.log('1. The OPNsense API may require a specific sequence of calls');
    console.log('2. There might be a delay between creation and appearance in list');
    console.log('3. The interface name might need to be in a specific format');
    console.log('4. Check OPNsense logs at /var/log/configd.log for errors');
    console.log('5. Verify the API user has full firewall permissions');
    console.log('\nTry running: npm run test:firewall for comprehensive testing');
  } else {
    console.log('✅ Rule persistence is working correctly!');
  }
}

// Run the debug script
debugPersistence().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});