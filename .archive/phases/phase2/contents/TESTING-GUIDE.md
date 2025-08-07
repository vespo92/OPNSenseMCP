# Phase 2 Testing Guide

## 🚀 Quick Start

Run the complete test suite:
```bash
run-all-tests.bat
```

This will:
1. Test API connection
2. Run comprehensive VLAN tests
3. List existing VLANs
4. Optionally create VLAN 120 for Minecraft

## 📋 Individual Test Scripts

### Connection Test
```bash
node test-quick.js
```
Tests basic API connectivity and lists existing VLANs.

### Comprehensive VLAN Test
```bash
node test-vlan-comprehensive.js
```
Tests all VLAN operations: create, read, update, delete.

### List VLANs
```bash
node list-vlans.js
```
Shows all configured VLANs with their UUIDs.

### Create Minecraft VLAN
```bash
node create-minecraft-vlan.js
```
Creates VLAN 120 specifically for the Minecraft server.

### Delete a VLAN
```bash
node delete-vlan.js <uuid>
```
Deletes a VLAN by its UUID (get UUID from list-vlans.js).

## 🔍 What to Look For

### Successful Output
```
✅ Connection successful
✅ Found X VLANs
✅ VLAN created with UUID: xxx
✅ Configuration applied
✅ VLAN updated successfully
✅ VLAN deleted successfully
```

### Common Issues

1. **SSL Certificate Error**
   - Set `OPNSENSE_VERIFY_SSL=false` in .env
   - Or add the certificate to trusted roots

2. **401 Unauthorized**
   - Check API key and secret in .env
   - Verify user has correct permissions

3. **400 Bad Request**
   - Enable debug mode: `set OPNSENSE_DEBUG=true`
   - Check the payload format in debug output

4. **VLAN Already Exists**
   - Run `node list-vlans.js` to see existing VLANs
   - Delete with `node delete-vlan.js <uuid>`

## 🎮 Minecraft VLAN Setup

After creating VLAN 120, you need to:

1. **Assign Interface**
   - Go to Interfaces → Assignments
   - Add igc3.120
   - Enable and configure

2. **Set IP Address**
   - IP: 10.2.120.1
   - Subnet: 24

3. **Configure DHCP**
   - Range: 10.2.120.100 - 10.2.120.199
   - Gateway: 10.2.120.1

4. **Add Firewall Rules**
   - Allow Minecraft: TCP/UDP 25565
   - Allow management access as needed

## 🐛 Debug Mode

Enable detailed API logging:
```bash
set OPNSENSE_DEBUG=true
```

This shows:
- Every API request (method, URL, payload)
- Every API response (status, data)
- Detailed error messages

## ✅ Success Criteria

The Phase 2 VLAN implementation is working when:
- [ ] Connection test passes
- [ ] Can create a new VLAN
- [ ] Can update VLAN properties
- [ ] Can delete a VLAN
- [ ] Changes are applied to OPNsense
- [ ] VLAN 120 can be created for Minecraft

## 🔧 Next Steps

Once tests pass:
1. Update remaining resources (Firewall, Interface, etc.)
2. Test complex deployments
3. Add network discovery tools
4. Implement HAProxy management

## 📝 Notes

- VLANs are created on igc3 (your trunk port)
- Each VLAN needs interface assignment after creation
- Always apply/reconfigure after changes
- Check OPNsense UI to verify changes

---

**Ready? Run `run-all-tests.bat` to begin!** 🚀
