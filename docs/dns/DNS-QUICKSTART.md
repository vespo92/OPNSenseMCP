# DNS Blocklist Quick Start

## Block Pornhub on Guest Network - Quick Guide

### Prerequisites
- OPNSense MCP server installed and running
- Claude Desktop configured with MCP
- OPNSense using Unbound DNS resolver

### Step 1: Connect to OPNSense
In Claude Desktop, say:
```
"Connect to my OPNSense firewall"
```

### Step 2: Check Current Blocklist
```
"Show me the DNS blocklist"
```

### Step 3: Block Pornhub
```
"Block pornhub.com"
```

Or for multiple sites:
```
"Block pornhub.com, xvideos.com, and xhamster.com"
```

### Step 4: Apply Adult Content Filter
For comprehensive blocking:
```
"Apply the adult content blocklist category"
```

This blocks common adult sites including:
- pornhub.com
- xvideos.com
- xhamster.com
- xnxx.com
- redtube.com
- youporn.com

### Step 5: Verify Blocks
```
"Search DNS blocklist for porn"
```

### Testing the Block
On a device using OPNSense for DNS:
```bash
nslookup pornhub.com
# Should return 0.0.0.0
```

### To Unblock Later
```
"Unblock pornhub.com"
```

## Other Quick Commands

### Block Social Media
```
"Apply social media blocklist"
```

### Block Ads
```
"Apply advertising blocklist"
```

### Block Malware
```
"Apply malware blocklist"
```

### Custom Blocks
```
"Block gambling-site.com with description 'Gambling block'"
```

## Important Notes

1. **Global Effect**: Blocks apply to ALL networks, not just guest
2. **DNS Cache**: Clients may need to flush DNS cache
3. **Bypass Prevention**: Users can bypass with alternative DNS servers

## Troubleshooting

If blocks aren't working:
1. Ensure client uses OPNSense for DNS
2. Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
3. Check Unbound is running in OPNSense

## Next Steps

For interface-specific blocking (guest network only), this requires additional configuration not yet supported by the MCP server. This will be added in Phase 5.
