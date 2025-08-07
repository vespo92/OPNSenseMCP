// Enhanced MCP Cache Manager with Drizzle ORM
import { OPNSenseAPIClient } from '../api/client.js';
import Redis from 'ioredis';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { 
  getDb, 
  Database,
  cacheStats,
  operations,
  queryPatterns,
  cacheInvalidationRules,
  commandQueue,
  NewOperation,
  NewCacheStat,
  QueryPattern,
  CacheInvalidationRule
} from '../db/index.js';

// Promisify zlib functions for async/await
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface EnhancedCacheConfig {
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    cluster?: boolean;
    sentinels?: Array<{ host: string; port: number }>;
  };
  cache?: {
    defaultTTL?: number;
    maxTTL?: number;
    minTTL?: number;
    compressionThreshold?: number;
    compressionLevel?: number;
    enableCompression?: boolean;
    enableSmartInvalidation?: boolean;
    enablePatternAnalysis?: boolean;
  };
  performance?: {
    batchSize?: number;
    maxConcurrency?: number;
    timeoutMs?: number;
  };
}

export interface CachedData<T> {
  data: T;
  metadata: {
    timestamp: Date;
    ttl: number;
    source: 'cache' | 'api' | 'batch';
    compressionRatio?: number;
    executionTime?: number;
    pattern?: string;
  };
}

interface CacheKey {
  raw: string;
  prefixed: string;
  pattern: string;
  resource: string;
  operation: string;
}

export class EnhancedCacheManager {
  private config: Required<EnhancedCacheConfig>;
  private client: OPNSenseAPIClient;
  private redis: Redis | null = null;
  private db: Database;
  private patternCache: Map<string, QueryPattern> = new Map();
  private invalidationRules: CacheInvalidationRule[] = [];

  constructor(client: OPNSenseAPIClient, config: EnhancedCacheConfig = {}) {
    this.client = client;
    this.config = this.mergeConfig(config);
    this.db = getDb();
    
    this.initializeConnections();
  }

  private mergeConfig(config: EnhancedCacheConfig): Required<EnhancedCacheConfig> {
    return {
      redis: {
        host: config.redis?.host || process.env.REDIS_HOST || 'localhost',
        port: config.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
        password: config.redis?.password || process.env.REDIS_PASSWORD,
        db: config.redis?.db || parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: config.redis?.keyPrefix || 'opnsense:',
        cluster: config.redis?.cluster || false,
        sentinels: config.redis?.sentinels || []
      },
      cache: {
        defaultTTL: config.cache?.defaultTTL || 300,
        maxTTL: config.cache?.maxTTL || 3600,
        minTTL: config.cache?.minTTL || 60,
        compressionThreshold: config.cache?.compressionThreshold || 1024,
        enableCompression: config.cache?.enableCompression ?? true,
        enableSmartInvalidation: config.cache?.enableSmartInvalidation ?? true,
        enablePatternAnalysis: config.cache?.enablePatternAnalysis ?? true
      },
      performance: {
        batchSize: config.performance?.batchSize || 100,
        maxConcurrency: config.performance?.maxConcurrency || 10,
        timeoutMs: config.performance?.timeoutMs || 5000
      }
    };
  }

  private async initializeConnections(): Promise<void> {
    try {
      // Initialize Redis with clustering support
      if (this.config.redis.cluster && this.config.redis.sentinels && this.config.redis.sentinels.length > 0) {
        this.redis = new Redis({
          sentinels: this.config.redis.sentinels,
          name: 'mymaster',
          password: this.config.redis.password,
          db: this.config.redis.db,
          keyPrefix: this.config.redis.keyPrefix
        });
      } else {
        this.redis = new Redis({
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          db: this.config.redis.db,
          keyPrefix: this.config.redis.keyPrefix,
          enableOfflineQueue: true,
          maxRetriesPerRequest: 3
        });
      }

      this.redis.on('ready', () => {
        console.log('✅ Redis connection established');
      });

      // Load invalidation rules
      await this.loadInvalidationRules();

      // Start pattern analysis worker
      if (this.config.cache.enablePatternAnalysis) {
        this.startPatternAnalysis();
      }

    } catch (error) {
      console.error('Failed to initialize cache connections:', error);
    }
  }

