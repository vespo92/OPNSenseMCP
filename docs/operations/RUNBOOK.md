# Operational Runbook - OPNSense MCP Server

## 🚨 Emergency Contacts

| Role | Name | Contact | When to Call |
|------|------|---------|--------------|
| On-Call Engineer | Rotation | PagerDuty | First contact for all incidents |
| Tech Lead | John Smith | +1-555-0100 | Architecture decisions |
| OPNsense Admin | Jane Doe | +1-555-0101 | Firewall access issues |
| DevOps Lead | Bob Wilson | +1-555-0102 | Infrastructure problems |
| Security Team | SOC | security@company | Security incidents |

## 🎯 Quick Actions

### Service is Down
```bash
# 1. Check if process is running
systemctl status opnsense-mcp

# 2. Restart service
systemctl restart opnsense-mcp

# 3. Check logs
journalctl -u opnsense-mcp -n 100

# 4. If still down, check dependencies
curl -k https://opnsense.local/api/core/system/status
redis-cli ping
```

### High Memory Usage
```bash
# 1. Check current usage
ps aux | grep opnsense-mcp

# 2. Clear cache
curl -X POST http://localhost:3000/admin/cache/clear

# 3. Restart with memory limit
systemctl stop opnsense-mcp
node --max-old-space-size=512 dist/index.js

# 4. If persists, check for memory leaks
node --inspect dist/index.js
# Open chrome://inspect and take heap snapshot
```

### API Connection Failed
```bash
# 1. Test OPNsense connectivity
ping opnsense.local
curl -k https://opnsense.local

# 2. Verify credentials
curl -u "$OPNSENSE_API_KEY:$OPNSENSE_API_SECRET" \
  https://opnsense.local/api/core/system/status

# 3. Check firewall rules
# SSH to OPNsense and verify API access is allowed

# 4. Restart with debug logging
DEBUG=opnsense:* node dist/index.js
```

## 📊 Standard Operating Procedures

### Daily Operations

#### Morning Health Check (9:00 AM)
```bash
#!/bin/bash
# morning-check.sh

echo "=== OPNSense MCP Daily Health Check ==="
echo "Date: $(date)"

# 1. Service Status
echo -e "\n1. Service Status:"
systemctl status opnsense-mcp --no-pager | head -10

# 2. Memory Usage
echo -e "\n2. Memory Usage:"
ps aux | grep opnsense-mcp | grep -v grep

# 3. Error Count (last 24h)
echo -e "\n3. Errors in last 24 hours:"
grep ERROR logs/error.log | grep "$(date -d yesterday '+%Y-%m-%d')" | wc -l

# 4. Cache Stats
echo -e "\n4. Cache Statistics:"
curl -s http://localhost:3000/debug/cache/stats | jq

# 5. API Response Time
echo -e "\n5. API Response Time:"
time curl -s http://localhost:3000/health > /dev/null

# 6. Disk Usage
echo -e "\n6. Disk Usage:"
df -h | grep -E "/$|/var"

echo -e "\n=== Check Complete ==="
```

#### Backup Procedure (Daily 2:00 AM)
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/opnsense-mcp/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 1. Backup state
cp -r /opt/opnsense-mcp/data $BACKUP_DIR/

# 2. Backup configuration
cp /opt/opnsense-mcp/.env $BACKUP_DIR/

# 3. Export Redis cache
redis-cli --rdb $BACKUP_DIR/redis.rdb

# 4. Backup OPNsense config
curl -u "$OPNSENSE_API_KEY:$OPNSENSE_API_SECRET" \
  https://opnsense.local/api/core/backup/download \
  -o $BACKUP_DIR/opnsense-config.xml

# 5. Compress backup
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

# 6. Upload to S3
aws s3 cp $BACKUP_DIR.tar.gz s3://backups/opnsense-mcp/

# 7. Clean old backups (keep 30 days)
find /backups/opnsense-mcp -name "*.tar.gz" -mtime +30 -delete
```

### Incident Response

#### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1** | Service Down | < 15 min | Complete outage, data loss |
| **P2** | Degraded Service | < 1 hour | Slow response, partial failure |
| **P3** | Minor Issue | < 4 hours | Single feature broken |
| **P4** | Low Priority | < 24 hours | Cosmetic issues |

#### P1 - Service Outage Response

```bash
# INCIDENT COMMANDER CHECKLIST
# [ ] Acknowledge incident in PagerDuty
# [ ] Join incident bridge: https://zoom.us/j/incident
# [ ] Start incident timeline
# [ ] Assign roles (Commander, Communicator, Investigator)

# IMMEDIATE ACTIONS (0-5 minutes)

# 1. Verify the outage
curl -m 5 http://localhost:3000/health || echo "SERVICE DOWN"

# 2. Check all components
systemctl status opnsense-mcp
redis-cli ping
curl -k https://opnsense.local/api/core/system/status

