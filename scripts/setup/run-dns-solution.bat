@echo off
echo ======================================
echo OPNSense DNS Blocking Solution Runner
echo ======================================
echo.

echo Running DNS blocking solution...
echo.

node solve-dns-blocking.js

echo.
echo ======================================
echo Solution completed!
echo.
echo To verify the blocks are working:
echo 1. Check OPNsense GUI: Services -^> Unbound DNS -^> Host Overrides
echo 2. From IoT device: nslookup pornhub.com (should return 0.0.0.0)
echo.
echo For debugging, run: node debug-dns-blocklist.js
echo ======================================
pause
