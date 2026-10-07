export const meta = {
  name: 'abm-build-groups',
  description: 'Build Abbott Mobile frontend page groups (args: {groups:[keys], review:bool}) — build, optional independent review, then fix; verified on desktop + 400px mobile',
  phases: [
    { title: 'Build', detail: 'one agent per page group, verifies desktop + mobile + modals' },
    { title: 'Review', detail: 'independent QA per group: renders, links, CRUD, spec, responsiveness' },
    { title: 'Fix', detail: 'apply review findings and re-verify' },
  ],
}

const ROOT = 'C:\\xampp\\htdocs\\abm'
const CFG = Array.isArray(args) ? { groups: args, review: true } : (args || {})
const SELECTED = CFG.groups || []
const DO_REVIEW = CFG.review !== false

const COMMON = `
You are building part of the **Abbott Mobile** frontend prototype — a universal retail + repair management system for mobile phone shops,
laptop shops, accessory shops and mobile/laptop REPAIR shops, plus a public e-commerce storefront with a CMS. Project root: ${ROOT} (Windows, PowerShell).
Stack: plain .html pages + Tailwind CSS (Play CDN) + Alpine.js 3 + a shared runtime (assets/js/app.js) with a localStorage-backed mock database seeded
from assets/js/data.js. The PHP/MySQL backend comes later, so every screen must be a REAL working prototype against ABM.db — full CREATE / EDIT / DELETE
with validation and persistence across reloads — never a static mockup with dead buttons.

READ THESE FIRST, IN FULL, before writing anything:
  1. ${ROOT}\\docs\\FRONTEND-GUIDE.md   (skeleton, ABM API, theme, date-range bar, data shapes incl. §7 universal model + repairs and §8 storefront/CMS, roles, pages, UI rules)
  2. ${ROOT}\\dashboard.html            (reference page — match its structure, density and polish; shows the standard range bar and clickable stat tiles)
  3. ${ROOT}\\assets\\js\\app.js         (runtime: db, session, utils, ui, icon, stock & ledger services, theme, range, nav, shell)
  4. ${ROOT}\\assets\\js\\data.js        (seed: exact field names and value vocab)
  5. ${ROOT}\\assets\\css\\app.css       (component classes + theme tokens)
  6. ${ROOT}\\products.html or ${ROOT}\\repairs.html  (already-built pages — the expected quality bar for lists, filters, modals)

HARD RULES
- Only create/modify the files in YOUR OWNERSHIP LIST. Never edit app.js, app.css, data.js, tailwind-config.js, login.html, index.html, docs/*, tests/* or another
  group's pages. If you need a shared change, describe it in sharedFileRequests in your result.
- Follow the page skeleton from the guide exactly. Alpine calls init() automatically — do NOT add x-init="init()". Modals live inside <main> (position: fixed works; never
  put transform/filter on ancestors).
- Use ABM.stock.* and ABM.ledger.* for every stock/balance change; db.nextNumber() for document numbers; db.audit() for important actions.
- Every page that shows period data (lists, ledgers, reports, closings, audit, orders, repairs) uses the STANDARD date range bar from the guide (§2 "Date range bar":
  ABM.range(...) + the exact markup: Today, Yesterday, This Week, Last Week, This Month, Last Month, All, Custom) and honours ?range=&from=&to= in the URL.
- Stat tiles that summarise something must be clickable links (class "stat" on an <a>, with .stat-arrow) to the page/report that explains the number.
- Universal labels: use ABM.db.serialLabel(product) ('IMEI' / 'Serial No.') — never hard-code "IMEI" for laptops. Services (product_type 'service') have no stock.
- Branch scoping: non-super-admin users only see/act on ABM.session.branchId(); super admin sees the topbar's active branch (add an "All branches" option where sensible).
- Security hygiene: x-text for user data; x-html only with ABM.icon / $badge / utils.escape'd strings (CMS rich text is the one sanctioned exception — strip <script>).
- RESPONSIVE IS MANDATORY: every page AND every modal/drawer works at 400px with no horizontal scroll. Every grid has a base grid-cols-1; forms inside modals use
  grid-cols-1 sm:grid-cols-2; tables in .table-wrap with secondary columns hidden on small screens (hidden md:table-cell); toolbars wrap (flex-wrap); page-actions wrap;
  long numbers get min-w-0 / truncate; sticky bottom action bars on mobile for POS/checkout.
- Quality bar: production-grade. Search, filters, pagination (15/page), empty states, inline validation, disabled-while-busy buttons, toasts, confirm dialogs for
  destructive actions, keyboard-friendly forms, print styles where the spec says print, dark-mode safe (use slate utilities / component classes; text-white on coloured bg).
- Currency PKR ("Rs.") via $money / ABM.utils.money. Dates via $date / ABM.utils.date.

VERIFY EVERY PAGE (mandatory before you finish)
A static server is running at http://127.0.0.1:8085 (root = project). If it does not respond start it in the background:
  Start-Process php -ArgumentList "-S","127.0.0.1:8085","-t","${ROOT}" -WindowStyle Hidden
Render each page:
  powershell -ExecutionPolicy Bypass -File ${ROOT}\\tests\\render.ps1 -Page transfers.html -As admin
  powershell -ExecutionPolicy Bypass -File ${ROOT}\\tests\\render.ps1 -Page "transfers.html?__layout=1" -As manager -Mobile
  powershell -ExecutionPolicy Bypass -File ${ROOT}\\tests\\render.ps1 -Page "transfers.html?__layout=1&__click=main%20.btn-primary" -As manager -Mobile   (opens your primary modal)
  (-As cashier / technician for pages those roles use; detail pages need ?id=1 etc.; -Theme dark to spot dark-mode issues; storefront pages: -NoLogin)
It prints console errors (must be 0) and saves a screenshot in tests\\out\\ — open the PNG with the Read tool and LOOK at it (empty tables, overlaps, clipped text
and unreadable contrast are failures). For mobile runs read tests\\out\\<name>.console.log and confirm the ABM_LAYOUT line says overflowing=0 (with the modal open too).
Mobile runs render inside a 400px iframe harness, so their DOM summary says sidebar=False — expected. "Alpine Expression Error" in the console = failure.
Other agents render pages concurrently on this machine, so renders can be slow — never treat a slow render as a failure; re-run it.

BE EFFICIENT: write each page once, completely and carefully, then verify. Do not rewrite a page from scratch to fix a small issue — use targeted edits.

RESULT: return the structured output (pages with feature summary + verified flag + how verified, sharedFileRequests, knownGaps, notes).
`

