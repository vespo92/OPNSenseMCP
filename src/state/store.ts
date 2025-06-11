import { promises as fs } from 'fs';
import { join } from 'path';
import { Resource, ResourceState } from '../resources/base.js';

/**
 * State entry for a resource
 */
export interface StateEntry {
  id: string;
  type: string;
  name: string;
  state: ResourceState;
  properties: Record<string, any>;
  outputs: Record<string, any>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
  dependencies: string[];
}

/**
 * Deployment state
 */
export interface DeploymentState {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  resources: Record<string, StateEntry>;
  checkpoints: Checkpoint[];
}

/**
 * Checkpoint for rollback
 */
export interface Checkpoint {
  id: string;
  timestamp: string;
  description: string;
  state: Record<string, StateEntry>;
}

/**
 * State store options
 */
export interface StateStoreOptions {
  directory?: string;
  format?: 'json' | 'yaml';
  encryption?: {
    enabled: boolean;
    key?: string;
  };
}

/**
 * Resource State Store - Manages persistent state for deployments
 */
export class ResourceStateStore {
  private state: Map<string, DeploymentState> = new Map();
  private options: Required<StateStoreOptions>;
  
  constructor(options: StateStoreOptions = {}) {
    this.options = {
      directory: options.directory || './state',
      format: options.format || 'json',
      encryption: options.encryption || { enabled: false }
    };
  }

  /**
   * Initialize the state store
   */
  async initialize(): Promise<void> {
    // Ensure state directory exists
    try {
      await fs.access(this.options.directory);
    } catch {
      await fs.mkdir(this.options.directory, { recursive: true });
    }
  }

