#!/usr/bin/env tsx
/**
 * Comprehensive Firewall Rule Testing Suite
 * Tests CRUD operations, persistence, and NFS connectivity rules
 */

import { config } from 'dotenv';
import { OPNSenseAPIClient } from '../src/api/client.js';
import { FirewallRuleResource, FirewallRule } from '../src/resources/firewall/rule.js';

// Load environment variables
config();

// Test configuration
const TEST_CONFIG = {
  DMZ_INTERFACE: process.env.DMZ_INTERFACE || 'igc3_vlan6',
  DMZ_NETWORK: '10.0.6.0/24',
  TRUENAS_IP: '10.0.0.14',
  DMZ_NODE: '10.0.6.2',
  DEBUG: true
};

// Enable debug mode
process.env.MCP_DEBUG = 'true';
process.env.DEBUG_FIREWALL = 'true';

class FirewallRuleTestSuite {
  private client: OPNSenseAPIClient;
  private firewall: FirewallRuleResource;
  private testRuleUUIDs: string[] = [];

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
   * Clean up test rules
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up test rules...');
    
    for (const uuid of this.testRuleUUIDs) {
      try {
        await this.firewall.delete(uuid);
        console.log(`  ✓ Deleted rule ${uuid}`);
      } catch (error) {
        console.log(`  ⚠ Could not delete rule ${uuid}:`, error);
      }
    }
    
