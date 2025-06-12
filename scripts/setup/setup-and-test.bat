@echo off
echo ========================================
echo OPNSense MCP Setup Check
echo ========================================
echo.

REM Check if .env file exists
if not exist .env (
    echo ERROR: .env file not found!
    echo.
    echo Please create a .env file with your OPNsense configuration:
    echo.
    echo 1. Copy .env.example to .env
    echo 2. Edit .env and add your OPNsense details:
    echo    - OPNSENSE_HOST=https://your-opnsense-ip
    echo    - OPNSENSE_API_KEY=your-api-key
    echo    - OPNSENSE_API_SECRET=your-api-secret
    echo.
    echo Creating .env from example...
    copy .env.example .env
    echo.
    echo Please edit the .env file with your OPNsense credentials.
    notepad .env
    pause
    exit /b 1
)

echo ✓ .env file found
echo.
echo Checking npm installation...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js first
    pause
    exit /b 1
)

echo ✓ npm is installed
echo.
echo Building the project...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    echo Please check for TypeScript errors
    pause
    exit /b 1
)

echo.
echo ✓ Build successful
echo.
echo Testing DHCP functionality...
echo.
node test-dhcp-fix.js

echo.
echo ========================================
echo Setup check completed!
echo ========================================
echo.
echo If DHCP is still not working:
echo 1. Verify your .env file has correct OPNsense credentials
echo 2. Run: node debug-dhcp-comprehensive.js
echo 3. Check DHCP-TROUBLESHOOTING.md
echo 4. Restart Claude Desktop after fixing
echo.
pause
