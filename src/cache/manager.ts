// MCP Cache Manager for Local Infrastructure Integration
import { OPNSenseAPIClient } from '../api/client.js';
import Redis from 'ioredis';
import pkg from 'pg';
const { Pool } = pkg;

export interface CacheConfig {
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  redisDb?: number;
  redisKeyPrefix?: string;
  postgresHost?: string;
  postgresPort?: number;
  postgresDb?: string;
  postgresSchema?: string;
  postgresUser?: string;
  postgresPassword?: string;
  cacheTTL?: number;
  enableCache?: boolean;
}

export interface CachedData<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  source: 'cache' | 'api';
}

export class MCPCacheManager {
  private config: CacheConfig;
  private client: OPNSenseAPIClient;
  private redisClient: Redis | null = null;
  private pgPool: any = null;
  private keyPrefix: string;

  constructor(client: OPNSenseAPIClient, config: CacheConfig = {}) {
    this.client = client;
    this.config = {
      redisHost: config.redisHost || process.env.REDIS_HOST || 'localhost',
      redisPort: config.redisPort || parseInt(process.env.REDIS_PORT || '6379'),
      redisPassword: config.redisPassword || process.env.REDIS_PASSWORD,
      redisDb: config.redisDb || parseInt(process.env.REDIS_DB || '0'),
      redisKeyPrefix: config.redisKeyPrefix || process.env.REDIS_KEY_PREFIX || 'opnsense:',
      postgresHost: config.postgresHost || process.env.POSTGRES_HOST || 'localhost',
      postgresPort: config.postgresPort || parseInt(process.env.POSTGRES_PORT || '5432'),
      postgresDb: config.postgresDb || process.env.POSTGRES_DB || 'opnsense_mcp',
      postgresSchema: config.postgresSchema || process.env.POSTGRES_SCHEMA || 'public',
      postgresUser: config.postgresUser || process.env.POSTGRES_USER || 'mcp_user',
      postgresPassword: config.postgresPassword || process.env.POSTGRES_PASSWORD,
      cacheTTL: config.cacheTTL || parseInt(process.env.CACHE_TTL || '300'),
      enableCache: config.enableCache !== false && process.env.ENABLE_CACHE !== 'false'
    };
    
    this.keyPrefix = this.config.redisKeyPrefix!;
    
    // Initialize connections
    // Don't auto-initialize - wait for connect() to be called
  }

  /**
   * Connect to cache services
   */
  async connect(): Promise<void> {
    await this.initializeConnections();
  }

