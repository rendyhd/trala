// TraLa Admin Settings Page
'use strict';

let currentConfig = null;
let envOverrides = {};
let discoveredServices = [];
let currentSection = 'general';
let hasUnsavedChanges = false;

// --- Initialization ---

async function init() {
    await loadConfig();
    await loadDiscoveredServices();
    setupNavigation();
    renderSection('general');
    document.getElementById('save-btn').addEventListener('click', saveConfig);
}

async function loadConfig() {
    try {
        const response = await fetch('/api/admin/config');
        if (response.status === 403) {
            document.getElementById('content-area').innerHTML = '<p style="color:#ef4444">Access denied. Admin privileges required.</p>';
            return;
        }
        if (!response.ok) throw new Error('Failed to load config');
        const data = await response.json();
        currentConfig = data.config;
        envOverrides = data.envOverrides || {};
    } catch (error) {
        showToast('Failed to load configuration', 'error');
        console.error(error);
    }
}

async function loadDiscoveredServices() {
    try {
        const response = await fetch('/api/admin/services/discovered');
        if (response.ok) {
            discoveredServices = await response.json();
        }
    } catch (error) {
        console.error('Failed to load discovered services:', error);
    }
}

async function saveConfig() {
    if (!currentConfig) return;
    try {
        const response = await fetch('/api/admin/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentConfig),
        });
        if (!response.ok) {
            const text = await response.text();
            showToast('Save failed: ' + text, 'error');
            return;
        }
        hasUnsavedChanges = false;
        showToast('Configuration saved successfully', 'success');
        await loadConfig();
        renderSection(currentSection);
    } catch (error) {
        showToast('Save failed: ' + error.message, 'error');
    }
}

// --- Navigation ---

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            if (section) {
                currentSection = section;
                renderSection(section);
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });
}

// --- Section Rendering ---

const sectionTitles = {
    general: 'General Settings',
    traefik: 'Traefik Connection',
    grouping: 'Grouping Settings',
    auth: 'Authentication',
    permissions: 'Group Permissions',
    manual: 'Manual Services',
    overrides: 'Service Overrides',
    exclusions: 'Exclusions',
};

function renderSection(section) {
    document.getElementById('section-title').textContent = sectionTitles[section] || section;
    const area = document.getElementById('content-area');
    if (!currentConfig) {
        area.innerHTML = '<p style="color:#9ca3af">Loading...</p>';
        return;
    }
    const renderers = {
        general: renderGeneral,
        traefik: renderTraefik,
        grouping: renderGrouping,
        auth: renderAuth,
        permissions: renderPermissions,
        manual: renderManualServices,
        overrides: renderOverrides,
        exclusions: renderExclusions,
    };
    const render = renderers[section];
    if (render) {
        area.innerHTML = '';
        area.appendChild(render());
    }
}

// --- Helper Functions ---

function isEnvOverridden(envVar) {
    return envOverrides[envVar] === true;
}

function card(title, content) {
    const div = document.createElement('div');
    div.className = 'admin-card';
    if (title) {
        const h = document.createElement('h3');
        h.className = 'card-title';
        h.textContent = title;
        div.appendChild(h);
    }
    if (typeof content === 'string') {
        const c = document.createElement('div');
        c.textContent = content;
        div.appendChild(c);
    } else if (content) {
        div.appendChild(content);
    }
    return div;
}

function fieldRow(label, input, envVar) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    if (envVar && isEnvOverridden(envVar)) {
        const badge = document.createElement('span');
        badge.className = 'env-badge';
        badge.textContent = 'ENV: ' + envVar;
        lbl.appendChild(badge);
        if (input.tagName === 'INPUT' || input.tagName === 'SELECT' || input.tagName === 'BUTTON') {
            input.disabled = true;
            input.style.opacity = '0.5';
            input.style.cursor = 'not-allowed';
        }
    }
    row.appendChild(lbl);
    row.appendChild(input);
    return row;
}

function textInput(value, onChange, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.addEventListener('input', () => { onChange(input.value); hasUnsavedChanges = true; });
    return input;
}

function numberInput(value, onChange, min, max, step) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    input.addEventListener('input', () => { onChange(Number(input.value)); hasUnsavedChanges = true; });
    return input;
}

function selectInput(value, options, onChange) {
    const select = document.createElement('select');
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === value) o.selected = true;
        select.appendChild(o);
    });
    select.addEventListener('change', () => { onChange(select.value); hasUnsavedChanges = true; });
    return select;
}

