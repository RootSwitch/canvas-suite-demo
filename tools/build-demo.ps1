<#
    build-demo.ps1 - assemble the static suite demo from the sibling checkouts.

    Everything OUTSIDE demo/ and tools/ is GENERATED - vendored copies of the
    real apps' frontends, refreshed by re-running this script. Hand-edit only:
        demo/demo-api.js        the fetch shim + fixtures wiring + demo ribbon
        demo/fixtures/*         the mock board and status feed
        README.md               this repo's own docs

    Run from the repo root:  powershell -File tools\build-demo.ps1
#>
[CmdletBinding()]
param(
    [string]$LaunchCanvas = 'C:\Workspace\launchcanvas',
    [string]$PingCanvas   = 'C:\Workspace\pingcanvas',
    [string]$SNMPCanvas   = 'C:\Workspace\snmpcanvas\SNMPCanvas',
    [string]$SyslogCanvas = 'C:\Workspace\syslogcanvas\syslogcanvas',
    [string]$AlertCanvas  = 'C:\Workspace\alertcanvas'
)

# Vendor an app's public/ into a subdir and inject its demo shim before app.js.
function Import-AppFrontend {
    param([string]$Src, [string]$DestName, [string]$Shim, [string]$RootDir)
    Write-Host "==> Vendoring $DestName"
    $pub = Join-Path $Src 'public'
    if (-not (Test-Path "$pub\index.html")) { throw "public/ not found at $pub" }
    $dest = Join-Path $RootDir $DestName
    Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item $pub $dest -Recurse -Force
    $idx = Join-Path $dest 'index.html'
    $html = Get-Content $idx -Raw
    if ($html -notmatch [regex]::Escape($Shim)) {
        $html = $html -replace '(<script src="app\.js"></script>)', ('<script src="../demo/' + $Shim + '"></script>' + "`n" + '$1')
        Set-Content $idx $html -Encoding utf8 -NoNewline
        Write-Host "  ok $Shim injected"
    }
}
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

# ----- LaunchCanvas frontend -> repo root (the launcher IS the demo's home) --
Write-Host '==> Vendoring LaunchCanvas public/'
$lcPub = Join-Path $LaunchCanvas 'public'
if (-not (Test-Path "$lcPub\index.html")) { throw "LaunchCanvas public/ not found at $lcPub" }
Copy-Item "$lcPub\*.html" $Root -Force
Copy-Item "$lcPub\*.js"   $Root -Force
Copy-Item "$lcPub\*.css"  $Root -Force
Copy-Item "$lcPub\favicon.svg" $Root -Force
foreach ($d in 'icons', 'tiles') {
    Remove-Item (Join-Path $Root $d) -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $lcPub $d) (Join-Path $Root $d) -Recurse -Force
}

# Inject the demo shim BEFORE app.js so its fetch override is in place first.
$idx = Join-Path $Root 'index.html'
$html = Get-Content $idx -Raw
if ($html -notmatch 'demo-api\.js') {
    $html = $html -replace '(<script src="app\.js"></script>)', ('<script src="demo/demo-api.js"></script>' + "`n" + '$1')
    Set-Content $idx $html -Encoding utf8 -NoNewline
    Write-Host '  ok demo shim injected into index.html'
} else { Write-Host '  ok demo shim already present' }

# ----- PingCanvas kiosk -> kiosk/ --------------------------------------------
Write-Host '==> Vendoring PingCanvas kiosk/'
$pcKiosk = Join-Path $PingCanvas 'kiosk'
if (-not (Test-Path "$pcKiosk\kiosk.html")) { throw "PingCanvas kiosk/ not found at $pcKiosk" }
$dest = Join-Path $Root 'kiosk'
New-Item -ItemType Directory -Force $dest | Out-Null
# Everything the kiosk page needs, nothing server-side (web.config stays out).
Get-ChildItem $pcKiosk -File | Where-Object { $_.Name -notin @('web.config', 'README.md') } |
    Copy-Item -Destination $dest -Force

# ----- the three Node app frontends ------------------------------------------
Import-AppFrontend -Src $SNMPCanvas   -DestName 'snmpcanvas'   -Shim 'snmp-demo-api.js'   -RootDir $Root
Import-AppFrontend -Src $SyslogCanvas -DestName 'syslogcanvas' -Shim 'syslog-demo-api.js' -RootDir $Root
Import-AppFrontend -Src $AlertCanvas  -DestName 'alertcanvas'  -Shim 'alert-demo-api.js'  -RootDir $Root

# ----- fixtures -> kiosk/data ------------------------------------------------
Write-Host '==> Placing fixtures'
New-Item -ItemType Directory -Force (Join-Path $dest 'data') | Out-Null
Copy-Item (Join-Path $Root 'demo\fixtures\board.xcanvas')     (Join-Path $dest 'data\board.xcanvas') -Force
Copy-Item (Join-Path $Root 'demo\fixtures\status.json')       (Join-Path $dest 'data\status.json') -Force
Copy-Item (Join-Path $Root 'demo\fixtures\snmp-status.json')  (Join-Path $dest 'data\snmp-status.json') -Force
Copy-Item (Join-Path $Root 'demo\fixtures\bad-status.json')      (Join-Path $dest 'data\bad-status.json') -Force
Copy-Item (Join-Path $Root 'demo\fixtures\bad-snmp-status.json') (Join-Path $dest 'data\bad-snmp-status.json') -Force

Write-Host '==> Done. Serve the repo root to preview; push to deploy Pages.'
