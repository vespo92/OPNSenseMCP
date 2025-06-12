# DNS Blocking Solution for OPNSense MCP

## Problem Summary

The DNS blocklist feature is not working as expected. When attempting to block domains like pornhub.com, the API reports success but the domains don't appear in the blocklist when queried.

## Root Cause

The issue appears to be related to:

1. **Domain Parsing**: The way domains are split into host and domain parts for Unbound host overrides
2. **API Response Handling**: The reconfigure endpoint might not be properly awaited
3. **List Retrieval**: The blocklist retrieval might not be correctly parsing the Unbound host overrides

## Solutions

### Solution 1: Fixed DNS Blocking Implementation

Run the comprehensive solution script:

```bash
node solve-dns-blocking.js
```

This script:
- Uses direct API calls to add host overrides
- Properly handles root domains (@) and subdomains (www)
- Applies configuration changes with proper waiting
- Verifies the blocks are in place

### Solution 2: Debug and Fix

For debugging the current state:

```bash
node debug-dns-blocklist.js
```

This will:
- Show raw Unbound settings
- Display what the MCP server sees
- Test blocking functionality
- Provide diagnostic information

### Solution 3: Manual Configuration

If automated blocking fails, configure manually in OPNsense:

1. **Navigate to**: Services → Unbound DNS → General
2. **Scroll to**: Host Overrides section
3. **Add entries**:
   - Host: @ (for root) or subdomain name
   - Domain: pornhub.com
   - IP: 0.0.0.0
   - Description: Adult content block

4. **Apply changes** and restart Unbound service

## Technical Details

### Correct Host Override Format

For blocking domains in Unbound:

```javascript
// Root domain (pornhub.com)
{
  enabled: '1',
  host: '@',           // @ means root domain
  domain: 'pornhub.com',
  server: '0.0.0.0',   // Redirect to nowhere
  description: 'Blocked domain'
}

// Subdomain (www.pornhub.com)
{
  enabled: '1',
  host: 'www',         // Subdomain part
  domain: 'pornhub.com',
  server: '0.0.0.0',
  description: 'Blocked subdomain'
}
```

### API Endpoints Used

- **Add host override**: `POST /api/unbound/settings/addHostOverride`
- **Apply changes**: `POST /api/unbound/service/reconfigure`
- **Get settings**: `GET /api/unbound/settings/get`

## Integration with IaC Vision

### Current State

The MCP server provides tools for DNS blocking:
- `block_domain` - Block single domain
- `block_multiple_domains` - Block multiple domains
- `apply_blocklist_category` - Apply predefined categories

### Future IaC Implementation

For your Pulumi/SST infrastructure as code vision:

```typescript
// Example Pulumi resource for OPNsense DNS policies
import * as pulumi from "@pulumi/pulumi";
import * as opnsense from "@your-org/pulumi-opnsense";

// Define DNS policies
const iotDnsPolicy = new opnsense.DnsPolicy("iot-dns-policy", {
    name: "IoT Device Restrictions",
    interfaces: ["igc2_vlan2"], // IoT VLAN
    
    blocklists: {
        // Static blocks
        domains: [
            "pornhub.com",
            "*.pornhub.com",
            "xvideos.com",
            "*.xvideos.com"
        ],
        
        // Category-based blocks
        categories: ["adult", "malware", "ads"],
        
        // External blocklist feeds
        feeds: [
            {
                url: "https://someonewhocares.org/hosts/zero/hosts",
                format: "hosts",
                updateInterval: "daily"
            },
            {
                url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts",
                format: "hosts",
                updateInterval: "weekly"
            }
        ]
    },
    
    // Time-based rules
    schedules: [{
        name: "School Hours",
        timeRanges: ["08:00-15:00"],
        daysOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        additionalBlocks: ["youtube.com", "tiktok.com", "instagram.com"]
    }],
    
    // Whitelist exceptions
    whitelist: [
        "educational-site.com",
        "school-portal.edu"
    ]
});

// Guest network policy
const guestDnsPolicy = new opnsense.DnsPolicy("guest-dns-policy", {
    name: "Guest Network Restrictions",
    interfaces: ["igc2_vlan4"], // Guest VLAN
    
    // Use public family-safe DNS
    upstreamServers: [
        "9.9.9.9",      // Quad9 (blocks malware)
        "149.112.112.112"
    ],
    
    blocklists: {
        categories: ["adult", "malware", "phishing"],
        customDomains: ["torrent-site.com", "vpn-provider.com"]
    }
});

// Export the policies for use in other stacks
export const dnsPolices = {
    iot: iotDnsPolicy,
    guest: guestDnsPolicy
};
```

### SST Implementation Example

```typescript
// sst.config.ts
import { OpnsenseDnsPolicy } from "./constructs/OpnsenseDnsPolicy";

export default {
  config(_input) {
    return {
      name: "home-network-iac",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(function HomeNetwork({ stack }) {
      // DNS filtering policies
      const dnsFiltering = new OpnsenseDnsPolicy(stack, "DnsFiltering", {
        opnsenseEndpoint: process.env.OPNSENSE_HOST!,
        apiCredentials: {
          key: process.env.OPNSENSE_API_KEY!,
          secret: process.env.OPNSENSE_API_SECRET!,
        },
        
        policies: {
          iot: {
            vlans: ["igc2_vlan2"],
            blockCategories: ["adult", "malware"],
            customBlocks: ["specific-bad-site.com"],
          },
          guest: {
            vlans: ["igc2_vlan4"],
            blockCategories: ["adult", "malware", "torrents"],
            upstreamDns: ["9.9.9.9"], // Quad9 for guests
          },
          kids: {
            vlans: ["igc2_vlan5"],
            blockCategories: ["adult", "violence", "gambling"],
            timeRestrictions: {
              schoolNights: {
                days: ["Sun", "Mon", "Tue", "Wed", "Thu"],
                blockAfter: "21:00",
                unblockAt: "06:00",
              },
            },
          },
        },
      });
      
      return {
        dnsFilteringArn: dnsFiltering.arn,
      };
    });
  },
};
```

## Troubleshooting Checklist

1. **Verify Unbound is running**:
   - System → Services → Check "unbound" status

2. **Check DNS settings**:
   - Services → Unbound DNS → General
   - Ensure "Enable" is checked
   - DNS Query Forwarding should be DISABLED

3. **Verify DHCP settings**:
   - Services → DHCPv4 → [Interface]
   - DNS servers should point to OPNsense IP

4. **Test from client**:
   ```bash
   # From a device on IoT VLAN
   nslookup pornhub.com
   # Should return 0.0.0.0
   ```

5. **Check Unbound logs**:
   - System → Log Files → General
   - Filter by "unbound"

## Next Steps for Full IaC Implementation

1. **Create MCP Orchestrator**:
   - Build a higher-level orchestrator that coordinates multiple MCP servers
   - Implement state management for tracking deployed configurations

2. **Add More MCP Servers**:
   - Home Assistant MCP for automation rules
   - Proxmox MCP for VM management
   - UniFi MCP for WiFi/switching

3. **Implement GitOps**:
   - Store all configurations in Git
   - Use CI/CD to deploy changes
   - Implement rollback capabilities

4. **Add Monitoring**:
   - Prometheus metrics from OPNsense
   - Grafana dashboards for DNS blocking effectiveness
   - Alerts for policy violations

## Conclusion

The DNS blocking issue can be resolved by:
1. Using the provided solution scripts
2. Manually configuring through the GUI if needed
3. Understanding the proper Unbound host override format

This DNS blocking capability is a crucial component of your larger IaC vision, enabling policy-based network management across your home infrastructure.
