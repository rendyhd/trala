# TraLa (Fork)

A modern, dynamic dashboard for Traefik services. Forked from [dannybouwers/trala](https://github.com/dannybouwers/trala) because my setup needs multi-user support with per-group service visibility — something upstream doesn't offer. Along the way I added a web-based settings UI.

## What's different in this fork

### Header-based auth with per-group dashboard filtering
- Authenticate users via headers set by a reverse proxy (e.g. Authentik, Authelia)
- Define groups in configuration, each with a list of allowed services
- Users only see services their group is permitted to access
- Case-insensitive permission matching for service IDs

### Web-based settings/admin page
- Configure TraLa from the browser instead of editing YAML files
- Environment variable overrides documented

### Other improvements
- Strip `-secure` suffix from router names for correct display and icon lookup

## Original Features

- **Auto-Discovery** — Automatically fetches and displays all HTTP routers from Traefik
- **Icon Auto-Detection** — Intelligently finds icons using selfh.st/icons
- **Smart Grouping** — Automatically group services based on tags
- **Light/Dark Mode** — Automatic theme based on OS settings
- **Manual Services** — Add custom services not managed by Traefik
- **Multi-Language** — Available in English, German, and Dutch
- **Multi-Arch** — Built for amd64 and arm64 architectures
- **Header Auth & Group Filtering** — Per-group service visibility via reverse proxy headers
- **Settings UI** — Web-based configuration management

## Quick Start

### Minimal (no auth)

```yaml
services:
  trala:
    image: ghcr.io/rendyhd/trala:latest
    environment:
      - TRAEFIK_API_HOST=http://traefik:8080
    volumes:
      - ./config:/config
```

The `/config` directory must be writable by the container (runs as UID 1000). On the host:

```bash
chown -R 1000:1000 ./config
```

Everything else (grouping, icons, manual services, exclusions, overrides) can be configured from the **Settings UI** at `/admin`.

### With auth (reverse proxy)

When using a reverse proxy like Authentik or Authelia, the **admin group must be set before startup** — otherwise nobody can access the Settings UI to configure anything else.

```yaml
services:
  trala:
    image: ghcr.io/rendyhd/trala:latest
    environment:
      # Required
      - TRAEFIK_API_HOST=http://traefik:8080
      # Auth — these must be pre-configured
      - AUTH_ENABLED=true
      - AUTH_ADMIN_GROUP=admins               # group that can access /admin
      # Only change these if your proxy uses different header names
      # - AUTH_GROUPS_HEADER=X-Authentik-Groups
      # - AUTH_USER_HEADER=X-Authentik-Username
      # - AUTH_GROUP_SEPARATOR=|
    volumes:
      - ./config:/config
```

Once running, an admin user can open `/admin` to:
- Add **group permissions** (which groups can see which services) via an interactive permission matrix
- Add manual services, service overrides, and exclusions
- Change general settings (language, refresh interval, icon URL, etc.)
- Adjust grouping settings

### What must be pre-configured vs. what can be done in Settings

| Setting | Pre-configure (env/compose) | Configurable in Settings UI |
|---------|:-:|:-:|
| `TRAEFIK_API_HOST` | **Required** | Read-only if set via env |
| `AUTH_ENABLED` | Yes, to enable auth | Read-only if set via env |
| `AUTH_ADMIN_GROUP` | **Yes** — gates access to `/admin` | Read-only if set via env |
| Auth header names | Only if not using Authentik defaults | Read-only if set via env |
| Group permissions | — | Yes (permission matrix) |
| Manual services | — | Yes |
| Service overrides | — | Yes |
| Exclusions | — | Yes |
| Grouping settings | — | Yes |
| Language, refresh interval, icons | — | Yes |
| Traefik basic auth password | Env var or config file only | Not editable in UI |

Any setting defined as an environment variable takes precedence over the config file and appears as read-only in the Settings UI.

## Documentation

- [Quick Start](docs/README.md)
- [Setup](docs/setup.md)
- [Configuration](docs/configuration.md)
- [Services](docs/services.md)
- [Grouping](docs/grouping.md)
- [Icons](docs/icons.md)
- [Search](docs/search.md)
- [Security](docs/security.md)

## Upstream

This fork is based on [dannybouwers/trala](https://github.com/dannybouwers/trala). Upstream features like auto-discovery, icon detection, grouping, and theming are preserved. This fork diverges with auth, security hardening, and the settings UI.

## License

MIT License — see the [LICENSE](LICENSE) file for details.
