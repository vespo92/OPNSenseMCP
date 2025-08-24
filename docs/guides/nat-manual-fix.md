# Manual NAT Fix Guide for DMZ Inter-VLAN Routing

## Problem Summary
Your DMZ network (10.0.6.0/24) traffic is being NAT'd to the WAN interface when communicating with internal networks (LAN, IoT, etc.). This breaks the return traffic path because the source IP gets rewritten.

## Root Cause
- OPNsense is applying NAT to ALL traffic going out the WAN interface
- Inter-VLAN traffic is incorrectly matching these NAT rules
- The source IP (10.0.6.x) gets rewritten to the WAN IP
- Return traffic can't find its way back to the DMZ

## Manual Fix Steps

### Step 1: Access NAT Configuration
1. Log into OPNsense web interface
2. Navigate to: **Firewall → NAT → Outbound**

### Step 2: Change NAT Mode to Hybrid
1. At the top of the Outbound NAT page, find the **Mode** dropdown
2. Change from **Automatic outbound NAT rule generation** to:
   - **Hybrid outbound NAT rule generation**
3. Click **Save** (don't apply yet)

> **Why Hybrid?** This mode keeps automatic NAT for internet traffic but allows you to add exception rules for internal traffic.

### Step 3: Create No-NAT Exception Rules

You need to create rules that prevent NAT for inter-VLAN traffic. Add these rules in order:

#### Rule 1: DMZ to LAN (No NAT)
Click the **+ Add** button and configure:
- **Interface**: WAN
- **Protocol**: any
- **Source**: 
  - Type: Network
  - Address: `10.0.6.0/24`
- **Destination**:
  - Type: Network  
  - Address: `10.0.0.0/24`
- **Translation/target**: 
  - **DO NOT NAT** ✓ (Check this box)
- **Description**: `No NAT: DMZ to LAN`
- Click **Save**

#### Rule 2: LAN to DMZ (No NAT)
Click **+ Add** again:
- **Interface**: WAN
- **Protocol**: any
- **Source**: 
  - Type: Network
  - Address: `10.0.0.0/24`
- **Destination**:
  - Type: Network
  - Address: `10.0.6.0/24`
- **Translation/target**: 
  - **DO NOT NAT** ✓ (Check this box)
- **Description**: `No NAT: LAN to DMZ`
- Click **Save**

#### Rule 3: DMZ to IoT (No NAT)
Click **+ Add** again:
- **Interface**: WAN
- **Protocol**: any
- **Source**: 
  - Type: Network
  - Address: `10.0.6.0/24`
- **Destination**:
  - Type: Network
  - Address: `10.0.2.0/24`
- **Translation/target**: 
  - **DO NOT NAT** ✓ (Check this box)
- **Description**: `No NAT: DMZ to IoT`
- Click **Save**

#### Rule 4: IoT to DMZ (No NAT)
Click **+ Add** again:
- **Interface**: WAN
- **Protocol**: any
- **Source**: 
  - Type: Network
  - Address: `10.0.2.0/24`
- **Destination**:
  - Type: Network
  - Address: `10.0.6.0/24`
- **Translation/target**: 
  - **DO NOT NAT** ✓ (Check this box)
- **Description**: `No NAT: IoT to DMZ`
- Click **Save**

### Step 4: Apply Changes
1. After all rules are created, click **Apply changes** at the top
2. Wait for the configuration to reload (usually 5-10 seconds)

### Step 5: Verify Rule Order
**CRITICAL**: The no-NAT rules MUST appear ABOVE the automatic NAT rules.

The order should look like:
1. No NAT: DMZ to LAN
2. No NAT: LAN to DMZ  
3. No NAT: DMZ to IoT
4. No NAT: IoT to DMZ
5. [Automatic NAT rules below]

If they're not in the right order, use the drag handles to reorder them.

## Testing the Fix

### From DMZ Node (10.0.6.2)
```bash
# Test connectivity to TrueNAS
ping 10.0.0.14

# Test NFS ports
nc -zv 10.0.0.14 111   # RPC port
nc -zv 10.0.0.14 2049  # NFS port

# Try mounting NFS
mount -t nfs 10.0.0.14:/mnt/SSDRAID/Kubes /mnt/test
```

### Check NAT Table (SSH/Console)
```bash
# See active NAT states
pfctl -s state | grep 10.0.6

# Check NAT rules
pfctl -s nat
```

## Troubleshooting

### If Traffic Still Doesn't Work
1. **Check Firewall Rules**: Ensure firewall rules allow the traffic (we already created these)
2. **Check States**: Clear existing states that might be using old NAT
   - Go to **Diagnostics → States → Reset**
   - Filter for 10.0.6.x addresses and reset those states
3. **Check Logs**: 
   - Go to **Firewall → Log Files → Live View**
   - Look for blocks involving 10.0.6.x addresses

### To Revert Changes
If you need to revert:
1. Go to **Firewall → NAT → Outbound**
2. Delete the manual rules you created
3. Change mode back to **Automatic**
4. Apply changes

## Expected Result
After applying these changes:
- DMZ nodes can reach internal networks with their real IP addresses
- Return traffic can properly route back to DMZ
- NFS mounts from DMZ to TrueNAS will work
- No impact on internet-bound traffic (still NAT'd properly)

## Alternative: Complete No-NAT for RFC1918
If you want to prevent NAT for ALL internal traffic:

Create a single rule:
- **Interface**: WAN
- **Protocol**: any
- **Source**: 
  - Type: Network
  - Address: `10.0.0.0/8`
- **Destination**:
  - Type: Network
  - Address: `10.0.0.0/8`
- **Translation/target**: 
  - **DO NOT NAT** ✓
- **Description**: `No NAT for all internal traffic`

This covers all 10.x.x.x to 10.x.x.x traffic.

## Why API Didn't Work
The OPNsense NAT API endpoints have changed between versions and don't match the documented patterns. The endpoints we tried:
- `/api/firewall/nat/outbound/get` - Returns 404
- `/api/firewall/nat/settings/get` - Returns different structure

This is why manual configuration is currently required for NAT exception rules.