package app

import (
	"fmt"
	"strings"

	"sshfolio/ui"

	"github.com/charmbracelet/lipgloss"
)

const version = "v0.1.0"

// Switch case with each page/TUI view
func (m Model) View() string {

	// If viewport isn't ready it'll say welcome
	if !m.Ready {
		return "\n  Welcome..."
	}

	// Sync theme
	ui.CurrentTheme = m.Theme

	// Build top navigation bar
	nav := m.renderNav()

	// Build main content based on current page
	var mainContent string
	switch m.PageIndex {
	case 0: // Home - side-by-side ASCII art + bio
		mainContent = m.renderHome()
	default: // Other pages - viewport markdown
		mainContent = m.renderViewport()
	}

	// Build bottom bar
	bottomBar := m.renderBottomBar()

	// Calculate vertical centering for home page
	if m.PageIndex == 0 {
		navHeight := lipgloss.Height(nav)
		bottomHeight := lipgloss.Height(bottomBar)
		contentHeight := lipgloss.Height(mainContent)
		availableHeight := m.Height - navHeight - bottomHeight
		topPadding := (availableHeight - contentHeight) / 2
		if topPadding < 1 {
			topPadding = 1
		}
		padding := strings.Repeat("\n", topPadding)
		return nav + padding + mainContent + "\n" + bottomBar
	}

	return nav + "\n" + mainContent + "\n" + bottomBar
}

func (m Model) renderNav() string {
	var tabs string
	for i, title := range m.Pages {
		displayTitle := strings.Title(title)
		if i == m.PageIndex {
			tabs += ui.GetActiveTabStyle().Render(displayTitle)
		} else {
			tabs += ui.GetInactiveTabStyle().Render(displayTitle)
		}
	}

	navLeft := ui.GetNavStyle().Render(tabs)

	// Right side status
	statusText := ui.GetStatusStyle().Render("[ portfolio ]")

	// Join left and right
	gap := m.Width - lipgloss.Width(navLeft) - lipgloss.Width(statusText)
	if gap < 0 {
		gap = 0
	}
	spacer := strings.Repeat(" ", gap)

	return navLeft + spacer + statusText
}

func (m Model) renderHome() string {
	// Get ASCII art from the homepage markdown
	artContent := ui.GetMarkdown("homepage")

	// Split the markdown into art and bio sections
	// Convention: separate art and bio with "---"
	parts := strings.SplitN(artContent, "---", 2)

	var artBlock, bioBlock string
	if len(parts) == 2 {
		artBlock = strings.TrimSpace(parts[0])
		bioBlock = strings.TrimSpace(parts[1])
	} else {
		artBlock = strings.TrimSpace(artContent)
		bioBlock = ""
	}

	// Style the art
	styledArt := ui.GetArtStyle().Render(artBlock)

	// Style the bio
	styledBio := ui.GetBioStyle().Render(bioBlock)

	// Join side by side
	combined := lipgloss.JoinHorizontal(lipgloss.Center, styledArt, "  ", styledBio)

	// Center horizontally
	return lipgloss.PlaceHorizontal(m.Width, lipgloss.Center, combined)
}

func (m Model) renderViewport() string {
	header := m.ViewportHeader(m.Pages[m.PageIndex])
	footer := m.ViewportFooter()

	if m.PageIndex == 2 { // Projects
		if !m.ProjectOpen {
			return header + ui.ListStyle.Render(m.List.View()) + footer
		}
		return header + m.Viewport.View() + footer
	}

	return header + m.Viewport.View() + footer
}

func (m Model) renderBottomBar() string {
	versionText := ui.GetVersionStyle().Render(fmt.Sprintf(" %s", version))

	themeName := ui.Themes[m.Theme].Name
	controls := ui.GetControlsStyle().Render(
		fmt.Sprintf("←→ navigate  t theme (%s)  q quit ", themeName),
	)

	gap := m.Width - lipgloss.Width(versionText) - lipgloss.Width(controls)
	if gap < 0 {
		gap = 0
	}
	spacer := strings.Repeat(" ", gap)

	return versionText + spacer + controls
}
