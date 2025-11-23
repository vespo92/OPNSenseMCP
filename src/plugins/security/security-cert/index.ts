/**
 * Certificate Management Plugin
 *
 * Manages SSL/TLS certificates with Let's Encrypt support
 */

import { BasePlugin } from '../../../core/plugin-system/base-plugin.js';
import { PluginCategory, PluginMetadata, MCPTool, MCPResource, MCPPrompt } from '../../../core/types/plugin.js';
import { EventType, EventSeverity } from '../../../core/types/events.js';

export default class CertificatePlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'security-cert',
    name: 'Certificate Management Plugin',
    version: '1.0.0',
    description: "SSL/TLS certificate management with Let's Encrypt support",
    category: PluginCategory.SECURITY,
    author: 'OPNsense MCP Team',
    enabled: true,
  };

  private expiryMonitorTimer?: NodeJS.Timeout;

  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing Certificate Management Plugin');
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting Certificate Management Plugin');

    if (this.context.config.enableExpiryMonitoring) {
      this.startExpiryMonitoring();
    }
  }

  protected async onStop(): Promise<void> {
    if (this.expiryMonitorTimer) {
      clearInterval(this.expiryMonitorTimer);
    }
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'cert_list',
        description: 'List all certificates',
        inputSchema: { type: 'object', properties: {} },
        handler: this.listCertificates.bind(this),
      },
      {
        name: 'cert_get',
        description: 'Get certificate details',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'Certificate UUID' },
          },
          required: ['uuid'],
        },
        handler: this.getCertificate.bind(this),
      },
      {
        name: 'cert_import',
        description: 'Import a certificate',
        inputSchema: {
          type: 'object',
          properties: {
            certificate: { type: 'string', description: 'PEM-encoded certificate' },
            privateKey: { type: 'string', description: 'PEM-encoded private key' },
            description: { type: 'string', description: 'Certificate description' },
          },
          required: ['certificate', 'privateKey', 'description'],
        },
        handler: this.importCertificate.bind(this),
      },
      {
        name: 'cert_delete',
        description: 'Delete a certificate',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'Certificate UUID' },
          },
          required: ['uuid'],
        },
        handler: this.deleteCertificate.bind(this),
      },
      {
        name: 'cert_letsencrypt_request',
        description: 'Request a Let\'s Encrypt certificate',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Domain name' },
            email: { type: 'string', description: 'Contact email' },
            challengeType: { type: 'string', enum: ['http-01', 'dns-01'] },
          },
          required: ['domain', 'email'],
        },
        handler: this.requestLetsEncrypt.bind(this),
      },
      {
        name: 'cert_letsencrypt_renew',
        description: 'Renew a Let\'s Encrypt certificate',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'Certificate UUID' },
          },
          required: ['uuid'],
        },
        handler: this.renewLetsEncrypt.bind(this),
      },
      {
        name: 'cert_check_expiry',
        description: 'Check certificate expiration status',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'Certificate UUID (optional, checks all if omitted)' },
            warningDays: { type: 'number', description: 'Days before expiry to warn' },
          },
        },
        handler: this.checkExpiry.bind(this),
      },
      {
        name: 'cert_generate_csr',
        description: 'Generate a Certificate Signing Request',
        inputSchema: {
          type: 'object',
          properties: {
            commonName: { type: 'string', description: 'Common name (CN)' },
            organization: { type: 'string', description: 'Organization (O)' },
            country: { type: 'string', description: 'Country (C)' },
          },
          required: ['commonName'],
        },
        handler: this.generateCSR.bind(this),
      },
    ];
  }

  getResources(): MCPResource[] {
    return [
      {
        uri: 'security://certificates/list',
        name: 'Certificates',
        description: 'All installed certificates',
        handler: async () => ({
          content: JSON.stringify(await this.listCertificates({}), null, 2),
        }),
      },
      {
        uri: 'security://certificates/expiring',
        name: 'Expiring Certificates',
        description: 'Certificates expiring soon',
        handler: async () => ({
          content: JSON.stringify(await this.checkExpiry({}), null, 2),
        }),
      },
    ];
  }

  getPrompts(): MCPPrompt[] {
    return [];
  }

  getDependencies(): string[] {
    return [];
  }

  private async listCertificates(params: {}): Promise<any> {
    try {
      const response = await this.api.get('/api/trust/cert/search');

      return {
        certificates: response.data?.rows || [],
        count: response.data?.rowCount || 0,
      };
    } catch (error) {
      this.logger.error('Error listing certificates:', error);
      throw error;
    }
  }

  private async getCertificate(params: { uuid: string }): Promise<any> {
    try {
      const response = await this.api.get(`/api/trust/cert/get/${params.uuid}`);

      return response.data?.cert || {};
    } catch (error) {
      this.logger.error(`Error getting certificate ${params.uuid}:`, error);
      throw error;
    }
  }

  private async importCertificate(params: {
    certificate: string;
    privateKey: string;
    description: string;
  }): Promise<any> {
    try {
      const response = await this.api.post('/api/trust/cert/import', {
        cert: {
          crt: params.certificate,
          prv: params.privateKey,
          descr: params.description,
        },
      });

      if (response.data?.result === 'saved') {
        this.emit('cert.imported', {
          uuid: response.data.uuid,
          description: params.description,
        });

        return {
          success: true,
          uuid: response.data.uuid,
          message: 'Certificate imported successfully',
        };
      }

      throw new Error('Failed to import certificate');
    } catch (error) {
      this.logger.error('Error importing certificate:', error);
      throw error;
    }
  }

  private async deleteCertificate(params: { uuid: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/trust/cert/del/${params.uuid}`);

      if (response.data?.result === 'deleted') {
        this.emit('cert.deleted', { uuid: params.uuid });

        return {
          success: true,
          message: 'Certificate deleted successfully',
        };
      }

      throw new Error('Failed to delete certificate');
    } catch (error) {
      this.logger.error(`Error deleting certificate ${params.uuid}:`, error);
      throw error;
    }
  }

  private async requestLetsEncrypt(params: {
    domain: string;
    email: string;
    challengeType?: string;
  }): Promise<any> {
    try {
      const response = await this.api.post('/api/letsencrypt/acme/request', {
        domain: params.domain,
        email: params.email,
        challenge: params.challengeType || 'http-01',
      });

      this.emit('cert.letsencrypt.requested', {
        domain: params.domain,
        email: params.email,
      });

      return {
        success: true,
        message: `Let's Encrypt certificate requested for ${params.domain}`,
        status: response.data,
      };
    } catch (error) {
      this.logger.error('Error requesting Let\'s Encrypt certificate:', error);
      throw error;
    }
  }

  private async renewLetsEncrypt(params: { uuid: string }): Promise<any> {
    try {
      const response = await this.api.post(`/api/letsencrypt/acme/renew/${params.uuid}`);

      this.emit('cert.letsencrypt.renewed', { uuid: params.uuid });

      return {
        success: true,
        message: 'Certificate renewal initiated',
        status: response.data,
      };
    } catch (error) {
      this.logger.error(`Error renewing certificate ${params.uuid}:`, error);
      throw error;
    }
  }

  private async checkExpiry(params: { uuid?: string; warningDays?: number }): Promise<any> {
    try {
      const warningDays = params.warningDays || this.context.config.expiryWarningDays || 30;
      const now = new Date();
      const warningDate = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);

      const certs = params.uuid
        ? [await this.getCertificate({ uuid: params.uuid })]
        : (await this.listCertificates({})).certificates;

      const expiring: any[] = [];
      const expired: any[] = [];

      for (const cert of certs) {
        if (cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);

          if (expiryDate < now) {
            expired.push({ ...cert, daysUntilExpiry: -1 });

            this.context.eventBus.createEvent(
              EventType.CERT_EXPIRED,
              this.metadata.id,
              { uuid: cert.uuid, description: cert.descr },
              EventSeverity.CRITICAL,
              'security'
            );
          } else if (expiryDate < warningDate) {
            const daysUntilExpiry = Math.floor(
              (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            );
            expiring.push({ ...cert, daysUntilExpiry });

            this.context.eventBus.createEvent(
              EventType.CERT_EXPIRING,
              this.metadata.id,
              { uuid: cert.uuid, description: cert.descr, daysUntilExpiry },
              EventSeverity.WARNING,
              'security'
            );
          }
        }
      }

      return {
        expiring,
        expired,
        expiringCount: expiring.length,
        expiredCount: expired.length,
        warningDays,
      };
    } catch (error) {
      this.logger.error('Error checking certificate expiry:', error);
      throw error;
    }
  }

  private async generateCSR(params: {
    commonName: string;
    organization?: string;
    country?: string;
  }): Promise<any> {
    try {
      const response = await this.api.post('/api/trust/cert/generateCSR', {
        csr: {
          CN: params.commonName,
          O: params.organization || '',
          C: params.country || '',
        },
      });

      return {
        success: true,
        csr: response.data?.csr,
        privateKey: response.data?.privateKey,
      };
    } catch (error) {
      this.logger.error('Error generating CSR:', error);
      throw error;
    }
  }

  private startExpiryMonitoring(): void {
    const interval = this.context.config.monitorInterval || 86400000; // 24 hours

    this.expiryMonitorTimer = setInterval(async () => {
      try {
        await this.checkExpiry({});
      } catch (error) {
        this.logger.error('Error in certificate expiry monitoring:', error);
      }
    }, interval);

    this.logger.info(`Started certificate expiry monitoring (interval: ${interval}ms)`);
  }
}
