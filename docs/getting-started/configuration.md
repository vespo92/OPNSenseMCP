# Configuration Guide

Detailed configuration options for OPNSense MCP Server.

## Configuration Methods

The server supports three configuration methods:

1. **Environment Variables** (recommended)
2. **Claude Desktop Config** (for Claude integration)
3. **Manual Configuration** (via API)

## Environment Variables

### Required Variables

Create a `.env` file in the project root:

```env
# OPNsense Connection (Required)
OPNSENSE_HOST=https://192.168.1.1     # Your OPNsense URL
OPNSENSE_API_KEY=your_api_key         # API key from OPNsense
OPNSENSE_API_SECRET=your_api_secret   # API secret from OPNsense
```

### Optional Variables

```env
# SSL Configuration
OPNSENSE_VERIFY_SSL=false             # Set true for valid certificates

# Feature Flags
IAC_ENABLED=true                      # Enable Infrastructure as Code
ENABLE_CACHE=false                    # Enable caching layer
ENABLE_MACRO_RECORDING=false          # Enable macro recording

# Transport Configuration
MCP_TRANSPORT=stdio                   # stdio or sse
SSE_PORT=3000                         # Port for SSE mode

# Caching (if ENABLE_CACHE=true)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                       # Optional Redis password
REDIS_DB=0                            # Redis database number

# PostgreSQL Cache (if ENABLE_CACHE=true)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=opnsense_cache
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Logging
LOG_LEVEL=info                        # debug, info, warn, error
LOG_FORMAT=json                        # json or text
LOG_FILE=./logs/opnsense-mcp.log     # Optional log file path

# Performance
MAX_CONCURRENT_REQUESTS=10            # API request concurrency
REQUEST_TIMEOUT=30000                 # Request timeout in ms
RETRY_ATTEMPTS=3                      # API retry attempts
RETRY_DELAY=1000                     # Retry delay in ms

# Network Discovery
ARP_SCAN_INTERVAL=300000             # ARP table scan interval (ms)
DHCP_SCAN_INTERVAL=60000             # DHCP lease scan interval (ms)
ENABLE_AUTO_DISCOVERY=false          # Auto-discover network devices
```

### Interface Mapping

For dynamic interface discovery:

```env
# Interface Mapping
INTERFACE_igc0_NAME=WAN
INTERFACE_igc0_DESCRIPTION=Internet Connection
INTERFACE_igc1_NAME=LAN
INTERFACE_igc1_DESCRIPTION=Main Network
INTERFACE_igc2_NAME=DMZ
INTERFACE_igc2_DESCRIPTION=DMZ Network
INTERFACE_igc3_NAME=VLANS
INTERFACE_igc3_DESCRIPTION=VLAN Trunk
```

## Claude Desktop Configuration

### Basic Configuration

Add to your Claude Desktop config file:

**Location by platform:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

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

### Advanced Configuration

With all features enabled:

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "node",
      "args": ["dist/index.js", "--transport", "stdio"],
      "cwd": "/absolute/path/to/opnsense-mcp",
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "your_api_key",
        "OPNSENSE_API_SECRET": "your_api_secret",
        "OPNSENSE_VERIFY_SSL": "false",
        "IAC_ENABLED": "true",
        "ENABLE_CACHE": "true",
        "REDIS_HOST": "localhost",
        "POSTGRES_HOST": "localhost",
        "LOG_LEVEL": "debug",
        "ENABLE_AUTO_DISCOVERY": "true"
      }
    }
  }
}
```

### Multiple OPNsense Instances

Configure multiple firewalls:

```json
{
  "mcpServers": {
    "opnsense-main": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/opnsense-mcp",
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "main_api_key",
        "OPNSENSE_API_SECRET": "main_api_secret"
      }
    },
    "opnsense-backup": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/opnsense-mcp",
      "env": {
        "OPNSENSE_HOST": "https://192.168.2.1",
        "OPNSENSE_API_KEY": "backup_api_key",
        "OPNSENSE_API_SECRET": "backup_api_secret"
      }
    }
  }
}
```

## SSE Mode Configuration

For HTTP-based integration:

### Environment Setup

```env
MCP_TRANSPORT=sse
SSE_PORT=3000
SSE_HOST=0.0.0.0
SSE_CORS_ORIGIN=*
SSE_AUTH_TOKEN=optional_auth_token
```

### Starting SSE Server

```bash
npm run start:sse
# Or with custom port
npm run start:sse -- --port 8080
```

### Client Configuration

Connect to the SSE server:

```javascript
const client = new EventSource('http://localhost:3000/sse');

