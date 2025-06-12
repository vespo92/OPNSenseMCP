@echo off
echo Cleaning and building OPNSense MCP Server...
echo.

REM Clean dist directory
echo Cleaning dist directory...
if exist dist (
    rmdir /s /q dist
    echo Dist directory cleaned.
)

REM Install dependencies if needed
echo.
echo Installing dependencies...
call npm install

REM Build TypeScript
echo.
echo Compiling TypeScript...
call npx tsc

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed! See errors above.
    exit /b %ERRORLEVEL%
)

echo.
echo Build completed successfully!
echo Output files are in the dist/ directory.
echo.
echo To run the server:
echo   npm start
echo.
echo To test with Claude Desktop:
echo   1. Make sure Claude Desktop is closed
echo   2. Restart Claude Desktop
echo   3. Test the new firewall tools!
echo.
