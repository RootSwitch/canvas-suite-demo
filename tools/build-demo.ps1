<#
    build-demo.ps1 - assemble the static suite demo from the sibling checkouts.

    Everything OUTSIDE demo/ and tools/ is GENERATED - vendored copies of the
    real apps' frontends, refreshed by re-running this script. Hand-edit only:
        demo/demo-api.js        the fetch shim + fixtures wiring + demo ribbon
        demo/fixtures/*         the mock board and status feed
        README.md               this repo's own docs

    Run from the repo root:  powershell -File tools\build-demo.ps1
    Verify without writing:  powershell -File tools\build-demo.ps1 -Check
      (exits 1 and lists every vendored file that no longer matches its source.
       Run it before any shoot and before publishing - a stale copy fails
       nothing on its own, it just misrepresents the product.)
#>
[CmdletBinding()]
param(
    [string]$LaunchCanvas = 'C:\Workspace\launchcanvas',
    [string]$PingCanvas   = 'C:\Workspace\pingcanvas',
    [string]$SNMPCanvas   = 'C:\Workspace\snmpcanvas\SNMPCanvas',
    [string]$SyslogCanvas = 'C:\Workspace\syslogcanvas\syslogcanvas',
    [string]$AlertCanvas  = 'C:\Workspace\alertcanvas',
    # Verify instead of vendoring: report every vendored file that no longer
    # matches its source and exit 1. Nothing is written.
    [switch]$Check
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

# --- drift check --------------------------------------------------------------
# Everything outside demo/ and tools/ is a COPY of a sibling repo's frontend, and
# nothing fails when a copy goes stale - it just quietly misrepresents the
# product until somebody stares at a screenshot. That is exactly how the demo
# came to be advertising a feature (95th-percentile chart lines) that had been
# REMOVED from SNMPCanvas upstream: it survived a whole imagery pass and was
# caught only because it turned up in a hero shot.
#
# -Check turns that silent rot into an exit code. Run it before any shoot and
# before publishing.
#
# The wrinkle: vendored index.html files are DELIBERATELY modified - the demo
# shim is injected ahead of app.js - so a raw hash compare would flag the very
# files that matter most, every time. Strip the injected line before comparing,
# and a genuine edit to index.html still shows up.
function Get-Normalized {
    param([string]$Path)
    $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($Path))
    if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) { $text = $text.Substring(1) }
    $text = [regex]::Replace($text, '(?m)^[ \t]*<script src="[^"]*demo[-/][^"]*\.js"></script>\r?\n', '')
    # The demo's home is the whole suite, so the build retitles the vendored
    # LaunchCanvas page. Normalise it back, exactly like the shim above: a
    # DELIBERATE difference must not read as drift, or the check reports STALE
    # on every run and stops being read at all.
    $text = $text -replace '<title>Canvas Suite Demo</title>', '<title>LaunchCanvas</title>'
    $text = $text -replace "`r`n", "`n"
    return $text
}

function Test-Vendored {
    param([string]$SrcDir, [string]$DestDir, [string[]]$Only = @(), [string[]]$Skip = @())
    if (-not (Test-Path $SrcDir))  { return @("source missing: $SrcDir") }
    if (-not (Test-Path $DestDir)) { return @("never vendored: $DestDir") }
    $problems = @()
    foreach ($f in (Get-ChildItem $SrcDir -Recurse -File)) {
        $rel = $f.FullName.Substring($SrcDir.Length).TrimStart('\')
        if ($Skip -contains $f.Name) { continue }
        if ($Only.Count -gt 0) {
            $match = $false
            foreach ($pat in $Only) { if ($rel -like $pat) { $match = $true; break } }
            if (-not $match) { continue }
        }
        $mirror = Join-Path $DestDir $rel
        if (-not (Test-Path $mirror)) { $problems += "MISSING  $rel"; continue }
        if ((Get-Normalized $f.FullName) -ne (Get-Normalized $mirror)) { $problems += "STALE    $rel" }
    }
    return $problems
}

if ($Check) {
    Write-Host '==> Checking vendored copies against their sources'
    $all = @()
    # The same mapping the vendoring below uses, kept adjacent on purpose: if one
    # moves, the other is in view.
    # favicon.svg is SKIPPED, not compared: the build replaces LaunchCanvas's
    # door mark with the suite mark on purpose (demo/suite-favicon.svg is the
    # source of truth for it). Comparing it against LaunchCanvas would report
    # STALE forever - the same trap the retitle above avoids.
    foreach ($x in (Test-Vendored (Join-Path $LaunchCanvas 'public') $Root -Only @('*.html','*.js','*.css','icons\*','tiles\*'))) {
        $all += ('{0,-13} {1}' -f 'launchcanvas', $x)
    }
    foreach ($x in (Test-Vendored (Join-Path $PingCanvas 'kiosk') (Join-Path $Root 'kiosk') -Skip @('web.config','README.md'))) {
        $all += ('{0,-13} {1}' -f 'pingcanvas', $x)
    }
    foreach ($a in @(
        @{ n = 'snmpcanvas';   p = (Join-Path $SNMPCanvas   'public') },
        @{ n = 'syslogcanvas'; p = (Join-Path $SyslogCanvas 'public') },
        @{ n = 'alertcanvas';  p = (Join-Path $AlertCanvas  'public') })) {
        foreach ($x in (Test-Vendored $a.p (Join-Path $Root $a.n))) { $all += ('{0,-13} {1}' -f $a.n, $x) }
    }
    if ($all.Count -gt 0) {
        Write-Host ''
        foreach ($line in $all) { Write-Host "  $line" }
        Write-Host ''
        Write-Host "$($all.Count) vendored file(s) out of date. Re-run without -Check to refresh." -ForegroundColor Red
        exit 1
    }
    Write-Host '  ok every vendored file matches its source'
    exit 0
}


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

# The demo's home is the whole SUITE, not the LaunchCanvas app it vendors -
# so the tab wears the suite mark and name, not the member app's door.
Copy-Item (Join-Path $Root 'demo\suite-favicon.svg') (Join-Path $Root 'favicon.svg') -Force
$html = Get-Content $idx -Raw
$retitled = $html -replace '<title>LaunchCanvas</title>', '<title>Canvas Suite Demo</title>'
if ($retitled -ne $html) {
    Set-Content $idx $retitled -Encoding utf8 -NoNewline
    Write-Host '  ok suite identity applied (favicon + title)'
} else { Write-Host '  ok suite title already present' }

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
