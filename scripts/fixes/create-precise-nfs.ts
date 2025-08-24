import { OPNSenseAPIClient } from '../../src/api/client.js';
import { FirewallRuleResource } from '../../src/resources/firewall/rule.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function createPreciseNFSRules() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });

  const firewall = new FirewallRuleResource(client);
  
  console.log('🎯 Creating Precise NFS Firewall Rules');
  console.log('=====================================');
  console.log('Source: 10.0.6.0/24 (DMZ - opt8)');
  console.log('Target: 10.0.0.14 (TrueNAS)');
  console.log('Purpose: Allow NFS mount from Kubernetes DMZ node\n');

  // Based on traceroute stopping at gateway, we need rules on BOTH interfaces
  const rules = [
    // 1. Allow DMZ to reach TrueNAS (apply on LAN interface for incoming traffic)
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '111',
      description: 'DMZ->TrueNAS: RPC TCP (on LAN)'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'udp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '111',
      description: 'DMZ->TrueNAS: RPC UDP (on LAN)'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '2049',
      description: 'DMZ->TrueNAS: NFS TCP (on LAN)'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'udp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '2049',
      description: 'DMZ->TrueNAS: NFS UDP (on LAN)'
    },
    // 2. Allow traffic FROM DMZ outbound (apply on DMZ interface)
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '111',
      description: 'DMZ->TrueNAS: RPC TCP (on DMZ)'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'udp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '111',
      description: 'DMZ->TrueNAS: RPC UDP (on DMZ)'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'tcp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '2049',
      description: 'DMZ->TrueNAS: NFS TCP (on DMZ)'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'udp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      destination_port: '2049',
      description: 'DMZ->TrueNAS: NFS UDP (on DMZ)'
    },
    // 3. Allow ICMP for testing
    {
      enabled: '1',
      action: 'pass',
      interface: 'lan',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'icmp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      description: 'DMZ->TrueNAS: ICMP ping (on LAN)'
    },
    {
      enabled: '1',
      action: 'pass',
      interface: 'opt8',
      direction: 'in',
      ipprotocol: 'inet',
      protocol: 'icmp',
      source_net: '10.0.6.0/24',
      destination_net: '10.0.0.14',
      description: 'DMZ->TrueNAS: ICMP ping (on DMZ)'
    }
  ];

  const createdRules: string[] = [];
  console.log(`📋 Creating ${rules.length} firewall rules...\n`);

  for (const rule of rules) {
    try {
      console.log(`📝 ${rule.description}`);
      const result = await firewall.create(rule);
      
      if (result.uuid) {
        createdRules.push(result.uuid);
        console.log(`   ✅ UUID: ${result.uuid}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Created ${createdRules.length} of ${rules.length} rules`);
  
  if (createdRules.length === rules.length) {
    console.log('\n🎉 SUCCESS! All rules created.');
    console.log('\n📝 What these rules do:');
    console.log('1. Allow DMZ network to reach TrueNAS on NFS ports');
    console.log('2. Rules applied on BOTH interfaces for proper routing');
    console.log('3. Includes ICMP for connectivity testing');
    
    console.log('\n🧪 Test commands from DMZ pod:');
    console.log('kubectl exec -it <busybox-pod> -n home-assistant -- sh');
    console.log('# Then run:');
    console.log('ping 10.0.0.14           # Should work now');
    console.log('nc -zv 10.0.0.14 2049    # Test NFS port');
    console.log('nc -zv 10.0.0.14 111     # Test RPC port');
    
    console.log('\n⚠️  If still blocked, check OPNsense Web UI:');
    console.log('1. Firewall → Rules → Check rule order (our rules should be near top)');
    console.log('2. Interfaces → opt8 → Uncheck "Block private networks"');
    console.log('3. System → Settings → Advanced → Static route filtering = Disabled');
  }

  return createdRules;
}

createPreciseNFSRules().catch(console.error);