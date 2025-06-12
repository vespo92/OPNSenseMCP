# Natural Language Network Query Examples

This document demonstrates the natural language query capabilities of the OPNSense Network Query Engine.

## Setup

```typescript
import { NetworkQueryMCP } from '../src/db/network-query/mcp-integration';

// Initialize the query engine
const queryEngine = new NetworkQueryMCP();
await queryEngine.start();
```

## Example Queries

### 1. Device Online Status

```typescript
// Check if specific devices are online
const queries = [
  "Is the Nintendo Switch online?",
  "Is there a PlayStation connected?",
  "Show me all online gaming consoles",
  "Which Apple devices are currently connected?"
];

// Example response:
{
  "query": "Is the Nintendo Switch online?",
  "intent": "device_online_check",
  "confidence": 0.95,
  "executionTime": "45ms",
  "results": [
    {
      "device": "Nintendo Switch",
      "type": "gaming_console",
      "status": "Online",
      "lastSeen": "2024-01-20T15:30:00Z",
      "network": "igc0",
      "vlan": null
    }
  ]
}
```

### 2. Network Segmentation Queries

```typescript
// Check devices on specific networks
const networkQueries = [
  "Which devices are on the guest network?",
  "Show me all devices on VLAN 4",
  "List all IoT devices",
  "What's connected to the trusted network?"
];

// Example response for guest network:
{
  "query": "Which devices are on the guest network?",
  "intent": "devices_on_network",
  "confidence": 0.90,
  "executionTime": "62ms",
  "results": [
    {
      "device": "John's iPhone",
      "type": "phone",
      "status": "Online",
      "ip": "192.168.4.101"
    },
    {
      "device": "Guest Laptop",
      "type": "computer",
      "status": "Online",
      "ip": "192.168.4.102"
    }
  ]
}
```

### 3. Data Usage Queries

```typescript
// Monitor bandwidth consumption
const dataQueries = [
  "Which devices used more than 10GB today?",
  "Show me the top data consumers this week",
  "How much data has the Apple TV used today?",
  "List devices that downloaded more than 1GB in the last hour"
];

// Example response:
{
  "query": "Which devices used more than 10GB today?",
  "intent": "device_data_usage",
  "confidence": 0.88,
  "executionTime": "78ms",
  "results": [
    {
      "device": "Apple TV 4K",
      "type": "smart_tv",
      "dataUsed": "15.3 GB",
      "rawBytes": 16424965120
    },
    {
      "device": "Gaming PC",
      "type": "computer",
      "dataUsed": "12.7 GB",
      "rawBytes": 13631488000
    }
  ]
}
```

### 4. Device Discovery

```typescript
// Find unknown or new devices
const discoveryQueries = [
  "Are there any unknown devices on my network?",
  "Show me new devices from today",
  "List unidentified devices on the IoT VLAN",
  "Find suspicious devices"
];
```

### 5. User Device Association

```typescript
// Find all devices belonging to a person
const userQueries = [
  "What devices does the person with iPhone 'Sarah's Phone' have?",
  "Show me all devices owned by John",
  "Which devices belong to the kids?"
];
```

### 6. Gaming Console Queries

```typescript
// Gaming-specific queries
const gamingQueries = [
  "Show me all gaming consoles",
  "Which game consoles are online?",
  "Is the Xbox Series X connected?",
  "List all Nintendo devices"
];
```

### 7. Device History

```typescript
// Historical queries
const historyQueries = [
  "When was the PlayStation last online?",
  "Show me the connection history for the Smart TV",
  "Which devices were online in the last hour?",
  "What IP addresses has the laptop used today?"
];
```

## Advanced Query Features

### Performance Optimization

All queries are optimized to return in <100ms using:
- Indexed columns for fast lookups
- Materialized views for complex aggregations
- Query result caching for frequently asked questions

### Device Fingerprinting

The system automatically identifies devices using:
- MAC address OUI prefixes (e.g., Nintendo: 7C:BB:8A)
- DHCP hostname patterns (e.g., "nintendo-switch-*")
- Vendor class identifiers
- User agent strings

### Real-time Updates

The system maintains real-time device status by:
- Syncing DHCP leases every 5 minutes
- Monitoring active connections
- Tracking traffic statistics
- Updating device online/offline status

## MCP Integration

Use the network query tool in your MCP conversations:

```json
{
  "tool": "network_query",
  "arguments": {
    "query": "Is the Nintendo Switch connected to the guest network?"
  }
}
```

The system will:
1. Parse the natural language query
2. Identify the intent and extract parameters
3. Build an optimized Drizzle ORM query
4. Execute and return results in <100ms
5. Log performance metrics for analysis

## Custom Device Names

You can assign friendly names to devices:

```json
{
  "tool": "update_device_name",
  "arguments": {
    "macAddress": "7C:BB:8A:12:34:56",
    "friendlyName": "Kids Nintendo Switch"
  }
}
```

## Device Grouping

Group related devices together:

```json
{
  "tool": "group_devices",
  "arguments": {
    "groupName": "Sarah's Devices",
    "macAddresses": [
      "A8:51:6B:11:22:33",
      "DC:2B:2A:44:55:66",
      "F0:DB:F8:77:88:99"
    ]
  }
}
```

This enables queries like:
- "Show me all of Sarah's devices"
- "Are any of Sarah's devices online?"
- "How much data have Sarah's devices used today?"