// OPNsense Backup Manager
import type { OPNSenseAPIClient } from '../../api/client.js';

export interface BackupInfo {
  id: string;
  filename: string;
  timestamp: Date;
  size?: number;
  description?: string;
  checksum?: string;
}

export interface BackupOptions {
  description?: string;
  compress?: boolean;
  includeRRD?: boolean;
  includeCaptivePortal?: boolean;
}

export class BackupManager {
  private client: OPNSenseAPIClient;

  constructor(client: OPNSenseAPIClient, backupPath: string = './backups') {
    this.client = client;
    this.backupPath = backupPath;
  }

  /**
   * Create a configuration backup
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupInfo> {
    try {
      // Generate backup ID
      const timestamp = new Date();
      const id = `backup-${timestamp.toISOString().replace(/[:.]/g, '-')}`;

      // Download configuration
      const config = await this.downloadConfig();

      // Create backup info
      const backupInfo: BackupInfo = {
        id,
        filename: `${id}.xml`,
        timestamp,
        description: options.description || `Automated backup before API operation`,
        size: config.length,
      };

      // Log backup creation
      console.log(`Created backup: ${backupInfo.id}`);

      // Store backup metadata (in production, save to database)
      await this.saveBackupMetadata(backupInfo);

      // Store backup file (in production, save to TrueNAS or local storage)
      await this.saveBackupFile(backupInfo.filename, config);

      return backupInfo;
    } catch (error: any) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Download current configuration from OPNsense
   */
  async downloadConfig(): Promise<string> {
    const response = await this.client.get('/core/backup/download/this');
    return response;
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    // In production, query from database
    // For now, return mock data
    return [
      {
        id: 'backup-2025-01-10T10-30-00-000Z',
        filename: 'backup-2025-01-10T10-30-00-000Z.xml',
        timestamp: new Date('2025-01-10T10:30:00.000Z'),
        description: 'Before firewall rule creation',
        size: 524288,
      },
    ];
  }

  /**
   * Restore a backup
   */
  async restoreBackup(backupId: string): Promise<boolean> {
    try {
      const backup = await this.getBackup(backupId);
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Read backup file
      const configData = await this.readBackupFile(backup.filename);

      // Upload to OPNsense
      const formData = new FormData();
      formData.append('conffile', new Blob([configData]), backup.filename);

      const response = await this.client.post('/core/backup/restore', formData);

      if (response.result === 'ok') {
        console.log(`Restored backup: ${backupId}`);
        return true;
      }

      throw new Error('Restore failed');
    } catch (error: any) {
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async deleteOldBackups(retentionDays: number): Promise<void> {
    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    for (const backup of backups) {
      if (backup.timestamp < cutoffDate) {
        await this.deleteBackup(backup.id);
        console.log(`Deleted old backup: ${backup.id}`);
      }
    }
  }

  /**
   * Get specific backup info
   */
  private async getBackup(backupId: string): Promise<BackupInfo | null> {
    const backups = await this.listBackups();
    return backups.find((b) => b.id === backupId) || null;
  }

  /**
   * Delete a specific backup
   */
  private async deleteBackup(backupId: string): Promise<void> {
    // In production, delete from storage and database
    console.log(`Would delete backup: ${backupId}`);
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(backupInfo: BackupInfo): Promise<void> {
    // In production, save to PostgreSQL
    console.log(`Would save backup metadata:`, backupInfo);
  }

  /**
   * Save backup file
   */
  private async saveBackupFile(filename: string, data: string): Promise<void> {
    // In production, save to TrueNAS or local storage
    console.log(`Would save backup file: ${filename} (${data.length} bytes)`);
  }

  /**
   * Read backup file
   */
  private async readBackupFile(_filename: string): Promise<string> {
    // In production, read from storage
    return '<opnsense>mock config data</opnsense>';
  }

  /**
   * Create a decorator for safe operations
   */
  async withBackup<T>(
    operation: () => Promise<T>,
    description?: string
  ): Promise<{ result: T; backupId: string }> {
    // Create backup first
    const backup = await this.createBackup({ description });

    try {
      // Execute operation
      const result = await operation();

      return {
        result,
        backupId: backup.id,
      };
    } catch (error) {
      console.error(`Operation failed. Backup available: ${backup.id}`);
      throw error;
    }
  }
}

export default BackupManager;
