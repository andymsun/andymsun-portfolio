// The agent panel. Four skins borrowed from four coding agents, one set of
// answers written by Andy in advance. Its tool calls are real in the only
// way that matters here: Read opens the file, Grep filters the list, Bash
// copies the command. Bean thinks while it thinks and reads while it streams.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var Bean = window.Bean, Site = window.Site;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function ticker(fn) {
    return new Promise(function (res) {
      var t0 = performance.now();
      (function tick() { if (fn(performance.now() - t0)) res(); else requestAnimationFrame(tick); })();
    });
  }

  var SKINS = {
    claude:   { name: 'Claude Code', model: 'andy-3 · effort high · 2 cups', place: 'Ask about Andy',
                verbs: ['Caffeinating', 'Percolating', 'Pondering', 'Brewing', 'Mulling', 'Reticulating'] },
    codex:    { name: 'Codex', model: 'andy-3-codex · reasoning high', place: 'Ask Codex about Andy' },
    agy:      { name: 'Antigravity', model: 'Andy 3 · planning mode', place: 'Ask anything about Andy' },
    opencode: { name: 'OpenCode', model: 'build · andy-3', place: 'Ask about Andy (enter to send)' }
  };
  var CLAUDE_GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  var BRAILLE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  var VERB = {
    codex: { Read: 'Read', Grep: 'Search', Bash: 'Ran' },
    agy: { Read: 'Analyzed', Grep: 'Searched', Bash: 'Ran command' }
  };

  var root = document.documentElement, chat = $('#chat'), form = $('#ask'), input = $('#ask-in'), chips = $('#chips');
  var skin = SKINS[root.dataset.skin] ? root.dataset.skin : 'claude';
  var busy = false;

  function scroll() { chat.scrollTop = chat.scrollHeight; }
  function add(node) { chat.appendChild(node); scroll(); return node; }

  /* ── painting: each skin draws the same transcript differently ── */
  function paintTool(n) {
    var fn = n.dataset.fn, arg = esc(n.dataset.arg), res = esc(n.dataset.res);
    if (skin === 'claude') n.innerHTML = '<p><span class="t-b">⏺</span> <b>' + fn + '</b>(' + arg + ')</p><p class="t-r">⎿&nbsp; ' + res + '</p>';
    else if (skin === 'codex') n.innerHTML = '<p><span class="t-b">•</span> <b>' + VERB.codex[fn] + '</b> ' + arg + '</p><p class="t-r">└ ' + res + '</p>';
    else if (skin === 'agy') n.innerHTML = '<p><span class="t-ic">◇</span> ' + VERB.agy[fn] + ' <span class="chipf">' + arg + '</span></p><p class="t-r">' + res + '</p>';
    else n.innerHTML = '<p><span class="t-b">→</span> <b>' + fn + '</b> ' + arg + ' <span class="t-r">' + res + '</span></p>';
  }
  function paintHead(n) {
    n.textContent = skin === 'codex' ? 'codex' : skin === 'opencode' ? '▣ Build · andy-3' : '';
  }
  function repaint() { $$('.m-tool', chat).forEach(paintTool); $$('.m-head', chat).forEach(paintHead); }

  function setSkin(key, quiet) {
    if (!SKINS[key]) return;
    var changed = key !== skin;
    skin = key;
    root.dataset.skin = key;
    try { localStorage.setItem('skin', key); } catch (e) {}
    $$('.skins button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.skin === key)); });
    $('#model-label').textContent = SKINS[key].model;
    $('#sb-skin').textContent = SKINS[key].name;
    input.placeholder = SKINS[key].place;
    repaint();
    Bean.skin(key);
    if (changed && !quiet) {
      add(el('p', 'm m-sys', 'switched to ' + SKINS[key].name + ' · same Andy underneath'));
      Bean.mood('happy', 900);
      Bean.say({ claude: 'cozy.', codex: 'terse mode.', agy: 'look, I float', opencode: 'boxy. I like it.' }[key], 1500);
    }
  }
  $$('.skins button').forEach(function (b) { b.addEventListener('click', function () { setSkin(b.dataset.skin); }); });

  /* ── the primitives ───────────────────────────────────────────── */
  var turnHead = null;
  function head() {
    if (turnHead) return;
    turnHead = add(el('p', 'm-head'));
    paintHead(turnHead);
  }
  function user(text) { turnHead = null; add(el('div', 'm m-user', '<p>' + esc(text) + '</p>')); }

  async function think(ms) {
    head();
    Bean.mood('think'); Bean.ripple(true);
    var n = add(el('p', 'm m-spin')), verb = SKINS.claude.verbs[Math.floor(Math.random() * SKINS.claude.verbs.length)];
    ms = reduced ? 0 : ms;
    await ticker(function (t) {
      var i = Math.floor(t / 110), secs = Math.max(1, Math.round(t / 1000));
      if (skin === 'claude') n.innerHTML = '<span class="g">' + CLAUDE_GLYPHS[i % CLAUDE_GLYPHS.length] + '</span> <span class="v">' + verb + '…</span> <span class="dim">(esc to interrupt)</span>';
      else if (skin === 'codex') n.innerHTML = '<span class="shimmer">Working</span> <span class="dim">(' + secs + 's • esc to interrupt)</span>';
      else if (skin === 'agy') n.innerHTML = '<span class="shimmer">Thinking</span>';
      else n.innerHTML = '<span class="g">' + BRAILLE[i % BRAILLE.length] + '</span> <span class="v">working</span>';
      return t >= ms;
    });
    n.remove();
    add(el('p', 'm m-thought', 'Thought for ' + Math.max(1, Math.round(ms / 1000)) + 's'));
    Bean.ripple(false); Bean.base('idle');
  }

  async function tool(fn, arg, res, act) {
    head();
    var n = el('div', 'm m-tool');
    n.dataset.fn = fn; n.dataset.arg = arg; n.dataset.res = '…';
    paintTool(n); add(n);
    await new Promise(function (r) { setTimeout(r, reduced ? 0 : 380); });
    if (act) act();
    n.dataset.res = res; paintTool(n);
  }

  async function reply(html) {
    head();
    var n = add(el('div', 'm m-say', '<p></p>')), p = n.firstChild;
    var plain = html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
    Bean.mood('read');
    var shown = 0;
    if (!reduced) {
      await ticker(function (t) {
        var k = Math.min(plain.length, Math.floor(t / 7));
        if (k !== shown) { shown = k; p.textContent = plain.slice(0, k); scroll(); }
        return k >= plain.length;
      });
    }
    p.innerHTML = html;
    scroll();
    Bean.base('idle');
    Bean.mood('happy', 700);
  }

  /* ── the answers ──────────────────────────────────────────────── */
  var FLOWS = {
    who: ['Who is Andy?', async function () {
      await think(800);
      await tool('Read', 'README.md', 'Read 14 lines', function () { Site.go('readme'); });
      await reply('A third-year at the University of Chicago studying computer science and applied math, from Flushing, Queens. He works on human–computer interaction: making capable systems usable by people who didn\'t build them. This window is one of those systems.');
    }],
    now: ['What\'s he working on?', async function () {
      await think(700);
      await tool('Read', 'now.log', '7 running, 3 finished', function () { Site.go('now'); });
      await reply('Three big ones. Real-time portals at <b>KindEd</b> (Django Channels, WebSockets, Redis). Span-aware mixture-of-agents research at <b>CUNY College of Staten Island</b>. Contract red-teaming of pre-release models at <b>Scale AI</b>. Plus the Financial Markets Program, badminton logistics, sshfolio, and pSiren.');
    }],
    shipped: ['Show what\'s shipped', async function () {
      await think(600);
      await tool('Grep', '"status: shipped" projects/', '8 files', function () { Site.filter('green'); Site.go('projects'); });
      await reply('Eight shipped or active: Lawvics, Rivendell, sshfolio, Spore in Space, Cupboard Companion, IMC Prosperity 4, UChicago Badminton, and Sprout. I filtered the list; the <b>All</b> button puts the other six back.');
    }],
    best: ['Best project?', async function () {
      await think(900);
      await tool('Read', 'projects/lawvics.md', 'Read 22 lines', function () { Site.go('p-lawvics'); });
      await reply('Lawvics. One legal question becomes fifty state searches, run in batches, with a second agent auditing every answer for citation format and repealed statutes. Built in under 48 hours; hackathon finalist. I\'m running its figure for you now.');
      Site.swarm();
    }],
    hire: ['How do I reach him?', async function () {
      await think(500);
      await tool('Read', 'contact.md', 'Read 6 lines', function () { Site.go('contact'); });
      await reply('Email is fastest: <a href="mailto:andy@andymsun.com">andy@andymsun.com</a>. He\'s a third-year graduating June 2028, and likes teams where he owns a large part of the outcome. GitHub and LinkedIn are in contact.md.');
    }],
    ssh: ['How do I ssh in?', async function () {
      await think(500);
      await tool('Bash', 'echo "ssh ssh.andymsun.com" | pbcopy', 'copied to clipboard', function () { Site.copySSH(); });
      await reply('Copied. Paste it into any terminal and you get this portfolio as a program: slash commands, subagents, three skins, and a coffee machine. No account, nothing to install. The terminal panel is playing a preview.');
      Site.run('ssh ssh.andymsun.com');
    }],
    coffee: ['Brew a coffee', async function () {
      await think(600);
      await tool('Bash', 'brew install coffee', '☕ 1 cup poured', function () { Bean.brew(); });
      await reply('Brewed. Context window: 3 cups. Andy runs on roughly the same fuel.');
      Bean.say('☕ mmm', 1600);
    }]
  };
  function findIn(sel, words) {
    var hit = null;
    $$(sel).some(function (n) {
      var txt = n.textContent.toLowerCase();
      if (words.some(function (w) { return w.length > 2 && txt.indexOf(w) >= 0; })) { hit = n; return true; }
      return false;
    });
    return hit;
  }

  async function freeform(text) {
    var t = text.toLowerCase(), words = t.split(/[^a-z0-9.]+/).filter(Boolean);
    var has = function () { return Array.prototype.some.call(arguments, function (w) { return t.indexOf(w) >= 0; }); };

    if (has('claude', 'codex', 'antigravity', 'opencode', ' agy') && has('switch', 'use', 'be ', 'skin', 'mode')) {
      var k = has('codex') ? 'codex' : has('antigravity', 'agy') ? 'agy' : has('opencode') ? 'opencode' : 'claude';
      setSkin(k); return;
    }
    if (has('outlier')) {
      await think(500);
      await tool('Grep', '"Outlier" experience.md', '1 match, renamed', function () { Site.go('x-scale'); });
      return reply('That one is Scale AI now. Same contract work: red-teaming pre-release models, 50+ critical failures catalogued. The diff is still showing in experience.md.');
    }
    // a project by name
    var proj = null;
    $$('.proj').some(function (p) {
      var name = $('.name', p).textContent.trim().toLowerCase(), file = $('.file', p).textContent.toLowerCase().replace(/\.[a-z]+$/, '');
      if (t.indexOf(name) >= 0 || words.indexOf(file) >= 0 || (name.split(' ')[0].length > 4 && t.indexOf(name.split(' ')[0]) >= 0)) { proj = p; return true; }
      return false;
    });
    if (proj) {
      await think(600);
      var file = $('.file', proj).textContent;
      await tool('Read', 'projects/' + file, 'Read ' + (12 + $('.body', proj).textContent.length % 20) + ' lines', function () { Site.go(proj.id); });
      var status = { green: 'Shipped', yellow: 'Still in progress', red: 'Abandoned' }[proj.dataset.status];
      return reply('<b>' + esc($('.name', proj).textContent.trim()) + '</b>: ' + esc($('.blurb', proj).textContent) + ' ' + status + '. ' + esc($('.body p', proj).textContent.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')));
    }
    // a job, school, or program by name
    var xp = findIn('.xp-list > li', words.filter(function (w) { return ['the', 'and', 'what', 'did', 'does', 'andy', 'about', 'tell', 'with', 'work', 'job'].indexOf(w) < 0; }));
    if (xp && has('kinded', 'scale', 'carelumi', 'lawbandit', 'tiptop', 'cuny', 'staten', 'goldman', 'trott', 'chicago', 'uchicago', 'queens', 'financial', 'metcalf', 'questbridge', 'trek', 'nypd', 'model united')) {
      await think(600);
      var h = $('h4', xp).cloneNode(true); $$('.diff-del', h).forEach(function (d) { d.remove(); });
      await tool('Grep', '"' + h.childNodes[0].textContent.trim().split(' ')[0] + '" experience.md', '1 match', function () {
        if (!xp.id) xp.id = 'x-' + Math.random().toString(36).slice(2, 7);
        Site.go(xp.id);
      });
      return reply('<b>' + esc(h.textContent.replace(/\s+/g, ' ').trim()) + '</b>, ' + esc($('.xp-when', xp).textContent) + '. ' + esc($('p', xp).textContent));
    }
    if (has('who', 'about him', 'tell me about')) return FLOWS.who[1]();
    if (has('now', 'working on', 'doing', 'current')) return FLOWS.now[1]();
    if (has('ship', 'done', 'finished', 'built')) return FLOWS.shipped[1]();
    if (has('best', 'favorite', 'favourite', 'proud', 'impressive')) return FLOWS.best[1]();
    if (has('hire', 'contact', 'email', 'intern', 'resume', 'cv', 'reach', 'recruit', 'looking')) return FLOWS.hire[1]();
    if (has('why ssh', 'terminal', 'tui')) {
      await think(700);
      return reply('A terminal is the smallest interface there is: no layout engine, no fonts, a grid of cells. Designing for one forces a decision about what matters. That\'s why the portfolio exists twice, here and on port 22.');
    }
    if (has('ssh')) return FLOWS.ssh[1]();
    if (has('coffee', 'brew', 'latte', 'espresso')) return FLOWS.coffee[1]();
    if (has('experience', 'history', 'career', 'jobs')) {
      await think(500);
      await tool('Read', 'experience.md', 'Read 31 lines', function () { Site.go('experience'); });
      return reply('Five internships and contracts since 2025 (KindEd, TipTop, LawBandit, Scale AI, CareLumi), one research post, two schools, and the older groups folded below them.');
    }
    if (has('skill', 'language', 'stack', 'know', 'tech')) {
      await think(500);
      await tool('Read', 'about.md', 'Read 12 lines', function () { Site.go('about'); });
      return reply('Python, TypeScript, Go, Swift, C, and R. React and Next.js, Django and Channels on the web side; AWS, GCP, Docker, Redis, and Postgres underneath. On the model side: evaluation, red-teaming, multi-agent systems, fine-tuning.');
    }
    if (has('badminton')) { await think(500); return reply('Every open gym. He\'s logistics officer for the UChicago club: dues, suppliers, a regional tournament, and a live board of who is on which court.'); }
    if (has('bean', 'mascot', 'you')) { await think(400); Bean.hop(18); return reply('I\'m Bean: a ring of 28 points on springs, two eyes, and no opinions about anything except Andy. Drag me if you like.'); }
    if (has('hello', 'hi', 'hey', 'yo', 'sup')) { await think(300); Bean.hop(14); return reply('Hi. I only know about one person. The buttons below are the quick way in.'); }
    await think(600);
    return reply('I only know about Andy. Try a project by name (say, “Rivendell”), a company (“KindEd”), or one of the buttons.');
  }

  // one turn at a time; a click during a turn waits its go
  var queue = Promise.resolve();
  function ask(text, flow) {
    queue = queue.then(async function () {
      busy = true;
      chips.classList.add('busy');
      user(text);
      try { if (flow) await flow(); else await freeform(text); }
      catch (e) { console.error(e); }
      finally { busy = false; chips.classList.remove('busy'); }
    });
    return queue;
  }

  chips.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ask]');
    if (!b) return;
    var f = FLOWS[b.dataset.ask];
    ask(f[0], f[1]);
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v) return;
    input.value = '';
    ask(v);
  });

  /* ── hello ────────────────────────────────────────────────────── */
  setSkin(skin, true);
  queue = queue.then(function () { return new Promise(function (r) { setTimeout(r, reduced ? 0 : 700); }); }).then(async function () {
    turnHead = null;
    await reply('Hi, I\'m Bean. I only know about Andy. Ask with a button, type a question, or poke me.');
    Bean.say('hi!', 1500);
    Bean.hop(14);
  });

  window.Agent = { skin: setSkin, ask: function (k) { var f = FLOWS[k]; if (f) ask(f[0], f[1]); } };
})();
