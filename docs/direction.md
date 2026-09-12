# direction

What the portfolio is, why it looks like this, and what to build next. Written
for Andy in September 2026; opinions are marked as such.

## the idea

A portfolio that pretends to be a coding agent, and only knows about one person.

You land on a terminal. It boots, types its own first question (`who is
andy?`), thinks with a spinner and a silly verb, streams an answer, then runs
`/projects` and "reads" five files that unfold into cards. Then the prompt is
yours: slash commands with a completion menu, `?` for help, keyword replies for
things like `why ssh?` and `coffee`, and `/exit` which cannot actually exit a
website. The ssh version is the same session in Go, with the real double
`Ctrl-C`.

The joke is the pitch. A CS student who cares about HCI and likes terminals,
presenting himself through the one interface everyone in the field is using
this year, and doing it in both mediums (a browser, a raw ssh session) with the
same behaviour. The Claude Code homage is deliberate and named as such; the
prompt box, the `⏺` bullets, the `⎿` results, the verbs, and the `Ctrl-C again`
line are all lifted. Nothing else is.

## what changed (round three)

Round two was a full-screen glassy terminal with a pointer-reactive dot field,
tilting cards, and pill chips. Andy liked the agent and called the rest slop.
Round three keeps the agent and rebuilds the frame around nine borrowed details
(see the swipe file): a normal header and footer, one dark window in the middle.

**Frame** (`index.html`, `style.css`)

- Header: name, one sentence, three text links (emilkowal.ski, brianlovin.com).
- Footer: a "runs on" row of small badges (antfu.me), a colophon, and a 1997
  marquee with an honest per-browser visitor counter (spatesite).
- Light page, dark terminal. Dark page theme via `/theme` or the OS.
- Cut: backdrop blur, the dot field, card tilt, chips.

**Window**

- Thin clay border; title bar reads `andy@ssh.andymsun.com: ~` (term.m4tt72.com).
- The three dots are back with the original gags: red flings the cursor, yellow
  hammers it flat, green stretches it until the floor gives (`eggs.js`).
- A ruler in the title bar, rectangle plus ticks, fills with transcript scroll
  (rauno.me). The Go side draws the same thing in its header.
- The session opens with `$ ssh ssh.andymsun.com` and a connection line, then
  boots itself: `who is andy?`, then `/now`.

**Commands**

- `/now` prints a process table: PID, status dot, tag, what (destel.dev).
- `/lights` turns the room black and gives you a flashlight; Esc or a click
  outside the window turns them back on (pankajtanwar.in).
- The Lawvics card carries a figure you can operate: fifty cells, a batch
  slider, a run button, results audited as they land (ciechanow.ski).
- Everything from round two stays: slash menu, `?`, history, `/exit`, `/cost`.

**Skins and the cup**

- Claude Code's welcome box has a small block-character mascot; ours is a
  coffee cup in the same half-block style, steam alternating every 700 ms, on
  both web and ssh.
- `/agent claude|codex|agy` reskins the whole session: welcome box, prompt
  glyph, bullets, tool labels, spinner, palette, model name. Codex is the
  `>_` box, `›` prompt, monochrome, "Working". Agy (Antigravity) is the
  gradient wordmark, `✦` bullets, braille spinner, blue. `?agent=` on the web
  picks one for a link. Same Andy underneath.

**Terminal** (`sshfolio/`)

- Same additions where a terminal can carry them: connection banner, hostname
  header with the ruler, `/now` table. Steps play on a 33 ms tick; colours are
  negotiated per session.

## hosting

Unchanged from round one: stay on Hetzner. Requirements are a public IPv4, raw
TCP on port 22, and a process that runs forever; that rules out every static
host. Hetzner's cheapest plan went from €3.99 to €5.49 in June 2026. Fly.io
lands around $4 with a dedicated IPv4. Oracle's Always Free ARM tier is $0 but
has capacity and reclamation problems. The gap is a coffee a month; the ssh
portfolio is the one part that must never show a "host key changed" warning.

## the server

Access from this Mac exists now (`ssh andy-vps`, port 2222), added through
Hetzner rescue mode on 2026-09-12. That first reboot also exposed two things and
fixed them: the portfolio container had no restart policy, and the admin sshd was
socket-activated and not actually listening. The box runs the old flat checkout
with docker compose; `deploy/README.md` has the one-time switch to the new
layout and the one-line update after that.

## what to build next

Ordered by how much it adds per hour.

1. **One content file.** `app.js` and `app/content.go` say the same things
   twice. A `content.json` at the repo root, read by both (the Go side embeds it
   with `//go:embed`; the web side fetches it or has it inlined by a 20-line
   build script), and the two sides can no longer drift.

2. **A recording of the ssh version.** `vhs` (charmbracelet) can script a
   session and produce a GIF. Put it in the README and behind `/web` on the
   terminal side. It is the strongest visual you have and costs an afternoon.

3. **More things to say.** The keyword table in `chat()` is the whole
   personality. Every good conversation with a recruiter or friend is a new
   row: what they asked, what you wish it had said. Keep it short and specific;
   the fallback line is fine as a fallback and boring as a habit.

4. **A real tool call.** Right now `Read()` is theatre. One honest tool would
   make the bit land harder: `/uptime` that actually reports the VPS uptime,
   `/whoami` that echoes the visitor's ssh username and terminal size, or
   `/now` that reads a real "what I'm doing this week" line from a file you
   update. Small, true, and it proves the thing is live.

5. **Writing.** Two pieces of prose, 600–900 words each, reachable as
   `/notes`: *designing for 80×24* (what this site cut to fit a terminal, and
   why it is better for it) and *showing uncertainty* (the Lawvics auditor, the
   CSI research). These are what professors and senior engineers read.

6. **Sound.** A single soft tick per streamed word, off by default, `/sound`
   to enable. Mechanical-keyboard people will love it; everyone else will never
   know it exists.

## deliberately not done

- No motion that is not attached to something you did: the spinner, the stream,
  the cards unfolding out of a `Read()`, the ruler, the dots. Nothing ambient.
- No analytics, no cookie banner, one font family (IBM Plex, sans and mono).
- No history rewrite for the previously committed host key; it is untracked,
  unused, and worthless.
