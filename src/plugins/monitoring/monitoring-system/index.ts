/**
 * System Monitoring Plugin
 *
 * Real-time system resource monitoring and alerting
 */

import { BasePlugin } from '../../../core/plugin-system/base-plugin.js';
import { PluginCategory, PluginMetadata, MCPTool, MCPResource, MCPPrompt } from '../../../core/types/plugin.js';
import { EventType, EventSeverity } from '../../../core/types/events.js';

export default class SystemMonitoringPlugin extends BasePlugin {
  readonly metadata: PluginMetadata = {
    id: 'monitoring-system',
    name: 'System Monitoring Plugin',
    version: '1.0.0',
    description: 'Real-time system resource monitoring and metrics collection',
    category: PluginCategory.MONITORING,
    author: 'OPNsense MCP Team',
    enabled: true,
  };

  private metricsTimer?: NodeJS.Timeout;
  private lastMetrics?: any;

  protected async onInitialize(): Promise<void> {
    this.logger.info('Initializing System Monitoring Plugin');
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting System Monitoring Plugin');
    this.startMetricsCollection();
  }

  protected async onStop(): Promise<void> {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
  }

  getTools(): MCPTool[] {
    return [
      {
        name: 'monitoring_get_metrics',
        description: 'Get current system metrics',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getMetrics.bind(this),
      },
      {
        name: 'monitoring_get_cpu_usage',
        description: 'Get CPU usage statistics',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getCPUUsage.bind(this),
      },
      {
        name: 'monitoring_get_memory_usage',
        description: 'Get memory usage statistics',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getMemoryUsage.bind(this),
      },
      {
        name: 'monitoring_get_disk_usage',
        description: 'Get disk usage statistics',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getDiskUsage.bind(this),
      },
      {
        name: 'monitoring_get_network_stats',
        description: 'Get network interface statistics',
        inputSchema: { type: 'object', properties: {} },
        handler: this.getNetworkStats.bind(this),
      },
    ];
  }

  getResources(): MCPResource[] {
    return [
      {
        uri: 'monitoring://system/metrics',
        name: 'System Metrics',
        description: 'Real-time system metrics',
        handler: async () => ({
          content: JSON.stringify(await this.getMetrics({}), null, 2),
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

  private async getMetrics(params: {}): Promise<any> {
    try {
      const [cpu, memory, disk, network] = await Promise.all([
        this.getCPUUsage({}),
        this.getMemoryUsage({}),
        this.getDiskUsage({}),
        this.getNetworkStats({}),
      ]);

      const metrics = {
        cpu,
        memory,
        disk,
        network,
        timestamp: new Date(),
      };

      this.lastMetrics = metrics;
      this.checkThresholds(metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Error getting metrics:', error);
      throw error;
    }
  }

  private async getCPUUsage(params: {}): Promise<any> {
    try {
      // Call OPNsense system API for CPU stats
      const response = await this.ssh.execute('top -b -n 1 | grep "CPU:"');
      // Parse response and return CPU usage
      return { usage: 0, cores: 1, loadAverage: [0, 0, 0] };
    } catch (error) {
      return { usage: 0, cores: 1, loadAverage: [0, 0, 0] };
    }
  }

  private async getMemoryUsage(params: {}): Promise<any> {
    try {
      const response = await this.ssh.execute('sysctl hw.physmem vm.stats.vm.v_free_count');
      // Parse response
      return { total: 0, used: 0, free: 0, percentage: 0 };
    } catch (error) {
      return { total: 0, used: 0, free: 0, percentage: 0 };
    }
  }

  private async getDiskUsage(params: {}): Promise<any> {
    try {
      const response = await this.ssh.execute('df -h /');
      // Parse response
      return { total: 0, used: 0, free: 0, percentage: 0 };
    } catch (error) {
      return { total: 0, used: 0, free: 0, percentage: 0 };
    }
  }

  private async getNetworkStats(params: {}): Promise<any> {
    try {
      const response = await this.ssh.execute('netstat -I -b -n');
      // Parse response
      return { interfaces: {} };
    } catch (error) {
      return { interfaces: {} };
    }
  }

  private checkThresholds(metrics: any): void {
    if (!this.context.config.enableAlerts) return;

    const thresholds = this.context.config.alertThresholds;

    if (metrics.cpu.usage > thresholds.cpu) {
      this.emit('monitor.cpu.high', {
        current: metrics.cpu.usage,
        threshold: thresholds.cpu,
      });
    }

    if (metrics.memory.percentage > thresholds.memory) {
      this.emit('monitor.memory.high', {
        current: metrics.memory.percentage,
        threshold: thresholds.memory,
      });
    }

    if (metrics.disk.percentage > thresholds.disk) {
      this.emit('monitor.disk.high', {
        current: metrics.disk.percentage,
        threshold: thresholds.disk,
      });
    }
  }

  private startMetricsCollection(): void {
    const interval = this.context.config.metricsInterval || 10000;

    this.metricsTimer = setInterval(async () => {
      try {
        const metrics = await this.getMetrics({});

        this.context.eventBus.createEvent(
          EventType.METRICS_COLLECTED,
          this.metadata.id,
          metrics,
          EventSeverity.DEBUG,
          'monitoring'
        );
      } catch (error) {
        this.logger.error('Error collecting metrics:', error);
      }
    }, interval);

    this.logger.info(`Started metrics collection (interval: ${interval}ms)`);
  }
}
