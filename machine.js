// espresso.machine: a working model of a Fellow Espresso Series 1 and an
// Opus 2 grinder, built from their public specs. Not a drawing that plays an
// animation: every number on the screen comes out of a small simulation.
//
//   grinder   48 mm conical burrs, stepless dial. Setting → median particle
//             size and fines fraction. About 2 g/s, a little retention.
//   puck      dose, evenness (you stir it), tamp force and level (you tamp
//             it) → porosity, bed depth, permeability (Kozeny–Carman), and a
//             risk of channelling.
//   hydraulics  pump curve (15 bar stall, ~9 ml/s free flow), headspace and
//             puck wetting, compliance, Darcy flow Q = ΔP / R(t) with R
//             falling as fines migrate and solubles leave. The machine's
//             "intelligent pressure control" is a feed-forward + P loop that
//             chases the profile's target pressure, capped at 9 bar.
//   thermal   PID-held brew temperature with droop under flow.
//   extraction  two-pool dissolution (fines fast, boulders slow, Arrhenius-ish
//             in temperature, scaled by roast) into the puck's liquid, carried
//             out by flow. Gives beverage weight, TDS, and extraction yield.
//   feedback  like the real machine: it tells you how much finer or coarser
//             to grind, found by re-simulating your shot at other settings.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var Tonic = window.Tonic, Coffee = window.Coffee, Site = window.Site;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function now() { return performance.now(); }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  if (!$('#es-svg')) return;

  /* ══ data ═══════════════════════════════════════════════════════ */
  var COLORWAYS = [
    { key: 'black', label: 'Black', shell: '#1d1d1c', wood: '#262624', cap: '#3a3a38', lid: '#141414' },
    { key: 'sesame', label: 'Sesame + Maple', shell: '#e4dac8', wood: '#d6ab74', cap: '#c9c7c2', lid: '#d6ab74' },
    { key: 'woodland', label: 'Woodland + Walnut', shell: '#566349', wood: '#6e4529', cap: '#c9c7c2', lid: '#6e4529' },
    { key: 'cherry', label: 'Cherry Red + Walnut', shell: '#93271f', wood: '#6e4529', cap: '#c9c7c2', lid: '#6e4529' },
    { key: 'marine', label: 'Marine Blue + Walnut', shell: '#274563', wood: '#6e4529', cap: '#c9c7c2', lid: '#6e4529' },
    { key: 'malted', label: 'Malted Chocolate + Maple', shell: '#563c31', wood: '#d6ab74', cap: '#c9c7c2', lid: '#d6ab74' }
  ];
  var BEANS = [
    { key: 'light', label: 'Ethiopia, washed (light)', Emax: 0.26, k: 0.8, temp: 94.5 },
    { key: 'medium', label: 'Colombia, natural (medium)', Emax: 0.28, k: 1.0, temp: 93 },
    { key: 'dark', label: 'House blend (dark)', Emax: 0.30, k: 1.25, temp: 91 }
  ];
  // Profiles return the controller's goal at this instant: target pressure,
  // an optional flow cap, a stage label, or the pump off.
  var PROFILES = [
    { key: 'classic', name: 'Classic', ratio: 2.0, window: [25, 32], desc: 'Pre-infuse at 2.5 bar for 6 s, then a flat 9 bar.',
      goal: function (s) { return s.t < 6 ? { P: 2.5, stage: 'PRE-INFUSION' } : { P: 9, stage: 'INFUSION' }; } },
    { key: 'bloom', name: 'Bloom', ratio: 2.2, window: [30, 40], desc: 'Wet the puck at 3 bar, rest it 8 s with the pump off, then 8 bar. Forgiving.',
      goal: function (s) {
        if (s.sat < 1 && !s.bloomAt) return { P: 3, stage: 'PRE-INFUSION' };
        if (!s.bloomAt) s.bloomAt = s.t;
        if (s.t - s.bloomAt < 8) return { P: 0, off: true, stage: 'BLOOM' };
        return { P: 8, stage: 'INFUSION' };
      } },
    { key: 'modern', name: 'Ramp', ratio: 2.0, window: [26, 34], desc: '2.5 bar, ramp to 9, hold, then ease down to 6 bar as the puck thins.',
      goal: function (s) {
        if (s.t < 6) return { P: 2.5, stage: 'PRE-INFUSION' };
        if (s.t < 10) return { P: lerp(2.5, 9, (s.t - 6) / 4), stage: 'INFUSION' };
        var k = s.bev / s.target;
        return k < 0.5 ? { P: 9, stage: 'INFUSION' } : { P: lerp(9, 6, (k - 0.5) / 0.5), stage: 'RAMP DOWN' };
      } },
    { key: 'turbo', name: 'Turbo', ratio: 3.0, window: [12, 18], desc: 'Coarser grind, 6 bar, a 4.5 ml/s flow cap, 1:3. Fast and clear.',
      goal: function () { return { P: 6, flow: 4.5, stage: 'INFUSION' }; } },
    { key: 'lever', name: 'Lever', ratio: 2.0, window: [25, 34], desc: 'A spring lever: 3 bar soak, a 9 bar peak, then falling as the spring unwinds.',
      goal: function (s) {
        if (s.t < 8) return { P: 3, stage: 'PRE-INFUSION' };
        var k = s.bev / s.target;
        return { P: lerp(9, 4, clamp(k, 0, 1)), stage: k < 0.5 ? 'INFUSION' : 'RAMP DOWN' };
      } },
    { key: 'manual', name: 'Manual', ratio: 2.0, window: [25, 32], desc: 'You are the profile: turn the knob during the shot to set pressure, live.',
      goal: function () { return { P: M.manualP, stage: 'MANUAL' }; } }
  ];

  var VH = 9.0;        // headspace above the puck, ml
  var C = 1.2;         // hydraulic compliance, ml per bar
  var KREF = (function () { var d = 150 + 70 * 2.5, fi = 0.30 - 0.022 * 2.5, de = d * (1 - 0.55 * fi); return de * de * Math.pow(0.4, 3) / Math.pow(0.6, 2); })();

  /* ══ state ══════════════════════════════════════════════════════ */
  var prefs = { colorway: 'sesame', bean: 'medium', dial: 3.0, speed: 2, sound: false, profile: 0, temp: 93, ratio: 2.0 };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('es-prefs') || '{}')); } catch (e) {}
  prefs.sound = false;   // never autoplay
  function savePrefs() { try { localStorage.setItem('es-prefs', JSON.stringify(prefs)); } catch (e) {} }
  function emptyCup() { return { water: 0, solids: 0, crema: 0, cremaColor: '#b9773f', milk: 0, tonic: 0, extra: 0, type: 'empty' }; }

  var M = {
    boiler: 24, ready: false,
    step: 'beans',
    hopper: 0, dosingCup: 0, grinding: 0, grindOut: 0, retention: 0.15,
    pf: 'locked', lock: 1, puck: null,
    shot: null, lastSamples: null, report: null, nextSetting: null,
    cup: emptyCup(), cupHidden: false,
    milk: null, steaming: null, water: null, flush: null,
    knobAngle: 0, editTemp: false, manualP: 0, menuUntil: 0,
    cupX: 0, pitcherX: 120, said: {}
  };

  /* ══ the drawing ════════════════════════════════════════════════ */
  var svg = $('#es-svg');
  svg.innerHTML = [
    '<defs>',
    '<linearGradient id="es-chrome" x1="0" x2="1"><stop offset="0" stop-color="#8c8f93"/><stop offset=".12" stop-color="#f4f5f6"/><stop offset=".3" stop-color="#a7aaae"/><stop offset=".55" stop-color="#e9eaec"/><stop offset=".78" stop-color="#7d8085"/><stop offset="1" stop-color="#cfd1d4"/></linearGradient>',
    '<linearGradient id="es-chrome-v" x1="0" x2="1"><stop offset="0" stop-color="#9a9da1"/><stop offset=".45" stop-color="#f6f7f8"/><stop offset="1" stop-color="#85888c"/></linearGradient>',
    '<linearGradient id="es-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1e1d"/><stop offset="1" stop-color="#121212"/></linearGradient>',
    '<linearGradient id="es-gbody" x1="0" x2="1"><stop offset="0" stop-color="#0d0d0d"/><stop offset=".35" stop-color="#262626"/><stop offset=".6" stop-color="#1a1a1a"/><stop offset="1" stop-color="#0b0b0b"/></linearGradient>',
    '<radialGradient id="es-knobg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#121212"/></radialGradient>',
    '<pattern id="es-grate" width="13" height="13" patternUnits="userSpaceOnUse"><rect width="13" height="13" fill="#1b1b1b"/><circle cx="6.5" cy="6.5" r="3.6" fill="#060606"/></pattern>',
    '<clipPath id="es-ring-clip"><rect x="690" y="214" width="154" height="34"/></clipPath>',
    '<clipPath id="es-knurl-clip"><rect x="848" y="268" width="22" height="60" rx="7"/></clipPath>',
    '</defs>',
    '<rect x="0" y="522" width="960" height="2" fill="var(--line)"/>',
    '<ellipse cx="316" cy="520" rx="290" ry="7" fill="#000" opacity=".12"/><ellipse cx="768" cy="520" rx="110" ry="6" fill="#000" opacity=".12"/>',
    // ── machine ──
    '<g id="es-mach">',
    '<rect x="72" y="134" width="516" height="318" rx="16" fill="var(--es-shell)"/>',
    '<rect x="548" y="140" width="36" height="304" rx="9" fill="var(--es-shell)" style="filter:brightness(1.08)"/>',
    '<rect x="84" y="148" width="470" height="300" rx="8" fill="url(#es-body)"/>',
    '<rect x="84" y="145" width="470" height="6" rx="2" fill="#262625"/>',
    '<rect x="96" y="164" width="112" height="274" rx="5" fill="#0e0e0e" stroke="#202020"/>',
    '<circle cx="152" cy="226" r="41" fill="#050505" stroke="#2b2b2b" stroke-width="1.5"/>',
    '<g id="es-screen" font-family="IBM Plex Sans, sans-serif"></g>',
    '<g id="es-knob" class="es-hit" tabindex="0" role="slider" aria-label="Knob: turn to choose, press to select" transform="translate(152 372)">',
    '<circle r="27" fill="#0a0a0a"/><circle r="25" fill="url(#es-knobg)" stroke="#000"/><g id="es-knob-rot"><rect x="-1.6" y="-21" width="3.2" height="8" rx="1.6" fill="#6a6a6a"/></g></g>',
    '<g id="es-keys">',
    '<g class="es-key es-hit" data-key="brew" tabindex="0" role="button" aria-label="Brew"><rect x="100" y="137" width="30" height="9" rx="2" fill="#262626"/><text x="115" y="129" text-anchor="middle" class="es-keylab">brew</text></g>',
    '<g class="es-key es-hit" data-key="steam" tabindex="0" role="button" aria-label="Steam"><rect x="134" y="137" width="30" height="9" rx="2" fill="#262626"/><text x="149" y="129" text-anchor="middle" class="es-keylab">steam</text></g>',
    '<g class="es-key es-hit" data-key="water" tabindex="0" role="button" aria-label="Hot water"><rect x="168" y="137" width="30" height="9" rx="2" fill="#262626"/><text x="183" y="129" text-anchor="middle" class="es-keylab">water</text></g>',
    '</g>',
    '<rect x="428" y="136" width="48" height="12" rx="3" fill="#232323"/>',
    '<g id="es-tamper"><rect x="444" y="114" width="16" height="24" rx="4" fill="var(--es-wood)" style="filter:brightness(.82)"/><ellipse cx="452" cy="98" rx="17" ry="22" fill="var(--es-wood)"/><ellipse cx="446" cy="90" rx="5" ry="9" fill="#fff" opacity=".18"/></g>',
    '<rect x="252" y="94" width="140" height="70" rx="10" fill="url(#es-chrome)"/>',
    '<rect x="252" y="94" width="140" height="6" rx="3" fill="#fff" opacity=".35"/>',
    '<circle cx="322" cy="142" r="3" fill="#6d7075"/>',
    '<rect x="274" y="162" width="96" height="18" rx="4" fill="url(#es-chrome)"/>',
    '<g id="es-pf" class="es-hit"><rect x="282" y="176" width="80" height="20" rx="7" fill="url(#es-chrome)"/><path id="es-pf-handle" fill="var(--es-wood)"/><ellipse id="es-pf-cap" fill="var(--es-cap)"/><circle id="es-pf-dot" r="2.4" fill="#555"/></g>',
    '<path d="M498 150V116Q498 98 516 98Q534 98 534 116V398" fill="none" stroke="url(#es-chrome-v)" stroke-width="9" stroke-linecap="round"/>',
    '<circle cx="498" cy="150" r="7" fill="url(#es-chrome)"/><rect x="529.5" y="396" width="9" height="13" rx="2.5" fill="url(#es-chrome-v)"/>',
    '<rect x="48" y="448" width="536" height="68" rx="6" fill="#141414"/>',
    '<rect x="60" y="452" width="512" height="26" rx="3" fill="url(#es-grate)" stroke="#8a8d91" stroke-width="1.2"/>',
    '<rect x="48" y="480" width="536" height="2" fill="#000" opacity=".5"/>',
    '<g id="es-pitcher"><path d="M508 372h48l-4 74h-40z" fill="url(#es-chrome-v)"/><path d="M556 382q14 2 12 22t-12 22" fill="none" stroke="#a6a9ad" stroke-width="5"/><path d="M508 372l-8-6h10z" fill="#c9cbce"/></g>',
    '<g id="es-cupg"><rect x="276" y="430" width="92" height="16" rx="3" fill="#0b0b0b"/><rect x="304" y="433" width="36" height="10" rx="2" fill="#141e18"/><text id="es-scale" x="322" y="441.5" text-anchor="middle" class="es-scale">0.0</text>',
    '<path id="es-cup" class="es-cup es-hit" d="M290 352h64l-4 70a8 8 0 0 1-8 7h-40a8 8 0 0 1-8-7z"/></g>',
    '</g>',
    // ── grinder ──
    '<g id="es-grinder">',
    '<rect x="668" y="490" width="200" height="26" rx="5" fill="#111"/>',
    '<g id="es-gbtn" class="es-hit" tabindex="0" role="button" aria-label="Grind"><circle cx="848" cy="503" r="8" fill="#1b1b1b" stroke="#3a3a3a"/><circle id="es-gled" cx="848" cy="503" r="2.4" fill="#444"/></g>',
    '<g id="es-dcup" class="es-hit" role="button" aria-label="Dosing cup"><rect x="708" y="404" width="118" height="86" rx="10" fill="url(#es-gbody)"/><rect x="708" y="404" width="118" height="7" rx="3" fill="#2c2c2c"/></g>',
    '<g id="es-gbodyg"><rect x="688" y="196" width="158" height="204" rx="22" fill="url(#es-gbody)"/>',
    '<rect x="688" y="214" width="158" height="34" fill="#0c0c0c"/><g id="es-ring" clip-path="url(#es-ring-clip)"></g>',
    '<rect x="765.5" y="248" width="3" height="14" fill="#e0453a"/>',
    '<rect id="es-lid" class="es-hit" x="686" y="176" width="162" height="28" rx="12" fill="var(--es-lid)"/>',
    '<g id="es-gknob" class="es-hit" tabindex="0" role="slider" aria-label="Grind dial"><rect x="846" y="266" width="26" height="64" rx="8" fill="#161616" stroke="#2a2a2a"/><g clip-path="url(#es-knurl-clip)" id="es-knurl"></g></g>',
    '</g>',
    '</g>'
  ].join('');

  var el = {};
  ['screen', 'knob', 'knob-rot', 'pf', 'pf-handle', 'pf-cap', 'pf-dot', 'tamper', 'pitcher', 'cupg', 'scale', 'cup',
    'gbtn', 'gled', 'dcup', 'gbodyg', 'ring', 'lid', 'gknob', 'knurl', 'tip'].forEach(function (id) { el[id] = document.getElementById('es-' + id); });

  /* ── colourways, beans, speed ─────────────────────────────────── */
  var stage = $('#es-stage');
  function applyColorway() {
    var c = COLORWAYS.filter(function (x) { return x.key === prefs.colorway; })[0] || COLORWAYS[1];
    stage.style.setProperty('--es-shell', c.shell); stage.style.setProperty('--es-wood', c.wood);
    stage.style.setProperty('--es-cap', c.cap); stage.style.setProperty('--es-lid', c.lid);
    M.woodColor = c.wood;
    $$('#es-swatches button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.key === c.key)); });
  }
  $('#es-swatches').innerHTML = COLORWAYS.map(function (c) {
    return '<button type="button" role="radio" data-key="' + c.key + '" title="' + c.label + '" aria-label="' + c.label + '" style="--a:' + c.shell + ';--b:' + c.wood + '"></button>';
  }).join('');
  $('#es-swatches').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; prefs.colorway = b.dataset.key; savePrefs(); applyColorway(); });
  applyColorway();

  var beanSel = $('#es-bean');
  beanSel.innerHTML = BEANS.map(function (b) { return '<option value="' + b.key + '">' + b.label + '</option>'; }).join('');
  beanSel.value = prefs.bean;
  function bean() { return BEANS.filter(function (b) { return b.key === prefs.bean; })[0] || BEANS[1]; }

  $$('#es-speed button').forEach(function (b) {
    b.classList.toggle('on', Number(b.dataset.speed) === prefs.speed);
    b.addEventListener('click', function () { prefs.speed = Number(b.dataset.speed); savePrefs(); $$('#es-speed button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
  });

  var tipT;
  function tip(text, ms) { el.tip.textContent = text; el.tip.classList.add('show'); clearTimeout(tipT); tipT = setTimeout(function () { el.tip.classList.remove('show'); }, ms || 3400); }

  /* ══ controls in the rail ═══════════════════════════════════════ */
  var doseIn = $('#es-dose'), dialIn = $('#es-dial'), tempIn = $('#es-temp'), ratioIn = $('#es-ratio');
  dialIn.value = prefs.dial; tempIn.value = prefs.temp; ratioIn.value = prefs.ratio;
  beanSel.addEventListener('change', function () {
    prefs.bean = beanSel.value; prefs.temp = bean().temp; tempIn.value = prefs.temp; savePrefs(); paintControls();
    tip('New bag. ' + bean().label.split(' (')[0] + ' likes about ' + bean().temp + '°C.');
  });
  function dialNote(v) {
    return v < 1 ? 'Turkish territory. It may choke.' : v < 4 ? 'Espresso range.' : v < 6 ? 'Coarse for espresso: turbo shots, or moka.' : v < 8.5 ? 'Pour-over range. Espresso will gush.' : 'French press. Not for this machine.';
  }
  function targetWeight() { var d = M.puck ? M.puck.dose : Number(doseIn.value); return d * prefs.ratio; }
  function paintControls() {
    $('#es-dose-v').textContent = f1(Number(doseIn.value));
    $('#es-dial-v').textContent = f1(prefs.dial);
    $('#es-dial-note').textContent = dialNote(prefs.dial);
    $('#es-temp-v').textContent = f1(prefs.temp);
    $('#es-ratio-v').textContent = f1(prefs.ratio);
    var p = PROFILES[prefs.profile];
    $('#es-prof').textContent = p.name;
    $('#es-prof-desc').textContent = p.desc;
    $('#es-manual-hint').textContent = p.key === 'manual' ? 'turn the knob while it runs' : 'stops itself at ' + f1(targetWeight()) + ' g';
  }
  doseIn.addEventListener('input', paintControls);
  dialIn.addEventListener('input', function () { setDial(Number(dialIn.value)); });
  tempIn.addEventListener('input', function () { prefs.temp = Number(tempIn.value); savePrefs(); paintControls(); });
  ratioIn.addEventListener('input', function () { prefs.ratio = Number(ratioIn.value); savePrefs(); paintControls(); });
  function setProfile(i) {
    prefs.profile = (i + PROFILES.length) % PROFILES.length;
    prefs.ratio = PROFILES[prefs.profile].ratio; ratioIn.value = prefs.ratio;
    savePrefs(); paintControls(); M.menuUntil = now() + 1800;
  }
  $('#es-prev').addEventListener('click', function () { setProfile(prefs.profile - 1); });
  $('#es-next').addEventListener('click', function () { setProfile(prefs.profile + 1); });
  function setDial(v) {
    prefs.dial = clamp(Math.round(v * 10) / 10, 0.5, 11);
    dialIn.value = prefs.dial; savePrefs(); paintControls();
  }

  function setStep(s) {
    M.step = s;
    var order = ['beans', 'grind', 'prep', 'lock', 'brew', 'serve'], at = order.indexOf(s);
    $$('#es-rail > li').forEach(function (li) {
      var i = order.indexOf(li.dataset.step);
      li.classList.toggle('on', i === at); li.classList.toggle('done', at >= 0 && i < at);
    });
    $('#es-load').disabled = s !== 'beans';
    $('#es-grind').disabled = !(s === 'grind' && M.hopper > 0 && !M.grinding);
    $('#es-dump').disabled = !(s === 'prep' && M.dosingCup > 0 && !(M.puck && M.puck.inBasket));
    $('#es-wdt-auto').disabled = !(s === 'prep' && M.puck && M.puck.inBasket && !M.puck.tamped);
    $('#es-insert').disabled = !(s === 'prep' && M.puck && M.puck.tamped);
    $('#es-lock').disabled = s !== 'lock';
    $('#es-brew').disabled = !(s === 'brew' || (M.shot && M.shot.running));
    $('#es-brew').textContent = M.shot && M.shot.running ? 'Stop' : 'Brew';
    ['#es-give', '#es-tonic', '#es-americano', '#es-steam'].forEach(function (q) { $(q).disabled = s !== 'serve'; });
    $('#es-steam').textContent = M.milk ? 'Pour the milk in' : 'Steam milk';
    $('#es-americano').disabled = s !== 'serve' || M.cup.type !== 'espresso';
    $('#es-tonic').disabled = s !== 'serve' || M.cup.type !== 'espresso';
    stage.dataset.step = s;
  }

  /* ══ beans and the grinder ═════════════════════════════════════ */
  var parts = [];   // particles for the fx canvas, in viewBox units
  function loadBeans() {
    if (M.step !== 'beans') return;
    M.hopper = Number(doseIn.value);
    for (var i = 0; i < 26; i++) parts.push({ k: 'bean', x: rnd(735, 800), y: rnd(40, 120), vx: rnd(-15, 15), vy: rnd(0, 60), r: rnd(3.2, 4.2), a: rnd(0, 6), va: rnd(-6, 6), life: 1.4, stop: 184 });
    tip(f1(M.hopper) + ' g of ' + bean().label.split(' (')[0] + ' in the grinder. Set the dial (the side knob), then grind.');
    Tonic.lookAt(svg, 1200); Tonic.say('beans!', 900);
    setStep('grind');
  }
  $('#es-load').addEventListener('click', loadBeans);
  el.lid.addEventListener('click', function () { if (M.step === 'beans') loadBeans(); else if (M.hopper) tip('Already loaded: ' + f1(M.hopper) + ' g. Weigh, then load: single-dose.'); });

  function startGrind() {
    if (M.step !== 'grind' || M.grinding || M.hopper <= 0) return;
    M.grinding = 1; M.grindOut = 0; M.retention = rnd(0.08, 0.22);
    tip('Grinding at ' + f1(prefs.dial) + '. About 9 s for a double.');
    Tonic.mood('happy', 900);
    setStep('grind');
  }
  $('#es-grind').addEventListener('click', startGrind);
  el.gbtn.addEventListener('click', startGrind);
  el.gbtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGrind(); } });

  // the side dial: drag vertically, scroll, or arrow keys
  (function () {
    var drag = null;
    el.gknob.addEventListener('pointerdown', function (e) { drag = { y: e.clientY, v: prefs.dial }; try { el.gknob.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
    el.gknob.addEventListener('pointermove', function (e) { if (drag) setDial(drag.v + (drag.y - e.clientY) / 18); });
    el.gknob.addEventListener('pointerup', function () { drag = null; });
    el.gknob.addEventListener('wheel', function (e) { e.preventDefault(); setDial(prefs.dial + (e.deltaY < 0 ? 0.1 : -0.1)); }, { passive: false });
    el.gknob.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setDial(prefs.dial + 0.1); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setDial(prefs.dial - 0.1); e.preventDefault(); }
    });
  })();

  function grinderTick(dt) {
    if (!M.grinding) return;
    var rate = 2.0 * (0.85 + prefs.dial * 0.04);
    var take = Math.min(M.hopper, rate * dt);
    M.hopper -= take; M.grindOut += take;
    M.dosingCup = Math.max(0, M.grindOut - M.retention);
    for (var i = 0; i < 3; i++) parts.push({ k: 'ground', x: rnd(752, 782), y: 398, vx: rnd(-10, 10), vy: rnd(20, 60), r: rnd(0.8, 1.6), life: 0.25 });
    $('#es-cup-v').textContent = f1(M.dosingCup) + ' g in the dosing cup';
    if (M.hopper <= 0.001) {
      M.grinding = 0; M.hopper = 0;
      tip(f1(M.dosingCup) + ' g out; ' + f1(M.retention) + ' g stayed in the burrs. Pour it into the basket.');
      Tonic.say(f1(M.dosingCup) + ' g. smells amazing', 1500);
      M.pf = 'prep'; M.lock = 0;
      setStep('prep'); paintPrep();
    }
  }

  /* ══ puck prep: a top-down basket you stir and tamp ═════════════ */
  var puckCv = $('#es-puck'), pctx = puckCv.getContext('2d'), G = 30;
  function inDisk(i, j) { var x = (i + 0.5) / G * 2 - 1, y = (j + 0.5) / G * 2 - 1; return x * x + y * y <= 1; }
  function newPuck(dose) {
    var cells = [], i, j, clumps = [];
    for (i = 0; i < 9; i++) clumps.push({ x: rnd(-0.6, 0.6), y: rnd(-0.6, 0.6), s: rnd(0.4, 1.1) });
    for (j = 0; j < G; j++) for (i = 0; i < G; i++) {
      var x = (i + 0.5) / G * 2 - 1, y = (j + 0.5) / G * 2 - 1, r2 = x * x + y * y, v = 0;
      if (r2 <= 1) {
        v = 0.55 + 1.1 * Math.max(0, 1 - r2 * 1.3) + rnd(-0.12, 0.12);
        clumps.forEach(function (c) { var d2 = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y); v += c.s * Math.exp(-d2 * 70); });
      }
      cells.push(v);
    }
    var p = { dose: dose, cells: cells, inBasket: true, tamped: false, U: 0, force: 0, tilt: 0, tiltDir: 0 };
    p.U = evenness(p);
    return p;
  }
  function evenness(p) {
    var sum = 0, sum2 = 0, n = 0;
    for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
      var x = (i + 0.5) / G * 2 - 1, y = (j + 0.5) / G * 2 - 1;
      if (x * x + y * y > 0.92) continue;
      var v = p.cells[j * G + i]; sum += v; sum2 += v * v; n++;
    }
    var m = sum / n, cv = Math.sqrt(Math.max(0, sum2 / n - m * m)) / m;
    return clamp((0.62 - cv) / 0.56, 0, 1);
  }
  function stirAt(cx, cy, rad) {
    var p = M.puck; if (!p || p.tamped) return;
    var c = p.cells, next = c.slice(), i, j;
    for (j = 0; j < G; j++) for (i = 0; i < G; i++) {
      if (!inDisk(i, j)) continue;
      var x = (i + 0.5) / G * 2 - 1, y = (j + 0.5) / G * 2 - 1, d = Math.hypot(x - cx, y - cy);
      if (d > rad) continue;
      var acc = 0, n = 0;
      for (var dj = -2; dj <= 2; dj++) for (var di = -2; di <= 2; di++) {
        var ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= G || jj >= G || !inDisk(ii, jj)) continue;
        acc += c[jj * G + ii]; n++;
      }
      next[j * G + i] = lerp(c[j * G + i], acc / n, 0.55 * (1 - d / rad));
    }
    // stirring also walks the mound out toward the walls
    var total = 0, cnt = 0; next.forEach(function (v) { if (v > 0) { total += v; cnt++; } });
    var mean = total / cnt;
    for (var k = 0; k < next.length; k++) if (next[k] > 0) next[k] = lerp(next[k], mean, 0.006);
    p.cells = next; p.U = evenness(p);
  }
  var stir = { on: false, x: null, y: null, moved: 0, t0: 0 }, tamp = { on: false, ox: 0, oy: 0, force: 0 };
  function drawPuck() {
    var W = puckCv.width, R = W * 0.43, cx = W / 2, cy = W / 2, p = M.puck;
    pctx.clearRect(0, 0, W, W);
    pctx.beginPath(); pctx.arc(cx, cy, R + 16, 0, Math.PI * 2); pctx.fillStyle = '#b9bcc0'; pctx.fill();
    pctx.beginPath(); pctx.arc(cx, cy, R + 9, 0, Math.PI * 2); pctx.fillStyle = '#7e8186'; pctx.fill();
    pctx.beginPath(); pctx.arc(cx, cy, R, 0, Math.PI * 2); pctx.fillStyle = '#2b2b2b'; pctx.fill();
    if (p && p.inBasket) {
      if (!p.tamped) {
        var cs = W / G * 0.86 * 1.0;
        for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
          var v = p.cells[j * G + i]; if (v <= 0) continue;
          var x = (i + 0.5) / G * 2 - 1, y = (j + 0.5) / G * 2 - 1;
          if (x * x + y * y > 1) continue;
          pctx.fillStyle = 'hsl(24, 42%, ' + clamp(14 + v * 10, 12, 46) + '%)';
          pctx.fillRect(cx + x * R - cs / 2, cy + y * R - cs / 2, cs + 1, cs + 1);
        }
        pctx.globalAlpha = 0.22;
        for (var k = 0; k < 420; k++) { var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R; pctx.fillStyle = Math.random() < 0.5 ? '#1c0f08' : '#6b4127'; pctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2, 2); }
        pctx.globalAlpha = 1;
      } else {
        var g = pctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 10, cx, cy, R);
        g.addColorStop(0, '#5a3824'); g.addColorStop(1, '#3a2316');
        pctx.beginPath(); pctx.arc(cx, cy, R, 0, Math.PI * 2); pctx.fillStyle = g; pctx.fill();
        if (p.tilt > 0.4) {   // a tilted tamp leaves one side deeper
          pctx.save(); pctx.beginPath(); pctx.arc(cx, cy, R, 0, Math.PI * 2); pctx.clip();
          pctx.beginPath(); pctx.arc(cx + Math.cos(p.tiltDir) * R * 1.05, cy + Math.sin(p.tiltDir) * R * 1.05, R * 0.55, 0, Math.PI * 2);
          pctx.fillStyle = 'rgba(0,0,0,' + clamp(p.tilt / 6, 0, 0.45) + ')'; pctx.fill(); pctx.restore();
        }
        pctx.strokeStyle = 'rgba(255,255,255,0.07)'; pctx.lineWidth = 2;
        pctx.beginPath(); pctx.arc(cx, cy, R * 0.92, 0, Math.PI * 2); pctx.stroke();
      }
    } else {
      pctx.fillStyle = '#9a9a9a'; pctx.font = '600 22px IBM Plex Mono, monospace'; pctx.textAlign = 'center';
      pctx.fillText(M.pf === 'prep' ? 'empty basket' : 'portafilter in the machine', cx, cy + 8);
    }
    if (tamp.on) {
      var ox = tamp.ox * R * 0.25, oy = tamp.oy * R * 0.25;
      pctx.beginPath(); pctx.arc(cx + ox * 0.3, cy + oy * 0.3, R * 0.98, 0, Math.PI * 2); pctx.fillStyle = 'rgba(200,203,207,0.6)'; pctx.fill();
      pctx.beginPath(); pctx.arc(cx + ox, cy + oy, R * 0.32, 0, Math.PI * 2); pctx.fillStyle = M.woodColor || '#a8784a'; pctx.fill();
    }
    if (stir.on && stir.x != null) {
      pctx.strokeStyle = 'rgba(235,235,235,0.85)'; pctx.lineWidth = 2;
      for (var n = 0; n < 6; n++) { var aa = n / 6 * Math.PI * 2 + now() / 90; pctx.beginPath(); pctx.arc(cx + stir.x * R + Math.cos(aa) * 9, cy + stir.y * R + Math.sin(aa) * 9, 2.2, 0, Math.PI * 2); pctx.stroke(); }
    }
  }
  function puckXY(e) { var r = puckCv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width * 2 - 1) / 0.86, y: ((e.clientY - r.top) / r.height * 2 - 1) / 0.86 }; }
  puckCv.addEventListener('pointerdown', function (e) {
    var p = M.puck; if (!p || !p.inBasket || p.tamped || M.step !== 'prep') return;
    try { puckCv.setPointerCapture(e.pointerId); } catch (x) {}
    var q = puckXY(e);
    stir.on = true; stir.x = q.x; stir.y = q.y; stir.moved = 0; stir.t0 = now();
    e.preventDefault();
  });
  puckCv.addEventListener('pointermove', function (e) {
    var q = puckXY(e);
    if (tamp.on) { tamp.ox = clamp(q.x, -1, 1); tamp.oy = clamp(q.y, -1, 1); return; }
    if (!stir.on) return;
    stir.moved += Math.hypot(q.x - stir.x, q.y - stir.y);
    if (stir.moved > 0.06) for (var k = 0; k < 3; k++) stirAt(lerp(stir.x, q.x, k / 3), lerp(stir.y, q.y, k / 3), 0.32);
    stir.x = q.x; stir.y = q.y;
    paintPrep();
  });
  function puckUp() { if (tamp.on) { finishTamp(); return; } stir.on = false; stir.x = null; }
  puckCv.addEventListener('pointerup', puckUp); puckCv.addEventListener('pointercancel', puckUp);
  // holding still turns a stir into a tamp
  setInterval(function () {
    if (stir.on && !tamp.on && stir.moved < 0.06 && now() - stir.t0 > 380) {
      stir.on = false; tamp.on = true; tamp.ox = stir.x || 0; tamp.oy = stir.y || 0; tamp.force = 0;
      el.tamper.style.opacity = '0';
    }
  }, 60);
  function tampTick(dt) {
    if (!tamp.on) return;
    tamp.force = Math.min(32, tamp.force + dt * 13);
    var off = Math.hypot(tamp.ox, tamp.oy);
    $('#es-force').style.width = (tamp.force / 32 * 100) + '%';
    $('#es-force-v').textContent = Math.round(tamp.force) + ' kg';
    $('#es-bubble').style.transform = 'translate(' + (tamp.ox * 16) + 'px,' + (tamp.oy * 16) + 'px)';
    $('#es-tilt-v').textContent = f1(off * 4) + '°';
  }
  function finishTamp() {
    var p = M.puck; tamp.on = false; el.tamper.style.opacity = '';
    if (!p) return;
    var off = Math.hypot(tamp.ox, tamp.oy);
    p.force = tamp.force; p.tilt = clamp(off * 4, 0, 4); p.tiltDir = Math.atan2(tamp.oy, tamp.ox);
    if (p.force < 4) { tip('That was a touch, not a tamp. Hold longer: 13 to 20 kg.'); return; }
    p.tamped = true;
    var notes = [];
    if (p.U < 0.45) notes.push('clumpy: stir more next time');
    if (p.force < 10) notes.push('light tamp');
    else if (p.force > 24) notes.push('heavy, though level matters more');
    if (p.tilt > 1.5) notes.push('tilted ' + f1(p.tilt) + '°');
    tip('Tamped at ' + Math.round(p.force) + ' kg' + (notes.length ? ': ' + notes.join(', ') + '.' : ', level. Lovely puck.'), 3800);
    Tonic.mood(notes.length ? 'curious' : 'happy', 900);
    Tonic.say(notes.length ? notes[0] : 'flat as a table', 1400);
    paintPrep(); setStep('prep'); drawPuck();
  }
  function paintPrep() {
    var p = M.puck, U = p ? p.U : 0;
    $('#es-even').style.width = (U * 100) + '%';
    $('#es-even-v').textContent = Math.round(U * 100) + '%';
    if (p && p.tamped) { $('#es-force').style.width = (p.force / 32 * 100) + '%'; $('#es-force-v').textContent = Math.round(p.force) + ' kg'; $('#es-tilt-v').textContent = f1(p.tilt) + '°'; $('#es-bubble').style.transform = 'translate(' + (Math.cos(p.tiltDir) * p.tilt * 4) + 'px,' + (Math.sin(p.tiltDir) * p.tilt * 4) + 'px)'; }
    var h = $('#es-prep-hint');
    if (M.step !== 'prep') h.textContent = M.pf === 'prep' ? 'Empty basket.' : 'The portafilter is in the machine.';
    else if (!p || !p.inBasket) h.textContent = 'Pour the dosing cup into the portafilter.';
    else if (!p.tamped) h.textContent = p.U < 0.7 ? 'Drag inside the basket to stir out the clumps (WDT). Aim past 70%.' : 'Even. Now press and hold still in the basket to tamp. Keep the pointer centred to stay level.';
    else h.textContent = 'Puck ready. Insert the portafilter.';
  }
  function dumpCup() {
    if (M.step !== 'prep' || M.dosingCup <= 0) return;
    M.puck = newPuck(M.dosingCup); M.dosingCup = 0;
    $('#es-cup-v').textContent = 'cup empty';
    tip('A mound with clumps. Stir it flat: drag inside the basket.');
    paintPrep(); setStep('prep'); drawPuck();
  }
  $('#es-dump').addEventListener('click', dumpCup);
  el.dcup.addEventListener('click', function () { if (M.step === 'prep') dumpCup(); });
  function autoStir() {
    return new Promise(function (res) {
      var t0 = now();
      (function go() {
        var t = (now() - t0) / 1000;
        for (var k = 0; k < 3; k++) { var a = t * 9 + k, r = 0.85 * (0.2 + 0.8 * ((t * 0.7) % 1)); stir.x = Math.cos(a) * r; stir.y = Math.sin(a) * r; stirAt(stir.x, stir.y, 0.32); }
        stir.on = true; paintPrep(); drawPuck();
        if (M.puck && M.puck.U < 0.9 && t < 6) requestAnimationFrame(go); else { stir.on = false; stir.x = null; paintPrep(); drawPuck(); res(); }
      })();
    });
  }
  $('#es-wdt-auto').addEventListener('click', function () { autoStir(); });
  function insert() {
    if (!(M.puck && M.puck.tamped) || M.step !== 'prep') return;
    M.pf = 'unlocked'; M.lock = 0;
    tip('In the group, not locked. Drag the handle right, or twist to lock.');
    setStep('lock'); paintPrep(); drawPuck();
  }
  $('#es-insert').addEventListener('click', insert);

  /* ── locking the portafilter: drag the handle ─────────────────── */
  function animateLock(to, done) {
    var from = M.lock, t0 = now();
    (function go() { var k = clamp((now() - t0) / 450, 0, 1); M.lock = lerp(from, to, 1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(go); else if (done) done(); })();
  }
  function lockIt() {
    if (M.step !== 'lock') return;
    animateLock(1, function () { M.pf = 'locked'; tip('Locked. Turn the knob to pick a profile, press it for temperature, then brew.'); Tonic.say('click.', 800); setStep('brew'); });
  }
  $('#es-lock').addEventListener('click', lockIt);
  (function () {
    var drag = null;
    el.pf.addEventListener('pointerdown', function (e) {
      if (M.pf === 'prep') return;
      if (M.shot && M.shot.running) { tip('Not mid-shot. There are nine bar behind that handle.'); return; }
      drag = { x: e.clientX, l: M.lock, moved: 0 }; try { el.pf.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
    });
    el.pf.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = svg.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width * 960;
      drag.moved = Math.max(drag.moved, Math.abs(dx));
      M.lock = clamp(drag.l + dx / 110, 0, 1);
    });
    el.pf.addEventListener('pointerup', function () {
      if (!drag) return;
      var click = drag.moved < 3; drag = null;
      if (click) { if (M.step === 'lock') lockIt(); return; }
      if (M.lock > 0.7) { if (M.step === 'lock') lockIt(); else animateLock(1); }
      else animateLock(0, function () { if (M.pf === 'locked') { M.pf = 'unlocked'; if (M.step === 'brew') setStep('lock'); } });
    });
  })();

  /* ══ the knob and the keys ══════════════════════════════════════ */
  function turnKnob(dir) {
    M.knobAngle += dir * 18;
    if (M.steaming) { M.steaming.target = clamp(M.steaming.target + dir, 50, 70); return; }
    if (M.shot && M.shot.running) { if (PROFILES[prefs.profile].key === 'manual') M.manualP = clamp(M.manualP + dir * 0.5, 0, 9); return; }
    if (M.editTemp) { prefs.temp = clamp(prefs.temp + dir * 0.5, 88, 96); tempIn.value = prefs.temp; savePrefs(); paintControls(); M.menuUntil = now() + 2500; return; }
    setProfile(prefs.profile + dir);
  }
  function pressKnob() {
    if (M.shot && M.shot.running) return;
    M.editTemp = !M.editTemp; M.menuUntil = now() + 2500;
    tip(M.editTemp ? 'Temperature: turn to adjust, press to finish.' : 'Profile: turn to choose.');
  }
  (function () {
    var drag = null, acc = 0;
    el.knob.addEventListener('wheel', function (e) { e.preventDefault(); turnKnob(e.deltaY > 0 ? 1 : -1); }, { passive: false });
    el.knob.addEventListener('pointerdown', function (e) { drag = { y: e.clientY, moved: 0 }; acc = 0; try { el.knob.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
    el.knob.addEventListener('pointermove', function (e) {
      if (!drag) return; var dy = drag.y - e.clientY; drag.y = e.clientY; acc += dy; drag.moved += Math.abs(dy);
      while (acc > 14) { turnKnob(1); acc -= 14; } while (acc < -14) { turnKnob(-1); acc += 14; }
    });
    el.knob.addEventListener('pointerup', function () { if (drag && drag.moved < 4) pressKnob(); drag = null; });
    el.knob.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { turnKnob(1); e.preventDefault(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { turnKnob(-1); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { pressKnob(); e.preventDefault(); }
    });
  })();
  $$('.es-key').forEach(function (k) {
    function act() {
      var key = k.dataset.key; k.classList.add('down'); setTimeout(function () { k.classList.remove('down'); }, 160);
      if (key === 'brew') brewKey(); else if (key === 'steam') steamKey(); else waterKey();
    }
    k.addEventListener('click', act);
    k.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });
  $('#es-brew').addEventListener('click', brewKey);

  /* ══ hydraulics, heat, and extraction ═══════════════════════════ */
  function puckParams(setting, puck) {
    var d = 150 + 70 * setting, fines = clamp(0.30 - 0.022 * setting, 0.08, 0.32);
    var eps = clamp(0.40 - 0.0035 * ((puck.force || 2) - 15), 0.30, 0.46);
    var de = d * (1 - 0.55 * fines), kappa = de * de * Math.pow(eps, 3) / Math.pow(1 - eps, 2);
    var R0 = 4.6 * (puck.dose / 18) * (KREF / kappa) * (1 - (1 - puck.U) * 0.12);
    var b = bean(), Stot = b.Emax * puck.dose, ff = Math.min(0.8, 0.5 + 0.9 * fines);
    var risk = clamp((1 - puck.U) * 0.8 + (puck.tilt / 4) * 0.55 + (puck.force < 10 ? 0.35 : 0) + Math.max(0, Math.abs(puck.dose - 18) - 1.5) * 0.12, 0, 1);
    return { R0: R0, Sf: Stot * ff, Ss: Stot * (1 - ff), kf: 0.55 * b.k, ks: 0.05 * b.k * Math.pow(325 / d, 2), Vabs: 1.05 * puck.dose, risk: risk };
  }
  function newShot(setting, puck, profile, temp, target) {
    var pp = puckParams(setting, puck);
    return { setting: setting, dose: puck.dose, profile: profile, Tset: temp, Tg: temp, target: target,
      R0: pp.R0, Sf: pp.Sf, Ss: pp.Ss, kf: pp.kf, ks: pp.ks, Vabs: pp.Vabs, risk: pp.risk,
      t: 0, P: 0, Vin: 0, Vthru: 0, Md: 0, water: 0, solids: 0, bev: 0, sat: 0, b: 0, Qp: 0, Qout: 0, Qin: 0, c: 0,
      phase: 'fill', stage: 'PRE-INFUSION', firstDrop: null, channelAt: null, running: true, sumP: 0, tP: 0, goalP: 0, bloomAt: 0 };
  }
  // one step of the model; `live` adds the dice (channels) that a replay leaves out
  function advance(s, dt, live) {
    var g = s.profile.goal(s), Pt = Math.min(g.P, 9);
    s.goalP = g.off ? 0 : Pt; s.stage = g.stage;
    var Qmax = 9 * (1 - s.P / 15);
    s.sat = clamp((s.Vin - VH) / s.Vabs, 0, 1);
    s.phase = s.Vin < VH ? 'fill' : s.sat < 1 ? 'wet' : 'flow';
    var R = s.R0 * (0.62 + 0.38 * Math.exp(-s.Vthru / (2.2 * s.dose))) * (0.85 + 0.15 * s.sat) * (1 - s.b * 1.6);
    // the last of the puck saturates unevenly, so outflow fades in rather than switching on
    var outFrac = s.phase === 'fill' ? 0 : clamp((s.sat - 0.85) / 0.15, 0, 1);
    var Qout = s.P / R * outFrac, Qabs = s.phase === 'wet' ? s.P / (R * 0.45) * (1 - outFrac) : 0, Qin = Qabs + Qout, Qp;
    if (s.phase === 'fill') {
      Qp = g.off ? 0 : Math.min(Qmax, g.flow || 6);
      s.Vin += Qp * dt; s.P = Math.max(0.1, s.P * 0.9);
    } else {
      Qp = g.off ? 0 : clamp(Qin + (Pt - s.P) * C * 5, 0, Math.min(Qmax, g.flow || 99));
      s.P = clamp(s.P + (Qp - Qin) / C * dt, 0, 9.6);
      s.Vin += Qabs * dt + (s.phase === 'wet' ? Qout * dt * 0.15 : 0);
    }
    s.Tg += ((s.Tset - s.Tg) * 0.6 - Qp * 0.22) * dt;
    var Tf = Math.exp((s.Tg - 93) * 0.05);
    if (s.sat > 0.2) {
      var Vl = s.Vabs * s.sat, c = s.Md / Vl, satur = Math.max(0, 1 - c / 0.42);
      var rf = s.kf * Tf * s.Sf * satur * s.sat, rs = s.ks * Tf * s.Ss * satur * s.sat;
      s.Sf -= rf * dt; s.Ss -= rs * dt; s.Md += (rf + rs) * dt;
      var out = c * Qout * dt * (1 - s.b) + c * 0.2 * Qout * dt * s.b;
      s.Md -= out; s.solids += out; s.water += Qout * dt; s.Vthru += Qout * dt; s.c = c;
      if (Qout > 0.05 && s.firstDrop == null) s.firstDrop = s.t;
    }
    if (live && s.phase === 'flow' && s.P > 5 && s.channelAt == null && Math.random() < s.risk * s.risk * 0.06 * dt) {
      s.channelAt = s.t; s.b = 0.12 + 0.25 * s.risk;
    }
    s.Qp = Qp; s.Qout = Qout; s.Qin = Qin; s.t += dt;
    s.bev = s.water + s.solids;
    if (s.P > 0.8) { s.sumP += s.P * dt; s.tP += dt; }
  }
  // replay a shot to its target weight, without the dice; used for feedback
  function replay(setting, puck, profile, temp, target) {
    var s = newShot(setting, puck, profile, temp, target), dt = 0.05;
    while (s.t < 90 && s.bev < target) advance(s, dt, false);
    return { t: s.t, ey: s.solids / puck.dose * 100, tds: s.bev ? s.solids / s.bev * 100 : 0 };
  }

  /* ── brewing ──────────────────────────────────────────────────── */
  var samples = [];
  function brewKey() {
    if (M.shot && M.shot.running) { stopShot('stopped'); return; }
    if (!M.ready) { tip('Still heating: ' + Math.round(M.boiler) + '°C. Under two minutes on the real one; seconds here.'); return; }
    if (M.pf === 'unlocked') { tip('Lock the portafilter first.'); return; }
    if (M.pf === 'prep') { if (M.step === 'beans' || M.step === 'grind') flush(); else tip('The portafilter is out. Finish the puck and insert it.'); return; }
    if (!(M.puck && M.puck.tamped)) { flush(); return; }
    if (M.step !== 'brew') return;
    var prof = PROFILES[prefs.profile];
    M.manualP = prof.key === 'manual' ? 2 : 0;
    M.shot = newShot(prefs.dial, M.puck, prof, prefs.temp, M.puck.dose * prefs.ratio);
    M.cup = emptyCup(); M.cup.type = 'espresso';
    if (samples.length) M.lastSamples = samples;
    samples = []; M.said = {};
    $('#es-report').hidden = true;
    tip(prof.name + ', ' + f1(prefs.temp) + '°C, stopping at ' + f1(M.shot.target) + ' g.' + (prof.key === 'manual' ? ' Turn the knob for pressure.' : ''));
    Tonic.mood('read'); Tonic.ripple(true); Tonic.lookAt(svg, 4000);
    setStep('brew');
  }
  function flush() {
    if (M.flush || !M.ready) return;
    M.flush = { t: 0 };
    tip('No puck: that is a flush. It rinses the shower screen.');
  }
  function shotTick(dt) {
    var s = M.shot; if (!s || !s.running) return;
    var sub = Math.max(2, Math.ceil(dt / 0.01)), h = dt / sub;
    for (var i = 0; i < sub; i++) advance(s, h, true);
    if (!samples.length || s.t - samples[samples.length - 1].t >= 0.1) samples.push({ t: s.t, P: s.P, Pt: s.goalP, Q: s.Qout, W: s.bev, T: s.Tg });
    M.cup.water = s.water; M.cup.solids = s.solids;
    M.cup.crema = s.bev * clamp(0.04 + s.sumP / Math.max(1, s.tP) * 0.012, 0.04, 0.16);
    if (s.firstDrop != null && !M.said.first) { M.said.first = 1; Tonic.say('first drops at ' + Math.round(s.firstDrop) + ' s', 1300); }
    if (s.channelAt != null && !M.said.ch) { M.said.ch = 1; channelBurst(); Tonic.mood('surprised', 1000); Tonic.say('channel! see that spurt?', 1600); }
    if (s.P > 8.6 && !M.said.nine) { M.said.nine = 1; Tonic.say('nine bar', 900); }
    if (s.bev >= s.target) stopShot('target');
    else if (s.t > 75) stopShot('timeout');
  }
  function stopShot(why) {
    var s = M.shot; if (!s || !s.running) return;
    s.running = false;
    Tonic.ripple(false); Tonic.base('idle');
    var tail = s.Qout * 0.6;   // the puck drips a little after the pump stops
    M.cup.water += tail; M.cup.solids += tail * s.c * 0.5; s.water += tail; s.bev = M.cup.water + M.cup.solids;
    report(s, why);
    setStep('serve');
  }

  /* ── the report, and feedback by replay ───────────────────────── */
  var logRows = [];
  try { logRows = JSON.parse(localStorage.getItem('es-log') || '[]'); } catch (e) {}
  function report(s, why) {
    var bev = M.cup.water + M.cup.solids, tds = bev ? M.cup.solids / bev * 100 : 0, ey = M.cup.solids / s.dose * 100;
    var ratio = bev / s.dose, avgP = s.tP ? s.sumP / s.tP : 0, prof = s.profile, win = prof.window, shotT = s.t;
    var verdict = bev < 10 ? 'thin' : s.channelAt != null ? 'uneven' : ey < 18 ? 'sour' : ey > 22.5 ? 'bitter' : 'balanced';
    if (verdict === 'balanced' && tds < 6.5 && prof.key !== 'turbo') verdict = 'thin';
    var mid = (win[0] + win[1]) / 2, fb = '', rec = null;
    if (why === 'target' && (shotT < win[0] || shotT > win[1])) {
      var lo = 0.5, hi = 11, pz = Object.assign({}, M.puck);
      for (var i = 0; i < 18; i++) { var m = (lo + hi) / 2, r = replay(m, pz, prof, s.Tset, s.target); if (r.t > mid) lo = m; else hi = m; }
      rec = Math.round((lo + hi) / 2 * 10) / 10;
      var pred = replay(rec, pz, prof, s.Tset, s.target);
      fb = (shotT < win[0] ? 'Fast shot: ' : 'Slow shot: ') + Math.round(shotT) + ' s against ' + win[0] + '–' + win[1] + ' s. Grind ' + (rec < s.setting ? 'finer' : 'coarser') + ': <b>' + f1(s.setting) + ' → ' + f1(rec) + '</b> <span class="dim">(predicted ' + Math.round(pred.t) + ' s, ' + f1(pred.ey) + '% extraction)</span>.';
    } else if (why === 'target') {
      fb = 'On time: ' + Math.round(shotT) + ' s. ' + (ey < 18.5 ? 'Still a little sour: go up a degree, or stretch the ratio.' : ey > 22 ? 'Leaning bitter: drop a degree, or shorten the ratio.' : 'Keep this recipe.');
    } else fb = why === 'stopped' ? 'Stopped by hand at ' + f1(bev) + ' g.' : 'It choked: ' + f1(bev) + ' g in 75 s. Grind much coarser.';
    if (s.channelAt != null) fb += '<br>A channel opened at ' + Math.round(s.channelAt) + ' s: water found a crack. Stir longer and tamp level.';
    M.nextSetting = rec || s.setting;
    M.cup.cremaColor = ey < 18 ? '#d6b07c' : ey > 22.5 ? '#6f4127' : '#b9773f';
    var taste = { balanced: 'Sweet, round, clean finish.', sour: 'Sharp and sour; thin body.', bitter: 'Bitter, drying, ashy finish.', thin: 'Watery and weak.', uneven: 'Sour and bitter at once: an uneven puck.' }[verdict];
    var pos = clamp((ey - 14) / 12, 0, 1) * 100, str = clamp((tds - 6) / 8, 0, 1) * 100;
    var rep = $('#es-report');
    rep.hidden = false;
    rep.innerHTML =
      '<p class="r-verdict"><i class="dot-s ' + (verdict === 'balanced' ? 'green' : verdict === 'thin' || verdict === 'uneven' ? 'red' : 'yellow') + '"></i>' + taste + '</p>' +
      '<dl>' + [['in', f1(s.dose) + ' g'], ['out', f1(bev) + ' g'], ['ratio', '1:' + f1(ratio)], ['time', Math.round(shotT) + ' s'], ['first drop', s.firstDrop != null ? Math.round(s.firstDrop) + ' s' : '—'],
        ['pressure', f1(avgP) + ' bar'], ['TDS', tds.toFixed(2) + '%'], ['extraction', f1(ey) + '%'], ['brew temp', f1(s.Tset) + '°C']]
        .map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="r-scale"><span>sour</span><span class="r-track"><i class="r-ok"></i><b style="left:' + pos + '%"></b></span><span>bitter</span></div>' +
      '<div class="r-scale"><span>weak</span><span class="r-track"><i class="r-ok2"></i><b style="left:' + str + '%"></b></span><span>strong</span></div>' +
      '<p class="r-fb">' + fb + '</p>';
    M.report = { verdict: verdict === 'uneven' ? 'sour' : verdict, ey: ey, tds: tds, yield: bev };
    logRows.unshift({ p: prof.name, g: f1(s.setting), i: f1(s.dose), o: f1(bev), t: Math.round(shotT), ey: f1(ey), tds: tds.toFixed(1), v: verdict });
    logRows = logRows.slice(0, 10);
    try { localStorage.setItem('es-log', JSON.stringify(logRows)); } catch (e) {}
    paintLog();
    var say = { balanced: 'that one is perfect. for me?', sour: 'sour… for me anyway?', bitter: 'bitter, but I will take it', thin: 'mostly water. still mine?', uneven: 'uneven puck. still, gimme' }[verdict];
    Tonic.mood(verdict === 'balanced' ? 'happy' : 'curious', 1400); Tonic.say(say, 2200);
  }
  function paintLog() {
    $('#es-log-n').textContent = logRows.length;
    $('#es-log').innerHTML = '<tr><th>profile</th><th>grind</th><th>in</th><th>out</th><th>s</th><th>EY</th><th>TDS</th><th></th></tr>' +
      logRows.map(function (r) { return '<tr><td>' + r.p + '</td><td>' + r.g + '</td><td>' + r.i + '</td><td>' + r.o + '</td><td>' + r.t + '</td><td>' + r.ey + '</td><td>' + r.tds + '</td><td><i class="dot-s ' + (r.v === 'balanced' ? 'green' : r.v === 'sour' || r.v === 'bitter' ? 'yellow' : 'red') + '"></i></td></tr>'; }).join('');
  }
  paintLog();

  /* ══ serving: Tonic, tonic and ice, hot water, milk ═════════════ */
  function serve(kind) {
    if (M.step !== 'serve' || !M.report) return;
    var rep = Object.assign({}, M.report, { yield: M.cup.water + M.cup.solids });
    if (matchMedia('(max-width: 1179px)').matches && Site.openSheet) Site.openSheet();
    if (kind === 'tonic') rep.tonic = true;
    if (M.cup.type === 'flat white') rep.line = 'a flat white! silky.';
    if (M.cup.type === 'americano') rep.line = 'americano. long and gentle.';
    Coffee.drink(rep);
    var w0 = M.cup.water, s0 = M.cup.solids, m0 = M.cup.milk, x0 = M.cup.extra, n0 = M.cup.tonic, t0 = now();
    setStep('done');
    (function drain() {
      var k = Math.min(1, (now() - t0) / 900);
      M.cup.water = w0 * (1 - k); M.cup.solids = s0 * (1 - k); M.cup.milk = m0 * (1 - k); M.cup.extra = x0 * (1 - k); M.cup.tonic = n0 * (1 - k); M.cup.crema *= 0.96;
      if (k < 1) requestAnimationFrame(drain); else { M.cup = emptyCup(); M.milk = null; M.pitcherX = 120; setTimeout(knockOut, 900); }
    })();
  }
  $('#es-give').addEventListener('click', function () { serve('mascot'); });
  $('#es-tonic').addEventListener('click', function () {
    if (M.step !== 'serve') return;
    M.cup.type = 'espresso tonic'; M.cup.tonic = 90;
    tip('Ice, tonic, then the shot floated on top. Don\'t stir.');
    setStep('serve');
    setTimeout(function () { serve('tonic'); }, 1400);
  });
  $('#es-americano').addEventListener('click', waterKey);
  $('#es-steam').addEventListener('click', function () { if (M.milk && !M.steaming) pourMilk(); else steamKey(); });

  function waterKey() {
    if (M.water || M.steaming) return;
    if (!M.ready) { tip('Heating.'); return; }
    if (M.step !== 'serve' || M.cup.type !== 'espresso') { tip('Hot water comes out of the wand. Pull a shot first and it tops the cup up into an americano.'); return; }
    M.water = { t: 0, phase: 'move' };
    tip('Sliding the cup under the wand.');
  }
  function steamKey() {
    if (M.steaming) { M.steaming.phase = 'purge'; M.steaming.t = 0; return; }
    if (!M.ready) { tip('Heating.'); return; }
    if (M.water) return;
    M.steaming = { phase: 'in', t: 0, temp: 5, target: 60 };
    tip('Steaming. The wand senses the milk and stops at 60°C; turn the knob to change the target.');
    Tonic.say('pssshhh', 1000);
  }
  function pourMilk() {
    if (!M.milk || M.step !== 'serve' || M.cup.type !== 'espresso') { tip('Pull a shot first, then pour the milk in.'); return; }
    M.cup.milk = M.milk.ml; M.cup.type = 'flat white'; M.milk = null; M.pitcherX = 120;
    tip('Poured from a low height, then closer: a flat white.');
    setStep('serve');
  }
  function steamTick(dt) {
    var s = M.steaming;
    if (s) {
      s.t += dt;
      if (s.phase === 'in') { M.pitcherX = lerp(120, 0, clamp(s.t / 0.6, 0, 1)); if (s.t > 0.6) { s.phase = 'steam'; s.t = 0; } }
      else if (s.phase === 'steam') {
        s.temp += dt * 2.1;
        for (var i = 0; i < 4; i++) parts.push({ k: 'steam', x: rnd(520, 548), y: rnd(366, 378), vx: rnd(-20, 20), vy: rnd(-70, -30), r: rnd(3, 7), life: 1.1 });
        if (s.temp >= s.target) { s.phase = 'purge'; s.t = 0; M.milk = { ml: 110, temp: s.temp }; Tonic.say(Math.round(s.temp) + '°. auto-stop.', 1200); }
      } else if (s.phase === 'purge') {
        for (var j = 0; j < 6; j++) parts.push({ k: 'steam', x: rnd(526, 542), y: 410, vx: rnd(-40, 40), vy: rnd(-20, 40), r: rnd(3, 8), life: 0.8 });
        if (s.t > 0.8) { M.steaming = null; if (!M.milk) M.pitcherX = 120; setStep(M.step); }
      }
    }
    var w = M.water;
    if (w) {
      w.t += dt;
      if (w.phase === 'move') { M.cupX = lerp(0, 212, clamp(w.t / 0.7, 0, 1)); if (w.t > 0.7) { w.phase = 'pour'; w.t = 0; } }
      else if (w.phase === 'pour') { M.cup.extra += dt * 22; if (w.t > 3.5) { w.phase = 'back'; w.t = 0; M.cup.type = 'americano'; } }
      else { M.cupX = lerp(212, 0, clamp(w.t / 0.7, 0, 1)); if (w.t > 0.7) { M.water = null; tip('Americano: ' + Math.round(M.cup.water + M.cup.solids + M.cup.extra) + ' g.'); setStep('serve'); } }
    }
    if (M.flush) { M.flush.t += dt; if (M.flush.t > 3) M.flush = null; }
  }

  /* ── carrying the cup across the page ─────────────────────────── */
  var carry = null;
  el.cup.addEventListener('pointerdown', function (e) {
    if (M.step !== 'serve' || M.water) return;
    e.preventDefault();
    var c = document.createElement('div');
    c.className = 'carry';
    c.innerHTML = '<canvas width="160" height="160" style="width:80px;height:80px"></canvas>';
    document.body.appendChild(c);
    document.body.classList.add('carrying');
    carry = { el: c, cv: c.firstChild, x: e.clientX, y: e.clientY, t: now(), tilt: 0, warned: false };
    M.cupHidden = true;
    moveCarry(e);
    Tonic.mood('curious', 1200); Tonic.say('over here!', 1200);
  });
  function moveCarry(e) {
    if (!carry) return;
    var t = now(), dt = Math.max(1, t - carry.t), vx = (e.clientX - carry.x) / dt, vy = (e.clientY - carry.y) / dt, sp = Math.hypot(vx, vy);
    carry.tilt += (clamp(-vx * 16, -40, 40) - carry.tilt) * 0.3;
    carry.el.style.transform = 'translate(' + (e.clientX - 40) + 'px,' + (e.clientY - 50) + 'px) rotate(' + carry.tilt + 'deg)';
    var vol = M.cup.water + M.cup.solids + M.cup.milk + M.cup.extra;
    if (sp > 2.2 && vol > 0) {
      var lose = Math.min(vol, sp * 0.4), k = 1 - lose / vol;
      M.cup.water *= k; M.cup.solids *= k; M.cup.milk *= k; M.cup.extra *= k;
      var d = document.createElement('i'); d.className = 'drop big'; d.style.left = e.clientX + 'px'; d.style.top = (e.clientY - 6) + 'px';
      document.body.appendChild(d); setTimeout(function () { d.remove(); }, 900);
      if (!carry.warned) { carry.warned = true; Tonic.mood('surprised', 900); Tonic.say('careful, you are spilling!', 1400); }
    }
    var cx = carry.cv.getContext('2d'); cx.setTransform(2, 0, 0, 2, 0, 0); cx.clearRect(0, 0, 80, 80); cx.translate(-282, -350); drawCup(cx, 0);
    Tonic.look(e.clientX, e.clientY, 300);
    carry.x = e.clientX; carry.y = e.clientY; carry.t = t;
  }
  addEventListener('pointermove', moveCarry, { passive: true });
  addEventListener('pointerup', function (e) {
    if (!carry) return;
    var c = carry; carry = null;
    document.body.classList.remove('carrying');
    var hit = function (sel) { var n = $(sel); if (!n) return false; var r = n.getBoundingClientRect(); return r.width && e.clientX > r.left - 24 && e.clientX < r.right + 24 && e.clientY > r.top - 24 && e.clientY < r.bottom + 24; };
    if (hit('#tonic') || hit('#fab')) { c.el.classList.add('gone'); setTimeout(function () { c.el.remove(); M.cupHidden = false; }, 250); serve('mascot'); return; }
    var r = el.cup.getBoundingClientRect();
    c.el.style.transition = 'transform 0.35s cubic-bezier(0.3, 0.7, 0.3, 1)';
    c.el.style.transform = 'translate(' + (r.left - 6) + 'px,' + (r.top - 4) + 'px) rotate(0deg)';
    setTimeout(function () { c.el.remove(); M.cupHidden = false; }, 360);
    Tonic.mood('sad', 800); Tonic.say('aw. it was right there.', 1300);
  });

  /* ── reset ───────────────────────────────────────────────────── */
  function knockOut() {
    if (M.shot && M.shot.running) return;
    var had = M.puck && M.puck.tamped;
    M.puck = null; M.pf = 'prep'; M.lock = 0;
    M.cup = emptyCup(); M.hopper = 0; M.dosingCup = 0; M.grinding = 0;
    $('#es-cup-v').textContent = 'cup empty';
    $('#es-force').style.width = '0%'; $('#es-force-v').textContent = '0 kg'; $('#es-tilt-v').textContent = '–'; $('#es-bubble').style.transform = '';
    if (had) tip('Thunk. Puck in the knock box. ' + (M.nextSetting && Math.abs(M.nextSetting - prefs.dial) > 0.05 ? 'The feedback says try the dial at ' + f1(M.nextSetting) + '.' : 'Same recipe again?'));
    setStep('beans'); paintPrep(); drawPuck();
  }
  $('#es-knock').addEventListener('click', knockOut);

  /* ══ drawing every frame ════════════════════════════════════════ */
  // The round screen: numerals 0–9 bar over 270°, an orange pressure arc, a
  // tick for the controller's goal, a white completion arc in the bottom gap,
  // the timer in the middle, and the stage under it.
  var SCX = 152, SCY = 226, SR = 34;
  function polar(a, r) { var t = (a - 90) * Math.PI / 180; return [SCX + Math.cos(t) * r, SCY + Math.sin(t) * r]; }
  function arcPath(a0, a1, r) {
    var p0 = polar(a0, r), p1 = polar(a1, r), large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  var scr = (function () {
    var nums = '', ticks = '', out = {};
    for (var i = 0; i <= 9; i++) { var p = polar(-135 + i * 30, SR - 9); nums += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 1.8).toFixed(1) + '" class="es-sn">' + i + '</text>'; }
    for (var k = 0; k <= 45; k++) { var aa = -135 + k * 6, q0 = polar(aa, SR - 2), q1 = polar(aa, SR - (k % 5 ? 3.4 : 4.8)); ticks += '<line x1="' + q0[0].toFixed(2) + '" y1="' + q0[1].toFixed(2) + '" x2="' + q1[0].toFixed(2) + '" y2="' + q1[1].toFixed(2) + '"/>'; }
    el.screen.innerHTML = '<circle cx="' + SCX + '" cy="' + SCY + '" r="' + SR + '" fill="#0a0a0a"/>' +
      '<g class="es-sticks">' + ticks + '</g><g class="es-snums">' + nums + '</g>' +
      '<path class="es-sarc-bg" d="' + arcPath(-135, 135, SR - 0.5) + '"/>' +
      '<path id="es-sarc" class="es-sarc" d=""/><path id="es-sgoal" class="es-sgoal" d=""/><path id="es-sdone" class="es-sdone" d=""/>' +
      '<text id="es-sbig" x="' + SCX + '" y="' + (SCY + 4) + '" class="es-sbig">24°</text>' +
      '<text id="es-ssmall" x="' + SCX + '" y="' + (SCY + 13) + '" class="es-ssmall">HEATING</text>' +
      '<text id="es-stop" x="' + SCX + '" y="' + (SCY - 11) + '" class="es-ssmall es-sdim">SERIES 1</text>';
    ['sarc', 'sgoal', 'sdone', 'sbig', 'ssmall', 'stop'].forEach(function (id) { out[id] = document.getElementById('es-' + id); });
    return out;
  })();
  function barA(p) { return -135 + clamp(p, 0, 9) / 9 * 270; }
  function paintScreen() {
    var s = M.shot, top = PROFILES[prefs.profile].name.toUpperCase(), big, small, arc = 0, goal = null, done = 0;
    if (!M.ready) { big = Math.round(M.boiler) + '°'; small = 'HEATING'; arc = clamp((M.boiler - 20) / (prefs.temp - 20), 0, 1) * 9; top = 'SERIES 1'; }
    else if (M.steaming) { big = Math.round(M.steaming.temp) + '°'; small = M.steaming.phase === 'purge' ? 'PURGE' : 'MILK → ' + M.steaming.target + '°'; arc = clamp(M.steaming.temp / M.steaming.target, 0, 1) * 9; top = 'STEAM'; }
    else if (M.water && M.water.phase === 'pour') { big = Math.round(M.cup.extra) + 'g'; small = 'HOT WATER'; top = 'WATER'; arc = 1.5; }
    else if (M.flush) { big = '0:0' + Math.floor(M.flush.t); small = 'FLUSH'; arc = 1.5; }
    else if (s && (s.running || M.step === 'serve' || M.step === 'done')) {
      var secs = Math.floor(s.t); big = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
      small = s.running ? s.stage : f1(s.bev) + ' G'; arc = s.running ? s.P : 0; goal = s.running ? s.goalP : null; done = clamp(s.bev / s.target, 0, 1);
    }
    else if (now() < M.menuUntil) {
      big = M.editTemp ? f1(prefs.temp) + '°' : PROFILES[prefs.profile].name;
      small = M.editTemp ? 'BREW TEMP' : '1:' + f1(prefs.ratio) + ' · ' + f1(prefs.temp) + '°'; top = M.editTemp ? 'SET' : 'PROFILE';
    }
    else { big = Math.round(M.boiler) + '°'; small = M.pf === 'locked' && M.puck && M.puck.tamped ? 'PRESS BREW' : 'READY'; }
    scr.sbig.textContent = big; scr.ssmall.textContent = small; scr.stop.textContent = top;
    scr.sbig.classList.toggle('long', String(big).length > 5);
    scr.sarc.setAttribute('d', arc > 0.05 ? arcPath(-135, barA(arc), SR - 0.5) : '');
    scr.sgoal.setAttribute('d', goal != null && goal > 0.1 ? arcPath(barA(goal) - 1.5, barA(goal) + 1.5, SR - 0.5) : '');
    scr.sdone.setAttribute('d', done > 0.01 ? arcPath(150, 150 + done * 60, SR - 0.5) : '');
  }

  function paintHardware() {
    var show = M.pf !== 'prep';
    el.pf.style.display = show ? '' : 'none';
    if (show) {   // the handle swings from side-on (unlocked) to end-on (locked)
      var th = (1 - M.lock) * 62 * Math.PI / 180, L = 118, sx = Math.sin(th), cz = Math.cos(th);
      var bx = 322, by = 192, ex = bx - L * sx, ey = by + 10 + L * 0.12 * cz + (1 - cz) * 6, w = 9, ry = 13;
      el['pf-handle'].setAttribute('d', 'M' + (bx - 6) + ' ' + (by - w) + 'L' + ex.toFixed(1) + ' ' + (ey - ry).toFixed(1) + 'L' + ex.toFixed(1) + ' ' + (ey + ry).toFixed(1) + 'L' + (bx + 6) + ' ' + (by + w) + 'Z');
      el['pf-handle'].style.display = M.lock > 0.985 ? 'none' : '';
      var locked = M.lock > 0.985;
      el['pf-cap'].setAttribute('cx', ex.toFixed(1)); el['pf-cap'].setAttribute('cy', ey.toFixed(1));
      el['pf-cap'].setAttribute('rx', locked ? '15' : (13 * (0.35 + 0.65 * cz) * 0.62).toFixed(1)); el['pf-cap'].setAttribute('ry', locked ? '15' : '8');
      el['pf-cap'].setAttribute('fill', locked ? 'var(--es-wood)' : 'var(--es-cap)');
      el['pf-dot'].setAttribute('cx', ex.toFixed(1)); el['pf-dot'].setAttribute('cy', ey.toFixed(1));
    }
    el['knob-rot'].setAttribute('transform', 'rotate(' + M.knobAngle + ')');
    el.pitcher.setAttribute('transform', 'translate(' + M.pitcherX + ' 0)');
    el.pitcher.style.opacity = M.pitcherX >= 119 ? '0' : '1';
    el.cupg.setAttribute('transform', 'translate(' + M.cupX + ' 0)');
    el.cupg.style.opacity = M.cupHidden ? '0.2' : '1';
    el.scale.textContent = M.ready ? f1(M.cup.water + M.cup.solids + M.cup.milk + M.cup.extra + M.cup.tonic) : '';
    el.gled.setAttribute('fill', M.grinding ? '#f2a31b' : M.hopper > 0 ? '#7fb069' : '#444');
    el.gbodyg.setAttribute('transform', M.grinding && !reduced ? 'translate(' + rnd(-0.6, 0.6).toFixed(2) + ' ' + rnd(-0.4, 0.4).toFixed(2) + ')' : '');
    // the dial ring is a cylinder: numbers slide past the red index
    var ring = '', cx = 767, Rr = 90;
    for (var v = 0; v <= 11.01; v += 0.25) {
      var phi = (v - prefs.dial) * 0.33; if (Math.abs(phi) > 1.45) continue;
      var x = cx + Math.sin(phi) * Rr, k = Math.cos(phi), major = Math.abs(v - Math.round(v)) < 0.01;
      ring += '<rect x="' + (x - 0.6 * k).toFixed(1) + '" y="240" width="' + (1.2 * k).toFixed(2) + '" height="' + (major ? 8 : 4) + '" fill="#cfcfcf" opacity="' + (0.25 + 0.75 * k).toFixed(2) + '"/>';
      if (major && v > 0) ring += '<text x="' + x.toFixed(1) + '" y="235" text-anchor="middle" font-size="10" fill="#e4e4e4" opacity="' + k.toFixed(2) + '" font-family="IBM Plex Mono, monospace" transform="translate(' + x.toFixed(1) + ' 0) scale(' + k.toFixed(2) + ' 1) translate(' + (-x).toFixed(1) + ' 0)">' + Math.round(v) + '</text>';
    }
    if (ring !== paintHardware.ring) { el.ring.innerHTML = ring; paintHardware.ring = ring; }
    var kn = '', off = (prefs.dial * 22) % 6;
    for (var y = 262; y < 336; y += 6) kn += '<rect x="848" y="' + (y + off).toFixed(1) + '" width="22" height="1.6" fill="#2e2e2e"/>';
    if (kn !== paintHardware.kn) { el.knurl.innerHTML = kn; paintHardware.kn = kn; }
    el.tamper.style.display = (M.step === 'prep' && M.puck && M.puck.inBasket && !M.puck.tamped) ? 'none' : '';
  }

  /* ── the fx canvas: liquid, drops, crema, steam, grounds, beans ── */
  var fx = $('#es-fx'), fctx = fx.getContext('2d'), dpr = 1, fscale = 1;
  function sizeFx() {
    var r = svg.getBoundingClientRect(); if (!r.width) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    fx.width = Math.round(r.width * dpr); fx.height = Math.round(r.height * dpr);
    fx.style.width = r.width + 'px'; fx.style.height = r.height + 'px';
    fscale = r.width / 960;
  }
  if ('ResizeObserver' in window) new ResizeObserver(sizeFx).observe(svg); else addEventListener('resize', sizeFx);
  sizeFx();

  function liquidColor(c) {   // concentrated early drops are near-black, late ones blonde
    var k = clamp(c / 0.32, 0, 1);
    return 'rgb(' + Math.round(lerp(201, 52, k)) + ',' + Math.round(lerp(150, 28, k)) + ',' + Math.round(lerp(98, 16, k)) + ')';
  }
  var beads = [];
  function channelBurst() { var a = Math.random() < 0.5 ? -1 : 1, x = 322 + a * rnd(10, 26); for (var i = 0; i < 26; i++) parts.push({ k: 'drop', x: x, y: 198, vx: a * rnd(80, 260), vy: rnd(-90, 20), r: rnd(1, 2.2), life: 1, col: '#5a3420' }); }
  var MLPX = 0.62;
  function cupLevel() { return 426 - 5 - (M.cup.water + M.cup.solids + M.cup.milk + M.cup.extra + M.cup.tonic) * MLPX; }
  function drawCup(cx, x0) {
    var cupx = 290 + x0, top = 352, bot = 426, L = cupx + 5, Rx = cupx + 59, B = bot - 5;
    var vol = M.cup.water + M.cup.solids, milk = M.cup.milk, water2 = M.cup.extra, tonicV = M.cup.tonic;
    var h = (vol + milk + water2 + tonicV) * MLPX, y = B - h;
    cx.save();
    cx.beginPath(); cx.moveTo(L, top + 4); cx.lineTo(Rx, top + 4); cx.lineTo(Rx - 3, B); cx.lineTo(L + 3, B); cx.closePath(); cx.clip();
    if (h > 0.3) {
      var tds = vol ? M.cup.solids / vol : 0.1;
      if (M.cup.type === 'espresso tonic') {
        var th = tonicV * MLPX, ty = B - th;
        cx.fillStyle = 'rgba(220,235,232,0.78)'; cx.fillRect(L, ty, Rx - L, th);
        cx.fillStyle = 'rgba(255,255,255,0.75)'; cx.fillRect(L + 8, ty + 8, 16, 14); cx.fillRect(L + 30, ty + 18, 15, 13);
        cx.fillStyle = 'rgba(255,255,255,0.8)'; for (var bb = 0; bb < 7; bb++) cx.fillRect(L + 6 + bb * 7, ty + ((now() / 20 + bb * 13) % th), 1.4, 1.4);
        cx.fillStyle = liquidColor(tds * 2); cx.fillRect(L, y, Rx - L, ty - y);
        var gr = cx.createLinearGradient(0, ty - 6, 0, ty + 8); gr.addColorStop(0, 'rgba(70,40,22,0.95)'); gr.addColorStop(1, 'rgba(220,235,232,0)'); cx.fillStyle = gr; cx.fillRect(L, ty - 6, Rx - L, 14);
      } else {
        var dil = vol / Math.max(0.1, vol + water2 + milk * 0.6);
        cx.fillStyle = milk > 0 ? '#b98a5e' : liquidColor(tds * 2.4 * dil);
        cx.fillRect(L, y, Rx - L, h);
        var cremaH = milk > 0 ? 7 : Math.min(9, M.cup.crema * MLPX * (water2 > 0 ? 0.4 : 1));
        if (cremaH > 0.4) {
          var g2 = cx.createLinearGradient(0, y, 0, y + cremaH);
          g2.addColorStop(0, milk > 0 ? '#f3e9da' : M.cup.cremaColor); g2.addColorStop(1, milk > 0 ? '#d9bf9c' : 'rgba(80,45,25,0.9)');
          cx.fillStyle = g2; cx.fillRect(L, y, Rx - L, cremaH);
          if (!milk) { cx.fillStyle = 'rgba(60,30,15,0.35)'; for (var i = 0; i < 9; i++) cx.fillRect(L + ((i * 37) % 50), y + 1 + (i % 3), 3, 1.2); }
        }
      }
    }
    cx.restore();
    cx.strokeStyle = 'rgba(255,255,255,0.6)'; cx.lineWidth = 1.4;
    cx.beginPath(); cx.moveTo(cupx, top); cx.lineTo(cupx + 64, top); cx.lineTo(cupx + 60, bot - 6); cx.quadraticCurveTo(cupx + 59, bot, cupx + 52, bot); cx.lineTo(cupx + 12, bot); cx.quadraticCurveTo(cupx + 5, bot, cupx + 4, bot - 6); cx.closePath(); cx.stroke();
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.beginPath(); cx.moveTo(L, top + 4); cx.lineTo(L + 3, B); cx.lineTo(Rx - 3, B); cx.lineTo(Rx, top + 4); cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.18)'; cx.fillRect(cupx + 8, top + 8, 3, 50);
  }
  function drawFx(dt) {
    var c = fctx;
    c.setTransform(dpr * fscale, 0, 0, dpr * fscale, 0, 0);
    c.clearRect(0, 0, 960, 560);
    var s = M.shot;
    if (s && s.running && M.pf === 'locked') {
      // beads form under the bottomless basket, then join into one stream
      if (s.sat > 0.88 && s.Qout < 0.9 && Math.random() < 0.35) beads.push({ x: rnd(296, 348), y: 197, r: 0.5, grow: rnd(2, 4) });
      var surface = cupLevel();
      if (s.Qout > 0.25) {
        var w = 0.8 + Math.sqrt(s.Qout) * 1.5, col = liquidColor(s.c), wob = Math.sin(now() / 60) * 0.8, gx = 322 + (s.channelAt != null ? 4 : 0);
        c.fillStyle = col;
        c.beginPath(); c.moveTo(gx - w * 2.4, 197); c.quadraticCurveTo(gx - w, 212, gx - w / 2 + wob, 230); c.lineTo(gx - w / 2 + wob, surface); c.lineTo(gx + w / 2 + wob, surface); c.lineTo(gx + w / 2 + wob, 230); c.quadraticCurveTo(gx + w, 212, gx + w * 2.4, 197); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(gx - w / 4 + wob, 214, Math.max(0.5, w / 4), Math.max(0, surface - 216));
        if (Math.random() < 0.3) parts.push({ k: 'drop', x: gx + rnd(-3, 3), y: surface, vx: rnd(-20, 20), vy: rnd(-40, -10), r: 0.8, life: 0.25, col: col });
      }
      if (s.channelAt != null && Math.random() < 0.25) parts.push({ k: 'drop', x: 322 + rnd(-24, 24), y: 198, vx: rnd(-140, 140), vy: rnd(-40, 10), r: rnd(0.8, 1.6), life: 0.8, col: '#6b3f26' });
    }
    if (M.flush) { c.fillStyle = 'rgba(190,215,230,0.6)'; for (var f = 0; f < 6; f++) c.fillRect(300 + f * 8 + Math.sin(now() / 40 + f) * 1.5, 197, 1.6, 252); }
    beads = beads.filter(function (b) {
      b.r += dt * b.grow;
      if (b.r > 2.6) { parts.push({ k: 'drop', x: b.x, y: b.y + 2, vx: 0, vy: 30, r: 1.6, life: 1, col: '#3b2112' }); return false; }
      c.fillStyle = '#4a2a18'; c.beginPath(); c.ellipse(b.x, b.y + b.r * 0.6, b.r * 0.8, b.r, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(b.x - b.r * 0.3, b.y + b.r * 0.2, 0.8, 0.8);
      return true;
    });
    if (M.water && M.water.phase === 'pour') { c.fillStyle = 'rgba(200,225,240,0.75)'; c.fillRect(532.5, 409, 3, Math.max(0, cupLevel() - 409)); }
    if (!M.cupHidden) drawCup(c, M.cupX);
    if (M.pitcherX < 119) { c.fillStyle = 'rgba(250,246,238,0.92)'; c.fillRect(510 + M.pitcherX, 380, 44, 6); }
    parts = parts.filter(function (p) {
      p.life -= dt; if (p.life <= 0) return false;
      if (p.k === 'steam') { p.vy -= 10 * dt; p.r += 8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.fillStyle = 'rgba(255,255,255,' + (0.35 * p.life).toFixed(3) + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); return true; }
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.stop && p.y > p.stop) return false;
      if (p.k === 'bean') { p.a += p.va * dt; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = '#5b3420'; c.beginPath(); c.ellipse(0, 0, p.r * 1.3, p.r, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2a170c'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-p.r, 0); c.quadraticCurveTo(0, p.r * 0.4, p.r, 0); c.stroke(); c.restore(); return true; }
      if (p.k === 'ground') { c.fillStyle = '#3d2416'; c.fillRect(p.x, p.y, p.r, p.r); return p.y < 410; }
      if (p.y > 452) return false;
      c.fillStyle = p.col || '#4a2a18'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      return true;
    });
  }

  /* ── the telemetry chart ─────────────────────────────────────── */
  var chart = $('#es-chart'), cctx = chart.getContext('2d');
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function drawChart() {
    var W = chart.clientWidth, H = chart.clientHeight; if (!W) return;
    var dp = Math.min(2, devicePixelRatio || 1);
    if (chart.width !== Math.round(W * dp)) { chart.width = Math.round(W * dp); chart.height = Math.round(H * dp); }
    var c = cctx; c.setTransform(dp, 0, 0, dp, 0, 0); c.clearRect(0, 0, W, H);
    var pl = 24, pr = 30, pt = 8, pb = 18, w = W - pl - pr, h = H - pt - pb;
    var s = M.shot, tmax = Math.max(40, s ? Math.ceil((s.t + 4) / 10) * 10 : 40), wmax = Math.max(50, s ? Math.ceil(s.target * 1.25 / 10) * 10 : 50);
    var X = function (t) { return pl + t / tmax * w; }, Y = function (v) { return pt + h - v / 10 * h; }, YW = function (v) { return pt + h - v / wmax * h; };
    c.strokeStyle = css('--line'); c.lineWidth = 1; c.font = '10px IBM Plex Mono, monospace'; c.fillStyle = css('--dim');
    for (var b = 0; b <= 10; b += 2) { c.beginPath(); c.moveTo(pl, Y(b)); c.lineTo(pl + w, Y(b)); c.stroke(); c.fillText(String(b), 4, Y(b) + 3); }
    c.textAlign = 'right'; for (var ww = 0; ww <= wmax + 0.1; ww += wmax / 5) c.fillText(String(Math.round(ww)), W - 2, YW(ww) + 3); c.textAlign = 'left';
    for (var tt = 0; tt <= tmax; tt += 10) c.fillText(tt + 's', X(tt) - 6, H - 4);
    if (s) { c.fillStyle = 'rgba(127,176,105,0.12)'; var win = s.profile.window; c.fillRect(X(win[0]), pt, X(win[1]) - X(win[0]), h); }
    function line(arr, key, col, yf, dash, alpha) {
      if (!arr || arr.length < 2) return;
      c.strokeStyle = col; c.globalAlpha = alpha || 1; c.lineWidth = 1.8; c.setLineDash(dash || []);
      c.beginPath(); arr.forEach(function (p, i) { var x = X(p.t), y = yf(p[key]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
      c.setLineDash([]); c.globalAlpha = 1;
    }
    line(M.lastSamples, 'P', '#9a968c', Y, null, 0.4);
    line(M.lastSamples, 'W', '#9a968c', YW, [2, 3], 0.4);
    line(samples, 'Pt', '#e08a63', Y, [4, 3], 0.75);
    line(samples, 'P', '#e08a63', Y);
    line(samples, 'Q', '#5b8fd1', Y);
    line(samples, 'W', '#a06b45', YW);
    if (s && s.target) { c.strokeStyle = '#a06b45'; c.globalAlpha = 0.4; c.setLineDash([2, 4]); c.beginPath(); c.moveTo(pl, YW(s.target)); c.lineTo(pl + w, YW(s.target)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
    if (s && s.channelAt != null) { c.fillStyle = css('--red'); c.fillRect(X(s.channelAt), pt, 1, h); c.fillText('channel', X(s.channelAt) + 3, pt + 10); }
  }
  function paintLive() {
    var s = M.shot;
    $('#es-l-p').textContent = f1(s && s.running ? s.P : 0);
    $('#es-l-q').textContent = f1(s && s.running ? s.Qout : 0);
    $('#es-l-w').textContent = f1(M.cup.water + M.cup.solids + M.cup.milk + M.cup.extra + M.cup.tonic);
    $('#es-l-t').textContent = f1(s ? s.t : 0);
    $('#es-l-temp').textContent = f1(s && s.running ? s.Tg : M.boiler);
  }

  /* ══ sound, only if you ask ═════════════════════════════════════ */
  var audio = null;
  function initAudio() {
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    var ac = new A(), noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    function src() { var s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; }
    var master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    var pumpO = ac.createOscillator(); pumpO.type = 'square'; pumpO.frequency.value = 50;
    var pumpF = ac.createBiquadFilter(); pumpF.type = 'lowpass'; pumpF.frequency.value = 380;
    var pumpG = ac.createGain(); pumpG.gain.value = 0; pumpO.connect(pumpF).connect(pumpG).connect(master); pumpO.start();
    var grO = ac.createOscillator(); grO.type = 'sawtooth'; grO.frequency.value = 140;
    var grN = src(), grF = ac.createBiquadFilter(); grF.type = 'bandpass'; grF.frequency.value = 1300; grF.Q.value = 0.8;
    var grG = ac.createGain(); grG.gain.value = 0; grO.connect(grG); grN.connect(grF).connect(grG); grG.connect(master); grO.start();
    var stN = src(), stF = ac.createBiquadFilter(); stF.type = 'highpass'; stF.frequency.value = 2800;
    var stG = ac.createGain(); stG.gain.value = 0; stN.connect(stF).connect(stG).connect(master);
    return { ac: ac, pumpO: pumpO, pumpG: pumpG, grG: grG, stG: stG };
  }
  $('#es-sound').addEventListener('click', function () {
    prefs.sound = !prefs.sound;
    this.setAttribute('aria-pressed', String(prefs.sound)); this.textContent = '♪ ' + (prefs.sound ? 'on' : 'off');
    if (prefs.sound && !audio) audio = initAudio();
    if (audio) { if (prefs.sound) audio.ac.resume(); else audio.ac.suspend(); }
  });
  function soundTick() {
    if (!audio || !prefs.sound) return;
    var t = audio.ac.currentTime, s = M.shot, pumping = (s && s.running && s.Qp > 0.05) || M.flush || (M.water && M.water.phase === 'pour');
    audio.pumpG.gain.setTargetAtTime(pumping ? 0.05 + (s && s.running ? s.P / 140 : 0) : 0, t, 0.05);
    audio.pumpO.frequency.setTargetAtTime(48 + (s && s.running ? s.P * 0.7 : 0), t, 0.1);
    audio.grG.gain.setTargetAtTime(M.grinding ? 0.05 : 0, t, 0.04);
    audio.stG.gain.setTargetAtTime(M.steaming && M.steaming.phase !== 'in' ? 0.06 : 0, t, 0.06);
  }

  /* ══ the loop ═══════════════════════════════════════════════════ */
  var last = now(), onScreen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; }, { rootMargin: '200px' }).observe(stage);
  function frame(t) {
    var real = Math.min(0.05, (t - last) / 1000); last = t;
    var dt = real * prefs.speed;
    // the boiler: a quick heat-up, then PID-flat
    if (!M.ready) { M.boiler += (prefs.temp + 0.6 - M.boiler) * real * 0.55 + real * 4; if (M.boiler >= prefs.temp - 0.2) { M.boiler = prefs.temp; M.ready = true; tip('Ready in seconds. (The real one: under two minutes.)'); } }
    else M.boiler = lerp(M.boiler, prefs.temp + Math.sin(t / 3000) * 0.05, real * 2);
    grinderTick(dt); tampTick(real); shotTick(dt); steamTick(dt);
    if (onScreen && !document.hidden) {
      paintHardware(); paintScreen(); drawFx(real); drawChart(); paintLive();
      if (tamp.on || stir.on) drawPuck();
    }
    soundTick();
    requestAnimationFrame(frame);
  }
  paintControls(); setStep('beans'); paintPrep(); drawPuck();
  requestAnimationFrame(frame);

  /* ══ Tonic's turn: the whole workflow, using the last feedback ══ */
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var piloting = false;
  async function pilot() {
    if (piloting) return; piloting = true;
    try {
      if (M.step === 'serve') { serve('mascot'); return; }
      if (M.shot && M.shot.running) return;
      if (M.step !== 'beans') knockOut();
      Tonic.say('my turn. watch.', 1400);
      setProfile(0);
      doseIn.value = 18; paintControls();
      await wait(500); loadBeans();
      var target = M.nextSetting || (bean().key === 'light' ? 1.6 : bean().key === 'dark' ? 2.4 : 2.0);
      for (var i = 0; i < 10; i++) { setDial(lerp(prefs.dial, target, 0.4)); await wait(70); }
      setDial(target);
      await wait(400); startGrind();
      while (M.grinding) await wait(80);
      await wait(500); dumpCup(); await wait(400);
      await autoStir(); await wait(300);
      tamp.on = true; tamp.ox = rnd(-0.08, 0.08); tamp.oy = rnd(-0.08, 0.08); tamp.force = 0; el.tamper.style.opacity = '0';
      while (tamp.force < 16) { drawPuck(); await wait(40); }
      finishTamp(); await wait(500);
      insert(); await wait(500);
      lockIt(); await wait(800);
      while (!M.ready) await wait(200);
      brewKey();
      while (M.shot && M.shot.running) await wait(150);
      await wait(1400);
      serve('mascot');
    } finally { piloting = false; }
  }
  $('#es-auto').addEventListener('click', pilot);

  window.Machine = { auto: function () { if (Site) Site.go('machine'); return pilot(); }, get step() { return M.step; }, _M: M };
})();
