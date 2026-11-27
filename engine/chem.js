/* Chem: formulas, molar mass, salts, thermodynamics, kinetics. UMD (browser + Node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Chem = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const R = 8.314462618e-3; // kJ/(mol*K)
  const Kw = 1e-14;
  let MASS = {};
  let SALTS = {}; // formula -> {c, a, nuC, nuA}

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // ---------- ions ----------
  function ionInfo(key) {
    const m = /^(.+?)\^(\d*)([+-])$/.exec(key);
    if (!m) return null;
    const z = (m[2] ? +m[2] : 1) * (m[3] === '+' ? 1 : -1);
    return { key, base: m[1], charge: z, isCation: z > 0 };
  }
  function wrap(base, n) {
    if (n === 1) return base;
    const poly = (base.match(/[A-Z]/g) || []).length > 1 || /\d/.test(base);
    return (poly ? '(' + base + ')' : base) + n;
  }
  function saltFormula(cKey, aKey) {
    const c = ionInfo(cKey), a = ionInfo(aKey);
    const g = gcd(Math.abs(c.charge), Math.abs(a.charge));
    const nuC = Math.abs(a.charge) / g, nuA = c.charge / g;
    let f = wrap(c.base, nuC) + wrap(a.base, nuA);
    // Hg2Cl2-style: cation with count 1 stays unwrapped (handled in wrap)
    return { formula: f, nuC, nuA, c: cKey, a: aKey };
  }
  function buildSalts(ions) {
    SALTS = {};
    ions.cations.forEach(c => ions.anions.forEach(a => {
      const s = saltFormula(c.key, a.key);
      SALTS[s.formula] = s;
    }));
  }

  // ---------- formulas / mass ----------
  function parseFormula(f) {
    f = f.replace(/\^.*$/, '').replace(/\((aq|s|l|g|conc)\)$/, '');
    const parts = f.split('.');
    const total = {};
    parts.forEach((p, i) => {
      let mult = 1;
      const m = /^(\d+)(.*)$/.exec(p);
      if (i > 0 && m) { mult = +m[1]; p = m[2]; }
      const stack = [{}];
      const re = /([A-Z][a-z]?)(\d*)|(\()|\)(\d*)/g;
      let t;
      while ((t = re.exec(p))) {
        if (t[1]) { const n = t[2] ? +t[2] : 1; const top = stack[stack.length - 1]; top[t[1]] = (top[t[1]] || 0) + n; }
        else if (t[3]) stack.push({});
        else {
          const k = t[4] ? +t[4] : 1; const top = stack.pop(); const below = stack[stack.length - 1];
          for (const e in top) below[e] = (below[e] || 0) + top[e] * k;
        }
      }
      for (const e in stack[0]) total[e] = (total[e] || 0) + stack[0][e] * mult;
    });
    return total;
  }
  function molarMass(f) {
    const c = parseFormula(f); let m = 0;
    for (const e in c) { if (!(e in MASS)) return NaN; m += MASS[e] * c[e]; }
    return m;
  }
  // element balance of an equation given parsed reactants/products [{species, coef}]
  function isBalanced(rx) {
    const tally = side => { const t = {}; side.forEach(s => { if (/[\[\]]/.test(s.species) || s.species === 'no reaction') return; const c = parseFormula(s.species); for (const e in c) t[e] = (t[e] || 0) + c[e] * s.coef; }); return t; };
    const L = tally(rx.reactants), Rr = tally(rx.products);
    const els = new Set([...Object.keys(L), ...Object.keys(Rr)]);
    for (const e of els) if ((L[e] || 0) !== (Rr[e] || 0)) return false;
    return true;
  }

  // ---------- thermodynamics & kinetics ----------
  const toK = c => c + 273.15;
  function deltaG(dH_kJ, dS_JK, T_K) { return dH_kJ - T_K * dS_JK / 1000; }
  function K_eq(dG_kJ, T_K) { return Math.exp(-dG_kJ / (R * T_K)); }
  // Arrhenius relative to a reference: rate factor = exp(-Ea/R (1/T - 1/Tref)); Tref=298.15 K
  function arrhenius(Ea_kJ, T_K, Tref) { Tref = Tref || 298.15; return Math.exp(-Ea_kJ / R * (1 / T_K - 1 / Tref)); }
  // practical reaction speed (1/s): k = A exp(-Ea/RT) with A tuned so that Ea~50 kJ at 25C gives ~0.05/s
  function rateConstant(Ea_kJ, T_K, A) { A = A || 1.0e9; return A * Math.exp(-Ea_kJ / (R * T_K)); }
  function logPh(h) { return -Math.log10(h); }

  function init(data) {
    MASS = {};
    data.elements.forEach(e => { MASS[e.symbol] = e.atomicMass; });
    buildSalts(data.ions);
    return api;
  }

  const api = {
    R, Kw, init, ionInfo, saltFormula, parseFormula, molarMass, isBalanced,
    toK, deltaG, K_eq, arrhenius, rateConstant, logPh, gcd,
    get salts() { return SALTS; },
    get mass() { return MASS; },
    saltByIons(c, a) { const s = saltFormula(c, a); return s; },
  };
  return api;
});
