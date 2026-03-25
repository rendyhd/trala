package handlers

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/nicksnyder/go-i18n/v2/i18n"

	"server/internal/auth"
	"server/internal/config"
	appi18n "server/internal/i18n"
	"server/internal/models"
	"server/internal/services"
	"server/internal/traefik"
)

// --- Admin Template ---

var (
	adminOnce       sync.Once
	adminTemplate   *template.Template
)

// LoadAdminTemplate reads and parses the admin.html template.
func LoadAdminTemplate(templatePath string) {
	adminOnce.Do(func() {
		templateFilePath := filepath.Join(templatePath, "admin.html")
		data, err := os.ReadFile(templateFilePath)
		if err != nil {
			log.Printf("WARNING: Could not read admin.html template at %s: %v", templateFilePath, err)
			return
		}
		tmpl, err := template.New("admin").Funcs(template.FuncMap{
			"T": func(localizer *i18n.Localizer, id string) string {
				if localizer == nil {
					return id
				}
				msg, err := localizer.Localize(&i18n.LocalizeConfig{MessageID: id})
				if err != nil {
					return id
				}
				return msg
			},
		}).Parse(string(data))
		if err != nil {
			log.Printf("WARNING: Could not parse admin.html: %v", err)
			return
		}
		adminTemplate = tmpl
	})
}

// --- Admin Middleware ---

// AdminOnly wraps a handler to restrict access to admin users.
// When auth is enabled, only users in the admin group can access.
// When auth is disabled, all requests pass through.
func AdminOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if config.GetAuthEnabled() {
			userGroups := auth.ExtractUserGroups(r)
			if !auth.IsAdmin(userGroups) {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	}
}

// --- Admin Handlers ---

// ServeAdminTemplate renders the admin settings page.
func ServeAdminTemplate(w http.ResponseWriter, r *http.Request) {
	if adminTemplate == nil {
		http.Error(w, "Admin page not available", http.StatusInternalServerError)
		return
	}

	lang := config.GetLanguage()
	localizer := appi18n.GetLocalizer(lang)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	data := map[string]interface{}{
		"Localizer": localizer,
	}
	if err := adminTemplate.Execute(w, data); err != nil {
		http.Error(w, "Template execution error", http.StatusInternalServerError)
	}
}

// AdminConfigHandler handles GET and PUT requests for the admin configuration.
func AdminConfigHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		adminConfigGet(w, r)
	case http.MethodPut:
		adminConfigPut(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// adminConfigGet returns the current file-level configuration and env override indicators.
func adminConfigGet(w http.ResponseWriter, r *http.Request) {
	response := models.AdminConfigResponse{
		Config:       config.GetFileConfiguration(),
		EnvOverrides: config.GetEnvOverrides(),
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("ERROR: Failed to encode admin config response: %v", err)
	}
}

// adminConfigPut validates and saves a new configuration.
func adminConfigPut(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
	var newConfig models.TralaConfiguration
	if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Basic validation
	if newConfig.Version == "" {
		newConfig.Version = config.GetFileConfiguration().Version
	}

	if err := config.SaveToFile(newConfig); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save configuration: %v", err), http.StatusInternalServerError)
		return
	}

	// Reinitialize Traefik HTTP client in case insecure_skip_verify changed
	traefik.InitializeHTTPClient()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Configuration saved and reloaded",
	})
}

// DiscoveredServicesHandler returns all currently discovered Traefik service IDs and names.
// This is used by the permission matrix in the admin UI.
func DiscoveredServicesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Fetch Traefik services
	entryPointsURL := fmt.Sprintf("%s/api/entrypoints", config.GetTraefikAPIHost())
	entryPoints, err := traefik.FetchAllPages[models.TraefikEntryPoint](w, entryPointsURL)
	if err != nil {
		return
	}

	entryPointsMap := make(map[string]models.TraefikEntryPoint, len(entryPoints))
	for _, ep := range entryPoints {
		entryPointsMap[ep.Name] = ep
	}

	routersURL := fmt.Sprintf("%s/api/http/routers", config.GetTraefikAPIHost())
	routers, err := traefik.FetchAllPages[models.TraefikRouter](w, routersURL)
	if err != nil {
		return
	}

	// Process routers to get service IDs
	var wg sync.WaitGroup
	serviceChan := make(chan models.Service, len(routers))
	for _, router := range routers {
		wg.Add(1)
		go func(r models.TraefikRouter) {
			defer wg.Done()
			service, ok := services.ProcessRouter(r, entryPointsMap)
			if ok {
				serviceChan <- service
			}
		}(router)
	}
	wg.Wait()
	close(serviceChan)

	discovered := make([]models.DiscoveredService, 0)
	seen := make(map[string]bool)
	for service := range serviceChan {
		id := strings.ToLower(service.ID)
		if !seen[id] {
			seen[id] = true
			discovered = append(discovered, models.DiscoveredService{
				ID:   id,
				Name: service.Name,
			})
		}
	}

	// Add manual services
	for _, ms := range services.GetManualServices() {
		id := strings.ToLower(ms.Name)
		if !seen[id] {
			seen[id] = true
			discovered = append(discovered, models.DiscoveredService{
				ID:   id,
				Name: ms.Name,
			})
		}
	}

	sort.Slice(discovered, func(i, j int) bool {
		return discovered[i].Name < discovered[j].Name
	})

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(discovered); err != nil {
		log.Printf("ERROR: Failed to encode discovered services: %v", err)
	}
}
