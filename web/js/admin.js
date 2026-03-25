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
            document.getElementById('content-area').innerHTML = '<p class="text-red-500">Access denied. Admin privileges required.</p>';
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
        // Reload config to get effective values
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
                // Update active state
                document.querySelectorAll('.nav-btn').forEach(b => {
                    b.className = 'nav-btn w-full text-left px-3 py-2 rounded-md text-sm font-medium mb-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700';
                });
                btn.className = 'nav-btn w-full text-left px-3 py-2 rounded-md text-sm font-medium mb-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
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
        area.innerHTML = '<p class="text-gray-500">Loading...</p>';
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

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function isEnvOverridden(envVar) {
    return envOverrides[envVar] === true;
}

function card(title, content) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4';
    if (title) {
        const h = document.createElement('h3');
        h.className = 'text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4';
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
    row.className = 'mb-4';
    const lbl = document.createElement('label');
    lbl.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
    lbl.textContent = label;
    if (envVar && isEnvOverridden(envVar)) {
        const badge = document.createElement('span');
        badge.className = 'ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
        badge.textContent = 'ENV: ' + envVar;
        lbl.appendChild(badge);
        if (input.tagName === 'INPUT' || input.tagName === 'SELECT') {
            input.disabled = true;
            input.classList.add('opacity-50', 'cursor-not-allowed');
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
    input.className = 'w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
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
    input.className = 'w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
    input.addEventListener('input', () => { onChange(Number(input.value)); hasUnsavedChanges = true; });
    return input;
}

function selectInput(value, options, onChange) {
    const select = document.createElement('select');
    select.className = 'w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
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
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = value
        ? 'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-blue-600 transition-colors'
        : 'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-300 dark:bg-gray-600 transition-colors';
    const dot = document.createElement('span');
    dot.className = value
        ? 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform translate-x-5 transition-transform'
        : 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform translate-x-0 transition-transform';
    btn.appendChild(dot);
    btn.addEventListener('click', () => {
        const newVal = !btn.dataset.on;
        btn.dataset.on = newVal ? '1' : '';
        btn.className = newVal
            ? 'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-blue-600 transition-colors'
            : 'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-300 dark:bg-gray-600 transition-colors';
        dot.className = newVal
            ? 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform translate-x-5 transition-transform'
            : 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform translate-x-0 transition-transform';
        onChange(newVal);
        hasUnsavedChanges = true;
    });
    btn.dataset.on = value ? '1' : '';
    wrapper.appendChild(btn);
    return wrapper;
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    const inner = toast.querySelector('div');
    inner.textContent = message;
    inner.className = type === 'error'
        ? 'rounded-lg px-4 py-3 shadow-lg text-sm font-medium bg-red-600 text-white'
        : 'rounded-lg px-4 py-3 shadow-lg text-sm font-medium bg-green-600 text-white';
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
        pwNote.className = 'text-sm text-gray-500 dark:text-gray-400 italic py-2';
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

    // Warning about lockout
    if (!a.enabled) {
        const warn = document.createElement('div');
        warn.className = 'mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300';
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

// --- Section: Permissions Matrix ---

function renderPermissions() {
    const frag = document.createDocumentFragment();
    const perms = currentConfig.environment.auth.groupPermissions || {};
    const groups = Object.keys(perms);
    const services = discoveredServices || [];

    if (services.length === 0) {
        const note = document.createElement('p');
        note.className = 'text-gray-500 dark:text-gray-400 text-sm';
        note.textContent = 'No services discovered yet. Start the dashboard with a valid Traefik connection to see services here.';
        frag.appendChild(card(null, note));
        return frag;
    }

    // Matrix container
    const container = document.createElement('div');
    container.className = 'overflow-x-auto';

    const table = document.createElement('table');
    table.className = 'min-w-full text-sm';

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const th0 = document.createElement('th');
    th0.className = 'text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800 z-10';
    th0.textContent = 'Group';
    headerRow.appendChild(th0);

    services.forEach(svc => {
        const th = document.createElement('th');
        th.className = 'py-2 px-2 font-medium text-gray-500 dark:text-gray-400 text-center whitespace-nowrap';
        th.textContent = svc.name;
        headerRow.appendChild(th);
    });

    // Patterns column
    const thP = document.createElement('th');
    thP.className = 'py-2 px-3 font-medium text-gray-500 dark:text-gray-400 text-left';
    thP.textContent = 'Patterns';
    headerRow.appendChild(thP);

    // Delete column
    const thD = document.createElement('th');
    thD.className = 'py-2 px-2';
    headerRow.appendChild(thD);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    groups.forEach(group => {
        const patterns = perms[group] || [];
        const row = document.createElement('tr');
        row.className = 'border-t border-gray-200 dark:border-gray-700';

        // Group name
        const tdName = document.createElement('td');
        tdName.className = 'py-2 px-3 font-medium sticky left-0 bg-white dark:bg-gray-800 z-10';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = group;
        nameInput.className = 'px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-transparent text-sm w-32';
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
        tdName.appendChild(nameInput);
        row.appendChild(tdName);

        // Service checkboxes
        services.forEach(svc => {
            const td = document.createElement('td');
            td.className = 'py-2 px-2 text-center';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 h-4 w-4';
            cb.checked = matchesPatterns(svc.id, patterns);
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    if (!patterns.includes(svc.id)) {
                        patterns.push(svc.id);
                    }
                } else {
                    // Remove the specific ID and any pattern that only matches this service
                    const idx = patterns.indexOf(svc.id);
                    if (idx !== -1) patterns.splice(idx, 1);
                }
                perms[group] = patterns;
                currentConfig.environment.auth.groupPermissions = perms;
                hasUnsavedChanges = true;
            });
            td.appendChild(cb);
            row.appendChild(td);
        });

        // Patterns text
        const tdPat = document.createElement('td');
        tdPat.className = 'py-2 px-3';
        const patInput = document.createElement('input');
        patInput.type = 'text';
        patInput.value = patterns.join(', ');
        patInput.className = 'px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-transparent text-sm w-48';
        patInput.placeholder = 'e.g., *arr, plex';
        patInput.addEventListener('change', () => {
            const newPatterns = patInput.value.split(',').map(p => p.trim()).filter(p => p);
            perms[group] = newPatterns;
            currentConfig.environment.auth.groupPermissions = perms;
            hasUnsavedChanges = true;
            renderSection('permissions');
        });
        tdPat.appendChild(patInput);
        row.appendChild(tdPat);

        // Delete button
        const tdDel = document.createElement('td');
        tdDel.className = 'py-2 px-2';
        const delBtn = document.createElement('button');
        delBtn.className = 'text-red-500 hover:text-red-700 p-1';
        delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
        delBtn.addEventListener('click', () => {
            if (confirm('Remove group "' + group + '"?')) {
                delete perms[group];
                currentConfig.environment.auth.groupPermissions = perms;
                hasUnsavedChanges = true;
                renderSection('permissions');
            }
        });
        tdDel.appendChild(delBtn);
        row.appendChild(tdDel);

        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    // Add group button
    const addBtn = document.createElement('button');
    addBtn.className = 'mt-3 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors';
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

    const wrapper = document.createElement('div');
    wrapper.appendChild(container);
    wrapper.appendChild(addBtn);
    frag.appendChild(card(null, wrapper));
    return frag;
}

function matchesPatterns(serviceId, patterns) {
    return patterns.some(pattern => globMatch(pattern.toLowerCase(), serviceId.toLowerCase()));
}

function globMatch(pattern, str) {
    // Simple glob matching supporting * and ?
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

    const container = document.createElement('div');

    manual.forEach((svc, idx) => {
        const row = document.createElement('div');
        row.className = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-3';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';

        grid.appendChild(fieldRow('Name', textInput(svc.name, v => { manual[idx].name = v; })));
        grid.appendChild(fieldRow('URL', textInput(svc.url, v => { manual[idx].url = v; }, 'https://...')));
        grid.appendChild(fieldRow('Icon', textInput(svc.icon || '', v => { manual[idx].icon = v; }, 'icon.png or full URL')));
        grid.appendChild(fieldRow('Priority', numberInput(svc.priority || 50, v => { manual[idx].priority = v; }, 0)));
        grid.appendChild(fieldRow('Group', textInput(svc.group || '', v => { manual[idx].group = v; })));

        const delBtn = document.createElement('button');
        delBtn.className = 'text-red-500 hover:text-red-700 text-sm mt-2';
        delBtn.textContent = 'Remove Service';
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
        container.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors';
    addBtn.textContent = '+ Add Service';
    addBtn.addEventListener('click', () => {
        if (!currentConfig.services.manual) currentConfig.services.manual = [];
        currentConfig.services.manual.push({ name: '', url: '', icon: '', priority: 50, group: '' });
        hasUnsavedChanges = true;
        renderSection('manual');
    });

    container.appendChild(addBtn);
    frag.appendChild(container);
    return frag;
}

// --- Section: Overrides ---

function renderOverrides() {
    const frag = document.createDocumentFragment();
    const overrides = currentConfig.services.overrides || [];

    const container = document.createElement('div');

    overrides.forEach((ov, idx) => {
        const row = document.createElement('div');
        row.className = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-3';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';

        grid.appendChild(fieldRow('Service (router name)', textInput(ov.service, v => { overrides[idx].service = v; })));
        grid.appendChild(fieldRow('Display Name', textInput(ov.displayName || '', v => { overrides[idx].displayName = v; })));
        grid.appendChild(fieldRow('Icon', textInput(ov.icon || '', v => { overrides[idx].icon = v; }, 'icon.png or full URL')));
        grid.appendChild(fieldRow('Group', textInput(ov.group || '', v => { overrides[idx].group = v; })));

        const delBtn = document.createElement('button');
        delBtn.className = 'text-red-500 hover:text-red-700 text-sm mt-2';
        delBtn.textContent = 'Remove Override';
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
        container.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors';
    addBtn.textContent = '+ Add Override';
    addBtn.addEventListener('click', () => {
        if (!currentConfig.services.overrides) currentConfig.services.overrides = [];
        currentConfig.services.overrides.push({ service: '', displayName: '', icon: '', group: '' });
        hasUnsavedChanges = true;
        renderSection('overrides');
    });

    container.appendChild(addBtn);
    frag.appendChild(container);
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
        row.className = 'flex items-center gap-2 mb-2';
        const input = textInput(pattern, v => { exclude.routers[idx] = v; }, 'e.g., traefik-api or internal-*');
        input.className += ' flex-1';
        const delBtn = document.createElement('button');
        delBtn.className = 'text-red-500 hover:text-red-700 p-1 shrink-0';
        delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
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
    addRouterBtn.className = 'text-sm text-blue-600 dark:text-blue-400 hover:underline';
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
        row.className = 'flex items-center gap-2 mb-2';
        const input = textInput(pattern, v => { exclude.entrypoints[idx] = v; }, 'e.g., metrics');
        input.className += ' flex-1';
        const delBtn = document.createElement('button');
        delBtn.className = 'text-red-500 hover:text-red-700 p-1 shrink-0';
        delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
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
    addEpBtn.className = 'text-sm text-blue-600 dark:text-blue-400 hover:underline';
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
