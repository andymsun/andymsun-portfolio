package app

import (
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

// A Persona is a skin for the same agent: claude (default, with the cup),
// codex, and agy (antigravity). Only glyphs, words, and colours change.
type Persona struct {
	Key, Name, Title, Model string
	Star, Prompt, Bullet    string // header glyph, prompt char, assistant bullet ("" for none)
	ToolDot, ResMark        string
	Label                   string // a dim line above every assistant message (codex)
	Placeholder             string
	Verbs, Glyphs           []string
	SpinEvery               time.Duration
	Accent, Ok              lipgloss.Color
	SpinnerMeta             func(secs, tokens int) string
	ToolCall                func(fn, arg string) (string, string) // display name, arg
}

var Personas = map[string]Persona{
	"claude": {
		Key: "claude", Name: "andy code", Title: "andy@ssh.andymsun.com: ~", Model: "andy-3 (third year)",
		Star: "✻", Prompt: ">", Bullet: "⏺", ToolDot: "⏺", ResMark: "⎿ ",
		Placeholder: "Try \"/projects\", \"why ssh?\", or \"/agent codex\"",
		Verbs:       Verbs, Glyphs: Glyphs, SpinEvery: 110 * time.Millisecond,
		Accent: lipgloss.Color("#d97757"), Ok: lipgloss.Color("#7fb069"),
		SpinnerMeta: func(s, t int) string { return "(" + itoa(s) + "s · ↑ " + itoa(t) + " tokens · esc to interrupt)" },
		ToolCall:    func(fn, arg string) (string, string) { return fn + "(" + arg + ")", "" },
	},
	"codex": {
		Key: "codex", Name: "andy codex", Title: "andy codex — ~/andymsun", Model: "andy-5-codex",
		Star: ">_", Prompt: "›", Bullet: "", ToolDot: "•", ResMark: "└ ", Label: "codex",
		Placeholder: "Ask andy codex to do anything",
		Verbs:       []string{"Working"}, Glyphs: []string{"•"}, SpinEvery: 110 * time.Millisecond,
		Accent: lipgloss.Color("#e6e6e6"), Ok: lipgloss.Color("#b5b5b5"),
		SpinnerMeta: func(s, t int) string { return "(" + itoa(s) + "s • esc to interrupt)" },
		ToolCall: func(fn, arg string) (string, string) {
			if fn == "Bash" {
				return "Ran", arg
			}
			return "Read", arg
		},
	},
	"agy": {
		Key: "agy", Name: "antigravity", Title: "antigravity — ~/andymsun", Model: "andy-2.5-pro",
		Star: "✦", Prompt: ">", Bullet: "✦", ToolDot: "✓", ResMark: "╰ ",
		Placeholder: "Type your message or @path/to/file",
		Verbs:       []string{"Reticulating splines", "Warming up the flux capacitor", "Consulting the coffee", "Untangling the shuttlecocks", "Asking Andy nicely", "Defragmenting the semester", "Polishing the pixels"},
		Glyphs:      []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"},
		SpinEvery:   80 * time.Millisecond,
		Accent:      lipgloss.Color("#7aa2f7"), Ok: lipgloss.Color("#7fb069"),
		SpinnerMeta: func(s, t int) string { return "(esc to cancel, " + itoa(s) + "s)" },
		ToolCall: func(fn, arg string) (string, string) {
			if fn == "Bash" {
				return "Shell", arg
			}
			return "ReadFile", arg
		},
	},
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	if neg {
		b = append([]byte{'-'}, b...)
	}
	return string(b)
}

// Cup is the mascot: a coffee cup in half blocks, steam alternating between frames.
var cupBody = []string{" ▗▟█████▙▖  ", " ▐███████▌▙ ", " ▝▜█████▛▘▛ ", "  ▀▀▀▀▀▀▀   "}
var cupSteam = []string{"   ) ) )    ", "   ( ( (    "}

func cupFrame(t time.Time) []string {
	steam := cupSteam[(t.UnixMilli()/700)%2]
	return append([]string{steam}, cupBody...)
}

// gradient colours each rune of s from one hex colour to another, for the agy wordmark.
func gradient(r *lipgloss.Renderer, s string, stops ...string) string {
	runes := []rune(s)
	if len(stops) < 2 || len(runes) == 0 {
		return s
	}
	var b strings.Builder
	n := len(runes) - 1
	for i, ch := range runes {
		f := 0.0
		if n > 0 {
			f = float64(i) / float64(n)
		}
		seg := f * float64(len(stops)-1)
		k := int(seg)
		if k >= len(stops)-1 {
			k = len(stops) - 2
		}
		c := mix(stops[k], stops[k+1], seg-float64(k))
		b.WriteString(r.NewStyle().Foreground(lipgloss.Color(c)).Bold(true).Render(string(ch)))
	}
	return b.String()
}

func mix(a, b string, t float64) string {
	pa, pb := hex(a), hex(b)
	var out [3]int
	for i := 0; i < 3; i++ {
		out[i] = int(float64(pa[i])*(1-t) + float64(pb[i])*t + 0.5)
	}
	const digits = "0123456789abcdef"
	s := "#"
	for _, v := range out {
		s += string(digits[v>>4]) + string(digits[v&15])
	}
	return s
}

func hex(s string) [3]int {
	s = strings.TrimPrefix(s, "#")
	var out [3]int
	for i := 0; i < 3 && 2*i+1 < len(s); i++ {
		out[i] = nib(s[2*i])<<4 | nib(s[2*i+1])
	}
	return out
}

func nib(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	}
	return 0
}
