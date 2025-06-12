# DNS Block Testing Script for Windows
# Tests if adult content domains are properly blocked

Write-Host "DNS Block Testing Tool" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# Get OPNsense IP from environment or prompt
$opnsenseIP = $env:OPNSENSE_HOST
if ($opnsenseIP) {
    $opnsenseIP = $opnsenseIP -replace "https?://", "" -replace "/.*", ""
} else {
    $opnsenseIP = Read-Host "Enter OPNsense IP address"
}

Write-Host "Using DNS Server: $opnsenseIP" -ForegroundColor Yellow
Write-Host ""

# Test domains
$testDomains = @(
    "pornhub.com",
    "www.pornhub.com",
    "xvideos.com",
    "xhamster.com",
    "google.com",  # Control - should resolve normally
    "github.com"   # Control - should resolve normally
)

Write-Host "Testing DNS blocks..." -ForegroundColor Green
Write-Host "Blocked domains should resolve to 0.0.0.0" -ForegroundColor Gray
Write-Host ""

foreach ($domain in $testDomains) {
    Write-Host "Testing: $domain" -NoNewline
    
    try {
        $result = Resolve-DnsName -Name $domain -Server $opnsenseIP -ErrorAction Stop
        $ip = $result | Where-Object {$_.Type -eq "A"} | Select-Object -First 1 -ExpandProperty IPAddress
        
        if ($ip -eq "0.0.0.0") {
            Write-Host " - BLOCKED ✓" -ForegroundColor Red
        } else {
            Write-Host " - Resolves to $ip" -ForegroundColor Green
        }
    } catch {
        Write-Host " - ERROR: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "If blocked domains are not resolving to 0.0.0.0:" -ForegroundColor Yellow
Write-Host "1. Run 'node solve-dns-blocking.js' to apply blocks" -ForegroundColor Gray
Write-Host "2. Check OPNsense GUI under Services -> Unbound DNS" -ForegroundColor Gray
Write-Host "3. Ensure DNS Query Forwarding is disabled" -ForegroundColor Gray
Write-Host "4. Make sure IoT devices use OPNsense for DNS" -ForegroundColor Gray
Write-Host ""

# Wait for user input
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
