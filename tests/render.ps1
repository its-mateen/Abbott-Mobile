<#
  Headless render check for the Abbott Mobile frontend prototype.
  Usage:  powershell -File tests\render.ps1 -Page dashboard.html [-As admin] [-Width 1440] [-Height 900] [-Mobile]
  Produces tests\out\<page>.png, <page>.dom.html, <page>.console.log and prints console errors + a DOM summary.
  Requires a running static server at http://127.0.0.1:8085/ (php -S 127.0.0.1:8085 -t .)
#>
param(
  [Parameter(Mandatory = $true)][string]$Page,
  [string]$As = 'admin',
  [string]$Branch = '',
  [int]$Width = 1440,
  [int]$Height = 900,
  [switch]$Mobile,
  [switch]$NoLogin,
  [string]$Shop = '',          # sign a STOREFRONT customer account in too (email, or "1" for the first demo account)
  [string]$Theme = '',
  [string]$Accent = '',
  [string]$BaseUrl = 'http://127.0.0.1:8085'
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force $out | Out-Null
$chromeProfile = Join-Path $out ('chrome-profile-' + (($Page -replace '[^A-Za-z0-9]+', '_') + "_$As" + $(if ($Mobile) { '_m' } else { '' })))  # per-run profile so parallel renders never share a locked browser profile
$chrome = @('C:\Program Files\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { Write-Error 'No Chromium browser found'; exit 1 }

if ($Mobile) { $Width = 400; $Height = 860 }
$variant = "__$As" + $(if ($Mobile) { '_mobile' } else { '' }) + $(if ($Theme) { "_$Theme" } else { '' }) + $(if ($Accent) { "_$Accent" } else { '' }) + $(if ($Shop) { '_shop' } else { '' })
$name = ($Page -replace '[^A-Za-z0-9]+', '_') + $variant
$chromeProfile = Join-Path $out ('chrome-profile-' + $name)
$png = Join-Path $out "$name.png"
$dom = Join-Path $out "$name.dom.html"
$log = Join-Path $out "$name.console.log"
$err = Join-Path $out "$name.stderr.log"

$common = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', "--user-data-dir=$chromeProfile", '--enable-logging=stderr', '--v=0', "--window-size=$Width,$Height", '--virtual-time-budget=12000')

# 1. establish session via test helper (persistent profile keeps localStorage)
if (-not $NoLogin) {
  $loginUrl = "$BaseUrl/tests/autologin.html?as=$As"
  if ($Branch) { $loginUrl += "&branch=$Branch" }
  if ($Shop) { $loginUrl += "&shop=" + [uri]::EscapeDataString($Shop) }
  if ($Theme) { $loginUrl += "&theme=$Theme" }
  if ($Accent) { if ($Accent -like '#*') { $loginUrl += "&custom=" + [uri]::EscapeDataString($Accent) } else { $loginUrl += "&accent=$Accent" } }
  $p = Start-Process -FilePath $chrome -ArgumentList ($common + @('--dump-dom', $loginUrl)) -Wait -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $out 'login.dom.html') -RedirectStandardError (Join-Path $out 'login.stderr.log')
}

# 2. render the page: DOM dump (mobile renders inside a 400px iframe harness because headless Chromium
#    enforces a ~500px minimum window width; the iframe gives a true phone-width viewport)
$url = "$BaseUrl/$Page"
if ($Mobile) { $url = "$BaseUrl/tests/frame.html?page=$([uri]::EscapeDataString($Page))&w=400&h=860"; $common = $common | ForEach-Object { if ($_ -like '--window-size=*') { '--window-size=520,900' } else { $_ } } }
$p = Start-Process -FilePath $chrome -ArgumentList ($common + @('--dump-dom', $url)) -Wait -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError $err
# 3. screenshot
$p2 = Start-Process -FilePath $chrome -ArgumentList ($common + @("--screenshot=$png", $url)) -Wait -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $out 'shot.stdout.log') -RedirectStandardError (Join-Path $out 'shot.stderr.log')

# console messages: Chromium logs them as "CONSOLE(line)" lines in stderr
$console = Get-Content $err -ErrorAction SilentlyContinue | Where-Object { $_ -match 'CONSOLE' -and $_ -notmatch 'cdn.tailwindcss.com should not be used in production' }
$console | Set-Content $log
$errors = $console | Where-Object { $_ -match '"(Uncaught|TypeError|ReferenceError|SyntaxError|Alpine Expression Error|Failed to load|net::ERR)' -or $_ -match 'Alpine Expression Error' -or $_ -match 'Uncaught' }

$html = Get-Content $dom -Raw -ErrorAction SilentlyContinue
$title = if ($html -match '<title>(.*?)</title>') { $matches[1] } else { '(no title)' }
$hasSidebar = $html -match 'id="abm-sidebar"'
$hasTopbar = $html -match 'id="abm-topbar"'
$forbidden = $html -match 'Access restricted'
$xCloak = ([regex]::Matches($html, 'x-cloak')).Count
$templates = ([regex]::Matches($html, '<template')).Count

Write-Output "PAGE: $Page  (as $As)"
Write-Output "TITLE: $title"
Write-Output "SHELL: sidebar=$hasSidebar topbar=$hasTopbar forbidden=$forbidden domBytes=$($html.Length)"
Write-Output "CONSOLE LINES: $($console.Count)   ERRORS: $($errors.Count)"
$errors | ForEach-Object { Write-Output "  ! $_" }
Write-Output "SCREENSHOT: $png"
