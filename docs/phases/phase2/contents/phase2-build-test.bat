@echo off
echo Phase 2 - Build and Test Script
echo ==============================
echo.

echo Building TypeScript...
call npx tsc

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed! See errors above.
    exit /b %ERRORLEVEL%
)

echo.
echo Build successful!
echo.

echo Running VLAN API test...
echo.
set OPNSENSE_DEBUG=true
node phase2docs/test-vlan-updated.js

echo.
echo Done!
pause