  /**
   * Parse cache key into components
   */
  private parseKey(key: string): CacheKey {
    const parts = key.split(':');
    return {
      raw: key,
      prefixed: `${this.config.redis.keyPrefix}${key}`,
      pattern: parts.slice(0, -1).join(':') + ':*',
      resource: parts[1] || 'unknown',
      operation: parts[2] || 'unknown'
    };
  }

  /**
   * Enhanced get with pattern analysis and smart TTL
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      ttl?: number;
      compress?: boolean;
      forceFetch?: boolean;
      pattern?: string;
    }
  ): Promise<CachedData<T>> {
    const startTime = Date.now();
    const keyInfo = this.parseKey(key);
    
    // Check if forced fetch
    if (options?.forceFetch) {
      return this.fetchAndCache(keyInfo, fetcher, options);
    }

    // Try to get from cache
    try {
      if (this.redis) {
        const cached = await this.redis.get(key);
        if (cached) {
          const data = await this.deserialize<T>(cached);
          const executionTime = Date.now() - startTime;
          
          // Update cache statistics
          await this.updateCacheStats(keyInfo, true, executionTime, cached.length);
          
          return {
            data,
            metadata: {
              timestamp: new Date(),
              ttl: await this.redis.ttl(key),
              source: 'cache',
              executionTime,
              pattern: keyInfo.pattern
            }
          };
        }
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }

    // Cache miss - fetch from API
    return this.fetchAndCache(keyInfo, fetcher, options);
  }

  /**
   * Batch get operation for multiple keys
   */
  async getBatch<T>(
    requests: Array<{
      key: string;
      fetcher: () => Promise<T>;
      ttl?: number;
    }>
  ): Promise<Map<string, CachedData<T>>> {
    const results = new Map<string, CachedData<T>>();
    
    if (!this.redis) {
      // No cache - fetch all
      for (const req of requests) {
        const data = await req.fetcher();
        results.set(req.key, {
          data,
          metadata: {
            timestamp: new Date(),
            ttl: 0,
            source: 'api',
            executionTime: 0
          }
        });
      }
      return results;
    }

    // Get all keys from cache
    const keys = requests.map(r => r.key);
    const cached = await this.redis.mget(...keys);
    
    // Process results and identify misses
    const misses: typeof requests = [];
    
    for (let index = 0; index < cached.length; index++) {
      const value = cached[index];
      if (value) {
        const data = await this.deserialize<T>(value);
        results.set(requests[index].key, {
          data,
          metadata: {
            timestamp: new Date(),
            ttl: requests[index].ttl || this.config.cache?.defaultTTL || 300,
            source: 'cache'
          }
        });
      } else {
        misses.push(requests[index]);
      }
    }

    // Fetch misses in parallel with concurrency control
    const chunks = this.chunk(misses, this.config.performance?.maxConcurrency || 10);
    
    for (const chunk of chunks) {
      const fetchPromises = chunk.map(async (req) => {
        const data = await req.fetcher();
        const keyInfo = this.parseKey(req.key);
        
        // Cache the result
        const ttl = await this.calculateSmartTTL(keyInfo, req.ttl);
        const serialized = await this.serialize(data);
        
        await this.redis!.setex(req.key, ttl, serialized.toString());
        
        results.set(req.key, {
          data,
          metadata: {
            timestamp: new Date(),
            ttl,
            source: 'batch'
          }
        });
      });
      
      await Promise.all(fetchPromises);
    }

    return results;
  }

