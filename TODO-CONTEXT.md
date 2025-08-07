# TODO Items - Detailed Context & Implementation Guide

## 📍 TODO Locations & Context

### 1. IaC Resource Imports
**File**: `src/index.ts:46`
```typescript
// TODO: Import other IaC resources as they are created
```

**Context**: 
- Currently only imports VlanResource and FirewallRuleResource for IaC
- Missing imports for other resource types that exist in the codebase

**What's Missing**:
- ArpTableResource (exists in `network/arp.ts`)
- DhcpLeaseResource (exists in `services/dhcp/leases.ts`) 
- DnsBlocklistResource (exists in `services/dns/blocklist.ts`)
- HAProxyResource (exists in `services/haproxy/index.ts`)
- BackupManager (exists in `backup/manager.ts`)

**Implementation**:
```typescript
// Add these imports:
import { ArpTableResource } from './resources/network/arp.js';
import { DhcpLeaseResource } from './resources/services/dhcp/leases.js';
import { DnsBlocklistResource } from './resources/services/dns/blocklist.js';
import { HAProxyResource } from './resources/services/haproxy/index.js';
import { BackupManager } from './resources/backup/manager.js';

// Register them with appropriate handlers
```

---

### 2. Network Interface Sync
**File**: `src/db/network-query/mcp-integration.ts:266`
```typescript
// 2. Sync network interfaces - TODO: implement getInterfaces in API client
```

**Context**:
- Part of the `syncNetworkData` function
- Needs to fetch network interfaces from OPNsense
- Currently commented out because API method doesn't exist

**Current Code**:
```typescript
async syncNetworkData(): Promise<void> {
  // 1. Sync VLANs ✓ (implemented)
  // 2. Sync network interfaces - TODO
  // 3. Sync firewall rules ✓ (implemented)
}
```

**Implementation Needed**:
```typescript
// In api/client.ts, add:
async getInterfaces(): Promise<any> {
  return this.request('GET', '/api/interfaces/overview/list');
}

// In mcp-integration.ts:
const interfaces = await this.apiClient.getInterfaces();
for (const [id, iface] of Object.entries(interfaces)) {
  await this.queries.upsertInterface({
    id,
    name: iface.description,
    type: iface.type,
    enabled: iface.enabled,
    ipAddress: iface.addr,
    // ... other fields
  });
}
```

---

### 3. JSONPath Substitution
**File**: `src/macro/recorder.ts:244`
```typescript
// TODO: Use proper JSONPath for more robust substitution
```

**Context**:
- Currently using simple string replacement for variables
- Needs JSONPath library for complex object navigation
- Part of macro recording/playback functionality

**Current Implementation**:
```typescript
private substituteVariables(value: any, variables: Record<string, any>): any {
  if (typeof value === 'string') {
    // Simple {{variable}} replacement
    return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] || match;
    });
  }
  // ... rest of implementation
}
```

**Improved Implementation**:
```typescript
import * as jsonpath from 'jsonpath';

private substituteVariables(value: any, variables: Record<string, any>): any {
  if (typeof value === 'string') {
    // Support JSONPath expressions like {{$.response.uuid}}
    return value.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      if (expression.startsWith('$')) {
        // JSONPath expression
        const result = jsonpath.query(variables, expression);
        return result.length > 0 ? result[0] : match;
      } else {
        // Simple variable
        return variables[expression] || match;
      }
    });
  }
  // ... rest
}
```

---

### 4. State Encryption (Decryption)
**File**: `src/state/store.ts:95`
```typescript
// TODO: Add decryption if encryption is enabled
```

**Context**:
- State persistence includes sensitive data
- Encryption flag exists but not implemented
- Need to decrypt when loading state

**Current Code**:
```typescript
async load(): Promise<void> {
  try {
    const data = await fs.readFile(this.statePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // TODO: Add decryption if encryption is enabled
    
    this.state = parsed;
  } catch (error) {
    // ... error handling
  }
}
```

