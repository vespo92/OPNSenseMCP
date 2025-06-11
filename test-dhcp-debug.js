// Simple test for DHCP with debug mode
const dotenv = require('dotenv');
dotenv.config();

// Build first
const { execSync } = require('child_process');
console.log('Building project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.log('Build failed, continuing anyway...');
}

// Now test
const { OPNSenseAPIClient } = require('./dist/api/client.js');
const { DhcpLeaseResource } = require('./dist/resources/services/dhcp/leases.js');

async function testDhcpDebug() {
  console.log('\n=== Testing DHCP with Debug Mode ===\n');

  // Create client with debug mode
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST,
    apiKey: process.env.OPNSENSE_API_KEY,
    apiSecret: process.env.OPNSENSE_API_SECRET,
    verifySsl: false,
    debugMode: true  // Enable API client debug
  });

  // Test connection
  console.log('Testing connection...');
  const connTest = await client.testConnection();
  console.log('Connection:', connTest);

  if (!connTest.success) {
    console.error('Connection failed!');
    return;
  }

  // Create DHCP resource with debug mode
  const dhcp = new DhcpLeaseResource(client, true);  // Enable DHCP debug

  console.log('\n=== Running debug diagnostics ===\n');
  await dhcp.debugApiEndpoints();

  console.log('\n=== Testing listLeases() ===\n');
  try {
    const leases = await dhcp.listLeases();
    console.log(`\nResult: Found ${leases.length} leases`);
    
    if (leases.length > 0) {
      console.log('\nFirst 3 leases:');
      leases.slice(0, 3).forEach((lease, i) => {
        console.log(`\nLease ${i + 1}:`);
        console.log(JSON.stringify(lease, null, 2));
        console.log('Device Info:', dhcp.getDeviceInfo(lease));
      });
    }
  } catch (error) {
    console.error('listLeases failed:', error);
  }

  console.log('\n=== Testing find functions ===\n');
  
  // Test finding by hostname
  try {
    console.log('Finding devices with "nintendo" in name...');
    const nintendoDevices = await dhcp.findByHostname('nintendo');
    console.log(`Found ${nintendoDevices.length} Nintendo devices`);
  } catch (error) {
    console.error('findByHostname failed:', error);
  }

  // Test guest devices
  try {
    console.log('\nChecking guest network devices...');
    const guestDevices = await dhcp.getGuestLeases();
    console.log(`Found ${guestDevices.length} devices on guest network`);
  } catch (error) {
    console.error('getGuestLeases failed:', error);
  }

  // Test grouping by interface
  try {
    console.log('\nGrouping by interface...');
    const byInterface = await dhcp.getLeasesByInterface();
    console.log('Interfaces found:', Array.from(byInterface.keys()));
  } catch (error) {
    console.error('getLeasesByInterface failed:', error);
  }
}

// Run the test
testDhcpDebug().catch(console.error);
