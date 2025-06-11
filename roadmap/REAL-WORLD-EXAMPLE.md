# Real-World Example: E-Commerce Platform Deployment

## Scenario
Your company needs to deploy a new e-commerce platform with:
- High availability across multiple servers
- Separate networks for web, app, and database tiers
- SSL certificates for secure transactions
- DDoS protection
- Auto-scaling based on load
- Monitoring and alerting
- Backup and disaster recovery

## Traditional Approach (Weeks of Work)
1. Network engineer configures VLANs
2. Security team sets up firewall rules
3. DevOps writes Terraform scripts
4. Someone configures load balancer
5. Another person handles SSL certificates
6. Multiple iterations to get it right
7. Documentation written (maybe)

## MCP-IaC Approach (Minutes)

### Step 1: Natural Language Request
```
User: "Deploy an e-commerce platform called 'ShopHub' with:
- Web tier with 2-10 servers that auto-scale
- App tier with 3 servers minimum
- Database with primary/replica setup
- Each tier in its own network
- SSL on shophhub.com and www.shophub.com
- DDoS protection limiting 1000 requests/minute per IP
- Allow traffic only between adjacent tiers
- Monitor everything and alert on issues"
```

### Step 2: AI Translation
The AI understands this and creates a deployment plan:

```yaml
deployment:
  name: shophub-platform
  version: 1.0.0
  
  patterns:
    - three-tier-architecture
    - auto-scaling
    - high-availability
    
  resources:
    # Network Layer (OPNSense)
    - type: opnsense:network:vlan
      name: web-tier
      properties:
        tag: 200
        subnet: 10.200.0.0/24
        
    - type: opnsense:network:vlan
      name: app-tier
      properties:
        tag: 201
        subnet: 10.201.0.0/24
        
    - type: opnsense:network:vlan
      name: db-tier
      properties:
        tag: 202
        subnet: 10.202.0.0/24
    
    # Security Rules (OPNSense)
    - type: opnsense:firewall:rule
      name: allow-https-to-web
      properties:
        source: any
        destination: web-tier
        port: 443
        action: pass
        rateLimit: 1000/minute
        
    - type: opnsense:firewall:rule
      name: allow-web-to-app
      properties:
        source: web-tier
        destination: app-tier
        port: 8080
        action: pass
        
    - type: opnsense:firewall:rule
      name: allow-app-to-db
      properties:
        source: app-tier
        destination: db-tier
        port: 5432
        action: pass
    
    # Load Balancer (OPNSense)
    - type: opnsense:haproxy:backend
      name: web-backend
      properties:
        balance: leastconn
        healthCheck: /health
        
    - type: opnsense:haproxy:backend
      name: app-backend
      properties:
        balance: roundrobin
        healthCheck: /api/health
    
    # SSL Certificates (AWS)
    - type: aws:acm:certificate
      name: shophub-cert
      properties:
        domains:
          - shophub.com
          - www.shophub.com
        validation: DNS
    
    # Auto-Scaling (AWS)
    - type: aws:autoscaling:group
      name: web-asg
      properties:
        min: 2
        max: 10
        targetCPU: 70
        subnet: web-tier
        
    # Database (AWS)
    - type: aws:rds:cluster
      name: shophub-db
      properties:
        engine: postgres
        version: "14"
        instances: 2
        subnet: db-tier
        backup: true
        
    # Containers (Docker)
    - type: docker:compose:stack
      name: shophub-stack
      properties:
        services:
          web:
            image: shophub/web:latest
            replicas: dynamic
          app:
            image: shophub/app:latest
            replicas: 3
            
    # Monitoring (Kubernetes)
    - type: k8s:deployment:prometheus
      name: monitoring
      properties:
        scrapeInterval: 30s
        retention: 30d
        
    - type: k8s:configmap:alerts
      name: alert-rules
      properties:
        rules:
          - name: HighErrorRate
            expr: error_rate > 0.05
            severity: critical
```

### Step 3: AI Shows the Plan
```
Deployment Plan: shophub-platform
=================================

Summary:
  + 25 resources to create
  + 3 networks to configure
  + 12 security rules to apply
  + 2 load balancers to setup
  + 5 monitoring rules to configure

Execution Order:
  Stage 1 (Network Foundation):
    + opnsense:network:vlan "web-tier" 
    + opnsense:network:vlan "app-tier"
    + opnsense:network:vlan "db-tier"
    
  Stage 2 (Security & Access):
    + opnsense:firewall:rule "allow-https-to-web"
    + opnsense:firewall:rule "allow-web-to-app"
    + opnsense:firewall:rule "allow-app-to-db"
    + opnsense:firewall:alias "ddos-blacklist"
    
  Stage 3 (Infrastructure):
    + aws:rds:cluster "shophub-db"
    + aws:acm:certificate "shophub-cert"
    + docker:image:build "web-image"
    + docker:image:build "app-image"
    
  Stage 4 (Application Layer):
    + aws:autoscaling:group "web-asg"
    + aws:ec2:instances "app-servers"
    + opnsense:haproxy:backend "web-backend"
    + opnsense:haproxy:backend "app-backend"
    
  Stage 5 (Monitoring):
    + k8s:deployment:prometheus "monitoring"
    + k8s:deployment:grafana "dashboards"
    + k8s:configmap:alerts "alert-rules"

Estimated Duration: 12 minutes

Policy Compliance:
  ✓ Network isolation enforced
  ✓ Encryption in transit enabled
  ✓ Backup configured
  ✓ Monitoring enabled
  ✓ Rate limiting active

Cost Estimate:
  - Infrastructure: $450/month
  - Data Transfer: $50/month (estimated)
  - Monitoring: $30/month
  - Total: ~$530/month

Proceed with deployment? (yes/no)
```

