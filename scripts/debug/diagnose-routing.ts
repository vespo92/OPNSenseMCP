import { OPNSenseAPIClient } from '../../src/api/client.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function diagnoseRoutingBlock() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: false
  });

  console.log('🔍 Deep Diagnosis: Why is DMZ→LAN traffic blocked?');
  console.log('===================================================\n');
  
  console.log('Known Facts:');
  console.log('✅ 39 firewall rules exist allowing DMZ→TrueNAS');
  console.log('✅ "Block private networks" is NOT enabled');
  console.log('❌ Traffic still blocked at gateway\n');

  // 1. Check for NAT rules
  console.log('1. Checking NAT Rules...');
  console.log('------------------------');
  try {
    const natOutbound = await client.get('/firewall/nat/outbound/searchRule');
    console.log(`   Outbound NAT rules: ${natOutbound?.rows?.length || 0}`);
    
    // Check if there's a NAT rule that might be masquerading DMZ traffic
    if (natOutbound?.rows) {
      const dmzNat = natOutbound.rows.filter((r: any) => 
        r.source?.includes('10.0.6') || r.interface === 'opt8'
      );
      if (dmzNat.length > 0) {
        console.log('   ⚠️  Found NAT rules affecting DMZ:');
        dmzNat.forEach((r: any) => {
          console.log(`      - Interface: ${r.interface}, Source: ${r.source}`);
        });
      }
    }
  } catch (e) {
    console.log('   Could not check NAT rules');
  }

  // 2. Check System Settings
  console.log('\n2. Checking System Settings...');
  console.log('-------------------------------');
  try {
    // Check if static route filtering is enabled
    const advanced = await client.get('/firewall/settings/get');
    if (advanced) {
      console.log('   Firewall settings retrieved');
      if (advanced.disablefilter === '1') {
        console.log('   ⚠️  Firewall is DISABLED globally!');
      }
      if (advanced.optimization) {
        console.log(`   Optimization mode: ${advanced.optimization}`);
      }
      if (advanced.state_policy) {
        console.log(`   State policy: ${advanced.state_policy}`);
      }
      if (advanced.static_route_filtering) {
        console.log(`   ⚠️  Static route filtering: ${advanced.static_route_filtering}`);
      }
    }
  } catch (e) {
    console.log('   Could not check system settings');
  }

  // 3. Check for Floating Rules
  console.log('\n3. Checking Floating Rules...');
  console.log('------------------------------');
  try {
    const floating = await client.get('/firewall/filter/searchFloatingRule');
    if (floating?.rows) {
      console.log(`   Found ${floating.rows.length} floating rules`);
      // Look for blocking rules
      const blockRules = floating.rows.filter((r: any) => 
        r.action === 'block' && (
          r.source?.includes('10.0.6') || 
          r.destination?.includes('10.0.0') ||
          r.interface === 'opt8'
        )
      );
      if (blockRules.length > 0) {
        console.log('   ⚠️  Found BLOCKING floating rules:');
        blockRules.forEach((r: any) => {
          console.log(`      - ${r.description || 'No description'}`);
        });
      }
    }
  } catch (e) {
    console.log('   No floating rules or endpoint not available');
  }

  // 4. Check Gateway Settings
  console.log('\n4. Checking Gateway Configuration...');
  console.log('-------------------------------------');
  try {
    const gateways = await client.get('/routing/gateway/status');
    if (gateways) {
      console.log('   Gateway status retrieved');
      Object.entries(gateways).forEach(([key, gw]: [string, any]) => {
        if (gw.address?.includes('10.0.6') || gw.address?.includes('10.0.0')) {
          console.log(`   ${key}: ${gw.address} (${gw.status})`);
        }
      });
    }
  } catch (e) {
    console.log('   Could not check gateway status');
  }

  // 5. Check Routes
  console.log('\n5. Checking Static Routes...');
  console.log('-----------------------------');
  try {
    const routes = await client.get('/routes/routes/searchroute');
    if (routes?.rows) {
      console.log(`   Found ${routes.rows.length} static routes`);
      const relevantRoutes = routes.rows.filter((r: any) => 
        r.network?.includes('10.0.6') || r.network?.includes('10.0.0')
      );
      if (relevantRoutes.length > 0) {
        console.log('   Routes affecting our networks:');
        relevantRoutes.forEach((r: any) => {
          console.log(`      - ${r.network} via ${r.gateway}`);
        });
      }
    }
  } catch (e) {
    console.log('   No static routes configured');
  }

  // 6. Check Interface Assignments
  console.log('\n6. Checking Interface Details...');
  console.log('---------------------------------');
  try {
    const interfaces = await client.get('/interfaces/overview/status');
    if (interfaces) {
      // Look for opt8 and lan
      ['opt8', 'lan'].forEach(iface => {
        if (interfaces[iface]) {
          const info = interfaces[iface];
          console.log(`   ${iface}:`);
          console.log(`      IP: ${info.addr || 'none'}`);
          console.log(`      Status: ${info.status}`);
          if (info.media) console.log(`      Media: ${info.media}`);
        }
      });
    }
  } catch (e) {
    console.log('   Could not get interface status');
  }

  // 7. CRITICAL: Check if there's a DENY rule BEFORE our ALLOW rules
  console.log('\n7. Checking Rule Order (CRITICAL)...');
  console.log('-------------------------------------');
  try {
    const allRules = await client.get('/firewall/filter/get');
    if (allRules?.filter?.rules?.rule) {
      const rules = Object.values(allRules.filter.rules.rule);
      
      // Find first BLOCK rule that might affect DMZ
      let blockFound = false;
      let allowFound = false;
      
      rules.forEach((r: any, index: number) => {
        const isBlock = r.action?.pass?.selected === 0 && r.action?.block?.selected === 1;
        const isAllow = r.action?.pass?.selected === 1;
        const affectsDMZ = r.source_net?.includes('10.0.6') || r.interface?.opt8?.selected === 1;
        
        if (isBlock && affectsDMZ && !allowFound) {
          console.log(`   ❌ BLOCK rule at position ${index}: ${r.description}`);
          blockFound = true;
        }
        if (isAllow && affectsDMZ && !blockFound) {
          allowFound = true;
        }
      });
      
      if (blockFound) {
        console.log('   ⚠️  There are BLOCK rules before ALLOW rules!');
        console.log('   This would prevent traffic even with allow rules.');
      }
    }
  } catch (e) {
    console.log('   Could not check rule order');
  }

  console.log('\n' + '='.repeat(50));
  console.log('Possible Issues to Check in Web UI:');
  console.log('='.repeat(50));
  console.log('\n1. **Rule Order** - Are there any BLOCK rules above your ALLOW rules?');
  console.log('2. **NAT** - Is outbound NAT set to "Automatic" or "Manual"?');
  console.log('3. **Gateway** - Is the DMZ interface using the correct gateway?');
  console.log('4. **Floating Rules** - Any floating block rules?');
  console.log('5. **Interface Groups** - Is opt8 part of a group with restrictions?');
  console.log('6. **Aliases** - Are the networks defined correctly in aliases?');
  console.log('\n🎯 Most Likely Cause: Rule ordering or NAT configuration');
}

diagnoseRoutingBlock().catch(console.error);