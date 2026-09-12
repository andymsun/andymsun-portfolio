package app

import (
	"math/rand"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.layout()
		if !m.ready {
			m.ready = true
			cmds = append(cmds, textinput.Blink)
		}

	case tickMsg:
		if time.Now().After(m.statusTo) {
			m.status = ""
		}
		if !m.booting && !m.running() && !m.nudged && time.Since(m.lastKey) > 90*time.Second {
			m.nudged = true
			m.queue = append(m.queue, sayPlain("Still here. /coffee if you need a minute, Ctrl-C twice if you do not."))
		}
		if quit := m.advance(); quit {
			return m, tea.Quit
		}
		cmds = append(cmds, tick())

	case tea.MouseMsg:
		var c tea.Cmd
		m.vp, c = m.vp.Update(msg)
		cmds = append(cmds, c)

	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC:
			if time.Since(m.ctrlC) < 2*time.Second {
				return m, tea.Quit
			}
			m.ctrlC = time.Now()
			m.setStatus("Press Ctrl-C again to exit", 2*time.Second)
			return m, nil
		case tea.KeyCtrlD:
			return m, tea.Quit
		case tea.KeyCtrlL:
			m.transcript = nil
			m.queue = append(m.queue, raw("welcome"))
			return m, nil
		case tea.KeyEsc:
			if m.running() {
				m.skip = true
				return m, nil
			}
			m.in.SetValue("")
			return m, nil
		}
		m.lastKey = time.Now()
		m.nudged = false
		if m.booting {
			return m, nil
		}
		// the konami code: tracked regardless of what the keys otherwise do,
		// so history and typing keep working; on a match the prompt is wiped.
		if !m.running() {
			m.keys = append(m.keys, msg.String())
			if len(m.keys) > len(konami) {
				m.keys = m.keys[len(m.keys)-len(konami):]
			}
			if len(m.keys) == len(konami) && strings.Join(m.keys, " ") == strings.Join(konami, " ") {
				m.keys = nil
				m.in.SetValue("")
				m.histIdx = -1
				m.queue = append(m.queue, m.partySteps()...)
				return m, nil
			}
		}
		items := m.menuItems()
		switch msg.Type {
		case tea.KeyEnter:
			if len(items) > 0 && items[m.menuSel].Name != m.in.Value() {
				m.in.SetValue(items[m.menuSel].Name)
				m.in.CursorEnd()
				return m, nil
			}
			m.submit(m.in.Value())
			return m, nil
		case tea.KeyTab:
			if len(items) > 0 {
				m.in.SetValue(items[m.menuSel].Name)
				m.in.CursorEnd()
			}
			return m, nil
		case tea.KeyUp:
			if len(items) > 0 {
				m.menuSel = (m.menuSel - 1 + len(items)) % len(items)
			} else if len(m.history) > 0 {
				if m.histIdx < len(m.history)-1 {
					m.histIdx++
				}
				m.in.SetValue(m.history[len(m.history)-1-m.histIdx])
				m.in.CursorEnd()
			}
			return m, nil
		case tea.KeyDown:
			if len(items) > 0 {
				m.menuSel = (m.menuSel + 1) % len(items)
			} else if m.histIdx >= 0 {
				m.histIdx--
				if m.histIdx < 0 {
					m.in.SetValue("")
				} else {
					m.in.SetValue(m.history[len(m.history)-1-m.histIdx])
					m.in.CursorEnd()
				}
			}
			return m, nil
		}
		if msg.String() == "?" && m.in.Value() == "" && !m.running() {
			m.submit("/help")
			return m, nil
		}
		if m.running() {
			return m, nil // one thing at a time, like the real one
		}
		var c tea.Cmd
		m.in, c = m.in.Update(msg)
		m.menuSel = 0
		cmds = append(cmds, c)
	default:
		var c tea.Cmd
		m.in, c = m.in.Update(msg)
		cmds = append(cmds, c)
	}

	m.layout()
	return m, tea.Batch(cmds...)
}

func (m *Model) running() bool { return m.cur != nil || len(m.queue) > 0 }

