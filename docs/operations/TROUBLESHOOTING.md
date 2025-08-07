# Troubleshooting Guide - OPNSense MCP Server

## 🔍 Quick Diagnosis

### System Health Check
```bash
# 1. Check if service is running
ps aux | grep "opnsense-mcp"
systemctl status opnsense-mcp  # If using systemd
pm2 status opnsense-mcp        # If using PM2

# 2. Check port availability
netstat -tlnp | grep 3000
lsof -i :3000

# 3. Test API connectivity
curl -k https://your-opnsense-host/api/core/system/status \
  -u "api_key:api_secret"

# 4. Check logs
tail -f logs/error.log
tail -f logs/combined.log
journalctl -u opnsense-mcp -f  # Systemd logs
```

## 🚨 Common Issues & Solutions

### 1. Connection Issues

#### Problem: "Connection refused" error
```
Error: connect ECONNREFUSED 192.168.1.1:443
```

**Causes & Solutions:**

1. **OPNsense API not enabled**
   ```bash
   # SSH into OPNsense
   # Navigate to: System > Settings > Administration
   # Enable: "Enable Secure Shell"
   # Enable: "Enable API"
   ```

2. **Firewall blocking connection**
   ```bash
   # Test connectivity
   ping 192.168.1.1
   telnet 192.168.1.1 443
   
   # If blocked, add firewall rule in OPNsense:
   # Firewall > Rules > Add
   # Source: MCP Server IP
   # Destination: This Firewall
   # Port: 443
   ```

3. **Wrong host/port in configuration**
   ```bash
   # Check environment variables
   echo $OPNSENSE_HOST
   
   # Fix in .env file
   OPNSENSE_HOST=https://192.168.1.1  # Include https://
   ```

#### Problem: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
```
Error: unable to verify the first certificate
```

**Solutions:**
1. **For development only - disable SSL verification**
   ```bash
   OPNSENSE_VERIFY_SSL=false
   ```

2. **For production - add CA certificate**
   ```bash
   # Export OPNsense CA certificate
   # System > Trust > Authorities > Export
   
   # Add to Node.js
   export NODE_EXTRA_CA_CERTS=/path/to/ca-cert.pem
   ```

### 2. Authentication Issues

#### Problem: "401 Unauthorized"
```
Error: Request failed with status code 401
```

**Solutions:**

1. **Verify API credentials**
   ```bash
   # Test credentials directly
   curl -u "wrong_key:wrong_secret" \
     https://192.168.1.1/api/core/system/status
   # Should return 401
   
   curl -u "correct_key:correct_secret" \
     https://192.168.1.1/api/core/system/status
   # Should return 200
   ```

2. **Check user permissions in OPNsense**
   ```
   System > Access > Users > Edit user
   Effective Privileges should include:
   - System: API access
   - Firewall: Rules: Edit
   - Interfaces: VLANs: Edit
   ```

3. **Regenerate API credentials**
   ```
   System > Access > Users > Edit user
   API Keys > Add > Generate new key/secret pair
   ```

#### Problem: "403 Forbidden"
```
Error: User lacks required privileges
```

**Solution:**
```
# In OPNsense:
System > Access > Groups
Edit group > Assigned Privileges
Add required privileges:
- GUI - all pages
- System - HA node sync
- Firewall - Aliases: Edit
- Firewall - Rules: Edit
- Interfaces - Groups: Edit
- Services - all
```

### 3. Performance Issues

#### Problem: Slow response times
```
Tool execution taking >5 seconds
```

**Diagnosis & Solutions:**

1. **Check cache status**
   ```typescript
   // Add debug endpoint
   app.get('/debug/cache', async (req, res) => {
     const stats = await cacheManager.getStats();
     res.json(stats);
   });
   ```

2. **Monitor API latency**
   ```bash
   # Time API calls
   time curl https://192.168.1.1/api/interfaces/vlan/searchItem \
     -u "key:secret"
   ```

3. **Check for memory leaks**
   ```bash
   # Monitor memory usage
   while true; do
     ps aux | grep node | grep opnsense
     sleep 5
   done
   
   # If growing, check for unclosed intervals
   grep -r "setInterval" src/ | grep -v "clearInterval"
   ```

