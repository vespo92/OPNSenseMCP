# Documentation Migration Checklist

## 🚀 Pre-Migration Setup

### Create New Structure
```bash
# Run these commands from project root
mkdir -p .archive/phases
mkdir -p .archive/roadmap  
mkdir -p .archive/implementation-plan
mkdir -p .internal

mkdir -p docs/getting-started
mkdir -p docs/guides
mkdir -p docs/iac/examples
mkdir -p docs/api-reference
mkdir -p docs/deployment
mkdir -p docs/troubleshooting

mkdir -p examples/basic
mkdir -p examples/advanced
mkdir -p examples/patterns

mkdir -p scripts/test
mkdir -p scripts/setup
mkdir -p scripts/build
```

## 📦 Phase 1: Archive Historical Content

### Move Phase Documentation
- [ ] `mv docs/phases .archive/`
- [ ] `mv docs/phase-4.5 .archive/phases/`
- [ ] `mv roadmap .archive/`
- [ ] `mv implementation-plan .archive/`

### Archive Old Summaries
- [ ] `mv MACRO-IMPLEMENTATION-SUMMARY.md .archive/`
- [ ] `mv SUBMISSION_CHECKLIST.md .archive/`

## 🗂️ Phase 2: Reorganize Scripts & Tests

### Move Test Scripts
- [ ] `mv create-dmz-rules.ts scripts/test/`
- [ ] `mv create-rpc-rules.ts scripts/test/`
- [ ] `mv debug-api.ts scripts/test/`
- [ ] `mv test-firewall-api.ts scripts/test/`
- [ ] `mv test-mcp-fix.ts scripts/test/`

### Move Backup Files
- [ ] `mv backup/test-build.ts tests/integration/`
- [ ] `mv backup/test-firewall.ts tests/integration/`
- [ ] `mv backup/verify-build.ts tests/integration/`
- [ ] `rm -rf backup/` (after verification)

### Consolidate Setup Scripts
- [ ] Keep `scripts/setup/` as is
- [ ] Move any `.bat` files from docs to `scripts/setup/`

## 📝 Phase 3: Documentation Consolidation

### Getting Started Section
- [ ] Create `docs/getting-started/installation.md`
  - Extract installation from main README
  - Merge with `docs/getting-started/SETUP-GUIDE.md`
  - Include environment setup
  
- [ ] Create `docs/getting-started/quickstart.md`
  - 5-minute tutorial
  - Basic example
  - Link to guides

- [ ] Create `docs/getting-started/configuration.md`
  - Environment variables
  - Claude Desktop setup
  - MCP configuration

- [ ] Update `docs/getting-started/README.md` as index

### Guides Section
- [ ] Create `docs/guides/vlan-management.md`
  - Extract VLAN content from main README
  - Add examples from phase docs
  
- [ ] Create `docs/guides/firewall-rules.md`
  - Consolidate firewall documentation
  - Include rule examples
  
- [ ] Create `docs/guides/dns-blocking.md`
  - Merge all DNS documentation:
    - `docs/dns/DNS-QUICKSTART.md`
    - `docs/dns/DNS-SOLUTION-README.md`
    - `docs/dns/DNS-BLOCKING-SOLUTION.md`
  
- [ ] Create `docs/guides/haproxy.md`
  - Merge:
    - `HAPROXY-IMPLEMENTATION-SUMMARY.md`
    - `docs/HAPROXY-GUIDE.md`
  
- [ ] Create `docs/guides/dhcp-management.md`
  - Extract DHCP content
  - Include lease management
  
- [ ] Create `docs/guides/arp-tables.md`
  - ARP table documentation
  - Network discovery examples
  
- [ ] Create `docs/guides/backup-restore.md`
  - Backup procedures
  - Restore instructions

### IaC Section
- [ ] Create `docs/iac/overview.md`
  - Merge best of `roadmap/` and `implementation-plan/`
  - Clear, unified vision
  
- [ ] Create `docs/iac/resource-model.md`
  - Resource types
  - Properties and validation
  
- [ ] Create `docs/iac/deployment.md`
  - Planning process
  - Execution engine
  - State management
  
- [ ] Create `docs/iac/patterns.md`
  - Common patterns
  - Best practices
  
- [ ] Move IaC examples to `docs/iac/examples/`

### API Reference
- [ ] Create `docs/api-reference/tools.md`
  - Complete tool documentation
  - Parameters and examples
  
- [ ] Create `docs/api-reference/resources.md`
  - Resource type reference
  - Properties for each type
  
