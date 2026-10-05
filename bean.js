// Bean, the mascot. A soft body (a ring of points on springs, drawn as one
// smooth path) with two eyes that are just four-point curves. No library.
// It watches the page: your cursor, what you hover, how fast you scroll,
// whether you have gone quiet, and the three dots in the title bar.
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var N = 28, R = 50, HOME = { x: 100, y: 94 }, GROUND = 146;
  var TAU = Math.PI * 2;

  // skins change the silhouette and the eyes, never the personality
  var SKINS = {
    claude:   { n: 2.0, w: 9,  h: 26, k: 0.6,  lean: 0,   gap: 24, float: 0 },
    codex:    { n: 2.0, w: 10, h: 25, k: 0.6,  lean: -16, gap: 24, float: 0 },
    agy:      { n: 2.15, w: 10, h: 22, k: 0.6, lean: 0,   gap: 24, float: 9 },
    opencode: { n: 5.0, w: 13, h: 15, k: 0.92, lean: 0,   gap: 26, float: 0 }
  };

  // what each mood does to the eyes; values are multipliers of the skin's eye
  var MOODS = {
    idle:      { w: 1,    t: 1,    b: 1,     tilt: 0,   dy: 0 },
    happy:     { w: 1.25, t: 0.85, b: -0.4,  tilt: 0,   dy: -3 },
    sad:       { w: 1.1,  t: 0.45, b: 0.9,   tilt: -18, dy: 5 },
    angry:     { w: 1.35, t: 0.22, b: 0.32,  tilt: 22,  dy: 2 },
    surprised: { w: 1.7,  t: 1.1,  b: 1.1,   tilt: 0,   dy: -3 },
    curious:   { w: 1.2,  t: 1.05, b: 0.8,   tilt: -6,  dy: -1 },
    think:     { w: 1,    t: 0.9,  b: 0.7,   tilt: 0,   dy: -2 },
    read:      { w: 1,    t: 0.75, b: 0.75,  tilt: 0,   dy: 2 },
    sleep:     { w: 1.3,  t: 0.06, b: 0.06,  tilt: 0,   dy: 6 },
    dizzy:     { w: 1.15, t: 0.9,  b: 0.9,   tilt: 0,   dy: 0 }
  };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function f(n) { return Math.round(n * 10) / 10; }

  // ── one drawn bean ──────────────────────────────────────────────
  function Body(svg, interactive) {
    this.svg = svg;
    this.bodyEl = svg.querySelector('.bean-body');
    this.eyeEls = svg.querySelectorAll('.bean-eye');
    this.shadow = svg.querySelector('.bean-shadow');
    this.steam = svg.querySelector('.bean-steam');
    this.z = svg.querySelector('.bean-z');
    this.interactive = interactive;
    this.c = { x: HOME.x, y: HOME.y, vx: 0, vy: 0 };
    this.p = [];
    for (var i = 0; i < N; i++) this.p.push({ x: HOME.x, y: HOME.y, vx: 0, vy: 0 });
    this.eye = { w: 9, t: 13, b: 13, tilt: 0, dy: 0, gx: 0, gy: 0 };
    this.drag = null;
    this.reset();
  }

  Body.prototype.reset = function () {
    for (var i = 0; i < N; i++) {
      var r = this.rest(i, 0);
      this.p[i].x = r.x; this.p[i].y = r.y; this.p[i].vx = this.p[i].vy = 0;
    }
  };

  // the resting outline: a superellipse, a little heavier at the bottom
  Body.prototype.rest = function (i, t) {
    var sk = S.skin, a = (i / N) * TAU;
    var ca = Math.cos(a), sa = Math.sin(a);
    var r = 1 / Math.pow(Math.pow(Math.abs(ca), sk.n) + Math.pow(Math.abs(sa), sk.n), 1 / sk.n);
    r *= 1 + 0.05 * sa;
    if (!reduced) {
      r *= 1 + 0.012 * Math.sin(t * (S.mood === 'sleep' ? 0.9 : 1.7));
      if (S.ripple) r += 0.035 * Math.sin(3 * a - t * 5);
      if (S.mood === 'dizzy') r += 0.03 * Math.sin(2 * a + t * 9);
    }
    var sy = S.mood === 'sleep' ? 0.93 : 1;
    // squash against the floor
    var pen = this.c.y - HOME.y;
    if (pen > 0) sy -= Math.min(0.28, pen / R * 0.9);
    var sx = 1 / sy;
    return { x: this.c.x + ca * r * R * sx, y: this.c.y + sa * r * R * sy + (1 - sy) * R };
  };

  Body.prototype.step = function (t, dt) {
    var c = this.c, k = dt * 60;
    // the centre floats home on a soft spring
    var hy = HOME.y - (reduced ? 0 : S.skin.float * (0.6 + 0.4 * Math.sin(t * 1.3))) - S.hop;
    var tx = HOME.x, ty = hy;
    if (this.drag) {
      tx += clamp((this.drag.x - this.drag.x0) * 0.35, -28, 28);
      ty += clamp((this.drag.y - this.drag.y0) * 0.35, -26, 18);
    }
    c.vx += ((tx - c.x) * 0.07 - c.vx * 0.14) * k;
    c.vy += ((ty - c.y) * 0.07 - c.vy * 0.14) * k;
    c.x += c.vx * k; c.y += c.vy * k;

    var p = this.p, rx = 0, ry = 0;
    for (var i = 0; i < N; i++) {
      var q = p[i], r = this.rest(i, t), gx = r.x, gy = r.y;
      if (this.drag) {
        var d = Math.min(Math.abs(i - this.drag.i), N - Math.abs(i - this.drag.i));
        var fall = Math.exp(-(d * d) / 10);
        var px = clamp(this.drag.x - this.drag.x0, -60, 60), py = clamp(this.drag.y - this.drag.y0, -60, 60);
        gx += px * fall * 0.55; gy += py * fall * 0.55;
      }
      var a = p[(i + N - 1) % N], b = p[(i + 1) % N];
      q.vx += ((gx - q.x) * 0.16 + ((a.x + b.x) / 2 - q.x) * 0.08 - q.vx * 0.16) * k;
      q.vy += ((gy - q.y) * 0.16 + ((a.y + b.y) / 2 - q.y) * 0.08 - q.vy * 0.16) * k;
      q.x += q.vx * k; q.y += q.vy * k;
      if (q.y > GROUND + 6) { q.y = GROUND + 6; q.vy *= -0.3; }
      rx += q.x; ry += q.y;
    }
    this.cx = rx / N; this.cy = ry / N;

    // eyes ease toward the mood
    var m = MOODS[S.mood] || MOODS.idle, sk = S.skin, e = this.eye, ease = 1 - Math.pow(0.78, k);
    e.w = lerp(e.w, sk.w * m.w, ease);
    e.t = lerp(e.t, sk.h / 2 * m.t, ease);
    e.b = lerp(e.b, sk.h / 2 * m.b, ease);
    e.tilt = lerp(e.tilt, m.tilt, ease);
    e.dy = lerp(e.dy, m.dy, ease);
    var g = S.gaze(this, t);
    e.gx = lerp(e.gx, g.x, 1 - Math.pow(0.82, k));
    e.gy = lerp(e.gy, g.y, 1 - Math.pow(0.82, k));
  };

  Body.prototype.draw = function (t) {
    var p = this.p, d = '';
    for (var i = 0; i < N; i++) {
      var p0 = p[(i + N - 1) % N], p1 = p[i], p2 = p[(i + 1) % N], p3 = p[(i + 2) % N];
      if (i === 0) d += 'M' + f(p1.x) + ' ' + f(p1.y);
      d += 'C' + f(p1.x + (p2.x - p0.x) / 6) + ' ' + f(p1.y + (p2.y - p0.y) / 6) + ' ' +
        f(p2.x - (p3.x - p1.x) / 6) + ' ' + f(p2.y - (p3.y - p1.y) / 6) + ' ' + f(p2.x) + ' ' + f(p2.y);
    }
    this.bodyEl.setAttribute('d', d + 'Z');

    var e = this.eye, sk = S.skin, bl = S.blinkAmt(t);
    for (var s = -1; s <= 1; s += 2) {
      var wink = (S.wink && s === -1) ? 0.08 : 1;
      var cx = this.cx + s * sk.gap / 2 + e.gx * 9, cy = this.cy - 10 + e.dy + e.gy * 7;
      var rot = (sk.lean + s * e.tilt) * Math.PI / 180;
      this.eyeEls[s < 0 ? 0 : 1].setAttribute('d', eyePath(cx, cy, e.w, Math.max(0.8, e.t * bl * wink), e.b * bl * wink, sk.k, rot));
    }
    if (this.shadow) {
      var lift = clamp((HOME.y - this.c.y) / 40, -0.3, 1);
      this.shadow.setAttribute('rx', f(42 * (1 - lift * 0.35)));
      this.shadow.style.opacity = String(0.5 - lift * 0.25);
    }
    if (this.steam) this.steam.style.opacity = String(S.steam);
    if (this.z) this.z.style.opacity = S.mood === 'sleep' ? String(0.5 + 0.5 * Math.sin(t * 2)) : '0';
  };

  function eyePath(cx, cy, w, t, b, k, rot) {
    var hw = w / 2, cos = Math.cos(rot), sin = Math.sin(rot);
    if (b < -t * 0.8) b = -t * 0.8;
    var pts = [
      [-hw, 0], [-hw, -t * k], [-hw * k, -t], [0, -t],
      [hw * k, -t], [hw, -t * k], [hw, 0],
      [hw, b * k], [hw * k, b], [0, b],
      [-hw * k, b], [-hw, b * k], [-hw, 0]
    ].map(function (q) { return f(cx + q[0] * cos - q[1] * sin) + ' ' + f(cy + q[0] * sin + q[1] * cos); });
    return 'M' + pts[0] + 'C' + pts.slice(1, 4).join(' ') + 'C' + pts.slice(4, 7).join(' ') +
      'C' + pts.slice(7, 10).join(' ') + 'C' + pts.slice(10, 13).join(' ') + 'Z';
  }

  // ── shared state ────────────────────────────────────────────────
  var S = {
    skin: SKINS.claude, skinKey: 'claude',
    mood: 'idle', moodUntil: 0, base: 'idle',
    ripple: false, hop: 0, steam: 0, wink: false,
    look: null, lookUntil: 0,
    pointer: null,
    nextBlink: 2, blinkStart: -1,
    blinkAmt: function (t) {
      if (S.mood === 'sleep') return 1;
      if (t > S.nextBlink && S.blinkStart < 0) S.blinkStart = t;
      if (S.blinkStart >= 0) {
        var u = (t - S.blinkStart) / 0.16;
        if (u >= 1) { S.blinkStart = -1; S.nextBlink = t + 2 + Math.random() * 4; return 1; }
        return 0.1 + 0.9 * Math.abs(1 - 2 * u);
      }
      return 1;
    },
    gaze: function (body, t) {
      if (S.mood === 'dizzy') return { x: Math.cos(t * 9) * 0.8, y: Math.sin(t * 9) * 0.6 };
      if (S.mood === 'read') return { x: Math.sin(t * 3.2) * 0.8, y: 0.4 };
      if (S.mood === 'think') return { x: 0.6, y: -0.9 };
      if (S.mood === 'sleep') return { x: 0, y: 0.3 };
      var target = (S.look && now() < S.lookUntil) ? S.look : S.pointer;
      if (!target) return { x: Math.sin(t * 0.5) * 0.3, y: Math.sin(t * 0.37) * 0.2 };
      var rect = body.svg.getBoundingClientRect();
      if (!rect.width) return { x: 0, y: 0 };
      var sx = rect.left + (body.cx / 200) * rect.width, sy = rect.top + ((body.cy - 10) / 170) * rect.height;
      var dx = target.x - sx, dy = target.y - sy, dist = Math.hypot(dx, dy) || 1, m = dist / (dist + 90);
      return { x: dx / dist * m, y: dy / dist * m };
    }
  };

  function now() { return performance.now(); }

  var bodies = [];
  var big = document.getElementById('bean');
  var mini = document.getElementById('bean-mini');
  if (big) bodies.push(new Body(big, true));
  if (mini) bodies.push(new Body(mini, false));

  // ── the loop ────────────────────────────────────────────────────
  var last = now(), t0 = last;
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    var t = (ts - t0) / 1000;
    if (S.moodUntil && ts > S.moodUntil) { S.mood = S.base; S.moodUntil = 0; }
    S.hop *= Math.pow(0.86, dt * 60);
    S.steam = Math.max(0, S.steam - dt * 0.12);
    watchEggs();
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.svg.getClientRects().length) continue;
      b.step(t, dt); b.draw(t);
    }
    if (!document.hidden) requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { last = now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);

  // ── the public face ─────────────────────────────────────────────
  var bubble = document.getElementById('bubble'), bubbleTimer;
  var Bean = {
    mood: function (m, ms) {
      if (!MOODS[m]) return;
      if (S.mood === 'sleep' && m !== 'sleep') S.hop = 10;
      S.mood = m;
      if (ms) S.moodUntil = now() + ms; else { S.base = m; S.moodUntil = 0; }
    },
    base: function (m) { S.base = m; if (!S.moodUntil) S.mood = m; },
    ripple: function (on) { S.ripple = on; },
    look: function (x, y, ms) { S.look = { x: x, y: y }; S.lookUntil = now() + (ms || 1200); },
    lookAt: function (el, ms) {
      var r = el.getBoundingClientRect();
      Bean.look(r.left + r.width / 2, r.top + Math.min(r.height / 2, 30), ms);
    },
    hop: function (h) { S.hop = h || 16; bodies.forEach(function (b) { b.c.vy -= 2; }); },
    wink: function () { S.wink = true; setTimeout(function () { S.wink = false; }, 380); },
    brew: function () { S.steam = 1; },
    skin: function (key) {
      if (!SKINS[key]) return;
      S.skin = SKINS[key]; S.skinKey = key;
      bodies.forEach(function (b) { b.c.vy -= 5; });
    },
    say: function (text, ms) {
      if (!bubble) return;
      bubble.textContent = text;
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, ms || 2600);
    },
    poke: function (x, y) {
      bodies.forEach(function (b) {
        for (var i = 0; i < N; i++) {
          var q = b.p[i], dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) || 1;
          var s = Math.max(0, 1 - d / 70) * 7;
          q.vx += dx / d * s; q.vy += dy / d * s;
        }
      });
    },
    get moodName() { return S.mood; },
    get skinName() { return S.skinKey; }
  };
  window.Bean = Bean;

  try { var saved = localStorage.getItem('skin'); if (SKINS[saved]) { S.skin = SKINS[saved]; S.skinKey = saved; } } catch (e) {}
  bodies.forEach(function (b) { b.reset(); });

  // ── what Bean notices ───────────────────────────────────────────
  var lastActive = now();
  function active() {
    if (S.mood === 'sleep') { Bean.mood('surprised', 700); S.base = 'idle'; Bean.say('oh! hi.', 1400); }
    lastActive = now();
  }
  setInterval(function () {
    if (S.mood !== 'sleep' && !S.moodUntil && now() - lastActive > 28000 && S.base === 'idle') {
      Bean.base('sleep'); Bean.say('zz', 1600);
    }
  }, 1000);

  addEventListener('pointermove', function (e) { S.pointer = { x: e.clientX, y: e.clientY }; active(); }, { passive: true });
  addEventListener('keydown', active);
  document.addEventListener('pointerleave', function () { S.pointer = null; });

  // fast scrolling makes Bean dizzy
  var lastY = null, lastT = 0, fast = 0;
  var quietUntil = 0;
  Bean.quiet = function (ms) { quietUntil = now() + (ms || 1500); };
  document.addEventListener('scroll', function (e) {
    active();
    if (now() < quietUntil) { lastY = null; return; }
    var el = e.target === document ? document.scrollingElement : e.target;
    if (!el || el.id === 'chat' || el.id === 'term-body') return;
    var y = el.scrollTop, tn = now();
    if (lastY !== null && tn - lastT < 120) {
      var v = Math.abs(y - lastY) / Math.max(1, tn - lastT);
      fast = v > 5 ? fast + 1 : Math.max(0, fast - 1);
      if (fast > 6 && S.mood !== 'dizzy') { Bean.mood('dizzy', 1600); Bean.say('woah, slow down', 1600); fast = 0; }
    }
    lastY = y; lastT = tn;
  }, true);

  // hovering something with a status dot: Bean looks, and has an opinion
  var hovered = null;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-status]');
    if (!el || el === hovered) return;
    hovered = el;
    Bean.lookAt(el, 1600);
    if (S.mood === 'think' || S.mood === 'read') return;
    var st = el.dataset.status;
    if (st === 'green') Bean.mood('happy', 900);
    else if (st === 'yellow') Bean.mood('curious', 900);
    else if (st === 'red') { Bean.mood('sad', 1400); Bean.say('rip betelgeuse', 1400); }
  });

  // the title-bar dots fling, flatten, and stretch a fake cursor; Bean watches it go
  var fake = document.getElementById('fake-cursor'), wasEgg = false;
  function watchEggs() {
    var egg = document.body.classList.contains('hide-cursor');
    if (egg && fake) {
      var r = fake.getBoundingClientRect();
      S.look = { x: r.left + 6, y: r.top + 8 }; S.lookUntil = now() + 300;
      if (!wasEgg) { Bean.mood('surprised', 2400); Bean.say('your cursor!', 1800); }
    } else if (wasEgg) { Bean.mood('sad', 900); }
    wasEgg = egg;
  }

  // poke, drag, fling
  bodies.forEach(function (b) {
    if (!b.interactive) return;
    var svg = b.svg, clicks = [];
    function toSvg(e) {
      var r = svg.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * 200, y: (e.clientY - r.top) / r.height * 170 };
    }
    svg.addEventListener('pointerdown', function (e) {
      var q = toSvg(e), best = 0, bd = 1e9;
      for (var i = 0; i < N; i++) { var d = Math.hypot(b.p[i].x - q.x, b.p[i].y - q.y); if (d < bd) { bd = d; best = i; } }
      if (bd > 70) return;
      svg.setPointerCapture(e.pointerId);
      b.drag = { i: best, x0: q.x, y0: q.y, x: q.x, y: q.y, moved: 0 };
      Bean.mood('surprised', 400);
    });
    svg.addEventListener('pointermove', function (e) {
      if (!b.drag) return;
      var q = toSvg(e);
      b.drag.moved = Math.max(b.drag.moved, Math.hypot(q.x - b.drag.x0, q.y - b.drag.y0));
      b.drag.x = q.x; b.drag.y = q.y;
    });
    function release(e) {
      if (!b.drag) return;
      var moved = b.drag.moved, q = { x: b.drag.x0, y: b.drag.y0 };
      b.drag = null;
      if (moved > 40) { Bean.mood('happy', 1000); Bean.say(['wheee', 'boing', 'again!'][Math.floor(Math.random() * 3)], 1200); return; }
      Bean.poke(q.x, q.y);
      Bean.hop(12);
      var tn = now();
      clicks = clicks.filter(function (c) { return tn - c < 2500; }); clicks.push(tn);
      if (clicks.length >= 6) { Bean.mood('angry', 1500); Bean.say('ok. that is enough.', 1600); clicks = []; }
      else if (clicks.length === 3) { Bean.wink(); Bean.say('hehe', 1000); }
      else Bean.mood('happy', 700);
    }
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
  });
})();