function toggleInput(value, onChange) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-toggle';
    btn.dataset.on = value ? '1' : '';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', value ? 'true' : 'false');
    const dot = document.createElement('span');
    dot.className = 'toggle-dot';
    btn.appendChild(dot);
    btn.addEventListener('click', () => {
        const newVal = btn.dataset.on !== '1';
        btn.dataset.on = newVal ? '1' : '';
        btn.setAttribute('aria-checked', newVal ? 'true' : 'false');
        onChange(newVal);
        hasUnsavedChanges = true;
    });
    return btn;
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    const inner = toast.querySelector('div');
    inner.textContent = message;
    inner.className = type === 'error' ? 'toast-error' : 'toast-success';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// --- Section: General ---

function renderGeneral() {
    const frag = document.createDocumentFragment();
    const fields = document.createElement('div');

    fields.appendChild(fieldRow('Icon Base URL', textInput(
        currentConfig.environment.selfhstIconURL,
        v => { currentConfig.environment.selfhstIconURL = v; }
    ), 'SELFHST_ICON_URL'));

    fields.appendChild(fieldRow('Search Engine URL', textInput(
        currentConfig.environment.searchEngineURL,
        v => { currentConfig.environment.searchEngineURL = v; }
    ), 'SEARCH_ENGINE_URL'));

    fields.appendChild(fieldRow('Refresh Interval (seconds)', numberInput(
        currentConfig.environment.refreshIntervalSeconds,
        v => { currentConfig.environment.refreshIntervalSeconds = v; },
        1
    ), 'REFRESH_INTERVAL_SECONDS'));

    fields.appendChild(fieldRow('Log Level', selectInput(
        currentConfig.environment.logLevel,
        [
            { value: 'info', label: 'Info' },
            { value: 'debug', label: 'Debug' },
            { value: 'warn', label: 'Warn' },
            { value: 'error', label: 'Error' },
        ],
        v => { currentConfig.environment.logLevel = v; }
    ), 'LOG_LEVEL'));

    fields.appendChild(fieldRow('Language', selectInput(
        currentConfig.environment.language,
        [
            { value: '', label: 'Default (English)' },
            { value: 'en', label: 'English' },
            { value: 'de', label: 'Deutsch' },
            { value: 'nl', label: 'Nederlands' },
        ],
        v => { currentConfig.environment.language = v; }
    ), 'LANGUAGE'));

    frag.appendChild(card(null, fields));
    return frag;
}

// --- Section: Traefik ---

function renderTraefik() {
    const frag = document.createDocumentFragment();
    const fields = document.createElement('div');
    const t = currentConfig.environment.traefik;

    fields.appendChild(fieldRow('API Host', textInput(
        t.apiHost, v => { currentConfig.environment.traefik.apiHost = v; }, 'http://traefik:8080'
    ), 'TRAEFIK_API_HOST'));

    fields.appendChild(fieldRow('Insecure Skip Verify', toggleInput(
        t.insecureSkipVerify, v => { currentConfig.environment.traefik.insecureSkipVerify = v; }
    ), 'TRAEFIK_INSECURE_SKIP_VERIFY'));

    fields.appendChild(fieldRow('Enable Basic Auth', toggleInput(
        t.enableBasicAuth, v => {
            currentConfig.environment.traefik.enableBasicAuth = v;
            renderSection('traefik');
        }
    ), 'TRAEFIK_ENABLE_BASIC_AUTH'));

    if (t.enableBasicAuth) {
        fields.appendChild(fieldRow('Username', textInput(
            t.basicAuth.username, v => { currentConfig.environment.traefik.basicAuth.username = v; }
        ), 'TRAEFIK_BASIC_AUTH_USERNAME'));

        const pwNote = document.createElement('p');
        pwNote.className = 'pw-note';
        pwNote.textContent = 'Password is managed via config file or TRAEFIK_BASIC_AUTH_PASSWORD env var.';
        fields.appendChild(fieldRow('Password', pwNote, 'TRAEFIK_BASIC_AUTH_PASSWORD'));
    }

    frag.appendChild(card(null, fields));
    return frag;
}

// --- Section: Grouping ---

