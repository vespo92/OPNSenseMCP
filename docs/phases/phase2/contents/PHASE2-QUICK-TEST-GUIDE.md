# Phase 2 - Quick Test Guide

## Prerequisites
- OPNsense API credentials in `.env` file
- Node.js installed
- Project dependencies installed (`npm install`)

## Step 1: Build the Project
```bash
# Windows
build.bat

# Or directly
npx tsc
```

## Step 2: Test the Updated VLAN Implementation

### Option A: Quick Test
```bash
# Enable debug mode and run test
set OPNSENSE_DEBUG=true
node phase2docs/test-vlan-updated.js
```

### Option B: Manual Test via MCP
```bash
# Start the MCP server
npm start

# In Claude Desktop, test with:
```

```javascript
// 1. Configure connection
await use_mcp_tool("opnsense", "configure", {
  host: "https://your-opnsense-host",
  apiKey: "your-api-key",
  apiSecret: "your-api-secret",
  verifySsl: false
});

// 2. Create VLAN 120 for Minecraft
await use_mcp_tool("opnsense", "applyResource", {
  resource: {
    type: "opnsense:network:vlan",
    name: "minecraft-dmz",
    properties: {
      device: "igc3",
      tag: 120,
      description: "Minecraft Server DMZ"
    }
  },
  action: "create"
});
```

## Step 3: Verify in OPNsense UI
1. Login to OPNsense web interface
2. Go to Interfaces → Other Types → VLAN
3. Look for VLAN 120 on igc3

## Expected Results

### Success Output
```
=== OPNsense VLAN API Test (Updated) ===

1. Testing API connection...
✓ Connected to OPNsense

2. Searching existing VLANs...
Found X existing VLANs

3. Creating test VLAN 999...
Create Result: {
  "result": "saved",
  "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
✓ VLAN created with UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

4. Applying configuration...
✓ Configuration applied

...
```

### Common Errors and Fixes

#### 1. "Cannot find module './api/client.js'"
```bash
# Need to build first
npx tsc
```

#### 2. "401 Unauthorized"
```bash
# Check .env file has correct credentials
# Verify API key user has permissions
```

#### 3. "400 Bad Request"
```bash
# Enable debug mode to see exact payload
set OPNSENSE_DEBUG=true
```

#### 4. "ECONNREFUSED"
```bash
# Check OPNsense host is reachable
# Verify firewall allows API access
```

## Debug Mode Output
When `OPNSENSE_DEBUG=true`, you'll see:
```
[API Request] {
  method: 'POST',
  url: '/interfaces/vlan_settings/addItem',
  data: { vlan: { device: 'igc3', tag: '999', pcp: '', description: 'API Test VLAN' } }
}
[API Response] {
  status: 200,
  statusText: 'OK',
  data: { result: 'saved', uuid: 'xxx' }
}
```

## Next Steps if Test Passes

1. **Update remaining resources** with new API patterns
2. **Create tests** for each resource type
3. **Document** working API calls
4. **Deploy** Minecraft server on VLAN 120

## Quick Reference

### Environment Variables
```env
OPNSENSE_HOST=https://your-opnsense
OPNSENSE_API_KEY=your-key
OPNSENSE_API_SECRET=your-secret
OPNSENSE_VERIFY_SSL=false
OPNSENSE_DEBUG=true
```

### Test Files
- `phase2docs/test-vlan-updated.js` - VLAN API test
- `src/api/client.ts` - New API client
- `src/resources/network/vlan.ts` - Updated VLAN resource

### MCP Tools
- `configure` - Set up connection
- `applyResource` - Create/update/delete resources
- `listResourceTypes` - See available resources
- `validateResources` - Check configuration

---

**Ready to test? Run `build.bat` then `node phase2docs/test-vlan-updated.js`!** 🚀
