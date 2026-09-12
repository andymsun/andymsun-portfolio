package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
	"github.com/muesli/reflow/wordwrap"
)

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
	parts := append([]string{}, m.transcript...)
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
	left := " " + st.Clay.Render("✻") + " " + st.Bold.Render("andy@ssh.andymsun.com") + st.Dimmer.Render(": ~")
	right := m.renderRuler() + "  " + st.Dim.Render("andymsun.com") + " "
	gap := m.width - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	b.WriteString(left + strings.Repeat(" ", gap) + right + "\n")
	b.WriteString(st.Dimmer.Render(strings.Repeat("─", m.width)) + "\n")

	// transcript
	b.WriteString(m.vp.View() + "\n")

	// slash menu
	if items := m.menuItems(); len(items) > 0 {
		b.WriteString("\n")
		for i, c := range items {
			name := c.Name + strings.Repeat(" ", 12-len(c.Name))
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
	b.WriteString(box.Width(m.width-4).Render(st.Dim.Render("> ")+m.in.View()) + "\n")

	// status line
	l := " " + st.Dimmer.Render("? for shortcuts")
	var r string
	switch {
	case m.status != "":
		r = st.Clay.Render(m.status)
	case m.booting:
		r = st.Dimmer.Render("esc to skip")
	case m.running():
		r = st.Dimmer.Render("esc to interrupt")
	default:
		r = st.Dimmer.Render("the real thing is on the web too: andymsun.com")
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
	dot := m.st.Fg.Render("⏺")
	switch style {
	case "ok":
		dot = m.st.Ok.Render("⏺")
	case "clay":
		dot = m.st.Clay.Render("⏺")
	}
	if streaming {
		text += "▌"
	}
	return hang(dot+" ", m.st.Fg.Render(text), m.textWidth())
}

func (m *Model) renderSpinner(frame int, verb string, secs, tokens int) string {
	g := m.st.Clay.Render(Glyphs[frame%len(Glyphs)])
	return g + " " + m.st.Fg.Render(verb+"…") + " " + m.st.Dim.Render(fmt.Sprintf("(%ds · ↑ %d tokens · esc to interrupt)", secs, tokens))
}

func (m *Model) renderToolPending(fn, arg string) string {
	return m.st.Dim.Render("⏺") + " " + m.st.Bold.Render(fn) + "(" + m.st.Dim.Render(arg) + ")"
}

func (m *Model) renderTool(fn, arg, res string) string {
	return m.st.Ok.Render("⏺") + " " + m.st.Bold.Render(fn) + "(" + m.st.Dim.Render(arg) + ")\n" +
		"  " + m.st.Dimmer.Render("⎿") + "  " + m.st.Dim.Render(res)
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
	if gap < 1 {
		gap = 1
	}
	b.WriteString(title + strings.Repeat(" ", gap) + year + "\n")
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
		body := st.Clay.Render("✻") + " Welcome to " + st.Bold.Render("andy code") + "!\n\n" +
			st.Dim.Render("  /help for help, /now for what is running") + "\n\n" +
			st.Dim.Render("  cwd: ~/andymsun") + "\n" +
			st.Dim.Render("  model: andy-3 (third year) · context: 2 cups")
		return st.Welcome.Render(body)
	case "help":
		var b strings.Builder
		for i, c := range Commands {
			if i > 0 {
				b.WriteString("\n")
			}
			b.WriteString("  " + st.Clay.Render(c.Name+strings.Repeat(" ", 12-len(c.Name))) + st.Dim.Render(c.Desc))
		}
		return b.String()
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
