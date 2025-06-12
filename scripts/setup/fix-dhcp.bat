@echo off
echo ========================================
echo OPNSense MCP DHCP Fix Script
echo ========================================
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js first
    pause
    exit /b 1
)

echo Step 1: Building the project...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    echo Please check for TypeScript errors
    pause
    exit /b 1
)

echo.
echo Step 2: Testing DHCP functionality...
echo.
node test-dhcp-fix.js

echo.
echo ========================================
echo Fix process completed!
echo ========================================
echo.
echo If DHCP is still not working:
echo 1. Run: node debug-dhcp-comprehensive.js
echo 2. Check DHCP-TROUBLESHOOTING.md
echo 3. Restart Claude Desktop after fixing
echo.
pause
