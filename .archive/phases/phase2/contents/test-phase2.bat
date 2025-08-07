@echo off
echo Phase 2 - VLAN API Test
echo =======================
echo.

echo Setting debug mode...
set OPNSENSE_DEBUG=true

echo.
echo Running VLAN test script...
echo.

node phase2docs/test-vlan-updated.js

echo.
echo Test completed!
echo.

echo If the test was successful, you should see:
echo - Connection successful
echo - VLAN created with UUID
echo - Configuration applied
echo - VLAN updated
echo - VLAN deleted
echo.

pause
