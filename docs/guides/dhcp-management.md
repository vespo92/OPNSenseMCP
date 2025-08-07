# DHCP Management Guide

Manage Dynamic Host Configuration Protocol (DHCP) to automatically assign IP addresses and network settings to devices.

## Overview

DHCP provides:
- Automatic IP address assignment
- Network configuration (gateway, DNS)
- Lease management and tracking
- Static mappings for specific devices
- Option configuration (NTP, TFTP, etc.)

## Prerequisites

- Configured network interfaces or VLANs
- IP address range planning
- Understanding of network topology
- MCP server connected

## Quick Commands

### View DHCP Leases

```
"Show all DHCP leases"
```

```
"Find DHCP leases for devices with 'laptop' in the name"
```

```
"Show expired DHCP leases"
```

### Configure DHCP

```
"Enable DHCP on LAN with range 192.168.1.100-200"
```

```
"Set up DHCP on VLAN 50 for guest network"
```

### Static Mappings

```
"Create static DHCP mapping:
- MAC: aa:bb:cc:dd:ee:ff
- IP: 192.168.1.50
- Hostname: office-printer"
```

## DHCP Server Configuration

### Basic Setup

Enable DHCP on an interface:

```javascript
{
  interface: "lan",
  enable: true,
  range: {
    from: "192.168.1.100",
    to: "192.168.1.200"
  },
  gateway: "192.168.1.1",
  dns: ["192.168.1.1"],
  domain: "home.local"
}
```

### Lease Settings

Configure lease times:

```
"Set DHCP lease time:
- Default: 7200 seconds (2 hours)
- Maximum: 86400 seconds (24 hours)"
```

Common lease times:
- Guest network: 2-4 hours
- Office network: 8-24 hours
- Home network: 24-168 hours

### DNS Configuration

Set DNS servers for DHCP clients:

```
"Configure DHCP DNS:
- Primary: 192.168.1.1 (OPNsense)
- Secondary: 8.8.8.8 (Google)
- Domain: internal.local"
```

## IP Range Planning

### Subnet Design

Organize your IP space:

| Network | Subnet | DHCP Range | Static Range | Purpose |
|---------|--------|------------|--------------|---------|
| LAN | 192.168.1.0/24 | .100-.200 | .10-.99 | Main network |
| Guest | 192.168.50.0/24 | .100-.250 | None | Visitors |
| IoT | 192.168.20.0/24 | .100-.200 | .10-.99 | Smart devices |
| Mgmt | 192.168.99.0/24 | None | .1-.254 | Infrastructure |

### Reserved Addresses

Keep these IPs available:
- .1: Gateway (OPNsense)
- .2-.9: Network infrastructure
- .10-.99: Static assignments
- .100-.200: DHCP pool
- .250-.254: Temporary/testing

## Static DHCP Mappings

### When to Use Static Mappings

Assign fixed IPs to:
- Servers
- Printers
- Network devices
- Smart home hubs
- Security cameras

### Creating Static Mappings

```
"Create static mappings for office devices:
1. Printer: MAC aa:bb:cc:11:22:33 → 192.168.1.20
2. NAS: MAC dd:ee:ff:44:55:66 → 192.168.1.21
3. Camera: MAC 11:22:33:44:55:66 → 192.168.1.30"
```

### Bulk Static Mappings

```
"Import static DHCP mappings from CSV:
hostname,mac,ip
printer,aa:bb:cc:dd:ee:ff,192.168.1.20
nas,11:22:33:44:55:66,192.168.1.21"
```

## DHCP Options

### Common Options

Configure additional DHCP options:

```
"Set DHCP options:
- Option 42: NTP servers (192.168.1.1)
- Option 66: TFTP server (192.168.1.10)
- Option 150: VoIP server (192.168.1.15)"
```

### Option Reference

| Option | Description | Example |
|--------|-------------|---------|
| 3 | Default gateway | 192.168.1.1 |
| 6 | DNS servers | 192.168.1.1,8.8.8.8 |
| 15 | Domain name | home.local |
| 42 | NTP servers | 192.168.1.1 |
| 66 | TFTP server | 192.168.1.10 |
| 119 | Domain search | local,internal |
| 150 | VoIP TFTP | 192.168.1.15 |

### Custom Options

Add vendor-specific options:

```
"Add custom DHCP option 252 for WPAD:
Value: http://192.168.1.1/wpad.dat"
```

## DHCP Relay

### Configure DHCP Relay

For multi-subnet environments:

```
"Set up DHCP relay:
- Interface: VLAN50
- DHCP server: 192.168.1.1
- Append circuit ID: yes"
```

### Use Cases

DHCP relay is useful for:
- Centralized DHCP management
- Multiple VLANs/subnets
- Reducing DHCP servers
- Cross-subnet communication

## Lease Management

### View Active Leases

```
"Show active DHCP leases with details:
- IP address
- MAC address
- Hostname
- Lease start time
- Lease end time"
```

### Search Leases

```
"Find Kyle's devices in DHCP leases"
```

```
"Show all Apple devices (MAC prefix)"
```

### Release and Renew

Force lease actions:

```
"Release DHCP lease for 192.168.1.150"
```

```
"Clear all expired DHCP leases"
```

## Device Tracking

### Find Devices by Name

```
"Find all devices with 'laptop' in DHCP"
```

