/* Container: state of a piece of glassware. aq = mol of dissolved species (analytic, H+/OH- never stored). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LabContainer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  let SEQ = 0;
  class Container {
    constructor(type, spec) {
      spec = spec || {};
      this.id = spec.id || 'c' + (++SEQ);
      this.type = type || 'beaker';
      this.capacityMl = spec.capacityMl || 250;
      this.tempC = 25;
      this.waterMl = 0;          // aqueous solvent volume
      this.aq = {};              // species -> mol
      this.solids = {};          // key -> {mol, form:'powder'|'chunk'|'precip', color, texture}
      this.liquids = {};         // key -> {ml}   (organic / conc. acids / Hg ...)
      this.gas = {};             // key -> mol  (headspace; only kept when sealed)
      this.sealed = false;       // stopper without delivery tube
      this.delivery = null;      // target container for delivery tube
      this.current = 0;          // A, when electrodes connected
      this.uv = false;           // UV lamp on
      this.stirred = 0;          // stirring factor 0..1 (helps slow-pour/mixing)
      this.layers = null;        // set by pouring (brown ring)
      this.history = [];         // per-tick events (consumed by UI/notebook)
      this.time = 0;
    }
    get miscibleMl() {
      let v = this.waterMl;
      for (const k in this.liquids) if (this.liquids[k].miscible) v += this.liquids[k].ml;
      return v;
    }
    get totalMl() { let v = this.waterMl; for (const k in this.liquids) v += this.liquids[k].ml; return v; }
    get volumeMl() { return this.miscibleMl; }
    mol(key) { return this.aq[key] || 0; }
    conc(key) { const L = this.volumeMl / 1000; return L > 0 ? (this.aq[key] || 0) / L : 0; }
    addAq(key, mol) {
      const v = (this.aq[key] || 0) + mol;
      if (v > 1e-14) this.aq[key] = v; else delete this.aq[key];
    }
    addSolid(key, mol, meta) {
      const s = this.solids[key] || (this.solids[key] = { mol: 0, form: 'powder' });
      s.mol += mol; if (meta) Object.assign(s, meta);
      if (s.mol < 1e-14) delete this.solids[key];
    }
    addLiquid(key, ml, meta) {
      const l = this.liquids[key] || (this.liquids[key] = { ml: 0 });
      l.ml += ml; if (meta) Object.assign(l, meta);
      if (l.ml < 1e-9) delete this.liquids[key];
    }
    addGas(key, mol) {
      this.gas[key] = (this.gas[key] || 0) + mol;
      if (this.gas[key] < 1e-14) delete this.gas[key];
    }
    event(type, data) { const e = Object.assign({ type, t: this.time }, data || {}); this.history.push(e); return e; }
    drainEvents() { const h = this.history; this.history = []; return h; }
    isEmpty() { return !this.waterMl && !Object.keys(this.solids).length && !Object.keys(this.liquids).length && !Object.keys(this.aq).length; }
    clear() {
      this.waterMl = 0; this.aq = {}; this.solids = {}; this.liquids = {}; this.gas = {}; this.layers = null;
      this.tempC = 25; this.current = 0; this.uv = false; this.history = [];
    }
    // proportional transfer of liquid contents (pouring)
    pourTo(target, ml) {
      const total = this.waterMl + Object.values(this.liquids).reduce((a, l) => a + l.ml, 0);
      if (total <= 0 || ml <= 0) return 0;
      const f = Math.min(1, ml / total);
      target.waterMl += this.waterMl * f; this.waterMl -= this.waterMl * f;
      for (const k in this.aq) { const n = this.aq[k] * f; target.addAq(k, n); this.aq[k] -= n; if (this.aq[k] < 1e-14) delete this.aq[k]; }
      for (const k in this.liquids) { const v = this.liquids[k].ml * f; target.addLiquid(k, v, Object.assign({}, this.liquids[k], { ml: 0 })); this.liquids[k].ml -= v; if (this.liquids[k].ml < 1e-9) delete this.liquids[k]; }
      // heat: mix temperatures by volume
      const vt = target.totalMl, vs = total * f;
      if (vt > 0) target.tempC = (target.tempC * (vt - vs) + this.tempC * vs) / vt;
      return total * f;
    }
    // transfer a fraction of undissolved solids too (decant with stirring / tipping)
    toJSON() {
      return { id: this.id, type: this.type, tempC: this.tempC, waterMl: this.waterMl, aq: this.aq, solids: this.solids, liquids: this.liquids, gas: this.gas };
    }
  }
  return Container;
});
