// sshfolio: andymsun.com as a program you ssh into.
//
//	SSH_SERVER_ENABLED=false  run the agent in this terminal
//	SSH_SERVER_ENABLED=true   serve it on HOST:PORT (the server uses 22)
package main

import (
	"os"
	"strconv"

	"sshfolio/app"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load() // .env is optional; env vars win

	serve, _ := strconv.ParseBool(os.Getenv("SSH_SERVER_ENABLED"))
	if !serve {
		app.RunTUI()
		return
	}
	host, port := os.Getenv("HOST"), os.Getenv("PORT")
	if host == "" {
		host = "0.0.0.0"
	}
	if port == "" {
		port = "22"
	}
	app.RunSSHTUI(host, port)
}
