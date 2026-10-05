// espresso.machine: a manual lever machine that actually models a shot.
//
// Grind size and tamp set the puck's resistance. Pulling the lever sets the
// pressure; flow is pressure over resistance. Shot time runs at twice real
// time so a 27-second shot takes about 13. Extraction is estimated from
// time, average pressure, ratio, and channelling (a light tamp), and graded
// sour, balanced, bitter, or thin. Tonic watches every step and drinks the
// result: drag the cup across the page to it, or use the buttons.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var Tonic = window.Tonic, Coffee = window.Coffee, Site = window.Site;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function now() { return performance.now(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, reduced ? Math.min(ms, 30) : ms); }); };
  if (!$('#mach')) return;

  var svg = $('#mach-svg'), steps = $('#mach-steps');
  var el = {
    grind: $('#m-grind'), grindV: $('#m-grind-v'), grindBtn: $('#m-grind-btn'), dose: $('#m-dose'),
    tampBtn: $('#m-tamp-btn'), tamp: $('#m-tamp'), tampFill: $('#m-tamp-fill'), lockBtn: $('#m-lock-btn'),
    leverIn: $('#m-lever'), bar: $('#m-bar'), time: $('#m-time'), yield: $('#m-yield'),
    give: $('#m-give'), tonic: $('#m-tonic'), reset: $('#m-reset'), auto: $('#m-auto'), report: $('#m-report'),
    beans: $('#m-beans'), gstream: $('#m-gstream'), dialPtr: $('#m-dial-ptr'), tamper: $('#m-tamper'),
    pf: $('#m-pf'), grounds: $('#m-grounds'), leverG: $('#m-lever-g'), knob: $('#m-knob'), needle: $('#m-needle'),
    stream: $('#m-stream'), cup: $('#m-cup'), cupFill: $('#m-cupfill'), cupCrema: $('#m-cupcrema')
  };

  /* ── gauge face: ticks 0–12 bar over 270°, a green band at 8–10 ── */
  var GX = 235, GY = 120, A0 = -135, A1 = 135;
  function barAngle(b) { return A0 + (A1 - A0) * clamp(b, 0, 12) / 12; }
  function polar(a, r) { var t = (a - 90) * Math.PI / 180; return [GX + Math.cos(t) * r, GY + Math.sin(t) * r]; }
  (function () {
    var g = '', i;
    for (i = 0; i <= 12; i++) {
      var a = barAngle(i), p = polar(a, 20), q = polar(a, i % 3 ? 17.5 : 15.5);
      g += '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"/>';
    }
    $('#m-ticks').innerHTML = g;
    var s = polar(barAngle(8), 19), e = polar(barAngle(10), 19);
    $('#m-arc').setAttribute('d', 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + 'A19 19 0 0 1 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1));
  })();

  /* ── state ────────────────────────────────────────────────────── */
  var S;
  function fresh() {
    S = { step: 'grind', dose: 0, tamp: 0, tamped: false, locked: false, lever: 0, leverHeld: false, P: 0,
      t: 0, yield: 0, sumP: 0, tAbove: 0, started: false, idle: 0, channel: false, said: {}, report: null, auto: false };
  }
  fresh();

  var GRIND_WORDS = ['', 'powder', 'very fine', 'fine', 'medium-fine', 'medium', 'medium', 'medium-coarse', 'coarse', 'very coarse', 'gravel'];
  function grindLabel() { var g = Number(el.grind.value); el.grindV.textContent = g + ' · ' + GRIND_WORDS[g]; el.dialPtr.setAttribute('transform', 'rotate(' + ((g - 5.5) * 26) + ' 65 122)'); }
  el.grind.addEventListener('input', function () { grindLabel(); Tonic.lookAt(svg, 800); });
  grindLabel();

  function setStep(step) {
    S.step = step;
    var order = ['grind', 'tamp', 'lock', 'pull', 'serve'], at = order.indexOf(step);
    $$('li', steps).forEach(function (li) {
      var i = order.indexOf(li.dataset.step);
      li.classList.toggle('on', i === at); li.classList.toggle('done', i < at);
      $$('button, input', li).forEach(function (c) { c.disabled = i !== at; });
    });
    el.grind.disabled = step !== 'grind';
    svg.dataset.step = step;
    el.cup.classList.toggle('grab', step === 'serve');
  }

  function puckResistance() { return ((11 - Number(el.grind.value)) / 5) * (0.6 + clamp(S.tamp, 2, 30) / 30); }

  function draw() {
    // portafilter position: under the grinder, or locked into the group
    el.pf.style.transform = S.locked ? 'translate(235px, 189px)' : 'translate(65px, 240px)';
    el.grounds.setAttribute('height', String(clamp(S.dose / 20, 0, 1.1) * 13));
    el.grounds.setAttribute('y', String(7 - clamp(S.dose / 20, 0, 1.1) * 13 + (S.tamped ? 2 : 0)));
    el.grounds.classList.toggle('tamped', S.tamped);
    var ang = -22 + S.lever * 118;
    el.leverG.style.transform = 'rotate(' + ang + 'deg)';
    el.needle.setAttribute('transform', 'rotate(' + barAngle(S.P) + ' ' + GX + ' ' + GY + ')');
    var fill = clamp(S.yield / 55, 0, 1) * 25;
    el.cupFill.setAttribute('y', String(287 - fill)); el.cupFill.setAttribute('height', String(fill));
    var crema = fill > 1 ? Math.min(4, fill * 0.18) : 0;
    el.cupCrema.setAttribute('y', String(287 - fill)); el.cupCrema.setAttribute('height', String(crema));
    el.bar.textContent = S.P.toFixed(1);
    el.time.textContent = String(Math.round(S.t));
    el.yield.textContent = S.yield.toFixed(1);
    el.bar.parentElement.classList.toggle('good', S.P >= 8 && S.P <= 10);
    el.bar.parentElement.classList.toggle('high', S.P > 10.5);
  }

  /* ── 1. grind: hold the button; 2.4 g a second ─────────────────── */
  function holdable(btn, onStart, onTick, onEnd) {
    var holding = false, last = 0, raf = 0;
    function start(e) {
      if (btn.disabled || holding) return;
      if (e) e.preventDefault();
      holding = true; last = now(); btn.classList.add('held'); onStart();
      (function loop() { if (!holding) return; var t = now(); onTick((t - last) / 1000); last = t; raf = requestAnimationFrame(loop); })();
    }
    function end() { if (!holding) return; holding = false; cancelAnimationFrame(raf); btn.classList.remove('held'); onEnd(); }
    btn.addEventListener('pointerdown', start);
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
    btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') end(); });
    return { start: start, end: end };
  }

  var grinder = holdable(el.grindBtn, function () {
    svg.classList.add('grinding'); Tonic.lookAt(svg, 1500);
    if (!S.said.grind) { S.said.grind = 1; Tonic.say('mmm, fresh grounds', 1500); }
  }, function (dt) {
    S.dose = Math.min(24, S.dose + dt * 2.4);
    el.dose.textContent = S.dose.toFixed(1); draw();
  }, function () {
    svg.classList.remove('grinding');
    if (S.dose < 1) return;
    var d = S.dose;
    if (d < 15) Tonic.say('that is a skinny dose', 1500);
    else if (d > 21) Tonic.say('overflowing basket!', 1500);
    else if (Math.abs(d - 18) < 0.6) { Tonic.mood('happy', 800); Tonic.say(d.toFixed(1) + ' g. nailed it.', 1500); }
    if (d >= 8) setStep('tamp');
  });

  /* ── 2. tamp: hold; pressure climbs, release in the band ─────── */
  var tamper = holdable(el.tampBtn, function () {
    svg.classList.add('tamping'); S.tamp = 0;
  }, function (dt) {
    S.tamp = Math.min(30, S.tamp + dt * 14);
    el.tamp.textContent = Math.round(S.tamp); el.tampFill.style.width = (S.tamp / 30 * 100) + '%';
  }, function () {
    svg.classList.remove('tamping');
    if (S.tamp < 2) return;
    S.tamped = true; S.channel = S.tamp < 10;
    if (S.tamp < 10) Tonic.say('too light. it will channel.', 1700);
    else if (S.tamp > 22) Tonic.say('easy, it is not a press', 1500);
    else { Tonic.mood('happy', 700); Tonic.say('level and firm', 1200); }
    draw(); setStep('lock');
  });

  /* ── 3. lock in ───────────────────────────────────────────────── */
  function lock() { if (S.step !== 'lock') return; S.locked = true; draw(); Tonic.say('click.', 900); setTimeout(function () { setStep('pull'); }, reduced ? 0 : 500); }
  el.lockBtn.addEventListener('click', lock);
  el.pf.addEventListener('click', lock);

  /* ── 4. pull: drag the knob, or use the slider ─────────────────── */
  function leverFromPointer(e) {
    var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    var x = vb.x + (e.clientX - r.left) / r.width * vb.width, y = vb.y + (e.clientY - r.top) / r.height * vb.height;
    var a = Math.atan2(x - 235, -(y - 60)) * 180 / Math.PI;   // 0 = straight up, clockwise positive
    return clamp((a + 22) / 118, 0, 1);
  }
  el.knob.addEventListener('pointerdown', function (e) {
    if (S.step !== 'pull') { Tonic.say(S.step === 'serve' ? 'already pulled one' : 'not yet: ' + S.step + ' first', 1300); return; }
    e.preventDefault(); try { el.knob.setPointerCapture(e.pointerId); } catch (x) {} S.leverHeld = true; svg.classList.add('pulling');
  });
  el.knob.addEventListener('pointermove', function (e) { if (S.leverHeld) { S.lever = leverFromPointer(e); el.leverIn.value = Math.round(S.lever * 100); } });
  function letGo() { if (!S.leverHeld) return; S.leverHeld = false; svg.classList.remove('pulling'); }
  el.knob.addEventListener('pointerup', letGo); el.knob.addEventListener('pointercancel', letGo);
  el.leverIn.addEventListener('input', function () { S.lever = Number(el.leverIn.value) / 100; S.sliderHeld = S.lever > 0; });

  // the physics, while pulling
  var last = now();
  function tick(t) {
    var dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (S.step === 'pull') {
      if (!S.leverHeld && !S.sliderHeld && !S.auto) S.lever = Math.max(0, S.lever - dt * 1.6);   // the spring returns it
      if (!S.leverHeld && !S.auto) el.leverIn.value = Math.round(S.lever * 100);
      var target = S.lever * 11.5;
      S.P += (target - S.P) * Math.min(1, dt * 6);
      var shotDt = dt * 2;
      if (S.P > 0.8) {
        if (!S.started) { S.started = true; Tonic.mood('read'); Tonic.lookAt($('#m-cup'), 3000); }
        var flow = S.P * 0.17 / puckResistance();
        if (S.channel && Math.random() < 0.08) flow *= 1.8;
        S.yield += flow * shotDt; S.t += shotDt; S.sumP += S.P * shotDt; S.tAbove += shotDt; S.idle = 0;
        el.stream.style.strokeWidth = String(clamp(flow * 1.4, 0.6, 3.4)); svg.classList.add('flowing');
        if (S.P >= 8.5 && S.P <= 9.6 && !S.said.nine) { S.said.nine = 1; Tonic.mood('happy', 900); Tonic.say('nine bar.', 1200); }
        if (S.P > 10.6 && !S.said.high) { S.said.high = 1; Tonic.mood('surprised', 900); Tonic.say('too much pressure!', 1400); Tonic.shake(4); }
      } else {
        svg.classList.remove('flowing');
        if (S.started) { S.idle += dt; if (S.idle > 0.9) finish(); }
      }
      if (S.yield > 60) finish();
      draw();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function finish() {
    if (S.step !== 'pull') return;
    S.P = 0; S.lever = 0; S.leverHeld = false; svg.classList.remove('flowing', 'pulling');
    var avgP = S.tAbove ? S.sumP / S.tAbove : 0, ratio = S.dose ? S.yield / S.dose : 0;
    var ey = 20 + (S.t - 27) * 0.22 + (avgP - 9) * 0.45 + (ratio - 2) * 2.2 - (S.channel ? 2.5 : 0) + (5 - Number(el.grind.value)) * 0.35;
    ey = clamp(ey, 12, 27);
    var verdict = S.yield < 12 ? 'thin' : ey < 18 ? 'sour' : ey > 22 ? 'bitter' : 'balanced';
    if (S.dose && ratio > 3.6) verdict = 'thin';
    S.report = { verdict: verdict, ey: ey, yield: S.yield, dose: S.dose, time: S.t, avgP: avgP, ratio: ratio, channel: S.channel };
    var words = { balanced: 'Balanced and sweet.', sour: 'Sour: under-extracted. Grind finer, or pull longer.', bitter: 'Bitter: over-extracted. Grind coarser, or stop sooner.', thin: 'Thin: too little coffee for that much water.' };
    el.report.hidden = false;
    el.report.innerHTML = '<p class="r-verdict ' + verdict + '"><i class="dot-s ' + (verdict === 'balanced' ? 'green' : verdict === 'thin' ? 'red' : 'yellow') + '"></i>' + words[verdict] + '</p>' +
      '<dl>' + [['dose', S.dose.toFixed(1) + ' g'], ['yield', S.yield.toFixed(1) + ' g'], ['ratio', '1:' + ratio.toFixed(1)], ['time', Math.round(S.t) + ' s'], ['pressure', avgP.toFixed(1) + ' bar avg'], ['extraction', ey.toFixed(1) + '%']]
        .map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      (S.channel ? '<p class="r-note">The puck channelled: water found a crack where the tamp was light.</p>' : '');
    Tonic.base('idle');
    Tonic.mood(verdict === 'balanced' ? 'happy' : 'curious', 1200);
    Tonic.say(verdict === 'balanced' ? 'that looks perfect. for me?' : 'hmm. for me anyway?', 2000);
    draw(); setStep('serve');
  }

  /* ── 5. serve: buttons, or carry the cup across the page ──────── */
  function serve(withTonic) {
    if (S.step !== 'serve' || !S.report) return;
    var rep = Object.assign({}, S.report, { yield: S.yield, tonic: !!withTonic });
    if (matchMedia('(max-width: 1179px)').matches && Site.openSheet) Site.openSheet();
    Coffee.drink(rep);
    var y0 = S.yield, t0 = now();
    (function drain() { var k = Math.min(1, (now() - t0) / 900); S.yield = y0 * (1 - k); draw(); if (k < 1) requestAnimationFrame(drain); else setTimeout(knockOut, 700); })();
    setStep('done');
  }
  el.give.addEventListener('click', function () { serve(false); });
  el.tonic.addEventListener('click', function () { serve(true); });

  // carrying: the cup follows the cursor, tilts with speed, and spills if you rush
  var carry = null;
  el.cup.addEventListener('pointerdown', function (e) {
    if (S.step !== 'serve') return;
    e.preventDefault();
    var c = document.createElement('div');
    c.className = 'carry';
    c.innerHTML = '<svg viewBox="0 0 34 30" width="44" height="40"><path d="M3 2h28l-3 25H6z" fill="var(--m-glass-fill)" stroke="var(--m-line)" stroke-width="1.5"/><path class="carry-fill" d="M4.2 ' + (27 - clamp(S.yield / 55, 0, 1) * 25) + 'h25.6L28 27H6z" fill="#4b2a1a"/></svg>';
    document.body.appendChild(c);
    document.body.classList.add('carrying');
    carry = { el: c, x: e.clientX, y: e.clientY, t: now(), tilt: 0, warned: false };
    move(e);
    Tonic.mood('curious', 1200); Tonic.say('over here!', 1200);
  });
  function move(e) {
    if (!carry) return;
    var t = now(), dt = Math.max(1, t - carry.t), vx = (e.clientX - carry.x) / dt, vy = (e.clientY - carry.y) / dt, sp = Math.hypot(vx, vy);
    carry.tilt += (clamp(-vx * 18, -40, 40) - carry.tilt) * 0.3;
    carry.el.style.transform = 'translate(' + (e.clientX - 22) + 'px,' + (e.clientY - 30) + 'px) rotate(' + carry.tilt + 'deg)';
    if (sp > 2.2 && S.yield > 0) {
      S.yield = Math.max(0, S.yield - sp * 0.35);
      var d = document.createElement('i'); d.className = 'drop big'; d.style.left = e.clientX + 'px'; d.style.top = (e.clientY - 6) + 'px';
      document.body.appendChild(d); setTimeout(function () { d.remove(); }, 900);
      var f = carry.el.querySelector('.carry-fill'); if (f) f.setAttribute('d', 'M4.2 ' + (27 - clamp(S.yield / 55, 0, 1) * 25) + 'h25.6L28 27H6z');
      if (!carry.warned) { carry.warned = true; Tonic.mood('surprised', 900); Tonic.say('careful, you are spilling!', 1400); }
      draw();
    }
    // Tonic looks at the cup the whole way
    Tonic.look(e.clientX, e.clientY, 300);
    carry.x = e.clientX; carry.y = e.clientY; carry.t = t;
  }
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerup', function (e) {
    if (!carry) return;
    var c = carry; carry = null;
    document.body.classList.remove('carrying');
    var hit = function (sel) { var n = $(sel); if (!n) return false; var r = n.getBoundingClientRect(); return r.width && e.clientX > r.left - 20 && e.clientX < r.right + 20 && e.clientY > r.top - 20 && e.clientY < r.bottom + 20; };
    if (hit('#tonic') || hit('#fab')) { c.el.classList.add('gone'); setTimeout(function () { c.el.remove(); }, 250); serve(false); return; }
    var r = el.cup.getBoundingClientRect();
    c.el.style.transition = 'transform 0.35s cubic-bezier(0.3, 0.7, 0.3, 1)';
    c.el.style.transform = 'translate(' + (r.left) + 'px,' + (r.top) + 'px) rotate(0deg)';
    setTimeout(function () { c.el.remove(); }, 360);
    Tonic.mood('sad', 800); Tonic.say('aw. it was right there.', 1300);
  });

  /* ── reset, and Tonic's turn ──────────────────────────────────── */
  function knockOut() {
    var g = el.grind.value;
    fresh(); el.grind.value = g;
    el.dose.textContent = '0.0'; el.tamp.textContent = '0'; el.tampFill.style.width = '0%'; el.leverIn.value = 0;
    el.report.hidden = true;
    draw(); setStep('grind');
  }
  el.reset.addEventListener('click', knockOut);

  async function auto() {
    if (S.auto) return;
    if (S.step === 'serve') { serve(false); return; }
    if (S.step === 'done') await sleep(1600);
    knockOut();
    S.auto = true;
    Tonic.say('my turn.', 1200);
    el.grind.value = 5; grindLabel();
    await sleep(500);
    grinder.start(); while (S.dose < 18) await sleep(40); grinder.end();
    await sleep(500);
    tamper.start(); while (S.tamp < 15.5) await sleep(30); tamper.end();
    await sleep(600); lock(); await sleep(700);
    // ease the lever down to about 9 bar and hold it there
    while (S.lever < 0.79) { S.lever = Math.min(0.79, S.lever + 0.03); el.leverIn.value = Math.round(S.lever * 100); await sleep(30); }
    while (S.yield < 36 && S.step === 'pull') await sleep(60);
    S.auto = false;
    while (S.step === 'pull') await sleep(60);
    await sleep(900);
    serve(false);
  }
  el.auto.addEventListener('click', auto);

  draw(); setStep('grind');
  window.Machine = { auto: function () { if (Site) Site.go('machine'); return auto(); }, get step() { return S.step; } };
})();
