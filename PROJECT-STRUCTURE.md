# OPNSense MCP Server Project Structure

## Phase 1 Implementation (Resource Model) - COMPLETE ✅

```
OPNSenseMCP/
├── src/
│   ├── index.ts                    # Main MCP server (refactored for resources)
│   ├── resources/                  # Resource model implementation
│   │   ├── base.ts                # Abstract Resource class & helpers
│   │   ├── registry.ts            # Resource registry & dependency management
│   │   ├── firewall/
│   │   │   ├── rule.ts           # Firewall rule resource
│   │   │   └── alias.ts          # Firewall alias resource
│   │   ├── network/
│   │   │   ├── vlan.ts           # VLAN resource
│   │   │   └── interface.ts      # Interface resource
│   │   └── services/
│   │       ├── haproxy/
│   │       │   ├── backend.ts    # HAProxy backend resource
│   │       │   ├── server.ts     # HAProxy server resource
│   │       │   └── frontend.ts   # HAProxy frontend resource
│   │       ├── dns/
│   │       │   └── override.ts   # DNS override resource
│   │       └── dhcp/
│   │           ├── range.ts      # DHCP range resource
│   │           └── static.ts     # DHCP static mapping resource
│   ├── state/
│   │   └── store.ts              # State persistence & checkpoints
│   └── test-resources.ts         # Resource model test suite
│
├── examples/
│   ├── phase1-resource-examples.md # Resource usage examples
│   └── claude-desktop-config.json  # Claude desktop configuration
│
├── roadmap/                       # Project roadmap & vision
│   ├── README.md                 # Roadmap index
│   ├── EXECUTIVE-SUMMARY.md      # High-level vision
│   ├── 00-ARCHITECTURE-OVERVIEW.md
│   ├── 01-RESOURCE-MODEL.md      # Phase 1 details
│   ├── 02-DEPLOYMENT-PLANNING.md # Phase 2 preview
│   ├── 03-EXECUTION-ENGINE.md    # Phase 3 preview
│   ├── 04-MULTI-MCP-INTEGRATION.md # Phase 4 preview
│   └── REAL-WORLD-EXAMPLE.md
│
├── dist/                         # Compiled JavaScript
│   └── index.js
│
├── state/                        # Deployment state files (created at runtime)
│   └── *.json                   # Individual deployment states
│
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── build.bat                     # Windows build script
├── PHASE1-COMPLETE.md           # Phase 1 summary
└── README.md                     # Project documentation
```

## Key Components

### Resource Model (`src/resources/`)
- **Base Class**: Abstract resource with validation, state, and metadata
- **Registry**: Manages resource types and instances
- **Concrete Resources**: 10 resource types covering firewall, network, and services

### State Management (`src/state/`)
- **State Store**: Persistent storage for deployments
- **Checkpoints**: Save and restore deployment states
- **Versioning**: Track changes over time

### MCP Tools (Resource-Based)
1. **configure** - Set up OPNSense connection
2. **validateResources** - Validate resource configurations
3. **planDeployment** - Create deployment plan with dependency resolution
4. **applyDeployment** - Execute deployment plan
5. **getDeploymentState** - Query current state
6. **listResourceTypes** - Show available resources
7. **createCheckpoint** - Save current state
8. **rollback** - Restore to previous state

## Resource Types

### Network
- `opnsense:network:vlan` - VLAN configuration
- `opnsense:network:interface` - Interface configuration

### Firewall
- `opnsense:firewall:rule` - Firewall rules
- `opnsense:firewall:alias` - IP/Port aliases

### Services
- `opnsense:service:haproxy:backend` - HAProxy backend pools
- `opnsense:service:haproxy:server` - HAProxy servers
- `opnsense:service:haproxy:frontend` - HAProxy frontends
- `opnsense:service:dns:override` - DNS host overrides
- `opnsense:service:dhcp:range` - DHCP ranges
- `opnsense:service:dhcp:static` - DHCP static mappings

## Next Steps (Phase 2-4)

### Phase 2: Planning Engine
- [ ] State diffing engine
- [ ] Change detection
- [ ] Impact analysis
- [ ] Human-readable plans

### Phase 3: Execution Engine
- [ ] Parallel execution
- [ ] Progress tracking
- [ ] Error recovery
- [ ] Advanced rollback

### Phase 4: Multi-MCP Integration
- [ ] Cross-server references
- [ ] Unified orchestrator
- [ ] Policy engine
- [ ] Pattern library

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm run test

# Start MCP server
npm start
```

## Configuration

Create `.env` file:
```env
OPNSENSE_HOST=https://192.168.1.1
OPNSENSE_API_KEY=your-api-key
OPNSENSE_API_SECRET=your-api-secret
OPNSENSE_VERIFY_SSL=false
```

## Claude Desktop Integration

Add to Claude desktop config:
```json
{
  "opnsense": {
    "command": "node",
    "args": ["C:\\path\\to\\OPNSenseMCP\\dist\\index.js"],
    "env": {
      "OPNSENSE_HOST": "https://192.168.1.1",
      "OPNSENSE_API_KEY": "your-key",
      "OPNSENSE_API_SECRET": "your-secret"
    }
  }
}
```
