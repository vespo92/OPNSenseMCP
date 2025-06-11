# OPNSense MCP Server - Project Overview

## 🎯 Project Mission

Build an AI-powered Infrastructure-as-Code (IaC) orchestration platform using Model Context Protocol (MCP) servers. This OPNSense MCP server is the network foundation for a larger ecosystem that will eventually include:

- **OPNSense MCP** (this project) - Network infrastructure
- **TrueNAS MCP** - Storage management
- **Ubuntu MCP** - Server provisioning
- **Kubernetes MCP** - Container orchestration
- **MikroTik MCP** - Switch configuration (future)

## 📁 Project Structure

```
OPNSenseMCP/
├── src/                    # TypeScript source code
├── dist/                   # Compiled JavaScript (MCP server)
├── Phase1Docs/            # Phase 1 documentation (COMPLETE)
├── Phase2Docs/            # Phase 2 documentation (COMPLETE)
├── Phase3Docs/            # Phase 3 documentation (PLANNED)
├── VinnieSpecific/        # User-specific configurations
├── examples/              # Generic examples for community
├── README.md              # Project readme
└── build.bat             # Build script
```

## 🚀 Current Status: Phase 2 Complete! Ready for Phase 3

### Phase 1 ✅ Complete
- Resource-based IaC framework
- 10 resource types implemented
- Deployment planning & rollback
- State management system
- TypeScript architecture

### Phase 2 ✅ Complete
- **Fixed API integration** - Resolved header quirks
- **VLAN management** - Full CRUD operations working
- **MCP server operational** - Claude Desktop integration successful
- **Connection testing** - API authentication verified
- **Resource discovery** - Interface enumeration working

### Phase 3 🚀 Next Up
- **Firewall Rules** - Rule creation and management
- **NAT Configuration** - Port forwarding automation
- **DHCP Static Mappings** - IP reservation management
- **DNS Overrides** - Local DNS management
- **Aliases** - IP/Port groups for rules
- **Multi-MCP Integration** - Connect with TrueNAS, Proxmox

### Phase 4+ 📋 Future
- External configuration storage (Redis/Vector DB)
- Cross-MCP orchestration
- Network topology discovery
- Automated documentation

## 🏗️ Network Architecture

**Physical Interfaces:**
- `igc0` (WAN) - Internet connection
- `igc1` (LAN) - Management network [PROTECTED]
- `igc2` (VLANIoT) - IoT devices trunk
- `igc3` (VLANSer) - Server VLANs trunk

**Server VLAN Design:**
- Each server gets its own VLAN/DMZ
- VLAN 100: steamserver0 (10.2.100.0/24)
- VLAN 120: steamserver2/Minecraft (10.2.120.0/24)
- VLAN 130-159: Reserved for future servers

## 🔧 Working Commands (Phase 2)

### List VLANs
"List all VLANs on my OPNsense firewall"

### Create VLAN
"Create VLAN 150 on interface igc3 with description 'New Server'"

### Delete VLAN
"Delete VLAN 150"

### Get Interfaces
"Show me the network interfaces on OPNsense"

## 📚 Key Documentation

### Phase 1 (Complete)
- `Phase1Docs/` - Original IaC framework documentation

### Phase 2 (Complete)
- `Phase2Docs/PHASE2-COMPLETE.md` - Implementation summary
- `Phase2Docs/testresults/` - API test results
- `Phase2Docs/typescript-fixes.md` - Build fixes documentation

### Phase 3 (Starting)
- `Phase3Docs/` - Coming soon!

### User Specific
- `VinnieSpecific/` - Personal configurations

## 🎯 Phase 3 Goals

1. **Firewall Rules** - Implement rule creation/management
2. **NAT/Port Forwarding** - Automate port forward setup
3. **DHCP Reservations** - Manage static IP assignments
4. **DNS Management** - Local DNS override automation
5. **Integration** - Connect with other MCP servers

## 💡 Vision

Transform home lab management through AI-powered automation:
- Natural language infrastructure requests
- Cross-platform orchestration
- Self-documenting deployments
- Version-controlled infrastructure

---

**Current Status:** Phase 2 Complete! VLAN management fully operational through Claude Desktop.