- [ ] Create `docs/api-reference/schemas.md`
  - JSON schemas
  - Validation rules

### Deployment Section
- [ ] Create `docs/deployment/claude-desktop.md`
  - Setup instructions
  - Configuration examples
  
- [ ] Create `docs/deployment/sse-mode.md`
  - From existing `docs/SSE-DEPLOYMENT.md`
  
- [ ] Create `docs/deployment/docker.md`
  - Container deployment
  - docker-compose examples
  
- [ ] Create `docs/deployment/production.md`
  - Best practices
  - Security considerations

### Troubleshooting
- [ ] Create `docs/troubleshooting/common-issues.md`
  - Merge existing troubleshooting
  
- [ ] Create `docs/troubleshooting/connection.md`
  - Network issues
  - SSL problems
  
- [ ] Create `docs/troubleshooting/authentication.md`
  - API key issues
  - Permission problems
  
- [ ] Create `docs/troubleshooting/faq.md`
  - Frequently asked questions

## 📚 Phase 4: Update Main Documentation

### Simplify Main README.md
- [ ] Remove detailed installation (link to docs)
- [ ] Remove extensive examples (link to examples/)
- [ ] Focus on:
  - What it is (brief)
  - Key features (bullet points)
  - Quick start (link)
  - Documentation links
  - Contributing
  - License

### Create docs/README.md Navigation
- [ ] Clear table of contents
- [ ] Links to all sections
- [ ] Search tips
- [ ] Getting help

### Update Examples
- [ ] Move basic examples to `examples/basic/`
- [ ] Move complex examples to `examples/advanced/`
- [ ] Move IaC patterns to `examples/patterns/`
- [ ] Create README in each subdirectory

## 🔧 Phase 5: Internal Documentation

### Move Developer Docs
- [ ] Create `.internal/architecture.md`
  - From `docs/ARCHITECTURE-DIAGRAM.md`
  - Technical details
  
- [ ] Create `.internal/development.md`
  - From `DEVELOPER.md`
  - Setup for contributors
  
- [ ] Create `.internal/testing.md`
  - Testing procedures
  - Test running instructions
  
- [ ] Create `.internal/release-process.md`
  - Release procedures
  - Version management

## 🔗 Phase 6: Fix Links & References

### Update Internal Links
- [ ] Main README.md - update all doc links
- [ ] CONTRIBUTING.md - update file paths
- [ ] docs/README.md - create new navigation
- [ ] All guide files - fix cross-references

### Update External References
- [ ] package.json - update homepage/docs links
- [ ] GitHub repository - update wiki if exists
- [ ] Any CI/CD configs - update paths

## 🧹 Phase 7: Cleanup

### Remove Old Files
- [ ] Delete empty directories
- [ ] Remove duplicate files after consolidation
- [ ] Clean up old DNS directory: `rm -rf docs/dns/`
- [ ] Remove old troubleshooting files after merge
- [ ] Delete phase test results

### Final Structure Verification
- [ ] Verify all links work
- [ ] Check examples run correctly
- [ ] Ensure no orphaned files
- [ ] Confirm archive is complete

## ✅ Phase 8: Validation

### Content Check
- [ ] No duplicate information
- [ ] All topics covered
- [ ] Examples work
- [ ] Links functional

### User Testing
- [ ] New user can find installation
- [ ] Easy to navigate to guides
- [ ] API reference is complete
- [ ] Troubleshooting helps

### Developer Testing  
- [ ] Contributing guide works
- [ ] Development setup clear
- [ ] Internal docs accessible
- [ ] Release process documented

## 📊 Success Metrics

### Quantitative
- [ ] Reduced from 26+ doc files to ~20 organized files
- [ ] Zero duplicate content
- [ ] All examples in examples/
- [ ] All scripts in scripts/

### Qualitative
- [ ] Clear navigation path
- [ ] Consistent formatting
- [ ] No conflicting information
- [ ] Easy to maintain

## 🚨 Rollback Plan

If issues arise:
1. All changes in git - can revert
2. Archive preserves original structure
3. No deletion until validation complete
4. Gradual migration allows testing

## 📅 Timeline

- **Day 1**: Phases 1-2 (Archive & Reorganize)
- **Day 2-3**: Phase 3 (Consolidation)
- **Day 4**: Phases 4-5 (Update & Internal)
- **Day 5**: Phases 6-7 (Links & Cleanup)
- **Day 6**: Phase 8 (Validation)
- **Day 7**: Buffer/Polish

---

*Check off items as completed. This checklist is designed to be executed sequentially.*