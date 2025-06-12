# Phase 4 Migration Guide

## Upgrading from Phase 3 to Phase 4

This guide helps you upgrade your OPNSense MCP server to include DNS blocklist functionality.

## Prerequisites

1. Ensure Phase 3 is working correctly
2. OPNSense must have Unbound DNS resolver enabled
3. Backup your configuration

## Migration Steps

### 1. Pull Latest Code
```bash
git pull origin main
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Project
```bash
npm run build
```

### 4. Test the Build
```bash
node test-dns-blocklist.js
```

### 5. Restart Claude Desktop
Close and reopen Claude Desktop to reload the MCP server.

## New Features Available

### DNS Blocklist Tools
- `list_dns_blocklist` - View all blocked domains
- `block_domain` - Block a single domain
- `unblock_domain` - Remove domain from blocklist
- `block_multiple_domains` - Block multiple domains
- `apply_blocklist_category` - Apply predefined categories
- `search_dns_blocklist` - Search blocklist entries
- `toggle_blocklist_entry` - Enable/disable entries

### Natural Language Examples
- "Block pornhub.com"
- "Apply adult content filter"
- "Show all blocked domains"
- "Unblock facebook.com"
- "Block all advertising domains"

## Configuration Changes

No `.env` changes required for basic functionality.

### Optional: Interface-Specific Blocking (Future)
To prepare for interface-specific DNS policies, ensure your VLANs use OPNSense as their DNS server.

## Testing Phase 4

1. **Check Current Blocklist**
   ```
   Ask Claude: "Show me the DNS blocklist"
   ```

2. **Block a Test Domain**
   ```
   Ask Claude: "Block test.example.com"
   ```

3. **Apply Category Filter**
   ```
   Ask Claude: "Block all adult content websites"
   ```

4. **Verify in OPNSense GUI**
   - Navigate to Services → Unbound DNS → Overrides
   - Verify blocked domains appear as host overrides pointing to 0.0.0.0

## Rollback Instructions

If you need to rollback to Phase 3:

1. **Remove DNS Blocks via GUI**
   - Services → Unbound DNS → Overrides
   - Delete any unwanted host overrides

2. **Revert Code**
   ```bash
   git checkout phase3
   npm install
   npm run build
   ```

3. **Restart Claude Desktop**

## Common Issues

### DNS Blocks Not Working
1. Verify Unbound is enabled in OPNSense
2. Check clients use OPNSense for DNS
3. Clear DNS cache on test devices
4. Ensure DNS Query Forwarding is disabled

### API Errors
1. Check OPNSense API credentials
2. Verify Unbound service is running
3. Check OPNSense logs for errors

### Performance Issues
Large blocklists can impact DNS performance. Consider:
- Starting with essential blocks only
- Using categories selectively
- Monitoring DNS query times

## Future Enhancements

Phase 5 will add:
- Interface-specific DNS policies
- Time-based blocking rules
- Integration with public blocklist feeds
- Wildcard domain support

## Support

- Check `Phase4-DNS-BLOCKLIST.md` for detailed documentation
- Review `API-ENDPOINTS.md` for API details
- Test with `test-dns-blocklist.js` for troubleshooting
