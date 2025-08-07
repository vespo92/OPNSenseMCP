# Configuration Guide - OPNSense MCP Server

## Overview

The OPNSense MCP Server is configured entirely through environment variables passed by Claude Desktop or Claude Code. There are **no .env files** needed - all configuration is managed by the MCP client.

## Configuration Locations

### Claude Desktop
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

### Claude Code
- **Project-specific**: `.claude/config.json` in your project root
- **Global**: Same as Claude Desktop locations

## Basic Configuration

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "your-api-key",
        "OPNSENSE_API_SECRET": "your-api-secret"
      }
    }
  }
}
```

## Secure Configuration (Recommended)

Using system keychain to store credentials:

```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "{{keychain:opnsense-api-key}}",
        "OPNSENSE_API_SECRET": "{{keychain:opnsense-api-secret}}"
      }
    }
  }
}
```

### Setting Keychain Values

#### MacOS
```bash
# Using security command
security add-generic-password -s "opnsense-api-key" -a "claude" -w "your-actual-api-key"
security add-generic-password -s "opnsense-api-secret" -a "claude" -w "your-actual-api-secret"
```

#### Windows
```powershell
# Using cmdkey
cmdkey /generic:opnsense-api-key /user:claude /pass:your-actual-api-key
cmdkey /generic:opnsense-api-secret /user:claude /pass:your-actual-api-secret
```

#### Linux
```bash
# Using secret-tool (GNOME Keyring)
secret-tool store --label="OPNsense API Key" service opnsense-api-key username claude
# (Enter password when prompted)

secret-tool store --label="OPNsense API Secret" service opnsense-api-secret username claude
# (Enter password when prompted)
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPNSENSE_HOST` | Full URL to OPNsense | `https://192.168.1.1` |
| `OPNSENSE_API_KEY` | API key from OPNsense | `w86L0k2X5n9P...` |
| `OPNSENSE_API_SECRET` | API secret from OPNsense | `7j3M9p1Q4r8S...` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `OPNSENSE_VERIFY_SSL` | Verify SSL certificates | `true` | `false` for dev |
| `LOG_LEVEL` | Logging verbosity | `info` | `debug`, `warn`, `error` |
| `CACHE_ENABLED` | Enable response caching | `true` | `false` to disable |
| `CACHE_TTL` | Cache time-to-live (seconds) | `300` | `600` for 10 min |
| `OPNSENSE_INTERFACE_MAPPINGS` | Friendly interface names | - | `{"dmz":"opt8"}` |

### Advanced Variables (External Services)

These are only needed if using external cache/database:

```json
{
  "env": {
    // Redis Cache (Optional)
    "REDIS_HOST": "localhost",
    "REDIS_PORT": "6379",
    "REDIS_PASSWORD": "{{keychain:redis-password}}",
    "REDIS_DB": "0",
    "REDIS_KEY_PREFIX": "opnsense:",
    
    // PostgreSQL State Store (Optional)
    "POSTGRES_HOST": "localhost",
    "POSTGRES_PORT": "5432",
    "POSTGRES_DB": "opnsense_mcp",
    "POSTGRES_USER": "mcp_user",
    "POSTGRES_PASSWORD": "{{keychain:postgres-password}}",
    
    // State Encryption (Optional but recommended)
    "STATE_ENCRYPTION_KEY": "{{keychain:state-encryption-key}}",
    
    // Performance Tuning (Optional)
    "CACHE_COMPRESSION_ENABLED": "true",
    "CACHE_COMPRESSION_THRESHOLD": "1024",
    "CACHE_COMPRESSION_LEVEL": "6",
    "MAX_CONCURRENT_REQUESTS": "10"
  }
}
```

## Development Configuration

For local development, you can still use a `.env` file, but it's not recommended for production:

```bash
# For development only
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

## Migration from .env Files

If you're upgrading from a version that used `.env` files:

1. Copy your credentials from `.env`
2. Add them to Claude Desktop/Code configuration
3. Delete the `.env` file
4. Restart Claude

## Troubleshooting

### Configuration Not Loading
1. Check file location is correct for your OS
2. Ensure JSON syntax is valid (no trailing commas)
3. Restart Claude Desktop/Code after changes

### Keychain Issues
1. Verify keychain entry names match exactly
2. Check keychain access permissions
3. Try hardcoding values first to isolate issue

### SSL Certificate Errors
For development only:
```json
"OPNSENSE_VERIFY_SSL": "false"
```

For production, import the OPNsense CA certificate to your system.

## Security Best Practices

1. **Always use keychain** for production credentials
2. **Never commit** configuration files with credentials
3. **Use separate API keys** for development and production
4. **Enable SSL verification** in production
5. **Rotate credentials** regularly
6. **Use read-only API keys** when possible

## Example Configurations

### Minimal (Development)
```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://192.168.1.1",
        "OPNSENSE_API_KEY": "dev-key",
        "OPNSENSE_API_SECRET": "dev-secret",
        "OPNSENSE_VERIFY_SSL": "false",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Production with Redis Cache
```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "https://firewall.company.com",
        "OPNSENSE_API_KEY": "{{keychain:opnsense-prod-key}}",
        "OPNSENSE_API_SECRET": "{{keychain:opnsense-prod-secret}}",
        "OPNSENSE_VERIFY_SSL": "true",
        "LOG_LEVEL": "warn",
        "REDIS_HOST": "redis.company.com",
        "REDIS_PASSWORD": "{{keychain:redis-password}}",
        "STATE_ENCRYPTION_KEY": "{{keychain:state-key}}",
        "CACHE_COMPRESSION_ENABLED": "true"
      }
    }
  }
}
```

### High Security Environment
```json
{
  "mcpServers": {
    "opnsense": {
      "command": "npx",
      "args": ["opnsense-mcp-server"],
      "env": {
        "OPNSENSE_HOST": "{{keychain:opnsense-host}}",
        "OPNSENSE_API_KEY": "{{keychain:opnsense-api-key}}",
        "OPNSENSE_API_SECRET": "{{keychain:opnsense-api-secret}}",
        "OPNSENSE_VERIFY_SSL": "true",
        "STATE_ENCRYPTION_KEY": "{{keychain:state-encryption-key}}",
        "LOG_LEVEL": "error",
        "CACHE_ENABLED": "false"
      }
    }
  }
}
```

---

*Remember: The server receives all configuration from Claude Desktop/Code. No configuration files are needed in the project itself.*