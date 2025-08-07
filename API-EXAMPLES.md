# API Usage Examples - OPNSense MCP Server

## 📚 Table of Contents
- [Getting Started](#getting-started)
- [VLAN Management](#vlan-management)
- [Firewall Rules](#firewall-rules)
- [DHCP Operations](#dhcp-operations)
- [DNS Filtering](#dns-filtering)
- [HAProxy Configuration](#haproxy-configuration)
- [Infrastructure as Code](#infrastructure-as-code)
- [Backup & Restore](#backup--restore)
- [Macro Recording](#macro-recording)
- [Advanced Patterns](#advanced-patterns)

## 🚀 Getting Started

### Basic Connection
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Initialize MCP client
const transport = new StdioClientTransport({
  command: 'node',
  args: ['path/to/opnsense-mcp/dist/index.js'],
  env: {
    OPNSENSE_HOST: 'https://192.168.1.1',
    OPNSENSE_API_KEY: 'your-api-key',
    OPNSENSE_API_SECRET: 'your-api-secret'
  }
});

const client = new Client({
  name: 'opnsense-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);
```

### Tool Discovery
```typescript
// List all available tools
const tools = await client.listTools();
console.log('Available tools:', tools.tools.map(t => t.name));

// Get tool details
const vlanTool = tools.tools.find(t => t.name === 'opnsense_vlan_create');
console.log('VLAN tool schema:', vlanTool.inputSchema);
```

## 🔌 VLAN Management

### List All VLANs
```typescript
const result = await client.callTool({
  name: 'opnsense_vlan_list',
  arguments: {}
});

console.log('VLANs:', result.content);
// Output: [{ uuid: '...', tag: '100', if: 'igc1', descr: 'Guest Network' }]
```

### Create a VLAN
```typescript
// Basic VLAN creation
const createResult = await client.callTool({
  name: 'opnsense_vlan_create',
  arguments: {
    interface: 'igc1',
    tag: 100,
    description: 'Guest Network'
  }
});

console.log('Created VLAN:', createResult.content);
// Output: { success: true, uuid: 'abc-123', message: 'VLAN 100 created' }

// VLAN with priority
const priorityVlan = await client.callTool({
  name: 'opnsense_vlan_create',
  arguments: {
    interface: 'igc1',
    tag: 200,
    description: 'VoIP Network',
    pcp: 5  // Priority Code Point for QoS
  }
});
```

### Update a VLAN
```typescript
const updateResult = await client.callTool({
  name: 'opnsense_vlan_update',
  arguments: {
    uuid: 'abc-123',
    description: 'Updated Guest Network',
    pcp: 1
  }
});
```

### Delete a VLAN
```typescript
// Delete by UUID
const deleteResult = await client.callTool({
  name: 'opnsense_vlan_delete',
  arguments: {
    uuid: 'abc-123'
  }
});

// Delete by tag
const deleteByTag = await client.callTool({
  name: 'opnsense_vlan_delete',
  arguments: {
    tag: 100
  }
});
```

## 🔥 Firewall Rules

### List Firewall Rules
```typescript
const rules = await client.callTool({
  name: 'opnsense_firewall_list',
  arguments: {}
});

// Filter by interface
const lanRules = await client.callTool({
  name: 'opnsense_firewall_list',
  arguments: {
    interface: 'lan'
  }
});
```

### Create Firewall Rule
```typescript
// Allow HTTP/HTTPS from LAN to WAN
const webRule = await client.callTool({
  name: 'opnsense_firewall_create',
  arguments: {
    interface: 'lan',
    type: 'pass',
    ipprotocol: 'inet',
    protocol: 'tcp',
    source: 'lan',
    destination: 'any',
    destination_port: '80,443',
    description: 'Allow web traffic'
  }
});

// Block specific IP
const blockRule = await client.callTool({
  name: 'opnsense_firewall_create',
  arguments: {
    interface: 'wan',
    type: 'block',
    ipprotocol: 'inet',
    source: '192.168.1.100',
    destination: 'any',
    description: 'Block suspicious IP',
    log: true
  }
});

// Allow VLAN to VLAN communication
const vlanRule = await client.callTool({
  name: 'opnsense_firewall_create',
  arguments: {
    interface: 'opt1',  // VLAN interface
    type: 'pass',
    source: '10.10.10.0/24',
    destination: '10.10.20.0/24',
    description: 'Allow VLAN 100 to VLAN 200'
  }
});
```

### Update Firewall Rule
```typescript
const updateRule = await client.callTool({
  name: 'opnsense_firewall_update',
  arguments: {
    uuid: 'rule-uuid',
    disabled: true,  // Disable rule temporarily
    description: 'DISABLED - Under review'
  }
});
```

### Delete Firewall Rule
```typescript
const deleteRule = await client.callTool({
  name: 'opnsense_firewall_delete',
  arguments: {
    uuid: 'rule-uuid'
  }
});
```

### Apply Firewall Changes
```typescript
// Always apply after making changes
const applyResult = await client.callTool({
  name: 'opnsense_firewall_apply',
  arguments: {}
});
```

## 📡 DHCP Operations

### List DHCP Leases
```typescript
const leases = await client.callTool({
  name: 'opnsense_dhcp_leases_list',
  arguments: {}
});

console.log('Active leases:', leases.content);
// Output: [{ ip: '192.168.1.100', mac: 'aa:bb:cc:dd:ee:ff', hostname: 'laptop' }]
```

### Create Static DHCP Mapping
```typescript
const staticLease = await client.callTool({
  name: 'opnsense_dhcp_static_create',
  arguments: {
    mac: 'aa:bb:cc:dd:ee:ff',
    ipaddr: '192.168.1.50',
    hostname: 'printer',
    description: 'Office printer'
  }
});
```

### Delete DHCP Lease
```typescript
const deleteLease = await client.callTool({
  name: 'opnsense_dhcp_lease_delete',
  arguments: {
    ip: '192.168.1.100'
  }
});
```

## 🚫 DNS Filtering

### List DNS Blocklists
```typescript
const blocklists = await client.callTool({
  name: 'opnsense_dns_blocklist_list',
  arguments: {}
});
```

### Add Domains to Blocklist
```typescript
const addDomains = await client.callTool({
  name: 'opnsense_dns_blocklist_add',
  arguments: {
    domains: [
      'malicious-site.com',
      'phishing-example.net',
      'ads.tracker.com'
    ],
    description: 'Security blocklist'
  }
});
```

### Remove Domains from Blocklist
```typescript
const removeDomains = await client.callTool({
  name: 'opnsense_dns_blocklist_remove',
  arguments: {
    domains: ['false-positive.com']
  }
});
```

### Enable/Disable DNS Filtering
```typescript
const toggleFiltering = await client.callTool({
  name: 'opnsense_dns_filtering_toggle',
  arguments: {
    enabled: true
  }
});
```

## ⚖️ HAProxy Configuration

### List HAProxy Servers
```typescript
const servers = await client.callTool({
  name: 'opnsense_haproxy_servers_list',
  arguments: {}
});
```

### Create Backend Server
```typescript
const backend = await client.callTool({
  name: 'opnsense_haproxy_server_create',
  arguments: {
    name: 'web-server-1',
    address: '10.0.1.10',
    port: 80,
    checkport: 80,
    mode: 'active',
    description: 'Primary web server'
  }
});
```

### Create Frontend
```typescript
const frontend = await client.callTool({
  name: 'opnsense_haproxy_frontend_create',
  arguments: {
    name: 'web-frontend',
    bind: '0.0.0.0:443',
    ssl_enabled: true,
    ssl_certificates: ['cert-uuid'],
    default_backend: 'web-backend-pool'
  }
});
```

### Update Load Balancing
```typescript
const updateLB = await client.callTool({
  name: 'opnsense_haproxy_backend_update',
  arguments: {
    uuid: 'backend-uuid',
    balance: 'roundrobin',  // or 'leastconn', 'source'
    health_check_interval: 10
  }
});
```

## 🏗️ Infrastructure as Code

### Deploy Resources
```typescript
// Define infrastructure
const infrastructure = {
  resources: [
    {
      type: 'opnsense:network:vlan',
      id: 'guest-vlan',
      name: 'Guest Network VLAN',
      properties: {
        interface: 'igc1',
        tag: 100,
        description: 'Guest WiFi Network'
      }
    },
    {
      type: 'opnsense:firewall:rule',
      id: 'guest-isolation',
      name: 'Guest Isolation Rule',
      properties: {
        interface: 'opt1',
        type: 'block',
        source: '10.10.100.0/24',
        destination: 'lan',
        description: 'Isolate guest network from LAN'
      },
      dependencies: ['guest-vlan']
    }
  ]
};

const deployResult = await client.callTool({
  name: 'opnsense_iac_deploy',
  arguments: {
    configuration: infrastructure,
    planOnly: false  // Set to true for dry run
  }
});

console.log('Deployment plan:', deployResult.content.plan);
console.log('Applied changes:', deployResult.content.changes);
```

### Destroy Infrastructure
```typescript
const destroyResult = await client.callTool({
  name: 'opnsense_iac_destroy',
  arguments: {
    resourceIds: ['guest-vlan', 'guest-isolation'],
    force: false  // Set to true to skip confirmation
  }
});
```

### Get Current State
```typescript
const state = await client.callTool({
  name: 'opnsense_iac_state',
  arguments: {}
});

console.log('Managed resources:', state.content.resources);
console.log('Last applied:', state.content.lastApplied);
```

## 💾 Backup & Restore

### Create Backup
```typescript
const backup = await client.callTool({
  name: 'opnsense_backup_create',
  arguments: {
    description: 'Pre-upgrade backup',
    includeRRD: true,      // Include RRD data
    includeCaptivePortal: false,
    encrypt: true,
    password: 'backup-password'
  }
});

console.log('Backup created:', backup.content.filename);
```

### List Backups
```typescript
const backups = await client.callTool({
  name: 'opnsense_backup_list',
  arguments: {}
});

console.log('Available backups:', backups.content);
```

### Restore Backup
```typescript
const restore = await client.callTool({
  name: 'opnsense_backup_restore',
  arguments: {
    filename: 'config-2024-01-15.xml',
    password: 'backup-password',
    restoreRRD: true
  }
});
```

### Download Backup
```typescript
const download = await client.callTool({
  name: 'opnsense_backup_download',
  arguments: {
    filename: 'config-2024-01-15.xml',
    destination: '/local/path/backups/'
  }
});
```

## 🎬 Macro Recording

### Start Recording
```typescript
const startRecording = await client.callTool({
  name: 'opnsense_macro_start',
  arguments: {
    name: 'network-setup',
    description: 'Complete network configuration'
  }
});

// Perform operations while recording...
await client.callTool({
  name: 'opnsense_vlan_create',
  arguments: { interface: 'igc1', tag: 100 }
});

await client.callTool({
  name: 'opnsense_firewall_create',
  arguments: { /* ... */ }
});
```

### Stop Recording
```typescript
const stopRecording = await client.callTool({
  name: 'opnsense_macro_stop',
  arguments: {}
});

console.log('Macro saved:', stopRecording.content.macro);
```

### Replay Macro
```typescript
const replay = await client.callTool({
  name: 'opnsense_macro_replay',
  arguments: {
    name: 'network-setup',
    variables: {
      vlan_tag: 200,  // Override recorded values
      interface: 'igc2'
    }
  }
});
```

### List Macros
```typescript
const macros = await client.callTool({
  name: 'opnsense_macro_list',
  arguments: {}
});
```

## 🔧 Advanced Patterns

### Batch Operations
```typescript
// Create multiple VLANs efficiently
async function createVlanRange(startTag: number, endTag: number, interface: string) {
  const promises = [];
  
  for (let tag = startTag; tag <= endTag; tag++) {
    promises.push(
      client.callTool({
        name: 'opnsense_vlan_create',
        arguments: {
          interface,
          tag,
          description: `VLAN ${tag}`
        }
      })
    );
  }
  
  const results = await Promise.all(promises);
  
  // Apply all changes at once
  await client.callTool({
    name: 'opnsense_vlan_apply',
    arguments: {}
  });
  
  return results;
}

// Usage
const vlans = await createVlanRange(100, 110, 'igc1');
```

### Error Handling
```typescript
async function safeCreateVlan(config: VlanConfig) {
  try {
    const result = await client.callTool({
      name: 'opnsense_vlan_create',
      arguments: config
    });
    
    if (result.isError) {
      console.error('Tool error:', result.content);
      
      // Handle specific errors
      if (result.content.includes('already exists')) {
        console.log('VLAN already exists, updating instead...');
        return await client.callTool({
          name: 'opnsense_vlan_update',
          arguments: config
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Connection error:', error);
    // Implement retry logic
    await sleep(1000);
    return safeCreateVlan(config); // Retry
  }
}
```

### Transaction Pattern
```typescript
async function transactionalUpdate() {
  // Create backup before changes
  const backup = await client.callTool({
    name: 'opnsense_backup_create',
    arguments: {
      description: 'Pre-transaction backup'
    }
  });
  
  try {
    // Perform multiple operations
    await client.callTool({ /* operation 1 */ });
    await client.callTool({ /* operation 2 */ });
    await client.callTool({ /* operation 3 */ });
    
    // Apply all changes
    await client.callTool({
      name: 'opnsense_apply_all',
      arguments: {}
    });
    
    console.log('Transaction completed successfully');
  } catch (error) {
    console.error('Transaction failed, rolling back...');
    
    // Restore from backup
    await client.callTool({
      name: 'opnsense_backup_restore',
      arguments: {
        filename: backup.content.filename
      }
    });
    
    throw error;
  }
}
```

### Resource Monitoring
```typescript
async function monitorResource(resourceType: string, resourceId: string) {
  const interval = setInterval(async () => {
    const result = await client.callTool({
      name: `opnsense_${resourceType}_get`,
      arguments: { uuid: resourceId }
    });
    
    console.log(`Resource ${resourceId} status:`, result.content.status);
    
    if (result.content.status === 'error') {
      clearInterval(interval);
      // Take corrective action
      await handleResourceError(resourceType, resourceId);
    }
  }, 30000); // Check every 30 seconds
}
```

### Bulk Import
```typescript
async function importFromCSV(csvPath: string) {
  const csv = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCSV(csv);
  
  for (const row of rows) {
    await client.callTool({
      name: 'opnsense_firewall_create',
      arguments: {
        interface: row.interface,
        type: row.action,
        source: row.source,
        destination: row.destination,
        port: row.port,
        description: row.description
      }
    });
  }
  
  // Apply all rules
  await client.callTool({
    name: 'opnsense_firewall_apply',
    arguments: {}
  });
}
```

## 📝 Best Practices

### 1. Always Apply Changes
```typescript
// After any configuration change
await client.callTool({
  name: 'opnsense_apply_changes',
  arguments: {}
});
```

### 2. Use Descriptive Names
```typescript
// Good
arguments: {
  description: 'Allow HTTPS from Guest VLAN to Internet'
}

// Bad
arguments: {
  description: 'Rule 1'
}
```

### 3. Implement Idempotency
```typescript
async function ensureVlanExists(tag: number, interface: string) {
  // Check if exists
  const vlans = await client.callTool({
    name: 'opnsense_vlan_list',
    arguments: {}
  });
  
  const exists = vlans.content.find(v => v.tag === tag.toString());
  
  if (!exists) {
    return await client.callTool({
      name: 'opnsense_vlan_create',
      arguments: { tag, interface }
    });
  }
  
  return exists;
}
```

### 4. Handle Rate Limiting
```typescript
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent requests

async function bulkOperation(items: any[]) {
  return Promise.all(
    items.map(item => 
      limit(() => processItem(item))
    )
  );
}
```

### 5. Clean Up Resources
```typescript
// Always disconnect when done
process.on('SIGINT', async () => {
  await client.disconnect();
  process.exit(0);
});
```

---

*These examples demonstrate the full capabilities of the OPNSense MCP Server API. For more details, refer to the tool schemas and documentation.*