const GROUPS = [
  {
    key: 'transfers', mode: 'new',
    files: ['transfers.html', 'transfer-create.html', 'transfer-view.html'],
    spec: `
Inter-branch stock transfer workflow: Branch A requests → Super Admin / source manager approves & ships → Branch B inspects (checks IMEIs/serials) & accepts → stock updates.
Statuses: pending → approved → shipped → received; also rejected, cancelled. Works for phones (IMEI), laptops (serial) and non-serialized items; services cannot be transferred.
transfers.html (data-page="transfers", perm transfers.view): clickable tiles (pending approval, in transit, received in range, rejected); standard date range bar; status tabs
  with counts; direction filter (Incoming / Outgoing for branch users; super admin sees all + branch filter); search by transfer no / product; table: no (link), from → to, lines,
  units, requested by/at, status badge, last action, actions (view; quick Approve/Ship/Receive when allowed). Pagination, CSV.
transfer-create.html (data-page="transfer-create", perm transfers.request): destination = active branch (super admin picks), source = another active branch; lines: product search
  (shows sellable qty at source), qty (≤ available), optional "pick specific units" chooser for serialized products (lists sellable units at source with serial label); notes.
  Insert stock_transfers (pending, transfer_no = db.nextNumber('TRF', sourceBranchCode)) + transfer_items (imei_ids), audit, redirect to transfer-view.html?id=.
transfer-view.html (data-page="transfer-view", ?id=): pipeline (Requested → Approved → Shipped → Received; rejected/cancelled terminal), header cards (from/to branch details,
  who/when for each step, notes), items table (product, requested qty, shipped units, received qty, variance). Role-aware actions guarded by session.can + branch checks:
  Approve/Reject (transfers.approve: super admin or SOURCE branch manager; reject needs reason); Ship (transfers.ship; status approved): modal — per serialized line choose exactly
  qty sellable units (checkbox list + scan-to-tick input); non-serialized lines confirm qty ≤ stock → ABM.stock.shipImei per unit / ABM.stock.remove('transfer_out'), store imei_ids +
  unit_cost, status shipped, audit; Inspect & Receive (transfers.receive; destination or super admin; status shipped): checklist of shipped units with scan-to-tick + per-unit
  condition OK / Missing / Damaged; non-serialized received qty → ABM.stock.receiveImei for OK, revertImeiTransit for Missing (note), receive + markDefective for Damaged;
  non-serialized: ABM.stock.add at destination ('transfer_in') and add back at source for shortfall; set received_quantity, status received, audit. Cancel (requester or admin while
  pending/approved). Activity timeline, print transfer note (.print-area), "waiting for X" banners. Bogus ?id → friendly not-found state.
Seed data has transfers id 1 (received), 2 (shipped), 3 (approved), 4 (pending), 5 (rejected), 6 (received) — test each state.`,
  },
  {
    key: 'partners', mode: 'new',
    files: ['customers.html', 'customer-view.html', 'suppliers.html', 'supplier-view.html'],
    spec: `
customers.html (data-page="customers", perm customers.view): clickable tiles (customers, total receivable, with dues, store credit); filters All / Has dues / Store credit / Inactive;
  search name/phone/cnic; table: name (+cnic), phone, address, credit limit, balance (Owes / Credit / Clear), last sale, sales count, repair jobs count, actions (view, new sale
  pos.html?customer=ID, new repair repair-create.html?customer=ID, receive payment (customers.payments), edit). Add/Edit modal: name*, phone* (digits, uniqueness warning), email,
  address, cnic (#####-#######-# mask), credit limit, notes, active. Walk-in row locked (no edit/delete). Delete blocked when the customer has sales/jobs/balance → deactivate.
  Pagination, CSV.
customer-view.html (?id=): profile card, balance card (outstanding / store credit / credit limit / available with .progress), quick actions (new sale, new repair, receive payment,
  adjustment (customers.manage), print statement), tabs: Ledger (statement with running balance, standard date range bar, opening balance row, totals), Sales, Returns, Repairs
  (jobs list → repair-view.html?id=), Online orders (online_orders where customer_id matches or phone matches). Receive payment modal → ABM.ledger.customer(id, branchId, 'payment',
  0, amount, {...}); advance beyond due creates store credit; Adjustment modal (increase/decrease due + reason); statement print (.print-area, company + branch header, period,
  closing balance). Bogus id → not-found.
suppliers.html (data-page="suppliers", perm suppliers.view): clickable tiles (suppliers, total payable, with payable), search, filter, table (name, contact, phone, email, tax id,
  purchases count, last purchase, payable balance, actions: view, new purchase purchase-create.html?supplier=ID, pay (suppliers.payments), edit). Add/Edit modal: name*,
  contact_person, phone*, email, address, tax_id, opening balance (on create → ABM.ledger.supplier 'opening_balance'), notes, active.
supplier-view.html (?id=): profile, payable card (outstanding, paid this month, purchases this month), actions (new purchase, pay supplier → ABM.ledger.supplier(id, branchId,
  'payment', amount, 0, {...}) + allocate against the oldest unpaid purchases (update purchase.paid_amount), adjustment, print statement), tabs Ledger (range bar) / Purchases
  (→ purchase-view.html?id=) / Payments / Products supplied (products with supplier_id). Bogus id → not-found. Verify desktop + mobile with modals open.`,
  },
  {
    key: 'sales-rest', mode: 'new',
    files: ['invoice.html', 'returns.html'],
    spec: `
sales.html and sale-view.html already exist — READ sale-view.html first (it links to these two pages and already implements the return flow; match its data handling exactly).
invoice.html (data-page="invoice", ?id=&layout=thermal|a4&autoprint=1; data-perm="sales.print"): full TAX INVOICE in both layouts: company logo (settings.logo if set) + company
  name, branch name/address/phone + NTN/tax id, "TAX INVOICE" title, invoice no, date/time, cashier, customer block (name, phone, address, CNIC), itemized lines with
  IMEI / serial (label via ABM.db.serialLabel) and warranty months under device lines, qty, rate, discount, amount; subtotal, total discount, tax (settings.tax_label + %),
  GRAND TOTAL (large), payments by method with references, change, balance due, previous ledger balance for registered customers, terms & conditions (settings.invoice_terms),
  receipt footer (settings.receipt_footer), QR-code placeholder (inline SVG grid pattern labelled with the invoice no — no library), "Powered by Abbott Mobile".
  Thermal: 80 mm (max-w-[80mm], condensed, mono-ish, dashed separators); A4: two-column header, bordered table, signature lines, amount in words.
  Layout toggle + Print button in a no-print toolbar (also: back to sale, new sale); ?autoprint=1 → window.print() after ~400 ms; default layout from settings.default_print_layout.
  @media print: hide everything except .print-area; @page { size: 80mm auto } for thermal, A4 portrait otherwise (inject a <style> per layout). Must look right at 400px too.
  Also support ?job=<repair_job id> to print a REPAIR invoice from the same page (parts + labor lines, warranty days, advance/final payments) — repair-view.html may link here.
returns.html (data-page="returns", perm sales.return): standard range bar; clickable tiles (returns count, refund amount, defective units, store credit issued); filters (refund
  method, condition, branch for admin); search by return no / invoice / customer; table: return no, date, invoice (link sale-view.html?id=), customer, items count, condition
  badges, refund amount + method badge, processed by, actions (view detail modal with full line list, print credit note). "New return" button → modal that searches an invoice
  no / customer and links to sale-view.html?id=…#return where the return is actually performed. Print credit note (.print-area: company/branch header, return no, original
  invoice, lines with serials, refund method and amount, signature). Pagination, CSV.`,
  },
  {
    key: 'accounting-rest', mode: 'new',
    files: ['closings.html'],
    spec: `
day-end.html and expenses.html already exist — READ day-end.html first and reuse its calculation approach and field names exactly.
closings.html (data-page="closings", data-title="Day-End History", perm closing.view): standard date range bar (default This Month); clickable tiles (closings in range, total
  cash sales, total short/over (discrepancy sum, red/green), average daily cash); filters: branch (admin: All / each; manager fixed), "with discrepancy only" toggle; search by
  date; table: date (link day-end.html?date=&branch=), branch, opening, cash sales, ledger received, repairs cash, refunds, expenses, supplier payments, expected, actual,
  discrepancy (badge green 0 / red short / amber over), bank deposit, retained float, closed by, closed at, actions (view, print). Sticky first column on mobile is not needed —
  hide secondary columns with hidden lg:table-cell and show a compact card list feel. Totals row in tfoot. Pagination, CSV export.
  Also: a small "Unclosed days" alert listing dates in the range with sales but no closing row (link to day-end.html?date=), and a Chart.js line/bar of daily cash sales vs
  discrepancy for the range using ABM.theme.chart() colours. Print-friendly (.print-area) register report.`,
  },
  {
    key: 'cms-rest', mode: 'new',
    files: ['website.html'],
    spec: `
online-orders.html and online-order-view.html already exist — READ online-orders.html first for style. This page is the CMS that drives the public storefront in shop/
(built in parallel by another agent; it reads ABM.db.cms()). Read guide §8 for the exact cms shape.
website.html (data-page="website", data-title="Website & CMS", perm website.manage): a left tab rail (vertical list of tabs on lg; a <select> or horizontal scrolling .tabs-pill
on mobile) with these tabs, each with its own Save button (ABM.db.saveCms) + toast + db.audit('website.update', …), plus a global "unsaved changes" indicator:
  1 Branding & Hero: site name, tagline, logo upload (file → data URL, preview, Remove), favicon, hero badge/title/subtitle, CTA 1 text+link, CTA 2 text+link, hero image upload,
    hero style (gradient | image);
  2 Announcement bar: enabled toggle + text;
  3 Home sections: highlights CRUD (icon picker from ABM icon names with live preview, title, text, reorder up/down, remove), featured categories (checkbox list with order),
    featured products (search + add, reorder, remove, shows price/stock), banners CRUD (title, subtitle, link, colour picker, image upload, active toggle, order),
    testimonials CRUD (name, text, rating 1-5 stars, active);
  4 Pages: list (title, slug, published badge, in-menu badge, updated) + editor panel: title, slug (auto from title, unique, validated), rich-text editor — a contenteditable
    div with a toolbar (Paragraph/H2/H3, bold, italic, underline, bullet list, numbered list, link, image by URL, blockquote, clear formatting, undo/redo, and a "HTML" toggle
    showing the raw markup in a textarea) using document.execCommand; on save strip <script> tags and on* attributes; publish toggle, show-in-menu toggle, preview link
    (shop/page.html?slug=… target _blank), delete with confirm. New page button.
  5 Menu: list of menu items (label, url, active) with add / edit / remove / reorder (up-down buttons); url picker offering CMS pages, shop pages (index/products/repair/contact)
    and category links (shop/products.html?category=ID);
  6 Contact & Social: phone, whatsapp, email, address, hours, map_url, facebook, instagram, tiktok, youtube, whatsapp link;
  7 Commerce: show_prices, allow_orders, cod_enabled, bank_transfer_enabled, wallet_enabled, bank_details (textarea), delivery_fee, free_delivery_above, min_order,
    fulfil_branch_id (select of active branches), order_prefix, show_stock, allow_backorder, whatsapp_orders;
  8 Repair booking: enabled, intro text, device types (checkboxes mobile/tablet/laptop/desktop/smartwatch), show_prices;
  9 SEO: title, description, keywords + a Google-result style preview card;
  10 Theme & Colours: colour inputs (input type="color" class="color-input" paired with a hex text field, kept in sync) for primary, accent and background; mode light|dark;
    font (Inter | Poppins | Roboto); radius (sharp | rounded | pill); header style; button style; a row of 6 one-click presets; a LIVE PREVIEW card that renders a miniature
    storefront (header bar + hero + 2 product cards + button) using the chosen values via ABM.theme.shadeScale(hex) inline styles; and a button "Also apply this colour to the
    software" → ABM.theme.setCustom(primary).
Header actions: "Open storefront" (shop/index.html, target _blank), "Reset website content to demo" (confirm → restore from a fresh ABM_SEED().cms), Save all.
Everything persists through ABM.db.saveCms({site, pages, menu, banners, testimonials}) — never mutate cms objects without saving. Verify desktop + mobile (tab rail collapses),
open the Pages editor and the Theme tab in the mobile screenshots.`,
  },
  {
    key: 'reports-a', mode: 'new',
    files: ['reports.html', 'report-sales.html', 'report-profit-loss.html', 'report-expenses.html', 'report-receivables.html', 'report-payables.html'],
    spec: `
All report pages: data-page="report-…" (reports.html → data-page="reports"), data-perm="reports.branch"; a toolbar card at the top with the STANDARD date range bar
(Today … Custom, honours ?range=&from=&to=), a branch selector (super admin: All branches / each branch; manager: locked to own branch), Print button (.print-area on the
report body, .no-print on the toolbar) and CSV export. Charts via Chart.js (already loaded per page) with ABM.theme.chart() colours and redraw on ABM.theme.onChange.
Exclude void sales everywhere. Never crash on bogus params. Money via $money.
reports.html: the hub — grouped sections (Sales, Inventory, Financial, Partners, Repairs & Online) of clickable .card.card-hover tiles, each with icon, title, one-line
  description, the destination link and a LIVE headline number for the current month (e.g. "Rs. 3.0M this month", "Rs. 14.2M at cost", "9 customers owe"). Include every
  report page that exists: report-sales, report-profit-loss, report-stock-valuation, report-balance-sheet, report-inventory, report-imei-history, report-expenses,
  report-receivables, report-payables, report-repairs, report-online-sales. Also a "Quick exports" row (CSV of products, customers, suppliers, stock).
report-sales.html: KPI tiles (invoices, gross, discounts, tax, net, avg basket, returns, items sold); tabs (.tabs) By day | By product | By category | By type | By cashier |
  By payment method | By customer — each renders a sortable table with a totals row plus the matching chart (bar for day, doughnut for payment/type, horizontal bar for top
  products); drill links (product → product-view.html?id=, customer → customer-view.html?id=, invoice → sale-view.html?id=); support the #products anchor to open that tab.
report-profit-loss.html: statement layout — Revenue (gross sales − returns − discounts) split Retail sales / Repair revenue (delivered repair_jobs total in range) / Online
  (orders with sale_id); COGS (Σ sale_items unit_cost×(qty−returned) + Σ repair_items type 'part' unit_cost); GROSS PROFIT + margin %; Operating expenses by category;
  NET PROFIT; a comparison column for range.previous with % change arrows; a 6-month trend chart (revenue vs gross profit vs expenses); per-branch breakdown table for super
  admin; print-friendly.
report-expenses.html: KPI tiles; table by category (amount, % of total, count) and by month; doughnut by category + bar by month; largest 10 expenses list (link expenses.html);
  branch comparison table for admin.
report-receivables.html: customer aging — allocate each customer's credits (payments/refunds) FIFO against their debit entries ('sale', 'opening_balance', 'adjustment') from
  customer_transactions, then bucket each unpaid remainder by age of the debit entry into Current (0–30) / 31–60 / 61–90 / 90+; table per customer with the four buckets, total,
  credit limit, phone and a link to customer-view.html?id=; totals row; stacked bar or doughnut of the buckets; tiles (total receivable, overdue >30, customers owing, largest
  balance). CSV.
report-payables.html: the same aging for suppliers (debits = 'payment' entries allocated FIFO against 'purchase' credits), links to supplier-view.html?id=, plus a
  "purchases with balance" table (purchase no, date, total, paid, due, days old).`,
  },
  {
    key: 'reports-b', mode: 'new',
    files: ['report-stock-valuation.html', 'report-balance-sheet.html', 'report-inventory.html', 'report-imei-history.html', 'report-repairs.html', 'report-online-sales.html'],
    spec: `
Same page conventions as the other report pages: data-page="report-…", data-perm="reports.branch", toolbar card with the STANDARD date range bar (where a period applies),
branch selector (super admin All/each; manager locked), Print (.print-area / .no-print) and CSV export; Chart.js with ABM.theme.chart() colours; exclude void sales;
never crash on bogus params; $money everywhere.
report-stock-valuation.html: valuation method toggle (.tabs-pill) — Weighted Average (branch_stock.avg_cost × quantity) | FIFO (build inbound layers per branch+product from
  stock_movements with quantity > 0 in date order, consume them with the outbound quantities, value the remaining units) | Actual (Σ product_imeis.cost_price for units with
  status available/returned) — show the method's explanation in a help note and the difference vs weighted average. Table: product (link), category, type, branch, qty, unit
  cost, stock value, retail value, potential margin %; grouped subtotals by category with collapsible rows; grand total; tiles (SKUs, units, cost value, retail value);
  services excluded; as-of note (valuation is current stock, not historical).
report-balance-sheet.html: as-of date picker (default today). ASSETS: Cash in drawer (latest daily_closings.actual_cash per branch before the date + cash movements since:
  cash sale payments + cash ledger receipts + cash repair payments − cash expenses − cash refunds − cash supplier payments), Bank (estimated: non-cash collections − bank/card
  expenses and supplier payments — label "estimated"), Inventory at cost (weighted average), Accounts receivable (Σ positive customer balances), Repair dues (Σ repair_jobs
  due_amount where status !== cancelled). LIABILITIES: Accounts payable (Σ positive supplier balances), Customer store credit (Σ |negative customer balances|), Repair advances
  held (Σ paid_amount of jobs not delivered/cancelled). EQUITY = assets − liabilities. Two-column statement with subtotals, per-branch column for super admin, print.
report-inventory.html: tabs — (1) Stock movements ledger: filters product, branch, movement type (purchase/sale/sale_return/transfer_in/transfer_out/adjustment/repair/defective/
  opening), date range; table date, product, IMEI/serial, type badge, qty ±, unit cost, balance after, reference (link to the sale/purchase/transfer/repair), user; totals of in/out.
  (2) Low stock: products at or below min_stock per branch with qty, min, reorder qty suggestion (max(reorder_qty, min_stock*2 − qty)), last purchase cost, supplier link and a
  "Create purchase" link (purchase-create.html?product=ID&supplier=…). (3) Dead stock: products with qty > 0 and no sale in the last 60 days (days since last sale, value tied up).
  (4) Stock by branch matrix (product × branch quantities, admin only). CSV per tab.
report-imei-history.html: a prominent search box (?imei= prefilled, scan-friendly) accepting an IMEI or a serial; on find → unit card (product link, current branch, status badge,
  serial label, cost, warranty, condition) + a vertical .timeline of every event: registered/purchased (supplier, purchase no, cost), transfers (from → to, transfer no),
  sale (invoice link, customer, price, cashier), return (condition, refund), defective/repaired adjustments, and any repair_jobs whose serial matches (job no link, problem,
  status). Each event: date, icon, title, details, user. "Not found" empty state with hints. Recent lookups list in localStorage (clearable). Print the history.
report-repairs.html: KPI tiles (jobs received in range, delivered, open, overdue, avg turnaround in days (delivered_at − received_at), revenue, parts cost, labor revenue,
  gross profit); table by technician (jobs, delivered, revenue, parts cost, avg days, on-time %); table by device type and by problem category; status funnel/bar chart;
  overdue jobs list (link repair-view.html?id=); busiest days chart. CSV.
report-online-sales.html: KPI tiles (orders in range, delivered, cancelled, revenue, conversion to invoices %, avg order value); table by day and by status; top products
  ordered online; cities table; payment method split doughnut; list of pending orders needing action (link online-order-view.html?id=). CSV.`,
  },
  {
    key: 'storefront-a', mode: 'new',
    files: ['assets/js/shop.js', 'assets/css/shop.css', 'shop/index.html', 'shop/products.html', 'shop/product.html'],
    spec: `
PUBLIC E-COMMERCE STOREFRONT, part 1 of 2 — you build the shared runtime + the three catalog pages. Another agent builds cart/checkout/order/repair/page/contact AFTER you,
reading your shop.js — so shop.js must be complete, documented at the top with the exact API those pages will use, and must already include the cart helpers, the checkout
helpers (delivery fee rules, order creation), the CMS page helpers and the repair-request helper even though you do not build those pages.
Read guide §8. Lives in shop/ (asset paths ../assets/…). A sexy, modern, premium website (a polished Shopify-grade theme), NOT the admin look.
Every shop page: <body data-public> (no login, no admin shell); head loads: Tailwind CDN, ../assets/js/tailwind-config.js, ../assets/css/app.css, ../assets/css/shop.css,
Google Fonts, then defer ../assets/js/data.js, ../assets/js/app.js, ../assets/js/shop.js, then Alpine CDN.
assets/js/shop.js (window.SHOP): reads ABM.db.cms(); applies cms.site.theme as CSS variables on <html> (--shop-primary-50..950 and --shop-accent-* via ABM.theme.shadeScale(hex),
  --shop-bg, --shop-radius, font family; adds data-shop-mode="dark|light"); renders the shared chrome by injecting into placeholders (SHOP.header(), SHOP.footer()) or exposing
  Alpine data — your choice, but every page must get: announcement bar (cms.site.announcement), sticky blurred header (logo/site name, menu from cms.menu, search box that goes to
  products.html?q=, cart button with live count, WhatsApp button, mobile hamburger → slide-in drawer), and a rich footer (about blurb, quick links, CMS pages, contact,
  socials, payment badges, copyright). Also: SHOP.cart (get/add/remove/setQty/clear/count/subtotal — localStorage 'abm.shop.cart', items {product_id, qty}), SHOP.money(),
  SHOP.products() (active, stock-tracked or service, at cms.site.commerce.fulfil_branch_id), SHOP.stockOf(productId), SHOP.inStock(p), SHOP.priceOf(p), SHOP.image(p) (returns
  product.image or a generated gradient+initial placeholder HTML/SVG per device type), SHOP.deliveryFee(subtotal), SHOP.placeOrder(customer, items, paymentMethod, reference)
  → inserts online_orders (order_no via ABM.db.nextNumber(commerce.order_prefix||'WEB','ON'), status pending, payment_status, status_log) and returns the row,
  SHOP.findOrder(no, phone), SHOP.bookRepair(data) → inserts repair_requests (status new), SHOP.page(slug), SHOP.toast(msg), SHOP.sanitize(html) (strip script/on*),
  SHOP.services() (service products), SHOP.categories(), SHOP.brands(). Document each in a header comment block.
assets/css/shop.css: the storefront design system — tokens driven by the CSS variables above, .shop-btn / .shop-btn-outline, .shop-card, .shop-badge, .shop-section,
  .shop-container, header/footer/drawer styles, product card hover lift, hero art, skeletons, responsive rules. Do not depend on admin component classes.
shop/index.html: announcement bar, hero (badge, big title, subtitle, two CTAs, image or generated gradient art), highlights strip (cms highlights with icons), featured
  categories cards (with product counts), featured products grid (cms featured_product_ids, fallback newest), banners row (cms banners with their colours), a "Laptops &
  computers" section (device_type laptop/desktop), a repairs CTA band with the service price list and a Book button (repair.html), testimonials carousel/grid, newsletter box
  (stores email in localStorage collection 'newsletter_subscribers' via ABM.db.insert), footer.
shop/products.html: catalog — sidebar filters (category grouped by product type, brand, price min/max, condition, device type, in-stock only) which become a slide-over drawer
  on mobile; search box; sort select (Featured / Price low-high / Price high-low / Newest / Name); active-filter chips with clear; responsive product grid (2 cols mobile,
  3-4 desktop) with "Load more"; empty state; reads ?category=&brand=&q=&type=&device=&sort=.
shop/product.html?id=: breadcrumbs, gallery (main image placeholder + thumbnails), title, brand, badges (condition, warranty, PTA/serial type), price (and wholesale note for
  bulk), stock status at the fulfil branch ("In stock" / "Only N left" / "Available to order" when allow_backorder / "Out of stock"), quantity stepper (serialized items max 1)
  + Add to cart (updates SHOP.cart, toast, cart count), "Order on WhatsApp" button (wa.me link with a prefilled message) when commerce.whatsapp_orders, specifications table
  (ABM.db.SPEC_KEYS[device_type] + ABM.db.specLabel), description, warranty & returns accordion, related products (same category), share buttons; service products show
  "Book this service" → repair.html?service=ID instead of add-to-cart. Bogus id → friendly not-found.
Verify with -NoLogin: desktop + mobile (?__layout=1) for all three pages, and mobile with the menu drawer and the filter drawer opened via __click.`,
  },
  {
    key: 'storefront-b', mode: 'new',
    files: ['shop/cart.html', 'shop/checkout.html', 'shop/order.html', 'shop/repair.html', 'shop/page.html', 'shop/contact.html'],
    spec: `
PUBLIC E-COMMERCE STOREFRONT, part 2 of 2. assets/js/shop.js, assets/css/shop.css and shop/index.html, shop/products.html, shop/product.html ALREADY EXIST — read shop.js
(its header comment documents the SHOP API) and shop/product.html first, and match the existing markup conventions, header/footer usage and visual style exactly.
You may NOT edit shop.js or shop.css; if something is missing, work around it in the page and note it in sharedFileRequests.
shop/cart.html: cart line items (image placeholder, name, variant, unit price, qty stepper — max 1 for serialized, remove), live subtotal, delivery fee rule (free above
  commerce.free_delivery_above, else commerce.delivery_fee), total, "Continue shopping" and "Proceed to checkout" buttons, minimum-order notice, empty-cart state with a
  link to products, recently viewed / recommended products row.
shop/checkout.html: two-column (form left, sticky order summary right; stacked on mobile with the summary collapsible): contact & delivery form (name*, phone* Pakistani format
  03xx-xxxxxxx, email, address*, city* select of major Pakistani cities + other, notes), payment method radio cards per commerce settings (Cash on Delivery; Bank transfer —
  shows commerce.bank_details and a transaction reference field; JazzCash / EasyPaisa — shows the wallet number and a transaction id field), order summary (items, subtotal,
  delivery, total), terms checkbox, Place order button (disabled while busy). On submit: validate, re-check stock for every line (out-of-stock → inline error), then
  SHOP.placeOrder(...) and show a success panel (order no, total, what happens next, "Track your order" link to order.html?no=…&phone=…, WhatsApp us button) and clear the cart.
  Guard: empty cart → redirect to cart.html; orders disabled (commerce.allow_orders false) → show an enquiry-only message.
shop/order.html?no=&phone=: order tracking — a form (order no + phone) when params are missing; on match show the order status pipeline (pending → confirmed → packed →
  out for delivery → delivered, cancelled terminal) with timestamps from status_log, the items table, totals, delivery address, payment status and instructions when unpaid,
  and a "Need help?" WhatsApp/phone block. No match → friendly not-found with the form again. Never expose other customers' orders (number AND phone must match).
shop/repair.html: repair booking — hero, "How it works" 3 steps, service price list from ABM.db service products grouped by device type (mobile / laptop) shown as cards with
  price "from" (hidden when repair_booking.show_prices is false), the booking form (name*, phone*, email, device type chips from repair_booking.device_types, brand, model,
  problem description*, preferred date, preferred branch select of active branches) → SHOP.bookRepair(...) → success panel with the request reference and what happens next;
  ?service=ID preselects the device type and prefills the problem; an FAQ accordion (warranty, turnaround, data safety, walk-in vs booking); trust badges.
shop/page.html?slug=: renders a published CMS page — title, updated date, sanitized content_html (SHOP.sanitize), a sidebar listing the other published pages and a contact CTA;
  unpublished or missing slug → friendly not-found with links. Typography styles for h2/h3/p/ul/ol/blockquote/img inside the content.
shop/contact.html: contact cards (phone, WhatsApp, email, hours from cms.site.contact), branch list (active branches with address, phone, hours), map placeholder (iframe when
  cms.site.contact.map_url is set, else a styled placeholder), a contact form (name*, phone*, email, subject, message*) storing into ABM.db collection 'contact_messages'
  with a success panel, and a social links row.
Verify every page with -NoLogin: desktop + mobile (?__layout=1). Drive the real flow: add an item to the cart from shop/product.html (localStorage), then render cart.html
and checkout.html; place an order and then render order.html?no=…&phone=… to confirm tracking works.`,
  },
]

