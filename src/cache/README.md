# Enhanced Caching Architecture for OPNSense MCP

## Overview

This enhanced architecture implements a high-performance caching layer using:
- **Drizzle ORM** for type-safe PostgreSQL operations
- **Redis** for lightning-fast cache retrieval
- **Intelligent invalidation** strategies
- **Query pattern analysis** for optimized TTLs
- **Batch operations** for efficiency

## Architecture

```
┌─────────────────┐
│   MCP Client    │
└────────┬────────┘
         │
┌────────▼────────┐
│   MCP Server    │
└────────┬────────┘
         │
┌────────▼────────┐     ┌─────────────┐
│ Enhanced Cache  │────▶│    Redis    │
│    Manager      │     │  (Hot Data) │
└────────┬────────┘     └─────────────┘
         │
┌────────▼────────┐     ┌─────────────┐
│  Drizzle ORM    │────▶│  PostgreSQL │
└─────────────────┘     │(Source of   │
                        │   Truth)    │
                        └─────────────┘
```

## Key Features

### 1. Type-Safe Database Operations
```typescript
// Drizzle provides full TypeScript support
const stats = await db
  .select()
  .from(cacheStats)
  .where(eq(cacheStats.key, 'firewall:rules'));
```

### 2. Smart TTL Calculation
- Analyzes query patterns
- Adjusts TTL based on:
  - Access frequency
  - Execution time
  - Resource type
  - Historical patterns

### 3. Cascade Invalidation
```typescript
// Invalidating firewall rules also clears dependent caches
await cache.invalidate('cache:firewall:*', { 
  cascade: true 
});
```

### 4. Batch Operations
```typescript
// Fetch multiple resources efficiently
const data = await cache.getBatch([
  { key: 'rules', fetcher: getRules },
  { key: 'vlans', fetcher: getVlans },
  { key: 'interfaces', fetcher: getInterfaces }
]);
```

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=opnsense_mcp
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_CLUSTER=false

# Cache Settings
CACHE_DEFAULT_TTL=300
CACHE_MAX_TTL=3600
CACHE_MIN_TTL=60
```

### 3. Run Migrations
```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate

# Or use Drizzle Studio for visual management
npm run db:studio
```

## Usage Examples

### Basic Caching
```typescript
const cache = new EnhancedCacheManager(apiClient);

// Get with caching
const result = await cache.get(
  'firewall:rules',
  () => apiClient.getFirewallRules(),
  { ttl: 300 }
);

console.log(result.metadata.source); // 'cache' or 'api'
```

### Pattern-Based Invalidation
```typescript
// Invalidate all firewall-related caches
await cache.invalidate('cache:firewall:*');

// Invalidate with cascade (follows dependency rules)
await cache.invalidate('cache:network:interfaces', {
  cascade: true // Also invalidates dependent VLANs
});
```

### Performance Monitoring
```typescript
const stats = await cache.getStatistics();

console.log(`Hit Rate: ${stats.overall.hitRate}%`);
console.log(`Avg Response Time: ${stats.overall.avgResponseTime}ms`);

// Get recommendations
stats.recommendations.forEach(rec => {
  console.log(`💡 ${rec}`);
});
```

## Database Schema

### Core Tables
- `operations` - Audit trail of all operations
- `cache_stats` - Cache hit/miss statistics
- `query_patterns` - Pattern analysis for optimization
- `cache_invalidation_rules` - Smart invalidation rules
- `command_queue` - Async command processing

### Views
- `cache_performance_analytics` - Hourly performance metrics
- `recent_operations` - Last 100 operations

### Functions
- `calculate_optimal_ttl()` - Dynamic TTL calculation
- `update_cache_stats()` - Atomic stats updates

## Performance Optimizations

### 1. Redis Clustering
```typescript
const cache = new EnhancedCacheManager(client, {
  redis: {
    cluster: true,
    sentinels: [
      { host: 'sentinel1', port: 26379 },
      { host: 'sentinel2', port: 26379 }
    ]
  }
});
```

### 2. Compression
Large payloads are automatically compressed:
```typescript
cache: {
  enableCompression: true,
  compressionThreshold: 1024 // bytes
}
```

### 3. Batch Loading
```typescript
// Pre-warm cache on startup
await cache.warmCache();
```

## Monitoring & Analytics

### Cache Performance Dashboard
```sql
-- View cache performance by hour
SELECT * FROM cache_performance_analytics
WHERE hour >= NOW() - INTERVAL '24 hours'
ORDER BY hour DESC;
```

### Query Pattern Analysis
```sql
-- Find optimization opportunities
SELECT pattern, frequency, avg_execution_time, suggested_ttl
FROM query_patterns
WHERE frequency > 50
ORDER BY (frequency * avg_execution_time) DESC;
```

## Best Practices

### 1. Key Naming Convention
```
cache:{resource}:{operation}:{identifier}
```
Examples:
- `cache:firewall:rules:all`
- `cache:network:vlan:10`
- `cache:system:status`

### 2. TTL Guidelines
- System info: 30-60 seconds
- DHCP leases: 2-5 minutes  
- Firewall rules: 5-10 minutes
- VLANs: 10-30 minutes
- Backups: 1 hour

### 3. Invalidation Strategy
- Use cascade for dependent data
- Invalidate on write operations
- Schedule periodic full refreshes

## Troubleshooting

### Check Cache Health
```typescript
const health = await cache.healthCheck();
console.log(health);
```

### View Recent Operations
```sql
SELECT * FROM recent_operations
WHERE result = 'failure'
ORDER BY timestamp DESC;
```

### Analyze Cache Misses
```sql
SELECT key, misses, hits, 
       ROUND(hits::numeric / NULLIF(hits + misses, 0) * 100, 2) as hit_rate
FROM cache_stats
WHERE misses > hits
ORDER BY misses DESC;
```

## Future Enhancements

1. **GraphQL Integration** - Query-specific caching
2. **ML-Based TTL** - Predictive cache expiration
3. **Multi-Region Support** - Geo-distributed caching
4. **Event Streaming** - Real-time cache updates
5. **WebSocket Subscriptions** - Live data push

## Contributing

See [DEVELOPER.md](../DEVELOPER.md) for development guidelines.
