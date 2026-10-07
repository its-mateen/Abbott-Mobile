# Abbott Mobile — Frontend Prototype Guide

This is a **static, backend-free UI prototype** of the Abbott Mobile multi-branch POS, inventory and
accounting system. Every screen is a plain `.html` file served from the project root
(`http://localhost/abm/` under XAMPP, or `php -S localhost:8080` for testing).
Tailwind CSS (Play CDN) + Alpine.js provide styling and reactivity; a small shared runtime
(`assets/js/app.js`) provides the page shell, a localStorage-backed mock database and helpers.
The PHP/MySQL backend will be added later — the data shapes here mirror the planned DB schema so
the JS logic ports directly to API calls.

## 1. Page skeleton (copy exactly)

```html
<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Products · Abbott Mobile</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="assets/js/tailwind-config.js"></script>
  <link rel="stylesheet" href="assets/css/app.css">
  <!-- optional: Chart.js only on pages that draw charts -->
  <!-- <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script> -->
  <script defer src="assets/js/data.js"></script>
  <script defer src="assets/js/app.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"></script>
</head>
<body class="h-full bg-slate-100" data-page="products" data-title="Products" data-perm="products.view">
  <main x-data="productsPage()">
    ... page content only (NO sidebar / topbar markup — app.js injects them around <main>) ...
  </main>
  <!-- NOTE: Alpine calls the component's init() automatically. Never add x-init="init()" as well,
       or init runs twice (double charts, duplicate listeners). -->

  <!-- Modals may live inside <main> (inside the Alpine scope) -->

  <script>
    function productsPage() {
      const { db, utils, ui, session } = ABM;
      return { /* state */, init() { /* load from db */ } };
    }
  </script>
</body>
</html>
```

`<body>` attributes:

| attribute    | purpose |
|--------------|---------|
| `data-page`  | nav key (see §5) — highlights the sidebar item; detail pages use their own key (e.g. `product-view`) and the nav `match` list maps it to the parent item |
| `data-title` | topbar heading |
| `data-perm`  | permission required (`a|b` = either); if the current role lacks it the shell replaces the page with a 403 panel naming the missing permission |
| `data-public`| (login only) skip auth + shell |

The shell adds padding and max-width to `<main>` — do not wrap the page in another container.
Print/receipt pages (`invoice.html`) still use the shell; wrap printable output in `.print-area`
and use `@media print` rules (`.no-print` hides chrome). The sidebar/topbar are hidden in print.

## 2. Runtime API (`window.ABM`)

```js
ABM.db.all('products')                    // array (live reference; call db.save() after mutating directly)
ABM.db.find('products', id)               // row or null (id compared as string)
ABM.db.where('sales', { branch_id: 1 })   // or predicate function
ABM.db.first('branch_stock', r => r.branch_id==1 && r.product_id==5)
ABM.db.insert('customers', { name, phone }) // returns row with id + created_at, persists
ABM.db.update('products', id, { retail_price: 100 }) // merges + updated_at, persists
ABM.db.remove('expenses', id)
ABM.db.nextNumber('INV', 'MB')            // 'INV-MB-000042' (sequence per prefix+branch)
ABM.db.setting('currency_symbol'), ABM.db.setSetting(key, value), ABM.db.settings()
ABM.brand.name() / tagline()             // company name + tagline from Settings
ABM.brand.logo()                         // the mark's URL: Settings logo → assets/img/logo.png → assets/img/logo.svg
ABM.brand.img('h-9 w-auto', {fallbackClass})  // <img> for chrome; degrades to initials
ABM.brand.hydrate(root?)                 // wires up any <img data-abm-logo> written straight into a page
// In markup use  :src="ABM.brand.logo()" onerror="ABM.brand.onError(this)"  (Alpine-bound, so ABM exists),
// or a plain <img data-abm-logo src="assets/img/logo.png"> when the tag is parsed before app.js runs.
ABM.db.audit('product.update', 'product', id, 'Retail price changed')
ABM.db.audit('purchase_order.send', 'purchase_order', id, '…', order.branch_id)   // 5th arg: stamp the branch that OWNS the record,
                                                                                 // so a super admin acting on another branch is logged there too
ABM.db.productLabel(id) / branchName(id) / branchCode(id) / customerName(id) / supplierName(id)
ABM.db.userName(id) / categoryName(id) / brandName(id) / stockQty(branchId, productId)

ABM.session.user() / role() / roleLabel() / branchId() / branch() / branchCode()
ABM.session.can('products.delete') / canAny([...]) / isSuperAdmin()   // see §4 for the roles API
ABM.session.setBranch(id)   // super admin only (topbar handles this)

ABM.utils.money(1234.5)            // 'Rs. 1,234.50'   money(v,{decimals:0}) -> 'Rs. 1,235'
ABM.utils.num(1234), date(v), date(v,'short'|'long'|'iso'), time(v), datetime(v), timeAgo(v)
ABM.utils.today() /*'YYYY-MM-DD'*/, now() /*ISO*/, isoDate(d), addDays(d, n)
ABM.utils.sum(arr,'total') / sum(arr, r=>...) / groupBy / sortBy(arr,key,'desc') / paginate(arr,page,per)
ABM.utils.escape(str), qs('id'), debounce(fn), isValidImei(s), luhnValid(s), toCsv(rows, cols), download(name, content)
ABM.utils.titleCase('in_transit') -> 'In Transit', initials(name)

ABM.ui.toast(msg, 'success'|'error'|'warning'|'info'); ABM.ui.success(msg); ABM.ui.error(msg)
await ABM.ui.confirm({ title, message, confirmText, danger:true })  // Promise<boolean>
ABM.ui.badge('available')   // HTML string for a coloured status pill (use with x-html)
ABM.ui.statusLabel('in_transit') -> 'In Transit'
ABM.icon('cart', 'w-4 h-4')  // inline SVG string (use x-html or innerHTML)
```

Alpine magics available in templates: `$money(v, opts)`, `$date(v, style)`, `$badge(status, label)`, `$can(perm)`.

### Date range bar (MANDATORY on every page that shows period data: lists, ledgers, reports, dashboard, closings, audit)

Presets are fixed: **Today, Yesterday, This Week, Last Week, This Month, Last Month, All, Custom** (`ABM.utils.RANGE_PRESETS`).

