// andymsun.com — the page is plain HTML; this adds behaviour.
// Nothing here is required to read the site: the terminal is a demo, the
// filters and cards are ordinary controls, and every section is already
// in the markup.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var sleep = function (ms) { return reduced ? Promise.resolve() : new Promise(function (r) { setTimeout(r, ms); }); };
  var SSH = 'ssh ssh.andymsun.com';

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
  var copyBtn = $('#copy-ssh');
  if (copyBtn) copyBtn.addEventListener('click', function () { copySSH(copyBtn); });
  $$('.copy-inline').forEach(function (b) { b.addEventListener('click', function () { copySSH(b); }); });

  /* ── theme ────────────────────────────────────────────────────── */
  var root = document.documentElement;
  function currentTheme() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    say(next === 'dark' ? 'Dark' : 'Light');
  }
  $('#theme-btn').addEventListener('click', toggleTheme);

  /* ── sticky header + which section you're in ──────────────────── */
  var topBar = $('.top'), navLinks = $$('.nav a');
  addEventListener('scroll', function () { topBar.classList.toggle('stuck', scrollY > 8); }, { passive: true });
  if ('IntersectionObserver' in window) {
    var sections = navLinks.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ── project filters ──────────────────────────────────────────── */
  var cards = $$('.card'), empty = $('#empty');
  function filter(which) {
    var shown = 0;
    cards.forEach(function (c) {
      var hit = which === 'all' || c.dataset.status === which;
      c.classList.toggle('hide', !hit);
      if (!hit) c.open = false;
      if (hit) shown++;
    });
    $$('.f').forEach(function (b) { b.classList.toggle('on', b.dataset.filter === which); });
    empty.hidden = shown > 0;
  }
  $$('.f').forEach(function (b) { b.addEventListener('click', function () { filter(b.dataset.filter); }); });
  $$('[data-filter]', empty).forEach(function (b) { b.addEventListener('click', function () { filter('all'); }); });

  /* ── the Lawvics figure: fifty jurisdictions, in batches ──────── */
  $$('.fig').forEach(function (fig) {
    var grid = $('.swarm', fig);
    for (var i = 0; i < 50; i++) grid.appendChild(document.createElement('i'));
    var cells = $$('i', grid), range = $('input', fig), bn = $('.bn', fig), tally = $('.tally', fig), run = $('.run', fig);
    range.addEventListener('input', function () { bn.textContent = range.value; });
    var running = false;
    run.addEventListener('click', function () {
      if (running) return;
      running = true; run.disabled = true;
      cells.forEach(function (c) { c.className = ''; });
      var ok = 0, sus = 0, batches = Number(range.value), per = Math.ceil(50 / batches), b = 0;
      tally.textContent = 'verified 0 · flagged 0';
      (function nextBatch() {
        if (b >= batches) { running = false; run.disabled = false; run.textContent = 'Run it again'; return; }
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
    });
  });

  /* ── visitor count (this browser only, and the marquee says so) ─ */
  var visits = 1;
  try { visits = Number(localStorage.getItem('visits') || 0) + 1; localStorage.setItem('visits', String(visits)); } catch (e) {}
  $('#marq-n').textContent = String(visits).padStart(6, '0');

  /* ── the flashlight, for the yellow dot and /lights ───────────── */
  var room = $('#room');
  function lightsOff() {
    document.body.classList.add('lights-out'); room.hidden = false;
    room.style.setProperty('--x', innerWidth / 2 + 'px');
    room.style.setProperty('--y', innerHeight / 2 + 'px');
  }
  function lightsOn() { document.body.classList.remove('lights-out'); room.hidden = true; }
  addEventListener('pointermove', function (e) {
    if (room.hidden) return;
    room.style.setProperty('--x', e.clientX + 'px');
    room.style.setProperty('--y', e.clientY + 'px');
  }, { passive: true });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') lightsOn(); });
  document.addEventListener('click', function (e) { if (!room.hidden && !e.target.closest('.demo')) lightsOn(); });

  /* ══ the terminal demo ═══════════════════════════════════════════
     It plays a short session by itself, then leaves a working prompt.
     Commands that match a section scroll the page there, so the toy and
     the page stay the same portfolio.                                */

  var body = $('#demo-body'), play = $('#demo-play');
  var VERBS = ['Caffeinating', 'Percolating', 'Not sleeping', 'Pondering', 'Brewing', 'Mulling', 'Reticulating'];
  var GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  var playing = false, promptBox, promptInput;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function add(node) { play.appendChild(node); body.scrollTop = body.scrollHeight; return node; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function ticker(fn) {
    return new Promise(function (res) {
      var t0 = performance.now();
      (function tick() { if (fn(performance.now() - t0)) res(); else requestAnimationFrame(tick); })();
    });
  }
  async function stream(node, text) {
    if (reduced) { node.textContent = text; return; }
    var cur = el('span', 'cursor');
    node.appendChild(cur);
    var shown = 0;
    await ticker(function (ms) {
      var n = Math.min(text.length, Math.floor(ms * 0.33));
      if (n > shown) { cur.insertAdjacentText('beforebegin', text.slice(shown, n)); shown = n; body.scrollTop = body.scrollHeight; }
      return shown >= text.length;
    });
    cur.remove();
  }
  async function reply(text, cls) { var n = add(el('p', 'assist ' + (cls || ''))); await stream(n, text); return n; }
  function typed(text) { add(el('p', 'user', esc(text))); }

  async function think(ms) {
    if (reduced) return;
    var n = add(el('p', 'spin', '<span class="g"></span><span class="v"></span>'));
    var g = $('.g', n), v = $('.v', n), verb = VERBS[Math.floor(Math.random() * VERBS.length)], last = -1, tok = 0;
    await ticker(function (t) {
      var step = Math.floor(t / 110);
      if (step !== last) {
        last = step;
        g.textContent = GLYPHS[step % GLYPHS.length];
        tok += Math.floor(Math.random() * 40);
        v.textContent = verb + '… (' + Math.floor(t / 1000) + 's · ↑ ' + tok + ' tokens)';
      }
      return t >= ms;
    });
    n.remove();
  }
  async function toolLine(fn, arg, res, after) {
    var n = add(el('div'));
    n.appendChild(el('p', 'assist ok', '<b>' + esc(fn) + '</b>(<span class="dim">' + esc(arg) + '</span>)'));
    await sleep(320);
    n.appendChild(el('p', 'dim', '⎿  ' + esc(res)));
    if (after) n.appendChild(after);
    body.scrollTop = body.scrollHeight;
    await sleep(160);
  }
  function psTable() {
    var rows = [
      ['running', 'KindEd', 'software engineering intern'],
      ['running', 'CUNY CSI', 'undergraduate researcher'],
      ['running', 'Scale AI', 'prompt engineer, contract'],
      ['running', 'Financial Markets', 'selected cohort member']
    ];
    return el('div', 'ps', rows.map(function (r) {
      return '<span class="on">●</span><span>' + r[0] + '</span><span><b>' + r[1] + '</b> · ' + r[2] + '</span>';
    }).join(''));
  }

  function makePrompt() {
    promptBox = add(el('div', 'prompt-box', '<span>&gt;</span><input type="text" spellcheck="false" aria-label="Try the terminal" />'));
    promptInput = $('input', promptBox);
    promptInput.placeholder = 'type /help, or just keep scrolling';
    promptInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var v = promptInput.value.trim();
      if (!v || playing) return;
      promptInput.value = '';
      runCommand(v);
    });
    promptBox.addEventListener('click', function () { if (promptInput && !promptInput.disabled) promptInput.focus(); });
  }
  function setLive(on) {
    if (!promptBox) return;
    promptBox.classList.toggle('live', on);
    promptInput.disabled = !on;
  }

  function goTo(sel, label) {
    var target = $(sel);
    if (!target) return;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    say('Scrolled to ' + label);
  }

  var COMMANDS = {
    '/help': async function () {
      await reply('These scroll the page, which is where everything actually lives:');
      add(el('div', 'ps',
        [['/now', 'what is running'], ['/projects', 'the work'], ['/experience', 'every role'],
         ['/about', 'who I am'], ['/contact', 'email and links'], ['/ssh', 'copy the real command'],
         ['/coffee', 'brew one'], ['/lights', 'turn them off'], ['/theme', 'light or dark'], ['/clear', 'clear this box']]
          .map(function (r) { return '<span class="on">·</span><span><b>' + r[0] + '</b></span><span>' + r[1] + '</span>'; }).join('')));
      await reply('Or ask me something. I only know about Andy.');
    },
    '/now': async function () { await think(400); await toolLine('Bash', 'ps -o stat,cmd', '10 processes', psTable()); await reply('Four running; the full list is in the Now section.'); goTo('#now', 'Now'); },
    '/projects': async function () { await think(400); await reply('Fourteen of them, with status dots: green shipped, yellow in progress, red abandoned.'); goTo('#work', 'Work'); },
    '/experience': async function () { await think(400); await reply('Every job, research post, cohort, program, and honor.'); goTo('#experience', 'Experience'); },
    '/about': async function () { await reply('Third-year at UChicago, from Flushing, Queens. The long version is below.'); goTo('#about', 'About'); },
    '/contact': async function () { await reply('andy@andymsun.com is fastest.'); goTo('#contact', 'Contact'); },
    '/ssh': async function () { copySSH(); await reply('Copied. Paste it into a real terminal and you get this, but bigger: subagents, three skins, and a coffee machine.'); },
    '/coffee': async function () { await think(700); await reply('☕ Brewed. Context window: 3 cups.', 'ok'); },
    '/lights': async function () { await reply('Lights off. Esc, or a click outside the window, brings them back.'); lightsOff(); },
    '/theme': async function () { toggleTheme(); await reply('Page theme: ' + currentTheme() + '. The terminal stays dark; it is a terminal.'); },
    '/clear': async function () { play.innerHTML = ''; makePrompt(); setLive(true); },
    '/exit': async function () { await reply('That is the thing about websites. There is a tab for it.'); }
  };

  async function chat(text) {
    var t = text.toLowerCase();
    var has = function () { return Array.prototype.some.call(arguments, function (w) { return t.indexOf(w) >= 0; }); };
    await think(700);
    if (has('why ssh', 'ssh?', 'terminal')) return reply('A terminal is the smallest interface there is: no layout engine, no fonts, a grid of cells. Designing for one forces a decision about what matters. This page is the same portfolio with more room.');
    if (has('coffee')) return reply('Load-bearing. My own portfolio makes jokes about it.');
    if (has('badminton')) return reply('Every open gym. Logistics officer for the UChicago club: dues, suppliers, and a live board of who is on which court.');
    if (has('hire', 'job', 'intern', 'resume', 'cv', 'recruit')) return reply('andy@andymsun.com. Third year, graduating June 2028, and I like teams where I own a large part of the outcome.');
    if (has('hello', 'hi ', 'hey', 'yo')) return reply('Hi. This box is a toy; the page around it is the real portfolio. Try /projects.');
    if (has('claude', 'anthropic')) return reply('The prompt box and ⏺ bullets are a homage to the Claude Code CLI. Not affiliated; the content is all mine.');
    return reply('I only know about Andy. Try /projects, or scroll: everything is on this page.');
  }

  async function runCommand(text) {
    playing = true;
    setLive(false);
    typed(text);
    var cmd = text.split(/\s+/)[0].toLowerCase();
    try {
      if (COMMANDS[cmd]) await COMMANDS[cmd]();
      else if (text.charAt(0) === '/') await reply('Unknown command: ' + text + '. /help lists the real ones.');
      else await chat(text);
    } finally {
      playing = false;
      setLive(true);
      if (promptBox) play.appendChild(promptBox);
      body.scrollTop = body.scrollHeight;
    }
  }

  // the opening session, played once
  async function intro() {
    playing = true;
    makePrompt();
    setLive(false);
    await sleep(700);
    typed('who is andy?');
    await think(900);
    await reply('A third-year at the University of Chicago studying computer science and computational & applied mathematics, building interfaces for systems that are otherwise hard to use.');
    await sleep(300);
    typed('/now');
    await think(500);
    await toolLine('Bash', 'ps -o stat,cmd', '10 processes', psTable());
    await reply('…and six more, in the Now section just below.', 'ok');
    playing = false;
    setLive(true);
    play.appendChild(promptBox);
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    play.innerHTML = '';
    intro();
  }
  // play once the demo is actually on screen, so a phone visitor does not miss it
  if ('IntersectionObserver' in window) {
    var demoIO = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { demoIO.disconnect(); start(); }
    }, { threshold: 0.25 });
    demoIO.observe($('.demo'));
  } else start();

  $('#demo-replay').addEventListener('click', function () {
    if (playing) return;
    started = false;
    start();
  });
  $('#demo-type').addEventListener('click', function () {
    $('.demo').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    if (promptInput && !promptInput.disabled) promptInput.focus();
    else say('One moment, it is still talking');
  });
})();
