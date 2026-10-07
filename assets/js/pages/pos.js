/* ==========================================================================
   Abbott Mobile — POS Terminal component (assets/js/pages/pos.js)
   Alpine component for pos.html. Load order (all deferred):
     data.js -> app.js -> pages/pos.js -> alpinejs
   Sells serialized devices (IMEI / serial scan), accessories, spare parts and
   non-stock services. All stock / ledger writes go through ABM.stock & ABM.ledger.
   ========================================================================== */
window.posPage = function posPage() {
  'use strict';
  const { db, utils, ui, session, stock, ledger } = ABM;
  const PER_PAGE = 15;
  const branchId = session.branchId();
  const branch = session.branch() || { id: branchId, name: 'Branch', code: 'MB' };
  const user = session.user() || { id: null, name: 'User', role: '' };
  const canOverride = session.isSuperAdmin() || session.isManager();
  const DRAFT_KEY = `abm.pos.draft.${branchId}.${user.id}`;
  const HELD_KEY = `abm.pos.held.${branchId}`;
  const METHODS = [
    { key: 'cash', label: 'Cash' }, { key: 'card', label: 'Card' }, { key: 'jazzcash', label: 'JazzCash' },
    { key: 'easypaisa', label: 'EasyPaisa' }, { key: 'bank_transfer', label: 'Bank Transfer' }, { key: 'store_credit', label: 'Store Credit' },
  ];
  const NEEDS_REF = ['card', 'jazzcash', 'easypaisa', 'bank_transfer'];
  const isBank = (m) => ABM.bank.isNonCash(m);                        // card / wallet / transfer money lands in an account
  const defaultAccount = (m) => (isBank(m) ? ABM.bank.accountFor(m, branchId) : null);
  const TYPE_CHIPS = [{ key: '', label: 'All' }, { key: 'device', label: 'Devices' }, { key: 'accessory', label: 'Accessories' }, { key: 'part', label: 'Parts' }, { key: 'service', label: 'Services' }];

  const walkinId = () => {
    const d = db.find('customers', db.setting('default_customer_id'));
    if (d && d.is_walkin) return d.id;
    const w = db.first('customers', (c) => c.is_walkin);
    return w ? w.id : (d ? d.id : 1);
  };
  const defaultTax = () => utils.clamp(Number(db.setting('default_tax_rate')) || 0, 0, 100);
  const emptyCart = () => ({ customer_id: walkinId(), lines: [], discount_type: 'percent', discount_value: 0, tax_rate: defaultTax(), notes: '', price_mode: 'retail' });
  const iconFor = (p, type) => (type === 'service' ? 'wrench' : type === 'part' ? 'cpu' : type === 'accessory' ? 'cube' : ['laptop', 'desktop'].includes(p.device_type) ? 'laptop' : 'phone');
  const readJson = (key, def) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? def : v; } catch (e) { return def; } };
  const writeJson = (key, v) => { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked: ignore */ } };
  let keyCounter = 0;
  const newKey = () => `${Date.now().toString(36)}-${++keyCounter}`;
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  /** a stored line's price approval (held carts / drafts keep who approved which net price) */
  const approval = (s) => ({ override: !!s.override, override_at: s.override && s.override_at != null ? num(s.override_at) : null, override_by: s.override ? (s.override_by || null) : null });

  return {
    /* ------------------------------------------------------------ context */
    branch, user, canOverride, branchId,
    roleLabel: session.roleLabel(),
    allowNegative: !!db.setting('allow_negative_stock'),
    taxLabel: db.setting('tax_label') || 'Tax',
    canViewProducts: session.can('products.view'),
    canViewCustomers: session.can('customers.view'),
    methods: METHODS,
    typeChips: TYPE_CHIPS,
    /** last invoice discount that passed the minimum-price check (a refused change goes back to it) */
    discAccepted: { type: 'percent', value: 0 },
    /* finder */
    q: '', type: '', category: '', brand: '', page: 1, products: [], brands: [],
    /* cart */
    cart: emptyCart(), cartOpen: false, held: [], showNotes: false,
    /* modals */
    unitModal: { open: false, product: null, q: '', page: 1, fromScan: false },
    customerModal: { open: false, tab: 'find', q: '', page: 1, busy: false, form: { name: '', phone: '', address: '', cnic: '' }, errors: {} },
    recallModal: { open: false },
    checkout: { open: false, payments: [], khata: false, busy: false, limitOverride: false, errors: [] },
    success: { open: false, sale: null, change: 0 },
    /* header */
    clock: '', clockDate: '', today: { total: 0, count: 0 },
    /* cash drawer (see ABM.shift) — sales are stamped with the open shift */
    shift: { open: false, row: null, expected: 0 },

    init() {
      this.refresh();
      this.refreshShift();
      this.held = this.loadHeld();
      this.restoreDraft();
      const cid = utils.qs('customer');
      if (cid) { const c = db.find('customers', cid); if (c && c.is_active) { this.cart.customer_id = c.id; } else ui.warn('Customer from the link was not found.'); }
      // QA aid (like ?__click): ?__cart=18,1 pre-fills the cart so screenshots can show lines / checkout.
      const demo = utils.qs('__cart');
      if (demo) demo.split(',').map((s) => s.trim()).filter(Boolean).forEach((id) => this.quickAddById(id));
      this.acceptDiscount();
      this.tick(); setInterval(() => this.tick(), 1000);
      this.computeToday();
      this.$watch('cart', () => this.saveDraft());
      this.$watch('q', () => { this.page = 1; });
      this.$watch('category', () => { this.page = 1; });
      this.$watch('brand', () => { this.page = 1; });
      this.$watch('type', () => { this.page = 1; if (this.category && !this.categoryChips.some((c) => String(c.id) === String(this.category))) this.category = ''; });
      this.$watch('customerModal.q', () => { this.customerModal.page = 1; });
      this.$watch('unitModal.q', () => { this.unitModal.page = 1; });
      window.addEventListener('keydown', (e) => this.onKey(e), true);
      this.$nextTick(() => this.focusSearch());
    },

    /* --------------------------------------------------------------- data */
    /** The cashier's open drawer, if any — shown above the cart and stamped on every sale. */
    refreshShift() {
      const row = ABM.shift.current(user.id, branchId);
      this.shift = row ? { open: true, row, expected: ABM.shift.tally(row).expected } : { open: false, row: null, expected: 0 };
    },
    refresh() {
      const units = db.all('product_imeis').filter((i) => i.branch_id == branchId && stock.SELLABLE.includes(i.status));
      const unitCount = {}, openBox = {};
      units.forEach((i) => { unitCount[i.product_id] = (unitCount[i.product_id] || 0) + 1; if (i.status === 'returned') openBox[i.product_id] = (openBox[i.product_id] || 0) + 1; });
      const rows = db.all('products').filter((p) => p.is_active).map((p) => {
        const type = db.productType(p);
        const serialized = db.isSerialized(p);
        const tracked = db.isStockTracked(p);
        const qty = !tracked ? null : serialized ? (unitCount[p.id] || 0) : stock.qty(branchId, p.id);
        const brandName = db.brandName(p.brand_id), categoryName = db.categoryName(p.category_id);
        const sub = [p.variant, p.color].filter(Boolean).join(' · ');
        return {
          id: p.id, name: p.name, model: p.model || '', sku: p.sku || '', barcode: p.barcode || '', brand_id: p.brand_id, brand: brandName,
          category_id: p.category_id, category: categoryName, type, device_type: p.device_type || null, serialized, serial_label: db.serialLabel(p), tracked,
          qty, min_stock: Number(p.min_stock) || 0, open_box: openBox[p.id] || 0, condition: p.condition || 'new', warranty_months: Number(p.warranty_months) || 0,
          retail_price: num(p.retail_price), wholesale_price: num(p.wholesale_price), min_sale_price: num(p.min_sale_price), icon: iconFor(p, type), sub,
          sellable: !tracked || qty > 0 || (this.allowNegative && !serialized),
          search: [p.name, p.model, p.variant, p.color, p.sku, p.barcode, brandName, categoryName].filter(Boolean).join(' ').toLowerCase(),
        };
      });
      this.products = utils.sortBy(rows, (p) => (p.name + ' ' + p.sub).toLowerCase());
      this.brands = utils.sortBy(db.all('brands').filter((b) => b.is_active && rows.some((p) => p.brand_id === b.id)), 'name');
    },
    productRow(id) { return this.products.find((p) => String(p.id) === String(id)) || null; },
    computeToday() {
      const t = utils.today();
      const mine = db.all('sales').filter((s) => s.status !== 'void' && s.user_id == user.id && s.branch_id == branchId && String(s.sale_date || '').slice(0, 10) === t);
      this.today = { total: utils.sum(mine, 'total'), count: mine.length };
    },
    tick() { const d = new Date(); this.clock = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); this.clockDate = utils.date(d, 'long'); },

    /* ------------------------------------------------------------- finder */
    get typeCounts() { const m = {}; this.products.forEach((p) => { m[p.type] = (m[p.type] || 0) + 1; }); m[''] = this.products.length; return m; },
    get categoryChips() {
      const m = {};
      this.products.filter((p) => !this.type || p.type === this.type).forEach((p) => { const c = m[p.category_id] = m[p.category_id] || { id: p.category_id, name: p.category, count: 0 }; c.count++; });
      return utils.sortBy(Object.values(m), (c) => c.name.toLowerCase());
    },
    get filtered() {
      const q = this.q.trim().toLowerCase();
      return this.products.filter((p) => (!this.type || p.type === this.type) && (!this.category || String(p.category_id) === String(this.category)) && (!this.brand || String(p.brand_id) === String(this.brand)) && (!q || p.search.includes(q)));
    },
    get pager() { return utils.paginate(this.filtered, this.page, PER_PAGE); },
    get pageNumbers() { const { page, pages } = this.pager; const out = []; for (let n = Math.max(1, page - 2); n <= Math.min(pages, page + 2); n++) out.push(n); return out; },
    get hasFilters() { return !!(this.q || this.type || this.category || this.brand); },
    clearFilters() { this.q = ''; this.type = ''; this.category = ''; this.brand = ''; this.focusSearch(); },
    priceFor(p) { return this.cart.price_mode === 'wholesale' && p.wholesale_price > 0 ? p.wholesale_price : p.retail_price; },
    stockBadge(p) {
      if (!p.tracked) return ui.badge('service', 'Service');
      if (p.qty <= 0) return ui.badge('out', 'Out of stock');
      if (p.qty <= p.min_stock) return ui.badge('low', p.qty + ' left');
      return ui.badge('ok', p.qty + ' in stock');
    },
    focusSearch(force = false) {
      const el = this.$refs.search; if (!el) return;
      if (force || window.innerWidth >= 1024) { el.focus(); el.select(); }
    },
    /** Enter in the search box: exact unit → exact barcode/SKU → single result. */
    scanEnter() {
      const raw = this.q.trim(); if (!raw) return;
      const code = raw.toUpperCase().replace(/\s+/g, '');
      const unit = stock.findSellable(code, branchId);
      if (unit) { if (this.addUnit(unit)) this.afterScan(); return; }
      const anyUnit = stock.findUnit(code);
      if (anyUnit) { ui.error(this.unitProblem(anyUnit)); this.focusSearch(true); return; }
      if (utils.isValidImei(code)) { ui.error(`No sellable unit with IMEI ${code} at ${branch.name}.`); this.focusSearch(true); return; }
      const exact = this.products.find((p) => utils.sameBarcode(p.barcode, code) || (p.sku && String(p.sku).toUpperCase() === code));
      if (exact) { this.pick(exact, true); return; }
      const list = this.filtered;
      if (list.length === 1) { this.pick(list[0], true); return; }
      if (!list.length) ui.warn(`No products match "${raw}".`);
    },
    afterScan() { this.q = ''; this.page = 1; this.focusSearch(true); },
    unitProblem(u) {
      const p = db.find('products', u.product_id);
      const label = p ? db.serialLabel(p) : 'Unit';
      if (u.status === 'sold') return `${label} ${u.imei} was already sold.`;
      if (u.status === 'in_transit') return `${label} ${u.imei} is in transit on a stock transfer.`;
      if (u.status === 'defective') return `${label} ${u.imei} is marked defective and cannot be sold.`;
      if (u.branch_id != branchId) return `${label} ${u.imei} is at ${db.branchName(u.branch_id)}, not ${branch.name}.`;
      return `${label} ${u.imei} is not available for sale.`;
    },
    /** Product card click / exact match: serialized → unit picker, otherwise add / increment. */
    pick(p, fromScan = false) {
      if (!p.sellable) { ui.error(`${p.name} is out of stock at ${branch.name}.`); return; }
      if (p.serialized) { this.openUnitPicker(p, fromScan); return; }
      if (this.addLine(p) && fromScan) this.afterScan();
    },
    quickAddById(id) {
      const p = this.productRow(id); if (!p || !p.sellable) return;
      if (p.serialized) { const u = db.first('product_imeis', (i) => i.product_id == p.id && i.branch_id == branchId && stock.SELLABLE.includes(i.status) && !this.cart.lines.some((l) => l.imei_id === i.id)); if (u) this.addUnit(u); }
      else this.addLine(p);
    },

    /* -------------------------------------------------------------- lines */
    makeLine(p, extra = {}) {
      return {
        key: newKey(), product_id: p.id, name: p.name, sub: p.sub, brand: p.brand, type: p.type, icon: p.icon, serialized: p.serialized, serial_label: p.serial_label,
        imei_id: null, imei: null, open_box: false, qty: 1, unit_price: this.priceFor(p), retail_price: p.retail_price, wholesale_price: p.wholesale_price,
        min_sale_price: p.min_sale_price, discount: 0, warranty_months: p.warranty_months, tracked: p.tracked, stock: p.qty, override: false, override_at: null, override_by: null, condition: p.condition, ...extra,
      };
    },
    addUnit(unit) {
      const p = this.productRow(unit.product_id);
      if (!p) { ui.error('This product is inactive and cannot be sold.'); return false; }
      if (this.cart.lines.some((l) => l.imei_id === unit.id)) { ui.error(`${p.serial_label} ${unit.imei} is already in the cart.`); return false; }
      this.cart.lines.push(this.makeLine(p, { imei_id: unit.id, imei: unit.imei, open_box: unit.status === 'returned' }));
      ui.success(`${p.name} · ${unit.imei} added.`);
      return true;
    },
    addLine(p, qty = 1) {
      const existing = this.cart.lines.find((l) => l.product_id === p.id && !l.serialized);
      const newQty = (existing ? existing.qty : 0) + qty;
      if (p.tracked && !this.allowNegative && newQty > p.qty) { ui.error(`Only ${p.qty} × ${p.name} in stock at ${branch.name}.`); return false; }
      if (existing) { existing.qty = newQty; existing.stock = p.qty; }
      else this.cart.lines.push(this.makeLine(p));
      ui.success(`${p.name} ${existing ? '× ' + newQty : 'added'}.`);
      return true;
    },
    lineTotal(l) { return utils.round2(num(l.qty) * num(l.unit_price) - num(l.discount)); },
    netUnit(l) { const q = num(l.qty) || 1; return utils.round2((q * num(l.unit_price) - num(l.discount)) / q); },
    /**
     * The invoice discount spread over the lines in proportion to their totals — the same way writeSale
     * spreads the tax. The last line takes the rounding so the shares add up to the discount exactly.
     * Returns { [line.key]: share }.
     */
    invoiceShares() {
      const t = this.totals, lines = this.cart.lines, out = {};
      if (!(t.invoiceDisc > 0) || !(t.afterLine > 0)) return out;
      let left = t.invoiceDisc;
      lines.forEach((l, i) => {
        const share = i === lines.length - 1 ? left : utils.round2(t.invoiceDisc * this.lineTotal(l) / t.afterLine);
        out[l.key] = Math.max(0, share);
        left = utils.round2(left - share);
      });
      return out;
    },
    /** Net price of one unit after the line discount AND its share of the invoice discount (before tax). */
    effectiveUnit(l, shares) { const s = shares || this.invoiceShares(); const q = num(l.qty) || 1; return utils.round2((this.lineTotal(l) - (s[l.key] || 0)) / q); },
    /**
     * min_sale_price holds unless a manager approved this line's price. An approval covers the net price it
     * was given for (override_at): a bigger discount afterwards needs a new approval. Held carts from before
     * override_at existed keep their blanket approval.
     */
    floorOk(l, shares) {
      if (!(num(l.min_sale_price) > 0)) return true;
      const net = this.effectiveUnit(l, shares);
      if (net >= num(l.min_sale_price) - 0.005) return true;
      return !!l.override && (l.override_at == null || net >= num(l.override_at) - 0.005);
    },
    /** Lines whose effective price is under the minimum with no approval covering it. */
    get belowFloor() { const s = this.invoiceShares(); return this.cart.lines.filter((l) => !this.floorOk(l, s)); },
    /** Manager approval for lines under their minimum price: one confirm, one audit row per line (same path as a line edit). */
    async approveFloor(lines, context) {
      if (!lines.length) return true;
      const s = this.invoiceShares();
      const list = lines.map((l) => `${l.name} ${utils.money(this.effectiveUnit(l, s))} (min ${utils.money(l.min_sale_price)})`).join('; ');
      const viaInvoice = lines.some((l) => (s[l.key] || 0) > 0);
      if (!canOverride) {
        ui.error(`${viaInvoice ? 'After the invoice discount, ' : ''}${list} ${lines.length === 1 ? 'is' : 'are'} below the minimum sale price. A manager can override this.`);
        return false;
      }
      const ok = await ui.confirm({
        title: 'Below minimum sale price',
        message: `${viaInvoice ? 'With the invoice discount of ' + utils.money(this.totals.invoiceDisc) + ', ' : ''}${list} ${lines.length === 1 ? 'is' : 'are'} below the minimum sale price. Allow ${lines.length === 1 ? 'this price' : 'these prices'} for this sale?`,
        confirmText: 'Allow', danger: true,
      });
      if (!ok) return false;
      lines.forEach((l) => {
        const net = this.effectiveUnit(l, s);
        l.override = true; l.override_at = net; l.override_by = user.name;
        db.audit('sale.price_override', 'product', l.product_id, `${user.name} allowed ${utils.money(net)} (min ${utils.money(l.min_sale_price)}) for ${l.name} at POS${(s[l.key] || 0) > 0 ? ' — includes ' + utils.money(s[l.key]) + ' of the invoice discount' : ''}${context === 'checkout' ? ' (at checkout)' : ''}`, branchId);
      });
      return true;
    },
    removeLine(l) { this.cart.lines = this.cart.lines.filter((x) => x.key !== l.key); },
    incQty(l, d) { this.applyQty(l, num(l.qty) + d); },
    setQty(l, el) { this.applyQty(l, parseInt(el.value, 10)); el.value = l.qty; },
    applyQty(l, q) {
      if (l.serialized) return;
      if (!Number.isInteger(q) || q < 1) { ui.error('Quantity must be a whole number of 1 or more.'); return; }
      if (l.tracked && !this.allowNegative) { const avail = stock.qty(branchId, l.product_id); if (q > avail) { ui.error(`Only ${avail} × ${l.name} in stock at ${branch.name}.`); return; } }
      l.qty = q;
      if (num(l.discount) > q * num(l.unit_price)) l.discount = utils.round2(q * num(l.unit_price));
    },
    async setPrice(l, el) {
      const v = utils.round2(el.value);
      if (el.value === '' || isNaN(Number(el.value)) || v < 0) { ui.error('Enter a valid unit price.'); el.value = l.unit_price; return; }
      const prev = l.unit_price;
      l.unit_price = v;
      if (num(l.discount) > num(l.qty) * v) l.discount = utils.round2(num(l.qty) * v);
      if (!(await this.checkFloor(l))) l.unit_price = prev;
      el.value = l.unit_price;
    },
    async setLineDiscount(l, el) {
      let v = utils.round2(el.value);
      if (el.value === '' ) v = 0;
      if (isNaN(Number(el.value)) || v < 0) { ui.error('Enter a discount amount of 0 or more.'); el.value = l.discount; return; }
      const max = utils.round2(num(l.qty) * num(l.unit_price));
      if (v > max) { v = max; ui.warn(`Line discount capped at ${utils.money(max)}.`); }
      const prev = l.discount;
      l.discount = v;
      if (!(await this.checkFloor(l))) l.discount = prev;
      el.value = l.discount;
    },
    /**
     * Enforce min_sale_price on the net unit price — line discount AND its share of the invoice discount.
     * Managers / admins may override after a confirm (audited).
     */
    async checkFloor(l) {
      if (this.floorOk(l)) return true;
      if (!canOverride) { ui.error(`Minimum sale price for ${l.name} is ${utils.money(l.min_sale_price)}. A manager can override this.`); return false; }
      return this.approveFloor([l], 'line');
    },
    acceptDiscount() { this.discAccepted = { type: this.cart.discount_type === 'fixed' ? 'fixed' : 'percent', value: num(this.cart.discount_value) }; },
    /**
     * After the invoice discount changes: it may not take any line under its minimum price. A manager is
     * asked to approve (the same confirm + audit as a line price); anyone else gets the previous discount back.
     */
    async guardInvoiceDiscount() {
      const bad = this.belowFloor;
      if (!bad.length || await this.approveFloor(bad, 'discount')) { this.acceptDiscount(); return true; }
      this.cart.discount_type = this.discAccepted.type;
      this.cart.discount_value = this.discAccepted.value;
      return false;
    },
    setPriceMode(mode) {
      if (this.cart.price_mode === mode) return;
      this.cart.price_mode = mode;
      let floored = 0;
      this.cart.lines.forEach((l) => {
        let price = mode === 'wholesale' && l.wholesale_price > 0 ? l.wholesale_price : l.retail_price;
        if (!l.override && l.min_sale_price > 0 && price < l.min_sale_price) { price = l.min_sale_price; floored++; }
        l.unit_price = price;
        if (num(l.discount) > num(l.qty) * price) l.discount = utils.round2(num(l.qty) * price);
      });
      if (floored) ui.warn(`${floored} line(s) kept at their minimum sale price.`);
    },

    /* ------------------------------------------------------------- totals */
    get totals() {
      const lines = this.cart.lines;
      const gross = utils.sum(lines, (l) => num(l.qty) * num(l.unit_price));
      const lineDisc = utils.sum(lines, (l) => num(l.discount));
      const afterLine = utils.round2(Math.max(0, gross - lineDisc));
      const dv = Math.max(0, num(this.cart.discount_value));
      const invoiceDisc = this.cart.discount_type === 'percent' ? utils.round2(afterLine * Math.min(100, dv) / 100) : utils.round2(Math.min(afterLine, dv));
      const taxable = utils.round2(afterLine - invoiceDisc);
      const rate = utils.clamp(num(this.cart.tax_rate), 0, 100);
      const tax = utils.round2(taxable * rate / 100);
      const total = utils.round2(taxable + tax);
      return { gross, lineDisc, afterLine, invoiceDisc, taxable, rate, tax, total, count: lines.reduce((a, l) => a + num(l.qty), 0) };
    },
    normalizeDiscount(el) {
      let v = num(this.cart.discount_value);
      if (v < 0) v = 0;
      if (this.cart.discount_type === 'percent' && v > 100) { v = 100; ui.warn('Invoice discount capped at 100%.'); }
      if (this.cart.discount_type === 'fixed' && v > this.totals.afterLine) { v = this.totals.afterLine; ui.warn(`Invoice discount capped at ${utils.money(v)}.`); }
      this.cart.discount_value = utils.round2(v);
      if (el) el.value = this.cart.discount_value;
    },
    normalizeTax(el) { this.cart.tax_rate = utils.round2(utils.clamp(num(this.cart.tax_rate), 0, 100)); if (el) el.value = this.cart.tax_rate; },

    /* ----------------------------------------------------------- customer */
    get customer() { return db.find('customers', this.cart.customer_id) || db.find('customers', walkinId()) || { id: null, name: 'Walk-in Customer', is_walkin: 1, balance: 0, credit_limit: 0 }; },
    get storeCredit() { return this.customer.is_walkin ? 0 : ledger.customerStoreCredit(this.customer.id); },
    balanceChip(c) {
      const b = num(c.balance);
      if (b > 0) return ui.badge('due', 'Owes ' + utils.money(b, { decimals: 0 }));
      if (b < 0) return ui.badge('available', 'Credit ' + utils.money(-b, { decimals: 0 }));
      return c.is_walkin ? '' : ui.badge('ok', 'Clear');
    },
    openCustomer(tab = 'find') {
      this.customerModal = { open: true, tab, q: '', page: 1, busy: false, form: { name: '', phone: '', address: '', cnic: '' }, errors: {} };
      this.$nextTick(() => { const el = tab === 'find' ? this.$refs.custSearch : this.$refs.custName; if (el) el.focus(); });
    },
    setCustomer(id) {
      this.cart.customer_id = id;
      this.customerModal.open = false;
      // store-credit rows are only valid for the customer that owns the credit
      if (this.checkout.open) this.checkout.payments.forEach((r) => { if (r.method === 'store_credit') r.amount = Math.min(num(r.amount), this.storeCredit); });
    },
    get customerList() {
      const q = this.customerModal.q.trim().toLowerCase();
      const rows = db.all('customers').filter((c) => c.is_active && !c.is_walkin && (!q || [c.name, c.phone, c.cnic, c.email].some((v) => String(v || '').toLowerCase().includes(q))));
      return utils.sortBy(rows, (c) => String(c.name || '').toLowerCase());
    },
    get customerPager() { return utils.paginate(this.customerList, this.customerModal.page, PER_PAGE); },
    customerEnter() { const list = this.customerList; if (list.length === 1) this.setCustomer(list[0].id); },
    validateCustomer() {
      const f = this.customerModal.form, e = {};
      const name = String(f.name || '').trim(), phone = String(f.phone || '').trim();
      if (name.length < 2) e.name = 'Enter the customer name.';
      if (!phone) e.phone = 'Phone number is required.';
      else if (!/^[0-9+][0-9\s\-]{6,19}$/.test(phone)) e.phone = 'Enter a valid phone number (e.g. 0300-1234567).';
      else { const dup = db.first('customers', (c) => c.is_active && String(c.phone || '').replace(/\D/g, '') === phone.replace(/\D/g, '')); if (dup) e.phone = `${dup.name} already uses this phone number.`; }
      const cnic = String(f.cnic || '').trim();
      if (cnic && !/^\d{5}-?\d{7}-?\d$/.test(cnic)) e.cnic = 'CNIC must be 13 digits (35202-1234567-1).';
      this.customerModal.errors = e;
      return !Object.keys(e).length;
    },
    saveCustomer() {
      if (!this.validateCustomer()) { ui.error('Please fix the highlighted fields.'); return; }
      this.customerModal.busy = true;
      try {
        const f = this.customerModal.form;
        let cnic = String(f.cnic || '').trim().replace(/\D/g, '');
        if (cnic) cnic = `${cnic.slice(0, 5)}-${cnic.slice(5, 12)}-${cnic.slice(12)}`;
        const rec = db.insert('customers', { name: String(f.name).trim(), phone: String(f.phone).trim(), email: '', address: String(f.address || '').trim(), cnic, credit_limit: 0, balance: 0, is_walkin: 0, notes: '', is_active: 1 });
        db.audit('customer.create', 'customer', rec.id, `Customer ${rec.name} (${rec.phone}) added from POS quick-add`);
        ui.success(`${rec.name} added and selected.`);
        this.setCustomer(rec.id);
      } catch (err) { ui.error(err.message || 'Could not save customer.'); }
      finally { this.customerModal.busy = false; }
    },

    /* ---------------------------------------------------------- unit picker */
    openUnitPicker(p, fromScan = false) {
      this.unitModal = { open: true, product: p, q: '', page: 1, fromScan };
      this.$nextTick(() => { if (this.$refs.unitSearch) this.$refs.unitSearch.focus(); });
    },
    get unitList() {
      const p = this.unitModal.product; if (!p) return [];
      const inCart = new Set(this.cart.lines.map((l) => l.imei_id));
      const q = this.unitModal.q.trim().toUpperCase().replace(/\s+/g, '');
      const rows = db.all('product_imeis').filter((i) => i.product_id == p.id && i.branch_id == branchId && stock.SELLABLE.includes(i.status) && !inCart.has(i.id) && (!q || String(i.imei).toUpperCase().includes(q) || String(i.imei2 || '').toUpperCase().includes(q)));
      return utils.sortBy(rows, (i) => (i.status === 'returned' ? 0 : 1) + '-' + String(i.id).padStart(8, '0'));
    },
    get unitPager() { return utils.paginate(this.unitList, this.unitModal.page, PER_PAGE); },
    chooseUnit(u) {
      if (this.addUnit(u)) { const fromScan = this.unitModal.fromScan; this.unitModal.open = false; if (fromScan) this.afterScan(); else this.focusSearch(); }
    },
    unitEnter() { const list = this.unitList; if (list.length === 1) this.chooseUnit(list[0]); else if (!list.length) ui.warn('No unit matches that number.'); },

    /* ------------------------------------------------------------- hold / recall */
    loadHeld() { const rows = readJson(HELD_KEY, []); return Array.isArray(rows) ? rows.filter((h) => h && Array.isArray(h.lines)) : []; },
    saveHeld() { writeJson(HELD_KEY, this.held); },
    holdCart() {
      if (!this.cart.lines.length) { ui.warn('Nothing to hold — the cart is empty.'); return; }
      const c = this.cart;
      this.held.unshift({ id: Date.now(), at: utils.now(), by: user.name, customer_id: c.customer_id, customer: this.customer.name, lines: JSON.parse(JSON.stringify(c.lines)), discount_type: c.discount_type, discount_value: c.discount_value, tax_rate: c.tax_rate, notes: c.notes, price_mode: c.price_mode, total: this.totals.total, count: this.totals.count });
      this.saveHeld();
      this.resetCart();
      ui.success('Cart held. Recall it any time from the Recall button.');
      this.focusSearch();
    },
    async recall(h) {
      if (this.cart.lines.length) { const ok = await ui.confirm({ title: 'Replace current cart?', message: 'The items in the current cart will be discarded and replaced by the held cart.', confirmText: 'Replace', danger: true }); if (!ok) return; }
      const { lines, dropped } = this.revalidateLines(h.lines);
      const cust = db.find('customers', h.customer_id);
      this.cart = { customer_id: cust && cust.is_active ? cust.id : walkinId(), lines, discount_type: h.discount_type === 'fixed' ? 'fixed' : 'percent', discount_value: num(h.discount_value), tax_rate: h.tax_rate == null ? defaultTax() : num(h.tax_rate), notes: h.notes || '', price_mode: h.price_mode === 'wholesale' ? 'wholesale' : 'retail' };
      this.held = this.held.filter((x) => x.id !== h.id); this.saveHeld();
      this.acceptDiscount();
      this.recallModal.open = false;
      if (dropped.length) ui.warn(`Recalled with ${dropped.length} change(s): ${dropped.join('; ')}`); else ui.success('Cart recalled.');
    },
    async deleteHeld(h) {
      const ok = await ui.confirm({ title: 'Delete held cart?', message: `${h.count} item(s) for ${h.customer} will be discarded.`, confirmText: 'Delete', danger: true });
      if (!ok) return;
      this.held = this.held.filter((x) => x.id !== h.id); this.saveHeld();
      ui.success('Held cart deleted.');
    },
    /** Rebuild stored lines against current stock; drops units that are no longer sellable here. */
    revalidateLines(stored) {
      const lines = [], dropped = [];
      const seenUnits = new Set();
      (stored || []).forEach((s) => {
        const p = this.productRow(s.product_id);
        if (!p) { dropped.push(`${s.name || 'item'} is inactive`); return; }
        if (p.serialized) {
          const u = db.find('product_imeis', s.imei_id);
          if (!u || u.branch_id != branchId || !stock.SELLABLE.includes(u.status) || seenUnits.has(u.id)) { dropped.push(`${p.name} ${s.imei || ''} no longer available`); return; }
          seenUnits.add(u.id);
          lines.push(this.makeLine(p, { imei_id: u.id, imei: u.imei, open_box: u.status === 'returned', unit_price: num(s.unit_price) || this.priceFor(p), discount: num(s.discount), ...approval(s) }));
        } else {
          let qty = Math.max(1, parseInt(s.qty, 10) || 1);
          if (p.tracked && !this.allowNegative && qty > p.qty) { if (p.qty <= 0) { dropped.push(`${p.name} out of stock`); return; } dropped.push(`${p.name} reduced to ${p.qty}`); qty = p.qty; }
          const line = this.makeLine(p, { qty, unit_price: num(s.unit_price) || this.priceFor(p), discount: Math.min(num(s.discount), qty * num(s.unit_price)), ...approval(s) });
          lines.push(line);
        }
      });
      return { lines, dropped };
    },
    saveDraft() { const c = this.cart; writeJson(DRAFT_KEY, c.lines.length || c.notes || c.customer_id !== walkinId() ? { customer_id: c.customer_id, lines: c.lines, discount_type: c.discount_type, discount_value: c.discount_value, tax_rate: c.tax_rate, notes: c.notes, price_mode: c.price_mode } : null); },
    restoreDraft() {
      const d = readJson(DRAFT_KEY, null); if (!d || !Array.isArray(d.lines)) return;
      const { lines, dropped } = this.revalidateLines(d.lines);
      const cust = db.find('customers', d.customer_id);
      this.cart = { customer_id: cust && cust.is_active ? cust.id : walkinId(), lines, discount_type: d.discount_type === 'fixed' ? 'fixed' : 'percent', discount_value: num(d.discount_value), tax_rate: d.tax_rate == null ? defaultTax() : num(d.tax_rate), notes: d.notes || '', price_mode: d.price_mode === 'wholesale' ? 'wholesale' : 'retail' };
      if (dropped.length) ui.warn(`Some items from your previous cart were removed: ${dropped.join('; ')}`);
    },
    async clearCart() {
      if (!this.cart.lines.length && !this.cart.notes) { this.resetCart(); return; }
      const ok = await ui.confirm({ title: 'Clear cart?', message: `${this.totals.count} item(s) will be removed from the cart.`, confirmText: 'Clear cart', danger: true });
      if (!ok) return;
      this.resetCart(); ui.success('Cart cleared.'); this.focusSearch();
    },
    resetCart() { this.cart = emptyCart(); this.showNotes = false; this.acceptDiscount(); },

    /* ---------------------------------------------------------- validation */
    validateCart() {
      const errs = [];
      if (!this.cart.lines.length) errs.push('The cart is empty.');
      const seen = new Set();
      const shares = this.invoiceShares();
      this.cart.lines.forEach((l) => {
        const p = db.find('products', l.product_id);
        if (!p || !p.is_active) { errs.push(`${l.name} is no longer active.`); return; }
        if (l.serialized) {
          if (seen.has(l.imei_id)) errs.push(`${l.serial_label} ${l.imei} appears twice in the cart.`);
          seen.add(l.imei_id);
          const u = db.find('product_imeis', l.imei_id);
          if (!u || u.branch_id != branchId || !stock.SELLABLE.includes(u.status)) errs.push(`${l.serial_label} ${l.imei} is no longer available at ${branch.name}.`);
        } else if (l.tracked && !this.allowNegative) {
          const avail = stock.qty(branchId, l.product_id);
          if (num(l.qty) > avail) errs.push(`Only ${avail} × ${l.name} in stock (cart has ${l.qty}).`);
        }
        if (!(Number.isInteger(num(l.qty)) && num(l.qty) >= 1)) errs.push(`Invalid quantity for ${l.name}.`);
        if (!(num(l.unit_price) >= 0)) errs.push(`Invalid price for ${l.name}.`);
        if (num(l.discount) < 0 || num(l.discount) > num(l.qty) * num(l.unit_price)) errs.push(`Discount on ${l.name} exceeds the line amount.`);
        if (!this.floorOk(l, shares)) errs.push(`${l.name} is below its minimum sale price (${utils.money(l.min_sale_price)})${(shares[l.key] || 0) > 0 ? ' after the invoice discount' : ''}${canOverride ? '' : ' — a manager can override this'}.`);
      });
      if (this.totals.total < 0) errs.push('Total cannot be negative.');
      return errs;
    },

    /* ------------------------------------------------------------ checkout */
    /** Async only when a manager must approve a price below the minimum; otherwise it opens synchronously. */
    async openCheckout() {
      if (!this.cart.lines.length) { ui.warn('Add items to the cart first.'); return; }
      this.normalizeDiscount(); this.normalizeTax();
      let problems = this.validateCart();
      const bad = this.belowFloor;
      if (problems.length && bad.length && canOverride) {
        if (!(await this.approveFloor(bad, 'checkout'))) return;
        this.acceptDiscount();
        problems = this.validateCart();
      }
      if (problems.length) { ui.error(problems[0]); return; }
      this.checkout = { open: true, payments: [this.payRow('cash', this.totals.total)], khata: false, busy: false, limitOverride: false, errors: [] };
      this.$nextTick(() => { const el = this.$refs.payAmount0; if (el) { el.focus(); el.select(); } });
    },
    payRow(method, amount) { return { key: newKey(), method, amount: utils.round2(amount), reference: '', account_id: String(defaultAccount(method) || '') }; },
    /** Open bank / wallet accounts this branch can take card, wallet and transfer money into. */
    get bankAccounts() { return ABM.bank.accounts(branchId).filter((a) => a.is_active); },
    isBank(method) { return isBank(method); },
    /** The account a payment row settles into: the one picked, else the Banking-page default for the method. */
    rowAccount(r) { return isBank(r.method) ? (r.account_id || defaultAccount(r.method) || null) : null; },
    accountName(id) { const a = id ? db.find('bank_accounts', id) : null; return a ? a.name : ''; },
    get pay() {
      const total = this.totals.total;
      const rows = this.checkout.payments || [];
      const paid = utils.sum(rows, (r) => num(r.amount));
      const cash = utils.sum(rows.filter((r) => r.method === 'cash'), (r) => num(r.amount));
      const credit = utils.sum(rows.filter((r) => r.method === 'store_credit'), (r) => num(r.amount));
      const nonCash = utils.round2(paid - cash);
      const change = utils.round2(Math.max(0, paid - total));
      const remaining = utils.round2(Math.max(0, total - paid));
      return { total, paid, cash, nonCash, credit, change, remaining, cashDue: utils.round2(Math.max(0, total - nonCash)) };
    },
    get methodOptions() { return METHODS.filter((m) => m.key !== 'store_credit' || this.storeCredit > 0); },
    needsRef(method) { return NEEDS_REF.includes(method); },
    get cashSuggestions() {
      const due = this.pay.cashDue; if (!(due > 0)) return [];
      const out = [due];
      [500, 1000, 5000, 10000].forEach((n) => { const v = Math.ceil(due / n) * n; if (!out.includes(v)) out.push(v); });
      return out.slice(0, 5);
    },
    setCash(amount) {
      let row = this.checkout.payments.find((r) => r.method === 'cash');
      if (!row) { row = this.payRow('cash', 0); this.checkout.payments.unshift(row); }
      row.amount = utils.round2(amount);
    },
    addPayment() {
      const used = new Set(this.checkout.payments.map((r) => r.method));
      const next = this.methodOptions.find((m) => !used.has(m.key)) || METHODS[1];
      let amount = this.pay.remaining;
      if (next.key === 'store_credit') amount = Math.min(amount, this.storeCredit);
      this.checkout.payments.push(this.payRow(next.key, amount));
    },
    removePayment(r) { if (this.checkout.payments.length > 1) this.checkout.payments = this.checkout.payments.filter((x) => x.key !== r.key); },
    onMethodChange(r) {
      if (r.method === 'store_credit') r.amount = utils.round2(Math.min(num(r.amount) || this.pay.remaining || this.storeCredit, this.storeCredit));
      if (!this.needsRef(r.method)) r.reference = r.method === 'cash' ? '' : r.reference;
      r.account_id = String(defaultAccount(r.method) || '');   // each method has its own default account
    },
    get creditCheck() {
      const c = this.customer, r = this.pay.remaining;
      if (!(r > 0)) return { needed: false, ok: true };
      if (c.is_walkin) return { needed: true, ok: false, reason: 'walkin' };
      const limit = num(c.credit_limit), balance = num(c.balance), newBalance = utils.round2(balance + r);
      if (limit <= 0) return { needed: true, ok: false, reason: 'nolimit', limit, balance, newBalance };
      if (newBalance > limit) return { needed: true, ok: false, reason: 'exceeds', limit, balance, newBalance };
      return { needed: true, ok: true, limit, balance, newBalance };
    },
    get paymentErrors() {
      const errs = [];
      const rows = this.checkout.payments || [];
      if (!rows.length) errs.push('Add at least one payment.');
      rows.forEach((r, i) => {
        const a = num(r.amount);
        if (!(a > 0)) errs.push(`Payment ${i + 1}: enter an amount greater than zero.`);
        if (this.needsRef(r.method) && !String(r.reference || '').trim()) errs.push(`Payment ${i + 1}: a reference / transaction ID is required for ${ui.statusLabel(r.method)}.`);
        if (r.method === 'store_credit') { if (this.customer.is_walkin) errs.push('Store credit needs a registered customer.'); else if (a > this.storeCredit + 0.005) errs.push(`Store credit available is ${utils.money(this.storeCredit)}.`); }
        // card / wallet / transfer money must land in an open account, checked BEFORE anything is written
        if (isBank(r.method) && a > 0) {
          const accId = this.rowAccount(r), acc = accId ? db.find('bank_accounts', accId) : null;
          if (!acc) errs.push(`Payment ${i + 1}: no bank or wallet account is set up for ${ui.statusLabel(r.method)} payments at ${branch.name} — add one under Bank Accounts.`);
          else if (!acc.is_active) errs.push(`Payment ${i + 1}: ${acc.name} is closed — pick another account.`);
        }
      });
      const p = this.pay;
      if (p.change > p.cash + 0.005) errs.push(`Change ${utils.money(p.change)} exceeds cash tendered — reduce the non-cash amount.`);
      if (p.remaining > 0) {
        const cc = this.creditCheck;
        if (!this.checkout.khata) errs.push(`${utils.money(p.remaining)} is still unpaid. Add a payment or put it on the customer ledger.`);
        else if (cc.reason === 'walkin') errs.push('Credit (Khata) needs a registered customer. Select or add one.');
        else if (!cc.ok && !canOverride) errs.push(cc.reason === 'nolimit' ? `${this.customer.name} has no credit limit — a manager must approve credit.` : `Credit limit ${utils.money(cc.limit)} would be exceeded (new balance ${utils.money(cc.newBalance)}) — manager approval required.`);
      }
      return errs;
    },
    get canComplete() { return !this.checkout.busy && !this.paymentErrors.length; },
    async completeSale() {
      if (this.checkout.busy) return;
      const perrs = this.paymentErrors;
      if (perrs.length) { this.checkout.errors = perrs; ui.error(perrs[0]); return; }
      const cerrs = this.validateCart();
      if (cerrs.length) { this.checkout.errors = cerrs; ui.error(cerrs[0]); return; }
      const cc = this.creditCheck;
      if (cc.needed && !cc.ok && !this.checkout.limitOverride) {
        const ok = await ui.confirm({ title: 'Approve credit beyond limit?', message: `${this.customer.name}: balance ${utils.money(cc.balance)} → ${utils.money(cc.newBalance)} against a limit of ${utils.money(cc.limit)}. Approve this credit sale as ${this.roleLabel}?`, confirmText: 'Approve credit', danger: true });
        if (!ok) return;
        this.checkout.limitOverride = true;
      }
      this.checkout.busy = true; this.checkout.errors = [];
      try {
        const result = this.writeSale();
        this.checkout.open = false;
        this.success = { open: true, sale: result.sale, change: result.change };
        this.resetCart();
        this.refresh();
        this.refreshShift();
        this.computeToday();
        this.cartOpen = false;
        const banked = result.banked.map((b) => `${ui.statusLabel(b.method)} ${utils.money(b.amount)} → ${b.account}`).join(' · ');
        ui.success(`Sale ${result.sale.invoice_no} completed.${banked ? ' ' + banked + '.' : ''}`);
      } catch (e) {
        ui.error(e.message || 'The sale could not be completed.');
        this.refresh();
      } finally { this.checkout.busy = false; }
    },
    /** Writes sale, items (stock via ABM.stock), payments, ledger entries and audit. Validation happens before this. */
    writeSale() {
      const t = this.totals, p = this.pay, cust = this.customer;
      const due = p.remaining, paidAmount = utils.round2(t.total - due);
      // honour settings.invoice_prefix (settings.html advertises it; online-order-view.html uses it too)
      const invoice_no = db.nextNumber(String(db.setting('invoice_prefix') || 'INV').toUpperCase(), branch.code);
      const sale = db.insert('sales', {
        invoice_no, branch_id: branchId, customer_id: cust.id, user_id: user.id, sale_date: utils.now(),
        shift_id: (ABM.shift.current(user.id, branchId) || {}).id || null,   // which drawer this sale belongs to
        subtotal: t.gross, discount_type: t.invoiceDisc > 0 ? this.cart.discount_type : null, discount_value: t.invoiceDisc > 0 ? num(this.cart.discount_value) : 0,
        discount_amount: utils.round2(t.lineDisc + t.invoiceDisc), tax_rate: t.rate, tax_amount: t.tax, total: t.total, paid_amount: paidAmount, due_amount: due,
        status: 'completed', notes: String(this.cart.notes || '').trim(), repair_job_id: null,
      });
      const shares = this.invoiceShares();   // the invoice discount per line, spread like the tax below
      this.cart.lines.forEach((l) => {
        const lineTotal = this.lineTotal(l);
        const taxAmt = t.afterLine > 0 ? utils.round2(t.tax * lineTotal / t.afterLine) : 0;
        const item = db.insert('sale_items', { sale_id: sale.id, product_id: l.product_id, imei_id: l.imei_id, imei: l.imei, quantity: num(l.qty), unit_price: num(l.unit_price), unit_cost: 0, discount_amount: num(l.discount), invoice_discount_amount: shares[l.key] || 0, tax_amount: taxAmt, total: lineTotal, returned_quantity: 0, warranty_months: num(l.warranty_months) });
        let cost = 0;
        if (l.serialized) cost = stock.sellImei(l.imei_id, branchId, item.id, sale.id);
        else if (l.tracked) cost = stock.remove(branchId, l.product_id, num(l.qty), 'sale', { type: 'sale', id: sale.id });
        db.update('sale_items', item.id, { unit_cost: utils.round2(cost) });
      });
      // one sale_payments row per method (and, for card / wallet / transfer, per receiving account)
      const groups = {};
      this.checkout.payments.forEach((r) => {
        const a = num(r.amount); if (!(a > 0)) return;
        const accountId = this.rowAccount(r);
        const k = r.method + '|' + (accountId || '');
        const m = groups[k] = groups[k] || { method: r.method, accountId, amount: 0, refs: [] };
        m.amount = utils.round2(m.amount + a);
        const ref = String(r.reference || '').trim(); if (ref) m.refs.push(ref);
      });
      const cashGroup = Object.values(groups).find((m) => m.method === 'cash');
      if (p.change > 0 && cashGroup) cashGroup.amount = utils.round2(cashGroup.amount - p.change);
      const banked = [];
      let storeCreditUsed = 0;
      Object.values(groups).forEach((m) => {
        if (!(m.amount > 0)) return;
        const reference = m.refs.length ? m.refs.join(', ') : null;
        const row = db.insert('sale_payments', { sale_id: sale.id, method: m.method, amount: m.amount, reference });
        if (m.method === 'store_credit') storeCreditUsed = utils.round2(storeCreditUsed + m.amount);
        if (!isBank(m.method)) return;
        // non-cash money never sits in the drawer: it lands in the bank / wallet account now
        const txn = ABM.bank.receive(m.method, m.amount, { accountId: m.accountId, branchId, reference: reference || invoice_no, party: cust.name, notes: invoice_no, ref: { type: 'sale_payment', id: row.id } });
        if (txn) {
          db.update('sale_payments', row.id, { bank_txn_id: txn.id, account_id: txn.account_id });
          banked.push({ method: m.method, amount: m.amount, account: this.accountName(txn.account_id) });
        }
      });
      if (storeCreditUsed > 0) ledger.customer(cust.id, branchId, 'store_credit', storeCreditUsed, 0, { referenceType: 'sale', referenceId: sale.id, paymentMethod: 'store_credit', notes: `Store credit applied to ${invoice_no}` });
      if (due > 0) ledger.customer(cust.id, branchId, 'sale', due, 0, { referenceType: 'sale', referenceId: sale.id, notes: `Credit sale ${invoice_no}${this.checkout.limitOverride ? ' (credit limit override by ' + user.name + ')' : ''}` });
      const discNote = t.invoiceDisc > 0
        ? ` · invoice discount ${utils.money(t.invoiceDisc)}${this.cart.discount_type === 'percent' ? ' (' + num(this.cart.discount_value) + '%)' : ''} given by ${user.name}`
        : '';
      const approved = this.cart.lines.filter((l) => l.override).map((l) => `${l.name}${l.override_by ? ' by ' + l.override_by : ''}`);
      db.audit('sale.create', 'sale', sale.id, `Invoice ${invoice_no} · ${this.cart.lines.length} line(s) · total ${utils.money(t.total)}${discNote}${approved.length ? ' · below-minimum price approved: ' + approved.join('; ') : ''}${due > 0 ? ' · due ' + utils.money(due) + ' on ledger' : ''}${banked.length ? ' · ' + banked.map((b) => ui.statusLabel(b.method) + ' ' + utils.money(b.amount) + ' → ' + b.account).join(', ') : ''}`, branchId);
      return { sale, change: p.change, banked };
    },
    newSale() { this.success = { open: false, sale: null, change: 0 }; this.resetCart(); this.focusSearch(); },

    /* ------------------------------------------------------------- keyboard */
    get anyModalOpen() { return this.unitModal.open || this.customerModal.open || this.recallModal.open || this.checkout.open || this.success.open; },
    onKey(e) {
      if (e.key === 'F2') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (this.anyModalOpen) return;
        if (this.cartOpen && window.innerWidth < 1024) this.cartOpen = false;
        this.focusSearch(true);
      } else if (e.key === 'F9') {
        e.preventDefault(); e.stopPropagation();
        if (this.anyModalOpen) return;
        this.openCheckout();
      }
    },
    onEscape() {
      if (this.customerModal.open) this.customerModal.open = false;
      else if (this.unitModal.open) { this.unitModal.open = false; this.focusSearch(); }
      else if (this.recallModal.open) this.recallModal.open = false;
      else if (this.checkout.open) { if (!this.checkout.busy) this.checkout.open = false; }
      else if (this.success.open) this.newSale();
      else if (this.cartOpen) this.cartOpen = false;
    },
  };
};
