/**
 * Unit tests for OPNSenseAPIClient.detectDhcpBackend().
 *
 * Detection result is cached for the life of the client, so a wrong answer
 * routes every DHCP call to the wrong API surface. Only a 404 may mean
 * "backend absent"; a denied or failed probe must surface, not be cached as
 * ISC (the same class of bug as a privilege-denied connectivity probe).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

import { OPNSenseAPIClient, OPNSenseAPIError } from '../../src/api/client.js';

const client = () =>
  new OPNSenseAPIClient({ host: 'https://opnsense.example.test', apiKey: 'key', apiSecret: 'secret' });

const res = (status: number, data: any = {}) => ({ status, statusText: String(status), data, headers: {} });

/** Route mocked GETs by path; unknown paths 404. */
function routeGets(routes: Record<string, () => any>) {
  mockAxiosInstance.get.mockImplementation(async (path: string) => {
    const handler = routes[path];
    return handler ? handler() : res(404);
  });
}

const DNSMASQ_WITH_RANGES = { dnsmasq: { enable: '1', dhcp_ranges: { 'uuid-1': {} } } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectDhcpBackend', () => {
  it('picks dnsmasq when it is enabled with DHCP ranges', async () => {
    routeGets({ '/dnsmasq/settings/get': () => res(200, DNSMASQ_WITH_RANGES) });
    await expect(client().detectDhcpBackend()).resolves.toBe('dnsmasq');
  });

  it('skips DNS-only dnsmasq (no ranges) and picks an enabled Kea', async () => {
    routeGets({
      '/dnsmasq/settings/get': () => res(200, { dnsmasq: { enable: '1', dhcp_ranges: {} } }),
      '/kea/dhcpv4/get': () => res(200, { dhcpv4: { general: { enabled: '1' } } }),
    });
    await expect(client().detectDhcpBackend()).resolves.toBe('kea');
  });

  it('falls back to ISC when both newer backends 404', async () => {
    routeGets({});
    await expect(client().detectDhcpBackend()).resolves.toBe('isc');
  });

  it('propagates a 403 on the dnsmasq probe instead of caching ISC', async () => {
    routeGets({ '/dnsmasq/settings/get': () => res(403, { message: 'Forbidden' }) });
    const c = client();

    await expect(c.detectDhcpBackend()).rejects.toBeInstanceOf(OPNSenseAPIError);
    expect(c.getDhcpBackend()).toBeUndefined();

    // Once the privilege is granted, the next call re-probes and succeeds.
    routeGets({ '/dnsmasq/settings/get': () => res(200, DNSMASQ_WITH_RANGES) });
    await expect(c.detectDhcpBackend()).resolves.toBe('dnsmasq');
  });

  it('propagates a network error instead of caching ISC', async () => {
    mockAxiosInstance.get.mockRejectedValue(new Error('ECONNRESET'));
    const c = client();

    await expect(c.detectDhcpBackend()).rejects.toThrow('ECONNRESET');
    expect(c.getDhcpBackend()).toBeUndefined();
  });

  it('shares one probe across concurrent first calls and caches the result', async () => {
    routeGets({ '/dnsmasq/settings/get': () => res(200, DNSMASQ_WITH_RANGES) });
    const c = client();

    const results = await Promise.all([c.detectDhcpBackend(), c.detectDhcpBackend(), c.detectDhcpBackend()]);
    expect(results).toEqual(['dnsmasq', 'dnsmasq', 'dnsmasq']);
    await c.detectDhcpBackend();
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
  });
});
