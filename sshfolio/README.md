# sshfolio

The terminal half of andymsun.com: a Go SSH server (charmbracelet `wish`) that
gives every connection a small "coding agent" that only knows about Andy. Same
prompt box, `⏺` bullets, spinner verbs, slash menu, and `Ctrl-C again to exit`
as the tool it is a homage to.

```bash
go run .              # runs the agent in this terminal (SSH_SERVER_ENABLED=false)
```

Serve it locally on a port that does not need root, then connect:

```bash
PORT=2323 SSH_SERVER_ENABLED=true go run .
ssh -p 2323 localhost
```

## what it does

On connect it plays a short session (welcome box, `who is andy?`, `/projects`
with the project cards), then hands over the prompt. `esc` skips the intro.

| input | does |
|---|---|
| `/` | opens the command menu; `↑` `↓` pick, `tab` or `enter` complete |
| `/about` `/projects` `/contact` `/web` `/help` `/model` `/cost` `/clear` `/exit` | the commands |
| `?` on an empty prompt | `/help` |
| anything else | a keyword-matched reply (try `why ssh?`, `coffee`, `hire`) |
| `esc` | interrupt whatever is streaming |
| `↑` `↓` | prompt history |
| `Ctrl-C` twice, `Ctrl-D`, or `/exit` | leave |

Mouse wheel scrolls the transcript.

## layout

```
main.go          reads .env, picks local or ssh mode
app/content.go   everything the agent knows: about, projects, verbs, commands
app/steps.go     command handlers; each returns a list of steps (think, say, tool, card…)
app/update.go    bubbletea update loop, key handling, step playback
app/view.go      rendering: header, transcript viewport, menu, prompt box, status
app/model.go     model struct, tick timer
app/runner.go    local runner and the wish ssh server
ui/styles.go     palette (same colours as style.css on the web)
ascii-gen/       older script that turns a photo into text art; not used by the agent
```

Content lives in `app/content.go` and is duplicated in `app.js` on the web.
Change both.

## deploy

See `../deploy/README.md`: Docker Compose on the Hetzner box, `ssh andy-vps`
for a shell. `.env` on the server says `PORT=22`; the checked-in file says `23`
so `go run .` works without root. The host key in `.ssh/` is generated on first
start and is deliberately not in git.
