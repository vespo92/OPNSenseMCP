/**
 * Event System Types
 *
 * Defines event types and interfaces for the SSE-based event bus
 */

/**
 * Event types organized by category
 */
export enum EventType {
  // System events
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  SYSTEM_CONFIG_CHANGED = 'system.config.changed',
  SYSTEM_ERROR = 'system.error',

  // Plugin lifecycle events
  PLUGIN_LOADED = 'plugin.loaded',
  PLUGIN_STARTED = 'plugin.started',
  PLUGIN_STOPPED = 'plugin.stopped',
  PLUGIN_ERROR = 'plugin.error',
  PLUGIN_HEALTH_CHANGED = 'plugin.health.changed',

  // Firewall events
  FIREWALL_RULE_CREATED = 'firewall.rule.created',
  FIREWALL_RULE_UPDATED = 'firewall.rule.updated',
  FIREWALL_RULE_DELETED = 'firewall.rule.deleted',
  FIREWALL_RULE_TOGGLED = 'firewall.rule.toggled',
  FIREWALL_RULE_TRIGGERED = 'firewall.rule.triggered',
  FIREWALL_RULES_RELOADED = 'firewall.rules.reloaded',
  FIREWALL_ALIAS_CREATED = 'firewall.alias.created',
  FIREWALL_ALIAS_UPDATED = 'firewall.alias.updated',
  FIREWALL_ALIAS_DELETED = 'firewall.alias.deleted',

  // NAT events
  NAT_RULE_CREATED = 'nat.rule.created',
  NAT_RULE_UPDATED = 'nat.rule.updated',
  NAT_RULE_DELETED = 'nat.rule.deleted',
  NAT_MODE_CHANGED = 'nat.mode.changed',
  NAT_CONFIG_APPLIED = 'nat.config.applied',

  // Network events
  INTERFACE_UP = 'network.interface.up',
  INTERFACE_DOWN = 'network.interface.down',
  INTERFACE_CONFIGURED = 'network.interface.configured',
  VLAN_CREATED = 'network.vlan.created',
  VLAN_UPDATED = 'network.vlan.updated',
  VLAN_DELETED = 'network.vlan.deleted',
  ARP_ENTRY_ADDED = 'network.arp.added',
  ARP_ENTRY_REMOVED = 'network.arp.removed',
  ROUTE_ADDED = 'network.route.added',
  ROUTE_REMOVED = 'network.route.removed',
  ROUTE_CHANGED = 'network.route.changed',

  // VPN events
  VPN_TUNNEL_CONNECTED = 'vpn.tunnel.connected',
  VPN_TUNNEL_DISCONNECTED = 'vpn.tunnel.disconnected',
  VPN_CLIENT_CONNECTED = 'vpn.client.connected',
  VPN_CLIENT_DISCONNECTED = 'vpn.client.disconnected',
  VPN_CONFIG_CHANGED = 'vpn.config.changed',
  OPENVPN_STATUS_CHANGED = 'vpn.openvpn.status',
  IPSEC_STATUS_CHANGED = 'vpn.ipsec.status',
  WIREGUARD_STATUS_CHANGED = 'vpn.wireguard.status',

  // Security events
  IDS_ALERT = 'security.ids.alert',
  IDS_RULE_UPDATED = 'security.ids.rule.updated',
  AUTH_SUCCESS = 'security.auth.success',
  AUTH_FAILED = 'security.auth.failed',
  CERT_CREATED = 'security.cert.created',
  CERT_EXPIRING = 'security.cert.expiring',
  CERT_EXPIRED = 'security.cert.expired',
  CERT_REVOKED = 'security.cert.revoked',
  AV_THREAT_DETECTED = 'security.av.threat',
  AV_SCAN_COMPLETE = 'security.av.scan.complete',

  // Monitoring events
  CPU_HIGH = 'monitor.cpu.high',
  MEMORY_HIGH = 'monitor.memory.high',
  DISK_HIGH = 'monitor.disk.high',
  BANDWIDTH_HIGH = 'monitor.bandwidth.high',
  TEMPERATURE_HIGH = 'monitor.temperature.high',
  LOAD_AVERAGE_HIGH = 'monitor.load.high',
  METRICS_COLLECTED = 'monitor.metrics.collected',

