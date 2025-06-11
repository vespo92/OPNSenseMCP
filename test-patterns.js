// test-patterns.js
// Quick test script for the pattern system

const dotenv = require('dotenv');
dotenv.config();

// This would be after you've implemented the pattern system
async function testPatterns() {
  console.log('Testing OPNsense Pattern Deployment System...\n');

  // Import the pattern classes (after building)
  const { 
    PatternRegistry, 
    SimpleDeploymentEngine,
    SecureGuestNetworkPattern,
    GameServerPattern 
  } = require('./dist/patterns/base.js');
  
  const { OPNSenseAPIClient } = require('./dist/api/client.js');
  const { VlanResource } = require('./dist/resources/network/vlan.js');
  const { FirewallRuleResource } = require('./dist/resources/firewall/rule.js');

  try {
    // Initialize
    const client = new OPNSenseAPIClient({
      host: process.env.OPNSENSE_HOST,
      apiKey: process.env.OPNSENSE_API_KEY,
      apiSecret: process.env.OPNSENSE_API_SECRET,
      verifySsl: false
    });

    const vlanResource = new VlanResource(client);
    const firewallResource = new FirewallRuleResource(client);
    const registry = new PatternRegistry();
    const engine = new SimpleDeploymentEngine(client, vlanResource, firewallResource);

    // Test 1: List available patterns
    console.log('Available Patterns:');
    const patterns = registry.list();
    patterns.forEach(p => {
      console.log(`  - ${p.name}: ${p.description}`);
    });
    console.log();

    // Test 2: Deploy a secure guest network (dry run)
    console.log('Test Pattern: Secure Guest Network');
    const guestPattern = registry.get('secure-guest-network');
    
    // First, just generate the template
    const guestTemplate = guestPattern.generate({
      vlanTag: 99,
      interface: 'igc2',
      subnet: '192.168.99.0/24',
      description: 'Test Guest Network'
    });
    
    console.log('Generated resources:');
    guestTemplate.resources.forEach(r => {
      console.log(`  - ${r.type} "${r.name}": ${r.properties.description}`);
    });
    console.log();

    // Test 3: Game server pattern
    console.log('Test Pattern: Game Server (Minecraft)');
    const gamePattern = registry.get('game-server');
    
    const gameTemplate = gamePattern.generate({
      game: 'minecraft',
      serverIp: '192.168.1.200',
      interface: 'lan',
      allowFrom: 'any'
    });
    
    console.log('Generated firewall rules:');
    gameTemplate.resources.forEach(r => {
      console.log(`  - ${r.properties.description}`);
    });
    console.log();

    // Test 4: Validate parameters
    console.log('Testing parameter validation:');
    const badParams = {
      vlanTag: 5000, // Invalid - too high
      interface: '', // Invalid - empty
      subnet: 'not-a-subnet' // Invalid format
    };
    
    const validation = guestPattern.validate(badParams);
    console.log('Validation result:', validation);
    console.log();

    // Test 5: Actual deployment (commented out for safety)
    /*
    console.log('Deploying secure guest network...');
    const result = await engine.deployPattern(guestPattern, {
      vlanTag: 99,
      interface: 'igc2', 
      subnet: '192.168.99.0/24',
      description: 'Automated Guest Network'
    });
    
    if (result.success) {
      console.log('✓ Deployment successful!');
      console.log(`  Deployment ID: ${result.deploymentId}`);
      console.log(`  Resources created: ${result.resources.size}`);
    } else {
      console.log('✗ Deployment failed:');
      result.errors?.forEach(e => console.log(`  - ${e}`));
    }
    */

    // Example natural language mappings
    console.log('\nExample Claude Commands:');
    console.log('- "Create a guest network on VLAN 50"');
    console.log('  → deploy_pattern("secure-guest-network", {vlanTag: 50, interface: "igc2", subnet: "192.168.50.0/24"})');
    console.log();
    console.log('- "Set up Minecraft server for the kids"');
    console.log('  → deploy_pattern("game-server", {game: "minecraft", serverIp: "192.168.1.100", interface: "lan"})');
    console.log();
    console.log('- "Open ports for Valheim server on the gaming PC"');
    console.log('  → deploy_pattern("game-server", {game: "valheim", serverIp: "192.168.1.150", interface: "lan"})');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testPatterns().catch(console.error);