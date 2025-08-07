# OPNSense MCP Documentation Reorganization Roadmap

## 📋 Current State Assessment

### Major Issues Identified

#### 1. **Fragmentation & Duplication**
- Documentation scattered across 7+ directories
- 4 different README files with overlapping content
- Multiple competing architectural visions (roadmap/ vs implementation-plan/)
- Historical development artifacts mixed with current docs

#### 2. **Navigation Confusion**
- No clear entry point for new users
- Multiple "getting started" guides in different locations
- Phase-based documentation (phase1-4.5) unclear if current or historical

#### 3. **Content Organization Problems**
- User docs mixed with developer/internal planning docs
- Test scripts and batch files inside documentation folders
- Examples scattered across multiple directories
- No separation between API reference and guides

#### 4. **Maintenance Challenges**
- Outdated content in phase directories
- Multiple implementation summaries with unclear status
- Conflicting information between different doc sections

## 🎯 Proposed New Structure

```
OPNSenseMCP/
├── README.md                    # Streamlined, user-focused entry point
├── CONTRIBUTING.md              # Keep existing
├── LICENSE                      # Keep existing
├── CHANGELOG.md                 # Keep existing
│
├── docs/                        # All user-facing documentation
│   ├── README.md               # Documentation index/navigation
│   │
│   ├── getting-started/        # Quick start for new users
│   │   ├── installation.md    # Setup and configuration
│   │   ├── quickstart.md      # 5-minute tutorial
│   │   └── configuration.md   # Environment variables, Claude Desktop config
│   │
│   ├── guides/                 # Feature-specific guides
│   │   ├── vlan-management.md
│   │   ├── firewall-rules.md
│   │   ├── dns-blocking.md
│   │   ├── haproxy.md
│   │   ├── dhcp-management.md
│   │   ├── arp-tables.md
│   │   └── backup-restore.md
│   │
│   ├── iac/                    # Infrastructure as Code
│   │   ├── overview.md        # IaC concepts and benefits
│   │   ├── resource-model.md  # Resource types and properties
│   │   ├── deployment.md      # Planning and execution
│   │   ├── patterns.md        # Common deployment patterns
│   │   └── examples/          # IaC example configurations
│   │
│   ├── api-reference/          # Complete API documentation
│   │   ├── tools.md           # MCP tools reference
│   │   ├── resources.md       # Resource type reference
│   │   └── schemas.md         # JSON schemas
│   │
│   ├── deployment/             # Deployment options
│   │   ├── claude-desktop.md  # Claude Desktop setup
│   │   ├── sse-mode.md       # SSE server deployment
│   │   ├── docker.md          # Container deployment
│   │   └── production.md      # Production best practices
│   │
│   └── troubleshooting/        # Problem solving
│       ├── common-issues.md
│       ├── connection.md
│       ├── authentication.md
│       └── faq.md
│
├── examples/                    # Runnable examples
│   ├── basic/                 # Simple use cases
│   ├── advanced/              # Complex scenarios
│   └── patterns/              # IaC pattern examples
│
├── .archive/                   # Historical/outdated content
│   ├── phases/                # Old phase documentation
│   ├── implementation-plan/   # Original planning docs
│   └── roadmap/              # Original roadmap docs
│
└── .internal/                  # Developer/maintainer docs
    ├── architecture.md        # Technical architecture
    ├── development.md         # Development setup
    ├── testing.md            # Testing guidelines
    └── release-process.md    # Release procedures
```

## 📝 Content Migration Plan

### Phase 1: Structure Setup (Day 1)
- [ ] Create new directory structure
- [ ] Create placeholder files with proper headings
- [ ] Set up navigation in docs/README.md

### Phase 2: Content Consolidation (Days 2-3)
- [ ] **Main README.md**: Simplify to essentials (features, quick start, links)
- [ ] **Installation Guide**: Merge setup content from multiple sources
- [ ] **API Reference**: Consolidate all API documentation
- [ ] **Guides**: Extract and reorganize feature guides

