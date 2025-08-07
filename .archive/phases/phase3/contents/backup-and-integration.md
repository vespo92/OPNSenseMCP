# Phase 3 Enhancement: Config Backup & Infrastructure Integration

## 🔒 Configuration Backup System

### Features
1. **Automatic Backups**
   - Create backup before any write operation
   - Timestamp-based backup naming
   - Configurable retention policy
   - Compressed storage

2. **Backup Operations**
   ```typescript
   interface BackupManager {
     createBackup(): Promise<BackupInfo>;
     listBackups(): Promise<BackupInfo[]>;
     restoreBackup(backupId: string): Promise<boolean>;
     downloadBackup(backupId: string): Promise<Buffer>;
     deleteOldBackups(retentionDays: number): Promise<void>;
   }
   ```

3. **Implementation Plan**
   - Use OPNsense's `/api/core/backup/*` endpoints
   - Store backups locally and/or in TrueNAS
   - Track backup metadata in local database

## 🐳 Docker/Database Integration

### Architecture
```
┌─────────────────────┐     ┌──────────────────┐
│  Claude Desktop     │────▶│  MCP Server      │
│  (Your Workstation) │     │  (Node.js)       │
└─────────────────────┘     └─────────┬────────┘
                                      │
                            ┌─────────▼────────┐
                            │  Redis/PostgreSQL │
                            │  (Docker on LAN)  │
                            │   10.0.0.2:6379  │
                            └─────────┬────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
            ┌───────▼────────┐  ┌────▼──────┐  ┌──────▼──────┐
            │   OPNsense     │  │  TrueNAS  │  │   Docker    │
            │  10.0.0.1      │  │ 10.0.0.3  │  │  10.0.0.2   │
            └────────────────┘  └───────────┘  └─────────────┘
```

### Components

1. **Redis Cache Layer**
   - Fast in-memory storage
   - API response caching
   - Command queuing
   - Real-time updates

2. **PostgreSQL Persistence**
   - Configuration history
   - Audit logs
   - MCP conversation history
   - Change tracking

3. **Docker Compose Setup**
   ```yaml
   version: '3.8'
   services:
     redis:
       image: redis:7-alpine
       ports:
         - "10.0.0.2:6379:6379"
       volumes:
         - redis-data:/data
     
     postgres:
       image: postgres:15-alpine
       environment:
         POSTGRES_DB: opnsense_mcp
         POSTGRES_USER: mcp_user
         POSTGRES_PASSWORD: ${DB_PASSWORD}
       ports:
         - "10.0.0.2:5432:5432"
       volumes:
         - postgres-data:/var/lib/postgresql/data
   
   volumes:
     redis-data:
     postgres-data:
   ```

## 🔄 Integration Flow

### 1. **Before Any Modification**
```typescript
async function safeModification(operation: () => Promise<any>) {
  // 1. Create backup
  const backup = await backupManager.createBackup();
  
  // 2. Log to database
  await db.logOperation({
    timestamp: new Date(),
    backupId: backup.id,
    operation: operation.toString()
  });
  
  try {
    // 3. Execute operation
    const result = await operation();
    
    // 4. Cache result
    await redis.set(`result:${backup.id}`, result);
    
    return result;
  } catch (error) {
    // 5. Offer rollback
    console.error('Operation failed, backup available:', backup.id);
    throw error;
  }
}
```

### 2. **Fast Local Communication**
```typescript
class MCPCache {
  private redis: RedisClient;
  private db: PostgresClient;
  
  async getFirewallRules() {
    // Check cache first
    const cached = await redis.get('firewall:rules');
    if (cached) return JSON.parse(cached);
    
    // Fetch from OPNsense
    const rules = await opnsense.getFirewallRules();
    
    // Cache for 5 minutes
    await redis.setex('firewall:rules', 300, JSON.stringify(rules));
    
    return rules;
  }
}
```

## 🚀 Implementation Steps

1. **Add Backup Tools to MCP**
   - `create_backup` - Manual backup creation
   - `list_backups` - Show available backups
   - `restore_backup` - Restore from backup
   - `auto_backup` - Enable/disable auto-backup

2. **Add Database Connection**
   - Redis client for caching
   - PostgreSQL for persistence
   - Connection pooling
   - Retry logic

3. **Create Docker Stack**
   - Docker Compose file
   - Environment configuration
   - Network setup for LAN access
   - Volume management

4. **Add Safety Features**
   - Pre-operation validation
   - Dry-run mode
   - Change preview
   - Rollback capability

## 📝 Example Usage

### In Claude Desktop:
```
User: "Create a firewall rule to block port 22"

Claude: I'll create that firewall rule with automatic backup:
1. Creating configuration backup... ✓
2. Backup ID: backup-2025-01-10-1234
3. Creating firewall rule...
4. Rule created successfully!
5. Changes cached locally for fast access

If you need to rollback, use: restore_backup backup-2025-01-10-1234
```

### From Hypervisor (10.0.0.2):
```bash
# Query MCP cache directly
redis-cli -h localhost get firewall:rules

# View operation history
psql -h localhost -U mcp_user -d opnsense_mcp \
  -c "SELECT * FROM operations ORDER BY timestamp DESC LIMIT 10"
```

## 🔧 Configuration

### `.env` additions:
```env
# Backup Settings
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/mnt/truenas/opnsense-backups

# Database Settings
REDIS_HOST=10.0.0.2
REDIS_PORT=6379
POSTGRES_HOST=10.0.0.2
POSTGRES_PORT=5432
POSTGRES_DB=opnsense_mcp
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=secure_password

# Cache Settings
CACHE_TTL=300
ENABLE_CACHE=true
```

## 🎯 Benefits

1. **Safety**
   - Never lose configuration
   - Easy rollback
   - Audit trail

2. **Performance**
   - Fast cached responses
   - Reduced API load
   - Local data access

3. **Integration**
   - Hypervisor can query MCP data
   - Other services can integrate
   - Centralized configuration management

4. **Reliability**
   - Persistent storage
   - Backup redundancy
   - Disaster recovery

Ready to implement this enhanced Phase 3?
