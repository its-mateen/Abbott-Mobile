<#
  Second half of the CMS proof: render the real storefront using the browser profile that
  tests\drive-online-cms.html already wrote its CMS changes into, and check every change
  actually shows up. Run cms-then-shop.ps1 (or the apply page) first.
  Usage: powershell -ExecutionPolicy Bypass -File tests\cms-verify-shop.ps1 [-Mobile] [-Dark]
#>
param([switch]$Mobile, [switch]$Dark, [string]$BaseUrl = 'http://127.0.0.1:8085')
$ErrorActionPreference = 'Continue'
$out = Join-Path $PSScriptRoot 'out'
$prof = Join-Path $out 'chrome-profile-cmsflow'
$chrome = @('C:\Program Files\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1

$w = if ($Mobile) { 520 } else { 1440 }
$h = if ($Mobile) { 900 } else { 1000 }
$common = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  "--user-data-dir=$prof", '--enable-logging=stderr', '--v=0', "--window-size=$w,$h", '--virtual-time-budget=15000')

$suffix = $(if ($Mobile) { '-m' } else { '' }) + $(if ($Dark) { '-dark' } else { '' })
function Go([string]$url, [string]$tag) {
  $dom = Join-Path $out "cms-$tag$suffix.dom.html"
  $err = Join-Path $out "cms-$tag$suffix.stderr.log"
  $png = Join-Path $out "cms-$tag$suffix.png"
  Start-Process -FilePath $chrome -ArgumentList ($common + @('--dump-dom', $url)) -Wait -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError $err
  Start-Process -FilePath $chrome -ArgumentList ($common + @("--screenshot=$png", $url)) -Wait -NoNewWindow -RedirectStandardOutput (Join-Path $out 'cms.shot.log') -RedirectStandardError (Join-Path $out 'cms.shoterr.log')
  $console = Get-Content $err -ErrorAction SilentlyContinue | Where-Object { $_ -match 'CONSOLE' -and $_ -notmatch 'cdn.tailwindcss.com should not be used in production' }
  $errs = $console | Where-Object { $_ -match '"(Uncaught|TypeError|ReferenceError|SyntaxError|Alpine Expression Error|Failed to load|net::ERR)' -or $_ -match 'Alpine Expression Error' }
  Write-Host "--- $tag$suffix  consoleErrors=$($errs.Count)  png=$png"
  $errs | ForEach-Object { Write-Host "    ! $_" }
  $console | Where-Object { $_ -match 'ABM_LAYOUT' } | ForEach-Object { if ($_ -match '"(ABM_LAYOUT[^"]*)"') { Write-Host "    $($matches[1])" } }
  return (Get-Content $dom -Raw -ErrorAction SilentlyContinue)
}
function Has([string]$hay, [string]$needle, [string]$label) {
  $r = if ($hay -and $hay.Contains($needle)) { 'FOUND  ' } else { 'MISSING' }
  Write-Host "    CMS-CHECK $r $label"
}

$mode = if ($Dark) { '&__mode=dark' } else { '' }
$idx = Go "$BaseUrl/shop/index.html?__layout=1$mode" 'index'
Has $idx 'Zee Gadget House' 'index / new site name'
Has $idx 'Driven by the CMS audit' 'index / new tagline'
Has $idx 'Phones, laptops and repairs under one roof' 'index / new hero headline'
Has $idx 'Clearance Deals' 'index / new menu item'
Has $idx 'Free delivery over Rs. 12,000 this week' 'index / announcement bar'
Has $idx 'Warranty Promise' 'index / new CMS page in footer'
if ($idx -match '--shop-primary-600:\s*([^;"]+)') { Write-Host "    CMS-CHECK primary-600 = $($matches[1])  (expect 187 62 34 for #7c2d12)" }
else { Write-Host '    CMS-CHECK primary-600 = (none)' }

$pg = Go "$BaseUrl/shop/page.html?slug=warranty-promise&__layout=1$mode" 'page'
Has $pg 'Our promise' 'page / heading from the rich-text editor'
Has $pg 'Every device carries a warranty.' 'page / body text'
$leakScript = if ($pg -match 'alert') { 'LEAKED ' } else { 'clean  ' }
$leakOn = if ($pg -match '\son(error|click|load)\s*=') { 'LEAKED ' } else { 'clean  ' }
$leakFrame = if ($pg -match '<iframe') { 'LEAKED ' } else { 'clean  ' }
Write-Host "    CMS-CHECK $leakScript page / no script payload"
Write-Host "    CMS-CHECK $leakOn page / no on* handler"
Write-Host "    CMS-CHECK $leakFrame page / no iframe"

$co = Go "$BaseUrl/shop/checkout.html?__demo=1&add=24:1&__layout=1$mode" 'checkout'
Has $co '399' 'checkout / new delivery fee'
Has $co 'Zee Gadget House' 'checkout / new site name'
