// Test DHCP with fixed implementation
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// First, let's compile the TypeScript if needed
const { execSync } = require('child_process');

console.log('Building TypeScript files...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.log('Build failed, continuing anyway...');
}

// Import the modules
const { OPNSenseAPIClient } = require('./dist/api/client.js');

async function testDhcpFixed() {
  console.log('\n=== Testing Fixed DHCP Implementation ===\n');

  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST,
    apiKey: process.env.OPNSENSE_API_KEY,
    apiSecret: process.env.OPNSENSE_API_SECRET,
    verifySsl: false,
    debugMode: true  // Enable debug mode
  });

  // Test connection first
  console.log('1. Testing connection...');
  const connTest = await client.testConnection();
  console.log('Connection test:', connTest);
  
  if (!connTest.success) {
    console.error('Connection failed! Check your credentials.');
    return;
  }

  console.log('\n2. Testing DHCP endpoints directly...\n');

  // Test the searchLease endpoint
  console.log('Testing POST /dhcpv4/leases/searchLease...');
  try {
    const response = await client.searchDhcpLeases({
      current: 1,
      rowCount: 1000,
      searchPhrase: ''
    });
    
    console.log('Response type:', typeof response);
    console.log('Response keys:', Object.keys(response || {}));
    
    if (response) {
      console.log('Full response structure:');
      console.log(JSON.stringify(response, null, 2));
      
      // Check for different possible data locations
      const possibleDataPaths = ['rows', 'leases', 'data', 'items', 'results'];
      for (const path of possibleDataPaths) {
        if (response[path] && Array.isArray(response[path])) {
          console.log(`\nFound data at response.${path}:`);
          console.log(`Number of items: ${response[path].length}`);
          if (response[path].length > 0) {
            console.log('First item:');
            console.log(JSON.stringify(response[path][0], null, 2));
          }
        }
      }
    }
  } catch (error) {
    console.error('searchLease failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }

  // Try alternative endpoints
  console.log('\n\nTrying alternative endpoints...\n');

  const alternativeEndpoints = [
    '/dhcpv4/leases',
    '/dhcpv4/leases/get',
    '/dhcpv4/service/searchLease',
    '/services/dhcpv4/leases',
    '/status/dhcpv4leases'
  ];

  for (const endpoint of alternativeEndpoints) {
    console.log(`Testing GET ${endpoint}...`);
    try {
      const response = await client.get(endpoint);
      console.log('Success! Response type:', typeof response);
      if (response) {
        console.log('Response preview:', JSON.stringify(response, null, 2).substring(0, 200));
      }
    } catch (error) {
      console.log('Failed:', error.message);
    }
  }

  // Also check if we need to look at a different module
  console.log('\n\nChecking status endpoints...\n');
  
  try {
    console.log('Testing /diagnostics/interface/getArp...');
    const arpResponse = await client.post('/diagnostics/interface/getArp', {});
    console.log('ARP Response:', JSON.stringify(arpResponse, null, 2).substring(0, 500));
  } catch (error) {
    console.log('ARP failed:', error.message);
  }

  try {
    console.log('\nTesting /diagnostics/interface/getNdp...');
    const ndpResponse = await client.post('/diagnostics/interface/getNdp', {});
    console.log('NDP Response:', JSON.stringify(ndpResponse, null, 2).substring(0, 500));
  } catch (error) {
    console.log('NDP failed:', error.message);
  }
}

// Run the test
testDhcpFixed().catch(console.error);
