package ui

import (
	"github.com/charmbracelet/lipgloss"
)

// For clickable area positioning
var TermHeight int

// Theme definitions
type Theme struct {
	Name       string
	Background lipgloss.Color
	Foreground lipgloss.Color
	Accent     lipgloss.Color
	Muted      lipgloss.Color
	ArtColor   lipgloss.Color
}

var Themes = []Theme{
	{
		Name:       "dark",
		Background: lipgloss.Color("#0a0a0c"),
		Foreground: lipgloss.Color("#e4e4e7"),
		Accent:     lipgloss.Color("#a78bfa"),
		Muted:      lipgloss.Color("#52525b"),
		ArtColor:   lipgloss.Color("#71717a"),
	},
	{
		Name:       "light",
		Background: lipgloss.Color("#fafafa"),
		Foreground: lipgloss.Color("#18181b"),
		Accent:     lipgloss.Color("#7c3aed"),
		Muted:      lipgloss.Color("#a1a1aa"),
		ArtColor:   lipgloss.Color("#71717a"),
	},
	{
		Name:       "tokyo",
		Background: lipgloss.Color("#1a1b26"),
		Foreground: lipgloss.Color("#c0caf5"),
		Accent:     lipgloss.Color("#7aa2f7"),
		Muted:      lipgloss.Color("#565f89"),
		ArtColor:   lipgloss.Color("#414868"),
	},
}

// Current theme index (updated from model)
var CurrentTheme = 0

// Dynamic style getters
func GetNavStyle() lipgloss.Style {
	return lipgloss.NewStyle().Padding(0, 2)
}

func GetActiveTabStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.Foreground).
		Bold(true).
		PaddingRight(2)
}

func GetInactiveTabStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.Muted).
		PaddingRight(2)
}

func GetArtStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.ArtColor)
}

func GetBioStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.Foreground).
		PaddingLeft(2)
}

func GetStatusStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.Muted)
}

func GetVersionStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.Muted)
}

func GetControlsStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.Muted)
}

func GetAccentStyle() lipgloss.Style {
	t := Themes[CurrentTheme]
	return lipgloss.NewStyle().
		Foreground(t.Accent)
}

// Keep old styles for backward compat with viewport pages
var (
	NavStyle           = lipgloss.NewStyle().Margin(1, 0).Padding(0, 2)
	ListStyle          = lipgloss.NewStyle().Padding(1, 2)
	BubbleLettersStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#7aa2f7"))
	ActivePageStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("#4fd6be")).Bold(true).PaddingLeft(2).PaddingRight(4)
	InactivePageStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("240")).PaddingLeft(4).PaddingRight(4)

	BorderTitleStyle = func() lipgloss.Style {
		b := lipgloss.HiddenBorder()
		return lipgloss.NewStyle().BorderStyle(b).Padding(0, 1)
	}()
	BorderInfoStyle = func() lipgloss.Style {
		b := lipgloss.HiddenBorder()
		return BorderTitleStyle.BorderStyle(b)
	}()
)
