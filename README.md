# Abbott Mobile — Retail, Repair & E-Commerce Management (Frontend Prototype)

A complete, clickable frontend for a mobile phone / laptop retail chain with an in-house repair lab and a
public online store. Multi-branch POS with IMEI **and serial-number** tracking, inventory, inter-branch
transfers, repair job cards, customer khata and supplier payables, expenses, day-end Z-report, financial
reports, an e-commerce storefront and a CMS to edit that storefront.

**This phase is frontend only** — every screen works against a mock database stored in your browser
(localStorage). The PHP 8 / MySQL backend is the next phase; the data shapes and service logic in
`assets/js/app.js` are written to port 1:1.

## Run it

- XAMPP: put the folder at `C:\xampp\htdocs\abm` and open <http://localhost/abm/> (Apache running), **or**
- Any static server, e.g. `php -S 127.0.0.1:8085 -t C:\xampp\htdocs\abm` then open <http://127.0.0.1:8085/>.

Internet access is needed for the CDNs (Tailwind, Alpine.js, Chart.js, Inter font).

## Demo accounts (any password)

| Username | Role | Lands on | Sees |
|---|---|---|---|
| `admin` | Super Admin | Dashboard | all branches, administration, global reports, website CMS |
| `manager` | Branch Manager | Dashboard | Main Branch: inventory, purchases, transfers, ledgers, repairs, expenses, day-end, reports |
| `cashier` | Cashier | POS | POS, sales history, customers, repair intake/delivery, online orders |
| `technician` | Technician | Repair Jobs | repair job cards, parts, customers (no money reports) |
| `sana` / `usman` / `faraz` | Branch 2 manager / cashier / technician | | Branch 2 (Gulberg) |

Switch users instantly from the avatar menu (top right) → *Demo: switch user*. *Reset demo data* reloads the sample data.

