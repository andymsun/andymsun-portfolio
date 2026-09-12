package app

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

// ---- argument completion ---------------------------------------------------

// ArgOptions are the completions offered after a command and a space.
var ArgOptions = map[string][]Command{
	"/agent":  {{"claude", "the cup"}, {"codex", ">_ and a › prompt"}, {"agy", "antigravity, gradient wordmark"}},
	"/effort": {{"low", "quick answers"}, {"medium", "the default"}, {"high", "thinks longer"}, {"max", "ultrathink"}},
	"/tab":    {{"new", "open a tab"}, {"next", "switch forward"}, {"prev", "switch back"}, {"close", "close this tab"}},
	"/skill":  {{"speedcubing", "sub-20, most days"}, {"mandarin", "native"}, {"typing", "fast, tap-dance layout"}, {"photography", "film and phone"}, {"badminton", "every open gym"}, {"caffeine", "load-bearing"}},
}

// argHint is the dim placeholder shown after a bare command that takes arguments.
func argHint(cmd string) string {
	opts, ok := ArgOptions[cmd]
	if !ok {
		return ""
	}
	names := make([]string, len(opts))
	for i, o := range opts {
		names[i] = o.Name
	}
	return " <" + strings.Join(names, "|") + ">"
}

// ---- effort ---------------------------------------------------------------

var effortFactor = map[string]float64{"low": 0.35, "medium": 1, "high": 2, "max": 3.5}

// ---- subagents ------------------------------------------------------------

type subagent struct {
	name  string
	files int
	ms    int // when it finishes, from the step start
}

func agents(names ...string) step {
	s := step{kind: stAgents}
	for _, n := range names {
		s.agents = append(s.agents, subagent{name: n, files: 1 + rand.Intn(4), ms: 900 + rand.Intn(1600)})
	}
	return s
}

func (m *Model) renderAgents(ag []subagent, ms int, final bool) string {
	st := m.st
	var b strings.Builder
	for i, a := range ag {
		if i > 0 {
			b.WriteString("\n")
		}
		done := ms >= a.ms || final
		dot := st.Dim.Render(m.p.ToolDot)
		if done {
			dot = st.Ok.Render(m.p.ToolDot)
		}
		b.WriteString(dot + " " + st.Bold.Render("Task") + "(" + st.Dim.Render("Explore "+a.name) + ")\n")
		if done {
			b.WriteString("  " + st.Dimmer.Render(m.p.ResMark) + " " + st.Dim.Render(fmt.Sprintf("Done (%d files · %.1fk tokens)", a.files, float64(a.files)*0.4+0.3)))
		} else {
			g := m.p.Glyphs[(ms/int(m.p.SpinEvery.Milliseconds())+i*3)%len(m.p.Glyphs)]
			b.WriteString("  " + st.Dimmer.Render(m.p.ResMark) + " " + st.Clay.Render(g) + " " + st.Dim.Render(fmt.Sprintf("Reading… (%ds · %d files)", ms/1000, a.files)))
		}
	}
	return b.String()
}

// ---- feedback -------------------------------------------------------------

func (m *Model) renderAsk() string {
	st := m.st
	k := func(s string) string { return st.Clay.Render(s) }
	body := st.Fg.Render("How is "+m.p.Name+" doing this session?") + st.Dim.Render(" (optional)") + "\n" +
		k("1") + st.Dim.Render(": Bad   ") + k("2") + st.Dim.Render(": Fine   ") + k("3") + st.Dim.Render(": Good   ") + k("0") + st.Dim.Render(": Dismiss")
	return st.Box.BorderForeground(st.DimmerColor).Render(body)
}

func feedbackReply(rating string) []step {
	switch rating {
	case "1":
		return []step{sayAs("Noted, and logged for real. Andy reads these. If it is fixable, it will be.", "clay")}
	case "2":
		return []step{say("Fine is honest. Logged. The web version has more pixels if that helps.")}
	case "3":
		return []step{sayAs("Thanks. Logged, and that one goes on the fridge.", "ok")}
	}
	return []step{sayPlain("Dismissed.")}
}

// ---- raw blocks: mcp, skills, agents roster, status, doctor, login ------------

