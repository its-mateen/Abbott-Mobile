<#
  Proves the CMS really drives the storefront.
  Runs tests/drive-online-cms.html (which saves real CMS changes through website.html's own
  component) and then renders shop pages IN THE SAME chrome profile, so they read the same
  localStorage. Dumps each page's DOM + screenshot into tests/out/cms-*.
  Usage: powershell -ExecutionPolicy Bypass -File tests\cms-then-shop.ps1 [-Mobile] [-Dark]
#>
param([switch]$Mobile, [switch]$Dark, [string]$BaseUrl = 'http://127.0.0.1:8085')
$ErrorActionPreference = 'Continue'
$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force $out | Out-Null
$profile = Join-Path $out ('chrome-profile-cmsflow' + $(if ($Mobile) { '-m' } else { '' }) + $(if ($Dark) { '-dark' } else { '' }))
Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
$chrome = @('C:\Program Files\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { Write-Error 'No Chromium browser found'; exit 1 }

$w = if ($Mobile) { 520 } else { 1440 }
$h = if ($Mobile) { 900 } else { 1000 }
$common = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  "--user-data-dir=$profile", '--enable-logging=stderr', '--v=0', "--window-size=$w,$h", '--virtual-time-budget=15000')

function Go([string]$url, [string]$tag, [switch]$NoShot) {
  $dom = Join-Path $out "cms-$tag.dom.html"
  $err = Join-Path $out "cms-$tag.stderr.log"
  $png = Join-Path $out "cms-$tag.png"
  Start-Process -FilePath $chrome -ArgumentList ($common + @('--dump-dom', $url)) -Wait -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError $err
  if (-not $NoShot) {
    Start-Process -FilePath $chrome -ArgumentList ($common + @("--screenshot=$png", $url)) -Wait -NoNewWindow -RedirectStandardOutput (Join-Path $out 'cms.shot.log') -RedirectStandardError (Join-Path $out 'cms.shoterr.log')
  }
  $console = Get-Content $err -ErrorAction SilentlyContinue | Where-Object { $_ -match 'CONSOLE' -and $_ -notmatch 'cdn.tailwindcss.com should not be used in production' }
  $errors = $console | Where-Object { $_ -match '"(Uncaught|TypeError|ReferenceError|SyntaxError|Alpine Expression Error|Failed to load|net::ERR)' -or $_ -match 'Alpine Expression Error' }
  $layout = $console | Where-Object { $_ -match 'ABM_LAYOUT' }
  # Write-Host, never Write-Output: this function's return value is the DOM text
  Write-Host "--- $tag  ($url)"
  Write-Host "    consoleErrors=$($errors.Count)"
  $errors | ForEach-Object { Write-Host "    ! $_" }
  $layout | ForEach-Object { if ($_ -match '"(ABM_LAYOUT[^"]*)"') { Write-Host "    $($matches[1])" } }
  Write-Host "    png=$png"
  return (Get-Content $dom -Raw -ErrorAction SilentlyContinue)
}

$mode = if ($Dark) { '&__mode=dark' } else { '' }
# 1. apply the CMS changes (writes into this profile's localStorage)
$applyDom = Go "$BaseUrl/tests/drive-online-cms.html" 'apply' -NoShot
$applyErr = Join-Path $out 'cms-apply.stderr.log'
Get-Content $applyErr -ErrorAction SilentlyContinue | Where-Object { $_ -match 'DRIVE (FAIL|MARKER|TOTAL)' -or $_ -match 'RESULT:' } |
  ForEach-Object { if ($_ -match '"(.*)", source') { "    $($matches[1])" } else { "    $_" } }

# 2. render the storefront from the very same localStorage
$expect = @{
  'site name'        = 'Zee Gadget House'
  'tagline'          = 'Driven by the CMS audit'
  'hero headline'    = 'Phones, laptops and repairs under one roof'
  'menu item'        = 'Clearance Deals'
  'announcement'     = 'Free delivery over Rs. 12,000 this week'
  'CMS page in footer' = 'Warranty Promise'
}
$idx = Go "$BaseUrl/shop/index.html?__layout=1$mode" 'index'
foreach ($k in $expect.Keys) {
  $hit = $idx -and $idx.Contains($expect[$k])
  Write-Output "    CMS-CHECK index/$k = $(if ($hit) { 'FOUND' } else { 'MISSING' })"
}
$primaryVar = if ($idx -match '--shop-primary-600:\s*([^;"]+)') { $matches[1] } else { '(none)' }
Write-Output "    CMS-CHECK index/primary-colour-var = $primaryVar"

$pg = Go "$BaseUrl/shop/page.html?slug=warranty-promise&__layout=1$mode" 'page'
Write-Output "    CMS-CHECK page/heading   = $(if ($pg -and $pg.Contains('Our promise')) { 'FOUND' } else { 'MISSING' })"
Write-Output "    CMS-CHECK page/body      = $(if ($pg -and $pg.Contains('Every device carries a warranty.')) { 'FOUND' } else { 'MISSING' })"
Write-Output "    CMS-CHECK page/no-script = $(if ($pg -and ($pg -match 'alert\(&quot;xss&quot;\)|alert\(""xss""\)')) { 'LEAKED' } else { 'clean' })"
Write-Output "    CMS-CHECK page/no-onerror= $(if ($pg -and ($pg -match 'onerror\s*=')) { 'LEAKED' } else { 'clean' })"

$co = Go "$BaseUrl/shop/checkout.html?__layout=1$mode" 'checkout'
Write-Output "    CMS-CHECK checkout/new-fee = $(if ($co -and $co.Contains('399')) { 'FOUND' } else { 'MISSING' })"
