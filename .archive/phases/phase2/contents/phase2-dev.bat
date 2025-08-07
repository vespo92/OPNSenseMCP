@echo off
echo ========================================
echo Phase 2 Development Helper
echo ========================================
echo.

:menu
echo What would you like to do?
echo.
echo 1. Rebuild TypeScript (npm run build)
echo 2. Test MCP connection
echo 3. Open API Discovery Helper
echo 4. View API endpoint mappings
echo 5. Check build output
echo 6. Exit
echo.
set /p choice="Enter choice (1-6): "

if "%choice%"=="1" goto rebuild
if "%choice%"=="2" goto test
if "%choice%"=="3" goto discovery
if "%choice%"=="4" goto endpoints
if "%choice%"=="5" goto checkbuild
if "%choice%"=="6" goto end

:rebuild
echo.
echo Rebuilding TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ Build failed! Check the errors above.
    pause
) else (
    echo.
    echo ✅ Build successful!
    echo.
    echo Don't forget to restart the MCP server in Claude Desktop!
    pause
)
goto menu

:test
echo.
echo Testing MCP connection...
echo.
echo Run this in Claude Desktop console:
echo.
echo await use_mcp_tool("opnsense", "listResourceTypes", {});
echo.
pause
goto menu

:discovery
echo.
echo Opening API Discovery Helper...
start api-discovery-helper.html
echo.
echo Helper opened in your browser!
pause
goto menu

:endpoints
echo.
echo Current API Endpoints (src\index.ts):
echo =====================================
echo.
findstr /C:"create:" /C:"update:" /C:"delete:" /C:"apply:" src\index.ts
echo.
echo These need to be verified with DevTools!
echo.
pause
goto menu

:checkbuild
echo.
echo Checking build output...
echo.
dir dist\*.js
echo.
echo Last build time:
for %%f in (dist\index.js) do echo %%~tf
echo.
pause
goto menu

:end
echo.
echo Happy coding! 🚀
echo Remember: Fix the API first, then add new features!
timeout /t 2 >nul
