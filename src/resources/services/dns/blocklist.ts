import { OPNSenseAPIClient } from '../../../api/client.js';
import { logger } from '../../../utils/logger.js';

/**
 * OPNsense API response shapes for Unbound DNSBL / host override data.
 * These mirror the JSON structure returned by the OPNsense REST API.
 */
interface OPNsenseTypeEntry {
  value: string;
  selected: 0 | 1;
}

interface OPNsenseSelectableList {
  value: string;
  selected: 0 | 1;
}

interface OPNsenseDnsblEntry {
  enabled: '0' | '1';
  type: Record<string, OPNsenseTypeEntry>;
  lists: Record<string, OPNsenseSelectableList>;
  allowlists: Record<string, OPNsenseSelectableList>;
  wildcards: Record<string, OPNsenseSelectableList>;
  address: string;
  nxdomain: '0' | '1';
  cache_ttl: string;
  description: string;
}

interface OPNsenseHostOverride {
  enabled: '0' | '1';
  hostname: string;
  domain: string;
  server: string;
  description: string;
  rr: Record<string, OPNsenseSelectableList>;
}

interface OPNsenseDnsblGetResponse {
  blocklist: OPNsenseDnsblEntry;
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
   * Extract selected keys from an OPNsense type map (entries where selected === 1).
   */
  private static extractSelectedKeys(typeMap: Record<string, OPNsenseTypeEntry>): string[] {
    const keys: string[] = [];
    for (const [key, entry] of Object.entries(typeMap)) {
      if (entry?.selected === 1) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Extract selected display names from an OPNsense type map.
   */
  private static extractSelectedNames(typeMap: Record<string, OPNsenseTypeEntry>): string[] {
    const names: string[] = [];
    for (const entry of Object.values(typeMap)) {
      if (entry?.selected === 1) {
        names.push(entry.value || '');
      }
    }
    return names;
  }

  /**
   * Extract non-empty values from an OPNsense selectable list map.
   */
  private static extractListValues(listMap: Record<string, OPNsenseSelectableList>): string[] {
    const values: string[] = [];
    for (const entry of Object.values(listMap)) {
      if (entry?.value) {
        values.push(entry.value);
      }
    }
    return values;
  }

  /**
   * List all DNS blocklist entries (both DNSBL subscriptions and manual blocks)
   */
  async list(): Promise<DnsBlocklistResult> {
    try {
      const response = await this.client.getUnboundSettings();

      const subscriptions: DnsblSubscription[] = [];
      const manualBlocks: DnsBlocklistConfig[] = [];

      // Parse DNSBL subscription blocklists (e.g. OISD, Hagezi, Steven Black)
      const dnsblBlocklist = response?.unbound?.dnsbl?.blocklist as
        Record<string, OPNsenseDnsblEntry> | undefined;

      if (dnsblBlocklist && typeof dnsblBlocklist === 'object') {
        for (const [uuid, entry] of Object.entries(dnsblBlocklist)) {
          if (!entry || typeof entry !== 'object') continue;

          subscriptions.push({
            uuid,
            enabled: entry.enabled === '1',
            selectedLists: entry.type
              ? DnsBlocklistResource.extractSelectedNames(entry.type)
              : [],
            customLists: entry.lists
              ? DnsBlocklistResource.extractListValues(entry.lists)
              : [],
            allowlists: entry.allowlists
              ? DnsBlocklistResource.extractListValues(entry.allowlists)
              : [],
            wildcards: entry.wildcards
              ? DnsBlocklistResource.extractListValues(entry.wildcards)
              : [],
            address: entry.address || '',
            nxdomain: entry.nxdomain === '1',
            cacheTtl: entry.cache_ttl || '',
            description: entry.description || '',
          });
        }
      }

      // Parse manual host override blocks (pointing to 0.0.0.0)
      const hosts = response?.unbound?.hosts?.host as
        Record<string, OPNsenseHostOverride> | undefined;

      if (hosts && typeof hosts === 'object') {
        for (const [uuid, hostData] of Object.entries(hosts)) {
          if (!hostData || typeof hostData !== 'object') continue;
          if (hostData.server === '0.0.0.0') {
            const hostname = hostData.hostname || '';
            manualBlocks.push({
              uuid,
              enabled: hostData.enabled === '1',
              host: hostname ? `${hostname}.${hostData.domain}` : hostData.domain,
              description: hostData.description || '',
            });
          }
        }
      }

      return { subscriptions, manualBlocks };
    } catch (error: any) {
      logger.error('Failed to list DNS blocklist:', error);
      throw new Error(`Failed to list DNS blocklist: ${error.message}`);
    }
  }

  /**
   * Add a domain to the blocklist
   */
  async blockDomain(domain: string, description?: string): Promise<{ uuid: string }> {
    try {
      const parts = domain.split('.');
      let host = '';
      let domainPart = '';

      if (parts.length >= 2) {
        if (parts.length === 2) {
          host = '@';
          domainPart = domain;
        } else {
          host = parts[0];
          domainPart = parts.slice(1).join('.');
        }
      } else {
        throw new Error('Invalid domain format');
      }

      const hostData = {
        enabled: '1',
        hostname: host,
        domain: domainPart,
        rr: 'A',
        server: '0.0.0.0',
        description: description || `Blocked: ${domain}`,
      };

      const response = await this.client.addUnboundHost(hostData);

      if (response?.uuid) {
        await this.applyChanges();
        return { uuid: response.uuid };
      }

      throw new Error('Failed to add domain to blocklist');
    } catch (error: any) {
      logger.error('Failed to block domain:', error);
      throw new Error(`Failed to block domain: ${error.message}`);
    }
  }

  /**
   * Remove a domain from the blocklist
   */
  async unblockDomain(domain: string): Promise<void> {
    try {
      const blocklist = await this.list();
      const entry = blocklist.manualBlocks.find(item => item.host === domain);

      if (!entry || !entry.uuid) {
        throw new Error(`Domain ${domain} not found in blocklist`);
      }

      await this.client.delUnboundHost(entry.uuid);
      await this.applyChanges();
    } catch (error: any) {
      logger.error('Failed to unblock domain:', error);
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
        logger.error(`Failed to block ${domain}:`, error);
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
    const allBlocked = await this.list();
    logger.warn(`Interface-specific filtering for ${interfaceName} requires ACL configuration`);
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
      logger.error('Failed to toggle blocklist entry:', error);
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
    const dnsblBlocklist = response?.unbound?.dnsbl?.blocklist as
      Record<string, OPNsenseDnsblEntry> | undefined;

    if (!dnsblBlocklist || typeof dnsblBlocklist !== 'object') {
      return {};
    }

    const firstEntry = Object.values(dnsblBlocklist)[0];
    if (!firstEntry?.type || typeof firstEntry.type !== 'object') {
      return {};
    }

    const available: Record<string, string> = {};
    for (const [key, info] of Object.entries(firstEntry.type)) {
      available[key] = info.value || key;
    }
    return available;
  }

  /**
   * Add a DNSBL subscription list to an existing entry, or create a new entry.
   * @param listKey - The list key (e.g. "atf", "oisd1", "hgz003")
   * @param targetUuid - Optional UUID of existing entry to modify. If omitted, creates a new entry.
   */
  async addDnsblSubscription(listKey: string, targetUuid?: string): Promise<{ uuid: string; selectedLists: string[] }> {
    const available = await this.getAvailableDnsblLists();
    if (!available[listKey]) {
      const validKeys = Object.entries(available)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');
      throw new Error(`Unknown DNSBL list key "${listKey}". Valid keys:\n${validKeys}`);
    }

    if (targetUuid) {
      const current = await this.client.getDnsbl(targetUuid) as OPNsenseDnsblGetResponse | undefined;
      if (!current?.blocklist) {
        throw new Error(`DNSBL entry ${targetUuid} not found`);
      }

      const currentTypes = DnsBlocklistResource.extractSelectedKeys(current.blocklist.type);

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
    const current = await this.client.getDnsbl(targetUuid) as OPNsenseDnsblGetResponse | undefined;
    if (!current?.blocklist) {
      throw new Error(`DNSBL entry ${targetUuid} not found`);
    }

    const available = await this.getAvailableDnsblLists();
    const currentTypes = DnsBlocklistResource.extractSelectedKeys(current.blocklist.type);

    if (!currentTypes.includes(listKey)) {
      throw new Error(`List "${available[listKey] || listKey}" is not active on this entry`);
    }

    const remaining = currentTypes.filter(k => k !== listKey);

    if (remaining.length === 0) {
      const response = await this.client.delDnsbl(targetUuid);
      if (response?.result !== 'deleted') {
        throw new Error('Failed to delete DNSBL entry: ' + JSON.stringify(response));
      }
      await this.applyChanges();
      return { deleted: true, remainingLists: [] };
    } else {
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
    const current = await this.client.getDnsbl(targetUuid) as OPNsenseDnsblGetResponse | undefined;
    if (!current?.blocklist) {
      throw new Error(`DNSBL entry ${targetUuid} not found`);
    }

    const available = await this.getAvailableDnsblLists();
    const update: Record<string, unknown> = {};

    if (options.listKeys !== undefined) {
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

    const updated = await this.client.getDnsbl(targetUuid) as OPNsenseDnsblGetResponse;
    const selectedLists = updated?.blocklist?.type
      ? DnsBlocklistResource.extractSelectedKeys(updated.blocklist.type).map(k => available[k] || k)
      : [];

    return { uuid: targetUuid, selectedLists };
  }

  /**
   * Apply DNS configuration changes
   */
  private async applyChanges(): Promise<void> {
    try {
      await this.client.applyUnboundChanges();
    } catch (error: any) {
      logger.error('Failed to apply DNS changes:', error);
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
