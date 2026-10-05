// Tonic, the mascot: a shot of espresso with eyes, named after Andy's order.
// A ring of points on springs drawn as one smooth path, a crema layer that
// sloshes when it moves, and two eyes that are four-point curves. Each agent
// skin changes the vessel: a Clawd-ish clay glass with legs, a blue terminal
// robot with >_ on its chest, a floating arch, and a block. No library.
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var N = 44, HOME = { x: 100, y: 94 }, GROUND = 148, TAU = Math.PI * 2;

  /* ── vessels: an outline, resampled to N points, top-centre first ── */
  function arc(out, cx, cy, r, a0, a1, steps) {
    for (var i = 0; i <= steps; i++) { var a = a0 + (a1 - a0) * i / steps; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  }
  // a polygon with rounded corners; verts clockwise from the top-left, radii per corner
  function rounded(verts, radii) {
    var out = [];
    for (var i = 0; i < verts.length; i++) {
      var p = verts[i], a = verts[(i + verts.length - 1) % verts.length], b = verts[(i + 1) % verts.length], r = radii[i];
      var da = norm([a[0] - p[0], a[1] - p[1]]), db = norm([b[0] - p[0], b[1] - p[1]]);
      var s = [p[0] + da[0] * r, p[1] + da[1] * r], e = [p[0] + db[0] * r, p[1] + db[1] * r];
      for (var k = 0; k <= 6; k++) {
        var t = k / 6, u = 1 - t;  // quadratic through the corner
        out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]]);
      }
    }
    return out;
  }
  function norm(v) { var l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
  function resample(poly) {
    // start at the top-centre and go clockwise
    var best = 0, bd = 1e9;
    poly.forEach(function (p, i) { var d = Math.abs(p[0]) + (p[1] + 100) * 0.01; if (p[1] < 0 && d < bd) { bd = d; best = i; } });
    poly = poly.slice(best).concat(poly.slice(0, best));
    var segs = [], total = 0;
    for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push(l); total += l; }
    var out = [], step = total / N, acc = 0, j = 0, into = 0;
    for (var n = 0; n < N; n++) {
      var want = n * step;
      while (acc + segs[j] < want) { acc += segs[j]; j = (j + 1) % poly.length; }
      into = (want - acc) / (segs[j] || 1);
      var p0 = poly[j], p1 = poly[(j + 1) % poly.length];
      out.push([p0[0] + (p1[0] - p0[0]) * into, p0[1] + (p1[1] - p0[1]) * into]);
    }
    return out;
  }
  var VESSELS = {
    glass: resample(rounded([[-44, -48], [44, -48], [32, 50], [-32, 50]], [5, 5, 12, 12])),
    robot: resample(rounded([[-42, -44], [42, -44], [42, 50], [-42, 50]], [16, 16, 12, 12])),
    arch: (function () { var o = []; arc(o, 0, -4, 42, Math.PI, TAU, 24); o.push([42, 50]); o.push([-42, 50]); return resample(o); })(),
    block: resample(rounded([[-45, -45], [45, -45], [45, 50], [-45, 50]], [3, 3, 3, 3]))
  };

  var SKINS = {
    claude:   { v: 'glass', w: 7,  h: 15, k: 0.92, lean: 0,   gap: 24, float: 0, crema: 0.26, extra: 'clawd' },
    codex:    { v: 'robot', w: 8,  h: 12, k: 0.96, lean: 0,   gap: 24, float: 0, crema: 0.18, extra: 'robot' },
    agy:      { v: 'arch',  w: 9,  h: 18, k: 0.6,  lean: 0,   gap: 24, float: 10, crema: 0.24, extra: 'orbit' },
    opencode: { v: 'block', w: 11, h: 11, k: 0.98, lean: 0,   gap: 26, float: 0, crema: 0.2, extra: 'feet' }
  };

  var MOODS = {
    idle:      { w: 1,    t: 1,    b: 1,    tilt: 0,   dy: 0 },
    happy:     { w: 1.35, t: 0.85, b: -0.4, tilt: 0,   dy: -2 },
    sad:       { w: 1.1,  t: 0.45, b: 0.9,  tilt: -18, dy: 4 },
    angry:     { w: 1.4,  t: 0.25, b: 0.35, tilt: 22,  dy: 2 },
    surprised: { w: 1.6,  t: 1.15, b: 1.15, tilt: 0,   dy: -2 },
    curious:   { w: 1.2,  t: 1.05, b: 0.8,  tilt: -6,  dy: -1 },
    think:     { w: 1,    t: 0.9,  b: 0.7,  tilt: 0,   dy: -1 },
    read:      { w: 1,    t: 0.75, b: 0.75, tilt: 0,   dy: 2 },
    sleep:     { w: 1.3,  t: 0.08, b: 0.08, tilt: 0,   dy: 5 },
    dizzy:     { w: 1.15, t: 0.9,  b: 0.9,  tilt: 0,   dy: 0 },
    love:      { w: 1.3,  t: 0.8,  b: -0.35, tilt: 0,  dy: -2 }
  };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function f(n) { return Math.round(n * 10) / 10; }
  function now() { return performance.now(); }
  function rect(x, y, w, h) { return 'M' + f(x) + ' ' + f(y) + 'h' + f(w) + 'v' + f(h) + 'h' + f(-w) + 'Z'; }

  /* ── one drawn Tonic ───────────────────────────────────────────── */
  function Body(svg, interactive) {
    var q = function (s) { return svg.querySelector(s); };
    this.svg = svg; this.interactive = interactive;
    this.bodyEl = q('.t-body'); this.clipEl = q('.t-clip'); this.cremaEl = q('.t-crema'); this.glint = q('.t-glint');
    this.eyeEls = svg.querySelectorAll('.t-eye'); this.shadow = q('.t-shadow'); this.steam = q('.t-steam');
    this.z = q('.t-z'); this.extra = q('.t-extra'); this.ant = q('.t-ant'); this.chest = q('.t-chest');
    this.front = q('.t-front'); this.fizz = q('.t-fizz'); this.hearts = q('.t-hearts');
    this.c = { x: HOME.x, y: HOME.y, vx: 0, vy: 0 };
    this.p = []; for (var i = 0; i < N; i++) this.p.push({ x: HOME.x, y: HOME.y, vx: 0, vy: 0 });
    this.eye = { w: 8, t: 7, b: 7, tilt: 0, dy: 0, gx: 0, gy: 0 };
    this.drag = null; this.slosh = 0; this.sloshV = 0;
    this.reset();
  }
  Body.prototype.reset = function () {
    for (var i = 0; i < N; i++) { var r = this.rest(i, 0); this.p[i].x = r.x; this.p[i].y = r.y; this.p[i].vx = this.p[i].vy = 0; }
  };
  Body.prototype.rest = function (i, t) {
    var u = VESSELS[S.skin.v][i], s = 1, ox = 0, oy = 0;
    if (!reduced) {
      s = 1 + 0.012 * Math.sin(t * (S.mood === 'sleep' ? 0.9 : 1.7));
      var a = Math.atan2(u[1], u[0]);
      if (S.ripple) { var w = 2 * Math.sin(3 * a - t * 5); ox += Math.cos(a) * w; oy += Math.sin(a) * w; }
      if (S.mood === 'dizzy') { var d = 1.6 * Math.sin(2 * a + t * 9); ox += Math.cos(a) * d; oy += Math.sin(a) * d; }
      if (S.jitter) { ox += (Math.random() - 0.5) * S.jitter; oy += (Math.random() - 0.5) * S.jitter; }
    }
    var sy = S.mood === 'sleep' ? 0.94 : 1, pen = this.c.y - HOME.y;
    if (pen > 0) sy -= Math.min(0.26, pen / 50 * 0.9);
    var sx = 1 / sy;
    return { x: this.c.x + u[0] * s * sx + ox, y: this.c.y + u[1] * s * sy + (1 - sy) * 50 + oy };
  };
  Body.prototype.step = function (t, dt) {
    var c = this.c, k = dt * 60;
    var hy = HOME.y - (reduced ? 0 : S.skin.float * (0.6 + 0.4 * Math.sin(t * 1.3))) - S.hop;
    var tx = HOME.x, ty = hy;
    if (this.drag) {
      tx += clamp((this.drag.x - this.drag.x0) * 0.35, -30, 30);
      ty += clamp((this.drag.y - this.drag.y0) * 0.35, -26, 18);
    }
    c.vx += ((tx - c.x) * 0.07 - c.vx * 0.13) * k;
    c.vy += ((ty - c.y) * 0.07 - c.vy * 0.13) * k;
    c.x += c.vx * k; c.y += c.vy * k;
    // keep it on stage when flung
    if (c.x < 50) { c.x = 50; c.vx = Math.abs(c.vx) * 0.6; Tonic.bonk(); }
    if (c.x > 150) { c.x = 150; c.vx = -Math.abs(c.vx) * 0.6; Tonic.bonk(); }
    if (c.y < 46) { c.y = 46; c.vy = Math.abs(c.vy) * 0.6; }

    var p = this.p, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, sx = 0, sy = 0;
    for (var i = 0; i < N; i++) {
      var q = p[i], r = this.rest(i, t), gx = r.x, gy = r.y;
      if (this.drag) {
        var d = Math.min(Math.abs(i - this.drag.i), N - Math.abs(i - this.drag.i)), fall = Math.exp(-(d * d) / 14);
        gx += clamp(this.drag.x - this.drag.x0, -60, 60) * fall * 0.5;
        gy += clamp(this.drag.y - this.drag.y0, -60, 60) * fall * 0.5;
      }
      var a = p[(i + N - 1) % N], b = p[(i + 1) % N];
      q.vx += ((gx - q.x) * 0.2 + ((a.x + b.x) / 2 - q.x) * 0.06 - q.vx * 0.18) * k;
      q.vy += ((gy - q.y) * 0.2 + ((a.y + b.y) / 2 - q.y) * 0.06 - q.vy * 0.18) * k;
      q.x += q.vx * k; q.y += q.vy * k;
      if (q.y > GROUND + 4) { q.y = GROUND + 4; q.vy *= -0.3; }
      sx += q.x; sy += q.y;
      if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x; if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
    }
    this.cx = sx / N; this.cy = sy / N; this.box = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };

    // the crema lags behind the glass: a damped pendulum driven by acceleration
    this.sloshV += (-c.vx * 0.05 - this.slosh * 0.05 - this.sloshV * 0.08) * k;
    this.slosh = clamp(this.slosh + this.sloshV * k, -0.5, 0.5);

    var m = MOODS[S.mood] || MOODS.idle, sk = S.skin, e = this.eye, ease = 1 - Math.pow(0.78, k);
    e.w = lerp(e.w, sk.w * m.w, ease); e.t = lerp(e.t, sk.h / 2 * m.t, ease); e.b = lerp(e.b, sk.h / 2 * m.b, ease);
    e.tilt = lerp(e.tilt, m.tilt, ease); e.dy = lerp(e.dy, m.dy, ease);
    var g = S.gaze(this, t);
    e.gx = lerp(e.gx, g.x, 1 - Math.pow(0.82, k)); e.gy = lerp(e.gy, g.y, 1 - Math.pow(0.82, k));
  };

  Body.prototype.draw = function (t) {
    var p = this.p, d = '';
    for (var i = 0; i < N; i++) {
      var p0 = p[(i + N - 1) % N], p1 = p[i], p2 = p[(i + 1) % N], p3 = p[(i + 2) % N];
      if (i === 0) d += 'M' + f(p1.x) + ' ' + f(p1.y);
      d += 'C' + f(p1.x + (p2.x - p0.x) / 6) + ' ' + f(p1.y + (p2.y - p0.y) / 6) + ' ' + f(p2.x - (p3.x - p1.x) / 6) + ' ' + f(p2.y - (p3.y - p1.y) / 6) + ' ' + f(p2.x) + ' ' + f(p2.y);
    }
    d += 'Z';
    this.bodyEl.setAttribute('d', d);
    if (this.clipEl) this.clipEl.setAttribute('d', d);

    var bx = this.box, H = bx.maxY - bx.minY, sk = S.skin;
    // crema: a band across the top with a wavy, tilting underside (in tonic mode, the espresso float)
    if (this.cremaEl) {
      var depth = (S.tonicMode ? 0.42 : sk.crema) * H, base = bx.minY + depth, cd = 'M' + f(bx.minX - 12) + ' ' + f(bx.minY - 20) + 'L' + f(bx.maxX + 12) + ' ' + f(bx.minY - 20);
      for (var x = bx.maxX + 12; x >= bx.minX - 12; x -= 6) {
        var y = base + this.slosh * (x - this.cx) * 0.9 + (reduced ? 0 : Math.sin(x * 0.13 + t * 2.6) * 1.4);
        cd += 'L' + f(x) + ' ' + f(y);
      }
      this.cremaEl.setAttribute('d', cd + 'Z');
    }
    if (this.glint) this.glint.setAttribute('d', rect(bx.minX + 8, bx.minY + H * 0.32, 4, H * 0.38));
    if (this.fizz) this.drawFizz(t, bx, H);

    // eyes sit in the espresso, below the crema
    var e = this.eye, bl = S.blinkAmt(t), eyeY = bx.minY + H * ((S.tonicMode ? 0.42 : sk.crema) + (S.tonicMode ? 0.2 : 0.26));
    for (var s = -1; s <= 1; s += 2) {
      var wink = (S.wink && s === -1) ? 0.08 : 1;
      var cx = this.cx + s * sk.gap / 2 + e.gx * 8, cy = eyeY + e.dy + e.gy * 6;
      var rot = (sk.lean + s * e.tilt) * Math.PI / 180;
      this.eyeEls[s < 0 ? 0 : 1].setAttribute('d', eyePath(cx, cy, e.w, Math.max(0.8, e.t * bl * wink), e.b * bl * wink, sk.k, rot));
    }
    this.drawExtras(t, bx, H);

    if (this.shadow) {
      var lift = clamp((HOME.y - this.c.y) / 40, -0.3, 1);
      this.shadow.setAttribute('cx', f(this.c.x));
      this.shadow.setAttribute('rx', f(44 * (1 - lift * 0.35)));
      this.shadow.style.opacity = String(0.5 - lift * 0.25);
    }
    if (this.steam) { this.steam.style.opacity = String(S.steam); this.steam.setAttribute('transform', 'translate(' + f(this.cx - 100) + ' ' + f(bx.minY - 48) + ')'); }
    if (this.z) { this.z.style.opacity = S.mood === 'sleep' ? String(0.5 + 0.5 * Math.sin(t * 2)) : '0'; this.z.setAttribute('x', f(bx.maxX + 6)); this.z.setAttribute('y', f(bx.minY + 4 - (t * 6 % 10))); }
    if (this.hearts) {
      var on = S.mood === 'love' ? 1 : 0;
      this.hearts.style.opacity = String(on);
      if (on) this.hearts.setAttribute('transform', 'translate(' + f(this.cx - 100) + ' ' + f(bx.minY - 30 - (t * 10 % 12)) + ')');
    }
  };

  Body.prototype.drawExtras = function (t, bx, H) {
    var sk = S.skin, cx = this.cx, ex = '', ant = '';
    var walk = (Math.abs(this.c.vx) > 0.4 || S.mood === 'happy' || S.party) && !reduced;
    if (sk.extra === 'clawd') {
      var legs = [-27, -13, 6, 20];
      legs.forEach(function (lx, i) { var lift = walk ? Math.max(0, Math.sin(t * 14 + i * 1.6)) * 3 : 0; ex += rect(cx + lx, bx.maxY - 3 - lift, 7, 10); });
      var arm = walk ? Math.sin(t * 10) * 2 : 0;
      ex += rect(bx.minX - 6, this.cy - 2 + arm, 9, 9) + rect(bx.maxX - 3, this.cy - 2 - arm, 9, 9);
    } else if (sk.extra === 'robot') {
      ant = 'M' + f(cx) + ' ' + f(bx.minY + 1) + 'L' + f(cx + Math.sin(t * 3) * 2) + ' ' + f(bx.minY - 13);
      ex += rect(cx - 4 + Math.sin(t * 3) * 2, bx.minY - 19, 8, 8);
      ex += rect(cx - 22, bx.maxY - 3, 12, 8) + rect(cx + 10, bx.maxY - 3, 12, 8);
    } else if (sk.extra === 'feet') {
      ex += rect(cx - 30, bx.maxY - 2, 16, 6) + rect(cx + 14, bx.maxY - 2, 16, 6);
    }
    if (this.extra) this.extra.setAttribute('d', ex);
    if (this.ant) this.ant.setAttribute('d', ant);
    if (this.chest) {
      var show = sk.extra === 'robot' && !S.tonicMode;
      this.chest.style.opacity = show ? '1' : '0';
      if (show) { this.chest.setAttribute('x', f(cx)); this.chest.setAttribute('y', f(bx.maxY - H * 0.18)); }
    }
    if (this.front) {
      var orb = '';
      if (sk.extra === 'orbit' && !reduced) {
        for (var i = 0; i < 3; i++) {
          var a = t * 1.4 + i * TAU / 3, ox = cx + Math.cos(a) * 62, oy = this.cy + Math.sin(a) * 14, r = 2.6 + Math.sin(a) * 1.2;
          if (Math.sin(a) > 0 || true) orb += 'M' + f(ox - r) + ' ' + f(oy) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(r * 2) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-r * 2) + ' 0';
        }
      }
      this.front.setAttribute('d', orb);
    }
  };

  // the espresso tonic: bubbles rising through tonic water, two ice cubes bobbing
  Body.prototype.drawFizz = function (t, bx, H) {
    if (!S.tonicMode) { if (this.fizzOn) { this.fizz.setAttribute('d', ''); this.fizzOn = false; } return; }
    this.fizzOn = true;
    var d = '', W = bx.maxX - bx.minX;
    for (var i = 0; i < 9; i++) {
      var ph = (t * (0.35 + (i % 3) * 0.12) + i * 0.37) % 1;
      var x = bx.minX + W * (0.15 + ((i * 0.618) % 0.7)), y = bx.maxY - 6 - ph * H * 0.55, r = 1.2 + (i % 3) * 0.6;
      d += 'M' + f(x - r) + ' ' + f(y) + 'a' + r + ' ' + r + ' 0 1 0 ' + f(r * 2) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + f(-r * 2) + ' 0';
    }
    var cy = bx.minY + H * 0.48;
    d += rect(this.cx - 26, cy + Math.sin(t * 2) * 2, 14, 13) + rect(this.cx + 10, cy + 6 + Math.sin(t * 2 + 1) * 2, 13, 12);
    this.fizz.setAttribute('d', d);
  };

  function eyePath(cx, cy, w, t, b, k, rot) {
    var hw = w / 2, cos = Math.cos(rot), sin = Math.sin(rot);
    if (b < -t * 0.8) b = -t * 0.8;
    var pts = [[-hw, 0], [-hw, -t * k], [-hw * k, -t], [0, -t], [hw * k, -t], [hw, -t * k], [hw, 0], [hw, b * k], [hw * k, b], [0, b], [-hw * k, b], [-hw, b * k], [-hw, 0]]
      .map(function (q) { return f(cx + q[0] * cos - q[1] * sin) + ' ' + f(cy + q[0] * sin + q[1] * cos); });
    return 'M' + pts[0] + 'C' + pts.slice(1, 4).join(' ') + 'C' + pts.slice(4, 7).join(' ') + 'C' + pts.slice(7, 10).join(' ') + 'C' + pts.slice(10, 13).join(' ') + 'Z';
  }

  /* ── shared state ──────────────────────────────────────────────── */
  var S = {
    skin: SKINS.claude, skinKey: 'claude', mood: 'idle', moodUntil: 0, base: 'idle',
    ripple: false, hop: 0, steam: 0, wink: false, jitter: 0, party: false, tonicMode: false,
    look: null, lookUntil: 0, pointer: null, nextBlink: 2, blinkStart: -1,
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
      var sx = rect.left + (body.cx / 200) * rect.width, sy = rect.top + (body.cy / 170) * rect.height;
      var dx = target.x - sx, dy = target.y - sy, dist = Math.hypot(dx, dy) || 1, m = dist / (dist + 90);
      return { x: dx / dist * m, y: dy / dist * m };
    }
  };

  var bodies = [];
  var big = document.getElementById('tonic'), mini = document.getElementById('tonic-mini');
  if (big) bodies.push(new Body(big, true));
  if (mini) bodies.push(new Body(mini, false));

  /* ── the loop ──────────────────────────────────────────────────── */
  var last = now(), t0 = last;
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    var t = (ts - t0) / 1000;
    if (S.moodUntil && ts > S.moodUntil) { S.mood = S.base; S.moodUntil = 0; }
    S.hop *= Math.pow(0.86, dt * 60);
    S.steam = Math.max(S.tonicMode ? 0 : 0, S.steam - dt * 0.12);
    if (S.party && !reduced && Math.random() < 0.04) S.hop = 14;
    watchEggs();
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.svg.getClientRects().length) continue;
      b.step(t, dt); b.draw(t);
    }
    if (!document.hidden) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ── the public face ───────────────────────────────────────────── */
  var bubble = document.getElementById('bubble'), bubbleTimer, lastBonk = 0;
  var Tonic = {
    mood: function (m, ms) {
      if (!MOODS[m]) return;
      if (S.mood === 'sleep' && m !== 'sleep') S.hop = 10;
      S.mood = m;
      if (ms) S.moodUntil = now() + ms; else { S.base = m; S.moodUntil = 0; }
    },
    base: function (m) { S.base = m; if (!S.moodUntil) S.mood = m; },
    ripple: function (on) { S.ripple = on; },
    look: function (x, y, ms) { S.look = { x: x, y: y }; S.lookUntil = now() + (ms || 1200); },
    lookAt: function (el, ms) { var r = el.getBoundingClientRect(); Tonic.look(r.left + r.width / 2, r.top + Math.min(r.height / 2, 30), ms); },
    hop: function (h) { S.hop = h || 16; bodies.forEach(function (b) { b.c.vy -= 2; }); },
    wink: function () { S.wink = true; setTimeout(function () { S.wink = false; }, 380); },
    brew: function () { S.steam = 1; },
    jitter: function (amt, ms) { S.jitter = amt; clearTimeout(Tonic._jt); Tonic._jt = setTimeout(function () { S.jitter = 0; }, ms || 6000); },
    party: function (ms) { S.party = true; document.body.classList.add('party'); setTimeout(function () { S.party = false; document.body.classList.remove('party'); }, ms || 6000); },
    tonic: function (on) {
      S.tonicMode = on == null ? !S.tonicMode : on;
      document.documentElement.classList.toggle('espresso-tonic', S.tonicMode);
      bodies.forEach(function (b) { b.c.vy -= 6; b.sloshV += 0.2; });
      return S.tonicMode;
    },
    shake: function (amt) { bodies.forEach(function (b) { b.c.vx += amt || 8; }); },
    bonk: function () { var tn = now(); if (tn - lastBonk > 600) { lastBonk = tn; Tonic.mood('surprised', 600); Tonic.say('bonk', 700); } },
    skin: function (key) {
      if (!SKINS[key]) return;
      S.skin = SKINS[key]; S.skinKey = key;
      bodies.forEach(function (b) { b.c.vy -= 5; b.sloshV += 0.15; });
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
          var q = b.p[i], dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) || 1, s = Math.max(0, 1 - d / 70) * 7;
          q.vx += dx / d * s; q.vy += dy / d * s;
        }
        b.sloshV += (x < b.cx ? 1 : -1) * 0.12;
      });
    },
    get moodName() { return S.mood; },
    get skinName() { return S.skinKey; },
    get tonicMode() { return S.tonicMode; }
  };
  window.Tonic = Tonic;

  try { var saved = localStorage.getItem('skin'); if (SKINS[saved]) { S.skin = SKINS[saved]; S.skinKey = saved; } } catch (e) {}
  bodies.forEach(function (b) { b.reset(); });

  /* ══ what Tonic notices ═════════════════════════════════════════ */
  var lastActive = now();
  function active() {
    if (S.mood === 'sleep') { Tonic.mood('surprised', 700); S.base = 'idle'; Tonic.say('oh! hi.', 1400); }
    lastActive = now();
  }
  setInterval(function () {
    if (S.mood !== 'sleep' && !S.moodUntil && now() - lastActive > 28000 && S.base === 'idle') { Tonic.base('sleep'); Tonic.say('zz', 1600); }
  }, 1000);
  addEventListener('pointermove', function (e) { S.pointer = { x: e.clientX, y: e.clientY }; active(); }, { passive: true });
  addEventListener('keydown', active);
  document.addEventListener('pointerleave', function () { S.pointer = null; });

  // what time it is where you are
  setTimeout(function () {
    var h = new Date().getHours();
    if (h >= 23 || h < 5) { Tonic.mood('sleep', 2500); Tonic.say('it is late. decaf?', 2600); }
    else if (h < 11) Tonic.say('morning. first shot?', 2400);
  }, 2600);

  // coming back to the tab
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = now(); return; }
    last = now(); requestAnimationFrame(frame);
    if (hiddenAt && now() - hiddenAt > 8000) { Tonic.hop(18); Tonic.mood('happy', 1400); Tonic.say('you came back!', 1800); }
  });

  // fast scrolling makes Tonic dizzy; jumps the agent makes do not count
  var lastY = null, lastT = 0, fast = 0, quietUntil = 0, sawBottom = false;
  Tonic.quiet = function (ms) { quietUntil = now() + (ms || 1500); };
  document.addEventListener('scroll', function (e) {
    active();
    var el = e.target === document ? document.scrollingElement : e.target;
    if (!el || el.closest && el.closest('.agent, .term')) return;
    if (!sawBottom && el.scrollHeight > 2000 && el.scrollTop + el.clientHeight > el.scrollHeight - 40) {
      sawBottom = true; Tonic.hop(18); Tonic.mood('love', 1600); Tonic.say('you read the whole thing', 2000);
    }
    if (now() < quietUntil) { lastY = null; return; }
    var y = el.scrollTop, tn = now();
    if (lastY !== null && tn - lastT < 120) {
      var v = Math.abs(y - lastY) / Math.max(1, tn - lastT);
      fast = v > 5 ? fast + 1 : Math.max(0, fast - 1);
      if (fast > 6 && S.mood !== 'dizzy') { Tonic.mood('dizzy', 1600); Tonic.say('woah, slow down', 1600); Tonic.shake(6); fast = 0; }
    }
    lastY = y; lastT = tn;
  }, true);

  // hovering something with a status dot: a look, and an opinion
  var hovered = null;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-status], .ssh-cta');
    if (!el || el === hovered) return;
    hovered = el;
    Tonic.lookAt(el, 1600);
    if (S.mood === 'think' || S.mood === 'read' || S.mood === 'sleep') return;
    if (el.classList.contains('ssh-cta')) { Tonic.mood('surprised', 700); return; }
    var st = el.dataset.status;
    if (st === 'green') Tonic.mood('happy', 900);
    else if (st === 'yellow') Tonic.mood('curious', 900);
    else if (st === 'red') { Tonic.mood('sad', 1400); Tonic.say('rip betelgeuse', 1400); }
  });

  // selecting and copying text
  var selTimer, lastSelSay = 0;
  document.addEventListener('selectionchange', function () {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      var s = getSelection();
      if (!s || s.isCollapsed || String(s).trim().length < 4) return;
      var node = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      if (!node || !node.closest('#doc')) return;
      var r = s.getRangeAt(0).getBoundingClientRect();
      Tonic.look(r.left + r.width / 2, r.top + r.height / 2, 2000);
      Tonic.mood('curious', 1200);
      if (now() - lastSelSay > 15000) { lastSelSay = now(); Tonic.say('ooh, highlighting', 1500); }
    }, 250);
  });
  document.addEventListener('copy', function () {
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    Tonic.wink(); Tonic.mood('happy', 900); Tonic.say('copying andy\'s homework?', 1800);
  });

  // resizing the window stretches it
  var rsT;
  addEventListener('resize', function () {
    clearTimeout(rsT);
    bodies.forEach(function (b) { b.p.forEach(function (q, i) { q.vx += Math.cos(i / N * TAU) * 1.5; }); });
    rsT = setTimeout(function () { Tonic.say('stretchy', 1000); }, 200);
  });

  // typed words, anywhere outside a text box: "tonic", "espresso", the konami code
  var buf = '', keys = [], KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  addEventListener('keydown', function (e) {
    keys.push(e.key); keys = keys.slice(-10);
    if (keys.join() === KONAMI.join()) { keys = []; Tonic.party(7000); Tonic.mood('love', 3000); Tonic.say('↑↑↓↓←→←→ba! party.', 2600); return; }
    if (/INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-24);
    if (/espresso ?tonic$/.test(buf) || /tonic$/.test(buf)) { buf = ''; Tonic.order(); }
    else if (/coffee$/.test(buf)) { buf = ''; Tonic.brew(); Tonic.say('did someone say coffee', 1600); Tonic.hop(12); }
    else if (/hello$|hi tonic$/.test(buf)) { buf = ''; Tonic.wink(); Tonic.say('hello!', 1200); }
  });

  // Andy's order: the vessel fills with tonic, ice, and an espresso float
  var orderT;
  Tonic.order = function () {
    var on = Tonic.tonic(true);
    Tonic.mood('love', 2200); Tonic.hop(20);
    Tonic.say('espresso tonic. andy\'s order.', 2600);
    clearTimeout(orderT);
    orderT = setTimeout(function () { Tonic.tonic(false); Tonic.say('back to a plain shot', 1400); }, 20000);
    return on;
  };

  // caffeine: every coffee counts, and too many show
  var cups = 0;
  var brew = Tonic.brew;
  Tonic.brew = function () {
    brew(); cups++;
    if (cups >= 5) { Tonic.jitter(4, 9000); Tonic.say('I can hear colours', 2000); }
    else if (cups >= 3) { Tonic.jitter(2, 6000); Tonic.say('cup ' + cups + '. vibrating slightly.', 1800); }
    return cups;
  };

  // the title-bar dots fling, flatten, and stretch a fake cursor; Tonic watches it go
  var fake = document.getElementById('fake-cursor'), wasEgg = false;
  function watchEggs() {
    var egg = document.body.classList.contains('hide-cursor');
    if (egg && fake) {
      var r = fake.getBoundingClientRect();
      S.look = { x: r.left + 6, y: r.top + 8 }; S.lookUntil = now() + 300;
      if (!wasEgg) { Tonic.mood('surprised', 2400); Tonic.say('your cursor!', 1800); }
    } else if (wasEgg) Tonic.mood('sad', 900);
    wasEgg = egg;
  }

  /* ── poke, pet, shake, drag, fling, spin ───────────────────────── */
  bodies.forEach(function (b) {
    if (!b.interactive) return;
    var svg = b.svg, clicks = [], track = [];
    function toSvg(e) { var r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 200, y: (e.clientY - r.top) / r.height * 170 }; }
    function inside(q) { return q.x > b.box.minX - 8 && q.x < b.box.maxX + 8 && q.y > b.box.minY - 8 && q.y < b.box.maxY + 8; }

    // petting: slow strokes over it; shaking: fast back-and-forth over it
    var petTime = 0, lastMove = 0, lastX = null, dir = 0, flips = [];
    svg.addEventListener('pointermove', function (e) {
      if (b.drag) return;
      var q = toSvg(e), tn = now();
      if (!inside(q)) { lastX = null; return; }
      if (lastX !== null) {
        var dx = q.x - lastX, sp = Math.abs(dx) / Math.max(1, tn - lastMove);
        if (sp < 0.25) { petTime += tn - lastMove; if (petTime > 1400) { petTime = 0; Tonic.mood('love', 1800); Tonic.say(['purr', 'that is nice', 'mmm'][Math.floor(Math.random() * 3)], 1400); } }
        var d = Math.sign(dx);
        if (sp > 1 && d && d !== dir) { dir = d; flips.push(tn); flips = flips.filter(function (x) { return tn - x < 900; }); b.sloshV += d * 0.12; }
        if (flips.length >= 6) { flips = []; Tonic.mood('dizzy', 1600); Tonic.say('stop, I\'ll spill', 1600); Tonic.shake(10); }
      }
      lastX = q.x; lastMove = tn;
    });

    svg.addEventListener('pointerdown', function (e) {
      var q = toSvg(e), best = 0, bd = 1e9;
      for (var i = 0; i < N; i++) { var d = Math.hypot(b.p[i].x - q.x, b.p[i].y - q.y); if (d < bd) { bd = d; best = i; } }
      if (bd > 70) return;
      svg.setPointerCapture(e.pointerId);
      b.drag = { i: best, x0: q.x, y0: q.y, x: q.x, y: q.y, moved: 0 };
      track = [{ x: q.x, y: q.y, t: now() }];
      Tonic.mood('surprised', 400);
    });
    svg.addEventListener('pointermove', function (e) {
      if (!b.drag) return;
      var q = toSvg(e);
      b.drag.moved = Math.max(b.drag.moved, Math.hypot(q.x - b.drag.x0, q.y - b.drag.y0));
      b.drag.x = q.x; b.drag.y = q.y;
      track.push({ x: q.x, y: q.y, t: now() }); track = track.slice(-6);
    });
    function release() {
      if (!b.drag) return;
      var moved = b.drag.moved, q = { x: b.drag.x0, y: b.drag.y0 };
      b.drag = null;
      if (moved > 40) {
        var a = track[0], z = track[track.length - 1], dt = Math.max(16, z.t - a.t);
        var vx = (z.x - a.x) / dt * 16, vy = (z.y - a.y) / dt * 16;
        b.c.vx += clamp(vx, -14, 14); b.c.vy += clamp(vy, -14, 14); b.sloshV += clamp(-vx * 0.02, -0.3, 0.3);
        var hard = Math.hypot(vx, vy) > 8;
        Tonic.mood(hard ? 'surprised' : 'happy', 1000);
        Tonic.say(hard ? 'wheeeee' : ['boing', 'again!'][Math.floor(Math.random() * 2)], 1200);
        return;
      }
      Tonic.poke(q.x, q.y); Tonic.hop(12);
      var tn = now();
      clicks = clicks.filter(function (c) { return tn - c < 2500; }); clicks.push(tn);
      if (clicks.length >= 6) { Tonic.mood('angry', 1500); Tonic.say('ok. that is enough.', 1600); clicks = []; }
      else if (clicks.length === 3) { Tonic.wink(); Tonic.say('hehe', 1000); }
      else Tonic.mood('happy', 700);
    }
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('dblclick', function () {
      svg.classList.remove('spin'); void svg.getBoundingClientRect(); svg.classList.add('spin');
      Tonic.say('wheee', 900);
      setTimeout(function () { svg.classList.remove('spin'); }, 800);
    });
  });
})();
