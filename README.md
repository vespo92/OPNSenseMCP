# OPNSense MCP Server

A Model Context Protocol (MCP) server for managing OPNsense firewalls with Infrastructure as Code (IaC) capabilities.

![Version](https://img.shields.io/badge/version-0.4.5-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![MCP](https://img.shields.io/badge/MCP-Compatible-orange)

## 🚀 Features

- **Complete OPNsense API Integration** - Manage VLANs, firewall rules, services, and more
- **Infrastructure as Code** - Deploy and manage network infrastructure declaratively
- **State Management** - Track resource state with rollback capabilities
- **Caching Support** - Redis and PostgreSQL integration for performance
- **DNS Blocking** - Built-in DNS blocklist management
- **Backup & Restore** - Configuration backup management

## 📋 Prerequisites

- Node.js 18+ 
- OPNsense firewall with API access enabled
- (Optional) Redis for caching
- (Optional) PostgreSQL for persistent cache

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/VinSpo/opnsense-mcp.git
cd opnsense-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Copy and configure environment
cp .env.example .env
# Edit .env with your OPNsense credentials
```

## ⚙️ Configuration

Create a `.env` file with your OPNsense configuration:

```env
# Required
OPNSENSE_HOST=https://192.168.1.1
OPNSENSE_API_KEY=your_api_key
OPNSENSE_API_SECRET=your_api_secret

# Optional
IAC_ENABLED=true
ENABLE_CACHE=false
REDIS_HOST=localhost
POSTGRES_HOST=localhost
```

## 🚦 Quick Start

```bash
# Start the MCP server
npm start

# Or use with Claude Desktop
# Add to claude_desktop_config.json:
{
  "mcpServers": {
    "opnsense": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/opnsense-mcp"
    }
  }
}
```

## 📚 Documentation

- [Getting Started Guide](docs/getting-started/README.md)
- [API Reference](docs/api/README.md)
- [IaC Architecture](docs/IaC-ARCHITECTURE.md)
- [Troubleshooting](docs/troubleshooting/README.md)

### Infrastructure as Code Example

Deploy network infrastructure declaratively:

```json
{
  "name": "home-network",
  "resources": [{
    "type": "opnsense:network:vlan",
    "id": "guest-vlan",
    "name": "Guest Network",
    "properties": {
      "interface": "igc3",
      "tag": 10,
      "description": "Isolated guest network"
    }
  }]
}
```

## 📖 Usage Examples

### Managing VLANs
```javascript
// Create a new VLAN for IoT devices
const vlan = {
  type: "opnsense:network:vlan",
  properties: {
    interface: "igc3",
    tag: 20,
    description: "IoT Network - Isolated"
  }
};
```

### Firewall Rules
```javascript
// Block all traffic from guest network to main LAN
const rule = {
  type: "opnsense:firewall:rule",
  properties: {
    action: "block",
    interface: "guest_vlan",
    source: "guest_vlan_subnet",
    destination: "lan_subnet",
    description: "Block guest to LAN"
  }
};
```

### DNS Blocking
```javascript
// Block social media sites
const blocklist = {
  type: "opnsense:dns:blocklist",
  properties: {
    domains: ["facebook.com", "twitter.com", "tiktok.com"],
    description: "Social media block",
    enabled: true
  }
};
```

### Complete Network Setup Example
```javascript
// Deploy a complete guest network with isolation
const guestNetwork = {
  name: "guest-network-setup",
  resources: [
    {
      type: "opnsense:network:vlan",
      id: "guest-vlan",
      properties: {
        interface: "igc3",
        tag: 10,
        description: "Guest WiFi Network"
      }
    },
    {
      type: "opnsense:firewall:rule",
      id: "guest-internet",
      properties: {
        action: "pass",
        interface: "guest_vlan",
        source: "guest_vlan_subnet",
        destination: "any",
        description: "Allow guest internet"
      }
    },
    {
      type: "opnsense:firewall:rule",
      id: "block-guest-lan",
      properties: {
        action: "block",
        interface: "guest_vlan",
        source: "guest_vlan_subnet",
        destination: "lan_subnet",
        description: "Isolate guest from LAN"
      }
    }
  ]
};
```

### Using with Claude Desktop
Once configured in Claude Desktop, you can ask Claude to:
- "Create a new VLAN for my smart home devices"
- "Show me all devices on my guest network"
- "Block pornhub.com on my network"
- "Set up a Minecraft server VLAN with proper firewall rules"
- "Find Kyle's laptop on the network"
- "Create a backup of my firewall configuration"

## 🔧 Troubleshooting

### Common Issues

**Connection refused errors**
- Ensure OPNsense API is enabled (System > Settings > Administration > API)
- Check firewall rules allow API access from your host
- Verify SSL settings match your configuration

**Authentication failures**
- API key and secret must be base64 encoded in OPNsense
- Ensure no trailing spaces in credentials
- Check user has appropriate permissions

**VLAN creation fails**
- Verify the physical interface exists and is not in use
- Check VLAN tag is within valid range (1-4094)
- Ensure interface supports VLAN tagging

**Build errors**
- Run `npm ci` for clean dependency installation
- Ensure Node.js 18+ is installed
- Check TypeScript version matches requirements

For more detailed troubleshooting, see our [Troubleshooting Guide](docs/troubleshooting/README.md).

## 🗺️ Roadmap
- [ ] Unified IaC orchestrator
- [ ] Web UI for deployment management
- [ ] Multi-firewall support

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the MCP (Model Context Protocol) ecosystem
- Inspired by Pulumi and SST infrastructure patterns
- Part of a larger vision for home infrastructure automation
