/* Equilibrium layer: salt dissolution/precipitation by Ksp, amphoteric + ammine complexes,
   gas evolution from supersaturated weak-acid systems, Le Chatelier complex equilibria. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chem.js'), require('./solution.js'));
  else root.Equilibrium = factory(root.Chem, root.Solution);
})(typeof self !== 'undefined' ? self : this, function (Chem, Sol) {
  'use strict';
  const AMPH = { 'Zn^2+': { cx: 'Zn(OH)4^2-', pH: 12.3 }, 'Al^3+': { cx: 'Al(OH)4^-', pH: 11.8 },
    'Pb^2+': { cx: 'Pb(OH)4^2-', pH: 12.6 }, 'Cr^3+': { cx: 'Cr(OH)4^-', pH: 12.8 } };
  const AMMINE = { 'Cu^2+': { cx: 'Cu(NH3)4^2+', n: 4, thr: 0.15 }, 'Ag^+': { cx: 'Ag(NH3)2^+', n: 2, thr: 0.3 },
    'Ni^2+': { cx: 'Ni(NH3)6^2+', n: 6, thr: 0.2 }, 'Co^2+': { cx: 'Co(NH3)6^2+', n: 6, thr: 0.3 },
    'Cd^2+': { cx: 'Cd(NH3)4^2+', n: 4, thr: 0.2 }, 'Zn^2+': { cx: 'Zn(NH3)4^2+', n: 4, thr: 0.2 } };
  // Le Chatelier complex equilibria: product total from reactants; K at 25C and dH (kJ/mol, forward)
  const EQ = [
    { id: 'FeSCN', parts: [{ k: 'Fe^3+', nu: 1 }, { k: 'SCN^-', nu: 1 }], cx: 'FeSCN^2+', K25: 138, dH: -10 },
    { id: 'CoCl4', parts: [{ k: 'Co^2+', nu: 1 }, { k: 'Cl^-', nu: 4 }], cx: 'CoCl4^2-', K25: 4e-3, dH: 50 },
  ];
  const ADD_COMPLEX_MAX = 40; // bisection iterations

  function make(data) {
    const M = data.solubilityMatrix.pairs;
    const SALTS = Chem.salts;
    // reverse map: cation key -> [{anion, entry, salt}]
    const byCation = {};
    for (const c in M) for (const a in M[c]) { (byCation[c] = byCation[c] || []).push({ c, a, entry: M[c][a], salt: Chem.saltFormula(c, a) }); }
    const speciesColor = k => (data.species[k] && data.species[k].color) || null;

    function sysOf(a) { return Sol.MEMBER_INDEX[a] ? Sol.MEMBER_INDEX[a].sys : null; }
    function anionTotal(aq, a) {
      const s = sysOf(a); if (!s) return aq[a] || 0;
      const sys = Sol.SYSTEMS[s]; return sys.members.concat(sys.aliases).reduce((x, k) => x + (aq[k] || 0), 0);
    }
    function copyAq(aq) { return Object.assign({}, aq); }
    function applyChange(aq, p, x) { // x>0 precipitate, x<0 dissolve (formula units)
      aq[p.c] = (aq[p.c] || 0) - p.salt.nuC * x; if (aq[p.c] < 1e-15) delete aq[p.c];
      if (p.a === 'OH^-') return;
      const s = sysOf(p.a);
      if (x > 0) { if (s) Sol.removeTotal(aq, s, p.salt.nuA * x); else { aq[p.a] = (aq[p.a] || 0) - p.salt.nuA * x; if (aq[p.a] < 1e-15) delete aq[p.a]; } }
      else aq[p.a] = (aq[p.a] || 0) - p.salt.nuA * x;
    }
    function ionProduct(aq, V, p, x) {
      const t = copyAq(aq); applyChange(t, p, x); const sol = Sol.solve(t, V);
      return Math.pow(sol.free(p.c), p.salt.nuC) * Math.pow(sol.free(p.a), p.salt.nuA);
    }
    // one pair equilibrium; returns signed x (formula units) moved to solid
    function equilibratePair(c, V, p, dt, allowDiss) {
      const sf = p.salt.formula; const solid = c.solids[sf]; const s = solid ? solid.mol : 0;
      const cat = c.aq[p.c] || 0; if (!cat && !s) return 0;
      const anAvail = p.a === 'OH^-' ? Infinity : anionTotal(c.aq, p.a);
      if (!anAvail && !s) return 0;
      let hi = Math.min(cat / p.salt.nuC, anAvail / p.salt.nuA);
      if (!(hi > 0) && !s) return 0;
      const ksp = p.entry.ksp, ip0 = hi > 0 || s ? ionProduct(c.aq, V, p, 0) : 0;
      let x = 0;
      // nucleation barrier: trivalent hydroxides stay in (acidic) solution until strongly supersaturated, as in real FeCl3/AlCl3 solutions
      const nuc = (!s && p.a === 'OH^-' && Math.abs(Chem.ionInfo(p.c).charge) >= 3) ? 3000 : 1;
      if (ip0 > ksp * 1.000001 * nuc && hi > 1e-12) {
        let lo = 0;
        for (let i = 0; i < ADD_COMPLEX_MAX; i++) { const mid = (lo + hi) / 2; if (ionProduct(c.aq, V, p, mid) > ksp) lo = mid; else hi = mid; }
        x = (lo + hi) / 2;
      } else if (s > 0 && ip0 < ksp * 0.999999) {
        if (ionProduct(c.aq, V, p, -s) <= ksp) x = -s; else {
          let lo = -s, up = 0; // IP decreasing in x: root between
          for (let i = 0; i < ADD_COMPLEX_MAX; i++) { const mid = (lo + up) / 2; if (ionProduct(c.aq, V, p, mid) > ksp) lo = mid; else up = mid; }
          x = (lo + up) / 2;
        }
      }
      if (x < 0) { // dissolution is rate-limited: chunk << powder < fresh precipitate; at most one step per settle()
        if (!allowDiss) return 0;
        const kd = solid.form === 'chunk' ? 0.02 : (solid.form === 'precip' ? 1.0 : 0.4);
        const lim = s * (1 - Math.exp(-kd * dt)); if (-x > lim) x = -lim;
      }
      if (Math.abs(x) < 1e-13) return 0;
      applyChange(c.aq, p, x);
      c.addSolid(sf, x, { form: x > 0 ? 'precip' : (solid && solid.form), color: p.entry.color, texture: p.entry.texture, salt: sf, c: p.c, a: p.a });
      return x;
    }
    function dissolveSoluble(c) {
      if (!(c.waterMl > 0)) return;
      for (const sf in c.solids) {
        const s = SALTS[sf]; if (!s) continue;
        if (M[s.c] && M[s.c][s.a]) continue; // handled by Ksp
        const n = c.solids[sf].mol; if (n < 1e-14) continue;
        c.addAq(s.c, n * s.nuC); if (s.a !== 'OH^-') c.addAq(s.a, n * s.nuA);
        c.event('dissolve', { salt: sf, mol: n }); delete c.solids[sf];
      }
    }
    function precipitation(c, dt, allowDiss) {
      let changed = false; const V = c.volumeMl; if (!(V > 0)) return false;
      const cats = new Set(); for (const k in c.aq) if (byCation[k]) cats.add(k);
      for (const sf in c.solids) { const s = SALTS[sf]; if (s && byCation[s.c]) cats.add(s.c); }
      const list = []; cats.forEach(k => byCation[k].forEach(p => list.push(p)));
      list.sort((a, b) => a.entry.ksp - b.entry.ksp);
      for (const p of list) { const x = equilibratePair(c, V, p, dt, allowDiss); if (x) { changed = true; if (x > 0) c.event('precipitate', { salt: p.salt.formula, mol: x, color: p.entry.color, texture: p.entry.texture }); } }
      return changed;
    }
    function complexes(c) {
      const V = c.volumeMl; if (!(V > 0)) return false; let ch = false;
      let sol = Sol.solve(c.aq, V); const L = V / 1000;
      // amphoteric hydroxides in excess OH-
      for (const cat in AMPH) {
        const A = AMPH[cat]; const entry = M[cat] && M[cat]['OH^-']; if (!entry) continue;
        const p = { c: cat, a: 'OH^-', entry, salt: Chem.saltFormula(cat, 'OH^-') };
        const solid = c.solids[p.salt.formula]; const OHthr = Math.pow(10, A.pH - 14);
        if (solid && solid.mol > 1e-12) {
          const extra = (sol.free('OH^-') - OHthr) * L; const ohPerComplex = 4 - Chem.ionInfo(cat).charge; // M(OH)z + (4-z)OH- -> M(OH)4^(z-4)
          if (extra > 0) { const n = Math.min(solid.mol, extra / ohPerComplex); if (n > 1e-12) { c.addSolid(p.salt.formula, -n); c.addAq(A.cx, n); ch = true; c.event('complex', { kind: 'amphoteric', from: p.salt.formula, to: A.cx, mol: n }); sol = Sol.solve(c.aq, V); } }
        }
        const have = c.aq[A.cx] || 0;
        if (have > 1e-12 && sol.free('OH^-') < OHthr * 0.3) { c.addAq(A.cx, -have); c.addAq(cat, have); ch = true; c.event('complex', { kind: 'amphoteric-reverse', from: A.cx, to: cat, mol: have }); sol = Sol.solve(c.aq, V); }
      }
      // ammine complexes in excess NH3
      for (const cat in AMMINE) {
        const A = AMMINE[cat];
        for (const p of (byCation[cat] || [])) {
          if (!p.entry.excessNH3) continue;
          const solid = c.solids[p.salt.formula]; if (!solid || solid.mol < 1e-12) continue;
          const nh3 = sol.free('NH3(aq)'); if (nh3 <= A.thr) continue;
          const avail = (nh3 - A.thr) * L / A.n; const n = Math.min(solid.mol * p.salt.nuC, avail);
          if (n > 1e-12) { const solidMol = n / p.salt.nuC; c.addSolid(p.salt.formula, -solidMol); c.addAq(A.cx, n);
            Sol.removeTotal(c.aq, 'ammonium', n * A.n); if (p.a !== 'OH^-') c.addAq(p.a, solidMol * p.salt.nuA);
            ch = true; c.event('complex', { kind: 'ammine', from: p.salt.formula, to: A.cx, mol: n }); sol = Sol.solve(c.aq, V); }
        }
        const have = c.aq[A.cx] || 0;
        if (have > 1e-12 && sol.free('NH3(aq)') < A.thr * 0.35) { c.addAq(A.cx, -have); c.addAq(cat, have); c.addAq('NH3(aq)', have * A.n); ch = true; c.event('complex', { kind: 'ammine-reverse', from: A.cx, to: cat, mol: have }); sol = Sol.solve(c.aq, V); }
      }
      return ch;
    }
    function gases(c, dt, allowSlow) {
      const V = c.volumeMl; if (!(V > 0)) return false; let ch = false;
      const sol = Sol.solve(c.aq, V); const hot = Math.exp(-0.03 * (c.tempC - 25));
      const ex = Sol.gasExcess(c.aq, V, sol);
      for (const e of ex) {
        const sys = Sol.SYSTEMS[e.sys]; const over = e.mol; // already relative to 25C solubility
        const extraHot = c.tempC > 25 ? sys.sol * (1 - hot) * (V / 1000) : 0; // hotter water holds less gas
        const amount = Math.max(0, over + extraHot * (over > 0 ? 1 : 0)) * (1 - Math.exp(-dt / 1.2));
        if (amount < 1e-12) continue;
        const took = Sol.removeTotal(c.aq, e.sys, amount); if (took <= 0) continue;
        if (c.sealed) c.addGas(e.gas, took); else c.event('gas', { gas: e.gas, mol: took });
        ch = true;
      }
      // slow degassing of dissolved gas from an open vessel (first order), faster when warm
      if (!c.sealed && allowSlow) {
        const sol2 = Sol.solve(c.aq, V);
        for (const name in sol2.an.totals) {
          const sys = Sol.SYSTEMS[name]; if (!sys.gas || !sys.kdeg) continue;
          const neutralKey = sys.members[0] === 'NH4^+' ? 'NH3(aq)' : sys.members[0];
          const nMol = sol2.free(neutralKey) * sol2.L; if (nMol < 1e-10) continue;
          const k = sys.kdeg * (1 + Math.max(0, c.tempC - 25) / 20);
          const amt = Math.min(nMol, nMol * (1 - Math.exp(-k * dt)));
          const took = Sol.removeTotal(c.aq, name, amt);
          if (took > 1e-12) { c.event('gas', { gas: sys.gas, mol: took, slow: true }); ch = true; }
        }
      }
      // hot ammonia leaves even below the supersaturation threshold
      if (c.tempC > 55 && (c.aq['NH3(aq)'] || 0) > 1e-6) {
        const n = Math.min(c.aq['NH3(aq)'], c.aq['NH3(aq)'] * (1 - Math.exp(-dt * 0.05 * (c.tempC - 50) / 10)));
        if (n > 1e-10) { c.addAq('NH3(aq)', -n); c.event('gas', { gas: 'NH3', mol: n }); ch = true; }
      }
      // thiosulfate decomposes in acid: S2O3^2- + 2H+ -> S + SO2 + H2O
      const thio = Sol.SYSTEMS.thiosulfate.members.reduce((a, k) => a + (c.aq[k] || 0), 0);
      if (thio > 1e-10 && sol.pH < 3.2) {
        const n = thio * (1 - Math.exp(-dt * 0.15)); Sol.removeTotal(c.aq, 'thiosulfate', n);
        c.addSolid('S', n, { form: 'precip', color: '#f4e9a0', texture: 'milky', colloid: true }); c.addAq('H2SO3(aq)', n); ch = true;
        c.event('decompose', { species: 'S2O3^2-', products: ['S', 'SO2'], mol: n });
      }
      return ch;
    }
    function eqComplex(c, spec) {
      const V = c.volumeMl; if (!(V > 0)) return false; const L = V / 1000;
      const T = Chem.toK(c.tempC); const K = spec.K25 * Math.exp(-spec.dH / Chem.R * (1 / T - 1 / 298.15));
      const R0 = spec.parts.map(p => (c.aq[p.k] || 0) + p.nu * (c.aq[spec.cx] || 0));
      if (R0.some(v => !(v > 0))) { if ((c.aq[spec.cx] || 0) > 0) { /* reactant missing -> dissociate fully */ } else return false; }
      const hi = Math.min(...spec.parts.map((p, i) => R0[i] / p.nu));
      const F = x => { let d = 1; spec.parts.forEach((p, i) => { d *= Math.pow(Math.max(R0[i] - p.nu * x, 1e-30) / L, p.nu); }); return (x / L) / d; };
      let lo = 0, up = hi; for (let i = 0; i < 60; i++) { const mid = (lo + up) / 2; if (F(mid) < K) lo = mid; else up = mid; }
      const x = (lo + up) / 2, cur = c.aq[spec.cx] || 0;
      if (Math.abs(x - cur) < 1e-12) return false;
      const d = x - cur; spec.parts.forEach(p => c.addAq(p.k, -p.nu * d)); c.addAq(spec.cx, d); return true;
    }
    function equilibria(c) { let ch = false; EQ.forEach(s => { if (eqComplex(c, s)) ch = true; }); return ch; }

    function settle(c, dt) {
      dt = dt === undefined ? 5 : dt; let any = false;
      for (let i = 0; i < 12; i++) {
        let ch = false;
        dissolveSoluble(c);
        if (c.volumeMl > 0) Sol.speciate(c.aq, c.volumeMl);
        if (precipitation(c, dt, i === 0)) ch = true;
        if (complexes(c)) ch = true;
        if (equilibria(c)) ch = true;
        if (gases(c, dt, i === 0)) ch = true;
        if (c.volumeMl > 0) Sol.speciate(c.aq, c.volumeMl);
        if (!ch) break; any = true;
      }
      return any;
    }
    return { settle, precipitation, complexes, gases, equilibria, dissolveSoluble, AMPH, AMMINE, EQ, byCation };
  }
  return { make, AMPH, AMMINE, EQ };
});
