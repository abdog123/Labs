/* Appearance + measurement + gas detection for a Container. Pure functions over container state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chem.js'), require('./solution.js'));
  else root.Appearance = factory(root.Chem, root.Solution);
})(typeof self !== 'undefined' ? self : this, function (Chem, Sol) {
  'use strict';
  // molar absorptivity (L/mol/cm) for coloured species; default for any coloured entry
  const EPS = { 'MnO4^-': 2200, 'Cr2O7^2-': 500, 'CrO4^2-': 1800, 'FeSCN^2+': 4500, 'CoCl4^2-': 700, 'Cu(NH3)4^2+': 600, 'Cu^2+': 14,
    'Fe^3+': 160, 'Fe^2+': 8, 'Ni^2+': 6, 'Co^2+': 8, 'Cr^3+': 18, 'Mn^2+': 1.5, 'I2(aq)': 900, 'Br2(aq)': 500, 'I3^-': 2200, 'Cl2(aq)': 30,
    'Ni(NH3)6^2+': 40, 'Co(NH3)6^2+': 120, 'Cr(OH)4^-': 60, 'Fe(CN)6^3-': 300, 'Fe(CN)6^4-': 20 };
  const BASE = [190, 225, 255];
  const hex = c => { // parse '#rrggbb' | 'rgba(r,g,b,a)' -> [r,g,b,a]
    if (!c) return null;
    if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
    const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  };
  function make(data) {
    const colorOf = {};
    data.ions.cations.forEach(i => { colorOf[i.key] = i.solutionColor; }); data.ions.anions.forEach(i => { colorOf[i.key] = i.solutionColor; });
    for (const k in data.species) if (data.species[k].phase === 'aq') colorOf[k] = data.species[k].color;
    const ind = data.reagents.indicators;

    function liquidLook(c) {
      const V = c.volumeMl; if (!(V > 0)) return null; const L = V / 1000; const path = 2.0;
      let total = 0; const sum = [0, 0, 0];
      const add = (col, A) => { const r = hex(col); if (!r || r[3] < 0.5 || !(A > 0)) return; total += A; for (let i = 0; i < 3; i++) sum[i] += A * r[i]; };
      for (const k in c.aq) { const col = colorOf[k]; if (!col) continue; add(col, (EPS[k] || 40) * (c.aq[k] / L) * path); }
      if ((c.liquids['C6H5OH(l)'] || c.aq['C6H5OH(aq)']) && (c.aq['Fe^3+'] > 1e-6)) add('#6a3fa0', 40);
      if ((c.aq['(C6H10O5)n(aq)'] || 0) > 0 && ((c.aq['I2(aq)'] || 0) + (c.aq['I3^-'] || 0)) > 1e-7) add('#14146a', 120);
      for (const k in c.liquids) { const l = c.liquids[k]; if (l.color && l.miscible !== false) { const r = hex(l.color); if (r && r[3] > 0.5) add(l.color, 10 * l.ml / V); } }
      // colour = absorbance-weighted mean of the coloured species, faded toward water when dilute
      const f = total > 0 ? 1 - Math.pow(10, -total) : 0;
      const mean = total > 0 ? sum.map(v => v / total) : BASE;
      const rgb = BASE.map((b, i) => Math.round(b * (1 - f) + mean[i] * f));
      const alpha = Math.min(0.93, 0.22 + 0.7 * f);
      return { rgb, alpha, color: 'rgba(' + rgb.join(',') + ',' + alpha.toFixed(2) + ')', absorbance: total };
    }
    function suspended(c) {
      const out = []; let turb = 0;
      for (const k in c.solids) {
        const s = c.solids[k]; if (s.mol < 1e-7) continue;
        const sp = data.species[k]; const tex = s.texture || 'powder';
        const settleRate = { powder: 0.02, crystalline: 0.08, gelatinous: 0.004, milky: 0.002, curdy: 0.03, flocculent: 0.01 }[tex] || 0.02;
        const age = c.time - (s.born === undefined ? (s.born = c.time) : s.born);
        const susp = s.form === 'precip' ? Math.exp(-settleRate * age) : 0;
        const mm = sp ? sp.M : (Chem.salts[k] ? Chem.molarMass(k) : 100);
        out.push({ key: k, nameAr: (sp && sp.nameAr) || s.name || k, color: s.color || (sp && sp.color) || '#ffffff', form: s.form, texture: tex, mol: s.mol, massG: s.mol * mm, suspended: susp });
        if (s.form === 'precip') turb += Math.min(1, s.mol * mm * 6) * susp;
      }
      return { solids: out, turbidity: Math.min(1, turb) };
    }
    function gasClouds(c) {
      const out = [];
      for (const g in (c.gasCloud || {})) {
        const amt = c.gasCloud[g]; if (amt < 1e-7) continue;
        const key = g + '(g)'; const sp = data.species[key] || {};
        out.push({ gas: g, amount: amt, color: sp.color || 'rgba(255,255,255,0)', dens: sp.dens || 1, toxic: !!sp.toxic, odorAr: sp.odor || null, flammable: !!sp.flammable });
      }
      return out;
    }
    function indicatorColor(c, pH) {
      const name = c.indicator; if (!name) return null; const d = ind[name]; if (!d) return null;
      if (name === 'universal') { const st = d.stops; if (pH <= st[0][0]) return st[0][1]; if (pH >= st[st.length - 1][0]) return st[st.length - 1][1];
        for (let i = 0; i < st.length - 1; i++) if (pH <= st[i + 1][0]) { const f = (pH - st[i][0]) / (st[i + 1][0] - st[i][0]); return mix(st[i][1], st[i + 1][1], f); } }
      const mid = (d.range[0] + d.range[1]) / 2, w = (d.range[1] - d.range[0]) / 4;
      const f = 1 / (1 + Math.exp(-(pH - mid) / w)); return mix(d.acidColor, d.baseColor, f);
    }
    function mix(a, b, f) { const A = hex(a), B = hex(b); const m = i => Math.round(A[i] * (1 - f) + B[i] * f);
      return 'rgba(' + m(0) + ',' + m(1) + ',' + m(2) + ',' + (A[3] * (1 - f) + B[3] * f).toFixed(2) + ')'; }
    function measure(c) {
      const V = c.volumeMl; const out = { tempC: c.tempC, volumeMl: V, pH: null, conductivity: 0, massG: 0 };
      if (V > 0) { const s = Sol.solve(c.aq, V); out.pH = s.pH; let k = 0; for (const key in c.aq) { const i = Chem.ionInfo(key); if (i) k += Math.abs(i.charge) * (c.aq[key] / s.L) * 6; }
        k += (s.h + 1e-14 / s.h) * 300; out.conductivity = k; // mS/cm, rough (strong electrolyte ~ 6 per |z| M)
      }
      out.massG = c.waterMl; for (const k in c.liquids) out.massG += c.liquids[k].ml * ((data.species[k] || {}).rho || 1);
      for (const k in c.solids) { const sp = data.species[k]; out.massG += c.solids[k].mol * (sp ? sp.M : (Chem.salts[k] ? Chem.molarMass(k) : 100)); }
      for (const k in c.aq) { const sp = data.species[k]; const i = Chem.ionInfo(k); const m = sp ? sp.M : (i ? ionMass(i.base) : 0); out.massG += c.aq[k] * m; }
      out.massG = Math.round(out.massG * 100) / 100; return out;
    }
    function ionMass(base) { const m = Chem.molarMass(base); return isNaN(m) ? 0 : m; }
    function look(c) {
      const m = measure(c); const liq = liquidLook(c); const ss = suspended(c);
      const ic = m.pH !== null ? indicatorColor(c, m.pH) : null;
      return { pH: m.pH, tempC: c.tempC, liquid: ic && liq ? { color: ic, alpha: 0.7 } : liq, indicatorColor: ic, solids: ss.solids, turbidity: ss.turbidity,
        gasClouds: gasClouds(c), layers: c.layers || null, volumeMl: m.volumeMl, liquids: Object.keys(c.liquids).map(k => ({ key: k, ml: c.liquids[k].ml, color: c.liquids[k].color || (data.species[k] || {}).color, miscible: c.liquids[k].miscible })),
        conductivity: m.conductivity, massG: m.massG };
    }
    // ---- gas detection tools ----
    function detect(c, tool, opts) {
      const t = data.reagents.gasTests[tool]; if (!t) return { result: 'none', textAr: 'أداة غير معروفة' };
      const cloud = c.gasCloud || {}; let best = null;
      for (const g in cloud) { if (cloud[g] < 1e-6) continue; const r = t.results[g]; if (r && (!best || cloud[g] > cloud[best.gas])) best = Object.assign({ gas: g }, r); }
      if (!best) return { result: 'none', gas: null, textAr: 'لا تغيّر ملحوظ' };
      return Object.assign({ result: 'positive' }, best, { tool: tool });
    }
    function odor(c) { const out = []; for (const g in (c.gasCloud || {})) { if (c.gasCloud[g] > 1e-6) { const o = data.reagents.odors[g]; if (o) out.push({ gas: g, odorAr: o }); } } return out; }
    // N2O4 <-> 2NO2 colour fraction of NO2 (closed tube): Kp(T) from van't Hoff (dH=+57 kJ for N2O4 -> 2NO2)
    function no2Fraction(tempC) { const T = Chem.toK(tempC); const Kp = 0.141 * Math.exp(-57 / Chem.R * (1 / T - 1 / 298.15)); const a = Math.sqrt(Kp / (Kp + 4)); return a; }
    return { look, measure, detect, odor, liquidLook, indicatorColor, no2Fraction, EPS };
  }
  return { make, EPS };
});
