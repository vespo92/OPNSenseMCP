// ARP Table Management Resource
import { OPNSenseAPIClient } from '../../api/client.js';

export interface ArpEntry {
  ip: string;                // IP address
  mac: string;               // MAC address  
  interface: string;         // Network interface
  expires?: number;          // Expiration time (seconds)
  permanent?: boolean;       // Is entry permanent
  hostname?: string;         // Resolved hostname
  vendor?: string;           // MAC vendor lookup
  type?: string;             // Entry type (dynamic/static)
  state?: string;            // Entry state
}

export interface ArpTableStats {
  totalEntries: number;
  dynamicEntries: number;
  staticEntries: number;
  interfaces: string[];
}

export class ArpTableResource {
  private client: OPNSenseAPIClient;
  private debugMode: boolean;

  constructor(client: OPNSenseAPIClient, debugMode: boolean = false) {
    this.client = client;
    this.debugMode = debugMode;
  }

  /**
   * Get complete ARP table
   */
  async list(): Promise<ArpEntry[]> {
    try {
      if (this.debugMode) {
        console.log('[ARP] Fetching ARP table...');
      }

      // OPNsense exposes ARP table through diagnostics interface
      const response = await this.client.get('/diagnostics/interface/getArp');

      if (this.debugMode) {
        console.log('[ARP] Raw response:', JSON.stringify(response, null, 2));
      }

      // Handle different response formats
      let entries: any[] = [];
      
      if (response && response.rows && Array.isArray(response.rows)) {
        entries = response.rows;
      } else if (Array.isArray(response)) {
        entries = response;
      } else if (response && response.arp && Array.isArray(response.arp)) {
        entries = response.arp;
      }

      return entries.map(entry => this.normalizeArpEntry(entry));
    } catch (error) {
      if (this.debugMode) {
        console.error('[ARP] Failed to fetch ARP table:', error);
      }
      
      // Try alternative endpoint
      try {
        const altResponse = await this.client.post('/diagnostics/interface/searchArp', {
          current: 1,
          rowCount: 10000,
          sort: {},
          searchPhrase: ''
        });
        
        if (altResponse && altResponse.rows) {
          return altResponse.rows.map((entry: any) => this.normalizeArpEntry(entry));
        }
      } catch (altError) {
        if (this.debugMode) {
          console.error('[ARP] Alternative endpoint also failed:', altError);
        }
      }
      
      throw new Error(`Failed to fetch ARP table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize ARP entry from various API response formats
   */
  private normalizeArpEntry(raw: any): ArpEntry {
    return {
      ip: raw.ip || raw.address || raw.ipaddr || '',
      mac: raw.mac || raw.hwaddr || raw.ethernet || '',
      interface: raw.intf || raw.interface || raw.if || '',
      expires: raw.expires || raw.expire || raw.timeout,
      permanent: raw.permanent || raw.perm || raw.static || false,
      hostname: raw.hostname || raw.host || '',
      vendor: this.getMacVendor(raw.mac || raw.hwaddr || raw.ethernet || ''),
      type: raw.type || (raw.permanent ? 'static' : 'dynamic'),
      state: raw.state || 'active'
    };
  }

  /**
   * Find ARP entries by IP address or subnet
   */
  async findByIp(ipPattern: string): Promise<ArpEntry[]> {
    const entries = await this.list();
    
    // Check if it's a subnet (contains /)
    if (ipPattern.includes('/')) {
      return this.filterBySubnet(entries, ipPattern);
    }
    
    // Otherwise treat as IP prefix or exact match
    return entries.filter(entry => 
      entry.ip.startsWith(ipPattern) || entry.ip === ipPattern
    );
  }

  /**
   * Find ARP entries by MAC address
   */
  async findByMac(macPattern: string): Promise<ArpEntry[]> {
    const entries = await this.list();
    const searchMac = macPattern.toLowerCase().replace(/[:-]/g, '');
    
    return entries.filter(entry => {
      const entryMac = entry.mac.toLowerCase().replace(/[:-]/g, '');
      return entryMac.includes(searchMac);
    });
  }

  /**
   * Find ARP entries by interface
   */
  async findByInterface(interfaceName: string): Promise<ArpEntry[]> {
    const entries = await this.list();
    return entries.filter(entry => entry.interface === interfaceName);
  }

  /**
   * Find ARP entries by hostname pattern
   */
  async findByHostname(pattern: string): Promise<ArpEntry[]> {
    const entries = await this.list();
    const searchPattern = pattern.toLowerCase();
    
    return entries.filter(entry => 
      entry.hostname?.toLowerCase().includes(searchPattern)
    );
  }

  /**
   * Get ARP table statistics
   */
  async getStats(): Promise<ArpTableStats> {
    const entries = await this.list();
    const interfaces = new Set<string>();
    let dynamicCount = 0;
    let staticCount = 0;

    entries.forEach(entry => {
      if (entry.interface) {
        interfaces.add(entry.interface);
      }
      if (entry.permanent) {
        staticCount++;
      } else {
        dynamicCount++;
      }
    });

    return {
      totalEntries: entries.length,
      dynamicEntries: dynamicCount,
      staticEntries: staticCount,
      interfaces: Array.from(interfaces)
    };
  }

  /**
   * Find devices on specific VLANs
   */
  async findOnVlan(vlanTag: string): Promise<ArpEntry[]> {
    const entries = await this.list();
    const vlanInterfaces = [`vlan${vlanTag}`, `igc2_vlan${vlanTag}`, `igc3_vlan${vlanTag}`];
    
    return entries.filter(entry => 
      vlanInterfaces.some(iface => entry.interface.includes(iface))
    );
  }

  /**
   * Filter entries by subnet
   */
  private filterBySubnet(entries: ArpEntry[], subnet: string): ArpEntry[] {
    const [network, maskBits] = subnet.split('/');
    const mask = parseInt(maskBits) || 24;
    
    // Simple subnet matching for common cases
    if (mask === 24) {
      const prefix = network.split('.').slice(0, 3).join('.');
      return entries.filter(entry => entry.ip.startsWith(prefix + '.'));
    } else if (mask === 16) {
      const prefix = network.split('.').slice(0, 2).join('.');
      return entries.filter(entry => entry.ip.startsWith(prefix + '.'));
    } else if (mask === 8) {
      const prefix = network.split('.')[0];
      return entries.filter(entry => entry.ip.startsWith(prefix + '.'));
    }
    
    // For other masks, do simple prefix matching
    return entries.filter(entry => entry.ip.startsWith(network.split('.')[0]));
  }

  /**
   * Get MAC vendor information
   */
  private getMacVendor(mac: string): string {
    if (!mac || mac.length < 8) {
      return 'Unknown';
    }

    const prefix = mac.substring(0, 8).toUpperCase().replace(/[:-]/g, '');
    
    // Extended vendor database
    const vendors: { [key: string]: string } = {
      '001B63': 'Apple',
      'ACDE48': 'Apple', 
      '3C22FB': 'Apple',
      '94B8C5': 'Apple',
      'A8BE27': 'Apple',
      'DCA632': 'Raspberry Pi',
      'B827EB': 'Raspberry Pi',
      'E45F01': 'Raspberry Pi',
      '005056': 'VMware',
      '000C29': 'VMware',
      '080027': 'VirtualBox',
      '00155D': 'Microsoft Hyper-V',
      '001C42': 'Parallels',
      '245EBE': 'PC Engines (OPNsense)',
      '00D9D1': 'Sony',
      '0403D6': 'Nintendo',
      '940103': 'Samsung',
      'AC5F3E': 'Samsung',
      '001A11': 'Google',
      '94EB2C': 'Google',
      '005050': 'Microsoft',
      '0003FF': 'Microsoft Xbox',
      '3CD92B': 'HP',
      '001B11': 'Dell',
      'B083FE': 'Dell',
      '14FEB5': 'Dell',
      '18A99B': 'Dell',
      '74AC6F': 'Ubiquiti',
      '788A20': 'Ubiquiti',
      'FCF528': 'ZTE',
      '8CC8CD': 'Cisco',
      '00E0FC': 'Cisco',
      '70B3D5': 'IEEE Registration',
      '000E08': 'Mikrotik',
      '2CC81B': 'Mikrotik',
      '4CCC6A': 'Mikrotik',
      '98DA00': 'Intel',
      '3C7A8A': 'Intel',
      'F0EF86': 'Google',
      '84E342': 'Tuya Smart',
      '7CF666': 'Tuya Smart',
      '6032B1': 'TP-Link',
      'B0A7B9': 'TP-Link',
      '70039F': 'Espressif (ESP32)',
      'C4DD57': 'Espressif (ESP32)',
      'B4E62D': 'Espressif (ESP32)',
      'E868E7': 'Espressif (ESP32)',
      '4C11AE': 'Espressif (ESP8266)'
    };

    // Check exact matches first
    for (const [vendorPrefix, vendor] of Object.entries(vendors)) {
      if (prefix.startsWith(vendorPrefix)) {
        return vendor;
      }
    }

    return 'Unknown';
  }

  /**
   * Format ARP entry for display
   */
  formatEntry(entry: ArpEntry): string {
    const hostname = entry.hostname || 'No hostname';
    const type = entry.permanent ? 'static' : 'dynamic';
    const vendor = entry.vendor || 'Unknown';
    
    return `${entry.ip.padEnd(15)} ${entry.mac} (${vendor}) on ${entry.interface} - ${hostname} [${type}]`;
  }

  /**
   * Clear ARP entry (requires specific permissions)
   */
  async clearEntry(ip: string, interfaceName?: string): Promise<boolean> {
    try {
      const data: any = { address: ip };
      if (interfaceName) {
        data.interface = interfaceName;
      }
      
      await this.client.post('/diagnostics/interface/flushArp', data);
      return true;
    } catch (error) {
      if (this.debugMode) {
        console.error('[ARP] Failed to clear entry:', error);
      }
      throw new Error(`Failed to clear ARP entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add static ARP entry (requires specific permissions)
   */
  async addStaticEntry(ip: string, mac: string, interfaceName: string): Promise<boolean> {
    try {
      await this.client.post('/diagnostics/interface/setArp', {
        address: ip,
        mac: mac,
        interface: interfaceName
      });
      return true;
    } catch (error) {
      if (this.debugMode) {
        console.error('[ARP] Failed to add static entry:', error);
      }
      throw new Error(`Failed to add static ARP entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default ArpTableResource;