# 3. Attempt quick recovery
systemctl restart opnsense-mcp
sleep 10
curl http://localhost:3000/health

# INVESTIGATION (5-15 minutes)

# 4. Check recent changes
git log --oneline -n 10
kubectl rollout history deployment/opnsense-mcp

# 5. Review error logs
tail -n 1000 /var/log/opnsense-mcp/error.log | grep ERROR

# 6. Check system resources
top -bn1 | head -20
df -h
netstat -tuln | grep -E "3000|6379"

# RECOVERY ACTIONS (15+ minutes)

# 7. Rollback if needed
kubectl rollout undo deployment/opnsense-mcp
# OR
git checkout v0.7.0 && npm run build && pm2 restart opnsense-mcp

# 8. Escalate if not resolved
# Page: Tech Lead, DevOps Lead
# Open vendor ticket if OPNsense issue
```

#### P2 - Performance Degradation

```bash
# 1. Identify slow operations
grep "duration" logs/app.log | awk '{if ($NF > 1000) print}'

# 2. Check cache effectiveness
curl http://localhost:3000/debug/cache/stats

# 3. Monitor API latency
for i in {1..10}; do
  time curl -s http://localhost:3000/api/vlans > /dev/null
  sleep 1
done

# 4. Clear cache if needed
curl -X POST http://localhost:3000/admin/cache/clear

# 5. Increase resources if needed
pm2 scale opnsense-mcp 4  # Scale to 4 instances
```

### Maintenance Procedures

#### Weekly Maintenance (Sunday 3:00 AM)

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Starting weekly maintenance..."

# 1. Cleanup logs
find /var/log/opnsense-mcp -name "*.log" -mtime +7 -delete
journalctl --vacuum-time=7d

# 2. Optimize Redis
redis-cli BGREWRITEAOF
sleep 60
redis-cli MEMORY PURGE

# 3. Database maintenance
psql -U opnsense -c "VACUUM ANALYZE;"
psql -U opnsense -c "REINDEX DATABASE opnsense_mcp;"

# 4. Update dependencies (staging only)
if [ "$ENVIRONMENT" = "staging" ]; then
  npm audit fix
  npm update
  npm run build
fi

# 5. Test backup restore
/opt/scripts/test-backup-restore.sh

echo "Maintenance complete"
```

#### Monthly Tasks

1. **Security Patching**
```bash
# Review and apply security updates
npm audit
apt update && apt list --upgradable
# Apply patches during maintenance window
```

2. **Capacity Review**
```bash
# Generate capacity report
./scripts/capacity-report.sh > reports/capacity-$(date +%Y%m).txt
```

3. **Certificate Renewal**
```bash
# Check certificate expiry
echo | openssl s_client -connect opnsense.local:443 2>/dev/null | \
  openssl x509 -noout -dates
```

### Monitoring Alerts

#### Alert: High Error Rate
```bash
# Triggered when: error_rate > 5% for 5 minutes

# 1. Identify error types
grep ERROR logs/error.log | tail -100 | \
  awk '{print $5}' | sort | uniq -c | sort -rn

# 2. Check specific endpoints
grep "status=5" logs/access.log | \
  awk '{print $7}' | sort | uniq -c | sort -rn

# 3. Temporary mitigation
# Enable circuit breaker
curl -X POST http://localhost:3000/admin/circuit-breaker/enable

# 4. Fix root cause
# Deploy fix or rollback
```

#### Alert: Cache Miss Rate High
```bash
# Triggered when: cache_hit_rate < 50% for 10 minutes

# 1. Check cache stats
redis-cli INFO stats

# 2. Identify missing keys
redis-cli MONITOR  # Watch for 5 seconds, Ctrl+C
# Look for frequent GETs with nil responses

# 3. Warm cache
curl -X POST http://localhost:3000/admin/cache/warm

# 4. Adjust TTL if needed
# Edit config to increase cache TTL
```

#### Alert: Memory Usage High
```bash
# Triggered when: memory > 80% for 10 minutes

# 1. Get memory breakdown
cat /proc/$(pgrep -f opnsense-mcp)/status | grep VmRSS

# 2. Check for memory leaks
node --expose-gc --trace-gc dist/index.js

# 3. Force garbage collection
curl -X POST http://localhost:3000/admin/gc

# 4. Restart if necessary
pm2 restart opnsense-mcp --max-memory-restart 400M
```

### Deployment Procedures

#### Standard Deployment

```bash
#!/bin/bash
# deploy.sh

# PRE-DEPLOYMENT CHECKS
echo "[ ] Code reviewed and approved"
echo "[ ] Tests passing in CI/CD"
echo "[ ] Change ticket approved"
echo "[ ] Maintenance window scheduled"
echo "[ ] Rollback plan documented"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi

# DEPLOYMENT STEPS

# 1. Backup current version
./scripts/backup-current.sh

# 2. Pull new code
git fetch
git checkout v0.8.0

# 3. Install dependencies
npm ci

# 4. Run migrations
npm run db:migrate

# 5. Build
npm run build

# 6. Run smoke tests
npm run test:smoke

# 7. Deploy (rolling update)
pm2 reload opnsense-mcp

# 8. Verify deployment
sleep 10
curl http://localhost:3000/version
curl http://localhost:3000/health

# 9. Monitor for 5 minutes
watch -n 10 'grep ERROR logs/error.log | tail -5'
```

