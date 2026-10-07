/* ==========================================================================
   Abbott Mobile - Demo data seed (frontend prototype)
   Universal retail + repair model: smartphones, tablets, watches, laptops,
   desktops (serialized by IMEI or serial number), accessories, spare parts,
   non-stock service/labor items and repair job cards with technicians.
   Shapes mirror the planned MySQL schema so the UI logic ports 1:1 to PHP.
   Loaded once into localStorage by ABM.db (see app.js). Reset via user menu.
   ========================================================================== */
window.ABM_SEED = function () {
  // ---- deterministic PRNG (mulberry32) so every reset looks the same ----
  let seed = 20260922;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const chance = (p) => rnd() < p;
  const round2 = (n) => Math.round(n * 100) / 100;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nowHour = new Date().getHours();
  // Local-time ISO stamp with offset (matches ABM.utils.now()): pages group rows by the first 10
  // characters of a timestamp, so a UTC stamp would file evening records under the wrong day.
  const localIso = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`;
  };
  /**
   * A demo timestamp. Anything dated TODAY is pulled back to before the current time: a sample
   * database opened in the morning must not show sales, orders or counts "made" later tonight.
   */
  const at = (daysAgo, h = 10, m = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    let hh = h, mm = m;
    if (daysAgo <= 0 && hh > nowHour) { hh = Math.max(0, nowHour - (hh % 3)); mm = (mm + 7) % 60; }
    d.setHours(hh, mm, 0, 0);
    return localIso(d);
  };
  const dateOnly = (daysAgo) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const pad = (n, w = 6) => String(n).padStart(w, '0');
  // full EAN-13 (12 digits + check digit), the same code the label prints and the scanner reads back
  const ean13 = (twelve) => { let s = 0; for (let i = 0; i < 12; i++) s += Number(twelve[i]) * (i % 2 ? 3 : 1); return twelve + ((10 - (s % 10)) % 10); };

  // Luhn check digit so demo IMEIs look real
  const luhnDigit = (digits14) => { let sum = 0; for (let i = 0; i < 14; i++) { let d = +digits14[i]; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; } return String((10 - (sum % 10)) % 10); };
  const usedSerials = new Set();
  const genImei = () => { let s; do { s = pick(['35', '86', '49', '01', '99']); while (s.length < 14) s += String(Math.floor(rnd() * 10)); s += luhnDigit(s); } while (usedSerials.has(s)); usedSerials.add(s); return s; };
  const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const genSerial = (prefix) => { let s; do { s = prefix; for (let i = 0; i < 7; i++) s += ALNUM[Math.floor(rnd() * ALNUM.length)]; } while (usedSerials.has(s)); usedSerials.add(s); return s; };

  // ---------------------------------------------------------------- branches
  const branches = [
    { id: 1, code: 'MB', name: 'Main Branch', address: 'Shop 12, Hall Road, Lahore', phone: '042-37311234', tax_id: 'NTN 1234567-8', is_active: 1, created_at: at(400) },
    { id: 2, code: 'B2', name: 'Branch 2 - Gulberg', address: 'Plaza 4, MM Alam Road, Gulberg III, Lahore', phone: '042-35771234', tax_id: 'NTN 1234567-8', is_active: 1, created_at: at(300) },
    { id: 3, code: 'B3', name: 'Branch 3 - Johar Town', address: 'Block G1, Johar Town, Lahore', phone: '042-35171234', tax_id: 'NTN 1234567-8', is_active: 0, created_at: at(120) },
  ];

  // ------------------------------------------------------------------- users
  const users = [
    { id: 1, branch_id: null, name: 'Abbott Admin', username: 'admin', email: 'admin@abbottmobile.pk', phone: '0300-1234567', role: 'super_admin', is_active: 1, last_login_at: at(0, 9, 5), created_at: at(400) },
    { id: 2, branch_id: 1, name: 'Ahmed Raza', username: 'manager', email: 'ahmed@abbottmobile.pk', phone: '0301-2345678', role: 'branch_manager', is_active: 1, last_login_at: at(0, 9, 30), created_at: at(390) },
    { id: 3, branch_id: 1, name: 'Bilal Hussain', username: 'cashier', email: 'bilal@abbottmobile.pk', phone: '0302-3456789', role: 'cashier', is_active: 1, last_login_at: at(0, 10, 0), created_at: at(380) },
    { id: 4, branch_id: 2, name: 'Sana Malik', username: 'sana', email: 'sana@abbottmobile.pk', phone: '0303-4567890', role: 'branch_manager', is_active: 1, last_login_at: at(1, 18, 10), created_at: at(290) },
    { id: 5, branch_id: 2, name: 'Usman Tariq', username: 'usman', email: 'usman@abbottmobile.pk', phone: '0304-5678901', role: 'cashier', is_active: 1, last_login_at: at(0, 11, 20), created_at: at(280) },
    { id: 6, branch_id: 1, name: 'Hamza Ali', username: 'hamza', email: 'hamza@abbottmobile.pk', phone: '0305-6789012', role: 'cashier', is_active: 0, last_login_at: at(40, 15, 0), created_at: at(200) },
    { id: 7, branch_id: 1, name: 'Zain Abbas', username: 'technician', email: 'zain@abbottmobile.pk', phone: '0306-7890123', role: 'technician', is_active: 1, last_login_at: at(0, 9, 45), created_at: at(250), specialties: 'Mobile & laptop hardware, chip-level' },
    { id: 8, branch_id: 2, name: 'Faraz Khan', username: 'faraz', email: 'faraz@abbottmobile.pk', phone: '0307-8901234', role: 'technician', is_active: 1, last_login_at: at(1, 17, 0), created_at: at(240), specialties: 'Software, laptops' },
  ];

  // --------------------------------------------------------------- catalog
  // product_type: device | accessory | part | service ; device_type: mobile | tablet | smartwatch | laptop | desktop
  // serialized items are tracked per unit: serial_type 'imei' (15 digits) or 'serial' (alphanumeric)
  const categories = [
    { id: 1, name: 'Smartphones', product_type: 'device', device_type: 'mobile', is_serialized: 1, serial_type: 'imei', is_active: 1 },
    { id: 2, name: 'Tablets', product_type: 'device', device_type: 'tablet', is_serialized: 1, serial_type: 'imei', is_active: 1 },
    { id: 3, name: 'Smartwatches', product_type: 'device', device_type: 'smartwatch', is_serialized: 1, serial_type: 'imei', is_active: 1 },
    { id: 4, name: 'Laptops', product_type: 'device', device_type: 'laptop', is_serialized: 1, serial_type: 'serial', is_active: 1 },
    { id: 5, name: 'Desktops & All-in-One', product_type: 'device', device_type: 'desktop', is_serialized: 1, serial_type: 'serial', is_active: 1 },
    { id: 6, name: 'Accessories', product_type: 'accessory', device_type: null, is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 7, name: 'Cables & Chargers', product_type: 'accessory', device_type: null, is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 8, name: 'Audio', product_type: 'accessory', device_type: null, is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 9, name: 'Power Banks', product_type: 'accessory', device_type: null, is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 10, name: 'Screen Protectors & Cases', product_type: 'accessory', device_type: null, is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 11, name: 'Mobile Spare Parts', product_type: 'part', device_type: 'mobile', is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 12, name: 'Laptop Spare Parts', product_type: 'part', device_type: 'laptop', is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 13, name: 'Computer Components', product_type: 'part', device_type: null, is_serialized: 0, serial_type: null, is_active: 1 },
    { id: 14, name: 'Repair Services', product_type: 'service', device_type: null, is_serialized: 0, serial_type: null, is_active: 1 },
  ].map((c) => ({ ...c, is_imei_tracked: c.is_serialized }));
  const brands = ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Infinix', 'Tecno', 'Realme', 'Anker', 'Baseus', 'JBL', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'Kingston', 'Generic']
    .map((name, i) => ({ id: i + 1, name, is_active: 1 }));
  const brandId = (name) => brands.find((b) => b.name === name).id;

  // [category, brand, name, model, variant, color, cost, retail, wholesale, min_stock, tax, extra]
  const productDefs = [
    // smartphones
    [1, 'Apple', 'iPhone 15', 'A3090', '128GB', 'Black', 265000, 289900, 279000, 2, 0, { specs: { storage: '128GB', ram: '6GB', screen: '6.1" OLED', os: 'iOS 17' }, warranty_months: 12 }],
    [1, 'Apple', 'iPhone 15 Pro', 'A3102', '256GB', 'Natural Titanium', 380000, 414900, 399000, 1, 0, { specs: { storage: '256GB', ram: '8GB', screen: '6.1" OLED 120Hz', os: 'iOS 17' }, warranty_months: 12 }],
    [1, 'Apple', 'iPhone 13', 'A2633', '128GB', 'Midnight', 175000, 189900, 182000, 2, 0, { specs: { storage: '128GB', ram: '4GB', screen: '6.1" OLED', os: 'iOS 17' }, warranty_months: 12 }],
    [1, 'Samsung', 'Galaxy S24', 'SM-S921B', '8GB/256GB', 'Onyx Black', 245000, 269999, 259000, 2, 0, { specs: { storage: '256GB', ram: '8GB', screen: '6.2" AMOLED 120Hz', os: 'Android 14' }, warranty_months: 12 }],
    [1, 'Samsung', 'Galaxy A55', 'SM-A556E', '8GB/256GB', 'Awesome Navy', 105000, 119999, 112000, 3, 0, { specs: { storage: '256GB', ram: '8GB', screen: '6.6" AMOLED', os: 'Android 14' }, warranty_months: 12 }],
    [1, 'Samsung', 'Galaxy A15', 'SM-A155F', '6GB/128GB', 'Blue', 45000, 52999, 49000, 4, 0, { specs: { storage: '128GB', ram: '6GB', screen: '6.5" AMOLED', os: 'Android 14' }, warranty_months: 12 }],
    [1, 'Xiaomi', 'Redmi Note 13 Pro', '2312DRA50G', '8GB/256GB', 'Midnight Black', 62000, 69999, 65500, 3, 0, { specs: { storage: '256GB', ram: '8GB', screen: '6.67" AMOLED', os: 'Android 13' }, warranty_months: 12 }],
    [1, 'Xiaomi', 'Xiaomi 14', '23127PN0CG', '12GB/512GB', 'Black', 210000, 239999, 225000, 1, 0, { specs: { storage: '512GB', ram: '12GB', screen: '6.36" AMOLED', os: 'Android 14' }, warranty_months: 12 }],
    [1, 'Oppo', 'Reno 11', 'CPH2599', '8GB/256GB', 'Wave Green', 95000, 109999, 101000, 2, 0, { specs: { storage: '256GB', ram: '8GB', screen: '6.7" AMOLED', os: 'Android 14' }, warranty_months: 12 }],
    [1, 'Vivo', 'V30', 'V2318', '12GB/256GB', 'Bloom White', 118000, 129999, 123000, 2, 0, { specs: { storage: '256GB', ram: '12GB', screen: '6.78" AMOLED', os: 'Android 14' }, warranty_months: 12 }],
    [1, 'Infinix', 'Hot 40 Pro', 'X6837', '8GB/256GB', 'Palm Blue', 36000, 41999, 38500, 5, 0, { specs: { storage: '256GB', ram: '8GB', screen: '6.78" IPS', os: 'Android 13' }, warranty_months: 12 }],
    [1, 'Tecno', 'Spark 20 Pro', 'KJ6', '8GB/256GB', 'Magic Skin Black', 33000, 38999, 35500, 5, 0, { specs: { storage: '256GB', ram: '8GB', screen: '6.78" IPS', os: 'Android 13' }, warranty_months: 12 }],
    [1, 'Realme', 'C67', 'RMX3890', '8GB/128GB', 'Sunny Oasis', 42000, 47999, 44500, 4, 0, { specs: { storage: '128GB', ram: '8GB', screen: '6.72" IPS', os: 'Android 14' }, warranty_months: 12 }],
    // tablets & watches
    [2, 'Samsung', 'Galaxy Tab A9+', 'SM-X210', '4GB/64GB', 'Graphite', 58000, 64999, 61000, 2, 0, { specs: { storage: '64GB', ram: '4GB', screen: '11" LCD' }, warranty_months: 12 }],
    [2, 'Apple', 'iPad 10th Gen', 'A2696', '64GB', 'Silver', 118000, 129900, 124000, 1, 0, { specs: { storage: '64GB', screen: '10.9" Liquid Retina' }, warranty_months: 12 }],
    [3, 'Apple', 'Apple Watch SE', 'A2722', '40mm GPS', 'Midnight', 72000, 79900, 76000, 1, 0, { warranty_months: 12 }],
    [3, 'Samsung', 'Galaxy Watch6', 'SM-R940', '44mm BT', 'Graphite', 62000, 69999, 65000, 1, 0, { warranty_months: 12 }],
    // accessories (18-26)
    [7, 'Anker', '20W USB-C Charger', 'A2633', '20W PD', 'White', 3200, 4500, 3900, 10, 0, { warranty_months: 6 }],
    [7, 'Baseus', 'USB-C to Lightning Cable', 'CATLGD', '1m', 'Black', 1100, 1800, 1450, 15, 0, {}],
    [7, 'Samsung', '25W Travel Adapter', 'EP-TA800', '25W', 'Black', 2800, 3999, 3400, 10, 0, { warranty_months: 6 }],
    [8, 'JBL', 'Tune 510BT Headphones', 'JBLT510BT', 'Wireless', 'Black', 9500, 12999, 11200, 3, 0, { warranty_months: 12 }],
    [9, 'Anker', 'PowerCore 10000mAh', 'A1263', '10000mAh', 'Black', 6200, 8499, 7300, 5, 0, { warranty_months: 12 }],
    [10, 'Generic', 'Tempered Glass iPhone 15', 'TG-IP15', '9H', 'Clear', 250, 800, 500, 20, 0, {}],
    [10, 'Generic', 'Silicone Case iPhone 15', 'SC-IP15', 'Soft', 'Navy', 450, 1500, 900, 15, 0, {}],
    [7, 'Generic', 'Type-C Cable', 'TC-1M', '1m', 'White', 180, 500, 320, 30, 0, {}],
    [8, 'Xiaomi', 'Redmi Buds 4 Lite', 'M2231E1', 'TWS', 'Black', 4500, 6499, 5400, 5, 0, { warranty_months: 6 }],
    // laptops & desktops (27-32) — serial-number tracked
    [4, 'Dell', 'Latitude 5420', 'Latitude 5420', 'i5-1135G7 / 8GB / 256GB', 'Grey', 95000, 112000, 104000, 1, 0, { condition: 'refurbished', serial_prefix: 'DL5420', specs: { processor: 'Intel Core i5-1135G7', generation: '11th Gen', ram: '8GB DDR4', storage: '256GB NVMe SSD', screen: '14" FHD', os: 'Windows 11 Pro', battery_health: '88%' }, warranty_months: 3 }],
    [4, 'HP', 'EliteBook 840 G8', '840 G8', 'i7-1165G7 / 16GB / 512GB', 'Silver', 145000, 168000, 158000, 1, 0, { condition: 'refurbished', serial_prefix: 'HP840G8', specs: { processor: 'Intel Core i7-1165G7', generation: '11th Gen', ram: '16GB DDR4', storage: '512GB NVMe SSD', screen: '14" FHD Touch', os: 'Windows 11 Pro', battery_health: '91%' }, warranty_months: 3 }],
    [4, 'Lenovo', 'ThinkPad T14 Gen 2', 'T14 Gen 2', 'i5-1145G7 / 16GB / 512GB', 'Black', 128000, 149000, 140000, 1, 0, { condition: 'refurbished', serial_prefix: 'LNT14', specs: { processor: 'Intel Core i5-1145G7', generation: '11th Gen', ram: '16GB DDR4', storage: '512GB NVMe SSD', screen: '14" FHD', os: 'Windows 11 Pro', battery_health: '85%' }, warranty_months: 3 }],
    [4, 'Apple', 'MacBook Air M1', 'A2337', '8GB / 256GB', 'Space Grey', 185000, 209000, 199000, 1, 0, { condition: 'new', serial_prefix: 'FVFM1', specs: { processor: 'Apple M1', ram: '8GB', storage: '256GB SSD', screen: '13.3" Retina', os: 'macOS' }, warranty_months: 12 }],
    [4, 'ASUS', 'VivoBook 15', 'X1504ZA', 'i3-1215U / 8GB / 512GB', 'Quiet Blue', 118000, 132000, 125000, 1, 0, { condition: 'new', serial_prefix: 'ASX1504', specs: { processor: 'Intel Core i3-1215U', generation: '12th Gen', ram: '8GB DDR4', storage: '512GB NVMe SSD', screen: '15.6" FHD', os: 'Windows 11 Home' }, warranty_months: 12 }],
    [5, 'Dell', 'OptiPlex 3090 SFF', 'OptiPlex 3090', 'i5-10500 / 8GB / 256GB', 'Black', 68000, 79000, 74000, 1, 0, { condition: 'refurbished', serial_prefix: 'DLOP3090', specs: { processor: 'Intel Core i5-10500', generation: '10th Gen', ram: '8GB DDR4', storage: '256GB SSD', os: 'Windows 10 Pro' }, warranty_months: 3 }],
    // mobile spare parts (33-36)
    [11, 'Generic', 'iPhone 13 Screen Assembly', 'IP13-OLED', 'OLED', 'Black', 18000, 24500, 21000, 2, 0, { warranty_months: 1 }],
    [11, 'Samsung', 'Galaxy A55 Battery', 'EB-BA556', '5000mAh', '-', 2800, 4500, 3600, 3, 0, { warranty_months: 3 }],
    [11, 'Generic', 'Charging Port Flex (Type-C)', 'CP-FLEX', 'Universal', '-', 350, 900, 600, 10, 0, {}],
    [11, 'Generic', 'iPhone 13 Back Glass', 'IP13-BG', 'OEM', 'Midnight', 2200, 4000, 3200, 2, 0, {}],
    // laptop spare parts (37-40)
    [12, 'Dell', 'Latitude 5420 Battery', 'MHR4G', '63Wh', '-', 6500, 9800, 8200, 2, 0, { warranty_months: 6 }],
    [12, 'HP', 'EliteBook 840 G8 Keyboard', 'M36312-001', 'US Backlit', 'Black', 4200, 7000, 5800, 1, 0, { warranty_months: 3 }],
    [12, 'Generic', '65W USB-C Laptop Charger', 'LC-65C', '65W PD', 'Black', 2800, 4500, 3700, 5, 0, { warranty_months: 6 }],
    [12, 'Generic', '15.6" FHD Laptop Screen', 'NV156FHM', '30-pin IPS', '-', 9500, 14500, 12000, 1, 0, { warranty_months: 3 }],
    // components (41-42)
    [13, 'Kingston', 'NV2 512GB NVMe SSD', 'SNV2S/500G', '512GB', '-', 7200, 9500, 8300, 3, 0, { warranty_months: 36 }],
    [13, 'Kingston', '8GB DDR4 3200 SODIMM', 'KVR32S22S8/8', '8GB', '-', 4300, 5800, 5000, 3, 0, { warranty_months: 36 }],
    // repair services (43-51) — non-stock labor items; device_type groups them on the storefront price list
    [14, 'Generic', 'Screen Replacement Labor (Mobile)', 'SVC-SCR-M', 'Labor', '-', 0, 1500, 1500, 0, 0, { unit: 'job', device_type: 'mobile' }],
    [14, 'Generic', 'Battery Replacement Labor', 'SVC-BAT', 'Labor', '-', 0, 800, 800, 0, 0, { unit: 'job', device_type: 'mobile' }],
    [14, 'Generic', 'Charging Port Repair Labor', 'SVC-CP', 'Labor', '-', 0, 1200, 1200, 0, 0, { unit: 'job', device_type: 'mobile' }],
    [14, 'Generic', 'Software Flash / OS Installation', 'SVC-SW', 'Labor', '-', 0, 1500, 1500, 0, 0, { unit: 'job', device_type: 'mobile' }],
    [14, 'Generic', 'Laptop Service & Thermal Paste', 'SVC-LSVC', 'Labor', '-', 0, 2500, 2500, 0, 0, { unit: 'job', device_type: 'laptop' }],
    [14, 'Generic', 'Laptop Screen Replacement Labor', 'SVC-SCR-L', 'Labor', '-', 0, 2000, 2000, 0, 0, { unit: 'job', device_type: 'laptop' }],
    [14, 'Generic', 'Motherboard Repair (Chip-level)', 'SVC-MB', 'Labor', '-', 0, 5000, 5000, 0, 0, { unit: 'job', device_type: 'laptop' }],
    [14, 'Generic', 'Diagnostic Fee', 'SVC-DIAG', 'Labor', '-', 0, 500, 500, 0, 0, { unit: 'job' }],
    [14, 'Generic', 'Data Recovery', 'SVC-DATA', 'Labor', '-', 0, 4000, 4000, 0, 0, { unit: 'job' }],
  ];
  const products = productDefs.map((d, i) => {
    const id = i + 1;
    const cat = categories.find((c) => c.id === d[0]);
    const extra = d[11] || {};
    const skuBase = (d[1].slice(0, 3) + '-' + d[2].replace(/[^A-Za-z0-9]/g, '').slice(0, 8)).toUpperCase();
    const isService = cat.product_type === 'service';
    return {
      id, category_id: d[0], brand_id: brandId(d[1]), name: d[2], model: d[3], variant: d[4], color: d[5] === '-' ? '' : d[5],
      sku: `${skuBase}-${pad(id, 3)}`, barcode: isService ? null : ean13(`880${pad(100000 + id * 7919, 9)}`),
      product_type: cat.product_type, device_type: extra.device_type || cat.device_type,
      is_serialized: cat.is_serialized, serial_type: cat.serial_type, is_imei_tracked: cat.is_serialized,
      is_stock_tracked: isService ? 0 : 1, unit: extra.unit || 'pcs',
      condition: extra.condition || 'new', specs: extra.specs || {}, warranty_months: extra.warranty_months || 0,
      // PTA (Pakistan) registration applies to phones, tablets and SIM watches; used / imported stock can be non-PTA
      pta_status: ['mobile', 'tablet', 'smartwatch'].includes(extra.device_type || cat.device_type) ? (extra.pta_status || (extra.condition === 'used' ? 'non_pta' : 'approved')) : 'not_applicable',
      cost_price: d[6], retail_price: d[7], wholesale_price: d[8], min_sale_price: isService ? d[7] : round2(d[6] * 1.03),
      tax_rate: d[10], min_stock: d[9], max_stock: d[9] ? d[9] * 4 : 0, reorder_qty: d[9] ? d[9] * 2 : 0,
      supplier_id: (function () { // default supplier by brand/category so purchase-create and supplier pages have real data
        const b = d[1], c = d[0];
        if (b === 'Apple') return 1;
        if (b === 'Samsung') return 2;
        if (b === 'Xiaomi' || b === 'Realme') return 4;
        if (['Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'Kingston'].includes(b) || c === 12 || c === 13) return 5;
        if (c === 14) return null; // services have no supplier
        return 3;
      })(), tags: [], description: '', image: null, is_active: 1, created_at: at(between(60, 300)),
      serial_prefix: extra.serial_prefix || null,
    };
  });

  // ---------------------------------------------------- demo product media
  // The prototype ships no photo files, so a few products get generated SVG "studio shots"
  // (front / back / box) and one YouTube link. Replace them by uploading real photos in
  // Products → edit → Photos & video; everything downstream already reads product.media.
  const svgShot = (label, hue, glyph) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 30% 97%)"/><stop offset="1" stop-color="hsl(${hue + 24} 24% 88%)"/></linearGradient>
<radialGradient id="s" cx="50%" cy="86%" r="34%"><stop offset="0" stop-color="rgba(15,23,42,.18)"/><stop offset="1" stop-color="rgba(15,23,42,0)"/></radialGradient></defs>
<rect width="800" height="800" fill="url(#g)"/><ellipse cx="400" cy="672" rx="190" ry="26" fill="url(#s)"/>
<g transform="translate(400 380)" fill="none" stroke="hsl(${hue} 22% 42%)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
<text x="400" y="742" text-anchor="middle" font-family="Inter,Segoe UI,sans-serif" font-size="30" font-weight="700" fill="hsl(${hue} 18% 46%)">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\n\s*/g, ' '));
  };
  const GLYPH = {
    front: '<rect x="-96" y="-168" width="192" height="336" rx="26"/><line x1="-30" y1="-140" x2="30" y2="-140"/><rect x="-58" y="132" width="116" height="4" rx="2"/>',
    back: '<rect x="-96" y="-168" width="192" height="336" rx="26"/><circle cx="-38" cy="-104" r="26"/><circle cx="26" cy="-104" r="26"/><circle cx="-38" cy="-40" r="26"/>',
    box: '<path d="M-128-70 0-140 128-70 0 0Z"/><path d="M-128-70V86L0 156V0Z"/><path d="M128-70V86L0 156"/>',
    laptop: '<rect x="-150" y="-120" width="300" height="196" rx="14"/><path d="M-196 104h392l-28-28h-336Z"/>',
  };
  const demoMedia = (productId, hue, kind) => {
    const g = kind === 'laptop' ? [GLYPH.laptop, GLYPH.box] : [GLYPH.front, GLYPH.back, GLYPH.box];
    const names = kind === 'laptop' ? ['Front view', 'In the box'] : ['Front view', 'Back view', 'In the box'];
    return g.map((glyph, i) => ({
      id: i + 1, type: 'image', url: svgShot(names[i], hue + i * 10, glyph),
      name: names[i], alt: names[i], is_primary: i === 0 ? 1 : 0, sort_order: i + 1,
    }));
  };

  // ------------------------------------------------------------- suppliers
  const suppliers = [
    { id: 1, name: 'Apple Authorized Distributor (Mercantile)', contact_person: 'Kamran Sheikh', phone: '021-35633100', email: 'orders@mercantile.pk', address: 'Shahrah-e-Faisal, Karachi', tax_id: 'NTN 0712345-6', balance: 0, notes: '', is_active: 1, created_at: at(380) },
    { id: 2, name: 'Samsung Pakistan (Lucky Core)', contact_person: 'Faisal Qureshi', phone: '021-32345678', email: 'sales@luckycore.pk', address: 'Port Qasim, Karachi', tax_id: 'NTN 0812345-6', balance: 0, notes: '', is_active: 1, created_at: at(370) },
    { id: 3, name: 'Hall Road Wholesale Traders', contact_person: 'Naveed Anjum', phone: '0321-4567890', email: 'hallroad.traders@gmail.com', address: 'Hall Road, Lahore', tax_id: 'NTN 0912345-6', balance: 0, notes: 'Accessories, spare parts & Chinese brands', is_active: 1, created_at: at(360) },
    { id: 4, name: 'Xiaomi Official (Airlink)', contact_person: 'Sara Khan', phone: '042-35761234', email: 'b2b@airlink.pk', address: 'Lahore', tax_id: 'NTN 1012345-6', balance: 0, notes: '', is_active: 1, created_at: at(350) },
    { id: 5, name: 'Hafeez Centre Laptop Importers', contact_person: 'Rizwan Malik', phone: '0333-4455667', email: 'rizwan@hclaptops.pk', address: 'Hafeez Centre, Gulberg, Lahore', tax_id: 'NTN 1112345-6', balance: 0, notes: 'Refurbished laptops, parts & components', is_active: 1, created_at: at(200) },
  ];

  // attach the generated gallery to a handful of hero products (id → hue, kind)
  [[1, 210, 'phone'], [4, 150, 'phone'], [7, 280, 'phone'], [9, 330, 'phone'], [27, 200, 'laptop'], [30, 20, 'laptop']].forEach(([pid, hue, kind]) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    p.media = demoMedia(pid, hue, kind);
    p.image = p.media[0].url;
  });
  // one product also shows a video, to demonstrate mixed media on the storefront
  const withVideo = products.find((p) => p.id === 1);
  if (withVideo) {
    withVideo.media.push({ id: 4, type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', name: 'Hands-on video', alt: '', is_primary: 0, sort_order: 4 });
  }

  // ------------------------------------------------------------- customers
  const customerNames = ['Muhammad Ali', 'Fatima Noor', 'Zeeshan Ahmed', 'Ayesha Siddiqui', 'Hassan Mehmood', 'Maryam Khan', 'Imran Baig', 'Sadia Butt', 'Tariq Javed', 'Hina Aslam', 'Waqas Chaudhry', 'Rabia Iqbal', 'Kashif Rana', 'Nadia Farooq', 'Shahid Afridi Traders', 'Techno Mobile Zone (Wholesale)', 'Bilal Computers (Wholesale)', 'Adeel Shafiq'];
  // Website accounts: the digest must match SHOP.auth's pwDigest() — every demo account's password is "demo1234".
  const DEMO_PW = (function () {
    var s = 'abm:demo1234', h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = (h1 * 0x01000193) >>> 0; h2 = (h2 + s.charCodeAt(i) * (i + 7)) >>> 0; }
    return 'p1$' + h1.toString(36) + h2.toString(36);
  })();
  const customers = [{ id: 1, name: 'Walk-in Customer', phone: '', email: '', address: '', cnic: '', credit_limit: 0, balance: 0, is_walkin: 1, notes: '', is_active: 1, created_at: at(400) }];
  customerNames.forEach((name, i) => customers.push({
    id: i + 2, name, phone: `03${between(0, 4)}${between(0, 9)}-${pad(between(1000000, 9999999), 7)}`, email: chance(0.5) ? name.toLowerCase().replace(/[^a-z]+/g, '.') + '@gmail.com' : '',
    address: pick(['Model Town, Lahore', 'DHA Phase 5, Lahore', 'Gulberg, Lahore', 'Johar Town, Lahore', 'Bahria Town, Lahore', 'Wapda Town, Lahore']),
    cnic: chance(0.7) ? `35202-${pad(between(1000000, 9999999), 7)}-${between(1, 9)}` : '', credit_limit: name.includes('Wholesale') || name.includes('Traders') ? 500000 : (chance(0.4) ? 100000 : 0),
    balance: 0, is_walkin: 0, notes: '', is_active: 1, created_at: at(between(20, 300)),
  }));
  // a few customers have a website login (password: demo1234) so the storefront account area has real history
  [
    { name: 'Hassan Mehmood', email: 'hassan@example.com', city: 'Lahore' },
    { name: 'Maryam Khan', email: 'maryam@example.com', city: 'Lahore' },
    { name: 'Zeeshan Ahmed', email: 'zeeshan@example.com', city: 'Islamabad' },
  ].forEach((d) => {
    const c = customers.find((x) => x.name === d.name);
    if (!c) return;
    c.email = d.email; c.city = d.city; c.has_account = 1; c.password = DEMO_PW;
    c.account_created_at = at(between(30, 120)); c.notes = 'Website account';
  });

  // ---------------------------------------------------------------- stock
  const branch_stock = [];
  const product_imeis = [];
  const stock_movements = [];
  const purchases = [];
  const purchase_items = [];
  const supplier_transactions = [];
  let imeiId = 1, movementId = 1, purchaseItemId = 1, stxId = 1;

  const stockRow = (branchId, productId) => {
    let row = branch_stock.find((s) => s.branch_id === branchId && s.product_id === productId);
    if (!row) { row = { id: branch_stock.length + 1, branch_id: branchId, product_id: productId, quantity: 0, avg_cost: 0, updated_at: at(0) }; branch_stock.push(row); }
    return row;
  };
  const move = (branchId, productId, type, qty, cost, refType, refId, imei, when, userId) => {
    const row = stockRow(branchId, productId);
    stock_movements.push({ id: movementId++, branch_id: branchId, product_id: productId, imei_id: imei ? imei.id : null, movement_type: type, quantity: qty, unit_cost: cost, balance_after: row.quantity, reference_type: refType, reference_id: refId, notes: '', user_id: userId, created_at: when });
  };
  const newUnit = (product, branchId, unitCost, purchaseItemId, when) => {
    const serial = product.serial_type === 'imei' ? genImei() : genSerial(product.serial_prefix || product.sku.slice(0, 4));
    return { id: imeiId++, product_id: product.id, branch_id: branchId, imei: serial, imei2: product.serial_type === 'imei' && chance(0.5) ? genImei() : null, serial_type: product.serial_type, status: 'available', cost_price: unitCost, purchase_item_id: purchaseItemId, sale_item_id: null, notes: '', created_at: when, updated_at: when };
  };

  // Purchases: stock inward with IMEIs / serials (the source of all opening stock)
  const purchaseDefs = [
    { supplier: 1, branch: 1, days: 44, items: [[1, 10], [2, 5], [3, 8], [15, 4], [16, 4], [30, 2]] },
    { supplier: 2, branch: 1, days: 42, items: [[4, 8], [5, 10], [6, 12], [14, 5], [17, 4], [20, 40], [34, 6]] },
    { supplier: 3, branch: 1, days: 41, items: [[11, 12], [12, 12], [13, 10], [18, 50], [19, 60], [21, 12], [22, 20], [23, 80], [24, 60], [25, 120], [33, 4], [35, 20], [36, 4]] },
    { supplier: 4, branch: 1, days: 40, items: [[7, 12], [8, 4], [26, 24]] },
    { supplier: 5, branch: 1, days: 39, items: [[27, 4], [28, 3], [29, 3], [31, 3], [32, 2], [37, 4], [38, 2], [39, 10], [40, 3], [41, 8], [42, 8]] },
    { supplier: 2, branch: 2, days: 43, items: [[4, 5], [5, 8], [6, 10], [20, 25], [34, 4]] },
    { supplier: 3, branch: 2, days: 42, items: [[9, 8], [10, 8], [11, 10], [12, 10], [13, 8], [18, 30], [19, 40], [23, 50], [24, 40], [25, 80], [22, 12], [21, 6], [26, 12], [33, 2], [35, 12]] },
    { supplier: 1, branch: 2, days: 40, items: [[1, 6], [2, 3], [3, 5], [15, 2], [16, 2]] },
    { supplier: 5, branch: 2, days: 38, items: [[27, 2], [28, 2], [30, 1], [31, 2], [39, 6], [41, 4], [42, 4], [37, 2]] },
    { supplier: 4, branch: 2, days: 38, items: [[7, 8], [8, 2]] },
    { supplier: 2, branch: 1, days: 20, items: [[4, 4], [5, 6], [6, 6], [14, 3]] },
    { supplier: 3, branch: 1, days: 14, items: [[11, 8], [12, 8], [18, 30], [19, 40], [23, 50], [25, 80], [35, 20]] },
    { supplier: 1, branch: 2, days: 12, items: [[1, 4], [3, 3]] },
    { supplier: 5, branch: 1, days: 9, items: [[27, 3], [29, 2], [31, 2], [40, 2], [41, 6]] },
    { supplier: 4, branch: 1, days: 6, items: [[7, 8], [26, 12]] },
    { supplier: 3, branch: 2, days: 3, items: [[13, 6], [24, 30], [22, 10], [33, 2]] },
  ];
  purchaseDefs.forEach((p, idx) => {
    const id = idx + 1;
    const branch = branches.find((b) => b.id === p.branch);
    const when = at(p.days, 11, 30);
    let subtotal = 0;
    const purchase = { id, purchase_no: `PUR-${branch.code}-${pad(id)}`, branch_id: p.branch, supplier_id: p.supplier, supplier_invoice_no: `SI-${between(10000, 99999)}`, purchase_date: dateOnly(p.days), subtotal: 0, discount_amount: 0, tax_amount: 0, total: 0, paid_amount: 0, status: 'received', purchase_order_id: null, notes: '', created_by: p.branch === 1 ? 2 : 4, created_at: when };
    p.items.forEach(([productId, qty]) => {
      const product = products.find((x) => x.id === productId);
      const unitCost = product.cost_price;
      const item = { id: purchaseItemId++, purchase_id: id, product_id: productId, quantity: qty, unit_cost: unitCost, total: round2(qty * unitCost), imeis: [] };
      subtotal += item.total;
      const row = stockRow(p.branch, productId);
      row.avg_cost = row.quantity + qty > 0 ? round2((row.avg_cost * row.quantity + unitCost * qty) / (row.quantity + qty)) : unitCost;
      row.quantity += qty;
      if (product.is_serialized) {
        for (let i = 0; i < qty; i++) {
          const unit = newUnit(product, p.branch, unitCost, item.id, when);
          product_imeis.push(unit);
          item.imeis.push(unit.imei);
          move(p.branch, productId, 'purchase', 1, unitCost, 'purchase', id, unit, when, purchase.created_by);
        }
      } else {
        move(p.branch, productId, 'purchase', qty, unitCost, 'purchase', id, null, when, purchase.created_by);
      }
      purchase_items.push(item);
    });
    purchase.subtotal = round2(subtotal);
    purchase.total = round2(subtotal);
    purchase.paid_amount = idx % 3 === 2 ? round2(purchase.total * 0.6) : purchase.total;
    purchases.push(purchase);
    const supplier = suppliers.find((s) => s.id === p.supplier);
    supplier.balance = round2(supplier.balance + purchase.total);
    supplier_transactions.push({ id: stxId++, supplier_id: p.supplier, branch_id: p.branch, type: 'purchase', reference_type: 'purchase', reference_id: id, debit: 0, credit: purchase.total, balance_after: supplier.balance, payment_method: null, payment_reference: null, notes: `Purchase ${purchase.purchase_no}`, created_by: purchase.created_by, created_at: when });
    if (purchase.paid_amount > 0) {
      supplier.balance = round2(supplier.balance - purchase.paid_amount);
      supplier_transactions.push({ id: stxId++, supplier_id: p.supplier, branch_id: p.branch, type: 'payment', reference_type: 'purchase', reference_id: id, debit: purchase.paid_amount, credit: 0, balance_after: supplier.balance, payment_method: pick(['bank_transfer', 'cash', 'bank_transfer']), payment_reference: `TRX-${between(100000, 999999)}`, notes: `Payment against ${purchase.purchase_no}`, created_by: purchase.created_by, created_at: at(p.days - 1, 15, 0) });
    }
  });

  // ------------------------------------------------------- purchase orders
  // What we asked the supplier for, before anything arrives. Receiving a PO creates the purchase
  // (goods received note) above and fills `received_quantity` line by line until the order closes.
  const purchase_orders = [];
  const purchase_order_items = [];
  {
    let poId = 1, poItemId = 1;
    const mkPo = (def) => {
      const branch = branches.find((b) => b.id === def.branch);
      const id = poId++;
      const when = at(def.ordered, 10, 30);
      const po = {
        id, po_no: `PO-${branch.code}-${pad(id)}`, branch_id: def.branch, supplier_id: def.supplier,
        order_date: dateOnly(def.ordered), expected_date: dateOnly(def.expected), status: def.status,
        subtotal: 0, discount_amount: 0, tax_amount: 0, total: 0,
        terms: def.terms || '', notes: def.notes || '', created_by: def.branch === 1 ? 2 : 4,
        created_at: when,
        ordered_at: def.status === 'draft' ? null : at(def.ordered, 11, 0),
        closed_at: def.status === 'completed' ? at(def.closed, 16, 0) : null,
        cancelled_at: def.status === 'cancelled' ? at(Math.max(0, def.ordered - 3), 9, 30) : null,
      };
      let subtotal = 0;
      def.items.forEach(([productId, qty, received]) => {
        const product = products.find((x) => x.id === productId);
        if (!product) return;
        const cost = product.cost_price;
        purchase_order_items.push({
          id: poItemId++, po_id: id, product_id: productId, quantity: qty,
          received_quantity: received || 0, unit_cost: cost, total: round2(cost * qty), notes: '',
        });
        subtotal += cost * qty;
      });
      po.subtotal = round2(subtotal);
      po.total = round2(subtotal);
      purchase_orders.push(po);
      return po;
    };
    const linkReceipt = (purchaseId, poId2) => { const pu = purchases.find((x) => x.id === purchaseId); if (pu) pu.purchase_order_id = poId2; };

    // closed: everything ordered arrived in one delivery (purchase #15)
    linkReceipt(15, mkPo({
      supplier: 4, branch: 1, ordered: 12, expected: 7, closed: 6, status: 'completed',
      terms: '30 days credit', notes: 'Eid stock top-up.', items: [[7, 8, 8], [26, 12, 12]],
    }).id);
    // partially delivered: the rest is still outstanding and already past the promised date (purchase #16)
    linkReceipt(16, mkPo({
      supplier: 3, branch: 2, ordered: 10, expected: 4, status: 'partial',
      terms: '15 days credit', notes: 'Balance promised next week.',
      items: [[13, 10, 6], [24, 40, 30], [22, 10, 10], [33, 4, 2]],
    }).id);
    // placed, delivery still to come
    mkPo({ supplier: 1, branch: 1, ordered: 3, expected: -5, status: 'ordered', terms: '50% advance', notes: '', items: [[1, 6, 0], [2, 4, 0], [15, 3, 0], [23, 20, 0]] });
    // placed and overdue — nothing received, promised date has passed
    mkPo({ supplier: 5, branch: 1, ordered: 14, expected: 2, status: 'ordered', terms: 'Cash on delivery', notes: 'Followed up twice on WhatsApp.', items: [[27, 3, 0], [31, 2, 0], [41, 6, 0]] });
    // draft: being prepared, not sent to the supplier yet
    mkPo({ supplier: 2, branch: 1, ordered: 0, expected: -7, status: 'draft', terms: '', notes: 'Waiting for the manager to confirm quantities.', items: [[4, 5, 0], [5, 6, 0], [20, 20, 0]] });
    // cancelled before delivery
    mkPo({ supplier: 3, branch: 1, ordered: 20, expected: 13, status: 'cancelled', terms: '', notes: 'Supplier could not confirm stock, ordered elsewhere.', items: [[18, 50, 0], [19, 60, 0]] });
  }

  // ---------------------------------------------------------------- sales
  const sales = [];
  const sale_items = [];
  const sale_payments = [];
  const customer_transactions = [];
  let saleId = 1, saleItemId = 1, paymentId = 1, ctxId = 1;
  const invoiceCounters = { 1: 0, 2: 0 };
  const accessoryIds = products.filter((p) => !p.is_serialized && p.is_stock_tracked && p.product_type !== 'part').map((p) => p.id);
  const cashierFor = { 1: [2, 3], 2: [4, 5] };
  const custEntry = (customerId, branchId, type, debit, credit, refType, refId, method, notes, userId, when) => {
    const c = customers.find((x) => x.id === customerId);
    c.balance = round2(c.balance + debit - credit);
    customer_transactions.push({ id: ctxId++, customer_id: customerId, branch_id: branchId, type, reference_type: refType, reference_id: refId, debit, credit, balance_after: c.balance, payment_method: method, payment_reference: method && method !== 'cash' ? `TRX-${between(100000, 999999)}` : null, notes, created_by: userId, created_at: when });
  };

  for (let day = 44; day >= 0; day--) {
    for (const branchId of [1, 2]) {
      const branch = branches.find((b) => b.id === branchId);
      const perDay = day === 0 ? between(2, 4) : between(0, 4);
      for (let n = 0; n < perDay; n++) {
        const when = day === 0 ? at(0, between(9, Math.max(9, nowHour)), between(0, nowHour <= 9 ? 5 : 59)) : at(day, between(10, 20), between(0, 59));
        const userId = pick(cashierFor[branchId]);
        const id = saleId++;
        invoiceCounters[branchId]++;
        const isCredit = chance(0.12);
        const customerId = isCredit ? pick(customers.filter((c) => !c.is_walkin && c.credit_limit > 0)).id : (chance(0.65) ? 1 : pick(customers.filter((c) => !c.is_walkin)).id);
        const sale = { id, invoice_no: `INV-${branch.code}-${pad(invoiceCounters[branchId])}`, branch_id: branchId, customer_id: customerId, user_id: userId, sale_date: when, subtotal: 0, discount_type: null, discount_value: 0, discount_amount: 0, tax_rate: 0, tax_amount: 0, total: 0, paid_amount: 0, due_amount: 0, status: 'completed', notes: '', repair_job_id: null, created_at: when, updated_at: when };
        const lines = [];
        if (chance(0.6)) { // device line - consume an available serialized unit at this branch
          const avail = product_imeis.filter((i) => i.branch_id === branchId && i.status === 'available');
          if (avail.length) {
            const unit = pick(avail);
            const product = products.find((p) => p.id === unit.product_id);
            const price = chance(0.15) ? product.wholesale_price : product.retail_price;
            const disc = chance(0.3) ? pick([500, 1000, 2000]) : 0;
            const item = { id: saleItemId++, sale_id: id, product_id: product.id, imei_id: unit.id, imei: unit.imei, quantity: 1, unit_price: price, unit_cost: unit.cost_price, discount_amount: disc, tax_amount: 0, total: round2(price - disc), returned_quantity: 0, warranty_months: product.warranty_months };
            unit.status = 'sold'; unit.sale_item_id = item.id; unit.updated_at = when;
            const row = stockRow(branchId, product.id); row.quantity -= 1;
            move(branchId, product.id, 'sale', -1, unit.cost_price, 'sale', id, unit, when, userId);
            lines.push(item);
          }
        }
        const accCount = lines.length ? between(0, 2) : between(1, 3);
        for (let a = 0; a < accCount; a++) {
          const productId = pick(accessoryIds);
          const row = stockRow(branchId, productId);
          if (row.quantity <= 0) continue;
          const product = products.find((p) => p.id === productId);
          const qty = Math.min(row.quantity, between(1, 3));
          const item = { id: saleItemId++, sale_id: id, product_id: productId, imei_id: null, imei: null, quantity: qty, unit_price: product.retail_price, unit_cost: row.avg_cost, discount_amount: 0, tax_amount: 0, total: round2(qty * product.retail_price), returned_quantity: 0, warranty_months: product.warranty_months };
          row.quantity -= qty;
          move(branchId, productId, 'sale', -qty, row.avg_cost, 'sale', id, null, when, userId);
          lines.push(item);
        }
        if (!lines.length) { saleId--; invoiceCounters[branchId]--; continue; }
        lines.forEach((l) => sale_items.push(l));
        sale.subtotal = round2(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0));
        const lineDisc = lines.reduce((s, l) => s + l.discount_amount, 0);
        if (chance(0.15)) { sale.discount_type = 'percent'; sale.discount_value = pick([2, 5]); }
        const invoiceDisc = sale.discount_type === 'percent' ? round2((sale.subtotal - lineDisc) * sale.discount_value / 100) : 0;
        sale.discount_amount = round2(lineDisc + invoiceDisc);
        sale.total = round2(sale.subtotal - sale.discount_amount + sale.tax_amount);
        if (isCredit) {
          const partial = chance(0.5) ? round2(Math.floor(sale.total * pick([0.3, 0.5]) / 500) * 500) : 0;
          sale.paid_amount = partial; sale.due_amount = round2(sale.total - partial);
          if (partial > 0) sale_payments.push({ id: paymentId++, sale_id: id, method: 'cash', amount: partial, reference: null, created_at: when });
          custEntry(customerId, branchId, 'sale', sale.due_amount, 0, 'sale', id, null, `Credit sale ${sale.invoice_no}`, userId, when);
        } else {
          sale.paid_amount = sale.total; sale.due_amount = 0;
          const r = rnd();
          if (r < 0.62) sale_payments.push({ id: paymentId++, sale_id: id, method: 'cash', amount: sale.total, reference: null, created_at: when });
          else if (r < 0.78) sale_payments.push({ id: paymentId++, sale_id: id, method: 'card', amount: sale.total, reference: `AUTH-${between(100000, 999999)}`, created_at: when });
          else if (r < 0.88) sale_payments.push({ id: paymentId++, sale_id: id, method: pick(['jazzcash', 'easypaisa']), amount: sale.total, reference: `TID-${between(10000000, 99999999)}`, created_at: when });
          else if (r < 0.94) sale_payments.push({ id: paymentId++, sale_id: id, method: 'bank_transfer', amount: sale.total, reference: `BT-${between(100000, 999999)}`, created_at: when });
          else { const cashPart = round2(Math.floor(sale.total * 0.4 / 500) * 500); sale_payments.push({ id: paymentId++, sale_id: id, method: 'cash', amount: cashPart, reference: null, created_at: when }); sale_payments.push({ id: paymentId++, sale_id: id, method: 'card', amount: round2(sale.total - cashPart), reference: `AUTH-${between(100000, 999999)}`, created_at: when }); }
        }
        sales.push(sale);
      }
    }
  }

  customers.filter((c) => c.balance > 0).forEach((c, i) => {
    if (i % 2 === 0) { const amt = round2(Math.min(c.balance, Math.floor(c.balance * 0.5 / 1000) * 1000)); if (amt > 0) custEntry(c.id, 1, 'payment', 0, amt, null, null, pick(['cash', 'bank_transfer', 'jazzcash']), 'Payment received against ledger', 2, at(between(1, 8), 16, 0)); }
  });
  custEntry(5, 1, 'opening_balance', 15000, 0, null, null, null, 'Opening balance (previous system)', 1, at(60, 9, 0));
  custEntry(7, 1, 'store_credit', 0, 4500, null, null, null, 'Store credit issued for returned accessory', 2, at(12, 13, 0));

  // ------------------------------------------------------------- returns
  const sale_returns = [];
  const sale_return_items = [];
  {
    const accSale = sales.find((s) => s.branch_id === 1 && sale_items.some((i) => i.sale_id === s.id && !i.imei_id));
    if (accSale) {
      const item = sale_items.find((i) => i.sale_id === accSale.id && !i.imei_id);
      const when = at(9, 12, 0);
      sale_returns.push({ id: 1, return_no: 'RET-MB-000001', sale_id: accSale.id, branch_id: 1, customer_id: accSale.customer_id, user_id: 2, return_date: when, subtotal: item.unit_price, refund_amount: item.unit_price, refund_method: 'cash', reason: 'Customer changed mind', notes: '', created_at: when });
      sale_return_items.push({ id: 1, return_id: 1, sale_item_id: item.id, product_id: item.product_id, imei_id: null, quantity: 1, unit_price: item.unit_price, total: item.unit_price, condition: 'good' });
      item.returned_quantity = 1;
      accSale.status = item.quantity > 1 ? 'partially_returned' : (sale_items.filter((i) => i.sale_id === accSale.id).length > 1 ? 'partially_returned' : 'returned');
      const row = stockRow(1, item.product_id); row.quantity += 1;
      move(1, item.product_id, 'sale_return', 1, item.unit_cost, 'sale_return', 1, null, when, 2);
    }
    const phoneSale = sales.find((s) => s.branch_id === 2 && sale_items.some((i) => i.sale_id === s.id && i.imei_id));
    if (phoneSale) {
      const item = sale_items.find((i) => i.sale_id === phoneSale.id && i.imei_id);
      const unit = product_imeis.find((i) => i.id === item.imei_id);
      const when = at(5, 17, 30);
      sale_returns.push({ id: 2, return_no: 'RET-B2-000001', sale_id: phoneSale.id, branch_id: 2, customer_id: phoneSale.customer_id, user_id: 4, return_date: when, subtotal: item.total, refund_amount: item.total, refund_method: 'store_credit', reason: 'Dead pixel on display - defective unit', notes: 'Sent to brand service centre', created_at: when });
      sale_return_items.push({ id: 2, return_id: 2, sale_item_id: item.id, product_id: item.product_id, imei_id: unit.id, quantity: 1, unit_price: item.unit_price, total: item.total, condition: 'defective' });
      item.returned_quantity = 1;
      phoneSale.status = sale_items.filter((i) => i.sale_id === phoneSale.id).length > 1 ? 'partially_returned' : 'returned';
      unit.status = 'defective'; unit.notes = 'Returned - dead pixel'; unit.updated_at = when;
      move(2, item.product_id, 'sale_return', 0, item.unit_cost, 'sale_return', 2, unit, when, 4);
      if (phoneSale.customer_id !== 1) custEntry(phoneSale.customer_id, 2, 'refund', 0, item.total, 'sale_return', 2, null, `Refund as store credit for ${phoneSale.invoice_no}`, 4, when);
    }
    const openBox = product_imeis.find((i) => i.branch_id === 1 && i.status === 'sold');
    if (openBox) { openBox.status = 'returned'; openBox.notes = 'Open box - returned within 3 days, resellable'; openBox.updated_at = at(3, 14, 0); const row = stockRow(1, openBox.product_id); row.quantity += 1; }
  }

  // ----------------------------------------------------------- transfers
  const stock_transfers = [];
  const transfer_items = [];
  let tItemId = 1;
  const mkTransfer = (id, from, to, status, days, items, extra = {}) => {
    const fromB = branches.find((b) => b.id === from);
    const t = { id, transfer_no: `TRF-${fromB.code}-${pad(id)}`, from_branch_id: from, to_branch_id: to, status, requested_by: to === 1 ? 2 : 4, approved_by: null, shipped_by: null, received_by: null, notes: extra.notes || '', rejection_reason: extra.rejection_reason || null, requested_at: at(days, 10, 0), approved_at: null, shipped_at: null, received_at: null, created_at: at(days, 10, 0), updated_at: at(days, 10, 0) };
    if (['approved', 'shipped', 'received'].includes(status)) { t.approved_by = 1; t.approved_at = at(days - 1, 11, 0); }
    if (['shipped', 'received'].includes(status)) { t.shipped_by = from === 1 ? 2 : 4; t.shipped_at = at(days - 1, 15, 0); }
    if (status === 'received') { t.received_by = to === 1 ? 2 : 4; t.received_at = at(days - 2, 12, 0); }
    if (status === 'rejected') { t.approved_by = 1; t.approved_at = at(days - 1, 11, 0); }
    items.forEach(([productId, qty]) => {
      const product = products.find((p) => p.id === productId);
      const item = { id: tItemId++, transfer_id: id, product_id: productId, quantity: qty, received_quantity: status === 'received' ? qty : 0, unit_cost: product.cost_price, imei_ids: [] };
      if (product.is_serialized && ['shipped', 'received'].includes(status)) {
        const avail = product_imeis.filter((i) => i.branch_id === from && i.status === 'available' && i.product_id === productId).slice(0, qty);
        avail.forEach((unit) => {
          item.imei_ids.push(unit.id);
          const fromRow = stockRow(from, productId); fromRow.quantity -= 1;
          move(from, productId, 'transfer_out', -1, unit.cost_price, 'transfer', id, unit, t.shipped_at, t.shipped_by);
          if (status === 'received') { unit.branch_id = to; unit.status = 'available'; unit.updated_at = t.received_at; const toRow = stockRow(to, productId); toRow.avg_cost = toRow.quantity + 1 > 0 ? round2((toRow.avg_cost * toRow.quantity + unit.cost_price) / (toRow.quantity + 1)) : unit.cost_price; toRow.quantity += 1; move(to, productId, 'transfer_in', 1, unit.cost_price, 'transfer', id, unit, t.received_at, t.received_by); }
          else { unit.status = 'in_transit'; unit.updated_at = t.shipped_at; }
        });
        item.quantity = avail.length; if (status === 'received') item.received_quantity = avail.length;
      } else if (!product.is_serialized && ['shipped', 'received'].includes(status)) {
        const fromRow = stockRow(from, productId); const q = Math.min(qty, fromRow.quantity); item.quantity = q; fromRow.quantity -= q;
        move(from, productId, 'transfer_out', -q, fromRow.avg_cost, 'transfer', id, null, t.shipped_at, t.shipped_by);
        if (status === 'received') { item.received_quantity = q; const toRow = stockRow(to, productId); toRow.avg_cost = toRow.quantity + q > 0 ? round2((toRow.avg_cost * toRow.quantity + fromRow.avg_cost * q) / (toRow.quantity + q)) : fromRow.avg_cost; toRow.quantity += q; move(to, productId, 'transfer_in', q, fromRow.avg_cost, 'transfer', id, null, t.received_at, t.received_by); }
      }
      transfer_items.push(item);
    });
    stock_transfers.push(t);
  };
  mkTransfer(1, 1, 2, 'received', 14, [[1, 1], [5, 2], [18, 5], [23, 10]], { notes: 'Restock for Gulberg weekend rush' });
  mkTransfer(2, 1, 2, 'shipped', 3, [[3, 1], [7, 2], [19, 10], [27, 1]], { notes: 'Customer pre-orders at B2 (incl. one Latitude 5420)' });
  mkTransfer(3, 2, 1, 'approved', 2, [[9, 1], [24, 5]], { notes: 'Reno 11 requested by walk-in at Main' });
  mkTransfer(4, 1, 2, 'pending', 1, [[4, 1], [17, 1], [21, 2], [41, 2]], { notes: 'Urgent - S24 out of stock at B2' });
  mkTransfer(5, 2, 1, 'rejected', 9, [[10, 2]], { notes: 'Move V30 units to Main', rejection_reason: 'Units already committed to a corporate order at B2' });
  mkTransfer(6, 1, 2, 'received', 25, [[6, 2], [12, 2], [25, 20]], {});

  // ------------------------------------------------------------ expenses
  const expense_categories = ['Rent', 'Utility Bills', 'Employee Salaries', 'Mobile Repairing Costs', 'Repair Parts & Tools', 'Marketing', 'Office Supplies', 'Transport & Courier', 'Miscellaneous'].map((name, i) => ({ id: i + 1, name, is_active: 1 }));
  const expenses = [];
  let expId = 1;
  const addExpense = (branchId, categoryId, amount, days, method, description, ref, userId) => expenses.push({ id: expId++, branch_id: branchId, category_id: categoryId, amount, expense_date: dateOnly(days), payment_method: method, description, reference: ref || '', created_by: userId, created_at: at(days, 12, 0) });
  [1, 2].forEach((branchId) => {
    const mgr = branchId === 1 ? 2 : 4;
    addExpense(branchId, 1, branchId === 1 ? 120000 : 85000, 21, 'bank_transfer', 'Shop rent - current month', 'RENT-' + dateOnly(21).slice(0, 7), mgr);
    addExpense(branchId, 3, branchId === 1 ? 185000 : 125000, 21, 'bank_transfer', 'Staff & technician salaries - previous month', '', mgr);
    addExpense(branchId, 2, between(18000, 32000), 15, 'cash', 'LESCO electricity bill', 'LESCO-' + between(100000, 999999), mgr);
    addExpense(branchId, 2, between(3000, 6000), 14, 'cash', 'PTCL internet & phone', '', mgr);
    for (let k = 0; k < 5; k++) addExpense(branchId, 4, between(800, 6500), between(1, 40), 'cash', pick(['Outsourced chip-level repair - customer job', 'Software flashing service', 'Screen refurbishing - outsourced']), '', mgr);
    for (let k = 0; k < 3; k++) addExpense(branchId, 5, between(1500, 12000), between(1, 40), 'cash', pick(['Soldering station tips & flux', 'Laptop opening tool kit', 'Isopropyl alcohol & thermal paste', 'Multimeter & DC power supply']), '', mgr);
    for (let k = 0; k < 4; k++) addExpense(branchId, pick([7, 8, 9, 6]), between(500, 4000), between(0, 40), 'cash', pick(['Printer thermal rolls', 'Courier charges - customer delivery', 'Tea & refreshments', 'Facebook boosted post', 'Shop cleaning', 'Stationery']), '', mgr);
    addExpense(branchId, 9, between(1000, 2500), 0, 'cash', 'Generator fuel', '', mgr);
  });

  // ------------------------------------------------------------- repairs
  // Repair job cards: device intake -> diagnosis -> parts/labor -> ready -> delivered. Parts consume stock; labor = service products.
  const repair_jobs = [];
  const repair_items = [];
  const repair_payments = [];
  const repair_status_log = [];
  let jobId = 1, rItemId = 1, rPayId = 1, rLogId = 1;
  const jobCounters = { 1: 0, 2: 0 };
  const STATUS_FLOW = ['received', 'diagnosing', 'awaiting_approval', 'awaiting_parts', 'in_progress', 'ready', 'delivered'];
  const deviceDefs = [
    { device_type: 'mobile', brand: 'Apple', model: 'iPhone 13', problem: 'Cracked screen, touch working', parts: [[33, 1]], labor: [43], serialType: 'imei' },
    { device_type: 'mobile', brand: 'Samsung', model: 'Galaxy A55', problem: 'Battery drains fast, swelling', parts: [[34, 1]], labor: [44], serialType: 'imei' },
    { device_type: 'mobile', brand: 'Xiaomi', model: 'Redmi Note 12', problem: 'Not charging - port loose', parts: [[35, 1]], labor: [45], serialType: 'imei' },
    { device_type: 'mobile', brand: 'Oppo', model: 'A78', problem: 'Stuck on logo / bootloop', parts: [], labor: [46], serialType: 'imei' },
    { device_type: 'mobile', brand: 'Apple', model: 'iPhone 13', problem: 'Back glass shattered', parts: [[36, 1]], labor: [43], serialType: 'imei' },
    { device_type: 'laptop', brand: 'Dell', model: 'Latitude 5420', problem: 'Battery not holding charge', parts: [[37, 1]], labor: [44], serialType: 'serial' },
    { device_type: 'laptop', brand: 'HP', model: 'EliteBook 840 G8', problem: 'Several keys not working', parts: [[38, 1]], labor: [47], serialType: 'serial' },
    { device_type: 'laptop', brand: 'Lenovo', model: 'IdeaPad 3', problem: 'Overheating and shutting down', parts: [], labor: [47], serialType: 'serial' },
    { device_type: 'laptop', brand: 'ASUS', model: 'VivoBook 15', problem: 'Cracked LCD after drop', parts: [[40, 1]], labor: [48], serialType: 'serial' },
    { device_type: 'laptop', brand: 'Acer', model: 'Aspire 5', problem: 'Very slow - upgrade to SSD + RAM', parts: [[41, 1], [42, 1]], labor: [46], serialType: 'serial' },
    { device_type: 'laptop', brand: 'HP', model: 'Pavilion 15', problem: 'No power, liquid damage', parts: [], labor: [49, 50], serialType: 'serial' },
    { device_type: 'desktop', brand: 'Dell', model: 'OptiPlex 7040', problem: 'Windows corrupted, data recovery needed', parts: [], labor: [51, 46], serialType: 'serial' },
    { device_type: 'tablet', brand: 'Samsung', model: 'Galaxy Tab A8', problem: 'Charging port damaged', parts: [[35, 1]], labor: [45], serialType: 'imei' },
    { device_type: 'mobile', brand: 'Infinix', model: 'Hot 30', problem: 'Screen flickering', parts: [], labor: [50], serialType: 'imei' },
  ];
  const jobPlan = [ // [deviceDef index, branch, daysAgo, status, technician]
    [0, 1, 18, 'delivered', 7], [5, 1, 15, 'delivered', 7], [2, 2, 14, 'delivered', 8], [9, 1, 12, 'delivered', 7], [12, 2, 11, 'delivered', 8],
    [1, 1, 8, 'delivered', 7], [6, 2, 7, 'ready', 8], [3, 1, 5, 'ready', 7], [7, 1, 4, 'in_progress', 7], [8, 2, 3, 'awaiting_parts', 8],
    [10, 1, 2, 'awaiting_approval', 7], [4, 2, 2, 'in_progress', 8], [11, 1, 1, 'diagnosing', 7], [13, 1, 0, 'received', null], [5, 2, 0, 'received', null], [0, 1, 27, 'cancelled', 7],
  ];
  jobPlan.forEach(([di, branchId, days, status, techId]) => {
    const def = deviceDefs[di];
    const branch = branches.find((b) => b.id === branchId);
    const id = jobId++;
    jobCounters[branchId]++;
    const customer = pick(customers.filter((c) => !c.is_walkin));
    const receivedAt = at(days, between(10, 17), between(0, 59));
    const serial = def.serialType === 'imei' ? genImei() : genSerial(def.brand.slice(0, 2).toUpperCase() + 'X');
    const parts = def.parts.map(([pid, q]) => { const p = products.find((x) => x.id === pid); return { product_id: pid, quantity: q, unit_price: p.retail_price, unit_cost: p.cost_price, description: p.name }; });
    const labor = def.labor.map((pid) => { const p = products.find((x) => x.id === pid); return { product_id: pid, quantity: 1, unit_price: p.retail_price, unit_cost: 0, description: p.name }; });
    const stageIdx = STATUS_FLOW.indexOf(status);
    const itemsAdded = status === 'cancelled' ? false : stageIdx >= STATUS_FLOW.indexOf('awaiting_approval');
    const totalParts = itemsAdded ? round2(parts.reduce((s, x) => s + x.unit_price * x.quantity, 0)) : 0;
    const totalLabor = itemsAdded ? round2(labor.reduce((s, x) => s + x.unit_price * x.quantity, 0)) : 0;
    const estimate = round2(parts.reduce((s, x) => s + x.unit_price * x.quantity, 0) + labor.reduce((s, x) => s + x.unit_price * x.quantity, 0));
    const discount = itemsAdded && chance(0.3) ? 500 : 0;
    const total = itemsAdded ? round2(totalParts + totalLabor - discount) : 0;
    const advance = chance(0.6) ? round2(Math.floor(estimate * 0.3 / 500) * 500) : 0;
    const job = {
      id, job_no: `JOB-${branch.code}-${pad(jobCounters[branchId])}`, branch_id: branchId, customer_id: customer.id,
      device_type: def.device_type, brand: def.brand, model: def.model, serial, serial_type: def.serialType, color: pick(['Black', 'Blue', 'Silver', 'Grey', 'White']),
      password_pattern: chance(0.5) ? pick(['1234', 'L-pattern', 'none', '0000']) : '', accessories_received: pick(['Device only', 'Device + charger', 'Device + charger + bag', 'Device + SIM + case']),
      condition_notes: pick(['Minor scratches on back', 'Good physical condition', 'Dent on corner, screen protector applied', 'Heavy wear']),
      problem_description: def.problem, diagnosis: stageIdx >= 1 ? pick(['Confirmed by inspection - part replacement required', 'Component failure found on board', 'Software corruption, hardware OK']) : '',
      status, priority: chance(0.25) ? 'urgent' : 'normal', technician_id: techId, estimated_cost: estimate, quoted_at: stageIdx >= 2 ? at(days, 18, 0) : null, approved_by_customer: stageIdx >= 3 ? 1 : 0,
      total_parts: totalParts, total_labor: totalLabor, discount, total, paid_amount: 0, due_amount: 0, warranty_days: def.device_type === 'laptop' ? 15 : 7,
      promised_at: at(Math.max(0, days - between(1, 3)), 18, 0), received_at: receivedAt, completed_at: stageIdx >= 5 ? at(Math.max(0, days - 1), 16, 0) : null, delivered_at: status === 'delivered' ? at(Math.max(0, days - 1), 18, 30) : null,
      cancel_reason: status === 'cancelled' ? 'Customer declined the quote' : '', notes: '', created_by: branchId === 1 ? 3 : 5, created_at: receivedAt, updated_at: receivedAt,
    };
    if (itemsAdded) {
      [...parts, ...labor].forEach((x) => {
        repair_items.push({ id: rItemId++, job_id: id, type: x.unit_cost === 0 && products.find((p) => p.id === x.product_id).product_type === 'service' ? 'labor' : 'part', product_id: x.product_id, description: x.description, quantity: x.quantity, unit_price: x.unit_price, unit_cost: x.unit_cost, total: round2(x.unit_price * x.quantity), created_at: at(days, 18, 0) });
      });
      if (stageIdx >= STATUS_FLOW.indexOf('in_progress')) { // parts consumed from stock
        parts.forEach((x) => { const row = stockRow(branchId, x.product_id); if (row.quantity >= x.quantity) { row.quantity -= x.quantity; move(branchId, x.product_id, 'repair', -x.quantity, row.avg_cost, 'repair_job', id, null, at(Math.max(0, days - 1), 12, 0), techId); } });
      }
    }
    if (advance > 0 && status !== 'cancelled') { repair_payments.push({ id: rPayId++, job_id: id, method: 'cash', amount: advance, reference: null, kind: 'advance', created_at: receivedAt, created_by: job.created_by }); job.paid_amount = advance; }
    if (status === 'delivered') { const rest = round2(total - job.paid_amount); if (rest > 0) repair_payments.push({ id: rPayId++, job_id: id, method: pick(['cash', 'cash', 'jazzcash', 'card']), amount: rest, reference: null, kind: 'final', created_at: job.delivered_at, created_by: job.created_by }); job.paid_amount = total; }
    job.due_amount = round2(Math.max(0, total - job.paid_amount));
    // status history
    const steps = status === 'cancelled' ? ['received', 'diagnosing', 'awaiting_approval', 'cancelled'] : STATUS_FLOW.slice(0, stageIdx + 1);
    steps.forEach((s, k) => repair_status_log.push({ id: rLogId++, job_id: id, status: s, notes: s === 'received' ? 'Device received at counter' : s === 'cancelled' ? job.cancel_reason : '', user_id: k === 0 ? job.created_by : (techId || job.created_by), created_at: at(Math.max(0, days - Math.floor(k / 2)), 10 + k, 0) }));
    repair_jobs.push(job);
  });

  // ---------------------------------------------------------- closings
  const daily_closings = [];
  let closingId = 1;
  let openingBal = { 1: 25000, 2: 15000 };
  for (let d = 12; d >= 1; d--) {
    const date = dateOnly(d);
    [1, 2].forEach((branchId) => {
      const daySales = sales.filter((s) => s.branch_id === branchId && s.sale_date.slice(0, 10) === date);
      const cashSales = round2(sale_payments.filter((p) => p.method === 'cash' && daySales.some((s) => s.id === p.sale_id)).reduce((s, p) => s + p.amount, 0));
      const cashReceived = round2(customer_transactions.filter((t) => t.branch_id === branchId && t.type === 'payment' && t.payment_method === 'cash' && t.created_at.slice(0, 10) === date).reduce((s, t) => s + t.credit, 0));
      const cashRepairs = round2(repair_payments.filter((p) => p.method === 'cash' && p.created_at.slice(0, 10) === date && repair_jobs.some((j) => j.id === p.job_id && j.branch_id === branchId)).reduce((s, p) => s + p.amount, 0));
      const cashRefunds = round2(sale_returns.filter((r) => r.branch_id === branchId && r.refund_method === 'cash' && r.return_date.slice(0, 10) === date).reduce((s, r) => s + r.refund_amount, 0));
      const cashExpenses = round2(expenses.filter((e) => e.branch_id === branchId && e.payment_method === 'cash' && e.expense_date === date).reduce((s, e) => s + e.amount, 0));
      const supplierCash = round2(supplier_transactions.filter((t) => t.branch_id === branchId && t.type === 'payment' && t.payment_method === 'cash' && t.created_at.slice(0, 10) === date).reduce((s, t) => s + t.debit, 0));
      const expected = round2(openingBal[branchId] + cashSales + cashReceived + cashRepairs - cashRefunds - cashExpenses - supplierCash);
      const discrepancy = d % 5 === 0 ? -pick([100, 250, 500]) : (d % 7 === 0 ? 50 : 0);
      const actual = round2(expected + discrepancy);
      const nextOpening = branchId === 1 ? 25000 : 15000;
      daily_closings.push({ id: closingId++, branch_id: branchId, closing_date: date, opening_balance: openingBal[branchId], cash_sales: cashSales, cash_received: cashReceived, cash_repairs: cashRepairs, cash_refunds: cashRefunds, cash_expenses: cashExpenses, supplier_cash_payments: supplierCash, expected_cash: expected, actual_cash: actual, discrepancy, bank_deposit: round2(Math.max(0, actual - nextOpening)), retained_float: nextOpening, denominations: null, notes: discrepancy ? pick(['Short - change given incorrectly', 'Minor variance, investigating', 'Coins not counted']) : '', status: 'closed', closed_by: branchId === 1 ? 2 : 4, closed_at: at(d, 21, 15), created_at: at(d, 21, 15) });
      openingBal[branchId] = nextOpening;
    });
  }

  // ------------------------------------------------------- cashier shifts
  // One cashier, one drawer, one session. The totals are derived from the very records the shift is
  // accountable for, so a seeded shift reconciles exactly the way a live one does.
  const cashier_shifts = [];
  const cash_movements = [];
  {
    let shiftId = 1, moveId = 1;
    const shiftNo = { 1: 0, 2: 0 };
    const inWin = (stamp, from, to) => stamp >= from && stamp <= to;

    const mkShift = (def) => {
      const branch = branches.find((b) => b.id === def.branch);
      const id = shiftId++;
      const from = at(def.days, def.openH, def.openM || 0);
      const to = def.open ? null : at(def.days, def.closeH, def.closeM || 0);
      const end = to || at(def.days, 23, 59);
      const mineSale = (s) => s.user_id === def.user && s.branch_id === def.branch && s.status !== 'void';
      const saleIds = new Set(sales.filter((s) => mineSale(s) && inWin(s.sale_date, from, end)).map((s) => s.id));
      const cashSales = round2(sale_payments.filter((p) => p.method === 'cash' && saleIds.has(p.sale_id)).reduce((a, p) => a + p.amount, 0));
      const cashReceived = round2(customer_transactions.filter((t) => t.branch_id === def.branch && t.created_by === def.user && t.type === 'payment' && t.payment_method === 'cash' && inWin(t.created_at, from, end)).reduce((a, t) => a + t.credit, 0));
      const cashRepairs = round2(repair_payments.filter((p) => p.method === 'cash' && p.created_by === def.user && inWin(p.created_at, from, end)).reduce((a, p) => a + p.amount, 0));
      const cashRefunds = round2(sale_returns.filter((r) => r.branch_id === def.branch && r.user_id === def.user && r.refund_method === 'cash' && inWin(r.created_at || r.return_date, from, end)).reduce((a, r) => a + r.refund_amount, 0));
      const cashExpenses = round2(expenses.filter((e) => e.branch_id === def.branch && e.created_by === def.user && e.payment_method === 'cash' && inWin(e.created_at, from, end)).reduce((a, e) => a + e.amount, 0));

      const moves = (def.movements || []).map((m) => {
        const row = { id: moveId++, shift_id: id, branch_id: def.branch, type: m[0], amount: m[1], reason: m[2], reference: '', created_by: def.user, created_at: at(def.days, m[3], m[4] || 0) };
        cash_movements.push(row);
        return row;
      });
      const sum = (type) => round2(moves.filter((m) => m.type === type).reduce((a, m) => a + m.amount, 0));
      const payIns = sum('pay_in'), payOuts = sum('pay_out'), banked = sum('bank_drop');
      const expected = round2(def.float + cashSales + cashReceived + cashRepairs + payIns - cashRefunds - cashExpenses - payOuts - banked);
      const counted = def.open ? null : round2(expected + (def.variance || 0));
      shiftNo[def.branch] = (shiftNo[def.branch] || 0) + 1;
      // the note breakdown has to add up to what was counted, or the printed report contradicts itself
      const splitNotes = (amount) => {
        let left = Math.round(amount);
        const d = {};
        [5000, 1000, 500, 100, 50, 20, 10].forEach((n) => { d[n] = Math.floor(left / n); left -= d[n] * n; });
        d.coins = round2(amount - Math.round(amount) + left);
        return d;
      };
      const handover = def.open ? 0 : Math.min(def.handover || 0, counted);

      cashier_shifts.push({
        id, shift_no: `SFT-${branch.code}-${pad(id)}`, branch_id: def.branch, user_id: def.user,
        status: def.open ? 'open' : 'closed', opened_at: from, opened_by: def.user, closed_at: to, closed_by: def.open ? null : def.user,
        opening_float: def.float, counted_cash: counted, expected_cash: def.open ? null : expected,
        variance: def.open ? null : round2(def.variance || 0),
        denominations: def.open ? null : splitNotes(counted),
        handover_to: def.open ? null : (def.handoverTo || null), handover_amount: handover,
        banked_amount: def.open ? 0 : round2(Math.max(0, counted - handover)),
        totals: def.open ? null : {
          cash_sales: cashSales, cash_received: cashReceived, repair_cash: cashRepairs, pay_ins: payIns,
          refunds: cashRefunds, expenses: cashExpenses, supplier_payments: 0, pay_outs: payOuts, bank_drops: banked,
          invoices: saleIds.size,
        },
        notes: def.notes || '', created_at: from,
      });
    };

    // Main branch: yesterday balanced, the day before short by Rs 500, plus today's live drawer
    mkShift({
      branch: 1, user: 3, days: 2, openH: 10, closeH: 20, closeM: 30, float: 10000, variance: -500,
      movements: [['pay_out', 1500, 'Lunch for the team', 14, 20], ['bank_drop', 40000, 'Evening deposit — slip 88142', 19, 45]],
      handoverTo: 2, handover: 10000, notes: 'Counted twice — Rs 500 short, most likely change given wrong.',
    });
    mkShift({
      branch: 1, user: 3, days: 1, openH: 10, closeH: 20, closeM: 40, float: 10000, variance: 0,
      movements: [['pay_in', 5000, 'Change brought from the safe', 11, 10], ['bank_drop', 60000, 'Evening deposit — slip 88219', 19, 50]],
      handoverTo: 2, handover: 10000, notes: '',
    });
    mkShift({ branch: 1, user: 3, days: 0, openH: 9, openM: 45, float: 10000, open: true, movements: [['pay_in', 2000, 'Coin float from the safe', 10, 15]], notes: 'Morning shift.' });
    // Branch 2: a closed shift that came up Rs 200 over, and today's open drawer
    mkShift({
      branch: 2, user: 5, days: 1, openH: 11, closeH: 21, float: 8000, variance: 200,
      movements: [['pay_out', 800, 'Courier charges', 16, 30]],
      handoverTo: 4, handover: 8000, notes: 'Rs 200 over — customer may have overpaid.',
    });
    mkShift({ branch: 2, user: 5, days: 0, openH: 11, float: 8000, open: true, movements: [], notes: '' });
  }

  // ------------------------------------------------------- banking & cheques
  // The bank side of the money that already exists in this database: every day-end deposit and every
  // shift that banked cash lands here, so the bank balance is the demo history, not a made-up number.
  const bank_accounts = [];
  const bank_transactions = [];
  const cheques = [];
  let bankPost = null, settleInto = null;       // used again by the card & wallet settlement pass at the end
  {
    let txnId = 1, chqId = 1;
    const mkAccount = (def) => {
      const acc = {
        id: bank_accounts.length + 1, name: def.name, bank_name: def.bank, account_title: def.title,
        account_no: def.no, iban: def.iban, branch_id: def.branch, account_type: def.type || 'current',
        opening_balance: def.opening, balance: def.opening, is_active: 1, notes: def.notes || '',
        created_at: at(200, 10, 0),
      };
      bank_accounts.push(acc);
      if (!(def.opening > 0)) return acc;                    // a wallet that starts empty has no opening entry
      bank_transactions.push({
        id: txnId++, account_id: acc.id, branch_id: def.branch, txn_date: dateOnly(200), type: 'opening',
        amount: def.opening, signed: def.opening, balance_after: def.opening, method: 'online',
        reference: 'Opening balance', cheque_id: null, reference_type: null, reference_id: null,
        party: '', notes: 'Account opened', reconciled: 1, reconciled_at: at(200, 10, 0), created_by: 1, created_at: at(200, 10, 0),
      });
      return acc;
    };
    const post = (acc, def) => {
      const sign = ['deposit', 'transfer_in', 'receipt', 'interest', 'opening'].includes(def.type) ? 1 : -1;
      acc.balance = round2(acc.balance + sign * def.amount);
      const row = {
        id: txnId++, account_id: acc.id, branch_id: def.branch || acc.branch_id, txn_date: def.date, type: def.type,
        amount: def.amount, signed: round2(sign * def.amount), balance_after: acc.balance, method: def.method || 'cash',
        reference: def.reference || '', cheque_id: def.chequeId || null,
        reference_type: def.refType || null, reference_id: def.refId || null,
        party: def.party || '', notes: def.notes || '', reconciled: def.days > 3 ? 1 : 0,
        reconciled_at: def.days > 3 ? at(Math.max(0, def.days - 2), 12, 0) : null,
        created_by: def.by || 2, created_at: at(def.days, def.hour || 16, 30),
      };
      bank_transactions.push(row);
      return row;
    };

    const main = mkAccount({ name: 'Meezan — Main Current', bank: 'Meezan Bank', title: 'Abbott Mobiles', no: '0102-0101-0007-3456', iban: 'PK36MEZN0001020101000734', branch: 1, opening: 1500000, notes: 'Day-to-day account for the Main Branch.' });
    const gulberg = mkAccount({ name: 'HBL — Gulberg', bank: 'Habib Bank', title: 'Abbott Mobiles (Gulberg)', no: '1234-7901-2345-001', iban: 'PK24HABB0012347901234500', branch: 2, opening: 600000, notes: 'Branch 2 collections.' });
    const savings = mkAccount({ name: 'Meezan — Savings', bank: 'Meezan Bank', title: 'Abbott Mobiles', no: '0102-0101-0009-8877', iban: 'PK36MEZN0001020101000988', branch: null, opening: 900000, type: 'savings', notes: 'Kept aside for stock buying.' });
    // merchant wallets: JazzCash / EasyPaisa money from every branch lands here, never in a drawer
    const jazz = mkAccount({ name: 'JazzCash Business', bank: 'JazzCash', title: 'Abbott Mobiles', no: '0300-1112233', iban: '', branch: null, opening: 0, type: 'wallet', notes: 'Merchant wallet for JazzCash payments at every branch.' });
    const easy = mkAccount({ name: 'EasyPaisa Business', bank: 'EasyPaisa', title: 'Abbott Mobiles', no: '0345-4445566', iban: '', branch: null, opening: 0, type: 'wallet', notes: 'Merchant wallet for EasyPaisa payments at every branch.' });
    bankPost = post;
    settleInto = { card: (b) => (b === 2 ? gulberg : main), bank_transfer: (b) => (b === 2 ? gulberg : main), jazzcash: () => jazz, easypaisa: () => easy };

    // every closed day that banked cash shows up as a deposit
    daily_closings.filter((c) => c.status === 'closed' && c.bank_deposit > 0).forEach((c) => {
      const acc = c.branch_id === 1 ? main : gulberg;
      const days = Math.round((today - new Date(c.closing_date + 'T00:00:00')) / 86400000);
      post(acc, {
        type: 'deposit', amount: c.bank_deposit, date: c.closing_date, days, hour: 21, method: 'cash',
        reference: 'Day-end ' + c.closing_date, refType: 'daily_closing', refId: c.id,
        notes: 'Cash banked at day-end', by: c.closed_by, branch: c.branch_id,
      });
    });
    // and so does every shift that sent cash to the bank during the day
    cash_movements.filter((m) => m.type === 'bank_drop').forEach((m) => {
      const acc = m.branch_id === 1 ? main : gulberg;
      const days = Math.round((today - new Date(String(m.created_at).slice(0, 10) + 'T00:00:00')) / 86400000);
      post(acc, {
        type: 'deposit', amount: m.amount, date: String(m.created_at).slice(0, 10), days, hour: 19, method: 'cash',
        reference: m.reason || 'Shift bank drop', refType: 'cash_movement', refId: m.id,
        notes: 'Banked from the drawer', by: m.created_by, branch: m.branch_id,
      });
    });

    // running the business through the bank
    post(main, { type: 'transfer_out', amount: 500000, date: dateOnly(18), days: 18, method: 'online', reference: 'TRF-88120', party: savings.name, notes: 'Moved to savings for stock buying' });
    post(savings, { type: 'transfer_in', amount: 500000, date: dateOnly(18), days: 18, method: 'online', reference: 'TRF-88120', party: main.name, notes: 'From the current account' });
    post(main, { type: 'charges', amount: 1150, date: dateOnly(12), days: 12, method: 'online', reference: 'Monthly charges', notes: 'Account maintenance and SMS alerts' });
    post(gulberg, { type: 'charges', amount: 850, date: dateOnly(12), days: 12, method: 'online', reference: 'Monthly charges', notes: 'Account maintenance' });
    post(savings, { type: 'interest', amount: 6400, date: dateOnly(10), days: 10, method: 'online', reference: 'Profit', notes: 'Quarterly profit' });
    post(main, { type: 'withdrawal', amount: 120000, date: dateOnly(7), days: 7, method: 'cash', reference: 'ATM / counter', notes: 'Cash taken for the shop float' });

    // the cheque register
    const mkCheque = (def) => {
      const row = {
        id: chqId++, cheque_no: def.no, direction: def.direction, account_id: def.account ? def.account.id : null,
        bank_name: def.bank || (def.account ? def.account.bank_name : ''), party_type: def.partyType,
        party_id: def.partyId || null, party_name: def.party, amount: def.amount,
        issue_date: dateOnly(def.issued), due_date: dateOnly(def.due), status: def.status,
        deposited_at: def.depositedDays != null ? at(def.depositedDays, 11, 0) : null,
        cleared_at: def.status === 'cleared' ? at(def.clearedDays, 12, 0) : null,
        bounced_reason: def.status === 'bounced' ? def.reason : '',
        branch_id: def.branch, reference_type: null, reference_id: null,
        notes: def.notes || '', created_by: def.branch === 1 ? 2 : 4, created_at: at(def.issued, 12, 0),
      };
      cheques.push(row);
      if (def.status === 'cleared' && def.account) {
        post(def.account, {
          type: def.direction === 'issued' ? 'payment' : 'receipt', amount: def.amount, date: dateOnly(def.clearedDays),
          days: def.clearedDays, method: 'cheque', reference: def.no, party: def.party, chequeId: row.id,
          refType: 'cheque', refId: row.id, notes: def.notes || '', branch: def.branch,
        });
      }
      return row;
    };
    // paid to suppliers
    mkCheque({ no: '0043117', direction: 'issued', account: main, partyType: 'supplier', partyId: 1, party: suppliers.find((s) => s.id === 1).name, amount: 450000, issued: 22, due: 22, clearedDays: 20, status: 'cleared', branch: 1, notes: 'Part payment against phone stock' });
    mkCheque({ no: '0043118', direction: 'issued', account: main, partyType: 'supplier', partyId: 3, party: suppliers.find((s) => s.id === 3).name, amount: 180000, issued: 5, due: -3, status: 'pending', branch: 1, notes: 'Post-dated — accessories order' });
    mkCheque({ no: '0091204', direction: 'issued', account: gulberg, partyType: 'supplier', partyId: 2, party: suppliers.find((s) => s.id === 2).name, amount: 260000, issued: 9, due: 8, clearedDays: 7, status: 'cleared', branch: 2, notes: '' });
    // received from customers
    const bigCustomer = customers.find((c) => c.balance > 0) || customers[1];
    mkCheque({ no: '7781204', direction: 'received', account: main, bank: 'Bank Alfalah', partyType: 'customer', partyId: bigCustomer.id, party: bigCustomer.name, amount: 95000, issued: 14, due: 13, depositedDays: 13, clearedDays: 11, status: 'cleared', branch: 1, notes: 'Against khata balance' });
    mkCheque({ no: '3390561', direction: 'received', account: main, bank: 'UBL', partyType: 'customer', partyId: customers[2].id, party: customers[2].name, amount: 42000, issued: 6, due: 5, depositedDays: 5, status: 'deposited', branch: 1, notes: 'Waiting to clear' });
    mkCheque({ no: '5510773', direction: 'received', account: gulberg, bank: 'Askari Bank', partyType: 'customer', partyId: customers[3].id, party: customers[3].name, amount: 28000, issued: 11, due: 10, depositedDays: 10, status: 'bounced', reason: 'Insufficient funds', branch: 2, notes: 'Customer informed, promised cash' });
    mkCheque({ no: '8821450', direction: 'received', account: null, bank: 'Meezan Bank', partyType: 'customer', partyId: customers[4].id, party: customers[4].name, amount: 65000, issued: 2, due: -6, status: 'pending', branch: 1, notes: 'Post-dated, in the safe' });
  }

  // ---------------------------------------------------------- audit log
  const audit_logs = [];
  const auditDefs = [
    [1, null, 'login', 'user', 1, 'Super admin logged in', 0, 9, 5],
    [2, 1, 'login', 'user', 2, 'Manager logged in', 0, 9, 30],
    [3, 1, 'sale.create', 'sale', sales[sales.length - 1] ? sales[sales.length - 1].id : 1, 'Invoice created at POS', 0, 10, 12],
    [3, 1, 'repair.create', 'repair_job', 14, 'Job card JOB-MB-000009 created (Infinix Hot 30)', 0, 11, 5],
    [7, 1, 'repair.status', 'repair_job', 9, 'JOB-MB-000006 moved to in_progress', 1, 12, 0],
    [2, 1, 'transfer.request', 'stock_transfer', 4, 'Transfer TRF-MB-000004 requested', 1, 10, 0],
    [1, null, 'transfer.approve', 'stock_transfer', 3, 'Transfer TRF-B2-000003 approved', 1, 11, 0],
    [4, 2, 'transfer.ship', 'stock_transfer', 2, 'Transfer TRF-MB-000002 shipped (4 units)', 2, 15, 0],
    [2, 1, 'product.update', 'product', 1, 'Retail price changed 284900 -> 289900', 3, 12, 30],
    [1, null, 'user.create', 'user', 7, 'User technician created (technician)', 250, 9, 0],
    [1, null, 'user.deactivate', 'user', 6, 'User hamza deactivated', 40, 17, 0],
    [1, null, 'branch.update', 'branch', 3, 'Branch B3 deactivated', 30, 10, 0],
    [2, 1, 'closing.close', 'daily_closing', 23, 'Day closed with discrepancy -250', 1, 21, 15],
    [4, 2, 'expense.create', 'expense', 3, 'Expense LESCO bill recorded', 15, 12, 0],
    [2, 1, 'imei.status', 'product_imei', 3, 'Unit marked returned (open box)', 3, 14, 0],
    [1, null, 'settings.update', 'settings', null, 'Invoice terms updated', 7, 16, 0],
    [3, 1, 'customer.create', 'customer', 10, 'Customer added from POS quick-add', 5, 13, 0],
    [1, null, 'login.failed', 'user', null, 'Failed login for username "admin" from 192.168.1.20', 2, 8, 50],
  ];
  auditDefs.forEach((a, i) => audit_logs.push({ id: i + 1, user_id: a[0], branch_id: a[1], action: a[2], entity_type: a[3], entity_id: a[4], details: a[5], ip: '192.168.1.' + between(2, 60), created_at: at(a[6], a[7], a[8]) }));

  // ------------------------------------------------------------ settings
  const settings = {
    company_name: 'Abbott Mobiles', company_tagline: 'The name of trust', logo: null,   // logo: null = use assets/img/logo.png (see ABM.brand)
    business_types: ['mobile', 'laptop', 'accessories', 'repair'],
    currency: 'PKR', currency_symbol: 'Rs.',
    default_tax_rate: 0, tax_label: 'Sales Tax', tax_inclusive: 0,
    invoice_prefix: 'INV', receipt_footer: 'Thank you for shopping at Abbott Mobile!',
    invoice_terms: 'Goods once sold are not returnable except for manufacturing defects reported within 7 days with the original invoice. Warranty as per manufacturer policy. IMEI / serial number must match this invoice for any claim.',
    repair_terms: 'Devices not collected within 30 days of the ready notice may be disposed of to recover costs. Data may be lost during repair - please back up. Warranty covers the repaired fault only.',
    thermal_width: '80mm', default_print_layout: 'thermal',
    low_stock_alerts: 1, imei_luhn_check: 0, serial_uppercase: 1, allow_negative_stock: 0,
    adjustment_approval_limit: 50000,
    // security (browser-only prototype: see the note on ABM.session) and the demo aids
    login_max_attempts: 5, login_lock_minutes: 15, idle_lock_minutes: 30, demo_mode: 1,
    doc_prefixes: {}, theme_default: null, company_ntn: '', company_strn: '',   // a manual stock adjustment worth more than this waits for inventory.approve
    default_customer_id: 1, cash_float: 25000,
    repair_prefix: 'JOB', repair_default_warranty_days: 7, repair_diagnostic_fee: 500, repair_sms_template: 'Dear {customer}, your {device} (Job {job_no}) is {status}. Total Rs {total}. - Abbott Mobile',
    // where card / wallet / bank-transfer money lands, per branch (bank_accounts ids; edited on Banking)
    payment_accounts: { 1: { card: 1, bank_transfer: 1, jazzcash: 4, easypaisa: 5 }, 2: { card: 2, bank_transfer: 2, jazzcash: 4, easypaisa: 5 } },
  };

  // ------------------------------------------------------- website / CMS
  // Everything the public storefront (shop/*.html) shows is editable from website.html (CMS).
  const cms = {
    site: {
      name: 'Abbott Mobiles', tagline: 'The name of trust', logo: null, favicon: null,   // logo: null = the shared brand mark
      hero: { badge: 'New arrivals every week', title: 'Latest phones & laptops. Honest prices. Real warranty.', subtitle: 'Shop genuine smartphones, laptops and accessories from Abbott Mobile — or book an expert repair and track it online.', cta_text: 'Shop now', cta_link: 'products.html', cta2_text: 'Book a repair', cta2_link: 'repair.html', image: null, style: 'gradient' },
      announcement: { enabled: 1, text: 'Free delivery in Lahore on orders above Rs. 5,000 · Same-day mobile repairs' },
      featured_category_ids: [1, 4, 6, 11], featured_product_ids: [1, 4, 7, 27, 30, 21, 22, 18],
      highlights: [
        { icon: 'shield-check', title: 'Official warranty', text: 'PTA approved phones with brand warranty' },
        { icon: 'truck', title: 'Fast delivery', text: 'Same-day in Lahore, 2–3 days nationwide' },
        { icon: 'wrench', title: 'Expert repairs', text: 'Certified technicians & genuine parts' },
        { icon: 'banknotes', title: 'Easy payments', text: 'COD, JazzCash, EasyPaisa & bank transfer' },
      ],
      about_html: '<h2>About Abbott Mobile</h2><p>Abbott Mobile has served Lahore since 2015 from Hall Road and Gulberg. We sell genuine, PTA-approved smartphones, business-class laptops and accessories, and run an in-house repair lab for mobiles and laptops.</p><p>Every device is checked by our technicians before sale and comes with a written warranty. Visit any branch or order online with cash on delivery.</p>',
      contact: { phone: '042-37311234', whatsapp: '0300-1234567', email: 'hello@abbottmobile.pk', address: 'Shop 12, Hall Road, Lahore', hours: 'Mon–Sat 10:00 – 21:00', map_url: '' },
      social: { facebook: 'https://facebook.com/abbottmobile', instagram: 'https://instagram.com/abbottmobile', tiktok: '', youtube: '', whatsapp: 'https://wa.me/923001234567' },
      footer_text: 'Abbott Mobile — Smartphones · Laptops · Accessories · Repairs. Hall Road & Gulberg, Lahore.',
      theme: { primary: '#1a336a', accent: '#10b981', background: '#f8fafc', mode: 'light', font: 'Inter', radius: 'rounded', header_style: 'solid', button_style: 'rounded' },
      seo: { title: 'Abbott Mobile — Phones, Laptops & Repairs in Lahore', description: 'Buy genuine smartphones, laptops and accessories online or book a mobile / laptop repair at Abbott Mobile, Lahore.', keywords: 'mobile shop lahore, laptop shop, iphone price, mobile repair' },
      commerce: { show_prices: 1, allow_orders: 1, cod_enabled: 1, bank_transfer_enabled: 1, wallet_enabled: 1, delivery_fee: 250, free_delivery_above: 5000, fulfil_branch_id: 1, order_prefix: 'WEB', show_stock: 1, allow_backorder: 0, whatsapp_orders: 1, bank_details: 'Meezan Bank · Abbott Mobile · PK36MEZN0001234567890123', min_order: 500,
      jazzcash_number: '0300-1234567', easypaisa_number: '0345-7654321', wallet_account_name: 'Abbott Mobile' },
      repair_booking: { enabled: 1, intro: 'Tell us what is wrong with your device and we will call you back with a quote within an hour.', device_types: ['mobile', 'tablet', 'laptop', 'desktop', 'smartwatch'], show_prices: 1 },
    },
    pages: [
      { id: 1, slug: 'about', title: 'About Us', content_html: '<h2>Who we are</h2><p>Abbott Mobile is a family-run mobile and laptop store in Lahore with two branches and a dedicated repair lab.</p><h3>What we do</h3><ul><li>Genuine smartphones, tablets and smartwatches</li><li>New and refurbished laptops with warranty</li><li>Accessories, spare parts and components</li><li>Mobile and laptop repairs with same-day service</li></ul>', is_published: 1, show_in_menu: 1, sort_order: 1, updated_at: at(20) },
      { id: 2, slug: 'warranty-policy', title: 'Warranty Policy', content_html: '<h2>Warranty</h2><p>New phones carry the official brand warranty. Refurbished laptops carry a 3-month Abbott Mobile warranty covering hardware faults. Repairs carry a 7-day (mobile) or 15-day (laptop) warranty on the repaired fault only.</p><p>Physical or liquid damage is not covered. Keep your invoice: the IMEI / serial number on it must match the device.</p>', is_published: 1, show_in_menu: 0, sort_order: 2, updated_at: at(20) },
      { id: 3, slug: 'return-policy', title: 'Return & Refund Policy', content_html: '<h2>Returns</h2><p>Accessories can be returned unused within 7 days with the original packing. Devices are exchanged only for manufacturing defects reported within 7 days. Online orders paid by bank transfer are refunded within 3 working days.</p>', is_published: 1, show_in_menu: 0, sort_order: 3, updated_at: at(20) },
      { id: 4, slug: 'faq', title: 'FAQs', content_html: '<h2>Frequently asked questions</h2><h4>Are your phones PTA approved?</h4><p>Yes, every phone we sell is PTA approved and comes with an official invoice.</p><h4>Do you deliver outside Lahore?</h4><p>Yes, nationwide through courier in 2–3 working days.</p><h4>How long does a screen replacement take?</h4><p>Most mobile screen replacements are done the same day; laptop screens in 1–2 days depending on part availability.</p>', is_published: 1, show_in_menu: 1, sort_order: 4, updated_at: at(10) },
      { id: 5, slug: 'privacy', title: 'Privacy Policy', content_html: '<h2>Privacy</h2><p>We only use your contact details to process orders and repair jobs. We never sell your data.</p>', is_published: 0, show_in_menu: 0, sort_order: 5, updated_at: at(5) },
      // Example of a built page: text plus widgets (banner, product grids, call to action).
      // Edit it in Website & CMS → Pages → Sections.
      {
        id: 6, slug: 'hot-sale', title: 'Hot Sale', is_published: 1, show_in_menu: 1, sort_order: 6, updated_at: at(1),
        content_html: '<p>Our best prices of the season on phones, laptops and accessories — while stocks last. Every device still comes with its full warranty and a printed invoice.</p>',
        blocks: [
          { id: 1, type: 'banner', title: 'Up to 20% off this week', subtitle: 'Selected smartphones, laptops and accessories', link: 'products.html', cta_text: 'Shop the sale', color: '#e11d48', image: '', sort_order: 1 },
          { id: 2, type: 'products', title: 'Hand-picked deals', subtitle: 'Chosen by our team', mode: 'pick', product_ids: [1, 4, 7, 27], category_id: '', tag: '', limit: 8, sort_order: 2 },
          { id: 3, type: 'products', title: 'Laptops on offer', subtitle: 'Business-class machines, tested and warrantied', mode: 'category', category_id: '4', product_ids: [], tag: '', limit: 4, sort_order: 3 },
          { id: 4, type: 'cta', title: 'Not sure which one to pick?', subtitle: 'Message us — we will recommend the right device for your budget.', link: 'contact.html', cta_text: 'Ask our team', sort_order: 4 },
          { id: 5, type: 'richtext', title: 'Sale terms', html: '<p>Sale prices are valid while stocks last and cannot be combined with other discounts. Warranty and return policy apply as normal.</p>', sort_order: 5 },
        ],
      },
    ],
    menu: [
      { id: 1, label: 'Home', url: 'index.html', sort_order: 1, is_active: 1 },
      { id: 2, label: 'Shop', url: 'products.html', sort_order: 2, is_active: 1 },
      { id: 3, label: 'Laptops', url: 'products.html?category=4', sort_order: 3, is_active: 1 },
      { id: 4, label: 'Repairs', url: 'repair.html', sort_order: 4, is_active: 1 },
      { id: 5, label: 'About', url: 'page.html?slug=about', sort_order: 5, is_active: 1 },
      { id: 6, label: 'Contact', url: 'contact.html', sort_order: 6, is_active: 1 },
    ],
    banners: [
      { id: 1, title: 'iPhone 15 Series', subtitle: 'Now in stock — PTA approved with official warranty', image: null, link: 'products.html?category=1', color: '#0b1a3a', is_active: 1, sort_order: 1 },
      { id: 2, title: 'Business-class laptops', subtitle: 'Refurbished Dell, HP & Lenovo with 3-month warranty', image: null, link: 'products.html?category=4', color: '#0f766e', is_active: 1, sort_order: 2 },
      { id: 3, title: 'Same-day repairs', subtitle: 'Screens, batteries, charging ports & software — book online', image: null, link: 'repair.html', color: '#7c3aed', is_active: 1, sort_order: 3 },
    ],
    testimonials: [
      { id: 1, name: 'Ayesha S.', text: 'Got my iPhone screen replaced in two hours with a genuine part. Great service and fair price.', rating: 5, is_active: 1 },
      { id: 2, name: 'Bilal Computers', text: 'We buy refurbished laptops in bulk from Abbott — consistent quality and honest grading.', rating: 5, is_active: 1 },
      { id: 3, name: 'Hassan M.', text: 'Ordered a Galaxy A55 online, delivered the same evening with a proper invoice.', rating: 4, is_active: 1 },
    ],
  };

  const online_orders = [];
  const orderDefs = [
    { days: 9, status: 'delivered', method: 'cod', name: 'Hassan Mehmood', phone: '0321-4455667', city: 'Lahore', items: [[5, 1], [18, 1]] },
    { days: 8, status: 'delivered', method: 'jazzcash', name: 'Nadia Farooq', phone: '0333-2233445', city: 'Lahore', items: [[24, 2], [23, 2]] },
    { days: 6, status: 'cancelled', method: 'cod', name: 'Ali Raza', phone: '0300-9988776', city: 'Faisalabad', items: [[11, 1]], note: 'Customer unreachable' },
    { days: 5, status: 'delivered', method: 'bank_transfer', name: 'Bilal Computers (Wholesale)', phone: '0345-1122334', city: 'Lahore', items: [[27, 1], [41, 2]] },
    { days: 3, status: 'out_for_delivery', method: 'cod', name: 'Maryam Khan', phone: '0312-5566778', city: 'Lahore', items: [[7, 1], [22, 1]] },
    { days: 2, status: 'packed', method: 'easypaisa', name: 'Zeeshan Ahmed', phone: '0301-6677889', city: 'Islamabad', items: [[21, 1]] },
    { days: 1, status: 'confirmed', method: 'cod', name: 'Adeel Shafiq', phone: '0322-7788990', city: 'Lahore', items: [[30, 1]] },
    { days: 0, status: 'pending', method: 'cod', name: 'Sara Imran', phone: '0333-8899001', city: 'Lahore', items: [[6, 1], [25, 2], [23, 1]] },
    { days: 0, status: 'pending', method: 'jazzcash', name: 'Usman Ghani', phone: '0345-9900112', city: 'Sialkot', items: [[26, 1]] },
  ];
  orderDefs.forEach((o, i) => {
    const id = i + 1;
    const when = at(o.days, between(9, 21), between(0, 59));
    const items = o.items.map(([pid, q]) => { const p = products.find((x) => x.id === pid); return { product_id: pid, name: [p.name, p.variant, p.color].filter(Boolean).join(' · '), quantity: q, unit_price: p.retail_price, total: round2(p.retail_price * q) }; });
    const subtotal = round2(items.reduce((s, x) => s + x.total, 0));
    const delivery = subtotal >= cms.site.commerce.free_delivery_above ? 0 : cms.site.commerce.delivery_fee;
    const custMatch = customers.find((c) => c.name === o.name);
    online_orders.push({ id, order_no: `WEB-ON-${pad(id)}`, status: o.status, payment_method: o.method, payment_status: o.status === 'delivered' || ['jazzcash', 'easypaisa', 'bank_transfer'].includes(o.method) && o.status !== 'cancelled' && o.status !== 'pending' ? 'paid' : 'unpaid', payment_reference: o.method === 'cod' ? '' : `TRX-${between(100000, 999999)}`,
      customer: { name: o.name, phone: o.phone, email: '', address: pick(['House 12, Street 4, Model Town', 'Flat 3B, Gulberg Heights', '45-C, DHA Phase 5', 'Shop 8, Main Market']), city: o.city, notes: o.note || '' }, customer_id: custMatch ? custMatch.id : null,
      items, subtotal, delivery_fee: delivery, discount: 0, total: round2(subtotal + delivery), branch_id: 1, sale_id: null, source: 'website',
      status_log: [{ status: 'pending', at: when, by: null }].concat(o.status !== 'pending' ? [{ status: o.status, at: at(Math.max(0, o.days - 1), 12, 0), by: 3 }] : []),
      internal_notes: '', created_at: when, updated_at: when });
    // a prepaid order marked paid in the demo was checked by staff (the reference matched the wallet / bank)
    const o2 = online_orders[online_orders.length - 1];
    if (o2.payment_status === 'paid' && o.method !== 'cod') { o2.payment_verified_at = at(Math.max(0, o.days - 1), 11, 30); o2.payment_verified_by = 3; }
  });
  // fill in the email + account link for orders placed by customers who have a website login
  online_orders.forEach((o) => {
    const c = customers.find((x) => x.has_account && x.name === o.customer.name);
    if (!c) return;
    o.customer.email = c.email;
    o.customer_id = c.id;
    o.invoice_emailed_at = o.created_at;
  });

  // -------------------------------------------------- supplier returns
  // Faulty units go back to whoever supplied them. A defective unit has already left branch_stock,
  // so a return only changes its status; the credit note reduces what we owe that supplier.
  const supplier_returns = [];
  const supplier_return_items = [];
  {
    let srId = 1, sriId = 1;
    // mark a few purchased units defective so there is something to send back
    const faulty = [];
    [[4, 1], [11, 1], [7, 1]].forEach(([productId, branchIdx]) => {
      const branchId = branchIdx || 1;
      const unit = product_imeis.find((i) => i.product_id === productId && i.branch_id === branchId && i.status === 'available');
      if (!unit) return;
      unit.status = 'defective';
      unit.notes = pick(['Dead pixels out of the box', 'Will not power on', 'Battery swollen on arrival']);
      unit.updated_at = at(between(8, 20), 11, 0);
      const row = stockRow(branchId, productId); row.quantity -= 1;
      move(branchId, productId, 'defective', -1, unit.cost_price, null, null, unit, unit.updated_at, branchId === 1 ? 2 : 4);
      faulty.push(unit);
    });

    const mkReturn = (supplierId, branchId, days, status, resolution, units, nonSerial) => {
      const branch = branches.find((b) => b.id === branchId);
      const id = srId++;
      const when = at(days, 12, 0);
      const r = {
        id, return_no: `SRT-${branch.code}-${pad(id)}`, branch_id: branchId, supplier_id: supplierId,
        purchase_id: null, return_date: dateOnly(days), status, resolution,
        reason: pick(['Faulty on arrival', 'Failed within warranty', 'Damaged in transit']),
        subtotal: 0, credit_amount: 0, notes: '', created_by: branchId === 1 ? 2 : 4,
        created_at: when, sent_at: status === 'draft' ? null : at(Math.max(0, days - 1), 10, 0),
        completed_at: status === 'completed' ? at(Math.max(0, days - 3), 15, 0) : null,
      };
      let subtotal = 0;
      (units || []).forEach((unit) => {
        supplier_return_items.push({
          id: sriId++, return_id: id, product_id: unit.product_id, imei_id: unit.id,
          quantity: 1, unit_cost: unit.cost_price, total: unit.cost_price,
          condition: 'defective', resolution_note: '', replacement_imei_id: null,
        });
        subtotal += unit.cost_price;
        if (status !== 'draft') { unit.status = 'returned_to_supplier'; unit.updated_at = r.sent_at; }
      });
      (nonSerial || []).forEach(([productId, qty]) => {
        const p = products.find((x) => x.id === productId);
        if (!p) return;
        supplier_return_items.push({
          id: sriId++, return_id: id, product_id: productId, imei_id: null,
          quantity: qty, unit_cost: p.cost_price, total: round2(p.cost_price * qty),
          condition: 'damaged', resolution_note: '', replacement_imei_id: null,
        });
        subtotal += p.cost_price * qty;
        if (status !== 'draft') {
          const row = stockRow(branchId, productId);
          row.quantity = Math.max(0, row.quantity - qty);
          move(branchId, productId, 'supplier_return', -qty, p.cost_price, 'supplier_return', id, null, r.sent_at, r.created_by);
        }
      });
      r.subtotal = round2(subtotal);
      if (status === 'completed' && resolution !== 'replacement') {
        r.credit_amount = r.subtotal;
        const supplier = suppliers.find((s) => s.id === supplierId);
        supplier.balance = round2(supplier.balance - r.credit_amount);
        supplier_transactions.push({
          id: stxId++, supplier_id: supplierId, branch_id: branchId, type: 'return',
          reference_type: 'supplier_return', reference_id: id, debit: r.credit_amount, credit: 0,
          balance_after: supplier.balance, payment_method: null, payment_reference: null,
          notes: `Credit note for ${r.return_no}`, created_by: r.created_by, created_at: r.completed_at,
        });
      }
      supplier_returns.push(r);
    };

    if (faulty[0]) mkReturn(2, faulty[0].branch_id, 16, 'completed', 'credit_note', [faulty[0]], []);
    if (faulty[1]) mkReturn(3, faulty[1].branch_id, 6, 'sent', 'replacement', [faulty[1]], [[19, 3]]);
    if (faulty[2]) mkReturn(2, faulty[2].branch_id, 1, 'draft', 'credit_note', [faulty[2]], []);
  }

  // ---------------------------------------------------------- stock takes
  // A physical count freezes what the system thinks it has, records what the shelf actually holds and
  // posts the difference. A completed count has already moved stock (count_in / count_out movements).
  const stock_counts = [];
  const stock_count_items = [];
  {
    let scId = 1, sciId = 1;
    const countable = (branchId, ids) => ids.map((id) => products.find((p) => p.id === id)).filter(Boolean)
      .map((p) => ({ product: p, expected: (branch_stock.find((s) => s.branch_id === branchId && s.product_id === p.id) || {}).quantity || 0 }));

    const mkCount = (def) => {
      const branch = branches.find((b) => b.id === def.branch);
      const id = scId++;
      const when = at(def.days, 9, 30);
      const user = def.branch === 1 ? 2 : 4;
      const count = {
        id, count_no: `CNT-${branch.code}-${pad(id)}`, branch_id: def.branch, count_date: dateOnly(def.days),
        scope: def.scope, scope_id: def.scope_id || null, scope_label: def.scope_label,
        status: def.status, notes: def.notes || '', created_by: user, counted_by: user,
        items_total: 0, counted_items: 0, variance_qty: 0, variance_value: 0, gain_value: 0, loss_value: 0,
        created_at: when, started_at: when,
        completed_at: def.status === 'completed' ? at(def.days, 13, 45) : null,
        cancelled_at: def.status === 'cancelled' ? at(def.days, 11, 0) : null,
      };
      let counted = 0, varianceQty = 0, varianceValue = 0, gain = 0, loss = 0;
      countable(def.branch, def.items).forEach((row, idx) => {
        const p = row.product;
        const delta = (def.deltas || {})[p.id];
        const isCounted = def.status === 'completed' || (def.counted || 0) > idx;
        const countedQty = isCounted ? Math.max(0, row.expected + (delta || 0)) : null;
        const variance = isCounted ? countedQty - row.expected : 0;
        const cost = p.cost_price;
        const item = {
          id: sciId++, count_id: id, product_id: p.id, serialized: p.is_serialized ? 1 : 0,
          expected_qty: row.expected, counted_qty: countedQty, unit_cost: cost,
          variance_qty: variance, variance_value: round2(variance * cost),
          scanned: [], missing_ids: [], extra_serials: [],
          notes: variance ? (variance > 0 ? 'Extra stock found behind the display' : 'Recounted twice, still short') : '',
          counted_at: isCounted ? at(def.days, 11, 15) : null, counted_by: isCounted ? user : null,
        };
        stock_count_items.push(item);
        if (isCounted) {
          counted++;
          varianceQty += variance;
          varianceValue += item.variance_value;
          if (variance > 0) gain += item.variance_value; else loss += item.variance_value;
        }
        // a completed count has already posted its variance to stock
        if (def.status === 'completed' && variance !== 0) {
          const stockRowRef = stockRow(def.branch, p.id);
          if (p.is_serialized && variance < 0) {
            // the units the count could not find are written off the shelf but stay on record
            for (let n = 0; n < -variance; n++) {
              const unit = product_imeis.find((u) => u.product_id === p.id && u.branch_id === def.branch && u.status === 'available');
              if (!unit) break;
              unit.status = 'missing';
              unit.notes = `Not found during ${count.count_no}`;
              unit.updated_at = count.completed_at;
              stockRowRef.quantity = Math.max(0, stockRowRef.quantity - 1);
              move(def.branch, p.id, 'count_out', -1, unit.cost_price, 'stock_count', id, unit, count.completed_at, user);
              item.missing_ids.push(unit.id);
            }
          } else {
            stockRowRef.quantity = Math.max(0, stockRowRef.quantity + variance);
            move(def.branch, p.id, variance > 0 ? 'count_in' : 'count_out', variance, cost, 'stock_count', id, null, count.completed_at, user);
          }
        }
      });
      count.items_total = stock_count_items.filter((i) => i.count_id === id).length;
      count.counted_items = counted;
      count.variance_qty = varianceQty;
      count.variance_value = round2(varianceValue);
      count.gain_value = round2(gain);
      count.loss_value = round2(loss);
      stock_counts.push(count);
      return count;
    };

    // last week's count: two shortages, one extra found and a phone that never turned up
    mkCount({
      branch: 1, days: 9, status: 'completed', scope: 'all', scope_label: 'Whole branch',
      notes: 'Monthly count, aisle by aisle.',
      items: [18, 19, 23, 24, 25, 20, 4], deltas: { 19: -2, 23: 3, 25: -5, 4: -1 },
    });
    // phones counted this week: the shelf is done, the display cabinet is not
    mkCount({
      branch: 1, days: 0, status: 'in_progress', scope: 'category', scope_id: 1, scope_label: 'Smartphones',
      notes: 'Quarterly device count — cabinet still to do.',
      items: [1, 2, 3, 4, 5, 6, 7, 11, 12], counted: 4, deltas: { 4: -1 },
    });
    // a branch-2 count abandoned when the shop got busy
    mkCount({
      branch: 2, days: 20, status: 'cancelled', scope: 'all', scope_label: 'Whole branch',
      notes: 'Stopped: too many walk-in customers, rescheduled.',
      items: [4, 5, 6, 18, 19, 23, 24], counted: 2,
    });
  }

  // ------------------------------------------------- website inbox
  // Messages left on shop/contact.html and newsletter sign-ups, read in the admin Inbox.
  const contact_messages = [
    { id: 1, message_no: 'MSG-ON-000001', name: 'Adnan Sheikh', phone: '0300-7788991', email: 'adnan.sheikh@gmail.com', subject: 'Bulk order for 10 phones', message: 'Assalam o alaikum. I need 10 units of Galaxy A15 for my office staff. What is your best price and can you deliver to Johar Town? Also do you give a proper invoice with warranty?', status: 'new', source: 'website', replied_at: null, notes: '', created_at: at(0, 11, 20) },
    { id: 2, message_no: 'MSG-ON-000002', name: 'Rabia Sultan', phone: '0321-4455667', email: 'rabia.sultan@outlook.com', subject: 'iPhone 13 battery service', message: 'My iPhone 13 battery drains very fast. How much do you charge for a battery replacement and how long does it take? Do you use original batteries?', status: 'new', source: 'website', replied_at: null, notes: '', created_at: at(0, 9, 5) },
    { id: 3, message_no: 'MSG-ON-000003', name: 'Junaid Akhtar', phone: '0333-1122334', email: '', subject: 'Laptop availability', message: 'Do you have any Dell Latitude with 16GB RAM in stock? I visited last week and it was sold out.', status: 'read', source: 'website', replied_at: null, notes: 'Called once, no answer. Try again in the evening.', created_at: at(1, 16, 40) },
    { id: 4, message_no: 'MSG-ON-000004', name: 'Saima Nawaz', phone: '0345-9988776', email: 'saima.n@gmail.com', subject: 'Order not received', message: 'I placed an order three days ago and I have not received any call. Order number is WEB-ON-000005. Please check.', status: 'replied', source: 'website', replied_at: at(2, 12, 15), notes: 'Courier was delayed, customer informed and order delivered.', created_at: at(3, 10, 0) },
    { id: 5, message_no: 'MSG-ON-000005', name: 'Hamza Iqbal', phone: '0301-2233445', email: 'hamza@techzone.pk', subject: 'Reseller partnership', message: 'We run a small shop in Gujranwala and would like to buy accessories from you on wholesale. Please share your rate list.', status: 'replied', source: 'website', replied_at: at(5, 15, 30), notes: 'Rate list sent on WhatsApp.', created_at: at(6, 13, 20) },
    { id: 6, message_no: 'MSG-ON-000006', name: 'Test Visitor', phone: '0300-0000000', email: 'spam@example.com', subject: '', message: 'Increase your website traffic now! Click here for SEO services.', status: 'archived', source: 'website', replied_at: null, notes: 'Spam.', created_at: at(9, 3, 10) },
  ];
  const newsletter_subscribers = [
    { id: 1, email: 'adnan.sheikh@gmail.com', source: 'website', is_active: 1, created_at: at(0, 11, 22) },
    { id: 2, email: 'rabia.sultan@outlook.com', source: 'website', is_active: 1, created_at: at(2, 18, 5) },
    { id: 3, email: 'hassan@example.com', source: 'website', is_active: 1, created_at: at(8, 14, 0) },
    { id: 4, email: 'maryam@example.com', source: 'website', is_active: 1, created_at: at(12, 19, 30) },
    { id: 5, email: 'kashif.rana@gmail.com', source: 'website', is_active: 1, created_at: at(18, 10, 45) },
    { id: 6, email: 'old.address@yahoo.com', source: 'website', is_active: 0, created_at: at(40, 9, 0) },
  ];

  // Emails the website has sent (no mail server in the prototype — see SHOP.sendEmail)
  const email_outbox = online_orders.filter((o) => o.customer.email).map((o, i) => ({
    id: i + 1, to: o.customer.email, subject: `Your invoice ${o.order_no} — Abbott Mobile`,
    body_html: '', template: 'order_invoice', reference_type: 'online_order', reference_id: o.id,
    status: 'sent', source: 'website', created_at: o.created_at,
  }));

  const repair_requests = [
    { id: 1, name: 'Kamran Latif', phone: '0300-4455667', email: '', device_type: 'laptop', brand: 'HP', model: 'Pavilion 15', problem: 'Laptop turns on but screen stays black', preferred_date: dateOnly(-1), preferred_branch_id: 1, status: 'new', job_id: null, notes: '', created_at: at(0, 9, 40) },
    { id: 2, name: 'Sadia Butt', phone: '0333-9988776', email: 'sadia@gmail.com', device_type: 'mobile', brand: 'Samsung', model: 'Galaxy S21', problem: 'Cracked back glass and camera lens', preferred_date: dateOnly(0), preferred_branch_id: 2, status: 'contacted', job_id: null, notes: 'Quoted Rs 6,500, customer will visit tomorrow', created_at: at(1, 15, 10) },
    { id: 3, name: 'Imran Baig', phone: '0321-1231234', email: '', device_type: 'mobile', brand: 'Apple', model: 'iPhone 13', problem: 'Screen cracked', preferred_date: dateOnly(18), preferred_branch_id: 1, status: 'converted', job_id: 1, notes: '', created_at: at(19, 11, 0) },
  ];

  // ---------------------------------------------------------- roles & permissions
  // users.role holds a role key. Super Admin is the one locked, full-access role; the other three are the
  // shop's starting roles and can be edited (or copied into new ones) from Roles & Permissions.
  const crud = (mod, acts) => acts.split(',').map((a) => mod + '.' + a.trim());
  const roles = [
    { id: 1, key: 'super_admin', name: 'Super Admin', color: 'purple', is_system: 1, sort: 0,
      description: 'Owner access: every branch, every screen, every action. Always has full access.', permissions: [] },
    { id: 2, key: 'branch_manager', name: 'Branch Manager', color: 'navy', is_system: 1, sort: 1,
      description: 'Runs one branch: selling, stock, buying, cash and the branch team.',
      permissions: [].concat(
        crud('dashboard', 'view'), crud('pos', 'view'), crud('sales', 'view,delete,export,print,all'), crud('returns', 'view,add,export'),
        crud('customers', 'view,add,edit,delete,export,payments'),
        crud('repairs', 'view,add,edit,delete,export,assign,deliver,work'),
        crud('orders', 'view,edit,export'), crud('messages', 'view,edit,delete,export'), crud('website', 'view,edit'),
        crud('products', 'view,add,edit,delete,export'), crud('categories', 'view,add,edit,delete,export'), crud('imei', 'view,add,edit,delete,export'),
        crud('inventory', 'view,edit,export,approve'), crud('stocktake', 'view,add,edit,delete,export'),
        crud('transfers', 'view,add,delete,export,approve,ship,receive'),
        crud('purchase_orders', 'view,add,edit,delete,export'), crud('purchases', 'view,add,delete,export'),
        crud('suppliers', 'view,add,edit,delete,export,payments'), crud('supplier_returns', 'view,add,edit,delete,export'),
        crud('expenses', 'view,add,edit,delete,export'), crud('shifts', 'view,add,edit,export,all'),
        crud('banking', 'view,add,edit,delete,export'), crud('cheques', 'view,add,edit,delete,export'),
        crud('closing', 'view,edit,export'), crud('reports', 'view,export'), crud('users', 'view'), crud('audit', 'view,export')) },
    { id: 3, key: 'cashier', name: 'Cashier', color: 'slate', is_system: 1, sort: 2,
      description: 'Counter sales: the POS, their own cash drawer, customers and repair drop-offs.',
      permissions: [].concat(
        crud('pos', 'view'), crud('sales', 'view,print'), crud('customers', 'view,add'),
        crud('repairs', 'view,add,deliver'), crud('orders', 'view,edit'), crud('messages', 'view,edit'), crud('shifts', 'view,add,edit')) },
    { id: 4, key: 'technician', name: 'Technician', color: 'green', is_system: 1, sort: 3,
      description: 'Repair bench: their own and unassigned jobs, parts lookup, customer drop-offs.',
      permissions: [].concat(crud('repairs', 'view,add,edit,work'), crud('customers', 'view,add'), crud('products', 'view'), crud('inventory', 'view')) },
  ].map((r) => ({ ...r, created_by: 1, created_at: at(200, 9, 0) }));

  // ------------------------------------------------ card & wallet settlements
  // Money taken by card, JazzCash, EasyPaisa or bank transfer never sat in a drawer: it settled into the
  // bank or wallet account of the branch that took it — one settlement per branch, method and day, the way
  // a card machine or wallet pays out. Supplier bills and expenses paid by transfer left the branch's
  // current account. Every source row keeps the bank row's id as bank_txn_id (see ABM.bank.receive).
  {
    const NON_CASH = ['card', 'jazzcash', 'easypaisa', 'bank_transfer'];
    const dayOf = (s) => String(s || '').slice(0, 10);
    const daysAgo = (day) => Math.round((today - new Date(day + 'T00:00:00')) / 86400000);
    const groups = new Map();
    const collect = (branch, stamp, method, amount, row) => {
      if (!NON_CASH.includes(method) || !(amount > 0)) return;
      const day = dayOf(stamp), key = branch + '|' + day + '|' + method;
      const g = groups.get(key) || { branch, day, method, amount: 0, rows: [] };
      g.amount = round2(g.amount + amount); g.rows.push(row); groups.set(key, g);
    };
    const saleById = new Map(sales.map((s) => [s.id, s]));
    sale_payments.forEach((p) => { const s = saleById.get(p.sale_id); if (s && s.status !== 'void') collect(s.branch_id, p.created_at || s.sale_date, p.method, Number(p.amount) || 0, p); });
    customer_transactions.forEach((t) => { if (t.type === 'payment' && Number(t.credit) > 0 && !t.sale_payment_id) collect(t.branch_id, t.created_at, t.payment_method, Number(t.credit), t); });
    const jobById = new Map(repair_jobs.map((j) => [j.id, j]));
    repair_payments.forEach((p) => { const j = jobById.get(p.job_id); if (j) collect(j.branch_id, p.created_at, p.method, Number(p.amount) || 0, p); });
    const LABEL = { card: 'Card settlement', jazzcash: 'JazzCash payout', easypaisa: 'EasyPaisa payout', bank_transfer: 'Transfers received' };
    [...groups.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.branch - b.branch)).forEach((g) => {
      const txn = bankPost(settleInto[g.method](g.branch), {
        type: 'receipt', amount: g.amount, date: g.day, days: daysAgo(g.day), hour: 20, method: g.method,
        reference: LABEL[g.method] + ' ' + g.day, refType: 'settlement', notes: g.rows.length + ' payment' + (g.rows.length === 1 ? '' : 's') + ' · branch ' + g.branch, branch: g.branch,
      });
      g.rows.forEach((r) => { r.bank_txn_id = txn.id; });
    });
    // what we paid by transfer left the branch's current account
    const payOut = (branch, stamp, method, amount, row, reference, party, refType, refId) => {
      if (!NON_CASH.includes(method) || !(amount > 0)) return;
      const day = dayOf(stamp);
      const txn = bankPost(settleInto[method](branch), { type: 'payment', amount, date: day, days: daysAgo(day), hour: 15, method, reference, party, refType, refId, branch });
      row.bank_txn_id = txn.id;
    };
    supplier_transactions.forEach((t) => { if (t.type === 'payment' && Number(t.debit) > 0) payOut(t.branch_id, t.created_at, t.payment_method, Number(t.debit), t, t.payment_reference || 'Supplier payment', (suppliers.find((s) => s.id === t.supplier_id) || {}).name || '', 'supplier_transaction', t.id); });
    expenses.forEach((e) => payOut(e.branch_id, e.expense_date + 'T12:00:00', e.payment_method, Number(e.amount) || 0, e, e.reference || e.description, '', 'expense', e.id));
    // never let an account dip below zero on any day: top its opening balance up by the deepest dip
    bank_accounts.forEach((acc) => {
      const rows = bank_transactions.filter((t) => t.account_id === acc.id).sort((a, b) => (String(a.txn_date) + '|' + String(a.id).padStart(8, '0') < String(b.txn_date) + '|' + String(b.id).padStart(8, '0') ? -1 : 1));
      let run = 0, low = 0;
      rows.forEach((t) => { run = round2(run + t.signed); low = Math.min(low, run); });
      if (low >= 0) return;
      const bump = Math.ceil((-low + 250000) / 100000) * 100000;
      const opening = rows.find((t) => t.type === 'opening');
      if (opening) { opening.amount = round2(opening.amount + bump); opening.signed = round2(opening.signed + bump); }
      acc.opening_balance = round2((acc.opening_balance || 0) + bump);
      acc.balance = round2(acc.balance + bump);
    });
  }

  // The blocks above write ledger rows in the order they were generated, not the order they happened
  // (a purchase from 43 days ago can be written after one from 42 days ago). Replay every ledger in
  // date order so each balance_after is the true running balance on that date.
  const restamp = (rows, partyKey, sortKey, delta) => {
    const byParty = {};
    rows.forEach((r) => { (byParty[r[partyKey]] = byParty[r[partyKey]] || []).push(r); });
    Object.values(byParty).forEach((list) => {
      let run = 0;
      list.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1)).forEach((r) => { run = round2(run + delta(r)); r.balance_after = run; });
    });
  };
  const stamp = (t) => String(t.created_at) + '|' + String(t.id).padStart(8, '0');
  restamp(customer_transactions, 'customer_id', stamp, (t) => (Number(t.debit) || 0) - (Number(t.credit) || 0));
  restamp(supplier_transactions, 'supplier_id', stamp, (t) => (Number(t.credit) || 0) - (Number(t.debit) || 0));
  restamp(bank_transactions, 'account_id', (t) => String(t.txn_date) + '|' + String(t.id).padStart(8, '0'), (t) => Number(t.signed) || 0);

  return {
    cms, online_orders, repair_requests, email_outbox, contact_messages, newsletter_subscribers,
    supplier_returns, supplier_return_items, stock_counts, stock_count_items,
    branches, users, categories, brands, products, branch_stock, product_imeis, stock_movements,
    suppliers, purchases, purchase_items, purchase_orders, purchase_order_items, supplier_transactions,
    customers, customer_transactions, sales, sale_items, sale_payments, sale_returns, sale_return_items,
    stock_transfers, transfer_items, expense_categories, expenses, daily_closings, cashier_shifts, cash_movements,
    bank_accounts, bank_transactions, cheques, roles, audit_logs, settings,
    repair_jobs, repair_items, repair_payments, repair_status_log,
  };
};
