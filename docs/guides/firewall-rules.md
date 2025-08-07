# Firewall Rules Guide

Configure and manage firewall rules to control traffic flow and secure your network.

## Overview

Firewall rules in OPNsense:
- Control traffic between interfaces
- Filter by source, destination, ports, and protocols
- Enable logging and monitoring
- Support advanced features like scheduling and rate limiting

## Prerequisites

- Understanding of network protocols (TCP/UDP)
- Knowledge of your network topology
- Clear security requirements
- MCP server connected

## Quick Commands

### Create Rules

```
"Block all traffic from 192.168.1.100"
```

```
"Allow port 443 from internet to web server 192.168.30.10"
```

```
"Create rule to allow Minecraft server on port 25565"
```

### List Rules

```
"Show all firewall rules"
```

```
"List rules for LAN interface"
```

```
"Show rules blocking port 445"
```

### Delete Rules

```
"Delete firewall rule blocking Facebook"
```

```
"Remove all rules for guest VLAN"
```

## Rule Basics

### Rule Components

Every firewall rule has:
- **Action**: Pass, Block, or Reject
- **Interface**: Where rule applies
- **Direction**: In or Out
- **Source**: Where traffic originates
- **Destination**: Where traffic goes
- **Protocol**: TCP, UDP, ICMP, etc.
- **Port**: Service port number

### Rule Order

Rules are processed top to bottom:
1. First matching rule wins
2. More specific rules go first
3. Default deny at the end

### Actions Explained

**Pass**: Allow traffic through
```
"Pass HTTPS traffic to web server"
```

**Block**: Silently drop packets
```
"Block all traffic from malicious IP"
```

**Reject**: Drop and notify sender
```
"Reject unauthorized SSH attempts"
```

## Common Rule Patterns

### 1. Allow Web Server

```
"Create firewall rule:
- Interface: WAN
- Action: Pass
- Protocol: TCP
- Destination: 192.168.30.10
- Port: 80,443
- Description: Allow web traffic"
```

### 2. Block Specific IP

```
"Block all traffic from IP 203.0.113.50:
- Interface: WAN
- Action: Block
- Source: 203.0.113.50
- Description: Blocked attacker"
```

### 3. Guest Network Isolation

```
"Create guest isolation rules:
1. Allow guest to internet
2. Block guest to LAN network
3. Block guest to admin interfaces"
```

### 4. Port Forwarding

```
"Forward port 25565 to Minecraft server:
- Interface: WAN
- Protocol: TCP/UDP
- Port: 25565
- Redirect to: 192.168.1.100:25565"
```

## Interface-Specific Rules

### WAN Rules (Internet)

Typically restrictive - block by default:

```
"WAN rules should:
- Block all unsolicited inbound
- Allow specific services only
- Log suspicious activity"
```

### LAN Rules

Usually permissive - allow by default:

```
"LAN rules typically:
- Allow all outbound
- Allow LAN to LAN
- Restrict specific devices"
```

### VLAN Rules

Isolation and segmentation:

```
"VLAN rules should:
- Control inter-VLAN routing
- Isolate guest networks
- Restrict IoT devices"
```

## Advanced Rule Features

### Aliases

Group IPs, ports, or URLs:

```
"Create alias 'WebServers':
- 192.168.1.10
- 192.168.1.11
- 192.168.1.12"
```

Use in rules:
```
"Allow HTTPS to alias WebServers"
```

### Schedules

Time-based rules:

```
"Block social media during work hours:
- Schedule: Mon-Fri 9am-5pm
- Block: facebook.com, twitter.com"
```

### Floating Rules

Apply to multiple interfaces:

```
"Create floating rule to block BitTorrent on all interfaces"
```

### Quick Rules

Stop processing after match:

```
"Create quick rule to immediately block known attackers"
```

## Security Rule Sets

### Basic Home Security

```
"Apply home security rules:
1. Block incoming except established
2. Allow LAN to anywhere
3. Block malicious IPs
4. Allow specific port forwards
5. Log all blocked attempts"
```

### Office Security

```
"Configure office firewall:
1. Segment by department VLANs
2. Restrict server access
3. Allow VPN connections
4. Block peer-to-peer
5. Time-based restrictions"
```

### DMZ Configuration

```
"Set up DMZ rules:
1. Allow internet to DMZ services
2. Block DMZ to LAN initiated
3. Allow LAN to DMZ
4. Restrict DMZ to internet
5. Log all DMZ traffic"
```

## Service-Specific Rules

### Web Services

```
"Allow web services:
- HTTP (80)
- HTTPS (443)
- WebSocket (specific ports)
- Reverse proxy rules"
```

### Email Services

```
"Configure email ports:
- SMTP (25, 587)
- IMAP (143, 993)
- POP3 (110, 995)
- Submission (587)"
```

### Gaming

