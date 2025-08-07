# Infrastructure as Code Overview

Deploy and manage your entire network infrastructure through declarative configurations and natural language.

## What is Infrastructure as Code?

Infrastructure as Code (IaC) treats infrastructure configuration as software code:
- **Declarative**: Describe what you want, not how to build it
- **Version Controlled**: Track all changes in Git
- **Reproducible**: Deploy identical environments
- **Automated**: No manual configuration needed

## Vision

Transform infrastructure management from manual configuration to intelligent automation where you can say:

```
"Deploy a secure web application with load balancing and automatic SSL"
```

And the system will:
1. Create necessary VLANs
2. Configure firewall rules
3. Set up load balancer
4. Deploy application containers
5. Configure DNS records
6. Provision SSL certificates

## Current Capabilities

### Supported Resources

The OPNSense MCP currently supports IaC for:

**Network Resources:**
- VLANs and interfaces
- Static routes
- ARP entries

**Firewall Resources:**
- Firewall rules
- NAT configurations
- Aliases and groups

**Services:**
- DHCP configuration
- DNS blocking
- HAProxy load balancing

### Basic Usage

Define infrastructure in JSON/YAML:

```json
{
  "name": "web-application",
  "resources": [
    {
      "type": "opnsense:network:vlan",
      "id": "web-vlan",
      "properties": {
        "interface": "igc3",
        "tag": 30,
        "description": "Web servers"
      }
    },
    {
      "type": "opnsense:firewall:rule",
      "id": "allow-https",
      "properties": {
        "interface": "wan",
        "action": "pass",
        "protocol": "tcp",
        "destination": "${web-vlan.subnet}",
        "port": 443
      }
    }
  ]
}
```

Deploy with:
```
"Apply the web-application infrastructure configuration"
```

## Core Concepts

### Resources

Every infrastructure component is a Resource:
- Has a unique identifier
- Belongs to a type (e.g., `opnsense:network:vlan`)
- Contains properties
- Produces outputs
- Tracks state

### Resource Lifecycle

```
Define → Validate → Plan → Execute → State
   ↓        ↓         ↓        ↓        ↓
Config    Schema    Diff     API    Database
```

### Dependencies

Resources can depend on others:

```yaml
resources:
  - id: database-vlan
    type: opnsense:network:vlan
    properties:
      tag: 40
      
  - id: database-dhcp
    type: opnsense:services:dhcp
    depends_on: [database-vlan]
    properties:
      interface: "${database-vlan.interface}"
      range: "${database-vlan.subnet}"
```

### State Management

IaC tracks infrastructure state:
- Current state in OPNsense
- Desired state in configuration
- Differences trigger updates
- History enables rollback

## Benefits

### Consistency
- Same configuration every time
- No configuration drift
- Standardized patterns

### Speed
- Deploy complex setups in minutes
- Parallel resource creation
- Automated dependency resolution

### Safety
- Preview changes before applying
- Automatic rollback on failure
- State locking prevents conflicts

### Documentation
- Infrastructure is self-documenting
- Changes tracked in version control
- Clear audit trail

## How It Works

### 1. Resource Definition

Define what you want:

```typescript
const guestNetwork = {
  type: "opnsense:network:vlan",
  id: "guest-vlan",
  properties: {
    interface: "igc3",
    tag: 50,
    subnet: "192.168.50.0/24",
    description: "Guest WiFi Network"
  }
};
```

### 2. Validation

System validates configuration:
- Schema validation
- Dependency checking
- Conflict detection
- Permission verification

### 3. Planning

Generate execution plan:

```
Plan: 3 to add, 1 to change, 0 to destroy

+ opnsense:network:vlan.guest-vlan
  + interface: igc3
  + tag: 50
  + subnet: 192.168.50.0/24

+ opnsense:services:dhcp.guest-dhcp
  + interface: guest-vlan
  + range: 192.168.50.100-200

~ opnsense:firewall:rule.guest-isolation
  ~ source: any → guest-vlan
```

### 4. Execution

Apply changes:
- Creates resources in dependency order
- Updates existing resources
- Handles errors gracefully
- Supports dry-run mode

### 5. State Tracking

