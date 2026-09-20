/**
 * Unit tests for testConnection()'s status reporting.
 *
 * The server's startup probe hits GET /core/firmware/info, which OPNsense
 * gates behind `page-system-firmware-manualupdate`. A least-privilege API key
 * gets 403 there even though its credentials are entirely valid, so callers
 * need the status code to tell that apart from bad credentials (401) or an
 * unreachable host (no status at all). See issue #99.
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
  default: { create: vi.fn(() => mockAxiosInstance) },
}));

import { OPNSenseAPIClient } from '../../src/api/client.js';

const baseConfig = () => ({
  host: 'https://opnsense.example.test',
  apiKey: 'key',
  apiSecret: 'secret',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('testConnection status reporting (issue #99)', () => {
  it('reports statusCode 403 when the probe endpoint is privilege-denied', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      status: 403,
      statusText: 'Forbidden',
      data: { status: 403, message: 'Forbidden' },
    });

    const result = await new OPNSenseAPIClient(baseConfig()).testConnection();

    expect(result.success).toBe(false);
    // Without this the server cannot distinguish a scoped key from a broken one.
    expect(result.statusCode).toBe(403);
  });

  it('reports statusCode 401 for genuinely bad credentials', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      status: 401,
      statusText: 'Unauthorized',
      data: { status: 401 },
    });

    const result = await new OPNSenseAPIClient(baseConfig()).testConnection();

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('leaves statusCode undefined when the host is unreachable', async () => {
    mockAxiosInstance.get.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const result = await new OPNSenseAPIClient(baseConfig()).testConnection();

    expect(result.success).toBe(false);
    expect(result.statusCode).toBeUndefined();
    expect(result.error).toMatch(/ECONNREFUSED/);
  });

  it('still reports version and product on a successful probe', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: { product_version: '26.7.3', product_name: 'OPNsense' },
    });

    const result = await new OPNSenseAPIClient(baseConfig()).testConnection();

    expect(result).toMatchObject({
      success: true,
      version: '26.7.3',
      product: 'OPNsense',
    });
  });
});

describe('probe policy: which failures are fatal (issue #99)', () => {
  it('treats a 403 as non-fatal, so a least-privilege key still starts', async () => {
    const { isProbeDeniedByPrivilege } = await import('../../src/utils/connection-probe.js');

    expect(isProbeDeniedByPrivilege({ success: false, statusCode: 403 })).toBe(true);
  });

  it('keeps bad credentials fatal', async () => {
    const { isProbeDeniedByPrivilege } = await import('../../src/utils/connection-probe.js');

    expect(isProbeDeniedByPrivilege({ success: false, statusCode: 401 })).toBe(false);
  });

  it('keeps an unreachable or non-OPNsense host fatal', async () => {
    const { isProbeDeniedByPrivilege } = await import('../../src/utils/connection-probe.js');

    // No status at all: network error.
    expect(isProbeDeniedByPrivilege({ success: false })).toBe(false);
    // Wrong host answering: 404 on the probe endpoint.
    expect(isProbeDeniedByPrivilege({ success: false, statusCode: 404 })).toBe(false);
    expect(isProbeDeniedByPrivilege({ success: false, statusCode: 500 })).toBe(false);
  });

  it('does not fire on a successful probe', async () => {
    const { isProbeDeniedByPrivilege } = await import('../../src/utils/connection-probe.js');

    expect(isProbeDeniedByPrivilege({ success: true })).toBe(false);
    expect(isProbeDeniedByPrivilege({ success: true, statusCode: 403 })).toBe(false);
  });
});
