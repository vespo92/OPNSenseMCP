# Phase 3 - Firewall & Network Services

## 🎯 Phase 3 Goals

Building on the successful VLAN management from Phase 2, Phase 3 will add comprehensive firewall and network service management.

## 📋 Planned Features

### 1. Firewall Rules
- Create, update, delete firewall rules
- Support for aliases in rules
- Rule ordering and priorities
- Enable/disable rules
- Apply changes after modifications

### 2. NAT / Port Forwarding
- Create port forward rules
- Outbound NAT configuration
- 1:1 NAT mappings
- NAT reflection settings

### 3. DHCP Management
- Static DHCP mappings (reservations)
- DHCP range configuration
- DHCP options per interface/VLAN

### 4. DNS Services
- Host overrides (local DNS)
- Domain overrides
- DNS forwarder settings
- Custom DNS options

### 5. Aliases
- Host aliases (IP addresses)
- Network aliases (subnets)
- Port aliases
- URL table aliases
- Nested alias support

## 🏗️ Technical Approach

### API Endpoints to Implement
Based on OPNsense API patterns discovered in Phase 2:
- `/api/firewall/filter/*` - Firewall rules
- `/api/firewall/nat/*` - NAT configuration
- `/api/dhcpv4/*` - DHCP services
- `/api/unbound/*` - DNS services
- `/api/firewall/alias/*` - Alias management

### Resource Structure
```typescript
interface FirewallRule {
  uuid?: string;
  enabled: boolean;
  action: 'pass' | 'block' | 'reject';
  interface: string;
  direction: 'in' | 'out';
  protocol: string;
  source: string;
  destination: string;
  sourcePort?: string;
  destPort?: string;
  description?: string;
}
```

## 🚀 Getting Started

1. **API Discovery** - Map out the exact endpoints for each service
2. **Resource Classes** - Create TypeScript classes for each resource type
3. **MCP Tools** - Add tools for each operation
4. **Testing** - Create test scenarios for common use cases
5. **Documentation** - Update README with new capabilities

## 📝 Success Criteria

Phase 3 will be complete when we can:
- [ ] Create a firewall rule to allow Minecraft traffic
- [ ] Set up port forwarding for a game server
- [ ] Create DHCP reservations for servers
- [ ] Add local DNS entries for services
- [ ] Manage aliases for rule organization

## 💡 Vision

By the end of Phase 3, the OPNsense MCP will be a comprehensive network management tool, allowing natural language control of all major firewall functions. This sets the stage for Phase 4's multi-MCP integration where we'll orchestrate across OPNsense, TrueNAS, and other infrastructure components.

---

**Ready to begin Phase 3 in a new chat session!**
