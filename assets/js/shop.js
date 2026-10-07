/* ==========================================================================
   Abbott Mobile — PUBLIC STOREFRONT runtime  (window.SHOP)
   --------------------------------------------------------------------------
   Loaded ONLY by shop/*.html, after data.js + app.js and before Alpine:

     <script defer src="../assets/js/data.js"></script>
     <script defer src="../assets/js/app.js"></script>
     <script defer src="../assets/js/shop.js"></script>
     <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"></script>

   It reads the SAME mock database as the admin (ABM.db / localStorage), so
   anything edited in website.html appears here instantly. On load it:
     1. applies cms.site.theme to <html> as CSS variables (see assets/css/shop.css),
     2. injects the shared chrome into <div data-shop-header></div> and
        <div data-shop-footer></div> (announcement + sticky header + mobile
        drawer, and the rich footer),
     3. exposes the API below, plus the dev helpers ?__layout=1 / ?__click=sel
        that the admin shell provides (public pages skip ABM.shell.render()).

   ==========================================================================
   PAGE SKELETON — copy this for every new shop/*.html page
   ==========================================================================
   <!DOCTYPE html>
   <html lang="en" class="h-full">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>… · Abbott Mobile</title>
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
     <script src="https://cdn.tailwindcss.com"></script>
     <script src="../assets/js/tailwind-config.js"></script>
     <link rel="stylesheet" href="../assets/css/app.css">
     <link rel="stylesheet" href="../assets/css/shop.css">
     <script defer src="../assets/js/data.js"></script>
     <script defer src="../assets/js/app.js"></script>
     <script defer src="../assets/js/shop.js"></script>
     <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"></script>
   </head>
   <body class="min-h-full flex flex-col" data-public data-page="shop-cart">
     <div data-shop-header></div>            <!-- announcement + sticky header + drawer -->
     <main class="flex-1" x-data="myPage()"> … </main>
     <div data-shop-footer class="mt-auto"></div>
     <script> function myPage() { return { init() {} }; } </script>
   </body>
   </html>

   Design-system classes live in assets/css/shop.css (all prefixed `shop-`):
     .shop-container .shop-section .shop-section-tight .shop-section-alt .shop-section-head
     .shop-eyebrow .shop-h1 .shop-h2 .shop-h3 .shop-lead .shop-muted .shop-on-dark
     .shop-btn (+ -accent -outline -ghost -white -glass -lg -sm -block) .shop-icon-btn
     .shop-input .shop-select .shop-textarea .shop-label .shop-error .shop-check
     .shop-card (+ -pad -hover) .shop-badge (+ -primary -accent -warn -danger) .shop-chip(.is-active)
     .shop-tag (+ -warn -danger -accent -info, for overlays on artwork) .shop-tile(.shop-tile-icon)
     .shop-product .shop-media .shop-media-tags .shop-product-body .shop-price .shop-grid-products
     .shop-qty .shop-acc/.shop-acc-btn/.shop-acc-body .shop-specs .shop-crumbs .shop-thumb
     .shop-empty .shop-skeleton .shop-divider .shop-rich (CMS html) .shop-sticky-bar (mobile bars)
     .shop-drawer / .shop-drawer-backdrop / .shop-drawer-head / -body / -link / -foot
   Never use the admin classes (.btn/.card/.stat/.table) on a storefront page.

   ==========================================================================
   API  — everything a storefront page needs. Read this before writing a page.
   ==========================================================================
   CONTENT / CMS
     SHOP.cms()                     -> the whole CMS document (live reference)
     SHOP.site()                    -> cms.site (name, hero, contact, social, …)
     SHOP.commerce()                -> cms.site.commerce merged with safe defaults
     SHOP.repairBooking()           -> cms.site.repair_booking merged with defaults
     SHOP.menu()                    -> active menu items, sorted  [{label,url}]
     SHOP.pages()                   -> published CMS pages, sorted
     SHOP.page(slug)                -> one published CMS page or null
     SHOP.banners() / SHOP.testimonials() / SHOP.highlights()
     SHOP.contact() / SHOP.social()  -> cms.site.contact / cms.site.social
     SHOP.sanitize(html)            -> CMS rich text with <script>/<style>/<iframe>,
                                       on*= handlers and javascript: URLs stripped
                                       (the ONLY sanctioned x-html of stored HTML)
     SHOP.escape(s)                 -> ABM.utils.escape

   CATALOG
     SHOP.branchId()                -> commerce.fulfil_branch_id (the web branch)
     SHOP.branch() / SHOP.branches()-> fulfil branch row / all active branches
     SHOP.products()                -> active, sellable products at the web branch
     SHOP.product(id)               -> one product (active only) or null
     SHOP.services()                -> active service / labor products (no stock)
     SHOP.categories()              -> [{id,name,product_type,device_type,count,…}]
                                       only categories that have sellable products
     SHOP.brands()                  -> [{id,name,count}] for sellable products
     SHOP.stockOf(productId)        -> sellable qty at the web branch (0 for services)
     SHOP.inStock(p)                -> true when it can be added to the cart today
     SHOP.canOrder(p)               -> inStock(p) || commerce.allow_backorder
     SHOP.stockLabel(p)             -> 'In stock' | 'Only 2 left' | 'Available to order' | 'Out of stock'
     SHOP.maxQty(p)                 -> max units per order (1 for serialized units)
     SHOP.priceOf(p)                -> retail price (number)
     SHOP.title(p) / SHOP.subtitle(p)
     SHOP.image(p, cls)             -> <img> HTML, or a generated gradient
                                       placeholder for the device type (x-html)
     SHOP.placeholder(p, cls, icon) -> the generated tile only; `icon` swaps the
                                       glyph (gallery thumbnails: cube / shield-check / barcode)
     SHOP.matches(p, q)             -> free-text search match (name/brand/sku/specs)
     SHOP.money(v, opts)            -> ABM.utils.money  ('Rs. 1,234.50')

   CART  (localStorage 'abm.shop.cart', items {product_id, qty})
     SHOP.cart.get()                -> raw [{product_id, qty}]
     SHOP.cart.lines()              -> enriched [{product_id, product, name, qty,
                                        unit_price, total, max, available, in_stock}]
     SHOP.cart.add(productId, qty)  -> adds/increments, clamps to maxQty, returns line
     SHOP.cart.setQty(productId, q) -> q<=0 removes
     SHOP.cart.remove(productId) / SHOP.cart.clear()
     SHOP.cart.count()              -> total units      SHOP.cart.subtotal() -> number
     SHOP.cart.has(productId)       -> boolean   SHOP.cart.qtyOf(id) -> number
     Every mutation fires window event 'shop:cart' {detail:{count, subtotal}} —
     the header badge and any page can listen for it.

   CHECKOUT / ORDERS
     SHOP.deliveryFee(subtotal)     -> 0 when subtotal >= free_delivery_above
     SHOP.orderTotal(subtotal)      -> subtotal + deliveryFee(subtotal)
     SHOP.paymentMethods()          -> enabled methods [{key,label,note,icon}]
     SHOP.placeOrder(customer, items, paymentMethod, reference)
         customer {name, phone, email, address, city, notes}
         items    [{product_id, qty}]  (SHOP.cart.get() works as-is)
         -> inserts an `online_orders` row: order_no via
            ABM.db.nextNumber(commerce.order_prefix||'WEB', 'ON'), status 'pending',
            payment_status ('paid' only when a non-COD reference is supplied),
            status_log [{status:'pending', at, by:null}], source 'website',
            branch_id = fulfil branch, customer_id matched by phone when known.
            Throws Error(message) on validation failure. Does NOT clear the cart —
            call SHOP.cart.clear() after you have shown the confirmation.
     SHOP.findOrder(orderNo, phone) -> the order when both match, else null
     SHOP.trackUrl(order)           -> 'order.html?no=…&phone=…'

   REPAIRS / MESSAGES / NEWSLETTER
     SHOP.bookRepair({name, phone, email, device_type, brand, model, problem,
                      preferred_date, preferred_branch_id, notes})
         -> inserts a `repair_requests` row with status 'new'. Throws on bad input.
     SHOP.sendMessage({name, phone, email, subject, message})
         -> inserts a `contact_messages` row (status 'new').
     SHOP.subscribe(email)          -> inserts a `newsletter_subscribers` row

   CHROME / MISC
     SHOP.header() / SHOP.footer()  -> HTML strings (auto-mounted on load)
     SHOP.mount()                   -> re-inject the chrome (called automatically)
     SHOP.toast(msg, type)          -> ABM.ui.toast
     SHOP.confirm(opts)             -> ABM.ui.confirm (Promise<boolean>)
     SHOP.waNumber() / SHOP.waLink(text) -> WhatsApp number / wa.me deep link
     SHOP.icon(name, cls)           -> ABM.icon
     SHOP.socialIcon(name)          -> brand glyph SVG (facebook/instagram/tiktok/
                                       youtube/whatsapp)
     SHOP.stars(rating)             -> 5-star SVG row HTML

   URL dev aids (work on every shop page):
     ?__mode=dark|light  preview the other colour mode without editing the CMS
     ?__layout=1         log overflowing elements (mobile QA, see tests/render.ps1)
     ?__click=<selector> click an element after load (screenshot a drawer open)
   ========================================================================== */
