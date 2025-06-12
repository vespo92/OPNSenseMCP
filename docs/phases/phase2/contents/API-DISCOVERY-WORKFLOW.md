# Phase 2 API Discovery Workflow

## 🎯 Goal: Fix VLAN Creation API

We'll start with VLAN creation since that's the foundation for the Minecraft server deployment.

## 📋 Pre-Flight Checklist

- [ ] OPNSense access ready
- [ ] Chrome/Edge browser available  
- [ ] `phase2-execute.js` run in Claude Desktop
- [ ] This guide open for reference

## 🔧 Step-by-Step Process

### Step 1: Run Initial Test
```javascript
// In Claude Desktop console:
// Copy and run phase2docs/phase2-execute.js
// This will show current errors
```

### Step 2: Open OPNSense UI
1. Navigate to: https://opnsense.boonersystems.com:55443
2. Log in with your credentials
3. Keep this tab open

### Step 3: Prepare DevTools
1. Press `F12` to open Developer Tools
2. Click on the **Network** tab
3. Click the **Clear** button (🚫) to remove old entries
4. Check **Preserve log** checkbox
5. Make sure **All** filter is selected (not just XHR)

### Step 4: Navigate to VLAN Section
1. In OPNSense: **Interfaces** → **Other** → **VLAN**
2. You should see existing VLANs (like VLAN 100 for steamserver0)
3. **DO NOT CLICK ADD YET!**

### Step 5: Start Recording
1. In DevTools: Ensure Network tab is recording (red dot)
2. Clear the network log one more time
3. Now click the **"+"** button to add a VLAN

### Step 6: Fill Test VLAN Form
Fill in EXACTLY these values:
- **Parent**: `igc3` (select from dropdown)
- **VLAN tag**: `999`
- **VLAN priority**: Leave default
- **Description**: `API Discovery Test`
- **Advanced**: Don't change anything

### Step 7: Save and Capture
1. Click **Save** button
2. Watch DevTools - look for POST requests
3. Find the request to `/api/interfaces/...`
4. Right-click on it
5. Select **Copy** → **Copy as cURL (cmd)** or **Copy as cURL (bash)**

### Step 8: Analyze the Request
Paste the cURL into a text editor and look for:

```bash
# Example of what to look for:
curl 'https://opnsense.boonersystems.com:55443/api/interfaces/????' \
  -H 'Content-Type: application/json' \
  --data-raw '{"vlan":{"if":"igc3","tag":"999",...}}'
```

Note these critical items:
- [ ] Exact API path after `/api/`
- [ ] The JSON payload structure
- [ ] Field names (is it `if` or `interface`?)
- [ ] Data types (is tag a string "999" or number 999?)

### Step 9: Check the Response
1. In DevTools, click on the request
2. Go to **Response** tab
3. Look for:
   - Success indicator (result: "saved"?)
   - UUID format and location
   - Any error messages

### Step 10: Clean Up
1. Delete the test VLAN 999 from OPNSense UI
2. This prevents conflicts later

## 📝 Document Your Findings

Create: `VinnieSpecific/vlan-api-discovery.json`

```json
{
  "discovered": "2024-12-10",
  "vlan_endpoint": {
    "url": "PASTE_ACTUAL_PATH_HERE",
    "method": "POST",
    "payload": {
      "PASTE": "ACTUAL_PAYLOAD_HERE"
    },
    "response": {
      "PASTE": "ACTUAL_RESPONSE_HERE"
    }
  }
}
```

## 🔧 Update the Code

### 1. Update Endpoint (src/index.ts)
Find the `getEndpoint()` method and update:
```typescript
'opnsense:network:vlan': {
  create: '/PUT_ACTUAL_PATH_HERE',
```

### 2. Update Payload Format (src/resources/network/vlan.ts)
Find `toApiPayload()` and match the actual format

### 3. Rebuild
```bash
npm run build
```

### 4. Restart MCP in Claude Desktop

### 5. Test Again
Run the same test - should work now!

## 🎉 Success Indicators

- No more 400 error
- Response includes UUID
- VLAN appears in OPNSense UI
- Can create VLAN 120 for Minecraft

## 🔄 Repeat for Other Resources

Once VLAN works, repeat for:
1. Firewall Alias
2. Firewall Rules  
3. DNS Override
4. DHCP Static

---

**Tip**: Save all cURL commands - they're your source of truth!
