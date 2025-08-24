import { OPNSenseAPIClient } from '../../src/api/client.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function discoverInterfaces() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST!,
    apiKey: process.env.OPNSENSE_API_KEY!,
    apiSecret: process.env.OPNSENSE_API_SECRET!,
    verifySsl: true
  });

  console.log('🔍 Discovering available interfaces in OPNsense...\n');
  
  try {
    // Get the rule form to see available options
    const ruleForm = await client.get('/firewall/filter/getRule');
    
    if (ruleForm?.rule?.interface) {
      console.log('✅ Available interfaces from OPNsense:');
      console.log('=====================================');
      const interfaces = Object.entries(ruleForm.rule.interface);
      interfaces.forEach(([key, value]) => {
        console.log(`  ${key.padEnd(15)} => "${value}"`);
      });
      console.log('\n📝 You should use one of these interface keys when creating rules.');
      console.log('   For example, if DMZ is on "opt1", use interface: "opt1"');
    } else {
      console.log('❌ Could not retrieve interface list from API');
      console.log('Response:', JSON.stringify(ruleForm, null, 2));
    }

    // Also try to get actual configured interfaces
    console.log('\n🔍 Checking configured interfaces...');
    try {
      const interfaces = await client.get('/interfaces/overview/list');
      if (interfaces) {
        console.log('Configured interfaces:');
        Object.entries(interfaces).forEach(([key, value]: [string, any]) => {
          console.log(`  ${key}: ${value.description || value.device || 'N/A'}`);
        });
      }
    } catch (e) {
      console.log('Could not fetch interface overview');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.apiResponse) {
      console.error('API Response:', error.apiResponse);
    }
  }
}

discoverInterfaces();