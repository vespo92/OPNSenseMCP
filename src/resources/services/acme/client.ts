import { OPNSenseAPIClient } from '../../../api/client.js';

/**
 * OPNsense ACME Client API response shapes.
 */

interface AcmeSelectOption {
  value: string;
  selected: 0 | 1;
}

interface AcmeCertificateEntry {
  id: string;
  enabled: '0' | '1';
  name: string;
  description: string;
  altNames: Record<string, AcmeSelectOption>;
  account: Record<string, AcmeSelectOption>;
  validationMethod: Record<string, AcmeSelectOption>;
  keyLength: Record<string, AcmeSelectOption>;
  ocsp: string;
  restartActions: Record<string, AcmeSelectOption>;
  autoRenewal: '0' | '1';
  renewInterval: string;
  aliasmode: Record<string, AcmeSelectOption>;
  lastUpdate: string;
  statusCode: string;
  statusLastUpdate: string;
}

interface AcmeAccountEntry {
  id: string;
  enabled: '0' | '1';
  name: string;
  description: string;
  email: string;
  ca: Record<string, AcmeSelectOption>;
  statusCode: string;
  statusLastUpdate: string;
}

interface AcmeValidationEntry {
  id: string;
  enabled: '0' | '1';
  name: string;
  description: string;
  method: Record<string, AcmeSelectOption>;
  dns_service: Record<string, AcmeSelectOption>;
  dns_sleep: string;
}

interface AcmeActionEntry {
  id: string;
  enabled: '0' | '1';
  name: string;
  description: string;
  type: Record<string, AcmeSelectOption>;
}

interface AcmeReconfigureResponse {
  status?: string;
  result?: string;
}

interface AcmeMutationResponse {
  result?: string;
  uuid?: string;
  validations?: Record<string, string>;
}

// --- Public result types ---

export interface AcmeCertificate {
  uuid: string;
  enabled: boolean;
  name: string;
  description: string;
  altNames: string[];
  accountUuid: string;
  accountName: string;
  validationUuid: string;
  validationName: string;
  keyLength: string;
  autoRenewal: boolean;
  renewInterval: string;
  restartActionUuids: string[];
  restartActionNames: string[];
  lastUpdate: string;
  statusCode: string;
}

export interface AcmeAccount {
  uuid: string;
  enabled: boolean;
  name: string;
  description: string;
  email: string;
  ca: string;
  statusCode: string;
}

export interface AcmeValidation {
  uuid: string;
  enabled: boolean;
  name: string;
  description: string;
  method: string;
  dnsService: string;
  dnsSleep: string;
}

export interface AcmeAction {
  uuid: string;
  enabled: boolean;
  name: string;
  description: string;
  type: string;
}

export interface AcmeOverview {
  enabled: boolean;
  autoRenewal: boolean;
  certificates: AcmeCertificate[];
  accounts: AcmeAccount[];
  validations: AcmeValidation[];
  actions: AcmeAction[];
}

/**
 * ACME Client resource for managing Let's Encrypt / ACME certificates on OPNsense.
 */
export class AcmeClientResource {
  constructor(private client: OPNSenseAPIClient) {}

  // --- Helpers ---

  private static getSelectedKey(opts: Record<string, AcmeSelectOption>): string {
    for (const [key, entry] of Object.entries(opts)) {
      if (entry?.selected === 1) return key;
    }
    return '';
  }

  private static getSelectedValue(opts: Record<string, AcmeSelectOption>): string {
    for (const entry of Object.values(opts)) {
      if (entry?.selected === 1) return entry.value ?? '';
    }
    return '';
  }

  private static getSelectedKeys(opts: Record<string, AcmeSelectOption>): string[] {
    const keys: string[] = [];
    for (const [key, entry] of Object.entries(opts)) {
      if (entry?.selected === 1 && key) keys.push(key);
    }
    return keys;
  }

  private static getSelectedValues(opts: Record<string, AcmeSelectOption>): string[] {
    const values: string[] = [];
    for (const entry of Object.values(opts)) {
      if (entry?.selected === 1 && entry.value) values.push(entry.value);
    }
    return values;
  }

