# GitHub Publish Checklist

Before pushing to GitHub, complete these steps:

## 1. Update Personal Information

### In `package.json`:
- [ ] Replace `"Your Name"` with your actual name
- [ ] Replace `yourusername` in all GitHub URLs with your GitHub username

### In `LICENSE`:
- [ ] Replace `[Your Name]` with your actual name
- [ ] Update the year if needed

### In `README.md`:
- [ ] Update the clone URL with your repository URL
- [ ] Update any example paths to match your setup

## 2. Verify Sensitive Data is Excluded

- [ ] Confirm `.env` is NOT being tracked (run `git status`)
- [ ] Check that no API keys appear in any committed files
- [ ] Verify `.gitignore` is working properly

## 3. Clean Build

```bash
# Clean and rebuild
npm run clean
npm run build

# Ensure it builds without errors
```

## 4. Test Functionality

- [ ] Test basic VLAN operations
- [ ] Test firewall rule creation
- [ ] Verify connection to OPNSense works

## 5. Final Git Commands

```bash
# Initialize repository if not done
git init

# Add all files (respecting .gitignore)
git add .

# Commit
git commit -m "Initial commit: OPNSense MCP Server v0.3.5"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/yourusername/opnsense-mcp.git

# Push to GitHub
git push -u origin main
```

## 6. After Publishing

- [ ] Add topics to your GitHub repo: `mcp`, `opnsense`, `claude-desktop`, `firewall`
- [ ] Consider adding a GitHub Action for automated testing
- [ ] Add badges to README (build status, version, license)

## Optional: Create Release

```bash
# Tag the version
git tag -a v0.3.5 -m "Phase 3: Infrastructure ready"
git push origin v0.3.5
```

Then create a release on GitHub with:
- Release notes from Phase documentation
- Mention it works with Claude Desktop
- Link to MCP documentation