function renderGrouping() {
    const frag = document.createDocumentFragment();
    const fields = document.createElement('div');
    const g = currentConfig.environment.grouping;

    fields.appendChild(fieldRow('Grouping Enabled', toggleInput(
        g.enabled, v => { currentConfig.environment.grouping.enabled = v; }
    ), 'GROUPING_ENABLED'));

    fields.appendChild(fieldRow('Columns', numberInput(
        g.columns, v => { currentConfig.environment.grouping.columns = v; }, 1, 6
    ), 'GROUPED_COLUMNS'));

    fields.appendChild(fieldRow('Tag Frequency Threshold', numberInput(
        g.tagFrequencyThreshold, v => { currentConfig.environment.grouping.tagFrequencyThreshold = v; }, 0, 1, 0.1
    ), 'GROUPING_TAG_FREQUENCY_THRESHOLD'));

    fields.appendChild(fieldRow('Min Services Per Group', numberInput(
        g.minServicesPerGroup, v => { currentConfig.environment.grouping.minServicesPerGroup = v; }, 1
    ), 'GROUPING_MIN_SERVICES_PER_GROUP'));

    frag.appendChild(card(null, fields));
    return frag;
}

// --- Section: Auth ---

function renderAuth() {
    const frag = document.createDocumentFragment();
    const fields = document.createElement('div');
    const a = currentConfig.environment.auth;

    if (!a.enabled) {
        const warn = document.createElement('div');
        warn.className = 'admin-alert';
        warn.textContent = 'Enabling auth requires a correctly configured reverse proxy (e.g., Authentik) that sets the user/group headers. Ensure your admin group is correct before enabling, or you may lose access to this settings page.';
        fields.appendChild(warn);
    }

    fields.appendChild(fieldRow('Auth Enabled', toggleInput(
        a.enabled, v => {
            currentConfig.environment.auth.enabled = v;
            renderSection('auth');
        }
    ), 'AUTH_ENABLED'));

    fields.appendChild(fieldRow('Admin Group', textInput(
        a.adminGroup, v => { currentConfig.environment.auth.adminGroup = v; }, 'admins'
    ), 'AUTH_ADMIN_GROUP'));

    fields.appendChild(fieldRow('Groups Header', textInput(
        a.groupsHeader, v => { currentConfig.environment.auth.groupsHeader = v; }, 'X-Authentik-Groups'
    ), 'AUTH_GROUPS_HEADER'));

    fields.appendChild(fieldRow('User Header', textInput(
        a.userHeader, v => { currentConfig.environment.auth.userHeader = v; }, 'X-Authentik-Username'
    ), 'AUTH_USER_HEADER'));

    fields.appendChild(fieldRow('Group Separator', textInput(
        a.groupSeparator, v => { currentConfig.environment.auth.groupSeparator = v; }, '|'
    ), 'AUTH_GROUP_SEPARATOR'));

    frag.appendChild(card(null, fields));
    return frag;
}

// --- Section: Permissions (per-group cards) ---

