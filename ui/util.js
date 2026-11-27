/* UI helpers: DOM, chemical formula typesetting (LTR), dialogs, toasts. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    for (const k in (attrs || {})) { const v = attrs[k]; if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v); }
    (kids || []).forEach(c => c == null || c === false ? 0 : n.append(c && c.nodeType ? c : document.createTextNode(c)));
    return n;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // "Cu(NH3)4^2+" -> Cu(NH<sub>3</sub>)<sub>4</sub><sup>2+</sup>
  function F(s) {
    if (s == null) return '';
    s = String(s); let base = s, chg = '';
    const i = s.indexOf('^'); if (i >= 0) { base = s.slice(0, i); chg = s.slice(i + 1); }
    let st = ''; const m = /(\((?:aq|s|l|g|conc)\))$/.exec(base); if (m) { st = m[1]; base = base.slice(0, -st.length); }
    base = esc(base).replace(/([A-Za-z)\]])(\d+)/g, '$1<sub>$2</sub>');
    return '<bdi class="f">' + base + (chg ? '<sup>' + esc(chg.replace('-', '−')) + '</sup>' : '') + (st ? '<span style="opacity:.7">' + st + '</span>' : '') + '</bdi>';
  }
  function FE(eq) { // whole equation
    return String(eq || '').split(' ').map(t => (t === '+' ? '+' : t === '->' ? '→' : t === '<->' ? '⇌' : F(t))).join(' ');
  }
  let toastT = null;
  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2600); }
  // fields: [{id,label,type:'number'|'select'|'range'|'text', value, min,max,step, options:[{v,t}], suffix}]
  function dialog(title, fields, okText) {
    return new Promise(resolve => {
      const dlg = $('#dialog'), body = $('#dlgBody'); $('#dlgTitle').textContent = title; body.innerHTML = ''; const inputs = {};
      (fields || []).forEach(f => {
        let inp;
        if (f.type === 'select') inp = el('select', {}, f.options.map(o => el('option', { value: o.v }, [o.t])));
        else if (f.type === 'note') { body.append(el('div', { html: f.html, class: 'fld' })); return; }
        else inp = el('input', { type: f.type || 'number', min: f.min, max: f.max, step: f.step || 'any' });
        if (f.value !== undefined) inp.value = f.value; inputs[f.id] = inp;
        const out = f.type === 'range' ? el('output', { text: inp.value }) : null; if (out) inp.addEventListener('input', () => { out.textContent = inp.value; });
        body.append(el('div', { class: 'fld' }, [el('label', { text: f.label + (f.suffix ? ' (' + f.suffix + ')' : '') }), inp, out]));
      });
      const ok = $('#dlgOk'), cancel = $('#dlgCancel'); ok.textContent = okText || 'تأكيد';
      const done = v => { dlg.hidden = true; ok.onclick = cancel.onclick = null; document.removeEventListener('keydown', key); resolve(v); };
      const key = e => { if (e.key === 'Escape') done(null); if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') ok.click(); };
      document.addEventListener('keydown', key);
      ok.onclick = () => { const out = {}; for (const k in inputs) { const f = fields.find(x => x.id === k); out[k] = (f.type === 'select' || f.type === 'text') ? inputs[k].value : parseFloat(inputs[k].value); } done(out); };
      cancel.onclick = () => done(null); dlg.hidden = false; const first = Object.values(inputs)[0]; if (first) first.focus();
    });
  }
  function download(name, text) { const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), download: name }); document.body.append(a); a.click(); a.remove(); }
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sci(x, d) { if (!(x > 0)) return '0'; const e = Math.floor(Math.log10(x)); const m = x / Math.pow(10, e); if (e >= -2 && e <= 3) return '<bdi dir="ltr">' + (+x.toPrecision(d || 2)) + '</bdi>'; return '<bdi dir="ltr">' + m.toFixed(1) + '×10' + String(e).split('').map(c => SUP[c]).join('') + '</bdi>'; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  window.U = { $, $$, el, esc, F, FE, sci, toast, dialog, download, clamp, hexToRgb };
})();