  /**
   * Smart cache invalidation based on patterns and rules
   */
  async invalidate(pattern: string, options?: {
    cascade?: boolean;
    reason?: string;
  }): Promise<void> {
    if (!this.redis) return;

    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      // Get keys matching pattern
      const keys = await this.scanKeys(pattern);
      invalidatedCount = keys.length;
      
      if (keys.length > 0) {
        // Delete keys in batches
        const chunks = this.chunk(keys, this.config.performance?.batchSize || 100);
        for (const chunk of chunks) {
          await this.redis.del(...chunk);
        }
      }

      // Apply cascade invalidation if enabled
      if (options?.cascade && this.config.cache.enableSmartInvalidation) {
        const cascadePatterns = await this.getCascadePatterns(pattern);
        for (const cascadePattern of cascadePatterns) {
          await this.invalidate(cascadePattern, { cascade: false });
        }
      }

      // Log the invalidation
      await this.logOperation({
        type: 'cache_invalidation',
        target: pattern,
        action: 'invalidate',
        result: 'success',
        metadata: {
          invalidatedCount,
          cascade: options?.cascade || false,
          reason: options?.reason,
          executionTime: Date.now() - startTime
        }
      });

    } catch (error) {
      console.error('Cache invalidation error:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics and insights
   */
  async getStatistics(): Promise<{
    overall: {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
    };
    byResource: Map<string, any>;
    patterns: Array<{
      pattern: string;
      frequency: number;
      suggestedTtl: number;
      cachePriority: number;
    }>;
    recommendations: string[];
  }> {
    // Get overall statistics
    const stats = await this.db
      .select({
        totalHits: sql<number>`sum(${cacheStats.hits})`,
        totalMisses: sql<number>`sum(${cacheStats.misses})`,
        avgResponseTime: sql<number>`avg(${cacheStats.avgResponseTime})`
      })
      .from(cacheStats);

    const overall = stats[0] || { totalHits: 0, totalMisses: 0, avgResponseTime: 0 };
    const hitRate = overall.totalHits / (overall.totalHits + overall.totalMisses) * 100 || 0;

    // Get statistics by resource
    const resourceStats = await this.db
      .select({
        resource: sql<string>`split_part(${cacheStats.key}, ':', 2)`,
        hits: sql<number>`sum(${cacheStats.hits})`,
        misses: sql<number>`sum(${cacheStats.misses})`,
        avgResponseTime: sql<number>`avg(${cacheStats.avgResponseTime})`
      })
      .from(cacheStats)
      .groupBy(sql`split_part(${cacheStats.key}, ':', 2)`);

    const byResource = new Map(
      resourceStats.map(r => [r.resource, r])
    );

    // Get query patterns with non-null values
    const patternsRaw = await this.db
      .select()
      .from(queryPatterns)
      .orderBy(desc(queryPatterns.frequency))
      .limit(20);
    
    const patterns = patternsRaw.map(p => ({
      pattern: p.pattern,
      frequency: p.frequency || 0,
      suggestedTtl: p.suggestedTtl || this.config.cache?.defaultTTL || 300,
      cachePriority: p.cachePriority || 0
    }));

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      hitRate,
      avgResponseTime: overall.avgResponseTime,
      patterns,
      resourceStats
    });

    return {
      overall: {
        hits: overall.totalHits,
        misses: overall.totalMisses,
        hitRate,
        avgResponseTime: overall.avgResponseTime
      },
      byResource,
      patterns,
      recommendations
    };
  }

  /**
   * Private helper methods
   */
  
  private async fetchAndCache<T>(
    keyInfo: CacheKey,
    fetcher: () => Promise<T>,
    options?: any
  ): Promise<CachedData<T>> {
    const startTime = Date.now();
    
    try {
      const data = await fetcher();
      const executionTime = Date.now() - startTime;
      
      // Calculate smart TTL based on patterns
      const ttl = await this.calculateSmartTTL(keyInfo, options?.ttl);
      
      // Cache the result
      if (this.redis) {
        const serialized = await this.serialize(data);
        await this.redis.setex(keyInfo.raw, ttl, serialized.toString());
      }
      
      // Update statistics
      await this.updateCacheStats(keyInfo, false, executionTime, 0);
      
      // Update query patterns
      if (this.config.cache.enablePatternAnalysis) {
        await this.updateQueryPattern(keyInfo, executionTime);
      }
      
      return {
        data,
        metadata: {
          timestamp: new Date(),
          ttl,
          source: 'api',
          executionTime,
          pattern: keyInfo.pattern
        }
      };
    } catch (error) {
      console.error('Fetch and cache error:', error);
      throw error;
    }
  }

