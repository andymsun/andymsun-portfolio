package app

import (
	"fmt"
	"math/rand"
	"strings"
)

// A step is one unit of the agent's output. Handlers return a list of them
// and the model plays them back on a timer so the terminal feels alive.
type stepKind int

const (
	stThink    stepKind = iota // spinner for ms
	stSay                      // stream text at cps
	stTool                     // "⏺ Fn(arg)" then "⎿ result"
	stCard                     // a project card, instantly
	stRaw                      // a pre-rendered block, instantly
	stPause                    // wait ms
	stType                     // type text into the prompt, then submit it
	stBootDone                 // hand the prompt to the user
	stQuit                     // leave
	stAnim                     // an animation in the live slot for ms
	stAgents                   // parallel subagents, then done
	stAsk                      // the feedback prompt; done when answered
)

type step struct {
	kind         stepKind
	text         string
	style        string // "", "ok", "clay" for the ⏺ colour
	ms           int
	cps          int
	fn, arg, res string
	proj         *Project
	agents       []subagent
}

func think(ms int) step             { return step{kind: stThink, ms: ms} }
func say(t string) step             { return step{kind: stSay, text: t, cps: 320} }
func sayAs(t, style string) step    { return step{kind: stSay, text: t, cps: 320, style: style} }
func tool(fn, arg, res string) step { return step{kind: stTool, fn: fn, arg: arg, res: res} }
func card(p *Project) step          { return step{kind: stCard, proj: p} }
func raw(t string) step             { return step{kind: stRaw, text: t} }
func pause(ms int) step             { return step{kind: stPause, ms: ms} }
func typeIn(t string) step          { return step{kind: stType, text: t} }

func randVerb() string { return Verbs[rand.Intn(len(Verbs))] }

// bootSteps is the autoplayed session everyone sees on connect.
func bootSteps() []step {
	s := []step{raw("conn"), pause(600), raw("welcome"), pause(700),
		typeIn("who is andy?"), think(900), say(About[0]), pause(300),
		typeIn("/now"), think(500), tool("Bash", "ps -o pid,stat,tag,cmd", fmt.Sprintf("%d processes", len(Now))), raw("now"),
		sayAs("That is the current state. The prompt is yours: /projects reads the work, / lists everything, or ask me something.", "ok"),
		step{kind: stBootDone}}
	return s
}