Maintain state database:
- Resource configurations
- Relationships
- Outputs
- History

## Real-World Example

### Minecraft Server Deployment

Natural language request:
```
"Deploy a Minecraft server on a dedicated VLAN with proper firewall rules"
```

Translates to IaC:

```yaml
name: minecraft-server
resources:
  # Network isolation
  - type: opnsense:network:vlan
    id: gaming-vlan
    properties:
      interface: igc3
      tag: 100
      subnet: 192.168.100.0/24
      description: Gaming servers
  
  # DHCP for the VLAN
  - type: opnsense:services:dhcp
    id: gaming-dhcp
    properties:
      interface: "${gaming-vlan.interface}"
      range: 192.168.100.100-150
      static_mappings:
        - mac: "aa:bb:cc:dd:ee:ff"
          ip: 192.168.100.10
          hostname: minecraft-server
  
  # Firewall rules
  - type: opnsense:firewall:rule
    id: minecraft-inbound
    properties:
      interface: wan
      action: pass
      protocol: tcp/udp
      destination: 192.168.100.10
      port: 25565
      description: Minecraft server access
  
  - type: opnsense:firewall:rule
    id: gaming-isolation
    properties:
      interface: "${gaming-vlan.interface}"
      action: block
      source: "${gaming-vlan.subnet}"
      destination: lan_net
      description: Isolate gaming from LAN
  
  # Port forwarding
  - type: opnsense:firewall:nat
    id: minecraft-nat
    properties:
      interface: wan
      protocol: tcp/udp
      source_port: 25565
      destination: 192.168.100.10
      destination_port: 25565
```

## Patterns Library

Common infrastructure patterns ready to deploy:

### Secure Guest Network
```
"Deploy standard guest network pattern"
```
- Isolated VLAN
- Internet only access
- Rate limiting
- Captive portal

### DMZ Web Services
```
"Set up DMZ for public services"
```
- DMZ VLAN
- Reverse proxy
- SSL termination
- Security rules

### IoT Isolation
```
"Create IoT network with restrictions"
```
- IoT VLAN
- Limited access
- DNS filtering
- Monitoring

## Future Vision

### Multi-MCP Orchestration

Coordinate across multiple MCP servers:

```
"Deploy WordPress with high availability"

→ OPNSense MCP: Creates VLANs, firewall rules
→ Docker MCP: Deploys containers
→ Database MCP: Sets up MySQL cluster
→ DNS MCP: Configures records
→ Certificate MCP: Provisions SSL
```

### GitOps Integration

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  deploy:
    steps:
      - uses: opnsense-mcp/deploy-action@v1
        with:
          config: infrastructure/production.yaml
          environment: production
```

### Policy Engine

Define organization policies:

```yaml
policies:
  security:
    - require_encryption: true
    - block_countries: [CN, RU]
    - enforce_segmentation: true
  
  compliance:
    - log_retention: 90_days
    - audit_changes: true
    - require_approval: true
```

## Getting Started

1. **Enable IaC mode**:
   ```env
   IAC_ENABLED=true
   ```

2. **Create your first resource**:
   ```json
   {
     "type": "opnsense:network:vlan",
     "id": "my-first-vlan",
     "properties": {
       "interface": "igc3",
       "tag": 200
     }
   }
   ```

3. **Deploy it**:
   ```
   "Deploy my-first-vlan resource"
   ```

## Best Practices

### 1. Start Small
- Begin with simple resources
- Test in lab environment
- Build complexity gradually

### 2. Use Patterns
- Leverage proven patterns
- Customize for your needs
- Share with community

### 3. Version Control
- Store configs in Git
- Use meaningful commits
- Tag stable versions

### 4. Test Changes
- Always preview plans
- Use dry-run mode
- Have rollback ready

## Next Steps

- [Resource Model](resource-model.md) - Deep dive into resources
- [Deployment Guide](deployment.md) - Planning and execution
- [Patterns](patterns.md) - Reusable configurations
- [Examples](examples/) - Complete configurations

## Related Documentation

- [Getting Started](../getting-started/)
- [API Reference](../api-reference/)
- [Troubleshooting](../troubleshooting/)