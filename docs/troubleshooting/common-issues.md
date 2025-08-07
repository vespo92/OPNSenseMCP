# Common Issues and Solutions

Solutions for frequently encountered problems with OPNSense MCP Server.

## Connection Issues

### Cannot Connect to OPNsense

**Symptoms:**
- Connection refused error
- Timeout errors
- "Cannot reach OPNsense" message

**Solutions:**

1. **Verify API is enabled:**
   - Log into OPNsense web interface
   - Navigate to System → Settings → Administration
   - Ensure "Enable API" is checked
   - Save changes

2. **Check network connectivity:**
   ```bash
   # Test connection
   ping 192.168.1.1
   
   # Test HTTPS port
   telnet 192.168.1.1 443
   ```

3. **Verify firewall rules:**
   - Ensure API access is allowed from your IP
   - Check anti-lockout rule is enabled
   - Verify no blocking rules for port 443

4. **SSL certificate issues:**
   ```env
   # In .env file, try disabling SSL verification
   OPNSENSE_VERIFY_SSL=false
   ```

### Authentication Failed

**Symptoms:**
- 401 Unauthorized errors
- "Invalid API credentials" message

**Solutions:**

1. **Verify API credentials:**
   - API key and secret must be exactly as provided
   - No extra spaces or quotes
   - Check for special characters

2. **Regenerate API key:**
   - System → Access → Users
   - Edit API user
   - Delete old key and create new one
   - Update .env file immediately

3. **Check user permissions:**
   - API user needs appropriate privileges
   - Add "GUI - All pages" for full access
   - Or specific permissions for limited access

## DHCP Issues

### No DHCP Leases Showing

**Symptoms:**
- Empty DHCP lease list
- "No leases found" message

**Solutions:**

1. **Verify DHCP service is running:**
   ```
   "Check if DHCP service is enabled on LAN"
   ```

2. **Check interface configuration:**
   - Services → DHCPv4 → [Interface]
   - Ensure "Enable" is checked
   - Verify IP range is configured

3. **API endpoint issues:**
   - Some OPNsense versions use different endpoints
   - Try manual API call to verify

### Static Mappings Not Working

**Solutions:**

1. **MAC address format:**
   - Use colons: `aa:bb:cc:dd:ee:ff`
   - All lowercase recommended

2. **IP within subnet:**
   - Static IP must be in interface subnet
   - Outside DHCP dynamic range preferred

## VLAN Issues

### Cannot Create VLAN

**Symptoms:**
- "Interface not found" error
- "VLAN tag already exists" error

**Solutions:**

1. **Verify physical interface:**
   ```
   "List available interfaces"
   ```
   - Use unassigned interfaces only
   - Common: igc2, igc3 for VLANs

2. **Check VLAN tag:**
   - Must be 1-4094
   - Cannot duplicate existing tags
   - Avoid reserved VLANs (0, 4095)

3. **Parent interface in use:**
   - Interface cannot have IP assigned
   - Must not be bridge member
   - Remove existing assignment first

### VLAN Not Passing Traffic

**Solutions:**

1. **Switch configuration:**
   - Port must be tagged for VLAN
   - Trunk port properly configured
   - VLAN exists on switch

2. **Firewall rules:**
   ```
   "Show firewall rules for VLAN interface"
   ```
   - Default deny if no rules
   - Add pass rules as needed

3. **Interface assignment:**
   - Interfaces → Assignments
   - VLAN must be assigned
   - Interface must be enabled

## Firewall Rule Issues

### Rules Not Taking Effect

**Symptoms:**
- Traffic still blocked/allowed incorrectly
- Rules appear but don't work

**Solutions:**

1. **Apply changes:**
   ```
   "Apply firewall changes"
   ```
   - Changes need explicit apply
   - May need service restart

2. **Rule order:**
   - Rules process top to bottom
   - First match wins
   - More specific rules first

3. **Interface selection:**
   - Rules apply to traffic entering interface
   - WAN rules for inbound internet
   - LAN rules for outbound LAN

### NAT/Port Forwarding Not Working

