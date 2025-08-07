# OPNSense MCP Documentation

Welcome to the comprehensive documentation for the OPNSense MCP Server.

## 📚 Documentation Structure

### [Getting Started](getting-started/)
Start here if you're new to OPNSense MCP:
- [Installation Guide](getting-started/installation.md) - Complete setup instructions
- [Quick Start](getting-started/quickstart.md) - Get running in 5 minutes
- [Configuration](getting-started/configuration.md) - Detailed configuration options

### [Feature Guides](guides/)
Learn how to use specific features:
- [VLAN Management](guides/vlan-management.md) - Network segmentation
- [Firewall Rules](guides/firewall-rules.md) - Security configuration
- [DNS Blocking](guides/dns-blocking.md) - Content filtering
- [DHCP Management](guides/dhcp-management.md) - IP address management
- [ARP Tables](guides/arp-tables.md) - Device discovery
- [HAProxy](guides/haproxy.md) - Load balancing
- [Backup & Restore](guides/backup-restore.md) - Configuration management

### [Infrastructure as Code](iac/)
Deploy infrastructure declaratively:
- [Overview](iac/overview.md) - IaC concepts and benefits
- [Resource Model](iac/resource-model.md) - Resource types and properties
- [Deployment](iac/deployment.md) - Planning and execution
- [Patterns](iac/patterns.md) - Reusable configurations

### [API Reference](api-reference/)
Complete technical reference:
- [Tools](api-reference/tools.md) - All available MCP tools
- [Resources](api-reference/resources.md) - Resource type reference
- [Schemas](api-reference/schemas.md) - Data validation schemas

### [Troubleshooting](troubleshooting/)
Solve common problems:
- [Common Issues](troubleshooting/common-issues.md) - Frequent problems and solutions
- [Connection Problems](troubleshooting/connection.md) - Network and API issues
- [Authentication](troubleshooting/authentication.md) - Credential problems
- [FAQ](troubleshooting/faq.md) - Frequently asked questions

## 🎯 Quick Navigation

### For New Users
1. [Installation Guide](getting-started/installation.md)
2. [Quick Start](getting-started/quickstart.md)
3. [Your First VLAN](guides/vlan-management.md)

### For Developers
1. [API Reference](api-reference/)
2. [IaC Documentation](iac/)
3. [Contributing Guide](../CONTRIBUTING.md)

### Common Tasks
- [Create a guest network](guides/vlan-management.md#guest-network-vlan)
- [Block websites](guides/dns-blocking.md)
- [Find devices on network](guides/arp-tables.md)
- [Set up port forwarding](guides/firewall-rules.md#port-forwarding)
- [Configure load balancing](guides/haproxy.md)

## 🔍 Search Tips

Use these keywords to find what you need:
- **vlan** - Network segmentation
- **firewall** - Security rules
- **dns** - Domain blocking
- **dhcp** - IP management
- **arp** - Device discovery
- **haproxy** - Load balancing
- **backup** - Configuration management
- **iac** - Infrastructure as Code

## 📖 Examples

Find working examples in the [examples/](../examples/) directory:
- [Basic Examples](../examples/basic/) - Simple use cases
- [Advanced Examples](../examples/advanced/) - Complex scenarios
- [IaC Patterns](../examples/patterns/) - Reusable templates

## 🆘 Getting Help

### Documentation Issues
If you find errors or missing information:
1. Check the [latest documentation](https://github.com/VinSpo/opnsense-mcp/tree/main/docs)
2. [Open an issue](https://github.com/VinSpo/opnsense-mcp/issues/new)

### Technical Support
For technical questions:
1. Check [Troubleshooting](troubleshooting/)
2. Search [existing issues](https://github.com/VinSpo/opnsense-mcp/issues)
3. Ask in [Discussions](https://github.com/VinSpo/opnsense-mcp/discussions)

## 📝 Contributing

We welcome contributions to the documentation:
- Fix typos and errors
- Add examples
- Improve explanations
- Translate documentation

See our [Contributing Guide](../CONTRIBUTING.md) for details.

---

**Version:** 0.7.0 | **Last Updated:** 2024