```js
// in your Alpine component
init() { this.range = ABM.range('this_month', () => this.compute(), 'sales'); this.compute(); }   // (default preset, onChange, storage key)
compute() { const rows = ABM.db.all('sales').filter((s) => this.range.contains(s.sale_date)); ... }
// this.range.value -> {from,to} · .label · .previous (equal-length previous period) · .days() (ISO days for charts) · .query ('range=this_month' for links)
```
```html
<!-- put this in the page header / filter card. It is the standard markup — copy it verbatim -->
<div class="range-bar">
  <div class="tabs-pill">
    <template x-for="p in range.presets" :key="p.key">
      <button type="button" class="tab" :class="range.preset === p.key && 'active'" @click="range.set(p.key)" x-text="p.label"></button>
    </template>
  </div>
  <div class="range-custom" x-show="range.preset === 'custom'" x-cloak>
    <input type="date" class="input input-sm" x-model="range.from" @change="range.set('custom')">
    <span class="text-xs text-slate-500">to</span>
    <input type="date" class="input input-sm" x-model="range.to" @change="range.set('custom')">
  </div>
  <span class="range-label" x-text="range.label"></span>
</div>
```
Pages also honour `?range=<preset>&from=&to=` in the URL (dashboard tiles link with it) — `ABM.range()` reads it automatically. Use `ABM.utils.inRange(date, range)` for ad-hoc checks.
Stat tiles that summarise a period must be links: `<a href="sales.html?range=today" class="stat">…<span class="stat-arrow" x-html="ABM.icon('arrow-right')"></span></a>`.

### Stock & ledger services (ALWAYS use these — never edit branch_stock / product_imeis / balances by hand)

```js
ABM.stock.qty(branchId, productId)                       // sellable quantity
ABM.stock.add(branchId, productId, qty, unitCost, 'purchase'|'adjustment'|'opening'|'sale_return'|'transfer_in', {type:'purchase', id}, imeiId?, notes?)
ABM.stock.remove(branchId, productId, qty, 'sale'|'adjustment'|'transfer_out', {type:'sale', id}, {imeiId?, unitCost?, notes?}) // returns unit cost; throws if insufficient
ABM.stock.adjust(branchId, productId, newQty, reason, unitCost?)  // stock-take for non-IMEI items
ABM.stock.validateImei(imei)                             // throws with a readable message (15 digits, optional Luhn, uniqueness)
ABM.stock.addImeis(branchId, productId, ['3512…','8612…'], unitCost, 'purchase', {type:'purchase', id, purchaseItemId}) // registers units + stock + movements
ABM.stock.findSellable(imei, branchId)                   // IMEI row available|returned at that branch, or null
ABM.stock.sellImei(imeiId, branchId, saleItemId, saleId) // status sold, stock −1, returns unit cost
ABM.stock.returnImei(imeiId, branchId, 'good'|'defective', {type:'sale_return', id}, notes)
ABM.stock.markDefective(imeiId, notes) / restoreImei(imeiId, notes)
ABM.stock.shipImei(imeiId, fromBranchId, transferId) / receiveImei(imeiId, toBranchId, transferId) / revertImeiTransit(imeiId, fromBranchId, transferId, notes)
ABM.stock.returnToSupplier(imeiId, {type:'supplier_return', id}, notes)   // defective unit → 'returned_to_supplier' (no double stock deduction)
ABM.stock.receiveReplacement(imeiId, newSerial, ref, notes)               // supplier swap: new unit in stock at the original cost
ABM.stock.scrapImei(imeiId, ref, notes)                                   // write a unit off for good
ABM.stock.removeForSupplierReturn(branchId, productId, qty, ref, notes)   // non-serialized goods going back
ABM.stock.countAdjust(branchId, productId, countedQty, {type:'stock_count', id}, notes)  // physical count → count_in / count_out, returns the signed variance
ABM.stock.markMissing(imeiId, ref, notes) / markFound(imeiId, ref, notes)  // unit not on the shelf → 'missing' (not sellable) and back
ABM.stock.moveCountedUnit(imeiId, toBranchId, ref, notes)                  // unit counted at a branch the registry did not expect
ABM.stock.SELLABLE  // ['available','returned']

ABM.shift.current(userId, branchId)      // the cashier's open drawer, or null
ABM.shift.open({branchId, userId, float, notes})       // one open drawer per cashier; throws otherwise
ABM.shift.tally(shiftOrId)               // { lines[], totals, expected, movements } — live, derived from the records
ABM.shift.movement(shiftId, 'pay_in'|'pay_out'|'bank_drop', amount, reason, {reference, accountId})  // a bank drop with accountId also deposits it
ABM.shift.close(shiftId, {counted, denominations, handoverTo, handoverAmount, bankedAmount, notes})
ABM.bank.accounts(branchId?) / account(id) / balance(id) / total(branchId?)
ABM.bank.post(accountId, {type, amount, date, method, reference, party, notes, ref, chequeId, allowOverdraft})  // the ONLY way a balance moves
ABM.bank.deposit / withdraw / transfer(fromId, toId, amount, opts) / reverse(txnId, reason)
ABM.bank.NON_CASH / isNonCash(method)    // card, jazzcash, easypaisa, bank_transfer
ABM.bank.accountFor(method, branchId)    // Banking-page mapping (settings.payment_accounts) → wallet by name → branch current account
ABM.bank.receive(method, amount, {accountId?, branchId, reference, party, notes, ref})  // non-cash money IN; null for cash / store credit / khata
ABM.bank.pay(method, amount, {...})      // non-cash money OUT; throws if it would overdraw
ABM.bank.undo(bankTxnId, reason)         // reverse the bank side of a voided / cancelled document (idempotent)
ABM.bank.cheque.issue(data) / receive(data) / deposit(id, accountId) / clear(id, opts) / bounce(id, reason) / cancel(id, reason) / due(branchId?)
// A cheque is a promise: only clear() moves the bank balance. With data.postLedger the cheque IS the
// payment: it writes the customer / supplier ledger entry itself (cheque.ledger_txn_id), and bounce() or
// cancel() undo exactly that entry (bank.cheque.unsettle). A cheque without it never touches a ledger.
ABM.utils.sameBarcode(stored, scanned) / toEan13(code) / eanCheck(twelve)   // 12-digit codes match their EAN-13
ABM.shift.suggestedFloat(branchId)       // what the last closed shift handed over, else settings.cash_float

ABM.barcode.svg(value, {height, moduleWidth, maxWidth, showText, symbology})  // <svg> in true millimetres
ABM.barcode.encode(value)                // picks EAN-13 for a 12/13-digit number, Code 39 for anything else
ABM.barcode.checkDigitEan13(twelve)      // the 13th digit
// assets/js/barcode.js is loaded only by the pages that draw codes (labels.html). Sizes are in mm so a
// printed sticker is the size it claims; never give a barcode svg width:100% - the height scales with it.

ABM.ledger.customer(customerId, branchId, 'sale'|'payment'|'refund'|'store_credit'|'adjustment'|'opening_balance', debit, credit, {referenceType, referenceId, paymentMethod, paymentReference, notes})
ABM.ledger.supplier(supplierId, branchId, 'purchase'|'payment'|'return'|'adjustment'|'opening_balance', debit, credit, {…})
ABM.ledger.customerStoreCredit(customerId)               // positive number if the customer has store credit
```

