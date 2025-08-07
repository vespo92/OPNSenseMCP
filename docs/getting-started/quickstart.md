# Quick Start Guide

Get up and running with OPNSense MCP in 5 minutes.

## Prerequisites

You should have already:
- [Installed the OPNSense MCP Server](installation.md)
- Configured your `.env` file with API credentials
- Built the project with `npm run build`

## 5-Minute Setup

### Step 1: Start the Server

```bash
npm start
```

You should see:
```
✅ Connected to OPNsense at https://192.168.1.1
Server ready for connections
```

### Step 2: Configure Claude Desktop

Add to your Claude Desktop configuration file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Linux:** `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/opnsense-mcp",
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "your_api_key",
        "OPNSENSE_API_SECRET": "your_api_secret",
        "OPNSENSE_VERIFY_SSL": "false"
      }
    }
  }
}
```

> [!IMPORTANT]
> Use absolute paths in the `cwd` field. Replace `/absolute/path/to/opnsense-mcp` with your actual path.

### Step 3: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Start Claude Desktop again
3. Look for the 🔌 icon indicating MCP is connected

### Step 4: Test It Out!

Try these commands in Claude:

```
"Show me all devices on my network"
```

```
"Create a guest network on VLAN 50"
```

```
"Block facebook.com and twitter.com"
```

```
"Find devices that connected in the last hour"
```

## Common First Tasks

### 1. Network Discovery

Ask Claude to help you understand your network:

- "List all VLANs configured on my firewall"
- "Show me the DHCP leases"
- "Find all Apple devices on the network"
- "What devices are currently online?"

### 2. Create a Guest Network

```
"Create a secure guest network on VLAN 20 that:
- Has internet access only
- Cannot reach the main LAN
- Uses DHCP range 192.168.20.100-200"
```

### 3. Block Unwanted Content

```
"Block these categories of websites:
- Social media
- Gambling
- Adult content"
```

### 4. Set Up Port Forwarding

```
"Set up port forwarding for:
- Minecraft server on 192.168.1.100 port 25565
- Web server on 192.168.1.101 ports 80 and 443"
```

## Understanding the Tools

The MCP server provides these main tools to Claude:

### Network Management
- **listVlans** - Show all VLANs
- **createVlan** - Create new VLAN
- **listInterfaces** - Show network interfaces

### Device Discovery
- **listArpTable** - Show ARP entries
- **listDhcpLeases** - Show DHCP leases
- **findDevicesByName** - Search for devices

### Firewall Rules
- **listFirewallRules** - Show current rules
- **createFirewallRule** - Add new rule
- **deleteFirewallRule** - Remove rule

### DNS Filtering
- **blockDomains** - Block specific domains
- **listBlockedDomains** - Show blocked domains
- **unblockDomains** - Remove blocks

## Example Conversations

### Example 1: Finding a Device

**You:** "Is Kyle's laptop online?"

**Claude:** Let me search for Kyle's devices on your network...

I found 2 devices that might be Kyle's:
- **Kyle-MacBook** (Apple device)
  - IP: 192.168.1.45
  - MAC: aa:bb:cc:dd:ee:ff
  - Last seen: 2 minutes ago
  - Status: Online ✅

### Example 2: Network Segmentation

**You:** "I want to isolate my IoT devices from my main network"

**Claude:** I'll help you create a separate network for your IoT devices. Let me:

1. Create a new VLAN for IoT devices
2. Set up firewall rules for isolation
3. Configure DHCP for the new network

Creating VLAN 30 for IoT devices...
✅ VLAN created on interface igc3

Setting up firewall rules...
✅ Rule 1: Allow IoT → Internet
✅ Rule 2: Block IoT → LAN
✅ Rule 3: Block IoT → Management

Your IoT network is now isolated on VLAN 30 (192.168.30.0/24).

## Tips for Best Results

### Be Specific
- ✅ "Create a VLAN on interface igc3 with tag 50"
- ❌ "Make a new network"

### Provide Context
- ✅ "Block social media during work hours 9am-5pm"
- ❌ "Block stuff"

### Ask for Confirmation
- "Show me what firewall rules you'll create before applying them"
- "What would happen if I delete this VLAN?"

## Advanced Features

Once comfortable, explore:

- [Infrastructure as Code](../iac/overview.md) - Deploy entire network configs
- [HAProxy Configuration](../guides/haproxy.md) - Load balancing
- [Backup & Restore](../guides/backup-restore.md) - Configuration management
- [Patterns](../../examples/patterns/) - Reusable network templates

## Troubleshooting Quick Start

### Claude doesn't see the MCP server
1. Check the 🔌 icon in Claude Desktop
2. Verify your config file syntax is valid JSON
3. Ensure the path to opnsense-mcp is absolute
4. Restart Claude Desktop

### Connection errors
1. Test with `npm start` in terminal first
2. Verify OPNsense is reachable
3. Check API credentials in .env
4. See [Troubleshooting Guide](../troubleshooting/)

## Next Steps

- Explore [Feature Guides](../guides/) for specific use cases
- Learn about [IaC capabilities](../iac/overview.md)
- Check out [Example Patterns](../../examples/patterns/)
- Read about [Production Deployment](../deployment/production.md)

---

**Need help?** Check the [full documentation](../) or [open an issue](https://github.com/vespo92/OPNSenseMCP/issues).