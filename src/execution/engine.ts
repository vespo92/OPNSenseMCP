/**
 * Deployment Execution Engine
 * Executes deployment plans with rollback support
 */

import { DeploymentPlan, ExecutionWave, ResourceChange } from '../deployment/planner';
import { IaCResource, ResourceStatus } from '../resources/base';
import { OPNSenseAPIClient } from '../api/client';

export interface ExecutionResult {
  success: boolean;
  planId: string;
  executedChanges: ExecutedChange[];
  failedChanges?: FailedChange[];
  rollbackPerformed: boolean;
  duration: number;
  logs: ExecutionLog[];
}

export interface ExecutedChange {
  changeId: string;
  resourceId: string;
  type: string;
  status: 'success' | 'failed' | 'skipped';
  outputs?: Record<string, any>;
  duration: number;
}

export interface FailedChange {
  changeId: string;
  resourceId: string;
  error: string;
  canRetry: boolean;
}

export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionOptions {
  dryRun?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
  continueOnError?: boolean;
  force?: boolean;
  progressCallback?: (progress: ExecutionProgress) => void;
}

export interface ExecutionProgress {
  totalChanges: number;
  completedChanges: number;
  currentWave: number;
  totalWaves: number;
  currentResource?: string;
  estimatedTimeRemaining: number;
}

export class ExecutionEngine {
  private client: OPNSenseAPIClient;
  private logs: ExecutionLog[] = [];
  private checkpoints: Map<string, any> = new Map();

  constructor(client: OPNSenseAPIClient) {
    this.client = client;
  }

  /**
   * Execute a deployment plan
   */
  async execute(
    plan: DeploymentPlan,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executedChanges: ExecutedChange[] = [];
    const failedChanges: FailedChange[] = [];
    let rollbackPerformed = false;

    this.log('info', `Starting execution of plan: ${plan.id}`);

    try {
      // Execute each wave
      for (let i = 0; i < plan.executionWaves.length; i++) {
        const wave = plan.executionWaves[i];
        
        this.log('info', `Executing wave ${wave.wave} with ${wave.changes.length} changes`);
        
        if (options.progressCallback) {
          options.progressCallback({
            totalChanges: this.getTotalChanges(plan),
            completedChanges: executedChanges.length,
            currentWave: wave.wave,
            totalWaves: plan.executionWaves.length,
            estimatedTimeRemaining: this.calculateRemainingTime(plan, i)
          });
        }

        const waveResults = await this.executeWave(wave, options);
        executedChanges.push(...waveResults.executed);
        
        if (waveResults.failed.length > 0) {
          failedChanges.push(...waveResults.failed);
          
          if (!options.continueOnError) {
            this.log('error', 'Wave execution failed, initiating rollback');
            rollbackPerformed = await this.rollback(executedChanges);
            break;
          }
        }
        
        // Create checkpoint after successful wave
        this.createCheckpoint(wave.wave, executedChanges);
      }
    } catch (error: any) {
      this.log('error', `Execution failed: ${error.message}`);
      rollbackPerformed = await this.rollback(executedChanges);
    }

    const duration = Date.now() - startTime;
    
    return {
      success: failedChanges.length === 0 && !rollbackPerformed,
      planId: plan.id,
      executedChanges,
      failedChanges: failedChanges.length > 0 ? failedChanges : undefined,
      rollbackPerformed,
      duration,
      logs: this.logs
    };
  }

