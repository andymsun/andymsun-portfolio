package app

import (
	"crypto/sha1"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/charmbracelet/lipgloss"
)

// ---- session facts: the honest tool calls ----------------------------------

// Session is what the server knows about the visitor. Local runs leave it mostly empty.
type Session struct {
	User, Addr, Term string
	Cols, Rows       int
	Visitor          int64
	Owner            bool // connected with Andy's own key
}

var (
	serverStart = time.Now()
	visitsBoot  int64 // sessions since the process started
	visitsAll   int64 // persisted across restarts in .ssh/visits
)

const visitsFile = ".ssh/visits"

func loadVisits() {
	if b, err := os.ReadFile(visitsFile); err == nil {
		if n, err := strconv.ParseInt(strings.TrimSpace(string(b)), 10, 64); err == nil {
			atomic.StoreInt64(&visitsAll, n)
		}
	}
}

// countVisit bumps both counters and returns the all-time number for this visitor.
func countVisit() int64 {
	atomic.AddInt64(&visitsBoot, 1)
	n := atomic.AddInt64(&visitsAll, 1)
	_ = os.WriteFile(visitsFile, []byte(strconv.FormatInt(n, 10)+"\n"), 0o644)
	return n
}

func humanDuration(d time.Duration) string {
	d = d.Round(time.Second)
	days := int(d.Hours()) / 24
	h := int(d.Hours()) % 24
	m := int(d.Minutes()) % 60
	switch {
	case days > 0:
		return fmt.Sprintf("%dd %dh %dm", days, h, m)
	case h > 0:
		return fmt.Sprintf("%dh %dm", h, m)
	default:
		return fmt.Sprintf("%dm %ds", m, int(d.Seconds())%60)
	}
}

// ---- fortunes, verbs for the party ----------------------------------------

var Fortunes = []string{
	"You will ssh into something you did not expect today. It was this.",
	"A badminton court is 13.4 m long. Andy has run the length of one more times than he has slept this month.",
	"The auditor agent flags 14% of statutes. The other 86% are merely suspicious.",
	"Your terminal is 80 columns wide because a punch card was. You are welcome.",
	"Coffee is a dependency, not a devDependency.",
	"He who controls port 22 controls the first impression.",
	"Sleep is a cache. Andy runs without one.",
	"Flushing, Queens produced this program. Blame the 7 train.",
	"The best interface is the one you forget is there. This one wants you to remember.",
	"There is no cloud. There is a CPX11 in Ashburn, and it is doing its best.",
}

var PartyVerbs = []string{"Ascending", "Unhinging", "Vibrating", "Transcending", "Yeeting", "Deep-frying", "Reticulating harder", "Speedrunning", "Levitating", "Screaming (politely)", "Overclocking the cup", "Manifesting"}

// ---- fake shell ------------------------------------------------------------

