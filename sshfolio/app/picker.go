package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// A picker is the tiny menu the real CLI shows for /model or /config: a
// bordered list, ↑↓ to move, Enter to choose, Esc to close, digits to jump.
// It lives in the live slot until it is closed; keys go to it first.
type pickItem struct {
	Label, Desc string
	Dot         string                // "", "green", "yellow", "red", "dim"
	Run         func(m *Model) []step // on Enter; returns steps to queue. nil keeps the picker open (cyclers)
	Cycle       func(m *Model)        // for /config rows: change the value and stay open
}

type picker struct {
	Title, Hint string
	Items       []pickItem
	Sel         int
	Rebuild     func(m *Model) []pickItem // for pickers whose rows change as you cycle them
}

func pickStep(p *picker) step { return step{kind: stPick, pick: p} }

func (m *Model) dotStyle(dot string) string {
	switch dot {
	case "green":
		return m.st.Green.Render("●")
	case "yellow":
		return m.st.Yellow.Render("●")
	case "red":
		return m.st.Red.Render("●")
	case "dim":
		return m.st.Dimmer.Render("○")
	}
	return " "
}

func (m *Model) renderPicker(p *picker) string {
	st := m.st
	var b strings.Builder
	b.WriteString(st.Fg.Render(p.Title))
	if p.Hint != "" {
		b.WriteString("  " + st.Dim.Render(p.Hint))
	}
	b.WriteString("\n")
	maxLabel := 0
	for _, it := range p.Items {
		if w := lipgloss.Width(it.Label); w > maxLabel {
			maxLabel = w
		}
	}
	// window of at most 10 rows around the selection
	start := 0
	if len(p.Items) > 10 && p.Sel > 4 {
		start = p.Sel - 4
		if start > len(p.Items)-10 {
			start = len(p.Items) - 10
		}
	}
	end := start + 10
	if end > len(p.Items) {
		end = len(p.Items)
	}
	// room for the description: the box has 2 cells of border, 2 of padding, then "1. ● label  "
	descW := m.textWidth() - 4 - 3 - 2 - maxLabel - 2
	if descW < 12 {
		descW = 12
	}
	for i := start; i < end; i++ {
		it := p.Items[i]
		num := st.Dimmer.Render(fmt.Sprintf("%d.", i+1))
		if i >= 9 {
			num = "  "
		}
		label := it.Label + strings.Repeat(" ", maxLabel-lipgloss.Width(it.Label))
		desc := it.Desc
		if r := []rune(desc); len(r) > descW {
			desc = string(r[:descW-1]) + "…"
		}
		row := fmt.Sprintf("%s %s %s  %s", num, m.dotStyle(it.Dot), label, st.Dim.Render(desc))
		if i == p.Sel {
			row = fmt.Sprintf("%s %s %s  %s", st.Clay.Render("›"), m.dotStyle(it.Dot), st.Clay.Render(label), st.Fg.Render(desc))
		}
		b.WriteString(row + "\n")
	}
	if len(p.Items) > 10 {
		b.WriteString(st.Dimmer.Render(fmt.Sprintf("↑↓ · %d of %d", p.Sel+1, len(p.Items))) + "\n")
	}
	b.WriteString(st.Dimmer.Render("enter to choose · esc to close"))
	return st.Box.BorderForeground(st.DimmerColor).Render(b.String())
}

// ---- the pickers ----------------------------------------------------------

func statusDot(s string) string {
	switch s {
	case "shipped", "active", "done":
		return "green"
	case "wip", "paused":
		return "yellow"
	case "abandoned":
		return "red"
	}
	return "dim"
}

func (m *Model) projectPicker() *picker {
	p := &picker{Title: "Projects", Hint: "green shipped · yellow in progress or paused · red abandoned"}
	for i := range Projects {
		pr := &Projects[i]
		p.Items = append(p.Items, pickItem{Label: pr.Name, Desc: pr.Year + " · " + pr.Blurb, Dot: statusDot(pr.Status),
			Run: func(m *Model) []step {
				return []step{tool("Read", pr.File, fmt.Sprintf("Read %d lines", pr.Lines)), card(pr)}
			}})
	}
	p.Items = append(p.Items, pickItem{Label: "all of them", Desc: "spawn a subagent per project and read every file", Dot: "",
		Run: func(m *Model) []step { return m.handle("/projects all") }})
	return p
}

