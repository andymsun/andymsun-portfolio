package app

import (
	"sshfolio/ui"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Bubbletea update/msg handling
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Commands to be returned for Viewport updating
	var (
		ViewportCMD     tea.Cmd
		ProjectsListCMD tea.Cmd
		cmds            []tea.Cmd
	)

	switch msg := msg.(type) {
	case tea.MouseMsg:
		switch tea.MouseAction(msg.Button) {
		case 1: // Mouse left click
			for i, title := range m.Pages {
				x, y := m.CalculateNavItemPosition(title)
				width, height := ui.CalculateNavItemSize(title)

				if msg.X >= x && msg.X <= x+width && msg.Y >= y && msg.Y <= y+height {
					m.PageIndex = i
					m.Viewport.SetContent(SaturateContent(m, m.Viewport.Width))
					m.Viewport.GotoTop()
					return m, nil
				} else if msg.Y >= ui.TermHeight-3 {
					m.Help.ShowAll = !m.Help.ShowAll
					return m, nil
				}
			}
			if m.PageIndex == 2 && !m.ProjectOpen && msg.Y >= 16 && msg.Y < ui.TermHeight-3 {
				projectIndex := 0
				for i := 16; projectIndex <= len(m.Projects)-1; i += 3 {
					if i <= msg.Y && msg.Y <= i+1 {
						if m.List.Index() == projectIndex {
							m.ClickCounter++
						} else {
							m.ClickCounter = 0
						}
						m.List.Select(projectIndex)
					} else {
						projectIndex++
					}
					if m.ClickCounter >= 2 {
						m.ClickCounter = 0
						m.ProjectOpen = true
						m.OpenProject = m.List.Index()
					}
				}
			}
		case 4: // Scroll wheel up
			if m.PageIndex == 2 && !m.ProjectOpen {
				if m.List.Index() == 0 {
					m.List.Select(len(m.Projects))
				} else {
					m.List.Select(m.List.Index() - 1)
				}
			}
		case 5: // Scroll wheel down
			if m.PageIndex == 2 && !m.ProjectOpen {
				if m.List.Index() == len(m.Projects)-1 {
					m.List.Select(0)
				} else {
					m.List.Select(m.List.Index() + 1)
				}
			}
		}
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, ui.DefaultKeyMap.Quit):
			return m, tea.Quit
		case key.Matches(msg, ui.DefaultKeyMap.Help):
			m.Help.ShowAll = !m.Help.ShowAll

		// Theme toggle - 't' key
		case msg.String() == "t":
			m.Theme = (m.Theme + 1) % len(ui.Themes)
			ui.CurrentTheme = m.Theme
			return m, nil

		// Refresh layout - 'r' key
		case msg.String() == "r":
			return m, func() tea.Msg {
				return tea.WindowSizeMsg{Width: m.Width, Height: m.Height}
			}

		case key.Matches(msg, ui.DefaultKeyMap.Navigate):
			break
		case key.Matches(msg, ui.DefaultKeyMap.Up):
			break
		case key.Matches(msg, ui.DefaultKeyMap.Down):
			break
		case key.Matches(msg, ui.DefaultKeyMap.RCycle):
			cycled := m.CyclePage("right")
			cycled.Viewport.SetContent(SaturateContent(cycled, m.Viewport.Width))
			cycled.Viewport.GotoTop()
			return cycled, nil
		case key.Matches(msg, ui.DefaultKeyMap.LCycle):
			cycled := m.CyclePage("left")
			m.Viewport.SetContent(SaturateContent(cycled, m.Viewport.Width))
			m.Viewport.GotoTop()
			return m.CyclePage("left"), nil
		case key.Matches(msg, ui.DefaultKeyMap.Left):
			if m.PageIndex > 0 {
				m.PageIndex--
				m.Viewport.SetContent(SaturateContent(m, m.Viewport.Width))
				m.Viewport.GotoTop()
			}
			return m, nil
		case key.Matches(msg, ui.DefaultKeyMap.Right):
			if m.PageIndex < len(m.Pages)-1 {
				m.PageIndex++
				m.Viewport.SetContent(SaturateContent(m, m.Viewport.Width))
				m.Viewport.GotoTop()
			}
			return m, nil
		case key.Matches(msg, ui.DefaultKeyMap.Enter):
			if m.PageIndex == 2 {
				m.ProjectOpen = true
				m.OpenProject = m.List.Index()
				m.Viewport.GotoTop()
			}
		case key.Matches(msg, ui.DefaultKeyMap.Back):
			if m.PageIndex == 2 {
				m.ProjectOpen = false
				m.List.Select(m.OpenProject)
			}
		}
	case tea.WindowSizeMsg:
		// Store dimensions
		m.Width = msg.Width
		m.Height = msg.Height

		// Set new terminal height for proper click areas
		ui.TermHeight = msg.Height
		// Setup for Viewport sizing
		headerHeight := lipgloss.Height(m.ViewportHeader(m.Pages[m.PageIndex]))
		footerHeight := lipgloss.Height(m.ViewportFooter())
		verticalMarginHeight := headerHeight + footerHeight
		// Project List size
		ListMarginWidth, ListMarginHeight := ui.ListStyle.GetFrameSize()
		m.List.SetSize(msg.Width-ListMarginWidth, msg.Height-ListMarginHeight-verticalMarginHeight-11)

		// Viewport creation & management
		if !m.Ready {
			m.Viewport = viewport.New(msg.Width, msg.Height-verticalMarginHeight-11)
			m.Viewport.SetContent(SaturateContent(m, m.Viewport.Width))
			m.Ready = true
		} else {
			m.Viewport.Width = msg.Width
			m.Viewport.Height = msg.Height - verticalMarginHeight - 11
		}
	}

	if m.PageIndex == 2 && m.ProjectOpen {
		m.Viewport.SetContent(ui.OpenProject(m.OpenProject, m.Projects, m.Viewport.Width))
	}
	// Handle keyboard and mouse events in the Viewport
	m.Viewport, ViewportCMD = m.Viewport.Update(msg)
	m.List, ProjectsListCMD = m.List.Update(msg)
	cmds = append(cmds, ViewportCMD, ProjectsListCMD)

	return m, tea.Batch(cmds...)
}
