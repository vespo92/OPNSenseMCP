# Monitoring Strategy - OPNSense MCP Server

## 🎯 Executive Summary

A comprehensive monitoring strategy for the OPNSense MCP Server covering:
- **Application Performance Monitoring (APM)**
- **Infrastructure Monitoring**
- **Security Monitoring**
- **Business Metrics**
- **Alerting & Incident Response**

## 📊 Monitoring Architecture

```
┌─────────────────────────────────────────────┐
│            Application Layer                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Metrics  │ │  Traces  │ │   Logs   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘   │
└───────┼────────────┼────────────┼──────────┘
        │            │            │
        └────────────┼────────────┘
                     │
          ┌──────────▼──────────┐
          │   OpenTelemetry     │
          │     Collector       │
          └──────────┬──────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼────┐    ┌────▼────┐    ┌────▼────┐
│Prometheus│    │  Jaeger │    │  Loki   │
└────┬────┘    └────┬────┘    └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
             ┌───────▼───────┐
             │    Grafana    │
             │  Dashboards   │
             └───────┬───────┘
                     │
             ┌───────▼───────┐
             │   Alerting    │
             │   Manager     │
             └───────────────┘
```

## 🔍 What to Monitor

### 1. Application Metrics

#### Key Performance Indicators (KPIs)
```typescript
// metrics.ts
export const applicationMetrics = {
  // Request metrics
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  }),
  
  // MCP tool metrics
  toolExecutionDuration: new Histogram({
    name: 'mcp_tool_execution_duration_seconds',
    help: 'Duration of MCP tool execution',
    labelNames: ['tool', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  }),
  
  // API client metrics
  apiCallDuration: new Histogram({
    name: 'opnsense_api_duration_seconds',
    help: 'Duration of OPNsense API calls',
    labelNames: ['endpoint', 'method', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
  }),
  
  // Cache metrics
  cacheHitRate: new Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate percentage',
    labelNames: ['cache_type']
  }),
  
  // Error metrics
  errorRate: new Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'severity']
  })
};
```

#### Golden Signals
| Signal | Metric | Target | Alert Threshold |
|--------|--------|--------|-----------------|
| **Latency** | P50, P95, P99 response times | P95 < 500ms | P95 > 1s |
| **Traffic** | Requests per second | Baseline ±20% | >200% baseline |
| **Errors** | Error rate | < 1% | > 5% |
| **Saturation** | CPU, Memory, Connections | < 80% | > 90% |

### 2. Infrastructure Metrics

#### System Resources
```yaml
# Node Exporter metrics
- node_cpu_seconds_total
- node_memory_MemAvailable_bytes
- node_filesystem_avail_bytes
- node_network_receive_bytes_total
- node_network_transmit_bytes_total
- node_load1, node_load5, node_load15
```

#### Container Metrics (if using Docker/K8s)
```yaml
# cAdvisor/Kubernetes metrics
- container_cpu_usage_seconds_total
- container_memory_usage_bytes
- container_network_receive_bytes_total
- container_fs_usage_bytes
- kube_pod_container_status_restarts_total
```

### 3. Business Metrics

```typescript
// business-metrics.ts
export const businessMetrics = {
  // Resource operations
  vlanOperations: new Counter({
    name: 'vlan_operations_total',
    help: 'Total VLAN operations',
    labelNames: ['operation', 'status']
  }),
  
  firewallRuleChanges: new Counter({
    name: 'firewall_rule_changes_total',
    help: 'Total firewall rule changes',
    labelNames: ['action', 'interface']
  }),
  
  // IaC deployments
  deploymentSuccess: new Counter({
    name: 'iac_deployments_successful_total',
    help: 'Successful IaC deployments'
  }),
  
  deploymentDuration: new Histogram({
    name: 'iac_deployment_duration_seconds',
    help: 'IaC deployment duration',
    buckets: [10, 30, 60, 120, 300, 600]
  }),
  
  // Backup operations
  backupSize: new Gauge({
    name: 'backup_size_bytes',
    help: 'Size of backups in bytes'
  }),
  
  lastBackupTimestamp: new Gauge({
    name: 'last_backup_timestamp',
    help: 'Timestamp of last successful backup'
  })
};
```

## 📈 Monitoring Implementation

### 1. OpenTelemetry Setup

```typescript
// telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: 'http://localhost:14268/api/traces',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new PrometheusExporter({
      port: 9090,
    }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

sdk.start();
```

### 2. Custom Metrics Collection

