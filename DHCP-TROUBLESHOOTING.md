# DHCP Troubleshooting Guide

## Quick Fix Steps

1. **Build the updated code:**
   ```bash
   npm run build
   ```

2. **Run the debug script to find working endpoints:**
   ```bash
   node debug-dhcp-comprehensive.js
   ```

3. **Test with debug mode enabled:**
   ```bash
   node test-dhcp-debug.js
   ```

## Common Issues and Solutions

### Issue: "Cannot read properties of undefined (reading 'substring')"
**Cause:** The MAC address field is undefined or null  
**Fix:** Already fixed in the updated `leases.ts` - includes null checks

### Issue: Empty array returned, no DHCP leases found
**Possible Causes:**
1. Wrong API endpoint for your OPNsense version
2. API user lacks permissions
3. DHCP service not running
4. Response format different than expected

**Solutions:**
1. Run `debug-dhcp-comprehensive.js` to find the correct endpoint
2. Check API user permissions in OPNsense
3. Verify DHCP service status
4. Check the debug output for actual response structure

### Issue: Fields are missing or named differently
**Fix:** The updated code includes field normalization that handles variations:
- `address`, `ip`, `ipaddr` → `address`
- `hwaddr`, `mac`, `macaddr` → `hwaddr`
- `hostname`, `host`, `name` → `hostname`

## Testing Individual Functions

### Test DHCP Leases
```javascript
// In Claude Desktop
list_dhcp_leases
```

### Test Device Search
```javascript
// Find by hostname
find_device_by_name pattern:"nintendo"

// Find by MAC
find_device_by_mac mac:"04:03:d6:da:97:54"
```

### Test Guest Network
```javascript
get_guest_devices
```

## If Nothing Works

1. **Check Alternative Data Sources:**
   - ARP table might have device info
   - Status pages might show DHCP data
   - Network diagnostics might list connected devices

2. **Manual API Test:**
   ```bash
   curl -k -u "your-api-key:your-api-secret" \
     https://your-opnsense-host/api/dhcpv4/leases/searchLease \
     -X POST -H "Content-Type: application/json" \
     -d '{"current":1,"rowCount":1000}'
   ```

3. **Enable More Debugging:**
   Edit `test-dhcp-debug.js` and add more console.logs to trace the issue

## Success Indicators

When working correctly, you should see:
- List of devices with IP addresses, MAC addresses, and hostnames
- Manufacturer identification for known MAC prefixes
- Proper interface grouping
- Guest network device detection

## Need Help?

If you're still having issues:
1. Run the debug scripts and save the output
2. Note your OPNsense version
3. Check the API user permissions
4. Try the alternative endpoints suggested by the debug script
