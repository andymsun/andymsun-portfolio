# andymsun.com

A portfolio that pretends to be a coding agent. It only knows about Andy.

- **Web**: `index.html`, `style.css`, `app.js` in the repo root. A fake terminal
  session that boots, asks itself who Andy is, reads the project files, and
  then hands you the prompt. Slash commands, a completion menu, a spinner with
  silly verbs, cards that unfold out of `Read()` calls, and a character grid
  behind it that reacts to the mouse. No framework, no build step; Vercel serves
  it as static files. `?fast` in the URL skips the animations.
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

The agent's knowledge is a couple of arrays, written twice:

- `app.js` (web): `ABOUT`, `PROJECTS`, `VERBS`, `COMMANDS`, and the replies in `chat()`.
- `sshfolio/app/content.go` and `steps.go` (terminal): the same names.

Change both. Merging them into one JSON file both sides read is the first item
in `docs/direction.md`.

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