// shell answers commands people type out of habit. Returns nil when it is not one.
func (m *Model) shell(text string) []step {
	f := strings.Fields(text)
	if len(f) == 0 {
		return nil
	}
	cmd, args := f[0], f[1:]
	arg := strings.Join(args, " ")
	switch cmd {
	case "ls", "ls -la", "dir", "tree":
		return []step{raw("ls")}
	case "pwd":
		return []step{sayPlain("/home/andy")}
	case "cd":
		return []step{sayPlain("This is not a shell. It is a program that looks like one, on port 22, talking about Andy. There is nowhere to cd.")}
	case "cat", "less", "more", "head", "tail", "bat":
		switch strings.TrimSuffix(strings.TrimPrefix(arg, "./"), ".md") {
		case "about":
			return m.handle("/about")
		case "contact":
			return m.handle("/contact")
		case "now":
			return m.handle("/now")
		case "projects", "projects/":
			return m.handle("/projects")
		case "resume", "experience", "cv":
			return m.handle("/experience")
		case "":
			return []step{sayPlain(cmd + ": which file? try ls")}
		}
		return []step{sayPlain(cmd + ": " + arg + ": No such file or directory (but ls works)")}
	case "clear", "cls":
		m.transcript = nil
		return []step{raw("welcome")}
	case "exit", "logout", "quit", ":q", ":q!", ":wq":
		return m.handle("/exit")
	case "help", "?":
		return m.handle("/help")
	case "whoami", "id":
		return m.handle("/whoami")
	case "uptime", "w":
		return m.handle("/uptime")
	case "top", "htop", "btop", "ps", "jobs":
		return m.handle("/now")
	case "date":
		return []step{sayPlain(time.Now().UTC().Format("Mon Jan _2 15:04:05 UTC 2006") + "  (server time; Andy is on Chicago time and behind on sleep)")}
	case "echo":
		if arg == "" {
			return []step{sayPlain("")}
		}
		return []step{sayPlain(arg)}
	case "sudo":
		return []step{pause(600), sayAs("andy is not in the sudoers file. This incident will be reported.", "clay"), pause(400), sayPlain("(to nobody. there is no one to report it to.)")}
	case "rm":
		return []step{tool("Bash", text, "removing andy's sleep schedule... already gone"), pause(300), sayPlain("Nothing else here is deletable. It is a Go binary; it will be exactly like this again in a second.")}
	case "vim", "vi", "nvim", "nano", "emacs", "code":
		return []step{sayPlain("You cannot exit " + cmd + ", and you cannot enter it here either. Both problems solved.")}
	case "git":
		if arg == "log" || strings.HasPrefix(arg, "log ") {
			return m.handle("/experience")
		}
		return []step{raw("git")}
	case "ping":
		host := arg
		if host == "" {
			host = "andymsun.com"
		}
		return []step{tool("Bash", "ping -c 3 "+host, "3 packets transmitted, 3 received, 0% packet loss"), sayPlain("Reachable. So is Andy: andy@andymsun.com.")}
	case "neofetch", "fastfetch", "screenfetch":
		return []step{raw("neofetch")}
	case "man":
		if arg == "andy" || arg == "" {
			return m.handle("/about")
		}
		return []step{sayPlain("No manual entry for " + arg + ". There is one for andy.")}
	case "make", "npm", "yarn", "pnpm", "cargo", "go", "python", "python3", "node":
		return []step{tool("Bash", text, "nothing to build; this is already running"), sayPlain("Andy builds things elsewhere. /projects has the list.")}
	case "sleep":
		return []step{sayPlain("sleep: command not found. Andy uninstalled it in 2024.")}
	case "coffee", "brew":
		return m.handle("/coffee")
	}
	return nil
}

// sayPlain is a reply with no bullet, like shell output.
func sayPlain(t string) step { return step{kind: stSay, text: t, cps: 600, style: "plain"} }

// ---- animations -----------------------------------------------------------

func anim(name string, ms int) step { return step{kind: stAnim, text: name, ms: ms} }

var cupFill = []string{" ▗▟█████▙▖  ", " ▐░░░░░░░▌▙ ", " ▝▜░░░░░▛▘▛ ", "  ▀▀▀▀▀▀▀   "}