  private async calculateSmartTTL(keyInfo: CacheKey, requestedTTL?: number): Promise<number> {
    if (requestedTTL) {
      return Math.min(Math.max(requestedTTL, this.config.cache?.minTTL || 60), this.config.cache?.maxTTL || 3600);
    }

    // Check if we have pattern data
    const pattern = this.patternCache.get(keyInfo.pattern);
    if (pattern && pattern.suggestedTtl) {
      return pattern.suggestedTtl;
    }

    // Default TTL based on resource type
    const resourceTTLs: Record<string, number> = {
      'firewall': 300,    // 5 minutes
      'network': 600,     // 10 minutes
      'system': 1800,     // 30 minutes
      'backup': 3600,     // 1 hour
      'dhcp': 120,        // 2 minutes (more dynamic)
    };

    return resourceTTLs[keyInfo.resource] || this.config.cache?.defaultTTL || 300;
  }

  private async updateCacheStats(
    keyInfo: CacheKey,
    hit: boolean,
    responseTime: number,
    dataSize: number
  ): Promise<void> {
    try {
      await this.db.insert(cacheStats)
        .values({
          key: keyInfo.raw,
          hits: hit ? 1 : 0,
          misses: hit ? 0 : 1,
          lastAccess: new Date(),
          avgResponseTime: responseTime.toString(),
          dataSize
        })
        .onConflictDoUpdate({
          target: cacheStats.key,
          set: {
            hits: hit ? sql`COALESCE(${cacheStats.hits}, 0) + 1` : sql`${cacheStats.hits}`,
            misses: hit ? sql`${cacheStats.misses}` : sql`COALESCE(${cacheStats.misses}, 0) + 1`,
            lastAccess: new Date(),
            avgResponseTime: sql`((${cacheStats.avgResponseTime} * (${cacheStats.hits} + ${cacheStats.misses}) + ${responseTime}) / (${cacheStats.hits} + ${cacheStats.misses} + 1))`,
            dataSize
          }
        });
    } catch (error) {
      console.error('Failed to update cache stats:', error);
    }
  }

  private async updateQueryPattern(keyInfo: CacheKey, executionTime: number): Promise<void> {
    try {
      await this.db.insert(queryPatterns)
        .values({
          pattern: keyInfo.pattern,
          frequency: 1,
          avgExecutionTime: executionTime.toString(),
          lastExecuted: new Date(),
          cachePriority: 0,
          suggestedTtl: this.config.cache?.defaultTTL || 300
        })
        .onConflictDoUpdate({
          target: queryPatterns.pattern,
          set: {
            frequency: sql`${queryPatterns.frequency} + 1`,
            avgExecutionTime: sql`((${queryPatterns.avgExecutionTime} * ${queryPatterns.frequency} + ${executionTime}) / (${queryPatterns.frequency} + 1))`,
            lastExecuted: new Date(),
            cachePriority: sql`
              CASE 
                WHEN ${queryPatterns.frequency} > 100 AND ${queryPatterns.avgExecutionTime} > 1000 THEN 10
                WHEN ${queryPatterns.frequency} > 50 AND ${queryPatterns.avgExecutionTime} > 500 THEN 5
                WHEN ${queryPatterns.frequency} > 10 THEN 1
                ELSE 0
              END
            `
          }
        });

      // Update local cache
      const updated = await this.db.select()
        .from(queryPatterns)
        .where(eq(queryPatterns.pattern, keyInfo.pattern))
        .limit(1);
      
      if (updated[0]) {
        this.patternCache.set(keyInfo.pattern, updated[0]);
      }
    } catch (error) {
      console.error('Failed to update query pattern:', error);
    }
  }

  private async loadInvalidationRules(): Promise<void> {
    try {
      const rules = await this.db.select()
        .from(cacheInvalidationRules)
        .where(eq(cacheInvalidationRules.enabled, true))
        .orderBy(desc(cacheInvalidationRules.priority));
      
      this.invalidationRules = rules;
    } catch (error) {
      console.error('Failed to load invalidation rules:', error);
    }
  }