window.SHOP = (function () {
  'use strict';

  var ABMx = window.ABM;
  var db = ABMx.db, utils = ABMx.utils, ui = ABMx.ui, icon = ABMx.icon;
  var CART_KEY = 'abm.shop.cart';
  var SESSION_KEY = 'abm.shop.session';
  var esc = utils.escape;

  /* ------------------------------------------------------------- defaults */
  var COMMERCE_DEFAULTS = {
    show_prices: 1, allow_orders: 1, cod_enabled: 1, bank_transfer_enabled: 1, wallet_enabled: 1,
    delivery_fee: 0, free_delivery_above: 0, fulfil_branch_id: 1, order_prefix: 'WEB',
    show_stock: 1, allow_backorder: 0, whatsapp_orders: 1, bank_details: '', min_order: 0,
  };
  var REPAIR_DEFAULTS = { enabled: 1, intro: '', device_types: ['mobile', 'tablet', 'laptop', 'desktop', 'smartwatch'], show_prices: 1 };
  var THEME_DEFAULTS = { primary: '#1a336a', accent: '#10b981', background: '#f8fafc', mode: 'light', font: 'Inter', radius: 'rounded' };
  var RADIUS_MAP = { sharp: '.375rem', square: '.375rem', soft: '1.25rem', rounded: '1rem', pill: '1.75rem' };

  /* ------------------------------------------------------------ cms reads */
  function cms() { return db.cms() || {}; }
  function site() { var c = cms(); return c.site || (c.site = {}); }
  function commerce() { return Object.assign({}, COMMERCE_DEFAULTS, site().commerce || {}); }
  function repairBooking() { return Object.assign({}, REPAIR_DEFAULTS, site().repair_booking || {}); }
  function themeCfg() { return Object.assign({}, THEME_DEFAULTS, site().theme || {}); }
  function contact() { return site().contact || {}; }
  function social() { return site().social || {}; }
  function sortOrder(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); }
  function menu() { return (cms().menu || []).filter(function (m) { return m.is_active !== 0 && m.label; }).slice().sort(sortOrder); }
  function pages() { return (cms().pages || []).filter(function (p) { return p.is_published; }).slice().sort(sortOrder); }
  function page(slug) { return pages().filter(function (p) { return String(p.slug) === String(slug); })[0] || null; }
  function banners() { return (cms().banners || []).filter(function (b) { return b.is_active !== 0; }).slice().sort(sortOrder); }
  function testimonials() { return (cms().testimonials || []).filter(function (t) { return t.is_active !== 0; }); }
  function highlights() { return site().highlights || []; }

  /* -------------------------------------------------------------- catalog */
  function branchId() { return Number(commerce().fulfil_branch_id) || 1; }
  function branch() { return db.find('branches', branchId()); }
  function branches() { return db.all('branches').filter(function (b) { return b.is_active; }); }

  /** Active products the website may sell: stock-tracked goods + services. */
  function products() {
    return db.all('products').filter(function (p) {
      return p.is_active && (db.isStockTracked(p) || db.productType(p) === 'service');
    });
  }
  function product(id) {
    var p = db.find('products', id);
    return p && p.is_active ? p : null;
  }
  function services() { return products().filter(function (p) { return db.productType(p) === 'service'; }); }

  function categories() {
    var counts = {};
    products().forEach(function (p) { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
    return db.all('categories').filter(function (c) { return c.is_active && counts[c.id]; }).map(function (c) {
      return { id: c.id, name: c.name, product_type: c.product_type, device_type: c.device_type, count: counts[c.id] };
    });
  }
  function brands() {
    var counts = {};
    products().forEach(function (p) { counts[p.brand_id] = (counts[p.brand_id] || 0) + 1; });
    return db.all('brands').filter(function (b) { return b.is_active && counts[b.id]; }).map(function (b) {
      return { id: b.id, name: b.name, count: counts[b.id] };
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  }

  function stockOf(productId) {
    var p = typeof productId === 'object' ? productId : db.find('products', productId);
    if (!p || !db.isStockTracked(p)) return 0;
    return ABMx.stock.qty(branchId(), p.id);
  }
  function inStock(p) {
    if (!p) return false;
    if (!db.isStockTracked(p)) return true;          // services are always bookable
    return stockOf(p) > 0;
  }
  function canOrder(p) { return inStock(p) || !!commerce().allow_backorder; }
  function stockLabel(p) {
    if (!p) return '';
    if (!db.isStockTracked(p)) return 'Available';
    var q = stockOf(p);
    if (q > 3) return 'In stock';
    if (q > 0) return 'Only ' + q + ' left';
    return commerce().allow_backorder ? 'Available to order' : 'Out of stock';
  }
  function maxQty(p) {
    if (!p) return 1;
    if (!db.isStockTracked(p)) return 10;                 // services / labor
    var q = stockOf(p), back = !!commerce().allow_backorder;
    if (db.isSerialized(p)) return (q > 0 || back) ? 1 : 0;   // one serialized unit per order line
    if (q > 0) return Math.min(q, 20);
    return back ? 5 : 0;
  }
  function priceOf(p) { return Number(p && p.retail_price) || 0; }
  function title(p) {
    if (!p) return '';
    if (db.productType(p) === 'service') return p.name;            // "… Labor · Labor" reads badly
    return [p.name, p.variant].filter(Boolean).join(' · ');
  }
  function subtitle(p) { return p ? [db.brandName(p.brand_id), p.color, p.model].filter(function (x) { return x && x !== '—'; }).join(' · ') : ''; }

  function matches(p, q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return true;
    var hay = [p.name, p.variant, p.model, p.color, p.sku, db.brandName(p.brand_id), db.categoryName(p.category_id), (p.tags || []).join(' '),
      Object.keys(p.specs || {}).map(function (k) { return p.specs[k]; }).join(' ')].join(' ').toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }

  /* ---------------------------------------------------- image placeholder */
  function hue(s) { var h = 0; s = String(s || 'x'); for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h % 360; }
  function deviceIcon(p) {
    var t = db.productType(p);
    if (t === 'service') return 'wrench';
    if (t === 'part') return 'cpu';
    if (t === 'accessory') return 'cube';
    return ({ mobile: 'phone', tablet: 'phone', smartwatch: 'clock', laptop: 'laptop', desktop: 'desktop' })[p && p.device_type] || 'cube';
  }
  /** Generated gradient tile. `iconName` overrides the device glyph (gallery views). */
  function placeholder(p, cls, iconName) {
    var seed = p ? (p.name || '') + (p.model || '') + p.id : 'abm';
    var initial = String(db.brandName(p && p.brand_id) || (p && p.name) || '?').trim().charAt(0).toUpperCase();
    return '<span class="shop-ph ' + esc(cls || '') + '" style="--h:' + hue(seed) + '" aria-hidden="true">' +
      '<span class="shop-ph-glyph">' + icon(iconName || deviceIcon(p), '') + '</span>' +
      '<span class="shop-ph-initial">' + esc(initial) + '</span></span>';
  }
  /** <img> when the product has an image, otherwise a generated gradient tile. */
  /** Main product photo (from the admin gallery), or a generated placeholder. */
  function image(p, cls) {
    var url = ABMx.media ? ABMx.media.primary(p) : (p && p.image);
    if (url) return '<img src="' + esc(url) + '" alt="' + esc(title(p)) + '" class="' + esc(cls || '') + '" loading="lazy">';
    return placeholder(p, cls);
  }
  /** How many photos/videos a product has (cards show a small gallery hint). */
  function mediaCount(p) { return ABMx.media ? ABMx.media.count(p) : (p && p.image ? 1 : 0); }

  /* ----------------------------------------------------------------- cart */
  function readCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map(function (l) { return { product_id: Number(l.product_id), qty: Math.max(1, Number(l.qty) || 1) }; })
        .filter(function (l) { return l.product_id > 0; });
    } catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* private mode */ }
    try {
      window.dispatchEvent(new CustomEvent('shop:cart', { detail: { count: cart.count(), subtotal: cart.subtotal() } }));
    } catch (e) { /* ignore */ }
    return items;
  }
  var cart = {
    get: function () { return readCart(); },
    has: function (productId) { return readCart().some(function (l) { return l.product_id == productId; }); },
    qtyOf: function (productId) { var l = readCart().filter(function (x) { return x.product_id == productId; })[0]; return l ? l.qty : 0; },
    /** Enriched lines, skipping products that no longer exist / went inactive. */
    lines: function () {
      return readCart().map(function (l) {
        var p = product(l.product_id);
        if (!p) return null;
        var max = maxQty(p);
        var qty = Math.max(1, Math.min(l.qty, max || l.qty));
        return {
          product_id: p.id, product: p, name: title(p), brand: db.brandName(p.brand_id),
          qty: qty, unit_price: priceOf(p), total: utils.round2(priceOf(p) * qty),
          max: max, available: stockOf(p), in_stock: inStock(p), is_service: db.productType(p) === 'service',
        };
      }).filter(Boolean);
    },
    add: function (productId, qty) {
      var p = product(productId);
      if (!p) throw new Error('This product is no longer available.');
      var max = maxQty(p);
      if (!max) throw new Error(title(p) + ' is out of stock.');
      qty = Math.max(1, Number(qty) || 1);
      var items = readCart();
      var line = items.filter(function (l) { return l.product_id == p.id; })[0];
      if (line) line.qty = Math.min(max, line.qty + qty);
      else { line = { product_id: p.id, qty: Math.min(max, qty) }; items.push(line); }
      writeCart(items);
      return line;
    },
    setQty: function (productId, qty) {
      qty = Number(qty) || 0;
      if (qty <= 0) return cart.remove(productId);
      var p = product(productId);
      var max = p ? maxQty(p) : qty;
      var items = readCart();
      var line = items.filter(function (l) { return l.product_id == productId; })[0];
      if (!line) return cart.add(productId, qty);
      line.qty = Math.max(1, Math.min(max || qty, qty));
      writeCart(items);
      return line;
    },
    remove: function (productId) {
      writeCart(readCart().filter(function (l) { return l.product_id != productId; }));
      return null;
    },
    clear: function () { return writeCart([]); },
    count: function () { return readCart().reduce(function (s, l) { return s + (Number(l.qty) || 0); }, 0); },
    subtotal: function () {
      return utils.round2(readCart().reduce(function (s, l) {
        var p = product(l.product_id);
        return s + (p ? priceOf(p) * l.qty : 0);
      }, 0));
    },
  };

  /* ------------------------------------------------------------- checkout */
  function deliveryFee(subtotal) {
    var c = commerce();
    subtotal = Number(subtotal) || 0;
    if (!subtotal) return 0;
    var free = Number(c.free_delivery_above) || 0;
    if (free && subtotal >= free) return 0;
    return utils.round2(Number(c.delivery_fee) || 0);
  }
  function orderTotal(subtotal) { return utils.round2((Number(subtotal) || 0) + deliveryFee(subtotal)); }

  function paymentMethods() {
    var c = commerce(), out = [];
    if (c.cod_enabled) out.push({ key: 'cod', label: 'Cash on Delivery', note: 'Pay the rider when your order arrives', icon: 'banknotes' });
    if (c.bank_transfer_enabled) out.push({ key: 'bank_transfer', label: 'Bank Transfer', note: c.bank_details || 'Transfer and share the reference number', icon: 'building' });
    if (c.wallet_enabled) {
      out.push({ key: 'jazzcash', label: 'JazzCash', note: 'Send to our JazzCash account and share the TRX ID', icon: 'wallet' });
      out.push({ key: 'easypaisa', label: 'EasyPaisa', note: 'Send to our EasyPaisa account and share the TRX ID', icon: 'wallet' });
    }
    return out;
  }

  function digits(s) { return String(s || '').replace(/\D+/g, ''); }

  /**
   * Create an online order. Throws Error(message) when validation fails.
   * Returns the inserted `online_orders` row.
   */
  function placeOrder(customer, items, paymentMethod, reference) {
    var c = commerce();
    if (!c.allow_orders) throw new Error('Online ordering is currently disabled. Please call us to place an order.');
    customer = customer || {};
    var name = String(customer.name || '').trim();
    var phone = String(customer.phone || '').trim();
    var address = String(customer.address || '').trim();
    if (name.length < 3) throw new Error('Please enter your full name.');
    if (digits(phone).length < 10) throw new Error('Please enter a valid phone number (e.g. 0300-1234567).');
    if (address.length < 8) throw new Error('Please enter a complete delivery address.');

    var raw = (items && items.length ? items : cart.get()) || [];
    var lines = raw.map(function (l) {
      var p = product(l.product_id != null ? l.product_id : l.id);
      if (!p) return null;
      var qty = Math.max(1, Number(l.qty || l.quantity) || 1);
      return { product_id: p.id, name: title(p), quantity: qty, unit_price: priceOf(p), total: utils.round2(priceOf(p) * qty) };
    }).filter(Boolean);
    if (!lines.length) throw new Error('Your cart is empty.');

    var subtotal = utils.round2(lines.reduce(function (s, l) { return s + l.total; }, 0));
    var minOrder = Number(c.min_order) || 0;
    if (minOrder && subtotal < minOrder) throw new Error('Minimum order value is ' + utils.money(minOrder, { decimals: 0 }) + '.');

    var methods = paymentMethods().map(function (m) { return m.key; });
    var method = methods.indexOf(paymentMethod) >= 0 ? paymentMethod : (methods[0] || 'cod');
    var ref = String(reference || '').trim();
    if (method !== 'cod' && !ref) throw new Error('Please enter the payment reference / transaction ID.');
    if (method === 'cod') ref = '';   // cash on delivery never carries a transaction reference

    var fee = deliveryFee(subtotal);
    // an order placed while signed in belongs to that account; otherwise match an existing customer by phone
    var signedIn = auth.user();
    var match = signedIn || db.all('customers').filter(function (x) { return !x.is_walkin && x.phone && digits(x.phone) === digits(phone); })[0];
    var no = db.nextNumber(c.order_prefix || 'WEB', 'ON');

    var row = db.insert('online_orders', {
      order_no: no, status: 'pending',
      payment_method: method,
      payment_status: (method !== 'cod' && ref) ? 'paid' : 'unpaid',
      payment_reference: ref,
      customer: {
        name: name, phone: phone, email: String(customer.email || '').trim(),
        address: address, city: String(customer.city || '').trim(), notes: String(customer.notes || '').trim(),
      },
      customer_id: match ? match.id : null,
      items: lines, subtotal: subtotal, delivery_fee: fee, discount: 0, total: utils.round2(subtotal + fee),
      branch_id: branchId(), sale_id: null, source: 'website',
      status_log: [{ status: 'pending', at: utils.now(), by: null }],
      internal_notes: '',
    });
    db.audit('order.create', 'online_order', row.id, 'Website order ' + no + ' · ' + utils.money(row.total));
    // the customer gets their invoice by email straight away (queued in email_outbox — see sendEmail)
    if (emailOk(row.customer.email)) {
      try { emailInvoice(row); row = db.update('online_orders', row.id, { invoice_emailed_at: utils.now() }) || row; }
      catch (e) { /* never fail an order because the receipt could not be queued */ }
    }
    return row;
  }

  /** Track an order: the number and the phone used on it must both match. */
  function findOrder(orderNo, phone) {
    var no = String(orderNo || '').trim().toUpperCase();
    var ph = digits(phone);
    if (!no || ph.length < 4) return null;
    return db.all('online_orders').filter(function (o) {
      return String(o.order_no || '').toUpperCase() === no && digits((o.customer || {}).phone).slice(-10) === ph.slice(-10);
    })[0] || null;
  }
  function trackUrl(order) {
    if (!order) return 'order.html';
    return 'order.html?no=' + encodeURIComponent(order.order_no) + '&phone=' + encodeURIComponent((order.customer || {}).phone || '');
  }

  /* ----------------------------------------------- repairs / messages */
  function bookRepair(data) {
    data = data || {};
    var name = String(data.name || '').trim();
    var phone = String(data.phone || '').trim();
    var problem = String(data.problem || '').trim();
    if (name.length < 3) throw new Error('Please enter your name.');
    if (digits(phone).length < 10) throw new Error('Please enter a valid phone number.');
    if (problem.length < 8) throw new Error('Please describe the problem in a few words.');
    var row = db.insert('repair_requests', {
      request_no: db.nextNumber('RQ', 'ON'),
      name: name, phone: phone, email: String(data.email || '').trim(),
      device_type: data.device_type || 'mobile', brand: String(data.brand || '').trim(), model: String(data.model || '').trim(),
      problem: problem, preferred_date: data.preferred_date || utils.today(),
      preferred_branch_id: Number(data.preferred_branch_id) || branchId(),
      status: 'new', job_id: null, notes: String(data.notes || '').trim(),
    });
    db.audit('repair_request.create', 'repair_request', row.id, 'Website repair booking ' + row.request_no + ' from ' + name);
    return row;
  }
  /* =========================================================================
     CUSTOMER ACCOUNTS  (SHOP.auth)
     A shopper account is just a `customers` row with has_account = 1, so an
     online account and the shop's walk-in ledger are the same customer — the
     admin sees one record, and past counter purchases show up in "My orders".

     SECURITY NOTE: this is a browser-only prototype. Passwords are stored as a
     non-reversible-looking digest in localStorage, which is NOT security — the
     real check belongs in PHP (password_hash / password_verify) when the backend
     lands. Never reuse this function server side.
     ========================================================================= */
  function pwDigest(pw) {
    var s = 'abm:' + String(pw == null ? '' : pw);
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      h1 ^= s.charCodeAt(i); h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 + s.charCodeAt(i) * (i + 7)) >>> 0;
    }
    return 'p1$' + h1.toString(36) + h2.toString(36);
  }
  function emailOk(v) { return /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(String(v || '').trim()); }
  function sameNumber(a, b) { var x = digits(a), y = digits(b); return !!x && !!y && x.slice(-10) === y.slice(-10); }

  var auth = {
    /** The signed-in customer row, or null. */
    user: function () {
      var s;
      try { s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { s = null; }
      if (!s || !s.customer_id) return null;
      var c = db.find('customers', s.customer_id);
      return c && c.has_account && c.is_active !== 0 ? c : null;
    },
    isLoggedIn: function () { return !!auth.user(); },
    /** Send a visitor to the login page, remembering where they wanted to go. */
    require: function (next) {
      if (auth.isLoggedIn()) return true;
      var target = next || (location.pathname.split('/').pop() + location.search);
      location.replace('login.html?next=' + encodeURIComponent(target));
      return false;
    },
    _start: function (customer) {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ customer_id: customer.id, at: utils.now() })); } catch (e) { /* ignore */ }
      try { document.dispatchEvent(new CustomEvent('shop:auth', { detail: { customer_id: customer.id } })); } catch (e) { /* ignore */ }
      return customer;
    },
    /** Create an account (or attach one to the walk-in customer who already has this phone/email). */
    register: function (data) {
      data = data || {};
      var name = String(data.name || '').trim();
      var email = String(data.email || '').trim().toLowerCase();
      var phone = String(data.phone || '').trim();
      var pw = String(data.password || '');
      if (name.length < 3) throw new Error('Please enter your full name.');
      if (!emailOk(email)) throw new Error('Please enter a valid email address.');
      if (digits(phone).length < 10) throw new Error('Please enter a valid phone number (e.g. 0300-1234567).');
      if (pw.length < 6) throw new Error('Choose a password of at least 6 characters.');
      if (data.confirm !== undefined && String(data.confirm) !== pw) throw new Error('The two passwords do not match.');

      var all = db.all('customers');
      if (all.some(function (c) { return c.has_account && String(c.email || '').toLowerCase() === email; })) {
        throw new Error('An account already exists for that email. Please sign in instead.');
      }
      if (all.some(function (c) { return c.has_account && sameNumber(c.phone, phone); })) {
        throw new Error('An account already exists for that phone number. Please sign in instead.');
      }
      // reuse the existing walk-in/ledger customer with the same phone, so history carries over
      var existing = all.filter(function (c) { return !c.is_walkin && !c.has_account && sameNumber(c.phone, phone); })[0];
      var patch = {
        name: name, email: email, phone: phone, has_account: 1,
        password: pwDigest(pw), account_created_at: utils.now(),
        address: String(data.address || (existing && existing.address) || '').trim(),
        city: String(data.city || (existing && existing.city) || '').trim(),
      };
      var customer = existing ? db.update('customers', existing.id, patch)
        : db.insert('customers', Object.assign({
          cnic: '', credit_limit: 0, balance: 0, is_walkin: 0, notes: 'Registered on the website', is_active: 1,
        }, patch));
      db.audit('customer.register', 'customer', customer.id, 'Website account created for ' + name);
      return auth._start(customer);
    },
    /** Sign in with an email address or a phone number. */
    login: function (identifier, password) {
      var id = String(identifier || '').trim().toLowerCase();
      if (!id) throw new Error('Please enter your email or phone number.');
      if (!password) throw new Error('Please enter your password.');
      var c = db.all('customers').filter(function (x) {
        if (!x.has_account) return false;
        return String(x.email || '').toLowerCase() === id || sameNumber(x.phone, id);
      })[0];
      if (!c) throw new Error('No account found for that email or phone number.');
      if (c.is_active === 0) throw new Error('This account is disabled. Please contact us.');
      if (c.password !== pwDigest(password)) throw new Error('That password is not correct.');
      db.update('customers', c.id, { last_login_at: utils.now() });
      return auth._start(c);
    },
    logout: function () { try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } try { document.dispatchEvent(new CustomEvent('shop:auth', { detail: null })); } catch (e) { /* ignore */ } },
    /** Update the signed-in customer's own details (never balances or limits). */
    updateProfile: function (patch) {
      var c = auth.user(); if (!c) throw new Error('Please sign in first.');
      patch = patch || {};
      var name = String(patch.name == null ? c.name : patch.name).trim();
      var email = String(patch.email == null ? c.email : patch.email).trim().toLowerCase();
      var phone = String(patch.phone == null ? c.phone : patch.phone).trim();
      if (name.length < 3) throw new Error('Please enter your full name.');
      if (!emailOk(email)) throw new Error('Please enter a valid email address.');
      if (digits(phone).length < 10) throw new Error('Please enter a valid phone number.');
      var clash = db.all('customers').filter(function (x) {
        return x.id !== c.id && x.has_account && (String(x.email || '').toLowerCase() === email || sameNumber(x.phone, phone));
      })[0];
      if (clash) throw new Error('Another account already uses that email or phone number.');
      return db.update('customers', c.id, {
        name: name, email: email, phone: phone,
        address: String(patch.address == null ? c.address : patch.address).trim(),
        city: String(patch.city == null ? (c.city || '') : patch.city).trim(),
      });
    },
    changePassword: function (current, next, confirm) {
      var c = auth.user(); if (!c) throw new Error('Please sign in first.');
      if (c.password !== pwDigest(current)) throw new Error('Your current password is not correct.');
      if (String(next || '').length < 6) throw new Error('Choose a new password of at least 6 characters.');
      if (confirm !== undefined && String(confirm) !== String(next)) throw new Error('The two passwords do not match.');
      db.update('customers', c.id, { password: pwDigest(next) });
      return true;
    },
    /** Every website order belonging to the signed-in customer (by account link or phone). */
    orders: function () {
      var c = auth.user(); if (!c) return [];
      return db.all('online_orders').filter(function (o) {
        return String(o.customer_id) === String(c.id) || sameNumber((o.customer || {}).phone, c.phone);
      }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
    },
    /** Counter invoices raised for this customer in the shop. */
    invoices: function () {
      var c = auth.user(); if (!c) return [];
      return db.all('sales').filter(function (s) { return String(s.customer_id) === String(c.id) && s.status !== 'void'; })
        .sort(function (a, b) { return String(b.sale_date).localeCompare(String(a.sale_date)); });
    },
    /** Repair bookings and job cards raised for this customer. */
    repairs: function () {
      var c = auth.user(); if (!c) return { requests: [], jobs: [] };
      return {
        requests: db.all('repair_requests').filter(function (r) { return sameNumber(r.phone, c.phone); }),
        jobs: db.all('repair_jobs').filter(function (j) { return String(j.customer_id) === String(c.id); }),
      };
    },
  };

  /* =========================================================================
     ORDER TRACKING · INVOICE · EMAIL
     ========================================================================= */
  var ORDER_FLOW = [
    { key: 'pending', label: 'Order placed', text: 'We have your order and will confirm it shortly.' },
    { key: 'confirmed', label: 'Confirmed', text: 'Your order is confirmed and being prepared.' },
    { key: 'packed', label: 'Packed', text: 'Your parcel is packed and ready to hand to the courier.' },
    { key: 'out_for_delivery', label: 'Out for delivery', text: 'Your parcel is on its way.' },
    { key: 'delivered', label: 'Delivered', text: 'Delivered. Thank you for shopping with us!' },
  ];
  /** Tracking steps for an order, with the timestamp of each completed step. */
  function orderSteps(order) {
    if (!order) return [];
    var log = order.status_log || [];
    var stampOf = function (key) { var e = log.filter(function (l) { return l.status === key; }).pop(); return e ? e.at : null; };
    if (order.status === 'cancelled') {
      var placed = stampOf('pending') || order.created_at;
      return [
        { key: 'pending', label: 'Order placed', text: ORDER_FLOW[0].text, at: placed, done: true, current: false },
        { key: 'cancelled', label: 'Cancelled', text: 'This order was cancelled. Contact us if that is unexpected.', at: stampOf('cancelled'), done: true, current: true, failed: true },
      ];
    }
    var idx = ORDER_FLOW.map(function (s) { return s.key; }).indexOf(order.status);
    if (idx < 0) idx = 0;
    return ORDER_FLOW.map(function (s, i) {
      return { key: s.key, label: s.label, text: s.text, at: stampOf(s.key) || (i === 0 ? order.created_at : null), done: i <= idx, current: i === idx };
    });
  }
  function orderStatusLabel(order) {
    if (!order) return '';
    if (order.status === 'cancelled') return 'Cancelled';
    var s = ORDER_FLOW.filter(function (x) { return x.key === order.status; })[0];
    return s ? s.label : utils.titleCase(order.status || '');
  }

  function paymentLabel(method) {
    return ({ cod: 'Cash on delivery', bank_transfer: 'Bank transfer', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa', card: 'Card' })[method] || utils.titleCase(method || '');
  }

  /**
   * A complete, self-contained invoice document for a website order.
   * Returned as a full HTML string so it can be printed, downloaded as a file,
   * or used as the body of the confirmation email.
   */
  function invoiceHtml(order, opts) {
    opts = opts || {};
    var s = site(), st = db.settings ? db.settings() : {}, b = db.find('branches', order.branch_id) || branch() || {};
    var sym = st.currency_symbol || 'Rs.';
    var m = function (v) { return sym + ' ' + utils.num(Number(v) || 0, 0); };
    var c = order.customer || {};
    var rows = (order.items || []).map(function (l, i) {
      return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(l.name) + '</td><td class="c">' + l.quantity +
        '</td><td class="r">' + m(l.unit_price) + '</td><td class="r">' + m(l.total) + '</td></tr>';
    }).join('');
    // an emailed / downloaded invoice is read outside the app, so the mark has to be an absolute URL
    var invLogo = st.logo || (window.ABM && ABM.brand ? new URL(ABM.brand.logo(), location.href).href : '');
    var logo = invLogo ? '<img src="' + esc(invLogo) + '" alt="" style="height:44px">' : '<div class="mark">' + esc(String(st.company_name || s.name || 'A').charAt(0)) + '</div>';
    var paid = order.payment_status === 'paid';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Invoice ' + esc(order.order_no) + '</title><style>' +
      ':root{color-scheme:light}' +
      '*{box-sizing:border-box}' +
      'body{margin:0;background:#f1f5f9;color:#0f172a;font:14px/1.5 Inter,Segoe UI,Roboto,system-ui,sans-serif;padding:24px}' +
      '.doc{max-width:760px;margin:0 auto;background:#fff;padding:36px;border-radius:14px;box-shadow:0 10px 40px -20px rgba(15,23,42,.4)}' +
      '.top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:18px}' +
      '.mark{width:44px;height:44px;border-radius:12px;background:#0b1a3a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px}' +
      '.co{font-weight:800;font-size:18px;letter-spacing:-.02em;margin-top:8px}' +
      '.muted{color:#64748b;font-size:12px;line-height:1.55}' +
      '.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700}' +
      '.tag-paid{background:#d1fae5;color:#047857}.tag-due{background:#fef3c7;color:#b45309}' +
      'h1{font-size:20px;margin:0 0 4px;letter-spacing:-.02em}' +
      '.grid{display:flex;gap:24px;flex-wrap:wrap;margin:22px 0}' +
      '.grid>div{flex:1 1 220px;min-width:0}' +
      '.lbl{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#64748b;margin-bottom:5px}' +
      'table{width:100%;border-collapse:collapse;margin-top:8px}' +
      'th{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#64748b;text-align:left;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0}' +
      'td{padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top}' +
      '.c{text-align:center}.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.tot{margin-left:auto;width:min(300px,100%);margin-top:16px}' +
      '.tot div{display:flex;justify-content:space-between;padding:6px 0}' +
      '.tot .g{border-top:2px solid #0f172a;margin-top:6px;padding-top:10px;font-weight:800;font-size:17px}' +
      '.terms{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:14px}' +
      '.ft{text-align:center;color:#64748b;font-size:12px;margin-top:20px}' +
      '@media print{body{background:#fff;padding:0}.doc{box-shadow:none;border-radius:0;max-width:none;padding:0}.noprint{display:none!important}@page{size:A4;margin:14mm}}' +
      '</style></head><body><div class="doc">' +
      '<div class="top"><div>' + logo + '<div class="co">' + esc(st.company_name || s.name || 'Abbott Mobiles') + '</div>' +
        '<div class="muted">' + esc(b.name || '') + (b.address ? '<br>' + esc(b.address) : '') +
        (b.phone ? '<br>' + esc(b.phone) : '') + (b.tax_id ? '<br>' + esc(b.tax_id) : '') + '</div></div>' +
      '<div style="text-align:right"><h1>INVOICE</h1>' +
        '<div class="muted"><b>' + esc(order.order_no) + '</b><br>' + esc(utils.date(order.created_at)) + '<br>' +
        'Order status: ' + esc(orderStatusLabel(order)) + '</div>' +
        '<div style="margin-top:8px"><span class="tag ' + (paid ? 'tag-paid' : 'tag-due') + '">' +
        (paid ? 'PAID' : (order.payment_method === 'cod' ? 'PAYABLE ON DELIVERY' : 'PAYMENT PENDING')) + '</span></div></div></div>' +
      '<div class="grid"><div><div class="lbl">Billed to</div><div><b>' + esc(c.name || '') + '</b><br>' +
        '<span class="muted">' + esc(c.phone || '') + (c.email ? '<br>' + esc(c.email) : '') +
        (c.address ? '<br>' + esc(c.address) : '') + (c.city ? '<br>' + esc(c.city) : '') + '</span></div></div>' +
      '<div><div class="lbl">Payment</div><div>' + esc(paymentLabel(order.payment_method)) +
        (order.payment_reference ? '<br><span class="muted">Ref ' + esc(order.payment_reference) + '</span>' : '') + '</div>' +
        '<div class="lbl" style="margin-top:14px">Delivery</div><div class="muted">' + esc(c.city || 'Pakistan') + '</div></div></div>' +
      '<table><thead><tr><th class="c" style="width:38px">#</th><th>Item</th><th class="c" style="width:56px">Qty</th>' +
        '<th class="r" style="width:110px">Price</th><th class="r" style="width:120px">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="tot"><div><span>Subtotal</span><span>' + m(order.subtotal) + '</span></div>' +
        (order.discount ? '<div><span>Discount</span><span>-' + m(order.discount) + '</span></div>' : '') +
        '<div><span>Delivery</span><span>' + (Number(order.delivery_fee) ? m(order.delivery_fee) : 'Free') + '</span></div>' +
        '<div class="g"><span>Total</span><span>' + m(order.total) + '</span></div></div>' +
      '<div class="terms"><div class="lbl">Terms</div><div class="muted">' + esc(st.invoice_terms || '') + '</div></div>' +
      '<div class="ft">' + esc(st.receipt_footer || 'Thank you for shopping with us!') +
        (opts.trackUrl ? '<br>Track your order: ' + esc(opts.trackUrl) : '') + '</div>' +
      '</div></body></html>';
  }

  /** Download the invoice as a file the customer can keep or print to PDF. */
  function downloadInvoice(order) {
    if (!order) return;
    var html = invoiceHtml(order, { trackUrl: location.origin + location.pathname.replace(/[^/]*$/, '') + trackUrl(order) });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    a.download = 'Invoice-' + String(order.order_no).replace(/[^A-Za-z0-9-]/g, '') + '.html';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /**
   * Queue an email. There is no mail server in a frontend prototype, so the message is
   * stored in the `email_outbox` collection (the admin can see exactly what a customer was
   * sent) and the UI offers a mailto: link as the real-world fallback. When the PHP backend
   * lands, this is the one function that changes.
   */
  function sendEmail(msg) {
    msg = msg || {};
    var to = String(msg.to || '').trim();
    if (!emailOk(to)) throw new Error('A valid email address is needed to send this.');
    return db.insert('email_outbox', {
      to: to, subject: String(msg.subject || '').trim(), body_html: String(msg.html || ''),
      template: msg.template || 'generic', reference_type: msg.referenceType || null, reference_id: msg.referenceId || null,
      status: 'queued', source: 'website',
    });
  }
  /** Email the invoice for an order to the address on it. Returns the outbox row. */
  function emailInvoice(order, address) {
    if (!order) throw new Error('Order not found.');
    var to = String(address || (order.customer || {}).email || '').trim();
    if (!emailOk(to)) throw new Error('No email address on this order. Add one to receive the invoice.');
    var row = sendEmail({
      to: to,
      subject: 'Your invoice ' + order.order_no + ' — ' + (site().name || 'Abbott Mobiles'),
      html: invoiceHtml(order, { trackUrl: location.origin + location.pathname.replace(/[^/]*$/, '') + trackUrl(order) }),
      template: 'order_invoice', referenceType: 'online_order', referenceId: order.id,
    });
    db.audit('order.invoice_email', 'online_order', order.id, 'Invoice for ' + order.order_no + ' emailed to ' + to);
    return row;
  }
  /** Every email we have queued about an order. */
  function emailsFor(order) {
    if (!order) return [];
    return db.all('email_outbox').filter(function (e) { return e.reference_type === 'online_order' && String(e.reference_id) === String(order.id); });
  }
  /** A real mailto: link, so the customer can actually send/forward the invoice from their own mail app. */
  function mailtoInvoice(order) {
    if (!order) return '';
    var c = order.customer || {}, s = site();
    var lines = (order.items || []).map(function (l) { return '- ' + l.name + ' x' + l.quantity + '  ' + utils.money(l.total, { decimals: 0 }); }).join('\n');
    var body = 'Invoice ' + order.order_no + '\n' + (s.name || 'Abbott Mobiles') + '\n\n' + lines +
      '\n\nSubtotal: ' + utils.money(order.subtotal, { decimals: 0 }) +
      '\nDelivery: ' + (Number(order.delivery_fee) ? utils.money(order.delivery_fee, { decimals: 0 }) : 'Free') +
      '\nTotal: ' + utils.money(order.total, { decimals: 0 }) +
      '\nPayment: ' + paymentLabel(order.payment_method) +
      '\n\nDelivering to: ' + (c.name || '') + ', ' + (c.address || '') + ' ' + (c.city || '');
    return 'mailto:' + encodeURIComponent(c.email || '') + '?subject=' + encodeURIComponent('Invoice ' + order.order_no) + '&body=' + encodeURIComponent(body);
  }

  /** Recently viewed products (product.html pushes, cart.html reads). */
  var recent = {
    KEY: 'abm.shop.recent',
    get: function () { try { return (JSON.parse(localStorage.getItem(recent.KEY) || '[]') || []).filter(function (id) { return !!product(id); }); } catch (e) { return []; } },
    push: function (id) {
      id = Number(id); if (!id) return;
      try {
        var list = recent.get().filter(function (x) { return Number(x) !== id; });
        list.unshift(id);
        localStorage.setItem(recent.KEY, JSON.stringify(list.slice(0, 12)));
      } catch (e) { /* ignore */ }
    },
    clear: function () { try { localStorage.removeItem(recent.KEY); } catch (e) { /* ignore */ } },
  };
  function sendMessage(data) {
    data = data || {};
    var name = String(data.name || '').trim();
    var message = String(data.message || '').trim();
    if (name.length < 2) throw new Error('Please enter your name.');
    if (!String(data.email || '').trim() && digits(data.phone).length < 10) throw new Error('Please leave an email address or a phone number.');
    if (message.length < 5) throw new Error('Please write your message.');
    var row = db.insert('contact_messages', {
      message_no: db.nextNumber('MSG', 'ON'),
      name: name, phone: String(data.phone || '').trim(), email: String(data.email || '').trim(),
      subject: String(data.subject || '').trim(), message: message, status: 'new', source: 'website',
    });
    db.audit('message.create', 'contact_message', row.id, 'Website message ' + row.message_no + ' from ' + name);
    return row;
  }
  function subscribe(email) {
    email = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email)) throw new Error('Please enter a valid email address.');
    var existing = db.all('newsletter_subscribers').filter(function (s) { return String(s.email).toLowerCase() === email.toLowerCase(); })[0];
    if (existing) return existing;
    return db.insert('newsletter_subscribers', { email: email, source: 'website', is_active: 1 });
  }

  /* -------------------------------------------------------------- helpers */
  function sanitize(html) {
    var s = String(html == null ? '' : html);
    s = s.replace(/<\s*(script|style|iframe|object|embed|form|link|meta|base)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    s = s.replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
    s = s.replace(/(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
    return s;
  }
  function waNumber() {
    var s = social(), c = contact();
    var link = String(s.whatsapp || '');
    var m = link.match(/(\d{8,})/);
    if (/^https?:/i.test(link) && m) return m[1];
    var n = digits(c.whatsapp || c.phone || link);
    if (!n) return '';
    if (n.charAt(0) === '0') n = '92' + n.slice(1);
    return n;
  }
  function waLink(text) {
    var n = waNumber();
    var base = n ? 'https://wa.me/' + n : (social().whatsapp || '#');
    return text ? base + (base.indexOf('?') >= 0 ? '&' : '?') + 'text=' + encodeURIComponent(text) : base;
  }
  var SOCIAL_ICONS = {
    facebook: 'M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0022 12z',
    instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.43-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 5.68A4.16 4.16 0 1016.16 12 4.16 4.16 0 0012 7.84zm0 6.86A2.7 2.7 0 1114.7 12 2.7 2.7 0 0112 14.7zm5.3-7.03a.97.97 0 11-.97-.97.97.97 0 01.97.97z',
    tiktok: 'M16.6 5.82A4.28 4.28 0 0115.54 3h-3.1v12.4a2.59 2.59 0 11-1.86-2.48V9.77a5.69 5.69 0 105.06 5.65V9.4a7.3 7.3 0 004.28 1.37V7.68a4.28 4.28 0 01-3.32-1.86z',
    youtube: 'M23.5 6.2a3 3 0 00-2.12-2.12C19.5 3.56 12 3.56 12 3.56s-7.5 0-9.38.52A3 3 0 00.5 6.2 31.3 31.3 0 000 12a31.3 31.3 0 00.5 5.8 3 3 0 002.12 2.12c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 002.12-2.12A31.3 31.3 0 0024 12a31.3 31.3 0 00-.5-5.8zM9.55 15.57V8.43L15.82 12z',
    whatsapp: 'M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2z',
  };
  function socialIcon(name, cls) {
    var d = SOCIAL_ICONS[name];
    if (!d) return icon('globe', cls || 'w-4 h-4');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="' + esc(cls || 'w-4 h-4') + '" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  function stars(rating) {
    var n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    var out = '<span class="shop-stars" aria-label="' + n + ' out of 5">';
    for (var i = 1; i <= 5; i++) out += icon('star', i <= n ? '' : 'is-off');
    return out + '</span>';
  }

  /* ---------------------------------------------------------------- theme */
  function applyTheme() {
    var t = themeCfg();
    var root = document.documentElement;
    // ?__mode=dark|light previews the other mode without touching the CMS (admin theme preview / QA)
    var override = new URLSearchParams(location.search).get('__mode');
    if (override === 'dark' || override === 'light') t.mode = override;
    var mode = t.mode === 'dark' ? 'dark' : (t.mode === 'auto' || t.mode === 'system'
      ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light') : 'light');
    var scale = ABMx.theme.shadeScale(t.primary);
    var accent = ABMx.theme.shadeScale(t.accent);
    if (scale) Object.keys(scale).forEach(function (k) {
      root.style.setProperty('--shop-primary-' + k, scale[k]);
      root.style.setProperty('--navy-' + k, scale[k]);   // keep any shared token in sync
    });
    if (accent) Object.keys(accent).forEach(function (k) { root.style.setProperty('--shop-accent-' + k, accent[k]); });
    if (mode === 'light') {
      var bg = window.ABM_THEME && window.ABM_THEME.hexToRgb(t.background);
      if (bg) root.style.setProperty('--shop-bg', bg.join(' '));
    }
    root.style.setProperty('--shop-radius', RADIUS_MAP[String(t.radius || '').toLowerCase()] || '1rem');
    // button shape + header treatment chosen in the CMS (website.html → Theme & Colours)
    var BTN_RADIUS = { sharp: '0.25rem', rounded: '0.75rem', pill: '999px' };
    root.style.setProperty('--shop-btn-radius', BTN_RADIUS[String(t.button_style || '').toLowerCase()] || 'var(--shop-radius)');
    // NOTE: never name these `data-shop-header` / `data-shop-footer` — mount() selects those attributes to
    // inject the chrome, and matching <html> would replace the whole document.
    root.setAttribute('data-shop-header-style', ['solid', 'gradient', 'light', 'transparent'].indexOf(String(t.header_style || '').toLowerCase()) >= 0 ? String(t.header_style).toLowerCase() : 'solid');
    root.setAttribute('data-shop-button-style', BTN_RADIUS[String(t.button_style || '').toLowerCase()] ? String(t.button_style).toLowerCase() : 'rounded');
    var font = String(t.font || 'Inter').replace(/["'<>]/g, '');
    root.style.setProperty('--shop-font', "'" + font + "', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");
    root.setAttribute('data-shop-mode', mode);
    // the storefront owns the document theme (so slate/surface tokens follow the CMS mode)
    root.setAttribute('data-theme', mode);
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
    return { mode: mode, primary: t.primary, accent: t.accent };
  }

  /* --------------------------------------------------------------- chrome */
  function currentPage() { return (location.pathname.split('/').pop() || 'index.html').toLowerCase(); }
  function isActive(url) {
    var u = String(url || '').split('?')[0].toLowerCase();
    var cur = currentPage();
    if (!u) return false;
    if (u === cur) {
      var q = String(url).split('?')[1];
      if (!q) return location.search.indexOf('category=') < 0 || cur !== 'products.html';
      return location.search.indexOf(q) >= 0;
    }
    return false;
  }

  function header() {
    var s = site(), c = commerce(), ann = s.announcement || {}, ct = contact();
    // the storefront shows the same mark as the software unless the CMS sets its own
    var logoSrc = s.logo || (window.ABM && ABM.brand ? ABM.brand.logo() : '');
    var logo = logoSrc
      ? '<img src="' + esc(logoSrc) + '" alt="' + esc(s.name || 'Logo') + '" class="shop-logo-img" onerror="ABM.brand.onError(this)" data-fallback-class="shop-logo-mark">'
      : '<span class="shop-logo-mark">' + esc(String(s.name || 'Abbott Mobiles').trim().charAt(0).toUpperCase()) + '</span>';
    var navLinks = menu().map(function (m) {
      return '<a href="' + esc(m.url || '#') + '" class="shop-nav-link' + (isActive(m.url) ? ' is-active' : '') + '">' + esc(m.label) + '</a>';
    }).join('');
    var drawerLinks = menu().map(function (m) {
      return '<a href="' + esc(m.url || '#') + '" class="shop-drawer-link' + (isActive(m.url) ? ' is-active' : '') + '">' +
        icon('chevron-right', '') + '<span class="flex-1 min-w-0 truncate">' + esc(m.label) + '</span></a>';
    }).join('');

    return '' +
    '<div x-data="shopChrome()" @scroll.window="scrolled = (window.scrollY || document.documentElement.scrollTop) > 8">' +
      (ann.enabled && ann.text ? '<div class="shop-announce"><div class="shop-container">' + esc(ann.text) + '</div></div>' : '') +
      '<header class="shop-header" :class="scrolled && \'is-scrolled\'">' +
        '<div class="shop-container shop-header-inner">' +
          '<a href="index.html" class="shop-logo" aria-label="' + esc(s.name || 'Home') + '">' + logo +
            '<span class="shop-logo-text">' +
              '<span class="shop-logo-name">' + esc(s.name || 'Abbott Mobiles') + '</span>' +
              '<span class="shop-logo-sub">' + esc(s.tagline || '') + '</span>' +
            '</span>' +
          '</a>' +
          '<nav class="shop-nav">' + navLinks + '</nav>' +
          '<div class="flex flex-none items-center gap-1 ml-auto">' +
            // search is an icon; it opens a full-width bar under the header (WhatsApp lives in the floating button)
            '<button type="button" class="shop-icon-btn" @click="toggleSearch()" :aria-expanded="searchOpen"' +
              ' aria-label="Search products" title="Search products">' + icon('search', '') + '</button>' +
            (function () {
              var u = auth.user();
              return u
                ? '<div class="shop-acct" x-data="{open:false}">' +
                    '<button type="button" class="shop-acct-btn" @click="open=!open" aria-label="My account">' +
                      '<span class="shop-acct-avatar">' + esc(String(u.name || '?').trim().charAt(0).toUpperCase()) + '</span>' +
                      '<span class="hidden lg:inline truncate max-w-[7rem]">' + esc(String(u.name || '').split(' ')[0]) + '</span>' +
                    '</button>' +
                    '<div x-show="open" x-cloak @click.outside="open=false" class="shop-acct-menu">' +
                      '<a href="account.html" class="shop-acct-item">' + icon('user', '') + 'My account</a>' +
                      '<a href="account.html#orders" class="shop-acct-item">' + icon('bag', '') + 'My orders</a>' +
                      '<a href="order.html" class="shop-acct-item">' + icon('truck', '') + 'Track an order</a>' +
                      '<button type="button" class="shop-acct-item" data-shop-logout>' + icon('logout', '') + 'Sign out</button>' +
                    '</div></div>'
                : '<a href="login.html" class="shop-icon-btn" aria-label="Sign in" title="Sign in or create an account">' + icon('user', '') + '</a>';
            })() +
            '<button type="button" class="shop-icon-btn" @click="openCart()" aria-label="Your cart" title="Your cart">' + icon('bag', '') +
              '<span class="shop-cart-count" x-show="cartCount > 0" x-cloak x-text="cartCount"></span></button>' +
            '<button type="button" class="shop-icon-btn lg:hidden" data-shop-menu @click="menuOpen = true" aria-label="Open menu">' + icon('menu', '') + '</button>' +
          '</div>' +
        '</div>' +
        // search panel — opens from the icon, with live results and quick links
        '<div class="shop-searchbar" x-show="searchOpen" x-cloak @keydown.escape.window="searchOpen = false">' +
          '<div class="shop-container">' +
            '<form class="shop-searchbox" @submit.prevent="search()" role="search">' +
              '<span class="shop-searchbox-icon">' + icon('search', '') + '</span>' +
              '<input type="search" class="shop-searchbox-input" x-ref="searchInput"' +
                ' placeholder="Search for iPhone, laptop, charger, repair…" x-model="q" aria-label="Search products"' +
                ' autocomplete="off">' +
              '<button type="button" class="shop-searchbox-clear" x-show="q" x-cloak @click="q = \'\'; $refs.searchInput.focus()" aria-label="Clear">' + icon('x', '') + '</button>' +
              '<button type="submit" class="shop-searchbox-go">' + icon('search', '') + '<span class="hidden sm:inline">Search</span></button>' +
            '</form>' +

            // live results
            '<div class="shop-suggest" x-show="q.trim().length > 1" x-cloak>' +
              '<template x-for="p in suggestions" :key="p.id">' +
                '<a :href="\'product.html?id=\' + p.id" class="shop-suggest-row">' +
                  '<span class="shop-suggest-thumb" x-html="SHOP.image(p)"></span>' +
                  '<span class="min-w-0 flex-1">' +
                    '<span class="block text-sm font-semibold truncate" x-text="SHOP.title(p)"></span>' +
                    '<span class="block text-xs text-slate-500 truncate" x-text="ABM.db.brandName(p.brand_id) + \' · \' + ABM.db.categoryName(p.category_id)"></span>' +
                  '</span>' +
                  '<span class="text-sm font-bold flex-none" x-text="SHOP.money(p.retail_price, {decimals:0})"></span>' +
                '</a>' +
              '</template>' +
              '<div class="shop-suggest-empty" x-show="!suggestions.length" x-cloak>' +
                'Nothing matches “<b x-text="q"></b>”. Try a brand or model name.' +
              '</div>' +
              '<button type="button" class="shop-suggest-all" x-show="suggestions.length" x-cloak @click="search()">' +
                'See all results for “<b x-text="q"></b>”' + icon('arrow-right', '') +
              '</button>' +
            '</div>' +

            // quick links before typing
            '<div class="shop-suggest-chips" x-show="q.trim().length <= 1" x-cloak>' +
              '<span class="shop-suggest-label">Popular</span>' +
              '<a href="products.html?device=mobile" class="shop-chip">Smartphones</a>' +
              '<a href="products.html?device=laptop" class="shop-chip">Laptops</a>' +
              '<a href="products.html?type=accessory" class="shop-chip">Accessories</a>' +
              '<a href="products.html?type=part" class="shop-chip">Spare parts</a>' +
              '<a href="repair.html" class="shop-chip">Repairs</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div x-show="menuOpen" x-cloak class="shop-drawer-backdrop" @click="menuOpen = false" x-transition.opacity></div>' +
      '<aside x-show="menuOpen" x-cloak class="shop-drawer" @keydown.escape.window="menuOpen = false" ' +
        'x-transition:enter="transition ease-out duration-200" x-transition:enter-start="translate-x-full" x-transition:enter-end="translate-x-0" ' +
        'x-transition:leave="transition ease-in duration-150" x-transition:leave-start="translate-x-0" x-transition:leave-end="translate-x-full" role="dialog" aria-label="Menu">' +
        '<div class="shop-drawer-head">' +
          logo +
          '<span class="min-w-0 flex-1"><span class="shop-logo-name block truncate">' + esc(s.name || 'Abbott Mobiles') + '</span>' +
          '<span class="shop-logo-sub block truncate">' + esc(s.tagline || '') + '</span></span>' +
          '<button type="button" class="shop-icon-btn" @click="menuOpen = false" aria-label="Close menu">' + icon('x', '') + '</button>' +
        '</div>' +
        '<div class="shop-drawer-body">' + drawerLinks +
          (auth.user()
            ? '<a href="account.html" class="shop-drawer-link">' + icon('user', '') + '<span class="flex-1 min-w-0 truncate">My account</span></a>' +
              '<button type="button" class="shop-drawer-link w-full" data-shop-logout>' + icon('logout', '') + '<span class="flex-1 min-w-0 truncate text-left">Sign out</span></button>'
            : '<a href="login.html" class="shop-drawer-link">' + icon('user', '') + '<span class="flex-1 min-w-0 truncate">Sign in / Register</span></a>') +
          '<a href="order.html" class="shop-drawer-link">' + icon('truck', '') + '<span class="flex-1 min-w-0 truncate">Track my order</span></a>' +
          '<a href="cart.html" class="shop-drawer-link">' + icon('bag', '') + '<span class="flex-1 min-w-0 truncate">Cart</span>' +
            '<span class="shop-badge shop-badge-accent" x-show="cartCount > 0" x-cloak x-text="cartCount"></span></a>' +
        '</div>' +
        '<div class="shop-drawer-foot space-y-2">' +
          (waNumber() ? '<a href="' + esc(waLink('Hello ' + (s.name || '') + '!')) + '" target="_blank" rel="noopener" class="shop-btn shop-btn-accent shop-btn-block">' + socialIcon('whatsapp', '') + 'Chat on WhatsApp</a>' : '') +
          (ct.phone ? '<a href="tel:' + esc(digits(ct.phone)) + '" class="shop-btn shop-btn-outline shop-btn-block">' + icon('phone-call', '') + esc(ct.phone) + '</a>' : '') +
        '</div>' +
      '</aside>' +

      /* ---------------------------- CART DRAWER (slides in from the right) ---------------------------- */
      '<div x-show="cartOpen" x-cloak class="shop-drawer-backdrop" @click="cartOpen = false" x-transition.opacity></div>' +
      '<aside x-show="cartOpen" x-cloak class="shop-drawer shop-cart-drawer" @keydown.escape.window="cartOpen = false" ' +
        'x-transition:enter="transition ease-out duration-200" x-transition:enter-start="translate-x-full" x-transition:enter-end="translate-x-0" ' +
        'x-transition:leave="transition ease-in duration-150" x-transition:leave-start="translate-x-0" x-transition:leave-end="translate-x-full" ' +
        'role="dialog" aria-label="Your cart">' +
        '<div class="shop-drawer-head">' +
          '<span class="shop-cart-head-icon">' + icon('bag', '') + '</span>' +
          '<span class="min-w-0 flex-1">' +
            '<span class="shop-logo-name block">Your cart</span>' +
            '<span class="shop-logo-sub block" x-text="cartCount + (cartCount === 1 ? \' item\' : \' items\')"></span>' +
          '</span>' +
          '<button type="button" class="shop-icon-btn" @click="cartOpen = false" aria-label="Close cart">' + icon('x', '') + '</button>' +
        '</div>' +

        '<div class="shop-cart-lines">' +
          '<template x-for="l in cartLines" :key="l.product_id">' +
            '<div class="shop-cart-line">' +
              '<a :href="\'product.html?id=\' + l.product_id" class="shop-cart-thumb" x-html="SHOP.image(l.product)"></a>' +
              '<div class="min-w-0 flex-1">' +
                '<a :href="\'product.html?id=\' + l.product_id" class="shop-cart-name" x-text="SHOP.title(l.product)"></a>' +
                '<div class="shop-cart-unit" x-text="SHOP.money(l.unit_price, {decimals:0}) + \' each\'"></div>' +
                '<div class="shop-qty mt-1.5">' +
                  '<button type="button" @click="setQty(l, l.qty - 1)" aria-label="Less">' + icon('minus', '') + '</button>' +
                  '<span x-text="l.qty"></span>' +
                  '<button type="button" @click="setQty(l, l.qty + 1)" :disabled="l.qty >= l.max" aria-label="More">' + icon('plus', '') + '</button>' +
                '</div>' +
              '</div>' +
              '<div class="text-right flex-none">' +
                '<div class="font-bold text-sm" x-text="SHOP.money(l.total, {decimals:0})"></div>' +
                '<button type="button" class="shop-cart-remove" @click="setQty(l, 0)" aria-label="Remove">' + icon('trash', '') + '</button>' +
              '</div>' +
            '</div>' +
          '</template>' +

          '<div class="shop-cart-empty" x-show="!cartLines.length" x-cloak>' +
            '<span>' + icon('bag', '') + '</span>' +
            '<div class="shop-empty-title">Your cart is empty</div>' +
            '<p class="text-sm mt-1">Add a phone, laptop or accessory and it will show up here.</p>' +
            '<a href="products.html" class="shop-btn mt-4">Start shopping</a>' +
          '</div>' +
        '</div>' +

        '<div class="shop-cart-foot" x-show="cartLines.length" x-cloak>' +
          '<div class="shop-cart-row"><span>Subtotal</span><b x-text="SHOP.money(cartSubtotal, {decimals:0})"></b></div>' +
          '<div class="shop-cart-row"><span>Delivery</span><b x-text="cartDelivery ? SHOP.money(cartDelivery, {decimals:0}) : \'Free\'"></b></div>' +
          '<div class="shop-cart-note" x-show="freeLeft > 0" x-cloak>' +
            'Add <b x-text="SHOP.money(freeLeft, {decimals:0})"></b> more for free delivery.' +
          '</div>' +
          '<div class="shop-cart-total"><span>Total</span><span x-text="SHOP.money(cartSubtotal + cartDelivery, {decimals:0})"></span></div>' +
          '<a href="checkout.html" class="shop-btn shop-btn-accent shop-btn-block shop-btn-lg mt-3">' + icon('check', '') + 'Checkout</a>' +
          '<a href="cart.html" class="shop-btn shop-btn-outline shop-btn-block mt-2">View full cart</a>' +
        '</div>' +
      '</aside>' +
    '</div>';
  }

  function footer() {
    var s = site(), c = commerce(), ct = contact(), so = social();
    var quick = [
      { label: 'All products', url: 'products.html' },
      { label: 'Laptops & computers', url: 'products.html?device=laptop' },
      { label: 'Accessories', url: 'products.html?type=accessory' },
      { label: 'Book a repair', url: 'repair.html' },
      { label: 'Track my order', url: 'order.html' },
      { label: 'Contact us', url: 'contact.html' },
    ].map(function (l) { return '<li><a href="' + esc(l.url) + '">' + esc(l.label) + '</a></li>'; }).join('');
    var cmsLinks = pages().map(function (p) {
      return '<li><a href="page.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a></li>';
    }).join('') || '<li class="text-white/40 text-sm">No pages published yet</li>';
    var socials = ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp'].filter(function (k) { return so[k]; }).map(function (k) {
      return '<a href="' + esc(so[k]) + '" target="_blank" rel="noopener" class="shop-social" aria-label="' + esc(k) + '">' + socialIcon(k, '') + '</a>';
    }).join('');
    var pays = [];
    if (c.cod_enabled) pays.push({ label: 'Cash on Delivery', icon: 'banknotes' });
    if (c.wallet_enabled) { pays.push({ label: 'JazzCash', icon: 'wallet' }); pays.push({ label: 'EasyPaisa', icon: 'wallet' }); }
    if (c.bank_transfer_enabled) pays.push({ label: 'Bank Transfer', icon: 'building' });
    var payBadges = pays.map(function (p) { return '<span class="shop-pay">' + icon(p.icon, '') + esc(p.label) + '</span>'; }).join('');

    return '' +
    '<footer class="shop-footer">' +
      '<div class="shop-container">' +
        '<div class="shop-footer-grid">' +
          '<div class="min-w-0">' +
            '<div class="flex items-center gap-2.5 mb-3">' +
              '<span class="shop-logo-mark">' + esc(String(s.name || 'A').trim().charAt(0).toUpperCase()) + '</span>' +
              '<span class="min-w-0"><span class="block font-extrabold text-white truncate">' + esc(s.name || 'Abbott Mobiles') + '</span>' +
              '<span class="block text-xs text-white/50 truncate">' + esc(s.tagline || '') + '</span></span>' +
            '</div>' +
            '<p class="text-sm leading-relaxed text-white/65 max-w-sm">' + esc(s.footer_text || s.tagline || '') + '</p>' +
            (socials ? '<div class="flex items-center gap-2 mt-4">' + socials + '</div>' : '') +
            (payBadges ? '<div class="flex flex-wrap items-center gap-1.5 mt-5">' + payBadges + '</div>' : '') +
          '</div>' +
          '<div class="min-w-0"><h4>Shop</h4><ul class="space-y-2">' + quick + '</ul></div>' +
          '<div class="min-w-0"><h4>Information</h4><ul class="space-y-2">' + cmsLinks + '</ul></div>' +
          '<div class="min-w-0"><h4>Get in touch</h4><ul class="space-y-3 text-sm">' +
            (ct.address ? '<li class="flex gap-2.5"><span class="text-white/40 flex-none">' + icon('map-pin', 'w-4 h-4') + '</span><span class="min-w-0">' + esc(ct.address) + '</span></li>' : '') +
            (ct.phone ? '<li class="flex gap-2.5"><span class="text-white/40 flex-none">' + icon('phone-call', 'w-4 h-4') + '</span><a href="tel:' + esc(digits(ct.phone)) + '" class="min-w-0 break-words">' + esc(ct.phone) + '</a></li>' : '') +
            (ct.email ? '<li class="flex gap-2.5"><span class="text-white/40 flex-none">' + icon('mail', 'w-4 h-4') + '</span><a href="mailto:' + esc(ct.email) + '" class="min-w-0 break-words">' + esc(ct.email) + '</a></li>' : '') +
            (ct.hours ? '<li class="flex gap-2.5"><span class="text-white/40 flex-none">' + icon('clock', 'w-4 h-4') + '</span><span class="min-w-0">' + esc(ct.hours) + '</span></li>' : '') +
          '</ul>' +
          (waNumber() ? '<a href="' + esc(waLink('Hello ' + (s.name || '') + '!')) + '" target="_blank" rel="noopener" class="shop-btn shop-btn-accent shop-btn-sm mt-4">' + socialIcon('whatsapp', '') + 'WhatsApp us</a>' : '') +
          '</div>' +
        '</div>' +
        '<div class="shop-footer-bottom">' +
          '<span>© ' + new Date().getFullYear() + ' ' + esc(s.name || 'Abbott Mobiles') + '. All rights reserved.</span>' +
          '<span class="flex flex-wrap items-center gap-x-4 gap-y-1">' +
            '<a href="page.html?slug=privacy">Privacy</a><a href="page.html?slug=return-policy">Returns</a>' +
            '<a href="../login.html">Staff login</a>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</footer>';
  }

  /** Floating buttons every storefront page gets: WhatsApp us, and back to top. */
  function fabs() {
    if (document.querySelector('.shop-fab-stack')) return;
    var s = site(), wa = waNumber() ? waLink('Hello ' + (s.name || '') + ', I have a question.') : '';
    var el = document.createElement('div');
    el.className = 'shop-fab-stack';
    el.innerHTML =
      (wa ? '<a href="' + esc(wa) + '" target="_blank" rel="noopener" class="shop-fab shop-fab-wa" aria-label="Chat on WhatsApp">' +
        socialIcon('whatsapp', '') + '<span class="shop-fab-label">WhatsApp</span></a>' : '') +
      '<button type="button" class="shop-fab shop-fab-top" data-shop-top aria-label="Back to top" hidden>' + icon('chevron-up', '') + '</button>';
    document.body.appendChild(el);
    var top = el.querySelector('[data-shop-top]');
    var onScroll = function () { top.hidden = (window.scrollY || document.documentElement.scrollTop) < 400; };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    top.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    });
  }

  function mount() {
    var h = document.querySelector('[data-shop-header]');
    if (h && !h.dataset.mounted) { h.innerHTML = header(); h.dataset.mounted = '1'; }
    var f = document.querySelector('[data-shop-footer]');
    if (f && !f.dataset.mounted) { f.innerHTML = footer(); f.dataset.mounted = '1'; }
    fabs();
    if (!document.body.dataset.shopLogoutBound) {
      document.body.dataset.shopLogoutBound = '1';
      document.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-shop-logout]');
        if (!b) return;
        ev.preventDefault();
        auth.logout();
        ui.toast('You have been signed out.', 'success');
        setTimeout(function () { location.href = 'index.html'; }, 250);
      });
    }
  }

  /* Alpine component behind the injected chrome. */
  window.shopChrome = function () {
    return {
      menuOpen: false, scrolled: false, searchOpen: false, cartOpen: false, cartTick: 0,
      q: utils.qs('q') || '', cartCount: cart.count(),
      /* ------------------------------- cart drawer ------------------------------- */
      openCart() { this.cartOpen = true; this.cartTick++; },
      /** Cart contents resolved against the live catalogue. */
      get cartLines() {
        this.cartTick;                       // re-read whenever the cart changes
        var self = this;
        return cart.get().map(function (l) {
          var p = product(l.product_id);
          if (!p) return null;
          var qty = Math.max(1, Number(l.qty) || 1);
          return { product_id: p.id, product: p, qty: qty, max: maxQty(p) || qty, unit_price: priceOf(p), total: utils.round2(priceOf(p) * qty) };
        }).filter(Boolean);
      },
      get cartSubtotal() { return utils.round2(this.cartLines.reduce(function (s, l) { return s + l.total; }, 0)); },
      get cartDelivery() { return deliveryFee(this.cartSubtotal); },
      /** How much more is needed to reach free delivery (0 when already free). */
      get freeLeft() {
        var above = Number(commerce().free_delivery_above) || 0;
        if (!above || this.cartSubtotal >= above || !this.cartLines.length) return 0;
        return utils.round2(above - this.cartSubtotal);
      },
      setQty(line, qty) {
        try {
          if (qty <= 0) cart.remove(line.product_id);
          else cart.setQty(line.product_id, Math.min(qty, line.max));
          this.cartTick++;
          this.cartCount = cart.count();
        } catch (e) { ui.toast(e.message, 'error'); }
      },
      /** The header search is an icon: tapping it reveals the panel and focuses the field. */
      toggleSearch() {
        this.searchOpen = !this.searchOpen;
        if (this.searchOpen) this.$nextTick(function () { var el = this.$refs.searchInput; if (el) el.focus(); }.bind(this));
      },
      /** Live suggestions while typing — the six closest products. */
      get suggestions() {
        var term = String(this.q || '').trim().toLowerCase();
        if (term.length < 2) return [];
        return products().filter(function (p) {
          return [p.name, p.model, p.variant, p.sku, p.barcode, db.brandName(p.brand_id), db.categoryName(p.category_id)]
            .join(' ').toLowerCase().indexOf(term) >= 0;
        }).slice(0, 6);
      },
      init() {
        var self = this;
        this._sync = function () { self.cartCount = cart.count(); };
        window.addEventListener('shop:cart', this._sync);
        window.addEventListener('storage', this._sync);
        // arriving from a search keeps the bar open with the term visible
        if (this.q) this.searchOpen = true;
        // while a drawer is open: lock page scrolling and get the floating buttons out of the way
        var lock = function () {
          var open = self.menuOpen || self.cartOpen;
          try {
            document.body.style.overflow = open ? 'hidden' : '';
            document.body.classList.toggle('shop-drawer-open', open);
          } catch (e) { /* ignore */ }
        };
        this.$watch('menuOpen', lock);
        this.$watch('cartOpen', lock);
      },
      search() {
        var q = String(this.q || '').trim();
        location.href = 'products.html' + (q ? '?q=' + encodeURIComponent(q) : '');
      },
    };
  };

  /* --------------------------------------------------- dev / QA helpers */
  /** Public pages skip ABM.shell.render(), so re-implement ?__click= and ?__layout=1 here. */
  function devTools() {
    var q = new URLSearchParams(location.search);
    var clickSel = q.get('__click');
    if (clickSel) setTimeout(function () {
      try { var el = document.querySelector(clickSel); if (el) el.click(); else console.log('ABM_CLICK not found: ' + clickSel); }
      catch (e) { console.log('ABM_CLICK error: ' + e.message); }
    }, 700);
    if (q.get('__layout') !== '1') return;
    setTimeout(function () {
      var vw = document.documentElement.clientWidth;
      var bad = [];
      var inScroller = function (el) {
        var p = el.parentElement;
        while (p && p !== document.body) { var ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; p = p.parentElement; }
        return false;
      };
      document.querySelectorAll('body *').forEach(function (el) {
        if (el.closest('[x-cloak]') || el.closest('.shop-drawer-backdrop')) return;
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1 && !inScroller(el)) {
          var cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 4).join('.') : '';
          bad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '') + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width));
        }
      });
      console.log('ABM_LAYOUT viewport=' + vw + ' scrollWidth=' + document.documentElement.scrollWidth + ' overflowing=' + bad.length);
      bad.slice(0, 25).forEach(function (b) { console.log('ABM_LAYOUT_OVERFLOW ' + b); });
    }, 1400);
  }

  /* ----------------------------------------------------------------- boot */
  var appliedTheme = applyTheme();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); devTools(); });
  else { mount(); devTools(); }

  return {
    // cms / content
    cms: cms, site: site, commerce: commerce, repairBooking: repairBooking, theme: appliedTheme,
    menu: menu, pages: pages, page: page, banners: banners, testimonials: testimonials, highlights: highlights,
    contact: contact, social: social, sanitize: sanitize, escape: esc,
    // catalog
    branchId: branchId, branch: branch, branches: branches,
    products: products, product: product, services: services, categories: categories, brands: brands,
    stockOf: stockOf, inStock: inStock, canOrder: canOrder, stockLabel: stockLabel, maxQty: maxQty,
    priceOf: priceOf, title: title, subtitle: subtitle, matches: matches, image: image, placeholder: placeholder, mediaCount: mediaCount,
    // cart & checkout
    cart: cart, deliveryFee: deliveryFee, orderTotal: orderTotal, paymentMethods: paymentMethods,
    placeOrder: placeOrder, findOrder: findOrder, trackUrl: trackUrl, recent: recent,
    // accounts, tracking, invoice & email
    auth: auth, orderSteps: orderSteps, orderStatusLabel: orderStatusLabel, paymentLabel: paymentLabel,
    invoiceHtml: invoiceHtml, downloadInvoice: downloadInvoice,
    sendEmail: sendEmail, emailInvoice: emailInvoice, emailsFor: emailsFor, mailtoInvoice: mailtoInvoice,
    // forms
    bookRepair: bookRepair, sendMessage: sendMessage, subscribe: subscribe,
    // chrome & misc
    header: header, footer: footer, mount: mount, applyTheme: applyTheme,
    money: function (v, o) { return utils.money(v, o); },
    toast: function (m, t) { return ui.toast(m, t || 'success'); },
    confirm: function (o) { return ui.confirm(o); },
    icon: icon, socialIcon: socialIcon, stars: stars, waNumber: waNumber, waLink: waLink, digits: digits,
    CART_KEY: CART_KEY,
  };
})();
