# SSE Transport Deployment Guide

## Overview

The OPNSense MCP server now supports dual transport modes:
- **STDIO** (default): For direct integration with Claude Desktop
- **SSE** (Server-Sent Events): For HTTP-based integration with agents and containers

## Quick Start

### STDIO Mode (Default)
```bash
npm run build
npm start
```

### SSE Mode
```bash
npm run build
npm run start:sse
```

## Command Line Options

```bash
node dist/index.js [options]

Options:
  --transport [stdio|sse]  Transport type (default: stdio)
  --port [number]         Port for SSE server (default: 3000)
  --host [string]         Host for SSE server (default: 0.0.0.0)
```

## Environment Variables

- `MCP_TRANSPORT`: Set transport type (stdio or sse)
- `MCP_SSE_PORT`: SSE server port (default: 3000)
- `MCP_SSE_HOST`: SSE server host (default: 0.0.0.0)
- `MCP_CORS_ORIGIN`: CORS origin for SSE (default: *)

## Docker Deployment

### Build and Run with Docker
```bash
docker build -t opnsense-mcp-sse .
docker run -p 3000:3000 \
  -e OPNSENSE_HOST=https://your-firewall.example.com \
  -e OPNSENSE_API_KEY=your-api-key \
  -e OPNSENSE_API_SECRET=your-api-secret \
  opnsense-mcp-sse
```

### Using Docker Compose

#### Standalone SSE Server
```bash
docker-compose -f docker-compose.sse.yml up
```

#### With Infrastructure Services
```bash
# Start infrastructure (Redis, PostgreSQL)
docker-compose up -d

# Start SSE server
docker-compose -f docker-compose.sse.yml up
```

## SSE Endpoints

When running in SSE mode, the server exposes:

- `GET /sse` - SSE connection endpoint
- `POST /messages` - Message handling endpoint
- `GET /health` - Health check endpoint

## Agent Integration

Agents can connect to the SSE server using:

```javascript
// Example agent connection
const eventSource = new EventSource('http://localhost:3000/sse');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle server messages
};

// Send messages via POST
fetch('http://localhost:3000/messages?sessionId=YOUR_SESSION_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // MCP protocol message
  })
});
```

## Architecture Benefits

1. **No Breaking Changes**: Existing STDIO users unaffected
2. **Container-Friendly**: SSE mode works great in containers
3. **Agent-Ready**: HTTP-based transport for agent integration
4. **Runtime Selection**: Choose transport at startup
5. **Clean Separation**: Transport logic isolated from business logic

## Troubleshooting

### SSE Connection Issues
- Check firewall rules for port 3000
- Verify CORS settings if connecting from browser
- Ensure health check passes: `curl http://localhost:3000/health`

### Session Management
- Each SSE connection gets a unique session ID
- Session ID must be included in POST requests
- Sessions are cleaned up on disconnect

## Security Considerations

- Always use HTTPS in production
- Configure appropriate CORS origins
- Use environment variables for sensitive data
- Run container as non-root user (already configured)