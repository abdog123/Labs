/* App: mode switching, header controls, boot. */
(function () {
  'use strict';
  const { $, $$, toast } = U; const B = Bench, E = B.E;
  const views = { lab: '#view-lab', qual: '#view-lab', phys: '#view-phys', codex: '#view-codex' }; let mode = 'lab';
  function setMode(m) {
    mode = m; $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); $$('.view').forEach(v => v.classList.remove('on'));
    $(views[m]).classList.add('on'); B.running = m === 'lab' || m === 'qual';
    if (m === 'codex') window.Codex && Codex.show(); if (m === 'phys') window.PhysLab && PhysLab.show(); if (m === 'qual') window.Qual && Qual.enter(); else window.Qual && Qual.leave();
    if (m === 'lab' || m === 'qual') setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  }
  $$('#modes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  const ts = $('#timeScale'), to = $('#timeOut'); ts.max = 2; ts.addEventListener('input', () => { const v = Math.pow(10, +ts.value); E.timeScale = v; to.textContent = '×' + (v < 10 ? v.toFixed(1) : Math.round(v)); }); ts.dispatchEvent(new Event('input'));
  $('#btnHood').addEventListener('click', e => { E.fumeHood = !E.fumeHood; e.currentTarget.classList.toggle('on', E.fumeHood); toast(E.fumeHood ? 'شُغّل شفاط الأبخرة' : 'أُطفئ شفاط الأبخرة'); });
  $('#btnLens').addEventListener('click', e => { const on = window.Lens ? Lens.toggle() : false; e.currentTarget.classList.toggle('on', on); });
  $('#btnReset').addEventListener('click', () => { if (confirm('إعادة ضبط الطاولة؟ سيُمسح كل شيء.')) { B.reset(); seed(); } });
  function seed() { B.addContainer('testTube'); B.addContainer('beaker'); B.addBurner(); B.select(null); }
  B.start(); setTimeout(() => { window.dispatchEvent(new Event('resize')); seed(); }, 80); window.App = { setMode, get mode() { return mode; }, seed };
})();
