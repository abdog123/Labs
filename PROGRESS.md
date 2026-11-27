# معمل ثانويكا (Thanawika Lab) — ملف التقدم / Resume Handoff

> عند "كمل": اقرأ هذا الملف أولًا ثم أكمل من أول بند غير مكتمل في "الخطوة التالية". لا تبدأ بحثًا جديدًا ولا تعيد بناء ما هو مكتمل.

## المصدر والقرارات
- المواصفات الكاملة: `/mnt/user-data/uploads/attachment.txt` (اقرأها بـ Read لو احتجت التفاصيل).
- القرارات المتفق عليها مع المستخدم (قال "تم" ووافق على الخطة):
  - يعمل على المتصفح بالكامل (HTML + CSS + JavaScript خام، بدون مكتبات، Canvas بدل Three.js).
  - واجهة عربية RTL، والصيغ الكيميائية LTR.
  - تحويله لتطبيق أندرويد (WebView) ممكن لاحقًا.
  - بناء على مراحل: نواة تعمل بالكامل أولًا ثم التوسعة.
  - لا يوجد تثبيت حزم (الشبكة مقفولة): Python/Node المثبتين فقط.
  - خصائص عناصر Z>=104 تقديرية/null ومعلّمة `estimated: true`.

## الهيكل الحالي (/home/claude)
```
tools/gen_elements.py   -> data/elements.json        (مكتمل، 118 عنصر، تم فحصه)
tools/gen_ions.py       -> data/ions.json            (مكتمل: 23 كاتيون، 22 أنيون، 20 حمض، 5 قواعد)
                        -> data/solubilityMatrix.json (مكتمل: 106 زوج راسب)
tools/gen_species.py    -> data/species.json         (مكتمل: 235 مادة: غازات/سوائل/أملاح/أكاسيد/معقدات/عضويات)
```
أعد توليد البيانات بـ: `cd /home/claude/tools && python3 gen_elements.py && python3 gen_ions.py && python3 gen_species.py`

## الحالة
- [x] المهمة 1 مكتملة: elements / ions / solubilityMatrix / species / reactions(132) / reagents / spectra / glassware / bundle.js
  - إعادة التوليد: `cd /home/claude/tools && for f in gen_elements gen_ions gen_species gen_reactions gen_misc build_bundle; do python3 $f.py; done`
  - `reactions.json`: لكل تفاعل reactants/products [{species,coef}], conditions, needsHeat/needsLight/needsElectricity/needsConc, catalyst, excessOf, dH_kJ, dS_JK, Ea_kJ, observationAr, gas
  - `reagents.json`: gasTests{أداة -> results{غاز -> textAr/color/effect}}, odors, toxicGases, alarmGases, indicators (مدى pH وألوان), analysisReagents
  - `data/bundle.js` يعرّف `window.LABDATA` (الواجهة تحمّله بـ script tag بدون سيرفر)
- [x] المهمة 2 مكتملة: engine/{chem,solution,container,equilibrium,catalogue,appearance,reactionEngine,physicsEngine}.js
  - اختبارات ناجحة: `for t in equilibrium engine physics; do node tests/$t.test.js; done`
  - تصميم: H+/OH- لا يُخزّنان (الحمض القوي يضيف أنيونه، القاعدة القوية كاتيونها)، pH من اتزان الشحنات؛ الترسيب بالـKsp بالتنصيف؛ الإذابة محكومة بحركية؛ الغاز المذاب يتسرب تدريجيًا.
  - ReactionEngine API: `new ReactionEngine(LABDATA)`; createContainer(type), addWater/addSolid(c,id,g,form)/addSolution(c,id,ml,M)/addLiquid/addGas/setIndicator/setFlame/pour/pourConc(slow,tilted), tick(c,dt), run(c,sec), appearance(c), measure(c), detect(c,tool), odor(c), inventory(), notebook[], fumeHood, timeScale, c.delivery=dst
  - PhysicsEngine: Circuit(MNA: R,rheostat,C,L,V,I,switch,ammeter,voltmeter,galvanometer,transformer; solve({mode:'ac',f}|{dt})), circuits, em, optics, make(data).emissionSpectrum/identifyByLines/geiger, photoelectric, crt, GasChamber, decay
