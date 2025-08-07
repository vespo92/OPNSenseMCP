# Installation Guide

Complete setup instructions for the OPNSense MCP Server.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download Node.js](https://nodejs.org/))
- **OPNsense firewall** with API access enabled
- **API credentials** from your OPNsense instance
- (Optional) **Redis** for caching
- (Optional) **PostgreSQL** for persistent cache

## OPNsense API Setup

### 1. Enable API Access

1. Log into your OPNsense web interface
2. Navigate to **System → Settings → Administration**
3. Enable the **Enable Secure Shell** option
4. Check **Enable API** 
5. Save the changes

### 2. Create API User

1. Go to **System → Access → Users**
2. Click the **+** button to add a new user
3. Fill in the user details:
   - Username: `api_user` (or your preference)
   - Password: Enable **Generate a scrambled password**
   - Full name: `API User`
4. Under **Effective Privileges**, add:
   - `GUI - All pages`
   - Or specific permissions for your use case
5. Click **Save**

### 3. Generate API Key

1. Edit the user you just created
2. Scroll down to **API Keys**
3. Click **+** to create a new API key
4. **Save the key and secret immediately** - you cannot retrieve them later!

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/vespo92/OPNSenseMCP
cd opnsense-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

If you encounter build errors, see [Troubleshooting](../troubleshooting/common-issues.md).

### 4. Configure Environment

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` with your OPNsense credentials:

```env
# Required Configuration
OPNSENSE_HOST=https://192.168.1.1     # Your OPNsense IP or hostname
OPNSENSE_API_KEY=your_api_key_here    # From step 3 above
OPNSENSE_API_SECRET=your_secret_here  # From step 3 above

# Optional Settings
OPNSENSE_VERIFY_SSL=false             # Set to true if using valid SSL cert
IAC_ENABLED=true                      # Enable Infrastructure as Code features
ENABLE_CACHE=false                    # Enable caching (requires Redis/PostgreSQL)

# Cache Configuration (if ENABLE_CACHE=true)
REDIS_HOST=localhost
REDIS_PORT=6379
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=opnsense_cache
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

> [!IMPORTANT]
> The API key and secret must match exactly what OPNsense provided. Do not add extra quotes or spaces.

### 5. Verify Installation

Test the connection to your OPNsense:

```bash
npm start
```

You should see:
```
OPNSense MCP Server v0.7.0
✅ Connected to OPNsense at https://192.168.1.1
Server ready for connections
```

If you see connection errors, check:
- OPNsense IP is correct and reachable
- API credentials are correct
- Firewall allows API access from your machine
- SSL verification settings match your setup

## Platform-Specific Instructions

### Windows

Use the provided batch scripts for easier setup:

```batch
# Run setup and test
scripts\setup\setup-and-test.bat
```

### macOS/Linux

Ensure you have proper permissions:

```bash
chmod +x scripts/setup/*.sh
./scripts/setup/setup.sh
```

### Docker

See [Docker Deployment](../deployment/docker.md) for containerized installation.

## Post-Installation

### Database Setup (Optional)

If using persistent caching:

```bash
# Initialize database schema
npm run db:migrate

# Verify database connection
npm run db:studio
```

### Verify Features

Test basic functionality:

```bash
# Test DHCP lease management
node scripts/test/test-dhcp-fix.js

# Test VLAN management
node scripts/test/test-vlan.js

# Test firewall rules
node scripts/test/test-firewall.js
```

## Next Steps

- [Quick Start Guide](quickstart.md) - Get up and running in 5 minutes
- [Claude Desktop Setup](configuration.md#claude-desktop) - Configure Claude Desktop integration
- [Feature Guides](../guides/) - Learn about specific features

## Troubleshooting

### Common Issues

**Connection refused**
- Ensure OPNsense API is enabled
- Check firewall rules allow API access
- Verify the host URL includes protocol (https://)

**Authentication failed**
- API credentials must be exactly as provided by OPNsense
- Check for trailing spaces in .env file
- Ensure user has appropriate permissions

**Build errors**
- Ensure Node.js 18+ is installed
- Try `npm ci` for clean install
- See [Build Troubleshooting](../troubleshooting/common-issues.md#build-errors)

### Getting Help

- Check [Troubleshooting Guide](../troubleshooting/)
- Open an [issue on GitHub](https://github.com/vespo92/OPNSenseMCP/issues)
- Join the [discussions](https://github.com/vespo92/OPNSenseMCP/discussions)