// andymsun.com: the editor around the content. Everything readable is in the
// markup; this adds the explorer and tabs, line numbers, the filters, the
// Lawvics figure, the terminal panel, and the command palette.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var wait = function (ms) { return reduced ? Promise.resolve() : new Promise(function (r) { setTimeout(r, ms); }); };
  var SSH = 'ssh ssh.andymsun.com';
  var noop = function () {};
  var Tonic = window.Tonic || { mood: noop, base: noop, ripple: noop, say: noop, hop: noop, brew: noop, lookAt: noop, skin: noop };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  /* ── toast ────────────────────────────────────────────────────── */
  var toast = $('#toast'), toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }

  /* ── copy the ssh command ─────────────────────────────────────── */
  function copySSH(btn) {
    Tonic.mood('happy', 1200); Tonic.hop(14);
    if (!navigator.clipboard) { say('Select and copy: ' + SSH); return; }
    navigator.clipboard.writeText(SSH).then(function () {
      say('Copied: ' + SSH);
      if (btn && btn.classList.contains('copy')) {
        var was = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = was; btn.classList.remove('done'); }, 1800);
      }
    }, function () { say('Select and copy: ' + SSH); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (b) copySSH(b);
  });

  /* ── theme ────────────────────────────────────────────────────── */
  var root = document.documentElement;
  function currentTheme() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  // flip it too often and Tonic spills coffee over the switch for five seconds
  var themeFlips = [], themeLockedUntil = 0;
  function toggleTheme() {
    var tn = Date.now();
    if (tn < themeLockedUntil) {
      var secs = Math.ceil((themeLockedUntil - tn) / 1000);
      if (window.Coffee) window.Coffee.sticky(3500);
      say('It\'s covered in coffee. ' + secs + 's.');
      Tonic.mood('angry', 900); Tonic.say('that\'s what you get', 1400);
      return currentTheme();
    }
    themeFlips = themeFlips.filter(function (x) { return tn - x < 3000; }); themeFlips.push(tn);
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    if (themeFlips.length >= 4) {
      themeFlips = [];
      Tonic.mood('angry', 2400); Tonic.shake(10); Tonic.say('ENOUGH. *splash*', 2200);
      if (window.Coffee) themeLockedUntil = window.Coffee.spill($('#theme-btn'), 5000);
      say('Tonic spilled coffee on the theme switch');
    } else { Tonic.mood(next === 'light' ? 'angry' : 'happy', 900); Tonic.say(next === 'light' ? 'bright!' : 'ahh, better', 1200); }
    return next;
  }
  $('#theme-btn').addEventListener('click', toggleTheme);

  /* ── navigation: explorer, tabs, and every #link ─────────────── */
  var doc = $('#doc');
  function flash(t) {
    t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
    setTimeout(function () { t.classList.remove('flash'); }, 1400);
  }
  function go(id) {
    var t = document.getElementById(id);
    if (!t) return false;
    if (t.classList.contains('proj') && t.classList.contains('hide')) filter('all');
    for (var p = t; p && p !== doc; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    if (Tonic.quiet) Tonic.quiet(1500);
    t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (!t.classList.contains('buf')) flash(t);
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    closeSheet();
    return true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return;
    if (go(a.getAttribute('href').slice(1))) e.preventDefault();
  });

  // which file is on screen
  var titleFile = $('#title-file'), tabs = $$('.tab'), treeLinks = $$('.tree a');
  var visited = {};
  function setActive(id, file) {
    // a file counts as read once it has been on screen for a couple of seconds
    clearTimeout(setActive.dwell);
    setActive.dwell = setTimeout(function () {
      if (visited[id]) return;
      visited[id] = 1;
      if (Object.keys(visited).length === 7) { say('Read every file in the repo'); Tonic.mood('happy', 1800); Tonic.hop(16); Tonic.say('a completionist!', 1800); }
    }, 2000);
    tabs.forEach(function (t) { t.classList.toggle('on', t.dataset.sec === id); });
    treeLinks.forEach(function (a) { if (a.dataset.sec) a.classList.toggle('on', a.dataset.sec === id); });
    if (titleFile.textContent !== file) titleFile.textContent = file;
    var on = $('.tab.on');
    if (on && on.parentElement.scrollWidth > on.parentElement.clientWidth) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  if ('IntersectionObserver' in window) {
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id, e.target.dataset.file); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    $$('.buf').forEach(function (s) { secIO.observe(s); });
    var projIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = $('.tree a[href="#' + e.target.id + '"]');
        if (a) a.classList.toggle('seen', e.isIntersecting);
        if (e.isIntersecting) titleFile.textContent = 'projects/' + $('.file', e.target).textContent;
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    $$('.proj').forEach(function (s) { projIO.observe(s); });
  }

  /* ── project filters ──────────────────────────────────────────── */
  var cards = $$('.proj'), empty = $('#empty');
  function filter(which) {
    var shown = 0;
    cards.forEach(function (c) {
      var on = which === 'all' || c.dataset.status === which;
      c.classList.toggle('hide', !on);
      if (on) shown++;
    });
    empty.hidden = shown > 0;
    if (which === 'red') { Tonic.mood('sad', 1600); Tonic.say('we don\'t talk about betelgeuse', 1800); }
    $$('.f').forEach(function (b) { b.classList.toggle('on', b.dataset.filter === which); });
    $$('.tree-sub a').forEach(function (a) {
      var t = document.getElementById(a.getAttribute('href').slice(1));
      a.classList.toggle('dim', !!t && t.classList.contains('hide'));
    });
    return shown;
  }
  $$('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { filter(b.dataset.filter); }); });

  /* ── the Lawvics figure: fifty jurisdictions, in batches ──────── */
  function swarm(fig) {
    var grid = $('.swarm', fig);
    for (var i = 0; i < 50; i++) grid.appendChild(document.createElement('i'));
    var cells = $$('i', grid), range = $('input', fig), bn = $('.bn', fig), tally = $('.tally', fig), run = $('.run', fig);
    range.addEventListener('input', function () { bn.textContent = range.value; });
    var running = false;
    function start() {
      if (running) return;
      running = true; run.disabled = true;
      Tonic.mood('read'); Tonic.ripple(true);
      cells.forEach(function (c) { c.className = ''; });
      var ok = 0, sus = 0, batches = Number(range.value), per = Math.ceil(50 / batches), b = 0;
      tally.textContent = 'verified 0 · flagged 0';
      (function nextBatch() {
        if (b >= batches) {
          running = false; run.disabled = false; run.textContent = 'Run it again';
          Tonic.base('idle'); Tonic.ripple(false); Tonic.mood('happy', 1200); Tonic.say(ok + ' verified, ' + sus + ' flagged', 2000);
          return;
        }
        var batch = cells.slice(b * per, (b + 1) * per);
        batch.forEach(function (c) { c.className = 'wait'; });
        b++;
        var j = 0;
        var step = function () {
          if (j >= batch.length) { setTimeout(nextBatch, reduced ? 0 : 120); return; }
          var c = batch[j++];
          var bad = Math.random() < 0.14;
          c.className = bad ? 'sus' : 'ok';
          if (bad) sus++; else ok++;
          tally.textContent = 'verified ' + ok + ' · flagged ' + sus;
          setTimeout(step, reduced ? 0 : 45);
        };
        setTimeout(step, reduced ? 0 : 260);
      })();
    }
    run.addEventListener('click', start);
    return start;
  }
  var runSwarm = null;
  $$('.fig').forEach(function (fig) { runSwarm = swarm(fig); });

  /* ── line numbers, the current line, and the status bar ─────── */
  var LINE = 'h1,h2,h3,h4,p,li,summary,dt,dd,.cta-row,.filters,.fig,.ssh-cta';
  var sbPos = $('#sb-pos'), numbering = 0;
  function numberLines() {
    numbering = 0;
    $$('.buf').forEach(function (buf) {
      var g = $('.gutter', buf);
      if (!g) { g = el('div', 'gutter'); g.setAttribute('aria-hidden', 'true'); buf.appendChild(g); }
      if (!g.getClientRects().length) return;
      var base = buf.getBoundingClientRect().top, rows = [];
      $$(LINE, $('.buf-body', buf)).forEach(function (e) {
        if (e.querySelector(LINE) || !e.getClientRects().length) return;
        rows.push({ e: e, top: e.getBoundingClientRect().top - base });
      });
      rows.sort(function (a, b) { return a.top - b.top; });
      var html = '', n = 0, lastTop = -99;
      rows.forEach(function (r) {
        if (r.top - lastTop > 6) { n++; lastTop = r.top; html += '<span style="top:' + Math.round(r.top) + 'px">' + n + '</span>'; }
        r.e.dataset.ln = n;
      });
      g.innerHTML = html;
    });
  }
  function queueNumbers() { if (!numbering) numbering = requestAnimationFrame(numberLines); }
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(queueNumbers); $$('.buf').forEach(function (b) { ro.observe(b); }); }
  addEventListener('resize', queueNumbers);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueNumbers);
  queueNumbers();

  var curLine = null;
  doc.addEventListener('mouseover', function (e) {
    var l = e.target.closest('[data-ln]');
    if (l === curLine) return;
    if (curLine) curLine.classList.remove('cur');
    curLine = l;
    if (!l) return;
    l.classList.add('cur');
    var buf = l.closest('.buf');
    sbPos.textContent = 'Ln ' + l.dataset.ln + ' · ' + (buf ? buf.dataset.file : '');
  });

  /* ── visitor count: one number, shared with the ssh server ─── */
  // The Go program on ssh.andymsun.com counts ssh sessions; this page asks it
  // for the total and adds itself once per browser per day.
  var API = 'https://ssh.andymsun.com/visits';
  function showVisits(total, you) {
    if (!total) return;
    $('#marq-n').textContent = '#' + String(you || total).padStart(6, '0');
    $('#sb-visits').textContent = total.toLocaleString() + ' visitors';
  }
  (function () {
    var today = new Date().toDateString(), counted = null, you = 0, cached = 0;
    try { counted = localStorage.getItem('counted'); you = Number(localStorage.getItem('you') || 0); cached = Number(localStorage.getItem('total') || 0); } catch (e) {}
    showVisits(cached, you);
    var post = counted !== today;
    fetch(API, { method: post ? 'POST' : 'GET', mode: 'cors' }).then(function (r) { return r.json(); }).then(function (d) {
      if (post && d.you) { you = d.you; try { localStorage.setItem('counted', today); localStorage.setItem('you', String(you)); } catch (e) {} }
      try { localStorage.setItem('total', String(d.total)); } catch (e) {}
      showVisits(d.total, you);
    }).catch(function () { if (!cached) $('#sb-visits').textContent = 'offline'; });
  })();

  /* ── the flashlight, for the yellow dot and `lights` ─────────── */
  var room = $('#room');
  function lightsOff() {
    document.body.classList.add('lights-out'); room.hidden = false;
    room.style.setProperty('--x', innerWidth / 2 + 'px');
    room.style.setProperty('--y', innerHeight / 2 + 'px');
    Tonic.say('who turned off the lights', 2200);
  }
  function lightsOn() { if (room.hidden) return; document.body.classList.remove('lights-out'); room.hidden = true; Tonic.mood('happy', 700); }
  addEventListener('pointermove', function (e) {
    if (room.hidden) return;
    room.style.setProperty('--x', e.clientX + 'px');
    room.style.setProperty('--y', e.clientY + 'px');
  }, { passive: true });
  document.addEventListener('click', function (e) { if (!room.hidden && !e.target.closest('.term, .dots')) lightsOn(); });

  /* ── the agent panel as a sheet, on smaller screens ──────────── */
  var fab = $('#fab');
  function openSheet() { document.body.classList.add('sheet-open'); fab.setAttribute('aria-expanded', 'true'); }
  function closeSheet() { if (!document.body.classList.contains('sheet-open')) return; document.body.classList.remove('sheet-open'); fab.setAttribute('aria-expanded', 'false'); }
  fab.addEventListener('click', function () { if (document.body.classList.contains('sheet-open')) closeSheet(); else openSheet(); });
  $('#agent-close').addEventListener('click', closeSheet);

  var term = $('#term');
  function termRun(c) { term.classList.remove('closed'); return window.Term ? window.Term.run(c) : null; }

  /* ══ panes: drag the dividers, drag the tabs ═════════════════════
     Sizes persist per browser. Double-click a divider to reset it, drag a
     side pane small enough and it folds away (⌘B brings the explorer back). */
  var ide = $('#ide'), panes = { ex: 240, ag: 368, term: 230 }, DEF = { ex: 240, ag: 368, term: 230 };
  try { var savedP = JSON.parse(localStorage.getItem('panes') || '{}'); for (var k in savedP) if (k in panes) panes[k] = savedP[k]; } catch (e) {}
  function applyPanes() {
    ide.style.setProperty('--ex-w', panes.ex + 'px');
    ide.style.setProperty('--ag-w', panes.ag + 'px');
    ide.style.setProperty('--term-h', panes.term + 'px');
    ide.classList.toggle('ex-hidden', panes.ex === 0);
    queueNumbers();
  }
  function savePanes() { try { localStorage.setItem('panes', JSON.stringify(panes)); } catch (e) {} }
  function togglePane(k) { panes[k] = panes[k] ? 0 : DEF[k]; applyPanes(); savePanes(); }
  applyPanes();
  $$('.split').forEach(function (sp) {
    var k = sp.dataset.split;
    sp.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { sp.setPointerCapture(e.pointerId); } catch (x) {}
      document.body.classList.add('resizing', k === 'term' ? 'resizing-v' : 'resizing-h');
      var x0 = e.clientX, y0 = e.clientY, start = panes[k] || (k === 'ex' ? 0 : DEF[k]);
      function move(ev) {
        var v;
        if (k === 'ex') v = start + (ev.clientX - x0);
        else if (k === 'ag') v = start - (ev.clientX - x0);
        else v = start - (ev.clientY - y0);
        if (k === 'ex') v = v < 120 ? 0 : Math.min(420, v);
        if (k === 'ag') v = Math.max(280, Math.min(560, v));
        if (k === 'term') v = Math.max(90, Math.min(innerHeight - 220, v));
        panes[k] = Math.round(v); applyPanes();
      }
      function up() {
        sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing', 'resizing-v', 'resizing-h'); savePanes();
        if (k === 'ex' && panes.ex === 0) { say('Explorer folded. ⌘B brings it back.'); }
      }
      sp.addEventListener('pointermove', move); sp.addEventListener('pointerup', up);
    });
    sp.addEventListener('dblclick', function () { panes[k] = DEF[k]; applyPanes(); savePanes(); });
  });
  $('#title-file').addEventListener('dblclick', function () { togglePane('ex'); });

  // tabs reorder, and the files in the buffer follow them
  var tabBar = $('#tabs'), dragTab = null;
  tabBar.addEventListener('dragstart', function (e) {
    dragTab = e.target.closest('.tab'); if (!dragTab) return;
    dragTab.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragTab.dataset.sec); } catch (x) {}
  });
  tabBar.addEventListener('dragover', function (e) {
    if (!dragTab) return;
    e.preventDefault();
    var over = e.target.closest('.tab');
    if (!over || over === dragTab) return;
    var r = over.getBoundingClientRect();
    tabBar.insertBefore(dragTab, e.clientX < r.left + r.width / 2 ? over : over.nextSibling);
  });
  tabBar.addEventListener('dragend', function () {
    if (!dragTab) return;
    dragTab.classList.remove('dragging');
    var foot = $('.doc-foot', doc);
    $$('.tab', tabBar).forEach(function (t) { doc.insertBefore(document.getElementById(t.dataset.sec), foot); });
    tabs = $$('.tab');
    Tonic.mood('curious', 900); Tonic.say('rearranging the furniture', 1400);
    dragTab = null;
    queueNumbers();
  });

  /* ══ command palette ═════════════════════════════════════════════ */
  var pal = $('#palette'), pin = $('#pal-in'), plist = $('#pal-list'), sel = 0, shown = [];
  var ITEMS = [];
  $$('.tab').forEach(function (t) { ITEMS.push({ label: t.textContent.replace('●', '').trim(), hint: 'file', run: function () { go(t.dataset.sec); } }); });
  $$('.proj').forEach(function (p) {
    ITEMS.push({ label: $('.file', p).textContent, hint: $('.name', p).textContent.trim(), dot: p.dataset.status, run: function () { go(p.id); } });
  });
  [
    ['Toggle light / dark', 'command', toggleTheme],
    ['Copy the ssh command', 'command', function () { copySSH(); }],
    ['Show shipped projects', 'filter', function () { filter('green'); go('projects'); }],
    ['Show projects in progress', 'filter', function () { filter('yellow'); go('projects'); }],
    ['Show abandoned projects', 'filter', function () { filter('red'); go('projects'); }],
    ['Run the Lawvics swarm', 'command', function () { go('p-lawvics'); setTimeout(function () { runSwarm && runSwarm(); }, 500); }],
    ['Agent: Claude Code', 'skin', function () { window.Agent && window.Agent.skin('claude'); }],
    ['Agent: Codex', 'skin', function () { window.Agent && window.Agent.skin('codex'); }],
    ['Agent: Antigravity', 'skin', function () { window.Agent && window.Agent.skin('agy'); }],
    ['Agent: OpenCode', 'skin', function () { window.Agent && window.Agent.skin('opencode'); }],
    ['Focus the terminal', 'command', function () { term.classList.remove('closed'); window.Term && window.Term.focus(); }],
    ['Open the espresso machine', 'file', function () { go('machine'); }],
    ['Let Tonic pull a shot', 'command', function () { window.Machine && window.Machine.auto(); }],
    ['Order an espresso tonic', 'command', function () { Tonic.order && Tonic.order(); }],
    ['Turn the lights off', 'command', lightsOff]
  ].forEach(function (c) { ITEMS.push({ label: c[0], hint: c[1], run: c[2] }); });

  function renderPal() {
    var q = pin.value.trim().toLowerCase();
    shown = ITEMS.filter(function (it) { return !q || (it.label + ' ' + it.hint).toLowerCase().indexOf(q) >= 0; }).slice(0, 12);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    plist.innerHTML = shown.length ? shown.map(function (it, i) {
      return '<li role="option" data-i="' + i + '"' + (i === sel ? ' class="on" aria-selected="true"' : '') + '>' +
        (it.dot ? '<i class="dot-s ' + it.dot + '"></i>' : '<i class="pal-ic">' + (it.hint === 'file' ? '#' : it.hint === 'skin' ? '◐' : '›') + '</i>') +
        '<span>' + esc(it.label) + '</span><span class="pal-hint">' + esc(it.hint) + '</span></li>';
    }).join('') : '<li class="none">No matches. Try “lawvics” or “theme”.</li>';
  }
  function openPal() { pal.hidden = false; pin.value = ''; sel = 0; renderPal(); pin.focus(); Tonic.mood('curious', 900); }
  function closePal() { pal.hidden = true; }
  function choose(i) { var it = shown[i]; closePal(); if (it) it.run(); }
  $('#open-palette').addEventListener('click', openPal);
  pin.addEventListener('input', function () { sel = 0; renderPal(); });
  pin.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); renderPal(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); renderPal(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
  });
  plist.addEventListener('click', function (e) { var li = e.target.closest('li[data-i]'); if (li) choose(Number(li.dataset.i)); });
  pal.addEventListener('click', function (e) { if (e.target === pal) closePal(); });

  addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (pal.hidden) openPal(); else closePal(); }
    else if (e.ctrlKey && e.key === '`') { e.preventDefault(); term.classList.remove('closed'); window.Term && window.Term.focus(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); togglePane('ex'); }
    else if (e.key === 'Escape') { closePal(); lightsOn(); closeSheet(); }
  });

  /* ── arrive at a #link ────────────────────────────────────────── */
  if (location.hash.length > 1) setTimeout(function () { go(decodeURIComponent(location.hash.slice(1))); }, 60);

  window.Site = { go: go, filter: filter, copySSH: copySSH, toggleTheme: toggleTheme, lightsOff: lightsOff, say: say,
    run: termRun,
    swarm: function () { runSwarm && runSwarm(); }, openSheet: openSheet };
})();
