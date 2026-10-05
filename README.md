# andymsun.com

A portfolio that pretends to be a coding agent. It only knows about Andy.

- **Web**: `index.html`, `style.css`, and three scripts in the repo root. The
  page is a calm editor window: the explorer is the nav, the portfolio is one
  scrollable multi-file buffer (README.md, now.log, projects/, experience.md,
  about.md, contact.md) with line numbers and sticky file headers, a friendly
  terminal panel previews the ssh program, and an agent panel on the right
  answers questions with tool calls that move the page. Bean, the mascot, is
  an SVG soft body (`bean.js`) that follows the cursor, reacts to what you
  hover, sleeps when you go quiet, and can be dragged. The agent panel has
  four skins (Claude Code, Codex, Antigravity, OpenCode). Under 760px it is an
  ordinary scrolling page and the agent opens as a sheet. Every word is in the
  markup. No framework, no build step; `?fast` skips the animations.
- **Terminal**: `sshfolio/`, the same agent in Go, served over ssh. Runs on a
  small Hetzner VPS on port 22, so `ssh ssh.andymsun.com` is the whole install.

Both borrow the look of coding agents (Claude Code most of all; Codex,
Antigravity, and OpenCode as web skins) as a homage. Not affiliated.

## run the terminal version locally

```bash
cd sshfolio
SSH_SERVER_ENABLED=false go run .        # in this terminal
PORT=2323 go run .                       # or serve it, then: ssh -p 2323 localhost
```

## edit content

Content lives in two places and has to be changed in both:

- **Web**: the markup in `index.html` (now.log, project files, experience,
  about, contact) and the explorer list at the top of it. The agent's
  scripted answers are in `agent.js`.
- **Terminal**: `sshfolio/app/content.go` and `steps.go`.

Merging them into one source both sides read is the first item in
`docs/direction.md`.

## deploy

See [`deploy/README.md`](deploy/README.md): how to get a shell on the box when
port 22 is taken by the portfolio, the systemd unit, and the one-line update.

## layout

```
index.html style.css           web front end
app.js                         editor: nav, line numbers, filters, terminal, palette
agent.js                       agent panel and its four skins
bean.js                        the mascot
eggs.js                        the three title-bar dots
sshfolio/                      go ssh server + agent (see sshfolio/README.md)
deploy/                        systemd unit, deploy script, server notes
docs/direction.md              why it looks like this and what is next
```
