@echo off
echo Building OPNSense MCP Server...
echo.

REM Build TypeScript
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
