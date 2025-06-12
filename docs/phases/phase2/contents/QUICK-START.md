# Quick Start Guide

## After Fixing TypeScript Errors

### 1. Run Complete Test
```bash
complete-test.bat
```

This will:
- Build the TypeScript project
- Test the implementation
- Verify the server starts correctly

### 2. If All Tests Pass

The server is ready! Configure Claude Desktop by adding to your config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "node",
      "args": ["C:\\Users\\VinSpo\\Desktop\\OPNSenseMCP\\dist\\index.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the config, restart Claude Desktop to load the MCP server.

### 4. Test It!

In Claude, try:
- "List all VLANs on my OPNsense"
- "Show me the network interfaces"
- "Create a VLAN 150 on igc3 for testing"

## Troubleshooting

If the build still fails:
- Check that all dependencies are installed: `npm install`
- Make sure you're using Node.js 16 or later: `node --version`
- Review the TypeScript errors and ensure all files were saved

If the server won't start:
- Check your .env file has the correct API credentials
- Verify your OPNsense API is accessible
- Run `troubleshoot.bat` for detailed diagnostics
