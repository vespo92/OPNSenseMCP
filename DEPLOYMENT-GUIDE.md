# Deployment Guide - OPNSense MCP Server

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Production Deployment](#production-deployment)
- [High Availability Setup](#high-availability-setup)
- [Security Hardening](#security-hardening)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)

## ✅ Prerequisites

### System Requirements
- **Node.js**: v18.0.0 or higher (v20.x recommended)
- **Memory**: Minimum 512MB, recommended 2GB
- **CPU**: 1 core minimum, 2+ cores recommended
- **Storage**: 1GB for application and logs
- **Network**: Access to OPNsense firewall API

### OPNsense Requirements
- **Version**: 23.7 or higher
- **API Access**: Enabled with valid credentials
- **Permissions**: User with appropriate privileges
- **Network**: Accessible from MCP server

### Required Credentials
```bash
# OPNsense API credentials
OPNSENSE_HOST=https://192.168.1.1
OPNSENSE_API_KEY=your-api-key-here
OPNSENSE_API_SECRET=your-api-secret-here

# Optional: SSL verification
OPNSENSE_VERIFY_SSL=true
```

## 🚀 Local Development

### 1. Clone and Install
```bash
# Clone repository
git clone https://github.com/yourorg/opnsense-mcp-server.git
cd opnsense-mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit with your credentials
nano .env
```

### 3. Run Development Server
```bash
# Development mode with hot reload
npm run dev

# Or production mode
npm start
```

### 4. Test Connection
```bash
# Test with MCP CLI
npx @modelcontextprotocol/cli connect stdio \
  node dist/index.js

# Test specific tool
echo '{"method":"tools/call","params":{"name":"opnsense_vlan_list"}}' | \
  node dist/index.js
```

## 🐳 Docker Deployment

### 1. Build Docker Image
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache tini
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

### 2. Build and Run
```bash
# Build image
docker build -t opnsense-mcp:latest .

# Run container
docker run -d \
  --name opnsense-mcp \
  -p 3000:3000 \
  -e OPNSENSE_HOST=https://192.168.1.1 \
  -e OPNSENSE_API_KEY=your-key \
  -e OPNSENSE_API_SECRET=your-secret \
  -e TRANSPORT_MODE=sse \
  --restart unless-stopped \
  opnsense-mcp:latest
```

### 3. Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  opnsense-mcp:
    build: .
    container_name: opnsense-mcp
    ports:
      - "3000:3000"
    environment:
      - OPNSENSE_HOST=${OPNSENSE_HOST}
      - OPNSENSE_API_KEY=${OPNSENSE_API_KEY}
      - OPNSENSE_API_SECRET=${OPNSENSE_API_SECRET}
      - TRANSPORT_MODE=sse
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Redis for caching
  redis:
    image: redis:7-alpine
    container_name: opnsense-mcp-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### 4. Run with Docker Compose
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f opnsense-mcp

# Stop services
docker-compose down
```

## ☸️ Kubernetes Deployment

### 1. ConfigMap for Configuration
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: opnsense-mcp-config
  namespace: opnsense
data:
  TRANSPORT_MODE: "sse"
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
```

### 2. Secret for Credentials
```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: opnsense-mcp-secret
  namespace: opnsense
type: Opaque
stringData:
  OPNSENSE_HOST: "https://192.168.1.1"
  OPNSENSE_API_KEY: "your-api-key"
  OPNSENSE_API_SECRET: "your-api-secret"
  REDIS_PASSWORD: "redis-password"
```

### 3. Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: opnsense-mcp
  namespace: opnsense
  labels:
    app: opnsense-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: opnsense-mcp
  template:
    metadata:
      labels:
        app: opnsense-mcp
    spec:
      containers:
      - name: opnsense-mcp
        image: opnsense-mcp:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: opnsense-mcp-config
        - secretRef:
            name: opnsense-mcp-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: opnsense-mcp-data
      - name: logs
        emptyDir: {}
```

### 4. Service
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: opnsense-mcp-service
  namespace: opnsense
spec:
  selector:
    app: opnsense-mcp
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 5. Ingress
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: opnsense-mcp-ingress
  namespace: opnsense
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - mcp.yourdomain.com
    secretName: opnsense-mcp-tls
  rules:
  - host: mcp.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: opnsense-mcp-service
            port:
              number: 80
```

### 6. Deploy to Kubernetes
```bash
# Create namespace
kubectl create namespace opnsense

# Apply configurations
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Check status
kubectl get pods -n opnsense
kubectl get svc -n opnsense
kubectl logs -f deployment/opnsense-mcp -n opnsense
```

## 🏭 Production Deployment

### 1. Production Environment Setup
```bash
# Production environment variables
export NODE_ENV=production
export LOG_LEVEL=warn
export TRANSPORT_MODE=sse
export ENABLE_METRICS=true
export ENABLE_TRACING=true

# Security settings
export ENABLE_RATE_LIMITING=true
export MAX_REQUESTS_PER_MINUTE=100
export ENABLE_AUTH=true
export AUTH_TOKEN=secure-token-here

# Performance settings
export MAX_CONNECTIONS=1000
export CONNECTION_TIMEOUT=30000
export CACHE_TTL=300
export ENABLE_COMPRESSION=true
```

### 2. Process Management with PM2
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'opnsense-mcp',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    wait_ready: true,
    listen_timeout: 10000
  }]
};
```

### 3. Start with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs opnsense-mcp
```

