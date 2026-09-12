package app

import (
	"time"

	"sshfolio/ui"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
)

type tickMsg time.Time

const tickEvery = 33 * time.Millisecond

func tick() tea.Cmd {
	return tea.Tick(tickEvery, func(t time.Time) tea.Msg { return tickMsg(t) })
}

type Model struct {
	st            *ui.Styles
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

func NewModel(st *ui.Styles, w, h int) Model {
	in := textinput.New()
	in.Prompt = ""
	in.CharLimit = 200
	in.Cursor.Style = st.Clay
	m := Model{st: st, width: w, height: h, in: in, booting: true, started: time.Now(), histIdx: -1}
	m.queue = bootSteps()
	if w > 0 && h > 0 { // over ssh the size comes from the pty, not a WindowSizeMsg
		m.ready = true
		m.layout()
	}
	return m
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(tea.SetWindowTitle("andy code"), textinput.Blink, tick())
}

func (m Model) uptime() time.Duration { return time.Since(m.started) }
