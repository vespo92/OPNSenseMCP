// Network Query Engine Schema for OPNSense
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
  uniqueIndex,
  bigint,
  inet,
  macaddr,
  uuid
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const deviceTypeEnum = pgEnum('device_type', [
  'computer', 'phone', 'tablet', 'gaming_console', 'smart_tv', 
  'iot_device', 'smart_speaker', 'camera', 'printer', 'router', 
  'nas', 'media_player', 'smart_home', 'wearable', 'unknown'
]);

export const deviceStatusEnum = pgEnum('device_status', ['online', 'offline', 'sleeping', 'unknown']);
export const connectionTypeEnum = pgEnum('connection_type', ['ethernet', 'wifi_2.4ghz', 'wifi_5ghz', 'wifi_6ghz']);

// Device Fingerprinting Tables
export const deviceFingerprints = pgTable('device_fingerprints', {
  id: serial('id').primaryKey(),
  macPrefix: varchar('mac_prefix', { length: 8 }).notNull(), // First 6 chars of MAC
  manufacturer: varchar('manufacturer', { length: 255 }).notNull(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  commonModels: jsonb('common_models').$type<string[]>(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).default('0.90'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  macPrefixIdx: uniqueIndex('idx_fingerprints_mac_prefix').on(table.macPrefix),
  manufacturerIdx: index('idx_fingerprints_manufacturer').on(table.manufacturer),
  deviceTypeIdx: index('idx_fingerprints_device_type').on(table.deviceType)
}));

export const hostnamePatterns = pgTable('hostname_patterns', {
  id: serial('id').primaryKey(),
  pattern: varchar('pattern', { length: 255 }).notNull(), // Regex pattern
  deviceType: deviceTypeEnum('device_type').notNull(),
  description: text('description'),
  priority: integer('priority').default(0),
  examples: jsonb('examples').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  patternIdx: index('idx_hostname_patterns_pattern').on(table.pattern),
  deviceTypeIdx: index('idx_hostname_patterns_device_type').on(table.deviceType),
  priorityIdx: index('idx_hostname_patterns_priority').on(table.priority)
}));

// Network Topology Tables
export const networkInterfaces = pgTable('network_interfaces', {
  id: serial('id').primaryKey(),
  interfaceName: varchar('interface_name', { length: 50 }).notNull().unique(),
  description: text('description'),
  vlanId: integer('vlan_id'),
  ipAddress: inet('ip_address'),
  subnet: varchar('subnet', { length: 20 }),
  isGuest: boolean('is_guest').default(false),
  isIot: boolean('is_iot').default(false),
  isTrusted: boolean('is_trusted').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  interfaceNameIdx: uniqueIndex('idx_interfaces_name').on(table.interfaceName),
  vlanIdIdx: index('idx_interfaces_vlan').on(table.vlanId)
}));

// Device Tracking Tables
export const devices = pgTable('devices', {
  id: serial('id').primaryKey(),
  macAddress: macaddr('mac_address').notNull().unique(),
  deviceType: deviceTypeEnum('device_type').default('unknown'),
  manufacturer: varchar('manufacturer', { length: 255 }),
  hostname: varchar('hostname', { length: 255 }),
  friendlyName: varchar('friendly_name', { length: 255 }),
  firstSeen: timestamp('first_seen').defaultNow(),
  lastSeen: timestamp('last_seen').defaultNow(),
  totalDataSent: bigint('total_data_sent', { mode: 'number' }).default(0),
  totalDataReceived: bigint('total_data_received', { mode: 'number' }).default(0),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  macAddressIdx: uniqueIndex('idx_devices_mac').on(table.macAddress),
  deviceTypeIdx: index('idx_devices_type').on(table.deviceType),
  hostnameIdx: index('idx_devices_hostname').on(table.hostname),
  lastSeenIdx: index('idx_devices_last_seen').on(table.lastSeen),
  friendlyNameIdx: index('idx_devices_friendly_name').on(table.friendlyName)
}));

