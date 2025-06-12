# Phase 2 Quick Start Guide

## 🚨 Priority 0: Fix API Integration

Before doing ANYTHING else in Phase 2, you need to fix the API integration issues discovered in Phase 1 testing.

### Quick API Discovery Process

1. **Open OPNSense Web UI**
   - Go to https://opnsense.boonersystems.com:55443
   - Open Chrome DevTools (F12)
   - Go to Network tab
   - Clear the network log

2. **Capture Working API Calls**
   
   **For Firewall Alias:**
   - Navigate to: Firewall → Aliases
   - Click "+" to add new alias
   - Fill in:
     - Name: test_api_alias
     - Type: Host(s)
     - Content: 192.168.1.100
   - Click Save
   - Find the API call in DevTools
   - Copy as cURL

   **For VLAN:**
   - Navigate to: Interfaces → Other → VLAN
   - Click "+" to add new VLAN
   - Fill in:
     - Parent: igc2
     - VLAN tag: 999
     - Description: API Test
   - Click Save
   - Find the API call in DevTools
   - Copy as cURL

3. **Update Code**
   - Compare the captured calls with current implementation
   - Update endpoints in `src/index.ts`
   - Fix payload formats in resource classes
   - Test with MCP

### Test Commands After Fix

```javascript
// Test firewall alias creation
await use_mcp_tool("opnsense", "applyResource", {
  action: "create",
  resource: {
    type: "opnsense:firewall:alias",
    name: "phase2_test",
    properties: {
      type: "host",
      content: "192.168.1.100",
      description: "Phase 2 API test"
    }
  }
});
```

## ✅ Phase 2 Development Order

1. **Fix API Integration** (Week 1, Days 1-2)
2. **Network Discovery Tools** (Week 1, Days 3-5)
3. **HAProxy Enhancement** (Week 2)
4. **DNS Management** (Week 3)
5. **Certificate Management** (Week 3-4)
6. **Multi-MCP Integration** (Week 4)

## 📋 Success Checklist

- [ ] All Phase 1 resources can be created via API
- [ ] MAC address search working
- [ ] ARP table retrieval working
- [ ] HAProxy backend management working
- [ ] DNS override creation working
- [ ] Certificate generation working
- [ ] Cross-MCP communication tested

## 🛠️ Development Tips

1. **Always Test API First**
   ```bash
   # Test with curl before implementing
   curl -k -u "apikey:secret" -X POST \
     https://opnsense.example.com/api/endpoint \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

2. **Add Debug Logging**
   ```typescript
   if (process.env.DEBUG) {
     console.error('API Request:', endpoint, payload);
     console.error('API Response:', response.data);
   }
   ```

3. **Create Test Scripts**
   - One test file per resource type
   - Test both success and failure cases
   - Document the working payloads

## 🚀 Quick Wins

After fixing API integration:
1. MAC search tool - High value, relatively simple
2. DHCP lease viewer - Already partially working
3. ARP table viewer - Simple GET request

Good luck with Phase 2! Remember: **Fix the API first!** 🎯
