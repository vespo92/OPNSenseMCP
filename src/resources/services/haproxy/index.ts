import { z } from 'zod';
import { OPNSenseAPIClient } from '../../../api/client.js';

// HAProxy Service Management
export interface HAProxyServiceStatus {
  enabled: boolean;
  running: boolean;
  pid?: number;
  uptime?: string;
  version?: string;
}

// Backend Management Types
export interface HAProxyBackend {
  uuid?: string;
  name: string;
  mode: 'http' | 'tcp';
  balance: 'roundrobin' | 'leastconn' | 'source' | 'uri' | 'hdr' | 'random';
  servers: HAProxyServer[];
  description?: string;
  enabled?: boolean;
  healthCheck?: {
    type: string;
    interval?: number;
    timeout?: number;
  };
}

export interface HAProxyServer {
  uuid?: string;
  name: string;
  address: string;
  port: number;
  ssl?: boolean;
  verify?: 'none' | 'required';
  weight?: number;
  backup?: boolean;
  enabled?: boolean;
}

// Frontend Management Types
export interface HAProxyFrontend {
  uuid?: string;
  name: string;
  bind: string;
  bindOptions?: {
    ssl?: boolean;
    certificates?: string[];
  };
  mode: 'http' | 'tcp';
  backend: string;
  acls?: HAProxyACL[];
  actions?: HAProxyAction[];
  description?: string;
  enabled?: boolean;
}

export interface HAProxyACL {
  uuid?: string;
  name: string;
  expression: string;
  enabled?: boolean;
}

export interface HAProxyAction {
  uuid?: string;
  type: 'use_backend' | 'redirect' | 'add_header' | 'set_header' | 'del_header';
  backend?: string;
  condition?: string;
  value?: string;
  enabled?: boolean;
}

// Certificate Management Types
export interface HAProxyCertificate {
  uuid?: string;
  name: string;
  type: 'selfsigned' | 'import' | 'acme';
  cn?: string;
  san?: string[];
  certificate?: string;
  key?: string;
  ca?: string;
}

// Stats Types
export interface HAProxyStats {
  frontends: {
    [name: string]: {
      status: string;
      sessions: number;
      bytesIn: number;
      bytesOut: number;
      requestRate: number;
      errorRate: number;
    };
  };
  backends: {
    [name: string]: {
      status: string;
      activeServers: number;
      backupServers: number;
      sessions: number;
      queuedRequests: number;
      health: {
        [serverName: string]: {
          status: 'up' | 'down' | 'maint';
          lastCheck: string;
          weight: number;
          checksPassed: number;
          checksFailed: number;
        };
      };
    };
  };
}

/**
 * HAProxy Resource Manager for OPNsense
 */
export class HAProxyResource {
  constructor(private client: OPNSenseAPIClient) {}

  // Service Control Methods
  async getServiceStatus(): Promise<HAProxyServiceStatus> {
    try {
      const response = await this.client.get('/haproxy/service/status');
      return {
        enabled: response.status === 'enabled',
        running: response.running === true,
        pid: response.pid,
        uptime: response.uptime,
        version: response.version
      };
    } catch (error) {
      throw new Error(`Failed to get HAProxy service status: ${error}`);
    }
  }