**Implementation**:
```typescript
import * as crypto from 'crypto';

private decrypt(encryptedData: string): string {
  if (!this.config.encryption?.enabled) return encryptedData;
  
  const algorithm = 'aes-256-gcm';
  const key = this.getEncryptionKey(); // From env or keyring
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

---

### 5. State Encryption (Encryption)
**File**: `src/state/store.ts:118`
```typescript
// TODO: Add encryption if enabled
```

**Context**:
- Companion to decryption TODO
- Need to encrypt state before saving

**Current Code**:
```typescript
async save(): Promise<void> {
  const data = JSON.stringify(this.state, null, 2);
  
  // TODO: Add encryption if enabled
  
  await fs.writeFile(this.statePath, data, 'utf-8');
}
```

**Implementation**:
```typescript
private encrypt(data: string): string {
  if (!this.config.encryption?.enabled) return data;
  
  const algorithm = 'aes-256-gcm';
  const key = this.getEncryptionKey();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

---

### 6. Cache Compression (Compress)
**File**: `src/cache/enhanced-manager.ts:631`
```typescript
// TODO: Implement compression (e.g., using zlib)
```

**Context**:
- Cache entries can be large (API responses, state snapshots)
- Compression would reduce memory usage
- Part of cache optimization

**Current Code**:
```typescript
private async serialize(data: any): Promise<Buffer> {
  const json = JSON.stringify(data);
  // TODO: Implement compression (e.g., using zlib)
  return Buffer.from(json);
}
```

**Implementation**:
```typescript
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

private async serialize(data: any): Promise<Buffer> {
  const json = JSON.stringify(data);
  
  if (this.config.compression?.enabled) {
    return await gzip(json, {
      level: this.config.compression.level || 6
    });
  }
  
  return Buffer.from(json);
}
```

---

### 7. Cache Compression (Decompress)
**File**: `src/cache/enhanced-manager.ts:639`
```typescript
// TODO: Handle decompression if implemented
```

**Context**:
- Companion to compression TODO
- Need to decompress when reading from cache

**Current Code**:
```typescript
private async deserialize(buffer: Buffer): Promise<any> {
  // TODO: Handle decompression if implemented
  const json = buffer.toString();
  return JSON.parse(json);
}
```

**Implementation**:
```typescript
private async deserialize(buffer: Buffer): Promise<any> {
  let json: string;
  
  if (this.config.compression?.enabled) {
    const decompressed = await gunzip(buffer);
    json = decompressed.toString();
  } else {
    json = buffer.toString();
  }
  
  return JSON.parse(json);
}
```

---

## 📊 TODO Priority Matrix

| Priority | TODO | Complexity | Impact | Dependencies |
|----------|------|------------|--------|--------------|
| 🔴 HIGH | Network Interface Sync | Medium | High | API client update |
| 🔴 HIGH | State Encryption | Medium | High | Security critical |
| 🟡 MEDIUM | IaC Resource Imports | Low | Medium | None |
| 🟡 MEDIUM | Cache Compression | Low | Medium | Performance gain |
| 🟢 LOW | JSONPath Substitution | Low | Low | New dependency |

## 🔧 Implementation Order

### Week 1 Sprint:
1. **IaC Resource Imports** (Quick win - 30 min)
2. **Network Interface Sync** (Core functionality - 2 hours)
3. **State Encryption/Decryption** (Security critical - 3 hours)

### Week 2 Sprint:
4. **Cache Compression** (Performance - 2 hours)
5. **JSONPath Substitution** (Enhancement - 1 hour)

## 📦 New Dependencies Needed

```json
{
  "dependencies": {
    "jsonpath": "^1.1.1"  // For JSONPath substitution
  }
}
```

Note: `zlib` is built into Node.js, no new dependency needed for compression
Note: `crypto` is built into Node.js, no new dependency needed for encryption

## 🧪 Testing Requirements

Each TODO implementation needs:
1. Unit tests for the new functionality
2. Integration test with existing code
3. Error handling for edge cases
4. Performance benchmarks (for compression)
5. Security audit (for encryption)

---

*This document provides complete context for resolving all TODO items in the codebase.*