func (m *Model) renderMore(kind string) (string, bool) {
	st := m.st
	ok := st.Ok.Render("✓")
	no := st.Clay.Render("✗")
	dim := st.Dim.Render
	switch kind {
	case "mcp":
		rows := []string{
			ok + " " + st.Bold.Render("coffee-machine") + dim("     connected · 3 tools (brew, refill, regret)"),
			ok + " " + st.Bold.Render("badminton-court") + dim("    connected · 2 tools (serve, rally)"),
			ok + " " + st.Bold.Render("hetzner") + dim("            connected · 1 tool (uptime)"),
			ok + " " + st.Bold.Render("github") + dim("             connected · 4 tools · github.com/andymsun"),
			no + " " + st.Bold.Render("uchicago-canvas") + dim("    needs authentication · /login"),
			no + " " + st.Bold.Render("sleep") + dim("              failed to connect (ENOENT)"),
		}
		return st.Fg.Render("MCP servers") + "\n" + strings.Join(rows, "\n") + "\n" + dim("4 connected · 2 not. tools are called with /coffee, /badminton, /uptime."), true
	case "skills":
		var rows []string
		for _, s := range ArgOptions["/skill"] {
			rows = append(rows, "  "+st.Clay.Render(fmt.Sprintf("%-13s", s.Name))+dim(s.Desc))
		}
		return st.Fg.Render("Skills") + dim(" (user-invocable: /skill <name>)") + "\n" + strings.Join(rows, "\n"), true
	case "agents":
		rows := []string{
			"  " + st.Clay.Render("Explore   ") + dim("reads project files in parallel · used by /projects"),
			"  " + st.Clay.Render("Auditor   ") + dim("checks citations and repealed statutes · from Lawvics"),
			"  " + st.Clay.Render("Barista   ") + dim("brews · /coffee"),
			"  " + st.Clay.Render("Plan      ") + dim("makes a plan, then Andy ignores it and ships"),
			"  " + st.Clay.Render("Sleep     ") + dim("never spawns"),
		}
		return st.Fg.Render("Agents") + "\n" + strings.Join(rows, "\n"), true
	case "status":
		return st.Bold.Render(m.p.Name) + dim(" v0.3 · "+m.p.Model) + "\n" +
			dim("account   ") + st.Fg.Render("andy@andymsun.com") + dim(" · plan: student (free) · org: uchicago") + "\n" +
			dim("effort    ") + st.Fg.Render(m.effort) + "\n" +
			dim("context   ") + st.Fg.Render(fmt.Sprintf("%d cups", m.cups)) + "\n" +
			dim("mcp       ") + st.Fg.Render("4 connected, 2 not") + "\n" +
			dim("tabs      ") + st.Fg.Render(fmt.Sprintf("%d", len(m.tabs))) + "\n" +
			dim("uptime    ") + st.Fg.Render(humanDuration(time.Since(serverStart))) + "\n" +
			dim("visitor   ") + st.Fg.Render(fmt.Sprintf("#%d", m.sess.Visitor)) + func() string {
			if m.sess.Owner {
				return dim(" · ") + st.Ok.Render("owner key")
			}
			return ""
		}(), true
	case "doctor":
		rows := []string{
			ok + dim(" coffee: 2 cups, warm"),
			ok + dim(" port 22: this"),
			ok + dim(" terminal: ") + st.Fg.Render(fmt.Sprintf("%d×%d", m.width, m.height)),
			ok + dim(" host key: unchanged since day one"),
			no + dim(" sleep: not found"),
			no + dim(" free time: not found"),
			ok + dim(" badminton: scheduled"),
		}
		return st.Fg.Render("Diagnostics") + "\n" + strings.Join(rows, "\n") + "\n" + dim("5 ok, 2 expected."), true
	case "login":
		return dim("Opening browser to https://andymsun.com/login …") + "\n" +
			dim("(there is no browser. there is no login.)") + "\n" +
			ok + " " + st.Fg.Render("Logged in as ") + st.Bold.Render("guest") + dim(" · you were already."), true
	}
	return "", false
}

// ---- tabs ------------------------------------------------------------------

// tabState is everything that belongs to one tab. The active tab lives in the
// Model's own fields; switching tabs swaps them in and out.
type tabState struct {
	transcript []string
	p          Persona
	cups       int
	party      bool
	history    []string
	queue      []step
	cur        *step
	curStart   time.Time
	curVerb    string
	tokens     int
	live       string
	booting    bool
	effort     string
	yoff       int
}

func (m *Model) saveTab() tabState {
	return tabState{transcript: m.transcript, p: m.p, cups: m.cups, party: m.party, history: m.history,
		queue: m.queue, cur: m.cur, curStart: m.curStart, curVerb: m.curVerb, tokens: m.tokens, live: m.live,
		booting: m.booting, effort: m.effort, yoff: m.vp.YOffset}
}

func (m *Model) loadTab(t tabState) {
	m.transcript, m.p, m.cups, m.party, m.history = t.transcript, t.p, t.cups, t.party, t.history
	m.queue, m.cur, m.curStart, m.curVerb, m.tokens, m.live = t.queue, t.cur, t.curStart, t.curVerb, t.tokens, t.live
	m.booting, m.effort = t.booting, t.effort
	m.setStyles()
	m.in.SetValue("")
	m.histIdx = -1
	m.layout()
	m.vp.SetYOffset(t.yoff)
}

func (m *Model) setStyles() {
	m.st = newStyles(m.r, m.p)
	m.in.Cursor.Style = m.st.Clay
	m.in.Placeholder = m.p.Placeholder
}

func (m *Model) newTab() {
	m.tabs[m.active] = m.saveTab()
	fresh := tabState{p: m.p, cups: 2, effort: "medium", queue: []step{raw("welcome"), sayPlain(fmt.Sprintf("Tab %d. Ctrl-N and Ctrl-P switch, /tab close closes.", len(m.tabs)+1))}}
	m.tabs = append(m.tabs, fresh)
	m.active = len(m.tabs) - 1
	m.loadTab(fresh)
}

func (m *Model) switchTab(i int) {
	if i < 0 || i >= len(m.tabs) || i == m.active {
		return
	}
	m.tabs[m.active] = m.saveTab()
	m.active = i
	m.loadTab(m.tabs[i])
}

func (m *Model) closeTab() bool {
	if len(m.tabs) == 1 {
		return false
	}
	m.tabs = append(m.tabs[:m.active], m.tabs[m.active+1:]...)
	if m.active >= len(m.tabs) {
		m.active = len(m.tabs) - 1
	}
	m.loadTab(m.tabs[m.active])
	return true
}

func (m *Model) renderTabs() string {
	if len(m.tabs) <= 1 {
		return ""
	}
	var parts []string
	for i := range m.tabs {
		p := m.tabs[i].p
		if i == m.active {
			p = m.p
		}
		label := fmt.Sprintf(" %d %s ", i+1, p.Name)
		if i == m.active {
			parts = append(parts, m.r.NewStyle().Foreground(lipgloss.Color("#121211")).Background(m.st.ClayColor).Render(label))
		} else {
			parts = append(parts, m.st.Dim.Render(label))
		}
	}
	return strings.Join(parts, " ")
}
