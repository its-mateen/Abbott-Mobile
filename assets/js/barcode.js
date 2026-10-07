/* ==========================================================================
   Abbott Mobile - barcode rendering (no dependencies, prints as crisp SVG)

   ABM.barcode.svg(value, opts)   -> <svg> markup, picking the symbology itself
   ABM.barcode.ean13(digits)      -> { modules: '101…', text, ok, error }
   ABM.barcode.code39(value)      -> { modules: '1101…', text, ok, error }
   ABM.barcode.code128(value)     -> { modules, text, ok, error, codes: [start, …, check, stop] }
   ABM.barcode.checkDigitEan13(d) -> the 13th digit for 12 digits

   EAN-13 is used when the value is 12 or 13 digits (product barcodes in this
   database are EAN-13). Anything else - SKUs, IMEIs, serial numbers - is drawn
   as Code 39 unless a symbology is asked for. IMEI / serial labels ask for
   Code 128 ({ symbology: 'code128' }): a 15-digit IMEI is 134 modules in
   Code 128 against 271 in Code 39, so it fits a 38 mm sticker at a printable
   bar width. Always test-scan a sheet before a production print run.
   ========================================================================== */
window.ABM = window.ABM || {};
(function () {
  'use strict';

  /* ------------------------------------------------------------------ EAN-13
   * 95 modules: 3 guard + 6x7 left + 5 centre + 6x7 right + 3 guard.
   * Only the L set and the parity table are data; G is R reversed and R is L inverted.
   */
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const invert = (s) => s.split('').map((c) => (c === '1' ? '0' : '1')).join('');
  const reverse = (s) => s.split('').reverse().join('');
  const R = L.map(invert);
  const G = R.map(reverse);
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

  function checkDigitEan13(twelve) {
    const d = String(twelve).replace(/\D/g, '').slice(0, 12);
    if (d.length !== 12) return null;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10;
  }

  function ean13(value) {
    const raw = String(value || '').replace(/\D/g, '');
    if (raw.length !== 12 && raw.length !== 13) return { ok: false, error: 'EAN-13 needs 12 or 13 digits.', modules: '', text: raw };
    const base = raw.slice(0, 12);
    const check = checkDigitEan13(base);
    if (raw.length === 13 && Number(raw[12]) !== check) {
      return { ok: false, error: `Check digit should be ${check}, not ${raw[12]}.`, modules: '', text: raw };
    }
    const digits = base + String(check);
    const parity = PARITY[Number(digits[0])];
    let modules = '101';                                  // start guard
    for (let i = 1; i <= 6; i++) modules += (parity[i - 1] === 'L' ? L : G)[Number(digits[i])];
    modules += '01010';                                   // centre guard
    for (let i = 7; i <= 12; i++) modules += R[Number(digits[i])];
    modules += '101';                                     // end guard
    return { ok: true, error: '', modules, text: digits, symbology: 'EAN-13' };
  }

  /* ----------------------------------------------------------------- Code 39
   * Every character is 9 elements (bar/space alternating, starting with a bar),
   * three of which are wide. '1' below marks a wide element.
   */
  const C39 = {
    0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001',
    5: '100110000', 6: '001110000', 7: '000100101', 8: '100100100', 9: '001100100',
    A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000',
    F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100',
    K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010',
    P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
    U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000',
    Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100',
    $: '010101000', '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
  };
  const NARROW = 1, WIDE = 3;

  function code39(value) {
    const text = String(value || '').toUpperCase().trim();
    if (!text) return { ok: false, error: 'Nothing to encode.', modules: '', text };
    const bad = text.split('').filter((c) => !(c in C39) || c === '*');
    if (bad.length) return { ok: false, error: `Code 39 cannot encode ${[...new Set(bad)].join(' ')}.`, modules: '', text };
    let modules = '';
    ('*' + text + '*').split('').forEach((ch, idx) => {
      if (idx) modules += '0';                            // inter-character gap
      C39[ch].split('').forEach((wide, i) => {
        const width = wide === '1' ? WIDE : NARROW;
        modules += (i % 2 === 0 ? '1' : '0').repeat(width);
      });
    });
    return { ok: true, error: '', modules, text, symbology: 'Code 39' };
  }

  /* ---------------------------------------------------------------- Code 128
   * 107 symbols. Values 0-102 are data and code changes, 103-105 the start codes (A, B, C) and 106 the
   * stop. Each symbol is 6 alternating elements (bar first), 1-4 modules wide, 11 modules in all; the stop
   * has a 7th bar and is 13 modules. The bars of every symbol add up to an even number of modules.
   * Set B carries printable ASCII (value = char code - 32); set C carries a digit pair 00-99 per symbol,
   * which halves the width of a number such as an IMEI.
   */
  const C128 = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
  ];
  const C128_CODE_C = 99, C128_CODE_B = 100, C128_START_B = 104, C128_START_C = 105, C128_STOP = 106;

  /**
   * Code 128 with automatic set choice: text goes in set B, and a run of digits goes in set C (two digits per
   * symbol) when that is shorter - the whole value if it is all digits, a run of 4+ at the start or end, 6+ in
   * the middle. An odd run keeps one digit in set B (the last one when the run opens the value, else the
   * first), so set C always holds an even-length run. The check symbol is the start value plus each symbol
   * value times its position, modulo 103.
   */
  function code128(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return { ok: false, error: 'Nothing to encode.', modules: '', text, codes: [] };
    const bad = text.split('').filter((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126);
    if (bad.length) return { ok: false, error: `Code 128 cannot encode ${[...new Set(bad)].map((c) => JSON.stringify(c)).join(' ')}.`, modules: '', text, codes: [] };
    const n = text.length;
    const isDigit = (i) => i < n && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57;
    const codes = [];
    let set = null;
    const use = (want) => {
      if (set === want) return;
      codes.push(set === null ? (want === 'C' ? C128_START_C : C128_START_B) : (want === 'C' ? C128_CODE_C : C128_CODE_B));
      set = want;
    };
    let i = 0;
    while (i < n) {
      let run = 0;
      while (isDigit(i + run)) run++;
      const atStart = i === 0, atEnd = i + run === n;
      const worthC = run >= 2 && ((atStart && atEnd) || ((atStart || atEnd) && run >= 4) || run >= 6);
      if (worthC) {
        if (run % 2 === 1 && !atStart) { use('B'); codes.push(text.charCodeAt(i) - 32); i++; run--; }
        use('C');
        for (let k = 0; k < Math.floor(run / 2); k++) { codes.push(Number(text.substr(i, 2))); i += 2; }
        continue;                                           // an odd digit left over is picked up in set B
      }
      use('B');
      codes.push(text.charCodeAt(i) - 32);
      i++;
    }
    let sum = codes[0];
    for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
    codes.push(sum % 103, C128_STOP);
    let modules = '';
    codes.forEach((v) => { C128[v].split('').forEach((w, j) => { modules += (j % 2 === 0 ? '1' : '0').repeat(Number(w)); }); });
    return { ok: true, error: '', modules, text, codes, symbology: 'Code 128' };
  }

  /** Pick the symbology the value actually fits. */
  function encode(value, opts) {
    const o = opts || {};
    const raw = String(value == null ? '' : value).trim();
    if (o.symbology === 'code39') return code39(raw);
    if (o.symbology === 'code128') return code128(raw);
    if (o.symbology === 'ean13') return ean13(raw);
    const digits = raw.replace(/\D/g, '');
    if ((digits.length === 12 || digits.length === 13) && digits === raw) return ean13(raw);
    return code39(raw);
  }

  /** Width in mm of a symbol: modules × module width, plus `quiet` blank modules on each side. */
  function measure(value, opts) {
    const o = Object.assign({ moduleWidth: 0.33, quiet: 0 }, opts || {});
    const res = encode(value, o);
    if (!res.ok) return { ok: false, error: res.error, modules: 0, moduleWidth: 0, width: 0 };
    const quiet = Math.max(0, Number(o.quiet) || 0);
    const count = res.modules.length + 2 * quiet;
    let mw = Number(o.moduleWidth) || 0.33;
    if (o.maxWidth > 0) mw = Math.min(mw, Number(o.maxWidth) / count);
    return { ok: true, symbology: res.symbology, modules: res.modules.length, quiet, moduleWidth: mw, width: count * mw };
  }

  /**
   * SVG for a barcode. Width is in millimetres so a printed label is the size it says.
   * opts: { height (mm), moduleWidth (mm), maxWidth (mm), quiet (blank modules each side), showText, symbology, className }
   */
  function svg(value, opts) {
    const o = Object.assign({ height: 12, moduleWidth: 0.33, showText: true, className: '', quiet: 0 }, opts || {});
    const res = encode(value, o);
    if (!res.ok) {
      return `<svg class="${o.className}" role="img" aria-label="No barcode" viewBox="0 0 60 ${o.height + 4}" style="width:60mm;max-width:100%;height:${(o.height + 4).toFixed(2)}mm">`
        + `<text x="30" y="${(o.height + 4) / 2}" text-anchor="middle" dominant-baseline="middle" font-size="4" fill="#b91c1c">${esc(res.error)}</text></svg>`;
    }
    // narrow the modules rather than let the symbol stretch: an SVG sized at 100% width scales its
    // height with it, which silently pushes everything else off a 25 mm sticker
    const quiet = Math.max(0, Number(o.quiet) || 0);
    let mw = Number(o.moduleWidth) || 0.33;
    if (o.maxWidth > 0) mw = Math.min(mw, Number(o.maxWidth) / (res.modules.length + 2 * quiet));
    const barH = Number(o.height) || 12;
    const textH = o.showText ? 3.6 : 0;
    const width = (res.modules.length + 2 * quiet) * mw;
    const x0 = quiet * mw;
    const total = barH + textH + (o.showText ? 1 : 0);
    let bars = '';
    let i = 0;
    while (i < res.modules.length) {
      if (res.modules[i] === '1') {
        let run = 1;
        while (res.modules[i + run] === '1') run++;
        bars += `<rect x="${(x0 + i * mw).toFixed(3)}" y="0" width="${(run * mw).toFixed(3)}" height="${barH}" fill="#000"/>`;
        i += run;
      } else i++;
    }
    const label = o.showText
      ? `<text x="${(width / 2).toFixed(2)}" y="${(barH + textH).toFixed(2)}" text-anchor="middle" font-family="monospace" font-size="3.2" fill="#000" letter-spacing="0.2">${esc(res.text)}</text>`
      : '';
    return `<svg class="${o.className}" role="img" aria-label="Barcode ${esc(res.text)}" viewBox="0 0 ${width.toFixed(2)} ${total.toFixed(2)}" `
      + `preserveAspectRatio="xMidYMid meet" style="width:${width.toFixed(2)}mm;max-width:100%;height:${total.toFixed(2)}mm;display:block">${bars}${label}</svg>`;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  window.ABM.barcode = { svg, measure, encode, ean13, code39, code128, checkDigitEan13, PARITY, L, G, R, C39, C128 };
})();
