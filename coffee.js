// Coffee: Tonic's caffeine, the status that shows it, and what coffee does
// to the page. Caffeine drains while you read; shots from the espresso
// machine fill it back up. Too much and the cursor drips. Flip the theme too
// often and Tonic spills a cup over the switch, and touching it makes your
// cursor sticky.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var Tonic = window.Tonic;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ── state, persisted per browser, draining one point every 10 s ── */
  var DRAIN = 10000;
  var st = { level: 40, shots: 0, t: Date.now(), best: null };
  try {
    var saved = JSON.parse(localStorage.getItem('coffee') || 'null');
    if (saved) { st = saved; st.level = clamp(st.level - (Date.now() - st.t) / DRAIN, 0, 120); }
  } catch (e) {}
  function save() { st.t = Date.now(); try { localStorage.setItem('coffee', JSON.stringify(st)); } catch (e) {} }

  function word(l) { return l < 8 ? 'empty' : l < 30 ? 'fading' : l < 70 ? 'fresh' : l < 95 ? 'perky' : 'jittery'; }

  var sbTxt = $('#cf-txt'), sbFill = $('#cf-fill'), cafFill = $('#caf-fill'), cafPct = $('#caf-pct'), cafWord = $('#caf-word'), sbBtn = $('#sb-coffee');
  var lastWord = null;
  function paint() {
    var l = Math.round(st.level), w = word(st.level), pct = Math.min(100, l);
    if (sbTxt) sbTxt.textContent = pct + '% · ' + w;
    if (sbFill) sbFill.style.width = pct + '%';
    if (cafFill) cafFill.style.width = pct + '%';
    if (cafPct) cafPct.textContent = pct + '%';
    if (cafWord) cafWord.textContent = w + (st.shots ? ' · ' + st.shots + (st.shots === 1 ? ' shot' : ' shots') : '');
    document.documentElement.dataset.caffeine = w;
    if (w !== lastWord) {
      if (lastWord && w === 'empty') { Tonic.base('idle'); Tonic.mood('sleep', 2400); Tonic.say('running on empty. pull me a shot?', 3000); }
      else if (lastWord && w === 'fading') Tonic.say('getting sleepy…', 1800);
      if (w === 'jittery') Tonic.jitter(3.5, 1e9); else if (w === 'perky') Tonic.jitter(1.2, 1e9); else Tonic.jitter(0, 1);
      lastWord = w;
    }
  }
  setInterval(function () { st.level = Math.max(0, st.level - 1); save(); paint(); }, DRAIN);
  paint();
  if (sbBtn) sbBtn.addEventListener('click', function () { if (window.Site) window.Site.go('machine'); });

  /* ── drinking ─────────────────────────────────────────────────── */
  // report: { verdict: 'balanced'|'sour'|'bitter'|'thin', yield, ey, tonic }
  function drink(report) {
    var amt = clamp((report.yield || 30) * 1.1, 12, 55);
    st.level = clamp(st.level + amt, 0, 120); st.shots++;
    if (report.verdict === 'balanced' && (!st.best || Math.abs(report.ey - 20) < Math.abs(st.best - 20))) st.best = report.ey;
    save(); paint();
    Tonic.hop(18);
    if (report.tonic) { Tonic.order(); return; }
    var lines = {
      balanced: ['perfect shot.', 'sweet. balanced. ten out of ten.', 'that is the good stuff'],
      sour: ['sour! grind finer?', 'under-extracted. it bites.'],
      bitter: ['bitter… went too long', 'over-extracted. ash.'],
      thin: ['that was mostly water', 'watery. more coffee next time?'],
      uneven: ['sour and bitter at once…']
    }[report.verdict] || ['gulp'];
    Tonic.mood(report.verdict === 'balanced' ? 'happy' : report.verdict === 'bitter' ? 'sad' : 'angry', 1600);
    Tonic.say(report.line || lines[Math.floor(Math.random() * lines.length)], 2200);
    Tonic.brew();
  }

  /* ── spills: coffee over a control, which then sticks ─────────── */
  function spill(el, ms) {
    ms = ms || 5000;
    var r = el.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'spill';
    d.style.left = (r.left - 14) + 'px'; d.style.top = (r.top - 10) + 'px';
    d.innerHTML = '<svg viewBox="0 0 64 80" aria-hidden="true"><path class="sp-pool" d="M10 22c-6-8 4-16 12-12 4-8 18-8 20 0 9-3 16 6 10 13 6 6-2 15-10 12-3 7-17 8-21 1-9 3-17-7-11-14z"/>' +
      '<path class="sp-drip d1" d="M18 30q2 0 2 6v10a2 2 0 0 1-4 0V36q0-6 2-6z"/><path class="sp-drip d2" d="M34 34q2 0 2 6v16a2 2 0 0 1-4 0V40q0-6 2-6z"/><path class="sp-drip d3" d="M47 30q2 0 2 4v8a2 2 0 0 1-4 0v-8q0-4 2-4z"/>' +
      '<circle class="sp-dot" cx="56" cy="10" r="2.5"/><circle class="sp-dot" cx="6" cy="40" r="2"/></svg>';
    document.body.appendChild(d);
    el.classList.add('spilled'); el.setAttribute('aria-disabled', 'true');
    var until = Date.now() + ms;
    setTimeout(function () {
      d.classList.add('wipe');
      el.classList.remove('spilled'); el.removeAttribute('aria-disabled');
      setTimeout(function () { d.remove(); }, 600);
    }, ms);
    return until;
  }

  /* ── the sticky cursor: it lags, like it is wading through coffee ── */
  var stickyEl = null, stickyUntil = 0, sx = 0, sy = 0, tx = 0, ty = 0;
  function sticky(ms) {
    stickyUntil = Date.now() + (ms || 4000);
    if (stickyEl) return;
    stickyEl = document.createElement('div');
    stickyEl.className = 'sticky-ptr';
    stickyEl.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1L1 19L5.5 14.5L9.5 22L13 20L9 12.5L15 12.5L1 1Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 18q1.6 0 1.6 3.6v3a1.6 1.6 0 0 1-3.2 0v-3Q1.4 18 3 18z" fill="#4b2a1a"/></svg>';
    document.body.appendChild(stickyEl);
    document.body.classList.add('sticky-cursor');
    sx = tx; sy = ty;
    (function loop() {
      sx += (tx - sx) * 0.07; sy += (ty - sy) * 0.07;
      stickyEl.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
      if (Date.now() < stickyUntil) requestAnimationFrame(loop);
      else { stickyEl.remove(); stickyEl = null; document.body.classList.remove('sticky-cursor'); }
    })();
  }

  /* ── a caffeinated cursor drips ───────────────────────────────── */
  var lastDrop = 0;
  addEventListener('pointermove', function (e) {
    tx = e.clientX; ty = e.clientY;
    if (reduced || st.level < 95 || e.pointerType === 'touch') return;
    var tn = performance.now();
    if (tn - lastDrop < 45) return;
    lastDrop = tn;
    var d = document.createElement('i');
    d.className = 'drop';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 900);
  }, { passive: true });

  window.Coffee = {
    drink: drink, spill: spill, sticky: sticky,
    add: function (n) { st.level = clamp(st.level + n, 0, 120); save(); paint(); },
    get level() { return st.level; }, get shots() { return st.shots; }, get word() { return word(st.level); }
  };
})();
