package main

import (
	"log"
	"net/http"
	"strings"
	"time"

	"server/internal/config"
	"server/internal/handlers"
	"server/internal/i18n"
	"server/internal/icons"
	"server/internal/traefik"
)

// Version information set at build time
var (
	version   string
	commit    string
	buildTime string
)

// noDirListingFileServer wraps http.FileServer to disable directory listing.
func noDirListingFileServer(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "" || strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		fs.ServeHTTP(w, r)
	})
}

func main() {
	// Load configuration
	config.Load()

	// Initialize HTTP clients
	traefik.InitializeHTTPClient()

	// Create SSRF-safe HTTP client for icon discovery (blocks private/loopback IPs at dial time)
	externalHTTPClient := icons.NewSSRFSafeClient(5 * time.Second)
	icons.InitHTTPClient(externalHTTPClient)

	// Set debug mode for icons package based on log level
	if config.GetLogLevel() == "debug" {
		icons.SetDebugMode(true)
	}

	// Initialize i18n
	i18n.Init()

	// Set version info in handlers
	handlers.SetVersionInfo(version, commit, buildTime)

	// Load HTML templates
	handlers.LoadHTMLTemplate("/app/template")
	handlers.LoadAdminTemplate("/app/template")

	// Pre-warm caches
	go icons.GetSelfHstIconNames()
	go icons.GetSelfHstAppTags()
	go icons.ScanUserIcons()

	// Setup routes
	mux := http.NewServeMux()
	mux.HandleFunc("/api/services", handlers.ServicesHandler)
	mux.HandleFunc("/api/status", handlers.StatusHandler)
	mux.HandleFunc("/api/health", handlers.HealthHandler)
	mux.Handle("/static/", http.StripPrefix("/static/", noDirListingFileServer("/app/static")))
	mux.Handle("/icons/", http.StripPrefix("/icons/", noDirListingFileServer("/icons")))
	mux.HandleFunc("/", handlers.ServeHTMLTemplate)

	// Register admin routes
	mux.HandleFunc("/admin", handlers.AdminOnly(handlers.ServeAdminTemplate))
	mux.HandleFunc("/api/admin/config", handlers.AdminOnly(handlers.AdminConfigHandler))
	mux.HandleFunc("/api/admin/services/discovered", handlers.AdminOnly(handlers.DiscoveredServicesHandler))

	// Register userinfo route unconditionally (auth may be toggled at runtime via admin UI)
	mux.HandleFunc("/api/userinfo", handlers.UserInfoHandler)

	if config.GetAuthEnabled() {
		log.Println("Auth enabled. Dashboard services will be filtered based on proxy group headers.")
	} else {
		log.Println("WARNING: TraLa does not provide authentication. Ensure it is placed behind an authenticating reverse proxy.")
	}

	// Start server
	log.Println("Starting server on :8080...")
	server := &http.Server{
		Addr:              ":8080",
		Handler:           handlers.SecurityHeaders(mux),
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
