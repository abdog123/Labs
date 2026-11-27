/* Codex (الموسوعة العلمية): periodic table + atomic lens, solubility matrix, acids/bases, constants, scientists, discoveries. */
(function () {
  'use strict';
  const { $, $$, el, F, sci, toast } = U; const D = window.LABDATA; const root = $('#view-codex');
  const CAT_AR = { Alkali: 'فلز قلوي', 'Alkaline Earth': 'فلز قلوي أرضي', 'Transition Metal': 'فلز انتقالي', 'Post-transition Metal': 'فلز ما بعد الانتقالي', Lanthanide: 'لانثانيدات', Actinide: 'أكتينيدات', Nonmetal: 'لافلز', Halogen: 'هالوجين', 'Noble Gas': 'غاز نبيل', Metalloid: 'شبه فلز', Superheavy: 'فائق الثقل' };
  const CAT_COL = { Alkali: '#ff9b8a', 'Alkaline Earth': '#ffc78a', 'Transition Metal': '#ffe08a', 'Post-transition Metal': '#bfe3a0', Lanthanide: '#9fe0d0', Actinide: '#9ac7f0', Nonmetal: '#8fe3a8', Halogen: '#e8a8f0', 'Noble Gas': '#b9b2ff', Metalloid: '#c8d6a0', Superheavy: '#c9c9d4' };
  const STATE_AR = { solid: 'صلب', liquid: 'سائل', gas: 'غاز' }, MAG_AR = { paramagnetic: 'بارامغناطيسي', diamagnetic: 'دايامغناطيسي', ferromagnetic: 'فرومغناطيسي' };
  const SCIENTISTS = [
    ['جابر بن حيان', 'نحو 721–815', 'كيمياء', 'من رواد الكيمياء التجريبية؛ طوّر التقطير والتبلور والتصعيد ووصف أحماضًا مثل النيتريك والكبريتيك.'],
    ['أبو بكر الرازي', '865–925', 'كيمياء/طب', 'صنّف المواد الكيميائية وأدخل الكحول والأحماض في الكيمياء الطبية، وله كتاب «سر الأسرار».'],
    ['ابن الهيثم', '965–1040', 'بصريات', 'أسّس المنهج التجريبي في البصريات وفسّر الرؤية والانعكاس والانكسار في «كتاب المناظر».'],
    ['روبرت بويل', '1627–1691', 'كيمياء/فيزياء', 'قانون بويل: يتناسب ضغط الغاز عكسيًا مع حجمه عند ثبوت درجة الحرارة.'],
    ['إسحاق نيوتن', '1642–1727', 'فيزياء', 'حلّل الضوء الأبيض بمنشور إلى طيف الألوان.'],
    ['أنطوان لافوازييه', '1743–1794', 'كيمياء', 'قانون بقاء الكتلة وفسّر الاحتراق بالاتحاد مع الأكسجين.'],
    ['جاك شارل', '1746–1823', 'فيزياء', 'قانون شارل: حجم الغاز يتناسب طرديًا مع درجة الحرارة المطلقة عند ثبوت الضغط.'],
    ['جون دالتون', '1766–1844', 'كيمياء', 'النظرية الذرية الحديثة الأولى وقانون الضغوط الجزيئية.'],
    ['توماس يونج', '1773–1829', 'فيزياء', 'تجربة الشقين (1801) التي أثبتت الطبيعة الموجية للضوء.'],
    ['أميديو أفوجادرو', '1776–1856', 'كيمياء', 'فرضية أن الأحجام المتساوية من الغازات تحوي أعدادًا متساوية من الجزيئات.'],
    ['جوزيف جاي-لوساك', '1778–1850', 'كيمياء/فيزياء', 'قانون العلاقة بين ضغط الغاز ودرجة حرارته عند ثبوت الحجم.'],
    ['جورج أوم', '1789–1854', 'فيزياء', 'قانون أوم (1827): V = I·R.'],
    ['مايكل فاراداي', '1791–1867', 'فيزياء/كيمياء', 'الحث الكهرومغناطيسي (1831) وقانونا التحليل الكهربي.'],
    ['روبرت بنزن', '1811–1899', 'كيمياء', 'طوّر موقد بنزن وبالتعاون مع كيرشوف أسّس التحليل الطيفي باللهب.'],
    ['جوستاف كيرشوف', '1824–1887', 'فيزياء', 'قانونا الدوائر الكهربية (التيار والجهد) والتحليل الطيفي.'],
    ['ديمتري مندليف', '1834–1907', 'كيمياء', 'الجدول الدوري (1869) وتنبأ بعناصر لم تكن مكتشفة.'],
    ['جيمس ماكسويل', '1831–1879', 'فيزياء', 'معادلات الكهرومغناطيسية وبيّن أن الضوء موجة كهرومغناطيسية.'],
    ['جوزيف جيبس', '1839–1903', 'كيمياء فيزيائية', 'الطاقة الحرة ΔG = ΔH − TΔS لتحديد تلقائية التفاعل.'],
    ['هنري لوشاتيليه', '1850–1936', 'كيمياء', 'مبدأ لوشاتيليه لاتجاه الاتزان الكيميائي عند تغيير الظروف.'],
    ['جوزيف طومسون', '1856–1940', 'فيزياء', 'اكتشف الإلكترون (1897) بأنبوب أشعة المهبط.'],
    ['ماكس بلانك', '1858–1947', 'فيزياء', 'تكميم الطاقة E = hf وبداية فيزياء الكم.'],
    ['هاينريش هيرتز', '1857–1894', 'فيزياء', 'لاحظ التأثير الكهروضوئي (1887) وأنتج الموجات الراديوية.'],
    ['سفانت أرينيوس', '1859–1927', 'كيمياء', 'نظرية التأين وعلاقة سرعة التفاعل بدرجة الحرارة (معادلة أرينيوس).'],
    ['ماري كوري', '1867–1934', 'فيزياء/كيمياء', 'درست النشاط الإشعاعي واكتشفت البولونيوم والراديوم، ونالت نوبل مرتين.'],
    ['إرنست رذرفورد', '1871–1937', 'فيزياء', 'اكتشف النواة بتجربة رقاقة الذهب (1911).'],
    ['روبرت ميليكان', '1868–1953', 'فيزياء', 'قاس شحنة الإلكترون (1909) وتحقق من معادلة أينشتاين الكهروضوئية.'],
    ['ألبرت أينشتاين', '1879–1955', 'فيزياء', 'فسّر التأثير الكهروضوئي (1905) بالفوتونات ونال نوبل 1921.'],
    ['نيلز بور', '1885–1962', 'فيزياء', 'نموذج الذرة بمستويات طاقة مكممة (1913).'],
    ['هنري موزلي', '1887–1915', 'فيزياء', 'أثبت أن العدد الذري هو أساس ترتيب الجدول الدوري.'],
    ['لينوس بولينج', '1901–1994', 'كيمياء', 'مقياس السالبية الكهربية وطبيعة الرابطة الكيميائية.'],
    ['أحمد زويل', '1946–2016', 'كيمياء', 'كيمياء الفيمتوثانية؛ رصد حركة الذرات أثناء التفاعل ونال نوبل في الكيمياء 1999.'],
  ];
  const CONSTANTS = [['سرعة الضوء في الفراغ', 'c', '2.99792458×10⁸', 'm/s'], ['ثابت بلانك', 'h', '6.62607015×10⁻³⁴', 'J·s'], ['الشحنة الأولية', 'e', '1.602176634×10⁻¹⁹', 'C'], ['ثابت بولتزمان', 'k_B', '1.380649×10⁻²³', 'J/K'],
    ['عدد أفوجادرو', 'N_A', '6.02214076×10²³', 'mol⁻¹'], ['ثابت الغاز العام', 'R', '8.314462618', 'J/(mol·K)'], ['ثابت فاراداي', 'F', '96485.33', 'C/mol'], ['كتلة الإلكترون', 'mₑ', '9.1093837×10⁻³¹', 'kg'],
    ['كتلة البروتون', 'mₚ', '1.67262192×10⁻²⁷', 'kg'], ['سماحية الفراغ', 'ε₀', '8.8541878×10⁻¹²', 'F/m'], ['نفاذية الفراغ', 'μ₀', '1.25663706×10⁻⁶', 'N/A²'], ['عجلة الجاذبية', 'g', '9.80665', 'm/s²'],
    ['الضغط الجوي القياسي', 'atm', '101325', 'Pa'], ['حجم المول من الغاز المثالي (STP)', 'Vₘ', '22.414', 'L/mol'], ['حاصل الأيونات للماء (25°م)', 'K_w', '1.0×10⁻¹⁴', ''], ['السعة الحرارية النوعية للماء', 'c_w', '4.18', 'J/(g·K)'],
    ['ثابت ريدبرج', 'R_∞', '1.0973731568×10⁷', 'm⁻¹'], ['نصف قطر بور', 'a₀', '5.29177×10⁻¹¹', 'm']];
  let sub = 'pt', query = '', selZ = 1, colorBy = 'cat', raf = 0, lensMode = 'bohr';
  const TABS = [['pt', 'الجدول الدوري'], ['sol', 'مصفوفة الذوبانية'], ['ab', 'أحماض وقواعد'], ['const', 'ثوابت فيزيائية'], ['sci', 'العلماء'], ['disc', 'اكتشافاتي']];
  // discoveries (compounds/gases seen in the lab)
  let disc = {}; try { disc = JSON.parse(localStorage.getItem('thanawika.disc') || '{}'); } catch (e) { disc = {}; }
  function noteDisc(k, nm) { if (!disc[k]) { disc[k] = nm; try { localStorage.setItem('thanawika.disc', JSON.stringify(disc)); } catch (e) { } if (window.Bench) U.toast('🔎 اكتشاف جديد في الموسوعة: ' + nm, 2600); } }
  setTimeout(() => { if (window.E) E.on(e => { if (e.kind === 'precipitate') noteDisc(e.salt, E.saltNameAr(Chem.salts[e.salt].c, Chem.salts[e.salt].a) + ' ' + e.salt); if (e.kind === 'gas') noteDisc(e.gas, ((D.species[e.gas + '(g)'] || {}).nameAr || e.gas) + ' ' + e.gas); if (e.kind === 'reaction') noteDisc('rx:' + e.id, e.equation); }); }, 0);

  function scale(v, lo, hi) { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); const h = 240 - t * 240; return 'hsl(' + h + ',70%,62%)'; }
  function colorOf(e) {
    if (colorBy === 'cat') return CAT_COL[e.category] || '#ccc';
    if (colorBy === 'state') return { solid: '#bcd0ff', liquid: '#8fe8c4', gas: '#ffd28a' }[e.physicalProperties.stateAtSTP];
    if (colorBy === 'en') { const v = e.chemicalProperties.electronegativity; return v == null ? '#556' : scale(v, 0.7, 4); }
    if (colorBy === 'mass') return scale(e.atomicMass, 1, 300);
    if (colorBy === 'mp') { const v = e.physicalProperties.meltingPoint; return v == null ? '#556' : scale(v, 0, 3800); }
    if (colorBy === 'rad') return e.physicalProperties.radioactivity ? '#ff8f8f' : '#8fd8a8';
    return '#ccc';
  }
  const matches = e => { const s = query.trim().toLowerCase(); return !s || e.nameAr.includes(s) || e.nameEn.toLowerCase().includes(s) || e.symbol.toLowerCase() === s || String(e.atomicNumber) === s; };
  function ptView() {
    const wrap = el('div', { class: 'pane' }); const left = el('div', { class: 'col', style: 'flex:1.7' }); const right = el('div', { class: 'col', id: 'elDetail', style: 'flex:1;border-inline-start:1px solid var(--line);max-width:430px' });
    const sel = el('select', { onchange: ev => { colorBy = ev.target.value; render(); } }, [['cat', 'الفئة'], ['state', 'الحالة عند STP'], ['en', 'السالبية الكهربية'], ['mass', 'الكتلة الذرية'], ['mp', 'درجة الانصهار'], ['rad', 'النشاط الإشعاعي']].map(o => el('option', { value: o[0], selected: o[0] === colorBy ? 'selected' : null }, [o[1]])));
    left.append(el('div', { class: 'btnrow' }, [el('span', { text: 'تلوين حسب: ', style: 'color:var(--mute)' }), sel]));
    const grid = el('div', { class: 'ptable' });
    D.elements.forEach(e => { const c = el('div', { class: 'el' + (matches(e) ? '' : ' dim'), style: 'background:' + colorOf(e) + ';grid-row:' + e.position.row + ';grid-column:' + e.position.col + (e.atomicNumber === selZ ? ';outline:2px solid #fff' : ''), title: e.nameAr + ' (' + e.nameEn + ')', onclick: () => { selZ = e.atomicNumber; render(); } }, [el('small', { text: e.atomicNumber }), el('b', { text: e.symbol }), el('small', { text: e.atomicMass < 100 ? e.atomicMass.toFixed(1) : String(Math.round(e.atomicMass)) })]); grid.append(c); });
    grid.append(el('div', { style: 'grid-row:6;grid-column:3;font-size:10px;color:var(--mute);align-self:center;text-align:center', text: '57–71' }), el('div', { style: 'grid-row:7;grid-column:3;font-size:10px;color:var(--mute);align-self:center;text-align:center', text: '89–103' }));
    left.append(grid); const legend = el('div', { class: 'btnrow' }); if (colorBy === 'cat') Object.keys(CAT_COL).forEach(k => legend.append(el('span', { class: 'chip', style: 'background:' + CAT_COL[k] + ';color:#06101e', text: CAT_AR[k] }))); left.append(legend);
    wrap.append(left, right); return wrap;
  }
  function elDetail() {
    const e = D.elements[selZ - 1]; const p = e.physicalProperties, ch = e.chemicalProperties; const box = $('#elDetail'); if (!box) return; box.innerHTML = '';
    const c2k = k => (k == null ? '—' : '<bdi dir="ltr">' + (k - 273.15).toFixed(1) + ' °C (' + k + ' K)</bdi>');
    const kv = (a, b) => [el('span', { text: a }), el('span', { html: b })];
    const rows = [].concat(kv('العدد الذري', e.atomicNumber), kv('الكتلة الذرية', e.atomicMass), kv('الفئة', CAT_AR[e.category] || e.category), kv('الحالة (STP)', STATE_AR[p.stateAtSTP]), kv('اللون', '<i class="sw" style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;background:' + p.color + '"></i>'),
      kv('الكثافة', p.density == null ? '—' : sci(p.density) + ' g/cm³'), kv('الانصهار', c2k(p.meltingPoint)), kv('الغليان', c2k(p.boilingPoint)), kv('الحجم المولي', p.molarVolume == null ? '—' : p.molarVolume.toFixed(2) + ' cm³/mol'),
      kv('السالبية الكهربية', ch.electronegativity == null ? '—' : ch.electronegativity), kv('حالات التأكسد', (ch.oxidationStates.length ? ch.oxidationStates.map(v => (v > 0 ? '+' : '') + v).join('، ') : '—')),
      kv('جهد الاختزال E°', ch.standardReductionPotential == null ? '—' : ch.standardReductionPotential + ' V'), kv('لون اللهب', ch.flameTestColor ? '<i class="sw" style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;background:' + ch.flameTestColor + '"></i> ' + E.colorNameAr(ch.flameTestColor) : '—'),
      kv('الخاصية المغناطيسية', MAG_AR[p.magneticProperty] || '—'), kv('الإشعاع', p.radioactivity ? 'مشع (' + { alpha: 'ألفا α', beta: 'بيتا β' }[p.radioactivity.emission] + '، عمر النصف ≈ ' + (p.radioactivity.halfLifeSeconds ? sci(p.radioactivity.halfLifeSeconds) + ' ث' : 'غير محدد') + ')' : 'مستقر'));
    box.append(el('div', { style: 'display:flex;align-items:center;gap:12px' }, [el('div', { class: 'el', style: 'width:84px;height:84px;font-size:14px;background:' + (CAT_COL[e.category] || '#ccc') }, [el('small', { text: e.atomicNumber }), el('b', { style: 'font-size:30px', text: e.symbol }), el('small', { text: e.atomicMass })]), el('div', {}, [el('h3', { style: 'margin:0;color:var(--accent)', text: e.nameAr }), el('div', { class: 'f', text: e.nameEn, style: 'color:var(--mute)' }), p.estimated ? el('div', { class: 'chip', text: 'خصائص تقديرية/غير معروفة' }) : null])]));
    box.append(el('div', { class: 'kv', style: 'grid-template-columns:auto 1fr' }, rows));
    const cfg = e.electronConfigurationFull.replace(/(\d[spdf])\^(\d+)/g, '$1<sup>$2</sup>'); box.append(el('h4', { text: 'التوزيع الإلكتروني', style: 'color:var(--accent2);margin:8px 0 2px' }), el('div', { class: 'f', html: e.electronConfiguration.replace(/(\d[spdf])\^(\d+)/g, '$1<sup>$2</sup>') + '<br><small style="color:var(--mute)">' + cfg + '</small>' }));
    const tabs = el('div', { class: 'btnrow' }, [['bohr', 'نموذج بور'], ['orb', 'الأفلاك']].map(m => el('button', { class: m[0] === lensMode ? 'on' : '', text: m[1], onclick: () => { lensMode = m[0]; elDetail(); } }))); const cv = el('canvas', { class: 'plot', width: 380, height: 300, id: 'atomCv' });
    box.append(el('h4', { text: 'عدسة الذرة (الكمّ)', style: 'color:var(--accent2);margin:8px 0 2px' }), tabs, cv); box.append(el('div', { style: 'margin-top:8px' }, [el('button', { text: 'أضف المادة للمعمل (كتلة 1 جم)', onclick: () => { if (!App) return; App.setMode('lab'); const o = Bench.selected || Bench.objects[0] || Bench.addContainer('beaker'); const r = E.addSolid(o.c, e.symbol, 1, 'powder'); toast(r.ok ? 'أُضيف إلى ' + o.name : 'تعذّر إضافة هذه المادة'); } })]));
    startAtom(e, cv);
  }
  function shellCounts(e) { const m = {}; e.shells.forEach(s => { const n = +s.subshell[0]; m[n] = (m[n] || 0) + s.electrons; }); return Object.keys(m).sort((a, b) => a - b).map(k => m[k]); }
  function startAtom(e, cv) {
    cancelAnimationFrame(raf); const ctx = cv.getContext('2d'); const shells = shellCounts(e); const subs = e.shells.filter(s => s.electrons > 0);
    function bohr(t) { const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2; ctx.fillStyle = '#060c1c'; ctx.fillRect(0, 0, W, H); const R = Math.min(W, H) / 2 - 14; const n = shells.length;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22); g.addColorStop(0, '#ffd27a'); g.addColorStop(1, '#a85a1a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 15 + Math.min(10, e.atomicNumber / 12), 0, 7); ctx.fill(); ctx.fillStyle = '#220'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.atomicNumber + '+', cx, cy + 4);
      shells.forEach((cnt, i) => { const r = 32 + (R - 32) * (i + 1) / n; ctx.strokeStyle = 'rgba(120,170,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); const sp = (1.2 / (i + 1)) * t * (i % 2 ? -1 : 1);
        for (let k = 0; k < cnt; k++) { const a = sp + k * 2 * Math.PI / cnt; ctx.fillStyle = '#5ee0ff'; ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 3.2, 0, 7); ctx.fill(); } ctx.fillStyle = '#93a4c8'; ctx.font = '11px sans-serif'; ctx.fillText(cnt, cx + r + 8, cy - 2); }); }
    function lobes(cx, cy, size, fn, col, rot) { const N = 180; ctx.beginPath(); for (let i = 0; i <= N; i++) { const th = i / N * Math.PI * 2; const r = Math.abs(fn(th)) * size; const x = cx + r * Math.cos(th + rot), y = cy + r * Math.sin(th + rot); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, size); g.addColorStop(0, col + 'cc'); g.addColorStop(1, col + '33'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = col; ctx.stroke(); }
    function orb(t) { ctx.fillStyle = '#060c1c'; ctx.fillRect(0, 0, cv.width, cv.height); const types = Array.from(new Set(subs.map(s => s.orbital))); const w = cv.width / types.length;
      types.forEach((ty, i) => { const cx = w * (i + 0.5), cy = 140, sz = Math.min(w / 2 - 6, 70); const rot = t * 0.3; const col = { s: '#5ee0ff', p: '#ffd27a', d: '#ff8fb0', f: '#a8ff9a' }[ty];
        if (ty === 's') lobes(cx, cy, sz * 0.7, () => 1, col, 0); else if (ty === 'p') { lobes(cx, cy, sz, th => Math.cos(th), col, rot); } else if (ty === 'd') { lobes(cx, cy, sz, th => Math.sin(2 * th), col, rot); } else lobes(cx, cy, sz, th => Math.cos(3 * th), col, rot);
        ctx.fillStyle = '#e8eefc'; ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ty, cx, 40); ctx.fillStyle = '#93a4c8'; ctx.font = '11px sans-serif'; ctx.fillText(subs.filter(s => s.orbital === ty).map(s => s.subshell + '^' + s.electrons).join('  '), cx, 250); });
      ctx.fillStyle = '#93a4c8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('مقاطع تقريبية لدوال الكثافة الاحتمالية (s كروي، p ثنائي الفص، d رباعي الفصوص، f ثماني)', cv.width / 2, 285); }
    const t0 = performance.now(); (function loop() { if (!document.body.contains(cv)) return; const t = (performance.now() - t0) / 1000; (lensMode === 'bohr' ? bohr : orb)(t); raf = requestAnimationFrame(loop); })();
  }
  function solView() {
    const M = D.solubilityMatrix.pairs; const cats = D.ions.cations, ans = D.ions.anions.filter(a => a.key !== 'HCO3^-'); const info = el('div', { class: 'box', style: 'margin-bottom:8px', text: 'انقر خلية لعرض التفاصيل. الخلية الفارغة = ذائب. الدائرة الملونة = راسب بلون الراسب الحقيقي.' });
    const t = el('table', { class: 't', style: 'direction:ltr;font-size:12px;text-align:center' }); const head = el('tr', {}, [el('th', { text: '' })].concat(ans.map(a => el('th', { html: F(a.key), title: a.nameAr })))); t.append(head);
    cats.forEach(c => { const r = el('tr', {}, [el('th', { html: F(c.key), title: c.nameAr })]); ans.forEach(a => { const en = M[c.key] && M[c.key][a.key]; const td = el('td', { style: 'cursor:pointer', onclick: () => { info.innerHTML = en ? F(c.key) + ' + ' + F(a.key) + ' ⟶ <b>' + F(Chem.saltFormula(c.key, a.key).formula) + '</b> — راسب ' + E.colorNameAr(en.color) + ' (' + en.textureAr + ')، K<sub>sp</sub> = ' + sci(en.ksp) + (en.dissolvesInAcid ? ' • يذوب في الحمض' : '') + (en.excessOH ? ' • يذوب في زيادة القلوي' : '') + (en.excessNH3 ? ' • يذوب في النشادر' : '') + (en.state === 'slightly' ? ' • شحيح الذوبان' : '') : F(c.key) + ' + ' + F(a.key) + ' ⟶ ذائب'; } }); if (en) td.append(el('i', { style: 'display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid #fff5;background:' + en.color + (en.state === 'slightly' ? ';opacity:.55' : '') })); r.append(td); }); t.append(r); });
    const w = el('div', { class: 'col' }, [info, el('div', { style: 'overflow:auto' }, [t]), el('p', { style: 'color:var(--mute);font-size:12px', text: 'الأملاح غير الموجودة بالجدول: ذائبة. دائمًا ذائبة: أملاح Na⁺ وK⁺ وNH₄⁺ وLi⁺، والنترات والأسيتات والبيركلورات والبيكربونات والبرمنجنات.' })]); return w;
  }
  function abView() { const rows = D.ions.acids.map(a => el('tr', {}, [el('td', { html: F(a.formula) }), el('td', { text: a.nameAr }), el('td', { text: { strong: 'قوي', weak: 'ضعيف', super: 'فائق' }[a.strength] }), el('td', { html: a.Ka ? 'K<sub>a</sub> = ' + sci(a.Ka) + '، pK<sub>a</sub> = ' + a.pKa : '—' })])); const rb = D.ions.bases.map(a => el('tr', {}, [el('td', { html: F(a.formula) }), el('td', { text: a.nameAr }), el('td', { text: { strong: 'قوية', weak: 'ضعيفة' }[a.strength] }), el('td', { html: a.Kb ? 'K<sub>b</sub> = ' + sci(a.Kb) + '، pK<sub>b</sub> = ' + a.pKb : '—' })]));
    return el('div', { class: 'col' }, [el('div', { class: 'box' }, [el('h4', { text: 'الأحماض' }), el('table', { class: 't' }, rows)]), el('div', { class: 'box', style: 'margin-top:10px' }, [el('h4', { text: 'القواعد' }), el('table', { class: 't' }, rb)])]); }
  function constView() { return el('div', { class: 'col' }, [el('div', { class: 'box' }, [el('table', { class: 't' }, CONSTANTS.filter(c => !query || c[0].includes(query) || c[1].toLowerCase().includes(query.toLowerCase())).map(c => el('tr', {}, [el('td', { text: c[0] }), el('td', { class: 'f', text: c[1] }), el('td', { class: 'f', text: c[2] }), el('td', { class: 'f', text: c[3] })])))])]); }
  function sciView() { const q = query.trim(); return el('div', { class: 'col' }, [el('div', { class: 'grid2' }, SCIENTISTS.filter(s => !q || s.join(' ').includes(q)).map(s => el('div', { class: 'box' }, [el('h4', { text: s[0] }), el('div', { style: 'color:var(--mute);font-size:12px', text: s[1] + 'م • ' + s[2] }), el('p', { style: 'margin:6px 0 0', text: s[3] })])))]); }
  function discView() { const k = Object.keys(disc); return el('div', { class: 'col' }, [el('div', { class: 'box' }, [el('h4', { text: 'ما اكتشفته في المعمل (' + k.length + ')' }), k.length ? el('div', {}, k.map(x => el('div', { class: 'chip', html: x.startsWith('rx:') ? '⚗ ' + U.FE(disc[x]) : '🔎 ' + U.esc(disc[x]) }))) : el('p', { style: 'color:var(--mute)', text: 'لم تكتشف شيئًا بعد: جرّب خلط المواد في المعمل الحر وستُسجَّل الرواسب والغازات والتفاعلات هنا تلقائيًا.' })])]); }
  function render() {
    cancelAnimationFrame(raf); root.innerHTML = ''; const bar = el('div', { class: 'tabs', style: 'align-items:center' }); TABS.forEach(t => bar.append(el('button', { class: t[0] === sub ? 'on' : '', text: t[1], onclick: () => { sub = t[0]; render(); } })));
    bar.append(el('input', { type: 'search', placeholder: 'بحث في الموسوعة…', value: query, style: 'margin-inline-start:auto;min-width:200px', oninput: e => { query = e.target.value; const pos = e.target.selectionStart; render(); const i = $('input[type=search]', root); i.focus(); i.setSelectionRange(pos, pos); } }));
    const body = el('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column' }); root.style.flexDirection = 'column'; root.append(bar, body);
    const v = { pt: ptView, sol: solView, ab: abView, const: constView, sci: sciView, disc: discView }[sub](); v.style.flex = '1'; v.style.minHeight = '0'; body.append(v); if (sub === 'pt') elDetail();
  }
  window.Codex = { show: render, noteDisc };
})();
