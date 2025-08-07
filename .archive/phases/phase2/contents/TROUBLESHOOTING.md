# OPNSense API Troubleshooting Guide

## Quick Start
Run `troubleshoot.bat` and select option 7 to run all tests.

## Interpreting Results

### If you see "400 Bad Request - Invalid JSON syntax":
- This usually means the endpoint expects different headers or no body
- Check test-minimal.js results to see which content types work

### If you see "404 Not Found":
- The endpoint doesn't exist in your OPNsense version
- Check explore-api.js results to find the correct endpoints

### If some tests pass:
- Note which endpoints work (usually /api/core/firmware/info works)
- Use the working patterns for VLAN endpoints

## Common Fixes

### 1. Wrong Request Format
If GET requests fail with 400 but POST works:
```javascript
// Change from:
await client.get('/api/core/system/status');

// To:
await client.post('/api/core/system/status', {});
```

### 2. Wrong Endpoint Path
If `/interfaces/vlan_settings/search` returns 404:
```javascript
// Try alternatives found by explore-api.js:
'/interfaces/vlan/searchItem'
'/interfaces/vlans/search'
'/interfaces/other_settings/get' // Then look for vlan section
```

### 3. Authentication Issues
If all requests fail:
- Verify credentials in .env file
- Test with curl directly: `test-curl.bat`
- Check if API is enabled in OPNsense UI

## Manual Discovery (Most Reliable)

1. Open OPNsense Web UI
2. Press F12 for DevTools
3. Go to Network tab
4. Navigate to Interfaces → Other Types → VLAN
5. Look for API calls in Network tab
6. Note the exact endpoints and request format

## Next Steps

Once you identify working endpoints:

1. Update `src/api/client.ts` with correct endpoints
2. Update the VLAN resource mappings
3. Run `npm run build`
4. Test with `node test-quick.js`

## Example Fix

If you find that VLANs are under `/api/interfaces/other_settings/get`:

```javascript
// In src/resources/vlan.ts
async list() {
  const response = await this.client.post('/interfaces/other_settings/get', {});
  const vlans = response.vlan_settings || response.vlans || [];
  return this.normalizeVlans(vlans);
}
```

## Getting Help

1. Share the output of `troubleshoot.bat` option 7
2. Include your OPNsense version
3. Note which endpoints returned 200 OK
4. Share any working curl commands
