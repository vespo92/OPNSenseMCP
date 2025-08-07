# OPNSense MCP Server - Developer Guide

## Architecture

The OPNSense MCP Server is built using:
- TypeScript for type safety
- MCP SDK for the Model Context Protocol implementation
- Axios for HTTP requests to the OPNSense API
- Environment variables for configuration

## OPNSense API Overview

OPNSense provides a comprehensive REST API for managing the firewall. Key endpoints include:

### Core System
- `/api/core/system/status` - System status and information
- `/api/core/service/search` - List all services
- `/api/core/service/restart/{service}` - Restart a service
- `/api/core/system/log` - System logs

### Firewall
- `/api/firewall/filter/searchRule` - List firewall rules
- `/api/firewall/filter/addRule` - Add a firewall rule
- `/api/firewall/filter/delRule/{uuid}` - Delete a rule
- `/api/firewall/filter/apply` - Apply firewall changes
- `/api/firewall/alias/searchItem` - List aliases
- `/api/firewall/nat/searchRule` - NAT rules

### Network
- `/api/diagnostics/interface/getInterfaceStatistics` - Interface stats
- `/api/dhcpv4/leases/searchLease` - DHCP leases
- `/api/ipsec/service/status` - VPN status

### Diagnostics
- `/api/diagnostics/log/core/firewall` - Firewall logs

## Adding New Tools

To add a new tool to the server:

1. **Add the tool definition** in the `ListToolsRequestSchema` handler:

```typescript
{
  name: 'yourToolName',
  description: 'Description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' },
      param2: { type: 'number', description: 'Another parameter' }
    },
    required: ['param1']
  }
}
```

2. **Add the implementation** in the `CallToolRequestSchema` handler:

```typescript
case 'yourToolName':
  if (!this.client) throw new Error('OPNSense not configured. Use configure tool first.');
  
  // Make API call
  const result = await this.client.get('/api/your/endpoint');
  
  // Or with parameters
  const result = await this.client.post('/api/your/endpoint', {
    field: args.param1,
    another: args.param2
  });
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
```

## Common OPNSense API Patterns

### Authentication
OPNSense uses basic authentication with API keys:
- Username: API Key
- Password: API Secret

### Response Format
Most endpoints return JSON with this structure:
```json
{
  "rows": [...],     // For list endpoints
  "rowCount": 10,    // Total count
  "result": "saved", // For action endpoints
  "uuid": "..."      // For create operations
}
```

### Making Changes
Many configuration changes require two steps:
1. Make the change (add/update/delete)
2. Apply the configuration

Example:
```typescript
// 1. Add the rule
await client.post('/firewall/filter/addRule', ruleData);

// 2. Apply changes
await client.post('/firewall/filter/apply');
```

## Error Handling

The server includes comprehensive error handling:
- Connection errors
- Authentication failures
- API errors with status codes
- Detailed error messages

## Security Considerations

1. **API Credentials**: Store in environment variables
2. **SSL Verification**: Always verify SSL in production
3. **Permissions**: Use minimal required permissions for API user
4. **Logging**: Avoid logging sensitive data

## Testing

Test the server with the provided test script:
```bash
node examples/test-server.js
```

Or manually with the MCP client:
```bash
npm run build
npm start
```

## Extending for Other Firewalls

The architecture can be adapted for other firewalls:
1. Replace the `OPNSenseClient` class
2. Update the API endpoints
3. Modify the tool schemas as needed

## Resources

- [OPNSense API Documentation](https://docs.opnsense.org/development/api.html)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [OPNSense Forum](https://forum.opnsense.org/)
