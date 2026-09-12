package app

import (
	"time"

	"sshfolio/ui"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type tickMsg time.Time

const tickEvery = 33 * time.Millisecond

func tick() tea.Cmd {
	return tea.Tick(tickEvery, func(t time.Time) tea.Msg { return tickMsg(t) })
}

type Model struct {
	st            *ui.Styles
	r             *lipgloss.Renderer
	p             Persona
	sess          Session
	cups          int
	effort        string
	ask           bool
	pendingRating string // set after a rating, while we wait for an optional comment
	awaitComment  bool
	cmdCount      int
	tabs          []tabState
	active        int
	party         bool
	lastKey       time.Time
	nudged        bool
	keys          []string // recent key names, for the konami code
	width, height int
	ready         bool

	vp         viewport.Model
	in         textinput.Model
	transcript []string // finalized blocks, already rendered
	live       string   // the block being animated right now

	queue    []step
	cur      *step
	curStart time.Time
	curVerb  string
	tokens   int

	menuSel  int
	history  []string
	histIdx  int
	ctrlC    time.Time
	status   string
	statusTo time.Time
	booting  bool
	skip     bool
	quitting bool
	started  time.Time
}

func NewModel(r *lipgloss.Renderer, w, h int, sess Session) Model {
	p := Personas["claude"]
	st := ui.NewStyles(r, p.Accent, p.Ok)
	in := textinput.New()
	in.Prompt = ""
	in.CharLimit = 200
	in.Cursor.Style = st.Clay
	m := Model{st: st, r: r, p: p, sess: sess, cups: 2, effort: "medium", width: w, height: h, in: in, booting: true, started: time.Now(), lastKey: time.Now(), histIdx: -1}
	m.queue = bootSteps()
	m.tabs = []tabState{{}} // the active tab's state lives on the model; this is its slot
	if w > 0 && h > 0 {     // over ssh the size comes from the pty, not a WindowSizeMsg
		m.ready = true
		m.layout()
	}
	return m
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(tea.SetWindowTitle("andy code"), textinput.Blink, tick())
}

func (m Model) uptime() time.Duration { return time.Since(m.started) }

// setPersona re-skins the session: new styles, new welcome, same Andy.
func (m *Model) setPersona(key string) {
	m.p = Personas[key]
	m.setStyles()
	m.transcript = nil
}

func newStyles(r *lipgloss.Renderer, p Persona) *ui.Styles { return ui.NewStyles(r, p.Accent, p.Ok) }
