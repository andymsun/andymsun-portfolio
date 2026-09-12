package app

// Everything the agent "knows". Keep in step with app.js on the web side.

const SSHCommand = "ssh ssh.andymsun.com"

var About = []string{
	"Andy is a third-year at the University of Chicago studying computer science and computational & applied mathematics (class of 2028). Odyssey, First Phoenix, and QuestBridge scholar. From Flushing, Queens.",
	"The through-line is human–computer interaction: making capable systems usable by people who did not build them. Lately that means interfaces for language models that are not a chat box, evaluation work where the uncertainty stays on the page, and terminal software like the one you are talking to.",
	"Right now: software engineering intern at KindEd (K–12 portals), undergraduate researcher at CUNY College of Staten Island (Span-Aware Mixture of Agents, on H200/A100/V100s), and prompt engineer on contract at Scale AI (finding where pre-release models fail). Before that: TipTop, LawBandit, CareLumi. /experience has all of it.",
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
	{"0214", "running", "job", "KindEd", "SWE intern · Django Channels, WebSockets, Redis · 2026 –"},
	{"0301", "running", "research", "CUNY CSI", "researcher · Span-Aware Mixture of Agents · 2026 –"},
	{"0188", "running", "contract", "Scale AI", "prompt engineer · red-teaming pre-release LLMs · 2025 –"},
	{"0333", "running", "cohort", "Financial Markets", "3-year quant finance cohort, Booth coursework · 2025 –"},
	{"0090", "daily", "life", "badminton", "logistics officer · every open gym · 2025 –"},
	{"0546", "active", "oss", "sshfolio", "this program · 2026"},
	{"0402", "active", "side", "pSiren", "take a song apart, rebuild it · 2025 –"},
	{"0410", "active", "cert", "Google Data Analytics", "in progress · 2025 –"},
	{"0290", "stopped", "job", "TipTop Technologies", "SWE intern (Metcalf) · summer 2026"},
	{"0250", "stopped", "job", "LawBandit", "SWE intern · spring 2026"},
	{"0116", "stopped", "job", "CareLumi", "SWE intern · fall 2025"},
}

// Experience is the full log: every job, research post, cohort, program,
// honor, and high-school role. /experience prints it like git log.
type Experience struct {
	Kind, Org, Title, Start, End, Line string // End "" means present
}

