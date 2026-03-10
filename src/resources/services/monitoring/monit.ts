import { OPNSenseAPIClient } from '../../../api/client.js';

/**
 * OPNsense Monit API response shapes.
 */

interface MonitSelectOption {
  value: string;
  selected: 0 | 1;
}

interface MonitServiceEntry {
  enabled: '0' | '1';
  name: string;
  description: string;
  type: Record<string, MonitSelectOption>;
  pidfile: string;
  match: string;
  path: string;
  timeout: string;
  starttimeout: string;
  address: string;
  interface: Record<string, MonitSelectOption>;
  start: string;
  stop: string;
  tests: Record<string, MonitSelectOption>;
  depends: Record<string, MonitSelectOption>;
  polltime: string;
}

interface MonitTestEntry {
  name: string;
  type: Record<string, MonitSelectOption>;
  condition: string;
  action: Record<string, MonitSelectOption>;
  path: string;
}

interface MonitAlertEntry {
  enabled: '0' | '1';
  recipient: string;
  noton: '0' | '1';
  events: Record<string, MonitSelectOption>;
  format: string;
  reminder: string;
  description: string;
}

interface MonitGeneralSettings {
  enabled: '0' | '1';
  interval: number;
  startdelay: number;
  mailserver: Record<string, MonitSelectOption>;
  port: number;
  username: string;
  password: string;
  ssl: string;
  sslversion: Record<string, MonitSelectOption>;
  sslverify: number;
  logfile: string;
  statefile: string;
  eventqueuePath: string;
  eventqueueSlots: string;
  httpdEnabled: number;
  httpdUsername: string;
  httpdPassword: string;
  httpdPort: number;
  httpdAllow: Record<string, MonitSelectOption>;
  mmonitUrl: string;
  mmonitTimeout: number;
  mmonitRegisterCredentials: number;
}

interface MonitMutationResponse {
  result?: string;
  uuid?: string;
  validations?: Record<string, string>;
}

interface MonitReconfigureResponse {
  status?: string;
  result?: string;
}

// --- Public result types ---

export interface MonitService {
  uuid: string;
  enabled: boolean;
  name: string;
  type: string;
  description: string;
  address: string;
  path: string;
  testUuids: string[];
  testNames: string[];
  dependUuids: string[];
  dependNames: string[];
}

export interface MonitTest {
  uuid: string;
  name: string;
  type: string;
  condition: string;
  action: string;
}

export interface MonitAlert {
  uuid: string;
  enabled: boolean;
  recipient: string;
  notOn: boolean;
  events: string[];
  format: string;
  reminder: string;
  description: string;
}

export interface MonitOverview {
  enabled: boolean;
  interval: number;
  startDelay: number;
  services: MonitService[];
  tests: MonitTest[];
  alerts: MonitAlert[];
}

export interface MonitLiveStatus {
  running: boolean;
  services: Array<{
    name: string;
    status: string;
    type: string;
    monitored: boolean;
  }>;
}

/**
 * Monit resource for managing OPNsense Monit services, tests, and alerts.
 */
export class MonitResource {
  constructor(private client: OPNSenseAPIClient) {}

  // --- Helpers ---

  private static getSelectedKey(opts: Record<string, MonitSelectOption>): string {
    for (const [key, entry] of Object.entries(opts)) {
      if (entry?.selected === 1) return entry.value ?? key;
    }
    return '';
  }

  private static getSelectedKeys(opts: Record<string, MonitSelectOption>): string[] {
    const keys: string[] = [];
    for (const [key, entry] of Object.entries(opts)) {
      if (entry?.selected === 1 && key) keys.push(key);
    }
    return keys;
  }

  private static getSelectedValues(opts: Record<string, MonitSelectOption>): string[] {
    const values: string[] = [];
    for (const entry of Object.values(opts)) {
      if (entry?.selected === 1 && entry.value) values.push(entry.value);
    }
    return values;
  }

  private static parseService(uuid: string, entry: MonitServiceEntry): MonitService {
    return {
      uuid,
      enabled: entry.enabled === '1',
      name: entry.name || '',
      type: MonitResource.getSelectedKey(entry.type || {}),
      description: entry.description || '',
      address: entry.address || '',
      path: entry.path || '',
      testUuids: MonitResource.getSelectedKeys(entry.tests || {}),
      testNames: MonitResource.getSelectedValues(entry.tests || {}),
      dependUuids: MonitResource.getSelectedKeys(entry.depends || {}),
      dependNames: MonitResource.getSelectedValues(entry.depends || {}),
    };
  }

  private static parseTest(uuid: string, entry: MonitTestEntry): MonitTest {
    return {
      uuid,
      name: entry.name || '',
      type: MonitResource.getSelectedKey(entry.type || {}),
      condition: entry.condition || '',
      action: MonitResource.getSelectedKey(entry.action || {}),
    };
  }