  /**
   * Execute a single wave of changes
   */
  private async executeWave(
    wave: ExecutionWave,
    options: ExecutionOptions
  ): Promise<{ executed: ExecutedChange[]; failed: FailedChange[] }> {
    const executed: ExecutedChange[] = [];
    const failed: FailedChange[] = [];

    if (options.parallel && options.maxConcurrency && options.maxConcurrency > 1) {
      // Parallel execution
      const chunks = this.chunkArray(wave.changes, options.maxConcurrency);
      
      for (const chunk of chunks) {
        const promises = chunk.map(change => 
          this.executeChange(change, options.dryRun || false)
        );
        
        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            executed.push(result.value);
          } else {
            failed.push({
              changeId: this.getChangeId(chunk[index]),
              resourceId: chunk[index].resource.id,
              error: result.reason.message,
              canRetry: true
            });
          }
        });
      }
    } else {
      // Sequential execution
      for (const change of wave.changes) {
        try {
          const result = await this.executeChange(change, options.dryRun || false);
          executed.push(result);
        } catch (error: any) {
          failed.push({
            changeId: this.getChangeId(change),
            resourceId: change.resource.id,
            error: error.message,
            canRetry: true
          });
          
          if (!options.continueOnError) {
            break;
          }
        }
      }
    }

    return { executed, failed };
  }

  /**
   * Execute a single resource change
   */
  private async executeChange(
    change: ResourceChange,
    dryRun: boolean
  ): Promise<ExecutedChange> {
    const startTime = Date.now();
    const changeId = this.getChangeId(change);
    
    this.log('info', `Executing ${change.type} for ${change.resource.id}`, {
      resourceId: change.resource.id,
      changeType: change.type
    });

    try {
      if (dryRun) {
        // Simulate execution
        await this.simulateDelay(1000);
        return {
          changeId,
          resourceId: change.resource.id,
          type: change.type,
          status: 'success',
          duration: Date.now() - startTime
        };
      }

      let outputs: Record<string, any> | undefined;

      switch (change.type) {
        case 'create':
          outputs = await this.createResource(change.resource);
          break;
        case 'update':
          outputs = await this.updateResource(change.resource, change.diff || []);
          break;
        case 'delete':
          await this.deleteResource(change.resource);
          break;
        case 'replace':
          await this.deleteResource(change.before!);
          outputs = await this.createResource(change.resource);
          break;
      }

      return {
        changeId,
        resourceId: change.resource.id,
        type: change.type,
        status: 'success',
        outputs,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      this.log('error', `Failed to execute ${change.type} for ${change.resource.id}: ${error.message}`, {
        resourceId: change.resource.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a resource
   */
  private async createResource(resource: IaCResource): Promise<Record<string, any>> {
    // Resource-specific creation logic would go here
    // This is a placeholder that would call the appropriate API
    const payload = resource.toAPIPayload();
    
    // Example for VLAN
    if (resource.type === 'opnsense:network:vlan') {
      const response = await this.client.post('/api/interfaces/vlan_settings/addItem', payload);
      resource.fromAPIResponse(response);
      return resource.getOutputs();
    }

    throw new Error(`Create not implemented for resource type: ${resource.type}`);
  }

  /**
   * Update a resource
   */
  private async updateResource(
    resource: IaCResource,
    diff: any[]
  ): Promise<Record<string, any>> {
    // Resource-specific update logic would go here
    const payload = resource.toAPIPayload();
    
    // Example for VLAN
    if (resource.type === 'opnsense:network:vlan') {
      const response = await this.client.post(
        `/api/interfaces/vlan_settings/setItem/${resource.id}`,
        payload
      );
      resource.fromAPIResponse(response);
      return resource.getOutputs();
    }

    throw new Error(`Update not implemented for resource type: ${resource.type}`);
  }

  /**
   * Delete a resource
   */
  private async deleteResource(resource: IaCResource): Promise<void> {
    // Resource-specific deletion logic would go here
    
    // Example for VLAN
    if (resource.type === 'opnsense:network:vlan') {
      await this.client.post(`/api/interfaces/vlan_settings/delItem/${resource.id}`, {});
      return;
    }

    throw new Error(`Delete not implemented for resource type: ${resource.type}`);
  }

  /**
   * Rollback executed changes
   */
  private async rollback(executedChanges: ExecutedChange[]): Promise<boolean> {
    this.log('warn', 'Starting rollback procedure');
    
    // Rollback in reverse order
    const reversedChanges = [...executedChanges].reverse();
    
    for (const change of reversedChanges) {
      try {
        this.log('info', `Rolling back ${change.type} for ${change.resourceId}`);
        
        // Rollback logic based on change type
        switch (change.type) {
          case 'create':
            // Delete the created resource
            // await this.deleteResource(...);
            break;
          case 'update':
            // Restore previous state
            // await this.updateResource(...);
            break;
          case 'delete':
            // Recreate the deleted resource
            // await this.createResource(...);
            break;
        }
      } catch (error: any) {
        this.log('error', `Failed to rollback ${change.resourceId}: ${error.message}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Create execution checkpoint
   */
  private createCheckpoint(waveNumber: number, executedChanges: ExecutedChange[]): void {
    const checkpointId = `wave-${waveNumber}`;
    this.checkpoints.set(checkpointId, {
      timestamp: new Date().toISOString(),
      executedChanges: [...executedChanges]
    });
  }

  /**
   * Utility functions
   */
  private getTotalChanges(plan: DeploymentPlan): number {
    return plan.executionWaves.reduce((total, wave) => total + wave.changes.length, 0);
  }

  private calculateRemainingTime(plan: DeploymentPlan, currentWaveIndex: number): number {
    return plan.executionWaves
      .slice(currentWaveIndex + 1)
      .reduce((total, wave) => total + wave.estimatedTime, 0);
  }

  private getChangeId(change: ResourceChange): string {
    return `${change.type}-${change.resource.id}-${Date.now()}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(level: ExecutionLog['level'], message: string, metadata?: Record<string, any>): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata
    });
  }
}
