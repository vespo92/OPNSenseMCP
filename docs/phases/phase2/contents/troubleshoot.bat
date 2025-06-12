@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  OPNsense API Troubleshooting Suite
echo ========================================
echo.

:: Create timestamp for filename
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%_%dt:~8,2%-%dt:~10,2%-%dt:~12,2%"
set "resultfile=Phase2Docs\testresults\test-results-%timestamp%.txt"

echo Results will be saved to: %resultfile%
echo.

:menu
echo Select a test to run:
echo 1. Minimal Connection Test
echo 2. Explore API Structure
echo 3. Comprehensive Diagnostics
echo 4. Test with Fixed Client
echo 5. Direct Endpoint Test
echo 6. Run test-curl.bat
echo 7. Run ALL tests (saves to file)
echo 8. Run ALL tests (display only)
echo 0. Exit
echo.

set /p choice="Enter your choice (0-8): "

if "%choice%"=="1" goto minimal
if "%choice%"=="2" goto explore
if "%choice%"=="3" goto diagnose
if "%choice%"=="4" goto fixed
if "%choice%"=="5" goto endpoints
if "%choice%"=="6" goto curl
if "%choice%"=="7" goto allfile
if "%choice%"=="8" goto alldisplay
if "%choice%"=="0" goto end

:minimal
echo.
echo Running Minimal Connection Test...
echo --------------------------------
node test-minimal.js
pause
goto menu

:explore
echo.
echo Running API Structure Explorer...
echo --------------------------------
node explore-api.js
pause
goto menu

:diagnose
echo.
echo Running Comprehensive Diagnostics...
echo -----------------------------------
node diagnose-comprehensive.js
pause
goto menu

:fixed
echo.
echo Testing with Fixed Client...
echo ---------------------------
node test-fixed.js
pause
goto menu

:endpoints
echo.
echo Testing Direct Endpoints...
echo --------------------------
node test-endpoints.js
pause
goto menu

:curl
echo.
echo Running curl tests...
echo --------------------
call test-curl.bat
goto menu

:allfile
echo.
echo Running ALL tests and saving to file...
echo =======================================
echo.
echo Test results will be saved to:
echo %resultfile%
echo.

(
    echo ========================================
    echo  OPNsense API Test Results
    echo  Date: %date% %time%
    echo ========================================
    echo.
    echo.
    echo [1/6] MINIMAL CONNECTION TEST
    echo ==============================
    echo.
    node test-minimal.js 2>&1
    echo.
    echo.
    echo [2/6] API STRUCTURE EXPLORER
    echo ============================
    echo.
    node explore-api.js 2>&1
    echo.
    echo.
    echo [3/6] COMPREHENSIVE DIAGNOSTICS
    echo ===============================
    echo.
    node diagnose-comprehensive.js 2>&1
    echo.
    echo.
    echo [4/6] FIXED CLIENT TEST
    echo =======================
    echo.
    node test-fixed.js 2>&1
    echo.
    echo.
    echo [5/6] ENDPOINT TEST
    echo ===================
    echo.
    node test-endpoints.js 2>&1
    echo.
    echo.
    echo [6/6] CURL TEST
    echo ===============
    echo.
    call test-curl.bat 2>&1
    echo.
    echo.
    echo ========================================
    echo  All tests completed!
    echo  Results saved to: %resultfile%
    echo ========================================
) > "%resultfile%"

echo.
echo Tests completed! Results saved to:
echo %resultfile%
echo.
echo Would you like to view the results? [Y/N]
set /p viewresults=
if /i "%viewresults%"=="Y" (
    notepad "%resultfile%"
)
pause
goto menu

:alldisplay
echo.
echo Running ALL tests (display only)...
echo ===================================
echo.
echo [1/6] Minimal Test
node test-minimal.js
echo.
echo [2/6] API Explorer
node explore-api.js
echo.
echo [3/6] Comprehensive Diagnostics
node diagnose-comprehensive.js
echo.
echo [4/6] Fixed Client Test
node test-fixed.js
echo.
echo [5/6] Endpoint Test
node test-endpoints.js
echo.
echo [6/6] Curl Test
call test-curl.bat
echo.
echo All tests completed!
pause
goto menu

:end
echo.
echo Exiting...
endlocal
