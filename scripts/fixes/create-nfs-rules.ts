import { OPNSenseAPIClient } from '../../src/api/client.js';
import { FirewallRuleResource } from '../../src/resources/firewall/rule.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function createNFSRules() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: true
  });

  const firewall = new FirewallRuleResource(client);
  
  console.log('🔥 Creating NFS Firewall Rules for DMZ to TrueNAS');
  console.log('================================================');
  console.log('DMZ Interface: opt8');
  console.log('DMZ Network: 10.0.6.0/24');
  console.log('TrueNAS IP: 10.0.0.14\n');

  const rules = [
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',  // DMZ interface
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '111',
      description: 'DMZ to TrueNAS - RPC Portmapper TCP'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',  // DMZ interface
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'udp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '111',
      description: 'DMZ to TrueNAS - RPC Portmapper UDP'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',  // DMZ interface
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '2049',
      description: 'DMZ to TrueNAS - NFS TCP'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',  // DMZ interface
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'udp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '2049',
      description: 'DMZ to TrueNAS - NFS UDP'
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
    console.log('\n✅ All NFS rules created successfully!');
    console.log('\n🧪 Test from DMZ node (10.0.6.2):');
    console.log('   nc -zv 10.0.0.14 111');
    console.log('   nc -zv 10.0.0.14 2049');
    console.log('   mount -t nfs 10.0.0.14:/mnt/SSDRAID/Kubes /mnt/test');
  } else {
    console.log('\n⚠️  Some rules failed to create. Check the errors above.');
  }

  return createdRules;
}

createNFSRules().catch(console.error);