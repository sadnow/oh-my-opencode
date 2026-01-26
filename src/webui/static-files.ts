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
      <h1>oh-my-opencode</h1>
      <nav>
        <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
        <a href="/budget-dashboard" class="tab-btn">Budget</a>
        <button class="tab-btn" data-tab="wizard">Wizard</button>
        <button class="tab-btn" data-tab="presets">Presets</button>
        <button class="tab-btn" data-tab="features">Features</button>
        <button class="tab-btn" data-tab="advanced">Advanced</button>
      </nav>
    </header>

    <main>
      <section id="dashboard" class="tab-content active">
        <h2>Dashboard</h2>
        <div class="grid">
          <div class="card">
            <h3>Budget Status</h3>
            <div id="budget-status">Loading...</div>
          </div>
          <div class="card">
            <h3>Usage Summary</h3>
            <div id="usage-summary">Loading...</div>
          </div>
          <div class="card">
            <h3>Current Preset</h3>
            <div id="current-preset">Loading...</div>
          </div>
          <div class="card">
            <h3>Recommended Tier</h3>
            <div id="recommended-tier">Loading...</div>
          </div>
        </div>
      </section>

      <section id="wizard" class="tab-content">
        <h2>Orchestration Wizard</h2>
        <div class="wizard-container">
          <div class="wizard-step" id="step-subscriptions">
            <h3>Step 1: Subscriptions</h3>
            <form id="subscriptions-form">
              <label>
                <input type="checkbox" name="hasAnthropicOAuth" checked>
                Anthropic OAuth (Claude Pro/Max)
              </label>
              <label>
                <input type="checkbox" name="hasChatGPT">
                ChatGPT Plus/Pro
              </label>
              <label>
                <input type="checkbox" name="hasGemini">
                Google Gemini
              </label>
              <label>
                <input type="checkbox" name="hasCopilot">
                GitHub Copilot
              </label>
              <label>
                <input type="checkbox" name="hasOpencodeZen">
                OpenCode Zen
              </label>
              <button type="button" onclick="nextWizardStep()">Next</button>
            </form>
          </div>

          <div class="wizard-step hidden" id="step-preset">
            <h3>Step 2: Choose Preset</h3>
            <div id="preset-options"></div>
            <button type="button" onclick="prevWizardStep()">Back</button>
            <button type="button" onclick="applyWizard()">Apply</button>
          </div>
        </div>
      </section>

      <section id="presets" class="tab-content">
        <h2>Orchestration Presets</h2>
        <div id="presets-list" class="presets-grid">Loading...</div>
      </section>

      <section id="features" class="tab-content">
        <h2>Features</h2>
        <div id="features-list">Loading...</div>
      </section>

      <section id="advanced" class="tab-content">
        <h2>Advanced Configuration</h2>
        <div class="advanced-editor">
          <textarea id="config-editor" rows="30"></textarea>
          <div class="button-group">
            <button onclick="loadConfig()">Reload</button>
            <button onclick="saveConfig()">Save</button>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <p>oh-my-opencode WebUI</p>
    </footer>
  </div>

  <div id="toast" class="toast hidden"></div>

  <script src="/app.js"></script>
</body>
</html>`

export const APP_JS = `// oh-my-opencode WebUI
const API_BASE = window.location.origin + '/api';

// State
let currentTab = 'dashboard';
let wizardStep = 0;
let wizardData = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboard();
  loadPresets();
  loadFeatures();
  loadConfig();
});

// Tab navigation
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
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

