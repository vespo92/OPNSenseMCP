# Backup and Restore Guide

Protect your OPNsense configuration with comprehensive backup and restore capabilities.

## Overview

Backup and restore features:
- Full configuration backups
- Selective component backup
- Scheduled automatic backups
- Version control integration
- Disaster recovery
- Configuration migration

## Prerequisites

- Administrative access to OPNsense
- Storage location for backups
- Understanding of configuration components
- MCP server connected

## Quick Commands

### Create Backup

```
"Create a full backup of OPNsense configuration"
```

```
"Backup firewall rules and VLANs with description 'Before upgrade'"
```

### Restore Configuration

```
"Restore OPNsense configuration from latest backup"
```

```
"Restore firewall rules from yesterday's backup"
```

### List Backups

```
"Show all available backups"
```

```
"List backups from this week"
```

## Backup Types

### Full Configuration Backup

Includes everything:
- System settings
- Network configuration  
- Firewall rules
- VLANs
- DHCP settings
- DNS configuration
- VPN settings
- Certificates
- User accounts

```
"Create complete configuration backup named 'full-backup-2024-01-15'"
```

### Selective Backup

Backup specific components:

```
"Backup only:
- Firewall rules
- NAT configuration
- Aliases"
```

### Incremental Backup

Track changes over time:

```
"Create incremental backup showing changes since last backup"
```

## Backup Strategies

### 3-2-1 Rule

Best practice backup strategy:
- **3** copies of data
- **2** different storage types
- **1** offsite copy

```
"Implement 3-2-1 backup:
1. Local backup on OPNsense
2. Network storage backup
3. Cloud backup"
```

### Backup Schedule

Recommended schedule:

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full | Weekly | 4 weeks |
| Incremental | Daily | 7 days |
| Before changes | As needed | 30 days |
| Archive | Monthly | 1 year |

### Automated Backups

Set up automatic backups:

```
"Schedule automatic backups:
- Daily at 2 AM
- Keep 30 days
- Store on NAS at 192.168.1.10
- Email notification on failure"
```

## Backup Storage

### Local Storage

Store on OPNsense:

```
"Save backup locally:
- Location: /conf/backup
- Filename: config-2024-01-15.xml
- Compress: Yes"
```

### Network Storage

Save to NAS/File server:

```
"Configure network backup:
- Protocol: SMB/CIFS
- Server: 192.168.1.10
- Share: backups/opnsense
- Credentials: backup_user"
```

### Cloud Storage

Backup to cloud:

```
"Set up cloud backup:
- Service: S3-compatible
- Bucket: opnsense-backups
- Encryption: AES-256
- Versioning: Enabled"
```

### Git Repository

Version control for configs:

```
"Initialize git backup:
- Repository: configs repo
- Branch: opnsense-main
- Commit message: Auto-backup
- Push on change"
```

## Restore Operations

### Full Restore

Complete configuration restore:

```
"Restore full configuration:
1. Select backup file
2. Verify backup integrity
3. Create current backup first
4. Apply restoration
5. Reboot if required"
```

### Partial Restore

Restore specific sections:

```
"Restore only firewall rules from backup:
- Keep current VLANs
- Keep current DHCP
- Replace firewall rules only"
```

### Rollback Changes

Undo recent changes:

```
"Rollback to configuration from 1 hour ago"
```

## Disaster Recovery

### Recovery Planning

Prepare for failures:

```yaml
Disaster Recovery Plan:
  Documentation:
    - Network diagram
    - IP assignments
    - VLAN mappings
    - Critical services
  
  Backups:
    - Configuration files
    - Certificates
    - Custom scripts
    - Documentation
  
  Recovery:
    - Fresh OPNsense install
    - Restore configuration
    - Verify connectivity
    - Test services
```

### Hardware Failure

Steps for hardware replacement:

```
"Hardware failure recovery:
1. Install OPNsense on new hardware
2. Configure management interface
3. Access web GUI
4. Restore latest backup
5. Adjust interface assignments
6. Verify all services"
```

### Corruption Recovery

Fix corrupted configuration:

```
"Recover from corruption:
1. Boot in safe mode
2. Access console
3. Restore factory defaults
4. Apply clean backup
5. Verify functionality"
```

## Configuration Management

### Version Control

Track configuration changes:

```
"Enable configuration versioning:
- Keep 50 versions
- Auto-save on change
- Add change descriptions
- Compare versions"
```

### Change Tracking

Monitor what changed:

```
"Show configuration changes:
- Since yesterday
- By user admin
- Affecting firewall rules"
```

### Configuration Diff

Compare configurations:

```
"Compare current config with:
- Yesterday's config
- Last week's config
- Specific backup file"
```

## Migration and Cloning

### Migrate to New Hardware

Move configuration:

```
"Migrate OPNsense:
1. Backup source config
2. Note interface mappings
3. Install on new hardware
4. Restore configuration
5. Remap interfaces
6. Verify services"
```

