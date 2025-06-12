# OPNSense MCP - IaC Architecture Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Desktop                           │
│                   (Natural Language Interface)                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ MCP Protocol
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OPNSense MCP Server                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Traditional  │  │     IaC      │  │   Multi-MCP        │   │
│  │   Tools      │  │    Tools     │  │  Orchestration     │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘   │
│         │                  │                    │ (Future)      │
│         ▼                  ▼                    ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Resource Layer                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Resources    Registry    Base Classes    State Mgmt    │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Deployment Engine                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │   Planner    Executor    Rollback    Progress Tracking  │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Infrastructure Layer                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  API Client   Cache Layer   Backup Manager   Audit DB   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS API
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OPNSense Firewall                          │
└─────────────────────────────────────────────────────────────────┘
```

## Resource Model Flow

```
Define Resource → Validate → Plan → Execute → Update State
       │              │        │        │           │
       ▼              ▼        ▼        ▼           ▼
   Properties     Schema    Diff    API Call    Persist
                           Engine              to Storage
```

## Deployment Planning Process

```
┌─────────────────┐     ┌─────────────────┐
│ Desired State   │     │ Current State   │
│   (Resources)   │     │  (From Store)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │  Diff Engine    │
            │ (Calculate Δ)   │
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │   Dependency    │
            │   Resolution    │
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │ Execution Waves │
            │  (Parallel)     │
            └────────┬────────┘
                     ▼
            ┌─────────────────┐
            │ Deployment Plan │
            └─────────────────┘
```

## Execution Flow with Rollback

```
Start → Wave 1 → Wave 2 → Wave 3 → Complete
  │        │        │        │         │
  │        ▼        ▼        ▼         ▼
  │    Execute   Execute   Error!   Success
  │    Changes   Changes     │
  │                         ▼
  │                    Rollback
  │                    Wave 2 ←─┐
  │                    Wave 1   │
  │                       │     │
  └───────────────────────┴─────┘
         (Checkpoint Restore)
```

## Multi-MCP Future Architecture

```
                    Claude Desktop
                         │
                         ▼
                ┌─────────────────┐
                │ MCP Orchestrator│
                └────────┬────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ OPNSense │    │   AWS    │    │ K8s MCP  │
  │   MCP    │    │   MCP    │    │          │
  └──────────┘    └──────────┘    └──────────┘
        │                │                │
        ▼                ▼                ▼
   Firewall,         EC2, S3,        Deployments,
   Network,          Lambda,         Services,
   Services          RDS              Pods
```

## State Management

```
┌─────────────────────────────────────────────┐
│              State Store                    │
├─────────────────────────────────────────────┤
│  Deployments  │  Resources  │  History     │
│  ┌─────────┐  │  ┌────────┐ │  ┌────────┐ │
│  │ Deploy1 │  │  │ VLAN1  │ │  │ v1→v2  │ │
│  │ Deploy2 │  │  │ Rule1  │ │  │ v2→v3  │ │
│  │ Deploy3 │  │  │ HAP1   │ │  │ v3→v4  │ │
│  └─────────┘  │  └────────┘ │  └────────┘ │
└─────────────────────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ Lock Manager │
              └──────────────┘
```

## Resource Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ PENDING  │───▶│ CREATING │───▶│ CREATED  │───▶│ UPDATING │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                      │                               │
                      ▼                               ▼
                ┌──────────┐                    ┌──────────┐
                │  FAILED  │                    │ DELETING │
                └──────────┘                    └──────────┘
                                                      │
                                                      ▼
                                                ┌──────────┐
                                                │ DELETED  │
                                                └──────────┘
```

## Directory Structure Overview

```
OPNSenseMCP/
├── src/
│   ├── resources/        # Resource definitions
│   ├── deployment/       # Planning logic
│   ├── execution/        # Execution engine
│   ├── state/           # State management
│   ├── integration/     # Multi-MCP (future)
│   └── policies/        # Policy engine (future)
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   ├── debug/          # Debug utilities
│   └── manual/         # Manual test scripts
├── scripts/
│   ├── build/          # Build automation
│   ├── setup/          # Setup utilities
│   └── test/           # Test runners
└── docs/
    ├── getting-started/
    ├── phases/
    ├── api/
    └── troubleshooting/
```

This architecture provides:
- **Modularity**: Each component has a single responsibility
- **Extensibility**: Easy to add new resource types
- **Reliability**: Rollback and state management
- **Scalability**: Ready for multi-MCP orchestration
