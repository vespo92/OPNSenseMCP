// Natural Language Query Processor
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { queryIntents as queryIntentDefinitions } from './query-engine';
import { 
  devices, 
  deviceSummaryView, 
  queryPerformance,
  queryIntents as queryIntentsTable,
  queryKeywords
} from './schema';
import { eq, sql, and, or, desc } from 'drizzle-orm';
import * as crypto from 'crypto';

export class NaturalLanguageQueryProcessor {
  private db: ReturnType<typeof drizzle>;
  
  constructor(connectionString: string) {
    const pool = new Pool({ connectionString });
    this.db = drizzle(pool);
  }
  
  // Main query processing method
  async processQuery(naturalQuery: string): Promise<{
    results: any[];
    executionTime: number;
    intent: string;
    confidence: number;
  }> {
    const startTime = Date.now();
    
    // 1. Identify intent
    const { intent, confidence, params } = this.identifyIntent(naturalQuery);
    
    if (!intent) {
      throw new Error('Could not understand the query. Please try rephrasing.');
    }
    
    // 2. Build and execute query
    const intentHandler = queryIntentDefinitions.find(q => q.intent === intent);
    if (!intentHandler) {
      throw new Error(`No handler found for intent: ${intent}`);
    }
    
    const queryParams = intentHandler.paramExtractor(naturalQuery);
    const query = intentHandler.queryBuilder({ ...params, ...queryParams });
    
    // 3. Execute with performance tracking
    const results = await this.executeOptimizedQuery(query);
    const executionTime = Date.now() - startTime;
    
    // 4. Log performance
    await this.logQueryPerformance(naturalQuery, query, executionTime, results.length);
    
    return {
      results,
      executionTime,
      intent,
      confidence
    };
  }
  
  // Intent identification using keyword matching and scoring
  private identifyIntent(query: string): { 
    intent: string | null; 
    confidence: number; 
    params: any;
  } {
    const lowerQuery = query.toLowerCase();
    const scores: Map<string, number> = new Map();
    
    // Score each intent based on keyword matches
    for (const intentDef of queryIntentDefinitions) {
      let score = 0;
      let matchedKeywords = 0;
      
      for (const keyword of intentDef.keywords) {
        if (lowerQuery.includes(keyword)) {
          score += keyword.length; // Longer keywords get higher scores
          matchedKeywords++;
        }
      }
      
      // Bonus for multiple keyword matches
      if (matchedKeywords > 1) {
        score *= 1.5;
      }
      
      scores.set(intentDef.intent, score);
    }
    
    // Find highest scoring intent
    let bestIntent: string | null = null;
    let bestScore = 0;
    
    for (const [intent, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }
    
    // Calculate confidence (0-1)
    const confidence = bestScore > 0 ? Math.min(bestScore / 20, 1) : 0;
    
    return {
      intent: bestIntent,
      confidence,
      params: {}
    };
  }
  
  // Execute query with optimizations
  private async executeOptimizedQuery(queryDef: any): Promise<any[]> {
    // Build the actual Drizzle query
    let query: any = this.db.select(queryDef.select);
    
    if (queryDef.from) {
      query = query.from(queryDef.from);
    }
    
    if (queryDef.innerJoin) {
      query = query.innerJoin(queryDef.innerJoin, queryDef.on);
    }
    
    if (queryDef.where) {
      query = query.where(queryDef.where);
    }
    
    if (queryDef.groupBy) {
      query = query.groupBy(...queryDef.groupBy);
    }
    
    if (queryDef.having) {
      query = query.having(queryDef.having);
    }
    
    if (queryDef.orderBy) {
      query = query.orderBy(...queryDef.orderBy);
    }
    
    if (queryDef.limit) {
      query = query.limit(queryDef.limit);
    }
    
    return await query;
  }
  
  // Log query performance for analysis
  private async logQueryPerformance(
    naturalQuery: string,
    sqlQuery: any,
    executionTime: number,
    resultCount: number
  ): Promise<void> {
    const queryHash = crypto
      .createHash('md5')
      .update(naturalQuery)
      .digest('hex');
    
    await this.db.insert(queryPerformance).values({
      queryHash,
      naturalQuery,
      sqlQuery: JSON.stringify(sqlQuery), // Store as JSON for analysis
      executionTime: executionTime.toString(),
      resultCount,
      timestamp: new Date()
    });
  }
  
  // Update device summary materialized view
  async updateDeviceSummaryView(): Promise<void> {
    // This would typically be a database trigger or scheduled job
    // For now, we'll update it manually
    await this.db.execute(sql`
      INSERT INTO device_summary_view (
        device_id, mac_address, device_type, friendly_name, 
        current_ip, interface_name, vlan_id, is_online, 
        last_seen, daily_data_usage, active_connections, 
        group_names, last_updated
      )
      SELECT 
        d.id,
        d.mac_address,
        d.device_type,
        d.friendly_name,
        dl.ip_address,
        dl.interface_name,
        ni.vlan_id,
        CASE 
          WHEN d.last_seen > NOW() - INTERVAL '5 minutes' THEN true 
          ELSE false 
        END as is_online,
        d.last_seen,
        COALESCE(
          (SELECT SUM(bytes_in + bytes_out) 
           FROM traffic_stats 
           WHERE device_id = d.id 
           AND timestamp >= CURRENT_DATE), 
          0
        ) as daily_data_usage,
        (SELECT COUNT(*) 
         FROM active_connections 
         WHERE device_id = d.id) as active_connections,
        ARRAY(
          SELECT dg.group_name 
          FROM device_groups dg 
          JOIN device_group_members dgm ON dg.id = dgm.group_id 
          WHERE dgm.device_id = d.id
        ) as group_names,
        NOW()
      FROM devices d
      LEFT JOIN dhcp_leases dl ON d.mac_address = dl.mac_address 
        AND dl.is_active = true
      LEFT JOIN network_interfaces ni ON dl.interface_name = ni.interface_name
      ON CONFLICT (device_id) DO UPDATE SET
        current_ip = EXCLUDED.current_ip,
        interface_name = EXCLUDED.interface_name,
        vlan_id = EXCLUDED.vlan_id,
        is_online = EXCLUDED.is_online,
        last_seen = EXCLUDED.last_seen,
        daily_data_usage = EXCLUDED.daily_data_usage,
        active_connections = EXCLUDED.active_connections,
        group_names = EXCLUDED.group_names,
        last_updated = NOW()
    `);
  }
  
  // Get query suggestions based on history
  async getQuerySuggestions(partialQuery: string): Promise<string[]> {
    const suggestions = await this.db
      .select({
        query: queryPerformance.naturalQuery
      })
      .from(queryPerformance)
      .where(sql`${queryPerformance.naturalQuery} ILIKE ${partialQuery + '%'}`)
      .orderBy(desc(queryPerformance.timestamp))
      .limit(5);
    
    return suggestions.map(s => s.query);
  }
}