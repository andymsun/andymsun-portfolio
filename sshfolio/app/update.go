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
		case tea.KeyCtrlT:
			if !m.booting {
				m.newTab()
			}
			return m, nil
		case tea.KeyCtrlN:
			m.switchTab((m.active + 1) % len(m.tabs))
			return m, nil
		case tea.KeyCtrlP:
			m.switchTab((m.active - 1 + len(m.tabs)) % len(m.tabs))
			return m, nil
		case tea.KeyEsc:
			if m.pick != nil { // close the picker, nothing else
				m.pick = nil
				m.live = ""
				return m, nil
			}
			if m.ask { // esc dismisses the rating prompt
				m.ask = false
				m.live = ""
				m.transcript = append(m.transcript, m.st.Dim.Render("(rating dismissed)"))
				return m, nil
			}
			if m.running() {
				m.skip = true
				return m, nil
			}
			m.in.SetValue("")
			return m, nil
		}
		if m.pick != nil { // a picker owns the keys until closed
			p := m.pick
			k := msg.String()
			switch {
			case k == "up" || k == "k" || k == "shift+tab":
				p.Sel = (p.Sel - 1 + len(p.Items)) % len(p.Items)
			case k == "down" || k == "j" || k == "tab":
				p.Sel = (p.Sel + 1) % len(p.Items)
			case k == "esc" || k == "q":
				m.pick = nil
			case k == "enter" || k == " ":
				it := p.Items[p.Sel]
				if it.Cycle != nil {
					it.Cycle(&m)
					if p.Rebuild != nil {
						p.Items = p.Rebuild(&m)
					}
				} else if it.Run != nil {
					m.pick = nil
					m.live = ""
					m.transcript = append(m.transcript, m.st.Dim.Render("› "+it.Label))
					if steps := it.Run(&m); steps != nil {
						m.queue = append(steps, m.queue...)
					}
				}
			case len(k) == 1 && k[0] >= '1' && k[0] <= '9' && int(k[0]-'1') < len(p.Items):
				p.Sel = int(k[0] - '1')
			}
			return m, nil
		}
		if m.ask { // the feedback prompt owns the keys until answered
			k := msg.String()
			if k == "0" || k == "1" || k == "2" || k == "3" {
				m.ask = false
				m.live = ""
				m.transcript = append(m.transcript, m.renderAsk()+"\n"+m.st.Dim.Render("> "+k))
				if k == "0" {
					m.queue = append(feedbackReply(k), m.queue...)
				} else {
					m.pendingRating = k
					m.awaitComment = true
					m.queue = append([]step{sayPlain("Anything to add? Type it and press Enter, or Enter alone to skip. Andy reads these.")}, m.queue...)
				}
			}
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
			if m.awaitComment && !m.running() { // the optional comment after a rating
				comment := strings.TrimSpace(m.in.Value())
				m.in.SetValue("")
				m.awaitComment = false
				m.writeFeedback(m.pendingRating, comment)
				if comment != "" {
					m.transcript = append(m.transcript, m.renderUser(comment))
				}
				m.queue = append(m.queue, feedbackReply(m.pendingRating)...)
				m.pendingRating = ""
				return m, nil
			}
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
	m.cmdCount++
	if m.cmdCount%5 == 0 { // like the real one: an occasional rating prompt
		m.queue = append(m.queue, step{kind: stAsk})
	}
	m.scrollBottom()
}

// menuItems returns the slash commands matching the prompt, or nil.
func (m *Model) menuItems() []Command {
	v := m.in.Value()
	if !strings.HasPrefix(v, "/") || m.booting {
		return nil
	}
	var out []Command
	if i := strings.Index(v, " "); i > 0 { // argument completion: "/agent co" -> "/agent codex"
		cmd, rest := v[:i], strings.TrimLeft(v[i:], " ")
		for _, o := range ArgOptions[cmd] {
			if strings.HasPrefix(o.Name, rest) {
				out = append(out, Command{cmd + " " + o.Name, o.Desc, ""})
			}
		}
		if m.menuSel >= len(out) {
			m.menuSel = 0
		}
		return out
	}
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
		total := int(float64(s.ms) * effortFactor[m.effort])
		if m.effort == "max" && !strings.HasPrefix(m.curVerb, "Ultrathinking") {
			m.curVerb = "Ultrathinking about " + strings.ToLower(m.curVerb)
		}
		if ms >= total || m.skip {
			m.live = ""
			return true, false
		}
		frame := ms / int(m.p.SpinEvery.Milliseconds())
		m.tokens += (ms*7 + 13) % 41 / 3
		if m.effort == "max" {
			m.tokens += 97
		}
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
	case stAgents:
		last := 0
		for _, a := range s.agents {
			if a.ms > last {
				last = a.ms
			}
		}
		if ms >= last+200 || m.skip {
			m.live = ""
			m.transcript = append(m.transcript, m.renderAgents(s.agents, ms, true))
			return true, false
		}
		m.live = m.renderAgents(s.agents, ms, false)
		return false, false
	case stPick:
		if m.pick == nil && ms < 50 { // just arrived
			m.pick = s.pick
			m.in.Blur()
		}
		if m.pick == nil { // closed
			m.live = ""
			return true, false
		}
		m.live = m.renderPicker(m.pick)
		return false, false
	case stAsk:
		if !m.ask && ms < 50 { // just arrived
			m.ask = true
		}
		if !m.ask { // answered by a key
			m.live = ""
			return true, false
		}
		m.live = m.renderAsk()
		m.in.Blur()
		return false, false
	}
	return true, false
}