All service calls throw `Error` on invalid input — wrap multi-step flows in try/catch and show `ABM.ui.error(e.message)`.
(There is no transaction rollback in the prototype; validate everything first, then apply writes.)

Icon names: home cart receipt return cube tag qr archive transfer truck store users user-group banknotes
lock chart building cog clipboard bell search menu x chevron-down chevron-right chevron-left chevron-up
plus minus printer logout user trash edit eye check check-circle x-circle warning info refresh phone
download upload filter calendar trend-up trend-down card wallet document dots grid scale barcode
arrow-right arrow-left arrow-up-right clock mail map-pin phone-call key shield calculator sparkles scan

### Global theme (dark mode + accent presets)

The look of every page is controlled centrally by `assets/css/app.css` (design tokens + components) and
`assets/js/tailwind-config.js` (maps Tailwind's `navy` and `slate` palettes to those tokens and restores the saved
theme before first paint). The topbar has a dark-mode toggle and an accent picker (Navy, Indigo, Violet, Teal, Ocean).

```js
ABM.theme.get()            // { mode: 'light'|'dark'|'system', accent: 'navy' }
ABM.theme.set({ mode: 'dark' }) / ABM.theme.set({ accent: 'violet' }) / ABM.theme.toggle()
ABM.theme.isDark()
ABM.theme.setCustom('#ff6a00')   // any colour: generates a 50–950 scale for the whole software (accent = 'custom'); ABM_THEME.shadeScale(hex) returns the scale
ABM.theme.chart()          // { grid, tick, primary, money, warn, danger, info, series[] } — use for every Chart.js chart
ABM.theme.onChange(fn)     // re-draw charts when the theme changes
```

Rules so pages look right in BOTH modes without any extra work:
- Use `slate` utilities for text/borders/backgrounds on normal surfaces (they invert automatically in dark mode) and
  `.card/.stat/.input/...` component classes (they use the surface token).
- On dark/coloured backgrounds (sidebar-like panels, navy headers, coloured buttons) use `text-white`, `text-white/70`,
  `border-white/10` — never `text-slate-*` there (it would invert to dark text).
- Tint chips: `bg-emerald-100 text-emerald-700` etc. are auto-adjusted in dark mode; prefer the `.chip chip-money|chip-navy|chip-danger|chip-warning|chip-info` classes for icon chips.
- Charts: pass `ABM.theme.chart()` colours (grid/tick/series) and redraw on `ABM.theme.onChange`.
- Extra components available: `.alert alert-info|success|warning|danger`, `.timeline .timeline-item(.done)`, `.progress(.progress-money) > div`,
  `.tabs-pill`, `.btn-group`, `.avatar`, `.card-hover`, `.stat-accent|stat-money|stat-danger|stat-warning`, `.pagination`, `.table-striped`, `.th-sort`.

## 3. Collections (mock DB shape = planned MySQL schema)

All money fields are numbers (2 dp). Dates: `*_date` = `'YYYY-MM-DD'`, `*_at` = ISO datetime string.

- `branches` {id, code, name, address, phone, tax_id, is_active}
- `users` {id, branch_id|null, name, username, email, phone, role: a oles.key (seed: super_admin|branch_manager|cashier|technician), is_active, last_login_at, specialties (optional, technicians)}
- `categories` {id, name, is_imei_tracked, is_active} · `brands` {id, name, is_active}
- `products` {id, category_id, brand_id, name, model, variant, color, sku, barcode, is_imei_tracked, cost_price, retail_price, wholesale_price, tax_rate, min_stock, description, image, is_active}
- `branch_stock` {id, branch_id, product_id, quantity, avg_cost}  — one row per branch+product; quantity counts sellable units (for IMEI products = IMEIs with status available|returned)
- `product_imeis` {id, product_id, branch_id, imei(15 digits), imei2, status: available|sold|in_transit|returned|defective, cost_price, purchase_item_id, sale_item_id, notes}
- `stock_movements` {id, branch_id, product_id, imei_id, movement_type: purchase|sale|sale_return|transfer_out|transfer_in|adjustment|opening|defective|count_in|count_out, quantity(+/-), unit_cost, balance_after, reference_type, reference_id, notes, user_id, created_at}
- `suppliers` {id, name, contact_person, phone, email, address, tax_id, balance(payable), notes, is_active}
- `purchases` {id, purchase_no, branch_id, supplier_id, supplier_invoice_no, purchase_date, subtotal, discount_amount, tax_amount, total, paid_amount, status: received|cancelled, purchase_order_id(null for a direct purchase), notes, created_by}
- `purchase_items` {id, purchase_id, product_id, quantity, unit_cost, total, imeis: [string], po_item_id(the order line this delivery was credited to, null for a direct purchase)}
  - `imeis` is also the record of **how** the line was received: cancelling a purchase gives units back one by one when it holds serials and by quantity when it does not, whatever the product's tracking says today.
