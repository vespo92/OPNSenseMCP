# DNS Blocking Guide

Block unwanted websites and content categories using OPNsense DNS filtering.

## Overview

DNS blocking prevents devices on your network from accessing specific websites by intercepting DNS queries and returning a "black hole" address (0.0.0.0) instead of the real IP address.

## Prerequisites

- OPNsense using Unbound DNS resolver (default)
- Devices configured to use OPNsense for DNS
- MCP server connected and configured

## Quick Commands

### Block Specific Sites

```
"Block pornhub.com"
```

```
"Block facebook.com, twitter.com, and tiktok.com"
```

### Block Content Categories

```
"Apply adult content blocklist"
```

```
"Block social media sites"
```

```
"Apply malware and phishing blocklist"
```

### View Current Blocks

```
"Show me the DNS blocklist"
```

```
"Search blocklist for gambling"
```

### Remove Blocks

```
"Unblock youtube.com"
```

```
"Remove all social media blocks"
```

## Content Categories

The server includes predefined blocklists for common categories:

### Adult Content
Blocks adult and pornographic websites:
- pornhub.com
- xvideos.com
- xhamster.com
- And many more...

### Social Media
Blocks social networking sites:
- facebook.com
- twitter.com
- instagram.com
- tiktok.com
- snapchat.com
- And more...

### Advertising
Blocks ad servers and tracking:
- doubleclick.net
- googleadservices.com
- googlesyndication.com
- facebook tracking pixels
- And thousands more...

### Malware & Phishing
Blocks known malicious sites:
- Phishing domains
- Malware distribution
- Command & control servers
- Compromised sites

### Gambling
Blocks online gambling sites:
- bet365.com
- pokerstars.com
- draftkings.com
- And more...

## How DNS Blocking Works

### Technical Process

1. **DNS Query**: Device requests IP for blocked domain
2. **Unbound Intercepts**: OPNsense DNS resolver checks blocklist
3. **Returns 0.0.0.0**: Instead of real IP, returns null address
4. **Connection Fails**: Browser can't connect to 0.0.0.0

### Implementation Details

DNS blocks are implemented as Unbound host overrides:

```javascript
// Example: Blocking pornhub.com
{
  enabled: '1',
  host: '@',              // @ for root domain
  domain: 'pornhub.com',
  server: '0.0.0.0',      // Black hole address
  description: 'Adult content block'
}
```

## Network-Wide vs Per-Device Blocking

### Current Capability: Network-Wide

DNS blocks currently apply to **all devices** using OPNsense for DNS.

**Pros:**
- Simple to implement
- Consistent policy
- No per-device configuration

**Cons:**
- Can't differentiate by user/device
- All-or-nothing approach

### Future: Per-Network Blocking

Coming in future updates:
- Different policies per VLAN
- Time-based restrictions
- User-specific rules

## Testing DNS Blocks

### From Windows
```powershell
# Test if domain is blocked
nslookup pornhub.com
# Should return: 0.0.0.0

# Flush DNS cache if needed
ipconfig /flushdns
```

### From macOS/Linux
```bash
# Test if domain is blocked
nslookup pornhub.com
# Should return: 0.0.0.0

# Flush DNS cache
sudo dscacheutil -flushcache  # macOS
sudo systemd-resolve --flush-caches  # Linux
```

### From Web Browser
1. Clear browser cache
2. Try visiting blocked site
3. Should see connection error

## Advanced Usage

### Custom Blocklists

Add domains with descriptions:

```
"Block gambling-site.com with description 'Company policy'"
```

### Wildcard Blocking

Block all subdomains:

```
"Block *.facebook.com"
```

This blocks:
- www.facebook.com
- m.facebook.com
- api.facebook.com
- All other subdomains

### Scheduled Blocking

> [!NOTE]
> Time-based blocking is planned for future releases.

Example of future capability:
```
"Block social media during work hours 9am-5pm Monday-Friday"
```

## Bypassing DNS Blocks

Be aware that users can bypass DNS blocks by:

### 1. Using Alternative DNS
- Changing device DNS to 8.8.8.8 (Google)
- Using DNS over HTTPS (DoH)
- Using VPN services

**Mitigation:**
- Block outbound DNS (port 53) except from OPNsense
- Block known DoH providers
- Monitor for VPN usage

### 2. Using IP Addresses
- Accessing sites directly by IP
- Using cached DNS entries

**Mitigation:**
- Use firewall rules for IP blocking
- Regular cache clearing
- Deep packet inspection (future)

## Troubleshooting

### Blocks Not Working

**Check Unbound Service:**
```bash
# Via Claude
"Is the Unbound DNS service running?"
```

**Verify DNS Settings:**
- Services → Unbound DNS → General
- Ensure "Enable" is checked
- DNS Query Forwarding should be DISABLED

**Check Client Configuration:**
- Device must use OPNsense for DNS
- Not using 8.8.8.8 or other public DNS

### Legitimate Sites Blocked

**Check for False Positives:**
```
"Search blocklist for example.com"
```

**Whitelist if Needed:**
```
"Unblock legitimate-site.com"
```

### Performance Issues

**Large Blocklists:**
- Too many entries can slow DNS
- Consider using categories instead of individual blocks
- Monitor Unbound memory usage

## Best Practices

### 1. Start Small
- Begin with critical blocks (malware)
- Add categories gradually
- Monitor for issues

### 2. Document Blocks
- Use descriptions for custom blocks
- Keep list of blocked categories
- Document exceptions/whitelists

### 3. Regular Review
- Check blocklist monthly
- Remove outdated entries
- Update category lists

### 4. User Communication
- Inform users about blocking policy
- Provide request process for unblocking
- Explain security benefits

## Integration with IaC

### Current Manual Process

Each block requires individual commands:
```
"Block site1.com"
"Block site2.com"
"Apply adult content filter"
```

### Future IaC Vision

Declarative DNS policies:
```yaml
dns_policies:
  guest_network:
    vlan: 50
    block_categories:
      - adult
      - malware
      - gambling
    custom_blocks:
      - specific-site.com
    
  kids_network:
    vlan: 60
    block_categories:
      - adult
      - violence
      - social_media
    time_restrictions:
      school_nights:
        days: [Sun, Mon, Tue, Wed, Thu]
        block_after: "21:00"
        unblock_at: "06:00"
```

## Examples

### Home Network Protection

```
"Apply these blocklists:
- Malware and phishing
- Adult content
- Gambling"
```

### Child-Safe Internet

```
"Create a child-safe DNS policy:
- Block adult content
- Block violence and gore
- Block social media
- Block gaming sites"
```

### Work From Home

```
"Block these distractions during work hours:
- Social media
- News sites
- Shopping sites
- Streaming services"
```

## API Reference

The following tools are available for DNS blocking:

### blockDomains
Block one or more domains.

**Parameters:**
- `domains`: Array of domains to block
- `description`: Optional description

### unblockDomains
Remove domains from blocklist.

**Parameters:**
- `domains`: Array of domains to unblock

### applyBlocklistCategory
Apply predefined category blocklist.

**Parameters:**
- `category`: Category name (adult, social, ads, malware, gambling)

### listBlockedDomains
Show all currently blocked domains.

**Parameters:**
- `search`: Optional search term

## Next Steps

- Learn about [Firewall Rules](firewall-rules.md) for IP-based blocking
- Explore [VLAN Management](vlan-management.md) for network segmentation
- Read about [HAProxy](haproxy.md) for SSL inspection

## Related Documentation

- [Troubleshooting Guide](../troubleshooting/common-issues.md)
- [IaC Overview](../iac/overview.md)
- [Network Examples](../../examples/patterns/)