### Find by Manufacturer

```
"List all Samsung devices on network"
```

### Track Device History

```
"Show DHCP history for MAC aa:bb:cc:dd:ee:ff"
```

## Troubleshooting DHCP

### Client Not Getting IP

Check these items:

```
"DHCP troubleshooting checklist:
1. DHCP service enabled on interface
2. IP range has available addresses
3. No IP conflicts
4. Firewall allows DHCP (ports 67/68)
5. Client set to DHCP (not static)"
```

### Wrong Network Settings

Verify configuration:

```
"Check DHCP server settings:
- Gateway is correct
- DNS servers are reachable
- Domain name is set
- Options are proper format"
```

### Lease Exhaustion

```
"If DHCP pool exhausted:
1. Check current lease count
2. Reduce lease time
3. Expand IP range
4. Clear stale leases
5. Check for rogue devices"
```

## DHCP Security

### Prevent Rogue DHCP

Protect against unauthorized DHCP:

```
"Security measures:
1. DHCP snooping on switches
2. Block DHCP on untrusted VLANs
3. Monitor for multiple DHCP servers
4. Use static mappings for critical"
```

### MAC Address Filtering

Restrict DHCP to known devices:

```
"Enable DHCP MAC filtering:
- Deny unknown clients
- Allow list: [MAC addresses]
- Log denied requests"
```

### Rate Limiting

Prevent DHCP exhaustion attacks:

```
"Set DHCP rate limits:
- Max leases per MAC: 1
- Max requests per minute: 10
- Block after threshold"
```

## Multi-Network DHCP

### Per-VLAN Configuration

Different settings per network:

```yaml
LAN:
  range: 192.168.1.100-200
  lease: 86400
  dns: local

Guest:
  range: 192.168.50.100-250
  lease: 7200
  dns: public

IoT:
  range: 192.168.20.100-200
  lease: 604800
  dns: filtered
```

### Failover Configuration

High availability DHCP:

```
"Configure DHCP failover:
- Primary: OPNsense1
- Secondary: OPNsense2
- Split: 50/50
- Sync interval: 60 seconds"
```

## Integration with DNS

### Dynamic DNS Updates

Update DNS with DHCP leases:

```
"Enable dynamic DNS:
- Update forward zones
- Update reverse zones
- Domain: home.local
- TTL: 3600"
```

### Hostname Registration

Register DHCP clients in DNS:

```
"Configure hostname registration:
- Register DHCP clients in DNS
- Override client hostname: optional
- Domain suffix: home.local"
```

## Monitoring and Reporting

### Lease Statistics

```
"Show DHCP statistics:
- Total leases
- Active leases
- Expired leases
- Available IPs
- Utilization percentage"
```

### Usage Trends

```
"Analyze DHCP usage:
- Peak usage times
- Average lease duration
- Most active clients
- New devices this week"
```

### Alerts

Set up monitoring:

```
"Create DHCP alerts:
- Pool > 80% full
- Rogue DHCP detected
- Excessive requests
- Service stopped"
```

## Best Practices

### 1. IP Planning
- Reserve space for growth
- Separate static and dynamic
- Document assignments
- Use consistent schemes

### 2. Lease Times
- Short for guests
- Long for infrastructure
- Medium for workstations
- Consider device types

### 3. Redundancy
- Configure failover
- Backup configurations
- Monitor availability
- Test recovery

### 4. Security
- Limit pool sizes
- Use static for critical
- Monitor for rogues
- Log all activity

## Common Scenarios

### Home Network

```
"Configure home DHCP:
- LAN: 192.168.1.100-200
- Static for: NAS, printers, smart hubs
- Lease time: 1 week
- DNS: Pi-hole or OPNsense"
```

### Small Office

```
"Set up office DHCP:
- Workstations: 192.168.1.100-150
- Phones: 192.168.2.100-150
- Printers: Static mappings
- Lease time: 24 hours
- DNS: Local AD server"
```

### Guest Network

```
"Guest DHCP configuration:
- Range: 192.168.50.100-250
- Lease time: 2 hours
- DNS: Public (8.8.8.8)
- No local domain
- Isolation enabled"
```

## Advanced Features

### DHCP Classes

Assign options by device class:

```
"Configure DHCP classes:
- VoIP phones: Get TFTP option
- Workstations: Get domain
- Printers: Get static mapping"
```

### Conditional Options

Options based on conditions:

```
"If client vendor = 'MSFT':
  Provide Windows-specific options
Else if vendor = 'Apple':
  Provide macOS options"
```

## API Reference

### DHCP Tools
- `listDhcpLeases` - Show current leases
- `configureDhcpServer` - Set up DHCP
- `createStaticMapping` - Add static entry
- `deleteLease` - Remove lease

### Related Tools
- `findDevicesByName` - Search by hostname
- `getNetworkStatistics` - Usage stats
- `configureDns` - DNS integration

## Next Steps

- Learn about [DNS Configuration](dns-blocking.md)
- Explore [VLAN Management](vlan-management.md)
- Read about [Network Monitoring](arp-tables.md)

## Related Documentation

- [Network Planning](../deployment/production.md#network-design)
- [IaC DHCP Patterns](../iac/patterns.md#dhcp-configuration)
- [Troubleshooting Guide](../troubleshooting/common-issues.md#dhcp)