- `purchase_orders` {id, po_no (PO-MB-000001), branch_id, supplier_id, order_date, expected_date, status: draft|ordered|partial|completed|cancelled, subtotal, discount_amount, tax_amount, total, terms, notes, created_by, ordered_at, closed_at, closed_short(1 = the balance was written off, so cancelling a delivery must not re-open it), cancelled_at} — what was ordered; nothing moves in stock or the ledger until a delivery is received against it.
- `purchase_order_items` {id, po_id, product_id, quantity(ordered), received_quantity, unit_cost, total, notes}
  - Receiving `purchase-create.html?po=<id>` creates the purchase, stamps `purchases.purchase_order_id`, adds to each line's `received_quantity` and sets the order to `partial` (units outstanding) or `completed` + `closed_at`. Cancelling that purchase subtracts the units again and reopens the order.
  - A delivery credits an order line by `po_item_id` first and by product only as a fallback, and a delivery that credits **nothing** (every line removed, or the order edited meanwhile) leaves the order's status untouched — it must never flip an order to `partial` without receiving anything. Receiving more than was ordered is recorded and warned about, not silently capped.
  - "Outstanding" only ever means a live order: a draft was never placed, and a closed or cancelled order is owed nothing. Values shown against an order are line costs scaled by `total / subtotal`, so an order-level discount or tax is reflected.
  - `draft` is editable and deletable; `ordered`/`partial` can be received, cancelled, or (partial only) closed short — "the rest is never coming". A cancelled order keeps whatever was already delivered.
  - An order is **overdue** when `status` is ordered|partial and `expected_date < today`; that drives the red tiles and badges.
- `supplier_transactions` {id, supplier_id, branch_id, type: purchase|payment|return|adjustment|opening_balance, reference_type, reference_id, debit(we paid), credit(we owe), balance_after, payment_method, payment_reference, notes, created_by, created_at}
- `customers` {id, name, phone, email, address, cnic, credit_limit, balance(receivable; negative = store credit), is_walkin, notes, is_active}
- `customer_transactions` {id, customer_id, branch_id, type: sale|payment|refund|store_credit|adjustment|opening_balance, reference_type, reference_id, debit(customer owes more), credit(customer paid / credit issued), balance_after, payment_method, payment_reference, notes, created_by, created_at}
- `sales` {id, invoice_no, branch_id, customer_id, user_id, sale_date, subtotal, discount_type: percent|fixed|null, discount_value, discount_amount, tax_rate, tax_amount, total, paid_amount, due_amount, status: completed|partially_returned|returned|void, notes}
- `sale_items` {id, sale_id, product_id, imei_id, imei, quantity, unit_price, unit_cost, discount_amount, tax_amount, total, returned_quantity}
- `sale_payments` {id, sale_id, method: cash|card|jazzcash|easypaisa|bank_transfer|store_credit, amount, reference, created_at}
- `sale_returns` {id, return_no, sale_id, branch_id, customer_id, user_id, return_date, subtotal, refund_amount, refund_method: cash|store_credit|ledger, reason, notes}
- `sale_return_items` {id, return_id, sale_item_id, product_id, imei_id, quantity, unit_price, total, condition: good|defective}
- `stock_transfers` {id, transfer_no, from_branch_id, to_branch_id, status: pending|approved|shipped|received|rejected|cancelled, requested_by, approved_by, shipped_by, received_by, notes, rejection_reason, requested_at, approved_at, shipped_at, received_at, cancelled_by, cancelled_at}
- `transfer_items` {id, transfer_id, product_id, quantity (requested), shipped_quantity, received_quantity, missing_quantity, damaged_quantity, receive_notes, unit_cost, imei_ids: [number]} — seed rows may omit the newer counters; fall back to `imei_ids.length` / `quantity`.
- `stock_movements.movement_type` also allows `repair` (parts consumed by a job), `transfer_return` (a shipped unit sent back to the source branch), `supplier_return` (goods going back to a supplier), `supplier_replacement` (a replacement unit coming in) and `scrap` (written off).
- `supplier_returns` {id, return_no (SRT-MB-000001), branch_id, supplier_id, purchase_id, return_date, status: draft|sent|completed|cancelled, resolution: credit_note|replacement|refund|scrap, reason, subtotal, credit_amount, notes, created_by, sent_at, completed_at, cancelled_at}
- `supplier_return_items` {id, return_id, product_id, imei_id, quantity, unit_cost, total, condition: defective|damaged|wrong_item|excess, resolution_note, replacement_imei_id}
- `product_imeis.status` also allows `returned_to_supplier` (sent back, awaiting their decision), `scrapped` (written off) and `missing` (a stock take could not find it). None of them is sellable; `missing` can come back through `ABM.stock.markFound()` or a later count that scans the unit.
- `stock_counts` {id, count_no (CNT-MB-000001), branch_id, count_date, scope: all|category|brand|low, scope_id, scope_label, status: in_progress|completed|cancelled, notes, created_by, counted_by, items_total, counted_items, variance_qty, variance_value, gain_value, loss_value, started_at, completed_at, cancelled_at}
- `stock_count_items` {id, count_id, product_id, serialized, expected_qty (frozen when the sheet was started), counted_qty (null = not counted yet), unit_cost, variance_qty, variance_value, scanned: [serial], missing_ids: [imei id], extra_serials: [serial], notes, counted_at, counted_by}
  - Counting changes **nothing** in stock. Posting does, and it posts against the quantity the system holds **now**, not the frozen `expected_qty` — so a sale made while the sheet was open is not counted twice. The page shows a "system now" column whenever the two differ.
  - Serialized lines are counted by scanning: units not scanned become `missing`, an unknown serial is registered as new stock, a unit the registry holds at another branch is moved in, and a previously `missing` unit that is scanned comes back. A serialized **surplus** cannot be posted without serials — the page blocks it.
  - Movement types `count_in` / `count_out` carry `reference_type: 'stock_count'`, which is what separates a stock take from a manual `adjustment` in the inventory report.
- `expense_categories` {id, name, is_active} · `expenses` {id, branch_id, category_id, amount, expense_date, payment_method, description, reference, created_by}
- `daily_closings` {id, branch_id, closing_date, opening_balance, cash_sales, cash_received, cash_refunds, cash_expenses, supplier_cash_payments, expected_cash, actual_cash, discrepancy, bank_deposit, retained_float, denominations, notes, status: open|closed, closed_by, closed_at}
- `cashier_shifts` {id, shift_no (SFT-MB-000001), branch_id, user_id (the cashier), status: open|closed, opened_at, opened_by, closed_at, closed_by, opening_float, expected_cash, counted_cash, variance (counted − expected), denominations, handover_to, handover_amount, banked_amount, totals (frozen at close), notes}
- `cash_movements` {id, shift_id, branch_id, type: pay_in|pay_out|bank_drop, amount, reason, reference, created_by, created_at} — cash that no other document records (float top-ups, petty pay-outs, bank drops).
  - A shift is **derived, never tallied by hand**: `ABM.shift.tally(shift)` reads the cash sales, khata receipts, repair payments, refunds, expenses and supplier payments that cashier handled at that branch between opening and closing, plus the shift's own `cash_movements`. Nothing can drift out of step with the records.
  - A POS sale carries `sales.shift_id`: the drawer it was rung up in, or `null` when none was open (then it belongs to **no** shift). Sales from before this module existed have no such field and fall back to who took the money and when.
  - A cashier may have only one open drawer, and `shifts.view` / `shifts.manage` are **scoped in the pages**: a cashier only ever sees and closes their own; a manager sees their branch.
  - Shifts sit *inside* the branch day: the day-end Z-report still reconciles the whole branch, and shows the drawers that ran that day.
