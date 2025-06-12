// Drizzle ORM Schema for OPNSense MCP
import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  jsonb,
  boolean,
  numeric,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const operationResultEnum = pgEnum('operation_result', ['success', 'failure', 'partial']);
export const commandStatusEnum = pgEnum('command_status', ['pending', 'processing', 'completed', 'failed', 'cancelled']);
export const messageTypeEnum = pgEnum('message_type', ['request', 'response', 'event', 'error']);

// Tables
export const backups = pgTable('backups', {
  id: varchar('id', { length: 255 }).primaryKey(),
  filename: varchar('filename', { length: 255 }).notNull(),
  timestamp: timestamp('timestamp').notNull(),
  size: integer('size'),
  description: text('description'),
  checksum: varchar('checksum', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  timestampIdx: index('idx_backups_timestamp').on(table.timestamp),
}));

export const operations = pgTable('operations', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  target: varchar('target', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  result: operationResultEnum('result').notNull(),
  backupId: varchar('backup_id', { length: 255 }).references(() => backups.id, { onDelete: 'set null' }),
  error: text('error'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  timestampIdx: index('idx_operations_timestamp').on(table.timestamp),
  typeIdx: index('idx_operations_type').on(table.type),
  resultIdx: index('idx_operations_result').on(table.result),
}));

export const cacheStats = pgTable('cache_stats', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  hits: integer('hits').default(0),
  misses: integer('misses').default(0),
  lastAccess: timestamp('last_access'),
  avgResponseTime: numeric('avg_response_time', { precision: 10, scale: 2 }),
  dataSize: integer('data_size'),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  keyIdx: uniqueIndex('idx_cache_stats_key').on(table.key),
  hitsIdx: index('idx_cache_stats_hits').on(table.hits),
}));

export const commandQueue = pgTable('command_queue', {
  id: varchar('id', { length: 255 }).primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  params: jsonb('params').notNull(),
  priority: integer('priority').default(0),
  status: commandStatusEnum('status').default('pending'),
  result: jsonb('result'),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at')
}, (table) => ({
  statusIdx: index('idx_command_queue_status').on(table.status),
  priorityIdx: index('idx_command_queue_priority').on(table.priority),
  createdAtIdx: index('idx_command_queue_created').on(table.createdAt),
}));

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  conversationId: varchar('conversation_id', { length: 255 }).notNull(),
  messageType: messageTypeEnum('message_type').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  conversationIdIdx: index('idx_conversations_conversation_id').on(table.conversationId),
  timestampIdx: index('idx_conversations_timestamp').on(table.timestamp),
}));

export const configSnapshots = pgTable('config_snapshots', {
  id: serial('id').primaryKey(),
  snapshotId: varchar('snapshot_id', { length: 255 }).notNull().unique(),
  configType: varchar('config_type', { length: 50 }).notNull(),
  configData: jsonb('config_data').notNull(),
  changeSummary: text('change_summary'),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  snapshotIdIdx: uniqueIndex('idx_config_snapshots_snapshot_id').on(table.snapshotId),
  typeIdx: index('idx_config_snapshots_type').on(table.configType),
  timestampIdx: index('idx_config_snapshots_timestamp').on(table.timestamp),
}));

// New tables for enhanced caching
export const queryPatterns = pgTable('query_patterns', {
  id: serial('id').primaryKey(),
  pattern: varchar('pattern', { length: 255 }).notNull().unique(),
  frequency: integer('frequency').default(1),
  avgExecutionTime: numeric('avg_execution_time', { precision: 10, scale: 2 }),
  lastExecuted: timestamp('last_executed').defaultNow(),
  cachePriority: integer('cache_priority').default(0),
  suggestedTtl: integer('suggested_ttl').default(300),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  patternIdx: uniqueIndex('idx_query_patterns_pattern').on(table.pattern),
  frequencyIdx: index('idx_query_patterns_frequency').on(table.frequency),
  priorityIdx: index('idx_query_patterns_priority').on(table.cachePriority),
}));

export const cacheInvalidationRules = pgTable('cache_invalidation_rules', {
  id: serial('id').primaryKey(),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'operation', 'time', 'dependency'
  triggerPattern: varchar('trigger_pattern', { length: 255 }).notNull(),
  affectedPattern: varchar('affected_pattern', { length: 255 }).notNull(),
  enabled: boolean('enabled').default(true),
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  triggerTypeIdx: index('idx_invalidation_trigger_type').on(table.triggerType),
  enabledIdx: index('idx_invalidation_enabled').on(table.enabled),
}));

// Relations
export const operationsRelations = relations(operations, ({ one }) => ({
  backup: one(backups, {
    fields: [operations.backupId],
    references: [backups.id],
  }),
}));

// Type exports for TypeScript
export type Backup = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;
export type Operation = typeof operations.$inferSelect;
export type NewOperation = typeof operations.$inferInsert;
export type CacheStat = typeof cacheStats.$inferSelect;
export type NewCacheStat = typeof cacheStats.$inferInsert;
export type CommandQueueItem = typeof commandQueue.$inferSelect;
export type NewCommandQueueItem = typeof commandQueue.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConfigSnapshot = typeof configSnapshots.$inferSelect;
export type NewConfigSnapshot = typeof configSnapshots.$inferInsert;
export type QueryPattern = typeof queryPatterns.$inferSelect;
export type NewQueryPattern = typeof queryPatterns.$inferInsert;
export type CacheInvalidationRule = typeof cacheInvalidationRules.$inferSelect;
export type NewCacheInvalidationRule = typeof cacheInvalidationRules.$inferInsert;

// Export all tables from network-query/schema for convenience
export { 
  deviceTypeEnum,
  deviceStatusEnum,
  connectionTypeEnum,
  deviceFingerprints,
  hostnamePatterns,
  networkInterfaces,
  devices,
  dhcpLeases,
  trafficStats,
  activeConnections,
  queryIntents,
  queryKeywords,
  deviceGroups,
  deviceGroupMembers,
  deviceSummaryView,
  queryPerformance
} from './network-query/schema';
