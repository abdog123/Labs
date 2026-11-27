/* PhysicsEngine: circuits (MNA, DC + AC phasors + transient), induction, optics/spectroscopy,
   photoelectric effect, cathode ray tube, gas laws, radioactivity (Geiger). UMD module. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhysicsEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = { h: 6.62607015e-34, c: 2.99792458e8, e: 1.602176634e-19, me: 9.1093837e-31, kB: 1.380649e-23, NA: 6.02214076e23, R: 8.314462618, eps0: 8.8541878128e-12, mu0: 4e-7 * Math.PI };
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

  // ---------------- complex helpers ----------------
  const cx = (re, im) => ({ re: re, im: im || 0 });
  const add = (a, b) => cx(a.re + b.re, a.im + b.im), sub = (a, b) => cx(a.re - b.re, a.im - b.im);
  const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const abs = a => Math.hypot(a.re, a.im), arg = a => Math.atan2(a.im, a.re);
  function solveLinear(A, b) { // complex Gaussian elimination with partial pivoting
    const n = b.length; for (let i = 0; i < n; i++) A[i].push(b[i]);
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (abs(A[r][i]) > abs(A[p][i])) p = r;
      if (abs(A[p][i]) < 1e-30) A[p][i] = cx(1e-30); if (p !== i) { const t = A[i]; A[i] = A[p]; A[p] = t; }
      for (let r = i + 1; r < n; r++) { const f = div(A[r][i], A[i][i]); if (f.re === 0 && f.im === 0) continue; for (let k = i; k <= n; k++) A[r][k] = sub(A[r][k], mul(f, A[i][k])); }
    }
    const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = A[i][n]; for (let k = i + 1; k < n; k++) s = sub(s, mul(A[i][k], x[k])); x[i] = div(s, A[i][i]); } return x;
  }

  // ---------------- circuits ----------------
  // element: {id,type,n1,n2, value...}; node 0 = ground. types: R, rheostat(R=Rmax*pos), C, L, bulb(R), V(dc: V, ac: V rms,f), I, switch(closed), ammeter, voltmeter, galvanometer, transformer(p1,p2,s1,s2,ratio)
  class Circuit {
    constructor() { this.elements = []; this.state = {}; }
    add(el) { this.elements.push(el); return this; }
    nodes() { const s = new Set(); this.elements.forEach(e => ['n1', 'n2', 'p1', 'p2', 's1', 's2'].forEach(k => { if (e[k] !== undefined && e[k] !== 0) s.add(e[k]); })); return Array.from(s); }
    solve(opts) {
      opts = opts || {}; const ac = opts.mode === 'ac', w = ac ? 2 * Math.PI * (opts.f || 50) : 0, dt = opts.dt || 0;
      const names = this.nodes(); const idx = {}; names.forEach((n, i) => { idx[n] = i; }); const N = names.length;
      let extra = 0; const ex = {}; this.elements.forEach(e => { if (e.type === 'V' || e.type === 'ammeter') ex[e.id] = N + extra++; if (e.type === 'transformer') { ex[e.id + ':p'] = N + extra++; ex[e.id + ':s'] = N + extra++; } });
      const M = N + extra; const A = Array.from({ length: M }, () => Array.from({ length: M }, () => cx(0))); const b = Array.from({ length: M }, () => cx(0));
      const ni = n => (n === 0 || n === undefined ? -1 : idx[n]);
      const stampY = (n1, n2, y) => { const i = ni(n1), j = ni(n2); if (i >= 0) A[i][i] = add(A[i][i], y); if (j >= 0) A[j][j] = add(A[j][j], y); if (i >= 0 && j >= 0) { A[i][j] = sub(A[i][j], y); A[j][i] = sub(A[j][i], y); } };
      const stampI = (n1, n2, I) => { const i = ni(n1), j = ni(n2); if (i >= 0) b[i] = sub(b[i], I); if (j >= 0) b[j] = add(b[j], I); }; // current I flowing n1->n2 through element => leaves n1
      const cond = {};
      this.elements.forEach(e => {
        const t = e.type; const R = t === 'R' ? e.R : t === 'rheostat' ? Math.max(1e-6, e.Rmax * e.pos) : t === 'bulb' ? e.R : t === 'galvanometer' ? (e.R || 50) : t === 'voltmeter' ? 1e9 : t === 'switch' ? (e.closed ? 1e-6 : 1e12) : null;
        if (R !== null) { stampY(e.n1, e.n2, cx(1 / R)); cond[e.id] = R; }
        else if (t === 'C') {
          if (ac) stampY(e.n1, e.n2, cx(0, w * e.C)); else if (dt) { const g = e.C / dt; const v0 = this.state[e.id + ':v'] || 0; stampY(e.n1, e.n2, cx(g)); stampI(e.n2, e.n1, cx(g * v0)); } else stampY(e.n1, e.n2, cx(1e-12));
        } else if (t === 'L') {
          if (ac) stampY(e.n1, e.n2, div(cx(1), cx(0, w * e.L))); else if (dt) { const g = dt / e.L; const i0 = this.state[e.id + ':i'] || 0; stampY(e.n1, e.n2, cx(g)); stampI(e.n1, e.n2, cx(i0)); } else stampY(e.n1, e.n2, cx(1e6));
        } else if (t === 'V' || t === 'ammeter') {
          const k = ex[e.id], i = ni(e.n1), j = ni(e.n2); // branch current from n1 -> n2 through source
          if (i >= 0) { A[i][k] = add(A[i][k], cx(1)); A[k][i] = add(A[k][i], cx(1)); } if (j >= 0) { A[j][k] = sub(A[j][k], cx(1)); A[k][j] = sub(A[k][j], cx(1)); }
          const volt = t === 'ammeter' ? 0 : (ac ? (e.acV !== undefined ? e.acV : (e.V || 0)) : (e.V || 0)); b[k] = cx(volt);
        } else if (t === 'I') stampI(e.n1, e.n2, cx(e.I));
        else if (t === 'transformer') {
          const kp = ex[e.id + ':p'], ks = ex[e.id + ':s'], p1 = ni(e.p1), p2 = ni(e.p2), s1 = ni(e.s1), s2 = ni(e.s2), n = e.ratio;
          if (p1 >= 0) A[p1][kp] = add(A[p1][kp], cx(1)); if (p2 >= 0) A[p2][kp] = sub(A[p2][kp], cx(1)); if (s1 >= 0) A[s1][ks] = add(A[s1][ks], cx(1)); if (s2 >= 0) A[s2][ks] = sub(A[s2][ks], cx(1));
          if (s1 >= 0) A[ks][s1] = add(A[ks][s1], cx(1)); if (s2 >= 0) A[ks][s2] = sub(A[ks][s2], cx(1)); if (p1 >= 0) A[ks][p1] = sub(A[ks][p1], cx(n)); if (p2 >= 0) A[ks][p2] = add(A[ks][p2], cx(n));
          A[kp][kp] = add(A[kp][kp], cx(1)); A[kp][ks] = add(A[kp][ks], cx(n));
        }
      });
      const x = solveLinear(A, b); const V = {}; names.forEach(n => { V[n] = x[idx[n]]; }); V[0] = cx(0);
      const vd = (e) => sub(V[e.n1 || 0] || cx(0), V[e.n2 || 0] || cx(0)); const res = { V, I: {}, VD: {}, P: {}, mode: ac ? 'ac' : 'dc', f: ac ? opts.f || 50 : 0 };
      this.elements.forEach(e => {
        let I = null;
        if (cond[e.id] !== undefined) I = div(vd(e), cx(cond[e.id])); else if (e.type === 'C') I = ac ? mul(vd(e), cx(0, w * e.C)) : (dt ? cx((e.C / dt) * (vd(e).re - (this.state[e.id + ':v'] || 0))) : cx(0));
        else if (e.type === 'L') I = ac ? div(vd(e), cx(0, w * e.L)) : (dt ? cx((this.state[e.id + ':i'] || 0) + (dt / e.L) * vd(e).re) : cx(0));
        else if (e.type === 'V' || e.type === 'ammeter') I = x[ex[e.id]]; else if (e.type === 'I') I = cx(e.I);
        if (I) { res.I[e.id] = I; res.VD[e.id] = vd(e); if (e.type === 'R' || e.type === 'rheostat' || e.type === 'bulb') res.P[e.id] = ac ? abs(I) * abs(I) * cond[e.id] : I.re * I.re * cond[e.id]; }
      });
      if (dt) this.elements.forEach(e => { if (e.type === 'C') this.state[e.id + ':v'] = vd(e).re; if (e.type === 'L') this.state[e.id + ':i'] = res.I[e.id].re; });
      return res;
    }
    // helpers
    reading(res, id) { const I = res.I[id]; return I ? { amps: abs(I), phaseDeg: deg(arg(I)), re: I.re } : null; }
    voltage(res, id) { const v = res.VD[id]; return v ? { volts: abs(v), phaseDeg: deg(arg(v)), re: v.re } : null; }
  }
  const circuits = {
    seriesRC_time: (R, Cap, V0, t) => V0 * (1 - Math.exp(-t / (R * Cap))),
    seriesRL_current: (R, L, V0, t) => (V0 / R) * (1 - Math.exp(-R * t / L)),
    rlcResonance: (L, Cap) => 1 / (2 * Math.PI * Math.sqrt(L * Cap)),
    reactanceC: (f, Cap) => 1 / (2 * Math.PI * f * Cap), reactanceL: (f, L) => 2 * Math.PI * f * L,
    seriesRLC: (R, L, Cap, f, Vrms) => { const X = 2 * Math.PI * f * L - 1 / (2 * Math.PI * f * Cap); const Z = Math.hypot(R, X); return { Z, I: Vrms / Z, phaseDeg: deg(Math.atan2(X, R)), powerFactor: R / Z, Pavg: (Vrms / Z) ** 2 * R, Q: Math.sqrt(L / Cap) / R }; },
  };
  // ---------------- electromagnetism ----------------
  const em = {
    faraday: (N, dPhi, dt) => -N * dPhi / dt,
    generatorEmf: (N, B, A, f, t) => N * B * A * 2 * Math.PI * f * Math.sin(2 * Math.PI * f * t),
    solenoidB: (N, I, length) => C.mu0 * N * I / length,
    wireForce: (B, I, L, thetaDeg) => B * I * L * Math.sin(rad(thetaDeg === undefined ? 90 : thetaDeg)),
    motionalEmf: (B, L, v) => B * L * v,
    transformer: (Vp, Np, Ns, eff) => { const Vs = Vp * Ns / Np; return { Vs, ratio: Ns / Np, type: Ns > Np ? 'step-up' : (Ns < Np ? 'step-down' : '1:1'), Is_over_Ip: Np / Ns, eff: eff === undefined ? 1 : eff }; },
    lorentzRadius: (m, v, q, B) => m * v / (Math.abs(q) * B), cyclotronPeriod: (m, q, B) => 2 * Math.PI * m / (Math.abs(q) * B),
    lenzDirection: (fluxChangeSign) => (fluxChangeSign > 0 ? 'opposes increase (induced field opposite)' : 'opposes decrease (induced field same direction)'),
  };
  // ---------------- optics & spectroscopy ----------------
  function wavelengthToRGB(nm) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else if (nm <= 780) { r = 1; }
    let f = 1; if (nm >= 380 && nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40; else if (nm > 700 && nm <= 780) f = 0.3 + 0.7 * (780 - nm) / 80; else if (nm < 380 || nm > 780) f = 0.15;
    const gm = 0.8; const q = v => Math.round(255 * Math.pow(Math.max(0, v) * f, gm)); return [q(r), q(g), q(b)];
  }
  const GLASS = { crown: { A: 1.5046, B: 0.0042 }, flint: { A: 1.6200, B: 0.0100 }, water: { A: 1.3240, B: 0.0031 }, diamond: { A: 2.3780, B: 0.0100 } };
  const indexAt = (glass, nm) => { const g = GLASS[glass] || GLASS.crown; const um = nm / 1000; return g.A + g.B / (um * um); };
  const optics = {
    GLASS, indexAt, wavelengthToRGB,
    snell: (n1, n2, thetaDeg) => { const s = n1 * Math.sin(rad(thetaDeg)) / n2; return s > 1 ? { tir: true, theta: null } : { tir: false, theta: deg(Math.asin(s)) }; },
    criticalAngle: (n1, n2) => (n2 >= n1 ? null : deg(Math.asin(n2 / n1))),
    brewster: (n1, n2) => deg(Math.atan(n2 / n1)),
    prism: (thetaDeg, apexDeg, glass, nm) => { const n = indexAt(glass, nm); const t2 = Math.asin(Math.sin(rad(thetaDeg)) / n); const t3 = rad(apexDeg) - t2; const s = n * Math.sin(t3); if (Math.abs(s) > 1) return { tir: true, n }; const t4 = Math.asin(s); return { tir: false, n, deviationDeg: thetaDeg + deg(t4) - apexDeg, exitAngleDeg: deg(t4) }; },
    prismSpectrum: (thetaDeg, apexDeg, glass, wavelengths) => (wavelengths || [400, 450, 500, 550, 600, 650, 700]).map(nm => Object.assign({ nm, rgb: wavelengthToRGB(nm) }, optics.prism(thetaDeg, apexDeg, glass, nm))),
    thinLens: (f, dobj) => { if (Math.abs(dobj - f) < 1e-9) return { image: 'at infinity' }; const di = 1 / (1 / f - 1 / dobj); const m = -di / dobj; return { di, m, real: di > 0, upright: m > 0, enlarged: Math.abs(m) > 1, type: f > 0 ? 'convex' : 'concave' }; },
    mirror: (f, dobj) => optics.thinLens(f, dobj), // f>0 concave, f<0 convex (same equation)
    doubleSlit: (lambdaNm, slitSepMm, screenM) => ({ fringeSpacingMm: (lambdaNm * 1e-9 * screenM / (slitSepMm * 1e-3)) * 1e3 }),
    doubleSlitIntensity: (lambdaNm, d_mm, a_mm, L_m, y_mm) => { const lam = lambdaNm * 1e-9, d = d_mm * 1e-3, a = a_mm * 1e-3, y = y_mm * 1e-3; const bd = Math.PI * d * y / (lam * L_m), ba = Math.PI * a * y / (lam * L_m); const sinc = ba === 0 ? 1 : Math.sin(ba) / ba; return Math.cos(bd) ** 2 * sinc * sinc; },
    singleSlit: (lambdaNm, a_mm, L_m) => ({ centralWidthMm: 2 * lambdaNm * 1e-9 * L_m / (a_mm * 1e-3) * 1e3 }),
    grating: (lambdaNm, linesPerMm, order) => { const s = order * lambdaNm * 1e-9 * linesPerMm * 1e3; return Math.abs(s) > 1 ? null : deg(Math.asin(s)); },
    photonEnergyEV: nm => C.h * C.c / (nm * 1e-9) / C.e,
  };
  function make(data) {
    const spectra = (data && data.spectra && data.spectra.lines) || {}; const elements = {}; ((data && data.elements) || []).forEach(e => { elements[e.symbol] = e; });
    return {
      emissionSpectrum: sym => { const lines = (spectra[sym] || []).map(l => ({ nm: l.nm, i: l.i, rgb: wavelengthToRGB(l.nm) })); const e = elements[sym]; return { symbol: sym, lines, flameColor: e ? e.chemicalProperties.flameTestColor : null, known: lines.length > 0 }; },
      identifyByLines: (observedNm, tolNm) => { tolNm = tolNm || 2; const scores = []; for (const sym in spectra) { let hit = 0; observedNm.forEach(o => { if (spectra[sym].some(l => Math.abs(l.nm - o) <= tolNm)) hit++; }); if (hit) scores.push({ symbol: sym, hits: hit, ofLines: spectra[sym].length }); } return scores.sort((a, b) => b.hits - a.hits || a.ofLines - b.ofLines); },
      geiger: (sym, massG, distCm, shield, rng) => geigerCount(elements[sym], massG, distCm, shield, rng),
    };
  }
  // ---------------- photoelectric effect ----------------
  const WORK_FN = { Cs: 2.14, Rb: 2.16, K: 2.30, Na: 2.28, Li: 2.90, Ca: 2.87, Mg: 3.66, Al: 4.08, Zn: 4.33, Ag: 4.26, Fe: 4.50, Cu: 4.65, Au: 5.10, Pt: 5.65 };
  const photoelectric = {
    WORK_FN,
    run: (o) => { const phi = o.phiEV !== undefined ? o.phiEV : WORK_FN[o.metal]; const nm = o.wavelengthNm; const E = optics.photonEnergyEV(nm); const f0 = phi * C.e / C.h;
      const ke = Math.max(0, E - phi); const emits = E > phi; const Vs = ke; const I0 = emits ? (o.intensity === undefined ? 1 : o.intensity) * 10 : 0; // uA arbitrary scale
      const V = o.voltage === undefined ? 0 : o.voltage; let I = 0; if (emits) { if (V >= 0) I = I0 * Math.min(1, 0.5 + V / (Vs + 1) / 2 + (V > 5 ? 0.5 : 0)); else if (V > -Vs) I = I0 * 0.5 * Math.pow(1 + V / Vs, 2); }
      return { metal: o.metal, phiEV: phi, photonEV: E, thresholdHz: f0, thresholdNm: C.h * C.c / (phi * C.e) * 1e9, emits, keMaxEV: ke, stoppingVoltage: Vs, current_uA: I, maxSpeed: Math.sqrt(2 * ke * C.e / C.me) }; },
    planckFromData: (pts) => { const n = pts.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; pts.forEach(p => { sx += p.f; sy += p.Vs; sxx += p.f * p.f; sxy += p.f * p.Vs; }); const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); return { h: slope * C.e, slope }; },
  };
  // ---------------- cathode ray tube ----------------
  const crt = {
    run: (o) => { const v = Math.sqrt(2 * C.e * o.Va / C.me); const L = o.plateLenM || 0.05, d = o.plateSepM || 0.02, D = o.screenDistM || 0.25; let yE = 0, yB = 0, r = null;
      if (o.Vdef) { const a = C.e * (o.Vdef / d) / C.me; const t = L / v; const y1 = 0.5 * a * t * t; const vy = a * t; yE = y1 + D * vy / v; }
      if (o.B) { r = C.me * v / (C.e * o.B); const Lm = o.magLenM || L; const s = Math.min(1, Lm / r); const th = Math.asin(s); yB = r * (1 - Math.cos(th)) + D * Math.tan(th); }
      return { speed: v, speedFracC: v / C.c, deflectionElectric: yE, deflectionMagnetic: yB, radius: r, kineticEV: o.Va }; },
    eOverM: (Va, B, r) => 2 * Va / (B * B * r * r), // classic Thomson/helical measurement
  };
  // ---------------- gas laws ----------------
  class GasChamber {
    constructor(n, T_K, V_L) { this.n = n; this.T = T_K; this.V = V_L; }
    get P() { return this.n * C.R * this.T / this.V; } // kPa (R in J/mol/K, V in L => kPa)
    setVolume(V, hold) { hold = hold || 'T'; if (hold === 'T') { /* Boyle: P changes automatically */ this.V = V; } else if (hold === 'P') { this.T = this.P * V / (this.n * C.R); this.V = V; } return this.state(); }
    setTemperature(T, hold) { hold = hold || 'V'; if (hold === 'V') this.T = T; else if (hold === 'P') { const P = this.P; this.T = T; this.V = this.n * C.R * T / P; } return this.state(); }
    state() { return { n: this.n, T: this.T, tC: this.T - 273.15, V: this.V, P_kPa: this.P, P_atm: this.P / 101.325, PV: this.P * this.V }; }
    static boyle(P1, V1, V2) { return P1 * V1 / V2; } static charles(V1, T1, T2) { return V1 * T2 / T1; } static gayLussac(P1, T1, T2) { return P1 * T2 / T1; }
    static rmsSpeed(Mgmol, T) { return Math.sqrt(3 * C.R * T / (Mgmol / 1000)); }
  }
  // ---------------- radioactivity ----------------
  function geigerCount(el, massG, distCm, shield, rng) {
    rng = rng || Math.random; if (!el || !el.physicalProperties.radioactivity || !el.physicalProperties.radioactivity.halfLifeSeconds) return { activityBq: 0, cps: Math.round(poisson(0.4, rng)), background: true };
    const ra = el.physicalProperties.radioactivity; const N = massG / el.atomicMass * C.NA; const A = N * Math.LN2 / ra.halfLifeSeconds;
    const area = 5, r = Math.max(distCm, 0.5); const eff = Math.min(0.5, area / (4 * Math.PI * r * r)); let f = 1; const em = ra.emission;
    const sh = shield || 'none'; if (sh === 'paper' && em === 'alpha') f = 0; else if (sh === 'aluminium' && (em === 'alpha' || em === 'beta')) f = em === 'alpha' ? 0 : 0.02; else if (sh === 'lead') f = 0.01;
    if (em === 'alpha' && distCm > 5) f = 0; // alpha range in air ~ 5 cm
    const mean = A * eff * f + 0.4; return { activityBq: A, emission: em, cps: poisson(mean, rng), meanCps: mean };
  }
  function poisson(mean, rng) { if (mean > 50) { const g = Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng()); return Math.max(0, Math.round(mean + Math.sqrt(mean) * g)); } let L = Math.exp(-mean), k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
  const decay = { remainingFraction: (t, halfLife) => Math.pow(0.5, t / halfLife), activity: (N, halfLife) => N * Math.LN2 / halfLife };

  return { C, Circuit, circuits, em, optics, photoelectric, crt, GasChamber, decay, make, wavelengthToRGB, geigerCount, poisson, complex: { cx, abs, arg } };
});
