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
)

var programOptions = []tea.ProgramOption{tea.WithAltScreen(), tea.WithMouseCellMotion()}

// RunTUI runs the agent in the current terminal.
func RunTUI() {
	m := NewModel(lipgloss.DefaultRenderer(), 0, 0)
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
	m := NewModel(r, pty.Window.Width, pty.Window.Height)
	return m, programOptions
}

// RunSSHTUI serves the agent over ssh on HOST:PORT.
func RunSSHTUI(host, port string) {
	server, err := wish.NewServer(
		wish.WithAddress(net.JoinHostPort(host, port)),
		wish.WithHostKeyPath(".ssh/id_ed25519"),
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
