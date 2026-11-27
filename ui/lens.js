/* Molecular lens (عدسة الذرة/الجزيء): animated microscopic view of the selected container. */
(function () {
  'use strict';
  const { $, el, F, sci } = U; const D = window.LABDATA; let on = false, cv, ctx, cap, raf = 0, parts = [], sig = '', lastC = null;
  const col = {}; D.ions.cations.forEach(i => col[i.key] = i.solutionColor); D.ions.anions.forEach(i => col[i.key] = i.solutionColor);
  const clear = c => !c || /rgba\(.*,0(\.0+)?\)/.test(c) || c === 'transparent';
  function ionColor(k, ch) { const c = col[k]; if (!clear(c) && c && !/^rgba\(2[0-9][0-9],2[0-9][0-9],2[0-9][0-9]/.test(c)) return c; return ch > 0 ? '#ff9b6a' : ch < 0 ? '#6ab4ff' : '#cfd8ee'; }
  function build(c) {
    const out = []; const L = Math.max(1e-6, c.volumeMl / 1000);
    const species = Object.keys(c.aq).map(k => ({ k, conc: c.aq[k] / L })).filter(s => s.conc > 1e-6).sort((a, b) => b.conc - a.conc).slice(0, 8);
    const maxC = species.length ? species[0].conc : 1;
    species.forEach(s => { const i = Chem.ionInfo(s.k); const ch = i ? i.charge : 0; const n = Math.max(2, Math.min(26, Math.round(3 + 20 * Math.sqrt(s.conc / Math.max(maxC, 1e-9)))));
      for (let j = 0; j < n; j++) out.push({ t: 'ion', k: s.k, ch, c: ionColor(s.k, ch), r: 4 + Math.min(5, Math.abs(ch) * 1.5) * (ch > 0 ? .7 : 1.1) });
    });
    for (let j = 0; j < 34; j++) out.push({ t: 'w' });
    const solids = Object.keys(c.solids).filter(k => c.solids[k].mol > 1e-7);
    solids.forEach(k => { const n = Math.max(4, Math.min(30, Math.round(6 + Math.log10(c.solids[k].mol * 1e7) * 3))); for (let j = 0; j < n; j++) out.push({ t: 's', k, c: c.solids[k].color || '#fff', i: j, n }); });
    const gases = Object.keys(c.gasCloud || {}).filter(g => c.gasCloud[g] > 1e-6); gases.forEach(g => { const sp = D.species[g + '(g)'] || {}; for (let j = 0; j < 6; j++) out.push({ t: 'g', k: g, c: sp.color && !clear(sp.color) ? sp.color : '#dfe8ff' }); });
    out.forEach((p, i) => { p.x = Math.random() * 300; p.y = Math.random() * 220; const a = Math.random() * 6.28, v = p.t === 'w' ? 28 : p.t === 'g' ? 40 : p.t === 's' ? 0 : 18; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; });
    return { parts: out, species, solids, gases };
  }
  function water(x, y, a) { ctx.fillStyle = '#3d7fd6'; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill(); ctx.fillStyle = '#e8eefc'; [0.9, -0.9].forEach(d => { ctx.beginPath(); ctx.arc(x + 4.6 * Math.cos(a + d + 1.57), y + 4.6 * Math.sin(a + d + 1.57), 1.9, 0, 7); ctx.fill(); }); }
  function frame(now) {
    if (!on) return; raf = requestAnimationFrame(frame); const o = window.Bench && Bench.selected; const W = cv.width, H = cv.height; ctx.fillStyle = '#050a18'; ctx.fillRect(0, 0, W, H);
    if (!o) { ctx.fillStyle = '#93a4c8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('اختر وعاءً من المعمل لرؤيته من الداخل', W / 2, H / 2); cap.textContent = ''; return; }
    const c = o.c; const s0 = Object.keys(c.aq).map(k => k + ':' + Math.round(Math.log10(c.aq[k] + 1e-12) * 4)).join('|') + '#' + Object.keys(c.solids).join(',') + '#' + Object.keys(c.gasCloud || {}).join(',') + '#' + Math.round(c.volumeMl / 10);
    if (c !== lastC || s0 !== sig) { lastC = c; sig = s0; const b = build(c); parts = b.parts; cap.innerHTML = ''; const info = b.species.map(s => '<span style="margin-inline-end:8px">' + F(s.k) + ' ' + sci(s.conc) + ' M</span>').join(''); cap.innerHTML = '<div style="color:#e8eefc;margin-bottom:3px">' + U.esc(o.name) + ' — ' + Math.round(c.volumeMl) + ' مل • ' + (c.tempC).toFixed(0) + ' °م</div>' + (info || 'ماء نقي تقريبًا') + (b.solids.length ? '<div>الصلب: ' + b.solids.map(k => F(k)).join('، ') + '</div>' : '') + (b.gases.length ? '<div>غاز: ' + b.gases.map(k => F(k)).join('، ') + '</div>' : ''); }
    const dt = Math.min(0.05, (now - (frame.t || now)) / 1000); frame.t = now; const T = Math.sqrt((c.tempC + 273.15) / 298.15);
    parts.forEach(p => {
      if (p.t === 's') { const cols = Math.ceil(Math.sqrt(p.n)); const gx = 40 + (p.i % cols) * 15, gy = H - 24 - Math.floor(p.i / cols) * 15; p.x = gx + (Math.random() - .5) * .6 * T; p.y = gy + (Math.random() - .5) * .6 * T; }
      else { p.x += p.vx * dt * T; p.y += p.vy * dt * T; if (Math.random() < 0.02) { p.vx += (Math.random() - .5) * 20; p.vy += (Math.random() - .5) * 20; } const top = p.t === 'g' ? 0 : 20; if (p.x < 6 || p.x > W - 6) { p.vx *= -1; p.x = Math.max(6, Math.min(W - 6, p.x)); } if (p.y < top + 4 || p.y > H - 6) { p.vy *= -1; p.y = Math.max(top + 4, Math.min(H - 6, p.y)); } }
    });
    // liquid tint
    const lk = E.appearance(c); if (lk && lk.liquid) { ctx.fillStyle = lk.liquid.color; ctx.globalAlpha = 0.18; ctx.fillRect(0, 20, W, H - 20); ctx.globalAlpha = 1; }
    parts.forEach(p => {
      if (p.t === 'w') water(p.x, p.y, now / 900 + p.x);
      else if (p.t === 'ion') { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.fillStyle = '#0a1226'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.ch > 0 ? '+' : p.ch < 0 ? '−' : '', p.x, p.y + 3); }
      else if (p.t === 's') { ctx.fillStyle = p.c; ctx.strokeStyle = '#fff6'; ctx.fillRect(p.x - 6, p.y - 6, 12, 12); ctx.strokeRect(p.x - 6, p.y - 6, 12, 12); }
      else { ctx.strokeStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.stroke(); ctx.fillStyle = p.c; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
    });
    ctx.fillStyle = '#93a4c8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('×10⁹  (تمثيل تخطيطي)', 6, 13);
  }
  function toggle() { const p = $('#lensPanel'); on = !on; p.hidden = !on; if (on) { if (!cv) { cv = el('canvas', { width: 300, height: 220 }); cap = el('div', { class: 'cap' }); p.append(cv, cap); ctx = cv.getContext('2d'); } cancelAnimationFrame(raf); lastC = null; raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf); return on; }
  window.Lens = { toggle };
})();