  // Service events
  SERVICE_STARTED = 'service.started',
  SERVICE_STOPPED = 'service.stopped',
  SERVICE_RESTARTED = 'service.restarted',
  SERVICE_FAILED = 'service.failed',
  DHCP_LEASE_GRANTED = 'service.dhcp.lease.granted',
  DHCP_LEASE_EXPIRED = 'service.dhcp.lease.expired',
  DNS_QUERY_BLOCKED = 'service.dns.blocked',
  DNS_CACHE_CLEARED = 'service.dns.cache.cleared',

  // Routing events
  BGP_PEER_UP = 'routing.bgp.peer.up',
  BGP_PEER_DOWN = 'routing.bgp.peer.down',
  OSPF_NEIGHBOR_UP = 'routing.ospf.neighbor.up',
  OSPF_NEIGHBOR_DOWN = 'routing.ospf.neighbor.down',
  ROUTE_TABLE_CHANGED = 'routing.table.changed',

  // Traffic shaping events
  TRAFFIC_LIMIT_EXCEEDED = 'traffic.limit.exceeded',
  QOS_RULE_APPLIED = 'traffic.qos.applied',

  // Proxy events
  PROXY_CLIENT_CONNECTED = 'proxy.client.connected',
  PROXY_REQUEST_BLOCKED = 'proxy.request.blocked',
  PROXY_CACHE_HIT = 'proxy.cache.hit',

  // Backup events
  BACKUP_CREATED = 'backup.created',
  BACKUP_RESTORED = 'backup.restored',
  BACKUP_FAILED = 'backup.failed',

  // HA/CARP events
  HA_FAILOVER = 'ha.failover',
  CARP_MASTER = 'ha.carp.master',
  CARP_BACKUP = 'ha.carp.backup',

  // Custom events (for user-defined plugins)
  CUSTOM = 'custom',
}

/**
 * Event severity levels
 */
export enum EventSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Event interface
 */
export interface Event {
  /** Unique event ID */
  id: string;

  /** Event type */
  type: EventType | string;

  /** Event timestamp */
  timestamp: Date;

  /** Plugin that emitted the event */
  pluginId: string;

  /** Event data payload */
  data: any;

  /** Event severity */
  severity: EventSeverity;

  /** Event source (e.g., 'firewall', 'vpn', 'system') */
  source?: string;

  /** Related resource identifier */
  resourceId?: string;

  /** Event metadata */
  metadata?: Record<string, any>;
}

/**
 * Event filter for subscriptions
 */
export interface EventFilter {
  /** Filter by event type(s) */
  types?: EventType[] | string[];

  /** Filter by plugin ID(s) */
  pluginIds?: string[];

  /** Filter by severity level(s) */
  severities?: EventSeverity[];

  /** Filter by source */
  sources?: string[];

  /** Custom filter function */
  filter?: (event: Event) => boolean;
}

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;

  /** Event filter */
  filter?: EventFilter;

  /** Event handler */
  handler: (event: Event) => void | Promise<void>;

  /** Subscription created at */
  createdAt: Date;
}

/**
 * Event stream configuration
 */
export interface EventStreamConfig {
  /** Enable event streaming */
  enabled: boolean;

  /** Event retention period (in milliseconds) */
  retention: number;

  /** Maximum number of events to keep in memory */
  maxEvents?: number;

  /** Maximum number of concurrent listeners */
  maxListeners?: number;

  /** Batch size for event delivery */
  batchSize?: number;

  /** Batch timeout (in milliseconds) */
  batchTimeout?: number;
}

/**
 * Metrics event data
 */
export interface MetricsEventData {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    interfaces: Record<string, {
      bytesIn: number;
      bytesOut: number;
      packetsIn: number;
      packetsOut: number;
      errorsIn: number;
      errorsOut: number;
    }>;
  };
  timestamp: Date;
}

/**
 * Firewall rule event data
 */
export interface FirewallRuleEventData {
  ruleId: string;
  uuid?: string;
  action: 'pass' | 'block' | 'reject';
  interface?: string;
  source?: string;
  destination?: string;
  protocol?: string;
  port?: string;
  description?: string;
}

/**
 * VPN connection event data
 */
export interface VPNEventData {
  tunnelId: string;
  tunnelName: string;
  protocol: 'openvpn' | 'ipsec' | 'wireguard';
  remoteAddress?: string;
  username?: string;
  bytesIn?: number;
  bytesOut?: number;
}

/**
 * Security alert event data
 */
export interface SecurityAlertEventData {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  sourceIp?: string;
  destIp?: string;
  protocol?: string;
  timestamp: Date;
}
