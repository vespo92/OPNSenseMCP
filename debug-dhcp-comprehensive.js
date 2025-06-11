// Comprehensive test to debug OPNsense DHCP API
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';

// Load environment variables
dotenv.config();

async function testOPNsenseAPI() {
  console.log('=== OPNsense DHCP API Debugging ===\n');
  
  const config = {
    host: process.env.OPNSENSE_HOST,
    apiKey: process.env.OPNSENSE_API_KEY,
    apiSecret: process.env.OPNSENSE_API_SECRET
  };

  // Create axios instance with debug interceptors
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

  // Add response interceptor to log all responses
  client.interceptors.response.use(
    response => {
      console.log(`\n✅ ${response.config.method.toUpperCase()} ${response.config.url}`);
      console.log(`Status: ${response.status}`);
      console.log(`Headers:`, response.headers);
      return response;
    },
    error => {
      console.log(`\n❌ ${error.config.method.toUpperCase()} ${error.config.url}`);
      console.log(`Status: ${error.response?.status}`);
      console.log(`Error:`, error.message);
      return Promise.reject(error);
    }
  );

  console.log('Testing various DHCP-related endpoints...\n');

  const endpoints = [
    // Primary endpoints
    { method: 'POST', path: '/dhcpv4/leases/searchLease', data: { current: 1, rowCount: 1000, sort: {}, searchPhrase: '' } },
    { method: 'POST', path: '/dhcpv4/leases/searchLease', data: {} },
    { method: 'GET', path: '/dhcpv4/leases/get' },
    { method: 'GET', path: '/dhcpv4/leases' },
    
    // Alternative paths
    { method: 'GET', path: '/dhcp/leases' },
    { method: 'GET', path: '/services/dhcpv4/leases' },
    { method: 'GET', path: '/status/services/dhcpv4/leases' },
    
    // Service status
    { method: 'GET', path: '/dhcpv4/service/status' },
    { method: 'GET', path: '/services/dhcpv4/status' },
    
    // Settings endpoints
    { method: 'GET', path: '/dhcpv4/settings/get' },
    
    // Interface diagnostics (might contain DHCP info)
    { method: 'POST', path: '/diagnostics/interface/getArp', data: {} },
    { method: 'GET', path: '/diagnostics/interface/getArp' },
    
    // Status pages that might have DHCP info
    { method: 'GET', path: '/dhcpv4/leases/status' },
    { method: 'GET', path: '/status/dhcpv4/leases' },
    
    // Try without v4
    { method: 'POST', path: '/dhcp/leases/searchLease', data: {} },
    { method: 'GET', path: '/dhcp/leases/get' }
  ];

  for (const endpoint of endpoints) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${endpoint.method} ${endpoint.path}`);
    console.log('='.repeat(60));
    
    try {
      const response = endpoint.method === 'POST' 
        ? await client.post(endpoint.path, endpoint.data || {}, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          })
        : await client.get(endpoint.path, {
            headers: {
              'Accept': 'application/json'
            }
          });
      
      console.log('\nResponse data structure:');
      
      // Analyze the response structure
      if (response.data) {
        const data = response.data;
        console.log('Type:', typeof data);
        
        if (typeof data === 'object') {
          console.log('Keys:', Object.keys(data));
          
          // Check for common data patterns
          const possibleArrayKeys = ['rows', 'leases', 'data', 'items', 'results', 'list'];
          for (const key of possibleArrayKeys) {
            if (data[key] && Array.isArray(data[key])) {
              console.log(`\n✨ Found array at data.${key}:`);
              console.log(`  - Length: ${data[key].length}`);
              if (data[key].length > 0) {
                console.log(`  - First item keys:`, Object.keys(data[key][0]));
                console.log(`  - Sample item:`, JSON.stringify(data[key][0], null, 2));
              }
            }
          }
          
          // Show full structure for small responses
          const jsonStr = JSON.stringify(data, null, 2);
          if (jsonStr.length < 1000) {
            console.log('\nFull response:', jsonStr);
          } else {
            console.log('\nResponse preview (first 500 chars):', jsonStr.substring(0, 500));
          }
        } else if (Array.isArray(data)) {
          console.log('Direct array response!');
          console.log(`Length: ${data.length}`);
          if (data.length > 0) {
            console.log('First item:', JSON.stringify(data[0], null, 2));
          }
        }
      }
      
    } catch (error) {
      if (error.response) {
        console.log('Response error data:', error.response.data);
      }
    }
  }

  console.log('\n\n=== Testing Web UI endpoints (might be different) ===\n');
  
  // Sometimes the web UI uses different endpoints
  const webUIEndpoints = [
    { method: 'GET', path: '/ui/dhcpv4/leases' },
    { method: 'POST', path: '/ui/dhcpv4/leases/search', data: {} },
    { method: 'GET', path: '/dhcp/api/leases' }
  ];

  for (const endpoint of webUIEndpoints) {
    try {
      console.log(`Testing: ${endpoint.method} ${endpoint.path}`);
      const response = endpoint.method === 'POST' 
        ? await client.post(endpoint.path, endpoint.data || {})
        : await client.get(endpoint.path);
      
      console.log('Success! Data:', JSON.stringify(response.data, null, 2).substring(0, 300));
    } catch (error) {
      console.log('Failed:', error.message);
    }
  }
}

// Run the test
testOPNsenseAPI().catch(console.error);