### 4. Nginx Reverse Proxy
```nginx
# /etc/nginx/sites-available/opnsense-mcp
upstream opnsense_mcp {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name mcp.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=mcp:10m rate=10r/s;
    limit_req zone=mcp burst=20 nodelay;
    
    location / {
        proxy_pass http://opnsense_mcp;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering off;
        proxy_cache off;
    }
    
    location /health {
        access_log off;
        proxy_pass http://opnsense_mcp/health;
    }
}
```

## 🔄 High Availability Setup

### 1. Multi-Node Architecture
```yaml
# Architecture Overview
       ┌──────────────┐
       │ Load Balancer│
       └──────┬───────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼──┐           ┌───▼──┐
│Node 1│           │Node 2│
└───┬──┘           └───┬──┘
    │                   │
    └─────────┬─────────┘
              │
         ┌────▼────┐
         │  Redis  │
         │ Cluster │
         └─────────┘
```

### 2. Redis Cluster Setup
```bash
# Redis cluster configuration
port 6379
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
appendonly yes
```

### 3. Health Checks
```typescript
// health.ts
export async function healthCheck(): Promise<HealthStatus> {
  const checks = {
    api: await checkAPIConnection(),
    redis: await checkRedisConnection(),
    disk: await checkDiskSpace(),
    memory: checkMemoryUsage()
  };
  
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  
  return {
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  };
}
```

## 🔒 Security Hardening

### 1. Environment Security
```bash
# Use secrets management
export OPNSENSE_API_KEY=$(vault kv get -field=api_key secret/opnsense)
export OPNSENSE_API_SECRET=$(vault kv get -field=api_secret secret/opnsense)

# File permissions
chmod 600 .env
chmod 700 ./data
chmod 700 ./logs
```

### 2. Network Security
```bash
# Firewall rules
iptables -A INPUT -p tcp --dport 3000 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP

# Fail2ban configuration
[opnsense-mcp]
enabled = true
port = 3000
filter = opnsense-mcp
logpath = /var/log/opnsense-mcp/access.log
maxretry = 5
```

### 3. Application Security
```javascript
// security.js
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api', limiter);
```

## 📊 Monitoring Setup

### 1. Prometheus Metrics
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'opnsense-mcp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### 2. Grafana Dashboard
```json
{
  "dashboard": {
    "title": "OPNSense MCP Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_errors_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### 3. Logging Setup
```javascript
// logging.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Connection Refused
```bash
# Check if service is running
systemctl status opnsense-mcp

# Check ports
netstat -tlnp | grep 3000

# Check firewall
iptables -L -n | grep 3000
```

#### 2. Authentication Failures
```bash
# Verify credentials
curl -k https://opnsense.local/api/core/system/status \
  -u "api_key:api_secret"

# Check environment variables
env | grep OPNSENSE
```

#### 3. High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart with memory limit
pm2 restart opnsense-mcp --max-memory-restart 500M

# Analyze heap dump
node --inspect dist/index.js
```

#### 4. Performance Issues
```bash
# Enable profiling
NODE_ENV=production node --prof dist/index.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt

# Check slow queries
grep "slow" logs/app.log
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=opnsense:*
export LOG_LEVEL=debug

# Run with verbose output
node dist/index.js --verbose

# Enable trace
export NODE_OPTIONS="--trace-warnings"
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Review security audit recommendations
- [ ] Update all dependencies
- [ ] Run security scanning
- [ ] Test backup and restore procedures
- [ ] Verify API credentials
- [ ] Configure monitoring
- [ ] Set up log aggregation
- [ ] Prepare rollback plan

### Deployment
- [ ] Deploy to staging environment
- [ ] Run integration tests
- [ ] Perform load testing
- [ ] Verify health checks
- [ ] Deploy to production
- [ ] Monitor metrics
- [ ] Verify functionality

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review logs for issues
- [ ] Update documentation
- [ ] Notify stakeholders
- [ ] Schedule post-deployment review

---

*This deployment guide covers all major deployment scenarios. Always test in a staging environment before deploying to production.*