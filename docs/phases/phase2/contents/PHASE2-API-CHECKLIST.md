# Phase 2 API Discovery Checklist

## 🎯 Priority API Calls to Capture

### 1. VLAN Creation
**UI Path:** Interfaces → Other → VLAN → Add (+)
**Test Data:**
- Parent: `igc2`
- VLAN tag: `999`
- Description: `Phase 2 Test VLAN`

**What to look for in DevTools:**
- Method: POST
- URL path containing: `/api/interfaces/vlan`
- Request payload structure
- Response format (especially UUID)

**Current implementation expects:**
```json
{
  "vlan": {
    "if": "igc2",
    "tag": "999",
    "descr": "Phase 2 Test VLAN",
    "vlanif": "igc2.999"
  }
}
```

### 2. Firewall Alias
**UI Path:** Firewall → Aliases → Add (+)
**Test Data:**
- Name: `test_phase2_hosts`
- Type: `Host(s)`
- Content: `192.168.1.100`
- Description: `Phase 2 Test Alias`

**What to look for in DevTools:**
- Method: POST
- URL path containing: `/api/firewall/alias`
- Request payload structure
- Apply/reconfigure endpoint

**Current implementation expects:**
```json
{
  "alias": {
    "name": "test_phase2_hosts",
    "type": "host",
    "content": "192.168.1.100",
    "description": "Phase 2 Test Alias"
  }
}
```

### 3. HAProxy Backend (Phase 2 Feature)
**UI Path:** Services → HAProxy → Real Servers → Add (+)
**Test Data:**
- Name: `web_server_1`
- Server: `192.168.1.50`
- Port: `80`
- Description: `Phase 2 HAProxy Test`

**What to look for:**
- Complete endpoint path
- Authentication headers
- Payload structure
- How to enable/disable servers

### 4. DHCP Lease Search (Phase 2 Feature)
**UI Path:** Services → DHCPv4 → Leases
**Action:** Use the search box to find a MAC address

**What to look for:**
- GET request with search parameters
- Response format with lease details
- How MAC addresses are formatted

### 5. ARP Table (Phase 2 Feature)  
**UI Path:** Interfaces → Diagnostics → ARP Table
**Action:** Just load the page

**What to look for:**
- GET request endpoint
- Response format (array of entries)
- Available filters/parameters

## 📝 Quick cURL Analysis

When you copy a cURL command, look for these key parts:

```bash
curl 'https://opnsense.boonersystems.com:55443/api/interfaces/vlan_settings/addItem' \
  -H 'Content-Type: application/json' \    # ← Headers
  -H 'Authorization: Basic [...]' \         # ← Auth (already handled)
  --data-raw '{"vlan":{"if":"igc2",...}}' # ← Payload format
```

## 🔧 Code Update Locations

### 1. Endpoint Mapping
**File:** `src/index.ts`
**Method:** `getEndpoint()`
```typescript
'opnsense:network:vlan': {
  create: '/interfaces/vlan_settings/addItem',  // ← Update this
  update: `/interfaces/vlan_settings/setItem/${uuid}`,
  delete: `/interfaces/vlan_settings/delItem/${uuid}`,
  apply: '/interfaces/vlan_settings/reconfigure'
}
```

### 2. Payload Format  
**File:** `src/resources/network/vlan.ts`
**Method:** `toApiPayload()`
```typescript
toApiPayload(): any {
  return {
    vlan: {  // ← Check if wrapper key is correct
      if: this.properties.interface,
      tag: this.properties.tag.toString(),
      // ... other fields
    }
  };
}
```

### 3. Response Handling
**File:** `src/resources/network/vlan.ts`
**Method:** `fromApiResponse()`
```typescript
fromApiResponse(response: any): void {
  // Check actual response structure
  if (response.uuid) {  // ← Verify field names
    this.outputs.uuid = response.uuid;
  }
}
```

## ✅ Success Criteria

You'll know the API is fixed when:

1. **No more 400 errors** - API calls succeed
2. **Resources created** - Can see them in OPNSense UI
3. **UUIDs returned** - Response includes resource UUID
4. **State updated** - MCP tracks resource state correctly

## 🚀 Test Commands for Claude Desktop

After fixing each resource type:

```javascript
// Test VLAN
await use_mcp_tool("opnsense", "applyResource", {
  action: "create",
  resource: {
    type: "opnsense:network:vlan",
    name: "phase2_vlan_test",
    properties: {
      tag: 999,
      interface: "igc2",
      description: "Phase 2 Working!"
    }
  }
});

// Test Firewall Alias
await use_mcp_tool("opnsense", "applyResource", {
  action: "create",
  resource: {
    type: "opnsense:firewall:alias",
    name: "phase2_alias_test",
    properties: {
      type: "host",
      content: "192.168.1.100",
      description: "Phase 2 Working!"
    }
  }
});
```

## 💡 Pro Tips

1. **Test incrementally** - Fix one resource type at a time
2. **Check apply endpoints** - Some resources need a separate "apply" call
3. **Watch for async operations** - Some API calls trigger background tasks
4. **UUID format** - OPNSense uses standard UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
5. **Error messages** - API usually returns helpful error details in response body

Good luck with Phase 2! 🎯 Remember: Fix the API first, then the cool features will follow!
