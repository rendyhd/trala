// Package auth provides header-based authentication support for the Trala dashboard.
// It reads user and group information from reverse proxy headers (e.g. Authentik)
// and filters services based on group permissions defined in the configuration.
package auth

import (
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"server/internal/config"
	"server/internal/logging"
	"server/internal/models"
)

// ExtractUserGroups reads the groups header from the request and returns the user's groups.
func ExtractUserGroups(r *http.Request) []string {
	authConfig := config.GetAuthConfig()
	header := r.Header.Get(authConfig.GroupsHeader)
	if header == "" {
		return nil
	}

	parts := strings.Split(header, authConfig.GroupSeparator)
	groups := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			groups = append(groups, trimmed)
		}
	}
	return groups
}

// ExtractUserName reads the user header from the request and returns the username.
func ExtractUserName(r *http.Request) string {
	authConfig := config.GetAuthConfig()
	return r.Header.Get(authConfig.UserHeader)
}

// IsAdmin checks if any of the user's groups match the configured admin group.
func IsAdmin(groups []string) bool {
	adminGroup := config.GetAuthConfig().AdminGroup
	if adminGroup == "" {
		return false
	}
	for _, g := range groups {
		if g == adminGroup {
			return true
		}
	}
	return false
}

// FilterServicesForUser filters services based on the user's group memberships.
// Admin users see all services. Other users only see services that are explicitly
// allowed for at least one of their groups via glob patterns in group_permissions.
// If auth is disabled or no groups header is present, all services are returned.
func FilterServicesForUser(services []models.Service, userGroups []string, isAdmin bool) []models.Service {
	if isAdmin {
		debugf("Admin user, returning all %d services", len(services))
		return services
	}

	// Collect all allowed patterns from the user's groups
	groupPermissions := config.GetAuthGroupPermissions()
	allowedPatterns := make([]string, 0)
	for _, group := range userGroups {
		if patterns, ok := groupPermissions[group]; ok {
			allowedPatterns = append(allowedPatterns, patterns...)
		}
	}

	if len(allowedPatterns) == 0 {
		debugf("No allowed patterns for groups %v, returning empty list", userGroups)
		return []models.Service{}
	}

	// Filter services: keep only those matching at least one allowed pattern
	filtered := make([]models.Service, 0, len(services))
	for _, service := range services {
		if matchesAnyPattern(service.ID, allowedPatterns) {
			filtered = append(filtered, service)
		}
	}

	debugf("Filtered %d services down to %d for groups %v", len(services), len(filtered), userGroups)
	return filtered
}

// matchesAnyPattern checks if a service ID matches any of the given glob patterns.
func matchesAnyPattern(serviceID string, patterns []string) bool {
	for _, pattern := range patterns {
		match, err := filepath.Match(pattern, serviceID)
		if err != nil {
			log.Printf("WARNING: invalid group_permissions pattern %q: %v", pattern, err)
			continue
		}
		if match {
			return true
		}
	}
	return false
}

// debugf is a convenience alias for logging.Debugf.
var debugf = logging.Debugf
