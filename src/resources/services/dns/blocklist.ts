import { OPNSenseAPIClient } from '../../../api/client.js';

/**
 * DNS blocklist item interface
 */
export interface DnsBlocklistItem {
  enabled: '0' | '1';
  host: string;
  description?: string;
}

/**
 * DNS blocklist configuration
 */
export interface DnsBlocklistConfig {
  uuid?: string;
  enabled: boolean;
  host: string;
  description?: string;
}

/**
 * OPNSense DNS Blocklist Resource for managing Unbound DNS blocklists
 */
export class DnsBlocklistResource {
  constructor(private client: OPNSenseAPIClient) {}

  /**
   * List all DNS blocklist entries
   */
  async list(): Promise<DnsBlocklistConfig[]> {
    try {
      // Get all Unbound settings
      const response = await this.client.getUnboundSettings();
      
      if (!response?.unbound?.hosts) {
        return [];
      }

      // Extract host overrides that act as blocklist entries (pointing to 0.0.0.0)
      const hosts = response.unbound.hosts;
      const blocklist: DnsBlocklistConfig[] = [];

      for (const [uuid, host] of Object.entries(hosts)) {
        if (typeof host === 'object' && host !== null) {
          const hostData = host as any;
          // Check if this is a blocklist entry (points to 0.0.0.0)
          if (hostData.server === '0.0.0.0') {
            blocklist.push({
              uuid,
              enabled: hostData.enabled === '1',
              host: `${hostData.host}.${hostData.domain}`,
              description: hostData.description || ''
            });
          }
        }
      }

      return blocklist;
    } catch (error: any) {
      console.error('Failed to list DNS blocklist:', error);
      throw new Error(`Failed to list DNS blocklist: ${error.message}`);
    }
  }

  /**
   * Add a domain to the blocklist
   */
  async blockDomain(domain: string, description?: string): Promise<{ uuid: string }> {
    try {
      // Parse domain into host and domain parts
      const parts = domain.split('.');
      let host = '';
      let domainPart = '';
      
      if (parts.length >= 2) {
        // For subdomains like ads.example.com, host=ads, domain=example.com
        // For domains like example.com, host=@, domain=example.com
        if (parts.length === 2) {
          host = '@';  // Special case for root domain
          domainPart = domain;
        } else {
          host = parts[0];
          domainPart = parts.slice(1).join('.');
        }
      } else {
        throw new Error('Invalid domain format');
      }

      const hostData: any = {
        enabled: '1',
        host: host,
        domain: domainPart,
        server: '0.0.0.0',  // Block by pointing to 0.0.0.0
        description: description || `Blocked: ${domain}`
      };

      // Add the host override
      const response = await this.client.addUnboundHost(hostData);
      
      if (response?.uuid) {
        // Apply changes
        await this.applyChanges();
        return { uuid: response.uuid };
      }
      
      throw new Error('Failed to add domain to blocklist');
    } catch (error: any) {
      console.error('Failed to block domain:', error);
      throw new Error(`Failed to block domain: ${error.message}`);
    }
  }

  /**
   * Remove a domain from the blocklist
   */
  async unblockDomain(domain: string): Promise<void> {
    try {
      // Find the entry
      const blocklist = await this.list();
      const entry = blocklist.find(item => item.host === domain);
      
      if (!entry || !entry.uuid) {
        throw new Error(`Domain ${domain} not found in blocklist`);
      }

      // Delete the entry
      await this.client.delUnboundHost(entry.uuid);
      
      // Apply changes
      await this.applyChanges();
    } catch (error: any) {
      console.error('Failed to unblock domain:', error);
      throw new Error(`Failed to unblock domain: ${error.message}`);
    }
  }

  /**
   * Block multiple domains at once
   */
  async blockMultipleDomains(domains: string[], description?: string): Promise<{ blocked: string[], failed: string[] }> {
    const blocked: string[] = [];
    const failed: string[] = [];

    for (const domain of domains) {
      try {
        await this.blockDomain(domain, description);
        blocked.push(domain);
      } catch (error) {
        console.error(`Failed to block ${domain}:`, error);
        failed.push(domain);
      }
    }

    return { blocked, failed };
  }

