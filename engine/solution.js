/* Solution: acid-base speciation + pH from charge balance. Concentrations in mol/L.
   Design: H+ and OH- are never stored. Strong acids add their anion only; strong bases add their cation only.
   pH is found by solving charge balance over strong ions + weak acid/base systems + metal-ion hydrolysis. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chem.js'));
  else root.Solution = factory(root.Chem);
})(typeof self !== 'undefined' ? self : this, function (Chem) {
  'use strict';
  const Kw = 1e-14;
  // members: most protonated first. pKa[i] is for member i -> i+1.
  const SYSTEMS = {
    carbonate: { members: ['H2CO3(aq)', 'HCO3^-', 'CO3^2-'], aliases: ['CO2(aq)'], pKa: [6.35, 10.33], gas: 'CO2', sol: 0.033, kdeg: 0.02, nameAr: 'كربونات' },
    sulfite: { members: ['H2SO3(aq)', 'HSO3^-', 'SO3^2-'], aliases: ['SO2(aq)'], pKa: [1.86, 7.2], gas: 'SO2', sol: 0.03, kdeg: 0.05, nameAr: 'كبريتيت' },
    sulfide: { members: ['H2S(aq)', 'HS^-', 'S^2-'], aliases: [], pKa: [7.0, 13.0], gas: 'H2S', sol: 0.08, kdeg: 0.05, nameAr: 'كبريتيد' },
    phosphate: { members: ['H3PO4(aq)', 'H2PO4^-', 'HPO4^2-', 'PO4^3-'], aliases: [], pKa: [2.15, 7.2, 12.35], nameAr: 'فوسفات' },
    oxalate: { members: ['H2C2O4(aq)', 'HC2O4^-', 'C2O4^2-'], aliases: [], pKa: [1.25, 4.27], nameAr: 'أكسالات' },
    sulfate: { members: ['HSO4^-', 'SO4^2-'], aliases: [], pKa: [1.99], nameAr: 'كبريتات' },
    acetate: { members: ['CH3COOH(aq)', 'CH3COO^-'], aliases: [], pKa: [4.76], nameAr: 'أسيتات' },
    formate: { members: ['HCOOH(aq)', 'HCOO^-'], aliases: [], pKa: [3.75], nameAr: 'فورمات' },
    benzoate: { members: ['C6H5COOH(aq)', 'C6H5COO^-'], aliases: [], pKa: [4.2], nameAr: 'بنزوات' },
    lactate: { members: ['C3H6O3(aq)', 'C3H5O3^-'], aliases: [], pKa: [3.86], nameAr: 'لاكتات' },
    salicylate: { members: ['C7H6O3(aq)', 'C7H5O3^-'], aliases: [], pKa: [2.97], nameAr: 'سالسيلات' },
    citrate: { members: ['C6H8O7(aq)', 'C6H7O7^-', 'C6H6O7^2-', 'C6H5O7^3-'], aliases: [], pKa: [3.13, 4.76, 6.4], nameAr: 'سيترات' },
    ammonium: { members: ['NH4^+', 'NH3(aq)'], aliases: [], pKa: [9.25], gas: 'NH3', sol: 2.5, kdeg: 0.004, nameAr: 'أمونيوم' },
    cyanide: { members: ['HCN(aq)', 'CN^-'], aliases: [], pKa: [9.21], gas: 'HCN', sol: 0.05, kdeg: 0.01, nameAr: 'سيانيد' },
    nitrite: { members: ['HNO2(aq)', 'NO2^-'], aliases: [], pKa: [3.35], gas: 'NO2', sol: 0.02, kdeg: 0.1, nameAr: 'نيتريت' },
    thiosulfate: { members: ['HS2O3^-', 'S2O3^2-'], aliases: [], pKa: [1.6], nameAr: 'ثيوكبريتات' },
    fluoride: { members: ['HF(aq)', 'F^-'], aliases: [], pKa: [3.17], nameAr: 'فلوريد' },
    thiocyanate: { members: ['HSCN(aq)', 'SCN^-'], aliases: [], pKa: [-1.3], nameAr: 'ثيوسيانات' },
  };
  // hydrolysis of metal aqua ions: M^n+ + H2O <-> M(OH)^(n-1)+ + H+
  const METAL_PKA = { 'Fe^3+': 2.2, 'Al^3+': 5.0, 'Cr^3+': 3.9, 'Cu^2+': 7.5, 'Zn^2+': 9.0, 'Fe^2+': 9.5, 'Pb^2+': 7.8,
    'Ni^2+': 9.9, 'Co^2+': 9.6, 'Mn^2+': 10.6, 'Mg^2+': 11.4, 'Hg^2+': 3.4, 'Bi^3+': 1.1, 'Cd^2+': 10.1, 'Hg2^2+': 5.0 };
  // dichromate/chromate: 2 CrO4^2- + 2 H+ <-> Cr2O7^2- + H2O ; K = 10^14.4 (per M^-1 ... with [H+]^2)
  const K_CHROMATE = Math.pow(10, 14.4);

  const MEMBER_INDEX = {}; // key -> {sys, i}
  Object.keys(SYSTEMS).forEach(n => {
    SYSTEMS[n].members.forEach((k, i) => { MEMBER_INDEX[k] = { sys: n, i }; });
    SYSTEMS[n].aliases.forEach(k => { MEMBER_INDEX[k] = { sys: n, i: 0 }; });
    SYSTEMS[n].z0 = (function () { const m = Chem.ionInfo(SYSTEMS[n].members[0]); return m ? m.charge : 0; })();
  });

  function fractions(sys, h) {
    const Ka = sys.pKa.map(p => Math.pow(10, -p));
    const terms = [1];
    for (let i = 0; i < Ka.length; i++) terms.push(terms[i] * Ka[i] / h);
    const s = terms.reduce((a, b) => a + b, 0);
    return terms.map(t => t / s);
  }
  function chromateParts(Ccr, h) {
    // Ccr = [CrO4] + 2[Cr2O7]; y = K h^2 x^2
    const a = 2 * K_CHROMATE * h * h, b = 1, c = -Ccr;
    const x = a === 0 ? Ccr : (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    return { cro4: x, cr2o7: K_CHROMATE * h * h * x * x };
  }

  // collect totals from aq (mol) -> concentrations
  function analyse(aq, V) {
    const L = V / 1000;
    const strong = []; const totals = {}; const metals = {}; let cr = 0;
    for (const k in aq) {
      const n = aq[k]; if (!(n > 1e-15)) continue;
      const c = n / L;
      if (k === 'CrO4^2-') { cr += c; continue; }
      if (k === 'Cr2O7^2-') { cr += 2 * c; continue; }
      if (MEMBER_INDEX[k]) { const m = MEMBER_INDEX[k]; totals[m.sys] = (totals[m.sys] || 0) + c; continue; }
      if (METAL_PKA[k]) { metals[k] = c; continue; }
      const info = Chem.ionInfo(k);
      if (info) strong.push({ key: k, z: info.charge, c });
    }
    return { strong, totals, metals, cr };
  }
  function chargeFn(an) {
    const sumStrong = an.strong.reduce((a, s) => a + s.z * s.c, 0);
    return function (h) {
      let q = h - Kw / h + sumStrong;
      for (const n in an.totals) {
        const sys = SYSTEMS[n]; const fr = fractions(sys, h);
        let s = 0; for (let i = 0; i < fr.length; i++) s += fr[i] * (sys.z0 - i);
        q += an.totals[n] * s;
      }
      for (const k in an.metals) {
        const z = Chem.ionInfo(k).charge; const Ka = Math.pow(10, -METAL_PKA[k]);
        const a0 = h / (h + Ka); q += an.metals[k] * (a0 * z + (1 - a0) * (z - 1));
      }
      if (an.cr > 0) { const p = chromateParts(an.cr, h); q += -2 * p.cro4 - 2 * p.cr2o7; }
      return q;
    };
  }
  function solve(aq, V) {
    if (!(V > 0)) return { h: 1e-7, pH: 7, an: analyse(aq, 1), free: () => 0 };
    const an = analyse(aq, V); const f = chargeFn(an);
    let lo = -2.5, hi = 15.5; // log10(h)
    // f increasing with h: find root in log space
    for (let i = 0; i < 90; i++) {
      const mid = (lo + hi) / 2; const v = f(Math.pow(10, -mid)); // mid is pH
      if (v > 0) lo = mid; else hi = mid; // v>0 => too acidic => raise pH
    }
    const pH = (lo + hi) / 2, h = Math.pow(10, -pH);
    const L = V / 1000;
    function free(key) { // free concentration (mol/L) of the named species at this pH
      if (key === 'H^+') return h; if (key === 'OH^-') return Kw / h;
      if (key === 'CrO4^2-' || key === 'Cr2O7^2-') { if (!an.cr) return 0; const p = chromateParts(an.cr, h); return key === 'CrO4^2-' ? p.cro4 : p.cr2o7; }
      const m = MEMBER_INDEX[key];
      if (m) { const T = an.totals[m.sys] || 0; if (!T) return 0; return T * fractions(SYSTEMS[m.sys], h)[m.i]; }
      if (METAL_PKA[key]) { const T = an.metals[key] || 0; return T * h / (h + Math.pow(10, -METAL_PKA[key])); }
      return (aq[key] || 0) / L;
    }
    return { h, pH, an, free, V, L };
  }
  // rewrite member keys of every system to the equilibrium speciation (keeps display/availability consistent)
  function speciate(aq, V) {
    const sol = solve(aq, V); if (!(V > 0)) return sol; const L = V / 1000;
    for (const name in sol.an.totals) {
      const sys = SYSTEMS[name]; const T = sol.an.totals[name]; const fr = fractions(sys, sol.h);
      sys.members.concat(sys.aliases).forEach(k => delete aq[k]);
      sys.members.forEach((k, i) => { const n = T * fr[i] * L; if (n > 1e-13) aq[k] = n; });
    }
    if (sol.an.cr > 0) {
      const p = chromateParts(sol.an.cr, sol.h); delete aq['CrO4^2-']; delete aq['Cr2O7^2-'];
      if (p.cro4 * L > 1e-13) aq['CrO4^2-'] = p.cro4 * L; if (p.cr2o7 * L > 1e-13) aq['Cr2O7^2-'] = p.cr2o7 * L;
    }
    return sol;
  }
  // gas supersaturation: returns [{gas, mol, sys}] amounts that should leave the liquid now
  function gasExcess(aq, V, sol) {
    sol = sol || solve(aq, V); const out = [];
    for (const name in sol.an.totals) {
      const sys = SYSTEMS[name]; if (!sys.gas) continue;
      const neutral = sol.free(sys.members[0] === 'NH4^+' ? 'NH3(aq)' : sys.members[0]);
      const over = neutral - sys.sol; if (over > 0) out.push({ gas: sys.gas, mol: over * sol.L, sys: name });
    }
    return out;
  }
  // remove `mol` of total from a system keeping speciation proportional
  function removeTotal(aq, name, mol) {
    const sys = SYSTEMS[name]; const keys = sys.members.concat(sys.aliases);
    const tot = keys.reduce((a, k) => a + (aq[k] || 0), 0); if (tot <= 0) return 0;
    const take = Math.min(mol, tot); const f = take / tot;
    keys.forEach(k => { if (aq[k]) { aq[k] -= aq[k] * f; if (aq[k] < 1e-14) delete aq[k]; } });
    return take;
  }
  function netCharge(aq) { let q = 0; for (const k in aq) { const i = Chem.ionInfo(k); if (i) q += i.charge * aq[k]; } return q; }

  return { SYSTEMS, METAL_PKA, MEMBER_INDEX, Kw, solve, speciate, gasExcess, removeTotal, fractions, analyse, netCharge, K_CHROMATE };
});