func (m *Model) setStatus(s string, d time.Duration) {
	m.status = s
	m.statusTo = time.Now().Add(d)
}

func (m *Model) submit(text string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return
	}
	m.history = append(m.history, text)
	m.histIdx = -1
	m.in.SetValue("")
	m.menuSel = 0
	m.transcript = append(m.transcript, m.renderUser(text))
	m.queue = append(m.queue, m.handle(text)...)
	m.scrollBottom()
}

// menuItems returns the slash commands matching the prompt, or nil.
func (m *Model) menuItems() []Command {
	v := m.in.Value()
	if !strings.HasPrefix(v, "/") || strings.Contains(v, " ") || m.booting {
		return nil
	}
	var out []Command
	for _, c := range Commands {
		if strings.HasPrefix(c.Name, v) {
			out = append(out, c)
		}
	}
	if m.menuSel >= len(out) {
		m.menuSel = 0
	}
	return out
}

// advance plays the current step forward. Returns true when the program should quit.
func (m *Model) advance() bool {
	for {
		if m.cur == nil {
			if len(m.queue) == 0 {
				return false
			}
			s := m.queue[0]
			m.queue = m.queue[1:]
			m.cur = &s
			m.curStart = time.Now()
			m.curVerb = randVerb()
			if m.party {
				m.curVerb = PartyVerbs[rand.Intn(len(PartyVerbs))]
			}
			m.tokens = 0
			m.in.Blur()
		}
		done, quit := m.stepTick()
		if quit {
			return true
		}
		if !done {
			m.scrollBottom()
			return false
		}
		m.cur = nil
		if !m.running() {
			m.skip = false
			if !m.booting {
				m.in.Focus()
			}
		}
		m.scrollBottom()
	}
}

// stepTick renders the in-progress step into m.live and reports whether it finished.
func (m *Model) stepTick() (done bool, quit bool) {
	s := m.cur
	el := time.Since(m.curStart)
	ms := int(el.Milliseconds())
	switch s.kind {
	case stThink:
		if ms >= s.ms || m.skip {
			m.live = ""
			return true, false
		}
		frame := ms / int(m.p.SpinEvery.Milliseconds())
		m.tokens += (ms*7 + 13) % 41 / 3
		m.live = m.renderSpinner(frame, m.curVerb, ms/1000, m.tokens)
		return false, false
	case stSay:
		r := []rune(s.text)
		n := ms * s.cps / 1000
		if m.skip || n >= len(r) {
			m.live = ""
			m.transcript = append(m.transcript, m.renderAssist(s.text, s.style, false))
			return true, false
		}
		m.live = m.renderAssist(string(r[:n]), s.style, true)
		return false, false
	case stTool:
		if ms >= 300 || m.skip {
			m.live = ""
			m.transcript = append(m.transcript, m.renderTool(s.fn, s.arg, s.res))
			return true, false
		}
		m.live = m.renderToolPending(s.fn, s.arg)
		return false, false
	case stCard:
		m.transcript = append(m.transcript, m.renderCard(s.proj))
		return true, false
	case stRaw:
		m.transcript = append(m.transcript, m.renderRaw(s.text))
		return true, false
	case stPause:
		return ms >= s.ms || m.skip, false
	case stType:
		r := []rune(s.text)
		n := ms / 55
		if m.skip {
			n = len(r)
		}
		if n > len(r) {
			n = len(r)
		}
		m.in.SetValue(string(r[:n]))
		m.in.CursorEnd()
		if n == len(r) && (ms >= len(r)*55+350 || m.skip) {
			m.in.SetValue("")
			m.transcript = append(m.transcript, m.renderUser(s.text))
			return true, false
		}
		return false, false
	case stBootDone:
		m.booting = false
		m.skip = false
		m.in.Placeholder = m.p.Placeholder
		m.in.Focus()
		return true, false
	case stQuit:
		m.quitting = true
		return true, true
	case stAnim:
		if ms >= s.ms || m.skip {
			m.live = ""
			return true, false
		}
		m.live = m.renderAnim(s.text, ms, s.ms)
		return false, false
	}
	return true, false
}
