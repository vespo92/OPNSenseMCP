# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2025-01-08

### Added
- **ARP Table Management** - Complete support for viewing and searching ARP table entries
  - List all ARP entries with vendor information
  - Search by IP address or subnet
  - Search by MAC address (partial matching supported)
  - Search by network interface
  - Search by hostname pattern
  - Find devices on specific VLANs
  - Get ARP table statistics (total, dynamic, static entries)
  - Extensive MAC vendor database for device identification

### Changed
- Updated server description to include ARP table support
- Enhanced API client with ARP-specific endpoints

### Technical Details
- Added `ArpTableResource` class at `src/resources/network/arp.ts`
- Added 7 new MCP tools for ARP operations
- Added ARP endpoints to API documentation
- Tested and verified with OPNsense v25.1.5_5

## [0.6.0] - Previous Release

### Added
- HAProxy support
- Macro recording functionality
- Enhanced DNS blocking features

## [0.5.0] - Previous Release

### Added
- DNS blocklist management
- DHCP lease management
- Infrastructure as Code capabilities

## [0.4.0] - Previous Release

### Added
- Firewall rule management
- Backup and restore functionality
- Dual transport support (STDIO and SSE)

## [0.3.0] - Previous Release

### Added
- VLAN management
- Basic OPNsense API integration
- MCP server foundation