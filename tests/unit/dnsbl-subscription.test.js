/**
 * Unit Tests for DNSBL Subscription Management
 *
 * Tests the DnsBlocklistResource methods for managing DNSBL subscriptions
 * (add, remove, update) with mocked API client responses.
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

// Mock API client factory
function createMockClient(overrides = {}) {
  return {
    getUnboundSettings: jest.fn().mockResolvedValue({
      unbound: {
        dnsbl: {
          blocklist: {
            'uuid-1': {
              enabled: '1',
              type: {
                atf: { value: 'Abuse.ch - ThreatFox IOC database', selected: 0 },
                oisd1: { value: 'OISD - Domain Blocklist Big', selected: 1 },
                hgz003: { value: '[hagezi] Multi PRO - Extended protection', selected: 0 },
              },
              lists: { '': { value: '', selected: 1 } },
              allowlists: { '': { value: '', selected: 1 } },
              wildcards: { '': { value: '', selected: 1 } },
              address: '',
              nxdomain: '0',
              cache_ttl: '72000',
              description: 'default',
            },
          },
        },
        hosts: { host: {} },
      },
    }),
    getDnsbl: jest.fn().mockResolvedValue({
      blocklist: {
        enabled: '1',
        type: {
          atf: { value: 'Abuse.ch - ThreatFox IOC database', selected: 0 },
          oisd1: { value: 'OISD - Domain Blocklist Big', selected: 1 },
          hgz003: { value: '[hagezi] Multi PRO - Extended protection', selected: 0 },
        },
      },
    }),
    addDnsbl: jest.fn().mockResolvedValue({ result: 'saved', uuid: 'new-uuid-123' }),
    setDnsbl: jest.fn().mockResolvedValue({ result: 'saved' }),
    delDnsbl: jest.fn().mockResolvedValue({ result: 'deleted' }),
    applyUnboundChanges: jest.fn().mockResolvedValue({ status: 'ok' }),
    ...overrides,
  };
}

// We need to import the compiled JS since Jest can't handle the TS source
// Use dynamic import for ESM module
let DnsBlocklistResource;

beforeAll(async () => {
  const mod = await import('../../dist/resources/services/dns/blocklist.js');
  DnsBlocklistResource = mod.DnsBlocklistResource;
});

describe('DnsBlocklistResource - DNSBL Subscriptions', () => {
  describe('getAvailableDnsblLists', () => {
    it('returns available list keys and names', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      const available = await resource.getAvailableDnsblLists();

      expect(available).toEqual({
        atf: 'Abuse.ch - ThreatFox IOC database',
        oisd1: 'OISD - Domain Blocklist Big',
        hgz003: '[hagezi] Multi PRO - Extended protection',
      });
    });

    it('returns empty object when no DNSBL entries exist', async () => {
      const client = createMockClient({
        getUnboundSettings: jest.fn().mockResolvedValue({ unbound: {} }),
      });
      const resource = new DnsBlocklistResource(client);

      const available = await resource.getAvailableDnsblLists();
      expect(available).toEqual({});
    });
  });

  describe('addDnsblSubscription', () => {
    it('adds a list to an existing entry', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      const result = await resource.addDnsblSubscription('atf', 'uuid-1');

      expect(client.setDnsbl).toHaveBeenCalledWith('uuid-1', {
        enabled: '1',
        type: 'oisd1,atf',
      });
      expect(client.applyUnboundChanges).toHaveBeenCalled();
      expect(result.uuid).toBe('uuid-1');
      expect(result.selectedLists).toContain('OISD - Domain Blocklist Big');
      expect(result.selectedLists).toContain('Abuse.ch - ThreatFox IOC database');
    });

    it('creates a new entry when no target_uuid provided', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      const result = await resource.addDnsblSubscription('atf');

      expect(client.addDnsbl).toHaveBeenCalledWith({
        enabled: '1',
        type: 'atf',
      });
      expect(client.applyUnboundChanges).toHaveBeenCalled();
      expect(result.uuid).toBe('new-uuid-123');
      expect(result.selectedLists).toEqual(['Abuse.ch - ThreatFox IOC database']);
    });

    it('throws on invalid list key', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      await expect(resource.addDnsblSubscription('invalid_key')).rejects.toThrow(
        /Unknown DNSBL list key "invalid_key"/
      );
    });

    it('throws when list is already active', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      await expect(resource.addDnsblSubscription('oisd1', 'uuid-1')).rejects.toThrow(
        /already active/
      );
    });
  });

  describe('removeDnsblSubscription', () => {
    it('removes a list and keeps the entry when other lists remain', async () => {
      const client = createMockClient({
        getDnsbl: jest.fn().mockResolvedValue({
          blocklist: {
            enabled: '1',
            type: {
              atf: { value: 'Abuse.ch - ThreatFox IOC database', selected: 1 },
              oisd1: { value: 'OISD - Domain Blocklist Big', selected: 1 },
            },
          },
        }),
      });
      const resource = new DnsBlocklistResource(client);

      const result = await resource.removeDnsblSubscription('atf', 'uuid-1');

      expect(result.deleted).toBe(false);
      expect(client.setDnsbl).toHaveBeenCalledWith('uuid-1', {
        enabled: '1',
        type: 'oisd1',
      });
      expect(result.remainingLists).toContain('OISD - Domain Blocklist Big');
    });

    it('deletes the entire entry when removing the last list', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      const result = await resource.removeDnsblSubscription('oisd1', 'uuid-1');

      expect(result.deleted).toBe(true);
      expect(client.delDnsbl).toHaveBeenCalledWith('uuid-1');
      expect(result.remainingLists).toEqual([]);
    });

    it('throws when list is not active', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      await expect(resource.removeDnsblSubscription('atf', 'uuid-1')).rejects.toThrow(
        /not active/
      );
    });
  });

  describe('updateDnsblSubscription', () => {
    it('replaces all selected lists', async () => {
      const client = createMockClient({
        getDnsbl: jest.fn()
          .mockResolvedValueOnce({
            blocklist: { enabled: '1', type: { oisd1: { value: 'OISD', selected: 1 } } },
          })
          .mockResolvedValueOnce({
            blocklist: {
              enabled: '1',
              type: {
                atf: { value: 'Abuse.ch - ThreatFox IOC database', selected: 1 },
                hgz003: { value: '[hagezi] Multi PRO - Extended protection', selected: 1 },
                oisd1: { value: 'OISD', selected: 0 },
              },
            },
          }),
      });
      const resource = new DnsBlocklistResource(client);

      const result = await resource.updateDnsblSubscription('uuid-1', {
        listKeys: ['atf', 'hgz003'],
      });

      expect(client.setDnsbl).toHaveBeenCalledWith('uuid-1', {
        type: 'atf,hgz003',
      });
      expect(result.selectedLists).toContain('Abuse.ch - ThreatFox IOC database');
      expect(result.selectedLists).toContain('[hagezi] Multi PRO - Extended protection');
    });

    it('can disable an entry', async () => {
      const client = createMockClient({
        getDnsbl: jest.fn()
          .mockResolvedValueOnce({
            blocklist: { enabled: '1', type: { oisd1: { value: 'OISD', selected: 1 } } },
          })
          .mockResolvedValueOnce({
            blocklist: { enabled: '0', type: { oisd1: { value: 'OISD', selected: 1 } } },
          }),
      });
      const resource = new DnsBlocklistResource(client);

      await resource.updateDnsblSubscription('uuid-1', { enabled: false });

      expect(client.setDnsbl).toHaveBeenCalledWith('uuid-1', { enabled: '0' });
    });

    it('throws on empty list_keys', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      await expect(
        resource.updateDnsblSubscription('uuid-1', { listKeys: [] })
      ).rejects.toThrow(/Cannot set empty list/);
    });

    it('throws when no options provided', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      await expect(
        resource.updateDnsblSubscription('uuid-1', {})
      ).rejects.toThrow(/No update options provided/);
    });

    it('throws on invalid list key', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      await expect(
        resource.updateDnsblSubscription('uuid-1', { listKeys: ['bogus'] })
      ).rejects.toThrow(/Unknown DNSBL list key "bogus"/);
    });
  });

  describe('list (DNSBL subscriptions)', () => {
    it('returns subscriptions with selected lists', async () => {
      const client = createMockClient();
      const resource = new DnsBlocklistResource(client);

      const result = await resource.list();

      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].uuid).toBe('uuid-1');
      expect(result.subscriptions[0].enabled).toBe(true);
      expect(result.subscriptions[0].selectedLists).toEqual(['OISD - Domain Blocklist Big']);
      expect(result.subscriptions[0].cacheTtl).toBe('72000');
    });

    it('returns empty when no DNSBL config exists', async () => {
      const client = createMockClient({
        getUnboundSettings: jest.fn().mockResolvedValue({ unbound: {} }),
      });
      const resource = new DnsBlocklistResource(client);

      const result = await resource.list();
      expect(result.subscriptions).toEqual([]);
      expect(result.manualBlocks).toEqual([]);
    });
  });
});
