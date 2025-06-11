# OPNSense Natural Language Network Query Engine

A high-performance natural language query system for OPNSense that translates questions about your network into optimized Drizzle ORM queries. Get instant answers about your network devices, their status, data usage, and more - all in under 100ms!

## Features

- **Natural Language Processing**: Ask questions in plain English
- **Device Fingerprinting**: Automatically identifies gaming consoles, smart devices, phones, and more
- **Real-time Network Status**: Live device online/offline status
- **Performance Optimized**: All queries return in <100ms
- **Smart Device Grouping**: Associate multiple devices with users
- **Network Segmentation Aware**: Query by VLAN, guest network, IoT network
- **Bandwidth Monitoring**: Track data usage by device

## Quick Start

### 1. Database Setup

First, run the migration to create the necessary tables:

```bash
# From the OPNSenseMCP directory
npx drizzle-kit push:pg
```

### 2. Initialize the Query Engine

```typescript
import { createNetworkQueryEngine } from './src/db/network-query';

// Initialize with your database credentials
const queryEngine = await createNetworkQueryEngine({
  postgresHost: '10.0.0.2',
  postgresPort: '5432',
  postgresUser: 'mcp_user',
  postgresPassword: 'your_password',
  postgresDb: 'opnsense_mcp'
});

// Process a natural language query
const result = await queryEngine.processQuery("Is the Nintendo Switch online?");
console.log(result);
```

### 3. MCP Integration

Add the network query tool to your MCP server:

```typescript
import { NetworkQueryMCP } from './src/db/network-query/mcp-integration';

const server = new NetworkQueryMCP();
await server.start();
```

## Query Examples

### Device Status Queries
- "Is the Nintendo Switch online?"
- "Show me all online gaming consoles"
- "Which Apple devices are connected?"
- "Is there a PlayStation on the network?"

### Network Segmentation
- "Which devices are on the guest network?"
- "Show me all devices on VLAN 4"
- "List all IoT devices"
- "What's connected to the trusted network?"

### Data Usage
- "Which devices used more than 10GB today?"
- "Show me the top bandwidth consumers this week"
- "How much data has the Apple TV used?"
- "List devices that downloaded more than 1GB in the last hour"

### Device Discovery
- "Are there any unknown devices?"
- "Show me new devices from today"
- "Find suspicious devices on my network"
- "List unidentified devices on the IoT VLAN"

### User Association
- "What devices does Sarah have?"
- "Show me all devices owned by the kids"
- "Which devices belong to the person with iPhone 'John's Phone'?"

## Device Fingerprinting

The engine automatically identifies devices using multiple methods:

### MAC Address Prefixes
```typescript
// Example: Nintendo Switch
'7C:BB:8A' → Nintendo Switch
'0C:FE:45' → Nintendo Switch
'98:B6:E9' → Nintendo Switch

// PlayStation 5
'00:D9:D1' → PlayStation 5
'28:3F:69' → PlayStation 5
'AC:B5:7D' → PlayStation 5

// Xbox Series X/S
'60:45:BD' → Xbox Series X/S
'94:9A:A9' → Xbox Series X/S
```

### Hostname Patterns
```typescript
// Gaming consoles
'^nintendo.*switch' → Nintendo Switch
'^playstation.*5' → PlayStation 5
'^xbox.*series' → Xbox Series X/S

// Smart home devices
'^echo-.*' → Amazon Echo
'^google-home.*' → Google Home
'^chromecast.*' → Chromecast
```

## Performance Optimization

### Indexes
All critical columns are indexed for sub-100ms query performance:
- MAC addresses
- Device types
- Last seen timestamps
- Network interfaces
- VLANs

### Materialized Views
Complex aggregations are pre-computed in the `device_summary_view`:
- Current online status
- Daily data usage
- Active connection count
- Device group memberships

### Query Caching
Frequently asked questions are cached and tracked for performance analysis.

## API Reference

### NaturalLanguageQueryProcessor

```typescript
class NaturalLanguageQueryProcessor {
  // Process a natural language query
  async processQuery(query: string): Promise<{
    results: any[];
    executionTime: number;
    intent: string;
    confidence: number;
  }>;
  
  // Update the materialized device summary view
  async updateDeviceSummaryView(): Promise<void>;
  
  // Get query suggestions based on history
  async getQuerySuggestions(partialQuery: string): Promise<string[]>;
}
```

### DeviceFingerprintingService

```typescript
class DeviceFingerprintingService {
  // Identify a device based on its characteristics
  async identifyDevice(
    macAddress: string, 
    hostname?: string, 
    vendorClassId?: string
  ): Promise<{
    deviceType: string;
    manufacturer?: string;
    confidence: number;
    method: string;
  }>;
  
  // Process a new DHCP lease
  async processNewLease(lease: {
    macAddress: string;
    ipAddress: string;
    hostname?: string;
    interfaceName: string;
    vendorClassId?: string;
  }): Promise<void>;
}
```

## Database Schema

### Core Tables
- `devices` - All discovered network devices
- `dhcp_leases` - Active and historical DHCP leases
- `traffic_stats` - Bandwidth usage statistics
- `active_connections` - Current network connections
- `device_fingerprints` - MAC prefix to device type mapping
- `hostname_patterns` - Regex patterns for device identification

### Query Tables
- `query_intents` - Natural language intent definitions
- `query_keywords` - Keywords mapped to intents
- `query_performance` - Query execution metrics

### View Tables
- `device_summary_view` - Pre-aggregated device information

## Integration with OPNSense

The query engine syncs data from OPNSense every 5 minutes:
1. DHCP lease information
2. Network interface configuration
3. Active connection states
4. Traffic statistics

## Extending the Query Engine

### Adding New Device Types

```typescript
// Add to deviceFingerprintData in fingerprints.ts
{
  macPrefix: 'XX:XX:XX',
  manufacturer: 'NewCompany',
  deviceType: 'new_device_type',
  commonModels: ['Model 1', 'Model 2']
}
```

### Adding New Query Intents

```typescript
// Add to queryIntents in query-engine.ts
{
  intent: 'new_intent',
  keywords: ['keyword1', 'keyword2'],
  paramExtractor: (query) => {
    // Extract parameters from query
  },
  queryBuilder: (params) => {
    // Build Drizzle query
  }
}
```

## Troubleshooting

### Query Performance Issues
1. Check if indexes are properly created
2. Run `ANALYZE` on PostgreSQL tables
3. Update the device summary view
4. Review query performance logs

### Device Not Identified
1. Check MAC prefix in fingerprint database
2. Add hostname pattern if consistent
3. Update device type manually using MCP tool

### Real-time Data Not Updating
1. Verify OPNSense API credentials
2. Check sync interval configuration
3. Review error logs for sync failures

## License

MIT