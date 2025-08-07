@echo off
REM Phase 1 Testing Script for OPNSense MCP Server

echo ==========================================
echo Phase 1 Testing - OPNSense MCP Server
echo ==========================================
echo.

REM Step 1: Build the project
echo Step 1: Building the project...
echo Running: npm run build
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo [OK] Build successful!
) else (
    echo [ERROR] Build failed! Please check the errors above.
    exit /b 1
)

echo.
echo Step 2: Checking compiled output...
if exist "dist\index.js" (
    echo [OK] Main server file compiled: dist\index.js
) else (
    echo [ERROR] Main server file not found!
    exit /b 1
)

if exist "dist\resources\" (
    echo [OK] Resources compiled: dist\resources\
) else (
    echo [ERROR] Resources not compiled!
    exit /b 1
)

if exist "dist\state\" (
    echo [OK] State management compiled: dist\state\
) else (
    echo [ERROR] State management not compiled!
    exit /b 1
)

echo.
echo ==========================================
echo Phase 1 Testing Results
echo ==========================================
echo [OK] TypeScript compilation: PASSED
echo [OK] All required modules: COMPILED
echo [OK] Phase 1 Status: COMPLETE
echo.
echo Next Steps:
echo 1. Update claude_desktop_config.json with your OPNSense credentials
echo 2. Restart Claude Desktop
echo 3. Test the applyResource tool with a simple resource
echo.
echo Example test command:
echo await use_tool("applyResource", {
echo   action: "create",
echo   resource: {
echo     type: "opnsense:firewall:alias",
echo     name: "test-alias",
echo     properties: {
echo       type: "host",
echo       content: ["192.168.1.100"],
echo       description: "Test alias from Phase 1"
echo     }
echo   }
echo });
echo.
pause
