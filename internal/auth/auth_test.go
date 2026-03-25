package auth

import (
	"path/filepath"
	"testing"

	"server/internal/models"
)

func TestMatchesAnyPattern(t *testing.T) {
	tests := []struct {
		name      string
		serviceID string
		patterns  []string
		want      bool
	}{
		{"exact match", "plex", []string{"plex"}, true},
		{"no match", "plex", []string{"jellyfin"}, false},
		{"glob prefix", "sonarr", []string{"*arr"}, true},
		{"glob suffix", "unifi-controller", []string{"unifi-*"}, true},
		{"glob no match", "portainer", []string{"unifi-*"}, false},
		{"multiple patterns one match", "radarr", []string{"plex", "*arr"}, true},
		{"multiple patterns no match", "portainer", []string{"plex", "*arr"}, false},
		{"empty patterns", "plex", []string{}, false},
		{"empty service ID", "", []string{"plex"}, false},
		{"wildcard all", "anything", []string{"*"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := matchesAnyPattern(tt.serviceID, tt.patterns)
			if got != tt.want {
				t.Errorf("matchesAnyPattern(%q, %v) = %v, want %v", tt.serviceID, tt.patterns, got, tt.want)
			}
		})
	}
}

func TestFilterServicesForUser_Admin(t *testing.T) {
	services := []models.Service{
		{ID: "plex", Name: "Plex"},
		{ID: "sonarr", Name: "Sonarr"},
		{ID: "portainer", Name: "Portainer"},
	}

	result := FilterServicesForUser(services, []string{"admins"}, true)
	if len(result) != 3 {
		t.Errorf("Admin should see all services, got %d", len(result))
	}
}

func TestFilterServicesForUser_NoGroups(t *testing.T) {
	services := []models.Service{
		{ID: "plex", Name: "Plex"},
	}

	result := FilterServicesForUser(services, nil, false)
	if len(result) != 0 {
		t.Errorf("User with no groups should see no services, got %d", len(result))
	}
}

func TestFilepathMatch(t *testing.T) {
	// Verify filepath.Match behavior for our use case
	tests := []struct {
		pattern string
		name    string
		want    bool
	}{
		{"*arr", "sonarr", true},
		{"*arr", "radarr", true},
		{"*arr", "plex", false},
		{"unifi-*", "unifi-controller", true},
		{"unifi-*", "portainer", false},
		{"plex", "plex", true},
		{"*", "anything", true},
	}

	for _, tt := range tests {
		match, err := filepath.Match(tt.pattern, tt.name)
		if err != nil {
			t.Errorf("filepath.Match(%q, %q) error: %v", tt.pattern, tt.name, err)
		}
		if match != tt.want {
			t.Errorf("filepath.Match(%q, %q) = %v, want %v", tt.pattern, tt.name, match, tt.want)
		}
	}
}
