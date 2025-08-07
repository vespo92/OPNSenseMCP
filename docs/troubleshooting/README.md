# Troubleshooting Guide

Find solutions to common problems with OPNSense MCP Server.

## Quick Navigation

- [Common Issues](common-issues.md) - Most frequent problems and solutions
- Connection Problems - Network and API connection issues
- Authentication - Credential and permission problems  
- FAQ - Frequently asked questions

## Problem Categories

### 🔌 Connection & Setup
- Cannot connect to OPNsense
- API not responding
- SSL certificate errors
- Network unreachable

**→ See [Common Issues](common-issues.md#connection-issues)**

### 🔐 Authentication
- Invalid credentials
- Permission denied
- API key not working
- User privilege issues

**→ See [Common Issues](common-issues.md#authentication-failed)**

### 🌐 Network Features
- VLANs not working
- Firewall rules not applying
- DHCP issues
- DNS blocking problems

**→ See [Common Issues](common-issues.md)**

### 🛠️ Build & Installation
- TypeScript errors
- Module not found
- Build failures
- Version conflicts

**→ See [Common Issues](common-issues.md#build-and-installation-issues)**

### 💬 Claude Desktop
- Server not appearing
- Commands not working
- Connection lost
- Configuration problems

**→ See [Common Issues](common-issues.md#claude-desktop-issues)**

## Quick Fixes

### Enable Debug Mode
```env
# In .env file
LOG_LEVEL=debug
DEBUG=opnsense:*
```

### Test Connection
```bash
# Quick connection test
npm start

# Should see:
# ✅ Connected to OPNsense at https://192.168.1.1
```

### Reset Configuration
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Clear Cache
```bash
# If using Redis cache
redis-cli FLUSHALL

# If using file cache
rm -rf .cache/
```

## Diagnostic Commands

### Check OPNsense API
```bash
# Test API directly
curl -k -u "api_key:api_secret" \
  https://192.168.1.1/api/core/system/status
```

### Verify Network
```bash
# Ping OPNsense
ping 192.168.1.1

# Check port
telnet 192.168.1.1 443
```

### Test MCP Server
```bash
# Run in debug mode
LOG_LEVEL=debug npm start
```

## Getting Help

### Before Opening an Issue

1. **Check existing documentation:**
   - Read relevant troubleshooting guides
   - Search closed issues
   - Review examples

2. **Gather information:**
   - Error messages (full text)
   - Log output (debug mode)
   - Configuration (without secrets)
   - OPNsense version
   - Node.js version

3. **Try basic fixes:**
   - Restart services
   - Clear cache
   - Rebuild project
   - Verify connectivity

### Where to Get Help

- **GitHub Issues:** [Report bugs](https://github.com/vespo92/OPNSenseMCP/issues)
- **Discussions:** [Ask questions](https://github.com/vespo92/OPNSenseMCP/discussions)
- **Documentation:** [Latest docs](https://github.com/vespo92/OPNSenseMCP/tree/main/docs)

### Reporting Issues

Include:
- Clear problem description
- Steps to reproduce
- Expected vs actual behavior
- Error messages
- Environment details

## Emergency Recovery

### Can't Access OPNsense GUI

1. **Use console access:**
   - Physical or serial console
   - Reset from console menu

2. **Restore from backup:**
   ```
   "Restore configuration from latest backup"
   ```

3. **Factory reset:**
   - Last resort option
   - Will lose all configuration

### Locked Out of API

1. **Disable API temporarily:**
   - Console access required
   - Re-enable after fixing

2. **Create new API user:**
   - Use admin account
   - Generate new credentials

3. **Check anti-lockout rule:**
   - Must allow management access
   - From at least one source

## Related Documentation

- [Getting Started](../getting-started/)
- [Feature Guides](../guides/)
- [API Reference](../api-reference/)