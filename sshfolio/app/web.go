package app

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync/atomic"
)

// The website reads and bumps the same visitor counter as the ssh server, so
// andymsun.com and `ssh ssh.andymsun.com` show one number. Caddy terminates
// TLS in front of this; it only ever listens inside the compose network.
//
//	GET  /visits   {"total": n}
//	POST /visits   counts one web visit, returns {"total": n, "you": n}
func RunHTTP(addr string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/visits", func(w http.ResponseWriter, r *http.Request) {
		if o := r.Header.Get("Origin"); allowedOrigin(o) {
			w.Header().Set("Access-Control-Allow-Origin", o)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		switch r.Method {
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(map[string]int64{"total": atomic.LoadInt64(&visitsAll)})
		case http.MethodPost:
			n := countVisit()
			_ = json.NewEncoder(w).Encode(map[string]int64{"total": n, "you": n})
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://andymsun.com", http.StatusFound)
	})
	log.Printf("http on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Printf("http: %v", err)
	}
}

func allowedOrigin(o string) bool {
	return o == "https://andymsun.com" || o == "https://www.andymsun.com" ||
		strings.HasSuffix(o, ".vercel.app") || strings.HasPrefix(o, "http://localhost:") || strings.HasPrefix(o, "http://127.0.0.1:")
}
