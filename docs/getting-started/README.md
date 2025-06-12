# Getting Started with OPNSense MCP

This guide will help you get the OPNSense MCP server up and running with Claude Desktop.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 18 or higher installed
- ✅ Access to an OPNsense firewall
- ✅ Admin credentials for OPNsense
- ✅ Claude Desktop installed (for AI integration)

## Step 1: Enable OPNsense API

1. Log into your OPNsense web interface
2. Navigate to **System → Settings → Administration**
3. Scroll to **API** section
4. Check **Enable API**
5. Click **Save**

## Step 2: Create API Credentials

1. Go to **System → Access → Users**
2. Click **Add** to create a new user (or edit existing)
3. Set username (e.g., `mcp_api`)
4. Under **API keys**, click **+** to generate
5. Save the key and secret (you'll need these!)

## Step 3: Install OPNSense MCP

```bash
# Clone the repository
git clone https://github.com/VinSpo/opnsense-mcp.git
cd opnsense-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Step 4: Configure Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your settings:
   ```env
   # Required settings
   OPNSENSE_HOST=https://192.168.1.1
   OPNSENSE_API_KEY=your_api_key_here
   OPNSENSE_API_SECRET=your_api_secret_here
   OPNSENSE_VERIFY_SSL=false  # Set to true if using valid SSL

   # Optional - Infrastructure as Code
   IAC_ENABLED=true
   ```

## Step 5: Test Connection

Run a quick test to ensure everything works:

```bash
# Test the connection
npm run test:api

# You should see:
# ✓ Connected to OPNsense
# ✓ API authentication successful
```

## Step 6: Configure Claude Desktop

1. Find your Claude Desktop config file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/claude/claude_desktop_config.json`

2. Add the OPNSense MCP server:
   ```json
   {
     "mcpServers": {
       "opnsense": {
         "command": "node",
         "args": ["dist/index.js"],
         "cwd": "C:\\Users\\YourName\\path\\to\\opnsense-mcp",
         "env": {
           "OPNSENSE_HOST": "https://192.168.1.1",
           "OPNSENSE_API_KEY": "your_key",
           "OPNSENSE_API_SECRET": "your_secret",
           "OPNSENSE_VERIFY_SSL": "false"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop

## Step 7: Verify Installation

In Claude Desktop, try these commands:

- "Show me the network interfaces"
- "List all VLANs"
- "What devices are on my network?"

## 🎉 Success!

You're now ready to manage your OPNsense firewall with AI assistance!

## Next Steps

- Read about [Infrastructure as Code](../IaC-ARCHITECTURE.md)
- Explore [usage examples](../../examples/)
- Learn about [DNS blocking](../dns/DNS-QUICKSTART.md)

## Common Setup Issues

### "Connection Refused"
- Ensure OPNsense API is enabled
- Check firewall isn't blocking API port (usually 443)
- Verify the host URL includes https://

### "Authentication Failed"
- API keys must be base64 encoded in OPNsense
- Ensure no spaces in credentials
- User needs appropriate permissions

### "Module Not Found"
- Run `npm run build` before starting
- Ensure Node.js 18+ is installed
- Check all dependencies with `npm list`

Need help? Check our [Troubleshooting Guide](../troubleshooting/README.md) or [open an issue](https://github.com/VinSpo/opnsense-mcp/issues).