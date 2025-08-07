# HAProxy Configuration Guide

Configure load balancing and reverse proxy services using HAProxy on OPNsense.

## Overview

HAProxy is a high-performance load balancer and reverse proxy that enables:
- Load distribution across multiple servers
- SSL/TLS termination
- Health monitoring
- Content-based routing
- High availability

## Prerequisites

- HAProxy plugin installed on OPNsense
- Backend servers configured and accessible
- SSL certificates (for HTTPS)
- MCP server connected

## Quick Setup Examples

### Basic Web Server Load Balancing

```
"Create an HAProxy backend named web-servers with servers at 192.168.1.10:80 and 192.168.1.11:80 using round-robin"
```

```
"Create an HAProxy frontend on port 80 that routes to the web-servers backend"
```

### HTTPS Reverse Proxy

```
"Set up HAProxy to proxy HTTPS traffic to my TrueNAS server at 10.0.0.14:443"
```

### Application Load Balancing

```
"Create a load balancer for my app servers:
- Backend: app1.local:8080, app2.local:8080, app3.local:8080
- Frontend: Public IP port 443 with SSL
- Health checks on /health endpoint"
```

## Core Concepts

### Backends
Server pools that receive traffic:
- Define target servers
- Set load balancing algorithm
- Configure health checks
- Handle SSL to backend

### Frontends
Entry points that accept client connections:
- Define listening addresses/ports
- Handle SSL termination
- Route to backends
- Apply ACLs and rules

### ACLs (Access Control Lists)
Conditions for routing decisions:
- Path-based routing
- Host-based routing
- Header inspection
- Source IP filtering

## Common Use Cases

### 1. Web Server Load Balancing

Balance traffic across multiple web servers:

```javascript
// Create backend
{
  name: "web-backend",
  mode: "http",
  balance: "roundrobin",
  servers: [
    { name: "web1", address: "192.168.1.10", port: 80 },
    { name: "web2", address: "192.168.1.11", port: 80 },
    { name: "web3", address: "192.168.1.12", port: 80 }
  ]
}

// Create frontend
{
  name: "web-frontend",
  bind: "0.0.0.0:80",
  mode: "http",
  backend: "web-backend"
}
```

### 2. SSL Termination

Terminate SSL at HAProxy and forward to HTTP backend:

```javascript
// Backend (HTTP)
{
  name: "app-backend",
  mode: "http",
  balance: "leastconn",
  servers: [
    { name: "app1", address: "10.0.0.20", port: 8080 }
  ]
}

// Frontend (HTTPS)
{
  name: "app-frontend",
  bind: "0.0.0.0:443",
  mode: "http",
  backend: "app-backend",
  ssl: true,
  certificates: ["my-ssl-cert"]
}
```

### 3. Multiple Applications

Route different domains to different backends:

```
"Create HAProxy routing:
- example.com → web-backend
- api.example.com → api-backend
- admin.example.com → admin-backend"
```

### 4. Database Load Balancing

Balance MySQL/PostgreSQL connections:

```javascript
// TCP mode for databases
{
  name: "mysql-backend",
  mode: "tcp",
  balance: "leastconn",
  servers: [
    { name: "mysql1", address: "10.0.0.30", port: 3306 },
    { name: "mysql2", address: "10.0.0.31", port: 3306 }
  ]
}
```

## Load Balancing Algorithms

### Round Robin
Default algorithm, distributes requests evenly:
```
balance: "roundrobin"
```

### Least Connections
Routes to server with fewest active connections:
```
balance: "leastconn"
```
Best for long-lived connections.

### Source IP Hash
Same client always goes to same server:
```
balance: "source"
```
Good for session persistence.

### URI Hash
Same URI always goes to same server:
```
balance: "uri"
```
Good for caching.

### Random
Random server selection:
```
balance: "random"
```

## Health Monitoring

### HTTP Health Checks

Configure health checks for web services:

```
"Add HTTP health checks to web-backend:
- Check path: /health
- Interval: 5 seconds
- Timeout: 2 seconds
- Rise: 2 successful checks to mark up
- Fall: 3 failed checks to mark down"
```

### TCP Health Checks

For non-HTTP services:

```
"Add TCP health checks to mysql-backend on port 3306"
```

## SSL/TLS Configuration

### Certificate Management

List available certificates:
```
"Show HAProxy certificates"
```

Create self-signed certificate:
```
"Create self-signed certificate for haproxy.local"
```

Import certificate:
```
"Import SSL certificate for example.com"
```

### SSL Frontend Configuration

