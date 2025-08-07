# Phase 3 Addition: DHCP Lease Management

## 🎯 New Feature: DHCP Lease Viewing & Management

### Use Cases
1. **Find devices by hostname** - "Show me Kyle's devices on the guest network"
2. **View active leases** - See all connected devices with IPs, MACs, and hostnames
3. **Create static mappings** - Reserve IPs for specific devices
4. **Monitor network usage** - Track who's connected and when
5. **Troubleshoot connectivity** - Identify devices having issues

### Implementation Plan

## 1. DHCP Lease Viewer

```typescript
interface DhcpLease {
  address: string;      // IP address
  hwaddr: string;       // MAC address
  hostname?: string;    // Device hostname
  descr?: string;       // Description
  starts?: Date;        // Lease start time
  ends?: Date;          // Lease end time
  state?: 'active' | 'expired' | 'reserved';
  interface?: string;   // Which interface/VLAN
}

interface DhcpLeaseResource {
  // View all leases
  listLeases(interface?: string): Promise<DhcpLease[]>;
  
  // Find leases by hostname pattern
  findByHostname(pattern: string): Promise<DhcpLease[]>;
  
  // Find leases by MAC address
  findByMac(mac: string): Promise<DhcpLease[]>;
  
  // Get leases for specific VLAN
  getVlanLeases(vlanTag: string): Promise<DhcpLease[]>;
}
```

## 2. Static DHCP Mappings

```typescript
interface DhcpStaticMapping {
  mac: string;          // MAC address
  ipaddr: string;       // Reserved IP
  hostname?: string;    // Optional hostname
  descr?: string;       // Description
  interface: string;    // Interface/VLAN
}

interface DhcpStaticResource {
  // List all static mappings
  listMappings(interface?: string): Promise<DhcpStaticMapping[]>;
  
  // Create static mapping
  createMapping(mapping: DhcpStaticMapping): Promise<{uuid: string}>;
  
  // Delete static mapping
  deleteMapping(uuid: string): Promise<boolean>;
  
  // Update mapping
  updateMapping(uuid: string, updates: Partial<DhcpStaticMapping>): Promise<boolean>;
}
```

## 3. MCP Tools to Add

### Lease Viewing Tools
- `list_dhcp_leases` - Show all active DHCP leases
- `find_device_by_name` - Search for devices by hostname
- `find_device_by_mac` - Search by MAC address
- `show_guest_devices` - List all devices on guest network
- `show_vlan_devices` - List devices on specific VLAN

### Static Mapping Tools
- `list_static_mappings` - Show all DHCP reservations
- `create_static_mapping` - Reserve IP for device
- `delete_static_mapping` - Remove reservation
- `update_static_mapping` - Modify reservation

## 4. Example Usage in Claude

```
User: "Show me all devices on the guest network"

Claude: I'll check the DHCP leases for the guest network (VLAN 4):

Found 5 devices on Guest network:
1. Kyle-MacBook-Pro.local - 192.168.4.125 (Apple device)
2. DESKTOP-A8K9J2 - 192.168.4.103 (Windows PC) 
3. android-28fa92b1 - 192.168.4.87 (Android phone)
4. PS5-Kyle - 192.168.4.55 (PlayStation 5)
5. Unknown - 192.168.4.201 (No hostname)

Kyle appears to have 2 devices connected: a MacBook and a PlayStation 5.
```

```
User: "Reserve IP 192.168.4.50 for Kyle's MacBook"

Claude: I'll create a static DHCP mapping for Kyle's MacBook:
- MAC Address: aa:bb:cc:dd:ee:ff
- Reserved IP: 192.168.4.50
- Hostname: Kyle-MacBook-Pro
- Interface: Guest (VLAN 4)

✅ Static mapping created! Kyle's MacBook will always get 192.168.4.50 when it connects.
```

## 5. API Endpoints (OPNsense)

Based on OPNsense patterns, likely endpoints:
- `/api/dhcpv4/leases/searchLease` - List active leases
- `/api/dhcpv4/settings/searchStaticMap` - List static mappings
- `/api/dhcpv4/settings/addStaticMap` - Create static mapping
- `/api/dhcpv4/settings/delStaticMap/{uuid}` - Delete mapping
- `/api/dhcpv4/settings/setStaticMap/{uuid}` - Update mapping
- `/api/dhcpv4/service/reconfigure` - Apply changes

## 6. Implementation Priority

1. **Phase 3.1** - DHCP Lease Viewing (Read-only)
   - List all leases
   - Search by hostname
   - Filter by VLAN/interface
   - Show device details

2. **Phase 3.2** - Static Mappings (Read/Write)
   - Create reservations
   - Update existing mappings
   - Delete mappings
   - Apply changes

3. **Phase 3.3** - Advanced Features
   - Lease history tracking
   - Wake-on-LAN support
   - DHCP options per device
   - Integration with firewall rules

## 7. Benefits

- **Visibility** - See all devices on your network instantly
- **Control** - Reserve IPs for important devices
- **Security** - Identify unknown devices
- **Troubleshooting** - Quick device lookup
- **Automation** - Create rules based on device presence

## 8. Database Schema Addition

```sql
-- Track DHCP lease history
CREATE TABLE IF NOT EXISTS dhcp_lease_history (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL,
    ip_address INET NOT NULL,
    hostname VARCHAR(255),
    interface VARCHAR(50),
    lease_start TIMESTAMP,
    lease_end TIMESTAMP,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track static mappings
CREATE TABLE IF NOT EXISTS dhcp_static_mappings (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(255) UNIQUE,
    mac_address VARCHAR(17) NOT NULL,
    ip_address INET NOT NULL,
    hostname VARCHAR(255),
    description TEXT,
    interface VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX idx_dhcp_history_mac ON dhcp_lease_history(mac_address);
CREATE INDEX idx_dhcp_history_hostname ON dhcp_lease_history(hostname);
CREATE INDEX idx_dhcp_history_interface ON dhcp_lease_history(interface);
```

## Ready to Find Kyle's Devices!

With this addition to Phase 3, you'll be able to:
1. See all devices on your guest network
2. Find Kyle's devices by searching for "kyle" in hostnames
3. Reserve specific IPs for his devices
4. Track when devices connect/disconnect
5. Set up automation based on device presence

This is a perfect addition to Phase 3 that complements the firewall rules and backup features!
