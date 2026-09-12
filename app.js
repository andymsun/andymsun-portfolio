// andy code — a terminal agent that only knows about Andy.
// Vanilla JS. The "model" is a switch statement; the spinner is the product.
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const log = $('#log'), input = $('#in'), menu = $('#menu'), form = $('#composer');
  const statusMid = $('#status-mid'), statusR = $('#status-right');
  const root = document.documentElement;
  // ?fast skips every animation; handy for testing and for people in a hurry.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]fast\b/.test(location.search);
  const sleep = (ms) => (reduced ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

  // ---------------------------------------------------------------- content
  const HOST = 'ssh.andymsun.com', IP = '178.156.231.94';
  const SSH = 'ssh ' + HOST;
  const ABOUT = [
    "Andy is a third-year at the University of Chicago studying computer science and computational & applied mathematics (class of 2028). Odyssey, First Phoenix, and QuestBridge scholar. From Flushing, Queens.",
    "The through-line is human–computer interaction: making capable systems usable by people who did not build them. Lately that means interfaces for language models that are not a chat box, evaluation work where the uncertainty stays on the page, and terminal software like the one you are talking to.",
  ];
  // /now, as a process table. pid is arbitrary but stable; status is honest.
  const NOW = [
    { pid: '0214', st: 'running', tag: 'job', what: 'KindEd', note: 'SWE intern · Django Channels, WebSockets, Redis · 2026 –' },
    { pid: '0301', st: 'running', tag: 'research', what: 'CUNY CSI', note: 'researcher · Span-Aware Mixture of Agents · 2026 –' },
    { pid: '0188', st: 'running', tag: 'contract', what: 'Scale AI', note: 'prompt engineer · red-teaming pre-release LLMs · 2025 –' },
    { pid: '0333', st: 'running', tag: 'cohort', what: 'Financial Markets', note: '3-year quant finance cohort, Booth coursework · 2025 –' },
    { pid: '0090', st: 'daily', tag: 'life', what: 'badminton', note: 'logistics officer · every open gym · 2025 –' },
    { pid: '0546', st: 'active', tag: 'oss', what: 'sshfolio', note: 'this program · 2026' },
    { pid: '0402', st: 'active', tag: 'side', what: 'pSiren', note: 'take a song apart, rebuild it · 2025 –' },
    { pid: '0410', st: 'active', tag: 'cert', what: 'Google Data Analytics', note: 'in progress · 2025 –' },
    { pid: '0290', st: 'stopped', tag: 'job', what: 'TipTop Technologies', note: 'SWE intern (Metcalf) · summer 2026' },
    { pid: '0250', st: 'stopped', tag: 'job', what: 'LawBandit', note: 'SWE intern · spring 2026' },
    { pid: '0116', st: 'stopped', tag: 'job', what: 'CareLumi', note: 'SWE intern · fall 2025' },
  ];
  // /experience: every job, research post, cohort, program, honor, and high-school role. end '' = present.
  const EXPERIENCE = [
    ['jobs', [
      ['TipTop Technologies', 'software engineering intern (Metcalf)', '2026-06', '2026-08', 'iOS Live Activity and Dynamic Island through a Swift Capacitor plugin; a CSS-token theming engine (light, dark, OLED, skins) raised to WCAG AA; fixed a navigation crash by lifting session state.'],
      ['KindEd', 'software engineering intern', '2026-03', '', 'real-time collaboration on Django Channels, WebSockets, and Redis; multi-tenant portals with role-scoped access and invite onboarding; closed a cross-tenant data leak.'],
      ['LawBandit', 'software engineering intern', '2026-03', '2026-05', 'a library of 25+ modular UI components standardising the front end of a legal AI adoption manual.'],
      ['Scale AI', 'prompt engineer (contract)', '2025-05', '', 'red-team pre-release LLMs, 50+ critical model failures catalogued; synthetic-data pipelines feeding fine-tuning; trained and evaluated contractors across four teams.'],
      ['CareLumi', 'software engineering intern', '2025-09', '2025-12', 'fine-tuned domain LLMs behind a multi-agent clinical documentation system; production AWS infrastructure (S3, EC2, Cognito, Neptune); real pilot data in the evaluation pipeline.'],
    ]],
    ['research', [
      ['CUNY College of Staten Island', 'undergraduate researcher, advised by Prof. Yumei Huo and Prof. Tianxiao Zhang', '2026-05', '', 'Span-Aware Mixture of Agents: layered multi-agent aggregation extended to span-level selection. Owns the code, tests, ablations against the MoA baseline, and the literature review.'],
    ]],
    ['leadership and cohorts', [
      ['Financial Markets Program', 'selected cohort member', '2025-07', '', 'selective three-year quantitative finance program with coursework at Chicago Booth.'],
      ['UChicago Badminton Club', 'logistics officer', '2025-04', '', 'dues, registrations, suppliers, inventory, an annual regional tournament for 100+ members; the club site and live play board.'],
      ['Goldman Sachs Virtual Insight Series', 'participant', '2025-05', '2025-06', 'four-week program on the firm\'s structure and career paths.'],
      ['Goldman Sachs Possibilities Summit', 'participant', '2024-12', '2025-06', 'competitive career-development program: risk analysis, data analytics, operations.'],
      ['Trott Emerging Business Leaders', 'selected cohort member', '2024-09', '2025-05', 'one-year business-acumen cohort; TEBL Scholar; TEBL Google Professional Certificate grant.'],
    ]],
    ['programs', [
      ['San Francisco Tech & AI Trek', 'UChicago', '2026-03', '2026-03', 'a week of Bay Area startups and labs.'],
      ['AI Integration Program', 'UChicago', '2026-01', '2026-03', 'winter 2026.'],
      ['Succeeding in the Entrepreneurial Workplace', 'UChicago, advanced cohort', '2026-01', '2026-03', 'winter 2026.'],
      ['Berlin & Frankfurt STEM & Startups Trek', 'UChicago', '2025-12', '2025-12', 'a week of German startups and research institutes.'],
      ['Google Data Analytics Professional Certificate', 'Coursera', '2025-06', '', 'in progress.'],
    ]],
    ['honors', [
      ['Odyssey Scholar · First Phoenix Scholar · QuestBridge Scholar', 'UChicago', '2024-09', '', 'first-generation, low-income scholarships; QuestBridge National College Match, December 2023.'],
      ['Financial Markets Scholar · TEBL Scholar', 'UChicago', '2024-09', '', 'with the cohorts above.'],
      ['AP Scholar · ARISTA National Honor Society · Principal\'s Honor Roll · Regents Mastery', 'Queens High School for the Sciences at York College', '2020-09', '2024-06', '4.00 GPA, Advanced Regents Diploma.'],
    ]],
    ['high school', [
      ['Queens Youth Volunteering Community', 'founding member and volunteer', '2021-11', '2024-06', 'helped grow the organisation to 300+ members.'],
      ['QHSS Model United Nations', 'secretary and delegate', '2021-09', '2024-06', 'competitive conference team.'],
      ['NYPD PSA 9', 'communications assistant', '2023-07', '2023-08', 'planned and attended community outreach events.'],
      ['Ivy Road Prep', 'teaching assistant', '2022-07', '2022-11', '200+ hours of teaching assistance.'],
    ]],
    ['education', [
      ['The University of Chicago', 'B.S. computer science + computational and applied mathematics', '2024-09', '2028-06', 'expected June 2028. Coursework: mathematical foundations of ML, abstract linear algebra, analysis in Rⁿ, systems programming.'],
      ['Queens High School for the Sciences at York College', 'Advanced Regents Diploma', '2020-09', '2024-06', 'Flushing, Queens; 4.00.'],
    ]],
  ];
  const PROJECTS = [
    { file: 'projects/lawvics.md', lines: 31, name: 'Lawvics', year: '2026', status: 'shipped', figure: 'swarm',
      blurb: 'One legal question, answered across all 50 states.',
      body: 'Built in under 48 hours; finalist at the UChicago Vibe Coding Hackathon. One agent turns a question into fifty jurisdiction-specific searches and runs them in five batches. A second agent audits every result: schema checks, citation format, and a flag for statutes that may have been repealed. A D3 map colors each state as its answer lands.',
      stack: 'Next.js 16 · React 19 · TypeScript · Vercel AI SDK · Zod · Zustand · D3',
      links: [['source', 'https://github.com/andymsun/lawvics'], ['demo', 'https://lawvics.vercel.app']] },
    { file: 'projects/rivendell.md', lines: 22, name: 'Rivendell', year: '2026', status: 'shipped',
      blurb: 'A live 3D map of everything moving around the planet.',
      body: '8,000+ satellites, 6,000+ flights, and 500+ vessels drawn on Google’s photorealistic 3D tiles, fed from several live sources at once. The hard parts were on the client: thousands of moving objects at 60 fps and a scene that stays readable at every zoom level.',
      stack: 'Next.js · TypeScript · React · Three.js · Google 3D Tiles', links: [] },
    { file: 'projects/sshfolio.md', lines: 27, name: 'sshfolio', year: '2026', status: 'active',
      blurb: 'This agent, but real, and over ssh.',
      body: 'A Go SSH server that gives every connection a program instead of a shell: the same prompt, the same slash commands, the same spinner. No account, nothing to install, Ctrl-C twice to leave. Runs on a small VPS whose real sshd was moved off port 22 so visitors get the app.',
      stack: 'Go · bubbletea · wish · lipgloss',
      links: [['source', 'https://github.com/andymsun/andymsun-portfolio'], ['connect', '#ssh']] },
    { file: 'projects/psiren.md', lines: 24, name: 'pSiren', year: '2025 –', status: 'wip',
      blurb: 'Take a finished song apart and rebuild it with different voices.',
      body: 'A music workspace for one person who wants the reach of a band. Separates a recording into vocal, instruments, and room, converts the lead with a voice model, and remixes over the original accompaniment, on an Apple Silicon laptop. In progress: per-instrument separation and instrument swaps that keep the notes and change the timbre.',
      stack: 'Python · PyTorch (MPS) · Mel-Band Roformer · RVC', links: [] },
    { file: 'projects/badminton.md', lines: 12, name: 'UChicago Badminton', year: '2025 –', status: 'active',
      blurb: 'Club website and a live play board for open gym.',
      body: 'Logistics officer for a 100+ member club: dues, registrations, suppliers, a regional tournament, and the board that shows who is on which court. The improvements come from being at every open gym and watching where people get stuck.',
      stack: 'a website · a whiteboard, digitized', links: [] },
    { file: 'projects/spore-in-space.md', lines: 19, name: 'Spore in Space', year: '2026', status: 'shipped',
      blurb: 'A browser roguelite about moss spores surviving 283 days outside the ISS.',
      body: 'Final project for a biology course: a small roguelite that dramatises a 2025 iScience study of moss spores exposed on the outside of the space station, with an in-game “About the science” panel that cites the paper.',
      stack: 'TypeScript · Canvas · one iScience paper', links: [] },
    { file: 'projects/imc-prosperity.md', lines: 16, name: 'IMC Prosperity 4', year: '2026', status: 'done',
      blurb: 'Algorithmic trading competition: a local backtester and round-by-round strategies.',
      body: 'Built a local backtesting environment and market-making and mean-reversion strategies in Python for IMC’s Prosperity 4, April 2026.',
      stack: 'Python · NumPy · Pandas', links: [] },
    { file: 'projects/cupboard-companion.md', lines: 18, name: 'Cupboard Companion', year: '2026', status: 'shipped',
      blurb: 'A pantry, grocery, and meal-plan hub that recognises what is in the photo.',
      body: 'Recognises items and meals from photos, deducts stock as you cook, saves recipes, and places delivery orders. Built for the AI Integration Program, winter 2026.',
      stack: 'Next.js · TypeScript · a vision model', links: [] },
    { file: 'projects/sophisticated-style.md', lines: 21, name: 'sophisticated.style', year: '2026', status: 'paused',
      blurb: 'A design-contract framework for AI-generated interfaces.',
      body: 'A multi-page concept canvas and a DESIGN.md compiler: tune density, type scale, and radius visually, and it emits a markdown design contract an agent can follow. Paused while the idea settles.',
      stack: 'TypeScript · React · a compiler for taste', links: [] },
    { file: 'projects/spatial-creator-suite.md', lines: 14, name: 'Spatial Creator Suite', year: '2026', status: 'paused',
      blurb: 'A two-module spatial creation app for XREAL One Pro, specified but not built.',
      body: 'An offline 3D audio mixing stage and a floating photo darkroom sharing one gesture engine, designed for the XREAL One Pro. Shelved at the design stage; the spec is the artefact.',
      stack: 'design · XREAL · a gesture engine on paper', links: [] },
    { file: 'projects/tapdance.md', lines: 17, name: 'TapDance', year: '2025 –', status: 'wip',
      blurb: 'A typing-test site with ten-plus custom test modes, inspired by monkeytype.',
      body: 'A highly customisable suite of typing tests, started as a static practice site (55 commits) and growing into TapDance. Andy types fast on his own layout, so the tests had to be stranger than the usual.',
      stack: 'TypeScript · static site · a keyboard layout of his own', links: [] },
    { file: 'projects/betelgeuse.md', lines: 13, name: 'Betelgeuse', year: '2026', status: 'abandoned',
      blurb: 'A modular native web browser. It did not survive the quarter.',
      body: 'A native Slint and Dioxus UI layer that skipped JavaScript DOM rendering for the browser chrome. Abandoned in March 2026, which is the honest word; the idea was bigger than the term.',
      stack: 'Rust · Slint · Dioxus', links: [] },
    { file: 'projects/sprout.md', lines: 11, name: 'Sprout', year: '2023 – 2024', status: 'done',
      blurb: 'A business plan for a localized tutoring startup, written in high school.',
      body: 'Executive summary, products, operations, marketing, and projections for a tutoring startup, co-written with a five-person high-school team.',
      stack: 'a plan · a team of five', links: [] },
  ];
  const DOT = { shipped: 'green', active: 'green', done: 'green', wip: 'yellow', paused: 'yellow', abandoned: 'red' };
  const VERBS = ['Caffeinating', 'Percolating', 'Not sleeping', 'Reticulating', 'Pondering', 'Compiling', 'Mulling', 'Brewing', 'Vibing', 'Herding statutes', 'Smashing', 'Noodling', 'Marinating', 'Cogitating', 'Clearing the court', 'Simmering', 'Shucking', 'Debugging life', 'Transmuting', 'Honking'];
  const GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  const COMMANDS = [
    ['/now', 'what is running', 'andy'],
    ['/projects', 'pick one, or all', 'andy'],
    ['/experience', 'everything, like git log', 'andy'],
    ['/about', 'who andy is', 'andy'],
    ['/contact', 'email, github, linkedin', 'andy'],
    ['/ssh', 'the real one', 'andy'],
    ['/agent', 'claude · codex · agy', 'session'],
    ['/model', 'which andy is this', 'session'],
    ['/config', 'settings, cycled in place', 'session'],
    ['/theme', 'page: light / dark', 'session'],
    ['/cost', 'what this session cost', 'session'],
    ['/clear', 'clear the screen', 'session'],
    ['/exit', 'you cannot', 'session'],
    ['/lights', 'turn them off', 'fun'],
    ['/help', 'this list', 'tools'],
  ];
  const GROUPS = ['andy', 'session', 'tools', 'fun'];
  const ARGS = { '/agent': ['claude', 'codex', 'agy'] };

  // ---------------------------------------------------------------- personas
  // Three skins for the same agent: claude (default, with the cup), codex, agy (antigravity).
  const CUP = [
    ['   ) ) )    ', ' ▗▟█████▙▖  ', ' ▐███████▌▙ ', ' ▝▜█████▛▘▛ ', '  ▀▀▀▀▀▀▀   '],
    ['   ( ( (    ', ' ▗▟█████▙▖  ', ' ▐███████▌▙ ', ' ▝▜█████▛▘▛ ', '  ▀▀▀▀▀▀▀   '],
  ];
  const PERSONAS = {
    claude: {
      name: 'andy code', star: '✻', title: 'andy@ssh.andymsun.com: ~', model: 'andy-3 (third year)',
      prompt: '>', placeholder: 'Try "/projects", "why ssh?", or "/lights"',
      verbs: VERBS, glyphs: GLYPHS,
      spinner: (verb, s, tok) => `${verb}… <span class="meta">(${s}s · ↑ ${tok} tokens · esc to interrupt)</span>`,
      tool: (fn, arg) => `<span class="fn">${esc(fn)}</span>(<span class="arg">${esc(arg)}</span>)`,
      welcome: () => `<div class="welcome cup"><pre class="mascot" aria-hidden="true"><span class="steam a">${CUP[0][0]}</span><span class="steam b">${CUP[1][0]}</span>\n${CUP[0].slice(1).join('\n')}</pre><pre class="wtext"><span class="star">✻</span> Welcome to <b>andy code</b>!\n\n<span class="dim">/help for help, /now for what is running</span>\n\n<span class="dim">cwd: ~/andymsun</span>\n<span class="dim">model: andy-3 (third year) · context: 2 cups</span></pre></div>`,
    },
    codex: {
      name: 'andy codex', star: '>_', title: 'andy codex — ~/andymsun', model: 'andy-5-codex',
      prompt: '›', placeholder: 'Ask andy codex to do anything',
      verbs: ['Working'], glyphs: ['•'],
      spinner: (verb, s) => `${verb} <span class="meta">(${s}s • esc to interrupt)</span>`,
      tool: (fn, arg) => `<span class="fn">${fn === 'Bash' ? 'Ran' : 'Read'}</span> <span class="arg">${esc(arg)}</span>`,
      welcome: () => `<div class="welcome box"><pre class="wtext"><span class="star">&gt;_</span> <b>andy codex</b> <span class="dim">(v0.3.0)</span>\n\n<span class="dim">model:     </span>andy-5-codex\n<span class="dim">directory: </span>~/andymsun</pre></div>`,
    },
    agy: {
      name: 'antigravity', star: '✦', title: 'antigravity — ~/andymsun', model: 'andy-2.5-pro',
      prompt: '>', placeholder: 'Type your message or @path/to/file',
      verbs: ['Reticulating splines', 'Warming up the flux capacitor', 'Consulting the coffee', 'Untangling the shuttlecocks', 'Asking Andy nicely', 'Defragmenting the semester', 'Polishing the pixels'],
      glyphs: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      spinner: (verb, s) => `${verb}… <span class="meta">(esc to cancel, ${s}s)</span>`,
      tool: (fn, arg) => `<span class="fn">${fn === 'Bash' ? 'Shell' : 'ReadFile'}</span> <span class="arg">${esc(arg)}</span>`,
      welcome: () => `<div class="welcome agy"><pre class="wtext"><span class="grad">A N T I G R A V I T Y</span>  <span class="dim">agent mode · andy-2.5-pro</span>\n\n<span class="dim">Tips for getting started:</span>\n<span class="dim">1.</span> Ask about Andy, read his projects, or run /now.\n<span class="dim">2.</span> Be specific; he is.\n<span class="dim">3.</span> <span class="k">/help</span> for more information.</pre></div>`,
    },
  };
  let P = PERSONAS.claude;
  function applyPersona(key, quiet) {
    P = PERSONAS[key] || PERSONAS.claude;
    document.getElementById('term').dataset.agent = key;
    $('#bar-title').textContent = P.title;
    $('.box .gt').textContent = P.prompt;
    if (!booting) input.placeholder = P.placeholder;
    try { localStorage.setItem('agent', key); } catch (e) {}
  }

  // ---------------------------------------------------------------- render
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function add(node) { log.appendChild(node); scrollDown(); return node; }
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function ticker(fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      (function tick() { if (fn(performance.now() - t0)) res(); else requestAnimationFrame(tick); })();
    });
  }
  async function stream(node, text, cps) {
    const cur = el('span', 'cursor');
    node.appendChild(cur);
    cps = cps || 320;
    let shown = 0;
    if (reduced) { cur.insertAdjacentText('beforebegin', text); cur.remove(); scrollDown(); return; }
    await ticker((ms) => {
      const target = skipping ? text.length : Math.min(text.length, Math.floor((ms * cps) / 1000));
      if (target > shown) { cur.insertAdjacentText('beforebegin', text.slice(shown, target)); shown = target; scrollDown(); }
      return shown >= text.length;
    });
    cur.remove();
  }
  async function say(text, cls) { const n = add(el('p', 'msg assist ' + (cls || ''))); await stream(n, text); return n; }
  function user(text) { add(el('p', 'msg user', esc(text))); }

  let spinning = false, skipping = false;
  async function think(ms) {
    const n = add(el('p', 'spin'));
    const verb = P.verbs[Math.floor(Math.random() * P.verbs.length)];
    let lastStep = -1, tokens = 0;
    n.innerHTML = `<span class="glyph"></span><span class="verb"></span>`;
    const glyph = n.querySelector('.glyph'), vb = n.querySelector('.verb');
    if (reduced) { n.remove(); return; }
    spinning = true;
    await ticker((t) => {
      const step = Math.floor(t / (P === PERSONAS.agy ? 80 : 110));
      if (step !== lastStep) {
        lastStep = step;
        glyph.textContent = P.glyphs[step % P.glyphs.length];
        tokens += Math.floor(Math.random() * 40);
        vb.innerHTML = P.spinner(verb, Math.floor(t / 1000), tokens);
      }
      return t >= ms || skipping;
    });
    spinning = false;
    n.remove();
  }
  async function tool(fn, arg, result, after) {
    const n = add(el('div', 'tool'));
    const call = el('p', 'call pending', P.tool(fn, arg));
    n.appendChild(call);
    await sleep(skipping ? 0 : 260 + Math.random() * 300);
    call.classList.remove('pending');
    n.appendChild(el('p', 'res', esc(result)));
    if (after) n.appendChild(after);
    scrollDown();
    await sleep(skipping ? 0 : 160);
    return n;
  }
  function card(p) {
    const c = el('article', 'card');
    c.innerHTML = `<h3>${esc(p.name)}<span class="year">${esc(p.year)}</span></h3>
      ${p.status ? `<p class="status"><i class="dot ${DOT[p.status]}"></i>${p.status}</p>` : ''}
      <p class="blurb">${esc(p.blurb)}</p>
      <p>${esc(p.body)}</p>
      <p class="stack">${esc(p.stack)}</p>
      ${p.links.length ? `<p class="links">${p.links.map(([t, h]) => `<a href="${h}"${h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(t)} →</a>`).join('')}</p>` : ''}`;
    if (p.figure === 'swarm') c.appendChild(swarmFigure());
    return c;
  }

  // ciechanowski's rule: a figure you can operate. Fifty states, N batches, an auditor.
  function swarmFigure() {
    const f = el('div', 'fig');
    f.innerHTML = `<p class="cap">Fifty jurisdictions, searched in batches, audited as they land. Drag the batch count, then run it.</p>
      <div class="grid" aria-hidden="true">${'<i></i>'.repeat(50)}</div>
      <div class="ctl"><button type="button" class="run">run the swarm</button>
      <label>batches <input type="range" min="1" max="10" value="5" step="1"><b class="bn">5</b></label>
      <span class="tally">verified 0 · flagged 0</span></div>`;
    const cells = Array.from(f.querySelectorAll('.grid i'));
    const range = f.querySelector('input'), bn = f.querySelector('.bn'), tally = f.querySelector('.tally'), run = f.querySelector('.run');
    range.addEventListener('input', () => { bn.textContent = range.value; });
    let running = false;
    run.addEventListener('click', async () => {
      if (running) return; running = true; run.disabled = true;
      cells.forEach((c) => { c.className = ''; });
      let ok = 0, sus = 0; tally.textContent = 'verified 0 · flagged 0';
      const batches = Number(range.value), per = Math.ceil(50 / batches);
      for (let b = 0; b < batches; b++) {
        const batch = cells.slice(b * per, (b + 1) * per);
        batch.forEach((c) => c.classList.add('wait'));
        const dur = reduced ? 0 : 350 + per * 40;
        await ticker((t) => {
          const done = dur === 0 ? batch.length : Math.min(batch.length, Math.floor((t / dur) * batch.length + 1));
          for (let i = 0; i < done; i++) {
            const c = batch[i]; if (c.className !== 'wait') continue;
            const bad = Math.random() < 0.14; c.className = bad ? 'sus' : 'ok'; if (bad) sus++; else ok++;
            tally.textContent = `verified ${ok} · flagged ${sus}`;
          }
          return t >= dur;
        });
        batch.forEach((c) => { if (c.className === 'wait') { c.className = 'ok'; ok++; } });
        tally.textContent = `verified ${ok} · flagged ${sus}`;
      }
      running = false; run.disabled = false; run.textContent = 'run it again';
    });
    return f;
  }

  function welcome() { add(el('div', 'welcome-wrap', P.welcome())); }
  function hash(str) { let h = 5381; for (const c of str) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(7, '0').slice(0, 7); }
  function experienceLog() {
    const t = el('pre', 'gitlog');
    t.innerHTML = EXPERIENCE.map(([label, rows]) => `<span class="lbl">── ${esc(label)}</span>\n` + rows.map(([org, title, start, end, line]) =>
      `<span class="${end ? 'dot off' : 'dot on'}">*</span> <span class="h">${hash(org + title)}</span> <span class="d">${start} → ${end || 'now'}</span>  <b>${esc(org)}</b> · ${esc(title)}\n<span class="d">|</span>         <span class="d">${esc(line)}</span>`).join('\n')).join('\n');
    t.innerHTML += `\n<span class="d">(${EXPERIENCE.reduce((n, [, r]) => n + r.length, 0)} entries · /now for what is running)</span>`;
    return t;
  }
  function psTable() {
    const t = el('div', 'ps');
    t.innerHTML = `<div class="h">PID   STATUS     TAG        PROCESS</div>` + NOW.map((r) => {
      const dot = r.st === 'stopped' ? '<span class="off">○</span>' : '<span class="on">●</span>';
      return `<span>${r.pid}</span><span>${dot} ${r.st}</span><span class="tag">[${r.tag}]</span><span class="what">${esc(r.what)} <span>· ${esc(r.note)}</span></span>`;
    }).join('');
    return t;
  }

  // ---------------------------------------------------------------- picker: the tiny menu
  let activePick = null;
  function picker(title, hint, items, opts) {
    // items: {label, desc, dot, run(): steps | cycle()}; resolves when closed
    return new Promise((resolve) => {
      const box = add(el('div', 'pick'));
      const pk = { items, sel: 0, box, resolve, rebuild: opts && opts.rebuild };
      activePick = pk;
      input.disabled = true;
      pk.render = () => {
        if (pk.rebuild) pk.items = pk.rebuild();
        box.innerHTML = `<p class="t">${esc(title)} <span class="h">${esc(hint || '')}</span></p>` +
          pk.items.map((it, i) => `<p class="row ${i === pk.sel ? 'sel' : ''}" data-i="${i}"><span class="n">${i === pk.sel ? '›' : i < 9 ? (i + 1) + '.' : ' '}</span><i class="dot ${it.dot || 'none'}"></i><span class="l">${esc(it.label)}</span><span class="d">${esc(it.desc || '')}</span></p>`).join('') +
          `<p class="h">↑↓ · enter · esc · or click</p>`;
        scrollDown();
      };
      pk.choose = async () => {
        const it = pk.items[pk.sel];
        if (it.cycle) { it.cycle(); pk.render(); return; }
        pk.close();
        add(el('p', 'msg user', '› ' + esc(it.label)));
        if (it.run) await it.run();
      };
      pk.close = () => { activePick = null; box.classList.add('closed'); input.disabled = false; input.focus(); resolve(); };
      box.addEventListener('click', (e) => { const r = e.target.closest('.row'); if (r) { pk.sel = Number(r.dataset.i); pk.render(); pk.choose(); } });
      pk.render();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (!activePick) return;
    const pk = activePick, n = pk.items.length;
    if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'Tab') { e.preventDefault(); pk.sel = (pk.sel + 1) % n; pk.render(); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); pk.sel = (pk.sel - 1 + n) % n; pk.render(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pk.choose(); }
    else if (e.key === 'Escape' || e.key === 'q') { e.preventDefault(); pk.close(); }
    else if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) { pk.sel = Number(e.key) - 1; pk.render(); }
  }, true);
  async function openProject(p) { await tool('Read', p.file, `Read ${p.lines} lines`, card(p)); }
  const skinItems = (asModel) => ['claude', 'codex', 'agy'].map((k) => ({
    label: asModel ? PERSONAS[k].model : PERSONAS[k].name, desc: asModel ? PERSONAS[k].name : PERSONAS[k].model, dot: P === PERSONAS[k] ? 'green' : 'dim',
    run: () => HANDLERS['/agent'](k) }));

  // ---------------------------------------------------------------- commands
  const HANDLERS = {
    async '/help'() {
      const t = el('div', 'help-groups');
      for (const g of GROUPS) {
        const col = el('div', 'grp', `<p class="g">${g}</p>`);
        for (const [k, d, gg] of COMMANDS) if (gg === g) col.appendChild(el('p', '', `<span class="k">${esc(k)}</span><span class="d">${esc(d)}</span>`));
        t.appendChild(col);
      }
      add(t);
      add(el('p', 'msg plain', 'Or just ask something. I only know about Andy. Type / and keep typing to filter the menu.'));
    },
    async '/now'() {
      await think(500);
      await tool('Bash', 'ps -o pid,stat,tag,cmd', `${NOW.length} processes`, psTable());
    },
    async '/experience'() {
      await think(400);
      await tool('Bash', 'git log --all --oneline --date=short', `${EXPERIENCE.reduce((n, [, r]) => n + r.length, 0)} entries`, experienceLog());
    },
    async '/history'() { await HANDLERS['/experience'](); },
    async '/resume'() { await say('Nothing to resume; you were here the whole time. The other kind of résumé:'); await HANDLERS['/experience'](); },
    async '/about'() {
      await think(900);
      await tool('Read', 'about.md', 'Read 18 lines');
      for (const p of ABOUT) await say(p);
      await say('For what he is doing right now, /now.');
    },
    async '/projects'(arg) {
      if (arg === 'all') {
        await think(900);
        await say(`Reading all ${PROJECTS.length} project files.`);
        for (const p of PROJECTS) await openProject(p);
        await say('All of them. Green shipped, yellow in progress, red abandoned; the abandoned one stays on purpose.', 'ok');
        return;
      }
      if (arg) {
        const p = PROJECTS.find((x) => x.name.toLowerCase().includes(arg));
        if (p) { await openProject(p); return; }
        await say(`No project called ${arg}. /projects opens the list.`); return;
      }
      await picker('Projects', 'green shipped · yellow in progress or paused · red abandoned',
        PROJECTS.map((p) => ({ label: p.name, desc: `${p.year} · ${p.blurb}`, dot: DOT[p.status], run: () => openProject(p) }))
          .concat([{ label: 'all of them', desc: 'read every file', dot: 'none', run: () => HANDLERS['/projects']('all') }]));
    },
    async '/model'() { await picker('Model', 'one Andy, three model names', skinItems(true)); },
    async '/config'() {
      await picker('Config', 'enter cycles a value', [], { rebuild: () => [
        { label: 'skin', desc: P.name, dot: 'green', cycle: () => applyPersona({ claude: 'codex', codex: 'agy', agy: 'claude' }[document.getElementById('term').dataset.agent]) },
        { label: 'page theme', desc: root.dataset.theme || 'system', dot: 'green', cycle: () => { const n = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = n; try { localStorage.setItem('theme', n); } catch (e) {} } },
        { label: 'lights', desc: document.body.classList.contains('lights-out') ? 'off' : 'on', dot: document.body.classList.contains('lights-out') ? 'dim' : 'green', cycle: () => (document.body.classList.contains('lights-out') ? lightsOn() : lightsOff()) },
      ] });
    },
    async '/contact'() {
      await think(500);
      await tool('Read', 'contact.md', 'Read 4 lines');
      const n = add(el('p', 'msg assist'));
      n.innerHTML = `email <a href="mailto:andy@andymsun.com">andy@andymsun.com</a>\ngithub <a href="https://github.com/andymsun" target="_blank" rel="noopener">github.com/andymsun</a>\nlinkedin <a href="https://linkedin.com/in/andymsun" target="_blank" rel="noopener">linkedin.com/in/andymsun</a>\nssh <code>${SSH}</code>`;
    },
    async '/ssh'() {
      await think(600);
      await tool('Bash', SSH, 'this is a website, so that did nothing. on your machine it works:');
      const c = el('div', 'cmdline');
      c.innerHTML = `<code>${SSH}</code><button type="button" id="copy">copy</button>`;
      add(c);
      c.querySelector('#copy').addEventListener('click', copySSH);
      await say('No account, nothing to install, Ctrl-C twice to leave. Same prompt, same commands, real terminal.');
    },
    async '/lights'() {
      if (document.body.classList.contains('lights-out')) { lightsOn(); await say('Lights on.'); return; }
      await say('Lights off. You have a flashlight. Esc, or /lights, to find the switch.', 'clay');
      lightsOff();
    },
    async '/theme'() {
      const next = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      await say(`Page theme: ${next}. The window stays dark; it is a terminal.`);
    },
    async '/agent'(arg) {
      if (!PERSONAS[arg]) { await picker('Agent skin', 'same Andy underneath', skinItems(false)); return; }
      applyPersona(arg);
      log.innerHTML = '';
      welcome();
      await say(`Now dressed as ${P.name}. Same Andy underneath.`);
    },
    async '/cost'() {
      const secs = Math.floor((performance.now() - T0) / 1000);
      await say(`Session: ${secs}s wall time, ≈ ${(secs / 900 + 1).toFixed(1)} coffees, $0.00. Andy is a student; this runs on a €5 VPS.`);
    },
    async '/clear'() { log.innerHTML = ''; welcome(); },
    async '/exit'() { await exitJoke(); },
    async '/quit'() { await exitJoke(); },
  };
  let exitCount = 0;
  async function exitJoke() {
    exitCount++;
    if (exitCount === 1) { statusR.innerHTML = '<span class="warn">Press Ctrl-C again to exit</span>'; return; }
    statusR.textContent = '';
    await say('That is the thing about websites. You can leave whenever you want; there is a tab for it.', 'clay');
  }

  async function chat(text) {
    const t = text.toLowerCase();
    const has = (...ws) => ws.some((w) => t.includes(w));
    await think(700 + Math.random() * 700);
    if (has('why ssh', 'ssh?', 'why a terminal', 'why terminal')) return say('An SSH session is the smallest interface there is: no layout engine, no fonts, no mouse required, a grid of cells. Designing for it forces a decision about what matters. This page is the same program with more pixels.');
    if (has('coffee')) return say('Yes. Interests, in order: coffee, coffee, coffee, HCI. He would like you to know the order is a joke, and that it is not.');
    if (has('sleep')) return say('The bio used to say "a cs major that does not sleep". It was removed for being too accurate.');
    if (has('badminton')) return say('Every open gym. Logistics officer for the UChicago club, which mostly means dues, suppliers, and a live board of who is on which court.');
    if (has('hire', 'job', 'intern', 'recruit', 'resume', 'cv')) return say('Good instinct. Email is fastest: andy@andymsun.com. He is a third year, graduating June 2028, and likes teams where he can own a large part of the outcome.');
    if (has('hello', 'hi ', 'hey', 'yo')) return say('Hi. I am a small script pretending to be a coding agent pretending to be Andy. Try /now.');
    if (has('who are you', 'what are you', 'what is this')) return say('A terminal agent that only knows about one person. The real one runs over ssh; this one runs in your tab. Type / to see what I can do.');
    if (has('hci', 'interaction', 'interface')) return say('Human–computer interaction is the part he keeps coming back to: making capable systems usable by people who did not build them. Interfaces for models that are not a chat box, and terminals, obviously.');
    if (has('claude', 'anthropic', 'copy')) return say('Inspired by, not affiliated with. The prompt box, the ⏺ bullets, and the spinner verbs are a homage. The content is all Andy.');
    if (has('dots', 'buttons', 'red', 'yellow', 'green')) return say('The three dots are load-bearing. Try them.');
    return say('I only know things about Andy. Try /now, /projects, or ask "why ssh?"');
  }

  async function run(text) {
    text = text.trim(); if (!text) return;
    user(text);
    lock(true);
    const parts = text.split(/\s+/), cmd = parts[0].toLowerCase(), arg = (parts[1] || '').toLowerCase();
    try {
      if (HANDLERS[cmd]) await HANDLERS[cmd](arg);
      else if (text.startsWith('/')) await say(`Unknown command: ${text}. /help lists the real ones.`);
      else await chat(text);
    } finally { lock(false); }
  }
  function lock(on) { input.disabled = on; if (!on) input.focus(); }
  function copySSH() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(SSH).then(() => { statusR.textContent = 'copied ' + SSH; setTimeout(() => (statusR.textContent = ''), 1500); });
  }

  // ---------------------------------------------------------------- the flashlight room
  const room = $('#room');
  function lightsOff() {
    document.body.classList.add('lights-out'); room.hidden = false;
    room.style.setProperty('--x', (innerWidth / 2) + 'px'); room.style.setProperty('--y', (innerHeight / 2) + 'px');
  }
  function lightsOn() { document.body.classList.remove('lights-out'); room.hidden = true; }
  addEventListener('pointermove', (e) => { if (!room.hidden) { room.style.setProperty('--x', e.clientX + 'px'); room.style.setProperty('--y', e.clientY + 'px'); } }, { passive: true });

  // ---------------------------------------------------------------- the ruler
  const ticks = $('#ruler .ticks');
  const N = 14;
  ticks.innerHTML = '<i></i>'.repeat(N);
  const tickEls = Array.from(ticks.children);
  function ruler() {
    const max = log.scrollHeight - log.clientHeight;
    const r = max <= 0 ? 1 : log.scrollTop / max;
    const on = Math.round(r * N);
    tickEls.forEach((t, i) => t.classList.toggle('on', i < on));
  }
  log.addEventListener('scroll', ruler, { passive: true });
  new MutationObserver(ruler).observe(log, { childList: true, subtree: true, characterData: true });

  // ---------------------------------------------------------------- slash menu, keys
  let sel = 0;
  function renderMenu() {
    const v = input.value;
    if (!v.startsWith('/')) { menu.hidden = true; return; }
    let items;
    const sp = v.indexOf(' ');
    if (sp > 0) { // argument completion: "/agent co" -> "/agent codex"
      const cmd = v.slice(0, sp), rest = v.slice(sp + 1).trimStart();
      items = (ARGS[cmd] || []).filter((a) => a.startsWith(rest)).map((a) => [cmd + ' ' + a, '']);
    } else items = COMMANDS.filter(([k]) => k.startsWith(v));
    if (!items.length) { menu.hidden = true; return; }
    sel = Math.min(sel, items.length - 1);
    let start = 0;
    if (items.length > 8 && sel > 3) start = Math.min(sel - 3, items.length - 8);
    const shown = items.slice(start, start + 8);
    menu.innerHTML = (items.length > 8 ? `<li class="more">↑↓ · ${sel + 1} of ${items.length} · keep typing to filter</li>` : '') +
      shown.map(([k, d], j) => { const i = start + j; return `<li role="option" class="${i === sel ? 'sel' : ''}" data-k="${k}"><span class="k">${k}</span><span>${d}</span></li>`; }).join('');
    menu.hidden = false;
  }
  menu.addEventListener('click', (e) => { const li = e.target.closest('li[data-k]'); if (li) { input.value = li.dataset.k; menu.hidden = true; form.requestSubmit(); } });
  input.addEventListener('input', () => { sel = 0; renderMenu(); });
  const history = []; let hi = -1;
  input.addEventListener('keydown', (e) => {
    if (!menu.hidden) {
      const rows = Array.from(menu.querySelectorAll('li[data-k]')), all = input.value.indexOf(' ') > 0 ? null : COMMANDS.filter(([k]) => k.startsWith(input.value));
      const n = all ? all.length : (ARGS[input.value.slice(0, input.value.indexOf(' '))] || []).filter((a) => a.startsWith(input.value.slice(input.value.indexOf(' ') + 1).trimStart())).length;
      const pick = all ? all[sel][0] : (rows.find((r) => r.classList.contains('sel')) || rows[0]).dataset.k;
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % n; renderMenu(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + n) % n; renderMenu(); return; }
      if (e.key === 'Tab') { e.preventDefault(); input.value = pick; menu.hidden = true; return; }
      if (e.key === 'Enter') { e.preventDefault(); menu.hidden = true; if (input.value !== pick) { input.value = pick; return; } form.requestSubmit(); return; }
      if (e.key === 'Escape') { menu.hidden = true; return; }
    }
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hi = Math.min(hi + 1, history.length - 1); input.value = history[history.length - 1 - hi]; }
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.max(hi - 1, -1); input.value = hi < 0 ? '' : history[history.length - 1 - hi]; }
    if (e.key === 'Enter' && menu.hidden) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value; if (!v.trim()) return;
    history.push(v); hi = -1; input.value = ''; menu.hidden = true;
    run(v);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.body.classList.contains('lights-out')) { lightsOn(); return; }
      if (spinning) { skipping = true; setTimeout(() => (skipping = false), 50); }
    }
    if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); exitJoke(); }
    if (e.key === '?' && document.activeElement !== input && !booting) { input.value = '/help'; form.requestSubmit(); }
    if (document.activeElement !== input && !e.metaKey && !e.ctrlKey && e.key.length === 1 && !booting && !input.disabled) input.focus();
  });
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('lights-out') && !e.target.closest('.term')) { lightsOn(); return; }
    if (e.target.closest('a[href="#ssh"]')) { e.preventDefault(); input.value = '/ssh'; form.requestSubmit(); }
  });

  // ---------------------------------------------------------------- visitor counter (honest: this browser only)
  let visits = 1;
  try { visits = Number(localStorage.getItem('visits') || 0) + 1; localStorage.setItem('visits', String(visits)); } catch (e) {}
  $('#marq-n').textContent = String(visits).padStart(6, '0');
  statusMid.textContent = visits === 1 ? 'first visit from this browser' : `visit ${visits} from this browser`;

  // ---------------------------------------------------------------- boot
  const T0 = performance.now();
  let booting = true;
  (function pickPersona() {
    const q = (location.search.match(/[?&]agent=(\w+)/) || [])[1];
    let saved = null; try { saved = localStorage.getItem('agent'); } catch (e) {}
    applyPersona(PERSONAS[q] ? q : (PERSONAS[saved] ? saved : 'claude'), true);
  })();
  async function typeIntoPrompt(text) {
    input.placeholder = ''; input.value = '';
    if (reduced) { input.value = text; await sleep(0); input.value = ''; return; }
    await ticker((ms) => { const n = skipping ? text.length : Math.min(text.length, Math.floor(ms / 55)); input.value = text.slice(0, n); return n >= text.length; });
    await sleep(skipping ? 0 : 350);
    input.value = '';
  }
  async function boot() {
    statusR.innerHTML = 'press <b>esc</b> to skip';
    const skipOnKey = (e) => { if (e.key === 'Escape') skipping = true; };
    document.addEventListener('keydown', skipOnKey);
    const conn = add(el('p', 'conn'));
    await stream(conn, '$ ' + SSH, 60);
    await sleep(500);
    conn.innerHTML += `\n<span class="p">Connected to ${HOST} (${IP}), port 22.\nandy code v0.3 · no account needed · Ctrl-C twice to leave</span>`;
    await sleep(500);
    welcome();
    await sleep(600);
    await typeIntoPrompt('who is andy?');
    user('who is andy?');
    await think(900);
    await say(ABOUT[0]);
    await sleep(300);
    await typeIntoPrompt('/now');
    user('/now');
    await think(500);
    await tool('Bash', 'ps -o pid,stat,tag,cmd', `${NOW.length} processes`, psTable());
    await say('That is the current state. The prompt is yours: /projects reads the work, / lists everything, or ask me something.', 'ok');
    document.removeEventListener('keydown', skipOnKey);
    skipping = false; booting = false;
    input.placeholder = P.placeholder;
    statusR.innerHTML = `the real one: <a href="#ssh">${SSH}</a>`;
    lock(false);
  }
  boot();
})();
