/* Detective mode (التحليل الكيفي): 4 unknown salt solutions A–D, scored on deduction accuracy and reagent economy. */
(function () {
  'use strict';
  const { $, el, F, toast, esc } = U; const D = window.LABDATA; const B = window.Bench, E = B.E;
  // [formula, cation key, anion key]
  const POOL = [['CuSO4', 'Cu^2+', 'SO4^2-'], ['FeCl3', 'Fe^3+', 'Cl^-'], ['FeSO4', 'Fe^2+', 'SO4^2-'], ['NiSO4', 'Ni^2+', 'SO4^2-'], ['CoCl2', 'Co^2+', 'Cl^-'], ['ZnSO4', 'Zn^2+', 'SO4^2-'], ['AgNO3', 'Ag^+', 'NO3^-'],
    ['Pb(NO3)2', 'Pb^2+', 'NO3^-'], ['BaCl2', 'Ba^2+', 'Cl^-'], ['CaCl2', 'Ca^2+', 'Cl^-'], ['MgSO4', 'Mg^2+', 'SO4^2-'], ['Al2(SO4)3', 'Al^3+', 'SO4^2-'], ['MnSO4', 'Mn^2+', 'SO4^2-'], ['NaCl', 'Na^+', 'Cl^-'],
    ['KI', 'K^+', 'I^-'], ['KBr', 'K^+', 'Br^-'], ['Na2CO3', 'Na^+', 'CO3^2-'], ['Na2SO4', 'Na^+', 'SO4^2-'], ['Na2SO3', 'Na^+', 'SO3^2-'], ['Na2S2O3', 'Na^+', 'S2O3^2-'], ['NaNO2', 'Na^+', 'NO2^-'], ['NaNO3', 'Na^+', 'NO3^-'],
    ['NH4Cl', 'NH4^+', 'Cl^-'], ['(NH4)2SO4', 'NH4^+', 'SO4^2-'], ['K2CrO4', 'K^+', 'CrO4^2-'], ['KSCN', 'K^+', 'SCN^-'], ['Na3PO4', 'Na^+', 'PO4^3-'], ['Na2C2O4', 'Na^+', 'C2O4^2-']];
  const PRESET_BEST = 'qual.best'; const par = 10; let panel = null, active = false, round = null, uses = 0, locked = false, hints = 0, listening = false, best = null;
  try { best = JSON.parse(localStorage.getItem(PRESET_BEST) || 'null'); } catch (e) { best = null; }
  const cations = D.ions.cations.filter(i => !i.hidden), anions = D.ions.anions;
  const cName = k => (D.ions.cations.find(i => i.key === k) || {}).nameAr || k, aName = k => (D.ions.anions.find(i => i.key === k) || {}).nameAr || k;
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pick() { // 4 distinct unknowns, distinct cations and anions where possible
    const out = [], cs = new Set(); shuffle(POOL).forEach(p => { if (out.length < 4 && !cs.has(p[1])) { out.push(p); cs.add(p[1]); } }); return out;
  }
  function onLog(e) { if (!active || locked) return; let n = 0; if (e.kind === 'test') n = 1; else if (e.kind === 'add' && !/مل ماء$/.test((e.textAr || '').trim())) n = 1; if (n) { uses += n; refreshCounter(); } }
  function refreshCounter() { const c = $('#qCount', panel); if (c) { c.textContent = uses; c.style.color = uses <= par ? '#7ee8a0' : uses <= par + 6 ? '#ffd27a' : '#ff8f8f'; } }
  function newRound() {
    B.reset(); uses = 0; locked = false; hints = 0; active = false; round = pick(); const L = 'ABCD';
    round.forEach((p, i) => { const o = B.addContainer('testTube', { name: 'مجهول ' + L[i] }); E.addSolution(o.c, p[0], 8, 0.1); o.c.tempC = 25; E.settle(o.c, 1); });
    B.addContainer('testTube', { name: 'أنبوب حر 1' }); B.addContainer('beaker', { name: 'كأس تجارب' }); B.addBurner(); E.notebook.length = 0; B.select(null);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 20); active = true; build();
    E.log({ kind: 'observation', textAr: 'بدأت جولة تحليل كيفي: أربعة محاليل مجهولة 0.1 مولار (8 مل لكل منها).' }); uses = 0; refreshCounter();
  }
  function sel(list, nameFn, id) { const s = el('select', { id, style: 'width:100%;font-size:12px;padding:3px' }, [el('option', { value: '' }, ['— اختر —'])].concat(list.map(i => el('option', { value: i.key }, [nameFn(i.key)])))); return s; }
  function build() {
    if (!panel) { panel = el('div', { id: 'qualPanel', style: 'position:absolute;inset-inline-start:10px;top:10px;width:300px;max-height:calc(100% - 20px);overflow:auto;background:#0a1226ee;border:1px solid var(--accent);border-radius:12px;padding:10px;z-index:5' }); $('#benchWrap').append(panel); }
    panel.innerHTML = ''; panel.hidden = false; const L = 'ABCD';
    panel.append(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [el('b', { style: 'color:var(--accent)', text: '🕵️ التحليل الكيفي' }), el('span', { html: 'الكواشف المستخدمة: <b id="qCount" style="font-size:18px">0</b> <small style="color:var(--mute)">(الهدف ≤ ' + par + ')</small>' })]));
    panel.append(el('p', { style: 'margin:6px 0;font-size:12px;color:var(--mute)', text: 'أمامك أربعة محاليل مجهولة (A–D). استخدم الكواشف والاختبارات من القوائم لتحديد الكاتيون والأنيون في كل منها بأقل عدد ممكن من الإضافات (ماء المعمل لا يُحسب).' }));
    round.forEach((p, i) => { const box = el('div', { style: 'margin:5px 0' }, [el('div', { style: 'color:var(--accent2);font-weight:700;font-size:12px', text: 'المجهول ' + L[i] }), el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px' }, [sel(cations, cName, 'qc' + i), sel(anions, aName, 'qa' + i)]), el('div', { id: 'qr' + i, style: 'font-size:12px;margin-top:2px' })]); panel.append(box); });
    panel.append(el('textarea', { id: 'qn', placeholder: 'ملاحظاتك واستنتاجاتك (تُضاف للتقرير)…', rows: 2, style: 'width:100%;background:var(--bg2);color:var(--txt);border:1px solid var(--line);border-radius:6px' }));
    panel.append(el('div', { class: 'btnrow' }, [el('button', { class: 'primary', text: 'تسليم الإجابات', onclick: submit }), el('button', { text: 'تلميح (+2)', onclick: hint }), el('button', { text: 'جولة جديدة', onclick: newRound })]));
    panel.append(el('div', { id: 'qOut' })); if (best != null) panel.append(el('div', { style: 'font-size:12px;color:var(--mute);margin-top:6px', text: 'أفضل نتيجة: ' + best + ' / 300' })); refreshCounter();
  }
  function hint() { if (locked) return; const i = round.findIndex((p, k) => !$('#qc' + k, panel).value); if (i < 0) return toast('كل الكاتيونات مُجاب عنها'); const ci = D.ions.cations.find(x => x.key === round[i][1]); uses += 2; hints++; refreshCounter(); toast('تلميح للمجهول ' + 'ABCD'[i] + ': مجموعة الكاتيون التحليلية = ' + (ci && ci.analyticalGroup != null ? ci.analyticalGroup : 'غير محددة'), 4200); }
  function submit() {
    if (locked) return; locked = true; let okC = 0, okA = 0; const lines = [];
    round.forEach((p, i) => { const c = $('#qc' + i, panel).value, a = $('#qa' + i, panel).value; const cOk = c === p[1], aOk = a === p[2]; okC += cOk; okA += aOk;
      $('#qr' + i, panel).innerHTML = (cOk ? '✅' : '❌') + ' ' + F(p[1]) + ' &nbsp; ' + (aOk ? '✅' : '❌') + ' ' + F(p[2]) + ' → <b>' + F(p[0]) + '</b>';
      lines.push('المجهول ' + 'ABCD'[i] + ': ' + p[0] + ' (الإجابة: ' + (c || '—') + ' / ' + (a || '—') + ') — ' + (cOk && aOk ? 'صحيح' : 'خطأ') + '\n' + ''); });
    const acc = (okC + okA) * 25; const econ = Math.max(0, Math.min(100, 100 - 6 * Math.max(0, uses - par))); const total = acc + Math.round(econ * (acc / 200));
    const grade = total >= 270 ? 'محلل بارع 🏆' : total >= 200 ? 'ممتاز 🥇' : total >= 130 ? 'جيد 🥈' : total >= 60 ? 'يحتاج مراجعة 🥉' : 'حاول من جديد';
    if (best == null || total > best) { best = total; try { localStorage.setItem(PRESET_BEST, JSON.stringify(best)); } catch (e) { } }
    $('#qOut', panel).replaceChildren(el('div', { class: 'box', style: 'margin-top:8px' }, [el('div', { html: 'الدقة: <b>' + acc + '</b> / 200' }), el('div', { html: 'الاقتصاد في الكواشف (' + uses + ' استخدامًا): <b>' + Math.round(econ * (acc / 200)) + '</b> / 100' }), el('div', { style: 'font-size:18px;color:var(--accent);margin-top:4px', html: 'المجموع: <b>' + total + '</b> / 300 — ' + grade }), el('button', { style: 'margin-top:6px', text: 'تصدير تقرير المختبر', onclick: () => U.download('lab-report.txt', 'تقرير التحليل الكيفي — معمل ثانويكا\nعدد الكواشف: ' + uses + '\nالنتيجة: ' + total + '/300\n\n' + lines.join('\n\n') + '\n\nملاحظات: ' + ($('#qn', panel).value || '') + '\n\n--- سجل التجربة ---\n' + E.notebook.map(n => '• ' + (n.textAr || '')).join('\n')) })]));
    E.log({ kind: 'observation', textAr: 'سُلّمت إجابات التحليل الكيفي: ' + total + '/300' });
  }
  function enter() { if (!listening) { E.on(onLog); listening = true; } if (!round) newRound(); else { active = !locked; if (panel) panel.hidden = false; } }
  function leave() { if (panel) panel.hidden = true; active = false; }
  window.Qual = { enter, leave, newRound };
})();
