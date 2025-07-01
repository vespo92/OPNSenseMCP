# Macro Recording System Guide

## Overview

The OPNsense MCP server now includes a powerful macro recording system that allows you to:

1. **Record** any sequence of API calls made through the MCP server
2. **Analyze** recordings to automatically detect parameters and patterns
3. **Playback** recorded macros with parameter substitution
4. **Generate** MCP tool definitions from recordings
5. **Share** macros by exporting and importing them

This "clever approach" makes extending the MCP server incredibly easy - just perform the actions once while recording, and the system will generate reusable tools automatically.

## How It Works

### Recording Architecture

```
User Action → MCP Tool → API Client (with Recorder) → OPNsense API
                              ↓
                        Macro Storage ← Recording
```

Every API call made through the client is intercepted and recorded with:
- HTTP method and path
- Request payload
- Response data
- Timing information
- Error states

### Intelligent Analysis

The macro analyzer examines recordings to:
- Detect variable values that should be parameters
- Identify resource creation/read/update/delete patterns
- Find dependencies between API calls
- Suggest parameter types and validation rules

## Macro Recording Tools

### 1. Start Recording

```json
{
  "tool": "macro_start_recording",
  "args": {
    "name": "create-vlan-with-rules",
    "description": "Create a VLAN and configure firewall rules"
  }
}
```

### 2. Perform Actions

While recording is active, use any MCP tools normally:

```json
{
  "tool": "create_vlan",
  "args": {
    "interface": "igc3",
    "tag": "100",
    "description": "Test VLAN"
  }
}
```

### 3. Stop Recording

```json
{
  "tool": "macro_stop_recording"
}
```

This saves the macro with auto-detected parameters.

### 4. List Macros

```json
{
  "tool": "macro_list"
}
```

Returns:
```json
[
  {
    "id": "uuid-here",
    "name": "create-vlan-with-rules",
    "description": "Create a VLAN and configure firewall rules",
    "created": "2024-01-20T10:00:00Z",
    "callCount": 3,
    "parameters": 2
  }
]
```

### 5. Analyze Macro

```json
{
  "tool": "macro_analyze",
  "args": {
    "id": "macro-uuid"
  }
}
```

Returns detailed analysis:
```json
{
  "patterns": {
    "creates": ["vlan", "firewall_rule"],
    "reads": ["interfaces"],
    "updates": [],
    "deletes": []
  },
  "parameterSuggestions": [
    {
      "name": "vlanTag",
      "type": "string",
      "required": true,
      "description": "VLAN tag number",
      "validation": {
        "pattern": "^[0-9]{1,4}$",
        "minimum": 1,
        "maximum": 4094
      }
    },
    {
      "name": "interfaceName",
      "type": "string",
      "required": true,
      "description": "Physical interface name"
    }
  ],
  "toolSuggestion": {
    "name": "create_vlan_with_rules",
    "description": "Create a VLAN and configure firewall rules",
    "inputSchema": {
      "type": "object",
      "properties": {
        "vlanTag": {
          "type": "string",
          "pattern": "^[0-9]{1,4}$"
        },
        "interfaceName": {
          "type": "string"
        }
      },
      "required": ["vlanTag", "interfaceName"]
    }
  }
}
```

### 6. Generate Tool

```json
{
  "tool": "macro_generate_tool",
  "args": {
    "id": "macro-uuid",
    "save": true
  }
}
```

This generates a complete TypeScript tool implementation that can be added to the MCP server.

### 7. Playback Macro

```json
{
  "tool": "macro_play",
  "args": {
    "id": "macro-uuid",
    "parameters": {
      "vlanTag": "200",
      "interfaceName": "igc2"
    },
    "dryRun": false
  }
}
```

Dry run mode shows what would be executed without making actual API calls.

## Advanced Features

### Export/Import Macros

Export all macros:
```json
{
  "tool": "macro_export",
  "args": {
    "path": "/path/to/macros-export.json"
  }
}
```

Import macros:
```json
{
  "tool": "macro_import",
  "args": {
    "path": "/path/to/macros-export.json",
    "overwrite": false
  }
}
```

### Parameter Detection

