# OPNSense MCP Server

[![Version](https://img.shields.io/npm/v/opnsense-mcp-server)](https://www.npmjs.com/package/opnsense-mcp-server)
[![Downloads](https://img.shields.io/npm/dt/opnsense-mcp-server)](https://www.npmjs.com/package/opnsense-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-orange)](https://modelcontextprotocol.io)

<a href="https://glama.ai/mcp/servers/@vespo92/OPNSenseMCP">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@vespo92/OPNSenseMCP/badge" alt="OPNSense Server MCP server" />
</a>

A Model Context Protocol (MCP) server for managing OPNsense firewalls through Claude Desktop or Claude Code.

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
- Claude Desktop or Claude Code

### Installation

#### Via npm (Recommended)
```bash
# Use directly with npx - no installation needed
npx opnsense-mcp-server

# Or install globally
npm install -g opnsense-mcp-server
```

#### Via GitHub (Latest Development)
```bash
# Use latest from GitHub
npx github:vespo92/OPNSenseMCP
```

#### For Development
```bash
git clone https://github.com/vespo92/OPNSenseMCP
cd OPNSenseMCP
npm install
npm run build
```

## 📋 Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "your-api-key",
        "OPNSENSE_API_SECRET": "your-api-secret",
        "OPNSENSE_VERIFY_SSL": "true"
      }
    }
  }
}
```

### Claude Code

Add to `.claude/config.json` in your project root:

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "your-api-key",
        "OPNSENSE_API_SECRET": "your-api-secret",
        "OPNSENSE_VERIFY_SSL": "true"
      }
    }
  }
}
```

### Using System Keychain (Recommended for Security)

Instead of hardcoding credentials:

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "{{keychain:opnsense-api-key}}",
        "OPNSENSE_API_SECRET": "{{keychain:opnsense-api-secret}}",
        "OPNSENSE_VERIFY_SSL": "true"
      }
    }
  }
}
```

Then store credentials in your system keychain:
- **MacOS**: Use Keychain Access app
- **Windows**: Use Credential Manager
- **Linux**: Use Secret Service (gnome-keyring or KWallet)

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPNSENSE_HOST` | OPNsense URL (include https://) | Yes | - |
| `OPNSENSE_API_KEY` | API key from OPNsense | Yes | - |
| `OPNSENSE_API_SECRET` | API secret from OPNsense | Yes | - |
| `OPNSENSE_VERIFY_SSL` | Verify SSL certificates | No | `true` |
| `LOG_LEVEL` | Logging level | No | `info` |
| `CACHE_ENABLED` | Enable response caching | No | `true` |
| `CACHE_TTL` | Cache time-to-live in seconds | No | `300` |

<details>
<summary>Advanced Configuration (Optional)</summary>

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "{{keychain:opnsense-api-key}}",
        "OPNSENSE_API_SECRET": "{{keychain:opnsense-api-secret}}",
        
        // Optional: Redis cache configuration
        // "REDIS_HOST": "localhost",
        // "REDIS_PORT": "6379",
        // "REDIS_PASSWORD": "{{keychain:redis-password}}",
        // "REDIS_DB": "0",
        
        // Optional: PostgreSQL for state persistence  
        // "POSTGRES_HOST": "localhost",
        // "POSTGRES_PORT": "5432",
        // "POSTGRES_DB": "opnsense_mcp",
        // "POSTGRES_USER": "mcp_user",
        // "POSTGRES_PASSWORD": "{{keychain:postgres-password}}",
        
        // Optional: State encryption
        // "STATE_ENCRYPTION_KEY": "{{keychain:state-encryption-key}}",
        
        // Optional: Performance tuning
        // "CACHE_COMPRESSION_ENABLED": "true",
        // "CACHE_COMPRESSION_THRESHOLD": "1024",
        // "MAX_CONCURRENT_REQUESTS": "10"
      }
    }
  }
}
```
</details>

## 🔑 OPNsense API Setup

1. **Enable API in OPNsense:**
   - Navigate to: System → Settings → Administration
   - Check: "Enable API"
   - Save

2. **Create API credentials:**
   - Navigate to: System → Access → Users
   - Edit user or create new
   - Under "API Keys", click "+" to generate key/secret
   - Save credentials securely

3. **Required privileges:**
   - System: API access
   - Firewall: Rules: Edit
   - Interfaces: VLANs: Edit
   - Services: All

Then restart Claude Desktop/Code and start chatting!

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
- [Issues](https://github.com/vespo92/OPNSenseMCP/issues)
- [Discussions](https://github.com/vespo92/OPNSenseMCP/discussions)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

Built with ❤️ for the MCP ecosystem