- `audit_logs` {id, user_id, branch_id, action, entity_type, entity_id, details, ip, created_at}
- **Universal product fields** (all products): `product_type` device|accessory|part|service · `device_type` mobile|tablet|smartwatch|laptop|desktop|null ·
  `is_serialized` (1 = tracked per unit) · `serial_type` imei|serial (laptops/desktops use serial numbers) · `is_imei_tracked` (legacy mirror of is_serialized) ·
  `is_stock_tracked` (0 for services/labor) · `unit` pcs|job · `condition` new|used|refurbished · `specs` {processor, generation, ram, storage, screen, os, battery_health, graphics, camera, battery, connectivity, ports} ·
  `warranty_months` · `min_sale_price` · `max_stock` · `reorder_qty` · `supplier_id` · `tags[]` · `image` (data URL or URL) · `serial_prefix`.
  `categories` carry the defaults: {product_type, device_type, is_serialized, serial_type}. `product_imeis.imei` holds the IMEI **or** serial number (`serial_type` on the row).
- `repair_jobs` {id, job_no (JOB-MB-000001), branch_id, customer_id, device_type, brand, model, serial, serial_type, color, password_pattern, accessories_received, condition_notes, problem_description, diagnosis, status: received|diagnosing|awaiting_approval|awaiting_parts|in_progress|ready|delivered|cancelled, priority: normal|urgent, technician_id, estimated_cost, quoted_at, approved_by_customer, total_parts, total_labor, discount, total, paid_amount, due_amount, warranty_days, promised_at, received_at, completed_at, delivered_at, cancel_reason, notes, created_by}
- `repair_items` {id, job_id, type: part|labor, product_id, description, quantity, unit_price, unit_cost, total} · `repair_payments` {id, job_id, method, amount, reference, kind: advance|final|partial, created_at, created_by} · `repair_status_log` {id, job_id, status, notes, user_id, created_at}
- `online_orders` {id, order_no (WEB-000001), status: pending|confirmed|packed|out_for_delivery|delivered|cancelled, payment_method: cod|bank_transfer|jazzcash|easypaisa, payment_status: paid|unpaid, payment_reference, customer {name, phone, email, address, city, notes}, customer_id, items [{product_id, name, quantity, unit_price, total}], subtotal, delivery_fee, discount, total, branch_id, sale_id, source, status_log [{status, at, by}], internal_notes, created_at}
- `repair_requests` {id, name, phone, email, device_type, brand, model, problem, preferred_date, preferred_branch_id, status: new|contacted|converted|closed, job_id, notes, created_at} — booked from the public website
- `contact_messages` {id, message_no (MSG-ON-000001), name, phone, email, subject, message, status: new|read|replied|archived, source, replied_at, notes, created_at} — website contact form, read in inbox.html
- `newsletter_subscribers` {id, email, source: website|in-store, is_active, created_at}
- `email_outbox` {id, to, subject, body_html, template: order_invoice|generic, reference_type, reference_id, status, source, created_at} — every email the app composed. There is no mail server in the prototype: `SHOP.sendEmail()` records the message here and the UI offers a mailto: fallback. Swapping that one function for a real send is the whole backend change.
- `cms` (single document via `ABM.db.cms()` / `ABM.db.saveCms(patch)`): `site` {name, tagline, logo, favicon, hero{badge,title,subtitle,cta_text,cta_link,cta2_text,cta2_link,image,style}, announcement{enabled,text}, featured_category_ids[], featured_product_ids[], highlights[{icon,title,text}], about_html, contact{phone,whatsapp,email,address,hours,map_url}, social{facebook,instagram,tiktok,youtube,whatsapp}, footer_text, theme{primary,accent,background,mode,font,radius,header_style,button_style}, seo{title,description,keywords}, commerce{show_prices,allow_orders,cod_enabled,bank_transfer_enabled,wallet_enabled,delivery_fee,free_delivery_above,fulfil_branch_id,order_prefix,show_stock,allow_backorder,whatsapp_orders,bank_details,min_order}, repair_booking{enabled,intro,device_types[],show_prices}} · `pages` [{id, slug, title, content_html, is_published, show_in_menu, sort_order, updated_at}] · `menu` [{id,label,url,sort_order,is_active}] · `banners` [{id,title,subtitle,image,link,color,is_active,sort_order}] · `testimonials` [{id,name,text,rating,is_active}]
- `settings` object: company_name, company_tagline, currency, currency_symbol, default_tax_rate, tax_label, invoice_prefix, receipt_footer, invoice_terms, thermal_width, default_print_layout, low_stock_alerts, imei_luhn_check, allow_negative_stock, default_customer_id, cash_float, payment_accounts {branchId: {card, jazzcash, easypaisa, bank_transfer: bank_account id}}

Business rules to respect in the UI logic:
- Stock math: selling decrements `branch_stock.quantity`; IMEI sale sets `product_imeis.status='sold'` + `sale_item_id`. Sale return good→ IMEI `returned` (+1 stock), defective→ `defective` (no stock). Transfer ship → IMEIs `in_transit` and source −qty; receive → IMEIs move to destination branch, `available`, destination +qty. Always append a `stock_movements` row.
- Customer ledger: balance += debit − credit. Supplier ledger: balance += credit − debit. Append a `*_transactions` row with `balance_after`.
- Day-end / shift expected cash = opening + cash sales + cash khata received + cash repair payments + supplier cash refunds + drawer pay-ins − cash refunds − cash repair refunds − cash expenses − supplier cash payments − pay-outs − bank drops (± bank cash deposits / withdrawals at day-end). `ABM.shift.tally` is the reference implementation.
- Gross profit = Σ(unit_price·qty − discounts) − Σ(unit_cost·qty).

