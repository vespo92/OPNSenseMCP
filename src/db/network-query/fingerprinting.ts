// Device Fingerprinting Service
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { 
  devices, 
  deviceFingerprints,
  hostnamePatterns,
  dhcpLeases 
} from './schema';
import { eq, and, or, like, sql } from 'drizzle-orm';
import { deviceFingerprintData, hostnamePatternData } from './fingerprints';

export class DeviceFingerprintingService {
  private db: ReturnType<typeof drizzle>;
  
  constructor(connectionString: string) {
    const pool = new Pool({ connectionString });
    this.db = drizzle(pool);
  }
  
  // Initialize fingerprint database
  async initializeFingerprints(): Promise<void> {
    // Insert MAC prefix fingerprints
    for (const fingerprint of deviceFingerprintData) {
      await this.db.insert(deviceFingerprints)
        .values({
          macPrefix: fingerprint.macPrefix,
          manufacturer: fingerprint.manufacturer,
          deviceType: fingerprint.deviceType as any, // Type assertion for enum
          commonModels: fingerprint.commonModels,
          confidence: '0.90'
        })
        .onConflictDoUpdate({
          target: deviceFingerprints.macPrefix,
          set: {
            manufacturer: fingerprint.manufacturer,
            deviceType: fingerprint.deviceType as any, // Type assertion for enum
            commonModels: fingerprint.commonModels,
            updatedAt: new Date()
          }
        });
    }
    
    // Insert hostname patterns
    for (const pattern of hostnamePatternData) {
      await this.db.insert(hostnamePatterns)
        .values({
          pattern: pattern.pattern,
          deviceType: pattern.deviceType as any, // Type assertion for enum
          description: pattern.description,
          priority: pattern.priority
        })
        .onConflictDoNothing();
    }
  }
  
