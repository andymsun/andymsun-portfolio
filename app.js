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
  var Bean = window.Bean || { mood: noop, base: noop, ripple: noop, say: noop, hop: noop, brew: noop, lookAt: noop, skin: noop };
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
    Bean.mood('happy', 1200); Bean.hop(14);
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
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    Bean.mood(next === 'light' ? 'angry' : 'happy', 900);
    Bean.say(next === 'light' ? 'bright!' : 'ahh, better', 1200);
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
    if (Bean.quiet) Bean.quiet(1500);
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
  function setActive(id, file) {
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
      Bean.mood('read'); Bean.ripple(true);
      cells.forEach(function (c) { c.className = ''; });
      var ok = 0, sus = 0, batches = Number(range.value), per = Math.ceil(50 / batches), b = 0;
      tally.textContent = 'verified 0 · flagged 0';
      (function nextBatch() {
        if (b >= batches) {
          running = false; run.disabled = false; run.textContent = 'Run it again';
          Bean.base('idle'); Bean.ripple(false); Bean.mood('happy', 1200); Bean.say(ok + ' verified, ' + sus + ' flagged', 2000);
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

  /* ── visitor count (this browser only, and it says so) ───────── */
  var visits = 1;
  try { visits = Number(localStorage.getItem('visits') || 0) + 1; localStorage.setItem('visits', String(visits)); } catch (e) {}
  $('#marq-n').textContent = String(visits).padStart(6, '0');
  $('#sb-visits').textContent = 'visit ' + visits + (visits === 1 ? '' : ' from this browser');

  /* ── the flashlight, for the yellow dot and `lights` ─────────── */
  var room = $('#room');
  function lightsOff() {
    document.body.classList.add('lights-out'); room.hidden = false;
    room.style.setProperty('--x', innerWidth / 2 + 'px');
    room.style.setProperty('--y', innerHeight / 2 + 'px');
    Bean.say('who turned off the lights', 2200);
  }
  function lightsOn() { if (room.hidden) return; document.body.classList.remove('lights-out'); room.hidden = true; Bean.mood('happy', 700); }
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

  /* ══ the terminal panel ═══════════════════════════════════════════
     A friendly shell with a handful of real-feeling commands. `ssh` plays a
     preview of the program on port 22; everything else moves this page. */
  var term = $('#term'), tb = $('#term-body'), tform = $('#term-form'), tin = $('#term-in'), out = null, busy = false;
  var hist = [], hi = 0;

  function block(cmd) {
    var b = el('div', 'blk');
    b.innerHTML = '<div class="blk-cmd"><span class="ps-dir">~/andymsun.com</span><span class="ps-branch">agent</span><span class="cmd">' + esc(cmd) + '</span></div>';
    out = el('div', 'blk-out');
    b.appendChild(out);
    tb.appendChild(b);
    tb.scrollTop = tb.scrollHeight;
  }
  function print(html, cls) { var d = el('div', 'tl' + (cls ? ' ' + cls : ''), html); out.appendChild(d); tb.scrollTop = tb.scrollHeight; return d; }

  var FILES = {
    'readme.md': 'readme', 'readme': 'readme', 'now.log': 'now', 'now': 'now', 'projects': 'projects', 'projects/': 'projects',
    'experience.md': 'experience', 'experience': 'experience', 'about.md': 'about', 'about': 'about', 'contact.md': 'contact', 'contact': 'contact'
  };
  $$('.proj').forEach(function (p) {
    var file = $('.file', p).textContent.toLowerCase(), name = $('.name', p).textContent.trim().toLowerCase();
    FILES[file] = p.id; FILES['projects/' + file] = p.id; FILES[name] = p.id; FILES[file.replace(/\.[a-z]+$/, '')] = p.id;
  });
  function resolve(arg) { return FILES[(arg || '').toLowerCase().replace(/^\.\//, '')]; }

  var CUP = '<span class="steam">   ) ) )\n   ( ( (</span>\n ▗▟█████▙▖\n ▐███████▌▙\n ▝▜█████▛▘▛\n  ▀▀▀▀▀▀▀';

  var CMDS = {
    help: function () {
      print('<div class="help">' + [
        ['ssh ssh.andymsun.com', 'a preview of the real thing'], ['ls [projects]', 'list files'], ['open &lt;file&gt;', 'jump to a file, e.g. open lawvics'],
        ['git status', 'what changed'], ['git log', 'the career, as commits'], ['claude · codex · agy · opencode', 'swap the agent panel'],
        ['coffee', 'brew one'], ['lights', 'turn them off'], ['theme', 'light or dark'], ['clear', 'clear this panel']
      ].map(function (r) { return '<span class="k">' + r[0] + '</span><span>' + r[1] + '</span>'; }).join('') + '</div>');
    },
    ls: function (a) {
      if (a[0] && /^projects\/?$/.test(a[0])) {
        print($$('.proj').map(function (p) {
          return '<span class="ls-item"><i class="dot-s ' + p.dataset.status + '"></i>' + esc($('.file', p).textContent) + '</span>';
        }).join(''), 'ls');
        return;
      }
      print('<span class="ls-item f-md">README.md</span><span class="ls-item f-log">now.log</span><span class="ls-item f-dir">projects/</span><span class="ls-item f-md">experience.md</span><span class="ls-item f-md">about.md</span><span class="ls-item f-md">contact.md</span>', 'ls');
    },
    open: function (a) {
      var id = resolve(a.join(' '));
      if (!a.length) return print('open what? try <b>open lawvics</b>', 'dim');
      if (!id) return print('no such file: ' + esc(a.join(' ')) + '. <b>ls</b> shows what is here.', 'err');
      go(id); print('opened ' + esc(a.join(' ')), 'dim');
    },
    pwd: function () { print('/home/andy/andymsun.com'); },
    cd: function () { print('you are already home.', 'dim'); },
    whoami: function () { print('a visitor. andy is in README.md.'); },
    echo: function (a) { print(esc(a.join(' '))); },
    git: function (a) {
      if (a[0] === 'status') {
        print('On branch <b class="acc">agent</b>\nChanges not staged for commit:\n  <span class="m">modified:   experience.md</span>  <span class="dim">(Outlier AI → Scale AI)</span>\n\n<span class="dim">14 projects: </span><i class="dot-s green"></i> 8 shipped  <i class="dot-s yellow"></i> 5 in progress  <i class="dot-s red"></i> 1 abandoned', 'pre');
      } else if (a[0] === 'log') {
        print([
          ['e41b0c2', '2026-06', 'join TipTop Technologies through Metcalf'],
          ['9a07d1f', '2026-05', 'start research at CUNY College of Staten Island'],
          ['c3f2a88', '2026-03', 'join KindEd and LawBandit, same month'],
          ['71de4b0', '2026-02', 'ship Lawvics in 48 hours, finalist'],
          ['5b9e113', '2025-09', 'join CareLumi'],
          ['2d4c7aa', '2025-05', 'start contract work at Scale AI'],
          ['0f1e9d3', '2024-09', 'move to Chicago'],
          ['0000001', '2020-09', 'initial commit: Queens High School for the Sciences']
        ].map(function (c) { return '<span class="sha">' + c[0] + '</span> <span class="dim">' + c[1] + '</span>  ' + c[2]; }).join('\n'), 'pre');
      } else if (a[0] === 'push') {
        print('Everything up-to-date. (Andy pushes from his own laptop.)', 'dim');
      } else print('git ' + esc(a.join(' ')) + ': try <b>git status</b> or <b>git log</b>', 'dim');
    },
    ssh: async function (a) {
      var host = (a.join(' ') || '').replace(/^[^@]*@/, '');
      if (host && host !== 'ssh.andymsun.com' && host !== 'andymsun.com') return print('ssh: Could not resolve hostname ' + esc(host) + '. There is only one host here.', 'err');
      print('Connecting to ssh.andymsun.com…', 'dim');
      await wait(500);
      print('Connected to ssh.andymsun.com (178.156.231.94), port 22.', 'dim');
      await wait(250);
      print('<div class="welcome"><pre class="cup" aria-hidden="true">' + CUP + '</pre><div><p><span class="star">✻</span> Welcome to <b>andy code</b></p><p class="dim">/help for help, /now for what is running</p><p class="dim">model: andy-3 (third year) · context: 2 cups</p></div></div>');
      await wait(200);
      print('This is a preview in your browser. The real program has slash commands, subagents, three skins, and a coffee machine. <button type="button" class="linkish" data-copy>Copy the command</button> and paste it into any terminal.', 'note');
      Bean.mood('happy', 1200);
    },
    coffee: async function () {
      Bean.brew(); Bean.mood('happy', 2000); Bean.say('☕ thank you', 1800);
      print('brewing…', 'dim'); await wait(700);
      print('<pre class="cup">' + CUP + '</pre>', '');
      print('Context window: 3 cups.', 'ok');
    },
    lights: function () { print('lights off. click anywhere outside this panel to bring them back.', 'dim'); lightsOff(); },
    theme: function () { print('theme: ' + toggleTheme()); },
    clear: function () { tb.innerHTML = ''; out = null; },
    exit: function () { print('That is the thing about websites. There is a tab for it.', 'dim'); },
    sudo: function () { print('andy is not in the sudoers file. This incident will be reported to Bean.', 'err'); Bean.mood('angry', 1600); Bean.say('reported.', 1400); },
    bean: function () { Bean.hop(20); Bean.mood('happy', 1000); Bean.say('hi!', 1200); print('Bean waves from the agent panel.', 'dim'); },
    vim: function () { print('You are already in an editor. Esc :q! will not save you here.', 'dim'); },
    rm: function () { print('rm: refusing to delete a portfolio. It took a while.', 'err'); Bean.mood('surprised', 1200); }
  };
  CMDS.cat = CMDS.open; CMDS.ll = CMDS.ls; CMDS.brew = CMDS.coffee; CMDS.nvim = CMDS.vim; CMDS.emacs = CMDS.vim;
  ['claude', 'codex', 'agy', 'opencode', 'antigravity'].forEach(function (k) {
    CMDS[k] = function () {
      var key = k === 'antigravity' ? 'agy' : k;
      if (window.Agent) window.Agent.skin(key);
      print('agent panel → <b>' + ({ claude: 'Claude Code', codex: 'Codex', agy: 'Antigravity', opencode: 'OpenCode' })[key] + '</b>', 'dim');
    };
  });

  async function run(line) {
    line = line.trim();
    if (!line) return;
    busy = true;
    hist.push(line); hi = hist.length;
    block(line);
    var parts = line.split(/\s+/), cmd = parts[0].toLowerCase(), args = parts.slice(1);
    try {
      if (CMDS[cmd]) await CMDS[cmd](args);
      else if (cmd.charAt(0) === '/') print('Slash commands live in the real program. Here, try <b>help</b>.', 'dim');
      else if (resolve(line)) { go(resolve(line)); print('opened ' + esc(line), 'dim'); }
      else print('zsh: command not found: ' + esc(cmd) + '. <b>help</b> lists what works.', 'err');
    } finally { busy = false; }
  }

  tform.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var v = tin.value; tin.value = '';
    intro.cancel = true;
    run(v);
  });
  tin.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); tin.value = hist[hi]; }
    else if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); hi = Math.min(hist.length, hi + 1); tin.value = hist[hi] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      var v = tin.value, sp = v.lastIndexOf(' ') + 1, word = v.slice(sp).toLowerCase();
      var pool = sp === 0 ? Object.keys(CMDS) : Object.keys(FILES).filter(function (k) { return /\.|\/$/.test(k); });
      var hits = pool.filter(function (k) { return k.indexOf(word) === 0; });
      if (hits.length === 1) tin.value = v.slice(0, sp) + hits[0] + (sp === 0 ? ' ' : '');
      else if (hits.length > 1) { block(v); print(hits.join('  '), 'dim'); }
    }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); CMDS.clear(); }
  });
  tin.addEventListener('focus', function () { intro.cancel = true; });
  tb.addEventListener('click', function (e) { if (!e.target.closest('button, a') && !getSelection().toString()) tin.focus(); });

  $('#term-toggle').addEventListener('click', function () {
    var closed = term.classList.toggle('closed');
    this.setAttribute('aria-expanded', String(!closed));
    this.setAttribute('aria-label', closed ? 'Expand terminal' : 'Collapse terminal');
  });

  // the panel types its own first command once it is on screen
  async function intro() {
    var text = SSH;
    for (var i = 1; i <= text.length; i++) {
      if (intro.cancel) { tin.value = ''; return; }
      tin.value = text.slice(0, i);
      await wait(38 + Math.random() * 40);
    }
    await wait(250);
    if (intro.cancel) { tin.value = ''; return; }
    tin.value = '';
    await run(text);
  }
  if ('IntersectionObserver' in window && !reduced) {
    var tio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { tio.disconnect(); setTimeout(intro, 900); } }, { threshold: 0.4 });
    tio.observe(term);
  } else run(SSH);

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
    ['Focus the terminal', 'command', function () { term.classList.remove('closed'); tin.focus(); }],
    ['Brew a coffee', 'command', function () { run('coffee'); }],
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
  function openPal() { pal.hidden = false; pin.value = ''; sel = 0; renderPal(); pin.focus(); Bean.mood('curious', 900); }
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
    else if (e.ctrlKey && e.key === '`') { e.preventDefault(); term.classList.remove('closed'); tin.focus(); }
    else if (e.key === 'Escape') { closePal(); lightsOn(); closeSheet(); }
  });

  /* ── arrive at a #link ────────────────────────────────────────── */
  if (location.hash.length > 1) setTimeout(function () { go(decodeURIComponent(location.hash.slice(1))); }, 60);

  window.Site = { go: go, filter: filter, copySSH: copySSH, toggleTheme: toggleTheme, lightsOff: lightsOff, say: say,
    run: function (c) { term.classList.remove('closed'); intro.cancel = true; return run(c); },
    swarm: function () { runSwarm && runSwarm(); }, openSheet: openSheet };
})();
