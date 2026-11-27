/* ReactionEngine: public facade. Containers, substance addition, time stepping, hazards, notebook events. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./chem.js'), require('./solution.js'), require('./container.js'), require('./equilibrium.js'), require('./catalogue.js'), require('./appearance.js'));
  else root.ReactionEngine = factory(root.Chem, root.Solution, root.LabContainer, root.Equilibrium, root.Catalogue, root.Appearance);
})(typeof self !== 'undefined' ? self : this, function (Chem, Sol, Container, Equilibrium, Catalogue, Appearance) {
  'use strict';
  const SOL_GAS = { CO2: ['H2CO3(aq)', 1], SO2: ['H2SO3(aq)', 1], H2S: ['H2S(aq)', 1], NH3: ['NH3(aq)', 1], HCl: ['Cl^-', 1], HBr: ['Br^-', 1], HCN: ['HCN(aq)', 1], Cl2: ['Cl2(aq)', 1], Br2: ['Br2(aq)', 1], I2: ['I2(aq)', 1] };
  const WEAK_ACID_KEY = f => f + '(aq)';
  const CONC_KEYS = { H2SO4: 'H2SO4(conc)', HNO3: 'HNO3(conc)', HCl: 'HCl(conc)' };
  const NAMES_AR = [[0, 0, 0, 'أسود'], [255, 255, 255, 'أبيض'], [128, 128, 128, 'رمادي'], [220, 30, 30, 'أحمر'], [140, 60, 20, 'بني'], [255, 150, 30, 'برتقالي'], [245, 220, 30, 'أصفر'],
    [60, 160, 60, 'أخضر'], [50, 110, 220, 'أزرق'], [140, 70, 180, 'بنفسجي'], [240, 150, 180, 'وردي'], [235, 225, 190, 'أبيض مصفر']];
  function colorNameAr(col) {
    const m = /^#([0-9a-f]{6})$/i.exec(col || ''); if (!m) return 'عديم اللون'; const n = parseInt(m[1], 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    let best = null, bd = 1e9; NAMES_AR.forEach(c => { const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (d < bd) { bd = d; best = c[3]; } }); return best;
  }

  class ReactionEngine {
    constructor(data) {
      this.data = data; Chem.init(data);
      this.eq = Equilibrium.make(data); this.cat = Catalogue.make(data); this.look = Appearance.make(data);
      this.fumeHood = false; this.timeScale = 1; this.notebook = []; this.listeners = []; this.containers = [];
      this._alarmAt = {}; this.glass = {}; (data.glassware.containers || []).forEach(g => { this.glass[g.id] = g; });
      this.SP = data.species; this.elements = {}; data.elements.forEach(e => { this.elements[e.symbol] = e; });
      this.cationMap = {}; data.ions.cations.forEach(i => { this.cationMap[i.key] = i; }); this.anionMap = {}; data.ions.anions.forEach(i => { this.anionMap[i.key] = i; });
      this.acids = {}; data.ions.acids.forEach(a => { this.acids[a.formula] = a; }); this.bases = {}; data.ions.bases.forEach(b => { this.bases[b.formula] = b; });
    }
    on(fn) { this.listeners.push(fn); }
    emit(e) { this.listeners.forEach(f => f(e)); }
    log(entry) { entry.t = Date.now(); this.notebook.push(entry); this.emit(entry); return entry; }

    createContainer(type, spec) {
      const g = this.glass[type] || {}; const c = new Container(type, Object.assign({ capacityMl: g.capacityMl || 250 }, spec));
      c.gasCloud = {}; c._dirty = false; c._ls = 0; this.containers.push(c); return c;
    }
    saltNameAr(cKey, aKey) { const c = this.cationMap[cKey], a = this.anionMap[aKey]; return (a ? a.nameAr : aKey) + ' ' + (c ? c.nameAr : cKey); }
    substanceName(id) {
      const s = Chem.salts[id]; if (s) return this.saltNameAr(s.c, s.a);
      const k = [id, id + '(s)', id + '(l)', id + '(aq)', id + '(g)'].find(x => this.SP[x]); if (k) return this.SP[k].nameAr;
      const a = this.acids[id]; if (a) return 'حمض ' + a.nameAr; const b = this.bases[id]; if (b) return b.nameAr; return id;
    }
    mixTemp(c, addMl, addT) { const v = c.totalMl; if (v + addMl > 0) c.tempC = (c.tempC * v + addT * addMl) / (v + addMl); }

    // ---------- adding substances ----------
    addWater(c, ml, tempC) {
      tempC = tempC === undefined ? 25 : tempC;
      const concKeys = Object.keys(c.liquids).filter(k => /\(conc\)$/.test(k));
      this.mixTemp(c, ml, tempC); c.waterMl += ml;
      concKeys.forEach(k => this.dissolveConc(c, k, k === 'H2SO4(conc)'));
      c._dirty = true; this.log({ kind: 'add', textAr: 'أُضيف ' + ml + ' مل ماء' });
    }
    dissolveConc(c, key, hazard) {
      const sp = this.SP[key]; const l = c.liquids[key]; if (!l) return; const n = l.ml * sp.rho / sp.M * (key === 'H2SO4(conc)' ? 0.98 : (key === 'HNO3(conc)' ? 0.69 : 0.37));
      const ml = l.ml; delete c.liquids[key]; c.waterMl += ml;
      const f = key.replace('(conc)', ''); const [an, nu] = Catalogue.STRONG_ACIDS[f]; c.addAq(an, n * nu);
      const dH = f === 'H2SO4' ? 95 : 35; const mass = Math.max(1, c.waterMl * 1.0 + ml * 0.84); const dT = (dH * 1000 * n) / (mass * 3.8);
      c.tempC += dT;
      if (hazard && c.volumeMl > 0) {
        c.event('hazard', { id: 'h2so4-water', dT, severity: c.tempC > 100 ? 'severe' : 'warning' });
        this.log({ kind: 'hazard', id: 'h2so4-water', severity: c.tempC > 100 ? 'severe' : 'warning',
          textAr: 'تحذير: إضافة الماء إلى الكبريتيك المركز طاردة للحرارة بشدة (ΔH≈-95 kJ/mol)؛ ارتفعت الحرارة ' + Math.round(dT) + '°م فقد يغلي الماء فجأة ويتناثر الحمض ويتحطم الزجاج. أضف الحمض إلى الماء ببطء وليس العكس.' });
      }
    }
    resolveSolid(id) {
      if (Chem.salts[id]) return { type: 'salt', key: id, M: Chem.molarMass(id) };
      const hyd = /^([A-Za-z0-9()]+)\.(\d*)H2O$/.exec(id); if (hyd && Chem.salts[hyd[1]]) { const sp = this.SP[id + '(s)']; return { type: 'hydrate', base: hyd[1], key: id + '(s)', M: sp ? sp.M : Chem.molarMass(id) }; }
      if (this.elements[id]) { const st = this.elements[id].physicalProperties.stateAtSTP; const k = id + (st === 'liquid' ? '(l)' : st === 'gas' ? '(g)' : '(s)'); return { type: 'element', key: k, state: st, M: this.elements[id].atomicMass, sym: id }; }
      const k = [id + '(s)', id].find(x => this.SP[x] && this.SP[x].phase === 's'); if (k) return { type: 'solid', key: k, M: this.SP[k].M };
      return null;
    }
    addSolid(c, id, grams, form) {
      const r = this.resolveSolid(id); if (!r) return { ok: false, error: 'unknown solid ' + id };
      const mol = grams / r.M; form = form || (r.type === 'element' ? 'chunk' : 'powder');
      if (r.type === 'salt') c.addSolid(id, mol, { form, salt: id });
      else if (r.type === 'hydrate') c.addSolid(r.key, mol, { form, color: this.SP[r.key].color });
      else if (r.type === 'element') { if (r.state === 'liquid') c.addLiquid(r.key, grams / (this.SP[r.key].rho || 1), { miscible: false, formula: r.key, color: this.SP[r.key].color }); else if (r.state === 'gas') c.addGas(r.key, mol); else c.addSolid(r.key, mol, { form, color: this.SP[r.key].color }); }
      else c.addSolid(r.key, mol, { form, color: this.SP[r.key].color });
      c._dirty = true; this.log({ kind: 'add', textAr: 'أُضيف ' + grams + ' جم من ' + this.substanceName(id) }); return { ok: true, mol };
    }
    addSolution(c, id, ml, M) {
      M = M === undefined ? 0.1 : M; const n = ml / 1000 * M; let done = false;
      this.mixTemp(c, ml, 25); c.waterMl += ml;
      const sa = Catalogue.STRONG_ACIDS[id], sb = Catalogue.STRONG_BASES[id], salt = Chem.salts[id];
      if (sa) { c.addAq(sa[0], n * sa[1]); done = true; }
      else if (id === 'aquaRegia') { c.addAq('NO3^-', n); c.addAq('Cl^-', 3 * n); done = true; }
      else if (this.acids[id] && this.SP[WEAK_ACID_KEY(id)]) { c.addAq(WEAK_ACID_KEY(id), n); done = true; }
      else if (['H2CO3', 'H3PO4', 'H2S', 'HNO2', 'HCN', 'HF'].includes(id)) { c.addAq(id + '(aq)', n); done = true; }
      else if (sb) { c.addAq(sb[0], n * sb[1]); done = true; }
      else if (id === 'NH4OH' || id === 'NH3') { c.addAq('NH3(aq)', n); done = true; }
      else if (salt) { c.addAq(salt.c, n * salt.nuC); c.addAq(salt.a, n * salt.nuA); done = true; }
      else if (this.SP[id + '(aq)']) { c.addAq(id + '(aq)', n); done = true; }
      else if (this.SP[id] && this.SP[id].phase === 'aq') { c.addAq(id, n); done = true; }
      if (!done) { c.waterMl -= ml; return { ok: false, error: 'unknown solution ' + id }; }
      c._dirty = true; this.log({ kind: 'add', textAr: 'أُضيف ' + ml + ' مل من محلول ' + this.substanceName(id) + ' ' + M + ' مولار' }); return { ok: true, mol: n };
    }
    addLiquid(c, id, ml) {
      const key = CONC_KEYS[id] || (this.SP[id + '(l)'] ? id + '(l)' : (this.SP[id] && this.SP[id].phase === 'l' ? id : null)); if (!key) return { ok: false, error: 'unknown liquid ' + id };
      const sp = this.SP[key];
      if (/\(conc\)$/.test(key)) { c.addLiquid(key, ml, { miscible: true, formula: key, color: sp.color, conc: true }); if (c.waterMl > 0) this.dissolveConc(c, key, false); }
      else c.addLiquid(key, ml, { miscible: !!sp.miscible, formula: key, color: sp.color, rho: sp.rho });
      c._dirty = true; this.log({ kind: 'add', textAr: 'أُضيف ' + ml + ' مل من ' + this.substanceName(id) }); return { ok: true };
    }
    addGas(c, id, mol) { const key = id + '(g)'; if (c.sealed) c.addGas(key, mol); else this.pushCloud(c, id, mol); c._dirty = true; return { ok: true }; }
    setIndicator(c, name) { c.indicator = name; this.log({ kind: 'add', textAr: 'أُضيف كاشف ' + name }); }
    // ---------- flame / pour / tube ----------
    setFlame(c, spec) { c.flame = spec && spec.on ? { on: true, luminous: !!spec.luminous, power: spec.luminous ? 150 : 450, maxC: spec.luminous ? 300 : 1500 } : null; }
    pour(src, dst, ml) { const moved = src.pourTo(dst, ml); dst._dirty = true; src._dirty = true; if (moved > 0) this.log({ kind: 'pour', textAr: 'سُكب ' + Math.round(moved * 10) / 10 + ' مل' }); return moved; }
    pourConc(c, id, ml, opts) {
      opts = opts || {}; const key = CONC_KEYS[id]; if (!key) return { ok: false }; const nitrate = c.aq['NO3^-'] || 0, fe2 = c.aq['Fe^2+'] || 0;
      if (opts.tilted && opts.slow) {
        this.addLiquid(c, id, 0); c.layers = { ringReady: true, acidMl: ml };
        const n = 0.12 * Math.min(nitrate, fe2 / 3);
        if (n > 1e-8) { c.layers.ring = { mol: n, color: '#6a3a1a' }; c.addAq('NO3^-', -n); c.addAq('Fe^2+', -3 * n); c.addAq('Fe^3+', 3 * n);
          this.log({ kind: 'observation', textAr: 'ظهرت حلقة بنية عند سطح الفصل بين الحمض المركز والمحلول: Fe(NO)²⁺ (اختبار النترات: الحلقة البنية)' }); }
        else this.log({ kind: 'observation', textAr: 'لم تتكوّن حلقة بنية: يلزم وجود أيون نترات وأيونات Fe²⁺ في المحلول' });
        return { ok: true, ring: n > 1e-8 };
      }
      c.layers = { mixed: true, ringReady: false }; this.addLiquid(c, id, ml); if (c.waterMl <= 0) this.dissolveConc(c, key, false);
      this.log({ kind: 'observation', textAr: 'سُكب الحمض بسرعة فاختلطت الطبقات وارتفعت الحرارة؛ فلا تتكوّن الحلقة البنية. اسكب الحمض ببطء على الجدار الداخلي لأنبوب مائل.' }); return { ok: true, ring: false };
    }
    pushCloud(c, gas, mol) { c.gasCloud[gas] = (c.gasCloud[gas] || 0) + mol; c.gasTotal = c.gasTotal || {}; c.gasTotal[gas] = (c.gasTotal[gas] || 0) + mol; }
    absorbGas(dst, gas, mol) {
      const m = SOL_GAS[gas];
      if (m && dst.volumeMl > 0) { dst.addAq(m[0], mol * m[1]); dst._dirty = true; }
      else { dst.gasCollected = dst.gasCollected || {}; dst.gasCollected[gas] = (dst.gasCollected[gas] || 0) + mol; }
    }
    // ---------- time stepping ----------
    tick(c, dt) {
      dt *= this.timeScale; c.time += dt; const out = [];
      for (const k in c.solids) if (/\.\d*H2O\(s\)$/.test(k) && c.waterMl > 0) { const b = k.replace(/\.\d*H2O\(s\)$/, ''); const s = c.solids[k]; delete c.solids[k]; c.addSolid(b, s.mol, { form: 'powder', salt: b }); c._dirty = true; }
      // heating
      if (c.flame && c.flame.on) {
        const m = Math.max(2, this.cat ? this.totalMass(c) : 10); const aqueous = c.waterMl > 0; const cp = aqueous ? 4.18 : 0.9;
        let Q = c.flame.power * (c.type === 'crucible' ? 1.4 : 1) * dt; // J
        if (aqueous && c.tempC >= 99.5) { const g = Q / 2260; c.waterMl = Math.max(0, c.waterMl - g); if (c.waterMl > 0) c.tempC = 100; else c.tempC = Math.min(c.flame.maxC, c.tempC + Q / (m * cp)); c.event('boil', {}); }
        else c.tempC = Math.min(c.flame.maxC, c.tempC + Q / (m * cp));
        if (c.flame.luminous) c.event('soot', {});
      }
      c.tempC -= 0.0035 * (c.tempC - 25) * dt * (c.flame && c.flame.on ? 0.2 : 1);
      c.stirred = Math.max(0, (c.stirred || 0) - 0.2 * dt);
      const progressed = this.cat.run(c, dt); if (progressed.length) c._dirty = true;
      if (c.volumeMl > 0 && (c._dirty || c.time - c._ls >= 0.5)) { this.eq.settle(c, Math.max(dt, c.time - c._ls)); c._ls = c.time; c._dirty = false; }
      const events = c.drainEvents(); const seen = c._seenObs = c._seenObs || {};
      for (const e of events) {
        if (e.type === 'gas') { c.gasFlux = (c.gasFlux || 0) + e.mol; if (c.delivery) this.absorbGas(c.delivery, e.gas, e.mol); else this.pushCloud(c, e.gas, e.mol); }
        if (e.type === 'reaction' && e.firstTime) out.push(this.log({ kind: 'reaction', id: e.id, equation: e.equation, dH: e.dH, textAr: e.observationAr, rtype: e.type }));
        if (e.type === 'precipitate' && !seen['p:' + e.salt]) { seen['p:' + e.salt] = 1; const s = Chem.salts[e.salt]; const ca = this.cationMap[s.c], an = this.anionMap[s.a];
          out.push(this.log({ kind: 'precipitate', salt: e.salt, equation: (s.nuC > 1 ? s.nuC : '') + s.c + ' + ' + (s.nuA > 1 ? s.nuA : '') + s.a + ' -> ' + e.salt + '(s)',
            textAr: 'تكوّن راسب ' + colorNameAr(e.color) + ' ' + (e.texture ? '(' + (this.look && this.data.solubilityMatrix.pairs[s.c][s.a].textureAr) + ') ' : '') + 'من ' + this.saltNameAr(s.c, s.a) })); }
        if (e.type === 'complex' && !seen['x:' + e.to + e.kind]) { seen['x:' + e.to + e.kind] = 1; out.push(this.log({ kind: 'observation', textAr: e.kind.endsWith('reverse') ? 'عاد الراسب للتكوّن (انعكاس المعقد)' : 'ذاب الراسب بتكوين المعقد ' + ((this.SP[e.to] && this.SP[e.to].nameAr) || e.to) })); }
        if (e.type === 'gas' && !seen['g:' + e.gas]) { seen['g:' + e.gas] = 1; const sp = this.SP[e.gas + '(g)']; out.push(this.log({ kind: 'gas', gas: e.gas, textAr: 'تصاعد غاز ' + (sp ? sp.nameAr : e.gas) + (sp && sp.odor ? ' — الرائحة: ' + sp.odor : '') })); }
        if (e.type === 'decompose' && !seen['d:' + e.species]) { seen['d:' + e.species] = 1; out.push(this.log({ kind: 'observation', textAr: 'تعكّر المحلول بكبريت أصفر مع تصاعد SO2 (تحلل الثيوكبريتات في الحمض)' })); }
      }
      // gas cloud decay + alarms
      for (const g in c.gasCloud) {
        const k = this.fumeHood ? 0.8 : 0.03; c.gasCloud[g] *= Math.exp(-k * dt); if (c.gasCloud[g] < 1e-9) { delete c.gasCloud[g]; continue; }
        if (!this.fumeHood && this.data.reagents.alarmGases.includes(g) && c.gasCloud[g] > 2e-5 && (c.time - (this._alarmAt[g] || -99)) > 30) {
          this._alarmAt[g] = c.time; const sp = this.SP[g + '(g)'];
          out.push(this.log({ kind: 'alarm', gas: g, textAr: 'إنذار المعمل: تصاعد غاز سام (' + (sp ? sp.nameAr : g) + ') بدون تشغيل شفاط الأبخرة! شغّل الشفاط فورًا.' })); }
      }
      return out;
    }
    totalMass(c) { return this.look.measure(c).massG; }
    settle(c, dt) { this.eq.settle(c, dt === undefined ? 30 : dt); c._dirty = false; return this; }
    run(c, seconds, step) { step = step || 0.25; const ev = []; for (let t = 0; t < seconds; t += step) ev.push.apply(ev, this.tick(c, step)); return ev; }
    appearance(c) { return this.look.look(c); }
    measure(c) { return this.look.measure(c); }
    detect(c, tool) { const r = this.look.detect(c, tool); this.log({ kind: 'test', tool, textAr: r.textAr, gas: r.gas || null }); return r; }
    odor(c) { return this.look.odor(c); }
    colorNameAr(h) { return colorNameAr(h); }
    // catalogue of items for the UI
    inventory() {
      const d = this.data; const metals = [], nonmetals = [], gases = [];
      d.elements.forEach(e => { const st = e.physicalProperties.stateAtSTP; const item = { id: e.symbol, nameAr: e.nameAr, state: st, category: e.category };
        if (e.atomicNumber > 103 || e.physicalProperties.radioactivity) return; (st === 'gas' ? gases : (['Nonmetal', 'Halogen', 'Noble Gas', 'Metalloid'].includes(e.category) ? nonmetals : metals)).push(item); });
      return { metals, nonmetals, gases,
        cations: d.ions.cations.map(i => ({ id: i.key, nameAr: i.nameAr, group: i.analyticalGroup })), anions: d.ions.anions.map(i => ({ id: i.key, nameAr: i.nameAr, group: i.testGroup })),
        acids: d.ions.acids, bases: d.ions.bases,
        organics: Object.keys(d.species).filter(k => d.species[k].phase === 'l' && !/\(conc\)/.test(k) && !d.species[k].element).map(k => ({ id: k, nameAr: d.species[k].nameAr })),
        indicators: Object.keys(d.reagents.indicators), analysisReagents: d.reagents.analysisReagents,
        presets: [{ id: 'Ca(OH)2', nameAr: 'ماء الجير (مخفف)', kind: 'solution', defaultM: 0.005 }, { id: 'HCl', nameAr: 'HCl مخفف 1M', kind: 'solution', defaultM: 1 }, { id: 'NaOH', nameAr: 'NaOH 0.1M', kind: 'solution', defaultM: 0.1 }] };
    }
  }
  ReactionEngine.colorNameAr = colorNameAr;
  return ReactionEngine;
});