  private async getCascadePatterns(pattern: string): Promise<string[]> {
    return this.invalidationRules
      .filter(rule => rule.triggerPattern === pattern)
      .map(rule => rule.affectedPattern);
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    if (!this.redis) return [];
    
    const keys: string[] = [];
    const stream = this.redis.scanStream({
      match: `${this.config.redis.keyPrefix}${pattern}`,
      count: this.config.performance.batchSize
    });

    return new Promise((resolve, reject) => {
      stream.on('data', (resultKeys) => {
        keys.push(...resultKeys.map((k: string) => 
          k.replace(this.config.redis?.keyPrefix || 'opnsense:', '')
        ));
      });
      stream.on('end', () => resolve(keys));
      stream.on('error', reject);
    });
  }

  private async logOperation(operation: Omit<NewOperation, 'timestamp'>): Promise<void> {
    try {
      await this.db.insert(operations).values({
        ...operation,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log operation:', error);
    }
  }

  private async serialize(data: any): Promise<Buffer> {
    const json = JSON.stringify(data);
    
    // Compress if enabled and data is large enough
    if (this.config.cache?.enableCompression && 
        json.length > (this.config.cache?.compressionThreshold || 1024)) {
      const compressed = await gzip(json, {
        level: this.config.cache.compressionLevel || 6
      });
      
      // Add a marker to indicate this is compressed data
      const marker = Buffer.from('GZIP:');
      return Buffer.concat([marker, compressed]);
    }
    
    return Buffer.from(json);
  }

  private async deserialize<T>(buffer: Buffer | string): Promise<T> {
    // Convert string to buffer if needed
    const data = typeof buffer === 'string' ? Buffer.from(buffer) : buffer;
    
    // Check for compression marker
    if (data.length > 5 && data.slice(0, 5).toString() === 'GZIP:') {
      // Data is compressed, decompress it
      const compressed = data.slice(5);
      const decompressed = await gunzip(compressed);
      return JSON.parse(decompressed.toString());
    }
    
    // Data is not compressed
    return JSON.parse(data.toString());
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private generateRecommendations(stats: any): string[] {
    const recommendations: string[] = [];
    
    if (stats.hitRate < 70) {
      recommendations.push('Consider increasing cache TTL for frequently accessed resources');
    }
    
    if (stats.avgResponseTime > 1000) {
      recommendations.push('High average response time detected. Consider pre-warming cache for critical paths');
    }
    
    // Analyze patterns for optimization opportunities
    const highFreqSlowPatterns = stats.patterns.filter((p: any) => 
      p.frequency > 50 && p.avgExecutionTime > 500
    );
    
    if (highFreqSlowPatterns.length > 0) {
      recommendations.push(`Optimize caching for slow, frequent queries: ${highFreqSlowPatterns.map((p: any) => p.pattern).join(', ')}`);
    }
    
    return recommendations;
  }

  private startPatternAnalysis(): void {
    // Analyze patterns every 5 minutes
    setInterval(async () => {
      try {
        // Update suggested TTLs based on access patterns
        const patterns = await this.db.select()
          .from(queryPatterns)
          .where(gte(queryPatterns.lastExecuted, sql`NOW() - INTERVAL '1 hour'`));
        
        for (const pattern of patterns) {
          // Calculate optimal TTL based on frequency and execution time
          const optimalTTL = this.calculateOptimalTTL(pattern);
          
          await this.db.update(queryPatterns)
            .set({ suggestedTtl: optimalTTL })
            .where(eq(queryPatterns.id, pattern.id));
        }
      } catch (error) {
        console.error('Pattern analysis error:', error);
      }
    }, 5 * 60 * 1000);
  }

  private calculateOptimalTTL(pattern: any): number {
    // High frequency + slow execution = longer TTL
    // Low frequency + fast execution = shorter TTL
    const frequencyFactor = Math.min(pattern.frequency / 100, 2);
    const executionFactor = Math.min(pattern.avgExecutionTime / 1000, 2);
    
    const baseTTL = this.config.cache?.defaultTTL || 300;
    const calculatedTTL = baseTTL * (1 + frequencyFactor + executionFactor);
    
    return Math.min(Math.max(calculatedTTL, this.config.cache?.minTTL || 60), this.config.cache?.maxTTL || 3600);
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export default EnhancedCacheManager;
