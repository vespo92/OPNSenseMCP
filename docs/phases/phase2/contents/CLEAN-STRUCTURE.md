# OPNSense MCP - Clean Project Structure

## Root Directory Files

### Core Configuration
- `.env` - Environment variables (API credentials)
- `.env.example` - Example environment file
- `.gitignore` - Git ignore rules
- `package.json` - Node.js dependencies and scripts
- `package-lock.json` - Locked dependency versions
- `tsconfig.json` - TypeScript configuration

### Build & Setup Scripts
- `build.bat` - Build the TypeScript project
- `setup.bat` - Initial setup script
- `setup.sh` - Setup script for Unix/Linux

### Troubleshooting Scripts (Phase 2)
- `troubleshoot.bat` - Interactive troubleshooting menu
- `run-tests.bat` - Run all tests and save to file
- `test-minimal.js` - Minimal connection test
- `explore-api.js` - API structure explorer
- `diagnose-comprehensive.js` - Comprehensive diagnostics
- `test-fixed.js` - Test with fixed client
- `test-endpoints.js` - Direct endpoint testing
- `test-curl.bat` - Raw curl API tests

### Documentation
- `README.md` - Main project documentation
- `PROJECT-OVERVIEW.md` - High-level project overview
- `PROJECT-STRUCTURE.md` - Detailed project structure
- `DEVELOPER.md` - Developer documentation

## Directory Structure

### `/src` - Source Code
- `/api` - API client implementations
  - `client.ts` - Main API client
  - `client-fixed.ts` - Fixed API client for troubleshooting
  - `client-fixed.js` - JavaScript version for testing
- `/resources` - Resource implementations (VLAN, Firewall, etc.)
- `/state` - State management
- `index.ts` - Main MCP server entry point

### `/dist` - Built JavaScript Files
- Mirror of `/src` structure with compiled JS files

### `/Phase2Docs` - Phase 2 Documentation
- `PHASE2-CURRENT-STATUS.md` - Current Phase 2 status
- `CURRENT-STATUS.md` - Overall status
- `READY-TO-TEST.md` - Testing readiness
- `TROUBLESHOOTING.md` - Troubleshooting guide
- `/testresults` - Test result files (timestamped)

### `/Phase1Docs` - Phase 1 Documentation
- Historical documentation from Phase 1

### `/Phase3Docs` - Phase 3 Documentation
- Planning documents for Phase 3

### `/examples` - Example Usage
- Example scripts and configurations

### `/tests` - Test Files
- Unit tests and integration tests

### `/roadmap` - Project Roadmap
- Future planning documents

### `/backup` - Backup Files
- Backup of important files

### `/VinnieSpecific` - User-specific Files
- Custom configurations and notes

### `/TODELETE` - Files to Remove
- Old test files and redundant scripts moved here for cleanup

### `/node_modules` - Dependencies
- NPM packages (git-ignored)

## Current Focus

We're in Phase 2, troubleshooting the OPNSense API connection. Use:

1. `run-tests.bat` - Quick automated test run
2. `troubleshoot.bat` - Interactive testing with menu

Test results are automatically saved to `Phase2Docs/testresults/` with timestamps.