func (m *Model) agentPicker() *picker {
	p := &picker{Title: "Agent skin", Hint: "same Andy underneath"}
	for _, k := range []string{"claude", "codex", "agy"} {
		key := k
		per := Personas[key]
		dot := "dim"
		if m.p.Key == key {
			dot = "green"
		}
		p.Items = append(p.Items, pickItem{Label: per.Name, Desc: per.Model + " · " + map[string]string{"claude": "the cup", "codex": ">_ and a › prompt", "agy": "gradient wordmark"}[key], Dot: dot,
			Run: func(m *Model) []step { return m.handle("/agent " + key) }})
	}
	return p
}

func (m *Model) effortPicker() *picker {
	p := &picker{Title: "Effort", Hint: "how long the spinner spins"}
	for _, o := range ArgOptions["/effort"] {
		lvl := o.Name
		dot := "dim"
		if m.effort == lvl {
			dot = "green"
		}
		p.Items = append(p.Items, pickItem{Label: lvl, Desc: o.Desc, Dot: dot, Run: func(m *Model) []step { return m.handle("/effort " + lvl) }})
	}
	return p
}

func (m *Model) skillPicker() *picker {
	p := &picker{Title: "Skills", Hint: "user-invocable"}
	for _, o := range ArgOptions["/skill"] {
		name := o.Name
		p.Items = append(p.Items, pickItem{Label: name, Desc: o.Desc, Dot: "green", Run: func(m *Model) []step { return m.handle("/skill " + name) }})
	}
	return p
}

func (m *Model) tabPicker() *picker {
	p := &picker{Title: "Tabs", Hint: "ctrl-t new · ctrl-n / ctrl-p switch"}
	for i := range m.tabs {
		idx := i
		per := m.tabs[i].p
		dot := "dim"
		if i == m.active {
			per = m.p
			dot = "green"
		}
		p.Items = append(p.Items, pickItem{Label: fmt.Sprintf("tab %d", i+1), Desc: per.Name, Dot: dot, Run: func(m *Model) []step { m.switchTab(idx); return nil }})
	}
	p.Items = append(p.Items, pickItem{Label: "new tab", Desc: "same skin, empty transcript", Run: func(m *Model) []step { m.newTab(); return nil }})
	if len(m.tabs) > 1 {
		p.Items = append(p.Items, pickItem{Label: "close this tab", Desc: "", Dot: "red", Run: func(m *Model) []step { m.closeTab(); return nil }})
	}
	return p
}

// configPicker rows cycle in place on Enter, like a settings screen.
func (m *Model) configPicker() *picker {
	p := &picker{Title: "Config", Hint: "enter cycles a value"}
	p.Rebuild = func(m *Model) []pickItem {
		onOff := func(b bool) string {
			if b {
				return "on"
			}
			return "off"
		}
		return []pickItem{
			{Label: "skin", Desc: m.p.Name, Dot: "green", Cycle: func(m *Model) {
				next := map[string]string{"claude": "codex", "codex": "agy", "agy": "claude"}[m.p.Key]
				m.setPersona(next)
				m.transcript = append(m.transcript, welcomeMark)
			}},
			{Label: "effort", Desc: m.effort, Dot: "green", Cycle: func(m *Model) {
				m.effort = map[string]string{"low": "medium", "medium": "high", "high": "max", "max": "low"}[m.effort]
			}},
			{Label: "party mode", Desc: onOff(m.party), Dot: map[bool]string{true: "yellow", false: "dim"}[m.party], Cycle: func(m *Model) { m.party = !m.party }},
			{Label: "status hints", Desc: onOff(!m.quietStatus), Dot: map[bool]string{true: "green", false: "dim"}[!m.quietStatus], Cycle: func(m *Model) { m.quietStatus = !m.quietStatus }},
			{Label: "context", Desc: fmt.Sprintf("%d cups", m.cups), Dot: "green", Cycle: func(m *Model) { m.cups++ }},
		}
	}
	p.Items = p.Rebuild(m)
	return p
}

func (m *Model) modelPicker() *picker {
	p := m.agentPicker()
	p.Title = "Model"
	p.Hint = "one Andy, three model names"
	keys := []string{"claude", "codex", "agy"}
	for i := range p.Items {
		p.Items[i].Label, p.Items[i].Desc = Personas[keys[i]].Model, p.Items[i].Label
	}
	return p
}
