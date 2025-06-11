#!/usr/bin/env node

// Quick DHCP Fix Test - Run this after building to verify the fix works

import dotenv from 'dotenv';
import { OPNSenseAPIClient } from './dist/api/client.js';
import { DhcpLeaseResource } from './dist/resources/services/dhcp/leases.js';

// Load environment variables
dotenv.config();

console.log('🔧 OPNSense MCP DHCP Fix Test\n');

// Test function
async function runTest() {
  console.log('🔌 Connecting to OPNsense...');
  
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST,
    apiKey: process.env.OPNSENSE_API_KEY,
    apiSecret: process.env.OPNSENSE_API_SECRET,
    verifySsl: false
  });

  // Test connection
  const connTest = await client.testConnection();
  if (!connTest.success) {
    console.error('❌ Connection failed:', connTest.error);
    console.log('\n💡 Check your .env file configuration');
    process.exit(1);
  }
  console.log('✅ Connected to OPNsense', connTest.version);

  // Test DHCP
  console.log('\n🔍 Testing DHCP functionality...');
  const dhcp = new DhcpLeaseResource(client);
  
  try {
    const leases = await dhcp.listLeases();
    console.log(`✅ DHCP is working! Found ${leases.length} devices\n`);
    
    if (leases.length > 0) {
      console.log('📱 Sample devices:');
      leases.slice(0, 5).forEach(lease => {
        const info = dhcp.getDeviceInfo(lease);
        console.log(`   • ${info}`);
      });
      
      // Test search
      console.log('\n🔎 Testing device search...');
      const searchTest = await dhcp.findByHostname(leases[0].hostname || 'test');
      console.log(`✅ Search working! Found ${searchTest.length} results`);
      
      // Test guest network
      console.log('\n🏠 Testing guest network detection...');
      const guestDevices = await dhcp.getGuestLeases();
      console.log(`✅ Found ${guestDevices.length} devices on guest network`);
    }
    
    console.log('\n🎉 DHCP fix is working correctly!');
    console.log('You can now use DHCP commands in Claude Desktop.');
    
  } catch (error) {
    console.error('❌ DHCP test failed:', error.message);
    console.log('\n💡 Troubleshooting steps:');
    console.log('1. Run: node debug-dhcp-comprehensive.js');
    console.log('2. Check which endpoint returns data');
    console.log('3. Update the API endpoint if needed');
    console.log('4. See DHCP-TROUBLESHOOTING.md for more help');
  }
}

// Run the test
runTest().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
