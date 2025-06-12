# 🎮 Minecraft Server Deployment - Execution Guide

## Quick Start Testing

Copy and paste these commands into Claude Desktop console to test the OPNSense MCP:

### 1️⃣ Test MCP Connection
```javascript
await use_mcp_tool("opnsense", "listResourceTypes", {});
```

### 2️⃣ Test VLAN Creation (Will Show API Error)
```javascript
await use_mcp_tool("opnsense", "applyResource", {
  action: "create",
  resource: {
    type: "opnsense:network:vlan",
    name: "minecraft_vlan_test",
    properties: {
      tag: 120,
      interface: "igc2",
      description: "Minecraft Server VLAN Test"
    }
  }
});
```

### 3️⃣ Create Deployment Plan (Should Work)
```javascript
const minecraftResources = [
  {
    type: "opnsense:network:vlan",
    name: "vlan_steamserver2",
    properties: {
      tag: 120,
      interface: "igc2",
      description: "Minecraft Server VLAN"
    }
  },
  {
    type: "opnsense:firewall:alias",
    name: "minecraft_server_ip",
    properties: {
      type: "host",
      content: "10.2.120.10",
      description: "Minecraft server IP"
    }
  },
  {
    type: "opnsense:firewall:alias",
    name: "minecraft_ports",
    properties: {
      type: "port",
      content: "25565",
      description: "Minecraft port"
    }
  }
];

const planResult = await use_mcp_tool("opnsense", "planDeployment", {
  deploymentId: "minecraft-steamserver2",
  resources: minecraftResources
});

console.log("Plan created:", JSON.parse(planResult).summary);
```

## 📊 What You Should See

### ✅ Success (MCP Working)
- `listResourceTypes` returns 10 resource types
- `planDeployment` creates a plan with execution order

### ❌ Expected Failures (Need API Fix)
- `applyResource` returns 400 Bad Request
- Error message about invalid API call

## 🔧 Fix Process

1. **Capture API Call**
   - Open OPNSense UI
   - Create VLAN manually with DevTools open
   - Copy the cURL command

2. **Update Code**
   - Use `api-discovery-helper.html`
   - Update endpoints and payloads
   - Rebuild: `npm run build`

3. **Test Again**
   - Restart MCP in Claude Desktop
   - Run the same commands
   - Should work after fix!

## 📁 Documentation Files

- `MINECRAFT-TEST-DOCS.md` - Full test documentation
- `minecraft-deployment.js` - Complete deployment script
- `test-minecraft-step-by-step.js` - Detailed test commands
- `minecraft-network-diagram.svg` - Visual architecture

## 🎯 End Goal

Deploy complete Minecraft server infrastructure:
- ✅ Isolated VLAN 120
- ✅ Firewall rules for port 25565
- ✅ DNS: minecraft.local.lan
- ✅ Ready for server installation

Happy testing! 🚀