- [~] المهمة 3 (جارية) — خطة الواجهة: index.html + ui/style.css + ui/{app,bench,glass,panels,notebook,codex,lens,qualitative,physicsLab}.js ؛ كلها scripts كلاسيكية (تعمل file://). خطوات: (1) هيكل+طاولة المعمل+مخزون المواد+دفتر المعمل ثم اختبار Playwright (2) الموسوعة+عدسة الذرة (3) التحليل الكيفي (4) معمل الفيزياء. تفاصيل: (طاولة المعمل Canvas، سحب وإفلات، سوائل/مساحيق/غازات، دفتر المعمل، الموسوعة، التحليل الكيفي، معمل الفيزياء، التحكم في الزمن)
- [ ] المهمة 4: اختبارات Node للمحرك (`tests/engine.test.js`) + فحص صياغة JS بـ `node --check` + تجربة الواجهة بـ Playwright (مثبت) مع screenshot

## مخطط البيانات (اتفاقيات يجب الالتزام بها)
- `elements.json`: مصفوفة؛ لكل عنصر: atomicNumber, symbol, nameAr, nameEn, atomicMass, category, electronConfiguration, shells[], physicalProperties{stateAtSTP,color,density,meltingPoint(K),boilingPoint(K),molarVolume,magneticProperty,radioactivity}, chemicalProperties{oxidationStates,electronegativity,standardReductionPotential,flameTestColor}, position{row,col}.
- `ions.json`: `{cations[], anions[], acids[], bases[], analyticalGroups}`. مفاتيح الأيونات بصيغة `Cu^2+` و `SO4^2-` و `NH4^+`.
- `solubilityMatrix.json`: `pairs[cation][anion] = {state, color, ksp, texture, textureAr, dissolvesInAcid, excessOH, excessNH3}`؛ أي زوج غير موجود = ذائب. كاتيونات Na/K/NH4/Li وأنيونات NO3/CH3COO/ClO4/HCO3/MnO4 دائمًا ذائبة. `hydrolysis` لـ Al/Fe3+/Cr3+ مع الكربونات والكبريتيد.
- `species.json`: قاموس بالمفتاح `formula` مثل `CO2(g)` و `H2SO4(conc)`؛ الحقول: nameAr, phase(g/l/s/aq), color, M, dens(نسبة لكثافة الهواء للغازات)/rho(سوائل)/ka/kb/odor/toxic/flammable/miscible.

## الخطوة التالية (ابدأ من هنا)
1. اكتب `tools/gen_reactions.py` يولد `data/reactions.json`: تفاعلات rule-based بحقول: reactants, products, conditions (heat/catalyst/light/conc), ΔH(kJ), ΔS(J/K), Ea, observations بالعربي، gas evolved. الأنواع: إحلال بسيط (من E°)، تحلل حراري، تحمض الكربونات/الكبريتيدات/الكبريتيت/الثيوكبريتات/النيتريت، كشف الهاليدات بالكبريتيك المركز، الحلقة البنية، لوشاتيليه (FeCl3+KSCN, CoCl4, CrO4/Cr2O7), عضوية (استبدال بالـUV، إضافة ماركوفنيكوف، هدرجة، أسترة، تصبن، بلمرة، احتراق، تجفيف كحول، تولنز/فهلنج).
2. اكتب `data/reagents.json`: أوراق الكشف (عباد شمس، خلات الرصاص، ثنائي كرومات محمضة، نشا/يود)، شظية مشتعلة، ماء الجير، ساق HCl.
3. اكتب `spectra.json` (خطوط الانبعاث بالنانومتر لـ H, He, Na, Hg, Ne, Li, K, Ca, Sr, Ba, Cu) و `glassware.json`.
4. اكتب `tools/build_bundle.py` ينتج `data/bundle.js`.
5. ثم المهمة 2، ثم 3، ثم 4.

## ملاحظات تنفيذ
- الملفات الكبيرة تُكتب على أجزاء (حد طول الرد): اكتب الجزء الأول ثم أضف الباقي بأوامر لاحقة.
- المستخدم يتكلم بالعامية المصرية: الردود بالعربي المصري، مختصرة، وبدون إعادة سرد الخطوات.
- التسليم النهائي: مجلد المشروع يفتح من `index.html`؛ يُرسل للمستخدم مضغوطًا (zip) أو يُنشر كـ artifact مفرد الملف إن لزم.

## Update 2026-11-27 — UI stage complete
Done: index.html, style.css, ui/util, glass, bench, panels, app, codex (periodic table+atom lens+solubility matrix+acids/bases+constants+scientists+discoveries), lens (molecular lens), qualitative (unknowns A–D scoring), physicsLab (14 experiments: dc, rc, rlc, gen, xf, snell, prism, lens, slit, spec, pe, crt, gas, gm).
All tests pass; Playwright smoke tests (/tmp/shot3-6.js) show no console errors.
Remaining: final packaging (zip), optional Playwright drag/drop test, Android WebView later.
