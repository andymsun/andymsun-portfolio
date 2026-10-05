// The terminal panel: a small shell that behaves like one. An inline prompt
// with a block cursor, readline keys, history, tab completion, and a
// filesystem built from the page itself, so `cat README.md` prints what you
// are reading and `grep -i redis` finds it. `curl` and `ping` reach the real
// server; `ssh ssh.andymsun.com` opens a replica of the program on port 22.
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  var wait = function (ms) { return reduced ? Promise.resolve() : new Promise(function (r) { setTimeout(r, ms); }); };
  var Site = window.Site, Tonic = window.Tonic;
  var HOST = 'ssh.andymsun.com', API = 'https://ssh.andymsun.com/visits';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function txt(n) { return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }

  var term = $('#term'), screen = $('#screen'), back = $('#scrollback'), live = $('#live'), promptEl = $('#prompt');
  var typedEl = $('#typed'), cursorEl = $('#cursor'), afterEl = $('#after'), input = $('#term-in'), titleEl = $('#term-title');

  /* ══ the filesystem, read off the page ═══════════════════════════ */
  var HOME = '/home/andy', ROOT = HOME + '/andymsun.com';
  function md(sec) {
    var body = $('.buf-body', document.getElementById(sec)), out = [];
    $$('h1, h2, h3, h4, p, li, dt', body).forEach(function (n) {
      if (n.closest('.proj, .fig, .filters, .stats, .xp-list li p, .contact li span')) return;
      if (n.tagName === 'LI' && n.querySelector('h4')) return;
      var t = n.tagName;
      if (t === 'H1') out.push('# ' + txt(n), '');
      else if (t === 'H2') out.push('## ' + txt(n), '');
      else if (t === 'H3') out.push('', '### ' + txt(n));
      else if (t === 'H4') {
        var li = n.closest('li'), h = n.cloneNode(true);
        $$('.diff-del', h).forEach(function (d) { d.remove(); });
        out.push('- ' + txt($('.xp-when', li)).padEnd(20) + txt(h) + (n.querySelector('.diff-del') ? '   <!-- was Outlier AI -->' : ''));
        var p = $('p', li); if (p) out.push('  ' + txt(p));
      }
      else if (t === 'DT') out.push(txt(n).padEnd(16) + txt(n.nextElementSibling));
      else if (t === 'LI') out.push('- ' + txt(n));
      else if (n.classList.contains('kicker')) out.push('> ' + txt(n), '');
      else out.push(txt(n), '');
    });
    if (sec === 'readme') out.push('$ ssh ssh.andymsun.com', '');
    if (sec === 'contact') { out.length = 0; out.push('## Contact', ''); $$('.contact li', body).forEach(function (li) { out.push(txt($('.k', li)).padEnd(10) + txt(li).replace(txt($('.k', li)), '').replace(/Copy$/, '').trim()); }); }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function nowLog() {
    return $$('#now .proc li').map(function (li) {
      var st = li.classList.contains('done') ? 'done  ' : li.dataset.status === 'yellow' ? 'paused' : 'active';
      return '[' + st + '] ' + txt($('.when', li)).padEnd(12) + txt($('.tag', li)).padEnd(9) + txt($('strong', li)) + ' · ' + txt($('.note', li));
    }).join('\n') + '\n';
  }
  function projFile(p) {
    var st = { green: 'shipped', yellow: 'in progress', red: 'abandoned' }[p.dataset.status];
    var lines = ['# ' + txt($('.name', p)), '', txt($('.blurb', p)), '', 'status: ' + st + ' · ' + txt($('.year', p)).split(' · ')[0], ''];
    $$('.body > p:not(.stack):not(.links)', p).forEach(function (q) { lines.push(txt(q), ''); });
    var stack = $('.stack', p); if (stack) lines.push('stack: ' + txt(stack));
    $$('.links a', p).forEach(function (a) { lines.push(txt(a).toLowerCase() + ': ' + a.href); });
    return lines.join('\n').trim() + '\n';
  }
  function file(text, sec) { return { type: 'file', text: text, sec: sec }; }
  var projects = { type: 'dir', children: {} };
  $$('.proj').forEach(function (p) { projects.children[txt($('.file', p))] = file(function () { return projFile(p); }, p.id); });
  var hist = [];
  try { hist = JSON.parse(localStorage.getItem('zsh_history') || '[]'); } catch (e) {}
  var FS = { type: 'dir', children: {
    home: { type: 'dir', children: { andy: { type: 'dir', children: {
      'andymsun.com': { type: 'dir', children: {
        'README.md': file(function () { return md('readme'); }, 'readme'),
        'now.log': file(nowLog, 'now'),
        'projects': projects,
        'experience.md': file(function () { return md('experience'); }, 'experience'),
        'about.md': file(function () { return md('about'); }, 'about'),
        'contact.md': file(function () { return md('contact'); }, 'contact'),
        '.coffee': file('espresso tonic\n  1. a glass of ice\n  2. tonic water, three quarters full\n  3. a double shot, poured slowly over the back of a spoon\n  4. do not stir. watch it layer.\n\n(andy\'s order. try typing "tonic" anywhere on the page.)\n'),
        '.ssh': { type: 'dir', children: { config: file('Host andy\n  HostName ssh.andymsun.com\n  Port 22\n  # no key needed. anyone may connect.\n') } },
        '.zsh_history': file(function () { return hist.join('\n') + '\n'; })
      } },
      'sshfolio': { type: 'dir', children: {
        'main.go': file('package main\n\n// the real thing is on port 22.\n// ssh ssh.andymsun.com\n\nfunc main() { app.RunSSHTUI("0.0.0.0", "22") }\n'),
        'README.md': file('# sshfolio\n\nThis portfolio as a Go program you ssh into: bubbletea, wish, lipgloss.\nSource: https://github.com/andymsun/andymsun-portfolio\n')
      } },
      'todo.txt': file('- [x] rebuild the website as an editor\n- [x] name the mascot after a drink\n- [ ] sleep\n- [ ] another espresso tonic\n')
    } } } }
  } };

  function norm(path, base) {
    if (!path) return base;
    if (path === '~') return HOME;
    if (path.charAt(0) === '~') path = HOME + path.slice(1);
    var parts = (path.charAt(0) === '/' ? path : base + '/' + path).split('/'), out = [];
    parts.forEach(function (p) { if (!p || p === '.') return; if (p === '..') out.pop(); else out.push(p); });
    return '/' + out.join('/');
  }
  function node(abs) {
    var n = FS, parts = abs.split('/').filter(Boolean);
    for (var i = 0; i < parts.length; i++) { if (!n || n.type !== 'dir') return null; n = n.children[parts[i]]; }
    return n || null;
  }
  function read(n) { return typeof n.text === 'function' ? n.text() : n.text; }
  function pretty(abs) { return abs === HOME ? '~' : abs.indexOf(HOME + '/') === 0 ? '~' + abs.slice(HOME.length) : abs; }

  /* ══ the screen ═══════════════════════════════════════════════════ */
  var cwd = ROOT, mode = 'zsh', busy = false, abort = false, hi = hist.length;
  function scroll() { screen.scrollTop = screen.scrollHeight; }
  function out(html, cls) { var d = document.createElement('div'); d.className = 'line' + (cls ? ' ' + cls : ''); d.innerHTML = html; back.appendChild(d); scroll(); return d; }
  function plain(text, cls) { return out(esc(text), cls); }
  function promptHTML() {
    if (mode === 'ssh') return '<span class="p-ssh">›</span> ';
    return '<span class="p-user">andy@andymsun</span> <span class="p-dir">' + esc(pretty(cwd)) + '</span>' + (cwd.indexOf(ROOT) === 0 ? ' <span class="p-git">(agent)</span>' : '') + ' <span class="p-sym">%</span> ';
  }
  function setPrompt() {
    promptEl.innerHTML = promptHTML();
    titleEl.textContent = mode === 'ssh' ? 'ssh ' + HOST : pretty(cwd);
    live.classList.toggle('ssh', mode === 'ssh');
  }
  function render() {
    var v = input.value, p = input.selectionStart == null ? v.length : input.selectionStart;
    typedEl.textContent = v.slice(0, p);
    cursorEl.textContent = v.charAt(p) || '\u00a0';
    afterEl.textContent = v.slice(p + 1);
  }
  function echo(line, extra) { out(promptHTML() + '<span class="cmd">' + esc(line) + '</span>' + (extra || '')); }
  function showLive(on) { live.classList.toggle('wait', !on); if (on) { setPrompt(); render(); scroll(); } }  // stays in the DOM so focus survives a running command

  screen.addEventListener('mouseup', function () { if (!getSelection().toString()) input.focus({ preventScroll: true }); });
  screen.addEventListener('click', function (e) { if (e.target.closest('button, a')) return; if (!getSelection().toString()) input.focus({ preventScroll: true }); });
  input.addEventListener('focus', function () { term.classList.add('focused'); intro.cancel = true; });
  input.addEventListener('blur', function () { term.classList.remove('focused'); });
  ['input', 'keyup', 'click', 'select'].forEach(function (ev) { input.addEventListener(ev, render); });
  document.addEventListener('selectionchange', function () { if (document.activeElement === input) render(); });

  /* ══ commands ═════════════════════════════════════════════════════ */
  var MAN = {
    ls: 'list directory contents.  -a shows dotfiles, -l the long form', cd: 'change directory', cat: 'print a file',
    grep: 'search files.  -i ignores case.  grep -i redis', open: 'jump the editor to a file', ssh: 'connect to ssh.andymsun.com (a replica runs here)',
    curl: 'fetch a url.  try: curl ssh.andymsun.com/visits', ping: 'measure the real round trip to the server', git: 'status, log, diff, blame',
    tree: 'show the directory tree', coffee: 'brew one', tonic: 'make Tonic jump.  tonic --order for andy\'s drink', sl: 'you meant ls'
  };
  var C = {};
  C.help = function () {
    out('<div class="help">' + [
      ['ls · cd · cat · tree', 'walk the repo (it is this page)'], ['grep -i &lt;word&gt;', 'search everything Andy wrote'],
      ['open &lt;file&gt;', 'jump the editor there'], ['ssh ' + HOST, 'a replica of the real program'],
      ['curl ' + HOST + '/visits', 'the real visitor count'], ['git status · git log · git diff', 'what changed'],
      ['claude · codex · agy · opencode', 'swap the agent skin'], ['coffee · tonic · sl · cowsay', 'and so on'],
      ['theme · lights · clear · history', '']
    ].map(function (r) { return '<span class="k">' + r[0] + '</span><span class="d">' + r[1] + '</span>'; }).join('') + '</div>');
    out('<span class="dim">ctrl-c interrupts · ctrl-l clears · tab completes · ↑ history</span>');
  };
  C.ls = function (a) {
    var flags = a.filter(function (x) { return x.charAt(0) === '-'; }).join(''), paths = a.filter(function (x) { return x.charAt(0) !== '-'; });
    var all = /a/.test(flags), long = /l/.test(flags), target = norm(paths[0] || '.', cwd), n = node(target);
    if (!n) return plain('ls: ' + paths[0] + ': No such file or directory', 'err');
    var entries = n.type === 'dir' ? Object.keys(n.children).filter(function (k) { return all || k.charAt(0) !== '.'; }).sort() : [paths[0]];
    if (all && n.type === 'dir') entries = ['.', '..'].concat(entries);
    function cls(name, c) {
      if (name === '.' || name === '..' || (c && c.type === 'dir')) return '<span class="f-dir">' + esc(name) + '</span>';
      var p = c && c.sec && document.getElementById(c.sec), dot = p && p.dataset.status ? '<i class="dot-s ' + p.dataset.status + '"></i>' : '';
      return dot + '<span class="' + (name.charAt(0) === '.' ? 'f-dot' : /\.md$/.test(name) ? 'f-md' : /\.log$/.test(name) ? 'f-log' : 'f-file') + '">' + esc(name) + '</span>';
    }
    if (long) {
      out('<span class="dim">total ' + entries.length * 8 + '</span>');
      entries.forEach(function (name) {
        var c = n.type === 'dir' ? n.children[name] : n, dir = name === '.' || name === '..' || (c && c.type === 'dir');
        var size = dir ? 192 : read(c).length;
        out('<span class="dim">' + (dir ? 'drwxr-xr-x' : '-rw-r--r--') + '  1 andy  staff ' + String(size >= 1024 ? (size / 1024).toFixed(1) + 'K' : size).padStart(6) + ' Oct  5 09:41</span> ' + cls(name, c));
      });
      return;
    }
    out('<span class="ls">' + entries.map(function (name) { return '<span>' + cls(name, n.type === 'dir' ? n.children[name] : n) + '</span>'; }).join('') + '</span>');
  };
  C.ll = function (a) { return C.ls(['-la'].concat(a)); };
  C.cd = function (a) {
    var target = a[0] ? norm(a[0], cwd) : ROOT, n = node(target);
    if (a[0] === '-') target = ROOT, n = node(ROOT);
    if (!n) return plain('cd: no such file or directory: ' + a[0], 'err');
    if (n.type !== 'dir') return plain('cd: not a directory: ' + a[0], 'err');
    cwd = target;
    if (target === '/') { Tonic.mood('surprised', 900); Tonic.say('careful down there', 1400); }
  };
  C.pwd = function () { plain(cwd); };
  function fileArg(a, cmd) {
    var p = a.filter(function (x) { return x.charAt(0) !== '-'; });
    if (!p.length) { plain('usage: ' + cmd + ' <file>', 'dim'); return null; }
    return p.map(function (x) {
      var abs = norm(x, cwd), n = node(abs);
      if (!n) { plain(cmd + ': ' + x + ': No such file or directory', 'err'); return null; }
      if (n.type === 'dir') { plain(cmd + ': ' + x + ': Is a directory', 'err'); return null; }
      return { name: x, abs: abs, n: n };
    }).filter(Boolean);
  }
  function colour(text, name) {
    return text.split('\n').map(function (l) {
      var e = esc(l);
      if (/^#/.test(l)) return '<span class="c-h">' + e + '</span>';
      if (/^\[active\]/.test(l)) return '<span class="c-ok">[active]</span>' + e.slice(8);
      if (/^\[paused\]/.test(l)) return '<span class="c-warn">[paused]</span>' + e.slice(8);
      if (/^\[done  \]/.test(l)) return '<span class="dim">' + e + '</span>';
      if (/^(status|stack|source|demo):/.test(l)) return '<span class="dim">' + e + '</span>';
      if (/&lt;!--/.test(e)) return e.replace(/(&lt;!--.*--&gt;)/, '<span class="dim">$1</span>');
      if (/^> /.test(l)) return '<span class="dim">' + e + '</span>';
      return e;
    }).join('\n');
  }
  C.cat = function (a) { var fs = fileArg(a, 'cat'); if (!fs) return; fs.forEach(function (f) { out(colour(read(f.n).replace(/\n$/, ''), f.name), 'pre'); }); };
  C.less = C.more = C.bat = C.cat;
  C.head = function (a) {
    var n = 10, i = a.indexOf('-n'); if (i >= 0) { n = Number(a[i + 1]) || 10; a.splice(i, 2); }
    var fs = fileArg(a, 'head'); if (fs) fs.forEach(function (f) { out(colour(read(f.n).split('\n').slice(0, n).join('\n'), f.name), 'pre'); });
  };
  C.tail = function (a) {
    var n = 10, i = a.indexOf('-n'); if (i >= 0) { n = Number(a[i + 1]) || 10; a.splice(i, 2); }
    var fs = fileArg(a, 'tail'); if (fs) fs.forEach(function (f) { out(colour(read(f.n).replace(/\n$/, '').split('\n').slice(-n).join('\n'), f.name), 'pre'); });
  };
  C.wc = function (a) {
    var fs = fileArg(a, 'wc'); if (!fs) return;
    fs.forEach(function (f) { var t = read(f.n); plain(String(t.split('\n').length - 1).padStart(8) + String(t.split(/\s+/).filter(Boolean).length).padStart(8) + String(t.length).padStart(8) + ' ' + f.name); });
  };
  function walk(abs, fn) {
    var n = node(abs); if (!n) return;
    if (n.type === 'file') return fn(abs, n);
    Object.keys(n.children).sort().forEach(function (k) { if (k.charAt(0) !== '.') walk(abs + '/' + k, fn); });
  }
  C.grep = function (a) {
    var flags = a.filter(function (x) { return /^-/.test(x); }).join(''), rest = a.filter(function (x) { return !/^-/.test(x); });
    if (!rest.length) return plain('usage: grep [-i] pattern [file ...]', 'dim');
    var pat = rest[0].replace(/^["']|["']$/g, ''), paths = rest.slice(1), ci = /i/.test(flags) || pat === pat.toLowerCase();
    var re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ci ? 'gi' : 'g'), hits = 0;
    (paths.length ? paths : ['.']).forEach(function (p) {
      walk(norm(p, cwd), function (abs, n) {
        read(n).split('\n').forEach(function (line, i) {
          re.lastIndex = 0;
          if (!re.test(line) || hits >= 40) { return; }
          hits++;
          var rel = abs.indexOf(cwd + '/') === 0 ? abs.slice(cwd.length + 1) : pretty(abs);
          out('<span class="g-file">' + esc(rel) + '</span><span class="dim">:' + (i + 1) + ':</span>' + esc(line.trim()).replace(new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ci ? 'gi' : 'g'), function (m) { return '<mark>' + m + '</mark>'; }));
        });
      });
    });
    if (!hits) { Tonic.mood('curious', 800); return; }
    if (hits >= 40) plain('… (first 40 matches)', 'dim');
  };
  C.rg = C.grep;
  C.tree = function (a) {
    var start = norm(a[0] || '.', cwd), n = node(start), lines = ['<span class="f-dir">' + esc(a[0] || '.') + '</span>'], dirs = 0, files = 0;
    if (!n || n.type !== 'dir') return plain('tree: not a directory', 'err');
    (function rec(d, pre) {
      var ks = Object.keys(d.children).filter(function (k) { return k.charAt(0) !== '.'; }).sort();
      ks.forEach(function (k, i) {
        var c = d.children[k], lastOne = i === ks.length - 1;
        lines.push('<span class="dim">' + pre + (lastOne ? '└── ' : '├── ') + '</span>' + (c.type === 'dir' ? '<span class="f-dir">' + esc(k) + '</span>' : esc(k)));
        if (c.type === 'dir') { dirs++; rec(c, pre + (lastOne ? '    ' : '│   ')); } else files++;
      });
    })(n, '');
    lines.push('', dirs + ' directories, ' + files + ' files');
    out(lines.join('\n'), 'pre');
  };
  C.find = function (a) {
    var name = (a[a.indexOf('-name') + 1] || a[0] || '').replace(/["'*]/g, '').toLowerCase();
    walk(cwd, function (abs) { var rel = '.' + abs.slice(cwd.length); if (!name || rel.toLowerCase().indexOf(name) >= 0) plain(rel); });
  };
  C.open = function (a) {
    var fs = fileArg(a, 'open'); if (!fs) return;
    var f = fs[0];
    if (!f.n.sec) return plain('open: ' + f.name + ' has no page of its own; try cat', 'dim');
    Site.go(f.n.sec); plain('opened ' + f.name + ' in the editor', 'dim');
  };
  C.code = C.open;
  C.echo = function (a) { plain(a.join(' ').replace(/^["']|["']$/g, '')); };
  C.clear = function () { back.innerHTML = ''; };
  C.history = function () { out(hist.slice(-30).map(function (h, i) { return '<span class="dim">' + String(hist.length - Math.min(30, hist.length) + i + 1).padStart(5) + '</span>  ' + esc(h); }).join('\n'), 'pre'); };
  C.whoami = function () { plain('a visitor. andy is in README.md'); };
  C.hostname = function () { plain('andymsun.com'); };
  C.date = function () { plain(new Date().toString().replace(/ \(.*\)$/, '')); };
  C.uptime = function () { var s = Math.round(performance.now() / 1000); plain('up ' + (s < 60 ? s + ' secs' : Math.round(s / 60) + ' mins') + ', 1 user, load averages: 0.03 0.02 0.00 (mostly caffeine)'); };
  C.uname = function (a) { plain(a[0] === '-a' ? 'Browser andymsun.com 2026.10 vanilla-js #1 SMP ' + navigator.platform + ' espresso' : 'Browser'); };
  C.neofetch = C.fastfetch = function () {
    var total = 0; try { total = Number(localStorage.getItem('total') || 0); } catch (e) {}
    var art = ['   ) ) )', '  ( ( (', ' ▗▟█████▙▖', ' ▐███████▌▙', ' ▝▜█████▛▘▛', '  ▀▀▀▀▀▀▀', '', ''];
    var info = [
      '<span class="p-user">andy</span>@<span class="p-user">andymsun.com</span>', '<span class="dim">─────────────────</span>',
      '<span class="k2">OS</span>       your browser', '<span class="k2">Host</span>     andymsun.com + ' + HOST,
      '<span class="k2">Shell</span>    zsh (pretend)', '<span class="k2">Editor</span>   this window', '<span class="k2">Mascot</span>   Tonic (' + Tonic.skinName + ')',
      '<span class="k2">Visitors</span> ' + (total ? total.toLocaleString() : '…') + ', shared with ssh'
    ];
    out(art.map(function (l, i) { return '<span class="acc">' + esc(l.padEnd(14)) + '</span>' + (info[i] || ''); }).join('\n'), 'pre');
  };
  C.man = function (a) { plain(a[0] && MAN[a[0]] ? a[0] + ': ' + MAN[a[0]] : 'No manual entry for ' + (a[0] || 'nothing') + '. help lists what works.', a[0] && MAN[a[0]] ? '' : 'dim'); };
  C.which = function (a) { plain(C[a[0]] ? '/usr/local/bin/' + a[0] : a[0] + ' not found', C[a[0]] ? '' : 'err'); };
  C.exit = C.logout = function () { plain('That is the thing about websites. There is a tab for it.', 'dim'); Tonic.mood('sad', 900); Tonic.say('don\'t go', 1200); };
  C.sudo = function (a) {
    if (a.join(' ') === 'make me a coffee' || a.join(' ') === 'make me a sandwich') { plain('okay.', 'ok'); return C.coffee([]); }
    plain('andy is not in the sudoers file. This incident will be reported to Tonic.', 'err'); Tonic.mood('angry', 1600); Tonic.say('reported.', 1400);
  };
  C.rm = function (a) {
    if (/-rf|-fr/.test(a.join(' '))) { plain('rm: absolutely not.', 'err'); Tonic.mood('surprised', 1600); Tonic.shake(12); Tonic.say('NO', 1200); return; }
    plain('rm: read-only file system. It is a portfolio; it took a while.', 'err');
  };
  C.mv = C.cp = C.touch = C.mkdir = C.chmod = function () { plain('read-only file system. Andy edits these from his own laptop.', 'err'); };
  C.vim = C.nvim = C.vi = C.nano = C.emacs = function () { plain('You are already in an editor. It is the whole window.', 'dim'); };
  C.git = function (a) {
    var sub = a[0];
    if (sub === 'status') out('On branch <span class="acc">agent</span>\nChanges not staged for commit:\n  <span class="c-warn">modified:   experience.md</span>\n\n<span class="dim">14 projects:</span> <i class="dot-s green"></i> 8 shipped  <i class="dot-s yellow"></i> 5 in progress  <i class="dot-s red"></i> 1 abandoned', 'pre');
    else if (sub === 'diff') out('<span class="c-h">diff --git a/experience.md b/experience.md</span>\n<span class="dim">@@ -14,3 +14,3 @@ ## Jobs</span>\n<span class="c-del">-- 2025-05 → now         Outlier AI · prompt engineer</span>\n<span class="c-ok">+- 2025-05 → now         Scale AI · prompt engineer, contract</span>', 'pre');
    else if (sub === 'log') out([
      ['e41b0c2', '2026-06', 'join TipTop Technologies through Metcalf'], ['9a07d1f', '2026-05', 'start research at CUNY College of Staten Island'],
      ['c3f2a88', '2026-03', 'join KindEd and LawBandit, same month'], ['71de4b0', '2026-02', 'ship Lawvics in 48 hours, finalist'],
      ['5b9e113', '2025-09', 'join CareLumi'], ['2d4c7aa', '2025-05', 'start contract work at Scale AI'],
      ['0f1e9d3', '2024-09', 'move to Chicago'], ['0000001', '2020-09', 'initial commit: Queens High School for the Sciences']
    ].map(function (c) { return '<span class="acc">' + c[0] + '</span> <span class="dim">' + c[1] + '</span>  ' + c[2]; }).join('\n'), 'pre');
    else if (sub === 'blame') plain('andy  (2026-10-05)  every line. there is one contributor.', 'dim');
    else if (sub === 'branch') out('* <span class="acc">agent</span>\n  main', 'pre');
    else if (sub === 'push') plain('Everything up-to-date. (Andy pushes from his own laptop.)', 'dim');
    else plain('usage: git status | diff | log | blame | branch', 'dim');
  };
  C.ps = C.top = C.htop = function () {
    out('<span class="dim">  PID STAT  CMD</span>\n' + $$('#now .proc li').map(function (li, i) {
      var st = li.classList.contains('done') ? '<span class="dim">Z   </span>' : li.dataset.status === 'yellow' ? '<span class="c-warn">T   </span>' : '<span class="c-ok">R   </span>';
      return String(101 + i * 7).padStart(5) + ' ' + st + '  ' + esc(txt($('strong', li)).toLowerCase().replace(/\s+/g, '-'));
    }).join('\n') + '\n<span class="dim">R running · T paused · Z finished</span>', 'pre');
  };
  C.curl = async function (a) {
    var url = (a.filter(function (x) { return x.charAt(0) !== '-'; })[0] || '').replace(/^https?:\/\//, '');
    if (!url) return plain('curl: try curl ' + HOST + '/visits', 'dim');
    if (url.replace(/\/$/, '') === HOST + '/visits') {
      try {
        var r = await fetch(API, { cache: 'no-store' }), j = await r.text();
        out('<span class="c-ok">' + esc(j.trim()) + '</span>');
        plain('(that is the live count from the Go server: ssh sessions plus visits to this page)', 'dim');
      } catch (e) { plain('curl: (7) Failed to connect to ' + HOST + ' port 443', 'err'); }
      return;
    }
    if (/^(www\.)?andymsun\.com\/?$/.test(url)) return plain('<!DOCTYPE html> … you are looking at it.', 'dim');
    plain('curl: only ' + HOST + '/visits is reachable from in here', 'dim');
  };
  C.ping = async function (a) {
    var host = a[0] || HOST;
    if (host !== HOST && host !== 'andymsun.com') return plain('ping: cannot resolve ' + host + ': only ' + HOST + ' answers in here', 'err');
    plain('PING ' + HOST + ' (178.156.231.94): 56 data bytes');
    var times = [];
    for (var i = 0; i < 4 && !abort; i++) {
      var t0 = performance.now();
      try { await fetch(API, { cache: 'no-store' }); var ms = performance.now() - t0; times.push(ms); plain('64 bytes from 178.156.231.94: icmp_seq=' + i + ' time=' + ms.toFixed(1) + ' ms'); }
      catch (e) { plain('Request timeout for icmp_seq ' + i, 'err'); }
      await wait(600);
    }
    if (times.length) plain('--- ' + HOST + ' ping statistics ---\n' + times.length + ' packets received, round-trip min/avg/max = ' + Math.min.apply(null, times).toFixed(1) + '/' + (times.reduce(function (x, y) { return x + y; }, 0) / times.length).toFixed(1) + '/' + Math.max.apply(null, times).toFixed(1) + ' ms (real, over https, from Ashburn)', 'dim');
  };
  C.coffee = C.brew = async function (a) {
    if (/tonic/.test(a.join(' '))) return C.tonic(['--order']);
    plain('brewing…', 'dim'); await wait(700);
    var n = Tonic.brew();
    out('<span class="acc">   ) ) )\n   ( ( (\n ▗▟█████▙▖\n ▐███████▌▙\n ▝▜█████▛▘▛\n  ▀▀▀▀▀▀▀</span>', 'pre');
    plain('cup ' + n + '. ' + (n >= 5 ? 'Tonic is vibrating. maybe water next.' : 'context window: ' + (n + 2) + ' cups.'), n >= 5 ? 'c-warn' : 'ok');
  };
  C.make = function (a) { if (/tonic/.test(a.join(' '))) return C.tonic(['--order']); plain('make: *** No rule to make target \'' + (a[0] || '') + '\'.  Try make espresso-tonic.', 'err'); };
  C.tonic = function (a) {
    if ((a[0] || '') === '--order' || (a[0] || '') === 'order') { var on = Tonic.order(); plain(on ? 'pouring a double shot over tonic and ice. watch it layer.' : '', 'ok'); return; }
    Tonic.hop(20); Tonic.mood('happy', 1000); Tonic.say('hi!', 1200);
    plain('Tonic waves from the agent panel. (tonic --order for andy\'s drink)', 'dim');
  };
  C.bean = function () { plain('bean was the old name. it is Tonic now, after an espresso tonic.', 'dim'); };
  C.theme = function () { plain('theme: ' + Site.toggleTheme()); };
  C.lights = function () { plain('lights off. click outside this panel to bring them back.', 'dim'); Site.lightsOff(); };
  C.cowsay = function (a) {
    var msg = a.join(' ') || 'moo. I mean, I am a coffee.', line = '─'.repeat(msg.length + 2);
    out(' ╭' + line + '╮\n │ ' + esc(msg) + ' │\n ╰' + line + '╯\n    \\\n     \\   ▗▟███▙▖\n         ▐█ ▘ ▘█▌\n         ▝▜███▛▘', 'pre');
  };
  C.fortune = function () {
    var f = ['A terminal is the most honest interface: no layout, no fonts, a grid of cells.', 'Ship the small thing. Betelgeuse did not.', 'The second agent should audit the first.', 'Good evaluation keeps the uncertainty on the page.', 'Espresso over tonic, never the other way round.'];
    plain(f[Math.floor(Math.random() * f.length)]);
  };
  C.sl = async function () {
    var train = ['      ====        ________                ___________ ', '  _D _|  |_______/        \\__I_I_____===__|_________| ', '   |(_)---  |   H\\________/ |   |        =|___ ___|   ', '   /     |  |   H  |  |     |   |         ||_| |_||   ', '  |      |  |   H  |__--------------------| [___] |   ', '  | ________|___H__/__|_____/[][]~\\_______|       |   ', '  |/ |   |-----------I_____I [][] []  D   |=======|__ ', '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ', ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ', '  \\_/      \\O=====O=====O=====O_/      \\_/            '];
    var el = out(esc(train.join('\n')), 'pre train'), w = screen.clientWidth, t0 = performance.now();
    Tonic.mood('surprised', 2600); Tonic.say('choo choo', 1600);
    await new Promise(function (res) {
      (function step() {
        var x = w - (performance.now() - t0) * 0.45;
        el.style.transform = 'translateX(' + x + 'px)';
        if (x > -700 && !abort && !reduced) requestAnimationFrame(step); else res();
      })();
    });
    el.remove();
  };
  ['claude', 'codex', 'agy', 'opencode', 'antigravity'].forEach(function (k) {
    C[k] = function () {
      var key = k === 'antigravity' ? 'agy' : k;
      if (window.Agent) window.Agent.skin(key);
      plain('agent panel and Tonic → ' + ({ claude: 'Claude Code', codex: 'Codex', agy: 'Antigravity', opencode: 'OpenCode' })[key], 'dim');
    };
  });
  C.ssh = async function (a) {
    var host = (a.filter(function (x) { return x.charAt(0) !== '-'; })[0] || '').replace(/^[^@]*@/, '');
    if (!host) return plain('usage: ssh ' + HOST, 'dim');
    if (host !== HOST && host !== 'andymsun.com') return plain('ssh: Could not resolve hostname ' + host + ': nodename nor servname provided, or not known', 'err');
    plain('Connecting to ' + HOST + ' (178.156.231.94) port 22…', 'dim'); await wait(450);
    if (abort) return;
    var total = 0; try { total = Number(localStorage.getItem('total') || 0); } catch (e) {}
    out('<div class="welcome"><pre class="cup"><span class="steam">   ) ) )\n   ( ( (</span>\n ▗▟█████▙▖\n ▐███████▌▙\n ▝▜█████▛▘▛\n  ▀▀▀▀▀▀▀</pre><div><p><span class="acc">✻</span> Welcome to <b>andy code</b></p><p class="dim">/help for help, /now for what is running</p><p class="dim">model: andy-3 (third year) · context: 2 cups' + (total ? ' · visitor #' + total.toLocaleString() : '') + '</p></div></div>');
    out('<span class="dim">A replica running in your browser. The real one has subagents, three skins, and pickers: <button type="button" class="linkish" data-copy>copy the command</button>. /exit or ctrl-d to leave.</span>');
    mode = 'ssh';
    Tonic.mood('happy', 1000);
  };

  /* the ssh replica's own commands */
  var SSH = {
    '/help': function () {
      out('<div class="help">' + [['/now', 'what is running'], ['/projects', 'everything, with status dots'], ['/experience', 'the log'], ['/about', 'the person'], ['/contact', 'how to reach him'], ['/coffee', 'brew one'], ['/exit', 'back to zsh']]
        .map(function (r) { return '<span class="k">' + r[0] + '</span><span class="d">' + r[1] + '</span>'; }).join('') + '</div>');
    },
    '/now': function () { C.ps(); },
    '/projects': function () {
      out($$('.proj').map(function (p) { return '<i class="dot-s ' + p.dataset.status + '"></i> <b>' + esc(txt($('.name', p))) + '</b>  <span class="dim">' + esc(txt($('.blurb', p))) + '</span>'; }).join('\n'), 'pre');
    },
    '/experience': function () { C.git(['log']); },
    '/about': function () { plain(txt($('#about .about-prose p'))); },
    '/contact': function () { out('andy@andymsun.com · github.com/andymsun · linkedin.com/in/andymsun'); },
    '/coffee': function () { return C.coffee([]); },
    '/exit': function () { leaveSSH(); }
  };
  function leaveSSH() { mode = 'zsh'; plain('Connection to ' + HOST + ' closed.', 'dim'); }
  function sshChat(t) {
    var s = t.toLowerCase();
    if (/hi|hello|hey/.test(s)) return 'Hi. I only know about Andy. /help lists the commands.';
    if (/coffee|tonic|espresso/.test(s)) return 'Espresso tonic. It is the mascot\'s name now.';
    if (/hire|job|intern|email|contact/.test(s)) return 'andy@andymsun.com. Third year, graduating June 2028.';
    if (/why|ssh|terminal/.test(s)) return 'A terminal is the smallest interface there is. Designing for one forces a decision about what matters.';
    return 'I only know about Andy. Try /projects or /now.';
  }

  /* ══ running a line ═══════════════════════════════════════════════ */
  function tokens(line) { return (line.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(function (x) { return x.replace(/^["']|["']$/g, ''); }); }
  async function run(line, quiet) {
    line = line.trim();
    if (!quiet) echo(line);
    if (!line) return;
    if (!quiet || line) { if (hist[hist.length - 1] !== line) hist.push(line); hist = hist.slice(-200); hi = hist.length; try { localStorage.setItem('zsh_history', JSON.stringify(hist)); } catch (e) {} }
    busy = true; abort = false; showLive(false);
    try {
      if (mode === 'ssh') {
        var cmd = line.split(/\s+/)[0].toLowerCase();
        if (cmd === 'exit' || cmd === 'logout') leaveSSH();
        else if (SSH[cmd]) await SSH[cmd]();
        else if (cmd.charAt(0) === '/') plain('Unknown command: ' + cmd + '. /help lists the real ones.', 'dim');
        else { await wait(350); out('<span class="acc">⏺</span> ' + esc(sshChat(line))); }
      } else {
        // pipes are honoured just enough for `| grep` and `| head`
        var parts = line.split('|').map(function (x) { return x.trim(); });
        var tk = tokens(parts[0]), name = tk[0], args = tk.slice(1);
        if (C[name]) {
          var mark = back.children.length;
          await C[name](args);
          if (parts.length > 1) pipe(mark, parts.slice(1));
        }
        else if (/^\.\/|\.sh$/.test(name)) plain('zsh: permission denied: ' + name, 'err');
        else if (node(norm(name, cwd)) && node(norm(name, cwd)).type === 'dir') { C.cd([name]); }
        else { plain('zsh: command not found: ' + name, 'err'); if (/^(python|node|npm|pip|go|cargo)/.test(name)) plain('no runtimes in here; the real code is on GitHub.', 'dim'); else plain('try help', 'dim'); }
      }
    } catch (e) { plain(String(e), 'err'); }
    finally { busy = false; showLive(true); }
  }
  function pipe(mark, stages) {
    var lines = Array.prototype.slice.call(back.children, mark), text = lines.map(function (n) { return n.textContent; }).join('\n').split('\n');
    lines.forEach(function (n) { n.remove(); });
    stages.forEach(function (st) {
      var t = tokens(st);
      if (t[0] === 'grep') { var re = new RegExp(t[t.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), /-i/.test(st) ? 'i' : ''); text = text.filter(function (l) { return re.test(l) !== /-v/.test(st); }); }
      else if (t[0] === 'head') text = text.slice(0, Number(t[2] || t[1] && t[1].replace('-', '')) || 10);
      else if (t[0] === 'tail') text = text.slice(-(Number(t[2] || t[1] && t[1].replace('-', '')) || 10));
      else if (t[0] === 'wc') text = [String(text.length)];
      else if (t[0] === 'sort') text = text.sort();
      else text = ['zsh: ' + t[0] + ': not supported in a pipe here'];
    });
    out(esc(text.join('\n')), 'pre');
  }

  /* ══ keys ═════════════════════════════════════════════════════════ */
  function complete() {
    var v = input.value, p = input.selectionStart, head = v.slice(0, p), sp = head.lastIndexOf(' ') + 1, word = head.slice(sp), pool;
    if (mode === 'ssh') pool = Object.keys(SSH);
    else if (sp === 0) pool = Object.keys(C);
    else {
      var slash = word.lastIndexOf('/'), dirPart = slash >= 0 ? word.slice(0, slash + 1) : '', n = node(norm(dirPart || '.', cwd));
      pool = n && n.type === 'dir' ? Object.keys(n.children).filter(function (k) { return word.slice(slash + 1).charAt(0) === '.' || k.charAt(0) !== '.'; })
        .map(function (k) { return dirPart + k + (n.children[k].type === 'dir' ? '/' : ''); }) : [];
    }
    var hits = pool.filter(function (k) { return k.indexOf(word) === 0; }).sort();
    if (!hits.length) return;
    var common = hits.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
    if (hits.length === 1) common = hits[0] + (/\/$/.test(hits[0]) ? '' : ' ');
    if (common.length > word.length) { input.value = head.slice(0, sp) + common + v.slice(p); input.setSelectionRange(sp + common.length, sp + common.length); }
    else { echo(v); out('<span class="ls">' + hits.map(function (h) { return '<span>' + esc(h) + '</span>'; }).join('') + '</span>'); }
    render();
  }
  input.addEventListener('keydown', function (e) {
    var k = e.key, v = input.value, p = input.selectionStart;
    if (e.ctrlKey && !e.metaKey) {
      var lk = k.toLowerCase();
      if (lk === 'c') {
        e.preventDefault();
        if (busy) { abort = true; plain('^C', 'dim'); return; }
        echo(v, '<span class="dim">^C</span>'); input.value = ''; render(); Tonic.mood('surprised', 500); return;
      }
      if (lk === 'l') { e.preventDefault(); C.clear(); return; }
      if (lk === 'd') { e.preventDefault(); if (!v) { if (mode === 'ssh') { echo(''); leaveSSH(); setPrompt(); } else { echo(''); C.exit(); } } return; }
      if (lk === 'a') { e.preventDefault(); input.setSelectionRange(0, 0); render(); return; }
      if (lk === 'e') { e.preventDefault(); input.setSelectionRange(v.length, v.length); render(); return; }
      if (lk === 'u') { e.preventDefault(); input.value = v.slice(p); input.setSelectionRange(0, 0); render(); return; }
      if (lk === 'k') { e.preventDefault(); input.value = v.slice(0, p); render(); return; }
      if (lk === 'w') { e.preventDefault(); var s = v.slice(0, p).replace(/\S+\s*$/, ''); input.value = s + v.slice(p); input.setSelectionRange(s.length, s.length); render(); return; }
      if (lk === 'r') { e.preventDefault(); C.history(); return; }
    }
    if (busy) { if (k !== 'Tab') return; }
    if (k === 'Enter') { e.preventDefault(); input.value = ''; render(); run(v); }
    else if (k === 'Tab') { e.preventDefault(); if (!busy) complete(); }
    else if (k === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; input.value = hist[hi]; input.setSelectionRange(input.value.length, input.value.length); render(); } }
    else if (k === 'ArrowDown') { e.preventDefault(); if (hi < hist.length) { hi++; input.value = hist[hi] || ''; render(); } }
    else setTimeout(render, 0);
  });

  $('#term-toggle').addEventListener('click', function () {
    var closed = term.classList.toggle('closed');
    this.setAttribute('aria-expanded', String(!closed));
    this.setAttribute('aria-label', closed ? 'Expand terminal' : 'Collapse terminal');
  });

  /* ══ boot ═════════════════════════════════════════════════════════ */
  plain('Last login: ' + new Date(Date.now() - 86400000 * 2).toString().slice(0, 24) + ' on ttys004', 'dim');
  out('<span class="dim">This is a shell over the page you are reading. Try </span><span class="acc">ls</span><span class="dim">, </span><span class="acc">cat README.md</span><span class="dim">, </span><span class="acc">grep -i redis</span><span class="dim">, or </span><span class="acc">ssh ' + HOST + '</span><span class="dim">.</span>');
  showLive(true);

  // it types its first command itself, once it is on screen
  async function intro() {
    var text = 'ls';
    await wait(600);
    for (var i = 1; i <= text.length; i++) { if (intro.cancel) return; input.value = text.slice(0, i); render(); await wait(120); }
    await wait(300);
    if (intro.cancel) { input.value = ''; render(); return; }
    input.value = ''; render();
    await run(text);
  }
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); setTimeout(intro, 800); } }, { threshold: 0.4 });
    io.observe(term);
  }

  window.Term = {
    run: function (c) { intro.cancel = true; if (busy) return Promise.resolve(); return run(c); },
    focus: function () { input.focus(); }
  };
})();
