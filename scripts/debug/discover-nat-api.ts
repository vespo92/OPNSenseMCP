#!/usr/bin/env tsx
import { OPNSenseAPIClient } from '../../src/api/client.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function discoverNATAPI() {
  console.log('🔍 Discovering OPNsense NAT API Endpoints');
  console.log('==========================================\n');
  
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });

  const endpoints = [
    // Core NAT endpoints
    '/api/firewall/nat/settings/get',
    '/api/firewall/nat/settings/searchItem',
    
    // Outbound NAT
    '/api/firewall/nat/outbound/get',
    '/api/firewall/nat/outbound/searchItem', 
    '/api/firewall/nat/outbound/getItem',
    '/api/firewall/nat/outbound/addItem',
    '/api/firewall/nat/outbound/delItem',
    '/api/firewall/nat/outbound/toggleItem',
    '/api/firewall/nat/outbound/reconfigure',
    
    // Alternative paths
    '/api/firewall/nat_out/get',
    '/api/firewall/nat_out/searchRule',
    '/api/firewall/source_nat/get',
    '/api/firewall/source_nat/searchItem',
    
    // Port forward
    '/api/firewall/nat/forward/get',
    '/api/firewall/nat/forward/searchItem',
    
    // One-to-One
    '/api/firewall/nat/one_to_one/get',
    '/api/firewall/nat/one_to_one/searchItem',
    
    // NPT
    '/api/firewall/nat/npt/get',
    '/api/firewall/nat/npt/searchItem',
    
    // Apply/Save
    '/api/firewall/nat/apply',
    '/api/firewall/nat/reconfigure',
    '/api/firewall/nat/savepoint',
    
    // Legacy paths
    '/api/firewall/nat/get',
    '/api/firewall/natoutbound/get',
    '/api/firewall/nat_outbound/get',
  ];

  console.log('Testing endpoints...\n');
  
  const working: string[] = [];
  const notFound: string[] = [];
  const errors: { endpoint: string, error: string }[] = [];
  
  for (const endpoint of endpoints) {
    try {
      const response = await client.get(endpoint);
      console.log(`✅ ${endpoint}`);
      
      // Show structure for working endpoints
      if (response && typeof response === 'object') {
        const keys = Object.keys(response);
        console.log(`   Structure: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        
        // Special handling for certain endpoints
        if (endpoint.includes('settings') && response.settings) {
          console.log(`   Settings keys: ${Object.keys(response.settings).join(', ')}`);
        }
        if (endpoint.includes('outbound') && response.rows) {
          console.log(`   Found ${response.rows.length || 0} outbound rules`);
        }
      }
      
      working.push(endpoint);
      console.log();
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`❌ ${endpoint} - Not Found`);
        notFound.push(endpoint);
      } else {
        console.log(`⚠️  ${endpoint} - Error: ${error.message}`);
        errors.push({ endpoint, error: error.message });
      }
    }
  }
  
  console.log('\n📊 Discovery Summary');
  console.log('====================\n');
  
  console.log(`✅ Working endpoints (${working.length}):`);
  working.forEach(ep => console.log(`   ${ep}`));
  
  console.log(`\n❌ Not found (${notFound.length}):`);
  notFound.forEach(ep => console.log(`   ${ep}`));
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach(({ endpoint, error }) => console.log(`   ${endpoint}: ${error}`));
  }
  
  // Test specific operations on working endpoints
  if (working.length > 0) {
    console.log('\n🔬 Detailed Analysis of Working Endpoints');
    console.log('=========================================\n');
    
    for (const endpoint of working) {
      try {
        const response = await client.get(endpoint);
        console.log(`\n${endpoint}:`);
        console.log(JSON.stringify(response, null, 2).slice(0, 500));
      } catch (error) {
        // Skip errors in detailed analysis
      }
    }
  }
}

// Run discovery
discoverNATAPI().catch(console.error);