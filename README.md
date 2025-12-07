# OPNsense MCP Server

[![npm version](https://badge.fury.io/js/opnsense-mcp-server.svg)](https://www.npmjs.com/package/opnsense-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server for comprehensive OPNsense firewall management. This server enables AI assistants like Claude to directly manage firewall configurations, diagnose network issues, and automate complex networking tasks.

## Features

### 🔥 Firewall Management
- Complete CRUD operations for firewall rules
- Proper handling of API-created "automation rules"
- Inter-VLAN routing configuration
- Batch rule creation and management
- Enhanced persistence with multiple fallback methods

### 🌐 NAT Configuration (SSH-based)
- Outbound NAT rule management
- NAT mode control (automatic/hybrid/manual/disabled)
- No-NAT exception rules for inter-VLAN traffic
- Automated DMZ NAT issue resolution
- Direct XML configuration manipulation

### 🔍 Network Diagnostics
- Comprehensive routing analysis
- ARP table inspection with vendor identification
- Interface configuration management
- Network connectivity troubleshooting
- Auto-fix capabilities for common issues

### 🖥️ SSH/CLI Execution
- Direct command execution on OPNsense
- Configuration file manipulation
- System-level operations not available via API
- Service management and restarts

### 📊 Additional Capabilities
- VLAN management
- DHCP lease viewing and management
- DNS blocklist configuration
- HAProxy load balancer support
- Configuration backup and restore
- Infrastructure as Code support

## Installation

### Prerequisites
- Node.js 18+ or Bun 1.0+
- OPNsense firewall (v24.7+ recommended)
- API credentials for OPNsense
- SSH access (optional, for advanced features)

### Quick Start with npm

1. Install the package:
```bash
npm install -g opnsense-mcp-server
```

2. Create a `.env` file with your credentials:
```bash
# Required
OPNSENSE_HOST=https://your-opnsense-host:port
OPNSENSE_API_KEY=your-api-key
OPNSENSE_API_SECRET=your-api-secret
OPNSENSE_VERIFY_SSL=false

# Optional - for SSH features
OPNSENSE_SSH_HOST=your-opnsense-host
OPNSENSE_SSH_USERNAME=root
OPNSENSE_SSH_PASSWORD=your-password
# Or use SSH key
# OPNSENSE_SSH_KEY_PATH=~/.ssh/id_rsa
```

3. Start the MCP server:
```bash
opnsense-mcp-server
```

### Quick Start with Bun (Faster)

[Bun](https://bun.sh) provides significantly faster startup times and better performance.

1. Install Bun (if not already installed):
```bash
curl -fsSL https://bun.sh/install | bash
```

2. Clone and install:
```bash
git clone https://github.com/vespo92/OPNSenseMCP.git
cd OPNSenseMCP
bun install
```

3. Create your `.env` file (same as npm version above)

4. Run with Bun:
```bash
# Development with hot reload
bun run dev:bun

# Production
bun run start:bun
```

### Using Bun with Claude Desktop

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "bun",
      "args": ["run", "/path/to/OPNSenseMCP/src/index.ts"],
      "env": {
        "OPNSENSE_HOST": "https://your-opnsense:port",
        "OPNSENSE_API_KEY": "your-key",
        "OPNSENSE_API_SECRET": "your-secret",
        "OPNSENSE_VERIFY_SSL": "false"
      }
    }
  }
}
```

## Usage with Claude Desktop (npm)

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://your-opnsense:port",
        "OPNSENSE_API_KEY": "your-key",
        "OPNSENSE_API_SECRET": "your-secret",
        "OPNSENSE_VERIFY_SSL": "false"
      }
    }
  }
}
```

## Common Use Cases

### Fix DMZ NAT Issues
```javascript
// Automatically fix DMZ to LAN routing
await mcp.call('nat_fix_dmz', {
  dmzNetwork: '10.0.6.0/24',
  lanNetwork: '10.0.0.0/24'
});
```

