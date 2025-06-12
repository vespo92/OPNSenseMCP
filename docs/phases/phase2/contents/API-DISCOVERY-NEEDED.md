# Phase 2 - API Endpoint Discovery Needed

## 🔍 Current Issue

The API is returning errors:
- **400 Bad Request** on `/api/core/system/status` - "Invalid JSON syntax"  
- **404 Not Found** on `/api/interfaces/vlan_settings/search` - "Endpoint not found"

## 🛠️ What Needs to Be Done

### 1. Manual API Discovery (Priority 0)

We need to use the OPNsense web UI to discover the correct API endpoints:

1. **Open OPNsense Web UI**
   - Navigate to: https://opnsense.boonersystems.com:55443
   - Login with your credentials

2. **Open Browser Developer Tools**
   - Press F12 or right-click → Inspect
   - Go to the Network tab
   - Filter by "XHR" or "Fetch"

3. **Capture API Calls**
   - Navigate to Interfaces → Other Types → VLAN
   - Watch for API calls in the Network tab
   - Note the exact URLs and request/response format

4. **Test Endpoints**
   - Look for endpoints like:
     - Search/list VLANs
     - Add VLAN
     - Get VLAN details
   - Copy the exact URL paths

### 2. Quick Diagnostic Scripts

Run these to help diagnose:

```bash
# Test with curl
test-curl.bat

# Test different endpoints
node diagnose-api.js

# Test with debug
node test-api-debug.js
```

### 3. Common Issues to Check

1. **API Version Changes**
   - OPNsense might have updated their API
   - Endpoints could have moved

2. **Authentication Format**
   - Verify API key/secret are correct
   - Check if auth format has changed

3. **Request Headers**
   - Some endpoints might need specific headers
   - Content-Type might need adjustment

4. **Plugin Requirements**
   - VLAN management might require a plugin
   - Check if os-api-core plugin is installed

## 📝 Information Needed

Please check in the OPNsense UI:

1. **System Information**
   - OPNsense version (System → Firmware → Status)
   - Installed plugins (System → Firmware → Plugins)

2. **API Settings**
   - Verify API is enabled
   - Check user permissions

3. **Network Tab Discovery**
   - When viewing VLANs, what API calls are made?
   - What's the exact URL format?
   - What's in the request/response?

## 🔧 Temporary Workaround

If the standard endpoints don't work, we might need to:

1. Use the legacy API endpoints
2. Use a different authentication method
3. Update to match the current OPNsense API version

## 📋 Next Steps After Discovery

Once we have the correct endpoints:

1. Update `src/api/client.ts` with correct endpoints
2. Fix the endpoint mappings in `API_ENDPOINTS`
3. Adjust request/response handling
4. Test VLAN operations again

---

**Action Required**: Please use the browser DevTools to capture the actual API calls when managing VLANs in the OPNsense UI. This will show us the correct endpoints and request format.