  // Identify device based on MAC address and hostname
  async identifyDevice(macAddress: string, hostname?: string, vendorClassId?: string): Promise<{
    deviceType: string;
    manufacturer?: string;
    confidence: number;
    method: string;
  }> {
    // 1. Try MAC prefix matching first (most reliable)
    const macPrefix = macAddress.substring(0, 8).toUpperCase();
    const macMatch = await this.db.select()
      .from(deviceFingerprints)
      .where(eq(deviceFingerprints.macPrefix, macPrefix))
      .limit(1);
    
    if (macMatch.length > 0) {
      return {
        deviceType: macMatch[0].deviceType,
        manufacturer: macMatch[0].manufacturer,
        confidence: parseFloat(macMatch[0].confidence || '0.90'),
        method: 'mac_prefix'
      };
    }
    
    // 2. Try hostname pattern matching
    if (hostname) {
      const patterns = await this.db.select()
        .from(hostnamePatterns)
        .orderBy(hostnamePatterns.priority);
      
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.pattern, 'i');
        if (regex.test(hostname)) {
          return {
            deviceType: pattern.deviceType,
            confidence: 0.70,
            method: 'hostname_pattern'
          };
        }
      }
    }
    
    // 3. Try vendor class ID patterns (DHCP option 60)
    if (vendorClassId) {
      const vendorPatterns: Record<string, { deviceType: string; manufacturer: string }> = {
        'android': { deviceType: 'phone', manufacturer: 'Android' },
        'dhcpcd-': { deviceType: 'computer', manufacturer: 'Linux' },
        'MSFT': { deviceType: 'computer', manufacturer: 'Microsoft' },
        'udhcp': { deviceType: 'iot_device', manufacturer: 'Embedded Linux' }
      };
      
      for (const [pattern, info] of Object.entries(vendorPatterns)) {
        if (vendorClassId.toLowerCase().includes(pattern.toLowerCase())) {
          return {
            deviceType: info.deviceType,
            manufacturer: info.manufacturer,
            confidence: 0.60,
            method: 'vendor_class'
          };
        }
      }
    }
    
    // 4. Default to unknown
    return {
      deviceType: 'unknown',
      confidence: 0.0,
      method: 'none'
    };
  }
  
  // Process new DHCP lease and update device information
  async processNewLease(lease: {
    macAddress: string;
    ipAddress: string;
    hostname?: string;
    interfaceName: string;
    vendorClassId?: string;
  }): Promise<void> {
    // Check if device exists
    const existingDevice = await this.db.select()
      .from(devices)
      .where(eq(devices.macAddress, lease.macAddress))
      .limit(1);
    
    if (existingDevice.length === 0) {
      // New device - identify it
      const identification = await this.identifyDevice(
        lease.macAddress,
        lease.hostname,
        lease.vendorClassId
      );
      
      // Generate friendly name
      const friendlyName = this.generateFriendlyName(
        identification.deviceType,
        identification.manufacturer,
        lease.hostname
      );
      
      // Insert new device
      await this.db.insert(devices).values({
        macAddress: lease.macAddress,
        deviceType: identification.deviceType as any,
        manufacturer: identification.manufacturer,
        hostname: lease.hostname,
        friendlyName: friendlyName,
        firstSeen: new Date(),
        lastSeen: new Date(),
        metadata: {
          identificationMethod: identification.method,
          confidence: identification.confidence
        }
      });
    } else {
      // Update existing device
      await this.db.update(devices)
        .set({
          hostname: lease.hostname,
          lastSeen: new Date(),
          updatedAt: new Date()
        })
        .where(eq(devices.macAddress, lease.macAddress));
    }
    
    // Insert/update DHCP lease
    await this.db.insert(dhcpLeases)
      .values({
        macAddress: lease.macAddress,
        ipAddress: lease.ipAddress,
        hostname: lease.hostname,
        interfaceName: lease.interfaceName,
        vendorClassId: lease.vendorClassId,
        leaseStart: new Date(),
        leaseEnd: new Date(Date.now() + 86400000), // 24 hours default
        isActive: true
      })
      .onConflictDoUpdate({
        target: [dhcpLeases.macAddress, dhcpLeases.ipAddress],
        set: {
          hostname: lease.hostname,
          leaseStart: new Date(),
          leaseEnd: new Date(Date.now() + 86400000),
          isActive: true,
          updatedAt: new Date()
        }
      });
  }
  
  // Generate a friendly name for the device
  private generateFriendlyName(
    deviceType: string,
    manufacturer?: string,
    hostname?: string
  ): string {
    // If hostname is descriptive, use it
    if (hostname && !hostname.match(/^[a-f0-9-]+$/i)) {
      return hostname.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Generate based on device type and manufacturer
    const typeNames: Record<string, string> = {
      gaming_console: 'Gaming Console',
      smart_speaker: 'Smart Speaker',
      smart_tv: 'Smart TV',
      media_player: 'Streaming Device',
      iot_device: 'IoT Device',
      nas: 'Network Storage'
    };
    
    const baseName = typeNames[deviceType] || deviceType.replace(/_/g, ' ');
    return manufacturer ? `${manufacturer} ${baseName}` : baseName;
  }
  
  // Batch update device fingerprints from OUI database
  async updateFromOuiDatabase(ouiData: Array<{
    prefix: string;
    vendor: string;
  }>): Promise<void> {
    const batch = [];
    
    for (const entry of ouiData) {
      // Simple device type inference from vendor name
      let deviceType = 'unknown';
      const vendor = entry.vendor.toLowerCase();
      
      if (vendor.includes('nintendo') || vendor.includes('sony computer') || 
          vendor.includes('microsoft') && vendor.includes('xbox')) {
        deviceType = 'gaming_console';
      } else if (vendor.includes('apple')) {
        deviceType = 'computer'; // Could be phone/tablet/computer
      } else if (vendor.includes('samsung')) {
        deviceType = 'phone'; // Could be TV/phone/tablet
      } else if (vendor.includes('amazon')) {
        deviceType = 'smart_speaker';
      } else if (vendor.includes('google')) {
        deviceType = 'media_player';
      }
      
      batch.push({
        macPrefix: entry.prefix.toUpperCase(),
        manufacturer: entry.vendor,
        deviceType: deviceType as any,
        confidence: '0.50' // Lower confidence for auto-imported
      });
    }
    
    // Batch insert
    if (batch.length > 0) {
      await this.db.insert(deviceFingerprints)
        .values(batch)
        .onConflictDoNothing();
    }
  }
}