function renderPermissions() {
    const frag = document.createDocumentFragment();
    const perms = currentConfig.environment.auth.groupPermissions || {};
    const groups = Object.keys(perms);
    const services = discoveredServices || [];

    if (services.length === 0) {
        const note = document.createElement('p');
        note.style.color = '#9ca3af';
        note.style.fontSize = '0.875rem';
        note.textContent = 'No services discovered yet. Start the dashboard with a valid Traefik connection to see services here.';
        frag.appendChild(card(null, note));
        return frag;
    }

    groups.forEach(group => {
        const patterns = perms[group] || [];

        const groupCard = document.createElement('div');
        groupCard.className = 'admin-card';

        // Group header: editable name + delete
        const header = document.createElement('div');
        header.className = 'group-header';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = group;
        nameInput.addEventListener('change', () => {
            const newName = nameInput.value.trim();
            if (newName && newName !== group) {
                perms[newName] = perms[group];
                delete perms[group];
                currentConfig.environment.auth.groupPermissions = perms;
                hasUnsavedChanges = true;
                renderSection('permissions');
            }
        });
        header.appendChild(nameInput);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-danger';
        delBtn.title = 'Remove group';
        delBtn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
        delBtn.addEventListener('click', () => {
            if (confirm('Remove group "' + group + '"?')) {
                delete perms[group];
                currentConfig.environment.auth.groupPermissions = perms;
                hasUnsavedChanges = true;
                renderSection('permissions');
            }
        });
        header.appendChild(delBtn);
        groupCard.appendChild(header);

        // Glob patterns
        const patRow = document.createElement('div');
        patRow.className = 'pattern-row';
        const patLabel = document.createElement('label');
        patLabel.textContent = 'Glob patterns (comma-separated)';
        const patInput = document.createElement('input');
        patInput.type = 'text';
        patInput.value = patterns.filter(p => p.includes('*') || p.includes('?')).join(', ');
        patInput.placeholder = 'e.g., *arr, media-*';
        patInput.addEventListener('change', () => {
            const explicitIds = patterns.filter(p => !p.includes('*') && !p.includes('?'));
            const newGlobs = patInput.value.split(',').map(p => p.trim()).filter(p => p);
            perms[group] = [...explicitIds, ...newGlobs];
            currentConfig.environment.auth.groupPermissions = perms;
            hasUnsavedChanges = true;
            renderSection('permissions');
        });
        patRow.appendChild(patLabel);
        patRow.appendChild(patInput);
        groupCard.appendChild(patRow);

        // Service checkboxes
        const gridLabel = document.createElement('label');
        gridLabel.textContent = 'Services';
        gridLabel.style.marginBottom = '0.5rem';
        groupCard.appendChild(gridLabel);

        const grid = document.createElement('div');
        grid.className = 'perm-grid';

        services.forEach(svc => {
            const item = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = matchesPatterns(svc.id, patterns);
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    if (!patterns.includes(svc.id)) patterns.push(svc.id);
                } else {
                    const idx = patterns.indexOf(svc.id);
                    if (idx !== -1) patterns.splice(idx, 1);
                }
                perms[group] = patterns;
                currentConfig.environment.auth.groupPermissions = perms;
                hasUnsavedChanges = true;
            });
            const span = document.createElement('span');
            span.textContent = svc.name;
            span.title = svc.name;
            item.appendChild(cb);
            item.appendChild(span);
            grid.appendChild(item);
        });

        groupCard.appendChild(grid);
        frag.appendChild(groupCard);
    });

    // Add group button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add';
    addBtn.textContent = '+ Add Group';
    addBtn.addEventListener('click', () => {
        const name = prompt('Enter group name:');
        if (name && name.trim()) {
            if (!currentConfig.environment.auth.groupPermissions) {
                currentConfig.environment.auth.groupPermissions = {};
            }
            currentConfig.environment.auth.groupPermissions[name.trim()] = [];
            hasUnsavedChanges = true;
            renderSection('permissions');
        }
    });
    frag.appendChild(addBtn);

    return frag;
}

function matchesPatterns(serviceId, patterns) {
    return patterns.some(pattern => globMatch(pattern.toLowerCase(), serviceId.toLowerCase()));
}

function globMatch(pattern, str) {
    let pi = 0, si = 0, starP = -1, starS = -1;
    while (si < str.length) {
        if (pi < pattern.length && (pattern[pi] === str[si] || pattern[pi] === '?')) {
            pi++; si++;
        } else if (pi < pattern.length && pattern[pi] === '*') {
            starP = pi++; starS = si;
        } else if (starP !== -1) {
            pi = starP + 1; si = ++starS;
        } else {
            return false;
        }
    }
    while (pi < pattern.length && pattern[pi] === '*') pi++;
    return pi === pattern.length;
}

// --- Section: Manual Services ---

