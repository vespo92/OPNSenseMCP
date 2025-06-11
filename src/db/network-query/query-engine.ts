// Natural Language Query Engine
import { eq, and, or, gte, lte, like, ilike, inArray, sql, isNull } from 'drizzle-orm';
import { 
  devices, 
  dhcpLeases, 
  trafficStats, 
  activeConnections,
  deviceSummaryView,
  networkInterfaces,
  deviceGroups,
  deviceGroupMembers
} from './schema';

export interface QueryIntent {
  intent: string;
  keywords: string[];
  queryBuilder: (params: any) => any;
  paramExtractor: (query: string) => any;
}

// Query Intent Definitions
export const queryIntents: QueryIntent[] = [
  {
    intent: 'device_online_check',
    keywords: ['online', 'connected', 'active', 'up'],
    paramExtractor: (query) => {
      // Extract device name/type from query
      const devicePatterns = {
        'nintendo switch': { deviceType: 'gaming_console', manufacturer: 'Nintendo' },
        'playstation': { deviceType: 'gaming_console', manufacturer: 'Sony' },
        'xbox': { deviceType: 'gaming_console', manufacturer: 'Microsoft' },
        'iphone': { deviceType: 'phone', manufacturer: 'Apple' },
        'ipad': { deviceType: 'tablet', manufacturer: 'Apple' },
        'macbook': { deviceType: 'computer', manufacturer: 'Apple' },
        'echo': { deviceType: 'smart_speaker', manufacturer: 'Amazon' },
        'chromecast': { deviceType: 'media_player', manufacturer: 'Google' }
      };
      
      const lowerQuery = query.toLowerCase();
      for (const [pattern, params] of Object.entries(devicePatterns)) {
        if (lowerQuery.includes(pattern)) {
          return params;
        }
      }
      
      // Check for specific device names
      const nameMatch = query.match(/["']([^"']+)["']/);
      if (nameMatch) {
        return { friendlyName: nameMatch[1] };
      }
      
      return {};
    },
    queryBuilder: (params) => {
      return {
        select: deviceSummaryView,
        where: and(
          params.deviceType ? eq(deviceSummaryView.deviceType, params.deviceType) : undefined,
          params.friendlyName ? ilike(deviceSummaryView.friendlyName, `%${params.friendlyName}%`) : undefined,
          eq(deviceSummaryView.isOnline, true)
        ),
        limit: 10
      };
    }
  },
  
  {
    intent: 'devices_on_network',
    keywords: ['guest', 'iot', 'vlan', 'network', 'connected to'],
    paramExtractor: (query) => {
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('guest')) return { vlanId: 4, networkType: 'guest' };
      if (lowerQuery.includes('iot')) return { isIot: true };
      if (lowerQuery.includes('trusted')) return { isTrusted: true };
      
      // Extract VLAN number
      const vlanMatch = query.match(/vlan\s*(\d+)/i);
      if (vlanMatch) return { vlanId: parseInt(vlanMatch[1]) };
      
      return {};
    },
    queryBuilder: (params) => {
      return {
        select: deviceSummaryView,
        where: and(
          params.vlanId ? eq(deviceSummaryView.vlanId, params.vlanId) : undefined,
          params.networkType === 'guest' ? eq(deviceSummaryView.vlanId, 4) : undefined
        ),
        orderBy: [deviceSummaryView.lastSeen],
        limit: 50
      };
    }
  },
  
  {
    intent: 'device_data_usage',
    keywords: ['data', 'usage', 'consumed', 'downloaded', 'uploaded', 'bandwidth'],
    paramExtractor: (query) => {
      const params: any = {};
      
      // Extract data amount
      const dataMatch = query.match(/(\d+)\s*(gb|mb|tb)/i);
      if (dataMatch) {
        const amount = parseInt(dataMatch[1]);
        const unit = dataMatch[2].toLowerCase();
        params.minBytes = unit === 'gb' ? amount * 1e9 : 
                        unit === 'mb' ? amount * 1e6 : 
                        amount * 1e12;
      }
      
      // Extract time period
      if (query.includes('today')) {
        params.since = sql`CURRENT_DATE`;
      } else if (query.includes('hour')) {
        params.since = sql`NOW() - INTERVAL '1 hour'`;
      } else if (query.includes('week')) {
        params.since = sql`NOW() - INTERVAL '1 week'`;
      }
      
      return params;
    },
    queryBuilder: (params) => {
      return {
        select: [
          devices.friendlyName,
          devices.deviceType,
          sql`SUM(${trafficStats.bytesIn} + ${trafficStats.bytesOut})`.as('totalBytes')
        ],
        from: devices,
        innerJoin: trafficStats,
        on: eq(devices.id, trafficStats.deviceId),
        where: and(
          params.since ? gte(trafficStats.timestamp, params.since) : undefined,
          params.minBytes ? sql`SUM(${trafficStats.bytesIn} + ${trafficStats.bytesOut}) >= ${params.minBytes}` : undefined
        ),
        groupBy: [devices.id, devices.friendlyName, devices.deviceType],
        having: params.minBytes ? sql`SUM(${trafficStats.bytesIn} + ${trafficStats.bytesOut}) >= ${params.minBytes}` : undefined,
        orderBy: sql`totalBytes DESC`,
        limit: 20
      };
    }
  },
  
  {
    intent: 'unknown_devices',
    keywords: ['unknown', 'unidentified', 'new', 'strange', 'suspicious'],
    paramExtractor: (query) => {
      const params: any = { deviceType: 'unknown' };
      
      if (query.includes('today')) {
        params.since = sql`CURRENT_DATE`;
      } else if (query.includes('week')) {
        params.since = sql`NOW() - INTERVAL '1 week'`;
      }
      
      return params;
    },
    queryBuilder: (params) => {
      return {
        select: devices,
        where: and(
          eq(devices.deviceType, 'unknown'),
          params.since ? gte(devices.firstSeen, params.since) : undefined,
          or(
            isNull(devices.friendlyName),
            eq(devices.friendlyName, '')
          )
        ),
        orderBy: [devices.firstSeen],
        limit: 50
      };
    }
  },
  
  {
    intent: 'user_devices',
    keywords: ['person', 'user', 'owner', 'has', 'owns', 'devices'],
    paramExtractor: (query) => {
      // Extract user/device name
      const nameMatch = query.match(/(?:person with|user with|owner of)\s+(?:iphone|device|phone)?\s*["']?([^"']+)["']?/i);
      if (nameMatch) {
        return { deviceName: nameMatch[1] };
      }
      
      return {};
    },
    queryBuilder: (params) => {
      // First find the device, then find all devices in the same group
      return {
        select: devices,
        from: devices,
        innerJoin: deviceGroupMembers,
        on: eq(devices.id, deviceGroupMembers.deviceId),
        where: sql`${deviceGroupMembers.groupId} IN (
          SELECT ${deviceGroupMembers.groupId} 
          FROM ${devices} d
          INNER JOIN ${deviceGroupMembers} dgm ON d.id = dgm.device_id
          WHERE d.friendly_name ILIKE '%${params.deviceName}%'
        )`,
        limit: 20
      };
    }
  },
  
  {
    intent: 'device_history',
    keywords: ['history', 'when', 'last seen', 'recently', 'activity'],
    paramExtractor: (query) => {
      const params: any = {};
      
      // Extract device info
      const deviceMatch = query.match(/["']([^"']+)["']/);
      if (deviceMatch) {
        params.deviceName = deviceMatch[1];
      }
      
      // Time period
      if (query.includes('hour')) {
        params.since = sql`NOW() - INTERVAL '1 hour'`;
      } else if (query.includes('today')) {
        params.since = sql`CURRENT_DATE`;
      }
      
      return params;
    },
    queryBuilder: (params) => {
      return {
        select: [
          devices.friendlyName,
          dhcpLeases.ipAddress,
          dhcpLeases.leaseStart,
          dhcpLeases.leaseEnd,
          dhcpLeases.interfaceName
        ],
        from: devices,
        innerJoin: dhcpLeases,
        on: eq(devices.macAddress, dhcpLeases.macAddress),
        where: and(
          params.deviceName ? ilike(devices.friendlyName, `%${params.deviceName}%`) : undefined,
          params.since ? gte(dhcpLeases.leaseStart, params.since) : undefined
        ),
        orderBy: [dhcpLeases.leaseStart],
        limit: 100
      };
    }
  },
  
  {
    intent: 'gaming_consoles',
    keywords: ['gaming', 'console', 'playstation', 'xbox', 'nintendo', 'games'],
    paramExtractor: (query) => {
      return { deviceType: 'gaming_console' };
    },
    queryBuilder: (params) => {
      return {
        select: deviceSummaryView,
        where: eq(deviceSummaryView.deviceType, 'gaming_console'),
        orderBy: [deviceSummaryView.isOnline, deviceSummaryView.lastSeen],
        limit: 20
      };
    }
  }
];