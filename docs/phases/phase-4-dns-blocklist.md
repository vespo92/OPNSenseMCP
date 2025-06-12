# Phase 4: DNS Blocklist Management

## Overview

Phase 4 adds DNS-level content filtering capabilities to the OPNSense MCP server using Unbound DNS host overrides. This feature enables natural language queries to block domains, particularly useful for content filtering on specific networks like guest VLANs.

## Implementation Summary

### New Components

1. **DNS Blocklist Resource** (`src/resources/services/dns/blocklist.ts`)
   - Manages Unbound DNS host overrides
   - Blocks domains by pointing them to 0.0.0.0
   - Supports individual and bulk domain blocking
   - Includes predefined categories (adult, malware, ads, social)

2. **API Client Extensions** (`src/api/client.ts`)
   - Added Unbound DNS API methods
   - Support for host overrides and access lists
   - Configuration management for DNS settings

3. **MCP Tools** (7 new tools)
   - `list_dns_blocklist` - View all blocked domains
   - `block_domain` - Block a single domain
   - `unblock_domain` - Remove domain from blocklist
   - `block_multiple_domains` - Block multiple domains at once
   - `apply_blocklist_category` - Apply predefined blocklists
   - `search_dns_blocklist` - Search blocked domains
   - `toggle_blocklist_entry` - Enable/disable blocks

## Usage Examples

### Block a Single Domain
```
"Please block pornhub.com on the network"
```
This will add a DNS host override pointing pornhub.com to 0.0.0.0

### Apply Category Blocks
```
"Block all adult content websites"
```
This applies the 'adult' category blocklist which includes common adult sites

### Manage Blocklist
```
"Show me all blocked domains"
"Search for blocked social media sites"
"Unblock facebook.com"
```

## Natural Language Queries

The system understands various phrasings:
- "Can you block pornhub on the guest network?"
- "Add adult content filtering"
- "Block social media websites"
- "Show DNS blocklist"
- "Remove twitter from blocklist"

## Technical Details

### DNS Blocking Method
- Uses Unbound host overrides
- Blocked domains resolve to 0.0.0.0
- Applies globally (interface-specific filtering requires ACL configuration)

### Predefined Categories

1. **Adult Content**
   - pornhub.com, xvideos.com, xhamster.com, etc.
   - Common adult content domains

2. **Malware**
   - Known malicious domains
   - Phishing sites

3. **Ads**
   - doubleclick.net, googleadservices.com
   - Common advertising networks

4. **Social Media**
   - facebook.com, instagram.com, twitter.com, tiktok.com
   - Major social platforms

### API Endpoints Used
- `/api/unbound/settings/get` - Get DNS settings
- `/api/unbound/settings/addHostOverride` - Add blocklist entry
- `/api/unbound/settings/delHostOverride` - Remove blocklist entry
- `/api/unbound/settings/setHostOverride` - Update entry
- `/api/unbound/service/reconfigure` - Apply changes

## Limitations & Future Enhancements

### Current Limitations
1. **Global Application** - Blocks apply to all networks (not interface-specific)
2. **Manual Categories** - Limited predefined blocklists
3. **No Wildcard Support** - Must block each subdomain individually

### Future Enhancements
1. **Interface-Specific Blocking**
   - Use Unbound Access Control Lists (ACLs)
   - Per-VLAN DNS policies

2. **Dynamic Blocklists**
   - Integration with public blocklist feeds
   - Automatic updates from threat intelligence

3. **Wildcard Domain Blocking**
   - Block *.domain.com patterns
   - Regex-based blocking

4. **Time-Based Rules**
   - Schedule when blocks are active
   - Parental control features

## IaC Integration

For your Infrastructure as Code vision:

```typescript
// Future IaC implementation
const guestNetworkPolicy = new opnsense.DnsPolicy("guest-policy", {
  interfaces: ["igc2_vlan4"], // Guest VLAN
  
  blocklists: {
    categories: ["adult", "malware"],
    customDomains: ["gambling-site.com"],
    
    feeds: [
      "https://someonewhocares.org/hosts/",
      "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts"
    ]
  },
  
  whitelist: ["educational-site.com"],
  
  schedule: {
    // Block social media during work hours
    social: {
      days: ["mon", "tue", "wed", "thu", "fri"],
      hours: "09:00-17:00"
    }
  }
});
```

## Testing the Feature

1. **List Current Blocklist**
   ```
   list_dns_blocklist
   ```

2. **Block a Test Domain**
   ```
   block_domain domain="test.example.com" description="Testing DNS block"
   ```

3. **Apply Adult Content Filter**
   ```
   apply_blocklist_category category="adult"
   ```

4. **Verify Blocks**
   - Check DNS resolution: `nslookup pornhub.com`
   - Should resolve to 0.0.0.0

5. **Search and Toggle**
   ```
   search_dns_blocklist pattern="porn"
   toggle_blocklist_entry uuid="<uuid-from-search>"
   ```

## Configuration Notes

### OPNSense Requirements
- Unbound DNS resolver must be enabled
- DNS Query Forwarding should be disabled for blocks to work
- Clients must use OPNSense as DNS server

### Best Practices
1. Test blocks before applying to production
2. Maintain a whitelist for legitimate sites
3. Regular review of blocklist effectiveness
4. Consider using DNS-over-HTTPS bypass prevention

## Integration with MCP Ecosystem

This DNS filtering integrates with your broader MCP vision:

```yaml
# MCP Orchestration Example
home_network:
  opnsense:
    vlans:
      guest:
        id: 4
        dns_policy: "restricted"
    
    dns_policies:
      restricted:
        block_categories: ["adult", "malware", "ads"]
        custom_blocks: ["competitor.com"]
        
  home_assistant:
    automations:
      - name: "Enable strict filtering during school hours"
        trigger: time(08:00)
        action: opnsense.apply_dns_policy("kids_devices", "education_mode")
```

## Troubleshooting

### Blocks Not Working
1. Verify Unbound is running: `unbound-control status`
2. Check DNS settings in OPNSense GUI
3. Ensure clients use OPNSense for DNS
4. Clear DNS cache on clients

### Performance Issues
1. Large blocklists can slow DNS resolution
2. Consider using Pi-hole for extensive blocking
3. Monitor Unbound memory usage

## Security Considerations

1. **DNS Bypass** - Savvy users can bypass by:
   - Using alternative DNS servers
   - DNS-over-HTTPS
   - VPN connections

2. **Mitigation**
   - Firewall rules blocking port 53 to external
   - Block known DoH servers
   - Monitor for VPN traffic

## Conclusion

Phase 4 successfully adds DNS-level content filtering to your OPNSense MCP server. While currently limited to global blocking, it provides a foundation for more sophisticated per-interface filtering in future phases. The natural language interface makes it easy to manage blocklists without diving into the OPNSense GUI.
