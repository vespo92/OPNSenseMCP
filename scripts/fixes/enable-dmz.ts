import { OPNSenseAPIClient } from '../../src/api/client.js';
import { FirewallRuleResource } from '../../src/resources/firewall/rule.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function enableDMZRouting() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: true
  });

  const firewall = new FirewallRuleResource(client);
  
  console.log('🔥 Creating Inter-VLAN Routing Rules for DMZ <-> LAN');
  console.log('====================================================');
  console.log('DMZ Network: 10.0.6.0/24 (opt8)');
  console.log('LAN Network: 10.0.0.0/24 (lan)');
  console.log('TrueNAS: 10.0.0.14\n');

  const rules = [
    // Allow DMZ to reach TrueNAS NFS
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',  // Apply on LAN interface
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'any',
      source_net: '10.0.6.0/24',  // From DMZ
      destination_net: '10.0.0.14',  // To TrueNAS only
      description: 'Allow DMZ to TrueNAS - All protocols'
    },
    // Allow return traffic from TrueNAS to DMZ
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',  // Apply on DMZ interface
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'any',
      source_net: '10.0.0.14',  // From TrueNAS
      destination_net: '10.0.6.0/24',  // To DMZ network
      description: 'Allow TrueNAS to DMZ - Return traffic'
    },
    // Allow DMZ to reach gateway for routing
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'icmp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.6.1',  // DMZ gateway
      description: 'Allow DMZ to gateway - ICMP'
    },
    // Allow DMZ to main K8s node
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.2',
      destination_port: '6443',  // Kubernetes API
      description: 'Allow DMZ to K8s master - API access'
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
        
        // Verify it was created
        const verification = await firewall.get(result.uuid);
        if (verification) {
          console.log(`   ✅ Verified rule exists`);
        } else {
          console.log(`   ⚠️  Rule created but verification failed`);
        }
      } else {
        console.log(`   ❌ Failed to create rule`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.apiResponse?.validations) {
        console.log(`      Validation errors:`, error.apiResponse.validations);
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`Created ${createdRules.length} of ${rules.length} rules`);
  
  if (createdRules.length === rules.length) {
    console.log('\n✅ Inter-VLAN routing rules created successfully!');
    console.log('\n⚠️  IMPORTANT: You may also need to:');
    console.log('1. Check that routing is enabled between VLANs in OPNsense');
    console.log('2. Verify no NAT rules are blocking the traffic');
    console.log('3. Check VLAN interface settings allow inter-VLAN routing');
    console.log('\n🧪 Test from DMZ node (10.0.6.2):');
    console.log('   ping 10.0.6.1  # DMZ gateway');
    console.log('   ping 10.0.0.14  # TrueNAS');
    console.log('   nc -zv 10.0.0.14 2049  # NFS port');
  } else {
    console.log('\n⚠️  Some rules failed to create. Check the errors above.');
  }

  return createdRules;
}

enableDMZRouting().catch(console.error);