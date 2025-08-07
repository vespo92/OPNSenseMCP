# Getting Started

Welcome to OPNSense MCP Server! This section will help you get up and running quickly.

## 📚 Documentation Overview

### [Installation Guide](installation.md)
Complete setup instructions including:
- Prerequisites and requirements
- OPNsense API configuration
- Step-by-step installation
- Platform-specific instructions
- Post-installation verification

**Start here if:** You haven't installed the server yet.

### [Quick Start Guide](quickstart.md)
Get running in 5 minutes:
- Fast setup for Claude Desktop
- Your first commands
- Common tasks and examples
- Tips for best results

**Start here if:** You've installed the server and want to start using it immediately.

### [Configuration Guide](configuration.md)
Detailed configuration options:
- Environment variables
- Claude Desktop setup
- SSE mode configuration
- Cache setup
- Performance tuning
- Security settings

**Start here if:** You need to customize the server for your environment.

## 🚀 Typical Setup Flow

1. **Install OPNSense MCP Server**
   - Follow the [Installation Guide](installation.md)
   - Takes about 10-15 minutes

2. **Configure Claude Desktop**
   - See [Quick Start Guide](quickstart.md#step-2-configure-claude-desktop)
   - Takes 2-3 minutes

3. **Test Basic Functions**
   - Try the examples in [Quick Start](quickstart.md#step-4-test-it-out)
   - Verify everything works

4. **Explore Features**
   - Check out [Feature Guides](../guides/)
   - Learn advanced capabilities

## 💡 Quick Setup (TL;DR)

If you're experienced and just need the commands:

```bash
# Clone and build
git clone https://github.com/VinSpo/opnsense-mcp
cd opnsense-mcp
npm install
npm run build

# Configure
cp .env.example .env
# Edit .env with your OPNsense credentials

# Test
npm start

# Add to Claude Desktop config and restart Claude
```

## 🔧 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] OPNsense firewall accessible
- [ ] Admin access to OPNsense
- [ ] API enabled in OPNsense
- [ ] Claude Desktop installed (optional)

## 📖 What Can You Do?

Once set up, you can ask Claude to:

### Network Management
- "Create a guest network on VLAN 50"
- "Show me all configured VLANs"
- "Set up a DMZ network"

### Device Discovery
- "Find all Apple devices"
- "Show devices that connected today"
- "Is Kyle's laptop online?"

### Security
- "Block social media websites"
- "Create firewall rule to block port 445"
- "Show me all current firewall rules"

### Infrastructure
- "Deploy my standard office network setup"
- "Backup the current configuration"
- "Set up HAProxy for load balancing"

## 🆘 Getting Help

### If Something Goes Wrong

1. Check [Troubleshooting Guide](../troubleshooting/common-issues.md)
2. Review your [Configuration](configuration.md)
3. Check the logs: `npm start` in debug mode
4. Search [GitHub Issues](https://github.com/VinSpo/opnsense-mcp/issues)
5. Ask in [Discussions](https://github.com/VinSpo/opnsense-mcp/discussions)

### Common First-Time Issues

**Can't connect to OPNsense**
- Is the API enabled?
- Are credentials correct?
- Is SSL verification configured properly?

**Claude doesn't see the server**
- Did you restart Claude Desktop?
- Is the path in config absolute?
- Check for JSON syntax errors

**Commands don't work**
- Is the server running?
- Check user permissions in OPNsense
- Review error messages in logs

## 📚 Next Steps

After getting started:

1. **Learn Core Features**
   - [VLAN Management](../guides/vlan-management.md)
   - [Firewall Rules](../guides/firewall-rules.md)
   - [DNS Blocking](../guides/dns-blocking.md)

2. **Explore Advanced Features**
   - [Infrastructure as Code](../iac/overview.md)
   - [HAProxy Configuration](../guides/haproxy.md)
   - [Backup & Restore](../guides/backup-restore.md)

3. **Check Examples**
   - [Basic Examples](../../examples/basic/)
   - [Advanced Patterns](../../examples/patterns/)
   - [IaC Templates](../iac/examples/)

---

**Ready to start?** → [Installation Guide](installation.md)