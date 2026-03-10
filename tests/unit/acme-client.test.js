/**
 * Unit Tests for ACME Client Resource
 *
 * Tests the AcmeClientResource methods for managing certificates, accounts,
 * validations, and automation actions with mocked API client responses.
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

function createAcmeSettings() {
  return {
    acmeclient: {
      settings: {
        enabled: '1',
        autoRenewal: '1',
      },
      accounts: {
        account: {
          'b0000000-0000-0000-0000-000000000001': {
            id: '123',
            enabled: '1',
            name: 'TestAccount',
            description: 'Test',
            email: 'test@example.com',
            ca: {
              letsencrypt: { value: "Let's Encrypt", selected: 1 },
              zerossl: { value: 'ZeroSSL', selected: 0 },
            },
            statusCode: '200',
            statusLastUpdate: '1700000000',
          },
        },
      },
      certificates: {
        certificate: {
          'c0000000-0000-0000-0000-000000000001': {
            id: '456',
            enabled: '1',
            name: '*.example.com',
            description: 'Wildcard cert',
            altNames: {
              '*.example.com': { value: '*.example.com', selected: 1 },
            },
            account: {
              'b0000000-0000-0000-0000-000000000001': { value: 'TestAccount', selected: 1 },
            },
            validationMethod: {
              'd0000000-0000-0000-0000-000000000001': { value: 'Cloudflare DNS', selected: 1 },
            },
            keyLength: {
              key_4096: { value: '4096 bit', selected: 1 },
              key_2048: { value: '2048 bit', selected: 0 },
            },
            ocsp: '0',
            restartActions: {
              'a0000000-0000-0000-0000-000000000001': { value: 'Restart HAProxy', selected: 1 },
            },
            autoRenewal: '1',
            renewInterval: '30',
            aliasmode: { none: { value: 'None', selected: 1 } },
            lastUpdate: '1700000000',
            statusCode: '200',
            statusLastUpdate: '1700000000',
          },
        },
      },
      validations: {
        validation: {
          'd0000000-0000-0000-0000-000000000001': {
            id: '789',
            enabled: '1',
            name: 'Cloudflare DNS',
            description: '',
            method: {
              dns01: { value: 'DNS-01', selected: 1 },
              http01: { value: 'HTTP-01', selected: 0 },
            },
            dns_service: {
              dns_cf: { value: 'CloudFlare.com', selected: 1 },
            },
            dns_sleep: '120',
          },
        },
      },
      actions: {
        action: {
          'a0000000-0000-0000-0000-000000000001': {
            id: '101',
            enabled: '1',
            name: 'Restart HAProxy',
            description: '',
            type: {
              configd_restart_haproxy: { value: 'Restart HAProxy (drop connections)', selected: 1 },
              configd_restart_gui: { value: 'Restart OPNsense Web UI', selected: 0 },
            },
          },
        },
      },
    },
  };
}

function createMockClient(overrides = {}) {
  return {
    getAcmeSettings: jest.fn().mockResolvedValue(createAcmeSettings()),
    setAcmeSettings: jest.fn().mockResolvedValue({ result: 'saved' }),
    getAcmeServiceStatus: jest.fn().mockResolvedValue({ status: 'running' }),
    applyAcmeChanges: jest.fn().mockResolvedValue({ status: 'ok' }),
    getAcmeActionSchema: jest.fn().mockResolvedValue({ action: {} }),
    addAcmeAction: jest.fn().mockResolvedValue({ result: 'saved', uuid: 'new-action-uuid' }),
    delAcmeAction: jest.fn().mockResolvedValue({ result: 'deleted' }),
    renewAcmeCertificate: jest.fn().mockResolvedValue({ status: 'ok' }),
    signAcmeCertificate: jest.fn().mockResolvedValue({ status: 'ok' }),
    revokeAcmeCertificate: jest.fn().mockResolvedValue({ status: 'ok' }),
    ...overrides,
  };
}

let AcmeClientResource;

beforeAll(async () => {
  const mod = await import('../../dist/resources/services/acme/client.js');
  AcmeClientResource = mod.AcmeClientResource;
});

describe('AcmeClientResource', () => {
  describe('getOverview', () => {
    it('returns parsed certificates, accounts, validations, and actions', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      const overview = await resource.getOverview();

      expect(overview.enabled).toBe(true);
      expect(overview.autoRenewal).toBe(true);

      expect(overview.certificates).toHaveLength(1);
      const cert = overview.certificates[0];
      expect(cert.uuid).toBe('c0000000-0000-0000-0000-000000000001');
      expect(cert.name).toBe('*.example.com');
      expect(cert.accountUuid).toBe('b0000000-0000-0000-0000-000000000001');
      expect(cert.accountName).toBe('TestAccount');
      expect(cert.validationUuid).toBe('d0000000-0000-0000-0000-000000000001');
      expect(cert.validationName).toBe('Cloudflare DNS');
      expect(cert.keyLength).toBe('4096 bit');
      expect(cert.autoRenewal).toBe(true);
      expect(cert.renewInterval).toBe('30');
      expect(cert.restartActionUuids).toEqual(['a0000000-0000-0000-0000-000000000001']);
      expect(cert.restartActionNames).toEqual(['Restart HAProxy']);

      expect(overview.accounts).toHaveLength(1);
      expect(overview.accounts[0].name).toBe('TestAccount');
      expect(overview.accounts[0].email).toBe('test@example.com');
      expect(overview.accounts[0].ca).toBe("Let's Encrypt");

      expect(overview.validations).toHaveLength(1);
      expect(overview.validations[0].method).toBe('DNS-01');
      expect(overview.validations[0].dnsService).toBe('CloudFlare.com');

      expect(overview.actions).toHaveLength(1);
      expect(overview.actions[0].name).toBe('Restart HAProxy');
      expect(overview.actions[0].type).toBe('Restart HAProxy (drop connections)');
    });

    it('returns empty when no ACME config exists', async () => {
      const client = createMockClient({
        getAcmeSettings: jest.fn().mockResolvedValue({ acmeclient: { settings: {} } }),
      });
      const resource = new AcmeClientResource(client);
      const overview = await resource.getOverview();

      expect(overview.certificates).toEqual([]);
      expect(overview.accounts).toEqual([]);
      expect(overview.validations).toEqual([]);
      expect(overview.actions).toEqual([]);
    });

    it('throws when no acmeclient key in response', async () => {
      const client = createMockClient({
        getAcmeSettings: jest.fn().mockResolvedValue({}),
      });
      const resource = new AcmeClientResource(client);
      await expect(resource.getOverview()).rejects.toThrow(/No ACME client configuration/);
    });
  });

  describe('updateCertificate', () => {
    it('updates renewInterval using settings/set nested path', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await resource.updateCertificate('c0000000-0000-0000-0000-000000000001', { renewInterval: '60' });

      expect(client.setAcmeSettings).toHaveBeenCalledWith({
        certificates: {
          certificate: {
            'c0000000-0000-0000-0000-000000000001': { renewInterval: '60' },
          },
        },
      });
      expect(client.applyAcmeChanges).toHaveBeenCalled();
    });

    it('updates restartActions with action UUIDs', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await resource.updateCertificate('c0000000-0000-0000-0000-000000000001', {
        restartActions: ['a0000000-0000-0000-0000-000000000001', 'action-uuid-2'],
      });

      expect(client.setAcmeSettings).toHaveBeenCalledWith({
        certificates: {
          certificate: {
            'c0000000-0000-0000-0000-000000000001': { restartActions: 'a0000000-0000-0000-0000-000000000001,action-uuid-2' },
          },
        },
      });
    });

    it('updates multiple fields at once', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await resource.updateCertificate('c0000000-0000-0000-0000-000000000001', {
        renewInterval: '14',
        autoRenewal: false,
        description: 'Updated',
      });

      expect(client.setAcmeSettings).toHaveBeenCalledWith({
        certificates: {
          certificate: {
            'c0000000-0000-0000-0000-000000000001': {
              renewInterval: '14',
              autoRenewal: '0',
              description: 'Updated',
            },
          },
        },
      });
    });

    it('throws when certificate not found', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.updateCertificate('00000000-0000-0000-0000-000000000000', { renewInterval: '30' }))
        .rejects.toThrow(/not found/);
    });

    it('throws when no update fields provided', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.updateCertificate('c0000000-0000-0000-0000-000000000001', {}))
        .rejects.toThrow(/No update fields/);
    });

    it('throws when settings/set fails', async () => {
      const client = createMockClient({
        setAcmeSettings: jest.fn().mockResolvedValue({ result: 'failed' }),
      });
      const resource = new AcmeClientResource(client);
      await expect(resource.updateCertificate('c0000000-0000-0000-0000-000000000001', { renewInterval: '30' }))
        .rejects.toThrow(/Failed to update certificate/);
    });
  });

  describe('renewCertificate', () => {
    it('triggers renewal and returns status', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      const result = await resource.renewCertificate('c0000000-0000-0000-0000-000000000001');

      expect(client.renewAcmeCertificate).toHaveBeenCalledWith('c0000000-0000-0000-0000-000000000001');
      expect(result.status).toBe('ok');
    });

    it('throws when certificate not found', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.renewCertificate('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/);
    });
  });

  describe('signCertificate', () => {
    it('triggers signing and returns status', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      const result = await resource.signCertificate('c0000000-0000-0000-0000-000000000001');

      expect(client.signAcmeCertificate).toHaveBeenCalledWith('c0000000-0000-0000-0000-000000000001');
      expect(result.status).toBe('ok');
    });

    it('throws when certificate not found', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.signCertificate('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/);
    });
  });

  describe('revokeCertificate', () => {
    it('triggers revocation and returns status', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      const result = await resource.revokeCertificate('c0000000-0000-0000-0000-000000000001');

      expect(client.revokeAcmeCertificate).toHaveBeenCalledWith('c0000000-0000-0000-0000-000000000001');
      expect(result.status).toBe('ok');
    });

    it('throws when certificate not found', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.revokeCertificate('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/);
    });
  });

  describe('Action CRUD', () => {
    it('adds an action with correct payload', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      const result = await resource.addAction({
        name: 'Restart Nginx',
        type: 'configd_restart_nginx',
        description: 'After renewal',
      });

      expect(result.uuid).toBe('new-action-uuid');
      expect(client.addAcmeAction).toHaveBeenCalledWith({
        name: 'Restart Nginx',
        type: 'configd_restart_nginx',
        enabled: '1',
        description: 'After renewal',
      });
      expect(client.applyAcmeChanges).toHaveBeenCalled();
    });

    it('adds a disabled action', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await resource.addAction({ name: 'Disabled', type: 'configd_restart_gui', enabled: false });

      expect(client.addAcmeAction).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: '0' })
      );
    });

    it('throws when addAction fails', async () => {
      const client = createMockClient({
        addAcmeAction: jest.fn().mockResolvedValue({ result: 'failed' }),
      });
      const resource = new AcmeClientResource(client);
      await expect(resource.addAction({ name: '', type: '' })).rejects.toThrow(/Failed to add/);
    });

    it('deletes an action', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await resource.deleteAction('a0000000-0000-0000-0000-000000000001');

      expect(client.delAcmeAction).toHaveBeenCalledWith('a0000000-0000-0000-0000-000000000001');
      expect(client.applyAcmeChanges).toHaveBeenCalled();
    });

    it('throws when delete fails', async () => {
      const client = createMockClient({
        delAcmeAction: jest.fn().mockResolvedValue({ result: 'not found' }),
      });
      const resource = new AcmeClientResource(client);
      await expect(resource.deleteAction('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/Failed to delete/);
    });
  });

  describe('Edge cases', () => {
    it('skips malformed certificate entries without name', async () => {
      const settings = createAcmeSettings();
      settings.acmeclient.certificates.certificate['e0000000-0000-0000-0000-000000000001'] = {
        id: '999',
        enabled: '1',
      };
      const client = createMockClient({
        getAcmeSettings: jest.fn().mockResolvedValue(settings),
      });
      const resource = new AcmeClientResource(client);
      const overview = await resource.getOverview();
      expect(overview.certificates).toHaveLength(1);
      expect(overview.certificates[0].uuid).toBe('c0000000-0000-0000-0000-000000000001');
    });

    it('handles certificates with empty select options', async () => {
      const settings = createAcmeSettings();
      const cert = settings.acmeclient.certificates.certificate['c0000000-0000-0000-0000-000000000001'];
      cert.account = {};
      cert.validationMethod = {};
      cert.restartActions = {};
      cert.keyLength = {};
      const client = createMockClient({
        getAcmeSettings: jest.fn().mockResolvedValue(settings),
      });
      const resource = new AcmeClientResource(client);
      const overview = await resource.getOverview();
      const c = overview.certificates[0];
      expect(c.accountUuid).toBe('');
      expect(c.accountName).toBe('');
      expect(c.validationUuid).toBe('');
      expect(c.keyLength).toBe('');
      expect(c.restartActionUuids).toEqual([]);
    });
  });

  describe('Validation', () => {
    it('rejects invalid UUID format', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.renewCertificate('not-a-uuid')).rejects.toThrow(/Invalid UUID/);
      await expect(resource.updateCertificate('bad', { renewInterval: '30' })).rejects.toThrow(/Invalid UUID/);
      await expect(resource.deleteAction('xyz')).rejects.toThrow(/Invalid UUID/);
    });

    it('rejects negative renewInterval', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.updateCertificate('c0000000-0000-0000-0000-000000000001', { renewInterval: '-1' }))
        .rejects.toThrow(/positive integer/);
    });

    it('rejects non-numeric renewInterval', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.updateCertificate('c0000000-0000-0000-0000-000000000001', { renewInterval: 'abc' }))
        .rejects.toThrow(/positive integer/);
    });

    it('rejects zero renewInterval', async () => {
      const client = createMockClient();
      const resource = new AcmeClientResource(client);
      await expect(resource.updateCertificate('c0000000-0000-0000-0000-000000000001', { renewInterval: '0' }))
        .rejects.toThrow(/positive integer/);
    });
  });

  describe('applyChanges error handling', () => {
    it('throws when reconfigure returns error status', async () => {
      const client = createMockClient({
        applyAcmeChanges: jest.fn().mockResolvedValue({ status: 'error' }),
      });
      const resource = new AcmeClientResource(client);
      await expect(resource.updateCertificate('c0000000-0000-0000-0000-000000000001', { description: 'test' }))
        .rejects.toThrow(/reconfigure failed/);
    });

    it('throws when reconfigure returns failed result', async () => {
      const client = createMockClient({
        applyAcmeChanges: jest.fn().mockResolvedValue({ result: 'failed' }),
      });
      const resource = new AcmeClientResource(client);
      await expect(resource.addAction({ name: 'Test', type: 'configd_restart_gui' }))
        .rejects.toThrow(/reconfigure failed/);
    });
  });
});
