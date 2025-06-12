# Simplified Infrastructure Setup

## What Actually Runs Where

### On Your Local PC (with Claude Desktop)
- **OPNsense MCP Server** - The actual MCP server
- **Claude Desktop** - Communicates with local MCP server
- All the TypeScript code stays here

### On Hypervisor (10.0.0.2)
- **Redis** - For caching (port 6379)
- **PostgreSQL** - For audit logs (port 5432)
- **Redis Commander** - Web UI (port 8081)
- **pgAdmin** - Web UI (port 8082)

## Quick Setup

### 1. On Hypervisor (10.0.0.2)

```bash
# Just copy these two files
scp deploy-hypervisor-minimal.sh root@10.0.0.2:/tmp/
scp init-db.sql root@10.0.0.2:/tmp/

# SSH and run
ssh root@10.0.0.2
cd /tmp
chmod +x deploy-hypervisor-minimal.sh
./deploy-hypervisor-minimal.sh
```

### 2. On Your Local PC

Update your `.env` file:
```env
# OPNsense settings (unchanged)
OPNSENSE_HOST=https://your-opnsense-ip
OPNSENSE_API_KEY=your-key
OPNSENSE_API_SECRET=your-secret

# Point to hypervisor for data services
REDIS_HOST=10.0.0.2
REDIS_PORT=6379
POSTGRES_HOST=10.0.0.2
POSTGRES_PORT=5432
POSTGRES_DB=opnsense_mcp
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_secure_password
ENABLE_CACHE=true
```

Then:
```bash
npm install
npm run build
# Restart Claude Desktop
```

## Benefits of This Approach

1. **MCP server stays local** - Works with Claude Desktop
2. **Shared cache** - Could be used by multiple MCP servers later
3. **Centralized logs** - All audit trails in one place
4. **Minimal footprint** - Just data services on hypervisor
5. **Easy maintenance** - Docker containers are simple to manage

## Testing

From your local PC:
```bash
# Test Redis connection
npm install -g redis-cli
redis-cli -h 10.0.0.2 ping

# Test PostgreSQL connection
psql -h 10.0.0.2 -U mcp_user -d opnsense_mcp -c "SELECT 1"
```

## What This Gives You

1. **Fast responses** - Redis cache on your LAN
2. **Audit trail** - All operations logged to PostgreSQL
3. **Backup metadata** - Stored in database
4. **Future ready** - Other MCP servers can share the same infrastructure