### Phase 3: Content Migration (Days 4-5)
- [ ] Move user-facing content to docs/
- [ ] Archive historical phase documentation
- [ ] Consolidate examples into examples/
- [ ] Move internal docs to .internal/

### Phase 4: Cleanup (Day 6)
- [ ] Remove duplicate content
- [ ] Update all internal links
- [ ] Verify navigation works
- [ ] Test all code examples

### Phase 5: Enhancement (Day 7)
- [ ] Add missing documentation
- [ ] Create documentation style guide
- [ ] Set up documentation linting
- [ ] Add search functionality (if needed)

## 🔄 Content Mapping

### Files to Keep/Update
| Current Location | New Location | Action |
|-----------------|--------------|---------|
| README.md | README.md | Simplify, focus on quick start |
| docs/getting-started/SETUP-GUIDE.md | docs/getting-started/installation.md | Update and consolidate |
| docs/api/API-ENDPOINTS.md | docs/api-reference/tools.md | Reorganize by tool |
| docs/dns/*.md | docs/guides/dns-blocking.md | Consolidate into single guide |
| HAPROXY-IMPLEMENTATION-SUMMARY.md | docs/guides/haproxy.md | Convert to user guide |

### Files to Archive
| Current Location | Reason |
|-----------------|---------|
| docs/phases/* | Historical development artifacts |
| implementation-plan/* | Planning documents, not user-facing |
| roadmap/* | Original vision docs, superseded |
| *.bat files in docs | Test scripts don't belong in docs |
| backup/*.ts | Code files in wrong location |

### Files to Delete
| File | Reason |
|------|---------|
| Duplicate README files | Consolidate into single source |
| Old test results | Not documentation |
| Phase checklists | Development artifacts |

## 🎯 Success Criteria

### User Experience
- [ ] New user can get started in < 5 minutes
- [ ] Clear navigation path through documentation
- [ ] No conflicting information
- [ ] Examples that actually work

### Developer Experience
- [ ] Clear contribution guidelines
- [ ] Separation of user vs developer docs
- [ ] Easy to maintain and update
- [ ] Version-controlled documentation

### Documentation Quality
- [ ] Consistent formatting and style
- [ ] Up-to-date code examples
- [ ] Comprehensive API reference
- [ ] Troubleshooting covers common issues

## 📅 Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Structure & Migration | New directory structure, migrated content |
| Week 2 | Content Creation | Fill gaps, write missing guides |
| Week 3 | Review & Polish | Style consistency, link verification |
| Week 4 | Enhancement | Search, automation, templates |

## 🚀 Quick Wins (Do First)

1. **Simplify Main README** - Make it a clear entry point
2. **Create Single Installation Guide** - Consolidate all setup instructions
3. **Archive Phase Folders** - Remove confusion about what's current
4. **Fix Navigation** - Create clear docs/README.md with links
5. **Consolidate Examples** - One place for all examples

## 📊 Metrics for Success

- **Before**: 26+ documentation files across 7+ directories
- **After**: Organized hierarchy with clear navigation
- **Reduction**: 50% fewer duplicate files
- **Clarity**: Single source of truth for each topic
- **Findability**: Any topic reachable in 3 clicks or less

## 🔧 Maintenance Plan

### Weekly
- Review and update based on user feedback
- Check for broken links
- Update code examples if API changes

### Monthly
- Review documentation analytics (if available)
- Archive outdated content
- Add new guides based on common questions

### Quarterly
- Major documentation review
- Update architecture diagrams
- Refresh examples with new patterns

## Next Steps

1. **Review this roadmap** with stakeholders
2. **Create new directory structure** (can be done immediately)
3. **Start with quick wins** (simplify README, consolidate installation)
4. **Begin systematic migration** following the phases above
5. **Set up CI/CD** for documentation (link checking, etc.)

---

*This roadmap is a living document. Update it as you progress through the reorganization.*