const BUILD_SCHEMA = { type: 'object', properties: { group: { type: 'string' }, pages: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, features: { type: 'string' }, verified: { type: 'boolean' }, verification: { type: 'string' } }, required: ['file', 'features', 'verified'] } }, sharedFileRequests: { type: 'array', items: { type: 'string' } }, knownGaps: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['group', 'pages'] }
const REVIEW_SCHEMA = { type: 'object', properties: { group: { type: 'string' }, findings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, title: { type: 'string' }, detail: { type: 'string' }, how_to_fix: { type: 'string' } }, required: ['file', 'severity', 'title', 'detail'] } }, renderResults: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'needs_fixes'] } }, required: ['group', 'findings', 'verdict'] }
const FIX_SCHEMA = { type: 'object', properties: { group: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, reverify: { type: 'string' } }, required: ['group', 'fixed'] }

const LINKS = `Cross-page links (some are built by other agents in parallel — link by file name even if the file is missing right now):
dashboard.html pos.html?customer= sales.html?range= sale-view.html?id= invoice.html?id=&layout= returns.html customers.html customer-view.html?id= products.html?edit=
product-view.html?id= categories.html imeis.html?product= stock.html?filter=low transfers.html transfer-create.html transfer-view.html?id= purchases.html
purchase-create.html?supplier=&product= purchase-view.html?id= suppliers.html supplier-view.html?id= expenses.html day-end.html?date= closings.html reports.html
report-sales.html report-profit-loss.html report-stock-valuation.html report-balance-sheet.html report-inventory.html report-imei-history.html?imei= report-expenses.html
report-receivables.html report-payables.html report-repairs.html report-online-sales.html repairs.html repair-create.html?customer=&request= repair-view.html?id=
online-orders.html online-order-view.html?id= website.html branches.html users.html settings.html audit-log.html profile.html
shop/index.html shop/products.html shop/product.html?id= shop/cart.html shop/checkout.html shop/order.html?no=&phone= shop/repair.html?service= shop/page.html?slug= shop/contact.html`