// DHCP Lease Tracking
export const dhcpLeases = pgTable('dhcp_leases', {
  id: serial('id').primaryKey(),
  macAddress: macaddr('mac_address').notNull(),
  ipAddress: inet('ip_address').notNull(),
  hostname: varchar('hostname', { length: 255 }),
  interfaceName: varchar('interface_name', { length: 50 }).notNull(),
  leaseStart: timestamp('lease_start').notNull(),
  leaseEnd: timestamp('lease_end').notNull(),
  isActive: boolean('is_active').default(true),
  vendorClassId: varchar('vendor_class_id', { length: 255 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  macIpIdx: uniqueIndex('idx_dhcp_mac_ip').on(table.macAddress, table.ipAddress),
  activeIdx: index('idx_dhcp_active').on(table.isActive),
  interfaceIdx: index('idx_dhcp_interface').on(table.interfaceName),
  leaseEndIdx: index('idx_dhcp_lease_end').on(table.leaseEnd)
}));

// Traffic Statistics
export const trafficStats = pgTable('traffic_stats', {
  id: serial('id').primaryKey(),
  deviceId: integer('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp').notNull(),
  bytesIn: bigint('bytes_in', { mode: 'number' }).default(0),
  bytesOut: bigint('bytes_out', { mode: 'number' }).default(0),
  packetsIn: bigint('packets_in', { mode: 'number' }).default(0),
  packetsOut: bigint('packets_out', { mode: 'number' }).default(0),
  connections: integer('connections').default(0),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  deviceTimestampIdx: index('idx_traffic_device_timestamp').on(table.deviceId, table.timestamp),
  timestampIdx: index('idx_traffic_timestamp').on(table.timestamp)
}));

// Real-time Connection States
export const activeConnections = pgTable('active_connections', {
  id: serial('id').primaryKey(),
  deviceId: integer('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  protocol: varchar('protocol', { length: 10 }).notNull(),
  sourcePort: integer('source_port'),
  destIp: inet('dest_ip').notNull(),
  destPort: integer('dest_port').notNull(),
  state: varchar('state', { length: 20 }),
  bytesTransferred: bigint('bytes_transferred', { mode: 'number' }).default(0),
  startTime: timestamp('start_time').defaultNow(),
  lastActivity: timestamp('last_activity').defaultNow(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  deviceIdx: index('idx_connections_device').on(table.deviceId),
  destIdx: index('idx_connections_dest').on(table.destIp, table.destPort),
  lastActivityIdx: index('idx_connections_activity').on(table.lastActivity)
}));

// Natural Language Query Mapping
export const queryIntents = pgTable('query_intents', {
  id: serial('id').primaryKey(),
  intent: varchar('intent', { length: 100 }).notNull().unique(),
  description: text('description'),
  queryTemplate: text('query_template').notNull(), // SQL template
  requiredParams: jsonb('required_params').$type<string[]>(),
  examples: jsonb('examples').$type<string[]>(),
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  intentIdx: uniqueIndex('idx_intents_intent').on(table.intent),
  priorityIdx: index('idx_intents_priority').on(table.priority)
}));

export const queryKeywords = pgTable('query_keywords', {
  id: serial('id').primaryKey(),
  keyword: varchar('keyword', { length: 100 }).notNull(),
  intentId: integer('intent_id').notNull().references(() => queryIntents.id, { onDelete: 'cascade' }),
  synonyms: jsonb('synonyms').$type<string[]>(),
  weight: numeric('weight', { precision: 3, scale: 2 }).default('1.00'),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  keywordIdx: index('idx_keywords_keyword').on(table.keyword),
  intentIdx: index('idx_keywords_intent').on(table.intentId)
}));

