import { OPNSenseAPIClient } from '../../src/api/client.js';
import { FirewallRuleResource } from '../../src/resources/firewall/rule.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function fixDMZRouting() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });

  const firewall = new FirewallRuleResource(client);
  
  console.log('🔥 Creating Comprehensive DMZ Routing Rules');
  console.log('============================================');
  console.log('Since system settings are not accessible via API,');
  console.log('creating firewall rules to allow all necessary traffic.\n');

  const rules = [
    // CRITICAL: Allow all traffic from DMZ to LAN network
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'any',  // Both directions
      ipprotocol: 'inet',
      protocol: 'any',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.0/24',
      description: 'ALLOW ALL - DMZ to entire LAN network'
    },
    // Allow return traffic from LAN to DMZ
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',
      direction: 'any',
      ipprotocol: 'inet',
      protocol: 'any',
      source_net: '10.0.0.0/24',
      destination_net: '10.0.6.0/24',
      description: 'ALLOW ALL - LAN to DMZ return traffic'
    },
    // Specific rule at top priority for TrueNAS
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'any',
      ipprotocol: 'inet',
      protocol: 'any',
      source_net: '10.0.6.2',  // Specific DMZ node
      destination_net: '10.0.0.14',  // TrueNAS
      description: 'HIGH PRIORITY - DMZ node to TrueNAS all traffic'
    },
    // Allow DMZ to use LAN DNS
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'udp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.1',  // Assuming gateway is DNS
      destination_port: '53',
      description: 'Allow DMZ to LAN DNS'
    }
  ];

  const createdRules: string[] = [];

  for (const rule of rules) {
    try {
      console.log(`📝 Creating rule: ${rule.description}`);
      const result = await firewall.create(rule);
      
      if (result.uuid) {
        createdRules.push(result.uuid);
        console.log(`   ✅ Created with UUID: ${result.uuid}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`Created ${createdRules.length} of ${rules.length} rules`);
  
  console.log('\n⚠️  IMPORTANT MANUAL STEPS:');
  console.log('Since API access to system settings is limited, please manually check in OPNsense web UI:');
  console.log('\n1. System → Settings → Advanced → Firewall & NAT');
  console.log('   ☐ Disable firewall - Should be UNCHECKED');
  console.log('   ☐ Disable all packet filtering - Should be UNCHECKED'); 
  console.log('   ☐ Optimization - Set to "normal" or "conservative"');
  console.log('\n2. Interfaces → [opt8] (DMZ interface)');
  console.log('   ☐ Block private networks - Should be UNCHECKED');
  console.log('   ☐ Block bogon networks - Should be UNCHECKED');
  console.log('\n3. Firewall → Settings → Advanced');
  console.log('   ☐ Static route filtering - Set to "Disabled"');
  console.log('   ☐ Disable reply-to - May need to be CHECKED');
  console.log('\n4. Make sure the rules appear at the TOP of the rule list');
  console.log('   (Lower sequence numbers = higher priority)');
  
  console.log('\n🧪 After making manual changes, test from DMZ:');
  console.log('   ping 10.0.0.14  # Should work now');
  console.log('   nc -zv 10.0.0.14 2049  # NFS port test');

  return createdRules;
}

fixDMZRouting().catch(console.error);