func (m *Model) renderAnim(name string, ms, total int) string {
	st := m.st
	f := float64(ms) / float64(total)
	if f > 1 {
		f = 1
	}
	switch name {
	case "brew":
		// pour: the two middle rows fill left to right, then steam.
		rows := []string{cupFill[0], cupFill[1], cupFill[2], cupFill[3]}
		fillCols := int(f * 8)
		for i := 1; i <= 2; i++ {
			r := []rune(rows[i])
			n := 0
			for j := range r {
				if r[j] == '░' {
					if n < fillCols {
						r[j] = '█'
					}
					n++
				}
			}
			rows[i] = string(r)
		}
		steam := "            "
		if f > 0.85 {
			steam = cupSteam[(ms/200)%2]
		}
		out := st.Dim.Render(steam)
		for _, r := range rows {
			out += "\n" + st.Clay.Render(r)
		}
		label := fmt.Sprintf("pouring… %3d%%", int(f*100))
		if f >= 1 {
			label = "brewed."
		}
		return lipgloss.JoinHorizontal(lipgloss.Center, out, "   ", st.Dim.Render(label))
	case "rally":
		w := m.textWidth() - 26 // room for the score on the same line
		if w < 20 {
			w = 20
		}
		// shuttle goes back and forth; position is a triangle wave over time
		period := 1400.0
		t := float64(ms) / period
		phase := t - float64(int(t))
		pos := phase * 2
		if pos > 1 {
			pos = 2 - pos
		}
		x := int(pos * float64(w-1))
		line := []rune(strings.Repeat(" ", w))
		line[x] = '◆'
		height := 1 - 4*(pos-0.5)*(pos-0.5) // arc
		arc := []rune(strings.Repeat(" ", w))
		if height > 0.5 {
			arc[x] = '·'
		}
		left := st.Clay.Render("▐")
		right := st.Clay.Render("▌")
		if x < 2 {
			left = st.Fg.Render("▐")
		}
		if x > w-3 {
			right = st.Fg.Render("▌")
		}
		score := st.Dim.Render(fmt.Sprintf("andy %d · you %d", int(t), int(t)/3))
		return " " + string(arc) + "\n" + left + st.Fg.Render(string(line)) + right + "   " + score + "\n" + st.Dimmer.Render(strings.Repeat("─", w+2))
	case "matrix":
		w := m.textWidth() - 2
		h := 8
		rng := rand.New(rand.NewSource(int64(ms / 90)))
		glyphs := []rune("ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ANDYCOFFEE")
		var b strings.Builder
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				if rng.Intn(4) == 0 {
					ch := string(glyphs[rng.Intn(len(glyphs))])
					if rng.Intn(6) == 0 {
						b.WriteString(st.Fg.Render(ch))
					} else {
						b.WriteString(st.Ok.Render(ch))
					}
				} else {
					b.WriteString(" ")
				}
			}
			b.WriteString("\n")
		}
		return strings.TrimRight(b.String(), "\n")
	case "confetti":
		w := m.textWidth() - 2
		rng := rand.New(rand.NewSource(int64(ms / 80)))
		bits := []string{"*", "+", "·", "°", "✦", "✧", "☕"}
		colors := []lipgloss.Color{"#d97757", "#7aa2f7", "#9b72cb", "#7fb069", "#facc15", "#f87171"}
		var b strings.Builder
		for y := 0; y < 5; y++ {
			for x := 0; x < w; x++ {
				if rng.Intn(7) == 0 {
					b.WriteString(m.r.NewStyle().Foreground(colors[rng.Intn(len(colors))]).Render(bits[rng.Intn(len(bits))]))
				} else {
					b.WriteString(" ")
				}
			}
			b.WriteString("\n")
		}
		return strings.TrimRight(b.String(), "\n")
	}
	return ""
}

// ---- rendered blocks for the eggs ----------------------------------------

