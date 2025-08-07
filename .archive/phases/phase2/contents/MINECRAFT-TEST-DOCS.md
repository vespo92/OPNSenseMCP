# Minecraft Server (steamserver2) Deployment Test & Documentation

## 🎮 Project Overview

We're testing the OPNSense MCP server by deploying network infrastructure for a Minecraft server. This real-world test will:
- Create VLAN 120 for game server isolation
- Configure firewall rules for Minecraft (port 25565)
- Set up DNS for easy access (minecraft.local.lan)
- Document the entire process and any issues

## 📋 Test Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Deployment ID | `minecraft-steamserver2` | Unique identifier for this deployment |
| VLAN ID | 120 | Isolated network for Minecraft server |
| Server IP | 10.2.120.10 | Static IP for the Minecraft server |
| Port | 25565 | Default Minecraft Java Edition port |
| DNS Name | minecraft.local.lan | Easy-to-remember server address |
| Interface | igc2 | Trunk interface for VLANs |

## 🧪 Test Results

### Test 1: MCP Server Connection
**Date/Time:** December 2024
**Command:**
```javascript
await use_mcp_tool("opnsense", "listResourceTypes", {});
```
**Result:** 
```json
[
  "opnsense:firewall:rule",
  "opnsense:firewall:alias",
  "opnsense:network:vlan",
  "opnsense:network:interface",
  "opnsense:service:haproxy:backend",
  "opnsense:service:haproxy:server",
  "opnsense:service:haproxy:frontend",
  "opnsense:service:dns:override",
  "opnsense:service:dhcp:range",
  "opnsense:service:dhcp:static"
]
```
**Status:** ✅ Success - MCP server running with 10 resource types

### Test 2: Resource Validation
**Date/Time:** December 2024
**Command:**
```javascript
await use_mcp_tool("opnsense", "validateResources", {
  resources: [
    {
      type: "opnsense:network:vlan",
      name: "vlan_steamserver2",
      properties: {
        tag: 120,
        interface: "igc2",
        description: "Minecraft Server VLAN"
      }
    }
  ]
});
```
**Result:**
```json
{
  "valid": true,
  "resources": [
    {
      "id": "opnsense:network:vlan:minecraft_vlan_test:6d38b0f6",
      "name": "minecraft_vlan_test",
      "type": "opnsense:network:vlan",
      "valid": true,
      "errors": []
    }
  ]
}
```
**Status:** ✅ Success - Resource validation working correctly

### Test 3: Single Resource Creation (VLAN)
**Date/Time:** December 2024
**Command:**
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
**Expected Error:** API 400 error (until fixed)
**Actual Result:**
```
Error: Request failed with status code 400
```
**Status:** ❌ Failed as expected - API endpoint/payload format needs to be fixed

## 🔍 API Discovery Findings

### VLAN API Endpoint
**Captured from DevTools:** [Fill in after capture]
- **Method:** POST
- **URL:** `/api/interfaces/???`
- **Headers:**
  ```
  [Paste headers]
  ```
- **Payload:**
  ```json
  [Paste actual payload]
  ```

### Current vs Actual Comparison

| Field | Current Implementation | Actual API | Notes |
|-------|----------------------|------------|-------|
| Endpoint | `/interfaces/vlan_settings/addItem` | ??? | Need to verify |
| Wrapper Key | `vlan` | ??? | Check payload structure |
| Tag Field | `tag` (string) | ??? | String or number? |
| Interface Field | `if` | ??? | Field name |

## 📊 Complete Resource List for Minecraft

### 1. Network Resources
- **VLAN 120** - Isolated network for game server
- **Interface** - Will be created as `igc2.120`

### 2. Firewall Aliases (3 total)
- **minecraft_server_ip** - Host alias for server IP (10.2.120.10)
- **minecraft_ports** - Port alias for Minecraft (25565)
- **minecraft_allowed_sources** - Networks allowed to connect

### 3. Firewall Rules (2 total)
- **allow_minecraft_internal** - Allow from LAN/VLANs (enabled)
- **allow_minecraft_wan** - Allow from Internet (disabled by default)

### 4. DNS Overrides (2 total)
- **minecraft.local.lan** → 10.2.120.10
- **steamserver2.local.lan** → 10.2.120.10

### 5. DHCP Configuration
- **Static mapping** - Reserve 10.2.120.10 for server MAC

## 🚀 Deployment Commands

### Full Deployment (after API fix)
```javascript
// 1. Create checkpoint
await use_mcp_tool("opnsense", "createCheckpoint", {
  deploymentId: "minecraft-steamserver2",
  description: "Before Minecraft deployment"
});

// 2. Apply deployment
await use_mcp_tool("opnsense", "applyDeployment", {
  deploymentId: "minecraft-steamserver2",
  plan: minecraftPlan  // Created by the deployment script
});
```

### Rollback if needed
```javascript
await use_mcp_tool("opnsense", "rollback", {
  deploymentId: "minecraft-steamserver2",
  checkpointId: "[checkpoint-id-here]"
});
```

## 🛠️ Troubleshooting

### Common Issues

1. **400 Bad Request**
   - **Cause:** API endpoint or payload format incorrect
   - **Fix:** Use DevTools to capture actual API call

2. **Authentication Failed**
   - **Cause:** API key/secret incorrect
   - **Fix:** Verify credentials in `.env` file

3. **Resource Not Found**
   - **Cause:** UUID format or endpoint path wrong
   - **Fix:** Check UUID format in API responses

4. **VLAN Not Created**
   - **Cause:** Parent interface doesn't exist or wrong name
   - **Fix:** Verify interface name (igc0, igc1, igc2, etc.)

## 📝 Notes

### Why Minecraft for Testing?
- Simple port requirements (just 25565)
- Easy to verify connectivity
- Real-world use case
- Good test for game server deployments

### Network Design Decisions
- **VLAN 120** - Part of the "gaming servers" range (110-129)
- **Priority 1** - Higher QoS for game traffic
- **Internal only** - WAN rule disabled by default for security
- **Static DHCP** - Ensures server always gets same IP

### Future Enhancements
- HAProxy for multiple server instances
- Automated backups to TrueNAS
- Monitoring with Prometheus
- DDoS protection rules
- Bedrock Edition support (port 19132)

## 📅 Test Log

| Date/Time | Action | Result | Notes |
|-----------|--------|--------|-------|
| [Fill in] | Initial test | [Result] | [Notes] |

## 🎯 Success Criteria

- [ ] MCP server responds to commands
- [ ] Resources validate without errors  
- [ ] API calls captured from DevTools
- [ ] Endpoints and payloads updated in code
- [ ] VLAN successfully created
- [ ] Firewall rules visible in UI
- [ ] DNS resolution works
- [ ] Minecraft server accessible

## 🔗 Related Files

- `minecraft-deployment.js` - Full deployment script
- `PHASE2-QUICKSTART.md` - API discovery guide
- `src/index.ts` - Endpoints to update
- `src/resources/network/vlan.ts` - VLAN payload format

---

**Last Updated:** [Current date/time]
**Phase:** 2 - API Discovery & Testing
**Status:** 🔴 Awaiting API fixes