Money rules (the money-integrity pass — every page follows them):
- **Non-cash money goes through the bank.** Card, JazzCash, EasyPaisa and bank-transfer money never sits in a drawer: `ABM.bank.receive` / `bank.pay` posts it to the account it lands in or leaves (Banking → "Where card & wallet money lands"), and the source row keeps the bank row's id as `bank_txn_id` (sale_payments, customer_transactions, repair_payments, supplier_transactions, expenses, sale_returns, cash_movements for bank drops). Voiding, cancelling or deleting the document calls `ABM.bank.undo(bank_txn_id)`.
- **Count money once.** A customer ledger credit written for money that is also a `sale_payments` row carries `sale_payment_id`; cash counts skip it (`ABM.ledger.mirrorsSalePayment(t)`).
- **Cheques are payments only when linked.** `postLedger: true` makes the cheque write the ledger entry (`ledger_txn_id`); bounce / cancel undo exactly that. Cheques move the bank only when they clear.
- **Refunds are rows, never deletions.** `repair_payments.kind = 'refund'` (positive amount, money out); a voided payment gets a refund row with `voids_payment_id`. A supplier paying us back is `supplier_transactions.type = 'refund'` (credit). Sale returns never pay out more money than the invoice received, and settle any unpaid khata first.
- **Two tabs share one database.** Another tab's save is adopted at once (a "changed in another tab" bar appears), so pages re-read records at save time instead of trusting values captured when they opened.
- Seed: the demo settles each day's card / wallet / transfer takings into the branch account or the JazzCash / EasyPaisa merchant wallets, and supplier / expense transfers leave the branch account.
- Document numbers via `db.nextNumber(prefix, branchCode)`: INV, PUR, TRF, RET.

## 4. Roles & permissions

Roles are **data** (`roles` collection), edited on `roles.html` / `role-edit.html`. `users.role` holds a role key.

**Permission key** = `<module>.<action>`. Every sidebar screen is a module (`ABM.roles.MODULES`, 30 of them); each
module lists which of the five standard actions it uses — `view`, `add`, `edit`, `delete`, `export` — plus module
extras (`sales.print`, `sales.all`, `customers.payments`, `repairs.assign|deliver|work`, `transfers.approve|ship|receive`,
`suppliers.payments`, `shifts.all`). `ABM.roles.KEYS` is the full list (123 keys). `notes` on a module say what an
action means there (e.g. Sales History: Delete = void a sale; Branches: Delete = deactivate).

Rules:
- `super_admin` is the one locked, full-access role (every key, every branch, cannot be edited or deleted). Company-wide
  (all-branch) access is reserved for it; `session.isSuperAdmin()` still means "may switch branch".
- Any action implies View of its module (`roles.normalize` adds it; unticking View clears the whole module).
- Nobody can grant a permission they do not hold, or give out / edit a role bigger than their own (`roles.canGrant`,
  `roles.assignable`). Removing `roles.edit` from your own role is refused (no lock-out). Built-in roles cannot be
  deleted; a role that any user still has cannot be deleted. Every create / update (full added/removed list) / delete is audited as `role.*`.
- Scopes that used to be role names are now permissions: `sales.all` (otherwise a user sees only the invoices they rang
  up), `shifts.all` (otherwise only their own drawer), `repairs.work` (can be put on jobs; with `repairs.work` but not
  `repairs.assign` = bench technician: own + unassigned jobs only, prices hidden — `roles.isBench(key)`).
- Old names still resolve through `PERM_ALIASES` (`products.manage` → `products.edit`, `pos.access` → `pos.view`,
  `bank.manage` → `banking.edit`, `staff.view` → `users.view` …), but pages use the canonical keys.

API:
```js
ABM.session.can('products.delete')         // current user; Alpine: $can('products.delete')
ABM.roles.has(roleOrKey, perm) / permsOf(role) / ticked(role, perm)   // ticked = on the role itself, not via Super Admin
ABM.roles.all() / get(key) / label(key) / module(key) / moduleForPage(page) / describe(perm)  // "Sales History: Delete"
ABM.roles.create({name, description, color, permissions}) / update(id, form) / remove(id) / validate(form, id)
ABM.roles.homeFor(key)        // dashboard → POS → repairs → first menu item the role can open
ABM.roles.technicians(branchId) / isBench(key) / canGrant(role) / assignable()
ABM.ui.roleBadge(key)         // chip in the role's colour
ABM.utils.canExportHere()     // Export permission of the page's module (data-page → module); hide Export buttons with it
```
Exporting is enforced centrally: `utils.download()` refuses a CSV when the page's module lacks `export` (pass
`{ allow: true }` for non-data files such as an import template). Pages expose `canAdd` / `canManage`(edit) /
`canDelete` flags, gate buttons with them and repeat the check inside the handler. `data-perm="a|b"` opens a page for
either permission (a create page that also edits) — the page then checks which one applies.

Starting roles (all editable except Super Admin): **Branch Manager** (whole branch incl. void, returns, approvals,
banking, closing, reports, staff list; no settings/branches/roles), **Cashier** (POS, own sales, customers add,
repair intake & delivery, online orders, inbox, own drawer; no exports), **Technician** (repairs view/add/edit + work,
customers view/add, products & stock view).
Demo logins: admin, manager, cashier, sana (B2 manager), usman (B2 cashier), technician (Zain, MB), faraz (B2 technician).
Branch scoping: non-super-admin pages must filter by `ABM.session.branchId()`; super admin sees the
active branch chosen in the topbar (offer an "All branches" toggle where it makes sense, e.g. reports).

## 5. Pages & nav keys

| file | data-page | perm | notes |
|---|---|---|---|
| dashboard.html | dashboard | dashboard.view | KPIs, charts (done) |
| pos.html | pos | pos.view | full POS terminal |
| sales.html / sale-view.html / invoice.html | sales / sale-view / invoice | sales.view | list, detail (+return), print A4/80mm |
| returns.html | returns | returns.view | returns list + new return (returns.add) |
| customers.html / customer-view.html | customers / customer-view | customers.view | ledger, receive payment, statement |
| products.html / product-view.html | products / product-view | products.view | catalog, stock per branch, IMEIs |
| categories.html | categories | categories.view | categories + brands tabs |
| imeis.html | imeis | imei.view | registry, bulk add (imei.add), lookup, status (imei.edit) |
| stock.html | stock | inventory.view | branch stock, low stock (`?filter=low`), adjustments |
| transfers.html / transfer-create.html / transfer-view.html | transfers / transfer-create / transfer-view | transfers.view | workflow request→approve→ship→inspect/receive |
| purchases.html / purchase-create.html / purchase-view.html | purchases / purchase-create / purchase-view | purchases.view | stock inward with IMEI entry |
| suppliers.html / supplier-view.html | suppliers / supplier-view | suppliers.view | payables ledger, pay supplier |
| expenses.html | expenses | expenses.view | categorized expenses |
| day-end.html / closings.html | day-end / closings | closing.view | Z-report, history |
| reports.html + report-*.html | reports / report-… | reports.view | hub + individual reports |
| branches.html / users.html / settings.html / audit-log.html / profile.html | branches / users / settings / audit-log / profile | branches.view / users.view / settings.view / audit.view / (none) | admin; settings & website have a view-only mode without .edit |
| roles.html / role-edit.html | roles / role-edit | roles.view | role cards + compare table; permission matrix editor (?id=, ?copy=, new) |

