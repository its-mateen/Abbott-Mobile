/* ==========================================================================
   Abbott Mobile - Global theme bootstrap + Tailwind Play CDN configuration
   --------------------------------------------------------------------------
   1. Restores the saved theme (light/dark/system + accent) BEFORE first paint.
   2. Maps Tailwind's `navy` (primary) and `slate` (neutral) palettes to CSS
      variables, so every utility class (bg-navy-800, text-slate-500, ...) follows
      the active theme defined in assets/css/app.css. Money stays emerald.
   3. Accent can be a preset (navy/indigo/violet/teal/ocean) or ANY custom colour:
      apply({ accent: 'custom', custom: '#ff6a00' }) generates a full 50–950 shade
      scale from that hex and applies it inline, so the whole software recolours.
   Public API: window.ABM_THEME (also exposed as ABM.theme in app.js)
   ========================================================================== */
(function () {
  var KEY = 'abm.theme.v1';
  // the owner's company-wide look (Settings → Appearance), used on any device where the user has not picked their own
  var COMPANY = 'abm.theme.company';
  var DEFAULTS = { mode: 'light', accent: 'navy', custom: '#1a336a' };
  var SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  function company() { try { return JSON.parse(localStorage.getItem(COMPANY) || 'null'); } catch (e) { return null; } }
  function personal() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function read() { return Object.assign({}, DEFAULTS, company() || {}, personal() || {}); }
  function resolve(mode) { if (mode === 'system') { return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; } return mode === 'dark' ? 'dark' : 'light'; }

  /* ---- colour maths: hex -> HSL -> shade scale (space-separated RGB for Tailwind alpha support) ---- */
  function hexToRgb(hex) { hex = String(hex || '').replace('#', ''); if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(hex, 16); if (isNaN(n) || hex.length !== 6) return null; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2; if (max !== min) { var d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; } h /= 6; } return [h, s, l]; }
  function hslToRgb(h, s, l) { var r, g, b; if (s === 0) { r = g = b = l; } else { var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; var f = function (t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3); } return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]; }
  function shadeScale(hex) {
    var rgb = hexToRgb(hex); if (!rgb) return null;
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]), h = hsl[0], s = Math.min(1, Math.max(0.12, hsl[1]));
    var L = { 50: 0.97, 100: 0.93, 200: 0.85, 300: 0.73, 400: 0.60, 500: 0.50, 600: 0.42, 700: 0.35, 800: 0.28, 900: 0.21, 950: 0.13 };
    var out = {};
    SHADES.forEach(function (sh) { var l = L[sh]; var sat = sh >= 800 ? s * 0.85 : sh <= 100 ? s * 0.7 : s; var c = hslToRgb(h, sat, l); out[sh] = c[0] + ' ' + c[1] + ' ' + c[2]; });
    return out;
  }
  function applyCustomScale(hex) {
    var root = document.documentElement, scale = shadeScale(hex);
    if (!scale) return false;
    SHADES.forEach(function (sh) { root.style.setProperty('--navy-' + sh, scale[sh]); });
    root.style.setProperty('--sb-from', scale[900]); root.style.setProperty('--sb-to', scale[950]); root.style.setProperty('--sb-glow', scale[300]);
    return true;
  }
  function clearCustomScale() { var root = document.documentElement; SHADES.forEach(function (sh) { root.style.removeProperty('--navy-' + sh); }); ['--sb-from', '--sb-to', '--sb-glow'].forEach(function (k) { root.style.removeProperty(k); }); }

  function apply(t, persist) {
    var root = document.documentElement;
    var mode = resolve(t.mode);
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-mode', t.mode);
    root.setAttribute('data-accent', t.accent || 'navy');
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
    if (t.accent === 'custom') { if (!applyCustomScale(t.custom)) { root.setAttribute('data-accent', 'navy'); clearCustomScale(); } } else { clearCustomScale(); }
    if (persist) { try { localStorage.setItem(KEY, JSON.stringify({ mode: t.mode, accent: t.accent, custom: t.custom })); } catch (e) { /* ignore */ } }
    try { document.dispatchEvent(new CustomEvent('abm:theme', { detail: { mode: mode, accent: t.accent, custom: t.custom } })); } catch (e) { /* ignore */ }
  }
  var current = read();
  apply(current, false);
  if (window.matchMedia) {
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { var t = read(); if (t.mode === 'system') apply(t, false); }); } catch (e) { /* older browsers */ }
  }
  window.ABM_THEME = {
    KEY: KEY,
    ACCENTS: [
      { key: 'navy', label: 'Navy', swatch: '#1a336a' },
      { key: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
      { key: 'violet', label: 'Violet', swatch: '#7c3aed' },
      { key: 'teal', label: 'Teal', swatch: '#0f766e' },
      { key: 'ocean', label: 'Ocean', swatch: '#0369a1' },
    ],
    get: read,
    /** Is the current look the user's own choice (true) or the company default (false)? */
    isPersonal: function () { return !!personal(); },
    company: company,
    /** Store the company default (app.js keeps it in sync with settings.theme_default) and re-apply. */
    setCompany: function (t) { try { if (t) localStorage.setItem(COMPANY, JSON.stringify({ mode: t.mode, accent: t.accent, custom: t.custom })); else localStorage.removeItem(COMPANY); } catch (e) { /* ignore */ } apply(read(), false); },
    /** Drop the user's own choice and follow the company default again. */
    usePersonal: function (on) { if (!on) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } apply(read(), false); } },
    isDark: function () { return document.documentElement.getAttribute('data-theme') === 'dark'; },
    apply: function (patch) { var t = Object.assign(read(), patch || {}); apply(t, true); return t; },
    toggle: function () { var t = read(); return this.apply({ mode: resolve(t.mode) === 'dark' ? 'light' : 'dark' }); },
    setCustom: function (hex) { return this.apply({ accent: 'custom', custom: hex }); },
    shadeScale: shadeScale,   // hex -> {50:'r g b', ... 950} (used by the website theme editor too)
    hexToRgb: hexToRgb,
  };
})();

var v = function (name) { return 'rgb(var(--' + name + ') / <alpha-value>)'; };
var scale = function (prefix) { var o = {}; [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach(function (s) { o[s] = v(prefix + '-' + s); }); return o; };

tailwind.config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        navy: scale('navy'),   // primary / accent — follows data-accent or a custom colour
        slate: scale('slate'), // neutral — inverts in dark mode
        surface: 'rgb(var(--surface) / <alpha-value>)',
        money: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857' },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.10)',
        pop: '0 12px 40px -12px rgb(15 23 42 / 0.30)',
        glow: '0 0 0 4px rgb(var(--navy-500) / 0.18)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.97)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .25s ease-out both', 'scale-in': 'scale-in .18s ease-out both' },
    },
  },
};
