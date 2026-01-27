/**
 * Static Files
 * Embedded HTML, JS, and CSS for the WebUI
 */

export const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>oh-my-opencode Settings</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app">
    <header>
      <div class="header-top">
        <h1>oh-my-opencode</h1>
        <div class="quick-status" id="quick-status">
          <span class="status-item" id="qs-tier" title="Current tier">--</span>
          <span class="status-item" id="qs-claude" title="Claude Max usage">Claude: --%</span>
          <span class="status-item" id="qs-copilot" title="Copilot usage">Copilot: --%</span>
        </div>
      </div>
      <nav>
        <button class="tab-btn active" data-tab="dashboard">Overview</button>
        <a href="/budget-dashboard" class="tab-btn">Usage & Budget</a>
        <button class="tab-btn" data-tab="presets">Presets</button>
        <button class="tab-btn" data-tab="features">Features</button>
        <button class="tab-btn" data-tab="advanced">Config</button>
        <button class="tab-btn" data-tab="docs">Docs</button>
      </nav>
    </header>

    <main>
      <section id="dashboard" class="tab-content active">
        <h2>Overview</h2>
        <div class="grid">
          <div class="card">
            <h3>Current Preset</h3>
            <div id="current-preset">Loading...</div>
          </div>
          <div class="card">
            <h3>Recommended Tier</h3>
            <div id="recommended-tier">Loading...</div>
          </div>
          <div class="card">
            <h3>Active Providers</h3>
            <div id="active-providers">Loading...</div>
          </div>
          <div class="card">
            <h3>Quick Actions</h3>
            <div class="quick-actions">
              <button onclick="window.location.href='/budget-dashboard'">View Usage Details</button>
              <button onclick="switchTab('presets')">Switch Preset</button>
            </div>
          </div>
        </div>
        <div class="section-divider"></div>
        <h3>Setup Wizard</h3>
        <div class="wizard-container">
          <div class="wizard-step" id="step-subscriptions">
            <h4>Configure Subscriptions</h4>
            <p class="wizard-help">Select which AI services you have access to:</p>
            <form id="subscriptions-form">
              <label>
                <input type="checkbox" name="hasAnthropicOAuth" checked>
                Anthropic (Claude Pro/Max)
              </label>
              <label>
                <input type="checkbox" name="hasChatGPT">
                OpenAI (ChatGPT Plus/Pro)
              </label>
              <label>
                <input type="checkbox" name="hasGemini">
                Google (Gemini)
              </label>
              <label>
                <input type="checkbox" name="hasCopilot">
                GitHub Copilot
              </label>
              <button type="button" onclick="nextWizardStep()">Next: Choose Preset</button>
            </form>
          </div>
          <div class="wizard-step hidden" id="step-preset">
            <h4>Choose Preset</h4>
            <p class="wizard-help">Select a configuration preset based on your usage pattern:</p>
            <div id="preset-options"></div>
            <div class="wizard-buttons">
              <button type="button" onclick="prevWizardStep()">Back</button>
              <button type="button" class="primary" onclick="applyWizard()">Apply Configuration</button>
            </div>
          </div>
        </div>
      </section>

      <section id="presets" class="tab-content">
        <h2>Orchestration Presets</h2>
        <p class="section-help">Presets configure model routing for different task types. Choose based on your budget and quality needs.</p>
        <div id="presets-list" class="presets-grid">Loading...</div>
      </section>

      <section id="features" class="tab-content">
        <h2>Features</h2>
        <p class="section-help">Toggle individual features. Changes take effect immediately.</p>
        <div id="features-list">Loading...</div>
      </section>

      <section id="advanced" class="tab-content">
        <h2>Configuration Editor</h2>
        <p class="section-help">Edit the raw JSON configuration. Use with caution.</p>
        <div class="advanced-editor">
          <textarea id="config-editor" rows="25"></textarea>
          <div class="button-group">
            <button onclick="loadConfig()">Reload</button>
            <button onclick="saveConfig()" class="primary">Save Changes</button>
          </div>
        </div>
      </section>

      <section id="docs" class="tab-content">
        <h2>Documentation</h2>
        <div class="docs-container">
          <div class="docs-nav">
            <button class="docs-nav-btn active" data-doc="quickstart">Quick Start</button>
            <button class="docs-nav-btn" data-doc="shortcuts">Keyboard Shortcuts</button>
            <button class="docs-nav-btn" data-doc="api">API Reference</button>
            <button class="docs-nav-btn" data-doc="config">Configuration</button>
          </div>
          <div class="docs-content">
            <div id="doc-quickstart" class="doc-section active">
              <h3>Quick Start Guide</h3>
              <div class="doc-block">
                <h4>1. Configure Subscriptions</h4>
                <p>Use the Setup Wizard on the Overview tab to select which AI services you have access to.</p>
              </div>
              <div class="doc-block">
                <h4>2. Choose a Preset</h4>
                <ul>
                  <li><strong>balanced</strong> - Best for daily development. Uses Claude for complex tasks, cheaper models for routine work.</li>
                  <li><strong>best</strong> - Maximum quality. Uses premium models (Opus, GPT-4.5) for everything.</li>
                  <li><strong>free</strong> - Zero cost. Uses only free tiers (Copilot, Gemini Flash).</li>
                </ul>
              </div>
              <div class="doc-block">
                <h4>3. Monitor Usage</h4>
                <p>The <strong>Usage & Budget</strong> tab shows real-time usage from Claude Max and Copilot APIs.</p>
              </div>
            </div>
            <div id="doc-shortcuts" class="doc-section">
              <h3>Keyboard Shortcuts</h3>
              <div class="shortcuts-grid">
                <div class="shortcut"><kbd>1</kbd> Overview tab</div>
                <div class="shortcut"><kbd>2</kbd> Usage & Budget</div>
                <div class="shortcut"><kbd>3</kbd> Presets tab</div>
                <div class="shortcut"><kbd>4</kbd> Features tab</div>
                <div class="shortcut"><kbd>5</kbd> Config tab</div>
                <div class="shortcut"><kbd>6</kbd> Docs tab</div>
                <div class="shortcut"><kbd>r</kbd> Refresh data</div>
                <div class="shortcut"><kbd>?</kbd> Show shortcuts</div>
              </div>
            </div>
            <div id="doc-api" class="doc-section">
              <h3>API Reference</h3>
              <div class="doc-block">
                <h4>Endpoints</h4>
                <pre class="code-block">GET  /api/budget/dashboard    - Budget overview
GET  /api/claude-max/usage    - Claude Max real-time usage
GET  /api/claude-max/history  - 24h usage history
POST /api/claude-max/refresh  - Force refresh from API
GET  /api/copilot/usage       - Copilot premium requests
GET  /api/copilot/history     - 24h usage history
POST /api/copilot/refresh     - Force refresh from API
GET  /api/config              - Current configuration
POST /api/config              - Update configuration
GET  /api/presets             - Available presets
POST /api/preset/:name        - Apply preset</pre>
              </div>
              <div class="doc-block">
                <h4>Example: Get Claude Max Usage</h4>
                <pre class="code-block">curl http://localhost:3847/api/claude-max/usage
# Response:
{
  "success": true,
  "data": {
    "currentSession": { "percentUsed": 30 },
    "allModels": { "percentUsed": 77 },
    "sonnetOnly": { "percentUsed": 0 }
  }
}</pre>
              </div>
            </div>
            <div id="doc-config" class="doc-section">
              <h3>Configuration Reference</h3>
              <div class="doc-block">
                <h4>Budget Settings</h4>
                <pre class="code-block">{
  "budget": {
    "enabled": true,
    "anthropic": {
      "period": "weekly",
      "limit": 20.0,
      "reset_day": "sunday"
    }
  }
}</pre>
              </div>
              <div class="doc-block">
                <h4>Background Task Settings</h4>
                <pre class="code-block">{
  "background_task": {
    "staleTimeoutMs": 600000,
    "maxStabilityResets": 25
  }
}</pre>
              </div>
              <div class="doc-block">
                <h4>Ralph Loop Settings</h4>
                <pre class="code-block">{
  "ralph_loop": {
    "enabled": true,
    "verbose_continuations": false
  }
}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <p>oh-my-opencode WebUI &bull; <a href="https://github.com/sadnow/oh-my-opencode" target="_blank">GitHub</a> &bull; Press <kbd>?</kbd> for shortcuts</p>
    </footer>
  </div>

  <div id="toast" class="toast hidden"></div>
  <div id="shortcuts-modal" class="modal hidden">
    <div class="modal-content">
      <h3>Keyboard Shortcuts</h3>
      <div class="shortcuts-grid">
        <div class="shortcut"><kbd>1</kbd> Overview</div>
        <div class="shortcut"><kbd>2</kbd> Usage & Budget</div>
        <div class="shortcut"><kbd>3</kbd> Presets</div>
        <div class="shortcut"><kbd>4</kbd> Features</div>
        <div class="shortcut"><kbd>5</kbd> Config</div>
        <div class="shortcut"><kbd>6</kbd> Docs</div>
        <div class="shortcut"><kbd>r</kbd> Refresh</div>
        <div class="shortcut"><kbd>Esc</kbd> Close</div>
      </div>
      <button onclick="closeShortcutsModal()">Close</button>
    </div>
  </div>

  <script src="/app.js"></script>
