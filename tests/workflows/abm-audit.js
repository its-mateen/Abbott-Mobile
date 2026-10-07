export const meta = {
  name: 'abm-audit',
  description: 'Audit the finished Abbott Mobile frontend: drive real end-to-end flows, check links/roles/consistency, then fix what is broken',
  phases: [
    { title: 'Audit', detail: 'one agent per area: drive the flow in a real browser, verify the data it wrote' },
    { title: 'Fix', detail: 'repair every confirmed defect and re-verify' },
  ],
}

const ROOT = 'C:\\xampp\\htdocs\\abm'
const CFG = Array.isArray(args) ? { areas: args } : (args || {})
const SELECTED = CFG.areas || []

const COMMON = `
Project: the **Abbott Mobile** frontend prototype at ${ROOT} — a universal retail + repair management system
(mobile / laptop shops, repair lab) with a public e-commerce storefront and CMS. Static .html + Tailwind (Play CDN)
+ Alpine.js 3 + a shared runtime (assets/js/app.js) over a localStorage mock database seeded by assets/js/data.js.
Every page is already built and renders with 0 console errors on desktop and at 400px. Your job is to prove the
FUNCTIONALITY is real and correct, and to fix what is not.

READ FIRST: ${ROOT}\\docs\\FRONTEND-GUIDE.md (ABM API, §2 date-range bar, §3 data shapes, §7 universal model,
§8 storefront/CMS) and the pages you are auditing.

HOW TO DRIVE A REAL FLOW (this is the point of the task — do not settle for reading code):
A static server runs at http://127.0.0.1:8085 (start it if down:
  Start-Process php -ArgumentList "-S","127.0.0.1:8085","-t","${ROOT}" -WindowStyle Hidden ).
Write a throwaway driver page under ${ROOT}\\tests\\ (e.g. tests\\drive-pos.html) that loads
../assets/js/data.js and ../assets/js/app.js, then calls the SAME ABM services the UI calls, asserts the resulting
rows, and console.log()s lines starting with a unique tag (e.g. "DRIVE ...") plus a final "RESULT: PASS|FAIL".
Render it with:
  powershell -ExecutionPolicy Bypass -File ${ROOT}\\tests\\render.ps1 -Page tests/drive-pos.html -NoLogin
then read tests\\out\\<name>.console.log for your tagged lines. This proves the service layer end to end
(stock moved, ledger balanced, documents numbered, totals correct).
For the UI layer, use the harness on the real pages:
  ...render.ps1 -Page "products.html?__layout=1&__click=main%20.btn-primary" -As admin      (opens a modal)
  ...render.ps1 -Page "repair-view.html?id=9" -As technician
  (-Mobile for 400px, -NoLogin for shop/*, -Theme dark to check dark mode)
Open every screenshot with the Read tool and judge it. tests/render.ps1 also supports &__click= to open a modal
or switch a tab before the screenshot.
IMPORTANT: the mock DB lives in localStorage per browser profile, and render.ps1 uses a profile per page+role, so
a driver page's writes do not pollute other pages. Reset with ABM.db.reset() at the top of your driver.

RULES WHEN FIXING
- Fix the page that owns the defect. Never edit assets/js/app.js, assets/css/app.css, assets/js/data.js,
  assets/js/tailwind-config.js or docs/* — if the fix belongs there, report it in sharedFileRequests instead.
- assets/js/shop.js and assets/css/shop.css MAY be edited, but only by the storefront auditor.
- Keep the established conventions: ABM.stock / ABM.ledger for all stock and balance changes, db.nextNumber for
  document numbers, db.audit for important actions, the standard date-range bar, clickable stat tiles,
  ABM.db.serialLabel (never hard-code "IMEI"), grid-cols-1 base on every grid, 400px-safe modals.
- After each fix re-render the affected page (desktop + mobile, relevant roles) and confirm 0 console errors and
  overflowing=0, and look at the screenshot.
- Delete your throwaway tests\\drive-*.html files at the end, or keep them only if they are genuinely reusable
  (name them tests\\drive-<area>.html and say so in notes).

Report precisely: what you drove, what passed, what was broken, what you changed.
`