  private static parseCertificate(uuid: string, entry: AcmeCertificateEntry): AcmeCertificate {
    return {
      uuid,
      enabled: entry.enabled === '1',
      name: entry.name || '',
      description: entry.description || '',
      altNames: AcmeClientResource.getSelectedValues(entry.altNames || {}),
      accountUuid: AcmeClientResource.getSelectedKey(entry.account || {}),
      accountName: AcmeClientResource.getSelectedValue(entry.account || {}),
      validationUuid: AcmeClientResource.getSelectedKey(entry.validationMethod || {}),
      validationName: AcmeClientResource.getSelectedValue(entry.validationMethod || {}),
      keyLength: AcmeClientResource.getSelectedValue(entry.keyLength || {}),
      autoRenewal: entry.autoRenewal === '1',
      renewInterval: entry.renewInterval || '',
      restartActionUuids: AcmeClientResource.getSelectedKeys(entry.restartActions || {}),
      restartActionNames: AcmeClientResource.getSelectedValues(entry.restartActions || {}),
      lastUpdate: entry.lastUpdate || '',
      statusCode: entry.statusCode || '',
    };
  }

  private static parseAccount(uuid: string, entry: AcmeAccountEntry): AcmeAccount {
    return {
      uuid,
      enabled: entry.enabled === '1',
      name: entry.name || '',
      description: entry.description || '',
      email: entry.email || '',
      ca: AcmeClientResource.getSelectedValue(entry.ca || {}),
      statusCode: entry.statusCode || '',
    };
  }

  private static parseValidation(uuid: string, entry: AcmeValidationEntry): AcmeValidation {
    return {
      uuid,
      enabled: entry.enabled === '1',
      name: entry.name || '',
      description: entry.description || '',
      method: AcmeClientResource.getSelectedValue(entry.method || {}),
      dnsService: AcmeClientResource.getSelectedValue(entry.dns_service || {}),
      dnsSleep: entry.dns_sleep || '',
    };
  }

  private static parseAction(uuid: string, entry: AcmeActionEntry): AcmeAction {
    return {
      uuid,
      enabled: entry.enabled === '1',
      name: entry.name || '',
      description: entry.description || '',
      type: AcmeClientResource.getSelectedValue(entry.type || {}),
    };
  }