// handle turns a submitted line into steps.
func (m *Model) handle(text string) []step {
	text = strings.TrimSpace(text)
	cmd := strings.ToLower(strings.Fields(text + " ")[0])
	switch cmd {
	case "/help", "?":
		return []step{say("Things I can do:"), raw("help"), say("Or just ask something. I only know about Andy, so keep it on topic.")}
	case "/now":
		return []step{think(500), tool("Bash", "ps -o pid,stat,tag,cmd", fmt.Sprintf("%d processes", len(Now))), raw("now")}
	case "/about":
		s := []step{think(900), tool("Read", "about.md", "Read 18 lines")}
		for _, p := range About {
			s = append(s, say(p))
		}
		return append(s, say("For what he is doing right now, /now."))
	case "/projects":
		names := make([]string, len(Projects))
		for i, p := range Projects {
			names[i] = strings.ToLower(p.Name)
		}
		s := []step{think(600), say("Spawning five Explore subagents, one per project."), agents(names...)}
		for i := range Projects {
			p := &Projects[i]
			s = append(s, tool("Read", p.File, fmt.Sprintf("Read %d lines", p.Lines)), card(p))
		}
		return append(s, sayAs("Five entries. Lawvics and Rivendell are the loud ones; sshfolio is the one you are inside of.", "ok"))
	case "/agents":
		return []step{raw("agents")}
	case "/mcp":
		return []step{think(400), raw("mcp")}
	case "/skills":
		return []step{raw("skills")}
	case "/skill":
		name := ""
		if f := strings.Fields(text); len(f) > 1 {
			name = strings.ToLower(f[1])
		}
		switch name {
		case "speedcubing":
			return []step{tool("Skill", "speedcubing", "loaded"), say("3x3, CFOP, sub-20 on a good day. The cube is the only thing on his desk that gets solved on schedule.")}
		case "mandarin":
			return []step{tool("Skill", "mandarin", "loaded"), say("Native. Flushing does that. 你好, and no, this program does not speak it beyond this line.")}
		case "typing":
			return []step{tool("Skill", "typing", "loaded"), say("Fast, and on a tap-dance keyboard layout of his own, because a normal one was not an interesting enough problem.")}
		case "photography":
			return []step{tool("Skill", "photography", "loaded"), say("Film when there is time, phone when there is not. Mostly courts, coffee, and the 7 train.")}
		case "badminton":
			return m.handle("/badminton")
		case "caffeine":
			return m.handle("/coffee")
		}
		return []step{say("Which one? /skills lists them, or /skill <name>.")}
	case "/effort":
		lvl := ""
		if f := strings.Fields(text); len(f) > 1 {
			lvl = strings.ToLower(f[1])
		}
		if _, ok := effortFactor[lvl]; !ok {
			return []step{say("Effort is " + m.effort + ". Levels: low, medium, high, max. Max is called ultrathink and is not faster.")}
		}
		m.effort = lvl
		msg := map[string]string{"low": "Effort: low. Short answers, short spinners.", "medium": "Effort: medium. The default.", "high": "Effort: high. Longer spinners, same Andy.", "max": "Effort: max. Ultrathink engaged. The token counter will now be ridiculous."}[lvl]
		return []step{think(500), say(msg)}
	case "/tab":
		arg := ""
		if f := strings.Fields(text); len(f) > 1 {
			arg = strings.ToLower(f[1])
		}
		switch arg {
		case "new":
			m.newTab()
			return nil
		case "next":
			m.switchTab((m.active + 1) % len(m.tabs))
			return nil
		case "prev":
			m.switchTab((m.active - 1 + len(m.tabs)) % len(m.tabs))
			return nil
		case "close":
			if !m.closeTab() {
				return []step{sayPlain("That is the last tab. Ctrl-C twice leaves.")}
			}
			return nil
		}
		if n := atoiSafe(arg); n >= 1 && n <= len(m.tabs) {
			m.switchTab(n - 1)
			return nil
		}
		return []step{say(fmt.Sprintf("%d tab(s). /tab new, next, prev, close, or a number. Ctrl-T, Ctrl-N, Ctrl-P do the same.", len(m.tabs)))}
	case "/status":
		return []step{raw("status")}
	case "/doctor":
		return []step{think(700), raw("doctor")}
	case "/login":
		return []step{think(900), raw("login")}
	case "/feedback":
		return []step{step{kind: stAsk}}
	case "/inbox":
		if !m.sess.Owner {
			return []step{say("Owner only. Feedback is real and goes to a file Andy reads; connect with his key to see it here.")}
		}
		return []step{tool("Read", feedbackFile, "feedback log"), raw("inbox")}
	case "/contact":
		return []step{think(500), tool("Read", "contact.md", "Read 4 lines"), raw("contact")}
	case "/web":
		return []step{think(500), tool("Bash", "open https://andymsun.com", "cannot open a browser from in here. it is the same agent with more pixels:"), raw("web")}
	case "/agent":
		arg := ""
		if f := strings.Fields(text); len(f) > 1 {
			arg = strings.ToLower(f[1])
		}
		if _, ok := Personas[arg]; !ok {
			return []step{say("Skins for the same agent: claude (the cup), codex, agy. Try \"/agent codex\". You are on " + m.p.Key + ".")}
		}
		m.setPersona(arg)
		return []step{raw("welcome"), say("Now dressed as " + m.p.Name + ". Same Andy underneath.")}
	case "/whoami":
		return []step{think(300), tool("Bash", "whoami; who am i; tput cols lines", "3 commands"), raw("whoami")}
	case "/uptime":
		return []step{tool("Bash", "uptime", "1 line"), raw("uptime")}
	case "/context":
		return []step{raw("context")}
	case "/coffee":
		m.cups++
		return []step{anim("brew", 2600), sayAs(fmt.Sprintf("☕ Brewed. Context window: %d cups.", m.cups), "ok")}
	case "/fortune":
		return []step{tool("Bash", "fortune andy", "1 fortune"), say(Fortunes[rand.Intn(len(Fortunes))])}
	case "/badminton":
		return []step{say("Open gym. You serve."), anim("rally", 5200), sayAs("21–19, Andy. He plays every open gym; you played one rally.", "ok")}
	case "/matrix":
		return []step{anim("matrix", 3200), sayPlain("Wake up, Andy. The statutes have you.")}
	case "/resume":
		return []step{say("Nothing to resume. You were here the whole time.")}
	case "/party":
		return m.partySteps()
	case "/model":
		return []step{say(m.p.Model + ". Context window: two cups of coffee. Knowledge cutoff: whenever he last slept.")}
	case "/cost":
		secs := int(m.uptime().Seconds())
		return []step{say(fmt.Sprintf("Session: %ds wall time, ≈ %.1f coffees, $0.00. Andy is a student; this runs on a €5 VPS.", secs, float64(secs)/900+1))}
	case "/clear":
		m.transcript = nil
		return []step{raw("welcome")}
	case "/exit", "/quit":
		return []step{sayAs("Bye. andymsun.com has the same thing with more pixels.", "clay"), pause(900), step{kind: stQuit}}
	}
	if strings.HasPrefix(text, "/") {
		return []step{say(fmt.Sprintf("Unknown command: %s. /help lists the real ones.", text))}
	}
	if s := m.shell(text); s != nil {
		return s
	}
	return chat(text)
}

