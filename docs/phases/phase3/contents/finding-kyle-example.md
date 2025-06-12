# Finding Kyle's Devices - Example Usage

## Once DHCP lease viewing is implemented, here's how we'll find Kyle:

### 1. List all devices on guest network
```
User: "Show me all devices on the guest network"

Claude: Checking DHCP leases for the guest network (VLAN 4)...

Found 8 devices on Guest network:
1. Kyle-MacBook-Pro.local - 192.168.4.125 (Apple)
2. Kyles-iPhone - 192.168.4.88 (Apple)  
3. PS5-Kyle - 192.168.4.55 (Sony)
4. DESKTOP-8HK2J9 - 192.168.4.103 (Dell)
5. android-92ba8f21 - 192.168.4.87 (Samsung)
6. Chromecast-Living - 192.168.4.92 (Google)
7. HP-Printer-Guest - 192.168.4.15 (HP)
8. Unknown - 192.168.4.201 (Unknown manufacturer)

Kyle appears to have 3 devices: MacBook Pro, iPhone, and PlayStation 5.
```

### 2. Search for Kyle specifically
```
User: "Find all devices with 'kyle' in the name"

Claude: Searching for devices with 'kyle' in hostname...

Found 3 devices matching 'kyle':
- Kyle-MacBook-Pro.local - 192.168.4.125 (Guest network)
- Kyles-iPhone - 192.168.4.88 (Guest network)
- PS5-Kyle - 192.168.4.55 (Guest network)
```

### 3. Get details about a specific device
```
User: "Tell me more about Kyle's MacBook"

Claude: Here are the details for Kyle's MacBook:
- Hostname: Kyle-MacBook-Pro.local
- IP Address: 192.168.4.125
- MAC Address: 3c:22:fb:aa:bb:cc
- Manufacturer: Apple Inc.
- Network: Guest (VLAN 4)
- Lease Started: 2025-01-10 14:32:15
- Lease Expires: 2025-01-10 18:32:15
- Status: Active
```

### 4. Reserve an IP for Kyle
```
User: "Reserve IP 192.168.4.50 for Kyle's MacBook"

Claude: I'll create a static DHCP mapping for Kyle's MacBook:
- MAC Address: 3c:22:fb:aa:bb:cc
- Reserved IP: 192.168.4.50
- Hostname: Kyle-MacBook-Pro
- Description: Kyle's MacBook - Reserved IP

✅ Static mapping created! Kyle's MacBook will always get 192.168.4.50.
```

## Implementation Status

To make this work, we need to:
1. ✅ Add DHCP API methods to client
2. ✅ Create DHCP lease resource class
3. 🔄 Add MCP tools for DHCP queries
4. 🔄 Test with real OPNsense API
5. 📋 Add static mapping management

The foundation is ready - we just need to wire up the MCP tools and test!
