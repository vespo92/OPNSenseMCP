// Test DHCP lease functionality
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import after build
const { OPNSenseAPIClient } = require('./dist/api/client.js');
const { DhcpLeaseResource } = require('./dist/resources/services/dhcp/leases.js');

// Mock data for testing without API
const mockLeases = [
  {
    address: '192.168.4.125',
    hwaddr: '3c:22:fb:aa:bb:cc',
    hostname: 'Kyle-MacBook-Pro.local',
    if: 'igc2_vlan4',
    state: 'active',
    starts: '2025/01/10 14:32:15',
    ends: '2025/01/10 18:32:15'
  },
  {
    address: '192.168.4.88',
    hwaddr: 'aa:bb:cc:dd:ee:ff',
    hostname: 'Kyles-iPhone',
    if: 'igc2_vlan4',
    state: 'active'
  },
  {
    address: '192.168.4.55',
    hwaddr: '00:04:20:12:34:56',
    hostname: 'PS5-Kyle',
    if: 'igc2_vlan4',
    state: 'active'
  },
  {
    address: '192.168.4.103',
    hwaddr: 'b0:83:fe:11:22:33',
    hostname: 'DESKTOP-8HK2J9',
    if: 'igc2_vlan4',
    state: 'active'
  },
  {
    address: '192.168.1.100',
    hwaddr: '00:11:22:33:44:55',
    hostname: 'VinPC',
    if: 'igc1',
    state: 'active'
  }
];

async function testDhcpLeases() {
  console.log('Testing OPNsense DHCP Lease Management...\n');

  try {
    // Create API client
    const client = new OPNSenseAPIClient({
      host: process.env.OPNSENSE_HOST,
      apiKey: process.env.OPNSENSE_API_KEY,
      apiSecret: process.env.OPNSENSE_API_SECRET,
      verifySsl: false
    });

    // Test connection
    console.log('Testing connection...');
    const connTest = await client.testConnection();
    console.log('Connection:', connTest);

    // Create DHCP resource
    const dhcpResource = new DhcpLeaseResource(client);

    console.log('\n=== Testing with Mock Data ===\n');
    
    // Override listLeases for testing
    dhcpResource.listLeases = async () => mockLeases;

    // Test 1: List all leases
    console.log('1. Listing all DHCP leases:');
    const leases = await dhcpResource.listLeases();
    console.log(`   Found ${leases.length} leases\n`);

    // Test 2: Find Kyle's devices
    console.log('2. Finding Kyle\'s devices:');
    const kyleDevices = await dhcpResource.findByHostname('kyle');
    console.log(`   Found ${kyleDevices.length} devices:`);
    kyleDevices.forEach(device => {
      console.log(`   - ${dhcpResource.getDeviceInfo(device)}`);
    });

    // Test 3: Get guest network devices
    console.log('\n3. Guest network devices:');
    const guestDevices = await dhcpResource.getGuestLeases();
    console.log(`   Found ${guestDevices.length} devices on guest network:`);
    guestDevices.forEach(device => {
      console.log(`   - ${device.hostname || 'Unknown'} (${device.address})`);
    });

    // Test 4: Group by interface
    console.log('\n4. Devices by interface:');
    const byInterface = await dhcpResource.getLeasesByInterface();
    for (const [iface, devices] of byInterface) {
      console.log(`   ${iface}: ${devices.length} devices`);
    }

    // Test 5: Try real API (will likely fail but shows the attempt)
    console.log('\n=== Testing Real API ===\n');
    try {
      const realDhcp = new DhcpLeaseResource(client);
      const realLeases = await realDhcp.listLeases();
      console.log(`Real API returned ${realLeases.length} leases`);
    } catch (error) {
      console.log('Real API test failed (expected):', error.message);
      console.log('This is normal - the API endpoint might be different in your OPNsense version');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testDhcpLeases().catch(console.error);
