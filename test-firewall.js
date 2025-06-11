// Test script for firewall rule functionality
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import after build
const { OPNSenseAPIClient } = require('./dist/api/client.js');
const { FirewallRuleResource } = require('./dist/resources/firewall/rule.js');

async function testFirewallRules() {
  console.log('Testing OPNsense Firewall Rule Management...\n');

  try {
    // Create API client
    const client = new OPNSenseAPIClient({
      host: process.env.OPNSENSE_HOST,
      apiKey: process.env.OPNSENSE_API_KEY,
      apiSecret: process.env.OPNSENSE_API_SECRET,
      verifySsl: false,
      debugMode: true
    });

    // Test connection
    console.log('Testing connection...');
    const connTest = await client.testConnection();
    console.log('Connection:', connTest);

    // Create firewall resource
    const firewallResource = new FirewallRuleResource(client);

    // List existing rules
    console.log('\n\nListing existing firewall rules...');
    const rules = await firewallResource.list();
    console.log(`Found ${rules.length} rules`);
    rules.slice(0, 3).forEach(rule => {
      console.log(`- ${rule.description || 'No description'} (${rule.action} ${rule.protocol} ${rule.source_net} -> ${rule.destination_net})`);
    });

    // Get available options
    console.log('\n\nGetting available options...');
    const options = await firewallResource.getOptions();
    console.log('Available interfaces:', Object.keys(options.interface || {}));

    // Create a test rule using preset
    console.log('\n\nCreating test Minecraft rule...');
    try {
      const presetRule = firewallResource.createPreset('allow-minecraft', {
        description: 'Test Minecraft Server Rule'
      });
      
      // You'll need to adjust the interface name based on your setup
      const newRule = await firewallResource.create({
        ...presetRule,
        interface: 'lan' // Change this to match your interface
      });
      
      console.log('Created rule:', newRule);

      // Find the rule
      console.log('\n\nFinding rules by description...');
      const foundRules = await firewallResource.findByDescription('Minecraft');
      console.log(`Found ${foundRules.length} rules matching "Minecraft"`);

      // Toggle the rule
      if (newRule.uuid) {
        console.log('\n\nToggling rule state...');
        await firewallResource.toggle(newRule.uuid);
        console.log('Rule toggled successfully');

        // Delete the test rule
        console.log('\n\nDeleting test rule...');
        await firewallResource.delete(newRule.uuid);
        console.log('Rule deleted successfully');
      }
    } catch (error) {
      console.error('Error during rule operations:', error.message);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testFirewallRules().catch(console.error);
