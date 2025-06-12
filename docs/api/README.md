# API Documentation

The OPNSense MCP Server provides a comprehensive API for managing OPNsense firewalls through the Model Context Protocol.

## 📖 Available Documentation

- [API Endpoints Reference](API-ENDPOINTS.md) - Complete list of all available MCP tools and resources

## 🔧 MCP Tools Overview

The server exposes the following tool categories:

### Network Management
- **VLAN Operations** - Create, list, update, and delete VLANs
- **Interface Management** - List and configure network interfaces

### Firewall Management
- **Rule Operations** - Create, modify, and delete firewall rules
- **Rule Presets** - Quick templates for common scenarios
- **Rule Search** - Find rules by description or criteria

### DNS Management
- **Blocklist Operations** - Manage DNS blocking entries
- **Category Blocking** - Apply predefined blocklist categories
- **Domain Search** - Search and manage blocked domains

### Device Discovery
- **DHCP Leases** - View active network devices
- **Device Search** - Find devices by name, MAC, or network

### System Management
- **Backup/Restore** - Configuration backup management
- **Connection Testing** - Verify API connectivity

## 📝 Tool Naming Convention

All tools follow a consistent naming pattern:
- `list_*` - Retrieve multiple items
- `get_*` - Retrieve a single item
- `create_*` - Create new resources
- `update_*` - Modify existing resources
- `delete_*` - Remove resources
- `find_*` - Search for resources

## 🔐 Authentication

All API calls require proper authentication configured via environment variables:
- `OPNSENSE_HOST` - Your OPNsense URL
- `OPNSENSE_API_KEY` - API key from OPNsense
- `OPNSENSE_API_SECRET` - API secret from OPNsense

## 💡 Usage Examples

### Creating a VLAN
```javascript
{
  "tool": "create_vlan",
  "arguments": {
    "interface": "igc3",
    "tag": "100",
    "description": "IoT Network"
  }
}
```

### Adding Firewall Rule
```javascript
{
  "tool": "create_firewall_rule",
  "arguments": {
    "action": "pass",
    "interface": "lan",
    "direction": "in",
    "protocol": "tcp",
    "source": "any",
    "destination": "any",
    "destinationPort": "443",
    "description": "Allow HTTPS"
  }
}
```

## 🔍 Error Handling

All tools implement consistent error handling:
- **Validation Errors** - Invalid input parameters
- **Authentication Errors** - API key issues
- **Network Errors** - Connection problems
- **Resource Errors** - Missing or conflicting resources

Errors are returned with descriptive messages to help troubleshooting.

## 📚 Further Reading

- [MCP Protocol Docs](https://modelcontextprotocol.io/docs)
- [OPNsense API Docs](https://docs.opnsense.org/development/api.html)