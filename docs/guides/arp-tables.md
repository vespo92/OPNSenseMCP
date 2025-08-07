# ARP Tables and Network Discovery Guide

Use Address Resolution Protocol (ARP) tables to discover and track devices on your network.

## Overview

ARP tables provide:
- MAC to IP address mappings
- Device discovery and tracking
- Network troubleshooting
- Security monitoring
- Manufacturer identification

## Prerequisites

- Understanding of MAC addresses
- Basic network knowledge
- MCP server connected
- Devices on local network segments

## Quick Commands

### View ARP Table

```
"Show ARP table"
```

```
"List all devices in ARP cache"
```

### Search Devices

```
"Find device with IP 192.168.1.100 in ARP table"
```

```
"Find devices with MAC starting with aa:bb:cc"
```

```
"Find all Apple devices on the network"
```

### Device Discovery

```
"Find Kyle's laptop on the network"
```

```
"Show all devices that connected in the last hour"
```

## Understanding ARP Tables

### What is ARP?

ARP resolves IP addresses to MAC addresses:
1. Device needs to send packet to IP
2. Sends ARP request: "Who has this IP?"
3. Target responds with MAC address
4. Mapping stored in ARP table

### ARP Entry Structure

Each entry contains:
- **IP Address**: Network layer address
- **MAC Address**: Hardware address
- **Interface**: Network interface
- **Type**: Dynamic or Static
- **Age**: Time since last update

Example entry:
```
IP: 192.168.1.100
MAC: aa:bb:cc:dd:ee:ff
Interface: LAN
Type: Dynamic
Age: 5 minutes
```

## Device Discovery

### Find Specific Devices

By hostname:
```
"Find 'MacBook-Pro' in network devices"
```

By manufacturer:
```
"List all Samsung devices"
```

By IP range:
```
"Show devices in 192.168.1.100-150"
```

### Identify Unknown Devices

```
"Identify device with MAC aa:bb:cc:dd:ee:ff"
```

Returns:
- Manufacturer (from MAC OUI)
- Hostname (if available)
- Last seen time
- Interface location

### Track Device Movement

```
"Show history for MAC aa:bb:cc:dd:ee:ff:
- Previous IPs
- Connection times
- Interface changes"
```

## Manufacturer Identification

### MAC Address Structure

MAC addresses reveal manufacturer:
- First 3 octets: OUI (Organizationally Unique Identifier)
- Last 3 octets: Device specific

Common OUIs:
| Prefix | Manufacturer |
|--------|-------------|
| 00:1B:63 | Apple |
| 00:15:5D | Microsoft (Hyper-V) |
| 00:50:56 | VMware |
| B8:27:EB | Raspberry Pi |
| 00:11:32 | Synology |

### Find by Manufacturer

```
"Find all Apple devices"
```

```
"List Raspberry Pi devices on network"
```

```
"Show all virtual machines (VMware/Hyper-V)"
```

## Network Mapping

### Complete Network Scan

```
"Perform complete network discovery:
- Scan all interfaces
- Include all VLANs
- Show device details
- Group by network segment"
```

### Network Topology

```
"Generate network map showing:
- Connected devices
- Network segments
- Device relationships
- Connection paths"
```

### Device Inventory

```
"Create device inventory:
- Hostname
- IP address
- MAC address
- Manufacturer
- First seen
- Last seen"
```

## Combining with DHCP

### Cross-Reference Data

ARP + DHCP provides complete picture:

```
"Show devices with both ARP and DHCP info:
- Current IP (ARP)
- Lease info (DHCP)
- Hostname (DHCP)
- MAC address (both)
- Online status (ARP)"
```

### Find Discrepancies

```
"Find devices in ARP but not DHCP:
- Static IP devices
- Rogue devices
- Misconfigured devices"
```

## Security Monitoring

### Detect Rogue Devices

```
"Alert on unknown devices:
- Not in DHCP
- Unknown manufacturer
- Suspicious MAC
- New to network"
```

### ARP Spoofing Detection

Watch for security issues:

```
"Detect ARP anomalies:
- Duplicate IPs
- MAC changes for IP
- Suspicious ARP requests
- Gratuitous ARP floods"
```

### MAC Address Changes

```
"Monitor MAC address changes:
- IP with new MAC
- MAC with new IP
- Rapid changes
- Pattern anomalies"
```

## Troubleshooting with ARP

### Connectivity Issues

```
"Diagnose connection problems:
1. Check if device in ARP table
2. Verify correct MAC/IP mapping
3. Check interface assignment
4. Verify VLAN membership
5. Test layer 2 connectivity"
```

### IP Conflicts

```
"Detect IP conflicts:
- Same IP, different MACs
- Flapping ARP entries
- Intermittent connectivity"
```

### Network Performance