function renderManualServices() {
    const frag = document.createDocumentFragment();
    const manual = currentConfig.services.manual || [];

    manual.forEach((svc, idx) => {
        const row = document.createElement('div');
        row.className = 'admin-card';

        const grid = document.createElement('div');
        grid.className = 'form-grid';

        grid.appendChild(fieldRow('Name', textInput(svc.name, v => { manual[idx].name = v; })));
        grid.appendChild(fieldRow('URL', textInput(svc.url, v => { manual[idx].url = v; }, 'https://...')));
        grid.appendChild(fieldRow('Icon', textInput(svc.icon || '', v => { manual[idx].icon = v; }, 'icon.png or full URL')));
        grid.appendChild(fieldRow('Priority', numberInput(svc.priority || 50, v => { manual[idx].priority = v; }, 0)));
        grid.appendChild(fieldRow('Group', textInput(svc.group || '', v => { manual[idx].group = v; })));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-danger';
        delBtn.textContent = 'Remove Service';
        delBtn.style.marginTop = '0.5rem';
        delBtn.style.fontSize = '0.875rem';
        delBtn.addEventListener('click', () => {
            if (confirm('Remove "' + svc.name + '"?')) {
                manual.splice(idx, 1);
                currentConfig.services.manual = manual;
                hasUnsavedChanges = true;
                renderSection('manual');
            }
        });

        row.appendChild(grid);
        row.appendChild(delBtn);
        frag.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add';
    addBtn.textContent = '+ Add Service';
    addBtn.addEventListener('click', () => {
        if (!currentConfig.services.manual) currentConfig.services.manual = [];
        currentConfig.services.manual.push({ name: '', url: '', icon: '', priority: 50, group: '' });
        hasUnsavedChanges = true;
        renderSection('manual');
    });
    frag.appendChild(addBtn);
    return frag;
}

// --- Section: Overrides ---

function renderOverrides() {
    const frag = document.createDocumentFragment();
    const overrides = currentConfig.services.overrides || [];

    overrides.forEach((ov, idx) => {
        const row = document.createElement('div');
        row.className = 'admin-card';

        const grid = document.createElement('div');
        grid.className = 'form-grid';

        grid.appendChild(fieldRow('Service (router name)', textInput(ov.service, v => { overrides[idx].service = v; })));
        grid.appendChild(fieldRow('Display Name', textInput(ov.displayName || '', v => { overrides[idx].displayName = v; })));
        grid.appendChild(fieldRow('Icon', textInput(ov.icon || '', v => { overrides[idx].icon = v; }, 'icon.png or full URL')));
        grid.appendChild(fieldRow('Group', textInput(ov.group || '', v => { overrides[idx].group = v; })));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-danger';
        delBtn.textContent = 'Remove Override';
        delBtn.style.marginTop = '0.5rem';
        delBtn.style.fontSize = '0.875rem';
        delBtn.addEventListener('click', () => {
            if (confirm('Remove override for "' + ov.service + '"?')) {
                overrides.splice(idx, 1);
                currentConfig.services.overrides = overrides;
                hasUnsavedChanges = true;
                renderSection('overrides');
            }
        });

        row.appendChild(grid);
        row.appendChild(delBtn);
        frag.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add';
    addBtn.textContent = '+ Add Override';
    addBtn.addEventListener('click', () => {
        if (!currentConfig.services.overrides) currentConfig.services.overrides = [];
        currentConfig.services.overrides.push({ service: '', displayName: '', icon: '', group: '' });
        hasUnsavedChanges = true;
        renderSection('overrides');
    });
    frag.appendChild(addBtn);
    return frag;
}

// --- Section: Exclusions ---

function renderExclusions() {
    const frag = document.createDocumentFragment();
    const exclude = currentConfig.services.exclude || { routers: [], entrypoints: [] };

    // Routers
    const routerFields = document.createElement('div');
    (exclude.routers || []).forEach((pattern, idx) => {
        const row = document.createElement('div');
        row.className = 'inline-row';
        const input = textInput(pattern, v => { exclude.routers[idx] = v; }, 'e.g., traefik-api or internal-*');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-danger';
        delBtn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        delBtn.addEventListener('click', () => {
            exclude.routers.splice(idx, 1);
            currentConfig.services.exclude = exclude;
            hasUnsavedChanges = true;
            renderSection('exclusions');
        });
        row.appendChild(input);
        row.appendChild(delBtn);
        routerFields.appendChild(row);
    });
    const addRouterBtn = document.createElement('button');
    addRouterBtn.className = 'btn-link';
    addRouterBtn.textContent = '+ Add pattern';
    addRouterBtn.addEventListener('click', () => {
        if (!exclude.routers) exclude.routers = [];
        exclude.routers.push('');
        currentConfig.services.exclude = exclude;
        hasUnsavedChanges = true;
        renderSection('exclusions');
    });
    routerFields.appendChild(addRouterBtn);
    frag.appendChild(card('Router Exclusions', routerFields));

    // Entrypoints
    const epFields = document.createElement('div');
    (exclude.entrypoints || []).forEach((pattern, idx) => {
        const row = document.createElement('div');
        row.className = 'inline-row';
        const input = textInput(pattern, v => { exclude.entrypoints[idx] = v; }, 'e.g., metrics');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-danger';
        delBtn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        delBtn.addEventListener('click', () => {
            exclude.entrypoints.splice(idx, 1);
            currentConfig.services.exclude = exclude;
            hasUnsavedChanges = true;
            renderSection('exclusions');
        });
        row.appendChild(input);
        row.appendChild(delBtn);
        epFields.appendChild(row);
    });
    const addEpBtn = document.createElement('button');
    addEpBtn.className = 'btn-link';
    addEpBtn.textContent = '+ Add pattern';
    addEpBtn.addEventListener('click', () => {
        if (!exclude.entrypoints) exclude.entrypoints = [];
        exclude.entrypoints.push('');
        currentConfig.services.exclude = exclude;
        hasUnsavedChanges = true;
        renderSection('exclusions');
    });
    epFields.appendChild(addEpBtn);
    frag.appendChild(card('Entrypoint Exclusions', epFields));

    return frag;
}

// --- Unsaved changes guard ---

window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
    }
});

// --- Start ---

init();