  private static validateUuid(uuid: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      throw new Error(`Invalid UUID format: ${uuid}`);
    }
  }

  private async applyChanges(): Promise<void> {
    const response = await this.client.applyAcmeChanges() as AcmeReconfigureResponse;
    if (response?.status === 'error' || response?.result === 'failed') {
      throw new Error('ACME reconfigure failed: ' + JSON.stringify(response));
    }
  }

  // --- Read operations ---

  async getOverview(): Promise<AcmeOverview> {
    const response = await this.client.getAcmeSettings();
    const a = response?.acmeclient;
    if (!a) throw new Error('No ACME client configuration found');

    const certificates: AcmeCertificate[] = [];
    const certMap = a.certificates?.certificate;
    if (certMap && typeof certMap === 'object') {
      for (const [uuid, entry] of Object.entries(certMap)) {
        if (typeof entry === 'object' && entry !== null && (entry as AcmeCertificateEntry).name !== undefined) {
          certificates.push(AcmeClientResource.parseCertificate(uuid, entry as AcmeCertificateEntry));
        }
      }
    }

    const accounts: AcmeAccount[] = [];
    const acctMap = a.accounts?.account;
    if (acctMap && typeof acctMap === 'object') {
      for (const [uuid, entry] of Object.entries(acctMap)) {
        if (typeof entry === 'object' && entry !== null && (entry as AcmeAccountEntry).name !== undefined) {
          accounts.push(AcmeClientResource.parseAccount(uuid, entry as AcmeAccountEntry));
        }
      }
    }

    const validations: AcmeValidation[] = [];
    const valMap = a.validations?.validation;
    if (valMap && typeof valMap === 'object') {
      for (const [uuid, entry] of Object.entries(valMap)) {
        if (typeof entry === 'object' && entry !== null && (entry as AcmeValidationEntry).name !== undefined) {
          validations.push(AcmeClientResource.parseValidation(uuid, entry as AcmeValidationEntry));
        }
      }
    }

    const actions: AcmeAction[] = [];
    const actMap = a.actions?.action;
    if (actMap && typeof actMap === 'object') {
      for (const [uuid, entry] of Object.entries(actMap)) {
        if (typeof entry === 'object' && entry !== null && (entry as AcmeActionEntry).name !== undefined) {
          actions.push(AcmeClientResource.parseAction(uuid, entry as AcmeActionEntry));
        }
      }
    }

    return {
      enabled: a.settings?.enabled === '1',
      autoRenewal: a.settings?.autoRenewal === '1',
      certificates,
      accounts,
      validations,
      actions,
    };
  }

  // --- Certificate operations ---

  /**
   * Update certificate fields using settings/set (the only reliable write path).
   * certificates/set/{uuid} silently drops changes to restartActions and renewInterval.
   */
  async updateCertificate(uuid: string, data: {
    renewInterval?: string;
    restartActions?: string[];
    autoRenewal?: boolean;
    enabled?: boolean;
    description?: string;
  }): Promise<void> {
    AcmeClientResource.validateUuid(uuid);

    if (Object.keys(data).length === 0) {
      throw new Error('No update fields provided');
    }

    // Verify cert exists
    const overview = await this.getOverview();
    const cert = overview.certificates.find(c => c.uuid === uuid);
    if (!cert) {
      throw new Error(`Certificate ${uuid} not found`);
    }

    const update: Record<string, string> = {};
    if (data.renewInterval !== undefined) {
      const interval = parseInt(data.renewInterval, 10);
      if (isNaN(interval) || interval < 1) {
        throw new Error('renewInterval must be a positive integer');
      }
      update.renewInterval = data.renewInterval;
    }
    if (data.restartActions !== undefined) update.restartActions = data.restartActions.join(',');
    if (data.autoRenewal !== undefined) update.autoRenewal = data.autoRenewal ? '1' : '0';
    if (data.enabled !== undefined) update.enabled = data.enabled ? '1' : '0';
    if (data.description !== undefined) update.description = data.description;

    // Use settings/set with full nested path — the only reliable write endpoint
    const response = await this.client.setAcmeSettings({
      certificates: {
        certificate: {
          [uuid]: update,
        },
      },
    }) as AcmeMutationResponse;

    if (response?.result !== 'saved') {
      throw new Error('Failed to update certificate: ' + JSON.stringify(response));
    }

    await this.applyChanges();
  }

  async renewCertificate(uuid: string): Promise<{ status: string }> {
    AcmeClientResource.validateUuid(uuid);
    const overview = await this.getOverview();
    const cert = overview.certificates.find(c => c.uuid === uuid);
    if (!cert) {
      throw new Error(`Certificate ${uuid} not found`);
    }

    const response = await this.client.renewAcmeCertificate(uuid);
    return { status: response?.status ?? 'unknown' };
  }

  async signCertificate(uuid: string): Promise<{ status: string }> {
    AcmeClientResource.validateUuid(uuid);
    const overview = await this.getOverview();
    const cert = overview.certificates.find(c => c.uuid === uuid);
    if (!cert) {
      throw new Error(`Certificate ${uuid} not found`);
    }

    const response = await this.client.signAcmeCertificate(uuid);
    return { status: response?.status ?? 'unknown' };
  }

  async revokeCertificate(uuid: string): Promise<{ status: string }> {
    AcmeClientResource.validateUuid(uuid);
    const overview = await this.getOverview();
    const cert = overview.certificates.find(c => c.uuid === uuid);
    if (!cert) {
      throw new Error(`Certificate ${uuid} not found`);
    }

    const response = await this.client.revokeAcmeCertificate(uuid);
    return { status: response?.status ?? 'unknown' };
  }

  // --- Automation action operations ---

  async addAction(data: {
    name: string;
    type: string;
    enabled?: boolean;
    description?: string;
  }): Promise<{ uuid: string }> {
    const payload: Record<string, unknown> = {
      name: data.name,
      type: data.type,
      enabled: data.enabled === false ? '0' : '1',
    };
    if (data.description !== undefined) payload.description = data.description;

    const response = await this.client.addAcmeAction(payload) as AcmeMutationResponse;
    if (!response?.uuid) {
      throw new Error('Failed to add ACME action: ' + JSON.stringify(response));
    }
    await this.applyChanges();
    return { uuid: response.uuid };
  }

  async deleteAction(uuid: string): Promise<void> {
    AcmeClientResource.validateUuid(uuid);
    const response = await this.client.delAcmeAction(uuid) as AcmeMutationResponse;
    if (response?.result !== 'deleted') {
      throw new Error('Failed to delete ACME action: ' + JSON.stringify(response));
    }
    await this.applyChanges();
  }
}

export default AcmeClientResource;
