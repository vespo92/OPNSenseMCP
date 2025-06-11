import { Resource, ValidationResult, ValidationHelper, ResourceProperties, ResourceState } from '../base.js';

/**
 * Firewall alias properties interface
 */
export interface FirewallAliasProperties extends ResourceProperties {
  type: 'host' | 'network' | 'port' | 'url' | 'geoip' | 'asn' | 'dynipv6host' | 'authgroup' | 'internal' | 'external';
  content: string;
  description?: string;
  enabled?: boolean;
  updateFreq?: number; // For URL type aliases
  counters?: boolean;
  proto?: 'IPv4' | 'IPv6' | 'IPv4,IPv6';
  interface?: string; // For dynamic types
}

/**
 * OPNSense Firewall Alias Resource
 */
export class FirewallAlias extends Resource {
  constructor(
    name: string,
    properties: FirewallAliasProperties,
    dependencies: string[] = []
  ) {
    super('opnsense:firewall:alias', name, properties, dependencies);
  }

  /**
   * Validate alias configuration
   */
  validate(): ValidationResult {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredErrors = ValidationHelper.validateRequired(this.properties, [
      'type',
      'content'
    ]);
    errors.push(...requiredErrors);

    // Validate type
    if (this.properties.type) {
      const validTypes = [
        'host', 'network', 'port', 'url', 'geoip', 
        'asn', 'dynipv6host', 'authgroup', 'internal', 'external'
      ];
      const typeError = ValidationHelper.validateEnum(
        this.properties.type,
        'type',
        validTypes
      );
      if (typeError) errors.push(typeError);
    }

    // Validate content based on type
    if (this.properties.type && this.properties.content) {
      const contentErrors = this.validateContent();
      errors.push(...contentErrors);
    }

    // Validate alias name
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(this.name)) {
      errors.push({
        property: 'name',
        message: 'Alias name must start with a letter and contain only letters, numbers, and underscores',
        code: 'INVALID_ALIAS_NAME'
      });
    }

    // Warnings
    if (this.properties.type === 'url' && !this.properties.updateFreq) {
      warnings.push({
        property: 'updateFreq',
        message: 'URL aliases should specify an update frequency',
        code: 'MISSING_UPDATE_FREQ'
      });
    }

    if (this.properties.content.split('\n').length > 5000) {
      warnings.push({
        property: 'content',
        message: 'Alias contains more than 5000 entries, which may impact performance',
        code: 'LARGE_ALIAS'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Convert to OPNSense API payload
   */
  toApiPayload(): any {
    return {
      alias: {
        name: this.name,
        type: this.properties.type,
        content: this.properties.content.split('\n').join(','), // API expects comma-separated
        description: this.properties.description || '',
        enabled: this.properties.enabled !== false ? '1' : '0',
        updatefreq: this.properties.updateFreq?.toString() || '',
        counters: this.properties.counters ? '1' : '0',
        proto: this.properties.proto || 'IPv4,IPv6',
        interface: this.properties.interface || ''
      }
    };
  }

  /**
   * Update resource from API response
   */
  fromApiResponse(response: any): void {
    if (response.uuid) {
      this.outputs.uuid = response.uuid;
      this.properties._uuid = response.uuid;
    }
    
    if (response.result) {
      this.outputs.result = response.result;
    }
    
    // Update state based on response
    if (response.result === 'saved') {
      this.state = this.state === ResourceState.Creating ? ResourceState.Created : ResourceState.Updated;
    } else if (response.result === 'deleted') {
      this.state = ResourceState.Deleted;
    }
  }

  /**
   * Validate content based on alias type
   */
  private validateContent(): any[] {
    const errors = [];
    const content = this.properties.content;
    const lines = content.split('\n').filter((line: string) => line.trim());

    switch (this.properties.type) {
      case 'host':
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !this.isValidHost(trimmed)) {
            errors.push({
              property: 'content',
              message: `Invalid host entry: ${trimmed}`,
              code: 'INVALID_HOST'
            });
          }
        }
        break;

      case 'network':
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !this.isValidNetwork(trimmed)) {
            errors.push({
              property: 'content',
              message: `Invalid network entry: ${trimmed}`,
              code: 'INVALID_NETWORK'
            });
          }
        }
        break;

      case 'port':
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !this.isValidPort(trimmed)) {
            errors.push({
              property: 'content',
              message: `Invalid port entry: ${trimmed}`,
              code: 'INVALID_PORT'
            });
          }
        }
        break;

      case 'url':
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !this.isValidUrl(trimmed)) {
            errors.push({
              property: 'content',
              message: `Invalid URL: ${trimmed}`,
              code: 'INVALID_URL'
            });
          }
        }
        break;

      case 'geoip':
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !this.isValidCountryCode(trimmed)) {
            errors.push({
              property: 'content',
              message: `Invalid country code: ${trimmed}`,
              code: 'INVALID_COUNTRY_CODE'
            });
          }
        }
        break;

      case 'asn':
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !this.isValidAsn(trimmed)) {
            errors.push({
              property: 'content',
              message: `Invalid ASN: ${trimmed}`,
              code: 'INVALID_ASN'
            });
          }
        }
        break;
    }

    return errors;
  }

  /**
   * Validate host entry (IP or hostname)
   */
  private isValidHost(host: string): boolean {
    // Check if it's an IP address
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    if (ipv4Regex.test(host) || ipv6Regex.test(host)) {
      return true;
    }
    
    // Check if it's a valid hostname
    const hostnameRegex = /^(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/;
    return hostnameRegex.test(host);
  }

  /**
   * Validate network entry (CIDR notation)
   */
  private isValidNetwork(network: string): boolean {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    const ipv6CidrRegex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/;
    
    return cidrRegex.test(network) || ipv6CidrRegex.test(network);
  }

  /**
   * Validate port entry
   */
  private isValidPort(port: string): boolean {
    // Single port
    if (/^\d+$/.test(port)) {
      const portNum = parseInt(port, 10);
      return portNum >= 1 && portNum <= 65535;
    }
    
    // Port range
    if (/^\d+-\d+$/.test(port)) {
      const [start, end] = port.split('-').map(p => parseInt(p, 10));
      return start >= 1 && start <= 65535 && 
             end >= 1 && end <= 65535 && 
             start < end;
    }
    
    return false;
  }

  /**
   * Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate country code
   */
  private isValidCountryCode(code: string): boolean {
    // ISO 3166-1 alpha-2 country codes
    return /^[A-Z]{2}$/.test(code);
  }

  /**
   * Validate ASN
   */
  private isValidAsn(asn: string): boolean {
    // ASN format: AS followed by number
    return /^AS\d+$/.test(asn);
  }

  /**
   * Get entries as array
   */
  getEntries(): string[] {
    return this.properties.content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
  }

  /**
   * Add entry to alias
   */
  addEntry(entry: string): void {
    const entries = this.getEntries();
    if (!entries.includes(entry.trim())) {
      entries.push(entry.trim());
      this.properties.content = entries.join('\n');
      this.metadata.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Remove entry from alias
   */
  removeEntry(entry: string): boolean {
    const entries = this.getEntries();
    const index = entries.indexOf(entry.trim());
    if (index !== -1) {
      entries.splice(index, 1);
      this.properties.content = entries.join('\n');
      this.metadata.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Check if alias contains entry
   */
  hasEntry(entry: string): boolean {
    return this.getEntries().includes(entry.trim());
  }
}
