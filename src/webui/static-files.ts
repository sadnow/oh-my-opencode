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
