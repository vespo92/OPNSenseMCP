# Using applyResource Tool - Example

## Create a Single VLAN using applyResource

Now that Phase 1 is complete with the `applyResource` tool, you can create individual resources directly:

```json
{
  "tool": "applyResource",
  "arguments": {
    "action": "create",
    "resource": {
      "type": "opnsense:network:vlan",
      "name": "minecraft-vlan-202",
      "properties": {
        "tag": 202,
        "interface": "igc2",
        "description": "Minecraft Server VLAN"
      }
    }
  }
}
```

This will:
1. Create a Resource instance
2. Validate it
3. Generate the API payload
4. Create the VLAN in OPNSense
5. Apply the configuration

## Create the Interface

After the VLAN is created, create the interface:

```json
{
  "tool": "applyResource", 
  "arguments": {
    "action": "create",
    "resource": {
      "type": "opnsense:network:interface",
      "name": "minecraft-interface",
      "properties": {
        "device": "igc2.202",
        "enabled": true,
        "description": "Minecraft Server Network",
        "ipv4": {
          "type": "static",
          "address": "10.0.202.1",
          "subnet": 24
        }
      }
    }
  }
}
```

## Create Firewall Rules

Allow Minecraft traffic:

```json
{
  "tool": "applyResource",
  "arguments": {
    "action": "create",
    "resource": {
      "type": "opnsense:firewall:rule",
      "name": "allow-minecraft",
      "properties": {
        "interface": "wan",
        "action": "pass",
        "source": "any",
        "destination": "10.0.202.10",
        "destinationPort": "25565",
        "protocol": "tcp",
        "description": "Allow Minecraft connections"
      }
    }
  }
}
```

The `applyResource` tool provides direct resource manipulation without the complexity of deployment plans, making it perfect for single resource operations!
