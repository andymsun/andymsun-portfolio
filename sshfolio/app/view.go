package app

import (
	"fmt"
	"strings"

	"time"

	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
	"github.com/muesli/reflow/wordwrap"
)

const welcomeMark = "\x00welcome" // replaced at render time so the cup can steam

// live holds the block currently being animated (spinner, streaming text).
// It is a field on Model but kept here with the rendering code.
func (m *Model) textWidth() int {
	w := m.width - 4
	if w < 20 {
		w = 20
	}
	if w > 88 {
		w = 88
	}
	return w
}

func (m *Model) layout() {
	if m.width == 0 || m.height == 0 {
		return
	}
	menuH := len(m.menuItems())
	if menuH > 0 {
		menuH++ // a blank line above the menu
	}
	h := m.height - 1 /*header*/ - 1 /*rule*/ - menuH - 3 /*box*/ - 1 /*status*/
	if h < 3 {
		h = 3
	}
	if !m.ready || m.vp.Width == 0 {
		m.vp = viewport.New(m.width, h)
		m.vp.MouseWheelEnabled = true
	} else {
		m.vp.Width = m.width
		m.vp.Height = h
	}
	m.in.Width = m.width - 10
	m.vp.SetContent(m.content())
}

func (m *Model) content() string {
	parts := make([]string, 0, len(m.transcript)+1)
	for _, t := range m.transcript {
		if t == welcomeMark {
			t = m.renderWelcome(time.Now())
		}
		parts = append(parts, t)
	}
	if m.live != "" {
		parts = append(parts, m.live)
	}
	return " " + strings.ReplaceAll(strings.Join(parts, "\n\n"), "\n", "\n ") + "\n"
}

func (m *Model) scrollBottom() {
	m.vp.SetContent(m.content())
	m.vp.GotoBottom()
}

func (m Model) View() string {
	if !m.ready {
		return ""
	}
	if m.quitting {
		return ""
	}
	st := m.st
	var b strings.Builder

	// header
	left := " " + st.Clay.Render(m.p.Star) + " " + st.Bold.Render(m.p.Title)
	if m.party {
		left = " " + gradient(m.r, m.p.Star+" "+m.p.Title, "#f87171", "#facc15", "#7fb069", "#7aa2f7", "#9b72cb")
	}
	right := m.renderRuler() + "  " + st.Dim.Render("andymsun.com") + " "
	if tabs := m.renderTabs(); tabs != "" {
		right = tabs + "  " + right
	}
	gap := m.width - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	b.WriteString(left + strings.Repeat(" ", gap) + right + "\n")
	b.WriteString(st.Dimmer.Render(strings.Repeat("─", m.width)) + "\n")

	// transcript
	b.WriteString(m.vp.View() + "\n")

	// slash menu: a window of eight rows around the selection
	if items := m.menuItems(); len(items) > 0 {
		b.WriteString("\n")
		start := 0
		if len(items) > 8 && m.menuSel > 3 {
			start = m.menuSel - 3
			if start > len(items)-8 {
				start = len(items) - 8
			}
		}
		end := start + 8
		if end > len(items) {
			end = len(items)
		}
		if len(items) > 8 {
			b.WriteString("   " + st.Dimmer.Render(fmt.Sprintf("↑↓ · %d of %d · keep typing to filter", m.menuSel+1, len(items))) + "\n")
		}
		for i := start; i < end; i++ {
			c := items[i]
			pad := 16 - len([]rune(c.Name))
			if pad < 1 {
				pad = 1
			}
			name := c.Name + strings.Repeat(" ", pad)
			if i == m.menuSel {
				b.WriteString("   " + st.Clay.Render(name) + st.Fg.Render(c.Desc) + "\n")
			} else {
				b.WriteString("   " + st.Fg.Render(name) + st.Dim.Render(c.Desc) + "\n")
			}
		}
	}

	// prompt box
	box := st.Box
	if m.running() {
		box = box.BorderForeground(st.DimmerColor)
	} else {
		box = box.BorderForeground(st.ClayColor)
	}
	// a dim argument hint after a bare command that takes one, e.g. /agent <claude|codex|agy>
	inView := m.in.View()
	if v := m.in.Value(); !m.running() && !strings.Contains(v, " ") && argHint(v) != "" {
		in := m.in
		in.Width = lipgloss.Width(v) + 1
		inView = in.View() + st.Dimmer.Render(argHint(v))
	}
	b.WriteString(box.Width(m.width-4).Render(st.Dim.Render(m.p.Prompt+" ")+inView) + "\n")

	// status line
	l := " " + st.Dimmer.Render("? for shortcuts")
	if m.sess.Visitor > 0 && !m.booting {
		l += st.Dimmer.Render(fmt.Sprintf("   visitor #%d", m.sess.Visitor))
	}
	var r string
	switch {
	case m.status != "":
		r = st.Clay.Render(m.status)
	case m.pick != nil:
		r = st.Dimmer.Render("↑↓ enter esc")
	case m.ask:
		r = st.Dimmer.Render("0–3 to answer")
	case m.booting:
		r = st.Dimmer.Render("esc to skip")
	case m.running():
		r = st.Dimmer.Render("esc to interrupt")
	default:
		r = st.Dimmer.Render("the real thing is on the web too: andymsun.com")
	}
	if m.quietStatus && m.pick == nil && !m.ask {
		r = ""
	}
	gap = m.width - lipgloss.Width(l) - lipgloss.Width(r) - 1
	if gap < 1 {
		gap = 1
	}
	b.WriteString(l + strings.Repeat(" ", gap) + r)
	return b.String()
}

