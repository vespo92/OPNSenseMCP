# Firewall Rule Persistence Debug Implementation Summary

## Version: 0.7.5+

This document summarizes the comprehensive debugging enhancements and test suite implemented to address firewall rule persistence issues in the OPNsense MCP Server.

## Problem Statement

Firewall rules created via the API were not consistently appearing in the `list_firewall_rules` output, even though they could be retrieved individually via `get_firewall_rule`. This indicated a persistence or synchronization issue between rule creation and the list endpoint.

## Implemented Solutions

### 1. Enhanced FirewallRuleResource Class (`src/resources/firewall/rule.ts`)

#### Debug Mode
- Added `debugMode` flag controlled by `MCP_DEBUG` or `DEBUG_FIREWALL` environment variables
- Comprehensive logging throughout all operations
- Detailed request/response logging for API calls

#### New Methods
- **`debugInterfaces()`**: Discovers and validates interface names
- **`testAlternativeEndpoints()`**: Tests various API endpoints for rule retrieval
- **`forceApply()`**: Attempts multiple persistence methods sequentially
- **`createNFSRules()`**: Creates NFS connectivity rules for DMZ to TrueNAS
- **`validateNFSConnectivity()`**: Validates existing NFS rules

#### Improved Persistence Logic
- Enhanced `applyChanges()` method with multiple fallback strategies:
  1. `/firewall/filter/apply` - Standard apply
  2. `/firewall/filter/reconfigure` - Service reconfiguration
  3. `/firewall/filter/savepoint` - Configuration savepoint
  4. Additional methods tested in `forceApply()`

#### Rule Verification
- After creation, immediately verifies rule via `get()`
- Checks if rule appears in `list()`
- Warns if rule exists individually but not in list
- Automatically attempts `forceApply()` if persistence issue detected

### 2. Comprehensive Test Suite (`test-suite/`)

#### `firewall-rules.test.ts`
Complete test coverage including:
- **Test 1**: Interface Discovery - Validates interface mappings
- **Test 2**: Alternative Endpoints - Tests various API endpoints
- **Test 3**: CRUD Operations - Full create, read, update, delete cycle
- **Test 4**: NFS Rules - Creates and validates NFS connectivity rules
- **Test 5**: Persistence - Verifies rules persist after delays
- **Test 6**: Batch Creation - Tests multiple rule creation

#### `validate-nfs-connectivity.ts`
Production validation tool that:
- Checks existing NFS rules
- Creates missing rules (with `--create` flag)
- Provides diagnostic information
- Generates test commands
- Identifies blocking rules

#### `setup-test-env.ts`
Interactive setup script that:
- Guides users through environment configuration
- Creates `.env` file with proper settings
- Tests OPNsense connection
- Validates API credentials

### 3. Quick Debug Script (`debug-firewall-persistence.ts`)

Standalone script for rapid debugging:
- Creates a test rule
- Tests various persistence methods
- Provides immediate feedback
- Cleans up after testing
- Offers specific recommendations

## Usage Instructions

### Initial Setup
```bash
# Set up test environment
npm run test:setup

# This will interactively create your .env file with:
# - OPNsense host
# - API credentials
# - Interface configuration
```

### Running Tests

#### Full Test Suite
```bash
npm run test:firewall
```

#### NFS Connectivity Validation
```bash
# Check existing rules
npm run test:nfs

# Create missing rules
npm run test:nfs:create
```

#### Quick Debug
```bash
npm run debug:firewall
```

## Network Configuration Used

- **DMZ Network**: 10.0.6.0/24
- **DMZ Interface**: igc3_vlan6 (VLAN tag 6)
- **TrueNAS Server**: 10.0.0.14
- **DMZ Test Node**: 10.0.6.2
- **Required Ports**: 111 (RPC), 2049 (NFS) - both TCP and UDP

## Key Findings and Recommendations

### 1. Interface Naming
- OPNsense may use internal interface keys (e.g., `opt3`) rather than friendly names
- The `debugInterfaces()` method helps discover valid interface names
- Interface mappings can be configured via `OPNSENSE_INTERFACE_MAPPINGS` environment variable

### 2. Persistence Methods
- Simple `apply` may not be sufficient for persistence
- Combination of `apply` + `reconfigure` provides better results
- Some installations may require `savepoint` or system-level config save

### 3. Timing Issues
- Rules may take time to propagate to all endpoints
- Delays between apply and verification improve reliability
- The test suite includes appropriate delays for validation

### 4. API Endpoints
- `/firewall/filter/get` - Most reliable for getting all rules
- `/firewall/filter/searchRule` - Alternative with pagination support
- `/firewall/filter/getRule/{uuid}` - Individual rule retrieval

## Production Testing Commands

After creating NFS rules, validate from DMZ node:

```bash
# Test RPC portmapper
rpcinfo -p 10.0.0.14

# List NFS exports
showmount -e 10.0.0.14

# Test NFS mount
mount -t nfs 10.0.0.14:/mnt/tank/kubernetes /mnt/test
ls -la /mnt/test
umount /mnt/test
```

## Troubleshooting

### Rules Not Appearing in List
1. Enable debug mode: `export DEBUG_FIREWALL=true`
2. Run `npm run debug:firewall` to test persistence methods
3. Check OPNsense logs: `/var/log/configd.log`
4. Verify API user has full firewall permissions

### Interface Not Recognized
1. Run `npm run test:firewall` (Test 1 shows valid interfaces)
2. Use internal interface key instead of friendly name
3. Configure interface mapping in environment variables

### Rules Not Persisting
1. Check if both `apply` and `reconfigure` are being called
2. Verify no errors in API responses
3. Try manual config save in OPNsense UI after API creation
4. Check for conflicting or blocking rules

## File Structure

```
OPNSenseMCP/
├── src/resources/firewall/
│   └── rule.ts                    # Enhanced with debugging
├── test-suite/
│   ├── firewall-rules.test.ts     # Comprehensive test suite
│   ├── validate-nfs-connectivity.ts # NFS validation tool
│   ├── setup-test-env.ts          # Environment setup helper
│   └── README.md                   # Test documentation
├── debug-firewall-persistence.ts   # Quick debug script
└── FIREWALL-DEBUG-SUMMARY.md      # This document
```

## Next Steps

1. Run `npm run test:setup` to configure environment
2. Execute `npm run test:firewall` for full validation
3. Use `npm run test:nfs:create` to create NFS rules
4. Monitor with `npm run debug:firewall` for ongoing issues

## Success Metrics

✅ Rules appear immediately in `list_firewall_rules`
✅ Rules visible in OPNsense Web UI
✅ Rules show as "Applied" not "Pending"
✅ Network connectivity tests pass
✅ Rules persist after service restart

## Version History

- **0.7.5**: Initial debugging enhancements
- **0.7.5+**: Comprehensive test suite and validation tools added