// Device Groups and User Associations
export const deviceGroups = pgTable('device_groups', {
  id: serial('id').primaryKey(),
  groupName: varchar('group_name', { length: 100 }).notNull().unique(),
  description: text('description'),
  ownerName: varchar('owner_name', { length: 100 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  groupNameIdx: uniqueIndex('idx_groups_name').on(table.groupName),
  ownerIdx: index('idx_groups_owner').on(table.ownerName)
}));

export const deviceGroupMembers = pgTable('device_group_members', {
  deviceId: integer('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  groupId: integer('group_id').notNull().references(() => deviceGroups.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.deviceId, table.groupId] }),
  deviceIdx: index('idx_group_members_device').on(table.deviceId),
  groupIdx: index('idx_group_members_group').on(table.groupId)
}));

// Materialized Views for Performance (as tables)
export const deviceSummaryView = pgTable('device_summary_view', {
  deviceId: integer('device_id').primaryKey(),
  macAddress: macaddr('mac_address').notNull(),
  deviceType: deviceTypeEnum('device_type'),
  friendlyName: varchar('friendly_name', { length: 255 }),
  currentIp: inet('current_ip'),
  interfaceName: varchar('interface_name', { length: 50 }),
  vlanId: integer('vlan_id'),
  isOnline: boolean('is_online').default(false),
  lastSeen: timestamp('last_seen'),
  dailyDataUsage: bigint('daily_data_usage', { mode: 'number' }).default(0),
  activeConnections: integer('active_connections').default(0),
  groupNames: jsonb('group_names').$type<string[]>(),
  lastUpdated: timestamp('last_updated').defaultNow()
}, (table) => ({
  macIdx: index('idx_summary_mac').on(table.macAddress),
  typeIdx: index('idx_summary_type').on(table.deviceType),
  onlineIdx: index('idx_summary_online').on(table.isOnline),
  interfaceIdx: index('idx_summary_interface').on(table.interfaceName),
  vlanIdx: index('idx_summary_vlan').on(table.vlanId)
}));

// Query Performance Tracking
export const queryPerformance = pgTable('query_performance', {
  id: serial('id').primaryKey(),
  queryHash: varchar('query_hash', { length: 64 }).notNull(),
  naturalQuery: text('natural_query').notNull(),
  sqlQuery: text('sql_query').notNull(),
  executionTime: numeric('execution_time', { precision: 10, scale: 3 }).notNull(),
  resultCount: integer('result_count').default(0),
  timestamp: timestamp('timestamp').defaultNow()
}, (table) => ({
  hashIdx: index('idx_performance_hash').on(table.queryHash),
  timeIdx: index('idx_performance_time').on(table.executionTime),
  timestampIdx: index('idx_performance_timestamp').on(table.timestamp)
}));

// Relations
export const devicesRelations = relations(devices, ({ many, one }) => ({
  dhcpLeases: many(dhcpLeases),
  trafficStats: many(trafficStats),
  activeConnections: many(activeConnections),
  groupMemberships: many(deviceGroupMembers)
}));

export const networkInterfacesRelations = relations(networkInterfaces, ({ many }) => ({
  dhcpLeases: many(dhcpLeases)
}));

export const deviceGroupsRelations = relations(deviceGroups, ({ many }) => ({
  members: many(deviceGroupMembers)
}));

export const deviceGroupMembersRelations = relations(deviceGroupMembers, ({ one }) => ({
  device: one(devices, {
    fields: [deviceGroupMembers.deviceId],
    references: [devices.id]
  }),
  group: one(deviceGroups, {
    fields: [deviceGroupMembers.groupId],
    references: [deviceGroups.id]
  })
}));

export const queryIntentsRelations = relations(queryIntents, ({ many }) => ({
  keywords: many(queryKeywords)
}));

export const queryKeywordsRelations = relations(queryKeywords, ({ one }) => ({
  intent: one(queryIntents, {
    fields: [queryKeywords.intentId],
    references: [queryIntents.id]
  })
}));

// Type exports
export type DeviceFingerprint = typeof deviceFingerprints.$inferSelect;
export type NewDeviceFingerprint = typeof deviceFingerprints.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DhcpLease = typeof dhcpLeases.$inferSelect;
export type NewDhcpLease = typeof dhcpLeases.$inferInsert;
export type TrafficStat = typeof trafficStats.$inferSelect;
export type NewTrafficStat = typeof trafficStats.$inferInsert;
export type QueryIntent = typeof queryIntents.$inferSelect;
export type NewQueryIntent = typeof queryIntents.$inferInsert;