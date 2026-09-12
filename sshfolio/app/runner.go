package app

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/log"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/activeterm"
	"github.com/charmbracelet/wish/bubbletea"
	"github.com/charmbracelet/wish/logging"
	gossh "golang.org/x/crypto/ssh"
)

var programOptions = []tea.ProgramOption{tea.WithAltScreen(), tea.WithMouseCellMotion()}

// RunTUI runs the agent in the current terminal.
func RunTUI() {
	loadVisits()
	m := NewModel(lipgloss.DefaultRenderer(), 0, 0, Session{Visitor: countVisit()})
	if _, err := tea.NewProgram(m, programOptions...).Run(); err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}
}

// sshHandler builds a fresh model per connection, with colours negotiated for
// that session's terminal rather than the server's stdout.
func sshHandler(s ssh.Session) (tea.Model, []tea.ProgramOption) {
	r := bubbletea.MakeRenderer(s)
	pty, _, _ := s.Pty()
	sess := Session{User: s.User(), Addr: s.RemoteAddr().String(), Term: pty.Term, Cols: pty.Window.Width, Rows: pty.Window.Height, Visitor: countVisit()}
	if k := s.PublicKey(); k != nil && ownerKey != nil && ssh.KeysEqual(k, ownerKey) {
		sess.Owner = true
	}
	m := NewModel(r, pty.Window.Width, pty.Window.Height, sess)
	return m, programOptions
}

// ownerKey is Andy's public key, read from .ssh/owner.pub if present.
var ownerKey ssh.PublicKey

func loadOwnerKey() {
	b, err := os.ReadFile(".ssh/owner.pub")
	if err != nil {
		return
	}
	if k, _, _, _, err := gossh.ParseAuthorizedKey(b); err == nil {
		ownerKey = k
		log.Info("owner key loaded", "fingerprint", gossh.FingerprintSHA256(k))
	}
}

// RunSSHTUI serves the agent over ssh on HOST:PORT.
func RunSSHTUI(host, port string) {
	loadVisits()
	loadOwnerKey()
	server, err := wish.NewServer(
		wish.WithAddress(net.JoinHostPort(host, port)),
		wish.WithHostKeyPath(".ssh/id_ed25519"),
		// Anyone may connect: keys are accepted (and remembered, so /inbox can
		// recognise Andy's), and clients without a key fall through to
		// keyboard-interactive, which also always succeeds.
		wish.WithPublicKeyAuth(func(ssh.Context, ssh.PublicKey) bool { return true }),
		wish.WithKeyboardInteractiveAuth(func(ssh.Context, gossh.KeyboardInteractiveChallenge) bool { return true }),
		wish.WithMiddleware(
			bubbletea.Middleware(sshHandler),
			activeterm.Middleware(),
			logging.Middleware(),
		),
	)
	if err != nil {
		log.Fatal("could not create server", "error", err)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	log.Info("starting ssh server", "host", host, "port", port)
	go func() {
		if err = server.ListenAndServe(); err != nil && !errors.Is(err, ssh.ErrServerClosed) {
			log.Error("could not start server", "error", err)
			done <- nil
		}
	}()

	<-done
	log.Info("stopping ssh server")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil && !errors.Is(err, ssh.ErrServerClosed) {
		log.Error("could not stop server", "error", err)
	}
}
