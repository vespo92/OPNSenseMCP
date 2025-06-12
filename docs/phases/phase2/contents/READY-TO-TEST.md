# Phase 2 Test Suite Ready! 🚀

I've created a comprehensive test suite for the OPNsense MCP server. Here's what's available:

## 🎯 Main Test Runner
```bash
run-all-tests.bat
```
This runs all tests in sequence and optionally creates VLAN 120 for Minecraft.

## 🧪 Individual Test Scripts

| Script | Purpose |
|--------|---------|
| `test-quick.js` | Quick connection test |
| `test-vlan-comprehensive.js` | Full VLAN CRUD operations test |
| `list-vlans.js` | List all existing VLANs |
| `create-minecraft-vlan.js` | Create VLAN 120 for Minecraft |
| `delete-vlan.js <uuid>` | Delete a specific VLAN |
| `test-mcp-server.js` | Test MCP server tools directly |

## 🚦 How to Test

### Option 1: Run Everything (Recommended)
```bash
run-all-tests.bat
```

### Option 2: Test Step by Step
```bash
# 1. Check connection
node test-quick.js

# 2. Run VLAN tests
node test-vlan-comprehensive.js

# 3. List current VLANs
node list-vlans.js

# 4. Create Minecraft VLAN
node create-minecraft-vlan.js
```

### Option 3: Test via Claude Desktop
Once the server is running in Claude Desktop, you can use these commands:

```javascript
// Test connection
await use_mcp_tool("opnsense", "testConnection", {});

// Create VLAN 120
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

## 📊 Expected Results

When everything is working correctly:
- ✅ API connection successful
- ✅ Can search existing VLANs  
- ✅ Can create new VLANs
- ✅ Can update VLAN properties
- ✅ Can delete VLANs
- ✅ Changes applied to OPNsense

## 🔍 Debug Mode

All tests run with debug mode enabled by default, showing:
- API requests (method, URL, payload)
- API responses (status, data)
- Detailed error messages

## 🎮 After Creating VLAN 120

1. Go to OPNsense UI → Interfaces → Other Types → VLAN
2. Verify VLAN 120 exists on igc3
3. Assign the interface (Interfaces → Assignments)
4. Configure IP address (10.2.120.1/24)
5. Set up DHCP and firewall rules

## 📈 Next Steps After Testing

Once the VLAN tests pass:
1. ✅ VLAN implementation is verified
2. 🔄 Update remaining resources (Firewall, Interface, etc.)
3. 🔍 Add network discovery tools
4. 🎯 Implement HAProxy management
5. 🌐 Add DNS zone management

## 🆘 Troubleshooting

If tests fail:
1. Check `.env` file has correct credentials
2. Verify OPNsense is reachable at the specified host
3. Ensure API user has proper permissions
4. Check debug output for specific errors

---

**Ready to test! Run `run-all-tests.bat` to begin.** 🎯
