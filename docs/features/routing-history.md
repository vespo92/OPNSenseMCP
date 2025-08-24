# Inter-VLAN Routing Diagnostics & Fix Guide

## Overview

The OPNsense MCP Server now includes comprehensive diagnostic and auto-fix capabilities for inter-VLAN routing issues. This solves the common problem where firewall rules are created but traffic still doesn't flow between VLANs due to interface-level blocking settings.

## The Problem

Despite creating firewall rules via the API, inter-VLAN traffic (especially DMZ to LAN) was being blocked because:

1. **Interface-level blocking**: OPNsense interfaces have a "Block private networks" setting that blocks RFC1918 addresses
2. **System-level settings**: Additional system settings can prevent inter-VLAN routing
3. **Hidden configuration**: These settings aren't always visible or accessible via standard API endpoints
4. **Multiple layers**: Routing issues can occur at interface, system, firewall, or NAT levels

## The Solution

We've implemented a comprehensive `RoutingDiagnosticsResource` that:

1. **Diagnoses** routing issues at all levels
2. **Identifies** specific blocking configurations
3. **Auto-fixes** common problems
4. **Creates** necessary firewall rules
5. **Verifies** the configuration

## New MCP Tools Available

### 1. `routing_diagnostics`
Run comprehensive diagnostics to identify routing issues.

```javascript
// Example usage in Claude
await use_mcp_tool("opnsense-mcp", "routing_diagnostics", {
  sourceNetwork: "10.0.6.0/24",  // DMZ
  destNetwork: "10.0.0.0/24"     // LAN
});
```

### 2. `routing_fix_all`
Automatically fix all detected routing issues.

```javascript
// Fix all routing issues
await use_mcp_tool("opnsense-mcp", "routing_fix_all", {});
```

### 3. `routing_fix_dmz`
Quick fix specifically for DMZ to LAN routing (includes NFS rules).

```javascript
// Quick DMZ fix
await use_mcp_tool("opnsense-mcp", "routing_fix_dmz", {});
```

### 4. `routing_create_intervlan_rules`
Create specific inter-VLAN firewall rules.

```javascript
// Create bidirectional rules
await use_mcp_tool("opnsense-mcp", "routing_create_intervlan_rules", {
  sourceNetwork: "10.0.6.0/24",
  destNetwork: "10.0.0.0/24",
  bidirectional: true
});
```

## Quick Start Guide

### Step 1: Run Diagnostics

```bash
npm run test:routing
# Select option 1 for full diagnostics
```

Or via MCP:
```javascript
await use_mcp_tool("opnsense-mcp", "routing_diagnostics", {});
```

### Step 2: Review Issues

The diagnostic will identify:
- ❌ Critical issues (blocking traffic)
- ⚠️ Warnings (potential problems)
- ℹ️ Info (configuration details)

### Step 3: Apply Fixes

Option A - Fix everything automatically:
```bash
npm run test:routing
# Select option 3
```

Option B - Quick DMZ fix:
```bash
npm run test:routing
# Select option 4
```

Option C - Via MCP:
```javascript
await use_mcp_tool("opnsense-mcp", "routing_fix_all", {});
```

### Step 4: Test Connectivity

From DMZ node (10.0.6.2):
```bash
# Basic connectivity
ping 10.0.0.14

# NFS access
showmount -e 10.0.0.14

# Mount NFS share
mount -t nfs 10.0.0.14:/mnt/tank/kubernetes /mnt/test
```

## What Gets Fixed

### 1. Interface Settings
- Disables "Block private networks" on internal interfaces
- Disables "Block bogons" for internal routing
- Ensures interfaces are enabled
- Configures DMZ-specific settings

### 2. System Settings
- Enables inter-LAN traffic globally
- Disables system-level private network blocking
- Configures static route filtering
- Sets reply-to options for proper routing

### 3. Firewall Rules
- Creates allow rules between VLANs
- Adds NFS-specific rules (ports 111, 2049)
- Sets proper rule ordering
- Applies changes immediately

### 4. Configuration Persistence
- Applies changes via multiple methods
- Reconfigures services
- Ensures changes persist

