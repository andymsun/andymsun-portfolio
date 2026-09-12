package app

// Everything the agent "knows". Keep in step with app.js on the web side.

const SSHCommand = "ssh ssh.andymsun.com"

var About = []string{
	"Andy is a third-year at the University of Chicago studying computer science and computational & applied mathematics (class of 2028). Odyssey, First Phoenix, and QuestBridge scholar. From Flushing, Queens.",
	"The through-line is human–computer interaction: making capable systems usable by people who did not build them. Lately that means interfaces for language models that are not a chat box, evaluation work where the uncertainty stays on the page, and terminal software like the one you are talking to.",
	"Right now: software engineering intern at KindEd (K–12 portals), undergraduate researcher at CUNY College of Staten Island (an AI system that revises documents, run on H200/A100/V100s), and prompt engineer at Outlier AI (finding where pre-release models fail).",
}

type Project struct {
	File  string
	Lines int
	Name  string
	Year  string
	Blurb string
	Body  string
	Stack []string
	Links [][2]string
}

var Projects = []Project{
	{File: "projects/lawvics.md", Lines: 31, Name: "Lawvics", Year: "2026",
		Blurb: "One legal question, answered across all 50 states.",
		Body:  "Built in under 48 hours; finalist at the UChicago Vibe Coding Hackathon. One agent turns a question into fifty jurisdiction-specific searches and runs them in five batches. A second agent audits every result: schema checks, citation format, and a flag for statutes that may have been repealed. A D3 map colors each state as its answer lands.",
		Stack: []string{"Next.js 16", "React 19", "TypeScript", "Vercel AI SDK", "Zod", "Zustand", "D3"},
		Links: [][2]string{{"source", "github.com/andymsun/lawvics"}, {"demo", "lawvics.vercel.app"}}},
	{File: "projects/rivendell.md", Lines: 22, Name: "Rivendell", Year: "2026",
		Blurb: "A live 3D map of everything moving around the planet.",
		Body:  "8,000+ satellites, 6,000+ flights, and 500+ vessels drawn on Google's photorealistic 3D tiles, fed from several live sources at once. The hard parts were on the client: thousands of moving objects at 60 fps and a scene that stays readable at every zoom level.",
		Stack: []string{"Next.js", "TypeScript", "React", "Three.js", "Google 3D Tiles"}},
	{File: "projects/sshfolio.md", Lines: 27, Name: "sshfolio", Year: "2026",
		Blurb: "This program. You are inside it.",
		Body:  "A Go SSH server that gives every connection a program instead of a shell: this prompt, these slash commands, this spinner. No account, nothing to install, Ctrl-C twice to leave. Runs on a small VPS whose real sshd was moved off port 22 so visitors get the app. andymsun.com is the same thing with more pixels.",
		Stack: []string{"Go", "bubbletea", "wish", "lipgloss"},
		Links: [][2]string{{"source", "github.com/andymsun/andymsun-portfolio"}, {"web", "andymsun.com"}}},
	{File: "projects/psiren.md", Lines: 24, Name: "pSiren", Year: "2025 –",
		Blurb: "Take a finished song apart and rebuild it with different voices.",
		Body:  "A music workspace for one person who wants the reach of a band. Separates a recording into vocal, instruments, and room, converts the lead with a voice model, and remixes over the original accompaniment, on an Apple Silicon laptop. In progress: per-instrument separation and instrument swaps that keep the notes and change the timbre.",
		Stack: []string{"Python", "PyTorch (MPS)", "Mel-Band Roformer", "RVC"}},
	{File: "projects/badminton.md", Lines: 12, Name: "UChicago Badminton", Year: "2025 –",
		Blurb: "Club website and a live play board for open gym.",
		Body:  "Logistics officer for a 100+ member club: dues, registrations, suppliers, a regional tournament, and the board that shows who is on which court. The improvements come from being at every open gym and watching where people get stuck.",
		Stack: []string{"a website", "a whiteboard, digitized"}},
}

var Verbs = []string{"Caffeinating", "Percolating", "Not sleeping", "Reticulating", "Pondering", "Compiling", "Mulling", "Brewing", "Vibing", "Herding statutes", "Smashing", "Noodling", "Marinating", "Cogitating", "Clearing the court", "Simmering", "Shucking", "Debugging life", "Transmuting", "Honking"}

var Glyphs = []string{"·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"}

// Now is /now: a process table. PIDs are arbitrary but stable; status is honest.
type Proc struct{ PID, Status, Tag, What, Note string }

var Now = []Proc{
	{"0214", "running", "job", "KindEd", "software engineering intern · K–12 portals · 2026 –"},
	{"0301", "running", "research", "CUNY CSI", "an AI system that revises documents · H200/A100 · 2026 –"},
	{"0188", "running", "job", "Outlier AI", "prompt engineer · where pre-release models fail · 2025 –"},
	{"0546", "active", "oss", "sshfolio", "this program · 2026"},
	{"0402", "active", "side", "pSiren", "take a song apart, rebuild it · 2025 –"},
	{"0116", "stopped", "job", "CareLumi", "software engineering intern · fall 2025"},
	{"0090", "daily", "life", "badminton", "every open gym · logistics officer, UChicago club"},
}

type Command struct{ Name, Desc string }

var Commands = []Command{
	{"/now", "what is running"},
	{"/about", "who andy is"},
	{"/projects", "read the work"},
	{"/contact", "email, github, linkedin"},
	{"/web", "the one with pixels"},
	{"/agent", "claude · codex · agy"},
	{"/whoami", "what the server sees"},
	{"/uptime", "how long this has been up"},
	{"/context", "how full the cups are"},
	{"/coffee", "brew one"},
	{"/fortune", "a small truth"},
	{"/badminton", "one rally"},
	{"/matrix", "you know"},
	{"/help", "this list"},
	{"/model", "which andy is this"},
	{"/cost", "what this session cost"},
	{"/clear", "clear the screen"},
	{"/exit", "leave"},
}
