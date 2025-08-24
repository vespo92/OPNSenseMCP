# SSH/CLI Execution

## Overview

The SSH Executor provides direct command-line access to OPNsense for operations not available through the REST API. This enables full control over firewall configuration, including NAT rules, system settings, and advanced diagnostics.

## Architecture

```
MCP Tool → SSH Resource → SSH2 Connection → OPNsense CLI → Response
```

## Features

- **Secure SSH Connection**: Support for password and key-based authentication
- **Command Execution**: Run any OPNsense CLI command
- **Configuration Management**: Direct XML config manipulation
- **System Control**: Service restarts, apply changes, diagnostics
- **Batch Operations**: Execute multiple commands in sequence

## Configuration

### Environment Variables
```bash
# Required
OPNSENSE_SSH_HOST=opnsense.example.com
OPNSENSE_SSH_USERNAME=root

# Choose one authentication method:
# Password
OPNSENSE_SSH_PASSWORD=your_password

# Or SSH Key
OPNSENSE_SSH_KEY_PATH=~/.ssh/id_rsa

# Optional
OPNSENSE_SSH_PORT=22
```

## MCP Tools

### system_execute_command
Execute any CLI command on OPNsense.
```javascript
await mcp.call('system_execute_command', {
  command: 'pfctl -s state | grep 10.0.6'
});
```

### Common Commands

#### Check Firewall States
```javascript
// View active connections
await mcp.call('system_execute_command', {
  command: 'pfctl -s state'
});
```

#### Apply Configuration Changes
```javascript
// Reload filter rules
await mcp.call('system_execute_command', {
  command: 'configctl filter reload'
});
```

#### View NAT Rules
```javascript
// Show NAT table
await mcp.call('system_execute_command', {
  command: 'pfctl -s nat'
});
```

#### Backup Configuration
```javascript
// Create config backup
await mcp.call('system_execute_command', {
  command: 'cp /conf/config.xml /conf/config.xml.backup'
});
```

## SSH Executor Implementation

The SSH executor (`src/resources/ssh/executor.ts`) provides:

### Core Methods
- `connect()`: Establish SSH connection
- `executeCommand()`: Run single command
- `executeMultiple()`: Run command batch
- `disconnect()`: Close connection

### XML Configuration Management
- `readConfig()`: Read `/conf/config.xml`
- `writeConfig()`: Write configuration changes
- `backupConfig()`: Create configuration backup
- `applyChanges()`: Reload services

### Safety Features
- Automatic connection management
- Command timeout handling
- Error recovery
- Configuration backup before changes

## Use Cases

### NAT Configuration
Since NAT API doesn't exist, SSH is used for:
```javascript
// Read NAT config
const config = await ssh.readConfig();
const nat = parseXML(config).nat;

// Modify and save
config.nat.outbound.mode = 'hybrid';
await ssh.writeConfig(config);
await ssh.executeCommand('configctl filter reload');
```

### System Diagnostics
```javascript
// Check routing table
await mcp.call('system_execute_command', {
  command: 'netstat -rn'
});

// View interface status
await mcp.call('system_execute_command', {
  command: 'ifconfig -a'
});
```

### Service Management
```javascript
// Restart service
await mcp.call('system_execute_command', {
  command: 'configctl webgui restart'
});

// Check service status
await mcp.call('system_execute_command', {
  command: 'configctl configd status'
});
```

## Security Considerations

### Authentication
- Use SSH keys when possible (more secure than passwords)
- Store credentials in environment variables, never in code
- Use `.env` file and ensure it's in `.gitignore`

### Command Execution
- Commands run with provided user privileges
- Validate and sanitize any user input
- Use read-only commands when possible
- Always backup before configuration changes

### Connection Management
- Connections auto-close after operations
- Timeout prevents hanging connections
- Rate limiting prevents abuse

## Error Handling

### Connection Errors
```javascript
try {
  await ssh.connect();
} catch (error) {
  if (error.message.includes('ECONNREFUSED')) {
    console.log('SSH service not running');
  } else if (error.message.includes('Authentication failed')) {
    console.log('Invalid credentials');
  }
}
```

### Command Errors
```javascript
const result = await ssh.executeCommand('invalid-command');
if (result.code !== 0) {
  console.error('Command failed:', result.stderr);
}
```

## Testing

### Test SSH Connection
```bash
npx tsx scripts/test/test-ssh.ts
```

### Test CLI Execution
```bash
npx tsx scripts/test/test-cli.ts
```

## Limitations

- Requires SSH access to be enabled on OPNsense
- User must have appropriate privileges
- Some operations require root access
- Interactive commands not supported

## Integration with Other Features

The SSH executor enables:
- **NAT Management**: Direct XML config manipulation
- **Routing Diagnostics**: Execute diagnostic commands
- **System Configuration**: Modify settings not in API
- **Advanced Troubleshooting**: Access to all CLI tools

## Version History

- **v0.8.2**: Enhanced for NAT configuration management
- **v0.8.0**: Initial SSH executor implementation
- **v0.7.6**: Identified need for CLI access