```typescript
// monitoring.ts
import { metrics } from './metrics';

export class MonitoringService {
  private metricsInterval: NodeJS.Timeout;
  
  start() {
    // Collect metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.collectApplicationMetrics();
      this.collectBusinessMetrics();
    }, 10000);
  }
  
  private async collectSystemMetrics() {
    const usage = process.memoryUsage();
    metrics.memoryUsage.set(usage.heapUsed / 1024 / 1024);
    
    const cpuUsage = process.cpuUsage();
    metrics.cpuUsage.set(cpuUsage.user / 1000000);
  }
  
  private async collectApplicationMetrics() {
    // Cache metrics
    const cacheStats = await this.cacheManager.getStats();
    metrics.cacheHitRate.set(
      { cache_type: 'memory' },
      cacheStats.hitRate
    );
    
    // Connection pool metrics
    const poolStats = this.apiClient.getPoolStats();
    metrics.activeConnections.set(poolStats.active);
    metrics.idleConnections.set(poolStats.idle);
  }
  
  trackRequest(method: string, path: string, statusCode: number, duration: number) {
    metrics.httpRequestDuration
      .labels(method, path, statusCode.toString())
      .observe(duration / 1000);
    
    metrics.httpRequestsTotal
      .labels(method, path, statusCode.toString())
      .inc();
  }
}
```

### 3. Distributed Tracing

```typescript
// tracing.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('opnsense-mcp-server');

export async function tracedOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(name);
  
  try {
    const result = await context.with(
      trace.setSpan(context.active(), span),
      operation
    );
    
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

// Usage example
async function createVlan(config: VlanConfig) {
  return tracedOperation('vlan.create', async () => {
    const span = trace.getActiveSpan();
    span?.setAttributes({
      'vlan.tag': config.tag,
      'vlan.interface': config.interface
    });
    
    // Operation logic
    const result = await this.apiClient.createVlan(config);
    
    span?.addEvent('vlan_created', {
      'vlan.uuid': result.uuid
    });
    
    return result;
  });
}
```

### 4. Structured Logging

```typescript
// logging.ts
import winston from 'winston';
import { LogtailTransport } from '@logtail/winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'opnsense-mcp',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    
    // File output
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    
    // Centralized logging
    new LogtailTransport({
      sourceToken: process.env.LOGTAIL_TOKEN
    })
  ]
});

// Correlation ID middleware
export function correlationMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || uuid();
  req.correlationId = correlationId;
  
  logger.defaultMeta.correlationId = correlationId;
  next();
}
```

## 📊 Dashboards

### 1. Main Operations Dashboard

```json
{
  "dashboard": {
    "title": "OPNSense MCP Operations",
    "panels": [
      {
        "title": "Request Rate",
        "query": "rate(http_requests_total[5m])",
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "query": "rate(errors_total[5m]) / rate(http_requests_total[5m])",
        "type": "singlestat",
        "thresholds": "0.01,0.05",
        "colors": ["green", "yellow", "red"]
      },
      {
        "title": "P95 Latency",
        "query": "histogram_quantile(0.95, http_request_duration_seconds)",
        "type": "graph"
      },
      {
        "title": "Active Connections",
        "query": "opnsense_active_connections",
        "type": "gauge"
      }
    ]
  }
}
```

### 2. Resource Management Dashboard

```yaml
panels:
  - title: "VLAN Operations"
    query: "sum(rate(vlan_operations_total[5m])) by (operation)"
    visualization: bar_chart
    
  - title: "Firewall Rule Changes"
    query: "sum(increase(firewall_rule_changes_total[1h])) by (action)"
    visualization: pie_chart
    
  - title: "HAProxy Backend Health"
    query: "haproxy_backend_up"
    visualization: heatmap
    
  - title: "DNS Blocklist Size"
    query: "dns_blocklist_entries"
    visualization: singlestat
```

### 3. Infrastructure Dashboard

```yaml
panels:
  - title: "CPU Usage"
    query: "100 - (avg(irate(node_cpu_seconds_total{mode='idle'}[5m])) * 100)"
    
  - title: "Memory Usage"
    query: "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100"
    
  - title: "Disk I/O"
    query: "rate(node_disk_read_bytes_total[5m]) + rate(node_disk_written_bytes_total[5m])"
    
  - title: "Network Traffic"
    query: "rate(node_network_receive_bytes_total[5m]) + rate(node_network_transmit_bytes_total[5m])"
```

## 🚨 Alerting Rules

### 1. Critical Alerts

```yaml
# prometheus-alerts.yml
groups:
  - name: critical
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"
      
      - alert: APIDown
        expr: up{job="opnsense-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "OPNsense API is down"
      
      - alert: OutOfMemory
        expr: node_memory_MemAvailable_bytes < 100000000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Memory critically low"
```

### 2. Warning Alerts

```yaml
  - name: warnings
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency above 1 second"
      
      - alert: CacheMissRate
        expr: cache_hit_rate < 0.5
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 50%"
      
      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Less than 10% disk space remaining"
```

### 3. Business Alerts

