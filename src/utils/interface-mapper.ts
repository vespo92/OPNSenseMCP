// Interface mapping utility for OPNsense API
// Maps user-friendly interface names to OPNsense internal keys

export interface InterfaceMapping {
  [key: string]: string;
}

// Default interface mappings for common setups
// These can be overridden by API discovery or environment configuration
export const DEFAULT_INTERFACE_MAPPINGS: InterfaceMapping = {
  'wan': 'wan',
  'lan': 'lan',
  // Common opt interface names - will be discovered from API
  // Users can override via OPNSENSE_INTERFACE_MAPPINGS env var
};

// Protocol mappings (OPNsense uses uppercase)
export const PROTOCOL_MAPPINGS: { [key: string]: string } = {
  'tcp': 'TCP',
  'udp': 'UDP',
  'tcp/udp': 'TCP/UDP',
  'icmp': 'ICMP',
  'esp': 'ESP',
  'ah': 'AH',
  'gre': 'GRE',
  'ipv6': 'IPv6',
  'igmp': 'IGMP',
  'pim': 'PIM',
  'ospf': 'OSPF',
  'any': 'any'
};

export class InterfaceMapper {
  private interfaceMap: InterfaceMapping = {};
  private reverseMap: InterfaceMapping = {};

  constructor(apiInterfaces?: any) {
    // Start with default mappings
    this.interfaceMap = { ...DEFAULT_INTERFACE_MAPPINGS };
    
    // Load custom mappings from environment if provided
    if (process.env.OPNSENSE_INTERFACE_MAPPINGS) {
      try {
        const customMappings = JSON.parse(process.env.OPNSENSE_INTERFACE_MAPPINGS);
        Object.assign(this.interfaceMap, customMappings);
      } catch (e) {
        console.warn('Failed to parse OPNSENSE_INTERFACE_MAPPINGS:', e);
      }
    }
    
    // Override with API-discovered interfaces if available
    if (apiInterfaces) {
      this.buildMapFromAPI(apiInterfaces);
    }
    
    this.buildReverseMap();
  }

  /**
   * Build interface map from OPNsense API response
   */
  private buildMapFromAPI(apiInterfaces: any) {
    Object.entries(apiInterfaces).forEach(([key, value]: [string, any]) => {
      const interfaceName = value.value;
      
      // Extract clean name from value string
      // e.g., "DMZ" from "DMZ" or "igc3_vlan6 (Tag: 6, Parent: igc3) [DMZ]"
      const cleanName = this.extractCleanName(interfaceName);
      
      if (cleanName) {
        // Store multiple mappings for flexibility
        this.interfaceMap[cleanName.toLowerCase()] = key;
        this.interfaceMap[key] = key; // Identity mapping
        
        // Also map VLAN notation if present
        const vlanMatch = interfaceName.match(/(igc\d+_vlan\d+)/);
        if (vlanMatch) {
          this.interfaceMap[vlanMatch[1]] = key;
        }
      }
    });
    
    this.buildReverseMap();
  }

  private extractCleanName(value: string): string {
    // Try to extract from [Name] format
    const bracketMatch = value.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      return bracketMatch[1];
    }
    
    // Otherwise, take the first word
    const firstWord = value.split(/[\s\(]/)[0];
    return firstWord;
  }

  private buildReverseMap() {
    Object.entries(this.interfaceMap).forEach(([friendly, internal]) => {
      this.reverseMap[internal] = friendly;
    });
  }

  /**
   * Map user-friendly interface name to OPNsense internal key
   */
  mapInterface(userInterface: string): string {
    // Check exact match first
    if (this.interfaceMap[userInterface]) {
      return this.interfaceMap[userInterface];
    }
    
    // Try lowercase
    const lower = userInterface.toLowerCase();
    if (this.interfaceMap[lower]) {
      return this.interfaceMap[lower];
    }
    
    // Try without special characters
    const clean = lower.replace(/[^a-z0-9]/g, '');
    if (this.interfaceMap[clean]) {
      return this.interfaceMap[clean];
    }
    
    // Return as-is if no mapping found
    console.warn(`No mapping found for interface: ${userInterface}`);
    return userInterface;
  }

  /**
   * Map OPNsense internal key to user-friendly name
   */
  mapInterfaceReverse(internalKey: string): string {
    return this.reverseMap[internalKey] || internalKey;
  }

  /**
   * Map protocol to OPNsense format
   */
  static mapProtocol(protocol: string): string {
    const lower = protocol.toLowerCase();
    return PROTOCOL_MAPPINGS[lower] || protocol;
  }

  /**
   * Get all available mappings
   */
  getMappings(): InterfaceMapping {
    return { ...this.interfaceMap };
  }
}

export default InterfaceMapper;