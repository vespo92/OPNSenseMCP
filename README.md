# OPNSense MCP Server

[![Version](https://img.shields.io/badge/version-0.7.0-blue)](https://github.com/VinSpo/opnsense-mcp/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-orange)](https://modelcontextprotocol.io)

<a href="https://glama.ai/mcp/servers/@vespo92/OPNSenseMCP">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@vespo92/OPNSenseMCP/badge" alt="OPNSense Server MCP server" />
</a>

Manage your OPNsense firewall through natural language with Claude, using the Model Context Protocol (MCP).

## What is this?

OPNSense MCP Server enables you to control your OPNsense firewall using conversational AI. Instead of navigating complex firewall interfaces, simply tell Claude what you want to do.

**Example interactions:**
- "Create a guest network on VLAN 50"
- "Block social media sites on the network"
- "Find all devices connected in the last hour"
- "Set up port forwarding for my Minecraft server"

## ✨ Key Features

- **Network Management** - VLANs, interfaces, firewall rules
- **Device Discovery** - ARP tables, DHCP leases, network scanning
- **DNS Filtering** - Block unwanted domains and categories
- **HAProxy** - Load balancing and reverse proxy configuration
- **Infrastructure as Code** - Declarative network deployments
- **Backup & Restore** - Configuration management
- **Dual Transport** - Works with Claude Desktop and as HTTP server

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- OPNsense firewall with API access enabled
- Claude Desktop (for desktop integration)

### Installation

```bash
# Clone and install
git clone https://github.com/VinSpo/opnsense-mcp
cd opnsense-mcp
npm install
npm run build

# Configure credentials
cp .env.example .env
# Edit .env with your OPNsense API credentials
```

### Run with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/opnsense-mcp",
      "env": {
        "OPNSENSE_HOST": "192.168.1.1",
        "OPNSENSE_API_KEY": "your_key",
        "OPNSENSE_API_SECRET": "your_secret"
      }
    }
  }
}
```

Then restart Claude Desktop and start chatting!

## 📚 Documentation

- **[Getting Started Guide](docs/getting-started/)** - Installation and setup
- **[Feature Guides](docs/guides/)** - Learn specific features
- **[IaC Documentation](docs/iac/)** - Infrastructure as Code
- **[API Reference](docs/api-reference/)** - Complete tool reference
- **[Troubleshooting](docs/troubleshooting/)** - Common issues and solutions

## 💡 Example Use Cases

### Create a Secure Guest Network
```
"Create a guest network on VLAN 20 with internet access only"
```

### Find Devices
```  
"Show me all devices from Apple on my network"
```

### Block Unwanted Content
```
"Block gambling and adult content sites"
```

### Set Up Services
```
"Configure HAProxy to load balance my web servers"
```

More examples in the [examples/](examples/) directory.

## 🛠️ Advanced Usage

### Server Mode (for agents and automation)
```bash
npm run start:sse  # HTTP server on port 3000
```

### Infrastructure as Code
Deploy entire network configurations declaratively. See [IaC documentation](docs/iac/).

### Custom Patterns
Build reusable network templates. See [pattern examples](examples/patterns/).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
npm install
npm run dev  # Development mode with hot reload
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Documentation](docs/)
- [Examples](examples/)
- [Issues](https://github.com/VinSpo/opnsense-mcp/issues)
- [Discussions](https://github.com/VinSpo/opnsense-mcp/discussions)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

Built with ❤️ for the MCP ecosystem