### Create Firewall Rules
```javascript
// Allow NFS from DMZ to NAS
await mcp.call('firewall_create_rule', {
  action: 'pass',
  interface: 'opt8',
  source: '10.0.6.0/24',
  destination: '10.0.0.14/32',
  protocol: 'tcp',
  destination_port: '2049',
  description: 'Allow NFS from DMZ'
});
```

### Diagnose Routing Issues
```javascript
// Run comprehensive routing diagnostics
await mcp.call('routing_diagnostics', {
  sourceNetwork: '10.0.6.0/24',
  destNetwork: '10.0.0.0/24'
});
```

### Execute CLI Commands
```javascript
// Run any OPNsense CLI command
await mcp.call('system_execute_command', {
  command: 'pfctl -s state | grep 10.0.6'
});
```

## MCP Tools Reference

The server provides 50+ MCP tools organized by category:

### Firewall Tools
- `firewall_list_rules` - List all firewall rules
- `firewall_create_rule` - Create a new rule
- `firewall_update_rule` - Update existing rule
- `firewall_delete_rule` - Delete a rule
- `firewall_apply_changes` - Apply pending changes

### NAT Tools
- `nat_list_outbound` - List outbound NAT rules
- `nat_set_mode` - Set NAT mode
- `nat_create_outbound_rule` - Create NAT rule
- `nat_fix_dmz` - Fix DMZ NAT issues
- `nat_analyze_config` - Analyze NAT configuration

### Network Tools
- `arp_list` - List ARP table entries
- `routing_diagnostics` - Diagnose routing issues
- `routing_fix_all` - Auto-fix routing problems
- `interface_list` - List network interfaces
- `vlan_create` - Create VLAN

### System Tools
- `system_execute_command` - Execute CLI command
- `backup_create` - Create configuration backup
- `service_restart` - Restart a service

For a complete list, see [docs/api/mcp-tools.md](docs/api/mcp-tools.md).

## Documentation

- [Quick Start Guide](docs/guides/quick-start.md)
- [Configuration Guide](docs/guides/configuration.md)
- [NAT Management](docs/features/nat.md)
- [SSH/CLI Execution](docs/features/ssh.md)
- [Firewall Rules](docs/features/firewall.md)
- [Troubleshooting](docs/guides/troubleshooting.md)

## Testing

The repository includes comprehensive testing utilities:

```bash
# Test NAT functionality
npx tsx scripts/test/test-nat-ssh.ts

# Test firewall rules
npx tsx scripts/test/test-rules.ts

# Test routing diagnostics
npx tsx scripts/test/test-routing.ts

# Run all tests
npm test
```

## Development

### Building from Source
```bash
git clone https://github.com/vespo92/OPNSenseMCP.git
cd OPNSenseMCP
npm install
npm run build
```

### Project Structure
```
OPNSenseMCP/
├── src/                 # Source code
│   ├── api/            # API client
│   ├── resources/      # Resource implementations
│   └── index.ts        # MCP server entry
├── docs/               # Documentation
├── scripts/            # Utility scripts
│   ├── test/          # Test scripts
│   ├── debug/         # Debug utilities
│   └── fixes/         # Fix scripts
└── dist/               # Build output
```

## Troubleshooting

### API Authentication Failed
- Verify API key and secret are correct
- Ensure API access is enabled in OPNsense
- Check firewall rules allow API access

### SSH Connection Failed
- Verify SSH credentials in `.env`
- Ensure SSH is enabled on OPNsense
- Check user has appropriate privileges

### NAT Features Not Working
- NAT management requires SSH access
- Add SSH credentials to environment variables
- Test with: `npx tsx scripts/test/test-nat-ssh.ts`

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/vespo92/OPNSenseMCP/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vespo92/OPNSenseMCP/discussions)
- **Documentation**: [Full Documentation](docs/)

## Acknowledgments

- Built for use with [Anthropic's Claude](https://claude.ai)
- Implements the [Model Context Protocol](https://modelcontextprotocol.io)
- Designed for [OPNsense](https://opnsense.org) firewall

---

**Version**: 0.8.2 | **Status**: Production Ready | **Last Updated**: August 2025