</body>
</html>`

export const APP_JS = `// oh-my-opencode WebUI
const API_BASE = window.location.origin + '/api';

// State
let currentTab = 'dashboard';
let wizardStep = 0;
let wizardData = {};

// Tab mapping for keyboard shortcuts
const TAB_MAP = {
  '1': 'dashboard',
  '2': null, // Budget page (separate URL)
  '3': 'presets',
  '4': 'features',
  '5': 'advanced',
  '6': 'docs'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initKeyboardShortcuts();
  initDocsNav();
  loadDashboard();
  loadPresets();
  loadFeatures();
  loadConfig();
  loadQuickStatus();
  // Refresh quick status every 60 seconds
  setInterval(loadQuickStatus, 60000);
});

// Keyboard shortcuts
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();

    if (key === '?') {
      e.preventDefault();
      showShortcutsModal();
    } else if (key === 'escape') {
      closeShortcutsModal();
    } else if (key === 'r') {
      e.preventDefault();
      refreshAll();
    } else if (key === '2') {
      window.location.href = '/budget-dashboard';
    } else if (TAB_MAP[key]) {
      e.preventDefault();
      switchTab(TAB_MAP[key]);
    }
  });
}

function showShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.remove('hidden');
}

function closeShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.add('hidden');
}

function refreshAll() {
  loadDashboard();
  loadQuickStatus();
  showToast('Refreshed');
}

// Tab navigation
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
  });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.toggle('active', section.id === tab);
  });

  if (tab === 'dashboard') loadDashboard();
}

// Docs navigation
function initDocsNav() {
  document.querySelectorAll('.docs-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const doc = btn.dataset.doc;
      document.querySelectorAll('.docs-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.doc-section').forEach(s => s.classList.remove('active'));
      document.getElementById('doc-' + doc).classList.add('active');
    });
  });
}

// Quick status bar
async function loadQuickStatus() {
  try {
    const [claudeRes, copilotRes, orchRes] = await Promise.all([
      fetch(API_BASE + '/claude-max/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/copilot/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/orchestration/status').then(r => r.json()).catch(() => null),
    ]);

    // Tier
    const tierEl = document.getElementById('qs-tier');
    if (orchRes?.success && orchRes.data?.currentTier) {
      tierEl.textContent = orchRes.data.currentTier.toUpperCase();
      tierEl.className = 'status-item tier-' + orchRes.data.currentTier;
    }

    // Claude Max
    const claudeEl = document.getElementById('qs-claude');
    if (claudeRes?.success && claudeRes.data?.allModels) {
      const pct = claudeRes.data.allModels.percentUsed || 0;
      claudeEl.textContent = 'Claude: ' + pct.toFixed(0) + '%';
      claudeEl.className = 'status-item ' + (pct >= 90 ? 'status-critical' : pct >= 70 ? 'status-warning' : 'status-ok');
    }

    // Copilot
    const copilotEl = document.getElementById('qs-copilot');
    if (copilotRes?.success && copilotRes.data) {
      const pct = copilotRes.data.percentUsed || 0;
      copilotEl.textContent = 'Copilot: ' + pct.toFixed(0) + '%';
      copilotEl.className = 'status-item ' + (pct >= 90 ? 'status-critical' : pct >= 70 ? 'status-warning' : 'status-ok');
    }
  } catch (err) {
    console.error('Quick status error:', err);
  }
}

