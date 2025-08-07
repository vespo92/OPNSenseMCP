# Migration Guide - OPNSense MCP Server

## 📋 Table of Contents
- [Version Migrations](#version-migrations)
- [0.7.0 to 0.8.0](#from-070-to-080)
- [Feature Migrations](#feature-migrations)
- [Data Migrations](#data-migrations)
- [Rollback Procedures](#rollback-procedures)

## 🔄 Version Migrations

### From 0.7.0 to 0.8.0

**Upgrade Complexity: LOW** - No breaking changes

#### Pre-Migration Checklist
- [ ] Backup current state file
- [ ] Backup current configuration
- [ ] Note current cache size (for comparison)
- [ ] Document any custom modifications
- [ ] Test in staging environment first

#### Step-by-Step Migration

##### 1. Backup Current Installation
```bash
# Create backup directory
mkdir -p backups/v0.7.0-$(date +%Y%m%d)

# Backup state and data
cp -r data/ backups/v0.7.0-$(date +%Y%m%d)/
cp -r logs/ backups/v0.7.0-$(date +%Y%m%d)/
cp .env backups/v0.7.0-$(date +%Y%m%d)/

# Backup current code (if modified)
tar -czf backups/v0.7.0-$(date +%Y%m%d)/code.tar.gz src/
```

##### 2. Update Dependencies
```bash
# Pull latest code
git pull origin main

# Install new dependencies (jsonpath)
npm install

# Rebuild the project
npm run build
```

##### 3. Enable New Features (Optional)

**Cache Compression** (Automatic - no action needed)
```javascript
// Enabled by default with these settings:
{
  cache: {
    enableCompression: true,
    compressionThreshold: 1024,  // 1KB
    compressionLevel: 6
  }
}
```

**State Encryption** (Optional - recommended for production)
```bash
# Generate a secure key (32 bytes)
openssl rand -hex 32

# Add to environment
echo "STATE_ENCRYPTION_KEY=your-generated-key" >> .env

# Or use a key management service
export STATE_ENCRYPTION_KEY=$(vault kv get -field=key secret/opnsense/state)
```

**Network Interface Sync** (Automatic)
```javascript
// Runs automatically every 5 minutes
// To customize interval, set in config:
{
  sync: {
    networkInterfaces: {
      enabled: true,
      interval: 300000  // 5 minutes in ms
    }
  }
}
```

##### 4. Start the Updated Server
```bash
# If using PM2
pm2 stop opnsense-mcp
pm2 start opnsense-mcp

# If using systemd
sudo systemctl restart opnsense-mcp

# If using Docker
docker-compose down
docker-compose up -d --build
```

##### 5. Verify Migration
```bash
# Check version
curl http://localhost:3000/version

# Test cache compression
curl http://localhost:3000/debug/cache/stats
# Should show: compressionEnabled: true

# Test state encryption (if enabled)
cat data/state.json
# Should show encrypted content starting with: {"encrypted":true,"data":"..."}

# Test network sync
curl http://localhost:3000/api/interfaces
# Should return synchronized interfaces
```

#### Post-Migration Validation

```bash
# Run health checks
npm run test:health

# Monitor logs for errors
tail -f logs/error.log

# Check memory usage (should be lower)
pm2 monit

# Verify all tools still work
npm run test:integration
```

### From 0.6.x to 0.8.0

**Upgrade Complexity: MEDIUM** - Multiple version jump

#### Additional Steps

1. **Update Database Schema**
```bash
# Run all migrations
npm run db:migrate

# Verify schema
npm run db:verify
```

2. **Update Configuration Format**
```javascript
// Old format (0.6.x)
{
  "host": "192.168.1.1",
  "apiKey": "key",
  "apiSecret": "secret"
}

// New format (0.8.0)
{
  "api": {
    "host": "https://192.168.1.1",
    "apiKey": "key",
    "apiSecret": "secret",
    "verifySsl": true
  },
  "cache": {
    "enabled": true,
    "ttl": 300
  }
}
```

## 🔧 Feature Migrations

### Migrating from Basic Cache to Enhanced Cache

#### Before (Basic Cache)
```typescript
import { MCPCacheManager } from './cache/manager';

const cache = new MCPCacheManager({
  ttl: 300,
  maxSize: 100
});
```

#### After (Enhanced Cache with Compression)
```typescript
import { EnhancedCacheManager } from './cache/enhanced-manager';

const cache = new EnhancedCacheManager({
  cache: {
    defaultTTL: 300,
    enableCompression: true,
    compressionThreshold: 1024,
    compressionLevel: 6
  },
  performance: {
    maxConcurrency: 10
  }
});
```

### Migrating Macro Definitions

#### Before (Simple Variables)
```json
{
  "macro": "create-vlan",
  "variables": {
    "vlan_tag": "{{tag}}",
    "interface": "{{iface}}"
  }
}
```

#### After (JSONPath Support)
```json
{
  "macro": "create-vlan",
  "variables": {
    "vlan_tag": "{{$.config.vlans[0].tag}}",
    "interface": "{{$.interfaces[?(@.type=='physical')].name}}"
  }
}
```

### Migrating State Files

#### Unencrypted to Encrypted State

```bash
# 1. Export current state
cat data/state.json > state-backup.json

# 2. Set encryption key
export STATE_ENCRYPTION_KEY="your-secure-key"

# 3. Import state (will encrypt on save)
cat state-backup.json | node -e "
  const fs = require('fs');
  const crypto = require('crypto');
  const state = JSON.parse(fs.readFileSync(0, 'utf-8'));
  
  // Encryption logic
  const encrypted = encrypt(state, process.env.STATE_ENCRYPTION_KEY);
  fs.writeFileSync('data/state.json', JSON.stringify(encrypted));
"
```

## 📊 Data Migrations

### Database Schema Updates

#### Add Network Interfaces Table
```sql
-- Run if upgrading from version without network sync
CREATE TABLE IF NOT EXISTS network_interfaces (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(20),
  ip_address VARCHAR(45),
  mac_address VARCHAR(17),
  mtu INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interfaces_status ON network_interfaces(status);
CREATE INDEX idx_interfaces_type ON network_interfaces(type);
```

#### Update Cache Statistics Table
```sql
-- Add compression tracking
ALTER TABLE cache_stats 
ADD COLUMN IF NOT EXISTS compression_ratio DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS compressed_size BIGINT,
ADD COLUMN IF NOT EXISTS original_size BIGINT;
```

### Redis Data Migration

```bash
# Export Redis data before migration
redis-cli --rdb dump.rdb

# Clear old cache (optional - for clean start)
redis-cli FLUSHDB

# Import with new key structure
node scripts/migrate-redis.js
```

```javascript
// scripts/migrate-redis.js
const Redis = require('ioredis');
const redis = new Redis();

async function migrate() {
  // Get all old keys
  const keys = await redis.keys('opnsense:*');
  
  for (const key of keys) {
    const value = await redis.get(key);
    const ttl = await redis.ttl(key);
    
    // Compress if large
    if (value.length > 1024) {
      const compressed = await compress(value);
      await redis.setex(key, ttl, compressed);
      console.log(`Compressed ${key}: ${value.length} -> ${compressed.length}`);
    }
  }
}

migrate().then(() => process.exit(0));
```

## 🔙 Rollback Procedures

### Quick Rollback (< 5 minutes downtime)

```bash
# 1. Stop current version
pm2 stop opnsense-mcp

# 2. Restore previous code
git checkout v0.7.0
npm install
npm run build

# 3. Restore previous state (if encrypted state causes issues)
cp backups/v0.7.0-*/data/state.json data/state.json

# 4. Restart service
pm2 start opnsense-mcp

# 5. Verify rollback
curl http://localhost:3000/version
# Should show: 0.7.0
```

### Full Rollback (with data restoration)

```bash
# 1. Stop all services
pm2 stop all
redis-cli SHUTDOWN

# 2. Restore complete backup
rm -rf data/ logs/
cp -r backups/v0.7.0-*/data/ ./
cp -r backups/v0.7.0-*/logs/ ./
cp backups/v0.7.0-*/.env ./

# 3. Restore code
git checkout v0.7.0
npm install
npm run build

# 4. Restore Redis dump (if applicable)
redis-server --dbfilename dump-v0.7.0.rdb

# 5. Start services
pm2 start ecosystem.config.js
```

## 🚨 Common Migration Issues

### Issue: State file won't load after enabling encryption
```bash
# Solution: State is still unencrypted, system expects encrypted
# Clear the encryption key temporarily
unset STATE_ENCRYPTION_KEY
node dist/index.js

# Then re-enable encryption - it will encrypt on next save
export STATE_ENCRYPTION_KEY="your-key"
```

### Issue: High memory usage after migration
```bash
# Solution: Old cache entries not compressed
# Clear cache to allow recompression
redis-cli FLUSHDB

# Or selectively clear old entries
redis-cli --scan --pattern "opnsense:*" | xargs redis-cli DEL
```

### Issue: JSONPath macro substitution failing
```javascript
// Solution: Update macro syntax
// Old: {{nested.value}}
// New: {{$.nested.value}}

// Or disable JSONPath for compatibility
{
  macro: {
    useJSONPath: false  // Falls back to simple substitution
  }
}
```

### Issue: Network sync causing performance issues
```javascript
// Solution: Increase sync interval or disable
{
  sync: {
    networkInterfaces: {
      enabled: false  // Or increase interval
    }
  }
}
```

## 📋 Migration Checklist Template

### Pre-Migration
- [ ] Review release notes
- [ ] Test in staging environment
- [ ] Backup production data
- [ ] Schedule maintenance window
- [ ] Notify stakeholders

### During Migration
- [ ] Stop production service
- [ ] Create backups
- [ ] Update code
- [ ] Run database migrations
- [ ] Update configuration
- [ ] Start service
- [ ] Verify core functionality

### Post-Migration
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify new features
- [ ] Document any issues
- [ ] Update runbooks
- [ ] Close maintenance window

## 🔐 Security Considerations

### Encryption Key Management

**Development**
```bash
# Use environment variable
export STATE_ENCRYPTION_KEY="dev-key-not-for-production"
```

**Production**
```bash
# Use secret management service
export STATE_ENCRYPTION_KEY=$(aws secretsmanager get-secret-value \
  --secret-id opnsense/state-key \
  --query SecretString --output text)

# Or HashiCorp Vault
export STATE_ENCRYPTION_KEY=$(vault kv get -field=key secret/opnsense/state)
```

### Key Rotation

```bash
# 1. Decrypt with old key
OLD_KEY="old-key" node scripts/decrypt-state.js

# 2. Re-encrypt with new key
NEW_KEY="new-key" node scripts/encrypt-state.js

# 3. Update environment
export STATE_ENCRYPTION_KEY="new-key"

# 4. Restart service
pm2 restart opnsense-mcp
```

## 📚 Additional Resources

- [Release Notes](./RELEASE-NOTES.md) - Detailed changes per version
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Backup Procedures](./DEPLOYMENT-GUIDE.md#backup--restore) - Backup strategies
- [Developer Guide](./DEVELOPER-GUIDE.md) - Development setup

---

*For migration assistance, contact the development team or create an issue on GitHub.*