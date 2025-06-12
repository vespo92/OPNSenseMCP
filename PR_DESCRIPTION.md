# Pull Request: Add OPNsense MCP Server

## Overview

This PR adds the OPNsense MCP server to the network & infrastructure tools section of the MCP servers repository.

## What is OPNsense MCP?

OPNsense MCP is a Model Context Protocol server that provides programmatic control over OPNsense firewalls, enabling AI-assisted network management and Infrastructure as Code capabilities through Claude Desktop.

## Key Features

### 🌐 Network Management
- **VLAN Management** - Create, configure, and manage VLANs
- **Interface Control** - List and manage network interfaces
- **DHCP Insights** - View and search connected devices

### 🔥 Firewall Control
- **Rule Management** - Create, update, and delete firewall rules
- **Preset Templates** - Quick deployment of common rule patterns
- **Smart Search** - Find rules by description or criteria

### 🛡️ DNS Security
- **Domain Blocking** - Manage DNS blocklists
- **Category Filters** - Apply predefined blocking categories (adult, malware, ads, social)
- **Bulk Operations** - Block multiple domains at once

### 💾 Infrastructure as Code
- **Declarative Config** - Define network infrastructure in JSON/YAML
- **State Tracking** - Monitor resource state with rollback capabilities
- **Modular Design** - Ready for integration with other MCP servers

### 🔧 System Features
- **Backup/Restore** - Configuration backup management
- **Caching Support** - Redis and PostgreSQL integration
- **Error Handling** - Comprehensive error messages and recovery

## Integration Example

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/opnsense-mcp",
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "your_key",
        "OPNSENSE_API_SECRET": "your_secret"
      }
    }
  }
}
```

## Use Cases

1. **Home Network Automation** - "Create a guest VLAN with internet-only access"
2. **Security Management** - "Block all social media sites on my network"
3. **Device Discovery** - "Find Kyle's laptop on the network"
4. **Gaming Setup** - "Set up a Minecraft server with proper port forwarding"
5. **Network Monitoring** - "Show me all devices on the IoT network"

## Future Vision

This server is part of a larger ecosystem for home infrastructure automation. Future plans include:
- Integration with Proxmox VE for VM management
- Docker/Kubernetes orchestration
- Unified IaC deployments across multiple services
- Web UI for visual infrastructure management

## Repository Details

- **Repository**: https://github.com/VinSpo/opnsense-mcp
- **License**: MIT
- **Documentation**: Comprehensive guides included
- **Examples**: Multiple usage examples provided
- **CI/CD**: GitHub Actions configured

## Testing

The server has been thoroughly tested with:
- OPNsense 24.x versions
- Claude Desktop on Windows, macOS, and Linux
- Various network configurations

## Why Include This?

1. **Unique Capability** - First MCP server for firewall management
2. **Real-World Use** - Actively used in production home networks
3. **Extensible Design** - Foundation for broader network automation
4. **Quality Code** - TypeScript, proper error handling, comprehensive docs
5. **Active Development** - Regular updates and feature additions

## Checklist

- [x] Public GitHub repository
- [x] MIT License
- [x] Comprehensive README
- [x] Proper package.json configuration
- [x] TypeScript implementation
- [x] No hardcoded credentials
- [x] Environment variables documented
- [x] MCP protocol properly implemented
- [x] Works with Claude Desktop
- [x] Clear tool descriptions
- [x] Error handling implemented
- [x] API documentation
- [x] Configuration examples
- [x] Troubleshooting guide
- [x] Usage examples
- [x] GitHub Actions CI/CD

---

Thank you for considering this addition to the MCP servers repository. This project aims to make network management more accessible through AI assistance while maintaining security and best practices.