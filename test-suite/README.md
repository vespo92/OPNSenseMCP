# Firewall Rule Testing Suite

This directory contains comprehensive testing tools for the OPNsense MCP Server firewall rule functionality, with a focus on persistence issues and NFS connectivity validation.

## Test Files

### 1. `firewall-rules.test.ts`
Comprehensive test suite covering:
- Interface discovery and validation
- Alternative API endpoint testing
- CRUD operations (Create, Read, Update, Delete)
- NFS connectivity rule creation
- Rule persistence validation
- Batch rule creation

### 2. `validate-nfs-connectivity.ts`
Production validation tool for NFS connectivity:
- Checks existing NFS rules
- Creates missing rules (with `--create` flag)
- Provides diagnostic information
- Generates test commands for validation
- Identifies potential blocking rules

### 3. `../debug-firewall-persistence.ts`
Quick debug script for persistence issues:
- Creates a test rule
- Tests various persistence methods
- Provides immediate feedback
- Cleans up after testing

## Running the Tests

### Full Test Suite
```bash
npm run test:firewall
```

### NFS Validation
```bash
# Check existing rules
npm run test:nfs

# Create missing rules
npm run test:nfs:create
```

### Quick Debug
```bash
tsx debug-firewall-persistence.ts
```

## Environment Variables

Required in `.env` file:
```env
OPNSENSE_HOST=your-opnsense-host
OPNSENSE_API_KEY=your-api-key
OPNSENSE_API_SECRET=your-api-secret

# Optional - defaults shown
DMZ_INTERFACE=igc3_vlan6
```

## Network Configuration

Default test configuration:
- **DMZ Network**: 10.0.6.0/24
- **DMZ Interface**: igc3_vlan6 (VLAN tag 6)
- **TrueNAS Server**: 10.0.0.14
- **DMZ Test Node**: 10.0.6.2

## Common Issues and Solutions

### Issue: Rules not appearing in list
**Symptoms**: Rule created successfully but doesn't appear in `list_firewall_rules`

**Solutions**:
1. Enable debug mode: `export DEBUG_FIREWALL=true`
2. Run the persistence debugger: `tsx debug-firewall-persistence.ts`
3. Check interface mapping is correct
4. Verify API user has full permissions

### Issue: Interface not recognized
**Symptoms**: Interface name not accepted by API

**Solutions**:
1. Run interface discovery: `npm run test:firewall` (Test 1)
2. Check valid interface names in OPNsense UI
3. Use internal interface keys (e.g., `opt3` instead of `DMZ`)

### Issue: Rules not persisting after service restart
**Symptoms**: Rules disappear after OPNsense service restart

**Solutions**:
1. Ensure both `apply` and `reconfigure` are called
2. Check for errors in `/var/log/configd.log`
3. Verify configuration is being saved properly

## Production Testing Commands

After creating NFS rules, test from DMZ node (10.0.6.2):

```bash
# Test RPC portmapper
rpcinfo -p 10.0.0.14

# List NFS exports
showmount -e 10.0.0.14

# Test NFS mount
mount -t nfs 10.0.0.14:/mnt/tank/kubernetes /mnt/test
ls -la /mnt/test
umount /mnt/test
```

## Debugging Tips

1. **Enable verbose logging**:
   ```bash
   export MCP_DEBUG=true
   export DEBUG_FIREWALL=true
   ```

2. **Check OPNsense logs**:
   - Web UI: System → Log Files → General
   - SSH: `tail -f /var/log/configd.log`

3. **Monitor live firewall logs**:
   - Web UI: System → Log Files → Live View → Firewall

4. **Verify rule in UI**:
   - Firewall → Rules → [Interface]
   - Check if rule shows as "Applied" vs "Pending"

## Test Coverage

The test suite validates:
- ✅ Rule creation and retrieval
- ✅ Rule updates and deletion
- ✅ Rule persistence in list
- ✅ Interface name mapping
- ✅ Protocol mapping
- ✅ Batch operations
- ✅ NFS-specific rules
- ✅ Apply and save mechanisms

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Clean up test data in finally blocks
3. Use descriptive console output
4. Include both positive and negative test cases
5. Document any new environment variables