client.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Send messages
fetch('http://localhost:3000/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer optional_auth_token'
  },
  body: JSON.stringify({
    method: 'listVlans',
    params: {}
  })
});
```

## Cache Configuration

### Redis Setup

1. Install Redis:
```bash
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Windows
# Download from https://redis.io/download
```

2. Configure in `.env`:
```env
ENABLE_CACHE=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password  # If configured
REDIS_DB=0
CACHE_TTL=300000              # Cache TTL in ms (5 minutes)
```

### PostgreSQL Setup

1. Install PostgreSQL:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

2. Create database:
```sql
CREATE DATABASE opnsense_cache;
```

3. Configure in `.env`:
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=opnsense_cache
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

4. Initialize schema:
```bash
npm run db:migrate
```

## Security Configuration

### SSL/TLS Settings

For production environments with valid certificates:

```env
OPNSENSE_VERIFY_SSL=true
OPNSENSE_CA_CERT=/path/to/ca-cert.pem  # Optional CA certificate
OPNSENSE_CLIENT_CERT=/path/to/cert.pem # Optional client certificate
OPNSENSE_CLIENT_KEY=/path/to/key.pem   # Optional client key
```

### API Token Security

Best practices:

1. **Never commit `.env` files**
   ```gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use environment-specific configs**
   ```bash
   # Development
   cp .env.development .env

   # Production
   cp .env.production .env
   ```

3. **Rotate API keys regularly**
   - Create new API keys in OPNsense
   - Update `.env` file
   - Delete old keys from OPNsense

## Performance Tuning

### API Request Optimization

```env
# Concurrent request handling
MAX_CONCURRENT_REQUESTS=10    # Increase for faster operations
REQUEST_TIMEOUT=30000         # Increase for slow networks
RETRY_ATTEMPTS=3              # Reduce for faster failures
RETRY_DELAY=1000             # Adjust based on network

# Batch operations
BATCH_SIZE=50                # Items per batch operation
BATCH_DELAY=100              # Delay between batches (ms)
```

### Cache Optimization

```env
# Cache settings
CACHE_TTL=300000             # 5 minutes default
CACHE_MAX_SIZE=1000          # Maximum cached items
CACHE_STRATEGY=lru           # lru or fifo

# Preload common data
PRELOAD_VLANS=true
PRELOAD_INTERFACES=true
PRELOAD_RULES=false         # May be large
```

## Logging Configuration

### Log Levels

```env
LOG_LEVEL=debug  # debug, info, warn, error, fatal
```

- **debug**: All messages including API calls
- **info**: Normal operation messages
- **warn**: Warning messages
- **error**: Error messages only
- **fatal**: Fatal errors only

### Log Formats

```env
LOG_FORMAT=json              # json or text
LOG_FILE=/var/log/opnsense-mcp.log
LOG_MAX_SIZE=10485760       # 10MB
LOG_MAX_FILES=5             # Keep 5 rotated files
LOG_TIMESTAMP=true          # Include timestamps
```

### Example Log Output

JSON format:
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "Connected to OPNsense",
  "host": "192.168.1.1",
  "version": "23.7"
}
```

Text format:
```
2024-01-15 10:30:45 [INFO] Connected to OPNsense at 192.168.1.1 (v23.7)
```

## Troubleshooting Configuration

### Debug Mode

Enable verbose logging:

```env
LOG_LEVEL=debug
DEBUG=opnsense:*            # Debug namespaces
DEBUG_API_CALLS=true        # Log all API calls
DEBUG_CACHE=true            # Log cache operations
```

### Test Configuration

Verify your configuration:

```bash
# Test connection
node scripts/test/test-connection.js

# Test specific features
node scripts/test/test-dhcp.js
node scripts/test/test-vlan.js
node scripts/test/test-firewall.js
```

### Common Issues

**Environment variables not loading**
- Ensure `.env` file is in project root
- Check file permissions
- No spaces around `=` in `.env` file

**Claude Desktop not finding server**
- Use absolute paths in config
- Check JSON syntax is valid
- Restart Claude Desktop after changes

**SSL verification failures**
- Set `OPNSENSE_VERIFY_SSL=false` for self-signed certs
- Or provide CA certificate path

## Next Steps

- [Quick Start Guide](quickstart.md) - Start using the server
- [Feature Guides](../guides/) - Learn specific features
- [Troubleshooting](../troubleshooting/) - Solve common problems