**Solutions:**

1. **Associated firewall rule:**
   - NAT needs firewall pass rule
   - Auto-create rule option
   - Or manual rule creation

2. **Destination IP:**
   - Use LAN IP, not WAN
   - Verify target service running
   - Check service listening on port

## DNS Blocking Issues

### Domains Not Being Blocked

**Symptoms:**
- Can still access blocked sites
- Blocks not appearing in DNS

**Solutions:**

1. **DNS resolver settings:**
   - Services → Unbound DNS → General
   - Ensure enabled
   - DNS Query Forwarding OFF

2. **Client configuration:**
   - Clients must use OPNsense for DNS
   - Not using 8.8.8.8 or other
   - Check DHCP DNS settings

3. **Apply configuration:**
   ```
   "Apply DNS configuration changes"
   ```

4. **Cache clearing:**
   ```bash
   # Windows
   ipconfig /flushdns
   
   # macOS
   sudo dscacheutil -flushcache
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

## HAProxy Issues

### Backend Servers Showing Down

**Solutions:**

1. **Health check configuration:**
   - Verify check method (HTTP/TCP)
   - Check interval not too aggressive
   - Correct health check URL

2. **Network connectivity:**
   - Can OPNsense reach backend?
   - Firewall rules allowing traffic
   - Backend actually running

3. **SSL to backend:**
   - If backend uses SSL, enable in config
   - Set verify to "none" for self-signed

### Frontend Not Accessible

**Solutions:**

1. **Bind address:**
   - Use 0.0.0.0 for all interfaces
   - Or specific interface IP
   - Check port not in use

2. **Firewall rules:**
   - Allow traffic to frontend port
   - Both WAN and local if needed

3. **Certificate issues:**
   - Valid certificate selected
   - Certificate not expired
   - Includes correct domains

## Performance Issues

### Slow Response Times

**Solutions:**

1. **Enable caching:**
   ```env
   ENABLE_CACHE=true
   REDIS_HOST=localhost
   ```

2. **Reduce API calls:**
   - Use batch operations
   - Cache frequently used data
   - Increase cache TTL

3. **OPNsense load:**
   - Check CPU/memory usage
   - Review firewall rule count
   - Consider hardware upgrade

## Build and Installation Issues

### TypeScript Build Errors

**Solutions:**

1. **Clean install:**
   ```bash
   rm -rf node_modules
   rm package-lock.json
   npm install
   npm run build
   ```

2. **Node version:**
   ```bash
   node --version  # Should be 18+
   ```

3. **TypeScript version:**
   ```bash
   npx tsc --version  # Should match package.json
   ```

### Module Not Found

**Solutions:**

1. **Rebuild project:**
   ```bash
   npm run build
   ```

2. **Check imports:**
   - File extensions for ESM
   - Correct relative paths

## Claude Desktop Issues

### MCP Server Not Showing

**Solutions:**

1. **Configuration syntax:**
   - Valid JSON format
   - No trailing commas
   - Quotes around strings

2. **Absolute paths:**
   - Use full path to project
   - No relative paths
   - Correct path separators

3. **Restart Claude:**
   - Fully quit application
   - Start fresh
   - Check for 🔌 icon

### Commands Not Working

**Solutions:**

1. **Check server running:**
   - Look for 🔌 icon
   - Try simple command first
   - Check Claude Desktop logs

2. **Environment variables:**
   - All required vars set
   - No typos in names
   - Values properly quoted

## Getting More Help

If these solutions don't resolve your issue:

1. **Enable debug logging:**
   ```env
   LOG_LEVEL=debug
   ```

2. **Check logs:**
   - Server console output
   - OPNsense system logs
   - Claude Desktop logs

3. **Get help:**
   - [GitHub Issues](https://github.com/vespo92/OPNSenseMCP/issues)
   - [Discussions](https://github.com/vespo92/OPNSenseMCP/discussions)
   - Include error messages and logs

## Related Documentation

- [Connection Guide](connection.md)
- [Authentication Guide](authentication.md)
- [FAQ](faq.md)