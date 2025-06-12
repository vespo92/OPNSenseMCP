@echo off
REM Quick setup script for OPNSense MCP Server

echo Setting up OPNSense MCP Server...

REM Install dependencies
echo Installing dependencies...
call npm install

REM Build the project
echo Building TypeScript...
call npm run build

REM Copy example env file
if not exist .env (
    echo Creating .env file from example...
    copy .env.example .env
    echo Please edit .env with your OPNSense credentials
)

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Edit .env with your OPNSense API credentials
echo 2. Run 'npm start' to start the server
echo 3. Configure your MCP client to use this server
echo.
echo For Claude Desktop, add the config from examples\claude-desktop-config.json
echo to: %%APPDATA%%\Claude\claude_desktop_config.json
echo.
pause
