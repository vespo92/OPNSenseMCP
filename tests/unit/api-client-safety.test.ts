/**
 * Unit tests for OPNSenseAPIClient's dry-run / read-only safety modes.
 *
 * These modes exist to stop an agent from making destructive changes to a
 * production router: OPNSENSE_READ_ONLY rejects every mutating request
 * before it is sent, OPNSENSE_DRY_RUN simulates it and logs what would have
 * happened. Both must hold even though GET requests are always allowed
 * through unmodified.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

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

function baseConfig(overrides: Partial<{ dryRun: boolean; readOnly: boolean }> = {}) {
  return {
    host: 'https://opnsense.example.test',
    apiKey: 'key',
    apiSecret: 'secret',
    ...overrides,
  };
}

function okResponse(data: any = { result: 'saved' }) {
  return { status: 200, statusText: 'OK', data, headers: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAxiosInstance.get.mockResolvedValue(okResponse({ rows: [] }));
  mockAxiosInstance.post.mockResolvedValue(okResponse());
  mockAxiosInstance.put.mockResolvedValue(okResponse());
  mockAxiosInstance.delete.mockResolvedValue(okResponse());
});

describe('OPNSenseAPIClient normal mode (regression)', () => {
  it('sends POST/PUT/DELETE through axios when no safety mode is set', async () => {
    const client = new OPNSenseAPIClient(baseConfig());

    await client.post('/firewall/filter/addRule', { rule: { description: 'x' } });
    await client.put('/firewall/filter/setRule/uuid-1', { rule: {} });
    await client.delete('/firewall/filter/delRule/uuid-1');

    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    expect(mockAxiosInstance.put).toHaveBeenCalledTimes(1);
    expect(mockAxiosInstance.delete).toHaveBeenCalledTimes(1);
  });

  it('reports isDryRun()/isReadOnly() as false', () => {
    const client = new OPNSenseAPIClient(baseConfig());
    expect(client.isDryRun()).toBe(false);
    expect(client.isReadOnly()).toBe(false);
  });
});

describe('OPNSenseAPIClient dry-run mode', () => {
  it('does not call axios for POST/PUT/DELETE and returns a synthetic dryRun response', async () => {
    const client = new OPNSenseAPIClient(baseConfig({ dryRun: true }));

    const postResult = await client.post('/firewall/filter/addRule', { rule: { description: 'nuke' } });
    const putResult = await client.put('/firewall/filter/setRule/uuid-1', { rule: {} });
    const delResult = await client.delete('/firewall/filter/delRule/uuid-1');

    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    expect(mockAxiosInstance.put).not.toHaveBeenCalled();
    expect(mockAxiosInstance.delete).not.toHaveBeenCalled();

    for (const result of [postResult, putResult, delResult] as any[]) {
      expect(result.dryRun).toBe(true);
      expect(result.result).toBe('dry-run');
    }
    expect(postResult.wouldSend).toEqual({
      method: 'POST',
      path: '/firewall/filter/addRule',
      data: { rule: { description: 'nuke' } },
    });
  });

  it('leaves true GET requests unaffected, even though search* helpers are POST-backed and get simulated', async () => {
    const client = new OPNSenseAPIClient(baseConfig({ dryRun: true }));

    // searchFirewallRules() is implemented as a POST to a searchItem endpoint,
    // so it is a mutation-shaped call as far as the client is concerned and
    // gets simulated like any other POST.
    const rules = await client.searchFirewallRules();
    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    expect((rules as any).dryRun).toBe(true);

    // A real GET always goes through untouched.
    await client.get('/core/firmware/info');
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it('feeds a dryRun-flagged entry to the recorder instead of a silent no-op', async () => {
    const client = new OPNSenseAPIClient(baseConfig({ dryRun: true }));
    const recorder = vi.fn();
    client.setRecorder(recorder);

    await client.post('/interfaces/vlan_settings/addItem', { vlan: { tag: '99' } });

    expect(recorder).toHaveBeenCalledTimes(1);
    const call = recorder.mock.calls[0][0];
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/interfaces/vlan_settings/addItem');
    expect(call.response.data.dryRun).toBe(true);
  });

  it('reports isDryRun() as true', () => {
    const client = new OPNSenseAPIClient(baseConfig({ dryRun: true }));
    expect(client.isDryRun()).toBe(true);
    expect(client.isReadOnly()).toBe(false);
  });
});

describe('OPNSenseAPIClient read-only mode', () => {
  it('rejects POST/PUT/DELETE without calling axios or simulating success', async () => {
    const client = new OPNSenseAPIClient(baseConfig({ readOnly: true }));

    await expect(client.post('/firewall/filter/addRule', { rule: {} })).rejects.toThrow(OPNSenseAPIError);
    await expect(client.put('/firewall/filter/setRule/uuid-1', { rule: {} })).rejects.toThrow(OPNSenseAPIError);
    await expect(client.delete('/firewall/filter/delRule/uuid-1')).rejects.toThrow(OPNSenseAPIError);

    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    expect(mockAxiosInstance.put).not.toHaveBeenCalled();
    expect(mockAxiosInstance.delete).not.toHaveBeenCalled();
  });

  it('still executes GET requests normally', async () => {
    const client = new OPNSenseAPIClient(baseConfig({ readOnly: true }));
    const data = await client.get('/core/firmware/info');
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    expect(data).toBeDefined();
  });

  it('takes precedence over dryRun when both are set', async () => {
    const client = new OPNSenseAPIClient(baseConfig({ dryRun: true, readOnly: true }));
    await expect(client.post('/firewall/filter/addRule', { rule: {} })).rejects.toThrow(OPNSenseAPIError);
    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
  });

  it('reports isReadOnly() as true', () => {
    const client = new OPNSenseAPIClient(baseConfig({ readOnly: true }));
    expect(client.isReadOnly()).toBe(true);
  });
});
