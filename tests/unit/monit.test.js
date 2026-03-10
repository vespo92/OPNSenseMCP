/**
 * Unit Tests for Monit Resource
 *
 * Tests the MonitResource methods for managing Monit services, tests, and alerts
 * with mocked API client responses.
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

// Factory for mock Monit settings response
function createMonitSettings(overrides = {}) {
  return {
    monit: {
      general: {
        enabled: '1',
        interval: 120,
        startdelay: 120,
        mailserver: { '192.168.1.8': { value: '192.168.1.8', selected: 1 } },
        port: 25,
        logfile: 'syslog facility log_daemon',
        ...overrides.general,
      },
      service: {
        'svc-uuid-1': {
          enabled: '1',
          name: '$HOST',
          description: 'System monitor',
          type: { system: { value: 'System', selected: 1 }, process: { value: 'Process', selected: 0 } },
          pidfile: '',
          match: '',
          path: '',
          timeout: '300',
          starttimeout: '30',
          address: '',
          interface: {},
          start: '',
          stop: '',
          tests: {
            'test-uuid-1': { value: 'CPUUsage', selected: 1 },
            'test-uuid-2': { value: 'MemoryUsage', selected: 1 },
          },
          depends: {},
          polltime: '',
        },
        'svc-uuid-2': {
          enabled: '1',
          name: 'RootFs',
          description: 'Root filesystem',
          type: { filesystem: { value: 'Filesystem', selected: 1 }, system: { value: 'System', selected: 0 } },
          pidfile: '',
          match: '',
          path: '/',
          timeout: '300',
          starttimeout: '30',
          address: '',
          interface: {},
          start: '',
          stop: '',
          tests: { 'test-uuid-3': { value: 'SpaceUsage', selected: 1 } },
          depends: {},
          polltime: '',
        },
        ...overrides.service,
      },
      test: {
        'test-uuid-1': {
          name: 'CPUUsage',
          type: { SystemResource: { value: 'System Resource', selected: 1 }, SpaceUsage: { value: 'Space Usage', selected: 0 } },
          condition: 'cpu usage is greater than 75%',
          action: { alert: { value: 'Alert', selected: 1 }, restart: { value: 'Restart', selected: 0 } },
          path: '',
        },
        'test-uuid-2': {
          name: 'MemoryUsage',
          type: { SystemResource: { value: 'System Resource', selected: 1 } },
          condition: 'memory usage is greater than 75%',
          action: { alert: { value: 'Alert', selected: 1 } },
          path: '',
        },
        'test-uuid-3': {
          name: 'SpaceUsage',
          type: { SpaceUsage: { value: 'Space Usage', selected: 1 } },
          condition: 'space usage is greater than 75%',
          action: { alert: { value: 'Alert', selected: 1 } },
          path: '',
        },
        ...overrides.test,
      },
      alert: {
        'alert-uuid-1': {
          enabled: '1',
          recipient: 'admin@example.com',
          noton: '0',
          events: {
            connection: { value: 'Connection failed', selected: 1 },
            resource: { value: 'Resource limit matched', selected: 1 },
            status: { value: 'Status failed', selected: 0 },
          },
          format: 'Subject: $SERVICE on $HOST failed',
          reminder: '10',
          description: 'Admin alerts',
        },
        ...overrides.alert,
      },
    },
  };
}

function createMockClient(overrides = {}) {
  return {
    getMonitSettings: jest.fn().mockResolvedValue(createMonitSettings()),
    getMonitStatus: jest.fn().mockResolvedValue({
      result: {
        service: [
          { name: '$HOST', status: 0, type: 5, monitor: 1 },
          { name: 'RootFs', status: 0, type: 0, monitor: 1 },
        ],
      },
    }),
    getMonitServiceStatus: jest.fn().mockResolvedValue({ status: 'running' }),
    getMonitService: jest.fn().mockResolvedValue({
      service: { enabled: '1', name: '$HOST', type: 'system', description: 'System monitor', path: '', timeout: '300' },
    }),
    addMonitService: jest.fn().mockResolvedValue({ result: 'saved', uuid: 'new-svc-uuid' }),
    setMonitService: jest.fn().mockResolvedValue({ result: 'saved' }),
    delMonitService: jest.fn().mockResolvedValue({ result: 'deleted' }),
    getMonitTest: jest.fn().mockResolvedValue({
      test: { name: 'CPUUsage', type: 'SystemResource', condition: 'cpu usage is greater than 75%', action: 'alert', path: '' },
    }),
    addMonitTest: jest.fn().mockResolvedValue({ result: 'saved', uuid: 'new-test-uuid' }),
    setMonitTest: jest.fn().mockResolvedValue({ result: 'saved' }),
    delMonitTest: jest.fn().mockResolvedValue({ result: 'deleted' }),
    getMonitAlert: jest.fn().mockResolvedValue({
      alert: { enabled: '1', recipient: 'admin@example.com', noton: '0', events: 'connection,resource', format: 'Subject: $SERVICE', reminder: '10', description: '' },
    }),
    addMonitAlert: jest.fn().mockResolvedValue({ result: 'saved', uuid: 'new-alert-uuid' }),
    setMonitAlert: jest.fn().mockResolvedValue({ result: 'saved' }),
    delMonitAlert: jest.fn().mockResolvedValue({ result: 'deleted' }),
    applyMonitChanges: jest.fn().mockResolvedValue({ status: 'OK', result: 'Control file syntax OK' }),
    ...overrides,
  };
}

let MonitResource;

beforeAll(async () => {
  const mod = await import('../../dist/resources/services/monitoring/monit.js');
  MonitResource = mod.MonitResource;
});

describe('MonitResource', () => {
  describe('getOverview', () => {
    it('returns parsed services, tests, and alerts', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      const overview = await resource.getOverview();

      expect(overview.enabled).toBe(true);
      expect(overview.interval).toBe(120);
      expect(overview.startDelay).toBe(120);
      expect(overview.services).toHaveLength(2);
      expect(overview.services[0].name).toBe('$HOST');
      expect(overview.services[0].type).toBe('System');
      expect(overview.services[0].testUuids).toEqual(['test-uuid-1', 'test-uuid-2']);
      expect(overview.services[0].testNames).toEqual(['CPUUsage', 'MemoryUsage']);
      expect(overview.services[1].name).toBe('RootFs');
      expect(overview.services[1].type).toBe('Filesystem');
      expect(overview.tests).toHaveLength(3);
      expect(overview.tests[0].condition).toBe('cpu usage is greater than 75%');
      expect(overview.tests[0].action).toBe('Alert');
      expect(overview.alerts).toHaveLength(1);
      expect(overview.alerts[0].recipient).toBe('admin@example.com');
      expect(overview.alerts[0].events).toEqual(['Connection failed', 'Resource limit matched']);
    });

    it('returns empty arrays when no monit config exists', async () => {
      const client = createMockClient({
        getMonitSettings: jest.fn().mockResolvedValue({ monit: { general: { enabled: '0', interval: 0, startdelay: 0 } } }),
      });
      const resource = new MonitResource(client);
      const overview = await resource.getOverview();

      expect(overview.enabled).toBe(false);
      expect(overview.services).toEqual([]);
      expect(overview.tests).toEqual([]);
      expect(overview.alerts).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('returns running status and service list', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      const status = await resource.getStatus();

      expect(status.running).toBe(true);
      expect(status.services).toHaveLength(2);
      expect(status.services[0].name).toBe('$HOST');
      expect(status.services[0].monitored).toBe(true);
    });

    it('handles status endpoint failure gracefully', async () => {
      const client = createMockClient({
        getMonitStatus: jest.fn().mockRejectedValue(new Error('timeout')),
        getMonitServiceStatus: jest.fn().mockRejectedValue(new Error('timeout')),
      });
      const resource = new MonitResource(client);
      const status = await resource.getStatus();

      expect(status.running).toBe(false);
      expect(status.services).toEqual([]);
    });

    it('handles single service object (non-array)', async () => {
      const client = createMockClient({
        getMonitStatus: jest.fn().mockResolvedValue({
          result: { service: { name: 'solo', status: 0, type: 5, monitor: 1 } },
        }),
      });
      const resource = new MonitResource(client);
      const status = await resource.getStatus();

      expect(status.services).toHaveLength(1);
      expect(status.services[0].name).toBe('solo');
    });
  });

  describe('Service CRUD', () => {
    it('adds a service with correct payload and defaults', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      const result = await resource.addService({
        name: 'TestSvc',
        type: 'custom',
        description: 'A test service',
        path: '/usr/bin/true',
      });

      expect(result.uuid).toBe('new-svc-uuid');
      expect(client.addMonitService).toHaveBeenCalledWith({
        name: 'TestSvc',
        type: 'custom',
        enabled: '1',
        timeout: '300',
        starttimeout: '30',
        description: 'A test service',
        path: '/usr/bin/true',
      });
      expect(client.applyMonitChanges).toHaveBeenCalled();
    });

    it('adds a disabled service', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.addService({ name: 'Disabled', type: 'host', enabled: false });

      expect(client.addMonitService).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: '0' })
      );
    });

    it('throws when addService returns no uuid', async () => {
      const client = createMockClient({
        addMonitService: jest.fn().mockResolvedValue({ result: 'failed', validations: { 'service.name': 'required' } }),
      });
      const resource = new MonitResource(client);
      await expect(resource.addService({ name: '', type: 'custom' })).rejects.toThrow(/Failed to add Monit service/);
    });

    it('updates a service with fetch-merge pattern', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.updateService('svc-uuid-1', { enabled: false, description: 'updated' });

      // Should have fetched current state first
      expect(client.getMonitService).toHaveBeenCalledWith('svc-uuid-1');
      // Merged payload should include original fields plus updates
      expect(client.setMonitService).toHaveBeenCalledWith('svc-uuid-1',
        expect.objectContaining({
          name: '$HOST',   // preserved from fetched state
          enabled: '0',    // overridden
          description: 'updated',  // overridden
        })
      );
      expect(client.applyMonitChanges).toHaveBeenCalled();
    });

    it('throws when service not found on update', async () => {
      const client = createMockClient({
        getMonitService: jest.fn().mockResolvedValue({}),
      });
      const resource = new MonitResource(client);
      await expect(resource.updateService('bad-uuid', { enabled: false })).rejects.toThrow(/not found/);
    });

    it('throws when no update fields provided', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await expect(resource.updateService('svc-uuid-1', {})).rejects.toThrow(/No update fields/);
    });

    it('deletes a service', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.deleteService('svc-uuid-1');

      expect(client.delMonitService).toHaveBeenCalledWith('svc-uuid-1');
      expect(client.applyMonitChanges).toHaveBeenCalled();
    });

    it('throws when delete fails', async () => {
      const client = createMockClient({
        delMonitService: jest.fn().mockResolvedValue({ result: 'not found' }),
      });
      const resource = new MonitResource(client);
      await expect(resource.deleteService('bad-uuid')).rejects.toThrow(/Failed to delete/);
    });
  });

  describe('Test CRUD', () => {
    it('adds a test with correct payload', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      const result = await resource.addTest({
        name: 'HighCPU',
        type: 'SystemResource',
        condition: 'cpu usage is greater than 90%',
        action: 'alert',
      });

      expect(result.uuid).toBe('new-test-uuid');
      expect(client.addMonitTest).toHaveBeenCalledWith({
        name: 'HighCPU',
        type: 'SystemResource',
        condition: 'cpu usage is greater than 90%',
        action: 'alert',
      });
      expect(client.applyMonitChanges).toHaveBeenCalled();
    });

    it('defaults action to alert', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.addTest({ name: 'Test', type: 'SpaceUsage', condition: 'space > 90%' });

      expect(client.addMonitTest).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'alert' })
      );
    });

    it('throws when addTest returns no uuid', async () => {
      const client = createMockClient({
        addMonitTest: jest.fn().mockResolvedValue({ result: 'failed' }),
      });
      const resource = new MonitResource(client);
      await expect(resource.addTest({ name: 'Bad', type: 'Custom', condition: '' })).rejects.toThrow(/Failed to add Monit test/);
    });

    it('updates a test with fetch-merge pattern', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.updateTest('test-uuid-1', { condition: 'cpu usage is greater than 90%' });

      expect(client.getMonitTest).toHaveBeenCalledWith('test-uuid-1');
      expect(client.setMonitTest).toHaveBeenCalledWith('test-uuid-1',
        expect.objectContaining({
          name: 'CPUUsage',  // preserved from fetched state
          condition: 'cpu usage is greater than 90%',  // overridden
        })
      );
    });

    it('throws when test not found on update', async () => {
      const client = createMockClient({
        getMonitTest: jest.fn().mockResolvedValue({}),
      });
      const resource = new MonitResource(client);
      await expect(resource.updateTest('bad-uuid', { condition: 'test' })).rejects.toThrow(/not found/);
    });

    it('deletes a test', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.deleteTest('test-uuid-1');

      expect(client.delMonitTest).toHaveBeenCalledWith('test-uuid-1');
    });
  });

  describe('Alert CRUD', () => {
    it('adds an alert with events', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      const result = await resource.addAlert({
        recipient: 'alerts@example.com',
        events: ['connection', 'resource', 'status'],
        format: 'Subject: OPNsense: $SERVICE $EVENT',
        reminder: '5',
      });

      expect(result.uuid).toBe('new-alert-uuid');
      expect(client.addMonitAlert).toHaveBeenCalledWith({
        recipient: 'alerts@example.com',
        enabled: '1',
        noton: '0',
        events: 'connection,resource,status',
        format: 'Subject: OPNsense: $SERVICE $EVENT',
        reminder: '5',
      });
      expect(client.applyMonitChanges).toHaveBeenCalled();
    });

    it('adds a disabled alert', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.addAlert({ recipient: 'test@test.com', enabled: false });

      expect(client.addMonitAlert).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: '0' })
      );
    });

    it('throws when addAlert returns no uuid', async () => {
      const client = createMockClient({
        addMonitAlert: jest.fn().mockResolvedValue({ result: 'failed' }),
      });
      const resource = new MonitResource(client);
      await expect(resource.addAlert({ recipient: '' })).rejects.toThrow(/Failed to add Monit alert/);
    });

    it('updates alert with fetch-merge pattern', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.updateAlert('alert-uuid-1', {
        events: ['connection', 'timeout'],
        enabled: true,
      });

      expect(client.getMonitAlert).toHaveBeenCalledWith('alert-uuid-1');
      expect(client.setMonitAlert).toHaveBeenCalledWith('alert-uuid-1',
        expect.objectContaining({
          recipient: 'admin@example.com',  // preserved from fetched state
          events: 'connection,timeout',     // overridden
          enabled: '1',                     // overridden
        })
      );
    });

    it('throws when alert not found on update', async () => {
      const client = createMockClient({
        getMonitAlert: jest.fn().mockResolvedValue({}),
      });
      const resource = new MonitResource(client);
      await expect(resource.updateAlert('bad-uuid', { enabled: false })).rejects.toThrow(/not found/);
    });

    it('throws when no update fields provided', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await expect(resource.updateAlert('alert-uuid-1', {})).rejects.toThrow(/No update fields/);
    });

    it('deletes an alert', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.deleteAlert('alert-uuid-1');

      expect(client.delMonitAlert).toHaveBeenCalledWith('alert-uuid-1');
      expect(client.applyMonitChanges).toHaveBeenCalled();
    });

    it('supports notOn flag', async () => {
      const client = createMockClient();
      const resource = new MonitResource(client);
      await resource.addAlert({
        recipient: 'test@test.com',
        notOn: true,
        events: ['instance'],
      });

      expect(client.addMonitAlert).toHaveBeenCalledWith(
        expect.objectContaining({ noton: '1', events: 'instance' })
      );
    });
  });

  describe('applyChanges validation', () => {
    it('throws when reconfigure reports config error', async () => {
      const client = createMockClient({
        applyMonitChanges: jest.fn().mockResolvedValue({
          status: 'ok',
          result: "Program does not exist: '/bad/path'\nmonit exiting due to parsing errors",
        }),
      });
      const resource = new MonitResource(client);
      await expect(resource.deleteTest('test-uuid-1')).rejects.toThrow(/Monit reconfigure failed/);
    });
  });
});