```
"Open gaming ports:
- Minecraft: 25565
- Steam: 27015-27030
- PlayStation: Various
- Xbox Live: 3074"
```

### VoIP/Video

```
"Allow VoIP traffic:
- SIP: 5060-5061
- RTP: 10000-20000
- Teams/Zoom: Specific ranges"
```

## Troubleshooting Rules

### Rule Not Working

Check these issues:

```
"Diagnose firewall rule:
1. Check rule order
2. Verify interface selection
3. Confirm source/destination
4. Check protocol/port
5. Review logs"
```

### Traffic Still Blocked

```
"If traffic is blocked:
- Check for conflicting rules
- Verify NAT if needed
- Check default deny
- Review floating rules
- Examine packet captures"
```

### Performance Issues

```
"Optimize firewall performance:
- Consolidate similar rules
- Use aliases for groups
- Minimize logging
- Review rule complexity"
```

## Logging and Monitoring

### Enable Logging

```
"Enable logging for security rules"
```

### View Logs

```
"Show firewall logs for blocked traffic"
```

```
"Display logs for specific rule"
```

### Log Analysis

```
"Analyze firewall logs:
- Top blocked IPs
- Most triggered rules
- Traffic patterns
- Security events"
```

## Best Practices

### 1. Principle of Least Privilege
- Default deny
- Only allow necessary
- Be specific

### 2. Rule Organization
- Group related rules
- Use descriptive names
- Add comments
- Keep rules simple

### 3. Security Layers
- Defense in depth
- Multiple checkpoints
- Fail secure
- Regular reviews

### 4. Documentation
- Document purpose
- Note dependencies
- Track changes
- Review regularly

## NAT and Port Forwarding

### Outbound NAT

Configure how LAN reaches internet:

```
"Set up outbound NAT for VLAN 50"
```

### Port Forwards

Expose internal services:

```
"Create port forward:
- External port: 8080
- Internal IP: 192.168.1.100
- Internal port: 80
- Protocol: TCP"
```

### 1:1 NAT

Map public IP to internal:

```
"Create 1:1 NAT:
- External: 203.0.113.10
- Internal: 192.168.1.50"
```

## GeoIP Blocking

### Block Countries

```
"Block all traffic from China and Russia"
```

### Allow Specific Regions

```
"Only allow traffic from United States and Canada"
```

## Anti-Lockout Rules

Prevent locking yourself out:

```
"Ensure anti-lockout rule exists:
- Allow LAN to firewall GUI
- Allow SSH from management"
```

## Rule Templates

### Web Server Template

```yaml
Rules:
  - Allow HTTP from any to server
  - Allow HTTPS from any to server
  - Allow server to any for updates
  - Block server to LAN
  - Log all connections
```

### Database Server Template

```yaml
Rules:
  - Allow app servers to database port
  - Block internet to database
  - Allow database to specific update servers
  - Log all access attempts
```

### IoT Device Template

```yaml
Rules:
  - Allow IoT to specific cloud services
  - Block IoT to local networks
  - Allow local to IoT for management
  - Heavy logging
```

## Firewall Rule Testing

### Test Connectivity

```
"Test if port 443 is open to 192.168.1.100"
```

### Simulate Traffic

```
"Simulate connection from WAN to LAN port 22"
```

### Packet Capture

```
"Capture packets matching firewall rule for debugging"
```

## Integration with IaC

### Current State

Manual rule creation:
```
"Create each rule individually"
```

### Future IaC Vision

Declarative firewall policies:
```yaml
firewall_policies:
  web_server:
    - allow: 
        from: internet
        to: web_servers
        ports: [80, 443]
    - block:
        from: web_servers
        to: internal_network
```

## Common Issues and Solutions

### Issue: Can't Access Service

Solution:
```
"Check:
1. Firewall rule exists and is enabled
2. Rule is on correct interface
3. Source/destination are correct
4. NAT/Port forward if from WAN
5. Service is actually running"
```

### Issue: Unwanted Traffic

Solution:
```
"Block unwanted traffic:
1. Identify source IPs
2. Create block rule
3. Place before allow rules
4. Enable logging
5. Monitor effectiveness"
```

## API Reference

### Rule Management
- `createFirewallRule` - Add new rule
- `listFirewallRules` - Show rules
- `updateFirewallRule` - Modify rule
- `deleteFirewallRule` - Remove rule

### Related Tools
- `createAlias` - Group IPs/ports
- `enableLogging` - Turn on logs
- `showFirewallLogs` - View logs

## Next Steps

- Learn about [NAT Configuration](../deployment/production.md#nat)
- Explore [VPN Setup](../deployment/production.md#vpn)
- Read about [Security Best Practices](../deployment/production.md#security)

## Related Documentation

- [VLAN Management](vlan-management.md) - Network segmentation
- [IaC Patterns](../iac/patterns.md#firewall-policies)
- [Troubleshooting](../troubleshooting/common-issues.md)