function buildPrompt(g) {
  return `${COMMON}

YOUR GROUP: ${g.key} (${g.mode === 'upgrade' ? 'UPGRADE existing pages — read them fully first, keep what works, change what the spec says' : 'BUILD new pages'})
YOUR OWNERSHIP LIST (only these files under ${ROOT}): ${g.files.join(', ')}

SPECIFICATION:
${g.spec}

${LINKS}

Work through every page to completion. Verify each one (desktop as admin + mobile ?__layout=1 + mobile with the main modal/drawer open via __click + the roles the spec names;
storefront pages with -NoLogin) and LOOK at the screenshots. verified:true only when console errors = 0, overflowing = 0 (page and modal) and the screenshot looks right.`
}

function reviewPrompt(g, build) {
  return `You are a meticulous QA reviewer for the Abbott Mobile frontend prototype (static HTML + Tailwind + Alpine.js + shared runtime). Project root: ${ROOT}.
Read ${ROOT}\\docs\\FRONTEND-GUIDE.md first (conventions, API, §2 date range bar, §7 universal model, §8 storefront/CMS), then review the "${g.key}" group.

FILES TO REVIEW: ${g.files.join(', ')}
SPEC THEY MUST SATISFY:
${g.spec}

BUILDER'S REPORT (verify, do not trust):
${JSON.stringify(build, null, 2)}

CHECKLIST — all of it, with evidence:
1. Render every page yourself: powershell -ExecutionPolicy Bypass -File ${ROOT}\\tests\\render.ps1 -Page <file>[?id=1] -As admin ; -As manager -Mobile with "?__layout=1";
   the main modal/drawer open on mobile ("?__layout=1&__click=<selector>"); -As cashier / technician for pages those roles use; storefront pages with -NoLogin; one page in -Theme dark.
   Server http://127.0.0.1:8085 (start: Start-Process php -ArgumentList "-S","127.0.0.1:8085","-t","${ROOT}" -WindowStyle Hidden). Console errors must be 0; the ABM_LAYOUT line must say
   overflowing=0 on every mobile run; open every screenshot with Read and judge it (empty tables, overlaps, clipped/unreadable text, dead space, modal not fitting = findings).
   Detail pages: real id (1) AND bogus id (999 → friendly not-found, no crash). Other agents render concurrently — re-run a slow/blank render before calling it a failure.
2. CRUD completeness: every entity the spec mentions must have working create, edit and delete/deactivate with validation and persistence.
3. Links: every href / location.href / window.open / :href target must exist in ${ROOT} or be a documented cross-group page; query params must match the documented ones.
4. Spec coverage item by item — missing or cosmetic-only (button with no behaviour) = finding. The standard date range bar (8 presets) must be present where the spec says.
5. Code rules: skeleton, no x-init="init()" duplication, stock/balances only via ABM.stock / ABM.ledger, db.nextNumber, safe x-html, grid-cols-1 on grids, no shared-file edits,
   allowed CDNs only, $money, branch scoping, permission gating, universal serial labels (no hard-coded "IMEI" for laptops), services without stock, clickable stat tiles.
6. Data integrity: trace each write flow and check maths + consistency across collections.
Report precise findings (file, severity, title, detail, how_to_fix). critical = crash / console error / data corruption / core spec feature missing / mobile overflow;
major = spec item missing or wrong behaviour; minor = polish. verdict = pass only with no critical/major findings. Do NOT modify the group's files.`
}