const AREAS = [
  {
    key: 'selling',
    title: 'POS → invoice → return → ledger',
    pages: 'pos.html, assets/js/pages/pos.js, sales.html, sale-view.html, invoice.html, returns.html',
    spec: `
Drive and verify the whole selling chain:
1. A cash sale of a NON-serialized accessory: stock at the branch must drop by the quantity, a stock_movements row
   of type 'sale' with a negative quantity and the right unit_cost must exist, sale/sale_items/sale_payments must
   balance (subtotal − discounts + tax = total = Σ payments), invoice_no must follow INV-<branchCode>-######.
2. A sale of a SERIALIZED device (phone by IMEI and a laptop by serial): the exact unit becomes status 'sold' with
   sale_item_id set, branch stock −1, sale_items.imei / imei_id populated, unit_cost = that unit's cost_price.
3. A SERVICE line (product_type 'service'): appears on the invoice, NO stock movement, unit_cost 0.
4. A split payment (cash + card) and a credit (khata) sale: due_amount correct, a customer_transactions 'sale'
   debit row with the right balance_after, customer.balance increased by exactly the due.
5. A return from sale-view.html: good condition → unit back in stock as 'returned' and quantity +1; defective →
   status 'defective' and NO stock increase; sale_items.returned_quantity and sale.status updated
   (partially_returned vs returned); refund by store credit → customer ledger credit.
6. invoice.html renders both layouts for a real sale id and for a repair job (?job=), with serial labels correct
   for phone vs laptop lines, totals matching the sale, and the print-area styling intact in dark mode.
Check the UI too: POS scan-by-IMEI and scan-by-serial add the right unit; adding the same unit twice is blocked;
qty above stock is blocked; the cart drawer and checkout modal fit 400px; sales.html filters/tiles/date-range work
and the cashier sees only their own sales.`,
  },
  {
    key: 'repairs',
    title: 'Repair job card lifecycle',
    pages: 'repairs.html, repair-create.html, repair-view.html',
    spec: `
Drive a full job card: intake (customer, device with serial, problem, advance payment) → diagnosis → quote →
customer approval → parts + labour added → in_progress (parts must be CONSUMED from branch stock exactly once,
with stock_movements type 'repair' and negative quantity) → ready → deliver (balance collected across split
methods, repair_payments rows, paid_amount/due_amount correct, delivered_at set, status delivered).
Then verify: cancelling a job AFTER parts were consumed returns them to stock exactly once; a part added while
already in_progress consumes immediately; repair_status_log has one row per transition with the acting user;
totals (total_parts + total_labor − discount = total) are right; job_no follows the settings.repair_prefix.
Role behaviour: a technician can move status and edit diagnosis/parts but must not see money-only reports; a
cashier can take in a job and deliver it; the board view and the list view agree; overdue = promised_at in the past
and status not ready/delivered. Website repair requests convert into a job card with the details prefilled.
Print both documents (job receipt and repair invoice) and check they are legible and light-on-white in dark mode.`,
  },
  {
    key: 'stock',
    title: 'Purchases, transfers, IMEI/serial registry, valuation',
    pages: 'purchases.html, purchase-create.html, purchase-view.html, transfers.html, transfer-create.html, transfer-view.html, imeis.html, stock.html, products.html, product-view.html',
    spec: `
Drive: (1) a purchase that receives BOTH a serialized product (entering IMEIs for a phone and serial numbers for a
laptop — check validation rejects a 14-digit IMEI, a duplicate, and an already-registered unit) and a
non-serialized product, with a partial payment: stock and avg_cost update, units are registered at the right
branch, supplier balance rises by the total and falls by the payment, purchase_no follows PUR-<branch>-######.
(2) Cancelling that purchase reverses stock and removes the units.
(3) A transfer of a serialized line through request → approve → ship → receive with one unit marked Missing and
one Damaged: source stock −n at shipping, units 'in_transit', destination +ok at receiving, missing unit back at
source and available, damaged unit 'defective' and not counted in stock, received_quantity recorded.
(4) A stock adjustment on a non-serialized product writes an 'adjustment' movement with the difference.
Then verify the read models agree: stock.html quantities equal branch_stock, imeis.html status counts equal
product_imeis, product-view.html's per-branch table matches, and report-stock-valuation's weighted-average total
equals Σ(quantity × avg_cost). Check the products.html add/edit modal writes EVERY field (type, device type, specs,
condition, warranty, prices with the cost ≤ min sale ≤ retail rule, stock settings) and that serialized/serial-type
cannot be changed once units exist.`,
  },
  {
    key: 'money',
    title: 'Ledgers, expenses, day-end and the financial reports',
    pages: 'customers.html, customer-view.html, suppliers.html, supplier-view.html, expenses.html, day-end.html, closings.html, report-profit-loss.html, report-balance-sheet.html, report-receivables.html, report-payables.html',
    spec: `
Drive: receiving a customer payment (partial, full, and an overpayment that becomes store credit), a customer
adjustment, a supplier payment allocated against the oldest unpaid purchases, creating/editing/deleting an expense,
and closing a day.
Verify: every ledger row has the correct debit/credit and balance_after and the partner balance equals the running
balance of its ledger; day-end's expected cash = opening + cash sales + cash ledger receipts + cash repair
payments − cash refunds − cash expenses − cash supplier payments, and each contributing list actually contains the
rows it counts (drill into them); closing a day writes daily_closings with the denominations and blocks a second
close; reopening (super admin) removes it.
Cross-check the reports against the raw data for the SAME period: report-profit-loss gross profit equals
Σ(sale line revenue − unit_cost×qty) + repair revenue − repair parts cost; receivables aging total equals
Σ positive customer balances; payables aging total equals Σ positive supplier balances; balance sheet balances
(assets = liabilities + equity). Report any figure that does not reconcile, with the numbers.
Also confirm the date-range bar on each page filters what it claims (compare Today vs This Month counts).`,
  },
  {
    key: 'online',
    title: 'Storefront → online order → invoice, and the CMS',
    pages: 'shop/*.html, assets/js/shop.js, assets/css/shop.css, online-orders.html, online-order-view.html, website.html',
    spec: `
Drive the customer journey in the browser: browse shop/products.html with filters, open a product, add to cart,
open shop/cart.html, complete shop/checkout.html with cash on delivery AND with a wallet payment, then track the
order on shop/order.html with the order number + phone (and confirm a wrong phone does NOT reveal it).
Verify the order row: order_no, items, subtotal, delivery fee rule (free above the threshold), total,
payment_status, status_log. Then in the admin: online-orders.html lists it, online-order-view.html moves it through
confirmed → packed → out_for_delivery → delivered writing status_log rows, and "Create invoice" produces a real
sale with stock deducted (picking units for serialized lines), links sale_id, and the invoice opens.
Also drive the CMS: in website.html change the site name, hero title, a menu item, a page's content, commerce
delivery fee and the storefront theme colour; save; then re-render the storefront and confirm every change appears
(this is the whole point of the CMS). Confirm the rich-text editor strips <script> and on* attributes on save.
Check the storefront is flawless at 400px (menu drawer, filter drawer, checkout) and in the CMS's dark mode
(shop/index.html?__mode=dark).`,
  },
  {
    key: 'platform',
    title: 'Cross-cutting: links, roles, navigation, consistency',
    pages: 'every page (read-only audit + targeted fixes)',
    spec: `
1. LINKS: extract every href / :href / location.href / window.open target across all *.html and shop/*.html and
   report any that points at a file that does not exist, or uses a query parameter the target page ignores
   (e.g. a link to customer-view.html?customer= when the page reads ?id=). Fix the broken ones in the page that
   contains the link.
2. ROLES: for each role (super_admin, branch_manager, cashier, technician) render a representative set of pages and
   confirm the sidebar only offers what the role may use and that a forbidden page shows the "Access restricted"
   panel rather than a broken screen: cashier must be blocked from branches/users/settings/reports/day-end,
   technician from money reports and settings, manager from branches/users/settings.
   Also confirm each role lands on the right home page after login.
3. BRANCH SCOPING: as the Branch 2 manager (sana), confirm lists show only Branch 2 data (sales, stock, repairs,
   expenses, closings) and that the super admin's topbar branch switcher changes what every page shows.
4. CONSISTENCY: same head/script order and body data-* attributes on every page; the standard date-range bar on
   every period page; clickable stat tiles; identical badge vocabulary and money formatting; no page missing its
   empty state or pagination. Report outliers and fix the cheap ones.
5. DEMO DATA SANITY: reset the demo data and confirm the dashboard, POS, repairs board and storefront all look
   populated and correct on a fresh seed (no empty tables, no NaN, no "Invalid Date", no Rs. NaN).
Fix what you can in the owning page; list anything that needs a shared-file change in sharedFileRequests.`,
  },
]

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    drove: { type: 'array', items: { type: 'string' }, description: 'flows actually executed end to end' },
    passed: { type: 'array', items: { type: 'string' } },
    defectsFound: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, title: { type: 'string' }, evidence: { type: 'string' }, fixed: { type: 'boolean' }, howFixed: { type: 'string' } }, required: ['file', 'severity', 'title', 'evidence', 'fixed'] } },
    sharedFileRequests: { type: 'array', items: { type: 'string' } },
    stillBroken: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['area', 'drove', 'defectsFound'],
}

const selected = AREAS.filter((a) => SELECTED.includes(a.key))
log(`Auditing: ${selected.map((a) => a.key).join(', ')}`)

const results = await parallel(selected.map((a) => () => agent(`${COMMON}

YOUR AREA: ${a.key} — ${a.title}
PAGES IN SCOPE: ${a.pages}

WHAT TO PROVE AND FIX:
${a.spec}

Work through it thoroughly: drive the flows first, collect evidence, then fix every critical and major defect you
find in the pages you own, re-verify, and report. Be honest about anything you could not verify or could not fix.`,
  { label: `audit:${a.key}`, phase: 'Audit', schema: AUDIT_SCHEMA })))

return results.filter(Boolean).map((r) => ({
  area: r.area,
  drove: r.drove,
  passed: (r.passed || []).length,
  fixed: (r.defectsFound || []).filter((d) => d.fixed).map((d) => `[${d.severity}] ${d.file}: ${d.title}`),
  openDefects: (r.defectsFound || []).filter((d) => !d.fixed).map((d) => `[${d.severity}] ${d.file}: ${d.title} — ${d.evidence}`),
  sharedFileRequests: r.sharedFileRequests || [],
  stillBroken: r.stillBroken || [],
  notes: r.notes || '',
}))
