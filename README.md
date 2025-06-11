# OPNSense MCP Server

A Model Context Protocol (MCP) server for managing OPNSense firewalls through natural language interactions with Claude Desktop.

<a href="https://glama.ai/mcp/servers/@vespo92/OPNSenseMCP">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@vespo92/OPNSenseMCP/badge" alt="OPNSense Server MCP server" />
</a>

## Features

### Phase 1 & 2 (Complete)
- **VLAN Management**: Create, update, delete, and list VLANs
- **Firewall Rules**: Manage firewall rules with presets and custom configurations
- **Network Interfaces**: Query available network interfaces

### Phase 3 (Infrastructure Ready)
- **Configuration Backup System**: Automatic backups before changes
- **Cache Layer**: Redis-based caching for improved performance
- **Audit Database**: PostgreSQL-based audit trail
- **DHCP Lease Management**: View and search connected devices

## Prerequisites

- Node.js 18+ and npm
- OPNSense firewall with API access enabled
- Claude Desktop with MCP support
- (Optional) Docker for Redis/PostgreSQL deployment

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/opnsense-mcp.git
cd opnsense-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment template:
```bash
cp .env.example .env
```

4. Configure your OPNSense API credentials in `.env`:
```env
OPNSENSE_HOST=https://your-opnsense-ip:port
OPNSENSE_API_KEY=your-api-key
OPNSENSE_API_SECRET=your-api-secret
OPNSENSE_VERIFY_SSL=true

# Start with optional features disabled
ENABLE_CACHE=false
BACKUP_ENABLED=false
```

5. Build the project:
```bash
npm run build
```

## Claude Desktop Configuration

Add this to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "node",
      "args": ["C:\\path\\to\\opnsense-mcp\\dist\\index.js"],
      "cwd": "C:\\path\\to\\opnsense-mcp"
    }
  }
}
```

## Usage Examples

Once configured in Claude Desktop, you can use natural language commands:

- "List all VLANs"
- "Create VLAN 30 for gaming on interface igc3"
- "Show all firewall rules"
- "Create a rule to allow Minecraft on the gaming VLAN"
- "Find all rules that allow SSH"
- "Disable the rule blocking port 80"

## Optional Features

### Redis Cache & PostgreSQL Audit (Phase 3)

For enhanced performance and audit trails, deploy Redis and PostgreSQL:

```bash
# On your infrastructure server
docker run -d --name mcp-redis -p 6379:6379 redis:7-alpine
docker run -d --name mcp-postgres -p 5432:5432 \
  -e POSTGRES_DB=opnsense_mcp \
  -e POSTGRES_USER=mcp_user \
  -e POSTGRES_PASSWORD=secure_password \
  postgres:15-alpine
```

Then update your `.env`:
```env
ENABLE_CACHE=true
REDIS_HOST=your-redis-host
POSTGRES_HOST=your-postgres-host
```

## Architecture

```
Claude Desktop <--> MCP Server (Local) <--> OPNSense API
                           |
                           └--> (Optional) Redis/PostgreSQL
```

## Security Notes

- Never commit `.env` files with real credentials
- Use HTTPS for OPNSense API connections
- Store API keys securely
- Consider network segmentation for management interfaces

## Development

```bash
# Run TypeScript directly (development)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Roadmap

- [x] Phase 1: Basic VLAN management
- [x] Phase 2: Firewall rule management
- [x] Phase 3: Infrastructure (backup, cache, audit)
- [ ] Phase 4: DHCP static mappings
- [ ] Phase 5: Multi-MCP orchestration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built for the [Model Context Protocol](https://github.com/anthropics/mcp)
- Designed to work with Claude Desktop
- Part of a larger Infrastructure as Code vision