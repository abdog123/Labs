/* Panels: inventory (drag & drop), selected-container info, smart notebook. */
(function () {
  'use strict';
  const { $, $$, el, F, FE, toast, dialog, download, clamp } = U; const B = Bench, E = B.E, D = window.LABDATA;
  const inv = E.inventory(); const CONC = ['H2SO4', 'HNO3', 'HCl'];
  const TOOLS = [['thermometer', 'ترمومتر'], ['phMeter', 'مقياس pH'], ['conductivity', 'جهاز التوصيلية'], ['stirRod', 'ساق تقليب'], ['stopper', 'سدادة'], ['deliveryTube', 'أنبوبة توصيل'], ['electrodes', 'أقطاب كهربية'], ['uvLamp', 'مصباح UV'], ['nichrome', 'سلك نيكروم (لهب)']];
  const GASTOOLS = Object.keys(D.reagents.gasTests).map(k => [k, D.reagents.gasTests[k].nameAr]);
  const COMMON_SALTS = ['NaCl', 'KCl', 'CuSO4', 'AgNO3', 'BaCl2', 'Na2SO4', 'FeCl3', 'FeSO4', 'KI', 'KSCN', 'Pb(NO3)2', 'ZnSO4', 'Na2CO3', 'NaHCO3', 'CaCl2', 'MgSO4', 'NH4Cl', 'Na2S', 'Na2SO3', 'Na2S2O3', 'KMnO4', 'K2Cr2O7', 'K2CrO4', 'NaNO2', 'NaNO3', 'NiSO4', 'CoCl2', 'CuCl2', 'Al2(SO4)3', 'CrCl3', 'MnSO4', 'NaBr', 'NaI', 'Na3PO4', 'Na2C2O4', 'CH3COONa'];
  const SOLIDS_EXTRA = ['CuO', 'MnO2', 'CaO', 'Fe2O3', 'ZnO', 'PbO', 'HgO', 'Ag2O', 'Cr2O3', 'Al2O3', 'MgO', 'Na2O2', 'S', 'C', 'P', 'CuSO4.5H2O', '(NH4)2Cr2O7', 'C12H22O11', 'CH3COONa', 'FeS', 'CuCO3', 'CaCO3', 'Cu(OH)2'];
  let tab = 'glass', infoTab = 'cont', q = '';
  const TABS = [['glass', 'الزجاجيات'], ['tools', 'الأدوات'], ['metals', 'الفلزات'], ['nonm', 'اللافلزات'], ['salts', 'الأملاح'], ['acid', 'أحماض وقواعد'], ['org', 'عضوية'], ['other', 'أخرى']];

  function card(o) {
    const c = el('div', { class: 'card', 'data-k': o.kind, title: o.title || '' }, [el('div', { class: 'nm', text: o.nm }), el('div', { class: 'fm', html: o.fm || '' })]);
    if (o.sw) c.append(el('i', { class: 'sw', style: 'background:' + o.sw })); c._o = o; return c;
  }
  function list() {
    const L = []; const add = (...a) => a.forEach(x => L.push(x)); const sect = t => L.push({ sect: t });
    const sw = k => (D.species[k] && D.species[k].color) || null;
    if (tab === 'glass') { D.glassware.containers.forEach(g => add({ kind: 'glass', id: g.id, nm: g.nameAr, fm: g.capacityMl + ' مل', click: true })); sect('معدات'); add({ kind: 'burner', nm: 'موقد بنزن', fm: 'انقر للتشغيل • نقر مزدوج: فتحة الهواء', click: true }, { kind: 'balance', nm: 'ميزان رقمي', fm: '0.01 جم', click: true }); }
    if (tab === 'tools') { sect('قياس وتحكم (اسقطها على وعاء)'); TOOLS.forEach(t => add({ kind: 'tool', id: t[0], nm: t[1] })); sect('كشف الغازات والكواشف'); GASTOOLS.forEach(t => add({ kind: 'tool', id: t[0], nm: t[1] })); }
    if (tab === 'metals') inv.metals.forEach(m => add({ kind: 'solid', id: m.id, nm: m.nameAr, fm: m.id, sw: sw(m.id + '(s)') || sw(m.id + '(l)') || (D.elements[+0] && null) }));
    if (tab === 'nonm') { inv.nonmetals.forEach(m => add({ kind: 'solid', id: m.id, nm: m.nameAr, fm: m.id })); sect('غازات'); ['H2', 'O2', 'N2', 'Cl2', 'CO2', 'SO2', 'H2S', 'NH3', 'HCl', 'CH4', 'C2H4', 'C2H2', 'NO2', 'CO'].forEach(g => add({ kind: 'gas', id: g, nm: (D.species[g + '(g)'] || {}).nameAr || g, fm: F(g) })); }
    if (tab === 'salts') { sect('أملاح شائعة'); COMMON_SALTS.forEach(f => add({ kind: 'salt', id: f, nm: E.substanceName(f), fm: F(f) })); sect('أملاح أخرى'); SOLIDS_EXTRA.forEach(f => add({ kind: 'solid', id: f, nm: E.substanceName(f), fm: F(f), sw: sw(f + '(s)') })); }
    if (tab === 'acid') { sect('أحماض'); D.ions.acids.filter(a => a.formula !== 'HNO3+3HCl').forEach(a => add({ kind: 'acid', id: a.formula, nm: 'حمض ' + a.nameAr, fm: F(a.formula) + (a.pKa != null ? ' &nbsp; pKa ' + a.pKa : ''), conc: CONC.includes(a.formula) })); add({ kind: 'acid', id: 'aquaRegia', nm: 'ماء الملك', fm: 'HNO<sub>3</sub>+3HCl' });
      sect('قواعد'); D.ions.bases.forEach(b => add({ kind: 'acid', id: b.formula, nm: b.nameAr, fm: F(b.formula) })); add({ kind: 'preset', id: 'Ca(OH)2', nm: 'ماء الجير (مخفف)', fm: F('Ca(OH)2') + ' 0.005M' }); }
    if (tab === 'org') { sect('سوائل عضوية'); inv.organics.forEach(o => add({ kind: 'liquid', id: o.id.replace(/\(l\)$/, ''), nm: o.nameAr, fm: F(o.id.replace(/\(l\)$/, '')), sw: sw(o.id) })); sect('محاليل/مواد'); ['C6H12O6', 'C57H110O6', 'NaOH'].forEach(f => { const k = f + '(aq)'; if (D.species[k] || f === 'NaOH') add({ kind: f === 'NaOH' ? 'acid' : 'sol', id: f, nm: E.substanceName(f), fm: F(f) }); }); add({ kind: 'solid', id: 'C12H22O11', nm: 'سكروز', fm: F('C12H22O11') }); }
    if (tab === 'other') { sect('ماء'); add({ kind: 'water', id: 'H2O', nm: 'ماء مقطر', fm: 'H<sub>2</sub>O' }); sect('كواشف الأحماض والقواعد'); inv.indicators.forEach(i => add({ kind: 'indicator', id: i, nm: { litmus: 'عباد الشمس', methylOrange: 'ميثيل برتقالي', methylRed: 'ميثيل أحمر', bromothymolBlue: 'أزرق البروموثيمول', phenolphthalein: 'فينولفثالين', universal: 'الكاشف العام' }[i] || i }));
      sect('محاليل مائية'); ['Br2', 'I2', 'Cl2', 'H2O2', 'H2S', 'NH3'].forEach(f => add({ kind: 'sol', id: f, nm: E.substanceName(f), fm: F(f) })); sect('صانع الأملاح'); add({ kind: 'maker' }); }
    const s = q.trim().toLowerCase(); return s ? L.filter(x => !x.sect && ((x.nm || '').toLowerCase().includes(s) || (x.id || '').toLowerCase().includes(s))) : L;
  }
  function renderInv() {
    const tabs = $('#invTabs'); tabs.innerHTML = ''; TABS.forEach(t => tabs.append(el('button', { class: t[0] === tab ? 'on' : '', onclick: () => { tab = t[0]; renderInv(); } }, [t[1]])));
    const box = $('#invList'); box.innerHTML = '';
    list().forEach(o => {
      if (o.sect) { box.append(el('div', { class: 'sect', text: o.sect })); return; }
      if (o.kind === 'maker') { box.append(saltMaker()); return; }
      const c = card(o); if (o.click) c.classList.add('glassc'); box.append(c);
      if (o.click) c.addEventListener('click', () => { if (o.kind === 'glass') B.addContainer(o.id); else if (o.kind === 'burner') B.addBurner(); else B.addBalance(); }); else c.addEventListener('pointerdown', ev => startDrag(ev, o));
    });
  }
  function saltMaker() {
    const cs = el('select', {}, D.ions.cations.map(c => el('option', { value: c.key }, [c.nameAr + ' ' + c.key.replace('^', '').replace(/(\d)\+/, '$1+')]))), as = el('select', {}, D.ions.anions.map(a => el('option', { value: a.key }, [a.nameAr + ' ' + a.key.replace('^', '')]))), out = el('div', {});
    const mk = () => { out.innerHTML = ''; const s = Chem.saltFormula(cs.value, as.value); const c = card({ kind: 'salt', id: s.formula, nm: E.saltNameAr(cs.value, as.value), fm: F(s.formula) }); c.addEventListener('pointerdown', ev => startDrag(ev, c._o)); out.append(c); };
    cs.onchange = as.onchange = mk; mk(); return el('div', { class: 'box', style: 'grid-column:1/-1' }, [el('div', { text: 'اختر كاتيونًا وأنيونًا ثم اسحب الملح', style: 'color:var(--mute);margin-bottom:6px' }), cs, as, out]);
  }
  // ---- drag & drop from inventory ----
  function startDrag(ev, o) {
    if (ev.button > 0) return; ev.preventDefault(); const ghost = el('div', { class: 'card', style: 'position:fixed;z-index:70;pointer-events:none;opacity:.9;width:130px;box-shadow:0 6px 22px #000a' }, [el('div', { class: 'nm', text: o.nm })]); document.body.append(ghost);
    const mv = e => { ghost.style.left = e.clientX - 65 + 'px'; ghost.style.top = e.clientY - 20 + 'px'; }; mv(ev);
    const fin = e => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', fin); ghost.remove(); drop(e, o); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', fin);
  }
  async function drop(e, o) {
    const r = $('#bench').getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; if (x < 0 || y < 0 || x > r.width || y > r.height) return;
    const t = B.hit(x, y); if (!t) { toast('أسقط المادة على وعاء (كأس/أنبوب…) فوق الطاولة'); return; }
    B.select(t); const c = t.c;
    if (o.kind === 'tool') { B.applyTool(t, o.id); refreshInfo(); return; }
    if (o.kind === 'indicator') { E.setIndicator(c, o.id); return; }
    if (o.kind === 'water') { const v = await dialog('إضافة ماء إلى ' + t.name, [{ id: 'ml', label: 'الحجم', value: 10, min: 0.1, suffix: 'مل' }]); if (v) E.addWater(c, v.ml); return; }
    if (o.kind === 'solid' || o.kind === 'salt') {
      const fields = [{ id: 'g', label: 'الكتلة', value: 1, min: 0.01, step: 0.01, suffix: 'جم' }, { id: 'form', label: 'الشكل', type: 'select', options: [{ v: 'powder', t: 'مسحوق' }, { v: 'chunk', t: 'قطع/شريط' }] }];
      if (o.kind === 'salt') fields.unshift({ id: 'mode', label: 'الحالة', type: 'select', options: [{ v: 'solid', t: 'ملح صلب' }, { v: 'soln', t: 'محلول مائي' }] }), fields.push({ id: 'ml', label: 'حجم المحلول (للمحلول)', value: 5, min: 0.1, suffix: 'مل' }, { id: 'M', label: 'التركيز (للمحلول)', value: 0.1, min: 0.0001, suffix: 'مولار' });
      const v = await dialog((o.kind === 'salt' ? 'ملح: ' : 'مادة صلبة: ') + o.nm, fields); if (!v) return;
      if (o.kind === 'salt' && v.mode === 'soln') { const rr = E.addSolution(c, o.id, v.ml, v.M); if (!rr.ok) toast('لا يمكن تحضير محلول: ' + o.nm); } else { const rr = E.addSolid(c, o.id, v.g, v.form); if (!rr.ok) toast('مادة غير متاحة: ' + o.id); } return;
    }
    if (o.kind === 'acid' || o.kind === 'sol' || o.kind === 'preset') {
      const conc = o.conc; const f = [{ id: 'ml', label: 'الحجم', value: 5, min: 0.1, suffix: 'مل' }, { id: 'M', label: 'التركيز', value: o.kind === 'preset' ? 0.005 : (['HCl', 'H2SO4', 'HNO3'].includes(o.id) ? 1 : 0.1), min: 0.0001, suffix: 'مولار' }];
      if (conc) f.push({ id: 'how', label: 'مركّز (للتفاعلات التي تحتاج حمضًا مركزًا)', type: 'select', options: [{ v: 'dil', t: 'محلول مخفف بالتركيز أعلاه' }, { v: 'conc', t: 'حمض مركز (سائل نقي)' }, { v: 'slow', t: 'مركز: صب بطيء على الجدار (وعاء مائل)' }, { v: 'fast', t: 'مركز: صب سريع' }] });
      const v = await dialog((o.kind === 'acid' ? '' : '') + o.nm, f); if (!v) return;
      if (conc && v.how === 'conc') E.addLiquid(c, o.id, v.ml); else if (conc && (v.how === 'slow' || v.how === 'fast')) B.pourConc(t, o.id, v.ml, v.how === 'slow', v.how === 'slow'); else { const rr = E.addSolution(c, o.id, v.ml, v.M); if (!rr.ok) toast('تعذّر: ' + o.nm); } return;
    }
    if (o.kind === 'liquid') { const v = await dialog(o.nm, [{ id: 'ml', label: 'الحجم', value: 3, min: 0.1, suffix: 'مل' }]); if (v) { const rr = E.addLiquid(c, o.id, v.ml); if (!rr.ok) toast('تعذّر إضافة ' + o.nm); } return; }
    if (o.kind === 'gas') { const v = await dialog('غاز: ' + o.nm, [{ id: 'mol', label: 'الكمية', value: 0.002, min: 0.00001, step: 0.0005, suffix: 'مول' }]); if (v) { if (c.volumeMl > 0) E.absorbGas(c, o.id, v.mol); else E.addGas(c, o.id, v.mol); E.log({ kind: 'add', textAr: 'أُدخل غاز ' + o.nm + ' (' + v.mol + ' مول) في ' + t.name }); } return; }
  }
  // ---- info panel ----
  function renderInfoTabs() { const t = $('#infoTabs'); t.innerHTML = ''; [['cont', 'الوعاء'], ['nb', 'دفتر المعمل']].forEach(x => t.append(el('button', { class: x[0] === infoTab ? 'on' : '', onclick: () => { infoTab = x[0]; renderInfoTabs(); refreshInfo(true); } }, [x[1]]))); }
  let lastSig = '';
  function contHTML(o) {
    if (!o) return '<p style="color:var(--mute)">اختر وعاءً من الطاولة (أو أضف زجاجية من القائمة) لعرض محتواه ونتائجه.</p>';
    const c = o.c, m = E.measure(c), look = o._look || E.appearance(c); const rows = [];
    rows.push('<div class="kv"><span>الحجم</span><span>' + m.volumeMl.toFixed(1) + ' مل / ' + c.capacityMl + '</span><span>الحرارة</span><span>' + c.tempC.toFixed(1) + ' °م</span><span>الكتلة</span><span>' + m.massG.toFixed(2) + ' جم</span><span>التوصيلية</span><span>' + m.conductivity.toFixed(1) + ' mS/cm</span></div>');
    if (m.pH !== null) rows.push('<div>pH = <b>' + m.pH.toFixed(2) + '</b></div><div class="ph"><i style="inset-inline-start:calc(' + clamp(m.pH / 14 * 100, 0, 100) + '% - 2px);' + 'left:' + clamp(m.pH / 14 * 100, 0, 100) + '%"></i></div>');
    const ions = Object.keys(c.aq).sort((a, b) => c.aq[b] - c.aq[a]); if (ions.length) rows.push('<h4>الأنواع المذابة (مولار)</h4>' + ions.map(k => '<span class="chip">' + F(k) + ' ' + U.sci(c.aq[k] / (m.volumeMl / 1000)) + '</span>').join(''));
    if (look.solids.length) rows.push('<h4>مواد صلبة / رواسب</h4>' + look.solids.map(s => '<div><span class="chip"><i class="sw" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + s.color + ';margin-inline-end:4px"></i>' + F(s.key.replace(/\(s\)$/, '')) + '</span> ' + s.massG.toFixed(3) + ' جم ' + (s.form === 'precip' ? '(راسب ' + E.colorNameAr(s.color) + ')' : '') + '</div>').join(''));
    const lq = Object.keys(c.liquids); if (lq.length) rows.push('<h4>سوائل</h4>' + lq.map(k => '<span class="chip">' + F(k.replace(/\(l\)$/, '')) + ' ' + c.liquids[k].ml.toFixed(1) + ' مل</span>').join(''));
    const gs = Object.keys(c.gasCloud || {}); if (gs.length) rows.push('<h4>غازات حول الوعاء</h4>' + gs.map(k => '<span class="chip">' + F(k) + '</span>').join('') + E.odor(c).map(x => '<div style="color:var(--warn)">👃 ' + x.odorAr + '</div>').join(''));
    if (c.sealed) rows.push('<div class="chip">مغلق بسدادة</div>');
    return rows.join('');
  }
  function actionsHTML(o) { return ''; }
  function renderCont() {
    const o = B.selected; const body = $('#infoBody'); const sig = o ? o.id + '|' + Math.round(performance.now() / 400) : 'none'; if (sig === lastSig && infoTab === 'cont') return; lastSig = sig;
    body.innerHTML = ''; const wrap = el('div', { html: contHTML(o) }); if (o) {
      const acts = el('div', { class: 'btnrow' }); const mk = (t, f) => acts.append(el('button', { text: t, onclick: () => { f(); lastSig = ''; } }));
      mk('سكب إلى…', () => B.startPour(o)); mk('تفريغ', () => { o.c.clear(); o.bubbles = []; o.paper = null; }); mk('إعادة تسمية', async () => { const v = await dialog('اسم الوعاء', [{ id: 'n', label: 'الاسم', type: 'text', value: o.name }]); if (v && v.n) o.name = o.c.name = v.n; }); mk('حذف', () => B.remove(o));
      wrap.prepend(el('h3', { text: o.name, style: 'margin:0 0 4px;color:var(--accent)' }), acts);
      const tools = el('div', { class: 'btnrow' }); tools.append(el('div', { style: 'width:100%;color:var(--mute);font-size:12px', text: 'اختبارات سريعة على هذا الوعاء:' })); GASTOOLS.forEach(g => tools.append(el('button', { style: 'font-size:12px;padding:3px 8px', text: g[1], onclick: () => { B.applyTool(o, g[0]); lastSig = ''; } }))); wrap.append(tools);
      const tl = el('div', { class: 'btnrow' }); TOOLS.forEach(t => tl.append(el('button', { style: 'font-size:12px;padding:3px 8px', text: t[1], onclick: () => { B.applyTool(o, t[0]); lastSig = ''; } }))); wrap.append(el('h4', { text: 'أدوات', style: 'margin:8px 0 2px' }), tl);
    }
    body.append(wrap);
  }
  function renderNB() {
    const body = $('#infoBody'); const n = E.notebook.length; const sig = 'nb' + n; if (sig === lastSig) return; lastSig = sig; body.innerHTML = '';
    const bar = el('div', { class: 'btnrow' }, [el('button', { text: 'تنزيل نص', onclick: () => download('دفتر-المعمل.txt', nbText()) }), el('button', { text: 'نسخ', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(nbText()); toast('تم النسخ'); } }), el('button', { text: 'مسح', onclick: () => { E.notebook.length = 0; lastSig = ''; } })]);
    const list = el('div', { class: 'nb' }); E.notebook.slice(-120).forEach((e, i) => { const t = new Date(e.t); const hh = t.toTimeString().slice(0, 8);
      list.append(el('div', { class: 'e ' + e.kind }, [el('small', { text: hh }), el('div', { text: e.textAr || '' }), e.equation ? el('div', { class: 'eq', html: FE(e.equation) + (e.dH !== undefined ? ' &nbsp; <small>ΔH ≈ ' + e.dH + ' kJ</small>' : '') }) : null])); });
    body.append(bar, list); body.scrollTop = body.scrollHeight;
  }
  function nbText() { return 'دفتر معمل ثانويكا\n' + E.notebook.map(e => '[' + new Date(e.t).toTimeString().slice(0, 8) + '] ' + (e.textAr || '') + (e.equation ? '\n    ' + e.equation + (e.dH !== undefined ? '   ΔH ≈ ' + e.dH + ' kJ' : '') : '')).join('\n'); }
  function refreshInfo(force) { if (force) lastSig = ''; if (infoTab === 'cont') renderCont(); else renderNB(); }
  // alarms
  let alarmT = null; E.on(e => { if (e.kind === 'alarm' || e.kind === 'hazard') { const a = $('#alarm'); a.textContent = '⚠ ' + e.textAr; a.hidden = false; clearTimeout(alarmT); alarmT = setTimeout(() => { a.hidden = true; }, 9000); } });
  B.on('select', () => { lastSig = ''; refreshInfo(); }); B.on('reset', () => { lastSig = ''; refreshInfo(); });
  let tmr = 0; B.on('frame', dt => { tmr += dt; if (tmr > 0.4) { tmr = 0; refreshInfo(); } });
  $('#invSearch').addEventListener('input', e => { q = e.target.value; renderInv(); });
  window.Panels = { renderInv, refreshInfo, renderInfoTabs, setTab: t => { tab = t; renderInv(); } };
  renderInv(); renderInfoTabs(); refreshInfo(true);
})();
