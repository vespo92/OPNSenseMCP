@echo off
echo Running all OPNsense API tests and saving results...

:: Create timestamp for filename
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%_%dt:~8,2%-%dt:~10,2%-%dt:~12,2%"
set "resultfile=Phase2Docs\testresults\test-results-%timestamp%.txt"

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
    echo  All tests completed at %time%
    echo ========================================
) > "%resultfile%"

echo.
echo Tests completed! Results saved to:
echo %resultfile%
echo.
