// DHCP Lease Management Resource
import { OPNSenseAPIClient } from '../../../api/client.js';

export interface DhcpLease {
  address: string;          // IP address
  hwaddr: string;           // MAC address
  hostname?: string;        // Device hostname
  descr?: string;           // Description
  starts?: string;          // Lease start time
  ends?: string;            // Lease end time
  state?: string;           // active, expired, etc.
  act?: string;             // Action
  wstatus?: string;         // Status
  if?: string;              // Interface
}

export interface DhcpStaticMapping {
  uuid?: string;
  mac: string;              // MAC address
  ipaddr: string;           // IP address
  hostname?: string;        // Hostname
  descr?: string;           // Description
  winsserver?: string;      // WINS server
  dnsserver?: string;       // DNS server
  gateway?: string;         // Gateway
  domain?: string;          // Domain
  domainsearchlist?: string; // Domain search list
  ntpserver?: string;       // NTP server
}

export class DhcpLeaseResource {
  private client: OPNSenseAPIClient;

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
  }

  /**
   * List all DHCP leases
   */
  async listLeases(): Promise<DhcpLease[]> {
    try {
      const response = await this.client.post('/dhcpv4/leases/searchLease', {
        current: 1,
        rowCount: 1000,
        sort: {},
        searchPhrase: ''
      });
      return response.rows || [];
    } catch (error) {
      console.error('Failed to list DHCP leases:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Find leases by hostname pattern
   */
  async findByHostname(pattern: string): Promise<DhcpLease[]> {
    const leases = await this.listLeases();
    const searchPattern = pattern.toLowerCase();
    
    return leases.filter(lease => 
      lease.hostname?.toLowerCase().includes(searchPattern) ||
      lease.descr?.toLowerCase().includes(searchPattern)
    );
  }

  /**
   * Find leases by MAC address
   */
  async findByMac(mac: string): Promise<DhcpLease[]> {
    const leases = await this.listLeases();
    const searchMac = mac.toLowerCase().replace(/[:-]/g, '');
    
    return leases.filter(lease => {
      const leaseMac = lease.hwaddr.toLowerCase().replace(/[:-]/g, '');
      return leaseMac.includes(searchMac);
    });
  }

  /**
   * Get leases for specific interface
   */
  async getInterfaceLeases(interfaceName: string): Promise<DhcpLease[]> {
    const leases = await this.listLeases();
    return leases.filter(lease => lease.if === interfaceName);
  }

  /**
   * Get leases for guest network (VLAN 4)
   */
  async getGuestLeases(): Promise<DhcpLease[]> {
    return this.getInterfaceLeases('igc2_vlan4');
  }

  /**
   * Get device info summary
   */
  getDeviceInfo(lease: DhcpLease): string {
    const hostname = lease.hostname || 'Unknown device';
    const manufacturer = this.getMacManufacturer(lease.hwaddr);
    
    return `${hostname} - ${lease.address} (${manufacturer})`;
  }

  /**
   * Simple MAC address manufacturer lookup
   */
  private getMacManufacturer(mac: string): string {
    const prefix = mac.substring(0, 8).toUpperCase();
    
    // Common manufacturer prefixes
    const manufacturers: { [key: string]: string } = {
      '00:1B:63': 'Apple',
      'AC:DE:48': 'Apple',
      '00:23:12': 'Apple',
      '00:50:56': 'VMware',
      '00:0C:29': 'VMware',
      '08:00:27': 'VirtualBox',
      '00:15:5D': 'Microsoft Hyper-V',
      '00:1C:42': 'Parallels',
      'DC:A6:32': 'Raspberry Pi',
      'B8:27:EB': 'Raspberry Pi',
      '00:50:B6': 'PlayStation',
      '00:04:20': 'PlayStation',
      '00:D9:D1': 'Sony',
      '00:24:D6': 'Intel',
      '00:1F:16': 'Intel',
      '00:13:77': 'Samsung',
      '00:15:99': 'Samsung',
      '00:21:19': 'Samsung',
      '00:26:37': 'Samsung',
      '94:01:C2': 'Samsung',
      'AC:5F:3E': 'Samsung',
      '00:09:2D': 'HTC',
      '00:23:76': 'HTC',
      '00:BB:3A': 'Google',
      '94:EB:2C': 'Google',
      '00:1A:11': 'Google',
      '00:50:F2': 'Microsoft',
      '00:03:FF': 'Microsoft Xbox',
      '00:50:8B': 'HP',
      '00:17:A4': 'HP',
      '00:21:5A': 'HP',
      '00:1C:C4': 'HP',
      '00:23:7D': 'HP',
      '00:25:B3': 'HP',
      '3C:D9:2B': 'HP',
      '00:04:00': 'Lexmark',
      '00:20:00': 'Lexmark',
      '00:00:48': 'Epson',
      '00:1B:11': 'Dell',
      '00:14:22': 'Dell',
      '00:19:B9': 'Dell',

      'B0:83:FE': 'Dell',
      '00:0D:56': 'Dell',
      '00:12:3F': 'Dell',
      '00:15:C5': 'Dell',
      '00:18:8B': 'Dell',
      '00:1A:A0': 'Dell',
      '00:1C:23': 'Dell',
      '00:1D:09': 'Dell',
      '00:1E:4F': 'Dell',
      '00:1E:C9': 'Dell',
      '00:21:70': 'Dell',
      '00:21:9B': 'Dell',
      '00:23:AE': 'Dell',
      '00:25:64': 'Dell',
      '00:26:B9': 'Dell',
      '14:FE:B5': 'Dell',
      '18:03:73': 'Dell',
      '18:A9:9B': 'Dell',
      '1C:40:24': 'Dell',
      '20:04:0F': 'Dell',
      '24:B6:FD': 'Dell',
      '28:F1:0E': 'Dell'
    };

    // Check for manufacturer
    for (const [prefixKey, manufacturer] of Object.entries(manufacturers)) {
      if (prefix.startsWith(prefixKey)) {
        return manufacturer;
      }
    }

    // Try to identify by common patterns
    if (mac.includes('DESKTOP') || mac.includes('PC')) {
      return 'Windows PC';
    } else if (mac.includes('android')) {
      return 'Android device';
    } else if (mac.includes('iPhone') || mac.includes('iPad')) {
      return 'Apple device';
    }

    return 'Unknown manufacturer';
  }

  /**
   * Format lease for display
   */
  formatLease(lease: DhcpLease): string {
    const hostname = lease.hostname || 'Unknown';
    const state = lease.state || 'unknown';
    const manufacturer = this.getMacManufacturer(lease.hwaddr);
    
    return `${hostname} - IP: ${lease.address}, MAC: ${lease.hwaddr} (${manufacturer}), State: ${state}`;
  }

  /**
   * Group leases by interface
   */
  async getLeasesByInterface(): Promise<Map<string, DhcpLease[]>> {
    const leases = await this.listLeases();
    const grouped = new Map<string, DhcpLease[]>();
    
    for (const lease of leases) {
      const iface = lease.if || 'unknown';
      if (!grouped.has(iface)) {
        grouped.set(iface, []);
      }
      grouped.get(iface)!.push(lease);
    }
    
    return grouped;
  }
}

export default DhcpLeaseResource;
