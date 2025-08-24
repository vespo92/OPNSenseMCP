#!/usr/bin/env tsx
import { OPNSenseAPIClient } from '../../src/api/client.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function discoverAllAPIs() {
  console.log('🔍 Discovering All OPNsense API Endpoints');
  console.log('==========================================\n');
  
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });

  // Try to get the API menu/structure
  const menuEndpoints = [
    '/api/core/menu/search',
    '/api/core/menu/tree', 
    '/api/diagnostics/interface/getInterfaceNames',
    '/api/firewall/filter/get',
    '/api/firewall/filter_util/get',
    '/api/firewall/filter_util/info',
    '/api/firewall/alias/get',
    '/api/firewall/category/get',
    '/api/routes/routes/get',
    '/api/diagnostics/firewall/list',
    
    // Try plugin-based NAT endpoints
    '/api/firewall/source_nat/get',
    '/api/firewall/destination_nat/get',
    '/api/firewall/nat_reflection/get',
    '/api/firewall/nat1to1/get',
    '/api/firewall/natforward/get',
    '/api/firewall/natoutbound/get',
    
    // Try os-firewall plugin paths
    '/api/os-firewall/nat/get',
    '/api/os-firewall/nat/outbound/get',
    '/api/os-firewall/source_nat/get',
    
    // Legacy/alternative plugin names
    '/api/firewall/pf/nat/get',
    '/api/pf/nat/get',
    '/api/nat/outbound/get',
    '/api/source_nat/get',
  ];

  console.log('Testing endpoints...\n');
  
  const working: { endpoint: string, data?: any }[] = [];
  
  for (const endpoint of menuEndpoints) {
    try {
      const response = await client.get(endpoint);
      console.log(`✅ ${endpoint}`);
      
      // Check if response has NAT-related data
      const responseStr = JSON.stringify(response);
      if (responseStr.includes('nat') || responseStr.includes('NAT')) {
        console.log(`   🎯 Contains NAT-related data!`);
      }
      
      working.push({ endpoint, data: response });
    } catch (error: any) {
      console.log(`❌ ${endpoint}`);
    }
  }
  
  console.log('\n📊 Working Endpoints with Details');
  console.log('==================================\n');
  
  for (const { endpoint, data } of working) {
    console.log(`\n${endpoint}:`);
    
    // Print a summary of the data structure
    if (data && typeof data === 'object') {
      const keys = Object.keys(data);
      console.log(`  Top-level keys: ${keys.join(', ')}`);
      
      // Look for NAT-related content
      const searchForNAT = (obj: any, path: string = ''): void => {
        if (!obj || typeof obj !== 'object') return;
        
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (key.toLowerCase().includes('nat')) {
            console.log(`  🎯 NAT key found: ${currentPath}`);
            if (typeof value === 'string') {
              console.log(`     Value: ${value}`);
            } else if (Array.isArray(value)) {
              console.log(`     Array with ${value.length} items`);
            }
          }
          
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            searchForNAT(value, currentPath);
          }
        }
      };
      
      searchForNAT(data);
    }
  }
  
  // Try to find menu items related to NAT
  const menuTree = working.find(w => w.endpoint.includes('menu/tree'));
  if (menuTree?.data) {
    console.log('\n🗂️ Menu Tree NAT Items');
    console.log('=======================\n');
    
    const findNATInMenu = (items: any[], path: string = ''): void => {
      if (!Array.isArray(items)) return;
      
      for (const item of items) {
        if (item.Id?.toLowerCase().includes('nat') || 
            item.Url?.toLowerCase().includes('nat') ||
            item.VisibleName?.toLowerCase().includes('nat')) {
          console.log(`Found NAT menu item:`);
          console.log(`  Name: ${item.VisibleName}`);
          console.log(`  ID: ${item.Id}`);
          console.log(`  URL: ${item.Url}`);
        }
        
        if (item.Children) {
          findNATInMenu(item.Children, `${path}/${item.Id}`);
        }
      }
    };
    
    findNATInMenu(menuTree.data);
  }
}

// Run discovery
discoverAllAPIs().catch(console.error);