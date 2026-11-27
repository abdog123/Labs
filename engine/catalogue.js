/* Catalogue executor: runs rule-driven reactions from reactions.json against a Container.
   Thermodynamics (dG = dH - T dS), activation energy / ignition temperature, catalysts, surface area,
   concentration, UV light and electricity (Faraday) all gate and scale the reaction extent. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chem.js'), require('./solution.js'));
  else root.Catalogue = factory(root.Chem, root.Solution);
})(typeof self !== 'undefined' ? self : this, function (Chem, Sol) {
  'use strict';
  const F = 96485; // C/mol e-
  const EXEC = new Set(['single-displacement', 'halogen-displacement', 'redox', 'thermal-decomposition', 'combustion', 'smelting',
    'conc-h2so4', 'dehydration', 'substitution', 'addition', 'hydrogenation', 'hydration', 'esterification', 'saponification',
    'hydrolysis', 'oxidation', 'haloform', 'polymerization', 'electrolysis']);
  const N_E = { electro_water: 4, electro_cuso4: 4, electro_nacl_aq: 2, electro_pbbr2: 2 };
  const CONC = { H2SO4: 'H2SO4(conc)', HNO3: 'HNO3(conc)', HCl: 'HCl(conc)' };
  const STRONG_ACIDS = { HCl: ['Cl^-', 1], HBr: ['Br^-', 1], HI: ['I^-', 1], HNO3: ['NO3^-', 1], H2SO4: ['SO4^2-', 2], HClO4: ['ClO4^-', 1] };
  const STRONG_BASES = { NaOH: ['Na^+', 1], KOH: ['K^+', 1], 'Ba(OH)2': ['Ba^2+', 1], 'Ca(OH)2': ['Ca^2+', 1] };
  const TON_C = (Ea, cat) => 40 + 2.2 * Ea * (cat ? 0.6 : 1);

  function make(data) {
    const SP = data.species; const SALTS = Chem.salts; const RX = data.reactions.filter(r => EXEC.has(r.type));
    const keyFor = t => { for (const s of ['(s)', '(l)', '(g)', '(aq)', '']) if (SP[t + s]) return t + s; return null; };

    // ---- token location: returns {avail(), take(n), give(n), inf, kind} ----
    function locate0(c, t, rx) {
      if (t === 'H2O') return { kind: 'water', inf: c.waterMl > 0, avail: () => (c.waterMl > 0 ? Infinity : 0), take() {}, give() {} };
      if (t === '[O]' || t === 'peroxide') return { kind: 'virtual', avail: () => Infinity, take() {}, give() {} };
      if (t === 'H^+' || t === 'OH^-') {
        return { kind: 'ion-implicit', avail: () => { if (!(c.volumeMl > 0)) return 0; const s = Sol.solve(c.aq, c.volumeMl); return (t === 'H^+' ? s.h : 1e-14 / s.h) * s.L; }, take() {}, give() {} };
      }
      if (t.indexOf('^') >= 0 || /\(aq\)$/.test(t)) {
        return { kind: 'aq', avail: () => c.aq[t] || 0, take: n => c.addAq(t, -n), give: n => c.addAq(t, n) };
      }
      if (rx && rx.needsConc && CONC[t]) {
        const k = CONC[t]; const M = SP[k].M; const rho = SP[k].rho;
        return { kind: 'conc', avail: () => (c.liquids[k] ? c.liquids[k].ml * rho / M : 0), take: n => c.addLiquid(k, -n * M / rho), give: () => {} };
      }
      if (STRONG_ACIDS[t]) {
        const [an, nu] = STRONG_ACIDS[t];
        return { kind: 'acid', avail: () => { if (!(c.volumeMl > 0)) return 0; const s = Sol.solve(c.aq, c.volumeMl); const a = (c.aq[an] || 0) + (t === 'H2SO4' ? (c.aq['HSO4^-'] || 0) : 0);
          return Math.min(a / nu, s.h * s.L / nu); }, take: n => { if (t === 'H2SO4') { const k = c.aq['SO4^2-'] ? 'SO4^2-' : 'HSO4^-'; c.addAq(k, -n); } else c.addAq(an, -n * nu); }, give: n => c.addAq(an, n * nu) };
      }
      if (STRONG_BASES[t]) {
        const [cat, nu] = STRONG_BASES[t];
        return { kind: 'base', avail: () => (c.aq[cat] || 0) / nu, take: n => c.addAq(cat, -n * nu), give: n => c.addAq(cat, n * nu) };
      }
      if (t === 'NH3') return locate0(c, 'NH3(aq)', rx);
      const salt = SALTS[t];
      if (salt) {
        return { kind: 'salt', avail: () => Math.max((c.solids[t] ? c.solids[t].mol : 0) + Math.min((c.aq[salt.c] || 0) / salt.nuC, (salt.a === 'OH^-' ? Infinity : (c.aq[salt.a] || 0)) / salt.nuA) * (c.waterMl > 0 ? 1 : 0), 0),
          take: n => { const s = c.solids[t] ? c.solids[t].mol : 0; const f = Math.min(n, s); if (f > 0) c.addSolid(t, -f); const r = n - f; if (r > 0) { c.addAq(salt.c, -r * salt.nuC); if (salt.a !== 'OH^-') c.addAq(salt.a, -r * salt.nuA); } },
          give: n => c.addSolid(t, n, { form: 'precip', salt: t }) };
      }
      const k = keyFor(t);
      if (t === 'O2') return { kind: 'gas', avail: () => (c.sealed ? (c.gas['O2(g)'] || 0) : Infinity), take: n => { if (c.sealed) c.addGas('O2(g)', -n); }, give: n => { if (c.sealed) c.addGas('O2(g)', n); else c.event('gas', { gas: 'O2', mol: n }); } };
      if (!k) return { kind: 'solid', avail: () => (c.solids[t] ? c.solids[t].mol : 0), take: n => c.addSolid(t, -n), give: n => c.addSolid(t, n, { form: 'precip', color: '#ffffff' }) };
      const sp = SP[k];
      if (sp.phase === 'g') {
        const aqk = SP[t + '(aq)'] ? t + '(aq)' : null;
        return { kind: 'gas', avail: () => (c.gas[k] || 0) + (aqk ? (c.aq[aqk] || 0) : 0),
          take: n => { const g = Math.min(n, c.gas[k] || 0); if (g > 0) c.addGas(k, -g); if (aqk && n - g > 0) c.addAq(aqk, -(n - g)); },
          give: n => { const toAq = aqk && c.waterMl > 0 && !(rx && rx.gas === t && rx.type !== 'halogen-displacement');
            if (c.sealed) c.addGas(k, n); else if (toAq) c.addAq(aqk, n); else c.event('gas', { gas: t, mol: n }); } };
      }
      if (sp.phase === 'l') return { kind: 'liquid', avail: () => (c.liquids[k] ? c.liquids[k].ml * (sp.rho || 1) / sp.M : 0), take: n => c.addLiquid(k, -n * sp.M / (sp.rho || 1)), give: n => c.addLiquid(k, n * sp.M / (sp.rho || 1), { miscible: !!sp.miscible, formula: k, color: sp.color }) };
      if (sp.phase === 'aq') return { kind: 'aq', avail: () => c.aq[k] || 0, take: n => c.addAq(k, -n), give: n => c.addAq(k, n) };
      return { kind: 'solid', avail: () => (c.solids[k] ? c.solids[k].mol : 0) + (c.solids[t] ? c.solids[t].mol : 0), take: n => { const a = c.solids[k] ? c.solids[k].mol : 0; const f = Math.min(a, n); if (f > 0) c.addSolid(k, -f); if (n - f > 0) c.addSolid(t, -(n - f)); },
        give: n => c.addSolid(k, n, { form: 'precip', color: sp.color, name: sp.nameAr }) };
    }
    function locate(c, t, rx) {
      const h = locate0(c, t, rx); const aqk = SP[t + '(aq)'] && t.indexOf('^') < 0 && !/\(aq\)$/.test(t) ? t + '(aq)' : null;
      if (aqk && (h.kind === 'solid' || h.kind === 'liquid')) return { kind: h.kind, avail: () => h.avail() + (c.aq[aqk] || 0),
        take: n => { const f = Math.min(h.avail(), n); if (f > 0) h.take(f); if (n - f > 0) c.addAq(aqk, -(n - f)); }, give: h.give };
      return h;
    }
    function hasCatalyst(c, cat) {
      if (!cat) return true;
      if (cat === 'peroxide') return true;
      if (cat === 'H^+') return c.volumeMl > 0 && Sol.solve(c.aq, c.volumeMl).pH < 3;
      if (cat === 'H2SO4') return !!(c.liquids['H2SO4(conc)'] && c.liquids['H2SO4(conc)'].ml > 0.01) || (c.volumeMl > 0 && ((c.aq['SO4^2-'] || 0) + (c.aq['HSO4^-'] || 0) > 1e-4) && Sol.solve(c.aq, c.volumeMl).pH < 1.2);
      if (cat === 'H3PO4') return (c.aq['H3PO4(aq)'] || 0) > 1e-6;
      const k = keyFor(cat) || cat; return !!((c.solids[k] && c.solids[k].mol > 0) || (c.solids[cat] && c.solids[cat].mol > 0) || (c.solids[cat + '.cat(s)'] && c.solids[cat + '.cat(s)'].mol > 0));
    }
    function surfaceFactor(c, rx) {
      let f = 1, any = false;
      rx.reactants.forEach(r => { const k = keyFor(r.species) || r.species; const s = c.solids[k] || c.solids[r.species]; if (s) { any = true; f = Math.max(f, (s.form === 'powder' || s.form === 'precip') ? 4 : 1); } });
      return any ? f : 1;
    }
    // ignition / activation temperature (C) for heat-gated reactions
    function ignitionC(rx, hasCat) {
      let t = TON_C(rx.Ea_kJ, !!rx.catalyst && hasCat);
      if (rx.dS_JK > 0 && rx.dH_kJ > 0) t = Math.max(t, rx.dH_kJ * 1000 / rx.dS_JK - 273.15); // thermodynamic floor (dG=0)
      return t;
    }
    function rateFor(c, rx, T, hasCat) {
      if (rx.needsHeat) { const ton = ignitionC(rx, hasCat); if (c.tempC < ton) return 0; return Math.min(2, 0.03 + 0.004 * (c.tempC - ton)); }
      let k = 3 * Math.exp(-rx.Ea_kJ / 12) * Chem.arrhenius(rx.Ea_kJ, T);
      if (rx.catalyst && !hasCat) k *= 0.003;
      return k;
    }
    function massGrams(c) { let m = c.waterMl; for (const k in c.liquids) m += c.liquids[k].ml * (SP[k] && SP[k].rho || 1); for (const k in c.solids) { const sp = SP[k]; const mm = sp ? sp.M : (SALTS[k] ? Chem.molarMass(k) : 50); m += c.solids[k].mol * mm; } return Math.max(m, 1); }
    function describe(rx) { return { id: rx.id, type: rx.type, equation: rx.equation, dH: rx.dH_kJ, observationAr: rx.observationAr, gas: rx.gas }; }

    // run all executable reactions for dt seconds; returns list of reactions that progressed
    function run(c, dt) {
      const progressed = []; const T = Chem.toK(c.tempC);
      for (const rx of RX) {
        if (rx.needsLight && !c.uv) continue;
        if (rx.needsElectricity && !(c.current > 0)) continue;
        if (rx.slowPour && !(c.layers && c.layers.ringReady)) continue;
        const dG = Chem.deltaG(rx.dH_kJ, rx.dS_JK, T);
        if (dG > 8 && !rx.needsElectricity && !rx.needsHeat) continue;
        if (rx.needsHeat && rx.dS_JK > 0 && rx.dH_kJ > 0 && dG > 8) continue;
        const L = rx.reactants.map(r => locate(c, r.species, rx));
        let xiMax = Infinity, ok = true;
        for (let i = 0; i < L.length; i++) { const a = L[i].avail() / rx.reactants[i].coef; if (!(a > 1e-9)) { ok = false; break; } if (a < xiMax) xiMax = a; }
        if (!ok || !isFinite(xiMax)) continue;
        if (rx.needsConc && !rx.reactants.some(r => CONC[r.species]) && !(c.liquids['H2SO4(conc)'] || c.liquids['HNO3(conc)'] || c.liquids['HCl(conc)'])) continue;
        const cat = hasCatalyst(c, rx.catalyst); let xi;
        if (rx.needsElectricity) { const ne = N_E[rx.id] || 2; xi = c.current * dt / (ne * F); }
        else {
          const k = rateFor(c, rx, T, cat); if (!(k > 0)) continue;
          let kk = k * surfaceFactor(c, rx) * (1 + (c.stirred || 0)); if (rx.needsHeat) kk = k;
          xi = xiMax * (1 - Math.exp(-kk * dt));
        }
        xi = Math.min(xi, xiMax); if (xi < 1e-12) continue;
        L.forEach((h, i) => h.take(xi * rx.reactants[i].coef));
        rx.products.forEach(p => { const h = locate(c, p.species, rx); const n = xi * p.coef;
          if (rx.type === 'halogen-displacement' && SP[p.species + '(aq)'] && c.waterMl > 0) c.addAq(p.species + '(aq)', n);
          else if (rx.gas && p.species === rx.gas && h.kind !== 'gas') c.event('gas', { gas: p.species, mol: n }); else h.give(n); });
        // heat of reaction -> temperature (4.18 J/g/K)
        const dTc = (-rx.dH_kJ * 1000 * xi) / (massGrams(c) * 4.18); c.tempC += Math.max(-80, Math.min(400, dTc));
        c.event('reaction', Object.assign(describe(rx), { xi: xi, firstTime: !c._seen || !c._seen[rx.id] })); (c._seen = c._seen || {})[rx.id] = true;
        progressed.push(rx.id);
      }
      return progressed;
    }
    return { run, locate, hasCatalyst, ignitionC, rateFor, RX, EXEC, STRONG_ACIDS, STRONG_BASES, CONC };
  }
  return { make, EXEC, CONC, STRONG_ACIDS, STRONG_BASES };
});