Enable SSL on frontend:
```javascript
{
  ssl: true,
  certificates: ["example-com-cert"],
  sslMinVersion: "TLSv1.2",
  sslCiphers: "ECDHE+AESGCM:ECDHE+AES256:!aNULL:!MD5"
}
```

### SSL to Backend

Enable SSL to backend servers:
```javascript
{
  servers: [{
    name: "secure-server",
    address: "10.0.0.40",
    port: 443,
    ssl: true,
    verify: "required"  // or "none" for self-signed
  }]
}
```

## Advanced Routing

### Path-Based Routing

Route based on URL path:

```
"Create ACLs:
- /api/* → api-backend
- /admin/* → admin-backend
- /* → web-backend"
```

### Host-Based Routing

Route based on hostname:

```
"Create host-based routing:
- Host header 'api.example.com' → api-backend
- Host header 'www.example.com' → web-backend"
```

### Header Manipulation

Add/modify headers:

```
"Add these headers to responses:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000"
```

## Monitoring and Statistics

### View Statistics

```
"Show HAProxy statistics"
```

Returns:
- Active sessions
- Total connections
- Bytes in/out
- Error rates
- Backend health

### Check Backend Health

```
"Check health of web-backend servers"
```

### Enable Stats Page

```
"Enable HAProxy stats page on port 8404 with username admin"
```

## Service Management

### Control Service

Start HAProxy:
```
"Start HAProxy service"
```

Stop HAProxy:
```
"Stop HAProxy service"
```

Reload configuration:
```
"Reload HAProxy configuration"
```

Check status:
```
"Check HAProxy service status"
```

## Troubleshooting

### Common Issues

**Backend servers shown as DOWN**
- Check network connectivity
- Verify health check settings
- Check backend server logs
- Ensure correct ports

**SSL errors**
- Verify certificate validity
- Check certificate chain
- Ensure correct SSL versions
- Review cipher suites

**Routing not working**
- Check ACL expressions
- Verify backend names
- Review frontend/backend modes
- Check bind addresses

### Debug Commands

View HAProxy logs:
```
"Show HAProxy error logs"
```

Test configuration:
```
"Validate HAProxy configuration"
```

Check specific backend:
```
"Show details for web-backend"
```

## Best Practices

### 1. Health Checks
Always configure health checks to detect failed servers automatically.

### 2. Timeouts
Set appropriate timeouts:
- Client timeout: 30s
- Server timeout: 30s
- Connect timeout: 5s

### 3. Logging
Enable logging for troubleshooting:
- Access logs for traffic analysis
- Error logs for debugging

### 4. SSL Security
- Use TLS 1.2 minimum
- Strong cipher suites only
- Regular certificate updates

### 5. Backup Configurations
Before major changes:
```
"Backup HAProxy configuration"
```

## Performance Tuning

### Connection Limits

Set maximum connections:
```
"Set HAProxy max connections to 10000"
```

### Buffer Sizes

Tune for large requests:
```
"Set HAProxy buffer size to 32768"
```

### Keep-Alive

Enable HTTP keep-alive:
```
"Enable HTTP keep-alive with 15 second timeout"
```

## Integration Examples

### WordPress Load Balancing

```
"Set up HAProxy for WordPress:
- 3 web servers on ports 80
- Shared database backend
- Session persistence via cookies
- SSL termination on frontend"
```

### Kubernetes Ingress

```
"Configure HAProxy as Kubernetes ingress:
- Route to NodePort services
- SSL termination
- Path-based routing for microservices"
```

### Multi-Site Hosting

```
"Configure HAProxy for multiple sites:
- site1.com → Backend pool 1
- site2.com → Backend pool 2
- site3.com → Backend pool 3
- All with SSL and health checks"
```

## API Reference

### Backend Tools
- `haproxy_backend_create` - Create backend
- `haproxy_backend_list` - List backends
- `haproxy_backend_delete` - Delete backend
- `haproxy_backend_health` - Check health

### Frontend Tools
- `haproxy_frontend_create` - Create frontend
- `haproxy_frontend_list` - List frontends
- `haproxy_frontend_delete` - Delete frontend

### Service Tools
- `haproxy_service_control` - Control service
- `haproxy_stats` - Get statistics

### Certificate Tools
- `haproxy_certificate_list` - List certificates
- `haproxy_certificate_create` - Create certificate

## Next Steps

- Learn about [Firewall Rules](firewall-rules.md) to protect HAProxy
- Explore [VLAN Management](vlan-management.md) for network segmentation
- Read about [Backup & Restore](backup-restore.md) for configuration management

## Related Documentation

- [SSL/TLS Best Practices](../deployment/production.md#ssl-security)
- [Performance Tuning](../deployment/production.md#performance)
- [IaC Integration](../iac/patterns.md#load-balancing)