# Phase 2 Quick Reference Card

## 🚀 Quick Start

1. **Run Test Script**: `phase2docs/phase2-execute.js` in Claude Desktop
2. **Open API Helper**: `api-discovery-helper.html` in browser
3. **Access OPNSense**: https://opnsense.boonersystems.com:55443

## 🎯 Current Mission

Fix API endpoints to deploy Minecraft server in VLAN 120 DMZ!

## 🔍 What We're Looking For

### VLAN Creation (Priority 1)
- **UI Path**: Interfaces → Other → VLAN → Add
- **Test Data**:
  - Parent: `igc3`
  - VLAN tag: `999`
  - Description: `API Test`
- **Current Endpoint**: `/api/interfaces/vlan_settings/addItem` ❓
- **Check**: Payload wrapper key, field names, data types

### Firewall Alias (Priority 2)
- **UI Path**: Firewall → Aliases → Add
- **Test Data**:
  - Name: `test_api_alias`
  - Type: `Host(s)`
  - Content: `10.2.120.10`
- **Current Endpoint**: `/api/firewall/alias/addItem` ❓

### Quick DevTools Checklist
- [ ] Network tab open
- [ ] Recording started
- [ ] Cleared old entries
- [ ] Preserve log enabled
- [ ] All filters removed

## 💻 Code Update Locations

```typescript
// 1. Endpoints: src/index.ts → getEndpoint()
'opnsense:network:vlan': {
  create: '/interfaces/vlan_settings/addItem',  // UPDATE THIS
  
// 2. Payload: src/resources/network/vlan.ts → toApiPayload()
toApiPayload(): any {
  return {
    vlan: {  // CHECK WRAPPER KEY
      if: this.properties.interface,  // CHECK FIELD NAME
```

## 🧪 Test Commands

```javascript
// After updating code:
npm run build

// In Claude Desktop:
await use_mcp_tool("opnsense", "applyResource", {
  action: "create",
  resource: {
    type: "opnsense:network:vlan",
    name: "minecraft_dmz",
    properties: {
      tag: 120,
      interface: "igc3",
      description: "Minecraft VLAN 120"
    }
  }
});
```

## 📝 Success Criteria

- [ ] No more 400 errors
- [ ] VLAN 120 created
- [ ] UUID returned in response
- [ ] Visible in OPNSense UI

---

**Remember**: One resource type at a time! Start with VLAN.
