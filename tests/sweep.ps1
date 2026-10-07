<#
  Full-project render sweep: every page, desktop + 400px mobile, reporting console errors and
  mobile overflow in one table.
    powershell -File tests\sweep.ps1                 # all pages, desktop + mobile
    powershell -File tests\sweep.ps1 -Only sales     # only pages matching a substring
    powershell -File tests\sweep.ps1 -DesktopOnly
#>
param([string]$Only = '', [switch]$DesktopOnly, [switch]$MobileOnly, [string]$BaseUrl = 'http://127.0.0.1:8085')

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$render = Join-Path $PSScriptRoot 'render.ps1'

# page, query, role
$pages = @(
  @('dashboard.html', '', 'admin'), @('pos.html', '', 'cashier'),
  @('sales.html', '?range=this_month', 'admin'), @('sale-view.html', '?id=1', 'admin'),
  @('invoice.html', '?id=1&layout=thermal', 'admin'), @('invoice.html', '?id=1&layout=a4', 'admin'),
  @('returns.html', '', 'admin'),
  @('customers.html', '', 'admin'), @('customer-view.html', '?id=2', 'admin'),
  @('suppliers.html', '', 'admin'), @('supplier-view.html', '?id=1', 'admin'),
  @('products.html', '', 'admin'), @('product-view.html', '?id=1', 'admin'),
  @('categories.html', '', 'admin'), @('imeis.html', '', 'admin'), @('stock.html', '?filter=low', 'admin'),
  @('transfers.html', '', 'admin'), @('transfer-create.html', '', 'manager'), @('transfer-view.html', '?id=2', 'admin'),
  @('labels.html', '?category=7', 'manager'), @('products-import.html', '', 'manager'),
  @('stock-counts.html', '', 'admin'), @('stock-count-view.html', '?id=2', 'manager'), @('stock-count-view.html', '?id=1', 'admin'),
  @('purchases.html', '', 'admin'), @('purchase-create.html', '', 'manager'), @('purchase-view.html', '?id=1', 'admin'),
  @('purchase-orders.html', '', 'admin'), @('purchase-order-create.html', '', 'manager'), @('purchase-order-view.html', '?id=2', 'admin'),
  @('purchase-create.html', '?po=3', 'manager'),
  @('supplier-returns.html', '', 'admin'), @('supplier-return-create.html', '', 'manager'), @('supplier-return-view.html', '?id=2', 'admin'),
  @('inbox.html', '', 'admin'),
  @('repairs.html', '', 'admin'), @('repair-create.html', '', 'technician'), @('repair-view.html', '?id=1', 'technician'),
  @('expenses.html', '', 'admin'), @('day-end.html', '', 'manager'), @('closings.html', '', 'admin'),
  @('banking.html', '?range=all', 'manager'), @('bank-account-view.html', '?id=1&range=all', 'manager'), @('cheques.html', '?range=all', 'manager'),
  @('shifts.html', '?range=all', 'admin'), @('shift-view.html', '?id=1', 'manager'), @('shift-view.html', '?id=3', 'cashier'),
  @('reports.html', '', 'admin'), @('report-sales.html', '?range=this_month', 'admin'),
  @('report-profit-loss.html', '?range=this_month', 'admin'), @('report-stock-valuation.html', '', 'admin'),
  @('report-balance-sheet.html', '', 'admin'), @('report-inventory.html', '', 'admin'),
  @('report-imei-history.html', '', 'admin'), @('report-expenses.html', '', 'admin'),
  @('report-receivables.html', '', 'admin'), @('report-payables.html', '', 'admin'),
  @('report-repairs.html', '', 'admin'), @('report-online-sales.html', '', 'admin'),
  @('online-orders.html', '', 'admin'), @('online-order-view.html', '?id=8', 'admin'), @('website.html', '', 'admin'),
  @('branches.html', '', 'admin'), @('users.html', '', 'admin'), @('roles.html', '', 'admin'), @('role-edit.html', '?id=2', 'admin'), @('role-edit.html', '', 'admin'), @('users.html', '', 'manager'), @('settings.html', '', 'admin'),
  @('audit-log.html', '', 'admin'), @('profile.html', '', 'manager'),
  @('shop/index.html', '', ''), @('shop/products.html', '', ''), @('shop/product.html', '?id=1', ''),
  @('shop/cart.html', '', ''), @('shop/checkout.html', '', ''), @('shop/order.html', '', ''),
  @('shop/repair.html', '', ''), @('shop/page.html', '?slug=about', ''), @('shop/contact.html', '', '')
)

if ($Only) { $pages = @($pages | Where-Object { $_[0] -like "*$Only*" }) }   # @() keeps a single match an array of arrays

$results = @()
foreach ($p in $pages) {
  $page = $p[0]; $q = $p[1]; $role = $p[2]
  $isShop = $page -like 'shop/*'
  foreach ($mode in @('desktop', 'mobile')) {
    if ($DesktopOnly -and $mode -eq 'mobile') { continue }
    if ($MobileOnly -and $mode -eq 'desktop') { continue }
    $sep = if ($q) { '&' } else { '?' }
    $url = "$page$q$sep" + '__layout=1'
    $a = @('-ExecutionPolicy', 'Bypass', '-File', $render, '-Page', $url, '-BaseUrl', $BaseUrl)
    if ($isShop) { $a += '-NoLogin' } else { $a += @('-As', $role) }
    if ($mode -eq 'mobile') { $a += '-Mobile' }
    $out = & powershell @a 2>&1 | Out-String
    $errs = 0; if ($out -match 'ERRORS:\s*(\d+)') { $errs = [int]$matches[1] }
    $shot = ''; if ($out -match 'SCREENSHOT:\s*(.+)') { $shot = $matches[1].Trim() }
    $overflow = ''
    $logFile = $shot -replace '\.png$', '.console.log'
    if (Test-Path $logFile) {
      $l = Get-Content $logFile | Select-String 'ABM_LAYOUT viewport'
      if ($l) { if ("$l" -match 'overflowing=(\d+)') { $overflow = $matches[1] } }
    }
    $results += [pscustomobject]@{ Page = $page; Mode = $mode; Role = $(if ($isShop) { 'public' } else { $role }); Errors = $errs; Overflow = $overflow }
    $flag = ''
    if ($errs -gt 0) { $flag += ' ERRORS' }
    if ($overflow -ne '' -and [int]$overflow -gt 0) { $flag += ' OVERFLOW' }
    Write-Output ("{0,-34} {1,-8} {2,-10} err={3} overflow={4}{5}" -f $page, $mode, $(if ($isShop) { 'public' } else { $role }), $errs, $overflow, $flag)
  }
}

Write-Output ''
Write-Output '================ FAILURES ================'
$bad = $results | Where-Object { $_.Errors -gt 0 -or ($_.Overflow -ne '' -and [int]$_.Overflow -gt 0) }
if ($bad) { $bad | Format-Table -AutoSize | Out-String | Write-Output } else { Write-Output 'none - all pages clean' }
Write-Output ("checked {0} renders, {1} failing" -f $results.Count, @($bad).Count)