function fixPrompt(g, review) {
  return `${COMMON}

YOUR GROUP: ${g.key}
YOUR OWNERSHIP LIST (only these files may change): ${g.files.join(', ')}

A QA reviewer found the issues below. Fix ALL critical and major findings and as many minor ones as practical, then re-verify every touched page (desktop admin + mobile
?__layout=1 + modal open + relevant roles) until console errors = 0 and overflowing = 0, and look at the screenshots. Spec for reference:
${g.spec}

FINDINGS:
${JSON.stringify(review.findings, null, 2)}

Return what you fixed, what you skipped (with reason) and the re-verification results.`
}

const selected = GROUPS.filter((g) => SELECTED.includes(g.key))
log(`Groups: ${selected.map((g) => g.key).join(', ')} · review=${DO_REVIEW}`)

const results = await pipeline(
  selected,
  (g) => agent(buildPrompt(g), { label: `build:${g.key}`, phase: 'Build', schema: BUILD_SCHEMA }),
  async (build, g) => {
    if (!build) { log(`build:${g.key} returned nothing`); return { g, build: null, review: null } }
    if (!DO_REVIEW) return { g, build, review: null }
    const review = await agent(reviewPrompt(g, build), { label: `review:${g.key}`, phase: 'Review', schema: REVIEW_SCHEMA })
    return { g, build, review }
  },
  async (r, g) => {
    if (!r || !r.review) return r
    const serious = r.review.findings.filter((f) => f.severity !== 'minor')
    log(`review:${g.key} → ${r.review.verdict} (${r.review.findings.length} findings, ${serious.length} critical/major)`)
    if (r.review.verdict === 'pass' && serious.length === 0) return { ...r, fix: null }
    const fix = await agent(fixPrompt(g, r.review), { label: `fix:${g.key}`, phase: 'Fix', schema: FIX_SCHEMA })
    return { ...r, fix }
  },
)

return results.filter(Boolean).map((r) => ({
  group: r.g.key,
  built: r.build ? r.build.pages.map((p) => `${p.file} (verified=${p.verified})`) : [],
  sharedFileRequests: r.build ? r.build.sharedFileRequests || [] : [],
  knownGaps: r.build ? r.build.knownGaps || [] : [],
  reviewVerdict: r.review ? r.review.verdict : 'not-reviewed',
  openFindings: r.review ? r.review.findings.filter((f) => f.severity !== 'minor').map((f) => `${f.file}: ${f.title}`) : [],
  fixed: r.fix ? r.fix.fixed : [], skipped: r.fix ? r.fix.skipped || [] : [],
}))
