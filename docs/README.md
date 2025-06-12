# OPNSense MCP Documentation

## 📚 Documentation Structure

- **[Getting Started](getting-started/)** - Installation and setup guides
- **[API Reference](api/)** - Detailed API documentation
- **[Architecture](IaC-ARCHITECTURE.md)** - System architecture and design
- **[Phases](phases/)** - Development phase documentation
- **[Troubleshooting](troubleshooting/)** - Common issues and solutions

## 🚀 Quick Links

### Getting Started
- [Initial Setup Guide](getting-started/setup.md)
- [Environment Configuration](getting-started/configuration.md)
- [First Deployment](getting-started/first-deployment.md)

### Infrastructure as Code
- [IaC Overview](IaC-ARCHITECTURE.md)
- [Resource Types](api/resources.md)
- [Deployment Guide](getting-started/iac-deployment.md)

### Features
- [DNS Blocking Setup](dns/DNS-QUICKSTART.md)
- [Backup Management](api/backup.md)
- [Cache Configuration](getting-started/cache-setup.md)

## 💡 Key Concepts

### MCP (Model Context Protocol)
This server implements the MCP protocol, allowing AI assistants to interact with OPNsense firewalls programmatically.

### Infrastructure as Code
Deploy and manage network infrastructure using declarative configurations with built-in state management and rollback capabilities.

### Resource Management
All OPNsense configurations are abstracted as resources that can be created, updated, and deleted through a consistent API.

## 📖 Development Documentation

- [Contributing Guide](../CONTRIBUTING.md)
- [Development Phases](phases/)
- [Troubleshooting Fixes](troubleshooting/fixes/)

## 🔧 Advanced Topics

- [State Management](IaC-ARCHITECTURE.md#state-management)
- [Dependency Resolution](IaC-ARCHITECTURE.md#dependency-resolution)
- [Custom Resources](api/custom-resources.md)