The system automatically detects:
- **IP Addresses**: Validated with regex pattern
- **Port Numbers**: Validated with min/max range
- **UUIDs**: Detected from API responses
- **Domain Names**: Validated with pattern
- **Repeated Values**: Suggests parameterization

### Generated Tool Example

Here's what a generated tool looks like:

```typescript
case 'create_vlan_with_firewall': {
  if (!this.client) {
    throw new McpError(
      ErrorCode.InternalError,
      'Not configured. Use configure tool first.'
    );
  }
  
  if (!args || !args.vlanTag || !args.interfaceName) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'vlanTag, interfaceName parameter(s) required'
    );
  }
  
  try {
    // Create VLAN
    const result1 = await this.client.post('/interfaces/vlan/addItem', {
      "vlan": {
        "if": args.interfaceName,
        "tag": args.vlanTag,
        "descr": `VLAN ${args.vlanTag}`
      }
    });
    
    // Apply changes
    const result2 = await this.client.post('/interfaces/vlan/reconfigure');
    
    // Create firewall rule
    const result3 = await this.client.post('/firewall/filter/addRule', {
      "rule": {
        "enabled": "1",
        "action": "pass",
        "interface": `vlan${args.vlanTag}`,
        "direction": "in",
        "protocol": "any",
        "source_net": "any",
        "destination_net": "any"
      }
    });
    
    return {
      content: [{
        type: 'text',
        text: `Successfully completed create_vlan_with_firewall. UUID: ${result1.uuid}`
      }]
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      error.message
    );
  }
}
```

## Use Cases

### 1. Learning the API

Record while exploring the OPNsense web UI to discover API endpoints:
1. Start recording with a descriptive name
2. Perform actions in the UI while monitoring network traffic
3. Stop recording and analyze to see the API calls

### 2. Creating Complex Workflows

Record multi-step processes:
1. Create a VLAN
2. Configure DHCP for it
3. Add firewall rules
4. Set up NAT

The macro captures the entire workflow with proper sequencing.

### 3. Building a Library

Create a collection of common operations:
- `setup_guest_network` - Complete guest network setup
- `configure_vpn_user` - Add VPN user with firewall rules
- `backup_and_update` - Backup config before updates

### 4. Testing and Development

Use dry-run mode to:
- Test parameter substitution
- Verify API call sequences
- Debug without side effects

## Best Practices

1. **Name Descriptively**: Use clear names like `create_minecraft_server_rules`
2. **Record Minimal Steps**: Only record necessary API calls
3. **Test Parameters**: Use the analyzer to verify detected parameters
4. **Document Macros**: Add detailed descriptions for sharing
5. **Version Control**: Export macros to Git for team sharing

## Storage

Macros are stored in:
- Default: `.opnsense-macros/` in the current directory
- Custom: Set `MACRO_STORAGE_PATH` environment variable

Each macro is saved as a JSON file with full API call history.

## Limitations

- Binary data in API calls is not recorded
- Timing dependencies may need manual adjustment
- Some dynamic values (timestamps) need parameterization

## Example Workflow

Here's a complete example of creating a reusable tool:

```bash
# 1. Start recording
macro_start_recording {
  "name": "setup_iot_vlan",
  "description": "Create IoT VLAN with isolated network rules"
}

# 2. Create VLAN
create_vlan {
  "interface": "igc3",
  "tag": "50",
  "description": "IoT Network"
}

# 3. Create isolation rules
create_firewall_rule {
  "action": "block",
  "interface": "vlan50",
  "direction": "in",
  "source": "any",
  "destination": "192.168.1.0/24",
  "description": "Block IoT to LAN"
}

# 4. Stop recording
macro_stop_recording

# 5. Analyze the macro
macro_analyze { "id": "generated-uuid" }

# 6. Generate tool
macro_generate_tool { 
  "id": "generated-uuid",
  "save": true
}

# 7. Now you can use the generated tool:
setup_iot_vlan {
  "vlanTag": "60",
  "interfaceName": "igc2",
  "lanNetwork": "192.168.2.0/24"
}
```

## Integration with MCP Server

The generated tools can be:
1. Saved to `generated-tools/` directory
2. Manually added to the MCP server
3. Dynamically loaded (future feature)

This makes the MCP server self-extending - use it to build itself!