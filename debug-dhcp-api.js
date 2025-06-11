// Debug DHCP API response structure
const dotenv = require('dotenv');
const axios = require('axios');
const https = require('https');

// Load environment variables
dotenv.config();

async function debugDhcpApi() {
  console.log('=== Debugging OPNsense DHCP API ===\n');
  
  const config = {
    host: process.env.OPNSENSE_HOST,
    apiKey: process.env.OPNSENSE_API_KEY,
    apiSecret: process.env.OPNSENSE_API_SECRET
  };

  console.log('Configuration:');
  console.log('- Host:', config.host);
  console.log('- API Key:', config.apiKey ? 'Set' : 'Not set');
  console.log('- API Secret:', config.apiSecret ? 'Set' : 'Not set');
  console.log();

  // Create axios instance
  const client = axios.create({
    baseURL: `${config.host}/api`,
    auth: {
      username: config.apiKey,
      password: config.apiSecret
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    }),
    timeout: 30000
  });

  try {
    // Test 1: Try the searchLease endpoint
    console.log('Test 1: POST /dhcpv4/leases/searchLease');
    try {
      const response = await client.post('/dhcpv4/leases/searchLease', {
        current: 1,
        rowCount: 1000,
        sort: {},
        searchPhrase: ''
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response data type:', typeof response.data);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.rows) {
        console.log(`\nFound ${response.data.rows.length} leases`);
        if (response.data.rows.length > 0) {
          console.log('\nFirst lease structure:');
          console.log(JSON.stringify(response.data.rows[0], null, 2));
        }
      }
    } catch (error) {
      console.log('Error:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }

    // Test 2: Try GET endpoints
    console.log('\n\nTest 2: GET /dhcpv4/leases/get');
    try {
      const response = await client.get('/dhcpv4/leases/get', {
        headers: {
          'Accept': 'application/json'
          // NO Content-Type for GET
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('Error:', error.message);
    }

    // Test 3: Try different endpoints
    console.log('\n\nTest 3: GET /dhcpv4/leases');
    try {
      const response = await client.get('/dhcpv4/leases', {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('Error:', error.message);
    }

    // Test 4: Check DHCP service status
    console.log('\n\nTest 4: GET /dhcpv4/service/status');
    try {
      const response = await client.get('/dhcpv4/service/status', {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('Error:', error.message);
    }

    // Test 5: Try searchLease with different params
    console.log('\n\nTest 5: POST /dhcpv4/leases/searchLease (minimal params)');
    try {
      const response = await client.post('/dhcpv4/leases/searchLease', {}, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('Error:', error.message);
    }

  } catch (error) {
    console.error('\nFatal error:', error.message);
  }
}

// Run the debug
debugDhcpApi().catch(console.error);
