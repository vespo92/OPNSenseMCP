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
 * DNS blocklist configuration (individual blocked domain)
 */
export interface DnsBlocklistConfig {
  uuid?: string;
  enabled: boolean;
  host: string;
  description?: string;
}

/**
 * DNSBL subscription blocklist entry (e.g. OISD, Hagezi, Steven Black)
 */
export interface DnsblSubscription {
  uuid: string;
  enabled: boolean;
  selectedLists: string[];
  customLists: string[];
  allowlists: string[];
  wildcards: string[];
  address: string;
  nxdomain: boolean;
  cacheTtl: string;
  description: string;
}

/**
 * Combined DNS blocklist result
 */
export interface DnsBlocklistResult {
  subscriptions: DnsblSubscription[];
  manualBlocks: DnsBlocklistConfig[];
}

/**
 * OPNSense DNS Blocklist Resource for managing Unbound DNS blocklists
 */
export class DnsBlocklistResource {
  constructor(private client: OPNSenseAPIClient) {}

  /**
   * List all DNS blocklist entries (both DNSBL subscriptions and manual blocks)
   */
  async list(): Promise<DnsBlocklistResult> {
    try {
      // Get all Unbound settings
      const response = await this.client.getUnboundSettings();

      const subscriptions: DnsblSubscription[] = [];
      const manualBlocks: DnsBlocklistConfig[] = [];

      // Parse DNSBL subscription blocklists (e.g. OISD, Hagezi, Steven Black)
      const dnsblBlocklist = response?.unbound?.dnsbl?.blocklist;
      if (dnsblBlocklist && typeof dnsblBlocklist === 'object') {
        for (const [uuid, entry] of Object.entries(dnsblBlocklist)) {
          if (typeof entry === 'object' && entry !== null) {
            const entryData = entry as any;

            // Extract selected list names from the type field
            const selectedLists: string[] = [];
            if (entryData.type && typeof entryData.type === 'object') {
              for (const [key, typeInfo] of Object.entries(entryData.type)) {
                if (typeof typeInfo === 'object' && typeInfo !== null && (typeInfo as any).selected === 1) {
                  selectedLists.push((typeInfo as any).value || key);
                }
              }
            }

            // Extract custom lists
            const customLists: string[] = [];
            if (entryData.lists && typeof entryData.lists === 'object') {
              for (const [, listInfo] of Object.entries(entryData.lists)) {
                if (typeof listInfo === 'object' && listInfo !== null) {
                  const val = (listInfo as any).value;
                  if (val) customLists.push(val);
                }
              }
            }

            // Extract allowlists
            const allowlists: string[] = [];
            if (entryData.allowlists && typeof entryData.allowlists === 'object') {
              for (const [, listInfo] of Object.entries(entryData.allowlists)) {
                if (typeof listInfo === 'object' && listInfo !== null) {
                  const val = (listInfo as any).value;
                  if (val) allowlists.push(val);
                }
              }
            }

            // Extract wildcards
            const wildcards: string[] = [];
            if (entryData.wildcards && typeof entryData.wildcards === 'object') {
              for (const [, listInfo] of Object.entries(entryData.wildcards)) {
                if (typeof listInfo === 'object' && listInfo !== null) {
                  const val = (listInfo as any).value;
                  if (val) wildcards.push(val);
                }
              }
            }

            subscriptions.push({
              uuid,
              enabled: entryData.enabled === '1',
              selectedLists,
              customLists,
              allowlists,
              wildcards,
              address: entryData.address || '',
              nxdomain: entryData.nxdomain === '1',
              cacheTtl: entryData.cache_ttl || '',
              description: entryData.description || ''
            });
          }
        }
      }

      // Parse manual host override blocks (pointing to 0.0.0.0)
      const hosts = response?.unbound?.hosts?.host;
      if (hosts && typeof hosts === 'object') {
        for (const [uuid, host] of Object.entries(hosts)) {
          if (typeof host === 'object' && host !== null) {
            const hostData = host as any;
            if (hostData.server === '0.0.0.0') {
              const hostname = hostData.hostname || '';
              manualBlocks.push({
                uuid,
                enabled: hostData.enabled === '1',
                host: hostname ? `${hostname}.${hostData.domain}` : hostData.domain,
                description: hostData.description || ''
              });
            }
          }
        }
      }

      return { subscriptions, manualBlocks };
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
        hostname: host,
        domain: domainPart,
        rr: 'A',
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
      // Find the entry in manual blocks
      const blocklist = await this.list();
      const entry = blocklist.manualBlocks.find(item => item.host === domain);
      
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
  async getInterfaceBlocklist(interfaceName: string): Promise<DnsBlocklistResult> {
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
   * Search blocklist entries (searches both subscriptions and manual blocks)
   */
  async searchBlocklist(pattern: string): Promise<DnsBlocklistResult> {
    const result = await this.list();
    const searchLower = pattern.toLowerCase();

    const subscriptions = result.subscriptions.filter(entry =>
      entry.selectedLists.some(l => l.toLowerCase().includes(searchLower)) ||
      entry.description.toLowerCase().includes(searchLower)
    );

    const manualBlocks = result.manualBlocks.filter(entry =>
      entry.host.toLowerCase().includes(searchLower) ||
      (entry.description && entry.description.toLowerCase().includes(searchLower))
    );

    return { subscriptions, manualBlocks };
  }

  /**
   * Get available DNSBL list types from the API.
   * Returns a map of list key to display name (e.g. { atf: "Abuse.ch - ThreatFox IOC database", ... })
   */
  async getAvailableDnsblLists(): Promise<Record<string, string>> {
    const response = await this.client.getUnboundSettings();
    const dnsblBlocklist = response?.unbound?.dnsbl?.blocklist;
    if (!dnsblBlocklist || typeof dnsblBlocklist !== 'object') {
      return {};
    }

    // Use the first entry's type field to get available lists
    const firstEntry = Object.values(dnsblBlocklist)[0] as any;
    if (!firstEntry?.type || typeof firstEntry.type !== 'object') {
      return {};
    }

    const available: Record<string, string> = {};
    for (const [key, info] of Object.entries(firstEntry.type)) {
      if (typeof info === 'object' && info !== null) {
        available[key] = (info as any).value || key;
      }
    }
    return available;
  }

  /**
   * Add a DNSBL subscription list to an existing entry, or create a new entry.
   * @param listKey - The list key (e.g. "atf", "oisd1", "hgz003")
   * @param targetUuid - Optional UUID of existing entry to modify. If omitted, creates a new entry.
   */
  async addDnsblSubscription(listKey: string, targetUuid?: string): Promise<{ uuid: string; selectedLists: string[] }> {
    // Validate the list key
    const available = await this.getAvailableDnsblLists();
    if (!available[listKey]) {
      const validKeys = Object.entries(available)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');
      throw new Error(`Unknown DNSBL list key "${listKey}". Valid keys:\n${validKeys}`);
    }

    if (targetUuid) {
      // Add to existing entry - get current selected types and append
      const current = await this.client.getDnsbl(targetUuid);
      if (!current?.blocklist) {
        throw new Error(`DNSBL entry ${targetUuid} not found`);
      }

      const currentTypes: string[] = [];
      if (current.blocklist.type && typeof current.blocklist.type === 'object') {
        for (const [key, info] of Object.entries(current.blocklist.type)) {
          if (typeof info === 'object' && info !== null && (info as any).selected === 1) {
            currentTypes.push(key);
          }
        }
      }

      if (currentTypes.includes(listKey)) {
        throw new Error(`List "${available[listKey]}" is already active on this entry`);
      }

      currentTypes.push(listKey);
      const response = await this.client.setDnsbl(targetUuid, {
        enabled: current.blocklist.enabled || '1',
        type: currentTypes.join(','),
      });

      if (response?.result !== 'saved') {
        throw new Error('API returned unexpected result: ' + JSON.stringify(response));
      }

      await this.applyChanges();
      return {
        uuid: targetUuid,
        selectedLists: currentTypes.map(k => available[k] || k),
      };
    } else {
      // Create a new DNSBL entry
      const response = await this.client.addDnsbl({
        enabled: '1',
        type: listKey,
      });

      if (!response?.uuid) {
        throw new Error('Failed to create DNSBL entry: ' + JSON.stringify(response));
      }

      await this.applyChanges();
      return {
        uuid: response.uuid,
        selectedLists: [available[listKey]],
      };
    }
  }

  /**
   * Remove a DNSBL subscription list from an entry.
   * If the entry has only one list, deletes the entire entry.
   * @param listKey - The list key to remove (e.g. "atf", "oisd1")
   * @param targetUuid - UUID of the DNSBL entry to modify.
   */
  async removeDnsblSubscription(listKey: string, targetUuid: string): Promise<{ deleted: boolean; remainingLists: string[] }> {
    const current = await this.client.getDnsbl(targetUuid);
    if (!current?.blocklist) {
      throw new Error(`DNSBL entry ${targetUuid} not found`);
    }

    const available = await this.getAvailableDnsblLists();

    const currentTypes: string[] = [];
    if (current.blocklist.type && typeof current.blocklist.type === 'object') {
      for (const [key, info] of Object.entries(current.blocklist.type)) {
        if (typeof info === 'object' && info !== null && (info as any).selected === 1) {
          currentTypes.push(key);
        }
      }
    }

    if (!currentTypes.includes(listKey)) {
      throw new Error(`List "${available[listKey] || listKey}" is not active on this entry`);
    }

    const remaining = currentTypes.filter(k => k !== listKey);

    if (remaining.length === 0) {
      // No lists left — delete the entire entry
      const response = await this.client.delDnsbl(targetUuid);
      if (response?.result !== 'deleted') {
        throw new Error('Failed to delete DNSBL entry: ' + JSON.stringify(response));
      }
      await this.applyChanges();
      return { deleted: true, remainingLists: [] };
    } else {
      // Update entry with remaining lists
      const response = await this.client.setDnsbl(targetUuid, {
        enabled: current.blocklist.enabled || '1',
        type: remaining.join(','),
      });
      if (response?.result !== 'saved') {
        throw new Error('Failed to update DNSBL entry: ' + JSON.stringify(response));
      }
      await this.applyChanges();
      return {
        deleted: false,
        remainingLists: remaining.map(k => available[k] || k),
      };
    }
  }

  /**
   * Update a DNSBL subscription entry (replace all selected lists, enable/disable, change settings).
   */
  async updateDnsblSubscription(
    targetUuid: string,
    options: { listKeys?: string[]; enabled?: boolean; description?: string }
  ): Promise<{ uuid: string; selectedLists: string[] }> {
    const current = await this.client.getDnsbl(targetUuid);
    if (!current?.blocklist) {
      throw new Error(`DNSBL entry ${targetUuid} not found`);
    }

    const available = await this.getAvailableDnsblLists();
    const update: Record<string, unknown> = {};

    if (options.listKeys !== undefined) {
      // Validate all keys
      for (const key of options.listKeys) {
        if (!available[key]) {
          throw new Error(`Unknown DNSBL list key "${key}"`);
        }
      }
      if (options.listKeys.length === 0) {
        throw new Error('Cannot set empty list — use remove to delete the entry instead');
      }
      update.type = options.listKeys.join(',');
    }

    if (options.enabled !== undefined) {
      update.enabled = options.enabled ? '1' : '0';
    }

    if (options.description !== undefined) {
      update.description = options.description;
    }

    if (Object.keys(update).length === 0) {
      throw new Error('No update options provided');
    }

    const response = await this.client.setDnsbl(targetUuid, update);
    if (response?.result !== 'saved') {
      throw new Error('Failed to update DNSBL entry: ' + JSON.stringify(response));
    }

    await this.applyChanges();

    // Read back the updated state
    const updated = await this.client.getDnsbl(targetUuid);
    const selectedLists: string[] = [];
    if (updated?.blocklist?.type && typeof updated.blocklist.type === 'object') {
      for (const [key, info] of Object.entries(updated.blocklist.type)) {
        if (typeof info === 'object' && info !== null && (info as any).selected === 1) {
          selectedLists.push(available[key] || key);
        }
      }
    }

    return { uuid: targetUuid, selectedLists };
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