  /**
   * Initialize database connections
   */
  private async initializeConnections(): Promise<void> {
    if (!this.config.enableCache) return;
    
    try {
      // Connect to Redis with optional authentication
      this.redisClient = new Redis({
        host: this.config.redisHost,
        port: this.config.redisPort,
        password: this.config.redisPassword,
        db: this.config.redisDb,
        keyPrefix: this.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.redisClient.on('connect', () => {
        console.log(`Connected to Redis at ${this.config.redisHost}:${this.config.redisPort} (using database ${this.config.redisDb})`);
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      // Connect to PostgreSQL
      this.pgPool = new Pool({
        host: this.config.postgresHost,
        port: this.config.postgresPort,
        database: this.config.postgresDb,
        user: this.config.postgresUser,
        password: this.config.postgresPassword,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Set search path to include opnsense schema
      await this.pgPool.query(`SET search_path TO ${this.config.postgresSchema}, public`);
      
      console.log(`Connected to PostgreSQL at ${this.config.postgresHost}:${this.config.postgresPort}/${this.config.postgresDb} (schema: ${this.config.postgresSchema})`);
    } catch (error) {
      console.error('Failed to initialize cache connections:', error);
    }
  }

  /**
   * Get data with caching
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<CachedData<T>> {
    if (!this.config.enableCache || !this.redisClient) {
      const data = await fetcher();
      return {
        data,
        timestamp: new Date(),
        ttl: 0,
        source: 'api'
      };
    }

    try {
      // Check Redis cache (key already has prefix from Redis client)
      const cached = await this.redisClient.get(key);
      if (cached) {
        await this.logCacheAccess(key, 'hit');
        return {
          data: JSON.parse(cached),
          timestamp: new Date(),
          ttl: ttl || this.config.cacheTTL!,
          source: 'cache'
        };
      }
    } catch (error) {
      console.error('Redis get error:', error);
    }

    // Fetch from API
    const data = await fetcher();
    
    // Store in Redis cache
    try {
      await this.redisClient!.setex(
        key,
        ttl || this.config.cacheTTL!,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Redis set error:', error);
    }
    
    // Log cache miss
    await this.logCacheAccess(key, 'miss');
    
    return {
      data,
      timestamp: new Date(),
      ttl: ttl || this.config.cacheTTL!,
      source: 'api'
    };
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      // Get all keys matching pattern (accounting for key prefix)
      const keys = await this.redisClient.keys(`${pattern}*`);
      
      if (keys.length > 0) {
        // Remove the key prefix before deleting
        const unprefixedKeys = keys.map(k => k.replace(this.keyPrefix, ''));
        await this.redisClient.del(...unprefixedKeys);
        console.log(`Invalidated ${keys.length} cache entries matching: ${this.keyPrefix}${pattern}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Simple key-value get (for plugins)
   */
  async getValue<T>(key: string): Promise<T | null> {
    if (!this.redisClient) return null;
    try {
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis getValue error:', error);
      return null;
    }
  }

  /**
   * Simple key-value set (for plugins)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.redisClient) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redisClient.setex(key, ttl, serialized);
      } else {
        await this.redisClient.set(key, serialized);
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  /**
   * Get cached firewall rules
   */
  async getFirewallRules(): Promise<CachedData<any[]>> {
    return this.get('cache:firewall:rules',
      () => this.client.searchFirewallRules(),
      300 // 5 minute cache
    );
  }

  /**
   * Get cached VLANs
   */
  async getVlans(): Promise<CachedData<any[]>> {
    return this.get('cache:network:vlans',
      () => this.client.searchVlans(),
      600 // 10 minute cache
    );
  }

  /**
   * Get cached interfaces
   */
  async getInterfaces(): Promise<CachedData<any>> {
    return this.get('cache:network:interfaces',
      () => this.client.get('/interfaces/overview/export'),
      1800 // 30 minute cache
    );
  }

  /**
   * Log operation for audit trail in PostgreSQL
   */
  async logOperation(operation: {
    type: string;
    target: string;
    action: string;
    result: 'success' | 'failure';
    params?: any;
    backupId?: string;
    error?: string;
    durationMs?: number;
  }): Promise<void> {
    if (!this.pgPool) return;

    try {
      const query = `
        INSERT INTO opnsense.operations 
        (operation_id, type, target, action, params, result, error_message, backup_id, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.pgPool.query(query, [
        operationId,
        operation.type,
        operation.target,
        operation.action,
        JSON.stringify(operation.params || {}),
        operation.result,
        operation.error || null,
        operation.backupId || null,
        operation.durationMs || null
      ]);

      // Also cache recent operations in Redis for quick access
      if (this.redisClient) {
        const recentKey = 'cache:operations:recent';
        await this.redisClient.lpush(recentKey, JSON.stringify({
          ...operation,
          operationId,
          timestamp: new Date()
        }));
        
        // Keep only last 100 operations
        await this.redisClient.ltrim(recentKey, 0, 99);
        await this.redisClient.expire(recentKey, 3600); // 1 hour TTL
      }
    } catch (error) {
      console.error('Failed to log operation:', error);
    }
  }

  /**
   * Get recent operations from cache or database
   */
  async getRecentOperations(limit: number = 10): Promise<any[]> {
    // Try Redis first
    if (this.redisClient) {
      try {
        const operations = await this.redisClient.lrange('cache:operations:recent', 0, limit - 1);
        if (operations.length > 0) {
          return operations.map(op => JSON.parse(op));
        }
      } catch (error) {
        console.error('Redis operations fetch error:', error);
      }
    }

    // Fall back to PostgreSQL
    if (this.pgPool) {
      try {
        const result = await this.pgPool.query(
          'SELECT * FROM opnsense.recent_operations LIMIT $1',
          [limit]
        );
        return result.rows;
      } catch (error) {
        console.error('PostgreSQL operations fetch error:', error);
      }
    }

    return [];
  }

  /**
   * Store command in Redis queue for async processing
   */
  async queueCommand(command: {
    id: string;
    type: string;
    params: any;
    priority?: number;
  }): Promise<void> {
    if (!this.redisClient) return;

    try {
      const queueKey = command.priority ? 'queue:commands:priority' : 'queue:commands:normal';
      await this.redisClient.lpush(queueKey, JSON.stringify({
        ...command,
        timestamp: new Date()
      }));
      
      console.log(`Queued command ${command.id} to ${queueKey}`);
    } catch (error) {
      console.error('Failed to queue command:', error);
    }
  }

  /**
   * Health check for cache services
   */
  async healthCheck(): Promise<{
    redis: boolean;
    postgres: boolean;
    redisInfo?: any;
    postgresInfo?: any;
  }> {
    const health: any = {
      redis: false,
      postgres: false
    };

    // Check Redis
    if (this.redisClient) {
      try {
        const pong = await this.redisClient.ping();
        health.redis = pong === 'PONG';
        
        if (health.redis) {
          const info = await this.redisClient.info('server');
          health.redisInfo = {
            version: info.match(/redis_version:(.+)/)?.[1],
            uptime: info.match(/uptime_in_seconds:(.+)/)?.[1]
          };
        }
      } catch (error) {
        console.error('Redis health check failed:', error);
      }
    }

    // Check PostgreSQL
    if (this.pgPool) {
      try {
        const result = await this.pgPool.query('SELECT version(), current_schema()');
        health.postgres = true;
        health.postgresInfo = {
          version: result.rows[0].version,
          schema: result.rows[0].current_schema
        };
      } catch (error) {
        console.error('PostgreSQL health check failed:', error);
      }
    }

    return health;
  }

  /**
   * Log cache access for analytics
   */
  private async logCacheAccess(key: string, result: 'hit' | 'miss'): Promise<void> {
    if (!this.pgPool) return;

    try {
      await this.pgPool.query(
        `INSERT INTO opnsense.cache_performance 
         (time, cache_key, hit_miss, response_time_ms, data_size_bytes)
         VALUES (NOW(), $1, $2, $3, $4)`,
        [key, result, 0, 0]
      );
    } catch (error) {
      // Don't fail operations due to logging errors
      console.error('Cache access logging error:', error);
    }
  }

  /**
   * Get cache statistics from PostgreSQL
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    recentStats: any[];
  }> {
    if (!this.pgPool) {
      return { hits: 0, misses: 0, hitRate: 0, recentStats: [] };
    }

    try {
      const result = await this.pgPool.query(
        'SELECT * FROM opnsense.cache_statistics LIMIT 24'
      );
      
      const totals = result.rows.reduce((acc: {hits: number, misses: number}, row: any) => ({
        hits: acc.hits + parseInt(row.hits),
        misses: acc.misses + parseInt(row.misses)
      }), { hits: 0, misses: 0 });

      return {
        ...totals,
        hitRate: totals.hits / (totals.hits + totals.misses) * 100 || 0,
        recentStats: result.rows
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { hits: 0, misses: 0, hitRate: 0, recentStats: [] };
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    if (this.pgPool) {
      await this.pgPool.end();
    }
  }
}

export default MCPCacheManager;
