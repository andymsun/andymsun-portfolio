# andymsun.com

A portfolio that pretends to be a coding agent. It only knows about Andy.

- **Web**: `index.html`, `style.css`, `app.js` in the repo root. An ordinary
  scrollable page with a nav, sections, filter buttons, and expandable cards:
  nothing is hidden behind a command, and every word is in the markup, so it
  reads fine with JavaScript off. The terminal sits in the hero as a *demo*
  that plays itself and can be typed into; its commands scroll the real page
  rather than replacing it. No framework, no build step; Vercel serves it as
  static files. `?fast` in the URL skips the animations.
- **Terminal**: `sshfolio/`, the same agent in Go, served over ssh. Runs on a
  small Hetzner VPS on port 22, so `ssh ssh.andymsun.com` is the whole install.

Both are a homage to the Claude Code CLI: the prompt box, the `⏺` bullets, the
`⎿` tool results, `Ctrl-C again to exit`. Not affiliated.

## run the terminal version locally

```bash
cd sshfolio
SSH_SERVER_ENABLED=false go run .        # in this terminal
PORT=2323 go run .                       # or serve it, then: ssh -p 2323 localhost
```

## edit content

Content lives in two places and has to be changed in both:

- **Web**: the markup in `index.html` (Now list, project cards, experience
  timeline, about, contact). `app.js` only holds the short demo script.
- **Terminal**: `sshfolio/app/content.go` and `steps.go`.

Merging them into one source both sides read is the first item in
`docs/direction.md`.

## deploy

See [`deploy/README.md`](deploy/README.md): how to get a shell on the box when
port 22 is taken by the portfolio, the systemd unit, and the one-line update.

## layout

```
index.html style.css app.js    web front end
sshfolio/                      go ssh server + agent (see sshfolio/README.md)
deploy/                        systemd unit, deploy script, server notes
docs/direction.md              why it looks like this and what is next
```