  private static parseAlert(uuid: string, entry: MonitAlertEntry): MonitAlert {
    return {
      uuid,
      enabled: entry.enabled === '1',
      recipient: entry.recipient || '',
      notOn: entry.noton === '1',
      events: MonitResource.getSelectedValues(entry.events || {}),
      format: entry.format || '',
      reminder: entry.reminder || '',
      description: entry.description || '',
    };
  }

  private async applyChanges(): Promise<void> {
    const response = await this.client.applyMonitChanges() as MonitReconfigureResponse;
    if (response?.result && !response.result.includes('syntax OK') && response.result !== 'OK') {
      throw new Error('Monit reconfigure failed: ' + response.result);
    }
  }

  // --- Read operations ---

  async getOverview(): Promise<MonitOverview> {
    const response = await this.client.getMonitSettings();
    const m = response?.monit;
    if (!m) throw new Error('No Monit configuration found');

    const general = m.general as MonitGeneralSettings;

    const services: MonitService[] = [];
    if (m.service && typeof m.service === 'object') {
      for (const [uuid, entry] of Object.entries(m.service)) {
        if (typeof entry === 'object' && entry !== null && (entry as MonitServiceEntry).name !== undefined) {
          services.push(MonitResource.parseService(uuid, entry as MonitServiceEntry));
        }
      }
    }

    const tests: MonitTest[] = [];
    if (m.test && typeof m.test === 'object') {
      for (const [uuid, entry] of Object.entries(m.test)) {
        if (typeof entry === 'object' && entry !== null && (entry as MonitTestEntry).name !== undefined) {
          tests.push(MonitResource.parseTest(uuid, entry as MonitTestEntry));
        }
      }
    }

    const alerts: MonitAlert[] = [];
    if (m.alert && typeof m.alert === 'object') {
      for (const [uuid, entry] of Object.entries(m.alert)) {
        if (typeof entry === 'object' && entry !== null && (entry as MonitAlertEntry).recipient !== undefined) {
          alerts.push(MonitResource.parseAlert(uuid, entry as MonitAlertEntry));
        }
      }
    }

    return {
      enabled: general?.enabled === '1',
      interval: general?.interval ?? 0,
      startDelay: general?.startdelay ?? 0,
      services,
      tests,
      alerts,
    };
  }

  async getStatus(): Promise<MonitLiveStatus> {
    const [statusResp, serviceResp] = await Promise.all([
      this.client.getMonitStatus().catch(() => null),
      this.client.getMonitServiceStatus().catch(() => null),
    ]);

    const running = serviceResp?.status === 'running';

    const services: MonitLiveStatus['services'] = [];
    if (statusResp?.result?.service) {
      const svcList = Array.isArray(statusResp.result.service)
        ? statusResp.result.service
        : [statusResp.result.service];
      for (const svc of svcList) {
        services.push({
          name: svc.name || '',
          status: svc.status !== undefined ? String(svc.status) : 'unknown',
          type: svc.type !== undefined ? String(svc.type) : 'unknown',
          monitored: svc.monitor !== '0' && svc.monitor !== 0,
        });
      }
    }

    return { running, services };
  }

  // --- Service CRUD ---

  async addService(data: {
    name: string;
    type: string;
    enabled?: boolean;
    description?: string;
    address?: string;
    path?: string;
    timeout?: string;
    starttimeout?: string;
    tests?: string[];
    depends?: string[];
  }): Promise<{ uuid: string }> {
    const payload: Record<string, unknown> = {
      name: data.name,
      type: data.type,
      enabled: data.enabled === false ? '0' : '1',
      timeout: data.timeout ?? '300',
      starttimeout: data.starttimeout ?? '30',
    };
    if (data.description !== undefined) payload.description = data.description;
    if (data.address !== undefined) payload.address = data.address;
    if (data.path !== undefined) payload.path = data.path;
    if (data.tests) payload.tests = data.tests.join(',');
    if (data.depends) payload.depends = data.depends.join(',');

    const response = await this.client.addMonitService(payload) as MonitMutationResponse;
    if (!response?.uuid) {
      throw new Error('Failed to add Monit service: ' + JSON.stringify(response));
    }
    await this.applyChanges();
    return { uuid: response.uuid };
  }

  async updateService(uuid: string, data: {
    enabled?: boolean;
    description?: string;
    address?: string;
    path?: string;
    tests?: string[];
  }): Promise<void> {
    if (Object.keys(data).length === 0) {
      throw new Error('No update fields provided');
    }

    // Fetch current state and merge to avoid blanking fields
    const current = await this.client.getMonitService(uuid);
    if (!current?.service) {
      throw new Error(`Monit service ${uuid} not found`);
    }

    const merged: Record<string, unknown> = { ...current.service };
    if (data.enabled !== undefined) merged.enabled = data.enabled ? '1' : '0';
    if (data.description !== undefined) merged.description = data.description;
    if (data.address !== undefined) merged.address = data.address;
    if (data.path !== undefined) merged.path = data.path;
    if (data.tests !== undefined) merged.tests = data.tests.join(',');

    const response = await this.client.setMonitService(uuid, merged) as MonitMutationResponse;
    if (response?.result !== 'saved') {
      throw new Error('Failed to update Monit service: ' + JSON.stringify(response));
    }
    await this.applyChanges();
  }