### Step 4: Execution with Progress
```
User: yes

AI: Starting deployment of shophub-platform...

[Stage 1/5] Network Foundation
  ✓ Created VLAN 200 (web-tier) - 10.200.0.0/24
  ✓ Created VLAN 201 (app-tier) - 10.201.0.0/24
  ✓ Created VLAN 202 (db-tier) - 10.202.0.0/24
  ✓ Configured inter-VLAN routing
  
[Stage 2/5] Security & Access
  ✓ Created firewall rule: allow-https-to-web
    - Added rate limiting: 1000 req/min per IP
  ✓ Created firewall rule: allow-web-to-app
  ✓ Created firewall rule: allow-app-to-db
  ✓ Created DDoS protection alias
  ✓ Applied firewall changes
  
[Stage 3/5] Infrastructure
  ✓ Requested SSL certificate for shophub.com
  ✓ DNS validation completed
  ✓ Creating RDS cluster (this may take a few minutes)...
    - Primary instance: ready
    - Replica instance: ready
    - Automated backups: configured
  ✓ Built Docker images
    - shophub/web:latest (342MB)
    - shophub/app:latest (256MB)
    
[Stage 4/5] Application Layer
  ✓ Created auto-scaling group for web tier
    - Initial capacity: 2 instances
    - Instances healthy: i-abc123, i-def456
  ✓ Deployed app tier servers
    - app-server-1: 10.201.0.10 (healthy)
    - app-server-2: 10.201.0.11 (healthy)
    - app-server-3: 10.201.0.12 (healthy)
  ✓ Configured HAProxy backends
    - Web backend: 2 servers active
    - App backend: 3 servers active
  ✓ SSL certificate bound to load balancer
  
[Stage 5/5] Monitoring
  ✓ Deployed Prometheus to Kubernetes
  ✓ Deployed Grafana with dashboards
  ✓ Configured alerting rules
  ✓ Test alert sent successfully

Deployment Complete!
==================

Access Points:
  - Public URL: https://shophub.com
  - Admin Panel: https://admin.shophub.com
  - Monitoring: https://monitor.shophub.com
  - Grafana: https://grafana.shophub.com

Health Status:
  - Web Tier: ● Healthy (2/2 instances)
  - App Tier: ● Healthy (3/3 instances)
  - Database: ● Healthy (Primary + Replica)
  - SSL: ● Valid until 2026-01-20

Quick Actions:
  - Scale web tier: "Add 2 more web servers"
  - Check logs: "Show me app tier errors from last hour"
  - Update config: "Increase rate limit to 2000/minute"
  - Disaster recovery: "Failover to backup region"
```

### Step 5: Day 2 Operations

#### Scaling Request
```
User: "Traffic is increasing, scale the web tier to 5 servers"

AI: Scaling web tier...
  ✓ Current: 2 instances
  ✓ Target: 5 instances
  ✓ Adding 3 new instances...
    - i-ghi789 (launching)
    - i-jkl012 (launching)
    - i-mno345 (launching)
  ✓ Updating load balancer...
  ✓ All instances healthy
  
Web tier scaled to 5 instances. Load distributed evenly.
```

#### Troubleshooting
```
User: "Why is the app slow?"

AI: Analyzing performance...

Found potential issues:
1. Database queries averaging 2.3s (should be <100ms)
   - Top slow query: SELECT * FROM orders WHERE...
   - Recommendation: Add index on orders.customer_id
   
2. App server CPU at 89% average
   - Memory usage normal (45%)
   - Recommendation: Scale app tier or optimize code
   
3. Network latency between tiers: 
   - Web→App: 2ms (good)
   - App→DB: 45ms (high)
   - Recommendation: Check network congestion

Would you like me to:
a) Add the database index
b) Scale the app tier
c) Investigate network issue
d) All of the above
```

#### Disaster Recovery
```
User: "Simulate a disaster recovery to backup datacenter"

AI: Initiating disaster recovery drill...

Pre-flight checks:
  ✓ Backup datacenter: ready
  ✓ Data replication lag: 2 seconds
  ✓ DNS TTL: 60 seconds

Executing failover:
  1. Set primary to read-only mode
  2. Promote backup database to primary
  3. Update DNS records
  4. Redirect load balancer
  5. Scale backup region resources
  
Failover complete in 3m 24s

Status:
  - Traffic now routing to backup datacenter
  - All services operational
  - Data loss: 0 (within RPO)
  - Downtime: 45 seconds (within RTO)

Run "failback to primary" when ready.
```

## Benefits Demonstrated

1. **Speed**: Entire deployment in 12 minutes vs weeks
2. **Intelligence**: AI understands intent and best practices
3. **Adaptability**: Easy scaling and modifications
4. **Reliability**: Automated health checks and recovery
5. **Observability**: Built-in monitoring and alerting
6. **Compliance**: Automatic security best practices

## Cost Comparison

### Traditional Approach
- Network Engineer: 40 hours @ $150/hr = $6,000
- Security Engineer: 20 hours @ $150/hr = $3,000
- DevOps Engineer: 60 hours @ $150/hr = $9,000
- Testing & Iteration: 40 hours @ $150/hr = $6,000
- **Total Setup Cost: $24,000**
- **Time to Deploy: 2-3 weeks**

### MCP-IaC Approach
- AI Platform License: $500/month
- Engineer Supervision: 2 hours @ $150/hr = $300
- **Total Setup Cost: $800**
- **Time to Deploy: 12 minutes**

**Savings: $23,200 (96%) and 2-3 weeks**

## Conclusion

This example demonstrates how MCP-based IaC transforms infrastructure deployment from a complex, time-consuming process into a simple conversation. The AI handles all the complexity while ensuring best practices, security, and reliability.

The future of infrastructure is here, and it speaks your language.