```
"Identify network issues:
- Excessive ARP requests
- Slow ARP resolution
- Stale entries
- Broadcast storms"
```

## Static ARP Entries

### When to Use Static ARP

Create static entries for:
- Critical servers
- Security devices
- Prevent ARP spoofing
- Network appliances

### Create Static Entry

```
"Add static ARP entry:
- IP: 192.168.1.10
- MAC: aa:bb:cc:dd:ee:ff
- Interface: LAN
- Description: Main server"
```

### Security Benefits

Static ARP prevents:
- ARP cache poisoning
- Man-in-the-middle attacks
- IP hijacking
- MAC spoofing

## ARP Table Management

### Clear ARP Cache

```
"Clear ARP table for interface LAN"
```

```
"Flush entire ARP cache"
```

### Refresh Entries

```
"Refresh ARP entry for 192.168.1.100"
```

### Set Timeouts

```
"Configure ARP timeout:
- Default: 1200 seconds
- Minimum: 60 seconds
- Maximum: 86400 seconds"
```

## Advanced Features

### ARP Inspection

Enable on managed switches:

```
"Configure Dynamic ARP Inspection:
- Validate ARP packets
- Drop invalid ARP
- Log violations
- Rate limit ARP"
```

### Gratuitous ARP

Monitor gratuitous ARP:

```
"Track gratuitous ARP:
- IP changes
- Failover events
- VRRP/HSRP
- Load balancer changes"
```

### Proxy ARP

Configure proxy ARP:

```
"Enable proxy ARP:
- Between VLANs: No (security)
- For VPN clients: Yes
- NAT networks: As needed"
```

## Integration with Monitoring

### Metrics Collection

```
"Collect ARP metrics:
- Table size
- Entry age
- Lookup rate
- Cache hits/misses"
```

### Alerting

```
"Set up ARP alerts:
- New device detected
- Device offline > 1 hour
- ARP table full
- Unusual activity"
```

### Logging

```
"Log ARP events:
- New entries
- Entry changes
- Deletions
- Anomalies"
```

## Best Practices

### 1. Regular Monitoring
- Check ARP table daily
- Watch for new devices
- Monitor for anomalies
- Track device patterns

### 2. Documentation
- Document static entries
- Record device MACs
- Note critical devices
- Map network topology

### 3. Security
- Use static ARP for critical
- Monitor for spoofing
- Enable DAI on switches
- Log suspicious activity

### 4. Maintenance
- Clear stale entries
- Update static mappings
- Verify accuracy
- Backup configurations

## Common Scenarios

### Finding Lost Device

```
"Locate missing device:
1. Search by partial hostname
2. Check last known IP
3. Search by MAC if known
4. Check DHCP history
5. Scan network segment"
```

### New Device Setup

```
"Onboard new device:
1. Connect to network
2. Wait for DHCP
3. Find in ARP table
4. Note MAC address
5. Create static mapping if needed"
```

### Network Audit

```
"Perform network audit:
1. Export ARP table
2. Export DHCP leases
3. Compare with inventory
4. Identify unknowns
5. Document findings"
```

## Performance Optimization

### Table Size Management

```
"Optimize ARP table:
- Set appropriate timeout
- Clear stale entries
- Limit table size
- Use static for critical"
```

### Reduce ARP Traffic

```
"Minimize ARP broadcasts:
- Increase cache timeout
- Use static entries
- Implement proxy ARP carefully
- Optimize VLAN design"
```

## Scripting and Automation

### Export ARP Data

```
"Export ARP table to CSV:
- IP address
- MAC address
- Interface
- Hostname
- Manufacturer"
```

### Scheduled Scans

```
"Schedule network discovery:
- Every hour: Quick scan
- Daily: Full scan
- Weekly: Deep analysis
- Monthly: Inventory update"
```

### Integration

```
"Integrate ARP data with:
- Asset management
- Network monitoring
- Security tools
- Documentation systems"
```

## API Reference

### ARP Tools
- `listArpTable` - Show ARP entries
- `findDeviceByMac` - Search by MAC
- `findDeviceByIp` - Search by IP
- `findDevicesByName` - Search by name
- `getMacManufacturer` - Identify vendor

### Related Tools
- `listDhcpLeases` - DHCP information
- `performNetworkScan` - Active discovery
- `getNetworkTopology` - Network map

## Next Steps

- Learn about [DHCP Management](dhcp-management.md)
- Explore [Network Monitoring](../deployment/production.md#monitoring)
- Read about [Security Best Practices](firewall-rules.md)

## Related Documentation

- [Network Discovery](../troubleshooting/common-issues.md#device-discovery)
- [Security Monitoring](../deployment/production.md#security-monitoring)
- [IaC Network Inventory](../iac/patterns.md#device-tracking)