Cross-page links use query strings: `sale-view.html?id=12`, `invoice.html?id=12&layout=thermal`,
`product-view.html?id=3`, `customer-view.html?id=4`, `supplier-view.html?id=2`,
`transfer-view.html?id=5`, `purchase-view.html?id=1`, `pos.html?customer=4`, `stock.html?filter=low`,
`imeis.html?product=3`, `report-imei-history.html?imei=3512…`.

## 6. UI conventions

- Use the shared classes: `.btn .btn-primary|btn-money|btn-secondary|btn-danger|btn-ghost|btn-soft .btn-sm .btn-icon`,
  `.card .card-header .card-title .card-subtitle .card-body .card-footer`, `.stat`, `.page-header .page-title .page-subtitle .page-actions`,
  `.label .input .select .textarea .field-error .help .input-icon .input-group .switch`, `.badge badge-*`, `.table .table-wrap .num`,
  `.modal-backdrop .modal-panel(.modal-lg/.modal-xl) .modal-header .modal-body .modal-footer`, `.dropdown .dropdown-item`, `.tabs .tab`, `.empty`, `.kbd`, `.pipeline`.
- Money actions (checkout, receive payment, pay supplier, close day) use `.btn-money`. Primary navigation actions use `.btn-primary`. Destructive use `.btn-danger` + `ABM.ui.confirm({danger:true})`.
- Every list page: search box, relevant filters, results count, pagination (`utils.paginate`, 15/page), empty state, CSV export where useful.
- Every form: inline validation messages (`.field-error`), disabled submit while busy, toast on success, write to `ABM.db`, `db.audit(...)` for important actions.
- Modals: Alpine `x-show` + `x-cloak` + `@keydown.escape.window`, `@click.self` on backdrop to close, focus first field.
- Responsive: mobile-first; tables inside `.table-wrap`; hide secondary columns with `hidden md:table-cell`; page must work at 400px wide with NO horizontal scroll. KPI grids: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. **Every `grid` must include a base `grid-cols-1`** (e.g. `grid grid-cols-1 lg:grid-cols-3`) — without it the implicit `auto` track grows to a table's intrinsic width and the page scrolls sideways on phones. Put `min-w-0` on grid/flex children that hold long text or numbers; never use fixed pixel widths wider than ~320px. Open any page with `?__layout=1` to log overflowing elements to the console (the render script captures them). Add `&__click=<css selector>` to auto-click an element after load (e.g. `&__click=[data-user-menu]` or `&__click=%23btn-add` for `#btn-add`) so a screenshot shows an open modal/menu — modals must also fit 400px (`.modal-panel` is full-width there; keep form grids `grid-cols-1 sm:grid-cols-2`).
- Verify your pages: `powershell -ExecutionPolicy Bypass -File tests\render.ps1 -Page products.html -As admin` (add `-Mobile` for 400px, `-As manager|cashier` for roles). It prints console errors and saves a screenshot to `tests/out/` that you can open with the Read tool. A page is not done until it renders with 0 errors on desktop and mobile.
- Always escape user data (`x-text` is safe; only use `x-html` with `ABM.icon`, `$badge` or `utils.escape`d strings).
- Tax invoice must show: branch header (name, address, phone, NTN/tax id), invoice no, date, cashier, customer, itemized lines **with IMEI**, subtotal, discount, tax, grand total, payments, due, terms & conditions, QR-code placeholder.
- No external resources beyond: Tailwind CDN, Alpine CDN (jsdelivr), Chart.js (cdnjs), Google Fonts (Inter). Everything else inline.
- Inline `<script>` at the end of body defining the page component function; larger POS logic may live in `assets/js/pages/pos.js` (load with `defer` after app.js and before Alpine).
- **Selects bound with `x-model` whose options come from `<template x-for>` are fixed automatically** by the runtime (it re-applies the bound value once the options render). Write them normally — no `x-init`/`$nextTick` workaround is needed. `x-sync="expr"` is available if you ever need to force it.

## 7. Universal shop model: mobiles, laptops, parts, services & repairs

The software must work for a mobile shop, a laptop shop, an accessories shop and a mobile/laptop **repair** shop — all at once.
- **Serialized units**: `ABM.db.isSerialized(p)`, `ABM.db.serialType(p)` ('imei' | 'serial'), `ABM.db.serialLabel(p)` ('IMEI' | 'Serial No.'). Use the label everywhere
  instead of hard-coding "IMEI" (tables, forms, invoices, scan placeholders: "Scan barcode / IMEI / serial"). `ABM.stock.validateSerial(value, product)`,
  `ABM.stock.addImeis(...)` (works for serial numbers too), `ABM.stock.findSellable(value, branchId)` and `ABM.stock.findUnit(value)` are case-insensitive.