// Dashboard
async function loadDashboard() {
  try {
    const [configRes, orchRes, budgetRes] = await Promise.all([
      fetch(API_BASE + '/config').then(r => r.json()),
      fetch(API_BASE + '/orchestration/status').then(r => r.json()).catch(() => ({ success: false })),
      fetch(API_BASE + '/budget/dashboard').then(r => r.json()).catch(() => ({ success: false })),
    ]);

    // Current preset
    const presetEl = document.getElementById('current-preset');
    const preset = configRes.data?.orchestration_preset || 'custom';
    presetEl.innerHTML = '<div class="big-value">' + preset + '</div><div class="sub-label">Active configuration</div>';

    // Recommended tier
    const tierEl = document.getElementById('recommended-tier');
    if (orchRes.success && orchRes.data.currentTier) {
      const tier = orchRes.data.currentTier;
      tierEl.innerHTML = '<div class="big-value tier-badge tier-' + tier + '">' + tier.toUpperCase() + '</div><div class="sub-label">Recommended by budget system</div>';
    } else {
      tierEl.innerHTML = '<div class="big-value">--</div><div class="sub-label">Budget system not active</div>';
    }

    // Active providers
    const providersEl = document.getElementById('active-providers');
    if (budgetRes.success && budgetRes.data?.providers?.length) {
      const providers = budgetRes.data.providers.map(p => p.provider).join(', ');
      providersEl.innerHTML = '<div class="big-value">' + budgetRes.data.providers.length + '</div><div class="sub-label">' + providers + '</div>';
    } else {
      providersEl.innerHTML = '<div class="big-value">0</div><div class="sub-label">Configure in Budget settings</div>';
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// Presets
async function loadPresets() {
  try {
    const res = await fetch(API_BASE + '/presets').then(r => r.json());
    const container = document.getElementById('presets-list');

    if (!res.success || !res.data.length) {
      container.innerHTML = '<em>No presets available</em>';
      return;
    }

    container.innerHTML = res.data.map(p =>
      '<div class="preset-card">' +
        '<h3>' + p.name + '</h3>' +
        '<p>' + p.description + '</p>' +
        '<button onclick="applyPreset(\\'' + p.name + '\\')">Apply</button>' +
      '</div>'
    ).join('');
  } catch (err) {
    console.error('Presets load error:', err);
  }
}

async function applyPreset(name) {
  try {
    const res = await fetch(API_BASE + '/preset/' + name, { method: 'POST' });
    const data = await res.json();
    showToast(data.success ? 'Preset applied!' : 'Error: ' + data.error);
    if (data.success) loadDashboard();
  } catch (err) {
    showToast('Error applying preset');
  }
}

// Features
async function loadFeatures() {
  try {
    const res = await fetch(API_BASE + '/features').then(r => r.json());
    const container = document.getElementById('features-list');

    if (!res.success || !res.data.length) {
      container.innerHTML = '<em>No features available</em>';
      return;
    }

    container.innerHTML = res.data.map(f =>
      '<div class="feature-item">' +
        '<label>' +
          '<input type="checkbox" ' + (f.enabled ? 'checked' : '') +
          ' onchange="toggleFeature(\\'' + f.name + '\\', this.checked)">' +
          '<strong>' + f.label + '</strong>' +
        '</label>' +
        '<p>' + f.description + '</p>' +
      '</div>'
    ).join('');
  } catch (err) {
    console.error('Features load error:', err);
  }
}

async function toggleFeature(name, enabled) {
  try {
    const res = await fetch(API_BASE + '/features/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    showToast(data.success ? 'Feature updated!' : 'Error: ' + data.error);
  } catch (err) {
    showToast('Error toggling feature');
  }
}

// Config editor
async function loadConfig() {
  try {
    const res = await fetch(API_BASE + '/config').then(r => r.json());
    const editor = document.getElementById('config-editor');
    editor.value = JSON.stringify(res.data, null, 2);
  } catch (err) {
    console.error('Config load error:', err);
  }
}

async function saveConfig() {
  try {
    const editor = document.getElementById('config-editor');
    const config = JSON.parse(editor.value);

    const res = await fetch(API_BASE + '/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: config, immediate: true, save: true }),
    });
    const data = await res.json();
    showToast(data.success ? 'Config saved!' : 'Error: ' + data.error);
  } catch (err) {
    showToast('Error: Invalid JSON');
  }
}

// Wizard
function nextWizardStep() {
  const form = document.getElementById('subscriptions-form');
  const formData = new FormData(form);

  wizardData = {
    hasAnthropicOAuth: formData.get('hasAnthropicOAuth') === 'on',
    hasChatGPT: formData.get('hasChatGPT') === 'on',
    hasGemini: formData.get('hasGemini') === 'on',
    hasCopilot: formData.get('hasCopilot') === 'on',
    hasOpencodeZen: formData.get('hasOpencodeZen') === 'on',
    preset: 'balanced',
    enableBudget: false,
  };

  document.getElementById('step-subscriptions').classList.add('hidden');
  document.getElementById('step-preset').classList.remove('hidden');
  loadPresetOptions();
}

function prevWizardStep() {
  document.getElementById('step-preset').classList.add('hidden');
  document.getElementById('step-subscriptions').classList.remove('hidden');
}

async function loadPresetOptions() {
  const res = await fetch(API_BASE + '/presets').then(r => r.json());
  const container = document.getElementById('preset-options');

  container.innerHTML = res.data.map(p =>
    '<label>' +
      '<input type="radio" name="preset" value="' + p.name + '"' +
      (p.name === 'balanced' ? ' checked' : '') + '>' +
      p.name + ' - ' + p.description +
    '</label>'
  ).join('<br>');
}

async function applyWizard() {
  const selectedPreset = document.querySelector('input[name="preset"]:checked')?.value || 'balanced';
  wizardData.preset = selectedPreset;

  try {
    const res = await fetch(API_BASE + '/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: wizardData, apply: true, save: true }),
    });
    const data = await res.json();
    showToast(data.success ? 'Wizard completed!' : 'Error: ' + data.error);
    if (data.success) {
      switchTab('dashboard');
      loadDashboard();
      loadConfig();
    }
  } catch (err) {
    showToast('Error running wizard');
  }
}

// Toast notifications
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
`

export const STYLES_CSS = `/* oh-my-opencode WebUI Styles */
:root {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-card: #242424;
  --text-primary: #e0e0e0;
  --text-secondary: #888;
  --accent: #9d4edd;
  --accent-hover: #b668e8;
  --success: #4caf50;
  --warning: #ff9800;
  --error: #f44336;
  --border: #333;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

#app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  margin-bottom: 30px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 10px;
}

header h1 {
  color: var(--accent);
  margin: 0;
}

.quick-status {
  display: flex;
  gap: 12px;
  font-size: 13px;
}

.status-item {
  padding: 4px 10px;
  background: var(--bg-card);
  border-radius: 4px;
  border: 1px solid var(--border);
}

.status-ok { border-color: var(--success); color: var(--success); }
.status-warning { border-color: var(--warning); color: var(--warning); }
.status-critical { border-color: var(--error); color: var(--error); }

nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 5px;
  transition: all 0.2s;
  text-decoration: none;
  font-size: 14px;
}

.tab-btn:hover {
  background: var(--bg-card);
  border-color: var(--accent);
}

.tab-btn.active {
  background: var(--accent);
  border-color: var(--accent);
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

h2 {
  margin-bottom: 10px;
  font-size: 1.5rem;
}

h3 {
  margin-top: 20px;
  margin-bottom: 15px;
}

.section-help {
  color: var(--text-secondary);
  margin-bottom: 20px;
  font-size: 14px;
}

.section-divider {
  margin: 30px 0;
  border-top: 1px solid var(--border);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.card h3 {
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.big-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sub-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-actions button {
  width: 100%;
  text-align: left;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
}

.quick-actions button:hover {
  background: var(--accent);
  border-color: var(--accent);
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.preset-card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
  transition: border-color 0.2s;
}

.preset-card:hover {
  border-color: var(--accent);
}

.preset-card h3 {
  color: var(--accent);
  margin: 0 0 8px 0;
  font-size: 1.1rem;
}

.preset-card p {
  color: var(--text-secondary);
  margin-bottom: 15px;
  font-size: 14px;
}

button {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

button:hover {
  background: var(--bg-card);
  border-color: var(--accent);
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
}

button.primary:hover {
  background: var(--accent-hover);
}

.feature-item {
  padding: 15px;
  background: var(--bg-card);
  border-radius: 8px;
  margin-bottom: 10px;
  border: 1px solid var(--border);
}

.feature-item label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.feature-item p {
  color: var(--text-secondary);
  margin-top: 5px;
  margin-left: 25px;
  font-size: 13px;
}

.advanced-editor textarea {
  width: 100%;
  padding: 15px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  border-radius: 8px;
  resize: vertical;
}

.button-group {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.wizard-container {
  max-width: 550px;
  margin-top: 10px;
}

.wizard-step {
  background: var(--bg-card);
  padding: 24px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.wizard-step h4 {
  margin: 0 0 8px 0;
  color: var(--accent);
}

.wizard-help {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.wizard-step label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.wizard-step label:hover {
  background: var(--bg-secondary);
}

.wizard-buttons {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

/* Docs Section */
.docs-container {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 24px;
  margin-top: 20px;
}

.docs-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.docs-nav-btn {
  text-align: left;
  padding: 10px 14px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  border-radius: 4px;
}

.docs-nav-btn:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.docs-nav-btn.active {
  background: var(--bg-card);
  color: var(--accent);
  border-left: 3px solid var(--accent);
}

.docs-content {
  background: var(--bg-card);
  padding: 24px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.doc-section {
  display: none;
}

.doc-section.active {
  display: block;
}

.doc-section h3 {
  margin: 0 0 20px 0;
  color: var(--accent);
}

.doc-block {
  margin-bottom: 24px;
}

.doc-block h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.doc-block p {
  color: var(--text-secondary);
  font-size: 14px;
}

.doc-block ul {
  margin: 10px 0;
  padding-left: 20px;
}

.doc-block li {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 6px;
}

.code-block {
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre;
  color: #a0ffa0;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 16px 0;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

kbd {
  display: inline-block;
  padding: 4px 8px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  min-width: 28px;
  text-align: center;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border);
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  margin: 0 0 16px 0;
  color: var(--accent);
}

/* Tier badges */
.tier-badge {
  display: inline-block;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.tier-premium { background: linear-gradient(135deg, #9d4edd, #7b2cbf); color: white; }
.tier-standard { background: linear-gradient(135deg, #3a86ff, #0077b6); color: white; }
.tier-budget { background: linear-gradient(135deg, #f9c74f, #f9844a); color: #333; }
.tier-economy { background: linear-gradient(135deg, #6c757d, #495057); color: white; }

.hidden {
  display: none !important;
}

.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 20px;
  background: var(--bg-card);
  border: 1px solid var(--accent);
  border-radius: 8px;
  animation: slideIn 0.3s ease;
  z-index: 1001;
  font-size: 14px;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

footer a {
  color: var(--accent);
  text-decoration: none;
}

footer a:hover {
  text-decoration: underline;
}

footer kbd {
  font-size: 10px;
  padding: 2px 5px;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 26px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: var(--text-secondary);
  border-radius: 50%;
  transition: 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--accent);
  border-color: var(--accent);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(22px);
  background-color: white;
}

/* Learning Mode Buttons */
.learning-mode-btn {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  min-width: 140px;
}

.learning-mode-btn:hover {
  border-color: var(--accent);
  background: var(--bg-card);
}

.learning-mode-btn.active {
  border-color: var(--accent);
  background: var(--accent);
}

.learning-mode-btn.active span {
  color: white !important;
}

/* Analytics Cards */
.analytics-card {
  transition: border-color 0.2s;
}

.analytics-card:hover {
  border-color: var(--accent);
}

/* Category Pills */
.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 16px;
  font-size: 13px;
}

.category-pill .cat-name {
  color: var(--text-primary);
}

.category-pill .cat-cost {
  color: var(--accent);
  font-weight: 600;
}

/* Efficiency Model Card */
.efficiency-card {
  background: var(--bg-secondary);
  padding: 10px 14px;
  border-radius: 8px;
  text-align: center;
}

.efficiency-card .model-name {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.efficiency-card .model-efficiency {
  font-size: 16px;
  font-weight: 600;
  color: var(--success);
}

/* Quota Slider Styling */
input[type="range"] {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-primary);
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: background 0.2s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: var(--accent-hover);
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}

@media (max-width: 768px) {
  nav {
    flex-direction: column;
  }

  .tab-btn {
    width: 100%;
  }

  .header-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .docs-container {
    grid-template-columns: 1fr;
  }

  .docs-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .shortcuts-grid {
    grid-template-columns: 1fr;
  }

  .learning-mode-btn {
    min-width: 100%;
  }
}
`

export const BUDGET_DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Budget Dashboard - oh-my-opencode</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      flex-wrap: wrap;
      gap: 10px;
    }

    .quick-status {
      display: flex;
      gap: 12px;
      font-size: 13px;
    }

    .status-item {
      padding: 4px 10px;
      background: var(--bg-card);
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .status-ok { border-color: var(--success); color: var(--success); }
    .status-warning { border-color: var(--warning); color: var(--warning); }
    .status-critical { border-color: var(--error); color: var(--error); }

    .budget-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .budget-card {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border);
    }

    .budget-card h3 {
      color: var(--accent);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .tier-badge {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .tier-premium { background: linear-gradient(135deg, #9d4edd, #7b2cbf); }
    .tier-standard { background: linear-gradient(135deg, #3a86ff, #0077b6); }
    .tier-budget { background: linear-gradient(135deg, #f9c74f, #f9844a); }
    .tier-economy { background: linear-gradient(135deg, #6c757d, #495057); }

    .progress-container {
      margin: 16px 0;
    }

    .progress-bar {
      height: 12px;
      background: var(--bg-secondary);
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.5s ease;
    }

    .progress-fill.green { background: linear-gradient(90deg, #4caf50, #81c784); }
    .progress-fill.yellow { background: linear-gradient(90deg, #ff9800, #ffb74d); }
    .progress-fill.red { background: linear-gradient(90deg, #f44336, #ef5350); }

    .progress-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 14px;
    }

    .budget-amount { color: var(--text-primary); font-weight: 600; }
    .budget-total { color: var(--text-secondary); }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 16px;
    }

    .metric-item {
      background: var(--bg-secondary);
      padding: 12px;
      border-radius: 8px;
    }

    .metric-label {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .adaptive-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    .adaptive-section h4 {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }

    .chart-container {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border);
      margin-bottom: 30px;
    }

    .chart-container h3 {
      margin-bottom: 20px;
    }

    .controls-section {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border);
    }

    .controls-section h3 {
      margin-bottom: 20px;
    }

    .control-group {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .control-group label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    select {
      padding: 8px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      color: var(--text-primary);
      border-radius: 6px;
    }

    .override-status {
      background: var(--bg-secondary);
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
    }

    .override-status.active {
      border-left: 4px solid var(--warning);
    }

    .trend-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
    }

    .trend-under { color: #4caf50; }
    .trend-on-track { color: #3a86ff; }
    .trend-over { color: #f44336; }

    .global-summary {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border);
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }

    .global-tier {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .global-tier span {
      font-size: 16px;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div id="app">
    <header>
      <div class="header-top">
        <h1>oh-my-opencode</h1>
        <div class="quick-status" id="quick-status">
          <span class="status-item" id="qs-tier" title="Current tier">--</span>
          <span class="status-item" id="qs-claude" title="Claude Max usage">Claude: --%</span>
          <span class="status-item" id="qs-copilot" title="Copilot usage">Copilot: --%</span>
        </div>
      </div>
      <nav>
        <a href="/" class="tab-btn">Overview</a>
        <span class="tab-btn active" style="cursor: default;">Usage & Budget</span>
      </nav>
    </header>

    <main>
      <div id="loading">Loading budget data...</div>

      <div id="dashboard-content" style="display: none;">
        <div id="disabled-message" class="card" style="display: none;">
          <h3>Budget Tracking Disabled</h3>
          <p>Enable budget tracking in your configuration to use this dashboard.</p>
        </div>

        <div id="enabled-content">
          <div class="global-summary" id="global-summary" style="display: none;"></div>

          <!-- Claude Max Subscription Section (Real-time from Anthropic API) -->
          <div id="claude-max-section" class="budget-card" style="margin-bottom: 30px; display: none;">
            <h3>
              <span style="color: #ff9d00;">Claude Max</span> Subscription
              <span class="tier-badge tier-premium" id="claude-max-tier">MAX 20X</span>
              <a href="https://claude.ai/settings/usage" target="_blank" style="margin-left: auto; font-size: 12px; color: var(--accent); text-decoration: none;">Open Claude Console &rarr;</a>
            </h3>
            <!-- Usage Meters -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 16px;">
              <!-- Current Session -->
              <div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Current Session</div>
                <div class="progress-container">
                  <div class="progress-bar">
                    <div class="progress-fill" id="claude-max-session-progress" style="width: 0%;"></div>
                  </div>
                  <div class="progress-labels">
                    <span class="budget-amount" id="claude-max-session-percent">0% used</span>
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;" id="claude-max-session-reset">Resets --</div>
              </div>
              <!-- All Models Weekly -->
              <div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Current Week (All Models)</div>
                <div class="progress-container">
                  <div class="progress-bar">
                    <div class="progress-fill" id="claude-max-all-progress" style="width: 0%;"></div>
                  </div>
                  <div class="progress-labels">
                    <span class="budget-amount" id="claude-max-all-percent">0% used</span>
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;" id="claude-max-all-reset">Resets --</div>
              </div>
              <!-- Sonnet Only Weekly -->
              <div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Current Week (Sonnet Only)</div>
                <div class="progress-container">
                  <div class="progress-bar">
                    <div class="progress-fill" id="claude-max-sonnet-progress" style="width: 0%;"></div>
                  </div>
                  <div class="progress-labels">
                    <span class="budget-amount" id="claude-max-sonnet-percent">0% used</span>
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;" id="claude-max-sonnet-reset">Resets --</div>
              </div>
            </div>
            <!-- Status & Controls -->
            <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding-top: 12px; border-top: 1px solid var(--border);">
              <span id="claude-max-recommendation" class="trend-indicator trend-under"></span>
              <span id="claude-max-downgrade-hint" style="font-size: 12px; color: var(--warning); display: none;">Consider downgrading to Sonnet</span>
              <span style="color: var(--text-secondary); font-size: 12px;" id="claude-max-last-updated">Last updated: --</span>
              <button onclick="toggleClaudeMaxHistory()" id="claude-max-history-toggle" style="margin-left: auto;">Show 24h History</button>
              <button onclick="refreshClaudeMax()">Refresh</button>
            </div>
            <!-- 24h History Chart (Expandable) -->
            <div id="claude-max-history-container" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 14px; color: var(--text-secondary);">Usage History (Last 24 Hours)</h4>
                <span style="font-size: 11px; color: var(--text-secondary);" id="claude-max-history-info">-- data points</span>
              </div>
              <div style="height: 150px; position: relative;">
                <canvas id="claude-max-history-chart"></canvas>
              </div>
              <div style="display: flex; justify-content: center; gap: 20px; margin-top: 8px; font-size: 11px;">
                <span><span style="display: inline-block; width: 12px; height: 3px; background: #ff9d00; margin-right: 4px;"></span>Session</span>
                <span><span style="display: inline-block; width: 12px; height: 3px; background: #7dd3fc; margin-right: 4px;"></span>All Models</span>
                <span><span style="display: inline-block; width: 12px; height: 3px; background: #86efac; margin-right: 4px;"></span>Sonnet</span>
              </div>
            </div>
            <div id="claude-max-error" style="display: none; margin-top: 12px; padding: 8px 12px; background: rgba(255,100,100,0.1); border-radius: 6px; color: #ff6b6b; font-size: 12px;"></div>
          </div>

          <!-- GitHub Copilot Section -->
          <div id="copilot-section" class="budget-card" style="margin-bottom: 30px; display: none;">
            <h3>
              <span style="color: #238636;">GitHub Copilot</span> Premium Requests
              <span class="tier-badge" style="background: linear-gradient(135deg, #238636, #2ea043);" id="copilot-plan-badge">PRO</span>
              <a href="https://github.com/settings/copilot" target="_blank" style="margin-left: auto; font-size: 12px; color: var(--accent); text-decoration: none;">Copilot Settings &rarr;</a>
            </h3>
            <!-- Usage Meter -->
            <div style="margin-bottom: 16px;">
              <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Premium Requests Used</div>
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" id="copilot-usage-progress" style="width: 0%;"></div>
                </div>
                <div class="progress-labels">
                  <span class="budget-amount" id="copilot-usage-percent">0% used</span>
                  <span class="budget-total" id="copilot-days-remaining">-- days until reset</span>
                </div>
              </div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;" id="copilot-reset-date">Resets --</div>
            </div>
            <!-- Status & Controls -->
            <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding-top: 12px; border-top: 1px solid var(--border);">
              <span id="copilot-recommendation" class="trend-indicator trend-under"></span>
              <span id="copilot-reduce-hint" style="font-size: 12px; color: var(--warning); display: none;">Consider reducing usage</span>
              <span style="color: var(--text-secondary); font-size: 12px;" id="copilot-last-updated">Last updated: --</span>
              <span style="color: var(--text-secondary); font-size: 11px;" id="copilot-fetch-method"></span>
              <button onclick="toggleCopilotHistory()" id="copilot-history-toggle" style="margin-left: auto;">Show 24h History</button>
              <button onclick="refreshCopilot()">Refresh</button>
            </div>
            <!-- 24h History Chart (Expandable) -->
            <div id="copilot-history-container" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 14px; color: var(--text-secondary);">Usage History (Last 24 Hours)</h4>
                <span style="font-size: 11px; color: var(--text-secondary);" id="copilot-history-info">-- data points</span>
              </div>
              <div style="height: 150px; position: relative;">
                <canvas id="copilot-history-chart"></canvas>
              </div>
              <div style="display: flex; justify-content: center; gap: 20px; margin-top: 8px; font-size: 11px;">
                <span><span style="display: inline-block; width: 12px; height: 3px; background: #238636; margin-right: 4px;"></span>Usage %</span>
              </div>
            </div>
            <div id="copilot-error" style="display: none; margin-top: 12px; padding: 8px 12px; background: rgba(255,100,100,0.1); border-radius: 6px; color: #ff6b6b; font-size: 12px;"></div>
          </div>

          <!-- Other Providers (collapsible) -->
          <div id="other-providers-section" style="margin-bottom: 30px; display: none;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <button onclick="toggleOtherProviders()" id="other-providers-toggle" style="padding: 6px 12px; font-size: 13px;">
                <span id="other-providers-arrow">&#9654;</span> Other API Providers
              </button>
              <span style="font-size: 12px; color: var(--text-secondary);" id="other-providers-summary"></span>
            </div>
            <div id="providers-grid" class="budget-grid" style="display: none;"></div>
          </div>

          <!-- Spending Trends (collapsible) -->
          <div class="chart-container" id="trends-section" style="display: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
              <h3 style="margin: 0;">Spending Trends</h3>
              <button onclick="toggleTrendsChart()" style="padding: 6px 12px; font-size: 13px;">Hide</button>
            </div>
            <canvas id="spending-chart" height="100"></canvas>
          </div>

          <!-- Tier Management Section (NEW) -->
          <div class="controls-section" style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h3 style="margin: 0;">Tier Management</h3>
              <button onclick="toggleTierManagement()" id="tier-mgmt-toggle" style="padding: 6px 12px; font-size: 13px;">Show</button>
            </div>
            <div id="tier-mgmt-content" style="display: none;">
              <!-- Auto-upgrade/downgrade toggles -->
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;">
                <div class="toggle-card" style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <div style="font-weight: 600;">Auto-Upgrade</div>
                      <div style="font-size: 12px; color: var(--text-secondary);" title="Automatically switch to higher-quality models when budget headroom allows.">Switch to premium when budget allows</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" id="auto-upgrade-toggle" onchange="setAutoUpgrade(this.checked)">
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
                <div class="toggle-card" style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <div style="font-weight: 600;">Auto-Downgrade</div>
                      <div style="font-size: 12px; color: var(--text-secondary);" title="Automatically switch to cheaper models when approaching budget limits.">Switch to cheaper when over budget</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" id="auto-downgrade-toggle" onchange="setAutoDowngrade(this.checked)" checked>
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Learning Mode Selector -->
              <div style="margin-bottom: 20px;">
                <div style="font-weight: 600; margin-bottom: 8px;">Learning Mode</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <button class="learning-mode-btn" data-mode="conservative" onclick="setLearningMode('conservative')">
                    <span style="display: block; font-weight: 600;">Conservative</span>
                    <span style="font-size: 11px; color: var(--text-secondary);">Slow learning, high stability</span>
                  </button>
                  <button class="learning-mode-btn active" data-mode="balanced" onclick="setLearningMode('balanced')">
                    <span style="display: block; font-weight: 600;">Balanced</span>
                    <span style="font-size: 11px; color: var(--text-secondary);">Recommended default</span>
                  </button>
                  <button class="learning-mode-btn" data-mode="aggressive" onclick="setLearningMode('aggressive')">
                    <span style="display: block; font-weight: 600;">Aggressive</span>
                    <span style="font-size: 11px; color: var(--text-secondary);">Fast learning, quick adjustments</span>
                  </button>
                </div>
              </div>

              <!-- Quota Targets -->
              <div style="margin-bottom: 20px;">
                <div style="font-weight: 600; margin-bottom: 8px;">Quota Targets</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                  <div class="quota-target" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                    <label style="font-size: 13px; display: block; margin-bottom: 6px;">Claude Max Weekly</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <input type="range" id="claude-quota-slider" min="0" max="100" value="70" oninput="updateQuotaDisplay('claude')">
                      <span id="claude-quota-value" style="min-width: 40px;">70%</span>
                    </div>
                  </div>
                  <div class="quota-target" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                    <label style="font-size: 13px; display: block; margin-bottom: 6px;">Copilot Monthly</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <input type="range" id="copilot-quota-slider" min="0" max="100" value="80" oninput="updateQuotaDisplay('copilot')">
                      <span id="copilot-quota-value" style="min-width: 40px;">80%</span>
                    </div>
                  </div>
                </div>
                <button onclick="saveQuotaTargets()" style="margin-top: 12px;">Save Quota Targets</button>
              </div>

              <!-- Stability Status Display -->
              <div id="stability-status" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; display: none;">
                <div style="font-size: 13px; color: var(--text-secondary);">Stability Status</div>
                <div id="stability-info" style="font-size: 14px; margin-top: 4px;">-- of -- checks until upgrade allowed</div>
              </div>
            </div>
          </div>

          <!-- Analytics Section (NEW) -->
          <div class="controls-section" style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h3 style="margin: 0;">Analytics</h3>
              <button onclick="toggleAnalytics()" id="analytics-toggle" style="padding: 6px 12px; font-size: 13px;">Show</button>
            </div>
            <div id="analytics-content" style="display: none;">
              <!-- Period Summary -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 20px;">
                <div class="analytics-card" style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="margin: 0; font-size: 14px; color: var(--text-secondary);">This Week</h4>
                    <select id="period-selector" onchange="loadAnalytics(this.value)" style="padding: 4px 8px; font-size: 12px;">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div id="period-cost" style="font-size: 24px; font-weight: 600;">$--</div>
                  <div id="period-change" style="font-size: 13px; color: var(--text-secondary);">-- vs previous</div>
                  <div id="period-daily-avg" style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Avg $--/day</div>
                </div>
                <div class="analytics-card" style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Sessions</h4>
                  <div id="session-count" style="font-size: 24px; font-weight: 600;">--</div>
                  <div id="session-avg-cost" style="font-size: 13px; color: var(--text-secondary);">Avg $-- per session</div>
                  <div id="session-avg-duration" style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Avg -- min duration</div>
                </div>
              </div>

              <!-- Category Breakdown -->
              <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">Cost by Category</h4>
                <div id="category-breakdown" style="display: flex; flex-wrap: wrap; gap: 8px;">
                  <span style="color: var(--text-secondary); font-size: 13px;">Loading...</span>
                </div>
              </div>

              <!-- Model Efficiency -->
              <div>
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">Model Efficiency (Tokens/$1)</h4>
                <div id="model-efficiency" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                  <span style="color: var(--text-secondary); font-size: 13px;">Loading...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Override Controls (collapsible) -->
          <div class="controls-section">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h3 style="margin: 0;">Advanced Controls</h3>
              <button onclick="toggleControls()" id="controls-toggle" style="padding: 6px 12px; font-size: 13px;">Show</button>
            </div>
            <div id="controls-content" style="display: none;">
            <div class="control-group">
              <label>
                Force Tier:
                <select id="force-tier-select">
                  <option value="">Select tier...</option>
                  <option value="premium">Premium</option>
                  <option value="standard">Standard</option>
                  <option value="budget">Budget</option>
                  <option value="economy">Economy</option>
                </select>
              </label>
              <button onclick="forceTier()">Apply</button>
            </div>
            <div class="control-group">
              <button onclick="lockTier()">Lock Current Tier</button>
              <button onclick="unlockTier()">Unlock Tier</button>
              <button onclick="clearOverrides()">Clear All Overrides</button>
              <button onclick="resetLearning()">Reset Learning</button>
            </div>
            <div id="override-status" class="override-status" style="display: none;"></div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer>
      <p>oh-my-opencode WebUI &bull; <a href="https://github.com/sadnow/oh-my-opencode" target="_blank">GitHub</a> &bull; Press <kbd>r</kbd> to refresh, <kbd>1</kbd>-<kbd>6</kbd> for tabs</p>
    </footer>
  </div>

  <div id="toast" class="toast hidden"></div>

  <script src="/budget-dashboard.js"></script>
</body>
</html>`

export const BUDGET_DASHBOARD_JS = `// Budget Dashboard JavaScript
const API_BASE = window.location.origin + '/api';
let spendingChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initKeyboardShortcuts();
  loadDashboard();
  loadQuickStatus();
  // Refresh every 60 seconds
  setInterval(loadDashboard, 60000);
  setInterval(loadQuickStatus, 60000);
});

// Keyboard shortcuts
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (key === '1') window.location.href = '/';
    else if (key === '3') window.location.href = '/#presets';
    else if (key === '4') window.location.href = '/#features';
    else if (key === '5') window.location.href = '/#advanced';
    else if (key === '6') window.location.href = '/#docs';
    else if (key === 'r') { e.preventDefault(); loadDashboard(); showToast('Refreshed'); }
  });
}

// Quick status bar
async function loadQuickStatus() {
  try {
    const [claudeRes, copilotRes, orchRes] = await Promise.all([
      fetch(API_BASE + '/claude-max/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/copilot/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/orchestration/status').then(r => r.json()).catch(() => null),
    ]);

    const tierEl = document.getElementById('qs-tier');
    if (orchRes?.success && orchRes.data?.currentTier) {
      tierEl.textContent = orchRes.data.currentTier.toUpperCase();
      tierEl.className = 'status-item tier-' + orchRes.data.currentTier;
    }

    const claudeEl = document.getElementById('qs-claude');
    if (claudeRes?.success && claudeRes.data?.allModels) {
      const pct = claudeRes.data.allModels.percentUsed || 0;
      claudeEl.textContent = 'Claude: ' + pct.toFixed(0) + '%';
      claudeEl.className = 'status-item ' + (pct >= 90 ? 'status-critical' : pct >= 70 ? 'status-warning' : 'status-ok');
    }

    const copilotEl = document.getElementById('qs-copilot');
    if (copilotRes?.success && copilotRes.data) {
      const pct = copilotRes.data.percentUsed || 0;
      copilotEl.textContent = 'Copilot: ' + pct.toFixed(0) + '%';
      copilotEl.className = 'status-item ' + (pct >= 90 ? 'status-critical' : pct >= 70 ? 'status-warning' : 'status-ok');
    }
  } catch (err) {
    console.error('Quick status error:', err);
  }
}

async function loadDashboard() {
  try {
    const res = await fetch(API_BASE + '/budget/dashboard');
    const { success, data } = await res.json();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'block';

    if (!success || !data.enabled) {
      document.getElementById('disabled-message').style.display = 'block';
      document.getElementById('enabled-content').style.display = 'none';
      return;
    }

    document.getElementById('disabled-message').style.display = 'none';
    document.getElementById('enabled-content').style.display = 'block';

    renderGlobalSummary(data);
    renderProviders(data.providers);
    renderOverrideStatus(data.override);
    await loadAndRenderChart();
    await loadClaudeMaxUsage();
    await loadCopilotUsage();
  } catch (err) {
    console.error('Dashboard load error:', err);
    document.getElementById('loading').textContent = 'Error loading dashboard';
  }
}

// Provider console URLs
const PROVIDER_URLS = {
  openai: 'https://platform.openai.com/usage',
  google: 'https://console.cloud.google.com/apis/dashboard',
  opencode: null, // Free via opencode
  anthropic: null, // We use Claude Max section instead
};

function renderGlobalSummary(data) {
  const container = document.getElementById('global-summary');
  // Hide global summary - we show tier in status bar already
  container.style.display = 'none';
}

// Toggle states
let otherProvidersExpanded = false;
let controlsExpanded = false;

function toggleOtherProviders() {
  otherProvidersExpanded = !otherProvidersExpanded;
  document.getElementById('providers-grid').style.display = otherProvidersExpanded ? 'grid' : 'none';
  document.getElementById('other-providers-arrow').innerHTML = otherProvidersExpanded ? '&#9660;' : '&#9654;';
}

function toggleControls() {
  controlsExpanded = !controlsExpanded;
  document.getElementById('controls-content').style.display = controlsExpanded ? 'block' : 'none';
  document.getElementById('controls-toggle').textContent = controlsExpanded ? 'Hide' : 'Show';
}

function toggleTrendsChart() {
  document.getElementById('trends-section').style.display = 'none';
}

function renderProviders(providers) {
  const container = document.getElementById('providers-grid');
  const section = document.getElementById('other-providers-section');
  const summary = document.getElementById('other-providers-summary');

  // Filter out anthropic (we have Claude Max) and opencode (free)
  const filteredProviders = providers.filter(function(p) {
    const name = p.provider.toLowerCase();
    return name !== 'anthropic' && name !== 'opencode';
  });

  // Only show section if there are providers with actual usage
  const activeProviders = filteredProviders.filter(function(p) {
    return p.used > 0 || p.budget > 0;
  });

  if (activeProviders.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  summary.textContent = activeProviders.length + ' provider' + (activeProviders.length === 1 ? '' : 's') + ' configured';

  container.innerHTML = activeProviders.map(function(p) {
    const progressClass = p.percentage < 70 ? 'green' : p.percentage < 90 ? 'yellow' : 'red';
    const trendClass = 'trend-' + p.trend.replace('-', '');
    const trendIcon = { under: '↓', 'on-track': '→', over: '↑' }[p.trend] || '•';
    const tierClass = 'tier-' + p.recommendedTier;
    const consoleUrl = PROVIDER_URLS[p.provider.toLowerCase()];
    const consoleLink = consoleUrl ? '<a href="' + consoleUrl + '" target="_blank" style="margin-left: auto; font-size: 11px; color: var(--accent); text-decoration: none;">Console &rarr;</a>' : '';

    return '<div class="budget-card">' +
      '<h3 style="display: flex; align-items: center;">' + p.provider.toUpperCase() +
      '<span class="tier-badge ' + tierClass + '" style="margin-left: 8px;">' + p.recommendedTier + '</span>' +
      consoleLink +
      '</h3>' +
      '<div class="progress-container">' +
      '<div class="progress-bar">' +
      '<div class="progress-fill ' + progressClass + '" style="width: ' + Math.min(100, p.percentage) + '%"></div>' +
      '</div>' +
      '<div class="progress-labels">' +
      '<span class="budget-amount">$' + p.used.toFixed(2) + ' used</span>' +
      '<span class="budget-total">$' + p.budget.toFixed(2) + ' budget</span>' +
      '</div>' +
      '</div>' +
      '<div style="display: flex; gap: 16px; margin-top: 12px; font-size: 13px; color: var(--text-secondary);">' +
      '<span>' + p.percentage.toFixed(1) + '% used</span>' +
      '<span>' + p.daysRemaining + ' days left</span>' +
      '<span class="trend-indicator ' + trendClass + '">' + trendIcon + ' ' + p.trend.replace('-', ' ') + '</span>' +
      '</div>' +
      '</div>';
  }).join('');
}

function renderOverrideStatus(override) {
  const container = document.getElementById('override-status');

  if (!override.forcedTier && !override.tierLocked) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.className = 'override-status active';

  let html = '<strong>Override Active</strong><br>';
  if (override.forcedTier) {
    html += 'Forced tier: <span class="tier-badge tier-' + override.forcedTier + '">' + override.forcedTier + '</span><br>';
  }
  if (override.tierLocked) {
    html += 'Tier locked: Yes<br>';
  }
  if (override.expiresIn) {
    html += 'Expires in: ' + override.expiresIn + '<br>';
  }
  if (override.modifiedBy) {
    html += 'Set by: ' + override.modifiedBy;
  }

  container.innerHTML = html;
}

async function loadAndRenderChart() {
  try {
    const res = await fetch(API_BASE + '/budget/trends');
    const { success, data } = await res.json();

    if (!success || !data.trends.length) return;

    const ctx = document.getElementById('spending-chart').getContext('2d');

    const datasets = data.providers.map(function(provider, i) {
      const colors = ['#9d4edd', '#3a86ff', '#4caf50', '#ff9800'];
      return {
        label: provider,
        data: data.trends.map(function(t) { return t[provider] || 0; }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        fill: true,
        tension: 0.4,
      };
    });

    if (spendingChart) {
      spendingChart.destroy();
    }

    spendingChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.trends.map(function(t) { return t.date; }),
        datasets: datasets,
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: '#e0e0e0' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#888' },
            grid: { color: '#333' }
          },
          y: {
            ticks: {
              color: '#888',
              callback: function(v) { return '$' + v.toFixed(2); }
            },
            grid: { color: '#333' }
          }
        }
      }
    });
  } catch (err) {
    console.error('Chart load error:', err);
  }
}

async function forceTier() {
  const tier = document.getElementById('force-tier-select').value;
  if (!tier) {
    showToast('Please select a tier');
    return;
  }

  try {
    const res = await fetch(API_BASE + '/budget/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'force-tier', tier: tier }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
    if (result.success) loadDashboard();
  } catch (err) {
    showToast('Error: ' + err);
  }
}

async function lockTier() {
  try {
    const res = await fetch(API_BASE + '/budget/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock-tier' }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
    if (result.success) loadDashboard();
  } catch (err) {
    showToast('Error: ' + err);
  }
}

async function unlockTier() {
  try {
    const res = await fetch(API_BASE + '/budget/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unlock-tier' }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
    if (result.success) loadDashboard();
  } catch (err) {
    showToast('Error: ' + err);
  }
}

async function clearOverrides() {
  try {
    const res = await fetch(API_BASE + '/budget/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
    if (result.success) loadDashboard();
  } catch (err) {
    showToast('Error: ' + err);
  }
}

async function resetLearning() {
  try {
    const res = await fetch(API_BASE + '/budget/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-learning' }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
    if (result.success) loadDashboard();
  } catch (err) {
    showToast('Error: ' + err);
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(function() { toast.classList.add('hidden'); }, 3000);
}

// Claude Max Functions (Real-time from Anthropic API)
async function loadClaudeMaxUsage() {
  try {
    const res = await fetch(API_BASE + '/claude-max/usage');
    const { success, data, error } = await res.json();

    const section = document.getElementById('claude-max-section');
    const errorEl = document.getElementById('claude-max-error');

    if (!success) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Show error if present but still display cached data
    if (data.error) {
      errorEl.textContent = 'API Error: ' + data.error;
      errorEl.style.display = 'block';
    } else {
      errorEl.style.display = 'none';
    }

    // Helper to set progress bar
    function setProgress(prefix, percent, resetText) {
      const progressClass = percent < 50 ? 'green' : percent < 80 ? 'yellow' : 'red';
      document.getElementById(prefix + '-progress').className = 'progress-fill ' + progressClass;
      document.getElementById(prefix + '-progress').style.width = Math.min(100, percent) + '%';
      document.getElementById(prefix + '-percent').textContent = percent.toFixed(0) + '% used';
      document.getElementById(prefix + '-reset').textContent = 'Resets ' + resetText;
    }

    // Current session (5-hour window)
    setProgress('claude-max-session', data.currentSession.percentUsed, data.formatted.currentSessionReset);

    // All models (weekly)
    setProgress('claude-max-all', data.allModels.percentUsed, data.formatted.allModelsReset);

    // Sonnet only (weekly)
    setProgress('claude-max-sonnet', data.sonnetOnly.percentUsed, data.formatted.sonnetOnlyReset);

    // Tier badge
    const tier = data.subscription.tier.toUpperCase().replace('-', ' ');
    document.getElementById('claude-max-tier').textContent = tier;

    // Recommendation
    const recEl = document.getElementById('claude-max-recommendation');
    const recommendations = {
      normal: { text: '✓ Normal usage', class: 'trend-under' },
      caution: { text: '⚠ Moderate usage', class: 'trend-on-track' },
      reduce: { text: '↓ Consider reducing', class: 'trend-over' },
      critical: { text: '⛔ Near limit!', class: 'trend-over' }
    };
    const rec = recommendations[data.recommendation] || recommendations.normal;
    recEl.textContent = rec.text;
    recEl.className = 'trend-indicator ' + rec.class;

    // Downgrade hint
    const downgradeEl = document.getElementById('claude-max-downgrade-hint');
    downgradeEl.style.display = data.shouldDowngrade ? 'inline' : 'none';

    // Last updated
    const lastUpdated = new Date(data.lastUpdated);
    document.getElementById('claude-max-last-updated').textContent = 'Updated: ' + lastUpdated.toLocaleTimeString();
  } catch (err) {
    console.error('Claude Max load error:', err);
    document.getElementById('claude-max-section').style.display = 'none';
  }
}

async function refreshClaudeMax() {
  try {
    const res = await fetch(API_BASE + '/claude-max/refresh', { method: 'POST' });
    const result = await res.json();
    showToast(result.success ? 'Usage refreshed from Anthropic' : result.error);
    if (result.success) {
      loadClaudeMaxUsage();
      // Also refresh history if visible
      if (claudeMaxHistoryVisible) {
        loadClaudeMaxHistory();
      }
    }
  } catch (err) {
    showToast('Refresh error: ' + err);
  }
}

// Claude Max History Chart
let claudeMaxHistoryChart = null;
let claudeMaxHistoryVisible = false;
let claudeMaxHistoryInterval = null;

function toggleClaudeMaxHistory() {
  const container = document.getElementById('claude-max-history-container');
  const button = document.getElementById('claude-max-history-toggle');
  claudeMaxHistoryVisible = !claudeMaxHistoryVisible;

  if (claudeMaxHistoryVisible) {
    container.style.display = 'block';
    button.textContent = 'Hide 24h History';
    loadClaudeMaxHistory();
    // Auto-refresh every 60 seconds while visible
    claudeMaxHistoryInterval = setInterval(loadClaudeMaxHistory, 60000);
  } else {
    container.style.display = 'none';
    button.textContent = 'Show 24h History';
    if (claudeMaxHistoryInterval) {
      clearInterval(claudeMaxHistoryInterval);
      claudeMaxHistoryInterval = null;
    }
  }
}

async function loadClaudeMaxHistory() {
  try {
    const res = await fetch(API_BASE + '/claude-max/history');
    const { success, data, error } = await res.json();

    if (!success || !data || !data.points || data.points.length === 0) {
      document.getElementById('claude-max-history-info').textContent = 'No history data yet';
      return;
    }

    document.getElementById('claude-max-history-info').textContent = data.pointCount + ' data points';

    // Prepare chart data
    const labels = data.points.map(p => p.formattedTime);
    const sessionData = data.points.map(p => p.sessionPercent);
    const allModelsData = data.points.map(p => p.allModelsPercent);
    const sonnetData = data.points.map(p => p.sonnetPercent);

    const ctx = document.getElementById('claude-max-history-chart').getContext('2d');

    // Destroy existing chart if any
    if (claudeMaxHistoryChart) {
      claudeMaxHistoryChart.destroy();
    }

    claudeMaxHistoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Session',
            data: sessionData,
            borderColor: '#ff9d00',
            backgroundColor: 'rgba(255, 157, 0, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
          },
          {
            label: 'All Models',
            data: allModelsData,
            borderColor: '#7dd3fc',
            backgroundColor: 'rgba(125, 211, 252, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
          },
          {
            label: 'Sonnet',
            data: sonnetData,
            borderColor: '#86efac',
            backgroundColor: 'rgba(134, 239, 172, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            titleColor: '#fff',
            bodyColor: '#ccc',
            borderColor: '#444',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(0) + '%';
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: '#888',
              maxTicksLimit: 8,
              font: { size: 10 }
            }
          },
          y: {
            display: true,
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: '#888',
              callback: function(value) { return value + '%'; },
              font: { size: 10 }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Claude Max history error:', err);
    document.getElementById('claude-max-history-info').textContent = 'Error loading history';
  }
}

// GitHub Copilot Functions
async function loadCopilotUsage() {
  try {
    const res = await fetch(API_BASE + '/copilot/usage');
    const { success, data, error } = await res.json();

    const section = document.getElementById('copilot-section');
    const errorEl = document.getElementById('copilot-error');

    if (!success) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Show error or auth prompt if present
    if (data.needsAuth) {
      errorEl.innerHTML = '<strong>Auth Required:</strong> Run <code>gh auth login</code> in your terminal to authenticate with GitHub CLI.';
      errorEl.style.display = 'block';
      errorEl.style.background = 'rgba(255, 157, 0, 0.1)';
      errorEl.style.color = '#ff9d00';
    } else if (data.error) {
      errorEl.textContent = data.error;
      errorEl.style.display = 'block';
      errorEl.style.background = 'rgba(255,100,100,0.1)';
      errorEl.style.color = '#ff6b6b';
    } else {
      errorEl.style.display = 'none';
    }

    // Usage progress bar
    const percent = data.percentUsed || 0;
    const progressClass = percent < 60 ? 'green' : percent < 80 ? 'yellow' : 'red';
    document.getElementById('copilot-usage-progress').className = 'progress-fill ' + progressClass;
    document.getElementById('copilot-usage-progress').style.width = Math.min(100, percent) + '%';
    document.getElementById('copilot-usage-percent').textContent = percent.toFixed(1) + '% used';

    // Days until reset
    document.getElementById('copilot-days-remaining').textContent = data.daysUntilReset + ' days until reset';
    document.getElementById('copilot-reset-date').textContent = 'Resets ' + data.formatted.resetDate;

    // Plan badge
    const plan = (data.plan || 'unknown').toUpperCase();
    document.getElementById('copilot-plan-badge').textContent = plan;

    // Recommendation
    const recEl = document.getElementById('copilot-recommendation');
    const recommendations = {
      normal: { text: '✓ Normal usage', class: 'trend-under' },
      caution: { text: '⚠ Moderate usage', class: 'trend-on-track' },
      reduce: { text: '↓ Consider reducing', class: 'trend-over' },
      critical: { text: '⛔ Over limit!', class: 'trend-over' }
    };
    const rec = recommendations[data.recommendation] || recommendations.normal;
    recEl.textContent = rec.text;
    recEl.className = 'trend-indicator ' + rec.class;

    // Reduce hint
    const reduceEl = document.getElementById('copilot-reduce-hint');
    reduceEl.style.display = data.shouldReduceUsage ? 'inline' : 'none';

    // Last updated
    const lastUpdated = new Date(data.lastUpdated);
    document.getElementById('copilot-last-updated').textContent = 'Updated: ' + lastUpdated.toLocaleTimeString();

    // Fetch method indicator
    const methodEl = document.getElementById('copilot-fetch-method');
    if (data.fetchMethod === 'api') {
      methodEl.textContent = '(via GitHub API)';
      methodEl.style.color = '#4caf50';
    } else if (data.fetchMethod === 'cached') {
      methodEl.textContent = '(cached)';
      methodEl.style.color = '#888';
    } else if (data.needsAuth) {
      methodEl.textContent = '(auth needed)';
      methodEl.style.color = '#ff9d00';
    } else {
      methodEl.textContent = '';
    }
  } catch (err) {
    console.error('Copilot load error:', err);
    document.getElementById('copilot-section').style.display = 'none';
  }
}

async function refreshCopilot() {
  try {
    showToast('Refreshing Copilot usage from GitHub API...');
    const res = await fetch(API_BASE + '/copilot/refresh', { method: 'POST' });
    const result = await res.json();

    if (result.success) {
      if (result.data?.error) {
        showToast(result.data.error);
      } else {
        showToast('Usage refreshed: ' + (result.data?.percentUsed || 0) + '%');
      }
      loadCopilotUsage();
      if (copilotHistoryVisible) {
        loadCopilotHistory();
      }
    } else {
      showToast(result.error || 'Refresh failed');
    }
  } catch (err) {
    showToast('Refresh error: ' + err);
  }
}

// Copilot History Chart
let copilotHistoryChart = null;
let copilotHistoryVisible = false;
let copilotHistoryInterval = null;

function toggleCopilotHistory() {
  const container = document.getElementById('copilot-history-container');
  const button = document.getElementById('copilot-history-toggle');
  copilotHistoryVisible = !copilotHistoryVisible;

  if (copilotHistoryVisible) {
    container.style.display = 'block';
    button.textContent = 'Hide 24h History';
    loadCopilotHistory();
    // Auto-refresh every 60 seconds while visible
    copilotHistoryInterval = setInterval(loadCopilotHistory, 60000);
  } else {
    container.style.display = 'none';
    button.textContent = 'Show 24h History';
    if (copilotHistoryInterval) {
      clearInterval(copilotHistoryInterval);
      copilotHistoryInterval = null;
    }
  }
}

async function loadCopilotHistory() {
  try {
    const res = await fetch(API_BASE + '/copilot/history');
    const { success, data, error } = await res.json();

    if (!success || !data || !data.points || data.points.length === 0) {
      document.getElementById('copilot-history-info').textContent = 'No history data yet';
      return;
    }

    document.getElementById('copilot-history-info').textContent = data.pointCount + ' data points';

    // Prepare chart data
    const labels = data.points.map(p => p.formattedTime);
    const usageData = data.points.map(p => p.percentUsed);

    const ctx = document.getElementById('copilot-history-chart').getContext('2d');

    // Destroy existing chart if any
    if (copilotHistoryChart) {
      copilotHistoryChart.destroy();
    }

    copilotHistoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Usage',
            data: usageData,
            borderColor: '#238636',
            backgroundColor: 'rgba(35, 134, 54, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            titleColor: '#fff',
            bodyColor: '#ccc',
            borderColor: '#444',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                return 'Usage: ' + context.parsed.y.toFixed(1) + '%';
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: '#888',
              maxTicksLimit: 8,
              font: { size: 10 }
            }
          },
          y: {
            display: true,
            min: 0,
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
            },
            ticks: {
              color: '#888',
              callback: function(value) { return value + '%'; },
              font: { size: 10 }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Copilot history error:', err);
    document.getElementById('copilot-history-info').textContent = 'Error loading history';
  }
}

// Tier Management Functions
let tierMgmtExpanded = false;
let analyticsExpanded = false;

function toggleTierManagement() {
  tierMgmtExpanded = !tierMgmtExpanded;
  document.getElementById('tier-mgmt-content').style.display = tierMgmtExpanded ? 'block' : 'none';
  document.getElementById('tier-mgmt-toggle').textContent = tierMgmtExpanded ? 'Hide' : 'Show';
  if (tierMgmtExpanded) {
    loadAdaptiveSettings();
  }
}

function toggleAnalytics() {
  analyticsExpanded = !analyticsExpanded;
  document.getElementById('analytics-content').style.display = analyticsExpanded ? 'block' : 'none';
  document.getElementById('analytics-toggle').textContent = analyticsExpanded ? 'Hide' : 'Show';
  if (analyticsExpanded) {
    loadAnalytics('weekly');
  }
}

async function loadAdaptiveSettings() {
  try {
    const res = await fetch(API_BASE + '/adaptive/settings');
    const { success, data } = await res.json();
    if (!success) return;

    // Set toggle states
    document.getElementById('auto-upgrade-toggle').checked = data.autoUpgrade || false;
    document.getElementById('auto-downgrade-toggle').checked = data.autoDowngrade !== false;

    // Set learning mode
    const mode = data.learningMode || 'balanced';
    document.querySelectorAll('.learning-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Set quota sliders
    if (data.quotaTargets) {
      if (data.quotaTargets.claude_max_weekly_percent !== undefined) {
        document.getElementById('claude-quota-slider').value = data.quotaTargets.claude_max_weekly_percent;
        document.getElementById('claude-quota-value').textContent = data.quotaTargets.claude_max_weekly_percent + '%';
      }
      if (data.quotaTargets.copilot_monthly_percent !== undefined) {
        document.getElementById('copilot-quota-slider').value = data.quotaTargets.copilot_monthly_percent;
        document.getElementById('copilot-quota-value').textContent = data.quotaTargets.copilot_monthly_percent + '%';
      }
    }

    // Show stability status if available
    const stabilityEl = document.getElementById('stability-status');
    const infoEl = document.getElementById('stability-info');
    if (data.stabilityStatus && Object.keys(data.stabilityStatus).length > 0) {
      stabilityEl.style.display = 'block';
      const entries = Object.entries(data.stabilityStatus);
      const statusText = entries.map(([provider, status]) => {
        return provider + ': ' + status.current + ' of ' + status.required + ' checks';
      }).join(' | ');
      infoEl.textContent = statusText || 'No stability data';
    } else {
      stabilityEl.style.display = 'none';
    }
  } catch (err) {
    console.error('Load adaptive settings error:', err);
  }
}

async function setAutoUpgrade(enabled) {
  try {
    const res = await fetch(API_BASE + '/adaptive/auto-upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
  } catch (err) {
    showToast('Error: ' + err);
  }
}

async function setAutoDowngrade(enabled) {
  try {
    const res = await fetch(API_BASE + '/adaptive/auto-downgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
  } catch (err) {
    showToast('Error: ' + err);
  }
}

async function setLearningMode(mode) {
  try {
    document.querySelectorAll('.learning-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const res = await fetch(API_BASE + '/adaptive/learning-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
  } catch (err) {
    showToast('Error: ' + err);
  }
}

function updateQuotaDisplay(provider) {
  const slider = document.getElementById(provider + '-quota-slider');
  const valueEl = document.getElementById(provider + '-quota-value');
  valueEl.textContent = slider.value + '%';
}

async function saveQuotaTargets() {
  try {
    const claudeValue = parseInt(document.getElementById('claude-quota-slider').value);
    const copilotValue = parseInt(document.getElementById('copilot-quota-slider').value);

    const res = await fetch(API_BASE + '/adaptive/quota-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claude_max_weekly_percent: claudeValue,
        copilot_monthly_percent: copilotValue,
      }),
    });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
  } catch (err) {
    showToast('Error: ' + err);
  }
}

// Analytics Functions
async function loadAnalytics(period) {
  try {
    const [summaryRes, sessionsRes, categoryRes, efficiencyRes] = await Promise.all([
      fetch(API_BASE + '/stats/summary?period=' + period).then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/sessions').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/by-category').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/efficiency').then(r => r.json()).catch(() => null),
    ]);

    // Period Summary
    if (summaryRes?.success && summaryRes.data) {
      const d = summaryRes.data;
      document.getElementById('period-cost').textContent = '$' + (d.totalCost || 0).toFixed(2);

      const changeEl = document.getElementById('period-change');
      if (d.previousCost !== undefined && d.previousCost > 0) {
        const pctChange = ((d.totalCost - d.previousCost) / d.previousCost * 100);
        const arrow = pctChange > 0 ? '↑' : pctChange < 0 ? '↓' : '→';
        changeEl.textContent = arrow + ' ' + Math.abs(pctChange).toFixed(0) + '% vs previous ' + period;
        changeEl.style.color = pctChange > 10 ? 'var(--error)' : pctChange < -10 ? 'var(--success)' : 'var(--text-secondary)';
      } else {
        changeEl.textContent = 'No previous data';
      }

      document.getElementById('period-daily-avg').textContent = 'Avg $' + (d.dailyAverage || 0).toFixed(2) + '/day';
    }

    // Sessions
    if (sessionsRes?.success && sessionsRes.data) {
      const s = sessionsRes.data;
      document.getElementById('session-count').textContent = s.totalSessions || '--';
      document.getElementById('session-avg-cost').textContent = 'Avg $' + (s.avgCostPerSession || 0).toFixed(2) + ' per session';
      document.getElementById('session-avg-duration').textContent = 'Avg ' + (s.avgDurationMinutes || 0).toFixed(0) + ' min duration';
    }

    // Category Breakdown
    if (categoryRes?.success && categoryRes.data?.categories) {
      const cats = categoryRes.data.categories;
      const container = document.getElementById('category-breakdown');
      if (cats.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary);">No category data</span>';
      } else {
        container.innerHTML = cats.slice(0, 6).map(c => {
          return '<span class="category-pill"><span class="cat-name">' + c.category + '</span><span class="cat-cost">$' + c.cost.toFixed(2) + '</span></span>';
        }).join('');
      }
    }

    // Model Efficiency
    if (efficiencyRes?.success && efficiencyRes.data?.byModel) {
      const models = efficiencyRes.data.byModel;
      const container = document.getElementById('model-efficiency');
      if (models.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary);">No efficiency data</span>';
      } else {
        container.innerHTML = models.slice(0, 6).map(m => {
          return '<div class="efficiency-card"><div class="model-name">' + (m.model || 'unknown') + '</div><div class="model-efficiency">' + formatNumber(m.tokensPer$1 || 0) + '</div></div>';
        }).join('');
      }
    }
  } catch (err) {
    console.error('Analytics load error:', err);
  }
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}
`