// Dashboard
async function loadDashboard() {
  try {
    const [budgetRes, usageRes, configRes, orchRes] = await Promise.all([
      fetch(API_BASE + '/budget').then(r => r.json()).catch(() => ({ success: false })),
      fetch(API_BASE + '/usage').then(r => r.json()).catch(() => ({ success: false })),
      fetch(API_BASE + '/config').then(r => r.json()),
      fetch(API_BASE + '/orchestration/status').then(r => r.json()).catch(() => ({ success: false })),
    ]);

    // Budget status
    const budgetEl = document.getElementById('budget-status');
    if (budgetRes.success && budgetRes.data.enabled) {
      const messages = Object.entries(budgetRes.data.statusMessages || {})
        .map(([k, v]) => '<div><strong>' + k + ':</strong> ' + v + '</div>')
        .join('');
      budgetEl.innerHTML = messages || 'No budget data';
    } else {
      budgetEl.innerHTML = '<em>Budget tracking disabled</em>';
    }

    // Usage summary
    const usageEl = document.getElementById('usage-summary');
    if (usageRes.success) {
      const total = usageRes.data.totalCost?.toFixed(2) || '0.00';
      usageEl.innerHTML = '<div>Total Cost: <strong>$' + total + '</strong></div>';
    } else {
      usageEl.innerHTML = '<em>Usage tracking disabled</em>';
    }

    // Current preset
    const presetEl = document.getElementById('current-preset');
    const preset = configRes.data?.orchestration_preset || 'custom';
    presetEl.innerHTML = '<div>Preset: <strong>' + preset + '</strong></div>';

    // Recommended tier
    const tierEl = document.getElementById('recommended-tier');
    if (orchRes.success && orchRes.data.currentTier) {
      tierEl.innerHTML = '<div>Tier: <strong>' + orchRes.data.currentTier + '</strong></div>';
    } else {
      tierEl.innerHTML = '<em>N/A</em>';
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

header h1 {
  color: var(--accent);
  margin-bottom: 15px;
}

nav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 5px;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: var(--bg-card);
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
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.card h3 {
  margin-bottom: 10px;
  color: var(--accent);
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.preset-card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.preset-card h3 {
  color: var(--accent);
  margin-bottom: 10px;
}

.preset-card p {
  color: var(--text-secondary);
  margin-bottom: 15px;
}

button {
  padding: 8px 16px;
  background: var(--accent);
  border: none;
  color: white;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
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
}

.feature-item p {
  color: var(--text-secondary);
  margin-top: 5px;
  margin-left: 25px;
}

.advanced-editor textarea {
  width: 100%;
  padding: 15px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', monospace;
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
  max-width: 600px;
}

.wizard-step {
  background: var(--bg-card);
  padding: 25px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.wizard-step h3 {
  margin-bottom: 20px;
}

.wizard-step label {
  display: block;
  margin-bottom: 10px;
}

.wizard-step button {
  margin-top: 20px;
  margin-right: 10px;
}

.hidden {
  display: none !important;
}

.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 25px;
  background: var(--bg-card);
  border: 1px solid var(--accent);
  border-radius: 8px;
  animation: slideIn 0.3s ease;
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
}

@media (max-width: 768px) {
  nav {
    flex-direction: column;
  }

  .tab-btn {
    width: 100%;
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
      <h1>Budget Dashboard</h1>
      <nav>
        <a href="/" class="tab-btn">Settings</a>
        <button class="tab-btn active">Budget Dashboard</button>
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
          <div class="global-summary" id="global-summary"></div>

          <div class="budget-grid" id="providers-grid"></div>

          <div class="chart-container">
            <h3>Spending Trends</h3>
            <canvas id="spending-chart" height="100"></canvas>
          </div>

          <div class="controls-section">
            <h3>Override Controls</h3>
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
    </main>

    <footer>
      <p>oh-my-opencode Budget Dashboard</p>
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
  loadDashboard();
  // Refresh every 60 seconds
  setInterval(loadDashboard, 60000);
});

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
  } catch (err) {
    console.error('Dashboard load error:', err);
    document.getElementById('loading').textContent = 'Error loading dashboard';
  }
}

function renderGlobalSummary(data) {
  const container = document.getElementById('global-summary');
  const tierClass = 'tier-' + data.globalTier;

  container.innerHTML = '<div class="global-tier">' +
    '<span>Recommended Tier:</span>' +
    '<span class="tier-badge ' + tierClass + '">' + data.globalTier + '</span>' +
    '</div>' +
    '<div>' +
    '<span style="color: var(--text-secondary);">Providers: </span>' +
    '<span style="font-weight: 600;">' + data.providers.length + '</span>' +
    '</div>';
}

function renderProviders(providers) {
  const container = document.getElementById('providers-grid');

  if (!providers.length) {
    container.innerHTML = '<div class="card"><p>No providers configured</p></div>';
    return;
  }

  container.innerHTML = providers.map(function(p) {
    const progressClass = p.percentage < 70 ? 'green' : p.percentage < 90 ? 'yellow' : 'red';
    const trendClass = 'trend-' + p.trend.replace('-', '');
    const trendIcon = { under: '↓', 'on-track': '→', over: '↑' }[p.trend] || '•';
    const tierClass = 'tier-' + p.recommendedTier;

    let adaptiveHtml = '';
    if (p.adaptive) {
      adaptiveHtml = '<div class="adaptive-section">' +
        '<h4>Adaptive Intelligence</h4>' +
        '<div class="metrics-grid">' +
        '<div class="metric-item">' +
        '<div class="metric-label">Accumulated Credits</div>' +
        '<div class="metric-value" style="color: #4caf50;">+$' + p.adaptive.accumulatedCredits.toFixed(2) + '</div>' +
        '</div>' +
        '<div class="metric-item">' +
        '<div class="metric-label">Budget Headroom</div>' +
        '<div class="metric-value">$' + p.adaptive.budgetHeadroom.toFixed(2) + '</div>' +
        '</div>' +
        '<div class="metric-item">' +
        '<div class="metric-label">Spending Velocity</div>' +
        '<div class="metric-value">$' + p.adaptive.spendingVelocity.toFixed(2) + '/hr</div>' +
        '</div>' +
        '<div class="metric-item">' +
        '<div class="metric-label">Learning Progress</div>' +
        '<div class="metric-value">' + (p.adaptive.learningProgress * 100).toFixed(0) + '%</div>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    return '<div class="budget-card">' +
      '<h3>' + p.provider.toUpperCase() +
      '<span class="tier-badge ' + tierClass + '">' + p.recommendedTier + '</span>' +
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
      '<div class="metrics-grid">' +
      '<div class="metric-item">' +
      '<div class="metric-label">Percentage Used</div>' +
      '<div class="metric-value">' + p.percentage.toFixed(1) + '%</div>' +
      '</div>' +
      '<div class="metric-item">' +
      '<div class="metric-label">Days Remaining</div>' +
      '<div class="metric-value">' + p.daysRemaining + '</div>' +
      '</div>' +
      '<div class="metric-item">' +
      '<div class="metric-label">Trend</div>' +
      '<div class="metric-value trend-indicator ' + trendClass + '">' + trendIcon + ' ' + p.trend.replace('-', ' ') + '</div>' +
      '</div>' +
      '<div class="metric-item">' +
      '<div class="metric-label">Period</div>' +
      '<div class="metric-value">' + p.daysElapsed + ' days</div>' +
      '</div>' +
      '</div>' +
      adaptiveHtml +
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
`
