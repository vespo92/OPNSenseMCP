# Troubleshooting Guide

This guide covers common issues and their solutions when using the OPNSense MCP Server.

## 🔌 Connection Issues

### API Connection Failed
**Symptoms:** 
- "Connection refused" errors
- "ECONNREFUSED" in logs

**Solutions:**
1. Verify OPNsense API is enabled:
   - Navigate to System → Settings → Administration → API
   - Ensure "Enable API" is checked
   
2. Check firewall rules:
   ```bash
   # Test connectivity
   curl -k https://your-opnsense-ip/api/core/system/status
   ```

3. Verify SSL settings in `.env`:
   ```env
   OPNSENSE_VERIFY_SSL=false  # For self-signed certificates
   ```

### Authentication Errors
**Symptoms:**
- "401 Unauthorized" responses
- "Invalid API credentials"

**Solutions:**
1. Regenerate API credentials in OPNsense
2. Ensure credentials are properly formatted in `.env`
3. Check user permissions in OPNsense

## 🏗️ Build Issues

### TypeScript Compilation Errors
**Symptoms:**
- `tsc` command fails
- Type errors in console

**Solutions:**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript version
npm list typescript

# Force rebuild
npm run build -- --force
```

### Module Resolution Issues
**Symptoms:**
- "Cannot find module" errors
- Import path problems

**Solutions:**
1. Ensure using Node.js 18+
2. Check `"type": "module"` in package.json
3. Use `.js` extensions in imports

## 🌐 Network Configuration

### VLAN Creation Failures
**Symptoms:**
- "Interface already in use"
- "Invalid VLAN tag"

**Solutions:**
1. List existing VLANs to check for conflicts
2. Verify interface is not assigned elsewhere
3. Use VLAN tags between 1-4094

### Firewall Rules Not Applied
**Symptoms:**
- Rules created but traffic not affected
- Rules appear disabled

**Solutions:**
1. Check rule order (OPNsense processes top-down)
2. Verify interfaces are correctly specified
3. Apply configuration changes in OPNsense
4. Check for conflicting rules

## 📊 Cache and Database

### Redis Connection Issues
**Symptoms:**
- "Redis connection failed"
- Slow performance

**Solutions:**
```bash
# Test Redis connection
redis-cli ping

# Check Redis is running
systemctl status redis

# Disable cache if not needed
ENABLE_CACHE=false
```

### PostgreSQL Issues
**Symptoms:**
- "Database connection failed"
- Migration errors

**Solutions:**
```bash
# Run migrations
npm run db:migrate

# Check database exists
psql -U postgres -c "SELECT datname FROM pg_database;"

# Reset database
npm run db:push
```

## 🔍 DHCP Lease Issues

### Devices Not Found
**Symptoms:**
- "No devices found" when querying
- Empty DHCP lease list

**Solutions:**
1. Verify DHCP service is running in OPNsense
2. Check interface has DHCP enabled
3. Wait for lease renewal (devices may need to reconnect)
4. Use MAC address search instead of hostname

## 🐛 Debug Mode

Enable debug logging for more information:

```env
# In .env file
MCP_DEBUG=true
MCP_LOG_LEVEL=debug
```

Check logs for detailed error messages:
```bash
# Run in development mode for live logs
npm run dev
```

## 🆘 Getting Help

If you're still experiencing issues:

1. **Check existing issues:** [GitHub Issues](https://github.com/VinSpo/opnsense-mcp/issues)
2. **Enable debug mode** and collect logs
3. **Create a new issue** with:
   - Error messages
   - Your configuration (without secrets)
   - Steps to reproduce
   - OPNsense version

## 📖 Additional Resources

- [OPNsense API Documentation](https://docs.opnsense.org/development/api.html)
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- [Project Discord/Discussions](https://github.com/VinSpo/opnsense-mcp/discussions)