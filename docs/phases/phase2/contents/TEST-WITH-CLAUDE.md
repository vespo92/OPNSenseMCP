# Testing OPNsense MCP with Claude Desktop

## Prerequisites
✅ Build completed successfully: `npm run build`
✅ OPNsense API credentials in `.env` file

## Step 1: Configure Claude Desktop

Add to your Claude Desktop config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

## Step 2: Restart Claude Desktop

Close and restart Claude Desktop to load the MCP server.

## Step 3: Test Commands in Claude

Try these commands to verify everything is working:

### 1. Test Connection
"Test the OPNsense connection"

### 2. List VLANs
"List all VLANs on my OPNsense firewall"

### 3. Get Interfaces
"Show me the available network interfaces"

### 4. Get Specific VLAN
"Show me details for VLAN 120"

### 5. Create a Test VLAN
"Create VLAN 777 on interface igc3 with description 'MCP Test VLAN'"

### 6. Update VLAN
"Update VLAN 777 description to 'MCP Test - Updated'"

### 7. Delete Test VLAN
"Delete VLAN 777"

## Expected Results

- Connection test should show OPNsense version 25.1.5_5
- VLAN list should show 17 existing VLANs
- Interfaces should show igc0, igc1, igc2, igc3
- VLAN operations should complete successfully

## Troubleshooting

If Claude says the server isn't available:
1. Check Claude Desktop config file syntax
2. Ensure path to index.js is correct
3. Restart Claude Desktop again

If operations fail:
1. Check your .env file has correct credentials
2. Verify OPNsense is accessible from your machine
3. Check Claude's response for specific error messages

## Phase 2 Complete! 🎉

Once you can successfully run these commands, Phase 2 is complete and your OPNsense MCP server is ready for production use!
