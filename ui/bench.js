/* Bench: interactive lab table (canvas). Owns bench objects, drag/drop, pouring, heating, tools, frame loop. */
(function () {
  'use strict';
  const { $, toast, clamp } = U; const D = window.LABDATA; const E = new ReactionEngine(D); window.E = E;
  const cv = $('#bench'), ctx = cv.getContext('2d'); let W = 800, H = 500, DPR = 1, benchY = 400, S = 1;
  const B = { E, objects: [], burners: [], balances: [], selected: null, mode: null, pourSrc: null, tubeSrc: null, flameTint: null, t: 0, listeners: {}, paper: [], lastFrame: 0, running: true };
  const on = (k, f) => { (B.listeners[k] = B.listeners[k] || []).push(f); }; const emit = (k, a) => (B.listeners[k] || []).forEach(f => f(a)); B.on = on;
  const GL = {}; D.glassware.containers.forEach(g => { GL[g.id] = g; });
  let seq = 0;

  function resize() { const oldW = W; const r = cv.parentElement.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; W = Math.max(300, r.width); H = Math.max(260, r.height); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; benchY = H * 0.8; S = clamp(H / 400, 0.8, 1.6); if (oldW > 0 && Math.abs(oldW - W) > 1 && (B.objects.length || B.burners.length)) { const k = W / oldW; B.objects.forEach(o => { o.x *= k; }); B.burners.forEach(b => { b.x *= k; }); B.balances.forEach(b => { b.x *= k; }); }
    B.objects.forEach(o => { o.w = GL[o.type].w * S; o.h = GL[o.type].h * S; if (!o.lifted) o.y = benchY; }); B.burners.forEach(b => { b.y = benchY + 8; }); B.balances.forEach(b => { b.y = benchY + 8; }); }
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(cv.parentElement);

  function freeX(wNew) { wNew = wNew || 70 * S; const items = B.objects.map(o => [o.x, o.w]).concat(B.burners.map(b => [b.x, 80]), B.balances.map(b => [b.x, 128]));
    for (let x = wNew / 2 + 24; x < W - wNew / 2 - 20; x += 12) if (items.every(it => Math.abs(it[0] - x) > it[1] / 2 + wNew / 2 + 16)) return x; return clamp(60 + Math.random() * (W - 120), 40, W - 40); }
  B.addContainer = function (type, pre) {
    const g = GL[type]; if (!g) return null; const c = E.createContainer(type); c.name = (pre && pre.name) || (g.nameAr + ' ' + (++seq));
    const o = { id: c.id, type, x: freeX(g.w * S), y: benchY, w: g.w * S, h: g.h * S, tilt: 0, c, bubbles: [], probes: {}, stopper: false, name: c.name }; B.objects.push(o); B.select(o); return o;
  };
  B.addBurner = function () { const b = { x: freeX(80), y: benchY + 8, on: false, luminous: false, kind: 'burner' }; B.burners.push(b); return b; };
  B.addBalance = function () { const b = { x: freeX(128), y: benchY + 8, kind: 'balance' }; B.balances.push(b); return b; };
  B.select = function (o) { B.selected = o; emit('select', o); };
  B.remove = function (o) { B.objects = B.objects.filter(x => x !== o); E.containers = E.containers.filter(c => c !== o.c); B.objects.forEach(x => { if (x.c.delivery === o.c) x.c.delivery = null; }); if (B.selected === o) B.select(null); };
  B.reset = function () { B.objects = []; B.burners = []; B.balances = []; E.containers = []; E.notebook.length = 0; B.select(null); B.flameTint = null; seq = 0; emit('reset'); };
  B.hit = function (x, y) { for (let i = B.objects.length - 1; i >= 0; i--) { const o = B.objects[i]; if (x > o.x - o.w / 2 - 10 && x < o.x + o.w / 2 + 10 && y > o.y - o.h - 12 && y < o.y + 6) return o; } return null; };
  B.hitEquip = function (x, y) { for (const b of B.burners) if (Math.abs(x - b.x) < 40 && y > b.y - 90 && y < b.y + 10) return b; for (const b of B.balances) if (Math.abs(x - b.x) < 64 && y > b.y - 30 && y < b.y + 4) return b; return null; };
  B.toLocal = function (e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  // ---- pointer interaction ----
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    const p = B.toLocal(e); const o = B.hit(p.x, p.y);
    if (B.mode === 'pour' && o && o !== B.pourSrc) { B.finishPour(o); return; }
    if (B.mode === 'tube' && o && o !== B.tubeSrc) { B.tubeSrc.c.delivery = o.c; B.tubeSrc.stopper = true; B.tubeSrc.c.sealed = false; E.log({ kind: 'observation', textAr: 'وُصلت أنبوبة توصيل بين ' + B.tubeSrc.name + ' و' + o.name }); B.setMode(null); return; }
    if (o) { B.select(o); drag = { o, dx: p.x - o.x, dy: p.y - o.y, kind: 'c' }; o.lifted = true; cv.setPointerCapture(e.pointerId); return; }
    const q = B.hitEquip(p.x, p.y);
    if (q) { drag = { o: q, dx: p.x - q.x, dy: p.y - q.y, kind: 'e', moved: false, startX: p.x }; cv.setPointerCapture(e.pointerId); return; }
    B.select(null);
  });
  cv.addEventListener('pointermove', e => { if (!drag) return; const p = B.toLocal(e); const o = drag.o;
    if (drag.kind === 'c') { o.x = clamp(p.x - drag.dx, 30, W - 30); o.y = clamp(p.y - drag.dy, o.h + 20, benchY + 4); } else { o.x = clamp(p.x - drag.dx, 40, W - 40); drag.moved = drag.moved || Math.abs(p.x - drag.startX) > 4; } });
  const up = () => { if (!drag) return; const d = drag; drag = null;
    if (d.kind === 'c') { const o = d.o; o.lifted = false; let sy = benchY;
      B.burners.forEach(b => { if (Math.abs(o.x - b.x) < 26 && o.y < benchY - 30) { o.x = b.x; sy = b.y - 96; o.lifted = true; } });
      B.balances.forEach(b => { if (Math.abs(o.x - b.x) < 56 && o.y > benchY - 60) { sy = b.y - 24; o.lifted = true; } });
      o.y = sy; if (sy === benchY) o.lifted = false; }
    else if (!d.moved && d.o.kind === 'burner') { d.o.on = !d.o.on; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('dblclick', e => { const p = B.toLocal(e); const q = B.hitEquip(p.x, p.y); if (q && q.kind === 'burner') { q.luminous = !q.luminous; toast(q.luminous ? 'اللهب مضيء (الفتحة مغلقة): أبرد ويترك سناجًا' : 'اللهب غير مضيء (فتحة الهواء مفتوحة): أسخن وأزرق'); } });

  B.setMode = function (m, src) { B.mode = m; B.pourSrc = m === 'pour' ? src : null; B.tubeSrc = m === 'tube' ? src : null; $('#hint').textContent = m === 'pour' ? 'انقر على الوعاء المراد السكب فيه (Esc للإلغاء)' : m === 'tube' ? 'انقر على الوعاء الذي تنتهي إليه أنبوبة التوصيل' : B.defaultHint; cv.style.cursor = m ? 'crosshair' : ''; };
  B.defaultHint = 'اسحب مادة من القائمة وأفلتها على الوعاء • اسحب الأوعية لتحريكها • انقر الموقد للتشغيل (نقر مزدوج: فتحة الهواء) • اسحب الوعاء فوق الموقد أو الميزان';
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && B.mode) B.setMode(null); });
  B.startPour = function (src) { B.setMode('pour', src); };
  B.finishPour = async function (dst) {
    const src = B.pourSrc; B.setMode(null); const max = Math.round(src.c.totalMl * 10) / 10; if (max <= 0) { toast('الوعاء فارغ'); return; }
    const r = await U.dialog('سكب من ' + src.name + ' إلى ' + dst.name, [{ id: 'ml', label: 'الكمية', type: 'number', value: Math.min(5, max), min: 0.1, max: max, suffix: 'مل' }], 'اسكب'); if (!r || !(r.ml > 0)) return;
    src.pouring = { dst, left: Math.min(r.ml, max), rate: Math.max(3, Math.min(r.ml, max) / 2.2) };
  };
  B.pourConc = function (o, id, ml, slow, tilted) { return E.pourConc(o.c, id, ml, { slow, tilted }); };

  // ---- tools ----
  const PAPER_TOOLS = new Set(['litmusBlue', 'litmusRed', 'leadAcetate', 'dichromatePaper', 'starchPaper', 'burningSplint', 'glowingSplint', 'concHClRod', 'ammoniaRod', 'limewater', 'aqueousBromine', 'acidKMnO4']);
  B.applyTool = async function (o, id) {
    const c = o.c;
    if (PAPER_TOOLS.has(id)) { const r = E.detect(c, id); const name = (D.reagents.gasTests[id] || {}).nameAr || id; o.paper = { t: 0, name, color: r.color || null, text: r.textAr, effect: r.effect }; toast(name + ': ' + r.textAr, 4200); emit('log'); return; }
    switch (id) {
      case 'thermometer': o.probes.temp = !o.probes.temp; break; case 'phMeter': o.probes.ph = !o.probes.ph; break; case 'conductivity': o.probes.cond = !o.probes.cond; break;
      case 'stirRod': c.stirred = 1; E.log({ kind: 'observation', textAr: 'تم تحريك ' + o.name }); break;
      case 'stopper': o.stopper = !o.stopper; c.sealed = o.stopper && !c.delivery; toast(o.stopper ? 'سُدّ الوعاء بالسدادة (الغاز يتجمع)' : 'أُزيلت السدادة'); break;
      case 'deliveryTube': B.setMode('tube', o); break;
      case 'uvLamp': c.uv = !c.uv; toast(c.uv ? 'أُضيء مصباح UV' : 'أُطفئ مصباح UV'); break;
      case 'electrodes': { const r = await U.dialog('أقطاب كهربية في ' + o.name, [{ id: 'I', label: 'شدة التيار', type: 'number', value: c.current ? c.current : 1, min: 0, max: 10, step: 0.1, suffix: 'أمبير (0 = إيقاف)' }], 'تطبيق'); if (r) { c.current = r.I; o.electrodes = r.I > 0; E.log({ kind: 'observation', textAr: r.I > 0 ? 'مُرّر تيار ' + r.I + ' A في ' + o.name : 'أُوقف التيار' }); } break; }
      case 'nichrome': B.flameTest(o); break;
      case 'balance': B.addBalance(); break;
      default: toast('أداة غير مدعومة: ' + id);
    }
  };
  B.flameTest = function (o) {
    const burner = B.burners.find(b => b.on && !b.luminous); if (!burner) { toast('أشعل موقد بنزن (لهب غير مضيء) أولًا لإجراء اختبار اللهب'); return; }
    let best = null; D.ions.cations.forEach(ci => { const n = o.c.aq[ci.key]; if (ci.flameColor && n > 1e-7 && (!best || n > best.n)) best = { n, ci }; });
    for (const k in o.c.solids) { const s = Chem.salts[k]; if (s) { const ci = D.ions.cations.find(x => x.key === s.c); if (ci && ci.flameColor && (!best || o.c.solids[k].mol > best.n)) best = { n: o.c.solids[k].mol, ci }; } }
    if (!best) { toast('لا يوجد كاتيون يعطي لونًا مميزًا للهب'); return; }
    B.flameTint = { color: best.ci.flameColor, until: B.t + 4, burner }; const txt = 'اختبار اللهب: ' + best.ci.nameAr + ' → ' + E.colorNameAr(best.ci.flameColor); E.log({ kind: 'test', textAr: txt, tool: 'nichrome' }); toast(txt, 4200);
  };

  // ---- update / render ----
  function updateObjects(dt) {
    B.objects.forEach(o => {
      const c = o.c; c.flame = null;
      B.burners.forEach(b => { if (b.on && Math.abs(o.x - b.x) < 30 && o.y < b.y - 60 && o.y > b.y - 150) E.setFlame(c, { on: true, luminous: b.luminous }); });
      if (o.pouring) { const p = o.pouring; const dir = Math.sign(p.dst.x - o.x) || 1; const tgt = dir * 1.25; o.tilt += (tgt - o.tilt) * Math.min(1, dt * 5);
        if (Math.abs(o.tilt - tgt) < 0.25) { const ml = Math.min(p.left, p.rate * dt); E.pour(c, p.dst.c, ml); p.left -= ml; if (p.left <= 1e-6) o.pouring = null; } }
      else o.tilt += (0 - o.tilt) * Math.min(1, dt * 6);
      const logs = E.tick(c, dt); if (logs.length) emit('log');
      // bubbles from gas flux
      const flux = c.gasFlux || 0; c.gasFlux = 0; const look = E.appearance(c); o._look = look;
      if (flux > 0 && look.volumeMl > 0) { const n = Math.min(14, Math.ceil(flux * 9000)); const sh = Glass.shapeOf(o); for (let i = 0; i < n; i++) o.bubbles.push({ x: sh.liq.x0 + Math.random() * (sh.liq.x1 - sh.liq.x0), y: sh.liq.y1 - 2 - Math.random() * 6, r: 1.5 + Math.random() * 2.5, vy: 30 + Math.random() * 50 }); }
      if (c.tempC >= 99.5 && look.volumeMl > 0) { const sh = Glass.shapeOf(o); for (let i = 0; i < 2; i++) o.bubbles.push({ x: sh.liq.x0 + Math.random() * (sh.liq.x1 - sh.liq.x0), y: sh.liq.y1 - 2, r: 1.5 + Math.random() * 2, vy: 40 + Math.random() * 40 }); }
      const sh = Glass.shapeOf(o); const ih = sh.liq.y1 - sh.liq.y0; const top = sh.liq.y1 - ih * Math.min(1, (look.volumeMl || 0) / c.capacityMl);
      o.bubbles.forEach(b => { b.y -= b.vy * dt; b.x += Math.sin(B.t * 6 + b.vy) * 0.4; }); o.bubbles = o.bubbles.filter(b => b.y > top && o.bubbles.length < 160);
      if (o.paper) { o.paper.t += dt; if (o.paper.t > 6) o.paper = null; }
    });
    if (B.flameTint && B.t > B.flameTint.until) B.flameTint = null;
  }
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, benchY, 0, H); g.addColorStop(0, '#4a3b28'); g.addColorStop(1, '#241b10'); ctx.fillStyle = g; ctx.fillRect(0, benchY, W, H - benchY);
    ctx.fillStyle = '#6b5a3d'; ctx.fillRect(0, benchY - 2, W, 4); ctx.strokeStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, benchY + 4); ctx.lineTo(x + 20, H); ctx.stroke(); }
    // tubes (delivery) behind glass
    B.objects.forEach(o => { const d = o.c.delivery; if (!d) return; const t2 = B.objects.find(x => x.c === d); if (!t2) return; const a = Glass.shapeOf(o).mouth, b2 = Glass.shapeOf(t2).mouth;
      const x1 = o.x + a.x, y1 = o.y + a.y, x2 = t2.x + b2.x, y2 = t2.y + b2.y + 40; ctx.strokeStyle = 'rgba(200,230,255,.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, y1 + 6); ctx.bezierCurveTo(x1, y1 - 70, x2, y1 - 70, x2, y2); ctx.stroke(); });
    B.balances.forEach(b => { const on = B.objects.find(o => Math.abs(o.x - b.x) < 56 && Math.abs(o.y - (b.y - 24)) < 3); Glass.drawBalance(ctx, b, on ? E.measure(on.c).massG : 0); });
    B.burners.forEach(b => { Glass.drawBurner(ctx, b, B.t); if (B.flameTint && B.flameTint.burner === b) Glass.drawFlameTint(ctx, b, B.flameTint.color, B.t); });
    B.objects.forEach(o => {
      if (o.lifted && B.burners.some(b => Math.abs(o.x - b.x) < 30 && o.y < b.y - 60)) { ctx.strokeStyle = '#8b94a5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x - 34, o.y + 1); ctx.lineTo(o.x + 34, o.y + 1); ctx.moveTo(o.x - 30, o.y + 1); ctx.lineTo(o.x - 40, benchY + 8); ctx.moveTo(o.x + 30, o.y + 1); ctx.lineTo(o.x + 40, benchY + 8); ctx.stroke(); }
      const look = o._look || E.appearance(o.c); Glass.drawContainer(ctx, o, look, B.t);
      if (o.pouring && o.pouring.left > 0 && Math.abs(o.tilt) > 1) { const sh = Glass.shapeOf(o); const ca = Math.cos(o.tilt), sa = Math.sin(o.tilt); const mx = o.x + sh.mouth.x * ca - sh.mouth.y * sa, my = o.y + sh.mouth.x * sa + sh.mouth.y * ca; const dstO = o.pouring.dst; const col = look.liquid ? (look.liquid.color || 'rgba(160,200,255,.6)') : 'rgba(160,200,255,.6)'; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(mx + Math.sign(o.tilt) * 14, my + 30, dstO.x, dstO.y - dstO.h - 2); ctx.stroke(); }
      Glass.drawGas(ctx, o, look, B.t);
      // labels
      ctx.save(); ctx.textAlign = 'center'; ctx.font = '600 12px ' + getComputedStyle(document.body).fontFamily; ctx.fillStyle = o === B.selected ? '#34d6c0' : '#c6d3f0'; ctx.fillText(o.name, o.x, o.y + 18);
      if (look.volumeMl > 0) { ctx.fillStyle = '#93a4c8'; ctx.font = '11px sans-serif'; ctx.fillText(look.volumeMl.toFixed(1) + ' مل', o.x, o.y + 32); }
      let ly = o.y - o.h - 10; ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center';
      const tag = (txt, col) => { const w = ctx.measureText(txt).width + 10; ctx.fillStyle = '#000b'; ctx.fillRect(o.x - w / 2, ly - 12, w, 16); ctx.fillStyle = col; ctx.fillText(txt, o.x, ly); ly -= 19; };
      if (o.probes.temp) tag('🌡 ' + o.c.tempC.toFixed(1) + '°C', o.c.tempC > 60 ? '#ff9a6b' : '#9fd8ff'); if (o.probes.ph && look.pH !== null) tag('pH ' + look.pH.toFixed(2), '#9bffb4'); if (o.probes.cond && look.volumeMl > 0) tag('σ ' + look.conductivity.toFixed(1) + ' mS/cm', '#ffe08a');
      if (o.electrodes) { ctx.strokeStyle = '#aab'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x - o.w * 0.2, o.y - o.h - 22); ctx.lineTo(o.x - o.w * 0.2, o.y - 14); ctx.moveTo(o.x + o.w * 0.2, o.y - o.h - 22); ctx.lineTo(o.x + o.w * 0.2, o.y - 14); ctx.stroke(); ctx.fillStyle = '#ff6b6b'; ctx.fillText('+', o.x + o.w * 0.2, o.y - o.h - 26); ctx.fillStyle = '#6bb8ff'; ctx.fillText('−', o.x - o.w * 0.2, o.y - o.h - 26); }
      if (o.paper) { const p = o.paper; const x = o.x + o.w / 2 + 22, y = o.y - o.h - 8; ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3); ctx.fillStyle = p.color || '#e8e8e8'; ctx.globalAlpha = Math.min(1, 0.4 + p.t); ctx.fillRect(-5, -34, 12, 38); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff6'; ctx.strokeRect(-5, -34, 12, 38); ctx.restore(); if (p.effect === 'pop' && p.t < 0.6) { ctx.fillStyle = '#ffd24a'; ctx.font = '700 16px sans-serif'; ctx.fillText('💥 بوب!', o.x, o.y - o.h - 36); } if (p.effect === 'relight' && p.t < 3) { ctx.fillText('🔥', o.x + o.w / 2 + 28, o.y - o.h - 30); } }
      if (o.c.flame && o.c.flame.on && o.c.flame.luminous) { ctx.fillStyle = 'rgba(15,15,15,.55)'; ctx.fillRect(o.x - 10, o.y - 3, 20, 3); }
      ctx.restore();
    });
    if (B.mode) { ctx.fillStyle = 'rgba(52,214,192,.08)'; ctx.fillRect(0, 0, W, H); }
  }
  function frame(ts) {
    const dt = Math.min(0.05, (ts - (B.lastFrame || ts)) / 1000); B.lastFrame = ts; B.t += dt;
    if (B.running && $('#view-lab').classList.contains('on')) { updateObjects(dt); draw(); emit('frame', dt); }
    requestAnimationFrame(frame);
  }
  B.start = function () { resize(); B.setMode(null); requestAnimationFrame(frame); };
  B.layoutReady = function () { const r = cv.parentElement.getBoundingClientRect(); return r.width > 300 && r.height > 260; };
  window.Bench = B; window.Chem = Chem;
})();