  /**
   * Get blocklist entries for a specific interface
   * Note: This requires domain-based access control lists which may need additional configuration
   */
  async getInterfaceBlocklist(interfaceName: string): Promise<DnsBlocklistConfig[]> {
    // For now, return all blocklist entries with a note about interface filtering
    const allBlocked = await this.list();
    
    // In a full implementation, this would filter based on ACLs
    console.warn(`Interface-specific filtering for ${interfaceName} requires ACL configuration`);
    
    return allBlocked;
  }

  /**
   * Block common adult content domains
   */
  async blockAdultContent(): Promise<{ blocked: string[], failed: string[] }> {
    const adultDomains = [
      'pornhub.com',
      'www.pornhub.com',
      'xvideos.com',
      'www.xvideos.com',
      'xhamster.com',
      'www.xhamster.com',
      'xnxx.com',
      'www.xnxx.com',
      'redtube.com',
      'www.redtube.com',
      'youporn.com',
      'www.youporn.com'
    ];

    return this.blockMultipleDomains(adultDomains, 'Adult Content Block');
  }

  /**
   * Block common malware domains (example list)
   */
  async blockMalware(): Promise<{ blocked: string[], failed: string[] }> {
    const malwareDomains = [
      'malware-test.com',
      'phishing-test.com',
      // Add more known malware domains
    ];

    return this.blockMultipleDomains(malwareDomains, 'Malware Block');
  }

  /**
   * Toggle a blocklist entry
   */
  async toggleBlocklistEntry(uuid: string): Promise<void> {
    try {
      const entry = await this.client.getUnboundHost(uuid);
      if (!entry?.host) {
        throw new Error('Blocklist entry not found');
      }

      const updated = {
        ...entry.host,
        enabled: entry.host.enabled === '1' ? '0' : '1'
      };

      await this.client.setUnboundHost(uuid, updated);
      await this.applyChanges();
    } catch (error: any) {
      console.error('Failed to toggle blocklist entry:', error);
      throw new Error(`Failed to toggle blocklist entry: ${error.message}`);
    }
  }

  /**
   * Search blocklist entries
   */
  async searchBlocklist(pattern: string): Promise<DnsBlocklistConfig[]> {
    const allEntries = await this.list();
    const searchLower = pattern.toLowerCase();
    
    return allEntries.filter(entry => 
      entry.host.toLowerCase().includes(searchLower) ||
      (entry.description && entry.description.toLowerCase().includes(searchLower))
    );
  }

  /**
   * Apply DNS configuration changes
   */
  private async applyChanges(): Promise<void> {
    try {
      await this.client.applyUnboundChanges();
    } catch (error: any) {
      console.error('Failed to apply DNS changes:', error);
      throw new Error(`Failed to apply DNS changes: ${error.message}`);
    }
  }

  /**
   * Create predefined blocklist categories
   */
  async applyBlocklistCategory(category: 'adult' | 'malware' | 'ads' | 'social'): Promise<{ blocked: string[], failed: string[] }> {
    switch (category) {
      case 'adult':
        return this.blockAdultContent();
      
      case 'malware':
        return this.blockMalware();
      
      case 'ads': {
        const adDomains = [
          'doubleclick.net',
          'googleadservices.com',
          'googlesyndication.com',
          'adnxs.com',
          'facebook.com/tr',
          'amazon-adsystem.com'
        ];
        return this.blockMultipleDomains(adDomains, 'Ad Block');
      }
      
      case 'social': {
        const socialDomains = [
          'facebook.com',
          'www.facebook.com',
          'instagram.com',
          'www.instagram.com',
          'twitter.com',
          'www.twitter.com',
          'tiktok.com',
          'www.tiktok.com'
        ];
        return this.blockMultipleDomains(socialDomains, 'Social Media Block');
      }
      
      default:
        throw new Error(`Unknown category: ${category}`);
    }
  }
}

// Export for both TypeScript and JavaScript usage
export default DnsBlocklistResource;