#### Emergency Hotfix

```bash
# For critical production issues only

# 1. Create hotfix branch
git checkout -b hotfix/critical-fix

# 2. Apply fix
# ... make changes ...

# 3. Test locally
npm test

# 4. Deploy to one instance
pm2 stop opnsense-mcp-1
node dist/index.js &
HOTFIX_PID=$!

# 5. Test fix
curl http://localhost:3000/test-endpoint

# 6. If successful, deploy to all
pm2 reload opnsense-mcp

# 7. If failed, rollback
kill $HOTFIX_PID
pm2 start opnsense-mcp-1
```

### Disaster Recovery

#### Complete System Failure

```bash
# When: Total system failure, need to rebuild from scratch

# 1. Provision new infrastructure
terraform apply -auto-approve

# 2. Install dependencies
ansible-playbook -i inventory setup.yml

# 3. Restore from backup
aws s3 cp s3://backups/opnsense-mcp/latest.tar.gz .
tar -xzf latest.tar.gz

# 4. Restore state
cp backup/data/state.json /opt/opnsense-mcp/data/

# 5. Restore Redis
redis-cli --rdb backup/redis.rdb

# 6. Start services
systemctl start opnsense-mcp
systemctl start redis

# 7. Verify recovery
./scripts/health-check.sh

# 8. Update DNS/Load balancer
# Point traffic to new instance
```

#### Data Corruption Recovery

```bash
# When: State file or cache corrupted

# 1. Stop service
systemctl stop opnsense-mcp

# 2. Backup corrupted data
mv data/state.json data/state.corrupted.$(date +%s)

# 3. Restore from last known good
cp /backups/opnsense-mcp/$(date +%Y%m%d)/data/state.json data/

# 4. Clear cache
redis-cli FLUSHDB

# 5. Restart and rebuild cache
systemctl start opnsense-mcp
curl -X POST http://localhost:3000/admin/cache/warm

# 6. Verify data integrity
npm run test:integrity
```

## 📈 Performance Tuning

### Quick Optimizations

```bash
# 1. Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=2048"

# 2. Enable clustering
pm2 start opnsense-mcp -i max

# 3. Optimize Redis
redis-cli CONFIG SET maxmemory 1gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 4. Enable compression
export ENABLE_COMPRESSION=true
export COMPRESSION_LEVEL=9

# 5. Increase cache TTL
export CACHE_DEFAULT_TTL=600
```

### Load Testing

```bash
# Run load test to find limits
npm run test:load

# Or use k6
k6 run load-test.js --vus 100 --duration 5m

# Monitor during test
watch -n 1 'ps aux | grep opnsense; echo; netstat -an | grep -c ESTABLISHED'
```

## 🔐 Security Procedures

### Security Incident Response

```bash
# When: Suspected security breach

# 1. ISOLATE
iptables -A INPUT -j DROP  # Block all incoming
iptables -A OUTPUT -j DROP  # Block all outgoing
iptables -A INPUT -s 10.0.0.0/8 -j ACCEPT  # Allow internal only

# 2. PRESERVE EVIDENCE
tar -czf /evidence/incident-$(date +%s).tar.gz /var/log /opt/opnsense-mcp

# 3. INVESTIGATE
grep -r "401\|403" logs/
last -100
netstat -an | grep ESTABLISHED

# 4. ROTATE CREDENTIALS
# Generate new API keys in OPNsense
# Update all secrets in vault
# Restart services with new credentials

# 5. REPORT
# Email: security@company.com
# Include: timeline, affected systems, actions taken
```

### Regular Security Tasks

```bash
# Weekly security scan
npm audit
nmap -sV localhost
nikto -h http://localhost:3000

# Monthly penetration test (staging)
./scripts/pentest.sh

# Quarterly security review
# Review access logs
# Update security documentation
# Rotate credentials
```

## 📋 Checklists

### New Team Member Onboarding
- [ ] Add to PagerDuty rotation
- [ ] Grant access to monitoring dashboards
- [ ] Provide runbook training
- [ ] Shadow on-call engineer
- [ ] Complete incident response training

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Rollback plan prepared
- [ ] Stakeholders notified

### Post-Incident Checklist
- [ ] Incident resolved and verified
- [ ] Root cause identified
- [ ] Post-mortem scheduled
- [ ] Action items documented
- [ ] Monitoring improved
- [ ] Runbook updated

---

*This runbook is a living document. Update it after each incident with lessons learned.*

**Last Updated**: 2025-01-07
**Version**: 1.0
**Owner**: Operations Team