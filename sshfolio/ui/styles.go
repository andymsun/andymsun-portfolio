// Package ui holds the palette. Same colours as style.css on andymsun.com.
package ui

import "github.com/charmbracelet/lipgloss"

type Styles struct {
	ClayColor, DimmerColor lipgloss.Color

	Fg, Bold, Dim, Dimmer, Clay, Ok lipgloss.Style
	Box, Card, Welcome              lipgloss.Style
}

// NewStyles builds styles against a renderer, so colours are negotiated per
// ssh session instead of against the server's stdout.
func NewStyles(r *lipgloss.Renderer) *Styles {
	clay := lipgloss.Color("#d97757")
	dimmer := lipgloss.Color("#5a554d")
	s := &Styles{ClayColor: clay, DimmerColor: dimmer}
	s.Fg = r.NewStyle().Foreground(lipgloss.Color("#e9e4da"))
	s.Bold = s.Fg.Bold(true)
	s.Dim = r.NewStyle().Foreground(lipgloss.Color("#8a847a"))
	s.Dimmer = r.NewStyle().Foreground(dimmer)
	s.Clay = r.NewStyle().Foreground(clay)
	s.Ok = r.NewStyle().Foreground(lipgloss.Color("#7fb069"))
	s.Box = r.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(clay).Padding(0, 1)
	s.Card = r.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(dimmer).BorderLeftForeground(clay).Padding(0, 1)
	s.Welcome = r.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(clay).Padding(0, 1)
	return s
}