  async deleteService(uuid: string): Promise<void> {
    const response = await this.client.delMonitService(uuid) as MonitMutationResponse;
    if (response?.result !== 'deleted') {
      throw new Error('Failed to delete Monit service: ' + JSON.stringify(response));
    }
    await this.applyChanges();
  }

  // --- Test CRUD ---

  async addTest(data: {
    name: string;
    type: string;
    condition: string;
    action?: string;
    path?: string;
  }): Promise<{ uuid: string }> {
    const payload: Record<string, unknown> = {
      name: data.name,
      type: data.type,
      condition: data.condition,
      action: data.action || 'alert',
    };
    if (data.path !== undefined) payload.path = data.path;

    const response = await this.client.addMonitTest(payload) as MonitMutationResponse;
    if (!response?.uuid) {
      throw new Error('Failed to add Monit test: ' + JSON.stringify(response));
    }
    await this.applyChanges();
    return { uuid: response.uuid };
  }

  async updateTest(uuid: string, data: {
    condition?: string;
    action?: string;
    path?: string;
  }): Promise<void> {
    if (Object.keys(data).length === 0) {
      throw new Error('No update fields provided');
    }

    // Fetch current state and merge
    const current = await this.client.getMonitTest(uuid);
    if (!current?.test) {
      throw new Error(`Monit test ${uuid} not found`);
    }

    const merged: Record<string, unknown> = { ...current.test };
    if (data.condition !== undefined) merged.condition = data.condition;
    if (data.action !== undefined) merged.action = data.action;
    if (data.path !== undefined) merged.path = data.path;

    const response = await this.client.setMonitTest(uuid, merged) as MonitMutationResponse;
    if (response?.result !== 'saved') {
      throw new Error('Failed to update Monit test: ' + JSON.stringify(response));
    }
    await this.applyChanges();
  }

  async deleteTest(uuid: string): Promise<void> {
    const response = await this.client.delMonitTest(uuid) as MonitMutationResponse;
    if (response?.result !== 'deleted') {
      throw new Error('Failed to delete Monit test: ' + JSON.stringify(response));
    }
    await this.applyChanges();
  }

  // --- Alert CRUD ---

  async addAlert(data: {
    recipient: string;
    enabled?: boolean;
    events?: string[];
    notOn?: boolean;
    format?: string;
    reminder?: string;
    description?: string;
  }): Promise<{ uuid: string }> {
    const payload: Record<string, unknown> = {
      recipient: data.recipient,
      enabled: data.enabled === false ? '0' : '1',
      noton: data.notOn ? '1' : '0',
    };
    if (data.events) payload.events = data.events.join(',');
    if (data.format !== undefined) payload.format = data.format;
    if (data.reminder !== undefined) payload.reminder = data.reminder;
    if (data.description !== undefined) payload.description = data.description;

    const response = await this.client.addMonitAlert(payload) as MonitMutationResponse;
    if (!response?.uuid) {
      throw new Error('Failed to add Monit alert: ' + JSON.stringify(response));
    }
    await this.applyChanges();
    return { uuid: response.uuid };
  }

  async updateAlert(uuid: string, data: {
    enabled?: boolean;
    events?: string[];
    notOn?: boolean;
    format?: string;
    reminder?: string;
    description?: string;
  }): Promise<void> {
    if (Object.keys(data).length === 0) {
      throw new Error('No update fields provided');
    }

    // Fetch current state and merge
    const current = await this.client.getMonitAlert(uuid);
    if (!current?.alert) {
      throw new Error(`Monit alert ${uuid} not found`);
    }

    const merged: Record<string, unknown> = { ...current.alert };
    if (data.enabled !== undefined) merged.enabled = data.enabled ? '1' : '0';
    if (data.events !== undefined) merged.events = data.events.join(',');
    if (data.notOn !== undefined) merged.noton = data.notOn ? '1' : '0';
    if (data.format !== undefined) merged.format = data.format;
    if (data.reminder !== undefined) merged.reminder = data.reminder;
    if (data.description !== undefined) merged.description = data.description;

    const response = await this.client.setMonitAlert(uuid, merged) as MonitMutationResponse;
    if (response?.result !== 'saved') {
      throw new Error('Failed to update Monit alert: ' + JSON.stringify(response));
    }
    await this.applyChanges();
  }

  async deleteAlert(uuid: string): Promise<void> {
    const response = await this.client.delMonitAlert(uuid) as MonitMutationResponse;
    if (response?.result !== 'deleted') {
      throw new Error('Failed to delete Monit alert: ' + JSON.stringify(response));
    }
    await this.applyChanges();
  }
}

export default MonitResource;
