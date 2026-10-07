/* ==========================================================================
   Abbott Mobile - Frontend application shell
   - ABM.utils    formatting & helpers (money, dates, ids, query params)
   - ABM.db       localStorage-backed mock database seeded from data.js
   - ABM.session  login simulation, active branch, role permissions
   - ABM.nav      sidebar navigation definition (drives page shell)
   - ABM.icon()   inline SVG icons (Heroicons outline)
   - ABM.ui       toasts, confirm dialog, status badges
   - ABM.shell    injects sidebar + topbar around <main> on every page
   Load order (all deferred): data.js -> app.js -> alpinejs
   ========================================================================== */
window.ABM = (function () {
  'use strict';

  const VERSION = '1.17.0';
  // Collections the app cannot work without. A stored database missing any of them (an older build left in the
  // browser) is discarded and re-seeded automatically, so a stale tab never shows an empty shop.
  const REQUIRED_COLLECTIONS = ['branches', 'users', 'categories', 'brands', 'products', 'branch_stock', 'product_imeis', 'customers', 'suppliers', 'sales', 'sale_items', 'repair_jobs', 'online_orders', 'expenses', 'contact_messages', 'newsletter_subscribers', 'email_outbox', 'purchase_orders', 'purchase_order_items', 'stock_counts', 'stock_count_items', 'cashier_shifts', 'cash_movements', 'bank_accounts', 'bank_transactions', 'cheques', 'roles'];
  const DB_KEY = 'abm.db.v1';
  const SESSION_KEY = 'abm.session.v1';

  /* ------------------------------------------------------------------ utils */
  const settingsCache = {};
  const utils = {
    round2: (n) => Math.round((Number(n) || 0) * 100) / 100,
    num(n, decimals = 0) {
      return new Intl.NumberFormat('en-PK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(n) || 0);
    },
    money(n, opts = {}) {
      const symbol = opts.symbol === false ? '' : (db.setting('currency_symbol') || 'Rs.') + ' ';
      const decimals = opts.decimals ?? 2;
      const v = Number(n) || 0;
      const formatted = new Intl.NumberFormat('en-PK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(v));
      return (v < 0 ? '-' : '') + symbol + formatted;
    },
    pad: (n, w = 6) => String(n).padStart(w, '0'),
    parseDate(v) { if (!v) return null; if (v instanceof Date) return v; const d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v); return isNaN(d) ? null : d; },
    date(v, style = 'medium') {
      const d = utils.parseDate(v); if (!d) return '';
      if (style === 'iso') return utils.isoDate(d);
      if (style === 'short') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (style === 'long') return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    time(v) { const d = utils.parseDate(v); return d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''; },
    datetime(v) { const d = utils.parseDate(v); return d ? `${utils.date(d)} ${utils.time(d)}` : ''; },
    isoDate(d) { d = utils.parseDate(d) || new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; },
    today() { return utils.isoDate(new Date()); },
    /** Local calendar date of any stored stamp — never shifts a late-evening sale into the next/previous day. */
    dayOf(value) { const s = String(value || ''); return s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s) && s.length === 10 ? s : utils.isoDate(utils.parseDate(s)); },
    /**
     * Timestamp for stored rows. Deliberately LOCAL time with its offset
     * ("2026-09-23T01:20:00+05:00") rather than UTC: pages group records by
     * `created_at.slice(0, 10)`, and a UTC stamp would file a sale rung up after
     * midnight in Pakistan under the previous day.
     */
    now() {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`;
    },
    addDays(d, n) { const x = new Date(utils.parseDate(d) || new Date()); x.setDate(x.getDate() + n); return x; },
    timeAgo(v) {
      const d = utils.parseDate(v); if (!d) return '';
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + ' min ago';
      if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
      if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
      return utils.date(d);
    },
    escape(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    qs(name, def = null) { const v = new URLSearchParams(location.search).get(name); return v === null ? def : v; },
    sum(arr, key) { return utils.round2(arr.reduce((s, x) => s + (typeof key === 'function' ? key(x) : Number(x[key]) || 0), 0)); },
    groupBy(arr, key) { return arr.reduce((acc, x) => { const k = typeof key === 'function' ? key(x) : x[key]; (acc[k] = acc[k] || []).push(x); return acc; }, {}); },
    sortBy(arr, key, dir = 'asc') { const m = dir === 'desc' ? -1 : 1; return [...arr].sort((a, b) => { const x = typeof key === 'function' ? key(a) : a[key]; const y = typeof key === 'function' ? key(b) : b[key]; return x < y ? -m : x > y ? m : 0; }); },
    debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
    clamp: (n, a, b) => Math.min(b, Math.max(a, n)),
    initials(name) { return String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); },
    isValidImei(s) { return /^\d{15}$/.test(String(s || '').trim()); },
    /** EAN-13 check digit for a 12-digit string. */
    eanCheck(twelve) { let s = 0; for (let i = 0; i < 12; i++) s += Number(twelve[i]) * (i % 2 ? 3 : 1); return String((10 - (s % 10)) % 10); },
    /** A 12-digit code completed to a full EAN-13 (anything else is returned unchanged). */
    toEan13(code) { const c = String(code || '').trim(); return /^\d{12}$/.test(c) ? c + utils.eanCheck(c) : c; },
    /**
     * Does a scanned / typed code match a stored barcode? Exact match, or the same EAN-13 with or without
     * its check digit — printed labels always carry 13 digits, older products were stored with 12.
     */
    sameBarcode(stored, scanned) {
      const a = String(stored || '').trim().toUpperCase(), b = String(scanned || '').trim().toUpperCase();
      if (!a || !b) return false;
      if (a === b) return true;
      const pair = (x, y) => /^\d{12}$/.test(x) && /^\d{13}$/.test(y) && y.slice(0, 12) === x && utils.eanCheck(x) === y[12];
      return pair(a, b) || pair(b, a);
    },
    luhnValid(s) { s = String(s); let sum = 0; for (let i = 0; i < s.length; i++) { let d = +s[s.length - 1 - i]; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; } return sum % 10 === 0; },
    paginate(arr, page, per = 15) { const total = arr.length; const pages = Math.max(1, Math.ceil(total / per)); page = utils.clamp(page, 1, pages); return { items: arr.slice((page - 1) * per, page * per), page, pages, total, per, from: total ? (page - 1) * per + 1 : 0, to: Math.min(total, page * per) }; },
    /** Save a file. A CSV is an export, and exporting is a permission of its own (<module>.export for the page's module). */
    download(filename, content, type = 'text/csv', opts = {}) {
      if (!opts.allow && /csv/.test(type) && !utils.canExportHere()) {
        const m = roles.moduleForPage((document.body && document.body.dataset.page) || '');
        ui.error('Your role is not allowed to export ' + (m ? m.label : 'this data') + '.');
        return false;
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); return true;
    },
    /** Export permission for the module the current page belongs to (pages outside the catalogue are not restricted). */
    canExportHere() {
      const m = roles.moduleForPage((document.body && document.body.dataset.page) || '');
      return !m || !m.actions.includes('export') || session.can(m.key + '.export');
    },
    toCsv(rows, columns) { const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'; return [columns.map((c) => esc(c.label || c.key)).join(','), ...rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))].join('\n'); },
    titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); },
    /* ---- standard date ranges (used by every list/report page) ---- */
    RANGE_PRESETS: [
      { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: 'this_week', label: 'This Week' }, { key: 'last_week', label: 'Last Week' },
      { key: 'this_month', label: 'This Month' }, { key: 'last_month', label: 'Last Month' }, { key: 'all', label: 'All' }, { key: 'custom', label: 'Custom' },
    ],
    /** Resolve a preset to {from, to} ISO dates (inclusive; null = open-ended). Weeks start on Monday. */
    rangeFor(preset, custom = {}) {
      const iso = utils.isoDate, today = new Date(); today.setHours(0, 0, 0, 0);
      const startOfWeek = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; };
      const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
      switch (preset) {
        case 'today': return { from: iso(today), to: iso(today) };
        case 'yesterday': { const y = utils.addDays(today, -1); return { from: iso(y), to: iso(y) }; }
        case 'this_week': return { from: iso(startOfWeek(today)), to: iso(today) };
        case 'last_week': { const s = utils.addDays(startOfWeek(today), -7); return { from: iso(s), to: iso(utils.addDays(s, 6)) }; }
        case 'this_month': return { from: iso(startOfMonth(today)), to: iso(today) };
        case 'last_month': { const s = new Date(today.getFullYear(), today.getMonth() - 1, 1); return { from: iso(s), to: iso(endOfMonth(s)) }; }
        case 'last_7': return { from: iso(utils.addDays(today, -6)), to: iso(today) };
        case 'last_30': return { from: iso(utils.addDays(today, -29)), to: iso(today) };
        case 'custom': return { from: custom.from || null, to: custom.to || null };
        default: return { from: null, to: null };
      }
    },
    /** Is a date/datetime value inside {from, to}? (null bounds are open) */
    inRange(value, range) {
      if (!range) return true;
      const d = utils.dayOf(value);   // compare on the LOCAL calendar day, whatever the stamp's timezone
      if (!d) return false;
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      return true;
    },
    rangeLabel(range, preset) {
      const p = utils.RANGE_PRESETS.find((x) => x.key === preset);
      if (preset === 'all' || (!range.from && !range.to)) return 'All time';
      if (preset && preset !== 'custom' && p) return p.label + (range.from ? ` · ${utils.date(range.from, 'short')}${range.to && range.to !== range.from ? ' – ' + utils.date(range.to, 'short') : ''}` : '');
      return `${range.from ? utils.date(range.from) : '…'} – ${range.to ? utils.date(range.to) : '…'}`;
    },
    /** Previous period of equal length (for comparisons). */
    previousRange(range) {
      if (!range.from || !range.to) return { from: null, to: null };
      const from = utils.parseDate(range.from), to = utils.parseDate(range.to);
      const days = Math.round((to - from) / 86400000) + 1;
      return { from: utils.isoDate(utils.addDays(from, -days)), to: utils.isoDate(utils.addDays(from, -1)) };
    },
    /** Query-string helper for links that carry a range: sales.html?range=this_month or ?range=custom&from=&to= */
    rangeQuery(preset, range) { return preset === 'custom' ? `range=custom&from=${range.from || ''}&to=${range.to || ''}` : `range=${preset}`; },
  };

  /**
   * Reactive date-range state for Alpine pages. Usage inside a component:
   *   init() { this.range = ABM.range('this_month', () => this.compute(), 'sales'); this.compute(); }
   *   ...then filter with this.range.contains(row.sale_date). Markup: see FRONTEND-GUIDE §2 "Date range bar".
   * Reads ?range=&from=&to= from the URL (so dashboard links preselect) and remembers the last preset per page key.
   */
  function range(defaultPreset = 'this_month', onChange = null, storageKey = null) {
    const q = new URLSearchParams(location.search);
    let preset = q.get('range') || (storageKey ? (localStorage.getItem('abm.range.' + storageKey) || defaultPreset) : defaultPreset);
    if (!utils.RANGE_PRESETS.some((p) => p.key === preset) && !['last_7', 'last_30'].includes(preset)) preset = defaultPreset;
    const custom = { from: q.get('from') || utils.isoDate(utils.addDays(new Date(), -29)), to: q.get('to') || utils.today() };
    const r = preset === 'custom' ? utils.rangeFor('custom', custom) : utils.rangeFor(preset);
    return {
      preset, from: r.from || custom.from, to: r.to || custom.to, presets: utils.RANGE_PRESETS, onChange,
      get value() { return this.preset === 'custom' ? { from: this.from || null, to: this.to || null } : utils.rangeFor(this.preset); },
      get label() { return utils.rangeLabel(this.value, this.preset); },
      get previous() { return utils.previousRange(this.value); },
      get query() { return utils.rangeQuery(this.preset, this.value); },
      set(key) {
        this.preset = key;
        if (key !== 'custom') { const v = utils.rangeFor(key); if (v.from) { this.from = v.from; this.to = v.to; } }
        if (this.preset === 'custom' && this.from && this.to && this.from > this.to) { const t = this.from; this.from = this.to; this.to = t; }
        if (storageKey) { try { localStorage.setItem('abm.range.' + storageKey, key); } catch (e) { /* ignore */ } }
        if (typeof this.onChange === 'function') this.onChange(this.value);
      },
      contains(dateValue) { return utils.inRange(dateValue, this.value); },
      /** All ISO days in the range (for charts); falls back to the last 30 days when open-ended. */
      days() { const v = this.value; const from = v.from ? utils.parseDate(v.from) : utils.addDays(new Date(), -29); const to = v.to ? utils.parseDate(v.to) : new Date(); const out = []; for (let d = new Date(from); d <= to && out.length < 400; d.setDate(d.getDate() + 1)) out.push(utils.isoDate(d)); return out; },
    };
  }

  /* --------------------------------------------------------------------- db */
  let store = null;
  const db = {
    load() {
      if (store) return store;
      try {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) { store = JSON.parse(raw); if (store && store.__version === VERSION && db.isHealthy(store)) return store; }
      } catch (e) { /* corrupted or blocked storage: fall through to reseed */ }
      store = window.ABM_SEED ? window.ABM_SEED() : {};
      store.__version = VERSION;
      store.__seeded_at = utils.now();
      db.save();
      return store;
    },
    /** A stored database is usable only if it has every collection AND the current data shape. */
    isHealthy(s) {
      if (!s || typeof s !== 'object') return false;
      if (!REQUIRED_COLLECTIONS.every((k) => Array.isArray(s[k]))) return false;
      if (!s.products.length || !s.branches.length) return false;
      if (!s.products.some((p) => p.product_type)) return false;       // pre-universal catalogue
      if (!s.settings || !s.settings.company_name) return false;
      if (!s.cms || !s.cms.site || !s.cms.site.name || !Array.isArray(s.cms.menu)) return false; // pre-storefront
      return true;
    },
    save() {
      try { localStorage.setItem(DB_KEY, JSON.stringify(store)); db.saveFailed = false; return true; } catch (e) {
        console.warn('ABM: could not persist demo data', e);
        // a full or blocked store must never fail silently: the change lives only in this tab until it saves
        if (!db.saveFailed) { db.saveFailed = true; try { ui.error('Could not save — this browser\'s storage is full or blocked. Export a backup from Settings, then free some space.'); } catch (x) { /* ui not ready */ } }
        return false;
      }
    },
    /**
     * Another tab saved: adopt its copy. The browser delivers this between tasks, never in the middle of a
     * write here, so no half-finished operation is cut in two, and the next write builds on the other
     * tab's work instead of overwriting it.
     */
    adopt(raw) {
      if (!raw) { store = null; return true; }                  // the other tab reset the demo
      try { const next = JSON.parse(raw); if (next && next.__version === VERSION && db.isHealthy(next)) { store = next; return true; } } catch (e) { /* partial write */ }
      return false;
    },
    reset() { store = null; try { localStorage.removeItem(DB_KEY); } catch (e) { /* ignore */ } db.load(); },
    raw() { return db.load(); },
    // a missing collection starts empty; a non-array key (settings, cms) is never overwritten by a stray all() call
    all(coll) { const s = db.load(); if (!Array.isArray(s[coll])) { if (s[coll] != null) return []; s[coll] = []; } return s[coll]; },
    find(coll, id) { return db.all(coll).find((r) => String(r.id) === String(id)) || null; },
    where(coll, pred) { return db.all(coll).filter(typeof pred === 'function' ? pred : (r) => Object.keys(pred).every((k) => String(r[k]) === String(pred[k]))); },
    first(coll, pred) { return db.where(coll, pred)[0] || null; },
    count(coll, pred) { return pred ? db.where(coll, pred).length : db.all(coll).length; },
    nextId(coll) { return db.all(coll).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1; },
    insert(coll, row) { const rows = db.all(coll); const rec = { id: db.nextId(coll), created_at: utils.now(), ...row }; rows.push(rec); db.save(); return rec; },
    update(coll, id, patch) { const rec = db.find(coll, id); if (!rec) return null; Object.assign(rec, typeof patch === 'function' ? patch(rec) : patch, { updated_at: utils.now() }); db.save(); return rec; },
    remove(coll, id) { const rows = db.all(coll); const i = rows.findIndex((r) => String(r.id) === String(id)); if (i >= 0) { rows.splice(i, 1); db.save(); return true; } return false; },
    setting(key, def = null) { const s = db.load().settings || {}; return key in s ? s[key] : def; },
    setSetting(key, value) { const s = db.load(); s.settings = s.settings || {}; s.settings[key] = value; db.save(); },
    settings() { return db.load().settings || {}; },
    /** Next document number, e.g. nextNumber('INV', 'MB') -> INV-MB-000042 (mirrors the backend `sequences` table). */
    /** Document prefixes Settings → Document numbering may rename (invoices and job cards have their own settings). */
    DOC_PREFIXES: { PUR: 'Purchases', PO: 'Purchase orders', TRF: 'Stock transfers', RET: 'Sale returns', SRT: 'Supplier returns', CNT: 'Stock takes', SFT: 'Cashier shifts', RQ: 'Repair requests', MSG: 'Website messages' },
    nextNumber(prefix, branchCode) {
      const s = db.load(); s.__sequences = s.__sequences || {};
      // a renamed prefix starts its own sequence; earlier documents keep the number they were given
      const renamed = ((s.settings && s.settings.doc_prefixes) || {})[prefix];
      if (renamed && /^[A-Z0-9]{1,8}$/i.test(renamed)) prefix = String(renamed).toUpperCase();
      const key = `${prefix}-${branchCode}`;
      if (!s.__sequences[key]) {
        // derive from existing documents so demo data and new docs never collide
        const re = new RegExp('^' + key + '-(\\d+)$');
        let max = 0;
        ['sales', 'purchases', 'purchase_orders', 'stock_transfers', 'sale_returns', 'supplier_returns', 'stock_counts', 'cashier_shifts', 'repair_jobs', 'online_orders'].forEach((c) => (s[c] || []).forEach((r) => { const m = String(r.invoice_no || r.purchase_no || r.po_no || r.transfer_no || r.return_no || r.count_no || r.shift_no || r.job_no || r.order_no || '').match(re); if (m) max = Math.max(max, +m[1]); }));
        s.__sequences[key] = max;
      }
      s.__sequences[key] += 1; db.save();
      return `${key}-${utils.pad(s.__sequences[key])}`;
    },
    /**
     * Write an audit row. `branchId` defaults to the branch the user is working in, but pass the
     * branch that OWNS the record when a super admin acts on another branch's document — otherwise
     * that branch's own audit log never shows what happened to it.
     */
    audit(action, entityType, entityId, details, branchId) {
      const u = session.user();
      db.insert('audit_logs', { user_id: u ? u.id : null, branch_id: branchId != null ? Number(branchId) : session.branchId(), action, entity_type: entityType, entity_id: entityId ?? null, details: details || '', ip: '127.0.0.1' });
    },
    /**
     * Price history: one price_history row per changed price field (cost, retail, wholesale, minimum), so a
     * product's prices can be traced over time. Call with the product BEFORE and the patch AFTER a change;
     * source says where it came from ('product_edit', 'bulk_edit', 'purchase', 'import').
     */
    PRICE_FIELDS: ['cost_price', 'retail_price', 'wholesale_price', 'min_sale_price'],
    recordPrices(before, after, source, ref) {
      if (!before || !after) return [];
      const out = [];
      db.PRICE_FIELDS.forEach((f) => {
        if (!(f in after)) return;
        const o = utils.round2(before[f]), n = utils.round2(after[f]);
        if (o === n) return;
        out.push(db.insert('price_history', { product_id: before.id, field: f, old_value: o, new_value: n, source: source || 'product_edit', reference_type: (ref && ref.type) || null, reference_id: (ref && ref.id) || null, user_id: (session.user() || {}).id || null }));
      });
      return out;
    },
    // convenience lookups used all over the UI
    product(id) { return db.find('products', id); },
    productLabel(id) { const p = db.find('products', id); if (!p) return '—'; return [p.name, p.variant, p.color].filter(Boolean).join(' · '); },
    branch(id) { return db.find('branches', id); },
    branchName(id) { const b = db.find('branches', id); return b ? b.name : '—'; },
    branchCode(id) { const b = db.find('branches', id); return b ? b.code : '—'; },
    customer(id) { return db.find('customers', id); },
    customerName(id) { const c = db.find('customers', id); return c ? c.name : 'Walk-in Customer'; },
    supplierName(id) { const s = db.find('suppliers', id); return s ? s.name : '—'; },
    userName(id) { const u = db.find('users', id); return u ? u.name : '—'; },
    categoryName(id) { const c = db.find('categories', id); return c ? c.name : '—'; },
    brandName(id) { const b = db.find('brands', id); return b ? b.name : '—'; },
    stockQty(branchId, productId) { const r = db.first('branch_stock', (s) => s.branch_id == branchId && s.product_id == productId); return r ? r.quantity : 0; },
    /** Universal catalog helpers (mobile / laptop / parts / services). */
    isSerialized(p) { p = typeof p === 'object' ? p : db.find('products', p); return !!(p && (p.is_serialized || p.is_imei_tracked)); },
    serialType(p) { p = typeof p === 'object' ? p : db.find('products', p); if (!p) return 'imei'; return p.serial_type || (['laptop', 'desktop'].includes(p.device_type) ? 'serial' : 'imei'); },
    serialLabel(p) { return db.serialType(p) === 'serial' ? 'Serial No.' : 'IMEI'; },
    isStockTracked(p) { p = typeof p === 'object' ? p : db.find('products', p); return !!p && p.is_stock_tracked !== 0 && p.product_type !== 'service'; },
    productType(p) { p = typeof p === 'object' ? p : db.find('products', p); return p ? (p.product_type || (db.isSerialized(p) ? 'device' : 'accessory')) : 'accessory'; },
    deviceTypeLabel(t) { return ({ mobile: 'Mobile Phone', tablet: 'Tablet', smartwatch: 'Smartwatch', laptop: 'Laptop', desktop: 'Desktop / AIO' })[t] || utils.titleCase(t || ''); },
    productTypeLabel(t) { return ({ device: 'Device', accessory: 'Accessory', part: 'Spare Part', service: 'Service / Labor' })[t] || utils.titleCase(t || ''); },
    specLabel(key) { return ({ processor: 'Processor', generation: 'Generation', ram: 'RAM', storage: 'Storage', screen: 'Screen', os: 'Operating System', battery_health: 'Battery Health', graphics: 'Graphics', camera: 'Camera', battery: 'Battery', connectivity: 'Connectivity', ports: 'Ports', weight: 'Weight' })[key] || utils.titleCase(key); },
    SPEC_KEYS: { mobile: ['ram', 'storage', 'screen', 'os', 'camera', 'battery'], tablet: ['ram', 'storage', 'screen', 'os', 'connectivity'], smartwatch: ['screen', 'connectivity', 'battery'], laptop: ['processor', 'generation', 'ram', 'storage', 'screen', 'graphics', 'os', 'battery_health', 'ports'], desktop: ['processor', 'generation', 'ram', 'storage', 'graphics', 'os'] },
    technicians(branchId) { return roles.technicians(branchId); },
    /** Website CMS document (site settings, theme, home content). */
    cms() { const s = db.load(); if (!s.cms) { s.cms = { site: {}, pages: [], menu: [], banners: [], testimonials: [] }; } return s.cms; },
    /** Merge a patch into the CMS document. `site` is deep-merged one level (so a partial {commerce:{…}} keeps the rest); arrays replace. */
    saveCms(patch) {
      const s = db.load(); const cms = db.cms(); patch = patch || {};
      if (patch.site) {
        const site = Object.assign({}, cms.site);
        Object.keys(patch.site).forEach((k) => {
          const a = site[k], b = patch.site[k];
          site[k] = (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) ? Object.assign({}, a, b) : b;
        });
        cms.site = site;
      }
      Object.keys(patch).forEach((k) => { if (k !== 'site') cms[k] = patch[k]; });
      s.cms = cms; db.save(); return cms;
    },
  };

  /* ------------------------------------------------------------------- bank
   * Bank accounts, their statement and the cheque register. Cash that leaves a drawer for the bank
   * has to land somewhere: every deposit, withdrawal, transfer, cleared cheque and bank charge is a
   * `bank_transactions` row, and the account balance is only ever moved by `bank.post()`.
   *
   * A cheque is a promise, not money: issuing one records a liability and only CLEARING it moves the
   * bank balance. A bounced cheque we received puts the amount back on the customer's ledger.
   */
  const bank = {
    TYPES: ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'payment', 'receipt', 'charges', 'interest', 'opening'],
    /** Signed direction of each transaction type: +1 money in, -1 money out. */
    sign(type) { return ['deposit', 'transfer_in', 'receipt', 'interest', 'opening'].includes(type) ? 1 : -1; },
    accounts(branchId) {
      return db.all('bank_accounts').filter((a) => branchId == null || a.branch_id == null || String(a.branch_id) === String(branchId));
    },
    account(id) { return db.find('bank_accounts', id); },
    balance(accountId) { const a = db.find('bank_accounts', accountId); return a ? utils.round2(a.balance) : 0; },
    /** Total money in the bank, optionally for one branch (shared accounts count everywhere). */
    total(branchId) { return utils.round2(bank.accounts(branchId).filter((a) => a.is_active).reduce((s, a) => s + (Number(a.balance) || 0), 0)); },
    /**
     * The only way an account balance changes. `amount` is always positive — the type decides
     * the direction. Returns the transaction row.
     */
    post(accountId, opts) {
      const acc = db.find('bank_accounts', accountId);
      if (!acc) throw new Error('Bank account not found.');
      if (!acc.is_active) throw new Error(`${acc.name} is closed — reopen it before posting to it.`);
      const type = String(opts.type || '');
      if (!bank.TYPES.includes(type)) throw new Error('Unknown bank transaction type.');
      const amount = utils.round2(opts.amount);
      if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
      const sign = bank.sign(type);
      const after = utils.round2((Number(acc.balance) || 0) + sign * amount);
      // opts.allowOverdraft: undoing money that really arrived (a voided sale's card receipt) must not be blocked
      if (after < 0 && !db.setting('allow_bank_overdraft') && !opts.allowOverdraft) {
        throw new Error(`${acc.name} only holds ${utils.money(acc.balance)} — that would overdraw it.`);
      }
      const row = db.insert('bank_transactions', {
        account_id: acc.id, branch_id: opts.branchId != null ? Number(opts.branchId) : (acc.branch_id || session.branchId()),
        txn_date: opts.date || utils.today(), type, amount, signed: utils.round2(sign * amount), balance_after: after,
        method: opts.method || (type === 'deposit' || type === 'withdrawal' ? 'cash' : 'online'),
        reference: String(opts.reference || '').trim(), cheque_id: opts.chequeId || null,
        reference_type: (opts.ref && opts.ref.type) || null, reference_id: (opts.ref && opts.ref.id) || null,
        party: String(opts.party || '').trim(), notes: String(opts.notes || '').trim(),
        reconciled: 0, reconciled_at: null, created_by: (session.user() || {}).id || null,
      });
      db.update('bank_accounts', acc.id, { balance: after });
      return row;
    },
    deposit(accountId, amount, opts) { return bank.post(accountId, Object.assign({ type: 'deposit', amount, method: 'cash' }, opts || {})); },
    withdraw(accountId, amount, opts) { return bank.post(accountId, Object.assign({ type: 'withdrawal', amount, method: 'cash' }, opts || {})); },
    /** Move money between two of our own accounts — one row on each side, same reference. */
    transfer(fromId, toId, amount, opts) {
      if (String(fromId) === String(toId)) throw new Error('Pick two different accounts.');
      const from = db.find('bank_accounts', fromId), to = db.find('bank_accounts', toId);
      if (!from || !to) throw new Error('Bank account not found.');
      const o = opts || {};
      const out = bank.post(fromId, { type: 'transfer_out', amount, method: 'online', date: o.date, reference: o.reference, notes: o.notes, party: to.name });
      const into = bank.post(toId, { type: 'transfer_in', amount, method: 'online', date: o.date, reference: o.reference, notes: o.notes, party: from.name, ref: { type: 'bank_transaction', id: out.id } });
      db.update('bank_transactions', out.id, { reference_type: 'bank_transaction', reference_id: into.id });
      return { out, into };
    },
    /* ---------------------------------------------- money that is not cash
     * Card, JazzCash, EasyPaisa and bank-transfer money never sits in a cash drawer: it lands in (or leaves)
     * a bank or wallet account. Every screen that takes or pays such money calls bank.receive / bank.pay and
     * keeps the returned row's id as `bank_txn_id` on its own record (sale_payments, customer_transactions,
     * repair_payments, supplier_transactions, expenses, sale_returns …), so voiding the document can undo it
     * with bank.undo(). Cash, store credit, khata and cheques never go through here — cheques settle
     * through the cheque register when they clear.
     */
    NON_CASH: ['card', 'jazzcash', 'easypaisa', 'bank_transfer'],
    isNonCash(method) { return bank.NON_CASH.includes(String(method || '')); },
    /**
     * The account a payment method settles into at a branch: the choice saved on Banking → "Where card &
     * wallet money lands" (settings.payment_accounts[branchId][method], or [all] for every branch), else a
     * wallet account named after JazzCash / EasyPaisa, else the branch's own current account.
     */
    accountFor(method, branchId) {
      const map = db.setting('payment_accounts') || {};
      const live = (id) => { const a = id ? db.find('bank_accounts', id) : null; return a && a.is_active ? a : null; };
      const chosen = live((map[String(branchId)] || {})[method]) || live((map.all || {})[method]);
      if (chosen) return chosen.id;
      const open = bank.accounts(branchId).filter((a) => a.is_active);
      if (method === 'jazzcash' || method === 'easypaisa') {
        const re = method === 'jazzcash' ? /jazz/i : /easy/i;
        const w = open.find((a) => a.account_type === 'wallet' && re.test(a.name + ' ' + (a.bank_name || '')));
        if (w) return w.id;
      }
      const own = open.find((a) => String(a.branch_id) === String(branchId) && a.account_type !== 'wallet' && a.account_type !== 'savings')
        || open.find((a) => a.account_type === 'current') || open.find((a) => a.account_type !== 'wallet');
      return own ? own.id : null;
    },
    /**
     * Non-cash money received. Returns the bank row, or null for cash / store credit / khata / cheque.
     * opts: { accountId?, branchId, date?, reference, party, notes, ref: {type, id} }
     */
    receive(method, amount, opts) {
      if (!bank.isNonCash(method) || !(utils.round2(amount) > 0)) return null;
      const o = opts || {};
      const accountId = o.accountId || bank.accountFor(method, o.branchId != null ? o.branchId : session.branchId());
      if (!accountId) throw new Error('No bank or wallet account is set up to receive ' + ui.statusLabel(method) + ' payments — add one under Bank Accounts.');
      return bank.post(accountId, { type: 'receipt', amount, method, date: o.date, reference: o.reference, party: o.party, notes: o.notes, ref: o.ref, branchId: o.branchId });
    },
    /** Non-cash money paid out (bank transfer, card, wallet). Throws when the account cannot cover it. */
    pay(method, amount, opts) {
      if (!bank.isNonCash(method) || !(utils.round2(amount) > 0)) return null;
      const o = opts || {};
      const accountId = o.accountId || bank.accountFor(method, o.branchId != null ? o.branchId : session.branchId());
      if (!accountId) throw new Error('Choose the bank account this payment leaves from.');
      return bank.post(accountId, { type: 'payment', amount, method, date: o.date, reference: o.reference, party: o.party, notes: o.notes, ref: o.ref, branchId: o.branchId });
    },
    /** Undo the bank side of a document being voided or cancelled. No-op when it never reached a bank. */
    undo(txnId, reason) {
      if (!txnId) return null;
      const t = db.find('bank_transactions', txnId);
      if (!t || t.reversed_by) return null;
      return bank.reverse(t.id, reason, { allowOverdraft: true });
    },
    /** Undo a transaction (a mis-keyed entry): reverses the balance and keeps both rows for the trail. */
    reverse(txnId, reason, opts) {
      const t = db.find('bank_transactions', txnId);
      if (!t) throw new Error('Transaction not found.');
      if (t.reversed_by) throw new Error('This entry has already been reversed.');
      if (t.type === 'opening') throw new Error('The opening balance cannot be reversed — edit the account instead.');
      const opposite = { deposit: 'withdrawal', withdrawal: 'deposit', transfer_in: 'transfer_out', transfer_out: 'transfer_in', payment: 'receipt', receipt: 'payment', charges: 'interest', interest: 'charges' }[t.type];
      const row = bank.post(t.account_id, {
        type: opposite, amount: t.amount, date: utils.today(), method: t.method,
        reference: t.reference, party: t.party, notes: 'Reversal of ' + utils.date(t.txn_date) + (reason ? ' · ' + reason : ''),
        ref: { type: 'bank_transaction', id: t.id }, allowOverdraft: !!(opts && opts.allowOverdraft),
      });
      db.update('bank_transactions', t.id, { reversed_by: row.id });
      return row;
    },
    /* ------------------------------------------------------------- cheques */
    cheque: {
      STATUSES: ['pending', 'deposited', 'cleared', 'bounced', 'cancelled'],
      /** A cheque we wrote. The bank balance does not move until it clears. */
      issue(data) {
        const acc = db.find('bank_accounts', data.account_id);
        if (!acc) throw new Error('Choose the account the cheque is drawn on.');
        const amount = utils.round2(data.amount);
        if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
        const no = String(data.cheque_no || '').trim();
        if (!no) throw new Error('Enter the cheque number.');
        if (db.all('cheques').some((c) => c.direction === 'issued' && String(c.account_id) === String(acc.id) && String(c.cheque_no).toUpperCase() === no.toUpperCase() && c.status !== 'cancelled')) {
          throw new Error(`Cheque ${no} is already recorded on ${acc.name}.`);
        }
        const row = db.insert('cheques', {
          cheque_no: no, direction: 'issued', account_id: acc.id, bank_name: acc.bank_name,
          party_type: data.party_type || 'supplier', party_id: data.party_id || null, party_name: String(data.party_name || '').trim(),
          amount, issue_date: data.issue_date || utils.today(), due_date: data.due_date || data.issue_date || utils.today(),
          status: 'pending', deposited_at: null, cleared_at: null, bounced_reason: '',
          branch_id: data.branch_id != null ? Number(data.branch_id) : session.branchId(),
          reference_type: (data.ref && data.ref.type) || null, reference_id: (data.ref && data.ref.id) || null,
          notes: String(data.notes || '').trim(), created_by: (session.user() || {}).id || null,
        });
        // data.postLedger: this cheque IS the supplier payment — record it on their account now, linked, so a
        // bounce or cancel undoes exactly this and nothing else. Without it the cheque never touches a ledger.
        if (data.postLedger && row.party_type === 'supplier' && row.party_id) {
          const t = ledger.supplier(row.party_id, row.branch_id, 'payment', amount, 0, {
            referenceType: data.ledgerRef ? data.ledgerRef.type : 'cheque', referenceId: data.ledgerRef ? data.ledgerRef.id : row.id,
            paymentMethod: 'cheque', paymentReference: no, chequeId: row.id, notes: data.ledgerNotes || `Cheque ${no} on ${acc.name}`,
          });
          db.update('cheques', row.id, { ledger_txn_id: t.id });
        }
        db.audit('cheque.issue', 'cheque', row.id, `Cheque ${no} for ${utils.money(amount)} issued to ${row.party_name} on ${acc.name}`, row.branch_id);
        return db.find('cheques', row.id);
      },
      /** A cheque a customer gave us. It is not money until it clears either. */
      receive(data) {
        const amount = utils.round2(data.amount);
        if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
        if (!String(data.cheque_no || '').trim()) throw new Error('Enter the cheque number.');
        const row = db.insert('cheques', {
          cheque_no: String(data.cheque_no).trim(), direction: 'received', account_id: data.account_id || null,
          bank_name: String(data.bank_name || '').trim(),
          party_type: data.party_type || 'customer', party_id: data.party_id || null, party_name: String(data.party_name || '').trim(),
          amount, issue_date: data.issue_date || utils.today(), due_date: data.due_date || data.issue_date || utils.today(),
          status: 'pending', deposited_at: null, cleared_at: null, bounced_reason: '',
          branch_id: data.branch_id != null ? Number(data.branch_id) : session.branchId(),
          reference_type: (data.ref && data.ref.type) || null, reference_id: (data.ref && data.ref.id) || null,
          notes: String(data.notes || '').trim(), created_by: (session.user() || {}).id || null,
        });
        // data.postLedger: the customer paid their khata with this cheque — credit it now, linked to the cheque
        if (data.postLedger && row.party_type === 'customer' && row.party_id) {
          const t = ledger.customer(row.party_id, row.branch_id, 'payment', 0, amount, {
            referenceType: data.ledgerRef ? data.ledgerRef.type : 'cheque', referenceId: data.ledgerRef ? data.ledgerRef.id : row.id,
            paymentMethod: 'cheque', paymentReference: row.cheque_no, chequeId: row.id, notes: data.ledgerNotes || `Cheque ${row.cheque_no}${row.bank_name ? ' · ' + row.bank_name : ''}`,
          });
          db.update('cheques', row.id, { ledger_txn_id: t.id });
        }
        db.audit('cheque.receive', 'cheque', row.id, `Cheque ${row.cheque_no} for ${utils.money(amount)} received from ${row.party_name}`, row.branch_id);
        return db.find('cheques', row.id);
      },
      /** Hand a received cheque to the bank: still not cleared, but now it is with them. */
      deposit(chequeId, accountId) {
        const c = db.find('cheques', chequeId);
        if (!c) throw new Error('Cheque not found.');
        if (c.direction !== 'received') throw new Error('Only a cheque we received can be deposited.');
        if (c.status !== 'pending') throw new Error(`This cheque is ${ui.statusLabel(c.status).toLowerCase()}.`);
        const acc = db.find('bank_accounts', accountId);
        if (!acc) throw new Error('Choose the account to deposit it into.');
        db.update('cheques', c.id, { status: 'deposited', account_id: acc.id, deposited_at: utils.now() });
        db.audit('cheque.deposit', 'cheque', c.id, `Cheque ${c.cheque_no} (${utils.money(c.amount)}) deposited into ${acc.name}`, c.branch_id);
        return db.find('cheques', c.id);
      },
      /** The money actually moved: now the bank balance changes. */
      clear(chequeId, opts) {
        const c = db.find('cheques', chequeId);
        if (!c) throw new Error('Cheque not found.');
        if (['cleared', 'cancelled'].includes(c.status)) throw new Error(`This cheque is already ${ui.statusLabel(c.status).toLowerCase()}.`);
        const o = opts || {};
        const accountId = o.accountId || c.account_id;
        if (!accountId) throw new Error('Which account did it clear through?');
        const txn = bank.post(accountId, {
          type: c.direction === 'issued' ? 'payment' : 'receipt', amount: c.amount, date: o.date || utils.today(),
          method: 'cheque', reference: c.cheque_no, party: c.party_name, chequeId: c.id,
          ref: { type: 'cheque', id: c.id }, notes: o.notes || '', branchId: c.branch_id,
        });
        db.update('cheques', c.id, { status: 'cleared', cleared_at: utils.now(), account_id: accountId, bounced_reason: '' });
        db.audit('cheque.clear', 'cheque', c.id, `Cheque ${c.cheque_no} (${utils.money(c.amount)}) cleared ${c.direction === 'issued' ? 'against' : 'into'} ${db.find('bank_accounts', accountId).name}`, c.branch_id);
        return { cheque: db.find('cheques', c.id), transaction: txn };
      },
      /**
       * It bounced. A cheque we received was never money, so whatever it settled goes back on the
       * customer's ledger; a cheque we wrote simply stays unpaid.
       */
      bounce(chequeId, reason, opts) {
        const c = db.find('cheques', chequeId);
        if (!c) throw new Error('Cheque not found.');
        if (c.status === 'cancelled') throw new Error('A cancelled cheque cannot bounce.');
        if (c.status === 'bounced') throw new Error('This cheque is already marked as bounced.');
        const o = opts || {};
        if (c.status === 'cleared') {                          // it had cleared: take the money back out
          bank.post(c.account_id, {
            type: c.direction === 'issued' ? 'receipt' : 'payment', amount: c.amount, date: o.date || utils.today(),
            method: 'cheque', reference: c.cheque_no, party: c.party_name, chequeId: c.id,
            ref: { type: 'cheque', id: c.id }, notes: 'Cheque returned: ' + (reason || 'bounced'), branchId: c.branch_id,
          });
        }
        db.update('cheques', c.id, { status: 'bounced', bounced_reason: String(reason || '').trim() || 'Returned by the bank', cleared_at: null });
        bank.cheque.unsettle(c, `bounced${reason ? ': ' + reason : ''}`);
        db.audit('cheque.bounce', 'cheque', c.id, `Cheque ${c.cheque_no} (${utils.money(c.amount)}) bounced: ${reason || 'returned'}`, c.branch_id);
        return db.find('cheques', c.id);
      },
      cancel(chequeId, reason) {
        const c = db.find('cheques', chequeId);
        if (!c) throw new Error('Cheque not found.');
        if (c.status === 'cleared') throw new Error('A cleared cheque cannot be cancelled — reverse it instead.');
        if (c.status === 'cancelled') throw new Error('This cheque is already cancelled.');
        db.update('cheques', c.id, { status: 'cancelled', notes: [c.notes, reason].filter(Boolean).join(' · ') });
        bank.cheque.unsettle(c, `cancelled${reason ? ': ' + reason : ''}`);   // idempotent: a bounce already undid it
        db.audit('cheque.cancel', 'cheque', c.id, `Cheque ${c.cheque_no} cancelled${reason ? ': ' + reason : ''}`, c.branch_id);
        return db.find('cheques', c.id);
      },
      /**
       * The payment a cheque stood for did not happen: put back exactly the ledger entry it made (only a
       * cheque recorded with postLedger has one). A cheque that never touched a ledger changes no balance.
       */
      unsettle(c, why) {
        if (!c.ledger_txn_id || c.ledger_reversal_id) return null;
        let t = null;
        if (c.direction === 'received' && c.party_type === 'customer' && c.party_id) {
          t = ledger.customer(c.party_id, c.branch_id, 'adjustment', c.amount, 0, {
            referenceType: 'cheque', referenceId: c.id, chequeId: c.id,
            notes: `Cheque ${c.cheque_no} ${why} — amount owed again`,
          });
        } else if (c.direction === 'issued' && c.party_type === 'supplier' && c.party_id) {
          t = ledger.supplier(c.party_id, c.branch_id, 'adjustment', 0, c.amount, {
            referenceType: 'cheque', referenceId: c.id, chequeId: c.id,
            notes: `Our cheque ${c.cheque_no} ${why} — still payable`,
          });
        }
        if (t) db.update('cheques', c.id, { ledger_reversal_id: t.id });
        return t;
      },
      /** Cheques that need attention: due today or earlier and still not cleared. */
      due(branchId, onDate) {
        const day = onDate || utils.today();
        return db.all('cheques').filter((c) => ['pending', 'deposited'].includes(c.status)
          && (branchId == null || String(c.branch_id) === String(branchId))
          && String(c.due_date || '') <= day);
      },
    },
  };

  /* ------------------------------------------------------------ cashier shift
   * A shift is one cashier's session at one drawer: opened with a float, closed by counting the
   * cash. Everything a shift is accountable for is derived from the records themselves — the cash
   * that user took or paid out at that branch between opening and closing — so nothing can drift
   * out of step with sales, refunds, expenses or the day-end Z-report. `cash_movements` covers the
   * money that never passes through a document: petty pay-outs, top-ups and bank drops.
   */
  const shift = {
    MOVEMENTS: ['pay_in', 'pay_out', 'bank_drop'],
    all(branchId) { return db.all('cashier_shifts').filter((s) => branchId == null || String(s.branch_id) === String(branchId)); },
    /** The open shift for a cashier at a branch, or null. A user can only have one at a time. */
    current(userId, branchId) {
      return db.all('cashier_shifts').find((s) => s.status === 'open' && String(s.user_id) === String(userId)
        && (branchId == null || String(s.branch_id) === String(branchId))) || null;
    },
    openAt(branchId) { return db.all('cashier_shifts').filter((s) => s.status === 'open' && String(s.branch_id) === String(branchId)); },
    /** What the next drawer should start with: what the last closed shift handed over, else the branch float. */
    suggestedFloat(branchId) {
      const last = utils.sortBy(db.all('cashier_shifts').filter((s) => String(s.branch_id) === String(branchId) && s.status === 'closed'), 'closed_at', 'desc')[0];
      if (last && Number(last.handover_amount) > 0) return utils.round2(last.handover_amount);
      return Number(db.setting('cash_float')) || 0;
    },
    open(opts) {
      const branchId = Number(opts.branchId), userId = Number(opts.userId);
      const user = db.find('users', userId);
      if (!user) throw new Error('Cashier not found.');
      if (!db.find('branches', branchId)) throw new Error('Branch not found.');
      if (shift.current(userId, null)) throw new Error(`${user.name} already has an open shift — close it before starting another.`);
      const float = utils.round2(opts.float);
      if (!(float >= 0)) throw new Error('Opening float must be zero or more.');
      const row = db.insert('cashier_shifts', {
        shift_no: db.nextNumber('SFT', db.branchCode(branchId)), branch_id: branchId, user_id: userId,
        status: 'open', opened_at: utils.now(), opened_by: (session.user() || {}).id || userId, closed_at: null, closed_by: null,
        opening_float: float, counted_cash: null, expected_cash: null, variance: null, denominations: null,
        handover_to: null, handover_amount: 0, banked_amount: 0, notes: String(opts.notes || '').trim(), totals: null,
      });
      db.audit('shift.open', 'cashier_shift', row.id, `Shift ${row.shift_no} opened for ${user.name} at ${db.branchName(branchId)} with ${utils.money(float)} float`, branchId);
      return row;
    },
    /** Cash in or out of the drawer that no other document records. */
    movement(shiftId, type, amount, reason, ref) {
      const s = db.find('cashier_shifts', shiftId);
      if (!s) throw new Error('Shift not found.');
      if (s.status !== 'open') throw new Error('This shift is closed — cash can no longer be recorded against it.');
      if (!shift.MOVEMENTS.includes(type)) throw new Error('Unknown cash movement.');
      const amt = utils.round2(amount);
      if (!(amt > 0)) throw new Error('Enter an amount greater than zero.');
      if (type !== 'pay_in') {
        const live = shift.tally(s);
        if (amt > live.expected + 0.005) throw new Error(`Only ${utils.money(live.expected)} is in the drawer.`);
      }
      // A bank drop is cash leaving the drawer FOR a bank account: it has to arrive there too.
      const accountId = type === 'bank_drop' ? (ref && ref.accountId) : null;
      if (type === 'bank_drop' && accountId) {
        const acc = db.find('bank_accounts', accountId);
        if (!acc || !acc.is_active) throw new Error('Choose an open bank account for the bank drop.');
      }
      const row = db.insert('cash_movements', {
        shift_id: s.id, branch_id: s.branch_id, type, amount: amt,
        reason: String(reason || '').trim(), reference: (ref && ref.reference) || '', created_by: (session.user() || {}).id || s.user_id,
      });
      if (accountId) {
        const txn = bank.deposit(accountId, amt, {
          reference: (ref && ref.reference) || s.shift_no, notes: 'Bank drop from ' + s.shift_no + (reason ? ' · ' + reason : ''),
          ref: { type: 'cash_movement', id: row.id }, branchId: s.branch_id,
        });
        db.update('cash_movements', row.id, { bank_txn_id: txn.id, account_id: Number(accountId) });
      }
      db.audit('shift.cash', 'cashier_shift', s.id, `${ui.statusLabel(type)} ${utils.money(amt)} on ${s.shift_no}${reason ? ': ' + reason : ''}${accountId ? ' → ' + db.find('bank_accounts', accountId).name : ''}`, s.branch_id);
      return db.find('cash_movements', row.id);
    },
    /**
     * Live cash position of a shift, built from the records it is accountable for.
     * Returns { lines[], expected, movements[] } — the same shape whether the shift is open or closed.
     */
    tally(shiftOrId) {
      const s = typeof shiftOrId === 'object' ? shiftOrId : db.find('cashier_shifts', shiftOrId);
      if (!s) return { lines: [], expected: 0, movements: [] };
      const from = s.opened_at, to = s.closed_at || utils.now();
      const mine = (stamp, userId) => stamp >= from && stamp <= to && String(userId) === String(s.user_id);
      const inBranch = (bid) => String(bid) === String(s.branch_id);

      const sales = db.all('sales').filter((x) => x.status !== 'void' && inBranch(x.branch_id));
      const saleById = new Map(sales.map((x) => [String(x.id), x]));
      // A sale rung up at POS carries the drawer it belongs to, which settles the case of two shifts
      // sharing a boundary second. Older sales (no shift_id) fall back to who took the money and when.
      // `shift_id: null` means POS rang it up with no drawer open — it belongs to no shift, ever.
      // Only a sale from before shifts existed (no such field) falls back to who took the money and when.
      const ownsSale = (sale, stamp) => ('shift_id' in sale ? String(sale.shift_id) === String(s.id) : mine(stamp, sale.user_id));
      const cashSales = db.all('sale_payments').map((p) => ({ p, s: saleById.get(String(p.sale_id)) }))
        .filter((x) => x.s && x.p.method === 'cash' && ownsSale(x.s, x.p.created_at || x.s.sale_date))
        .map((x) => ({ id: 'p' + x.p.id, label: x.s.invoice_no, sub: db.customerName(x.s.customer_id), at: x.p.created_at || x.s.sale_date, amount: Number(x.p.amount) || 0, href: 'sale-view.html?id=' + x.s.id }));

      const ctx = db.all('customer_transactions').filter((t) => inBranch(t.branch_id) && mine(t.created_at, t.created_by));
      // a credit that mirrors a sale payment is already counted above as that sale's cash
      const received = ctx.filter((t) => t.type === 'payment' && t.payment_method === 'cash' && Number(t.credit) > 0 && !ledger.mirrorsSalePayment(t))
        .map((t) => ({ id: 'c' + t.id, label: db.customerName(t.customer_id), sub: t.notes || 'Khata payment', at: t.created_at, amount: Number(t.credit) || 0, href: 'customer-view.html?id=' + t.customer_id }));

      // repair money: payments in, refunds (kind 'refund', incl. a voided payment's reversal) out; a payment
      // stamped with a drawer belongs to that drawer, an older one to whoever took it and when
      const jobs = new Map(db.all('repair_jobs').filter((j) => inBranch(j.branch_id)).map((j) => [String(j.id), j]));
      const ownsRepair = (p) => ('shift_id' in p && p.shift_id != null ? String(p.shift_id) === String(s.id) : mine(p.created_at, p.created_by));
      const repairRows = db.all('repair_payments').map((p) => ({ p, j: jobs.get(String(p.job_id)) }))
        .filter((x) => x.j && x.p.method === 'cash' && ownsRepair(x.p))
        .map((x) => ({ kind: x.p.kind, id: 'r' + x.p.id, label: x.j.job_no, sub: db.customerName(x.j.customer_id) + (x.p.kind === 'refund' ? ' · refund' : ''), at: x.p.created_at, amount: Number(x.p.amount) || 0, href: 'repair-view.html?id=' + x.j.id }));
      const repairs = repairRows.filter((r) => r.kind !== 'refund');
      const repairRefunds = repairRows.filter((r) => r.kind === 'refund');

      const refunds = db.all('sale_returns').filter((r) => inBranch(r.branch_id) && r.refund_method === 'cash' && mine(r.created_at || r.return_date, r.user_id))
        .map((r) => ({ id: 'ret' + r.id, label: r.return_no, sub: db.customerName(r.customer_id), at: r.created_at || r.return_date, amount: Number(r.refund_amount) || 0, href: 'sale-view.html?id=' + r.sale_id }));

      const expenses = db.all('expenses').filter((e) => inBranch(e.branch_id) && e.payment_method === 'cash' && mine(e.created_at, e.created_by))
        .map((e) => ({ id: 'e' + e.id, label: db.find('expense_categories', e.category_id) ? db.find('expense_categories', e.category_id).name : 'Expense', sub: e.description || '', at: e.created_at, amount: Number(e.amount) || 0, href: 'expenses.html' }));

      const supplier = db.all('supplier_transactions').filter((t) => inBranch(t.branch_id) && t.type === 'payment' && t.payment_method === 'cash' && Number(t.debit) > 0 && mine(t.created_at, t.created_by))
        .map((t) => ({ id: 's' + t.id, label: db.supplierName(t.supplier_id), sub: t.notes || 'Supplier payment', at: t.created_at, amount: Number(t.debit) || 0, href: 'supplier-view.html?id=' + t.supplier_id }));
      // money a supplier handed back in cash (a return refunded, an advance returned): type 'refund', credit
      const supplierRefunds = db.all('supplier_transactions').filter((t) => inBranch(t.branch_id) && t.type === 'refund' && t.payment_method === 'cash' && Number(t.credit) > 0 && mine(t.created_at, t.created_by))
        .map((t) => ({ id: 'sr' + t.id, label: db.supplierName(t.supplier_id), sub: t.notes || 'Supplier refund', at: t.created_at, amount: Number(t.credit) || 0, href: 'supplier-view.html?id=' + t.supplier_id }));

      const movements = db.where('cash_movements', { shift_id: s.id });
      const mv = (type) => movements.filter((m) => m.type === type)
        .map((m) => ({ id: 'm' + m.id, label: ui.statusLabel(m.type), sub: m.reason || '', at: m.created_at, amount: Number(m.amount) || 0, href: null }));

      const line = (key, label, icon, sign, items) => ({ key, label, icon, sign, items, count: items.length, amount: utils.sum(items, 'amount') });
      const lines = [
        line('cash_sales', 'Cash sales', 'receipt', 1, cashSales),
        line('cash_received', 'Khata received', 'users', 1, received),
        line('repair_cash', 'Repair payments', 'wrench', 1, repairs),
        line('supplier_refunds', 'Supplier refunds', 'store', 1, supplierRefunds),
        line('pay_ins', 'Cash added to drawer', 'plus', 1, mv('pay_in')),
        line('refunds', 'Refunds paid', 'return', -1, refunds),
        line('repair_refunds', 'Repair refunds', 'wrench', -1, repairRefunds),
        line('expenses', 'Expenses paid', 'banknotes', -1, expenses),
        line('supplier_payments', 'Supplier payments', 'store', -1, supplier),
        line('pay_outs', 'Cash taken out', 'minus', -1, mv('pay_out')),
        line('bank_drops', 'Banked', 'building', -1, mv('bank_drop')),
      ];
      const expected = utils.round2(lines.reduce((a, l) => a + l.sign * l.amount, Number(s.opening_float) || 0));
      const totals = {};
      lines.forEach((l) => { totals[l.key] = l.amount; });
      totals.invoices = cashSales.length;
      return { shift: s, lines, totals, expected, movements, from, to };
    },
    /** Count the drawer and hand over. Everything the shift was accountable for is frozen on the row. */
    close(shiftId, opts) {
      const s = db.find('cashier_shifts', shiftId);
      if (!s) throw new Error('Shift not found.');
      if (s.status !== 'open') throw new Error('This shift is already closed.');
      const counted = utils.round2(opts.counted);
      if (!(counted >= 0)) throw new Error('Counted cash must be zero or more.');
      const t = shift.tally(s);
      const handover = utils.round2(opts.handoverAmount || 0);
      const banked = utils.round2(opts.bankedAmount || 0);
      if (handover + banked > counted + 0.005) throw new Error(`Handover and banking (${utils.money(handover + banked)}) cannot exceed the ${utils.money(counted)} counted.`);
      if (opts.handoverTo && !db.find('users', opts.handoverTo)) throw new Error('Select who is taking over the drawer.');
      const variance = utils.round2(counted - t.expected);
      const row = db.update('cashier_shifts', s.id, {
        status: 'closed', closed_at: utils.now(), closed_by: (session.user() || {}).id || s.user_id,
        counted_cash: counted, expected_cash: t.expected, variance, denominations: opts.denominations || null,
        handover_to: opts.handoverTo ? Number(opts.handoverTo) : null, handover_amount: handover, banked_amount: banked,
        totals: t.totals, notes: [s.notes, String(opts.notes || '').trim()].filter(Boolean).join(' · '),
      });
      db.audit('shift.close', 'cashier_shift', s.id, `Shift ${s.shift_no} closed by ${db.userName((session.user() || {}).id)}: expected ${utils.money(t.expected)}, counted ${utils.money(counted)}, ${variance === 0 ? 'balanced' : (variance < 0 ? 'short ' : 'over ') + utils.money(Math.abs(variance))}${handover ? `; ${utils.money(handover)} handed to ${db.userName(opts.handoverTo)}` : ''}${banked ? `; ${utils.money(banked)} banked` : ''}`, s.branch_id);
      return row;
    },
  };

  /* ------------------------------------------------------------------ brand */
  /**
   * One place decides what the company mark is, so the whole software rebrands at once:
   * the sidebar, the login screen, every printed document, the storefront and the emailed invoice.
   * Order of preference: a logo set in Settings / the CMS → assets/img/logo.png (drop the real
   * artwork there) → assets/img/logo.svg (the stand-in shipped with the prototype) → initials.
   */
  const ASSET_BASE = (function () {
    const s = document.querySelector('script[src*="assets/js/app.js"]');
    return s ? s.src.replace(/assets\/js\/app\.js.*$/, '') : '';
  })();
  const brand = {
    base: ASSET_BASE,
    file(name) { return ASSET_BASE + 'assets/img/' + name; },
    name() { return db.setting('company_name', 'Abbott Mobiles'); },
    tagline() { return db.setting('company_tagline', 'The name of trust'); },
    /** The mark to show. A custom logo (data URL or path) always wins. */
    logo() { return db.setting('logo', '') || brand.file('logo.png'); },
    /** `<img>` that degrades to the stand-in and then to a monogram if the file is not there. */
    img(cls = 'h-9 w-auto', opts = {}) {
      const alt = utils.escape(opts.alt || brand.name());
      return `<img src="${utils.escape(brand.logo())}" alt="${alt}" class="${cls}" data-abm-logo`
        + ` data-fallback-class="${utils.escape(opts.fallbackClass || 'w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-black text-lg')}"`
        + ' onerror="ABM.brand.onError(this)">';
    },
    /**
     * Wire up any `<img data-abm-logo>` written straight into a page's HTML. Done from script
     * because a plain inline onerror can fire before app.js has loaded (the file 404s instantly).
     */
    hydrate(root) {
      (root || document).querySelectorAll('img[data-abm-logo]').forEach((img) => {
        if (img.dataset.hydrated) return;
        img.dataset.hydrated = '1';
        img.addEventListener('error', () => brand.onError(img));
        const want = brand.logo();
        if (img.getAttribute('src') !== want) img.src = want;
        else if (img.complete && img.naturalWidth === 0) brand.onError(img);
      });
    },
    onError(img) {
      if (!img) return;
      if (!img.dataset.step) {                       // the PNG is not there: fall back to the shipped SVG
        img.dataset.step = 'svg';
        img.src = brand.file('logo.svg');
        return;
      }
      const cls = img.dataset.fallbackClass;
      if (!cls) { img.remove(); return; }             // a document header simply drops the mark
      const span = document.createElement('span');    // a chrome slot keeps its shape with initials
      span.className = cls;
      span.textContent = utils.initials(brand.name());
      if (img.parentNode) img.replaceWith(span);
    },
  };

  /* ------------------------------------------------------ permissions/roles */
  // Every screen in the sidebar is a module. A role ticks which of the five standard actions it may take on
  // each module, plus a few actions that only make sense for that one module (void a sale, approve a transfer…).
  // A permission key is "<module>.<action>", e.g. products.delete or transfers.approve.
  const ACTIONS = [
    { key: 'view', label: 'View' }, { key: 'add', label: 'Add' }, { key: 'edit', label: 'Edit' },
    { key: 'delete', label: 'Delete' }, { key: 'export', label: 'Export' },
  ];
  const ALL5 = ['view', 'add', 'edit', 'delete', 'export'];
  const MODULES = [
    { group: 'Overview', key: 'dashboard', label: 'Dashboard', icon: 'home', actions: ['view'], pages: ['dashboard'] },
    { group: 'Sales', key: 'pos', label: 'POS Terminal', icon: 'cart', actions: ['view'], notes: { view: 'Ring up sales' }, pages: ['pos'] },
    { group: 'Sales', key: 'sales', label: 'Sales History', icon: 'receipt', actions: ['view', 'delete', 'export'], notes: { delete: 'Void a sale' },
      extras: [{ key: 'print', label: 'Reprint invoices' }, { key: 'all', label: 'Everyone’s sales', hint: 'Without this a user only sees the invoices they rang up themselves.' }], pages: ['sales', 'sale-view', 'invoice'] },
    { group: 'Sales', key: 'returns', label: 'Returns', icon: 'return', actions: ['view', 'add', 'export'], notes: { add: 'Refund or exchange' }, pages: ['returns'] },
    { group: 'Sales', key: 'customers', label: 'Customers', icon: 'users', actions: ALL5, notes: { edit: 'Includes balance adjustments' },
      extras: [{ key: 'payments', label: 'Receive payments' }], pages: ['customers', 'customer-view'] },
    { group: 'Repairs', key: 'repairs', label: 'Repair Jobs', icon: 'wrench', actions: ALL5, notes: { edit: 'Status, parts, diagnosis', delete: 'Cancel a job' },
      extras: [{ key: 'assign', label: 'Assign technicians' }, { key: 'deliver', label: 'Deliver & take payment' }, { key: 'work', label: 'Works on repairs', hint: 'Can be put on jobs. Without “Assign technicians” they can only work their own and unassigned jobs, and job prices are hidden.' }],
      pages: ['repairs', 'repair-create', 'repair-view', 'repair-board'] },
    { group: 'Website', key: 'orders', label: 'Online Orders', icon: 'bag', actions: ['view', 'edit', 'export'], notes: { edit: 'Confirm, pack, ship, cancel' }, pages: ['online-orders', 'online-order-view'] },
    { group: 'Website', key: 'messages', label: 'Inbox', icon: 'mail', actions: ['view', 'edit', 'delete', 'export'], notes: { edit: 'Reply and mark handled' }, pages: ['inbox'] },
    { group: 'Website', key: 'website', label: 'Website & CMS', icon: 'globe', actions: ['view', 'edit'], notes: { edit: 'Pages, menus, banners, theme' }, pages: ['website', 'website-pages', 'website-theme', 'website-page-edit'] },
    { group: 'Inventory', key: 'products', label: 'Products', icon: 'cube', actions: ALL5, notes: { add: 'Includes CSV import' }, pages: ['products', 'product-view', 'products-import', 'labels'] },
    { group: 'Inventory', key: 'categories', label: 'Categories & Brands', icon: 'tag', actions: ['view', 'add', 'edit', 'delete', 'export'], pages: ['categories'] },
    { group: 'Inventory', key: 'imei', label: 'IMEI Registry', icon: 'qr', actions: ['view', 'add', 'edit', 'delete', 'export'], notes: { add: 'Register units', edit: 'Correct a unit, grade, mark defective / found', delete: 'Void a unit registered by mistake' }, pages: ['imeis'] },
    { group: 'Inventory', key: 'inventory', label: 'Branch Stock', icon: 'archive', actions: ['view', 'edit', 'export'], notes: { edit: 'Adjust stock levels' },
      extras: [{ key: 'approve', label: 'Approve large adjustments', hint: 'Adjustments worth more than the limit in Settings wait for someone with this permission.' }], pages: ['stock'] },
    { group: 'Inventory', key: 'stocktake', label: 'Stock Take', icon: 'calculator', actions: ALL5, notes: { add: 'Start a count', edit: 'Count and post', delete: 'Cancel a count' }, pages: ['stock-counts', 'stock-count-view'] },
    { group: 'Inventory', key: 'transfers', label: 'Stock Transfers', icon: 'transfer', actions: ['view', 'add', 'delete', 'export'], notes: { add: 'Request stock', delete: 'Cancel a request' },
      extras: [{ key: 'approve', label: 'Approve' }, { key: 'ship', label: 'Ship' }, { key: 'receive', label: 'Receive' }], pages: ['transfers', 'transfer-create', 'transfer-view'] },
    { group: 'Purchases', key: 'purchase_orders', label: 'Purchase Orders', icon: 'document', actions: ALL5, notes: { delete: 'Cancel an order' }, pages: ['purchase-orders', 'purchase-order-create', 'purchase-order-view'] },
    { group: 'Purchases', key: 'purchases', label: 'Purchases', icon: 'truck', actions: ['view', 'add', 'delete', 'export'], notes: { add: 'Receive stock', delete: 'Cancel a purchase' }, pages: ['purchases', 'purchase-create', 'purchase-view'] },
    { group: 'Purchases', key: 'suppliers', label: 'Suppliers', icon: 'store', actions: ALL5, notes: { edit: 'Includes balance adjustments' },
      extras: [{ key: 'payments', label: 'Pay suppliers' }], pages: ['suppliers', 'supplier-view'] },
    { group: 'Purchases', key: 'supplier_returns', label: 'Supplier Returns', icon: 'return', actions: ALL5, notes: { edit: 'Send, resolve', delete: 'Cancel a return' }, pages: ['supplier-returns', 'supplier-return-create', 'supplier-return-view'] },
    { group: 'Accounting', key: 'expenses', label: 'Expenses', icon: 'banknotes', actions: ALL5, pages: ['expenses'] },
    { group: 'Accounting', key: 'shifts', label: 'Cashier Shifts', icon: 'wallet', actions: ['view', 'add', 'edit', 'export'], notes: { add: 'Open a drawer', edit: 'Pay in / out, close' },
      extras: [{ key: 'all', label: 'Every cashier’s drawer', hint: 'Without this a user only sees and runs their own drawer.' }], pages: ['shifts', 'shift-view'] },
    { group: 'Accounting', key: 'banking', label: 'Bank Accounts', icon: 'building', actions: ALL5, notes: { add: 'Open an account', edit: 'Deposit, withdraw, transfer, reconcile', delete: 'Reverse an entry' }, pages: ['banking', 'bank-account-view'] },
    { group: 'Accounting', key: 'cheques', label: 'Cheque Register', icon: 'document', actions: ALL5, notes: { edit: 'Deposit, clear, bounce', delete: 'Cancel a cheque' }, pages: ['cheques'] },
    { group: 'Accounting', key: 'closing', label: 'Day-End Closing', icon: 'lock', actions: ['view', 'edit', 'export'], notes: { edit: 'Close the day' }, pages: ['day-end', 'closings'] },
    { group: 'Accounting', key: 'reports', label: 'Reports', icon: 'chart', actions: ['view', 'export'], pages: ['reports', 'report-sales', 'report-profit-loss', 'report-stock-valuation', 'report-balance-sheet', 'report-expenses', 'report-receivables', 'report-payables', 'report-inventory', 'report-repairs', 'report-online-sales', 'report-imei-history'] },
    { group: 'Administration', key: 'branches', label: 'Branches', icon: 'building', actions: ['view', 'add', 'edit', 'delete', 'export'], notes: { delete: 'Deactivate' }, pages: ['branches'] },
    { group: 'Administration', key: 'users', label: 'Users', icon: 'user-group', actions: ALL5, notes: { view: 'Own branch staff', delete: 'Deactivate' }, pages: ['users'] },
    { group: 'Administration', key: 'roles', label: 'Roles & Permissions', icon: 'shield', actions: ['view', 'add', 'edit', 'delete'], pages: ['roles', 'role-edit'] },
    { group: 'Administration', key: 'settings', label: 'Settings', icon: 'cog', actions: ['view', 'edit'], notes: { edit: 'Change settings, backups, data import' }, pages: ['settings', 'data-import'] },
    { group: 'Administration', key: 'audit', label: 'Audit Log', icon: 'clipboard', actions: ['view', 'export'], pages: ['audit-log'] },
  ];
  // Older permission names still resolve, so a page or a saved role that uses them keeps working.
  const PERM_ALIASES = {
    'pos.access': 'pos.view', 'sales.void': 'sales.delete', 'sales.return': 'returns.add',
    'customers.create': 'customers.add', 'customers.manage': 'customers.edit',
    'repairs.create': 'repairs.add', 'repairs.manage': 'repairs.edit',
    'orders.manage': 'orders.edit', 'messages.manage': 'messages.edit', 'website.manage': 'website.edit',
    'products.manage': 'products.edit', 'categories.manage': 'categories.edit', 'brands.manage': 'categories.edit',
    'imei.manage': 'imei.edit', 'inventory.adjust': 'inventory.edit', 'transfers.request': 'transfers.add',
    'purchases.manage': 'purchases.add', 'suppliers.manage': 'suppliers.edit', 'expenses.manage': 'expenses.edit',
    'closing.manage': 'closing.edit', 'shifts.manage': 'shifts.edit', 'bank.view': 'banking.view', 'bank.manage': 'banking.edit',
    'reports.branch': 'reports.view', 'staff.view': 'users.view', 'users.manage': 'users.edit',
    'branches.manage': 'branches.edit', 'settings.manage': 'settings.edit',
  };
  const moduleActions = (m) => m.actions.concat((m.extras || []).map((x) => x.key));
  const PERMISSION_KEYS = MODULES.reduce((all, m) => all.concat(moduleActions(m).map((a) => m.key + '.' + a)), []);
  const FULL_ACCESS = 'super_admin';
  const ROLE_COLORS = ['navy', 'blue', 'green', 'amber', 'red', 'purple', 'slate'];

  const roles = {
    MODULES, ACTIONS, KEYS: PERMISSION_KEYS, FULL_ACCESS, COLORS: ROLE_COLORS,
    all() { return utils.sortBy(db.all('roles'), (r) => String(r.sort ?? 99).padStart(3, '0') + r.name); },
    get(key) { return db.all('roles').find((r) => r.key === key) || null; },
    label(key) { const r = roles.get(key); return r ? r.name : (key ? utils.titleCase(String(key).replace(/_/g, ' ')) : ''); },
    /** { key: name } for every role — the shape the old ROLES constant had. */
    map() { const o = {}; roles.all().forEach((r) => { o[r.key] = r.name; }); return o; },
    module(key) { return MODULES.find((m) => m.key === key) || null; },
    moduleForPage(page) { return MODULES.find((m) => (m.pages || []).includes(page)) || null; },
    canonical(perm) { return PERM_ALIASES[perm] || perm; },
    isFull(role) { role = typeof role === 'string' ? roles.get(role) : role; return !!role && role.key === FULL_ACCESS; },
    /** Does this role grant the permission? Super Admin always does. */
    has(role, perm) {
      role = typeof role === 'string' ? roles.get(role) : role;
      if (!role) return false;
      if (role.key === FULL_ACCESS) return true;
      return (role.permissions || []).includes(roles.canonical(perm));
    },
    permsOf(role) { role = typeof role === 'string' ? roles.get(role) : role; return !role ? [] : role.key === FULL_ACCESS ? PERMISSION_KEYS.slice() : (role.permissions || []).slice(); },
    /** Keep only known keys, in catalogue order, and make every action imply View of its module. */
    normalize(list) {
      const set = new Set((list || []).map((p) => roles.canonical(p)).filter((p) => PERMISSION_KEYS.includes(p)));
      MODULES.forEach((m) => { if (m.actions.includes('view') && moduleActions(m).some((a) => set.has(m.key + '.' + a))) set.add(m.key + '.view'); });
      return PERMISSION_KEYS.filter((k) => set.has(k));
    },
    users(key) { return db.all('users').filter((u) => u.role === key); },
    /** "products.delete" -> "Products: Delete" (for messages and the audit log). */
    describe(perm) {
      const [mk, ak] = String(roles.canonical(perm)).split('.');
      const m = roles.module(mk); if (!m) return String(perm);
      const x = (m.extras || []).find((e) => e.key === ak);
      const a = x ? x.label : ((ACTIONS.find((y) => y.key === ak) || {}).label || ak);
      return m.label + ': ' + a;
    },
    /** The screen a role lands on after signing in: the first sidebar item it can open. */
    homeFor(key) {
      const r = roles.get(key);
      if (!r) return 'profile.html';
      if (roles.has(r, 'dashboard.view')) return 'dashboard.html';
      if (roles.has(r, 'pos.view')) return 'pos.html';
      if (roles.has(r, 'repairs.view')) return 'repairs.html';
      for (const g of nav) for (const it of g.items) if (!it.external && (!it.perm || roles.has(r, it.perm))) return it.href;
      return 'profile.html';
    },
    /** Ticked on the role itself (Super Admin's blanket access does not make an owner a technician). */
    ticked(role, perm) { role = typeof role === 'string' ? roles.get(role) : role; return !!role && (role.permissions || []).includes(roles.canonical(perm)); },
    /** People who can be put on a repair job. */
    technicians(branchId) { return db.all('users').filter((u) => u.is_active && roles.ticked(u.role, 'repairs.work') && (!branchId || u.branch_id == branchId)); },
    /** A bench technician works jobs but does not run the repair desk. */
    isBench(key) { return roles.has(key, 'repairs.work') && !roles.has(key, 'repairs.assign'); },
    /**
     * Roles the signed-in user may hand out, and permissions they may grant: nobody can give away more
     * than they hold themselves, and only a Super Admin can make another Super Admin.
     */
    grantable() { const me = session.user(); return me ? roles.permsOf(me.role) : []; },
    canGrant(role) {
      const me = session.user(); if (!me) return false;
      role = typeof role === 'string' ? roles.get(role) : role; if (!role) return false;
      if (roles.isFull(me.role)) return true;
      if (roles.isFull(role)) return false;
      const mine = new Set(roles.permsOf(me.role));
      return (role.permissions || []).every((p) => mine.has(p));
    },
    assignable() { return roles.all().filter((r) => roles.canGrant(r)); },
    slug(name) {
      let base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'role';
      let key = base, n = 2;
      while (roles.get(key)) key = base + '_' + n++;
      return key;
    },
    /** Human diff of two permission lists, for the audit log. */
    diff(before, after) {
      const a = new Set(before || []), b = new Set(after || []);
      return { added: (after || []).filter((p) => !a.has(p)), removed: (before || []).filter((p) => !b.has(p)) };
    },
    validate(form, id) {
      const e = {};
      const name = String(form.name || '').trim();
      if (!name) e.name = 'Give the role a name.';
      else if (name.length > 40) e.name = 'Keep the name under 40 characters.';
      else if (db.all('roles').some((r) => String(r.id) !== String(id) && r.name.toLowerCase() === name.toLowerCase())) e.name = 'Another role already has this name.';
      if (String(form.description || '').length > 200) e.description = 'Keep the description under 200 characters.';
      const perms = roles.normalize(form.permissions);
      if (!perms.length) e.permissions = 'Tick at least one permission.';
      const mine = new Set(roles.grantable());
      const over = perms.filter((p) => !mine.has(p));
      if (over.length) e.permissions = 'You cannot grant permissions you do not have yourself (' + over.slice(0, 3).join(', ') + (over.length > 3 ? '…' : '') + ').';
      return e;
    },
    create(form) {
      if (!session.can('roles.add')) throw new Error('You do not have permission to create roles.');
      const e = roles.validate(form, null); if (Object.keys(e).length) { const err = new Error(Object.values(e)[0]); err.errors = e; throw err; }
      const row = db.insert('roles', {
        key: roles.slug(form.name), name: String(form.name).trim(), description: String(form.description || '').trim(),
        color: form.color || 'slate', is_system: 0, sort: 50, permissions: roles.normalize(form.permissions),
        created_by: (session.user() || {}).id || null,
      });
      db.audit('role.create', 'role', row.id, `Role "${row.name}" created with ${row.permissions.length} permission${row.permissions.length === 1 ? '' : 's'}`, null);
      return row;
    },
    update(id, form) {
      if (!session.can('roles.edit')) throw new Error('You do not have permission to edit roles.');
      const r = db.find('roles', id); if (!r) throw new Error('Role not found.');
      if (roles.isFull(r)) throw new Error('The Super Admin role always has full access and cannot be changed.');
      if (!roles.canGrant(r) && !roles.isFull((session.user() || {}).role)) throw new Error('This role has permissions you do not hold, so you cannot edit it.');
      const e = roles.validate(form, id); if (Object.keys(e).length) { const err = new Error(Object.values(e)[0]); err.errors = e; throw err; }
      const perms = roles.normalize(form.permissions);
      const me = session.user();
      // never let someone lock themselves out of the screen they are standing on
      if (me && me.role === r.key && !perms.includes('roles.edit')) throw new Error('This is your own role — removing “Roles: Edit” would lock you out of this screen.');
      const d = roles.diff(r.permissions, perms);
      const patch = { name: String(form.name).trim(), description: String(form.description || '').trim(), color: form.color || r.color || 'slate', permissions: perms };
      db.update('roles', id, patch);
      const parts = [];
      if (patch.name !== r.name) parts.push('renamed from "' + r.name + '"');
      // the audit trail keeps the full list: this is the only record of who could do what, when
      if (d.added.length) parts.push('added ' + d.added.join(', '));
      if (d.removed.length) parts.push('removed ' + d.removed.join(', '));
      db.audit('role.update', 'role', id, `Role "${patch.name}" updated` + (parts.length ? ': ' + parts.join('; ') : ' (no permission changes)'), null);
      return db.find('roles', id);
    },
    remove(id) {
      if (!session.can('roles.delete')) throw new Error('You do not have permission to delete roles.');
      const r = db.find('roles', id); if (!r) throw new Error('Role not found.');
      if (r.is_system) throw new Error('“' + r.name + '” is a built-in role and cannot be deleted.');
      const n = roles.users(r.key).length;
      if (n) throw new Error(n + ' user' + (n === 1 ? ' still has' : 's still have') + ' this role. Move them to another role first.');
      db.remove('roles', id);
      db.audit('role.delete', 'role', id, `Role "${r.name}" deleted`, null);
      return true;
    },
  };

  /* ---------------------------------------------------------------- session
   * SECURITY NOTE: this is a browser-only prototype. Staff passwords are stored as a digest in localStorage,
   * which is NOT security (anyone with the browser can read or change the data). It exists so the screens
   * behave like the real thing; the PHP backend replaces it with password_hash / password_verify and
   * server-side sessions. Seeded demo accounts have no digest and accept the demo password.
   */
  const DEMO_PASSWORD = 'demo1234';
  const pwDigest = (pw) => {
    const s = 'abm-staff:' + String(pw == null ? '' : pw);
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = (h1 * 0x01000193) >>> 0; h2 = (h2 + s.charCodeAt(i) * (i + 7)) >>> 0; }
    return 's1$' + h1.toString(36) + h2.toString(36);
  };
  let sess = null;
  const session = {
    DEMO_PASSWORD,
    // "Keep me signed in" keeps the session in localStorage; otherwise it lives in sessionStorage and ends
    // when the browser closes.
    load() {
      if (sess) return sess;
      try { sess = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { sess = null; }
      return sess;
    },
    save() {
      try {
        localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
        if (sess) (sess.remember === false ? sessionStorage : localStorage).setItem(SESSION_KEY, JSON.stringify(sess));
      } catch (e) { /* ignore */ }
    },
    /** Start a session for a user (no password check — see authenticate). opts.remember defaults to true. */
    login(user, opts) {
      const branchId = user.branch_id || (db.all('branches').find((b) => b.is_active) || {}).id || 1;
      sess = { user_id: user.id, branch_id: branchId, logged_in_at: utils.now(), remember: !(opts && opts.remember === false) };
      session.save();
      db.update('users', user.id, { last_login_at: utils.now() });
      db.audit('login', 'user', user.id, `${user.name} logged in`);
      return sess;
    },
    /** Does this password open this user's account? */
    verifyPassword(user, password) {
      user = typeof user === 'object' ? user : db.find('users', user);
      if (!user) return false;
      return user.password_hash ? user.password_hash === pwDigest(password) : String(password) === DEMO_PASSWORD;
    },
    /** Store a new password for a user (min 8 characters). */
    setPassword(userId, password, opts) {
      const u = db.find('users', userId); if (!u) throw new Error('User not found.');
      if (String(password || '').length < 8) throw new Error('A password needs at least 8 characters.');
      db.update('users', u.id, { password_hash: pwDigest(password), password_changed_at: utils.now(), failed_logins: 0, locked_until: null, must_change_password: opts && opts.mustChange ? 1 : 0 });
      return true;
    },
    /** Why this user may not work right now ('' = fine): deactivated, branch closed, or locked out. */
    blockedReason(user) {
      if (!user) return 'No account found for that username.';
      if (!user.is_active) return 'This account is deactivated. Contact your Super Admin.';
      const b = user.branch_id ? db.find('branches', user.branch_id) : null;
      if (b && !b.is_active) return `${b.name} is deactivated, so its staff cannot sign in.`;
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const mins = Math.max(1, Math.ceil((new Date(user.locked_until) - new Date()) / 60000));
        return `Too many wrong passwords — this account is locked for ${mins} more minute${mins === 1 ? '' : 's'}. A Super Admin can unlock it.`;
      }
      return '';
    },
    /**
     * Sign-in with a password. Returns { ok, user, error }. Wrong passwords are counted; after
     * settings.login_max_attempts (5) the account locks for settings.login_lock_minutes (15).
     */
    authenticate(username, password, opts) {
      const name = String(username || '').trim().toLowerCase();
      const user = db.all('users').find((x) => String(x.username).toLowerCase() === name);
      if (!user) { db.audit('login.failed', 'user', null, `Failed login for unknown username "${name}"`, null); return { ok: false, error: 'No account found for that username.' }; }
      const blocked = session.blockedReason(user);
      if (blocked) { db.audit('login.blocked', 'user', user.id, `Sign-in refused for ${user.username}: ${blocked}`, user.branch_id); return { ok: false, user, error: blocked }; }
      if (!session.verifyPassword(user, password)) {
        const tries = (Number(user.failed_logins) || 0) + 1;
        const max = Number(db.setting('login_max_attempts', 5)) || 5;
        const patch = { failed_logins: tries };
        if (tries >= max) patch.locked_until = new Date(Date.now() + (Number(db.setting('login_lock_minutes', 15)) || 15) * 60000).toISOString();
        db.update('users', user.id, patch);
        db.audit(patch.locked_until ? 'login.locked' : 'login.failed', 'user', user.id, patch.locked_until ? `${user.username} locked after ${tries} wrong passwords` : `Wrong password for ${user.username} (${tries} of ${max})`, user.branch_id);
        return { ok: false, user, error: patch.locked_until ? session.blockedReason(db.find('users', user.id)) : `That password is not correct${max - tries <= 2 ? ` — ${max - tries} attempt${max - tries === 1 ? '' : 's'} left before the account locks` : ''}.` };
      }
      db.update('users', user.id, { failed_logins: 0, locked_until: null });
      session.login(user, opts);
      return { ok: true, user };
    },
    unlock(userId) {
      const u = db.find('users', userId); if (!u) throw new Error('User not found.');
      db.update('users', u.id, { failed_logins: 0, locked_until: null });
      db.audit('user.unlock', 'user', u.id, `${u.username} unlocked`, u.branch_id);
    },
    logout() { const u = session.user(); if (u) db.audit('logout', 'user', u.id, `${u.name} logged out`); sess = null; session.save(); },
    /** Signed in AND still allowed: a deactivated user (or branch) is signed out on the next page. */
    check() {
      const s = session.load();
      const u = s && db.find('users', s.user_id);
      if (!u) return false;
      if (!u.is_active || (u.branch_id && db.find('branches', u.branch_id) && !db.find('branches', u.branch_id).is_active)) { sess = null; session.save(); return false; }
      return true;
    },
    user() { const s = session.load(); return s ? db.find('users', s.user_id) : null; },
    role() { const u = session.user(); return u ? u.role : null; },
    roleLabel() { return roles.label(session.role()); },
    /** Company-wide access (every branch, every permission) belongs to the Super Admin role alone. */
    isSuperAdmin() { return session.role() === FULL_ACCESS; },
    isManager() { return session.role() === 'branch_manager'; },
    isCashier() { return session.role() === 'cashier'; },
    branchId() { const u = session.user(); if (!u) return null; return u.branch_id || (session.load() || {}).branch_id || null; },
    branch() { return db.find('branches', session.branchId()); },
    branchCode() { const b = session.branch(); return b ? b.code : 'MB'; },
    setBranch(id) { if (!session.isSuperAdmin()) return; sess.branch_id = Number(id); session.save(); },
    can(perm) { const u = session.user(); return !!u && roles.has(u.role, perm); },
    canAny(perms) { return perms.some((p) => session.can(p)); },
    /** Redirect to login when not authenticated (call on protected pages). */
    require() { if (!session.check()) { const next = encodeURIComponent(location.pathname.split('/').pop() + location.search); location.replace('login.html?next=' + next); return false; } return true; },
    homeFor(role) { return roles.homeFor(role); },
  };

  /* -------------------------------------------------------------------- nav */
  const nav = [
    { section: null, items: [
      { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'home', perm: 'dashboard.view' },
      { key: 'pos', label: 'POS Terminal', href: 'pos.html', icon: 'cart', perm: 'pos.view', highlight: true },
    ] },
    { section: 'Sales', items: [
      { key: 'sales', label: 'Sales History', href: 'sales.html', icon: 'receipt', perm: 'sales.view', match: ['sale-view', 'invoice'] },
      { key: 'returns', label: 'Returns', href: 'returns.html', icon: 'return', perm: 'returns.view' },
      { key: 'customers', label: 'Customers', href: 'customers.html', icon: 'users', perm: 'customers.view', match: ['customer-view'] },
    ] },
    { section: 'Repairs', items: [
      { key: 'repairs', label: 'Repair Jobs', href: 'repairs.html', icon: 'wrench', perm: 'repairs.view', match: ['repair-create', 'repair-view', 'repair-board'] },
    ] },
    { section: 'Website', items: [
      { key: 'online-orders', label: 'Online Orders', href: 'online-orders.html', icon: 'bag', perm: 'orders.view', match: ['online-order-view'] },
      { key: 'inbox', label: 'Inbox', href: 'inbox.html', icon: 'mail', perm: 'messages.view', badge: 'unreadMessages' },
      { key: 'website', label: 'Website & CMS', href: 'website.html', icon: 'globe', perm: 'website.view', match: ['website-pages', 'website-theme', 'website-page-edit'] },
      { key: 'storefront', label: 'View Storefront', href: 'shop/index.html', icon: 'arrow-up-right', perm: 'orders.view', external: true },
    ] },
    { section: 'Inventory', items: [
      { key: 'products', label: 'Products', href: 'products.html', icon: 'cube', perm: 'products.view', match: ['product-view'] },
      { key: 'categories', label: 'Categories & Brands', href: 'categories.html', icon: 'tag', perm: 'categories.view' },
      { key: 'imeis', label: 'IMEI Registry', href: 'imeis.html', icon: 'qr', perm: 'imei.view' },
      { key: 'labels', label: 'Labels & Barcodes', href: 'labels.html', icon: 'barcode', perm: 'products.view' },
      { key: 'stock', label: 'Branch Stock', href: 'stock.html', icon: 'archive', perm: 'inventory.view' },
      { key: 'stock-counts', label: 'Stock Take', href: 'stock-counts.html', icon: 'calculator', perm: 'stocktake.view', match: ['stock-count-view'] },
      { key: 'transfers', label: 'Stock Transfers', href: 'transfers.html', icon: 'transfer', perm: 'transfers.view', match: ['transfer-create', 'transfer-view'] },
    ] },
    { section: 'Purchases', items: [
      { key: 'purchase-orders', label: 'Purchase Orders', href: 'purchase-orders.html', icon: 'document', perm: 'purchase_orders.view', match: ['purchase-order-create', 'purchase-order-view'] },
      { key: 'purchases', label: 'Purchases', href: 'purchases.html', icon: 'truck', perm: 'purchases.view', match: ['purchase-create', 'purchase-view'] },
      { key: 'suppliers', label: 'Suppliers', href: 'suppliers.html', icon: 'store', perm: 'suppliers.view', match: ['supplier-view'] },
      { key: 'supplier-returns', label: 'Supplier Returns', href: 'supplier-returns.html', icon: 'return', perm: 'supplier_returns.view', match: ['supplier-return-create', 'supplier-return-view'] },
    ] },
    { section: 'Accounting', items: [
      { key: 'expenses', label: 'Expenses', href: 'expenses.html', icon: 'banknotes', perm: 'expenses.view' },
      { key: 'shifts', label: 'Cashier Shifts', href: 'shifts.html', icon: 'wallet', perm: 'shifts.view', match: ['shift-view'] },
      { key: 'banking', label: 'Bank Accounts', href: 'banking.html', icon: 'building', perm: 'banking.view', match: ['bank-account-view'] },
      { key: 'cheques', label: 'Cheque Register', href: 'cheques.html', icon: 'document', perm: 'cheques.view' },
      { key: 'day-end', label: 'Day-End Closing', href: 'day-end.html', icon: 'lock', perm: 'closing.view', match: ['closings'] },
      { key: 'reports', label: 'Reports', href: 'reports.html', icon: 'chart', perm: 'reports.view', match: ['report-sales', 'report-profit-loss', 'report-stock-valuation', 'report-balance-sheet', 'report-imei-history', 'report-expenses', 'report-receivables', 'report-payables', 'report-inventory', 'report-repairs', 'report-online-sales'] },
    ] },
    { section: 'Administration', items: [
      { key: 'branches', label: 'Branches', href: 'branches.html', icon: 'building', perm: 'branches.view' },
      { key: 'users', label: 'Users', href: 'users.html', icon: 'user-group', perm: 'users.view' },
      { key: 'roles', label: 'Roles & Permissions', href: 'roles.html', icon: 'shield', perm: 'roles.view', match: ['role-edit'] },
      { key: 'settings', label: 'Settings', href: 'settings.html', icon: 'cog', perm: 'settings.view' },
      { key: 'data-import', label: 'Data Import', href: 'data-import.html', icon: 'upload', perm: 'settings.edit' },
      { key: 'audit-log', label: 'Audit Log', href: 'audit-log.html', icon: 'clipboard', perm: 'audit.view' },
    ] },
  ];

  /* ------------------------------------------------------------------ icons */
  const ICONS = {
    home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
    cart: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
    receipt: 'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
    return: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
    cube: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
    tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
    qr: 'M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z',
    archive: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
    transfer: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    truck: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
    store: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z',
    users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    'user-group': 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
    banknotes: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
    chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    building: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
    cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    clipboard: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
    bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
    search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
    menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
    x: 'M6 18L18 6M6 6l12 12',
    'chevron-down': 'M19.5 8.25l-7.5 7.5-7.5-7.5',
    'chevron-right': 'M8.25 4.5l7.5 7.5-7.5 7.5',
    'chevron-left': 'M15.75 19.5L8.25 12l7.5-7.5',
    'chevron-up': 'M4.5 15.75l7.5-7.5 7.5 7.5',
    plus: 'M12 4.5v15m7.5-7.5h-15',
    minus: 'M19.5 12h-15',
    printer: 'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z',
    logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
    user: 'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z',
    trash: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
    edit: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
    eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    check: 'M4.5 12.75l6 6 9-13.5',
    'check-circle': 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    'x-circle': 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
    refresh: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
    phone: 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3',
    tablet: 'M10.5 19.5h3M7.5 2.25h9a1.5 1.5 0 011.5 1.5v16.5a1.5 1.5 0 01-1.5 1.5h-9a1.5 1.5 0 01-1.5-1.5V3.75a1.5 1.5 0 011.5-1.5z',
    watch: 'M12 8.25v3.75l2.25 1.5M15.75 6.75l-.44-2.2A2.25 2.25 0 0013.1 2.75h-2.2a2.25 2.25 0 00-2.21 1.8l-.44 2.2m7.5 10.5l-.44 2.2a2.25 2.25 0 01-2.21 1.8h-2.2a2.25 2.25 0 01-2.21-1.8l-.44-2.2M18 12a6 6 0 11-12 0 6 6 0 0112 0z',
    download: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3',
    upload: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
    filter: 'M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z',
    calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
    'trend-up': 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
    'trend-down': 'M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181',
    card: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
    wallet: 'M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3',
    document: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    dots: 'M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z',
    grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
    scale: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.5l-3.75 8.25h7.5L18.75 4.5zm0 0V3m0 1.5c-.75 0-1.5.06-2.226.18M5.25 4.5l-3.75 8.25h7.5L5.25 4.5zm0 0V3m0 1.5c.75 0 1.5.06 2.226.18m12.75 0A48.34 48.34 0 0012 3.75c-2.51 0-4.973.19-7.383.556M2.25 12.75a4.5 4.5 0 006 0M15.75 12.75a4.5 4.5 0 006 0',
    barcode: 'M3.75 4.5v15M7.5 4.5v15M10.5 4.5v15M13.5 4.5v15M16.5 4.5v15M20.25 4.5v15',
    'arrow-right': 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
    'arrow-left': 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
    'arrow-up-right': 'M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25',
    clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
    'map-pin': 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
    'phone-call': 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
    key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
    shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    calculator: 'M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z',
    sparkles: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
    scan: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
    sun: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
    moon: 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
    palette: 'M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z',
    desktop: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
    wrench: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
    laptop: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
    cpu: 'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z',
    globe: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
    bag: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
    brush: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42',
    ticket: 'M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z',
    image: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
    video: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h8.25a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
    play: 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z',
    gallery: 'M6 3.75A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6zm10.06 5.19a1.5 1.5 0 11-2.12 2.122 1.5 1.5 0 012.12-2.122zM4.5 16.5l4.28-4.28a1.5 1.5 0 012.12 0l5.1 5.1',
    star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
    heart: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
    chat: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
    'shield-check': 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    'paint': 'M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z',
  };
  function icon(name, cls = 'w-5 h-5') {
    const d = ICONS[name] || ICONS.info;
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor" class="${cls}" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
  }

  /* --------------------------------------------------------------------- ui */
  const STATUS_STYLES = {
    // generic
    active: 'green', inactive: 'slate', enabled: 'green', disabled: 'slate',
    // imei
    available: 'green', sold: 'navy', in_transit: 'amber', returned: 'blue', defective: 'red',
    // sales
    completed: 'green', partially_returned: 'amber', void: 'red', paid: 'green', partial: 'amber', unpaid: 'red', due: 'red',
    // transfers
    pending: 'amber', approved: 'blue', shipped: 'navy', received: 'green', rejected: 'red', cancelled: 'slate',
    // closings
    open: 'amber', closed: 'green',
    // roles
    super_admin: 'purple', branch_manager: 'navy', cashier: 'slate',
    // payment methods
    cash: 'green', card: 'blue', jazzcash: 'red', easypaisa: 'green', bank_transfer: 'navy', store_credit: 'purple', credit: 'amber',
    // conditions
    good: 'green', low: 'amber', out: 'red', ok: 'green',
    new: 'green', used: 'amber', refurbished: 'blue',
    // product / device types
    device: 'navy', accessory: 'blue', part: 'amber', service: 'purple', mobile: 'navy', tablet: 'blue', smartwatch: 'purple', laptop: 'green', desktop: 'slate',
    imei: 'navy', serial: 'blue',
    // repair jobs
    received: 'amber', diagnosing: 'blue', awaiting_approval: 'amber', awaiting_parts: 'purple', in_progress: 'navy', ready: 'green', delivered: 'green',
    urgent: 'red', normal: 'slate', technician: 'green',
    // online orders / requests
    confirmed: 'blue', packed: 'purple', out_for_delivery: 'amber', cod: 'amber', contacted: 'blue', converted: 'green', published: 'green', draft: 'slate',
    // stock movement types
    purchase: 'blue', sale: 'navy', sale_return: 'amber', transfer_in: 'green', transfer_out: 'purple', transfer_return: 'amber', adjustment: 'slate', repair: 'purple', opening: 'slate', defective: 'red',
    supplier_return: 'amber', supplier_replacement: 'green', scrap: 'red',
    // supplier return workflow
    draft: 'slate', sent: 'amber', completed: 'green', returned_to_supplier: 'amber', scrapped: 'red',
    refund: 'green', replacement: 'blue', credit_note: 'navy',
    // purchase orders (draft -> ordered -> partial -> completed)
    ordered: 'blue', overdue: 'red', awaiting: 'amber',
    // stock take
    count_in: 'green', count_out: 'red', missing: 'red', counted: 'green', short: 'red', over: 'amber', matched: 'green', transit_loss: 'red',
    // PTA status of phones / tablets
    approved: 'green', non_pta: 'red', not_applicable: 'slate',
    // cashier shifts
    pay_in: 'green', pay_out: 'amber', bank_drop: 'navy', balanced: 'green',
    // banking & cheques
    deposit: 'green', withdrawal: 'amber', transfer_in: 'green', transfer_out: 'amber', receipt: 'green',
    charges: 'red', interest: 'green', cleared: 'green', deposited: 'blue', bounced: 'red', issued: 'navy', received: 'blue',
  };
  const STATUS_LABELS = { in_transit: 'In Transit', partially_returned: 'Partial Return', super_admin: 'Super Admin', branch_manager: 'Branch Manager', bank_transfer: 'Bank Transfer', store_credit: 'Store Credit', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa', void: 'Void', awaiting_approval: 'Awaiting Approval', awaiting_parts: 'Awaiting Parts', in_progress: 'In Progress', out_for_delivery: 'Out for Delivery', cod: 'Cash on Delivery', imei: 'IMEI', serial: 'Serial No.', part: 'Spare Part', device: 'Device', transfer_in: 'Transfer In', transfer_out: 'Transfer Out', transfer_return: 'Transfer Return', sale_return: 'Sale Return',
    supplier_return: 'Supplier Return', supplier_replacement: 'Replacement In', scrap: 'Written Off', scrapped: 'Written Off',
    returned_to_supplier: 'With Supplier', credit_note: 'Credit Note',
    count_in: 'Count Gain', count_out: 'Count Loss', missing: 'Missing', transit_loss: 'Lost in Transit', non_pta: 'Non-PTA', not_applicable: 'Not Applicable',
    pay_in: 'Cash In', pay_out: 'Cash Out', bank_drop: 'Bank Drop',
    transfer_in: 'Transfer In', transfer_out: 'Transfer Out', charges: 'Bank Charges', receipt: 'Money In', payment: 'Money Out' };
  const ui = {
    badge(status, label) {
      const s = String(status || '').toLowerCase();
      const color = STATUS_STYLES[s] || 'slate';
      return `<span class="badge badge-${color} badge-dot">${utils.escape(label || STATUS_LABELS[s] || utils.titleCase(s))}</span>`;
    },
    statusLabel(status) { const s = String(status || '').toLowerCase(); return STATUS_LABELS[s] || utils.titleCase(s); },
    /** A role chip in the role's own colour, labelled with its (editable) name. */
    roleBadge(key) {
      const r = roles.get(key);
      const color = r && ROLE_COLORS.includes(r.color) ? r.color : (STATUS_STYLES[key] || 'slate');
      return `<span class="badge badge-${color} badge-dot">${utils.escape(r ? r.name : roles.label(key))}</span>`;
    },
    toast(message, type = 'info', ms = 3200) {
      let wrap = document.getElementById('abm-toasts');
      if (!wrap) { wrap = document.createElement('div'); wrap.id = 'abm-toasts'; document.body.appendChild(wrap); }
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      const ic = { success: 'check-circle', error: 'x-circle', warning: 'warning', info: 'info' }[type] || 'info';
      el.innerHTML = icon(ic) + '<div class="flex-1">' + utils.escape(message) + '</div>';
      wrap.appendChild(el);
      setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }, ms);
    },
    success: (m) => ui.toast(m, 'success'),
    error: (m) => ui.toast(m, 'error'),
    warn: (m) => ui.toast(m, 'warning'),
    /** Promise-based confirm dialog. ui.confirm({title, message, confirmText, danger}) */
    confirm(opts = {}) {
      if (typeof opts === 'string') opts = { message: opts };
      return new Promise((resolve) => {
        const wrap = document.createElement('div');
        wrap.className = 'modal-backdrop';
        wrap.innerHTML = `
          <div class="modal-panel" style="max-width:26rem" role="dialog" aria-modal="true">
            <div class="modal-body">
              <div class="flex items-start gap-3">
                <div class="flex-none w-10 h-10 rounded-full flex items-center justify-center ${opts.danger ? 'bg-rose-100 text-rose-600' : 'bg-navy-50 text-navy-700'}">${icon(opts.danger ? 'warning' : 'info', 'w-5 h-5')}</div>
                <div class="min-w-0">
                  <h3 class="text-base font-bold text-slate-900">${utils.escape(opts.title || 'Are you sure?')}</h3>
                  <p class="text-sm text-slate-600 mt-1">${utils.escape(opts.message || '')}</p>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-act="cancel">${utils.escape(opts.cancelText || 'Cancel')}</button>
              <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${utils.escape(opts.confirmText || 'Confirm')}</button>
            </div>
          </div>`;
        const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
        const onKey = (e) => { if (e.key === 'Escape') done(false); };
        wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); const b = e.target.closest('[data-act]'); if (b) done(b.dataset.act === 'ok'); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(wrap);
        wrap.querySelector('[data-act="ok"]').focus();
      });
    },
    print() { window.print(); },
  };

  /* ------------------------------------------------------------------ shell */
  const shell = {
    activeKey(page) {
      for (const g of nav) for (const it of g.items) if (it.key === page || (it.match || []).includes(page)) return it.key;
      return page;
    },
    sidebarHtml(page) {
      const active = shell.activeKey(page);
      const u = session.user() || {};
      const branch = session.branch();
      let html = '';
      for (const g of nav) {
        const items = g.items.filter((it) => !it.perm || session.can(it.perm));
        if (!items.length) continue;
        if (g.section) html += `<div class="nav-section">${g.section}</div>`;
        html += items.map((it) => {
          let tail = it.highlight ? '<span class="nav-kbd">F2</span>' : '';
          if (it.badge === 'unreadMessages') { const n = shell.unreadMessages(); if (n) tail = `<span class="nav-badge">${n}</span>`; }
          return `<a href="${it.href}" class="nav-item ${it.key === active ? 'active' : ''}"${it.external ? ' target="_blank" rel="noopener"' : ''}>${icon(it.icon)}<span class="flex-1">${it.label}</span>${tail}</a>`;
        }).join('');
      }
      return `
      <aside id="abm-sidebar" :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'" class="fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform transition-transform duration-200 lg:translate-x-0 print:hidden">
        <div class="h-16 flex items-center gap-3 px-4 border-b sb-border">
          <span class="flex-none bg-white rounded-xl p-1 shadow-lg shadow-black/30 flex items-center justify-center">
            ${brand.img('h-9 w-9 object-contain', { fallbackClass: 'w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-black text-lg' })}
          </span>
          <div class="min-w-0">
            <div class="font-extrabold text-white leading-tight tracking-tight truncate">${utils.escape(brand.name())}</div>
            <div class="text-[11px] text-white/45 leading-tight truncate">${utils.escape(brand.tagline())}</div>
          </div>
          <button type="button" class="ml-auto lg:hidden text-white/50 hover:text-white" @click="sidebarOpen=false" aria-label="Close menu">${icon('x')}</button>
        </div>
        <div class="px-4 py-3 border-b sb-border">
          <div class="text-[10px] uppercase tracking-[.12em] text-white/40 font-bold">Active branch</div>
          <div class="flex items-center gap-2 mt-1">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/20">${utils.escape(branch ? branch.code : '—')}</span>
            <span class="text-sm font-semibold text-white truncate">${utils.escape(branch ? branch.name : 'No branch')}</span>
          </div>
        </div>
        <nav class="flex-1 overflow-y-auto scroll-thin px-3 py-2 space-y-0.5">${html}</nav>
        <div class="p-3 border-t sb-border">
          <div class="flex items-center gap-3 px-2 py-1">
            <div class="w-9 h-9 rounded-full bg-white/10 ring-1 ring-white/15 text-white flex items-center justify-center text-sm font-bold">${utils.escape(utils.initials(u.name))}</div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-white truncate">${utils.escape(u.name || '')}</div>
              <div class="text-[11px] text-white/45 truncate">${utils.escape(roles.label(u.role))}</div>
            </div>
            <a href="#" class="text-white/50 hover:text-white" title="Sign out" data-logout>${icon('logout')}</a>
          </div>
        </div>
      </aside>`;
    },
    topbarHtml(title) {
      const u = session.user() || {};
      const branches = db.all('branches').filter((b) => b.is_active);
      const branchSel = session.isSuperAdmin()
        ? `<div class="hidden sm:block"><select class="select input-sm !w-auto pr-8 font-semibold" data-branch-switch title="Switch active branch">${branches.map((b) => `<option value="${b.id}" ${b.id === session.branchId() ? 'selected' : ''}>${utils.escape(b.code)} · ${utils.escape(b.name)}</option>`).join('')}</select></div>`
        : `<div class="hidden sm:flex items-center gap-2 text-sm text-slate-600">${icon('building', 'w-4 h-4 text-slate-400')}<span class="font-semibold">${utils.escape(session.branch() ? session.branch().name : '')}</span></div>`;
      // Everything that is waiting for someone, each only for roles that can act on it
      const bid = session.branchId();
      const here = (b) => session.isSuperAdmin() || b == null || String(b) === String(bid);
      const lowStock = session.can('inventory.view') ? shell.lowStockCount() : 0;
      const pendingTransfers = session.can('transfers.view') ? db.all('stock_transfers').filter((t) => ['pending', 'shipped'].includes(t.status) && (session.isSuperAdmin() || t.to_branch_id === bid || t.from_branch_id === bid)).length : 0;
      const unreadMsgs = session.can('messages.view') ? shell.unreadMessages() : 0;
      const newOrders = session.can('orders.view') ? db.all('online_orders').filter((o) => o.status === 'pending' && here(o.branch_id)).length : 0;
      const unverified = session.can('orders.edit') ? db.all('online_orders').filter((o) => o.payment_status === 'unverified' && o.status !== 'cancelled' && here(o.branch_id)).length : 0;
      const requests = session.can('repairs.view') ? db.all('repair_requests').filter((r) => r.status === 'new' && here(r.preferred_branch_id)).length : 0;
      const approvals = session.can('inventory.approve') ? db.all('stock_adjustments').filter((a) => a.status === 'pending' && here(a.branch_id)).length : 0;
      const chequesDue = session.can('cheques.view') ? bank.cheque.due(session.isSuperAdmin() ? null : bid).length : 0;
      const notifCount = lowStock + pendingTransfers + unreadMsgs + newOrders + unverified + requests + approvals + chequesDue;
      const note = (n, href, ic, one, many) => (n ? `<a href="${href}" class="dropdown-item">${icon(ic)}<span><b>${n}</b> ${n > 1 ? many : one}</span></a>` : '');
      return `
      <header id="abm-topbar" class="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 sm:px-6 print:hidden">
        <button type="button" class="btn btn-ghost btn-icon lg:hidden -ml-2" @click="sidebarOpen=true" aria-label="Open menu">${icon('menu')}</button>
        <h1 class="text-base sm:text-lg font-bold text-slate-900 truncate">${utils.escape(title)}</h1>
        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          ${branchSel}
          ${session.can('pos.view') ? `<a href="pos.html" class="btn btn-money btn-sm hidden md:inline-flex">${icon('cart')}New Sale</a>` : ''}
          <button type="button" class="btn btn-ghost btn-icon" data-theme-toggle title="Toggle dark mode" aria-label="Toggle dark mode">${icon(theme.isDark() ? 'sun' : 'moon')}</button>
          <div class="relative" x-data="{open:false}">
            <button type="button" class="btn btn-ghost btn-icon relative" @click="open=!open" aria-label="Notifications">${icon('bell')}${notifCount ? `<span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">${notifCount}</span>` : ''}</button>
            <div x-show="open" x-cloak @click.outside="open=false" class="dropdown right-0 mt-2 w-80">
              <div class="px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Notifications</div>
              ${note(newOrders, 'online-orders.html?status=pending', 'bag', 'new web order to confirm', 'new web orders to confirm')}
              ${note(unverified, 'online-orders.html', 'banknotes', 'web payment to verify', 'web payments to verify')}
              ${note(requests, 'repairs.html', 'wrench', 'repair request from the website', 'repair requests from the website')}
              ${note(approvals, 'stock.html', 'scale', 'stock adjustment waiting for approval', 'stock adjustments waiting for approval')}
              ${note(chequesDue, 'cheques.html', 'document', 'cheque due or overdue', 'cheques due or overdue')}
              ${note(lowStock, 'stock.html?filter=low', 'warning', 'product at or below minimum stock', 'products at or below minimum stock')}
              ${note(pendingTransfers, 'transfers.html', 'transfer', 'transfer awaiting action', 'transfers awaiting action')}
              ${note(unreadMsgs, 'inbox.html', 'mail', 'unread website message', 'unread website messages')}
              ${!notifCount ? '<div class="px-2.5 py-3 text-sm text-slate-500">You are all caught up.</div>' : ''}
            </div>
          </div>
          <div class="relative" x-data="{open:false}">
            <button type="button" class="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-100" @click="open=!open" data-user-menu aria-label="User menu">
              <div class="w-8 h-8 rounded-full bg-navy-800 text-white flex items-center justify-center text-xs font-bold">${utils.escape(utils.initials(u.name))}</div>
              <div class="hidden sm:block text-left"><div class="text-sm font-semibold text-slate-800 leading-tight">${utils.escape(u.name || '')}</div><div class="text-[11px] text-slate-500 leading-tight">${utils.escape(roles.label(u.role))}</div></div>
              ${icon('chevron-down', 'w-4 h-4 text-slate-400 hidden sm:block')}
            </button>
            <div x-show="open" x-cloak @click.outside="open=false" class="dropdown right-0 mt-2 w-72">
              <div class="px-2.5 py-2 min-w-0"><div class="text-sm font-semibold text-slate-800 truncate">${utils.escape(u.name || '')}</div><div class="text-xs text-slate-500 truncate">${utils.escape(u.email || '')}</div></div>
              <div class="dropdown-divider"></div>
              <a href="profile.html" class="dropdown-item">${icon('user')}My profile</a>
              <div class="dropdown-divider"></div>
              <div class="dropdown-label">Appearance</div>
              <div class="px-2.5 pb-2 grid grid-cols-3 gap-1.5">
                ${['light', 'dark', 'system'].map((m) => `<button type="button" class="btn btn-sm !px-1.5 text-xs min-w-0 ${theme.get().mode === m ? 'btn-primary' : 'btn-secondary'}" data-theme-mode="${m}" title="${m} mode">${icon(m === 'light' ? 'sun' : m === 'dark' ? 'moon' : 'desktop', 'w-4 h-4 flex-none')}<span class="truncate">${m.charAt(0).toUpperCase() + m.slice(1)}</span></button>`).join('')}
              </div>
              <div class="px-2.5 pb-2 flex items-center gap-2">
                ${theme.ACCENTS.map((a) => `<button type="button" class="theme-swatch ${theme.get().accent === a.key ? 'active' : ''}" style="background:${a.swatch}" data-accent="${a.key}" title="${a.label} accent" aria-label="${a.label} accent"></button>`).join('')}
                <label class="theme-swatch theme-swatch-custom ${theme.get().accent === 'custom' ? 'active' : ''}" title="Pick any colour" style="background:${theme.get().accent === 'custom' ? utils.escape(theme.get().custom || '#1a336a') : 'conic-gradient(#f43f5e,#f59e0b,#10b981,#0ea5e9,#8b5cf6,#f43f5e)'}">
                  <input type="color" data-accent-custom value="${utils.escape(theme.get().custom || '#1a336a')}" aria-label="Custom accent colour" class="opacity-0 w-0 h-0 absolute">
                </label>
                <span class="text-[11px] text-slate-500 ml-1">Accent</span>
              </div>
              ${session.isSuperAdmin() ? `<div class="sm:hidden"><div class="px-2.5 pt-2 pb-1 text-[11px] font-bold uppercase text-slate-500">Branch</div><div class="px-2.5 pb-2"><select class="select input-sm" data-branch-switch>${branches.map((b) => `<option value="${b.id}" ${b.id === session.branchId() ? 'selected' : ''}>${utils.escape(b.name)}</option>`).join('')}</select></div></div>` : ''}
              ${shell.demoMode() ? `<div class="dropdown-divider"></div>
              <div class="px-2.5 pt-1 pb-1 text-[11px] font-bold uppercase text-slate-500">Demo: switch user</div>
              ${db.all('users').filter((x) => x.is_active && !session.blockedReason(x)).map((x) => `<button type="button" class="dropdown-item ${x.id === u.id ? 'bg-slate-50' : ''}" data-switch-user="${x.id}">${icon(roles.isFull(x.role) ? 'shield' : roles.isBench(x.role) ? 'wrench' : roles.has(x.role, 'dashboard.view') ? 'building' : 'cart')}<span class="flex-1 truncate">${utils.escape(x.name)}</span><span class="text-[10px] text-slate-400">${utils.escape(roles.label(x.role))}</span></button>`).join('')}
              <div class="dropdown-divider"></div>
              <button type="button" class="dropdown-item" data-reset-demo>${icon('refresh')}Reset demo data</button>` : ''}
              <a href="help.html" class="dropdown-item">${icon('info')}Help &amp; getting started</a>
              <button type="button" class="dropdown-item" data-lock-now>${icon('lock')}Lock screen</button>
              <button type="button" class="dropdown-item text-rose-600" data-logout>${icon('logout')}Sign out</button>
            </div>
          </div>
        </div>
      </header>`;
    },
    lowStockCount() {
      // Settings → 'Low-stock alerts' can switch the bell off; services and untracked items never run low
      if (!db.setting('low_stock_alerts', 1)) return 0;
      const bid = session.branchId();
      return db.all('products').filter((p) => p.is_active && db.isStockTracked(p) && Number(p.min_stock) > 0 && db.stockQty(bid, p.id) <= p.min_stock).length;
    },
    /** Website messages nobody has opened yet (drives the sidebar badge and the bell). */
    unreadMessages() { return db.all('contact_messages').filter((m) => m.status === 'new').length; },
    forbiddenHtml(perm) {
      return `<div class="max-w-lg mx-auto mt-16 card"><div class="card-body text-center py-12">
        <div class="mx-auto w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">${icon('lock', 'w-7 h-7')}</div>
        <h2 class="text-xl font-bold text-slate-900">Access restricted</h2>
        <p class="text-sm text-slate-600 mt-2">Your role (<b>${utils.escape(session.roleLabel())}</b>) is not allowed to <b>${utils.escape(roles.describe(perm))}</b>. Ask a Super Admin to add it under Roles &amp; Permissions if you need access.</p>
        <div class="mt-6 flex justify-center gap-2"><a href="${session.homeFor(session.role())}" class="btn btn-primary">Go to my home</a><button type="button" class="btn btn-secondary" onclick="history.back()">Go back</button></div>
      </div></div>`;
    },
    render() {
      const body = document.body;
      if (body.dataset.public !== undefined) return; // login and print-only pages render themselves
      if (!session.require()) return;
      const page = body.dataset.page || '';
      const title = body.dataset.title || document.title.split('·')[0].trim();
      const perm = body.dataset.perm;
      const main = document.querySelector('main');
      if (!main) return;
      const wrap = document.createElement('div');
      wrap.setAttribute('x-data', '{ sidebarOpen: false }');
      wrap.className = 'min-h-screen bg-slate-100';
      wrap.innerHTML = `
        <div x-show="sidebarOpen" x-cloak class="fixed inset-0 z-40 bg-slate-900/60 lg:hidden" @click="sidebarOpen=false"></div>
        ${shell.sidebarHtml(page)}
        <div class="lg:pl-64 flex flex-col min-h-screen">
          ${shell.topbarHtml(title)}
          <div id="abm-main-slot" class="flex-1"></div>
          <footer class="px-4 sm:px-6 py-4 text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1 print:hidden">
            <span>© ${new Date().getFullYear()} Abbott Mobile</span><span>Frontend prototype v${VERSION} · demo data stored in this browser</span>
          </footer>
        </div>`;
      main.parentNode.insertBefore(wrap, main);
      const slot = wrap.querySelector('#abm-main-slot');
      slot.appendChild(main);
      main.classList.add('p-4', 'sm:p-6', 'lg:p-8', 'max-w-[1600px]', 'w-full', 'mx-auto');
      // data-perm="a|b" lets a page open for either permission (a create page that also edits); the page checks which.
      const perms = perm ? perm.split('|').map((p) => p.trim()).filter(Boolean) : [];
      if (perms.length && !perms.some((p) => session.can(p))) {
        // Replace the page and make sure its Alpine component never boots against the placeholder markup.
        ['x-data', 'x-init', 'x-effect'].forEach((a) => main.removeAttribute(a));
        main.innerHTML = shell.forbiddenHtml(perms[0]);
        document.querySelectorAll('body > .modal-backdrop, body > [x-data]:not(#abm-root)').forEach((n) => { if (!wrap.contains(n)) n.remove(); });
      }
      // shell interactions
      wrap.addEventListener('click', async (e) => {
        const tt = e.target.closest('[data-theme-toggle]');
        if (tt) { theme.toggle(); tt.innerHTML = icon(theme.isDark() ? 'sun' : 'moon'); return; }
        const tm = e.target.closest('[data-theme-mode]');
        if (tm) { theme.set({ mode: tm.dataset.themeMode }); wrap.querySelectorAll('[data-theme-mode]').forEach((b) => { b.classList.toggle('btn-primary', b === tm); b.classList.toggle('btn-secondary', b !== tm); }); const t = wrap.querySelector('[data-theme-toggle]'); if (t) t.innerHTML = icon(theme.isDark() ? 'sun' : 'moon'); return; }
        const ac = e.target.closest('[data-accent]');
        if (ac) { theme.set({ accent: ac.dataset.accent }); wrap.querySelectorAll('[data-accent]').forEach((b) => b.classList.toggle('active', b === ac)); return; }
        const logout = e.target.closest('[data-logout]');
        if (logout) { e.preventDefault(); session.logout(); location.href = 'login.html'; return; }
        const sw = e.target.closest('[data-switch-user]');
        // demo aids exist only while Settings → Demo mode is on (they must be off before real use)
        if (sw) { if (!shell.demoMode()) return; const user = db.find('users', sw.dataset.switchUser); if (user && !session.blockedReason(user)) { session.logout(); session.login(user); location.href = session.homeFor(user.role); } return; }
        if (e.target.closest('[data-lock-now]')) { shell.lockNow(); return; }
        const reset = e.target.closest('[data-reset-demo]');
        if (reset) { if (!shell.demoMode()) return; if (await ui.confirm({ title: 'Reset demo data?', message: 'All changes you made in this browser will be discarded and the sample data reloaded.', confirmText: 'Reset', danger: true })) { const me = session.user(); const uid = me.id; db.reset(); const u = db.find('users', uid) || db.all('users')[0]; session.logout(); session.login(u); db.audit('data.reset', 'settings', null, 'Demo data reset by ' + me.name, null); location.reload(); } }
      });
      wrap.querySelectorAll('[data-branch-switch]').forEach((sel) => sel.addEventListener('change', () => { session.setBranch(sel.value); location.reload(); }));
      wrap.querySelectorAll('[data-accent-custom]').forEach((inp) => {
        const applyCustom = () => { theme.set({ accent: 'custom', custom: inp.value }); wrap.querySelectorAll('[data-accent]').forEach((b) => b.classList.remove('active')); const lbl = inp.closest('.theme-swatch'); if (lbl) { lbl.classList.add('active'); lbl.style.background = inp.value; } };
        inp.addEventListener('input', utils.debounce(applyCustom, 60));
        inp.addEventListener('change', applyCustom);
        inp.addEventListener('click', (e) => e.stopPropagation());
      });
      // global shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F2' && session.can('pos.view')) { e.preventDefault(); location.href = 'pos.html'; }
      });
      shell.idleLock();
      shell.layoutDebug();
    },
    /** Demo aids (switch user, reset demo data) — Settings → Demo mode; turn it off before real use. */
    demoMode() { return !!db.setting('demo_mode', 1); },
    /**
     * Idle lock: after settings.idle_lock_minutes (0 = off) with no mouse / keyboard / touch, the screen locks
     * and only the signed-in user's password opens it again. The lock survives a reload (it is on the session).
     */
    idleLock() {
      const s = session.load();
      if (s && s.locked) shell.showLock();
      const mins = Number(db.setting('idle_lock_minutes', 30)) || 0;
      if (!mins) return;
      let last = Date.now();
      const touch = () => { last = Date.now(); };
      ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
      setInterval(() => { if (!document.getElementById('abm-lock') && Date.now() - last > mins * 60000) shell.lockNow(); }, 20000);
    },
    lockNow() { const s = session.load(); if (!s) return; s.locked = true; session.save(); shell.showLock(); },
    showLock() {
      if (document.getElementById('abm-lock') || !document.body) return;
      const u = session.user() || {};
      const el = document.createElement('div');
      el.id = 'abm-lock';
      el.className = 'fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md print:hidden';
      el.innerHTML = `<form class="w-full max-w-sm card" data-lock-form><div class="card-body text-center">
        <div class="mx-auto w-14 h-14 rounded-full bg-navy-800 text-white flex items-center justify-center text-lg font-bold mb-3">${utils.escape(utils.initials(u.name))}</div>
        <div class="text-lg font-bold text-slate-900">${utils.escape(u.name || '')}</div>
        <div class="text-sm text-slate-500 mb-4">Screen locked — enter your password to carry on.</div>
        <input type="password" class="input input-lg text-center" data-lock-pw placeholder="Password" autocomplete="current-password" aria-label="Password">
        <p class="field-error mt-2" data-lock-err hidden></p>
        <button type="submit" class="btn btn-primary btn-lg btn-block mt-4">${icon('lock', 'w-4 h-4')}Unlock</button>
        <button type="button" class="btn btn-ghost btn-sm mt-2" data-lock-out>Sign out instead</button>
      </div></form>`;
      let tries = 0;
      el.querySelector('[data-lock-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const pw = el.querySelector('[data-lock-pw]').value;
        if (session.verifyPassword(u, pw)) { const s = session.load(); if (s) { s.locked = false; session.save(); } el.remove(); return; }
        tries += 1;
        db.audit('session.unlock_failed', 'user', u.id, `Wrong password on the lock screen for ${u.username}`, u.branch_id);
        if (tries >= 5) { session.logout(); location.href = 'login.html'; return; }
        const err = el.querySelector('[data-lock-err]'); err.hidden = false; err.textContent = 'That password is not correct.';
      });
      el.querySelector('[data-lock-out]').addEventListener('click', () => { session.logout(); location.href = 'login.html'; });
      document.body.appendChild(el);
      setTimeout(() => { const i = el.querySelector('[data-lock-pw]'); if (i) i.focus(); }, 30);
    },
    /** Another tab changed the data: new writes already use it, but this page's lists were drawn from the old copy. */
    staleNotice() {
      if (!document.body || document.body.dataset.public !== undefined || document.getElementById('abm-stale')) return;
      const bar = document.createElement('div');
      bar.id = 'abm-stale';
      bar.setAttribute('role', 'status');
      bar.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] flex items-center gap-3 rounded-xl bg-slate-900 text-white shadow-xl px-4 py-2.5 text-sm print:hidden';
      bar.innerHTML = `${icon('refresh', 'w-4 h-4 flex-none text-amber-300')}<span class="min-w-0">Data was changed in another tab — this screen may be out of date.</span><button type="button" class="btn btn-sm btn-primary flex-none" data-stale-reload>Reload</button><button type="button" class="text-white/60 hover:text-white flex-none" aria-label="Dismiss" data-stale-close>${icon('x', 'w-4 h-4')}</button>`;
      bar.addEventListener('click', (e) => {
        if (e.target.closest('[data-stale-reload]')) location.reload();
        else if (e.target.closest('[data-stale-close]')) bar.remove();
      });
      document.body.appendChild(bar);
    },
    /** Dev aids: ?__click=<css selector> clicks that element after load (open a modal/menu for screenshots);
     *  ?__layout=1 logs elements that overflow the viewport width (mobile QA). */
    layoutDebug() {
      const clickSel = new URLSearchParams(location.search).get('__click');
      if (clickSel) {
        // Poll for the element: Alpine (CDN) may not have rendered it yet, and headless virtual time
        // collapses fixed delays, so a single setTimeout is flaky.
        let tries = 0;
        const tryClick = () => {
          tries++;
          try {
            const el = document.querySelector(clickSel);
            if (el) { el.click(); return; }
          } catch (e) { console.log('ABM_CLICK error: ' + e.message); return; }
          if (tries < 40) setTimeout(tryClick, 100); else console.log('ABM_CLICK not found: ' + clickSel);
        };
        setTimeout(tryClick, 300);
      }
      if (!/[?&]__layout=1/.test(location.search)) return;
      setTimeout(() => {
        const vw = document.documentElement.clientWidth;
        const bad = [];
        const inScroller = (el) => { let p = el.parentElement; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; p = p.parentElement; } return false; };
        document.querySelectorAll('body *').forEach((el) => {
          if (el.closest('#abm-sidebar') || el.closest('[x-cloak]')) return;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > vw + 1 && !el.closest('.dropdown') && !inScroller(el)) {
            const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 4).join('.') : '';
            const par = el.parentElement, pcls = (par && typeof par.className === 'string') ? par.className.split(' ').slice(0, 3).join('.') : '';
            const text = String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
            bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''} right=${Math.round(r.right)} w=${Math.round(r.width)} in<${par ? par.tagName.toLowerCase() : '?'}${pcls ? '.' + pcls : ''}> "${text}"`);
          }
        });
        console.log('ABM_LAYOUT viewport=' + vw + ' scrollWidth=' + document.documentElement.scrollWidth + ' overflowing=' + bad.length);
        bad.slice(0, 25).forEach((b) => console.log('ABM_LAYOUT_OVERFLOW ' + b));
      }, 1200);
    },
  };

  /* ------------------------------------------------------------ services */
  /**
   * Stock service — the ONLY way pages should change stock. Mirrors the backend StockService so the
   * logic ports 1:1. Every call keeps branch_stock.quantity / avg_cost in sync and appends a
   * stock_movements row. Throws Error with a user-readable message on invalid operations.
   */
  const SELLABLE = ['available', 'returned'];
  const stock = {
    SELLABLE,
    row(branchId, productId, create = true) {
      let r = db.first('branch_stock', (s) => s.branch_id == branchId && s.product_id == productId);
      if (!r && create) r = db.insert('branch_stock', { branch_id: Number(branchId), product_id: Number(productId), quantity: 0, avg_cost: 0 });
      return r;
    },
    qty(branchId, productId) { const r = stock.row(branchId, productId, false); return r ? r.quantity : 0; },
    movement(branchId, productId, type, qty, unitCost, ref = {}, imeiId = null, notes = '') {
      const r = stock.row(branchId, productId);
      return db.insert('stock_movements', { branch_id: Number(branchId), product_id: Number(productId), imei_id: imeiId, movement_type: type, quantity: qty, unit_cost: utils.round2(unitCost || 0), balance_after: r.quantity, reference_type: ref.type || null, reference_id: ref.id || null, notes, user_id: (session.user() || {}).id || null, ...(ref.reasonCode ? { reason_code: ref.reasonCode } : {}) });
    },
    /** Increase quantity (non-IMEI or per IMEI unit). Maintains weighted-average cost. */
    add(branchId, productId, qty, unitCost, type = 'purchase', ref = {}, imeiId = null, notes = '') {
      qty = Number(qty); if (!(qty > 0)) throw new Error('Quantity must be greater than zero.');
      const r = stock.row(branchId, productId);
      const cost = Number(unitCost) || 0;
      r.avg_cost = r.quantity + qty > 0 ? utils.round2((r.avg_cost * r.quantity + cost * qty) / (r.quantity + qty)) : cost;
      r.quantity += qty; r.updated_at = utils.now(); db.save();
      stock.movement(branchId, productId, type, qty, cost, ref, imeiId, notes);
      return r;
    },
    /** Decrease quantity. Returns the unit cost consumed (avg cost, or the given cost for IMEI units). */
    remove(branchId, productId, qty, type = 'sale', ref = {}, opts = {}) {
      qty = Number(qty); if (!(qty > 0)) throw new Error('Quantity must be greater than zero.');
      const r = stock.row(branchId, productId);
      if (r.quantity < qty && !db.setting('allow_negative_stock')) throw new Error(`Insufficient stock for ${db.productLabel(productId)} at ${db.branchName(branchId)} (available ${r.quantity}, requested ${qty}).`);
      const cost = opts.unitCost != null ? Number(opts.unitCost) : r.avg_cost;
      // A unit leaving at its OWN cost (a serialized phone) takes exactly that value off the shelf, so the
      // average of what remains has to move: (avg × qty − cost × n) / (qty − n). Leaving at the average
      // cost changes nothing, which is why this only matters when unitCost is given.
      if (opts.unitCost != null && r.quantity - qty > 0) {
        r.avg_cost = Math.max(0, utils.round2(((Number(r.avg_cost) || 0) * r.quantity - cost * qty) / (r.quantity - qty)));
      }
      r.quantity -= qty; r.updated_at = utils.now(); db.save();
      stock.movement(branchId, productId, type, -qty, cost, ref, opts.imeiId || null, opts.notes || '');
      return cost;
    },
    /** Why stock was adjusted by hand; kept on the movement as reason_code (reports group by it). */
    ADJUST_REASONS: { damaged: 'Damaged', lost: 'Lost / stolen', expired: 'Expired / obsolete', internal_use: 'Used in the shop', found: 'Found', recount: 'Recount correction', opening: 'Opening stock', other: 'Other' },
    /** Set an absolute quantity (stock-take / adjustment) for non-IMEI products. reasonCode: a key of ADJUST_REASONS. */
    adjust(branchId, productId, newQty, reason = '', unitCost = null, reasonCode = null) {
      const r = stock.row(branchId, productId);
      const diff = Number(newQty) - r.quantity;
      if (diff === 0) return r;
      const ref = reasonCode ? { reasonCode } : {};
      if (diff > 0) return stock.add(branchId, productId, diff, unitCost != null ? unitCost : r.avg_cost, 'adjustment', ref, null, reason);
      stock.remove(branchId, productId, -diff, 'adjustment', ref, { notes: reason });
      return r;
    },
    /** Normalise a scanned/typed unit identifier: IMEIs keep digits only, serial numbers are trimmed & upper-cased. */
    normalizeSerial(value, serialType = 'imei') {
      const v = String(value || '').trim();
      return serialType === 'serial' ? (db.setting('serial_uppercase', 1) ? v.toUpperCase() : v) : v.replace(/\s+/g, '');
    },
    /**
     * Validate a unit identifier for a product. IMEI-type products need exactly 15 digits (optional Luhn check);
     * serial-type products (laptops, desktops) accept 4–40 letters/digits/-/_/./. Throws a readable Error; returns the normalised value.
     */
    validateSerial(value, product = null) {
      const p = product && typeof product === 'object' ? product : (product ? db.find('products', product) : null);
      const type = p ? db.serialType(p) : 'imei';
      const v = stock.normalizeSerial(value, type);
      const label = type === 'serial' ? 'Serial number' : 'IMEI';
      if (type === 'serial') { if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{3,39}$/.test(v)) throw new Error(`${label} "${v}" must be 4–40 letters, digits or - _ . /`); }
      else { if (!utils.isValidImei(v)) throw new Error(`IMEI "${v}" must be exactly 15 digits.`); if (db.setting('imei_luhn_check') && !utils.luhnValid(v)) throw new Error(`IMEI ${v} failed the Luhn check digit.`); }
      if (db.first('product_imeis', (i) => String(i.imei).toUpperCase() === v.toUpperCase())) throw new Error(`${label} ${v} is already registered.`);
      return v;
    },
    /** Backwards-compatible alias (IMEI rules unless a product is given). */
    validateImei(imei, product = null) { return stock.validateSerial(imei, product); },
    /** Register new serialized units — IMEIs or serial numbers (purchase / opening stock). Returns inserted rows. */
    addImeis(branchId, productId, imeis, unitCost, type = 'purchase', ref = {}, extra = {}) {
      const product = db.find('products', productId);
      if (!product) throw new Error('Product not found.');
      const serialType = db.serialType(product);
      const clean = [...new Set(imeis.map((s) => stock.normalizeSerial(s, serialType)).filter(Boolean))];
      clean.forEach((i) => stock.validateSerial(i, product));
      return clean.map((imei) => {
        // per-unit details (used, refurbished and open-box units differ from their siblings): grade A-D, battery %,
        // PTA status, a unit-specific selling price, and where the unit came from (purchase, buy-back, opening…)
        const unit = {};
        ['grade', 'battery_health', 'pta_status', 'sale_price', 'accessories', 'source', 'buyback_id'].forEach((k) => { if (extra[k] != null && extra[k] !== '') unit[k] = extra[k]; });
        const row = db.insert('product_imeis', { product_id: Number(productId), branch_id: Number(branchId), imei, imei2: extra.imei2 || null, serial_type: serialType, status: 'available', cost_price: utils.round2(unitCost), purchase_item_id: ref.purchaseItemId || null, sale_item_id: null, notes: extra.notes || '', ...unit });
        stock.add(branchId, productId, 1, unitCost, type, ref, row.id);
        return row;
      });
    },
    addSerials(branchId, productId, serials, unitCost, type = 'purchase', ref = {}, extra = {}) { return stock.addImeis(branchId, productId, serials, unitCost, type, ref, extra); },
    /** Find a sellable unit at a branch by IMEI or serial (case-insensitive). Returns row or null. */
    findSellable(imei, branchId) { const v = String(imei || '').trim().toUpperCase().replace(/\s+/g, ''); return db.first('product_imeis', (i) => String(i.imei).toUpperCase() === v && i.branch_id == branchId && SELLABLE.includes(i.status)); },
    /** Find any unit anywhere by IMEI / serial (for lookups & repair intake). */
    findUnit(imei) { const v = String(imei || '').trim().toUpperCase().replace(/\s+/g, ''); return db.first('product_imeis', (i) => String(i.imei).toUpperCase() === v || String(i.imei2 || '').toUpperCase() === v); },
    sellImei(imeiId, branchId, saleItemId, saleId) {
      const i = db.find('product_imeis', imeiId);
      if (!i || i.branch_id != branchId || !SELLABLE.includes(i.status)) throw new Error('IMEI is not available for sale at this branch.');
      const cost = stock.remove(branchId, i.product_id, 1, 'sale', { type: 'sale', id: saleId }, { imeiId: i.id, unitCost: i.cost_price });
      db.update('product_imeis', i.id, { status: 'sold', sale_item_id: saleItemId });
      return cost;
    },
    /** Sale return: good → back to sellable stock as 'returned' (open box); defective → 'defective', not counted. */
    returnImei(imeiId, branchId, condition = 'good', ref = {}, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i || i.status !== 'sold') throw new Error('Only sold IMEIs can be returned.');
      if (condition === 'good') { stock.add(branchId, i.product_id, 1, i.cost_price, 'sale_return', ref, i.id, notes); db.update('product_imeis', i.id, { status: 'returned', branch_id: Number(branchId), sale_item_id: null, notes }); }
      else { stock.movement(branchId, i.product_id, 'defective', 0, i.cost_price, ref, i.id, notes); db.update('product_imeis', i.id, { status: 'defective', branch_id: Number(branchId), notes }); }
      return i;
    },
    markDefective(imeiId, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i || !SELLABLE.includes(i.status)) throw new Error('Only in-stock IMEIs can be marked defective.');
      stock.remove(i.branch_id, i.product_id, 1, 'defective', {}, { imeiId: i.id, unitCost: i.cost_price, notes });
      db.update('product_imeis', i.id, { status: 'defective', notes });
    },
    /**
     * Send a faulty unit back to the supplier.
     * A defective unit has already left branch_stock (markDefective removed it), so this only changes
     * status and records the movement. A unit that is still sellable is removed from stock here.
     */
    returnToSupplier(imeiId, ref = {}, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i) throw new Error('Unit not found.');
      if (['returned_to_supplier', 'scrapped', 'sold', 'in_transit'].includes(i.status)) {
        throw new Error(`This unit is ${utils.titleCase(i.status)} and cannot be sent back to the supplier.`);
      }
      if (SELLABLE.includes(i.status)) stock.remove(i.branch_id, i.product_id, 1, 'supplier_return', ref, { imeiId: i.id, unitCost: i.cost_price, notes });
      else stock.movement(i.branch_id, i.product_id, 'supplier_return', 0, i.cost_price, ref, i.id, notes);
      db.update('product_imeis', i.id, { status: 'returned_to_supplier', notes });
      return i;
    },
    /** Supplier could not help: write the unit off for good. */
    scrapImei(imeiId, ref = {}, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i) throw new Error('Unit not found.');
      if (i.status === 'scrapped') throw new Error('This unit is already written off.');
      if (SELLABLE.includes(i.status)) stock.remove(i.branch_id, i.product_id, 1, 'scrap', ref, { imeiId: i.id, unitCost: i.cost_price, notes });
      else stock.movement(i.branch_id, i.product_id, 'scrap', 0, i.cost_price, ref, i.id, notes);
      db.update('product_imeis', i.id, { status: 'scrapped', notes });
      return i;
    },
    /** The supplier sent a replacement: bring the unit back into stock at the original cost. */
    receiveReplacement(imeiId, serial, ref = {}, notes = '') {
      const old = db.find('product_imeis', imeiId);
      if (!old) throw new Error('Original unit not found.');
      if (old.status !== 'returned_to_supplier') throw new Error('Only units sent back to the supplier can be replaced.');
      const product = db.find('products', old.product_id);
      const clean = stock.validateSerial(serial, product);
      const row = db.insert('product_imeis', {
        product_id: old.product_id, branch_id: old.branch_id, imei: clean, imei2: null,
        serial_type: db.serialType(product), status: 'available', cost_price: old.cost_price,
        purchase_item_id: old.purchase_item_id, sale_item_id: null,
        notes: `Replacement for ${old.imei}${notes ? ' · ' + notes : ''}`, replaced_imei_id: old.id,
      });
      stock.add(old.branch_id, old.product_id, 1, old.cost_price, 'supplier_replacement', ref, row.id, notes);
      db.update('product_imeis', old.id, { status: 'scrapped', notes: `Replaced by ${clean}` });
      return row;
    },
    /** Non-serialized goods going back to the supplier (damaged box, wrong item). */
    removeForSupplierReturn(branchId, productId, qty, ref = {}, notes = '') {
      return stock.remove(branchId, productId, qty, 'supplier_return', ref, { notes });
    },
    restoreImei(imeiId, notes = '') { // defective -> available again (e.g. repaired)
      const i = db.find('product_imeis', imeiId);
      if (!i || i.status !== 'defective') throw new Error('Only defective IMEIs can be restored.');
      stock.add(i.branch_id, i.product_id, 1, i.cost_price, 'adjustment', {}, i.id, notes);
      db.update('product_imeis', i.id, { status: 'available', notes });
    },

    /* ------------------------------------------------------------ stock take
     * A physical count posts its variance through these four calls, always against the count
     * (`ref = {type:'stock_count', id}`), so `count_in` / `count_out` movements can be told apart
     * from a manual adjustment in the inventory report. */

    /** Set the counted quantity for a non-serialized product. Returns the signed variance (0 = nothing posted). */
    countAdjust(branchId, productId, countedQty, ref = {}, notes = '') {
      const counted = Number(countedQty);
      if (!Number.isFinite(counted) || counted < 0) throw new Error('Counted quantity must be zero or more.');
      const r = stock.row(branchId, productId);
      const diff = counted - r.quantity;
      if (diff === 0) return 0;
      if (diff > 0) stock.add(branchId, productId, diff, r.avg_cost, 'count_in', ref, null, notes);
      else stock.remove(branchId, productId, -diff, 'count_out', ref, { notes });
      return diff;
    },
    /** A registered unit the count could not find: off the shelf, off the books, still on record. */
    markMissing(imeiId, ref = {}, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i) throw new Error('Unit not found.');
      if (i.status === 'missing') throw new Error('This unit is already marked missing.');
      if (!SELLABLE.includes(i.status)) throw new Error(`Only stock on the shelf can go missing — this unit is ${ui.statusLabel(i.status)}.`);
      stock.remove(i.branch_id, i.product_id, 1, 'count_out', ref, { imeiId: i.id, unitCost: i.cost_price, notes });
      db.update('product_imeis', i.id, { status: 'missing', notes });
      return i;
    },
    /** A unit written off as missing has turned up again. */
    markFound(imeiId, ref = {}, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i) throw new Error('Unit not found.');
      if (i.status !== 'missing') throw new Error('Only a missing unit can be marked found.');
      stock.add(i.branch_id, i.product_id, 1, i.cost_price, 'count_in', ref, i.id, notes);
      db.update('product_imeis', i.id, { status: 'available', notes });
      return i;
    },
    /** A unit counted at a branch the registry did not expect: move it, keeping both branches' stock right. */
    moveCountedUnit(imeiId, toBranchId, ref = {}, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i) throw new Error('Unit not found.');
      if (String(i.branch_id) === String(toBranchId)) return i;
      if (!SELLABLE.includes(i.status) && i.status !== 'missing') throw new Error(`This unit is ${ui.statusLabel(i.status)} and cannot be moved by a count.`);
      if (SELLABLE.includes(i.status)) stock.remove(i.branch_id, i.product_id, 1, 'count_out', ref, { imeiId: i.id, unitCost: i.cost_price, notes: notes || 'Counted at another branch' });
      db.update('product_imeis', i.id, { branch_id: Number(toBranchId), status: 'available', notes });
      stock.add(toBranchId, i.product_id, 1, i.cost_price, 'count_in', ref, i.id, notes || 'Found by stock take');
      return db.find('product_imeis', imeiId);
    },
    shipImei(imeiId, fromBranchId, transferId) {
      const i = db.find('product_imeis', imeiId);
      if (!i || i.branch_id != fromBranchId || !SELLABLE.includes(i.status)) throw new Error(`IMEI ${i ? i.imei : imeiId} is not available at the source branch.`);
      stock.remove(fromBranchId, i.product_id, 1, 'transfer_out', { type: 'transfer', id: transferId }, { imeiId: i.id, unitCost: i.cost_price });
      db.update('product_imeis', i.id, { status: 'in_transit' });
    },
    receiveImei(imeiId, toBranchId, transferId) {
      const i = db.find('product_imeis', imeiId);
      if (!i || i.status !== 'in_transit') throw new Error(`IMEI ${i ? i.imei : imeiId} is not in transit.`);
      db.update('product_imeis', i.id, { status: 'available', branch_id: Number(toBranchId) });
      stock.add(toBranchId, i.product_id, 1, i.cost_price, 'transfer_in', { type: 'transfer', id: transferId }, i.id);
    },
    /**
     * A serialized unit that never arrived: booked in at the destination and written off there as lost in
     * transit (movement 'transit_loss' at its own cost, status 'missing'). It is NOT sellable anywhere until
     * someone finds it (stock.markFound). Use revertImeiTransit only when a shipment is called back.
     */
    loseImeiInTransit(imeiId, toBranchId, transferId, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i || i.status !== 'in_transit') throw new Error('IMEI is not in transit.');
      const ref = { type: 'transfer', id: transferId };
      stock.add(toBranchId, i.product_id, 1, i.cost_price, 'transfer_in', ref, i.id, 'Shipped but not received');
      stock.remove(toBranchId, i.product_id, 1, 'transit_loss', ref, { imeiId: i.id, unitCost: i.cost_price, notes: notes || 'Missing on receipt' });
      db.update('product_imeis', i.id, { status: 'missing', branch_id: Number(toBranchId), notes: notes || 'Missing on receipt of a transfer' });
      return db.find('product_imeis', imeiId);
    },
    /** Bulk quantity shipped but not received: booked in and written off at the destination (a transit loss). */
    loseQtyInTransit(toBranchId, productId, qty, unitCost, transferId, notes = '') {
      qty = Number(qty); if (!(qty > 0)) return;
      const ref = { type: 'transfer', id: transferId };
      stock.add(toBranchId, productId, qty, unitCost, 'transfer_in', ref, null, 'Shipped but not received');
      stock.remove(toBranchId, productId, qty, 'transit_loss', ref, { unitCost, notes: notes || 'Missing on receipt' });
    },
    /** Transfer cancelled after shipping (called back): put the IMEI back at the source branch. */
    revertImeiTransit(imeiId, fromBranchId, transferId, notes = '') {
      const i = db.find('product_imeis', imeiId);
      if (!i || i.status !== 'in_transit') throw new Error('IMEI is not in transit.');
      db.update('product_imeis', i.id, { status: 'available', branch_id: Number(fromBranchId), notes });
      stock.add(fromBranchId, i.product_id, 1, i.cost_price, 'transfer_in', { type: 'transfer', id: transferId }, i.id, notes || 'Transfer reverted');
    },
  };

  /**
   * Media service — product photo galleries and videos.
   * A product carries `media: [{ id, type:'image'|'video', url, alt, is_primary, sort_order, name }]`.
   * `product.image` stays in sync with the primary image so every older screen keeps working.
   * Files are read in the browser: images are resized and re-encoded before storing, because the
   * prototype keeps everything in localStorage. The PHP backend will store real files instead.
   */
  const media = {
    MAX_IMAGE_PX: 1400,          // longest edge after resize
    IMAGE_QUALITY: 0.82,
    MAX_VIDEO_BYTES: 4 * 1024 * 1024,
    ACCEPT_IMAGE: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
    ACCEPT_VIDEO: 'video/mp4,video/webm,video/ogg,video/quicktime',

    /** Normalised gallery for a product (falls back to the legacy single image). */
    list(product) {
      const p = typeof product === 'object' ? product : db.find('products', product);
      if (!p) return [];
      let items = Array.isArray(p.media) ? p.media.slice() : [];
      if (!items.length && p.image) items = [{ id: 1, type: 'image', url: p.image, alt: '', is_primary: 1, sort_order: 1 }];
      return items
        .filter((m) => m && m.url)
        .map((m, i) => ({ id: m.id || i + 1, type: m.type === 'video' ? 'video' : 'image', url: m.url, alt: m.alt || '', name: m.name || '', is_primary: m.is_primary ? 1 : 0, sort_order: m.sort_order != null ? m.sort_order : i + 1 }))
        .sort((a, b) => (b.is_primary - a.is_primary) || (a.sort_order - b.sort_order));
    },
    images(product) { return media.list(product).filter((m) => m.type === 'image'); },
    videos(product) { return media.list(product).filter((m) => m.type === 'video'); },
    /** URL of the main product photo, or null when the product has none. */
    primary(product) {
      const imgs = media.images(product);
      if (imgs.length) return (imgs.find((m) => m.is_primary) || imgs[0]).url;
      const p = typeof product === 'object' ? product : db.find('products', product);
      return (p && p.image) || null;
    },
    count(product) { return media.list(product).length; },
    /** Re-number, guarantee exactly one primary image, and return a storable array. */
    normalize(items) {
      const out = (items || []).filter((m) => m && m.url).map((m, i) => ({
        id: m.id || i + 1, type: m.type === 'video' ? 'video' : 'image', url: m.url,
        alt: m.alt || '', name: m.name || '', is_primary: 0, sort_order: i + 1,
      }));
      const firstImage = out.find((m) => m.type === 'image');
      const wanted = (items || []).find((m) => m && m.is_primary && m.type !== 'video');
      const primary = wanted ? out.find((m) => m.url === wanted.url) : firstImage;
      if (primary) primary.is_primary = 1;
      return out;
    },
    /** Save a gallery onto a product, keeping product.image pointing at the main photo. */
    save(productId, items) {
      const list = media.normalize(items);
      const main = list.find((m) => m.is_primary && m.type === 'image') || list.find((m) => m.type === 'image');
      return db.update('products', productId, { media: list, image: main ? main.url : null });
    },
    /** YouTube / Vimeo links become embeds; anything else plays in a <video> tag. */
    videoEmbed(url) {
      const u = String(url || '');
      let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
      if (m) return 'https://www.youtube.com/embed/' + m[1];
      m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (m) return 'https://player.vimeo.com/video/' + m[1];
      return null;
    },
    isDataUrl(url) { return /^data:/.test(String(url || '')); },
    /** Rough byte size of a stored data URL (for quota warnings). */
    bytes(url) { const s = String(url || ''); const i = s.indexOf(','); return i < 0 ? s.length : Math.round((s.length - i - 1) * 3 / 4); },
    /**
     * Turn a picked File into a storable media item.
     * Images are resized to MAX_IMAGE_PX and re-encoded; videos are kept as-is under the size cap.
     * Returns a Promise<{type, url, name}> and rejects with a readable message.
     */
    fromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('No file selected.'));
        const isImage = /^image\//.test(file.type);
        const isVideo = /^video\//.test(file.type);
        if (!isImage && !isVideo) return reject(new Error(`"${file.name}" is not an image or a video.`));
        if (isVideo && file.size > media.MAX_VIDEO_BYTES) {
          return reject(new Error(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB. Videos must be under ${Math.round(media.MAX_VIDEO_BYTES / 1048576)} MB — or paste a YouTube link instead.`));
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
        reader.onload = () => {
          const raw = String(reader.result || '');
          if (isVideo) return resolve({ type: 'video', url: raw, name: file.name });
          if (/^image\/gif/.test(file.type)) return resolve({ type: 'image', url: raw, name: file.name }); // keep animation
          const img = new Image();
          img.onerror = () => reject(new Error(`"${file.name}" is not a readable image.`));
          img.onload = () => {
            try {
              const scale = Math.min(1, media.MAX_IMAGE_PX / Math.max(img.width, img.height));
              const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);   // flatten transparency for JPEG fallback
              ctx.drawImage(img, 0, 0, w, h);
              let out = canvas.toDataURL('image/webp', media.IMAGE_QUALITY);
              if (out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/jpeg', media.IMAGE_QUALITY);
              resolve({ type: 'image', url: out, name: file.name });
            } catch (e) { resolve({ type: 'image', url: raw, name: file.name }); }
          };
          img.src = raw;
        };
        reader.readAsDataURL(file);
      });
    },
    /** Read several files, resolving to the ones that worked plus readable errors for the rest. */
    fromFiles(fileList) {
      const files = Array.prototype.slice.call(fileList || []);
      return Promise.all(files.map((f) => media.fromFile(f).then((m) => ({ ok: m }), (e) => ({ error: e.message }))))
        .then((res) => ({ items: res.filter((r) => r.ok).map((r) => r.ok), errors: res.filter((r) => r.error).map((r) => r.error) }));
    },
  };

  /**
   * Ledger service — customer receivables (khata) and supplier payables.
   * Optional links kept on the row (opts): chequeId (a cheque that made this entry), bankTxnId (the bank
   * row of a non-cash payment), salePaymentId (this credit is the ledger side of a sale_payments row —
   * cash counts such as the shift tally and day-end count the sale payment and SKIP this row, so the
   * same money is never counted twice).
   */
  const links = (opts) => {
    const o = {};
    if (opts.chequeId) o.cheque_id = opts.chequeId;
    if (opts.bankTxnId) o.bank_txn_id = opts.bankTxnId;
    if (opts.salePaymentId) o.sale_payment_id = opts.salePaymentId;
    return o;
  };
  const ledger = {
    customer(customerId, branchId, type, debit, credit, opts = {}) {
      const c = db.find('customers', customerId); if (!c) throw new Error('Customer not found.');
      debit = utils.round2(debit); credit = utils.round2(credit);
      const balance = utils.round2((Number(c.balance) || 0) + debit - credit);
      db.update('customers', c.id, { balance });
      return db.insert('customer_transactions', { customer_id: c.id, branch_id: Number(branchId), type, reference_type: opts.referenceType || null, reference_id: opts.referenceId || null, debit, credit, balance_after: balance, payment_method: opts.paymentMethod || null, payment_reference: opts.paymentReference || null, notes: opts.notes || '', created_by: (session.user() || {}).id || null, ...links(opts) });
    },
    supplier(supplierId, branchId, type, debit, credit, opts = {}) {
      const s = db.find('suppliers', supplierId); if (!s) throw new Error('Supplier not found.');
      debit = utils.round2(debit); credit = utils.round2(credit);
      const balance = utils.round2((Number(s.balance) || 0) + credit - debit);
      db.update('suppliers', s.id, { balance });
      return db.insert('supplier_transactions', { supplier_id: s.id, branch_id: Number(branchId), type, reference_type: opts.referenceType || null, reference_id: opts.referenceId || null, debit, credit, balance_after: balance, payment_method: opts.paymentMethod || null, payment_reference: opts.paymentReference || null, notes: opts.notes || '', created_by: (session.user() || {}).id || null, ...links(opts) });
    },
    /** True for a customer credit that mirrors a sale_payments row (counted there, not as a khata receipt). */
    mirrorsSalePayment(t) { return !!(t && t.sale_payment_id); },
    customerStoreCredit(customerId) { const c = db.find('customers', customerId); return c && c.balance < 0 ? Math.abs(c.balance) : 0; },
  };

  /** Theme service — thin wrapper over window.ABM_THEME (bootstrapped in tailwind-config.js before first paint). */
  const theme = {
    get ACCENTS() { return (window.ABM_THEME && window.ABM_THEME.ACCENTS) || []; },
    get() { return window.ABM_THEME ? window.ABM_THEME.get() : { mode: 'light', accent: 'navy' }; },
    isDark() { return !!(window.ABM_THEME && window.ABM_THEME.isDark()); },
    set(patch) { if (window.ABM_THEME) window.ABM_THEME.apply(patch); },
    toggle() { if (window.ABM_THEME) window.ABM_THEME.toggle(); },
    /** Company-wide look (settings.theme_default): every device follows it until a user picks their own. */
    companyDefault() { return db.setting('theme_default', null); },
    saveCompanyDefault(t) {
      const v = t ? { mode: t.mode || 'light', accent: t.accent || 'navy', custom: t.custom || '#1a336a' } : null;
      db.setSetting('theme_default', v);
      if (window.ABM_THEME && window.ABM_THEME.setCompany) window.ABM_THEME.setCompany(v);
    },
    /** Is this device following its user's own choice (true) or the company default (false)? */
    isPersonal() { return !!(window.ABM_THEME && window.ABM_THEME.isPersonal && window.ABM_THEME.isPersonal()); },
    followCompany() { if (window.ABM_THEME && window.ABM_THEME.usePersonal) window.ABM_THEME.usePersonal(false); },
    /** Apply ANY colour as the software accent — generates a full 50–950 shade scale from the hex. */
    setCustom(hex) { return window.ABM_THEME ? window.ABM_THEME.setCustom(hex) : null; },
    /** hex -> {50:'r g b', …, 950:'r g b'} (used by the website theme editor / storefront). */
    shadeScale(hex) { return window.ABM_THEME ? window.ABM_THEME.shadeScale(hex) : null; },
    /** Chart.js helper colours that respect the active theme. */
    chart() {
      // Headless QA renders destroy/recreate charts mid-animation, which throws inside Chart.js.
      // Disable animation in the test harness and for users who prefer reduced motion.
      try {
        if (window.Chart && (/[?&]__(layout|click)=/.test(location.search) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches))) {
          window.Chart.defaults.animation = false;
        }
      } catch (e) { /* ignore */ }
      const dark = theme.isDark();
      const css = getComputedStyle(document.documentElement);
      const rgb = (name) => `rgb(${css.getPropertyValue(name).trim()})`;
      return { grid: dark ? 'rgba(148,163,184,.12)' : 'rgba(148,163,184,.2)', tick: dark ? '#8c98b4' : '#64748b', primary: rgb('--navy-700'), primaryLight: rgb('--navy-400'), money: '#059669', warn: '#d97706', danger: '#e11d48', info: '#0369a1', violet: '#7c3aed', series: [rgb('--navy-700'), '#059669', '#0369a1', '#d97706', '#7c3aed', '#e11d48'] };
    },
    onChange(fn) { document.addEventListener('abm:theme', fn); },
  };

  /**
   * Alpine select fix (automatic, no page changes needed).
   * A `<select x-model="f.branch">` whose `<option>`s come from a `<template x-for>` silently shows the
   * WRONG option: x-model assigns el.value before the options exist, the browser drops the selection, and
   * nothing re-applies it when x-for finally renders. We remember the value that was assigned and restore
   * it whenever the option list changes. Pages can also add `x-sync="expr"` explicitly; both work.
   */
  const selectFix = {
    modelExpr(el) {
      const name = el.getAttributeNames().find((a) => a === 'x-model' || a.startsWith('x-model.'));
      return name ? el.getAttribute(name) : null;
    },
    /** Re-apply the bound value to a select once its <option>s exist. */
    apply(el) {
      if (!window.Alpine || !el.isConnected || el.multiple) return;
      const expr = selectFix.modelExpr(el);
      if (!expr) return;
      let v;
      try { v = window.Alpine.evaluate(el, expr); } catch (e) { return; }
      const want = v === null || v === undefined ? '' : String(v);
      if (el.value === want) return;
      if (!Array.prototype.some.call(el.options, (o) => o.value === want)) return; // option not rendered yet
      el.value = want;
    },
    patch(el) {
      if (!el || el.__abmSelectPatched || !selectFix.modelExpr(el)) return;
      el.__abmSelectPatched = true;
      // Re-apply whenever x-for adds/removes options.
      new MutationObserver(() => selectFix.apply(el)).observe(el, { childList: true, subtree: true });
      selectFix.apply(el);
    },
    scan(root) {
      try { (root || document).querySelectorAll('select').forEach((el) => selectFix.patch(el)); } catch (e) { /* ignore */ }
    },
    start() {
      selectFix.scan(document);
      try {
        new MutationObserver((records) => {
          records.forEach((r) => r.addedNodes && r.addedNodes.forEach((n) => {
            if (n.nodeType !== 1) return;
            if (n.tagName === 'SELECT') selectFix.patch(n); else selectFix.scan(n);
          }));
        }).observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) { /* ignore */ }
      // after Alpine's first pass, re-apply every bound select (options now exist)
      document.addEventListener('alpine:initialized', () => setTimeout(() => document.querySelectorAll('select').forEach((el) => { selectFix.patch(el); selectFix.apply(el); }), 0));
    },
  };

  /* -------------------------------------------------------------- boot */
  // QA renders freeze the animation clock; disable entrance animations so screenshots show the real UI.
  try { if (/[?&]__(layout|click)=/.test(location.search)) document.documentElement.classList.add('abm-no-anim'); } catch (e) { /* ignore */ }
  db.load();
  session.load();
  // keep the first-paint copy of the company theme (read by tailwind-config.js) in step with the database
  try { if (window.ABM_THEME && window.ABM_THEME.setCompany) { const td = db.setting('theme_default', null); if (JSON.stringify(td || null) !== JSON.stringify(window.ABM_THEME.company() || null)) window.ABM_THEME.setCompany(td); } } catch (e) { /* ignore */ }
  // Installable app: link the manifest and register a network-first service worker (it only falls back to the
  // cache when offline, so it never serves stale code). Skipped on the QA server (port 8085) and test pages.
  try {
    if (location.port !== '8085' && !/\/tests\//.test(location.pathname) && 'serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      const root = new URL(ASSET_BASE || './', location.href);   // the project root (where manifest + sw.js live)
      if (!document.querySelector('link[rel="manifest"]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = new URL('manifest.webmanifest', root).href; document.head.appendChild(l); }
      window.addEventListener('load', () => { navigator.serviceWorker.register(new URL('sw.js', root).href, { scope: root.pathname }).catch(() => { /* ignore */ }); });
    }
  } catch (e) { /* ignore */ }
  // Two tabs share one database. When another tab saves, take its copy straight away, and warn that
  // what this screen shows may be out of date (its lists were drawn from the old copy).
  window.addEventListener('storage', (e) => {
    if (e.key !== DB_KEY) return;
    if (db.adopt(e.newValue)) shell.staleNotice();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selectFix.start); else selectFix.start();
  document.addEventListener('alpine:init', () => {
    if (window.Alpine) {
      window.Alpine.store('abm', { user: session.user(), branchId: session.branchId(), role: session.role() });
      window.Alpine.magic('money', () => (v, o) => utils.money(v, o));
      window.Alpine.magic('date', () => (v, s) => utils.date(v, s));
      window.Alpine.magic('badge', () => (s, l) => ui.badge(s, l));
      window.Alpine.magic('can', () => (p) => session.can(p));
      /**
       * x-sync="expr" — fixes the classic Alpine gotcha where a <select x-model="f.branch"> whose <option>s
       * come from a <template x-for> shows the FIRST option instead of the bound value (x-model applies
       * before the options exist). Add it next to x-model and the element re-applies the value after every
       * render, so the picker always shows what the state actually says:
       *   <select class="select" x-model="f.branch" x-sync="f.branch"> … </select>
       */
      window.Alpine.directive('sync', (el, { expression }, { evaluateLater, effect }) => {
        const getValue = evaluateLater(expression);
        effect(() => getValue((v) => {
          const want = v === null || v === undefined ? '' : String(v);
          queueMicrotask(() => { if (el.value !== want) el.value = want; });
        }));
      });
    }
  });
  const boot = () => { shell.render(); brand.hydrate(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  return { VERSION, utils, db, session, nav, icon, ui, shell, stock, ledger, media, theme, range, brand, shift, bank, roles, get ROLES() { return roles.map(); } };
})();
