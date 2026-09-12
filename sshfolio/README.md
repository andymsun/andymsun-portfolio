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
| `/now` `/experience` `/about` `/projects` `/contact` `/web` `/help` `/model` `/cost` `/clear` `/exit` | the commands. `/experience` (also `git log`, `cat resume.md`, `/cv`) is every job, research post, cohort, program, honor, and high-school role, drawn like git log |
| `/agent claude` `/agent codex` `/agent agy` | reskin the session: the cup, the `>_` box, or the gradient wordmark |
| `/whoami` `/uptime` `/context` | honest tool calls: what the server sees, real uptime and visitor counts, a context bar that fills as you talk |
| `/coffee` `/badminton` `/matrix` `/fortune` | brew a cup (adds a cup to your context), one rally, three seconds of rain, a small truth |
| `ls` `cat about.md` `pwd` `cd` `sudo …` `rm -rf /` `vim` `git status` `top` `ping` `neofetch` `man andy` `date` `echo` `exit` | it is not a shell, but it answers like one |
| `↑↑↓↓←→←→BA` or `/party` | rainbow header, confetti, unhinged spinner verbs; again to stop |
| `/projects` | opens a picker (↑↓, enter, esc, digits): fourteen projects with a status dot, green shipped or active, yellow in progress or paused, red abandoned. `/projects <name>` opens one; `/projects all` spawns a subagent per project and reads every file |
| `/config` `/model`, and `/agent` `/effort` `/tab` `/skill` with no argument | the same tiny menu; `/config` rows cycle in place (skin, effort, party, status hints, cups) |
| `/agents` `/mcp` `/skills` `/skill <name>` `/status` `/doctor` `/login` | the roster, connected servers, skills, account and session, diagnostics, a login that isn't |
| `/effort low|medium|high|max` | scales thinking time; `max` is ultrathink and shows in the spinner |
| `/tab new|next|prev|close|N`, `Ctrl-T` `Ctrl-N` `Ctrl-P` | tabs, each with its own transcript and skin; strip in the header |
| `/feedback`, or every fifth command | "How is andy code doing this session? 1: Bad 2: Fine 3: Good 0: Dismiss", then an optional comment. Real: each answer is a JSON line in `.ssh/feedback.log` |
| `/inbox` | the feedback log, newest first. Owner only: the server compares the visitor's ssh key with `.ssh/owner.pub` |
| `/agent `, `/effort `, `/tab `, `/skill ` then Tab | argument completion; a bare command shows a dim `<a|b|c>` hint |
| `Ctrl-L` | clear |
| ninety seconds of silence | it checks on you once |
| `?` on an empty prompt | `/help` |
| anything else | a keyword-matched reply (try `why ssh?`, `coffee`, `hire`) |
| `esc` | interrupt whatever is streaming |
| `↑` `↓` | prompt history |
| `Ctrl-C` twice, `Ctrl-D`, or `/exit` | leave |

Mouse wheel scrolls the transcript.

## layout

```
main.go          reads .env, picks local or ssh mode
app/content.go   everything the agent knows: about, /now, projects, verbs, commands
app/persona.go   the three skins (claude with the cup, codex, agy) and the cup frames
app/eggs.go      fake shell, animations (brew, rally, matrix, confetti), fortunes, neofetch, visitor counter
app/more.go      argument completion, effort, subagents, feedback prompt, mcp/skills/status/doctor/login, tabs
app/picker.go    the tiny menu: project, agent, model, effort, skill, tab, and config pickers
app/feedback.go  the feedback log (write, read, /inbox)
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

## feedback

Ratings and comments are written to `.ssh/feedback.log` on the server, one JSON
line each (time, visitor number, ssh user, address, skin, rating, comment,
session length, command count). Read them either way:

```bash
ssh ssh.andymsun.com          # from a machine whose key is in .ssh/owner.pub, then /inbox
ssh andy-vps cat /opt/portfolio/sshfolio/.ssh/feedback.log
```

Auth is deliberately open: any key is accepted and keyless clients fall through
to keyboard-interactive, which also succeeds. The key is only used to recognise
the owner.

## deploy

See `../deploy/README.md`: Docker Compose on the Hetzner box, `ssh andy-vps`
for a shell. `.env` on the server says `PORT=22`; the checked-in file says `23`
so `go run .` works without root. The host key in `.ssh/` is generated on first
start and is deliberately not in git.
