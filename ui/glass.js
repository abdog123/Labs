/* Glass: canvas drawing of glassware, liquids, precipitates, gas plumes, burner, balance. */
(function () {
  'use strict';
  const rr = (ctx, x, y, w, h, r) => { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  // local coordinates: origin = bottom centre, y up is negative
  const SHAPES = {
    testTube(w, h) { return { path(c) { const r = w / 2; c.moveTo(-r, -h); c.lineTo(-r, -r); c.arc(0, -r, r, Math.PI, 0, true); c.lineTo(r, -h); }, liq: { x0: -w / 2 + 2, x1: w / 2 - 2, y0: -h + 4, y1: -2 }, mouth: { x: 0, y: -h }, lip: w + 6 }; },
    beaker(w, h) { return { path(c) { c.moveTo(-w / 2, -h); c.lineTo(-w / 2 + 3, -4); c.quadraticCurveTo(-w / 2 + 3, 0, -w / 2 + 12, 0); c.lineTo(w / 2 - 12, 0); c.quadraticCurveTo(w / 2 - 3, 0, w / 2 - 3, -4); c.lineTo(w / 2, -h); }, liq: { x0: -w / 2 + 4, x1: w / 2 - 4, y0: -h + 6, y1: -2 }, mouth: { x: 0, y: -h }, lip: w + 8 }; },
    flask(w, h) { const nw = w * 0.26, nh = h * 0.3; return { path(c) { c.moveTo(-nw / 2, -h); c.lineTo(-nw / 2, -h + nh); c.lineTo(-w / 2, -4); c.quadraticCurveTo(-w / 2, 0, -w / 2 + 12, 0); c.lineTo(w / 2 - 12, 0); c.quadraticCurveTo(w / 2, 0, w / 2, -4); c.lineTo(nw / 2, -h + nh); c.lineTo(nw / 2, -h); }, liq: { x0: -w / 2, x1: w / 2, y0: -h + nh, y1: -2 }, mouth: { x: 0, y: -h }, lip: nw + 8, cone: { nh: nh, nw: nw } }; },
    cylinder(w, h) { return { path(c) { c.moveTo(-w / 2, -h); c.lineTo(-w / 2, -4); c.lineTo(-w / 2 - 6, -4); c.lineTo(-w / 2 - 8, 0); c.lineTo(w / 2 + 8, 0); c.lineTo(w / 2 + 6, -4); c.lineTo(w / 2, -4); c.lineTo(w / 2, -h); }, liq: { x0: -w / 2 + 2, x1: w / 2 - 2, y0: -h + 4, y1: -5 }, mouth: { x: 0, y: -h }, lip: w + 4, ticks: true }; },
    burette(w, h) { return { path(c) { c.moveTo(-w / 2, -h); c.lineTo(-w / 2, -26); c.lineTo(-2, -22); c.lineTo(-2, 0); c.lineTo(2, 0); c.lineTo(2, -22); c.lineTo(w / 2, -26); c.lineTo(w / 2, -h); }, liq: { x0: -w / 2 + 2, x1: w / 2 - 2, y0: -h + 4, y1: -26 }, mouth: { x: 0, y: -h }, lip: w + 4, ticks: true, tap: true }; },
    pipette(w, h) { return { path(c) { c.moveTo(-w / 2, -h); c.lineTo(-w / 2, -30); c.lineTo(-1.5, -4); c.lineTo(-1.5, 0); c.lineTo(1.5, 0); c.lineTo(1.5, -4); c.lineTo(w / 2, -30); c.lineTo(w / 2, -h); }, liq: { x0: -w / 2 + 2, x1: w / 2 - 2, y0: -h + 4, y1: -30 }, mouth: { x: 0, y: -h }, lip: w + 2, ticks: true }; },
    crucible(w, h) { return { path(c) { c.moveTo(-w / 2, -h); c.lineTo(-w * 0.32, -3); c.quadraticCurveTo(-w * 0.3, 0, -w * 0.22, 0); c.lineTo(w * 0.22, 0); c.quadraticCurveTo(w * 0.3, 0, w * 0.32, -3); c.lineTo(w / 2, -h); }, liq: { x0: -w * 0.3, x1: w * 0.3, y0: -h + 4, y1: -2 }, mouth: { x: 0, y: -h }, lip: w + 4, ceramic: true }; },
    petri(w, h) { return { path(c) { rr(c, -w / 2, -h, w, h, 4); }, liq: { x0: -w / 2 + 3, x1: w / 2 - 3, y0: -h + 3, y1: -2 }, mouth: { x: 0, y: -h }, lip: w }; },
  };
  const pseudo = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  function shapeOf(o) { return (SHAPES[o.type] || SHAPES.beaker)(o.w, o.h); }
  function rgba(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }

  function drawContainer(ctx, o, look, t, opts) {
    opts = opts || {}; const sh = shapeOf(o); const c = o.c; const L = sh.liq;
    ctx.save(); ctx.translate(o.x, o.y); if (o.tilt) ctx.rotate(o.tilt);
    // liquid
    const vol = look.volumeMl || 0, cap = c.capacityMl; const frac = Math.min(1, vol / cap); const ih = L.y1 - L.y0;
    const yS = L.y1 - ih * frac;
    ctx.save(); ctx.beginPath(); sh.path(ctx); ctx.closePath(); ctx.clip();
    if (o.tilt) ctx.rotate(-o.tilt); // liquid surface stays level in world space
    if (vol > 0 && look.liquid) {
      const lc = look.liquid; const g = ctx.createLinearGradient(0, yS, 0, L.y1);
      const col = lc.rgb ? lc.rgb : [190, 225, 255]; const a = lc.alpha !== undefined ? lc.alpha : 0.3;
      if (lc.rgb) { g.addColorStop(0, rgba(col, Math.min(0.95, a * 0.85))); g.addColorStop(1, rgba(col, Math.min(0.98, a + 0.08))); } else { g.addColorStop(0, lc.color); g.addColorStop(1, lc.color); }
      ctx.fillStyle = g; ctx.fillRect(-o.w, yS, o.w * 2, o.h);
      // meniscus line
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-o.w, yS, o.w * 2, 1.5);
      // organic immiscible layers drawn as bands on top
      let ytop = yS; (look.liquids || []).filter(l => l.miscible === false).forEach(l => { const hh = Math.max(3, (l.ml / cap) * ih); ctx.fillStyle = rgba([200, 200, 210], .18); ctx.fillRect(-o.w, ytop, o.w * 2, hh); ytop += hh; });
      // turbidity haze
      if (look.turbidity > 0.02) { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * look.turbidity).toFixed(3) + ')'; ctx.fillRect(-o.w, yS, o.w * 2, o.h); }
      // suspended particles
      look.solids.forEach((s, si) => { if (s.form !== 'precip' || s.suspended < 0.05) return; const n = Math.min(60, Math.round(18 * s.suspended + 4)); ctx.fillStyle = s.color; ctx.globalAlpha = 0.55 * s.suspended;
        for (let i = 0; i < n; i++) { const px = L.x0 + pseudo(i, si) * (L.x1 - L.x0), py = yS + 4 + ((pseudo(si, i) * (L.y1 - yS - 6) + t * 6 * (1 - s.suspended)) % Math.max(4, L.y1 - yS - 6)); ctx.fillRect(px, py, 2.2, 2.2); } ctx.globalAlpha = 1; });
      // brown ring layer
      if (look.layers && look.layers.ring) { ctx.fillStyle = 'rgba(110,60,25,.85)'; ctx.fillRect(L.x0, yS + ih * 0.18, L.x1 - L.x0, 7); }
    }
    // settled solids at the bottom
    let base = L.y1; look.solids.forEach((s, si) => {
      const settled = s.form === 'precip' ? (1 - s.suspended) : 1; const mass = s.massG * settled; if (mass < 0.0005) return;
      const hgt = Math.min(ih * 0.5, 2 + Math.sqrt(mass) * 9); const w = L.x1 - L.x0; ctx.fillStyle = s.color;
      if (s.form === 'chunk') { for (let i = 0; i < Math.min(6, 1 + Math.round(mass * 2)); i++) { ctx.fillRect(L.x0 + 3 + i * (w - 10) / 6, base - 6 - (i % 2) * 3, Math.min(14, 5 + mass), 6); } }
      else { ctx.beginPath(); ctx.moveTo(L.x0, base); ctx.quadraticCurveTo((L.x0 + L.x1) / 2, base - hgt * 1.6, L.x1, base); ctx.closePath(); ctx.fill();
        if (s.texture === 'crystalline') { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 8; i++) ctx.fillRect(L.x0 + pseudo(i, si) * w, base - pseudo(si, i) * hgt, 1.6, 1.6); } }
      base -= hgt * 0.7;
    });
    // bubbles
    (o.bubbles || []).forEach(b => { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.stroke(); });
    ctx.restore();
    // glass wall
    ctx.beginPath(); sh.path(ctx); const hot = Math.min(1, Math.max(0, (look.tempC - 60) / 90));
    ctx.lineWidth = 2.2; ctx.strokeStyle = hot > 0 ? 'rgba(255,' + Math.round(200 - 120 * hot) + ',' + Math.round(200 - 160 * hot) + ',.85)' : 'rgba(215,235,255,.75)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-o.w / 2 + 5, -o.h * 0.9); ctx.lineTo(-o.w / 2 + 5, -o.h * 0.3); ctx.stroke();
    // rim
    ctx.strokeStyle = 'rgba(215,235,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-sh.lip / 2, sh.mouth.y); ctx.lineTo(sh.lip / 2, sh.mouth.y); ctx.stroke();
    if (sh.ticks) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; for (let i = 1; i < 10; i++) { const yy = L.y1 - ih * i / 10; ctx.beginPath(); ctx.moveTo(-o.w / 2, yy); ctx.lineTo(-o.w / 2 + (i % 5 ? 5 : 9), yy); ctx.stroke(); } }
    if (sh.tap) { ctx.fillStyle = '#a8b2c4'; ctx.fillRect(-9, -22, 18, 5); ctx.fillRect(-2, -26, 4, 12); }
    if (o.stopper) { ctx.fillStyle = '#b8864d'; ctx.beginPath(); ctx.moveTo(-sh.lip / 2 + 3, sh.mouth.y); ctx.lineTo(sh.lip / 2 - 3, sh.mouth.y); ctx.lineTo(sh.lip / 2 - 6, sh.mouth.y + 14); ctx.lineTo(-sh.lip / 2 + 6, sh.mouth.y + 14); ctx.fill(); }
    ctx.restore();
  }
  // gas plume above mouth: light gases rise, heavy gases spill downward along the bench
  function drawGas(ctx, o, look, t) {
    const sh = shapeOf(o); const mx = o.x + sh.mouth.x, my = o.y + sh.mouth.y;
    look.gasClouds.forEach((g, gi) => {
      const col = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(g.color); const rgb = col ? [col[1], col[2], col[3]] : [230, 240, 255]; const a0 = col ? parseFloat(col[4]) : 0; const amount = Math.min(1, g.amount * 4000);
      const visible = Math.max(a0, 0.08) * (0.4 + amount); const heavy = g.dens > 1.15; const n = 14;
      for (let i = 0; i < n; i++) { const ph = (t * 0.35 + i / n + gi * 0.2) % 1; const wob = Math.sin(t * 2 + i * 1.7) * 10 * ph;
        const x = mx + wob + (heavy ? (i % 2 ? 1 : -1) * ph * 60 : 0), y = heavy ? my + ph * (o.y - my + 6) : my - ph * 120 * (g.dens < 0.5 ? 1.5 : 1); const r = 6 + ph * 16;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb.join(',') + ',' + (visible * (1 - ph)).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); }
    });
  }
  function drawBurner(ctx, b, t) {
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.fillStyle = '#4b5565'; ctx.beginPath(); ctx.ellipse(0, -4, 36, 9, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#6b7788'; ctx.fillRect(-7, -64, 14, 58);
    ctx.fillStyle = '#8791a3'; ctx.fillRect(-9, -68, 18, 8); ctx.fillStyle = b.luminous ? '#2d3643' : '#b8c1d0'; ctx.fillRect(-10, -44, 20, 10);
    ctx.fillStyle = '#9aa4b6'; ctx.fillRect(-5, -78, 10, 12);
    if (b.on) { const n = b.luminous ? 1 : 0; const fh = b.luminous ? 70 : 56; const wob = Math.sin(t * 18) * 1.5;
      const g = ctx.createLinearGradient(0, -78, 0, -78 - fh); if (b.luminous) { g.addColorStop(0, '#ffcf5a'); g.addColorStop(1, 'rgba(255,120,0,.05)'); } else { g.addColorStop(0, '#3a74ff'); g.addColorStop(.5, '#7cb0ff'); g.addColorStop(1, 'rgba(160,200,255,.05)'); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, -78); ctx.quadraticCurveTo(-8 + wob, -78 - fh * .6, 0 + wob, -78 - fh); ctx.quadraticCurveTo(8 + wob, -78 - fh * .6, 6, -78); ctx.closePath(); ctx.fill();
      if (!b.luminous) { ctx.fillStyle = 'rgba(40,90,220,.9)'; ctx.beginPath(); ctx.moveTo(-3, -78); ctx.lineTo(0, -78 - fh * .35); ctx.lineTo(3, -78); ctx.fill(); }
      const gl = ctx.createRadialGradient(0, -100, 0, 0, -100, 90); gl.addColorStop(0, b.luminous ? 'rgba(255,170,60,.25)' : 'rgba(110,160,255,.22)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.fillRect(-100, -190, 200, 200); }
    ctx.restore();
  }
  function drawFlameTint(ctx, b, rgbHex, t) { // coloured flame for flame test
    ctx.save(); ctx.translate(b.x, b.y); const g = ctx.createLinearGradient(0, -78, 0, -150); g.addColorStop(0, rgbHex); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.85; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-8, -78); ctx.quadraticCurveTo(-12 + Math.sin(t * 15), -120, 0, -150); ctx.quadraticCurveTo(12, -120, 8, -78); ctx.fill(); ctx.restore();
  }
  function drawBalance(ctx, b, grams) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = '#c5ccd8'; rr(ctx, -62, -22, 124, 22, 5); ctx.fill(); ctx.fillStyle = '#e6ebf3'; ctx.beginPath(); ctx.ellipse(0, -24, 54, 6, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#0a1a14'; rr(ctx, -34, -18, 68, 14, 3); ctx.fill(); ctx.fillStyle = '#6dff9a'; ctx.font = '700 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(grams.toFixed(2) + ' g', 0, -7); ctx.restore();
  }
  window.Glass = { SHAPES, shapeOf, drawContainer, drawGas, drawBurner, drawFlameTint, drawBalance, pseudo };
})();
