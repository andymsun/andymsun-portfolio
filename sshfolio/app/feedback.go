package app

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// Feedback is one rating, written as a JSON line to .ssh/feedback.log (a
// mounted volume on the server, so it survives rebuilds). Andy reads it with
// /inbox when connected with his own key, or with cat over the admin port.
type Feedback struct {
	Time     time.Time `json:"time"`
	Visitor  int64     `json:"visitor"`
	User     string    `json:"user"`
	Addr     string    `json:"addr"`
	Skin     string    `json:"skin"`
	Rating   string    `json:"rating"` // "1" bad, "2" fine, "3" good
	Comment  string    `json:"comment,omitempty"`
	Duration string    `json:"session"`
	Commands int       `json:"commands"`
}

const feedbackFile = ".ssh/feedback.log"

var ratingWord = map[string]string{"1": "bad", "2": "fine", "3": "good"}

func (m *Model) writeFeedback(rating, comment string) {
	fb := Feedback{Time: time.Now().UTC(), Visitor: m.sess.Visitor, User: m.sess.User, Addr: m.sess.Addr,
		Skin: m.p.Key, Rating: rating, Comment: strings.TrimSpace(comment), Duration: humanDuration(m.uptime()), Commands: m.cmdCount}
	b, err := json.Marshal(fb)
	if err != nil {
		return
	}
	f, err := os.OpenFile(feedbackFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(b, '\n'))
}

func readFeedback(limit int) ([]Feedback, int) {
	f, err := os.Open(feedbackFile)
	if err != nil {
		return nil, 0
	}
	defer f.Close()
	var all []Feedback
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		var fb Feedback
		if json.Unmarshal(sc.Bytes(), &fb) == nil {
			all = append(all, fb)
		}
	}
	total := len(all)
	if len(all) > limit {
		all = all[len(all)-limit:]
	}
	return all, total
}

// renderInbox is /inbox for the owner: the last ratings, newest first.
func (m *Model) renderInbox() string {
	st := m.st
	items, total := readFeedback(15)
	if total == 0 {
		return st.Dim.Render("No feedback yet. It lands here when a visitor answers the rating prompt.")
	}
	counts := map[string]int{}
	for _, it := range items {
		counts[it.Rating]++
	}
	var b strings.Builder
	b.WriteString(st.Fg.Render(fmt.Sprintf("Inbox · %d total, showing last %d", total, len(items))) + "\n")
	for i := len(items) - 1; i >= 0; i-- {
		it := items[i]
		mark := st.Ok.Render("●")
		switch it.Rating {
		case "1":
			mark = st.Clay.Render("●")
		case "2":
			mark = st.Dim.Render("●")
		}
		who := it.User
		if who == "" {
			who = "?"
		}
		line := fmt.Sprintf("%s %s  %-4s  #%d %s@%s · %s · %s · %d cmds",
			mark, st.Dim.Render(it.Time.Local().Format("Jan 02 15:04")), ratingWord[it.Rating], it.Visitor, who, it.Addr, it.Skin, it.Duration, it.Commands)
		b.WriteString(line + "\n")
		if it.Comment != "" {
			b.WriteString("    " + st.Fg.Render("“"+it.Comment+"”") + "\n")
		}
	}
	return strings.TrimRight(b.String(), "\n")
}