var Experiences = []Experience{
	// jobs
	{"job", "TipTop Technologies", "software engineering intern (Metcalf)", "2026-06", "2026-08", "iOS Live Activity and Dynamic Island through a Swift Capacitor plugin; a CSS-token theming engine (light, dark, OLED, skins) raised to WCAG AA; fixed a navigation crash by lifting session state."},
	{"job", "KindEd", "software engineering intern", "2026-03", "", "real-time collaboration on Django Channels, WebSockets, and Redis; multi-tenant portals with role-scoped access and invite onboarding; closed a cross-tenant data leak with origin validation and object-level scoping."},
	{"job", "LawBandit", "software engineering intern", "2026-03", "2026-05", "a library of 25+ modular UI components standardising the front end of a legal AI adoption manual."},
	{"job", "Scale AI", "prompt engineer (contract)", "2025-05", "", "red-team pre-release LLMs, 50+ critical model failures catalogued; synthetic-data pipelines feeding fine-tuning; trained and evaluated contractors across four teams."},
	{"job", "CareLumi", "software engineering intern", "2025-09", "2025-12", "fine-tuned domain LLMs behind a multi-agent clinical documentation system; production AWS infrastructure (S3, EC2, Cognito, Neptune) for pilot deployments; real pilot data in the evaluation pipeline."},
	// research
	{"research", "CUNY College of Staten Island", "undergraduate researcher, advised by Prof. Yumei Huo and Prof. Tianxiao Zhang", "2026-05", "", "Span-Aware Mixture of Agents: layered multi-agent aggregation extended to span-level selection. Owns the code, tests, ablations against the MoA baseline, and the literature review. Runs on H200, A100, V100."},
	// leadership and cohorts
	{"lead", "Financial Markets Program", "selected cohort member", "2025-07", "", "selective three-year quantitative finance program with coursework at Chicago Booth, weekly workshops, employer visits."},
	{"lead", "UChicago Badminton Club", "logistics officer", "2025-04", "", "dues, registrations, suppliers, inventory, an annual regional tournament for 100+ members; the club site and live play board."},
	{"lead", "Goldman Sachs Virtual Insight Series", "participant", "2025-05", "2025-06", "four-week program on the firm's structure and career paths."},
	{"lead", "Goldman Sachs Possibilities Summit", "participant", "2024-12", "2025-06", "competitive career-development program: risk analysis, data analytics, operations."},
	{"lead", "Trott Emerging Business Leaders", "selected cohort member", "2024-09", "2025-05", "one-year business-acumen cohort; TEBL Scholar; TEBL Google Professional Certificate grant."},
	// UChicago programs
	{"program", "San Francisco Tech & AI Trek", "UChicago", "2026-03", "2026-03", "a week of Bay Area startups and labs."},
	{"program", "AI Integration Program", "UChicago", "2026-01", "2026-03", "winter 2026."},
	{"program", "Succeeding in the Entrepreneurial Workplace", "UChicago, advanced cohort", "2026-01", "2026-03", "winter 2026."},
	{"program", "Berlin & Frankfurt STEM & Startups Trek", "UChicago", "2025-12", "2025-12", "a week of German startups and research institutes."},
	{"program", "Google Data Analytics Professional Certificate", "Coursera", "2025-06", "", "in progress."},
	// honors
	{"honor", "Odyssey Scholar · First Phoenix Scholar · QuestBridge Scholar", "UChicago", "2024-09", "", "first-generation, low-income scholarships; QuestBridge National College Match, December 2023."},
	{"honor", "Financial Markets Scholar · TEBL Scholar", "UChicago", "2024-09", "", "with the cohorts above."},
	{"honor", "AP Scholar · ARISTA National Honor Society · Principal's Honor Roll · Regents Mastery", "Queens High School for the Sciences at York College", "2020-09", "2024-06", "4.00 GPA, Advanced Regents Diploma."},
	// high school
	{"school", "Queens Youth Volunteering Community", "founding member and volunteer", "2021-11", "2024-06", "helped grow the organisation to 300+ members."},
	{"school", "QHSS Model United Nations", "secretary and delegate", "2021-09", "2024-06", "competitive conference team."},
	{"school", "NYPD PSA 9", "communications assistant", "2023-07", "2023-08", "planned and attended community outreach events."},
	{"school", "Ivy Road Prep", "teaching assistant", "2022-07", "2022-11", "200+ hours of teaching assistance."},
	// education
	{"education", "The University of Chicago", "B.S. computer science + computational and applied mathematics", "2024-09", "2028-06", "expected June 2028. Coursework: mathematical foundations of ML, abstract linear algebra, analysis in Rⁿ, systems programming."},
	{"education", "Queens High School for the Sciences at York College", "Advanced Regents Diploma", "2020-09", "2024-06", "Flushing, Queens; 4.00."},
}

type Command struct{ Name, Desc string }

var Commands = []Command{
	{"/now", "what is running"},
	{"/experience", "the whole log, like git log"},
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
	{"/agents", "the roster"},
	{"/mcp", "connected servers"},
	{"/skills", "what he can do"},
	{"/skill", "run one"},
	{"/effort", "low · medium · high · max"},
	{"/tab", "new · next · prev · close"},
	{"/status", "account and session"},
	{"/doctor", "diagnostics"},
	{"/login", "there is no login"},
	{"/feedback", "rate the session"},
	{"/inbox", "what visitors said (owner)"},
	{"/help", "this list"},
	{"/model", "which andy is this"},
	{"/cost", "what this session cost"},
	{"/clear", "clear the screen"},
	{"/exit", "leave"},
}
