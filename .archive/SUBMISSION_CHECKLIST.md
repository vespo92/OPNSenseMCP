# Pre-Submission Checklist for MCP Servers Repository

Before submitting your PR, ensure:

## Repository Requirements
- [ ] Your repository is public on GitHub
- [ ] LICENSE file exists (MIT recommended)
- [ ] README.md is comprehensive with:
  - [ ] Clear installation instructions
  - [ ] Configuration examples
  - [ ] Feature list
  - [ ] Usage examples
- [ ] Package.json has correct:
  - [ ] Name
  - [ ] Description
  - [ ] Repository URL
  - [ ] Keywords (include "mcp")
  - [ ] Author information

## Code Quality
- [ ] TypeScript/JavaScript code builds without errors
- [ ] All dependencies are listed in package.json
- [ ] No hardcoded credentials or sensitive data
- [ ] Environment variables documented

## MCP Specific
- [ ] Implements MCP protocol correctly
- [ ] Works with Claude Desktop
- [ ] Has clear tool/resource descriptions
- [ ] Error handling implemented

## Documentation
- [ ] API documentation available
- [ ] Configuration options explained
- [ ] Troubleshooting guide included
- [ ] Examples provided

## GitHub Actions (Optional but recommended)
- [ ] CI/CD pipeline for testing
- [ ] Automated builds
- [ ] NPM publishing workflow

## Steps to Submit PR:

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "feat: OPNsense MCP server for network management"
   git push origin main
   ```

2. Fork the MCP servers repository:
   https://github.com/modelcontextprotocol/servers

3. Clone your fork:
   ```bash
   git clone https://github.com/VinSpo/servers.git
   cd servers
   ```

4. Create a new branch:
   ```bash
   git checkout -b add-opnsense-mcp
   ```

5. Add your entry to the README.md in the appropriate section

6. Commit and push:
   ```bash
   git add README.md
   git commit -m "Add OPNsense MCP server to network tools"
   git push origin add-opnsense-mcp
   ```

7. Create Pull Request with:
   - Clear title: "Add OPNsense MCP Server"
   - Description explaining what your server does
   - Link to your repository
   - Any special features or capabilities

## PR Description Template:

```markdown
## Add OPNsense MCP Server

This PR adds the OPNsense MCP server to the network & infrastructure tools section.

### What it does:
- Provides programmatic control over OPNsense firewalls
- Enables Infrastructure as Code for network management
- Integrates with Claude Desktop for AI-assisted network configuration

### Key Features:
- VLAN and interface management
- Firewall rule configuration
- DNS blocklist management
- State tracking and rollback
- Configuration backup/restore

### Repository: https://github.com/VinSpo/opnsense-mcp

This server is part of a larger vision for home infrastructure automation using MCP, with planned integrations for Proxmox, Docker, and other homelab tools.
```
