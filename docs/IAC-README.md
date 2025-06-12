# OPNSense MCP Infrastructure as Code (IaC)

## Overview

The OPNSense MCP Server now supports Infrastructure as Code (IaC) capabilities, allowing you to define and manage your OPNSense configuration using declarative code similar to Pulumi or SST.

## Key Features

- **Declarative Configuration**: Define your network infrastructure in code
- **State Management**: Track resource state with automatic rollback capabilities
- **Dependency Resolution**: Automatic ordering of resource creation/deletion
- **Plan/Apply Workflow**: Preview changes before applying them
- **Resource Types**: Support for VLANs, interfaces, firewall rules, HAProxy, DHCP, DNS, and more
- **Generative AI Ready**: Designed to work with AI-powered infrastructure generation

## Quick Start

### 1. Enable IaC Features

Set the following environment variables:

```bash
export IAC_ENABLED=true
export OPNSENSE_HOST=https://your-opnsense-host
export OPNSENSE_API_KEY=your-api-key
export OPNSENSE_API_SECRET=your-api-secret
```

### 2. Fix and Build

```powershell
# Run the fix and build script
.\fix-and-build-phase45.ps1
```

### 3. Start the Server

```bash
npm start
```

### 4. Use with MCP Client

```javascript
// Connect to the MCP server
const client = createMCPClient({
  server: 'opnsense-mcp',
  transport: 'stdio'
});

// Define infrastructure
const infrastructure = {
  name: "my-network",
  resources: [
    {
      type: "opnsense:network:vlan",
      id: "guest-vlan",
      name: "Guest Network",
      properties: {
        tag: 100,
        device: "igc0",
        description: "Guest WiFi"
      }
    }
  ]
};

// Plan deployment
const plan = await client.call('iac_plan_deployment', {
  ...infrastructure,
  dryRun: true
});

// Apply deployment
const result = await client.call('iac_apply_deployment', {
  planId: plan.id,
  autoApprove: true
});
```

## Resource Types

### Network Resources

- `opnsense:network:vlan` - VLAN configuration
- `opnsense:network:interface` - Network interface configuration

### Firewall Resources

- `opnsense:firewall:rule` - Firewall rules
- `opnsense:firewall:alias` - Firewall aliases

### Service Resources

- `opnsense:service:dhcp:range` - DHCP ranges
- `opnsense:service:dhcp:static` - Static DHCP mappings
- `opnsense:service:dns:override` - DNS overrides
- `opnsense:service:dns:blocklist` - DNS blocklist entries
- `opnsense:service:haproxy:backend` - HAProxy backends
- `opnsense:service:haproxy:frontend` - HAProxy frontends
- `opnsense:service:haproxy:server` - HAProxy servers

## IaC Tools

### iac_plan_deployment

Plans infrastructure changes without applying them.

```typescript
{
  name: string,           // Deployment name
  resources: Resource[],  // Resources to deploy
  dryRun: boolean        // Preview mode (default: true)
}
```

### iac_apply_deployment

Applies a deployment plan.

```typescript
{
  planId: string,        // Plan ID from plan_deployment
  autoApprove: boolean   // Skip confirmation (default: false)
}
```

### iac_destroy_deployment

Destroys deployed resources.

```typescript
{
  deploymentId: string,  // Deployment to destroy
  force: boolean        // Force destruction (default: false)
}
```

### iac_list_resource_types

Lists available resource types.

```typescript
{
  category?: string     // Filter by category (network, firewall, services)
}
```

## State Management

The IaC system maintains state in the `./state` directory by default. Each deployment has its own state file tracking:

- Resource properties
- Resource outputs
- Dependencies
- Metadata (creation time, version, etc.)

## Dependency Resolution

Resources can declare dependencies:

```javascript
{
  type: "opnsense:firewall:rule",
  id: "guest-internet",
  name: "Allow Guest Internet",
  properties: { /* ... */ },
  dependencies: ["guest-vlan"]  // Will be created after guest-vlan
}
```

## AI Integration

The IaC system is designed to work with generative AI:

1. **Schema Validation**: All resources have Zod schemas for validation
2. **Type Safety**: Full TypeScript support for resource definitions
3. **Error Handling**: Clear error messages for AI to understand
4. **Idempotency**: Resources can be applied multiple times safely

## Example: AI-Generated Network

```javascript
// AI can generate infrastructure like this
const aiGeneratedNetwork = {
  name: "smart-home-network",
  resources: [
    // Main networks
    ...generateVLANs(['guest', 'iot', 'cameras', 'servers']),
    
    // Security rules
    ...generateSecurityPolicy({
      allowGuestInternet: true,
      blockInterVLAN: true,
      allowManagementFrom: ['192.168.1.0/24']
    }),
    
    // Services
    ...generateDHCPConfig({
      networks: ['guest', 'iot', 'cameras']
    })
  ]
};
```

## Roadmap

- [ ] Terraform provider compatibility
- [ ] Pulumi provider wrapper
- [ ] SST component integration
- [ ] GitOps workflow support
- [ ] Multi-site deployments
- [ ] Resource drift detection
- [ ] Cost estimation (power usage)

## Troubleshooting

### Build Errors

Run the fix script:
```bash
node fix-phase45-build-errors.mjs
```

### State Issues

Check state directory permissions:
```bash
ls -la ./state
```

### API Connection

Test connection:
```bash
curl -k https://your-opnsense/api/core/system/status \
  -u "api-key:api-secret"
```

## Contributing

The IaC system is modular and extensible. To add new resource types:

1. Create resource class in `src/resources/`
2. Implement required abstract methods
3. Register in `src/resources/registry.ts`
4. Add to resource type list

## License

MIT License - See LICENSE file for details.
