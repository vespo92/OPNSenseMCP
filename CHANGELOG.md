# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.2] - 2025-01-23

### Fixed
- **NAT Implementation**: Complete rewrite using SSH/CLI approach since OPNsense doesn't expose NAT configuration through REST API
  - NAT API endpoints (`/api/firewall/nat/*`) don't exist in OPNsense
  - Implemented direct XML configuration manipulation via SSH
  - Full NAT control now available through MCP server

### Added
- SSH-based NAT management using `/conf/config.xml` manipulation
- XML parsing and building with `xml2js` package
- Interactive NAT testing tool (`test-nat-ssh.ts`)
- Comprehensive NAT documentation

### Changed
- `NATResource` completely rewritten for SSH mode
- MCP tool handlers updated to support SSH-based NAT operations
- Graceful fallback when SSH isn't configured

### Requirements
- NAT features now require SSH credentials in environment variables

## [0.8.1] - 2025-01-23

### Fixed
- **Critical: Firewall Rule Visibility** - Resolved issue where API-created rules were stored as "automation rules" and not visible
  - OPNsense segregates API-created rules separately from UI-created rules
  - Fixed by using `/firewall/filter/get` instead of `searchRule` endpoint
  - All 39+ existing automation rules now properly retrieved

### Changed
- `getAllRules()` now fetches from correct endpoint
- Rule retrieval includes both regular and automation rules
- Improved rule parsing for complex OPNsense structures

## [0.8.0] - 2025-01-22

### Added
- **SSH Executor**: Complete SSH/CLI execution capability for operations not available via API
  - Direct command execution on OPNsense
  - Configuration file manipulation
  - System-level operations
- **CLI Integration**: Execute any OPNsense CLI command via MCP
- Advanced routing diagnostics
- System configuration management

### Technical Details
- SSH2 client implementation with connection pooling
- Secure credential management via environment variables
- Command timeout and error handling

## [0.7.6] - 2025-01-22

### Added
- **Routing Diagnostics**: Comprehensive inter-VLAN routing analysis and auto-fix
  - Identifies interface-level blocking settings
  - Detects NAT interference with inter-VLAN traffic
  - Provides severity-based issue reporting
- **Auto-Fix Capabilities**: One-command routing issue resolution
  - Automatically fixes "Block private networks" settings
  - Creates necessary firewall rules
  - DMZ-specific optimizations with NFS support
- **Enhanced Interface Management**: Direct interface configuration control

### New MCP Tools
- `routing_diagnostics` - Comprehensive routing analysis
- `routing_fix_all` - Automatic issue resolution
- `routing_fix_dmz` - DMZ-specific quick fix

## [0.7.5] - 2025-01-21

### Fixed
- **Firewall Rule Persistence**: Enhanced apply changes mechanism
  - Multiple fallback methods for applying configuration
  - Reconfigure with savepoint support
  - Force filter reload capability

### Added
- Rule caching system for performance optimization
- Batch rule creation support
- Enhanced validation and error handling

## [0.7.0] - 2025-01-08

### Added
- **ARP Table Management**: Complete ARP table inspection and search
  - List all ARP entries with vendor information
  - Search by IP, MAC, interface, or hostname
  - VLAN-specific device discovery
  - Extensive MAC vendor database
- **Network Discovery**: Enhanced network device identification

### New MCP Tools
- `arp_list` - List all ARP entries
- `arp_search_ip` - Search by IP address
- `arp_search_mac` - Search by MAC address
- `arp_get_interface` - Get entries by interface
- `arp_find_vlan_devices` - Find VLAN devices
- `arp_get_statistics` - ARP table statistics

## [0.6.0] - 2024-12-15

### Added
- **HAProxy Support**: Load balancer configuration and management
- **Macro Recording**: Record and replay configuration sequences
- **Enhanced DNS Blocking**: Improved blocklist management

## [0.5.0] - 2024-12-01

### Added
- **DNS Blocklist Management**: Configure DNS filtering
- **DHCP Lease Management**: View and manage DHCP leases
- **Infrastructure as Code**: Configuration export/import

## [0.4.0] - 2024-11-15

### Added
- **Firewall Rule Management**: Complete CRUD operations for firewall rules
- **Backup and Restore**: Configuration backup functionality
- **Dual Transport Support**: STDIO for development, SSE for production

## [0.3.0] - 2024-11-01

### Added
- **VLAN Management**: Create and manage VLANs
- **Basic API Integration**: Core OPNsense API client
- **MCP Server Foundation**: Initial Model Context Protocol implementation

## [0.2.0] - 2024-10-15

### Added
- Initial project structure
- Basic OPNsense connection testing
- Environment configuration setup

## [0.1.0] - 2024-10-01

### Added
- Project initialization
- Basic documentation
- License and contribution guidelines