### Clone Configuration

Duplicate setup:

```
"Clone configuration for:
- Lab environment
- Standby system
- Branch office
Excluding: Certificates, IPs"
```

### Template Configuration

Create reusable templates:

```
"Create template:
- Basic firewall rules
- Standard VLANs
- Common services
- Remove specifics"
```

## Best Practices

### 1. Regular Backups
- Daily automatic backups
- Before any changes
- After successful changes
- Weekly archives

### 2. Testing Restores
- Verify backup integrity
- Test restore process
- Document procedures
- Practice recovery

### 3. Documentation
- Label backups clearly
- Document changes
- Keep restore instructions
- Update network diagrams

### 4. Security
- Encrypt sensitive backups
- Secure storage access
- Limit restore permissions
- Audit backup access

## Backup Validation

### Verify Integrity

Check backup health:

```
"Validate backup file:
- Check XML structure
- Verify completeness
- Test decryption
- Confirm size"
```

### Test Restore

Verify restorability:

```
"Test restore process:
1. Set up test system
2. Restore backup
3. Verify configuration
4. Check all services
5. Document issues"
```

## Troubleshooting

### Backup Failures

Common issues and solutions:

```
"Backup troubleshooting:
- Storage full: Clean old backups
- Permission denied: Check credentials
- Network unreachable: Verify connectivity
- Timeout: Increase timeout value"
```

### Restore Problems

Fix restore issues:

```
"Restore troubleshooting:
- Version mismatch: Check compatibility
- Corrupt file: Use alternate backup
- Partial restore: Check components
- Service failure: Restart services"
```

### Missing Configuration

Recover lost settings:

```
"If configuration lost:
1. Check auto-backups
2. Review version history
3. Check alternate storage
4. Rebuild from documentation"
```

## Automation

### Backup Scripts

Automate backup tasks:

```bash
#!/bin/bash
# Daily backup script
DATE=$(date +%Y%m%d)
BACKUP_FILE="opnsense-backup-$DATE.xml"

# Create backup
create_backup $BACKUP_FILE

# Copy to NAS
copy_to_nas $BACKUP_FILE

# Rotate old backups
rotate_backups 30
```

### Monitoring

Alert on backup issues:

```
"Set backup monitoring:
- Alert if backup fails
- Warn if backup missing
- Check backup size
- Verify backup age"
```

### Integration

Connect with other systems:

```
"Integrate backups with:
- Monitoring system
- Ticketing system
- Configuration management
- Documentation wiki"
```

## Advanced Features

### Encrypted Backups

Secure sensitive data:

```
"Enable backup encryption:
- Algorithm: AES-256
- Password protect
- Secure key storage
- Encrypted transport"
```

### Differential Backups

Save only changes:

```
"Configure differential backup:
- Base: Weekly full
- Daily: Changes only
- Merge on restore
- Save storage space"
```

### Multi-Site Sync

Synchronize multiple sites:

```
"Sync configurations:
- Master: HQ OPNsense
- Slaves: Branch offices
- Selective sync
- Conflict resolution"
```

## Recovery Time Objectives

### RTO Planning

Define recovery targets:

| Scenario | RTO | RPO | Method |
|----------|-----|-----|--------|
| Config change | 5 min | 0 | Version history |
| Service failure | 15 min | 1 hour | Recent backup |
| Hardware failure | 1 hour | 1 day | Spare + backup |
| Site disaster | 4 hours | 1 day | Cloud backup |

### Recovery Procedures

Document step-by-step:

```
"Create recovery runbook:
1. Assessment steps
2. Decision tree
3. Recovery procedures
4. Verification tests
5. Escalation paths"
```

## Compliance and Auditing

### Audit Trail

Track backup activities:

```
"Audit backup operations:
- Who created backup
- When created
- What was backed up
- Where stored
- Access logs"
```

### Compliance Requirements

Meet regulatory needs:

```
"Compliance settings:
- Retention period: 7 years
- Encryption: Required
- Access control: Role-based
- Audit logging: Enabled"
```

## API Reference

### Backup Tools
- `createBackup` - Create backup
- `listBackups` - Show backups
- `restoreBackup` - Restore config
- `deleteBackup` - Remove backup

### Related Tools
- `compareConfigs` - Diff configurations
- `getConfigHistory` - Version history
- `validateBackup` - Check integrity

## Next Steps

- Learn about [Disaster Recovery](../deployment/production.md#disaster-recovery)
- Explore [High Availability](../deployment/production.md#high-availability)
- Read about [Configuration Management](../iac/overview.md)

## Related Documentation

- [Security Best Practices](../deployment/production.md#security)
- [IaC Patterns](../iac/patterns.md#configuration-management)
- [Troubleshooting](../troubleshooting/common-issues.md#backup-restore)