#### Problem: High memory usage
```
Process using >500MB RAM
```

**Solutions:**

1. **Clear cache**
   ```typescript
   // Implement cache clearing endpoint
   app.post('/admin/cache/clear', async (req, res) => {
     await cacheManager.clear();
     res.json({ message: 'Cache cleared' });
   });
   ```

2. **Restart with memory limit**
   ```bash
   # PM2
   pm2 restart opnsense-mcp --max-memory-restart 400M
   
   # Docker
   docker run -m 512m opnsense-mcp
   ```

3. **Enable heap snapshots**
   ```bash
   node --inspect dist/index.js
   # Open chrome://inspect
   # Take heap snapshot
   # Analyze for memory leaks
   ```

### 4. Tool Execution Failures

#### Problem: "Tool not found"
```
Error: Unknown tool: opnsense_vlan_create
```

**Solutions:**

1. **List available tools**
   ```bash
   # Using MCP CLI
   echo '{"method":"tools/list"}' | node dist/index.js
   ```

2. **Check tool registration**
   ```typescript
   // In index.ts, verify tool is registered
   console.log('Registered tools:', Array.from(this.tools.keys()));
   ```

#### Problem: "Invalid arguments"
```
Error: Validation failed: tag must be between 1 and 4094
```

**Solutions:**

1. **Check schema requirements**
   ```bash
   # Get tool schema
   echo '{"method":"tools/get","params":{"name":"opnsense_vlan_create"}}' | \
     node dist/index.js
   ```

2. **Validate input**
   ```typescript
   // Test validation
   const schema = VlanCreateSchema;
   const result = schema.safeParse(input);
   if (!result.success) {
     console.log('Validation errors:', result.error.errors);
   }
   ```

### 5. State Management Issues

#### Problem: "State file corrupted"
```
Error: Unexpected token in JSON at position 0
```

**Solutions:**

1. **Backup and reset state**
   ```bash
   # Backup corrupted state
   mv data/state.json data/state.backup.json
   
   # Start fresh
   echo '{"resources":{},"version":"1.0.0"}' > data/state.json
   ```

2. **Recover from backup**
   ```bash
   # List backups
   ls -la data/backups/
   
   # Restore
   cp data/backups/state-2024-01-15.json data/state.json
   ```

#### Problem: "State lock timeout"
```
Error: Could not acquire state lock
```

**Solution:**
```bash
# Remove stale lock
rm data/.state.lock

# Or force unlock via API
curl -X POST http://localhost:3000/admin/state/unlock
```

### 6. Docker-Specific Issues

#### Problem: Container exits immediately
```
docker ps shows container exiting with code 1
```

**Solutions:**

1. **Check logs**
   ```bash
   docker logs opnsense-mcp
   docker logs --tail 50 -f opnsense-mcp
   ```

2. **Debug interactively**
   ```bash
   docker run -it --entrypoint /bin/sh opnsense-mcp
   # Then manually run: node dist/index.js
   ```

3. **Environment variables not set**
   ```bash
   docker run -e OPNSENSE_HOST=https://192.168.1.1 \
     -e OPNSENSE_API_KEY=key \
     -e OPNSENSE_API_SECRET=secret \
     opnsense-mcp
   ```

#### Problem: "Cannot connect to Redis"
```
Error: Redis connection refused
```

**Solution:**
```bash
# Ensure Redis is in same network
docker network create opnsense-net
docker run --network opnsense-net --name redis redis
docker run --network opnsense-net \
  -e REDIS_HOST=redis \
  opnsense-mcp
```

### 7. Kubernetes-Specific Issues

#### Problem: "CrashLoopBackOff"
```
kubectl get pods shows CrashLoopBackOff
```

**Solutions:**

1. **Check pod logs**
   ```bash
   kubectl logs -f pod/opnsense-mcp-xxxxx
   kubectl logs -f pod/opnsense-mcp-xxxxx --previous
   ```

2. **Describe pod for events**
   ```bash
   kubectl describe pod opnsense-mcp-xxxxx
   ```