// ---- block renderers ------------------------------------------------------

func wrap(s string, w int) string { return wordwrap.String(s, w) }

// hang renders text with a two-cell hanging indent after a bullet.
func hang(bullet, text string, w int) string {
	lines := strings.Split(wrap(text, w-2), "\n")
	for i, l := range lines {
		if i == 0 {
			lines[i] = bullet + l
		} else {
			lines[i] = "  " + l
		}
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderUser(text string) string {
	return hang(m.st.Dimmer.Render("> "), m.st.Dim.Render(text), m.textWidth())
}

func (m *Model) renderAssist(text, style string, streaming bool) string {
	if streaming {
		text += "▌"
	}
	if style == "plain" { // shell output: no bullet, dimmer
		return wrap(m.st.Dim.Render(text), m.textWidth())
	}
	if m.p.Bullet == "" { // codex: a dim label line, no bullet
		return m.st.Dim.Render(m.p.Label) + "\n" + wrap(m.st.Fg.Render(text), m.textWidth())
	}
	dot := m.st.Fg.Render(m.p.Bullet)
	switch style {
	case "ok":
		dot = m.st.Ok.Render(m.p.Bullet)
	case "clay":
		dot = m.st.Clay.Render(m.p.Bullet)
	}
	return hang(dot+" ", m.st.Fg.Render(text), m.textWidth())
}

func (m *Model) renderSpinner(frame int, verb string, secs, tokens int) string {
	g := m.st.Clay.Render(m.p.Glyphs[frame%len(m.p.Glyphs)])
	if m.p.Key != "codex" {
		verb += "…"
	}
	meta := m.p.SpinnerMeta(secs, tokens)
	if m.effort != "medium" {
		meta += m.st.Dimmer.Render(" · effort: " + m.effort)
	}
	return g + " " + m.st.Fg.Render(verb) + " " + m.st.Dim.Render(meta)
}

func (m *Model) toolLabel(fn, arg string) string {
	name, rest := m.p.ToolCall(fn, arg)
	if rest == "" { // claude style: Read(file)
		i := strings.Index(name, "(")
		return m.st.Bold.Render(name[:i]) + "(" + m.st.Dim.Render(name[i+1:len(name)-1]) + ")"
	}
	return m.st.Bold.Render(name) + " " + m.st.Dim.Render(rest)
}

func (m *Model) renderToolPending(fn, arg string) string {
	return m.st.Dim.Render(m.p.ToolDot) + " " + m.toolLabel(fn, arg)
}

func (m *Model) renderTool(fn, arg, res string) string {
	return m.st.Ok.Render(m.p.ToolDot) + " " + m.toolLabel(fn, arg) + "\n" +
		"  " + m.st.Dimmer.Render(m.p.ResMark) + " " + m.st.Dim.Render(res)
}

func (m *Model) renderCard(p *Project) string {
	w := m.textWidth() - 6
	if w > 64 {
		w = 64
	}
	var b strings.Builder
	title := m.st.Bold.Render(p.Name)
	year := m.st.Dim.Render(p.Year)
	gap := w - lipgloss.Width(title) - lipgloss.Width(year)
	_ = gap
	if gap < 1 {
		gap = 1
	}
	b.WriteString(title + strings.Repeat(" ", gap) + year + "\n")
	if p.Status != "" {
		b.WriteString(m.dotStyle(statusDot(p.Status)) + " " + m.st.Dim.Render(p.Status) + "\n")
	}
	b.WriteString(m.st.Clay.Render(wrap(p.Blurb, w)) + "\n\n")
	b.WriteString(m.st.Fg.Render(wrap(p.Body, w)))
	b.WriteString("\n\n" + m.st.Dim.Render(wrap(strings.Join(p.Stack, " · "), w)))
	if len(p.Links) > 0 {
		var ls []string
		for _, l := range p.Links {
			ls = append(ls, m.st.Fg.Render(l[0])+" "+m.st.Dim.Render(l[1]))
		}
		b.WriteString("\n" + strings.Join(ls, "   "))
	}
	return "   " + strings.ReplaceAll(m.st.Card.Width(w+2).Render(b.String()), "\n", "\n   ")
}

func (m *Model) renderRaw(kind string) string {
	st := m.st
	if out, ok := m.renderEgg(kind); ok {
		return out
	}
	if out, ok := m.renderMore(kind); ok {
		return out
	}
	if kind == "inbox" {
		return m.renderInbox()
	}
	if kind == "experience" {
		return m.renderExperience()
	}
	switch kind {
	case "conn":
		return st.Dim.Render("$ ssh ssh.andymsun.com") + "\n" +
			st.Dimmer.Render("Connected to ssh.andymsun.com (178.156.231.94), port 22.") + "\n" +
			st.Dimmer.Render("andy code v0.3 · no account needed · Ctrl-C twice to leave")
	case "now":
		var b strings.Builder
		b.WriteString("  " + st.Dimmer.Render("PID   STATUS     TAG        PROCESS"))
		for _, p := range Now {
			dot := st.Ok.Render("●")
			if p.Status == "stopped" {
				dot = st.Dimmer.Render("○")
			}
			b.WriteString(fmt.Sprintf("\n  %s  %s %-8s %s %s %s", st.Fg.Render(p.PID), dot, p.Status,
				st.Dim.Render(fmt.Sprintf("%-10s", "["+p.Tag+"]")), st.Fg.Render(p.What), st.Dim.Render("· "+p.Note)))
		}
		return b.String()
	case "welcome":
		return welcomeMark
	case "help":
		// grouped, two columns of groups so it does not scroll off the screen
		var cols []string
		for _, g := range Groups {
			var b strings.Builder
			b.WriteString(st.Fg.Render(g) + "\n")
			for _, c := range Commands {
				if c.Group != g {
					continue
				}
				pad := 12 - len([]rune(c.Name))
				if pad < 1 {
					pad = 1
				}
				b.WriteString(st.Clay.Render(c.Name+strings.Repeat(" ", pad)) + st.Dim.Render(c.Desc) + "\n")
			}
			cols = append(cols, strings.TrimRight(b.String(), "\n"))
		}
		if m.width < 100 {
			return strings.Join(cols, "\n\n")
		}
		left := lipgloss.JoinVertical(lipgloss.Left, cols[0], "", cols[3], "", cols[4])
		right := lipgloss.JoinVertical(lipgloss.Left, cols[1], "", cols[2])
		return lipgloss.JoinHorizontal(lipgloss.Top, left, "      ", right)
	case "contact":
		return hang(st.Fg.Render("⏺")+" ",
			st.Dim.Render("email    ")+st.Fg.Render("andy@andymsun.com")+"\n"+
				st.Dim.Render("github   ")+st.Fg.Render("github.com/andymsun")+"\n"+
				st.Dim.Render("linkedin ")+st.Fg.Render("linkedin.com/in/andymsun")+"\n"+
				st.Dim.Render("web      ")+st.Fg.Render("andymsun.com"), m.textWidth())
	case "web":
		return "   " + st.Box.BorderForeground(st.DimmerColor).Padding(0, 1).Render(st.Fg.Render("https://andymsun.com"))
	}
	return kind
}

// renderRuler is the scroll position as a rectangle and ticks, after rauno.me.
func (m *Model) renderRuler() string {
	const n = 12
	on := 0
	if m.vp.Height > 0 && m.vp.TotalLineCount() > m.vp.Height {
		on = int(m.vp.ScrollPercent()*n + 0.5)
	}
	var b strings.Builder
	b.WriteString(m.st.Dim.Render("▭") + " ")
	for i := 0; i < n; i++ {
		if i < on {
			b.WriteString(m.st.Clay.Render("|"))
		} else {
			b.WriteString(m.st.Dimmer.Render("|"))
		}
	}
	return b.String()
}

// renderWelcome draws the welcome box for the current persona. The cup steams.
func (m *Model) renderWelcome(now time.Time) string {
	st := m.st
	switch m.p.Key {
	case "codex":
		body := st.Clay.Render(">_") + " " + st.Bold.Render("andy codex") + st.Dim.Render(" (v0.3.0)") + "\n\n" +
			st.Dim.Render("model:     ") + st.Fg.Render("andy-5-codex") + "\n" +
			st.Dim.Render("directory: ") + st.Fg.Render("~/andymsun")
		return st.Welcome.BorderForeground(st.DimmerColor).Render(body)
	case "agy":
		body := gradient(m.r, "A N T I G R A V I T Y", "#4285f4", "#9b72cb", "#d96570") + "  " + st.Dim.Render("agent mode · andy-2.5-pro") + "\n\n" +
			st.Dim.Render("Tips for getting started:") + "\n" +
			st.Dim.Render("1.") + st.Fg.Render(" Ask about Andy, read his projects, or run /now.") + "\n" +
			st.Dim.Render("2.") + st.Fg.Render(" Be specific; he is.") + "\n" +
			st.Dim.Render("3.") + " " + st.Clay.Render("/help") + st.Fg.Render(" for more information.")
		return st.Welcome.BorderForeground(lipgloss.Color("#4285f4")).Render(body)
	}
	frame := cupFrame(now)
	cup := st.Dim.Render(frame[0])
	for _, l := range frame[1:] {
		cup += "\n" + st.Clay.Render(l)
	}
	text := st.Clay.Render("✻") + " Welcome to " + st.Bold.Render("andy code") + "!\n\n" +
		st.Dim.Render("/help for help, /now for what is running") + "\n\n" +
		st.Dim.Render("cwd: ~/andymsun") + "\n" +
		st.Dim.Render(fmt.Sprintf("model: andy-3 (third year) · context: %d cups", m.cups))
	return st.Welcome.Render(lipgloss.JoinHorizontal(lipgloss.Center, cup, "  ", text))
}