    this.testRuleUUIDs = [];
  }

  /**
   * Test 1: Interface Discovery
   */
  async testInterfaceDiscovery() {
    console.log('\n📡 TEST 1: Interface Discovery');
    console.log('================================');
    
    await this.firewall.debugInterfaces();
    
    return { success: true };
  }

  /**
   * Test 2: Alternative Endpoints
   */
  async testAlternativeEndpoints() {
    console.log('\n🔌 TEST 2: Alternative API Endpoints');
    console.log('=====================================');
    
    await this.firewall.testAlternativeEndpoints();
    
    return { success: true };
  }

  /**
   * Test 3: Basic CRUD Operations
   */
  async testCRUDOperations() {
    console.log('\n📝 TEST 3: Basic CRUD Operations');
    console.log('=================================');
    
    try {
      // Create a test rule
      console.log('\n1. Creating test rule...');
      const testRule: FirewallRule = {
        enabled: '1',
        action: 'pass',
        interface: TEST_CONFIG.DMZ_INTERFACE,
        direction: 'in',
        ipprotocol: 'inet',
        protocol: 'tcp',
        source_net: TEST_CONFIG.DMZ_NETWORK,
        destination_net: 'any',
        destination_port: '8080',
        description: `TEST RULE - Created at ${new Date().toISOString()}`
      };
      
      const createResult = await this.firewall.create(testRule);
      this.testRuleUUIDs.push(createResult.uuid);
      console.log(`  ✓ Created rule: ${createResult.uuid}`);
      
      // Read the rule back
      console.log('\n2. Reading rule back...');
      const readRule = await this.firewall.get(createResult.uuid);
      if (readRule) {
        console.log(`  ✓ Rule found via get(): ${readRule.uuid}`);
        console.log(`    Description: ${readRule.description}`);
      } else {
        console.log('  ✗ Rule not found via get()!');
        return { success: false, error: 'Rule not found after creation' };
      }
      
      // Check if rule appears in list
      console.log('\n3. Checking if rule appears in list...');
      const allRules = await this.firewall.list();
      const foundInList = allRules.some(r => r.uuid === createResult.uuid);
      
      if (foundInList) {
        console.log(`  ✓ Rule found in list (total rules: ${allRules.length})`);
      } else {
        console.log(`  ✗ Rule NOT found in list! (total rules: ${allRules.length})`);
        console.log('  ⚠ This indicates a persistence issue!');
        
        // Try force apply
        console.log('\n4. Attempting force apply...');
        await this.firewall.forceApply();
        
        // Check again
        const allRulesAfterForce = await this.firewall.list();
        const foundAfterForce = allRulesAfterForce.some(r => r.uuid === createResult.uuid);
        
        if (foundAfterForce) {
          console.log(`  ✓ Rule found after force apply (total rules: ${allRulesAfterForce.length})`);
        } else {
          console.log(`  ✗ Rule still not in list after force apply!`);
          return { success: false, error: 'Rule not persisted in list' };
        }
      }
      
      // Update the rule
      console.log('\n5. Updating rule...');
      const updateSuccess = await this.firewall.update(createResult.uuid, {
        description: `TEST RULE - Updated at ${new Date().toISOString()}`,
        destination_port: '8081'
      });
      
      if (updateSuccess) {
        console.log('  ✓ Rule updated successfully');
        
        // Verify update
        const updatedRule = await this.firewall.get(createResult.uuid);
        if (updatedRule?.destination_port === '8081') {
          console.log('  ✓ Update verified');
        } else {
          console.log('  ⚠ Update not reflected in rule');
        }
      }
      
      // Toggle the rule
      console.log('\n6. Toggling rule enabled state...');
      await this.firewall.toggle(createResult.uuid);
      const toggledRule = await this.firewall.get(createResult.uuid);
      
      if (toggledRule?.enabled === '0') {
        console.log('  ✓ Rule disabled successfully');
      } else {
        console.log('  ⚠ Rule toggle may not have worked');
      }
      
      // Delete the rule
      console.log('\n7. Deleting rule...');
      const deleteSuccess = await this.firewall.delete(createResult.uuid);
      
      if (deleteSuccess) {
        console.log('  ✓ Rule deleted successfully');
        this.testRuleUUIDs = this.testRuleUUIDs.filter(id => id !== createResult.uuid);
        
        // Verify deletion
        const deletedRule = await this.firewall.get(createResult.uuid);
        if (!deletedRule) {
          console.log('  ✓ Deletion verified');
        } else {
          console.log('  ⚠ Rule still exists after deletion!');
        }
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('CRUD test failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Test 4: NFS Connectivity Rules
   */
  async testNFSRules() {
    console.log('\n🔒 TEST 4: NFS Connectivity Rules');
    console.log('==================================');
    
    try {
      // Create NFS rules
      console.log('\n1. Creating NFS rules for DMZ to TrueNAS...');
      const nfsRules = await this.firewall.createNFSRules({
        interface: TEST_CONFIG.DMZ_INTERFACE,
        sourceNetwork: TEST_CONFIG.DMZ_NETWORK,
        truenasIP: TEST_CONFIG.TRUENAS_IP
      });
      
      this.testRuleUUIDs.push(nfsRules.tcp, nfsRules.udp);
      
      // Validate NFS connectivity
      console.log('\n2. Validating NFS connectivity rules...');
      const validation = await this.firewall.validateNFSConnectivity();
      
      console.log(`\nNFS Validation Results:`);
      console.log(`  Total rules: ${validation.details.totalRules}`);
      console.log(`  NFS rules found: ${validation.details.nfsRules}`);
      
      if (validation.details.rules.length > 0) {
        console.log('\n  NFS Rules:');
        validation.details.rules.forEach((rule: any) => {
          console.log(`    - ${rule.description}`);
          console.log(`      UUID: ${rule.uuid}`);
          console.log(`      Interface: ${rule.interface}`);
          console.log(`      ${rule.source} -> ${rule.destination}:${rule.ports} (${rule.protocol})`);
          console.log(`      Enabled: ${rule.enabled}`);
        });
      }
      
      // Test commands for validation
      console.log('\n3. Production validation commands:');
      console.log('   From DMZ node (10.0.6.2), run:');
      console.log(`     # Test RPC portmapper`);
      console.log(`     rpcinfo -p ${TEST_CONFIG.TRUENAS_IP}`);
      console.log(`     `);
      console.log(`     # Test NFS mount`);
      console.log(`     showmount -e ${TEST_CONFIG.TRUENAS_IP}`);
      console.log(`     `);
      console.log(`     # Attempt mount`);
      console.log(`     mount -t nfs ${TEST_CONFIG.TRUENAS_IP}:/mnt/tank/kubernetes /mnt/test`);
      
      return { success: validation.rulesExist };
      
    } catch (error) {
      console.error('NFS rules test failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Test 5: Rule Persistence After Service Restart
   */
  async testPersistence() {
    console.log('\n💾 TEST 5: Rule Persistence');
    console.log('============================');
    
    try {
      // Create a persistence test rule
      console.log('\n1. Creating persistence test rule...');
      const persistRule: FirewallRule = {
        enabled: '1',
        action: 'pass',
        interface: TEST_CONFIG.DMZ_INTERFACE,
        direction: 'in',
        ipprotocol: 'inet',
        protocol: 'tcp',
        source_net: TEST_CONFIG.DMZ_NETWORK,
        destination_net: 'any',
        destination_port: '9999',
        description: `PERSISTENCE TEST - ${new Date().toISOString()}`
      };
      
      const result = await this.firewall.create(persistRule);
      this.testRuleUUIDs.push(result.uuid);
      console.log(`  ✓ Created rule: ${result.uuid}`);
      
      // Initial check
      console.log('\n2. Initial verification...');
      const initialCheck = await this.firewall.get(result.uuid);
      const initialList = await this.firewall.list();
      const inInitialList = initialList.some(r => r.uuid === result.uuid);
      
      console.log(`  Rule exists via get(): ${!!initialCheck}`);
      console.log(`  Rule in list(): ${inInitialList}`);
      
      // Wait a bit for propagation
      console.log('\n3. Waiting 5 seconds for full propagation...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check again
      console.log('\n4. Post-wait verification...');
      const afterWaitCheck = await this.firewall.get(result.uuid);
      const afterWaitList = await this.firewall.list();
      const inAfterWaitList = afterWaitList.some(r => r.uuid === result.uuid);
      
      console.log(`  Rule exists via get(): ${!!afterWaitCheck}`);
      console.log(`  Rule in list(): ${inAfterWaitList}`);
      
      if (!inAfterWaitList) {
        console.log('\n  ⚠ WARNING: Rule not persisting in list!');
        console.log('  This indicates the apply/save process is not working correctly.');
        
        // Try alternative apply methods
        console.log('\n5. Trying alternative persistence methods...');
        
        // Method 1: Direct config save
        try {
          await this.client.post('/core/firmware/configsave');
          console.log('  ✓ Config saved via /core/firmware/configsave');
        } catch (e) {
          console.log('  ✗ /core/firmware/configsave failed');
        }
        
        // Method 2: System config apply
        try {
          await this.client.post('/core/system/applyConfig');
          console.log('  ✓ Applied via /core/system/applyConfig');
        } catch (e) {
          console.log('  ✗ /core/system/applyConfig failed');
        }
        
        // Final check
        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalList = await this.firewall.list();
        const inFinalList = finalList.some(r => r.uuid === result.uuid);
        
        console.log(`\n6. Final check - Rule in list: ${inFinalList}`);
        
        return { success: inFinalList };
      }
      
      console.log('\n  ✅ Rule persisted successfully!');
      return { success: true };
      
    } catch (error) {
      console.error('Persistence test failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Test 6: Batch Rule Creation
   */
  async testBatchCreation() {
    console.log('\n📦 TEST 6: Batch Rule Creation');
    console.log('===============================');
    
    try {
      const batchRules = [
        {
          description: 'Batch Test 1 - HTTP',
          destination_port: '80',
          protocol: 'tcp'
        },
        {
          description: 'Batch Test 2 - HTTPS',
          destination_port: '443',
          protocol: 'tcp'
        },
        {
          description: 'Batch Test 3 - DNS',
          destination_port: '53',
          protocol: 'udp'
        }
      ];
      
      console.log(`\n1. Creating ${batchRules.length} rules in batch...`);
      
      for (const ruleConfig of batchRules) {
        const rule: FirewallRule = {
          enabled: '1',
          action: 'pass',
          interface: TEST_CONFIG.DMZ_INTERFACE,
          direction: 'in',
          ipprotocol: 'inet',
          protocol: ruleConfig.protocol,
          source_net: TEST_CONFIG.DMZ_NETWORK,
          destination_net: 'any',
          destination_port: ruleConfig.destination_port,
          description: ruleConfig.description
        };
        
        const result = await this.firewall.create(rule);
        this.testRuleUUIDs.push(result.uuid);
        console.log(`  ✓ Created: ${ruleConfig.description} (${result.uuid})`);
      }
      
      // Apply once after all rules
      console.log('\n2. Applying changes...');
      await this.firewall.applyChanges();
      
      // Verify all rules exist
      console.log('\n3. Verifying batch creation...');
      const allRules = await this.firewall.list();
      let foundCount = 0;
      
      for (const uuid of this.testRuleUUIDs) {
        if (allRules.some(r => r.uuid === uuid)) {
          foundCount++;
        }
      }
      
      console.log(`  Found ${foundCount}/${this.testRuleUUIDs.length} batch rules in list`);
      
      return { success: foundCount === this.testRuleUUIDs.length };
      
    } catch (error) {
      console.error('Batch creation test failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 OPNsense Firewall Rule Test Suite');
    console.log('=====================================');
    console.log(`Host: ${process.env.OPNSENSE_HOST}`);
    console.log(`DMZ Interface: ${TEST_CONFIG.DMZ_INTERFACE}`);
    console.log(`DMZ Network: ${TEST_CONFIG.DMZ_NETWORK}`);
    console.log(`TrueNAS IP: ${TEST_CONFIG.TRUENAS_IP}`);
    
    const results = {
      interfaceDiscovery: { success: false },
      alternativeEndpoints: { success: false },
      crudOperations: { success: false },
      nfsRules: { success: false },
      persistence: { success: false },
      batchCreation: { success: false }
    };
    
    try {
      // Run tests
      results.interfaceDiscovery = await this.testInterfaceDiscovery();
      results.alternativeEndpoints = await this.testAlternativeEndpoints();
      results.crudOperations = await this.testCRUDOperations();
      results.nfsRules = await this.testNFSRules();
      results.persistence = await this.testPersistence();
      results.batchCreation = await this.testBatchCreation();
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    } finally {
      // Always cleanup
      await this.cleanup();
    }
    
    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    
    let passedCount = 0;
    let failedCount = 0;
    
    Object.entries(results).forEach(([name, result]) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${name}`);
      if (result.success) {
        passedCount++;
      } else {
        failedCount++;
        if ((result as any).error) {
          console.log(`       Error: ${(result as any).error}`);
        }
      }
    });
    
    console.log(`\n  Total: ${passedCount} passed, ${failedCount} failed`);
    
    return failedCount === 0;
  }
}

// Main execution
async function main() {
  const suite = new FirewallRuleTestSuite();
  const success = await suite.runAllTests();
  
  process.exit(success ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { FirewallRuleTestSuite };