<#
  Runs every tests/drive-*.html suite in headless Chrome (4 at a time) and prints one line per suite.
  Usage:  powershell -File tests\run-drivers.ps1 [-Only money] [-Parallel 4]
  A suite passes when its console shows "RESULT: PASS". Failing assertions are listed under the suite.
#>
param([string]$Only = '', [int]$Parallel = 4)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$files = Get-ChildItem (Join-Path $PSScriptRoot 'drive-*.html') | Where-Object { -not $Only -or $_.Name -like "*$Only*" } | ForEach-Object { $_.Name }
$jobs = @()
foreach ($f in $files) {
  while (@($jobs | Where-Object { $_.State -eq 'Running' }).Count -ge $Parallel) { Start-Sleep -Milliseconds 300 }
  $jobs += Start-Job -ArgumentList $root, $f -ScriptBlock {
    param($root, $f)
    Set-Location $root
    $null = powershell -File tests\render.ps1 -Page ("tests/" + $f) -NoLogin -As driver 2>&1
    $log = Join-Path 'tests\out' ((("tests/" + $f) -replace '[^A-Za-z0-9]+', '_') + '__driver.console.log')
    $lines = @(); if (Test-Path $log) { $lines = Get-Content $log }
    $text = $lines | ForEach-Object { if ($_ -match '"(.*)", source') { $matches[1] } else { $_ } }
    $res = $text | Where-Object { $_ -match 'RESULT:' } | Select-Object -Last 1
    $bad = $text | Where-Object { $_ -match '(^|\s)FAIL\b' -and $_ -notmatch 'RESULT:' } | Select-Object -First 8
    $errs = $lines | Where-Object { $_ -match 'Uncaught|TypeError|ReferenceError' } | Select-Object -First 3
    [pscustomobject]@{ Suite = $f; Result = $(if ($res) { ($res -replace '^.*RESULT:\s*', '') } else { 'NO RESULT' }); Fails = $bad; Errors = $errs }
  }
}
$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
$pass = 0
foreach ($r in ($results | Sort-Object Suite)) {
  if ($r.Result -match '^PASS') { $pass++ }
  "{0,-34} {1}" -f $r.Suite, $r.Result
  if ($r.Result -notmatch '^PASS') { $r.Fails | ForEach-Object { "      $_" }; $r.Errors | ForEach-Object { "      ! $_" } }
}
""
"{0} of {1} suites passed" -f $pass, @($results).Count