3. **Check secret/configmap**
   ```bash
   kubectl get secret opnsense-secret -o yaml
   kubectl get configmap opnsense-config -o yaml
   ```

4. **Exec into pod**
   ```bash
   kubectl exec -it pod/opnsense-mcp-xxxxx -- /bin/sh
   ```

## 🔧 Advanced Debugging

### Enable Debug Mode
```bash
# Set environment variables
export DEBUG=opnsense:*
export LOG_LEVEL=debug
export NODE_ENV=development

# Run with verbose output
node dist/index.js --verbose
```

### Network Debugging
```bash
# Trace network calls
tcpdump -i any -w opnsense.pcap host 192.168.1.1

# Analyze with Wireshark
wireshark opnsense.pcap

# Or use mitmproxy
mitmdump -s log_requests.py --mode upstream:https://192.168.1.1
```

### Performance Profiling
```bash
# CPU profiling
node --prof dist/index.js
# Run load test
# Then process profile
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --expose-gc --trace-gc dist/index.js

# Trace async operations
node --trace-warnings dist/index.js
```

### Database Issues
```bash
# Check database connection
psql -h localhost -U mcp_user -d opnsense_mcp -c "SELECT 1"

# Check table structure
psql -h localhost -U mcp_user -d opnsense_mcp -c "\dt"

# Run migrations
npm run db:migrate

# Reset database
npm run db:reset
```

## 📝 Debug Endpoints

Add these endpoints for debugging:

```typescript
// debug-routes.ts
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/health', (req, res) => {
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      versions: process.versions
    });
  });
  
  app.get('/debug/config', (req, res) => {
    res.json({
      host: process.env.OPNSENSE_HOST,
      ssl: process.env.OPNSENSE_VERIFY_SSL,
      transport: process.env.TRANSPORT_MODE,
      cache: !!cacheManager,
      redis: !!redisClient
    });
  });
  
  app.get('/debug/connections', async (req, res) => {
    const stats = apiClient.getConnectionStats();
    res.json(stats);
  });
  
  app.post('/debug/test-api', async (req, res) => {
    try {
      const result = await apiClient.testConnection();
      res.json({ success: true, result });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  });
}
```

## 🆘 Getting Help

### Collect Diagnostic Information
```bash
# Generate diagnostic bundle
cat > diagnostic.sh << 'EOF'
#!/bin/bash
echo "=== System Info ==="
uname -a
node --version
npm --version

echo "=== Environment ==="
env | grep -E "OPNSENSE|NODE|REDIS" | sed 's/SECRET=.*/SECRET=***/'

echo "=== Process Info ==="
ps aux | grep opnsense

echo "=== Network Info ==="
netstat -tlnp 2>/dev/null | grep -E "3000|6379"

echo "=== Recent Logs ==="
tail -n 50 logs/error.log 2>/dev/null

echo "=== API Test ==="
curl -s -o /dev/null -w "%{http_code}" $OPNSENSE_HOST/api/core/system/status
EOF

chmod +x diagnostic.sh
./diagnostic.sh > diagnostic.txt
```

### Report Issues
When reporting issues, include:
1. Diagnostic output
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment details
5. Recent changes

### Community Support
- GitHub Issues: [github.com/yourorg/opnsense-mcp/issues]
- Discord: [discord.gg/opnsense-mcp]
- Documentation: [docs.opnsense-mcp.io]

## 🔄 Recovery Procedures

### Full System Reset
```bash
# 1. Stop service
pm2 stop opnsense-mcp

# 2. Backup current state
tar -czf backup-$(date +%Y%m%d).tar.gz data/ logs/

# 3. Clear all data
rm -rf data/* logs/*

# 4. Reinitialize
npm run init

# 5. Restart
pm2 start opnsense-mcp
```

### Emergency Rollback
```bash
# Using Docker
docker run opnsense-mcp:previous-version

# Using Git
git checkout previous-tag
npm run build
pm2 restart opnsense-mcp

# Using backup
tar -xzf backup-20240115.tar.gz
pm2 restart opnsense-mcp
```

---

*This troubleshooting guide covers the most common issues. For additional help, enable debug mode and check the logs carefully.*