```yaml
  - name: business
    rules:
      - alert: DeploymentFailures
        expr: rate(iac_deployments_failed_total[1h]) > 0.1
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "High deployment failure rate"
      
      - alert: BackupNotRunning
        expr: time() - last_backup_timestamp > 86400
        labels:
          severity: warning
        annotations:
          summary: "No backup in last 24 hours"
      
      - alert: UnusualActivity
        expr: rate(firewall_rule_changes_total[5m]) > 10
        labels:
          severity: info
        annotations:
          summary: "Unusual number of firewall changes"
```

## 📱 Alert Routing

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  
  routes:
    - match:
        severity: critical
      receiver: pagerduty
      continue: true
      
    - match:
        severity: warning
      receiver: slack
      
    - match:
        severity: info
      receiver: email
      
receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'
      
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<pagerduty_key>'
        
  - name: 'slack'
    slack_configs:
      - api_url: '<slack_webhook>'
        channel: '#ops-alerts'
        
  - name: 'email'
    email_configs:
      - to: 'ops-team@company.com'
        from: 'alerts@company.com'
```

## 📈 SLO Monitoring

### Service Level Objectives

```yaml
slos:
  - name: "API Availability"
    objective: 99.9%
    indicator: "sum(rate(http_requests_total{status!~'5..'}[5m])) / sum(rate(http_requests_total[5m]))"
    
  - name: "Request Latency"
    objective: 95% of requests < 500ms
    indicator: "histogram_quantile(0.95, http_request_duration_seconds) < 0.5"
    
  - name: "Error Budget"
    objective: < 0.1% errors
    indicator: "rate(errors_total[1h]) / rate(http_requests_total[1h]) < 0.001"
```

### Error Budget Tracking

```typescript
// error-budget.ts
export class ErrorBudgetTracker {
  private readonly SLO = 0.999; // 99.9% availability
  
  calculateErrorBudget(timeWindow: number): ErrorBudget {
    const totalRequests = this.getTotalRequests(timeWindow);
    const failedRequests = this.getFailedRequests(timeWindow);
    
    const availability = (totalRequests - failedRequests) / totalRequests;
    const errorBudgetUsed = (1 - availability) / (1 - this.SLO);
    const errorBudgetRemaining = Math.max(0, 1 - errorBudgetUsed);
    
    return {
      slo: this.SLO,
      availability,
      errorBudgetUsed,
      errorBudgetRemaining,
      burnRate: errorBudgetUsed / (timeWindow / (30 * 24 * 60 * 60))
    };
  }
}
```

## 🔄 Continuous Improvement

### 1. Regular Reviews
- **Daily**: Check dashboards, review overnight alerts
- **Weekly**: Analyze trends, update thresholds
- **Monthly**: SLO review, capacity planning
- **Quarterly**: Architecture review, tool evaluation

### 2. Runbook Automation
```typescript
// runbook.ts
export class AutomatedRunbook {
  async handleAlert(alert: Alert) {
    switch (alert.name) {
      case 'HighMemoryUsage':
        await this.clearCache();
        await this.restartIfNeeded();
        break;
        
      case 'APIDown':
        await this.checkAPIHealth();
        await this.attemptReconnection();
        await this.notifyOnCall();
        break;
        
      case 'DiskSpaceLow':
        await this.cleanupLogs();
        await this.archiveOldBackups();
        break;
    }
  }
}
```

### 3. Post-Incident Analysis
```markdown
## Incident Report Template

**Incident ID**: INC-2024-001
**Date**: 2024-01-15
**Duration**: 45 minutes
**Severity**: High

### Timeline
- 14:30 - Alert triggered
- 14:35 - Engineer acknowledged
- 14:45 - Root cause identified
- 15:00 - Fix deployed
- 15:15 - Incident resolved

### Root Cause
Memory leak in cache manager

### Action Items
- [ ] Fix memory leak
- [ ] Add memory profiling
- [ ] Update monitoring thresholds
- [ ] Create automated remediation
```

## 📋 Implementation Checklist

### Phase 1: Basic Monitoring (Week 1)
- [ ] Install Prometheus
- [ ] Configure Node Exporter
- [ ] Set up Grafana
- [ ] Create basic dashboards
- [ ] Configure critical alerts

### Phase 2: Advanced Monitoring (Week 2)
- [ ] Implement OpenTelemetry
- [ ] Add distributed tracing
- [ ] Set up centralized logging
- [ ] Create business metrics
- [ ] Configure alert routing

### Phase 3: Optimization (Week 3)
- [ ] Define SLOs
- [ ] Implement error budgets
- [ ] Create runbooks
- [ ] Automate remediation
- [ ] Performance baseline

### Phase 4: Maturity (Ongoing)
- [ ] Chaos engineering
- [ ] Predictive analytics
- [ ] Cost optimization
- [ ] Compliance reporting
- [ ] Continuous improvement

---

*This monitoring strategy ensures comprehensive observability of the OPNSense MCP Server, enabling proactive issue detection and rapid incident response.*