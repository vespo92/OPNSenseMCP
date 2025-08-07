# OPNSense MCP Project Structure

## Expected folder structure after implementing all phases:

```
OPNSenseMCP/
├── src/
│   ├── index.ts                    # Main MCP server entry point
│   │
│   ├── resources/                  # Resource definitions (Phase 1)
│   │   ├── base.ts                # Base Resource class
│   │   ├── registry.ts            # Resource registry
│   │   ├── firewall/
│   │   │   ├── rule.ts            # FirewallRule resource
│   │   │   ├── alias.ts           # FirewallAlias resource
│   │   │   └── nat.ts             # NatRule resource
│   │   ├── network/
│   │   │   ├── vlan.ts            # Vlan resource
│   │   │   ├── interface.ts       # Interface resource
│   │   │   └── route.ts           # Route resource
│   │   ├── services/
│   │   │   ├── haproxy/
│   │   │   │   ├── backend.ts     # HaproxyBackend resource
│   │   │   │   ├── frontend.ts    # HaproxyFrontend resource
│   │   │   │   └── server.ts      # HaproxyServer resource
│   │   │   ├── dns/
│   │   │   │   ├── override.ts    # DnsOverride resource
│   │   │   │   └── domain.ts      # DnsDomain resource
│   │   │   └── dhcp/
│   │   │       ├── range.ts       # DhcpRange resource
│   │   │       └── static.ts      # DhcpStaticMapping resource
│   │   └── security/
│   │       ├── certificate.ts     # Certificate resource
│   │       └── user.ts            # User resource
│   │
│   ├── deployment/                 # Deployment planning (Phase 2)
│   │   ├── planner.ts             # Main deployment planner
│   │   ├── state-reader.ts        # Read current OPNSense state
│   │   ├── diff.ts                # Diff engine
│   │   ├── dependencies.ts        # Dependency resolver
│   │   └── visualizer.ts          # Plan visualization
│   │
│   ├── execution/                  # Execution engine (Phase 3)
│   │   ├── engine.ts              # Main execution engine
│   │   ├── operations.ts          # Resource CRUD operations
│   │   ├── progress.ts            # Progress tracking
│   │   ├── rollback.ts            # Rollback mechanisms
│   │   └── checkpoint.ts          # Checkpoint management
│   │
│   ├── state/                      # State management
│   │   ├── store.ts               # State storage interface
│   │   ├── persistence.ts         # File-based persistence
│   │   └── models.ts              # State data models
│   │
│   ├── integration/                # Multi-MCP integration (Phase 4)
│   │   ├── orchestrator.ts        # Multi-MCP orchestrator
│   │   ├── references.ts          # Cross-MCP references
│   │   ├── protocol.ts            # MCP communication protocol
│   │   └── patterns/              # Deployment patterns
│   │       ├── base.ts            # Base pattern class
│   │       ├── web-app.ts         # Load-balanced web app
│   │       ├── three-tier.ts      # Three-tier architecture
│   │       └── microservices.ts   # Microservices pattern
│   │
│   ├── policies/                   # Policy engine (Phase 4)
│   │   ├── engine.ts              # Policy evaluation engine
│   │   ├── security.ts            # Security policies
│   │   ├── compliance.ts          # Compliance policies
│   │   └── cost.ts                # Cost optimization policies
│   │
│   ├── client/                     # OPNSense API client
│   │   ├── client.ts              # Main API client
│   │   ├── auth.ts                # Authentication
│   │   └── errors.ts              # Error handling
│   │
│   └── utils/                      # Utility functions
│       ├── logger.ts              # Logging utility
│       ├── validators.ts          # Input validators
│       └── helpers.ts             # Helper functions
│
├── test/                           # Test files
│   ├── unit/                      # Unit tests
│   │   ├── resources/             # Resource tests
│   │   ├── deployment/            # Planner tests
│   │   └── execution/             # Engine tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
│
├── examples/                       # Example deployments
│   ├── simple-firewall.yaml       # Basic firewall rules
│   ├── web-app.yaml               # Web application
│   ├── enterprise.yaml            # Enterprise deployment
│   └── test-environment.ts        # Test environment setup
│
├── state/                          # State storage (gitignored)
│   ├── deployments/               # Deployment states
│   └── checkpoints/               # Checkpoints
│
├── docs/                           # Documentation
│   ├── api/                       # API documentation
│   ├── resources/                 # Resource documentation
│   └── patterns/                  # Pattern documentation
│
├── scripts/                        # Utility scripts
│   ├── discover-endpoints.js      # API endpoint discovery
│   ├── test-connection.js         # Test OPNSense connection
│   └── generate-docs.js           # Generate documentation
│
├── roadmap/                        # Project roadmap
│   ├── README.md                  # Roadmap index
│   ├── EXECUTIVE-SUMMARY.md       # Project vision
│   ├── 00-ARCHITECTURE-OVERVIEW.md
│   ├── 01-RESOURCE-MODEL.md
│   ├── 02-DEPLOYMENT-PLANNING.md
│   ├── 03-EXECUTION-ENGINE.md
│   ├── 04-MULTI-MCP-INTEGRATION.md
│   └── REAL-WORLD-EXAMPLE.md
│
├── .env.example                    # Environment variables template
├── .env                           # Environment variables (gitignored)
├── .gitignore                     # Git ignore file
├── package.json                   # NPM package file
├── tsconfig.json                  # TypeScript configuration
├── README.md                      # Project readme
├── LICENSE                        # License file
└── CHANGELOG.md                   # Version history
```

## Key Directories Explained

### `/src/resources/`
Contains all resource definitions. Each resource type has its own file with:
- Property definitions
- Validation logic
- API payload transformation
- State management

### `/src/deployment/`
Planning engine that:
- Reads current infrastructure state
- Calculates differences
- Resolves dependencies
- Generates execution plans

### `/src/execution/`
Execution engine that:
- Applies changes in correct order
- Tracks progress
- Handles errors
- Performs rollbacks

### `/src/integration/`
Multi-MCP coordination:
- Cross-server references
- Unified orchestration
- Deployment patterns
- Communication protocols

### `/src/policies/`
Policy enforcement:
- Security best practices
- Compliance requirements
- Cost optimization
- Resource naming

### `/state/`
Persistent state storage:
- Current deployment states
- Historical checkpoints
- Plan history
- Rollback data

### `/examples/`
Ready-to-use examples:
- Common scenarios
- Best practices
- Testing setups
- Pattern demonstrations

## Development Workflow

1. **Resource Development**
   - Define new resource in `/src/resources/`
   - Add tests in `/test/unit/resources/`
   - Document in `/docs/resources/`

2. **Pattern Development**
   - Create pattern in `/src/integration/patterns/`
   - Add example in `/examples/`
   - Document in `/docs/patterns/`

3. **Testing**
   - Unit tests for individual components
   - Integration tests for workflows
   - E2E tests for complete deployments

4. **Documentation**
   - API docs auto-generated from TypeScript
   - Resource docs include examples
   - Pattern docs show use cases

This structure supports:
- **Modularity**: Easy to add new resources
- **Testability**: Clear separation of concerns
- **Scalability**: Ready for multiple MCP servers
- **Maintainability**: Well-organized code