  /**
   * Load deployment state from disk
   */
  async loadDeployment(deploymentId: string): Promise<DeploymentState | null> {
    try {
      const filePath = this.getStateFilePath(deploymentId);
      const data = await fs.readFile(filePath, 'utf-8');
      
      // TODO: Add decryption if encryption is enabled
      
      const state = JSON.parse(data) as DeploymentState;
      this.state.set(deploymentId, state);
      return state;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Save deployment state to disk
   */
  async saveDeployment(deployment: DeploymentState): Promise<void> {
    const filePath = this.getStateFilePath(deployment.id);
    
    // Update timestamp
    deployment.updatedAt = new Date().toISOString();
    deployment.version++;
    
    // TODO: Add encryption if enabled
    
    const data = JSON.stringify(deployment, null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
    
    // Update in-memory cache
    this.state.set(deployment.id, deployment);
  }

  /**
   * Create a new deployment
   */
  async createDeployment(id: string, name: string): Promise<DeploymentState> {
    const deployment: DeploymentState = {
      id,
      name,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resources: {},
      checkpoints: []
    };
    
    await this.saveDeployment(deployment);
    return deployment;
  }

  /**
   * Update resource state
   */
  async updateResourceState(
    deploymentId: string,
    resource: Resource
  ): Promise<void> {
    const deployment = await this.getOrCreateDeployment(deploymentId);
    
    deployment.resources[resource.id] = {
      id: resource.id,
      type: resource.type,
      name: resource.name,
      state: resource.state,
      properties: resource.properties,
      outputs: resource.outputs,
      metadata: resource.metadata,
      dependencies: resource.dependencies
    };
    
    await this.saveDeployment(deployment);
  }

  /**
   * Update multiple resource states
   */
  async updateResourceStates(
    deploymentId: string,
    resources: Resource[]
  ): Promise<void> {
    const deployment = await this.getOrCreateDeployment(deploymentId);
    
    for (const resource of resources) {
      deployment.resources[resource.id] = {
        id: resource.id,
        type: resource.type,
        name: resource.name,
        state: resource.state,
        properties: resource.properties,
        outputs: resource.outputs,
        metadata: resource.metadata,
        dependencies: resource.dependencies
      };
    }
    
    await this.saveDeployment(deployment);
  }

  /**
   * Get resource state
   */
  async getResourceState(
    deploymentId: string,
    resourceId: string
  ): Promise<StateEntry | null> {
    const deployment = await this.loadDeployment(deploymentId);
    if (!deployment) return null;
    
    return deployment.resources[resourceId] || null;
  }

  /**
   * Remove resource from state
   */
  async removeResourceState(
    deploymentId: string,
    resourceId: string
  ): Promise<void> {
    const deployment = await this.loadDeployment(deploymentId);
    if (!deployment) return;
    
    delete deployment.resources[resourceId];
    await this.saveDeployment(deployment);
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    deploymentId: string,
    description: string
  ): Promise<Checkpoint> {
    const deployment = await this.getOrCreateDeployment(deploymentId);
    
    const checkpoint: Checkpoint = {
      id: `checkpoint-${Date.now()}`,
      timestamp: new Date().toISOString(),
      description,
      state: JSON.parse(JSON.stringify(deployment.resources)) // Deep copy
    };
    
    deployment.checkpoints.push(checkpoint);
    
    // Keep only last 10 checkpoints
    if (deployment.checkpoints.length > 10) {
      deployment.checkpoints = deployment.checkpoints.slice(-10);
    }
    
    await this.saveDeployment(deployment);
    return checkpoint;
  }

  /**
   * Rollback to checkpoint
   */
  async rollbackToCheckpoint(
    deploymentId: string,
    checkpointId: string
  ): Promise<void> {
    const deployment = await this.loadDeployment(deploymentId);
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);
    
    const checkpoint = deployment.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint ${checkpointId} not found`);
    
    // Create a rollback checkpoint before applying
    await this.createCheckpoint(deploymentId, `Rollback to ${checkpointId}`);
    
    // Restore state from checkpoint
    deployment.resources = JSON.parse(JSON.stringify(checkpoint.state));
    
    await this.saveDeployment(deployment);
  }

  /**
   * List all deployments
   */
  async listDeployments(): Promise<string[]> {
    const files = await fs.readdir(this.options.directory);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    const filePath = this.getStateFilePath(deploymentId);
    
    try {
      await fs.unlink(filePath);
      this.state.delete(deploymentId);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get deployment summary
   */
  async getDeploymentSummary(deploymentId: string): Promise<any> {
    const deployment = await this.loadDeployment(deploymentId);
    if (!deployment) return null;
    
    const resourcesByType: Record<string, number> = {};
    const resourcesByState: Record<string, number> = {};
    
    for (const resource of Object.values(deployment.resources)) {
      // Count by type
      resourcesByType[resource.type] = (resourcesByType[resource.type] || 0) + 1;
      
      // Count by state
      resourcesByState[resource.state] = (resourcesByState[resource.state] || 0) + 1;
    }
    
    return {
      id: deployment.id,
      name: deployment.name,
      version: deployment.version,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      totalResources: Object.keys(deployment.resources).length,
      resourcesByType,
      resourcesByState,
      checkpoints: deployment.checkpoints.length
    };
  }

  /**
   * Export deployment state
   */
  async exportDeployment(deploymentId: string): Promise<string> {
    const deployment = await this.loadDeployment(deploymentId);
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);
    
    return JSON.stringify(deployment, null, 2);
  }

  /**
   * Import deployment state
   */
  async importDeployment(data: string): Promise<DeploymentState> {
    const deployment = JSON.parse(data) as DeploymentState;
    
    // Validate structure
    if (!deployment.id || !deployment.name || !deployment.resources) {
      throw new Error('Invalid deployment data');
    }
    
    // Save imported deployment
    await this.saveDeployment(deployment);
    return deployment;
  }

  /**
   * Get or create deployment
   */
  private async getOrCreateDeployment(deploymentId: string): Promise<DeploymentState> {
    let deployment = await this.loadDeployment(deploymentId);
    if (!deployment) {
      deployment = await this.createDeployment(deploymentId, deploymentId);
    }
    return deployment;
  }

  /**
   * Get state file path
   */
  private getStateFilePath(deploymentId: string): string {
    return join(this.options.directory, `${deploymentId}.json`);
  }

  /**
   * Lock deployment for concurrent access protection
   */
  async lockDeployment(deploymentId: string): Promise<() => Promise<void>> {
    // Simple file-based locking
    const lockPath = join(this.options.directory, `${deploymentId}.lock`);
    
    // Try to create lock file
    const lockFd = await fs.open(lockPath, 'wx');
    
    // Return unlock function
    return async () => {
      await lockFd.close();
      await fs.unlink(lockPath);
    };
  }
}

/**
 * Global state store instance
 */
export const stateStore = new ResourceStateStore();