These four are only the starting roles. **Administration → Roles & Permissions** lets you create your own roles and
tick, per screen, what each may **View, Add, Edit, Delete and Export** (plus screen-specific actions such as void a sale,
approve / ship / receive a transfer, assign technicians, pay suppliers, see everyone's sales). Every page and every Export
button follows those ticks; nobody can grant more than they hold, and Super Admin always keeps full access.

## What it covers

**Sell** — POS terminal with barcode / IMEI / serial scanning, unit picker for serialized devices, services and
labour lines, retail vs wholesale pricing, per-line and invoice discounts, split payments (cash, card, JazzCash,
EasyPaisa, bank transfer, store credit), khata (credit) sales with credit-limit checks, held carts, and 80 mm
thermal + A4 tax invoices.

**Label** — barcode and price stickers: pick products (or a whole delivery, category or everything low on stock), choose the sticker size, what it shows and which code to print — EAN-13 from the product barcode, Code 39 for a SKU, or each unit's own IMEI / serial — then print an A4 sheet, starting part-way down a used one if you like.

**Onboard** — product CSV import: paste or upload a price list, match the columns (guessed from the headings), see row by row what will be created, updated or refused, then import — optionally creating missing categories and brands and booking opening stock. Bulk edit does the rest: category, brand, tax, minimum stock, supplier and price changes (% or amount, with rounding) across every selected product.

**Count** — stock takes: freeze a sheet for the whole branch, a category, a brand or just what is running low,
count quantities or scan every serialized unit (blind count optional), see the variance in units and money, then
post it — shortages become `count_out` movements and unfound units are marked *missing* instead of vanishing.

**Stock** — universal catalog: phones and tablets tracked by IMEI, laptops and desktops by serial number,
accessories and spare parts by quantity, plus non-stock service items. Product specs per device type,
condition (new / used / refurbished), warranty, min / max / reorder levels. Branch stock, adjustments,
IMEI & serial registry, inter-branch transfers with an approve → ship → inspect → receive workflow.

**Repair** — job cards from intake to delivery: device and fault capture, diagnosis, quote and customer
approval, parts consumed from stock, labour lines, technician assignment, status board, job receipt and
repair invoice, warranty period, advance and final payments.

**Buy** — purchase orders with a low-stock suggestion list, draft → sent → partially received → completed
tracking, overdue alerts, printable PO, and receiving that turns an order into a goods received note (part
deliveries welcome); supplier returns for faulty stock with credit note, refund, replacement or write-off.

**Drawer** — cashier shifts: open a drawer with a float, every cash sale, khata receipt, repair payment, refund and expense that cashier handles is counted against it, petty cash in/out and bank drops are recorded, and closing counts the notes, shows the variance and hands the drawer to the next cashier. POS shows the live drawer; day-end lists the shifts that ran.

**Bank** — bank accounts with a real statement (deposits, withdrawals, transfers, charges, reconcile ticks, reversals) and a cheque register for both directions: post-dated cheques, deposit → clear → bounce, and a bounced customer cheque goes straight back onto their khata. Day-end and shift closings bank their cash into a chosen account, so banked money no longer disappears; the balance sheet shows it as a real asset.

**Money** — customer ledgers (khata) and supplier payables with statements, purchases and stock inward with
unit entry, categorised expenses, day-end cash drawer closing (Z-report) including repair cash, and reports:
sales, profit & loss, stock valuation (FIFO / weighted average / actual), balance sheet, receivables and
payables aging, inventory movements, IMEI history, repairs and online sales.

**Access** — roles are data, not code: create a role, copy one, or edit a built-in one on a screen-by-screen matrix of
View / Add / Edit / Delete / Export plus extra actions; compare roles side by side; every change is in the audit log.
Branch staff only see their branch, and scopes such as "own sales only" or "own drawer only" are permissions too.

**Online** — a public storefront (`shop/`) sharing the same catalog: home, category and product pages, cart,
checkout with cash on delivery / bank transfer / wallets, order tracking, repair booking and CMS pages.
Orders arrive in the admin and convert into invoices with stock deduction.

**Website CMS** — edit the storefront from inside the software: branding, hero, announcement bar, highlights,
featured categories and products, banners, testimonials, custom pages with a rich-text editor, menu, contact
and social links, commerce rules, SEO and a full colour / font / radius theme editor with live preview.

## Logo & branding

The company mark lives in **one place** and every screen reads it from there — sidebar, login, browser
tab icon, all printed documents (invoice, GRN, purchase order, debit note, count sheet, job card), the
storefront header and the emailed invoice.

1. Save the artwork as **`assets/img/logo.png`** (a square-ish lockup works best; PNG with transparency
   is ideal). That is all — nothing in the code needs changing.
2. `assets/img/logo.svg` is a stand-in that ships with the prototype and is used only while no PNG is
   there. If neither file exists, the app falls back to the company initials so nothing looks broken.
3. A different logo per site can still be set in **Settings** (software) and **Website & CMS** (storefront);
   those override the file.

The displayed company name and tagline come from Settings (`Abbott Mobiles` · `The name of trust`).

## Theme

Top-right moon/sun toggles dark mode. Avatar menu → *Appearance* picks Light / Dark / System, one of five
accent presets, or **any custom colour** — a full shade scale is generated from your hex and the whole
software recolours. The storefront has its own colour theme in the CMS, and can follow the software colour.

## Date filters

Every page that shows period data uses the same filter bar: **Today, Yesterday, This Week, Last Week,
This Month, Last Month, All, Custom**. Dashboard tiles link to the matching page with the period preserved
(`sales.html?range=this_month`).

## Pages

| Area | Pages |
|---|---|
| Auth & home | `login.html`, `dashboard.html`, `profile.html` |
| POS & sales | `pos.html`, `sales.html`, `sale-view.html`, `invoice.html`, `returns.html` |
| Customers & suppliers | `customers.html`, `customer-view.html`, `suppliers.html`, `supplier-view.html` |
| Inventory | `products.html`, `product-view.html`, `products-import.html`, `labels.html`, `categories.html`, `imeis.html`, `stock.html`, `stock-counts.html`, `stock-count-view.html`, `transfers.html`, `transfer-create.html`, `transfer-view.html` |
| Purchases | `purchase-orders.html`, `purchase-order-create.html`, `purchase-order-view.html`, `purchases.html`, `purchase-create.html`, `purchase-view.html`, `supplier-returns.html`, `supplier-return-create.html`, `supplier-return-view.html` |
| Repairs | `repairs.html`, `repair-create.html`, `repair-view.html` |
| Accounting | `expenses.html`, `shifts.html`, `shift-view.html`, `banking.html`, `bank-account-view.html`, `cheques.html`, `day-end.html`, `closings.html` |
| Reports | `reports.html` + `report-sales`, `report-profit-loss`, `report-stock-valuation`, `report-balance-sheet`, `report-inventory`, `report-imei-history`, `report-expenses`, `report-receivables`, `report-payables`, `report-repairs`, `report-online-sales` |
| Website | `website.html` (CMS), `online-orders.html`, `online-order-view.html`, `inbox.html` (messages, newsletter, email log), `shop/*` (storefront) |
| Administration | `branches.html`, `users.html`, `roles.html`, `role-edit.html`, `settings.html`, `audit-log.html` |

## Project layout

```
abm/
  *.html                        one file per admin screen (no build step)
  shop/*.html                   public storefront
  assets/css/app.css            global theme tokens + component classes
  assets/css/shop.css           storefront design system
  assets/js/tailwind-config.js  theme bootstrap + Tailwind palette mapping + custom-colour scales
  assets/js/app.js              shell, mock DB, session/RBAC, stock & ledger services, theme, date ranges, UI helpers
  assets/js/data.js             deterministic demo data (mirrors the planned MySQL schema)
  assets/js/pages/pos.js        POS terminal component
  assets/js/shop.js             storefront runtime (theme, cart, orders)
  docs/FRONTEND-GUIDE.md        conventions, API reference, data shapes, business rules
  tests/render.ps1              headless-Chrome check (console errors, screenshots, mobile overflow)
```

## Developer notes

- Conventions and the runtime API are in `docs/FRONTEND-GUIDE.md`.
- Verify a page: `powershell -ExecutionPolicy Bypass -File tests\render.ps1 -Page products.html -As admin`
  (add `-Mobile`, `-Theme dark`, `-Accent violet`, `-As cashier|technician`, `-NoLogin` for shop pages).
  Screenshots land in `tests/out/`.
- `?__layout=1` logs elements overflowing the viewport; `&__click=<selector>` opens a modal before the screenshot.