- **Services / labor** (`product_type === 'service'`, `is_stock_tracked === 0`): sellable at POS and in repair jobs with NO stock movement and cost 0. Never show stock badges for them; never let purchases receive them.
- **Spare parts** (`product_type === 'part'`): normal stock items; used by repair jobs (`ABM.stock.remove(branchId, productId, qty, 'repair', {type:'repair_job', id})`).
- **Specs**: `ABM.db.SPEC_KEYS[device_type]` lists which spec fields to show for a device type; `ABM.db.specLabel(key)` gives the label. The product form must show a dynamic "Specifications" section based on device type (processor/generation/RAM/storage/screen/graphics/OS/battery health for laptops; RAM/storage/screen/OS/camera/battery for phones…) plus `condition` (new/used/refurbished), `warranty_months`, `min_sale_price`, `max_stock`, `reorder_qty`, default `supplier_id`, `tags`, `image` (file → data URL preview, or URL), `description`.
- **Repair jobs (job cards)**: `repairs.html` (list + kanban board by status, filters, technician, priority, overdue = promised_at < now and not ready/delivered),
  `repair-create.html` (intake: customer (search / quick add), device type, brand, model, serial/IMEI (lookup existing unit via `ABM.stock.findUnit` to prefill; scanning allowed),
  color, password/pattern, accessories received, condition notes, problem description, priority, promised date, estimated cost, advance payment → `repair_payments` kind 'advance', technician (optional),
  job_no = `db.nextNumber('JOB', branchCode)`, status 'received', status_log entry, audit `repair.create`, print job receipt (customer copy, 80 mm + A4)),
  `repair-view.html` (job card: status pipeline + actions per role, diagnosis + quote (estimated_cost, quoted_at, customer approval), parts & labor lines
  (`repair_items`: parts from products type part/accessory with stock check, labor from service products or free-text; totals total_parts/total_labor/discount/total),
  parts are consumed from stock when the job moves to `in_progress` (or when a part line is added while in progress), returned to stock if the job is cancelled after consumption,
  payments (`repair_payments`; paid_amount/due_amount), status log timeline with notes, technician assignment, deliver flow: collect balance (split methods allowed), set delivered_at, warranty_days,
  print repair invoice (80 mm + A4, with device serial and warranty), SMS text preview from settings.repair_sms_template, cancel with reason).
  Cash from repair payments is part of the day-end drawer (`cash_repairs`) and repair revenue (delivered jobs) appears in P&L and reports (`report-repairs.html`).
- **Technicians**: users whose role ticks `repairs.work` (`ABM.db.technicians(branchId)` → seed: technicians and managers). Technician home = repairs.html; they may update status, diagnosis, parts/labor on their jobs; they cannot see money reports.

## 8. Public storefront (shop/) & CMS

The website lives in `shop/` (asset paths are `../assets/...`), is **public** (`<body data-public>` — no login, no admin shell) and reads the SAME `ABM.db`
(same origin/localStorage), so products, prices, stock and CMS content edited in the admin appear instantly. It has its own runtime `assets/js/shop.js`
(header/nav/footer/cart/theme from `ABM.db.cms()`) and stylesheet `assets/css/shop.css`; it may use Tailwind + Alpine like the admin but must look like a
modern, premium e-commerce site (not like the admin). Pages: `shop/index.html` (announcement bar, hero, highlights, featured categories, featured products,
banners, laptops section, repair CTA, testimonials, newsletter, footer), `shop/products.html` (grid + filters: category, brand, price range, condition, device type, search, sort;
`?category=&brand=&q=&type=`), `shop/product.html?id=` (gallery placeholder, specs table, price, stock at fulfil branch, add to cart, warranty, related products),
`shop/cart.html`, `shop/checkout.html` (name, phone, email, address, city, payment method (COD / bank transfer / JazzCash / EasyPaisa per commerce settings), order summary,
delivery fee rules → inserts `online_orders` (order_no `db.nextNumber('WEB','')`-style using commerce.order_prefix, status pending) and shows confirmation + tracking link),
`shop/order.html?no=&phone=` (track an order by number + phone), `shop/repair.html` (book a repair → `repair_requests`; shows service price list from service products),
`shop/page.html?slug=` (CMS pages), `shop/contact.html` (contact info, branches list, hours, map placeholder, WhatsApp button, contact form → stored in `contact_messages`).
Storefront theme: `cms.site.theme` {primary, accent, background, mode, font, radius, header_style, button_style} — apply as CSS variables on `<html>` in shop.js
(generate shade scales with `ABM_THEME.shadeScale(hex)`).
Admin CMS pages: `website.html` (tabs: Branding & Hero, Announcement, Home sections (highlights, featured categories/products pickers, banners, testimonials), Pages (CRUD with a
simple rich-text editor: bold/italic/headings/lists/links/images via contenteditable toolbar, slug, publish toggle, menu toggle, preview), Menu (add/remove/reorder), Contact & Social,
Commerce settings (delivery fee, free-delivery threshold, payment methods, bank details, fulfil branch, WhatsApp orders), SEO, **Theme & Colours** (colour pickers with live
preview of a mini storefront and the option to apply the same colour to the software via `ABM.theme.setCustom(hex)`)), `online-orders.html` (list, status tabs, filters, quick status
actions), `online-order-view.html?id=` (details, items with stock check, status workflow pending→confirmed→packed→out_for_delivery→delivered / cancelled, payment status,
"Create invoice" → converts to a `sales` row + stock deduction via ABM.stock at the fulfil branch (serialized items: pick units), links sale_id, print packing slip, customer quick-create),
plus `repair-requests` handled inside repairs.html (tab "Website requests" → convert to job card).

## 9. Additional pages (extends the table in §5)

| file | data-page | perm |
|---|---|---|
| repairs.html / repair-create.html / repair-view.html | repairs / repair-create / repair-view | repairs.view (create: repairs.create) |
| online-orders.html / online-order-view.html | online-orders / online-order-view | orders.view |
| inbox.html | inbox | messages.view (actions need messages.manage) |
| supplier-returns.html / supplier-return-create.html / supplier-return-view.html | supplier-returns / supplier-return-create / supplier-return-view | purchases.view (actions need purchases.manage) |
| purchase-orders.html / purchase-order-create.html / purchase-order-view.html | purchase-orders / purchase-order-create / purchase-order-view | purchases.view (create & edit need purchases.manage) |
| stock-counts.html / stock-count-view.html | stock-counts / stock-count-view | inventory.view (counting & posting need inventory.adjust) |
| banking.html / bank-account-view.html | banking / bank-account-view | bank.view (moving money needs bank.manage) |
| cheques.html | cheques | bank.view (recording and clearing needs bank.manage) |
| shifts.html / shift-view.html | shifts / shift-view | shifts.view (opening, cash movements & closing need shifts.manage; a cashier is scoped to their own drawer) |
| labels.html | labels | products.view — shelf labels & barcode stickers; accepts ?product= / ?ids= / ?category= / ?purchase= / ?low=1 |
| products-import.html | products-import | products.manage — CSV import wizard (read → match columns → per-row preview → import) |
| website.html | website | website.manage |
| report-repairs.html / report-online-sales.html | report-repairs / report-online-sales | reports.branch |
| shop/index.html, shop/products.html, shop/product.html, shop/cart.html, shop/checkout.html, shop/order.html, shop/repair.html, shop/page.html, shop/contact.html | (public, data-public) | none |