func chat(text string) []step {
	t := strings.ToLower(text)
	has := func(ws ...string) bool {
		for _, w := range ws {
			if strings.Contains(t, w) {
				return true
			}
		}
		return false
	}
	th := think(700 + rand.Intn(700))
	switch {
	case has("why ssh", "ssh?", "why a terminal", "why terminal"):
		return []step{th, say("An SSH session is the smallest interface there is: no layout engine, no fonts, no mouse required, a grid of cells. Designing for it forces a decision about what matters. andymsun.com is this same program with more pixels.")}
	case has("coffee"):
		return []step{th, say("Yes. Interests, in order: coffee, coffee, coffee, HCI. He would like you to know the order is a joke, and that it is not.")}
	case has("sleep"):
		return []step{th, say("The bio used to say \"a cs major that does not sleep\". It was removed for being too accurate.")}
	case has("badminton"):
		return []step{th, say("Every open gym. Logistics officer for the UChicago club, which mostly means dues, suppliers, and a live board of who is on which court.")}
	case has("hire", "job", "intern", "recruit", "resume", "cv"):
		return []step{th, say("Good instinct. Email is fastest: andy@andymsun.com. He is a third year, graduating June 2028, and likes teams where he can own a large part of the outcome.")}
	case has("hello", "hi ", "hey", "yo"):
		return []step{th, say("Hi. I am a small Go program pretending to be a coding agent pretending to be Andy. Try /now.")}
	case has("who are you", "what are you", "what is this"):
		return []step{th, say("A terminal agent that only knows about one person. Type / to see what I can do, or ask why ssh.")}
	case has("hci", "interaction", "interface"):
		return []step{th, say("Human–computer interaction is the part he keeps coming back to: making capable systems usable by people who did not build them. Interfaces for models that are not a chat box, and terminals, obviously.")}
	case has("claude", "anthropic", "copy"):
		return []step{th, say("Inspired by, not affiliated with. The prompt box, the ⏺ bullets, and the spinner verbs are a homage. The content is all Andy.")}
	}
	return []step{th, say("I only know things about Andy. Try /now, /projects, or ask \"why ssh?\"")}
}

// partySteps is what the Konami code (or /party) does.
func (m *Model) partySteps() []step {
	if m.party {
		m.party = false
		return []step{sayPlain("Party off. The verbs are calm again.")}
	}
	m.party = true
	return []step{anim("confetti", 2200), sayAs("↑↑↓↓←→←→BA. Andy mode. The header is a rainbow now and the spinner has lost its mind. /party turns it off.", "clay")}
}

func atoiSafe(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return -1
		}
		n = n*10 + int(c-'0')
	}
	if s == "" {
		return -1
	}
	return n
}
