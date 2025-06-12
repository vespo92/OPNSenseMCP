# OPNsense MCP DHCP Fix Solution

## Problem Summary
The DHCP lease functions are failing with "Cannot read properties of undefined (reading 'substring')" because:
1. The API response format might be different than expected
2. The MAC address field might be undefined or null
3. The response structure might vary between OPNsense versions

## Solution Steps

### 1. Run the Debug Script
First, run the comprehensive debug script to identify the actual API response:

```bash
node debug-dhcp-comprehensive.js
```

This will test multiple endpoints and show you the exact response structure.

### 2. Identify the Working Endpoint
Look for an endpoint that returns data with:
- Status 200
- An array of DHCP lease objects
- Fields like IP address, MAC address, hostname

Common working patterns:
- Response has a `rows` array: `response.rows`
- Response has a `leases` array: `response.leases`
- Response is directly an array: `response`
- Response has nested data: `response.data.leases`

### 3. Update the API Client (if needed)
If the endpoint is different than `/dhcpv4/leases/searchLease`, update the client method in `src/api/client.ts`:

```typescript
async searchDhcpLeases(params: any = {}): Promise<any> {
  // Try the endpoint that worked in your debug
  return this.post('/your/working/endpoint', params);
}
```

### 4. Update the DHCP Resource
The fixed version (`leases.ts`) already includes:
- Better error handling
- Multiple response format support
- Null checks for MAC addresses
- Debug mode for troubleshooting

### 5. Build and Test

```bash
# Build the TypeScript
npm run build

# Test with the fixed implementation
node test-dhcp-fixed.js
```

### 6. Common Fixes Based on API Response

#### If the API returns an empty response:
- Check if DHCP service is enabled in OPNsense
- Verify the user has permissions to view DHCP leases
- Try alternative endpoints from the debug script

#### If fields are named differently:
Update the `normalizeLease` method in `leases.ts` to map the actual field names:

```typescript
private normalizeLease(rawLease: any): DhcpLease {
  return {
    address: rawLease.address || rawLease.ip || rawLease.ipv4 || '',
    hwaddr: rawLease.hwaddr || rawLease.mac || rawLease.macaddr || rawLease.ether || '',
    hostname: rawLease.hostname || rawLease.host || rawLease.name || rawLease.client || '',
    // Add more mappings based on your API response
  };
}
```

#### If the response structure is completely different:
Check if you need to:
1. Use a different API module (e.g., `/status/` instead of `/dhcpv4/`)
2. Parse HTML responses (some endpoints return HTML tables)
3. Use the diagnostics API to get network information

### 7. Alternative Approaches

If the DHCP API doesn't work, you can try:

#### A. Use ARP Table
```javascript
// In the API client
async getArpTable(): Promise<any> {
  return this.post('/diagnostics/interface/getArp', {});
}
```

#### B. Parse Status Page
Some OPNsense versions expose DHCP info via status pages:
```javascript
async getDhcpStatus(): Promise<any> {
  const response = await this.get('/status/dhcpv4leases');
  // Parse the response which might be HTML or JSON
  return this.parseDhcpStatus(response);
}
```

#### C. Use Shell Commands (if available)
```javascript
async getDhcpViaShell(): Promise<any> {
  // Some OPNsense APIs allow executing commands
  return this.post('/diagnostics/command/execute', {
    command: 'dhcpd-leases'
  });
}
```

### 8. Quick Test After Fix

Once you've identified the working endpoint and updated the code:

```javascript
// Quick test
const { OPNSenseAPIClient } = require('./dist/api/client.js');
const { DhcpLeaseResource } = require('./dist/resources/services/dhcp/leases.js');

async function quickTest() {
  const client = new OPNSenseAPIClient({
    host: process.env.OPNSENSE_HOST,
    apiKey: process.env.OPNSENSE_API_KEY,
    apiSecret: process.env.OPNSENSE_API_SECRET,
    verifySsl: false
  });

  const dhcp = new DhcpLeaseResource(client, true); // Enable debug mode
  const leases = await dhcp.listLeases();
  console.log(`Found ${leases.length} leases`);
  
  if (leases.length > 0) {
    console.log('First lease:', leases[0]);
  }
}

quickTest().catch(console.error);
```

## Expected Outcome
After applying these fixes:
1. `list_dhcp_leases()` returns actual DHCP lease data
2. No more substring errors
3. Device search functions work properly
4. Guest network device listing works

## Need More Help?
1. Run the debug scripts and share the output
2. Check OPNsense version - API endpoints may vary
3. Verify API user permissions include DHCP access
4. Check if DHCP service is running in OPNsense