func (m *Model) renderEgg(kind string) (string, bool) {
	st := m.st
	switch kind {
	case "ls":
		d := func(s string) string { return st.Clay.Render(s) }
		return d("projects/") + "   about.md   resume.md   contact.md   now.txt   " + d("coffee/") + "   " + st.Dimmer.Render(".sleep (empty)"), true
	case "git":
		return st.Fg.Render("On branch ") + st.Clay.Render("coffee") + "\n" +
			st.Dim.Render("Your branch is 3 commits behind 'sleep'.") + "\n\n" +
			st.Fg.Render("Changes not staged for commit:") + "\n" +
			st.Clay.Render("\tmodified:   sleep_schedule.txt") + "\n" +
			st.Clay.Render("\tdeleted:    free_time.md") + "\n\n" +
			st.Dim.Render("no changes added to commit (use \"/coffee\" to continue)"), true
	case "neofetch":
		cup := cupFrame(time.Now())
		var logo string
		for i, l := range cup {
			if i == 0 {
				logo += st.Dim.Render(l)
			} else {
				logo += "\n" + st.Clay.Render(l)
			}
		}
		logo += "\n" + strings.Repeat(" ", 12)
		k := func(s string) string { return st.Clay.Render(s + ": ") }
		term := m.sess.Term
		if term == "" {
			term = "local"
		}
		size := fmt.Sprintf("%dx%d", m.width, m.height)
		info := st.Bold.Render("andy") + st.Dim.Render("@") + st.Bold.Render("ssh.andymsun.com") + "\n" +
			st.Dimmer.Render(strings.Repeat("─", 22)) + "\n" +
			k("OS") + "andy code v0.3 (" + m.p.Key + " skin)\n" +
			k("Host") + "Hetzner CPX11, Ashburn\n" +
			k("Uptime") + humanDuration(time.Since(serverStart)) + "\n" +
			k("Shell") + "none. this is not a shell\n" +
			k("Terminal") + term + " " + size + "\n" +
			k("Packages") + "5 (projects)\n" +
			k("Coffee") + fmt.Sprintf("%d cups\n", m.cups) +
			k("Sleep") + "N/A\n" +
			k("Visitors") + fmt.Sprintf("%d since boot, %d all time\n\n", atomic.LoadInt64(&visitsBoot), atomic.LoadInt64(&visitsAll))
		var sw string
		for _, c := range []string{"#d97757", "#7aa2f7", "#9b72cb", "#7fb069", "#facc15", "#f87171", "#e9e4da", "#8a847a"} {
			sw += m.r.NewStyle().Foreground(lipgloss.Color(c)).Render("███")
		}
		return lipgloss.JoinHorizontal(lipgloss.Top, logo, "   ", info+sw), true
	case "whoami":
		user, addr := m.sess.User, m.sess.Addr
		if user == "" {
			user = "you"
		}
		if addr == "" {
			addr = "this machine"
		}
		term := m.sess.Term
		if term == "" {
			term = os.Getenv("TERM")
		}
		lines := []string{
			st.Dim.Render("user     ") + st.Fg.Render(user),
			st.Dim.Render("from     ") + st.Fg.Render(addr),
			st.Dim.Render("terminal ") + st.Fg.Render(fmt.Sprintf("%s, %d×%d cells", term, m.width, m.height)),
			st.Dim.Render("skin     ") + st.Fg.Render(m.p.Key),
			st.Dim.Render("visitor  ") + st.Fg.Render(fmt.Sprintf("#%d all time", m.sess.Visitor)),
			st.Dim.Render("here for ") + st.Fg.Render(humanDuration(m.uptime())),
		}
		return strings.Join(lines, "\n"), true
	case "uptime":
		return st.Fg.Render(fmt.Sprintf("up %s · %d sessions since boot · %d all time · load: one cup",
			humanDuration(time.Since(serverStart)), atomic.LoadInt64(&visitsBoot), atomic.LoadInt64(&visitsAll))), true
	case "context":
		lines := 0
		for _, t := range m.transcript {
			lines += strings.Count(t, "\n") + 1
		}
		cap := 200 * m.cups
		used := lines * 100 / cap
		if used > 100 {
			used = 100
		}
		n := used / 5
		bar := st.Clay.Render(strings.Repeat("▓", n)) + st.Dimmer.Render(strings.Repeat("░", 20-n))
		note := "plenty of room."
		if used > 60 {
			note = "getting full. /coffee adds a cup."
		}
		return fmt.Sprintf("context  %s  %d%% of %d cups · %s", bar, used, m.cups, note), true
	}
	return "", false
}

// konami is the sequence that turns the party on.
var konami = []string{"up", "up", "down", "down", "left", "right", "left", "right", "b", "a"}

// renderExperience is /experience: every entry, newest first, drawn like git log.
func (m *Model) renderExperience() string {
	st := m.st
	kinds := []struct{ key, label string }{
		{"job", "jobs"}, {"research", "research"}, {"lead", "leadership and cohorts"}, {"program", "programs"},
		{"honor", "honors"}, {"school", "high school"}, {"education", "education"},
	}
	var b strings.Builder
	for _, k := range kinds {
		first := true
		for _, e := range Experiences {
			if e.Kind != k.key {
				continue
			}
			if first {
				b.WriteString(st.Dimmer.Render("── ") + st.Fg.Render(k.label) + "\n")
				first = false
			}
			end := "now"
			if e.End != "" {
				end = e.End
			}
			mark := st.Clay.Render("*")
			if e.End != "" {
				mark = st.Dim.Render("*")
			}
			b.WriteString(fmt.Sprintf("%s %s %s  %s %s\n", mark, st.Clay.Render(shortHash(e.Org+e.Title)), st.Dim.Render(e.Start+" → "+end), st.Bold.Render(e.Org), st.Fg.Render("· "+e.Title)))
			for _, l := range strings.Split(wrap(e.Line, m.textWidth()-12), "\n") {
				b.WriteString(st.Dimmer.Render("|") + "         " + st.Dim.Render(l) + "\n")
			}
		}
	}
	b.WriteString(st.Dimmer.Render(fmt.Sprintf("(%d entries · LawBandit dates are from the résumé bank and may be a year off · /now for what is running)", len(Experiences))))
	return b.String()
}

func shortHash(s string) string {
	h := sha1.Sum([]byte(s))
	return fmt.Sprintf("%x", h[:])[:7]
}