  async controlService(action: 'start' | 'stop' | 'restart' | 'reload'): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/service/${action}`);
      return response.result === 'ok';
    } catch (error) {
      throw new Error(`Failed to ${action} HAProxy service: ${error}`);
    }
  }

  async reconfigure(): Promise<boolean> {
    try {
      const response = await this.client.post('/haproxy/service/reconfigure');
      return response.result === 'ok';
    } catch (error) {
      throw new Error(`Failed to reconfigure HAProxy: ${error}`);
    }
  }

  // Backend Management Methods
  async listBackends(): Promise<HAProxyBackend[]> {
    try {
      const response = await this.client.get('/haproxy/settings/searchBackends');
      if (!response.rows || !Array.isArray(response.rows)) {
        return [];
      }
      return response.rows.map((row: any) => this.parseBackend(row));
    } catch (error) {
      throw new Error(`Failed to list HAProxy backends: ${error}`);
    }
  }

  async getBackend(uuid: string): Promise<HAProxyBackend | null> {
    try {
      const response = await this.client.get(`/haproxy/settings/getBackend/${uuid}`);
      if (!response.backend) {
        return null;
      }
      return this.parseBackend(response.backend);
    } catch (error) {
      throw new Error(`Failed to get HAProxy backend: ${error}`);
    }
  }

  async createBackend(backend: Omit<HAProxyBackend, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = this.buildBackendPayload(backend);
      const response = await this.client.post('/haproxy/settings/addBackend', payload);
      
      if (!response.uuid) {
        throw new Error('No UUID returned from create backend');
      }

      // Add servers if provided
      if (backend.servers && backend.servers.length > 0) {
        for (const server of backend.servers) {
          await this.addServerToBackend(response.uuid, server);
        }
      }

      // Apply configuration
      await this.reconfigure();

      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to create HAProxy backend: ${error}`);
    }
  }

  async updateBackend(uuid: string, updates: Partial<HAProxyBackend>): Promise<boolean> {
    try {
      const payload = this.buildBackendPayload(updates as HAProxyBackend);
      const response = await this.client.post(`/haproxy/settings/setBackend/${uuid}`, payload);
      
      if (response.result !== 'saved') {
        throw new Error('Failed to save backend updates');
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy backend: ${error}`);
    }
  }

  async deleteBackend(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delBackend/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete backend');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy backend: ${error}`);
    }
  }

  // Server Management Methods
  async addServerToBackend(backendUuid: string, server: Omit<HAProxyServer, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = this.buildServerPayload(server);
      payload.server.backend = backendUuid;
      
      const response = await this.client.post('/haproxy/settings/addServer', payload);
      if (!response.uuid) {
        throw new Error('No UUID returned from add server');
      }
      
      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to add server to backend: ${error}`);
    }
  }

  async updateServer(uuid: string, updates: Partial<HAProxyServer>): Promise<boolean> {
    try {
      const payload = this.buildServerPayload(updates as HAProxyServer);
      const response = await this.client.post(`/haproxy/settings/setServer/${uuid}`, payload);
      
      if (response.result !== 'saved') {
        throw new Error('Failed to save server updates');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy server: ${error}`);
    }
  }

  async deleteServer(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delServer/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete server');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy server: ${error}`);
    }
  }

  // Frontend Management Methods
  async listFrontends(): Promise<HAProxyFrontend[]> {
    try {
      const response = await this.client.get('/haproxy/settings/searchFrontends');
      if (!response.rows || !Array.isArray(response.rows)) {
        return [];
      }
      return response.rows.map((row: any) => this.parseFrontend(row));
    } catch (error) {
      throw new Error(`Failed to list HAProxy frontends: ${error}`);
    }
  }

  async getFrontend(uuid: string): Promise<HAProxyFrontend | null> {
    try {
      const response = await this.client.get(`/haproxy/settings/getFrontend/${uuid}`);
      if (!response.frontend) {
        return null;
      }
      return this.parseFrontend(response.frontend);
    } catch (error) {
      throw new Error(`Failed to get HAProxy frontend: ${error}`);
    }
  }

  async createFrontend(frontend: Omit<HAProxyFrontend, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = this.buildFrontendPayload(frontend);
      const response = await this.client.post('/haproxy/settings/addFrontend', payload);
      
      if (!response.uuid) {
        throw new Error('No UUID returned from create frontend');
      }

      // Add ACLs if provided
      if (frontend.acls && frontend.acls.length > 0) {
        for (const acl of frontend.acls) {
          await this.addACLToFrontend(response.uuid, acl);
        }
      }

      // Add actions if provided
      if (frontend.actions && frontend.actions.length > 0) {
        for (const action of frontend.actions) {
          await this.addActionToFrontend(response.uuid, action);
        }
      }

      await this.reconfigure();
      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to create HAProxy frontend: ${error}`);
    }
  }

  async updateFrontend(uuid: string, updates: Partial<HAProxyFrontend>): Promise<boolean> {
    try {
      const payload = this.buildFrontendPayload(updates as HAProxyFrontend);
      const response = await this.client.post(`/haproxy/settings/setFrontend/${uuid}`, payload);
      
      if (response.result !== 'saved') {
        throw new Error('Failed to save frontend updates');
      }

      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy frontend: ${error}`);
    }
  }

  async deleteFrontend(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delFrontend/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete frontend');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy frontend: ${error}`);
    }
  }

  // ACL Management Methods
  async addACLToFrontend(frontendUuid: string, acl: Omit<HAProxyACL, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = {
        acl: {
          name: acl.name,
          expression: acl.expression,
          frontend: frontendUuid,
          enabled: acl.enabled !== false ? '1' : '0'
        }
      };
      
      const response = await this.client.post('/haproxy/settings/addAcl', payload);
      if (!response.uuid) {
        throw new Error('No UUID returned from add ACL');
      }
      
      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to add ACL to frontend: ${error}`);
    }
  }

  async updateACL(uuid: string, updates: Partial<HAProxyACL>): Promise<boolean> {
    try {
      const payload = {
        acl: {
          name: updates.name,
          expression: updates.expression,
          enabled: updates.enabled !== false ? '1' : '0'
        }
      };
      
      const response = await this.client.post(`/haproxy/settings/setAcl/${uuid}`, payload);
      if (response.result !== 'saved') {
        throw new Error('Failed to save ACL updates');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy ACL: ${error}`);
    }
  }

  async deleteACL(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delAcl/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete ACL');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy ACL: ${error}`);
    }
  }

  // Action Management Methods
  async addActionToFrontend(frontendUuid: string, action: Omit<HAProxyAction, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = {
        action: {
          type: action.type,
          backend: action.backend,
          condition: action.condition,
          value: action.value,
          frontend: frontendUuid,
          enabled: action.enabled !== false ? '1' : '0'
        }
      };
      
      const response = await this.client.post('/haproxy/settings/addAction', payload);
      if (!response.uuid) {
        throw new Error('No UUID returned from add action');
      }
      
      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to add action to frontend: ${error}`);
    }
  }

  async updateAction(uuid: string, updates: Partial<HAProxyAction>): Promise<boolean> {
    try {
      const payload = {
        action: {
          type: updates.type,
          backend: updates.backend,
          condition: updates.condition,
          value: updates.value,
          enabled: updates.enabled !== false ? '1' : '0'
        }
      };
      
      const response = await this.client.post(`/haproxy/settings/setAction/${uuid}`, payload);
      if (response.result !== 'saved') {
        throw new Error('Failed to save action updates');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to update HAProxy action: ${error}`);
    }
  }

  async deleteAction(uuid: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/haproxy/settings/delAction/${uuid}`);
      if (response.result !== 'deleted') {
        throw new Error('Failed to delete action');
      }
      
      await this.reconfigure();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete HAProxy action: ${error}`);
    }
  }

  // Certificate Management Methods
  async listCertificates(): Promise<HAProxyCertificate[]> {
    try {
      const response = await this.client.get('/system/certificates/searchCertificate');
      if (!response.rows || !Array.isArray(response.rows)) {
        return [];
      }
      return response.rows.map((row: any) => ({
        uuid: row.uuid,
        name: row.descr,
        type: row.method,
        cn: row.dn?.CN,
        san: row.altnames ? row.altnames.split(',') : []
      }));
    } catch (error) {
      throw new Error(`Failed to list certificates: ${error}`);
    }
  }

  async createCertificate(cert: Omit<HAProxyCertificate, 'uuid'>): Promise<{ uuid: string }> {
    try {
      const payload = {
        cert: {
          descr: cert.name,
          method: cert.type
        }
      };

      if (cert.type === 'selfsigned') {
        Object.assign(payload.cert, {
          keylen: '2048',
          digest_alg: 'sha256',
          lifetime: '825',
          dn_commonname: cert.cn || cert.name,
          dn_country: 'US',
          dn_state: 'State',
          dn_city: 'City',
          dn_organization: 'Organization'
        });

        if (cert.san && cert.san.length > 0) {
          (payload.cert as any).altnames = cert.san.join(',');
        }
      } else if (cert.type === 'import') {
        Object.assign(payload.cert, {
          crt: cert.certificate,
          prv: cert.key,
          ca: cert.ca
        });
      }

      const response = await this.client.post('/system/certificates/addCertificate', payload);
      if (!response.uuid) {
        throw new Error('No UUID returned from create certificate');
      }
      
      return { uuid: response.uuid };
    } catch (error) {
      throw new Error(`Failed to create certificate: ${error}`);
    }
  }

  // Stats Methods
  async getStats(): Promise<HAProxyStats> {
    try {
      const response = await this.client.get('/haproxy/stats/show');
      return this.parseStats(response);
    } catch (error) {
      throw new Error(`Failed to get HAProxy stats: ${error}`);
    }
  }

  async getBackendHealth(backendName: string): Promise<any> {
    try {
      const stats = await this.getStats();
      return stats.backends[backendName]?.health || {};
    } catch (error) {
      throw new Error(`Failed to get backend health: ${error}`);
    }
  }

  // Helper Methods
  private parseBackend(data: any): HAProxyBackend {
    return {
      uuid: data.uuid,
      name: data.name,
      mode: data.mode || 'http',
      balance: data.algorithm || 'roundrobin',
      description: data.description,
      enabled: data.enabled === '1',
      servers: [],
      healthCheck: data.healthCheckEnabled === '1' ? {
        type: data.healthCheck,
        interval: parseInt(data.healthCheckInterval) || undefined,
        timeout: parseInt(data.healthCheckTimeout) || undefined
      } : undefined
    };
  }

  private parseFrontend(data: any): HAProxyFrontend {
    return {
      uuid: data.uuid,
      name: data.name,
      bind: data.bind || '',
      mode: data.mode || 'http',
      backend: data.defaultBackend || '',
      description: data.description,
      enabled: data.enabled === '1',
      acls: [],
      actions: [],
      bindOptions: {
        ssl: data.ssl === '1',
        certificates: data.certificates ? data.certificates.split(',') : []
      }
    };
  }

  private buildBackendPayload(backend: HAProxyBackend): any {
    return {
      backend: {
        name: backend.name,
        mode: backend.mode,
        algorithm: backend.balance,
        description: backend.description || '',
        enabled: backend.enabled !== false ? '1' : '0',
        healthCheckEnabled: backend.healthCheck ? '1' : '0',
        healthCheck: backend.healthCheck?.type || '',
        healthCheckInterval: backend.healthCheck?.interval?.toString() || '',
        healthCheckTimeout: backend.healthCheck?.timeout?.toString() || ''
      }
    };
  }

  private buildServerPayload(server: HAProxyServer): any {
    return {
      server: {
        name: server.name,
        address: server.address,
        port: server.port.toString(),
        ssl: server.ssl ? '1' : '0',
        sslVerify: server.verify || 'none',
        weight: (server.weight || 1).toString(),
        backup: server.backup ? '1' : '0',
        enabled: server.enabled !== false ? '1' : '0'
      }
    };
  }

  private buildFrontendPayload(frontend: HAProxyFrontend): any {
    const payload: any = {
      frontend: {
        name: frontend.name,
        bind: frontend.bind,
        mode: frontend.mode,
        defaultBackend: frontend.backend,
        description: frontend.description || '',
        enabled: frontend.enabled !== false ? '1' : '0'
      }
    };

    if (frontend.bindOptions?.ssl) {
      payload.frontend.ssl = '1';
      if (frontend.bindOptions.certificates && frontend.bindOptions.certificates.length > 0) {
        payload.frontend.certificates = frontend.bindOptions.certificates.join(',');
      }
    }

    return payload;
  }

  private parseStats(data: any): HAProxyStats {
    const stats: HAProxyStats = {
      frontends: {},
      backends: {}
    };

    // Parse the stats data from HAProxy
    // This would need to be implemented based on the actual response format
    // For now, returning a basic structure
    if (data.stats) {
      // Parse frontend stats
      if (data.stats.frontends) {
        for (const [name, frontendData] of Object.entries(data.stats.frontends)) {
          stats.frontends[name] = {
            status: (frontendData as any).status || 'unknown',
            sessions: (frontendData as any).scur || 0,
            bytesIn: (frontendData as any).bin || 0,
            bytesOut: (frontendData as any).bout || 0,
            requestRate: (frontendData as any).req_rate || 0,
            errorRate: (frontendData as any).ereq || 0
          };
        }
      }

      // Parse backend stats
      if (data.stats.backends) {
        for (const [name, backendData] of Object.entries(data.stats.backends)) {
          const backend = backendData as any;
          stats.backends[name] = {
            status: backend.status || 'unknown',
            activeServers: backend.act || 0,
            backupServers: backend.bck || 0,
            sessions: backend.scur || 0,
            queuedRequests: backend.qcur || 0,
            health: {}
          };

          // Parse server health
          if (backend.servers) {
            for (const [serverName, serverData] of Object.entries(backend.servers)) {
              const server = serverData as any;
              stats.backends[name].health[serverName] = {
                status: server.status === 'UP' ? 'up' : server.status === 'DOWN' ? 'down' : 'maint',
                lastCheck: server.check_status || '',
                weight: server.weight || 0,
                checksPassed: server.chkpass || 0,
                checksFailed: server.chkfail || 0
              };
            }
          }
        }
      }
    }

    return stats;
  }
}