## Network Architecture

```
Internet
    |
    v
[WAN - igc0]
    |
[OPNsense Firewall]
    |
    +--[LAN - igc1] - 10.0.0.0/24
    |   |
    |   +-- TrueNAS (10.0.0.14) - NFS Server
    |
    +--[DMZ - igc3_vlan6] - 10.0.6.0/24
        |
        +-- K8s Node (10.0.6.2) - Needs NFS access
```

## Troubleshooting

### Issue: Rules created but traffic still blocked

**Diagnosis:**
```javascript
await use_mcp_tool("opnsense-mcp", "routing_diagnostics", {
  sourceNetwork: "10.0.6.0/24",
  destNetwork: "10.0.0.0/24"
});
```

**Fix:**
```javascript
await use_mcp_tool("opnsense-mcp", "routing_fix_all", {});
```

### Issue: Can't ping between VLANs

**Check interface blocking:**
```javascript
await use_mcp_tool("opnsense-mcp", "interface_get_config", {
  interfaceName: "opt8"
});
```

**Fix interface:**
```javascript
await use_mcp_tool("opnsense-mcp", "interface_enable_intervlan_routing", {
  interfaceName: "opt8"
});
```

### Issue: NFS mount fails

**Quick fix:**
```javascript
await use_mcp_tool("opnsense-mcp", "routing_fix_dmz", {});
```

This creates all necessary NFS rules and fixes routing.

## Manual UI Verification

After running fixes, verify in OPNsense Web UI:

1. **Interfaces → [interface] → Configuration**
   - ✅ "Block private networks" should be unchecked
   - ✅ "Block bogon networks" should be unchecked

2. **System → Settings → Advanced → Miscellaneous**
   - ✅ "Static route filtering" should be disabled

3. **Firewall → Rules → [interface]**
   - ✅ Should see allow rules for inter-VLAN traffic
   - ✅ Should see NFS-specific rules (ports 111, 2049)

## Command Line Testing

### Using the test script:
```bash
# Interactive diagnostic menu
npm run test:routing

# Options available:
# 1. Run full diagnostics
# 2. Run DMZ to LAN diagnostics  
# 3. Fix all routing issues
# 4. Quick fix DMZ routing
# 5. Create custom inter-VLAN rules
```

### Direct commands:
```bash
# Run diagnostics
npm run diagnose:routing

# Quick reference for DMZ fix
npm run fix:dmz
```

## API Endpoints Discovered

The diagnostic tool checks multiple endpoints to find the correct configuration:

### Interface Endpoints:
- `/interfaces/settings/get/{interface}`
- `/interfaces/{interface}/get`
- `/interfaces/vlan_settings/getItem/{interface}`
- `/interfaces/overview/list`

### System Endpoints:
- `/firewall/settings/get`
- `/firewall/settings/advanced`
- `/system/settings/get`
- `/routing/settings/get`

### Apply Endpoints:
- `/firewall/filter/apply`
- `/firewall/filter/reconfigure`
- `/interfaces/reconfigure`
- `/system/firmware/configctl`

## Success Metrics

After running the fixes, you should see:

✅ No critical issues in diagnostics
✅ Ping works between VLANs
✅ NFS mounts succeed
✅ Traffic flows bidirectionally
✅ Rules visible in Web UI
✅ Settings persist after reboot

## Implementation Details

The solution is implemented in:

- **Main Resource**: `/src/resources/diagnostics/routing.ts`
- **Interface Config**: `/src/resources/network/interfaces.ts`
- **System Settings**: `/src/resources/system/settings.ts`
- **Test Script**: `/test-routing-diagnostics.ts`

## Version Requirements

- OPNsense: 24.7 or later
- MCP Server: 0.7.6+
- Node.js: 18+

## Contributing

If you encounter routing issues not covered by the diagnostics:

1. Run diagnostics and save the output
2. Check OPNsense logs (`/var/log/configd.log`)
3. Open an issue with the diagnostic output
4. Include your network topology

## License

Part of the OPNsense MCP Server project.