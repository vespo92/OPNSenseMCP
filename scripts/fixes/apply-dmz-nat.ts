#!/usr/bin/env tsx
import { OPNSenseAPIClient } from '../../src/api/client.js';
import { NATResource } from '../../src/resources/firewall/nat.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function applyDMZNATFix() {
  console.log('🔧 Applying DMZ NAT Fix');
  console.log('========================\n');
  
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });

  const nat = new NATResource(client);
  
  try {
    // First, check current NAT rules
    console.log('📊 Checking current NAT rules...\n');
    const currentRules = await nat.listOutboundRules();
    
    // Check if DMZ is being NAT'd
    const dmzNATRules = currentRules.filter((rule: any) => 
      rule.source?.includes('DMZ') || rule.source?.includes('10.0.6')
    );
    
    if (dmzNATRules.length > 0) {
      console.log(`Found ${dmzNATRules.length} NAT rules affecting DMZ traffic`);
      console.log('These rules are causing the routing issue.\n');
    }
    
    // Apply the fix
    console.log('🚀 Applying DMZ NAT fix...\n');
    const result = await nat.fixDMZNAT();
    
    if (result.success) {
      console.log('✅ DMZ NAT Fix Applied Successfully!\n');
      
      if (result.rulesCreated && result.rulesCreated.length > 0) {
        console.log('Created exception rules:');
        result.rulesCreated.forEach(rule => {
          console.log(`  • ${rule}`);
        });
      }
      
      console.log('\n🎉 The DMZ NAT issue is now fixed!');
      console.log('\n🧪 Test from DMZ node (10.0.6.2):');
      console.log('  ping 10.0.0.14         # Should work now!');
      console.log('  nc -zv 10.0.0.14 2049  # NFS port test');
      console.log('  mount -t nfs 10.0.0.14:/mnt/SSDRAID/Kubes /mnt/test');
      
    } else {
      console.log('⚠️  Fix may have partially applied');
      if (result.message) {
        console.log(`  Message: ${result.message}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error applying NAT fix:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n📝 Note: Some exception rules may already exist.');
      console.log('Check Firewall → NAT → Outbound in the web UI.');
    }
  }
}

// Run immediately
applyDMZNATFix().catch(console.error);