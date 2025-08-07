# Root Directory Cleanup Plan

## 📋 Current Root Files Analysis

### ✅ Essential Files (KEEP in root)
These must stay in root for functionality:

| File | Purpose | Why Keep in Root |
|------|---------|------------------|
| `README.md` | Main project documentation | GitHub/npm standard |
| `LICENSE` | MIT License | Legal requirement |
| `package.json` | Node.js configuration | Required by npm |
| `package-lock.json` | Dependency lock file | Required by npm |
| `tsconfig.json` | TypeScript config | Build requirement |
| `.gitignore` | Git ignore rules | Git requirement |
| `CHANGELOG.md` | Version history | Standard location |
| `CONTRIBUTING.md` | Contribution guidelines | GitHub standard |

### 🗂️ Configuration Files (KEEP in root)
These need to be in root for tools to find them:

| File | Purpose | Action |
|------|---------|--------|
| `drizzle.config.ts` | Database ORM config | Keep - tool expects root |
| `mcp.json` | MCP configuration | Keep - MCP standard |
| `schema.json` | JSON schema | Keep - referenced by code |
| `docker-compose.yml` | Docker config | Keep - Docker standard |
| `docker-compose.sse.yml` | SSE Docker config | Keep - Docker standard |
| `Dockerfile` | Container definition | Keep - Docker standard |

### 📁 Files to Move/Archive

#### Documentation Files (move to .archive or delete)
| File | Action | Reason |
|------|--------|--------|
| `DOCUMENTATION-ROADMAP.md` | → `.archive/migration/` | Migration planning doc |
| `DOCUMENTATION-REFACTOR-SUMMARY.md` | → `.archive/migration/` | Migration summary |
| `DOCUMENTATION-STYLE-GUIDE.md` | → `docs/contributing/style-guide.md` | Active doc, wrong location |
| `DUPLICATE-CONTENT-ANALYSIS.md` | → `.archive/migration/` | Migration analysis |
| `MIGRATION-CHECKLIST.md` | → `.archive/migration/` | Migration checklist |
| `MIGRATION-COMPLETE.md` | → `.archive/migration/` | Migration complete |
| `MIGRATION-PROGRESS.md` | → `.archive/migration/` | Migration progress |
| `README-NEW-DRAFT.md` | DELETE | Draft already applied |
| `HAPROXY-IMPLEMENTATION-SUMMARY.md` | → `.archive/` | Old implementation notes |

#### Script/Config Files
| File | Action | Reason |
|------|--------|--------|
| `agent-config.yaml` | → `examples/configs/` | Example configuration |
| `init-db.sql` | → `scripts/setup/` | Setup script |
| `cleanup-services.sh` | → `scripts/maintenance/` | Maintenance script |

## 🎯 Cleanup Actions

### Step 1: Create Archive Directories
```bash
mkdir -p .archive/migration
mkdir -p examples/configs
mkdir -p scripts/maintenance
mkdir -p docs/contributing
```

### Step 2: Move Migration Documentation
```bash
# Archive migration docs
mv DOCUMENTATION-ROADMAP.md .archive/migration/
mv DOCUMENTATION-REFACTOR-SUMMARY.md .archive/migration/
mv DUPLICATE-CONTENT-ANALYSIS.md .archive/migration/
mv MIGRATION-CHECKLIST.md .archive/migration/
mv MIGRATION-COMPLETE.md .archive/migration/
mv MIGRATION-PROGRESS.md .archive/migration/

# Archive old implementation docs
mv HAPROXY-IMPLEMENTATION-SUMMARY.md .archive/
```

### Step 3: Move Active Documentation
```bash
# Move style guide to proper location
mv DOCUMENTATION-STYLE-GUIDE.md docs/contributing/style-guide.md
```

### Step 4: Move Scripts and Configs
```bash
# Move example configs
mv agent-config.yaml examples/configs/

# Move setup scripts
mv init-db.sql scripts/setup/

# Move maintenance scripts
mv cleanup-services.sh scripts/maintenance/
```

### Step 5: Delete Drafts
```bash
rm README-NEW-DRAFT.md
```

## 📊 Result Preview

### Before: 25 files in root
```
Root cluttered with:
- 7 migration-related docs
- 1 draft file
- Mixed scripts and configs
- Implementation summaries
```

### After: 15 files in root
```
Root contains only:
✅ Essential project files (README, LICENSE, etc.)
✅ Required configs (package.json, tsconfig.json)
✅ Docker files (standard location)
✅ Tool configs that must be in root
```

## 🚀 Benefits

1. **Cleaner root** - Only essential files visible
2. **Better organization** - Related files grouped together
3. **Preserves history** - Migration docs archived, not deleted
4. **Standard structure** - Follows conventions
5. **Easier navigation** - Less clutter when browsing

## ⚠️ Pre-Cleanup Checklist

Before executing cleanup:
- [ ] Ensure git is clean (commit current changes)
- [ ] Verify no active references to files being moved
- [ ] Check CI/CD won't break from moved files
- [ ] Confirm Docker builds still work

## 🔧 Execute Cleanup

Ready to clean? Run these commands:

```bash
# 1. Create directories
mkdir -p .archive/migration examples/configs scripts/maintenance docs/contributing

# 2. Move files (all in one go)
mv DOCUMENTATION-{ROADMAP,REFACTOR-SUMMARY}.md DUPLICATE-CONTENT-ANALYSIS.md MIGRATION-*.md .archive/migration/
mv HAPROXY-IMPLEMENTATION-SUMMARY.md .archive/
mv DOCUMENTATION-STYLE-GUIDE.md docs/contributing/style-guide.md
mv agent-config.yaml examples/configs/
mv init-db.sql scripts/setup/
mv cleanup-services.sh scripts/maintenance/

# 3. Remove draft
rm README-NEW-DRAFT.md

# 4. Verify
ls -la
```

## 📝 Post-Cleanup Tasks

After cleanup:
1. Update any documentation that references moved files
2. Test Docker builds
3. Verify npm scripts still work
4. Commit changes with clear message

---

*This will reduce root directory files from 25 to ~15, improving project organization significantly.*