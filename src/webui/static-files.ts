/**
 * Static Files
 * Embedded HTML, JS, and CSS for the WebUI
 */

export const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>oh-im-broke Settings</title>
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
        <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
        <button class="tab-btn" data-tab="presets">Presets</button>
        <button class="tab-btn" data-tab="features">Features</button>
        <button class="tab-btn" data-tab="advanced">Config</button>
        <button class="tab-btn" data-tab="docs">Docs</button>
      </nav>
    </header>

    <main>
      <section id="dashboard" class="tab-content active">
        <h2>Dashboard</h2>

        <!-- Hero Section: Large KPI Cards -->
        <div class="dashboard-hero">
          <div class="hero-card">
            <div class="label">
              Total Cost
              <span class="tooltip-trigger" data-tooltip="              Estimated API cost based on token usage tracked by oh-im-broke. Uses public pricing data. Real costs depend on your subscription plan (Claude Max, Copilot, etc.). Resets every Monday.">ⓘ</span>
            </div>
            <div class="value" id="hero-total-cost">$0.00</div>
            <div class="sub-value" id="hero-period-label">This Week</div>
            <div class="trend" id="hero-cost-trend">
              <span class="trend-neutral">--</span>
            </div>
          </div>
          <div class="hero-card">
            <div class="label">
              Claude Max
              <span class="tooltip-trigger" data-tooltip="Real-time usage percentage from Anthropic's API. Shows how much of your $50/week Claude Max allowance you've used. Resets every Thursday.">ⓘ</span>
            </div>
            <div class="value" id="hero-claude-percent">--%</div>
            <div class="sub-value" id="hero-claude-cost">$0/$50/week</div>
            <div class="trend" id="hero-claude-trend">
              <span class="trend-neutral">--</span>
            </div>
          </div>
          <div class="hero-card">
            <div class="label">
              GitHub Copilot
              <span class="tooltip-trigger" data-tooltip="Premium request usage from GitHub Copilot. Shows how many of your 1500 monthly premium requests you've used. Resets on the 1st of each month.">ⓘ</span>
            </div>
            <div class="value" id="hero-copilot-percent">--%</div>
            <div class="sub-value" id="hero-copilot-reqs">0/1500 reqs</div>
            <div class="trend" id="hero-copilot-trend">
              <span class="trend-neutral">--</span>
            </div>
          </div>
          <div class="hero-card">
            <div class="label">
              Current Tier
              <span class="tooltip-trigger" data-tooltip="Recommended model tier based on your budget system. Premium = best quality, Standard = balanced, Budget = cost-optimized, Economy = cheapest.">ⓘ</span>
            </div>
            <div class="value" id="hero-tier">--</div>
            <div class="sub-value">Recommended by budget system</div>
          </div>
        </div>

        <!-- Period Selector -->
        <div class="period-selector">
          <button class="period-btn active" data-period="24h" onclick="changePeriod('24h')">24 Hours</button>
          <button class="period-btn" data-period="week" onclick="changePeriod('week')">This Week</button>
          <button class="period-btn" data-period="month" onclick="changePeriod('month')">This Month</button>
        </div>

        <!-- Cost Trend Chart -->
        <div class="chart-section">
          <h3>
            Cost Trend
            <span class="tooltip-trigger" data-tooltip="API cost over time during the selected period. Shows spending patterns and helps identify usage spikes.">ⓘ</span>
          </h3>
          <div class="cost-chart" id="cost-trend-chart">
            <canvas id="trendCanvas"></canvas>
          </div>
        </div>

        <!-- Provider Breakdown -->
        <div class="provider-grid" id="provider-breakdown">
          <!-- Provider cards will be populated by JavaScript -->
        </div>

        <!-- Session Stats -->
        <div class="session-grid">
          <div class="session-card">
            <div class="session-value" id="session-count">--</div>
            <div class="session-label">
              Total Sessions
              <span class="tooltip-trigger" data-tooltip="Number of AI sessions during this period. Each session represents a conversation or task.">ⓘ</span>
            </div>
          </div>
          <div class="session-card">
            <div class="session-value" id="session-avg-cost">$0.00</div>
            <div class="session-label">
              Avg Cost/Session
              <span class="tooltip-trigger" data-tooltip="Average cost per session. Calculated by dividing total cost by number of sessions.">ⓘ</span>
            </div>
          </div>
          <div class="session-card">
            <div class="session-value" id="session-avg-duration">--</div>
            <div class="session-label">
              Avg Duration
              <span class="tooltip-trigger" data-tooltip="Average session duration in minutes. Helps understand task complexity.">ⓘ</span>
            </div>
          </div>
          <div class="session-card">
            <div class="session-value" id="session-daily-avg">$0.00</div>
            <div class="session-label">
              Daily Avg
              <span class="tooltip-trigger" data-tooltip="Average daily cost during this period. Calculated by dividing total cost by days in period.">ⓘ</span>
            </div>
          </div>
        </div>

        <!-- Category Efficiency -->
        <div class="category-section">
          <h3>
            Category Efficiency
            <span class="tooltip-trigger" data-tooltip="Cost breakdown by task category. Shows which types of tasks consume the most budget. Categories are configured in your orchestration preset.">ⓘ</span>
          </h3>
          <div class="category-list" id="category-list">
            <!-- Category items will be populated by JavaScript -->
          </div>
        </div>

        <!-- Footer Stats Bar -->
        <div class="footer-stats">
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-label">Claude Max:</span>
              <span class="stat-value" id="footer-claude-dph">$0.00/hr</span>
              <span class="tooltip-trigger" data-tooltip="Average cost per hour for Claude Max usage. Calculated from Anthropic API data.">ⓘ</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Copilot:</span>
              <span class="stat-value" id="footer-copilot-dph">$0.00/hr</span>
              <span class="tooltip-trigger" data-tooltip="Average cost per hour for Copilot usage. Based on premium request quota.">ⓘ</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Other:</span>
              <span class="stat-value" id="footer-other-dph">$0.00/hr</span>
              <span class="tooltip-trigger" data-tooltip="Average cost per hour for other providers (OpenAI, Google, etc.).">ⓘ</span>
            </div>
          </div>
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-label">Claude Max:</span>
              <span class="stat-value" id="footer-claude-pph">0%/hr</span>
              <span class="tooltip-trigger" data-tooltip="Percentage of Claude Max quota used per hour. Helps pace your usage.">ⓘ</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Copilot:</span>
              <span class="stat-value" id="footer-copilot-pph">0%/hr</span>
              <span class="tooltip-trigger" data-tooltip="Percentage of Copilot quota used per hour. Helps pace your usage.">ⓘ</span>
            </div>
          </div>
        </div>

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
                Google Gemini (Antigrav OAuth)
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
            <button class="docs-nav-btn" data-doc="presets">Presets Guide</button>
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
            <div id="doc-presets" class="doc-section">
              <h3>Orchestration Presets Guide</h3>
              <p style="color: var(--text-secondary); margin-bottom: 20px;">Presets configure which AI models handle different task types. Choose based on your budget, quality needs, and available API keys.</p>

              <div class="doc-block">
                <h4>default <span class="tier-badge tier-premium" style="font-size: 10px; margin-left: 8px;">RECOMMENDED</span></h4>
                <p><strong>Philosophy:</strong> Maintainer's recommended configuration. Maximize quality with intelligent cost optimization across multiple providers.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>claude-opus-4-5</code> for orchestration/synthesis - Best reasoning, worth the premium cost for critical decisions</li>
                    <li><code>gemini-3-flash-preview</code> for exploration/parallel work - Blazing fast, current gen, excellent for I/O-bound tasks</li>
                    <li><code>claude-sonnet-4-5</code> for UI/creative - Strong coding with good cost/quality balance</li>
                    <li><code>gpt-5.2</code> for writing - GPT excels at prose and documentation</li>
                    <li><code>kimi-k2-thinking</code> for analysis - Thinking model, great for deep reasoning at budget price</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Why NOT Other Models:</strong>
                  <ul style="margin-top: 8px;">
                    <li>o3 - Excellent but slower than Opus for orchestration; reserved for debugging</li>
                    <li>GLM-4.7 - Good but Gemini 3 Flash is faster for parallel work</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Most users. Leverages provider diversity for resilience and optimal cost/quality across tasks.</p>
              </div>

              <div class="doc-block">
                <h4>balanced</h4>
                <p><strong>Philosophy:</strong> Anthropic-focused. Claude for everything with tier-appropriate models.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>claude-opus-4-5</code> for ultrabrain - Premium reasoning for complex analysis</li>
                    <li><code>claude-sonnet-4-5</code> for implementation - Strong coding, balanced cost</li>
                    <li><code>claude-haiku-4-5</code> for quick tasks - Fast responses, low cost</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Why NOT Other Providers:</strong>
                  <ul style="margin-top: 8px;">
                    <li>Single-provider simplicity - easier quota management</li>
                    <li>Consistent response style across tasks</li>
                    <li>No cross-provider API key management needed</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Claude Max subscribers who want simplicity. Requires Anthropic API.</p>
              </div>

              <div class="doc-block">
                <h4>claude-heavy</h4>
                <p><strong>Philosophy:</strong> Maximum quality, all Claude, cost is secondary.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>claude-opus-4-5</code> for EVERYTHING except quick - Premium tier across the board</li>
                    <li><code>claude-sonnet-4-5</code> for quick tasks only - Still high quality for simple queries</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Cost Implications:</strong>
                  <ul style="margin-top: 8px;">
                    <li>~$20/1M tokens average (vs ~$9 for balanced)</li>
                    <li>Best quality output for critical work</li>
                    <li>Use when accuracy matters more than cost</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Production code review, security audits, critical architecture decisions.</p>
              </div>

              <div class="doc-block">
                <h4>budget-conscious</h4>
                <p><strong>Philosophy:</strong> Optimize cost-to-value ratio with budget-tier models that still deliver quality.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>kimi-k2-thinking</code> for reasoning - Thinking model at $0.60/$2.50, excellent for analysis</li>
                    <li><code>gemini-3-flash-preview</code> for speed tasks - $0.50/$3, blazing fast</li>
                    <li><code>glm-4.7</code> for coding/writing - $0.60/$2.20, strong at agentic tasks</li>
                    <li><code>gemini-2.5-flash-lite</code> for simple tasks - Ultra cheap economy tier</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Why NOT Premium Models:</strong>
                  <ul style="margin-top: 8px;">
                    <li>Budget models are 80%+ as good for most tasks</li>
                    <li>~$2.50/1M tokens vs ~$20 for premium (8x cheaper)</li>
                    <li>Kimi thinking model rivals premium for analysis</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Personal projects, learning, high-volume tasks where cost matters.</p>
              </div>

              <div class="doc-block">
                <h4>free-tier <span class="tier-badge tier-economy" style="font-size: 10px; margin-left: 8px;">NO API KEYS</span></h4>
                <p><strong>Philosophy:</strong> OpenCode models only - completely free, no API keys required.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>kimi-k2-thinking</code> for reasoning - Best free thinking model</li>
                    <li><code>glm-4.7</code> for implementation - Strong coding capability</li>
                    <li><code>glm-4.6</code> for quick/writing - Fast and capable</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Limitations:</strong>
                  <ul style="margin-top: 8px;">
                    <li>Rate limits may apply during peak usage</li>
                    <li>No premium model quality for complex tasks</li>
                    <li>Limited model variety</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Trying oh-my-opencode without API costs, students, hobby projects.</p>
              </div>

              <div class="doc-block">
                <h4>speed-optimized <span class="tier-badge tier-budget" style="font-size: 10px; margin-left: 8px;">FAST</span></h4>
                <p><strong>Philosophy:</strong> Fastest models for rapid iteration cycles. Minimize latency.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>gemini-3-flash-preview</code> for almost everything - Sub-second responses</li>
                    <li><code>gemini-2.5-flash-lite</code> for parallel workers - Maximum throughput</li>
                    <li><code>claude-sonnet-4-5</code> for ultrabrain only - Quality when truly needed</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Why Gemini Flash:</strong>
                  <ul style="margin-top: 8px;">
                    <li>~100-300ms response time vs ~1-3s for other models</li>
                    <li>Current generation (Gemini 3) with strong capabilities</li>
                    <li>Excellent for exploration and iteration</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Rapid prototyping, exploration, TDD cycles, impatient developers.</p>
              </div>

              <div class="doc-block">
                <h4>quality-first <span class="tier-badge tier-premium" style="font-size: 10px; margin-left: 8px;">PREMIUM</span></h4>
                <p><strong>Philosophy:</strong> Best models for highest quality, regardless of cost.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>claude-opus-4-5</code> for reasoning/UI/creative - Best overall quality</li>
                    <li><code>claude-sonnet-4-5</code> for quick tasks - Still premium-tier quality</li>
                    <li><code>gpt-5.2</code> for writing - GPT's prose is unmatched</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">When to Use:</strong>
                  <ul style="margin-top: 8px;">
                    <li>Production deployments</li>
                    <li>Client-facing work</li>
                    <li>Security-critical code</li>
                    <li>Complex architecture decisions</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Enterprise work, production code, when quality is non-negotiable.</p>
              </div>

              <div class="doc-block">
                <h4>parallel-agent-optimized</h4>
                <p><strong>Philosophy:</strong> Optimized for heavy parallel workloads. Fast workers, quality orchestration.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used:</strong>
                  <ul style="margin-top: 8px;">
                    <li><code>claude-sonnet-4-5</code> for orchestration - Quality decisions on task delegation</li>
                    <li><code>gemini-3-flash-preview</code> for workers/UI - Fast parallel execution</li>
                    <li><code>glm-4.7</code> for creative/writing - Cost-effective bulk work</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Orchestration Pattern:</strong>
                  <ul style="margin-top: 8px;">
                    <li>Main agent (Sonnet) plans and delegates</li>
                    <li>Background workers (Flash) execute in parallel</li>
                    <li>Results aggregated by main agent</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Large refactoring, multi-file changes, codebase-wide analysis.</p>
              </div>

              <div class="doc-block">
                <h4>hybrid-reasoning</h4>
                <p><strong>Philosophy:</strong> Multi-stage reasoning - cheap exploration, deep analysis, premium synthesis.</p>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Models Used (by stage):</strong>
                  <ul style="margin-top: 8px;">
                    <li><strong>Exploration:</strong> <code>gemini-3-flash-preview</code> - Fast breadth-first search</li>
                    <li><strong>Analysis:</strong> <code>kimi-k2-thinking</code> - Deep reasoning on candidates</li>
                    <li><strong>Synthesis:</strong> <code>claude-opus-4-5</code> - Premium final answer generation</li>
                  </ul>
                </div>
                <div style="margin: 12px 0;">
                  <strong style="color: var(--text-primary);">Why This Works:</strong>
                  <ul style="margin-top: 8px;">
                    <li>Exploration doesn't need premium - quantity over quality</li>
                    <li>Analysis benefits from thinking models - deliberate reasoning</li>
                    <li>Synthesis needs best quality - final answer matters most</li>
                  </ul>
                </div>
                <p style="font-size: 12px; color: var(--text-secondary);"><strong>Best for:</strong> Research tasks, debugging complex issues, architecture exploration.</p>
              </div>

              <div class="doc-block" style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-top: 24px;">
                <h4 style="margin-top: 0;">Model Tier Reference</h4>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid var(--border);">
                    <th style="text-align: left; padding: 8px 0;">Tier</th>
                    <th style="text-align: left; padding: 8px 0;">Cost (per 1M tokens)</th>
                    <th style="text-align: left; padding: 8px 0;">Example Models</th>
                  </tr>
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 8px 0;"><span class="tier-badge tier-premium">Premium</span></td>
                    <td style="padding: 8px 0;">$3-5 / $15-25</td>
                    <td style="padding: 8px 0;">Opus 4.5, o3, GPT-5.2-Codex</td>
                  </tr>
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 8px 0;"><span class="tier-badge tier-standard">Standard</span></td>
                    <td style="padding: 8px 0;">$1-3 / $5-15</td>
                    <td style="padding: 8px 0;">Sonnet 4.5, GPT-5.2, Gemini 3 Pro</td>
                  </tr>
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 8px 0;"><span class="tier-badge tier-budget">Budget</span></td>
                    <td style="padding: 8px 0;">$0.5-1 / $2-5</td>
                    <td style="padding: 8px 0;">Haiku 4.5, Gemini 3 Flash, GLM-4.7, Kimi K2</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><span class="tier-badge tier-economy">Economy</span></td>
                    <td style="padding: 8px 0;">$0.05-0.25 / $0.4-1</td>
                    <td style="padding: 8px 0;">GPT-4.1-nano, Qwen3, Gemini Flash Lite</td>
                  </tr>
                </table>
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
      <p>oh-im-broke WebUI &bull; <a href="https://github.com/sadnow/oh-im-broke" target="_blank">GitHub</a> &bull; Press <kbd>?</kbd> for shortcuts</p>
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

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <script src="/app.js"></script>
</body>
</html>`

export const APP_JS = `// oh-im-broke WebUI
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
  loadAnalytics('week'); // Load unified dashboard analytics
  loadPresets();
  loadFeatures();
  loadConfig();
  loadQuickStatus();
  // Refresh quick status every 60 seconds
  setInterval(loadQuickStatus, 60000);

  // Handle ?tab= query parameter from budget-dashboard links
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam && ['presets', 'features', 'advanced', 'docs'].includes(tabParam)) {
    switchTab(tabParam);
  }
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
    const [configRes, orchRes, budgetRes, summaryRes, claudeMaxRes, copilotRes] = await Promise.all([
      fetch(API_BASE + '/config').then(r => r.json()),
      fetch(API_BASE + '/orchestration/status').then(r => r.json()).catch(() => ({ success: false })),
      fetch(API_BASE + '/budget/dashboard').then(r => r.json()).catch(() => ({ success: false })),
      fetch(API_BASE + '/stats/summary?period=weekly').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/claude-max/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/copilot/usage').then(r => r.json()).catch(() => null),
    ]);

    // Analytics overview on homepage
    if (summaryRes?.success && summaryRes.data) {
      const d = summaryRes.data;
      const totalCost = d.current?.totalCost || 0;
      const costDisplay = totalCost < 0.01 && totalCost > 0 
        ? '$' + totalCost.toFixed(4) 
        : '$' + totalCost.toFixed(2);
      
      const costEl = document.getElementById('hero-total-cost');
      const trendEl = document.getElementById('hero-cost-trend');
      
      if (costEl) costEl.textContent = costDisplay;
      
      if (trendEl) {
        const previousCost = d.previous?.totalCost || 0;
        if (previousCost > 0) {
          const pctChange = ((totalCost - previousCost) / previousCost * 100);
          const arrow = pctChange > 0 ? '↑' : pctChange < 0 ? '↓' : '→';
          const trendClass = pctChange > 10 ? 'trend-up' : pctChange < -10 ? 'trend-down' : 'trend-neutral';
          trendEl.innerHTML = '<span class="' + trendClass + '">' + arrow + ' ' + Math.abs(pctChange).toFixed(0) + '% vs last week</span>';
        } else {
          trendEl.innerHTML = '<span class="trend-neutral">--</span>';
        }
      }
    }
    
    // Claude Max usage
    if (claudeMaxRes?.success && claudeMaxRes.data?.allModels) {
      const percent = claudeMaxRes.data.allModels.percentUsed || 0;
      const cost = (percent / 100) * 50; // $50/week
      const usageEl = document.getElementById('hero-claude-percent');
      const detailEl = document.getElementById('hero-claude-cost');
      
      if (usageEl) usageEl.textContent = percent.toFixed(0) + '%';
      if (detailEl) detailEl.textContent = '$' + cost.toFixed(2) + '/$50/week';
    }
    
    // Copilot usage
    if (copilotRes?.success && copilotRes.data) {
      const percent = copilotRes.data.percentUsed || 0;
      const usedReqs = copilotRes.data.usedRequests || 0;
      const totalReqs = copilotRes.data.totalRequests || 1500;
      const usageEl = document.getElementById('hero-copilot-percent');
      const detailEl = document.getElementById('hero-copilot-reqs');
      
      if (usageEl) {
        usageEl.textContent = percent.toFixed(0) + '%';
        usageEl.style.color = percent > 100 ? 'var(--error)' : percent > 75 ? 'var(--warning, #ffa500)' : '';
      }
      if (detailEl) detailEl.textContent = usedReqs + '/' + totalReqs + ' reqs';
    }

    // Current tier
    const tierEl = document.getElementById('hero-tier');
    if (orchRes?.success && orchRes.data?.currentTier) {
      tierEl.textContent = orchRes.data.currentTier.toUpperCase();
    } else {
      tierEl.textContent = '--';
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

// Analytics Functions
async function loadAnalytics(period) {
  try {
    const [summaryRes, sessionsRes, categoryRes, enhancedRes, claudeMaxRes, copilotRes] = await Promise.all([
      fetch(API_BASE + '/stats/summary?period=' + period).then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/sessions').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/by-category').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/enhanced?period=' + period).then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/claude-max/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/copilot/usage').then(r => r.json()).catch(() => null),
    ]);

    // Sessions
    if (sessionsRes?.success && sessionsRes.data) {
      const s = sessionsRes.data;
      const countEl = document.getElementById('session-count');
      const avgCostEl = document.getElementById('session-avg-cost');
      const avgDurEl = document.getElementById('session-avg-duration');
      const dailyAvgEl = document.getElementById('session-daily-avg');
      
      if (countEl) countEl.textContent = s.totalSessions || '--';
      if (avgCostEl) avgCostEl.textContent = '$' + (s.avgCostPerSession || 0).toFixed(2);
      if (avgDurEl) avgDurEl.textContent = (s.avgDurationMinutes || 0).toFixed(0) + ' min';
      
      if (dailyAvgEl && summaryRes?.success && summaryRes.data) {
        const avgDaily = summaryRes.data.avgDailySpend || 0;
        dailyAvgEl.textContent = '$' + avgDaily.toFixed(4);
      }
    }

    // Category Breakdown
    if (categoryRes?.success && categoryRes.data?.categories) {
      const cats = categoryRes.data.categories;
      const container = document.getElementById('category-list');
      if (container) {
        if (cats.length === 0) {
          container.innerHTML = '<span style="color: var(--text-secondary);">No API usage tracked yet.</span>';
        } else {
          container.innerHTML = cats.slice(0, 6).map(c => {
            const costDisplay = c.cost < 0.01 && c.cost > 0 
              ? '$' + c.cost.toFixed(4) 
              : '$' + c.cost.toFixed(2);
            return '<div class="category-item"><span class="cat-name">' + c.category + '</span><span class="cat-cost">' + costDisplay + '</span></div>';
          }).join('');
        }
      }
    }

    // Provider Breakdown
    if (enhancedRes?.success && enhancedRes.data?.byProviderSource) {
      const providerSources = enhancedRes.data.byProviderSource;
      const providersContainer = document.getElementById('provider-breakdown');
      
      const providersArray = Object.values(providerSources);
      
      if (providersContainer && providersArray.length > 0) {
        providersContainer.innerHTML = providersArray.map(p => {
          let displayName = p.providerSource || 'unknown';
          if (p.providerSource === 'github-copilot') {
            displayName = 'GitHub Copilot';
          } else if (p.providerSource === 'anthropic') {
            displayName = 'Claude Max (OAuth)';
          } else if (p.providerSource === 'openai') {
            displayName = 'OpenAI (Direct)';
          } else if (p.providerSource === 'google') {
            displayName = 'Google (Direct)';
          }
          
          const costDisplay = p.totalCost < 0.01 && p.totalCost > 0 
            ? '$' + p.totalCost.toFixed(4) 
            : '$' + p.totalCost.toFixed(2);
          
          return '<div class="provider-card"><div class="provider-name">' + displayName + '</div><div class="provider-cost">' + costDisplay + '</div></div>';
        }).join('');
      }
    }
    
    // Footer stats
    if (claudeMaxRes?.success && claudeMaxRes.data?.allModels) {
      const percent = claudeMaxRes.data.allModels.percentUsed || 0;
      const weeklyLimit = 50;
      const cost = (percent / 100) * weeklyLimit;
      
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mondayStart = new Date(now);
      mondayStart.setDate(now.getDate() - daysFromMonday);
      mondayStart.setHours(0, 0, 0, 0);
      const hoursElapsed = (now - mondayStart) / (1000 * 60 * 60);
      
      const dph = hoursElapsed > 0 ? cost / hoursElapsed : 0;
      const pph = hoursElapsed > 0 ? percent / hoursElapsed : 0;
      
      const dphEl = document.getElementById('footer-claude-dph');
      const pphEl = document.getElementById('footer-claude-pph');
      if (dphEl) dphEl.textContent = '$' + dph.toFixed(4) + '/hr';
      if (pphEl) pphEl.textContent = pph.toFixed(2) + '%/hr';
    }
    
    if (copilotRes?.success && copilotRes.data) {
      const percent = copilotRes.data.percentUsed || 0;
      const monthlyCost = 39;
      const cost = (percent / 100) * monthlyCost;
      
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const hoursElapsed = (now - monthStart) / (1000 * 60 * 60);
      
      const dph = hoursElapsed > 0 ? cost / hoursElapsed : 0;
      const pph = hoursElapsed > 0 ? percent / hoursElapsed : 0;
      
      const dphEl = document.getElementById('footer-copilot-dph');
      const pphEl = document.getElementById('footer-copilot-pph');
      if (dphEl) dphEl.textContent = '$' + dph.toFixed(4) + '/hr';
      if (pphEl) pphEl.textContent = pph.toFixed(2) + '%/hr';
    }
    
    if (summaryRes?.success && summaryRes.data) {
      const totalCost = summaryRes.data.current?.totalCost || 0;
      let otherCost = totalCost;
      if (claudeMaxRes?.success && claudeMaxRes.data?.allModels) {
        const claudeCost = (claudeMaxRes.data.allModels.percentUsed / 100) * 50;
        otherCost -= claudeCost;
      }
      if (copilotRes?.success && copilotRes.data) {
        const copilotCost = (copilotRes.data.percentUsed / 100) * 39;
        otherCost -= copilotCost;
      }
      
      let hoursElapsed = 24;
      if (period === 'week') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayStart = new Date(now);
        mondayStart.setDate(now.getDate() - daysFromMonday);
        mondayStart.setHours(0, 0, 0, 0);
        hoursElapsed = (now - mondayStart) / (1000 * 60 * 60);
      } else if (period === 'month') {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        hoursElapsed = (now - monthStart) / (1000 * 60 * 60);
      }
      
      const dph = hoursElapsed > 0 ? otherCost / hoursElapsed : 0;
      const dphEl = document.getElementById('footer-other-dph');
      if (dphEl) dphEl.textContent = '$' + dph.toFixed(4) + '/hr';
    }
    
    // Cost Trend - Combined Relative Costs
    // Render Chart.js time-series graph
    const canvas = document.getElementById('trendCanvas');
    if (canvas) {
      try {
        // Fetch time-series data for all providers
        const [claudeHistoryRes, copilotHistoryRes] = await Promise.all([
          fetch('/api/claude-max/history').then(r => r.json()),
          fetch('/api/copilot/history').then(r => r.json())
        ]);

        // Prepare datasets
        const datasets = [];
        let allTimestamps = new Set();

        // Claude Max dataset
        if (claudeHistoryRes?.success && claudeHistoryRes.data?.points) {
          const points = claudeHistoryRes.data.points;
          points.forEach(p => allTimestamps.add(p.timestamp));
          
          datasets.push({
            label: 'Claude Max (OAuth)',
            data: points.map(p => ({
              x: new Date(p.timestamp),
              y: p.allModelsPercent || 0
            })),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2
          });
        }

        // Copilot dataset
        if (copilotHistoryRes?.success && copilotHistoryRes.data?.points) {
          const points = copilotHistoryRes.data.points;
          points.forEach(p => allTimestamps.add(p.timestamp));
          
          datasets.push({
            label: 'GitHub Copilot',
            data: points.map(p => ({
              x: new Date(p.timestamp),
              y: p.percentUsed || 0
            })),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2
          });
        }

        // Direct API cost dataset (if we have trend data)
        if (summaryRes?.success && summaryRes.data?.current?.totalCost > 0) {
          // For now, show as flat line - can be enhanced with /api/stats/trends later
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const cost = summaryRes.data.current.totalCost;
          
          datasets.push({
            label: 'Direct API Usage',
            data: [
              { x: new Date(now - 7 * dayMs), y: cost },
              { x: new Date(now), y: cost }
            ],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2,
            borderDash: [5, 5]
          });
        }

        // Destroy existing chart if present
        if (window.costTrendChart) {
          window.costTrendChart.destroy();
        }

        // Create Chart.js instance
        const ctx = canvas.getContext('2d');
        window.costTrendChart = new Chart(ctx, {
          type: 'line',
          data: { datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              intersect: false
            },
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  color: '#e5e7eb',
                  font: { size: 12 },
                  usePointStyle: true,
                  padding: 15
                }
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                titleColor: '#f9fafb',
                bodyColor: '#e5e7eb',
                borderColor: '#374151',
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                  title: (items) => {
                    if (items.length > 0) {
                      const date = new Date(items[0].parsed.x);
                      return date.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    }
                    return '';
                  },
                  label: (context) => {
                    const label = context.dataset.label || '';
                    const value = context.parsed.y;
                    return label + ': ' + value.toFixed(1) + '%';
                  }
                }
              }
            },
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: period === '24h' ? 'hour' : period === 'week' ? 'day' : 'day',
                  displayFormats: {
                    hour: 'HH:mm',
                    day: 'MMM d'
                  }
                },
                grid: {
                  color: 'rgba(75, 85, 99, 0.3)',
                  drawBorder: false
                },
                ticks: {
                  color: '#9ca3af',
                  font: { size: 11 }
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(75, 85, 99, 0.3)',
                  drawBorder: false
                },
                ticks: {
                  color: '#9ca3af',
                  font: { size: 11 },
                  callback: (value) => value + '%'
                }
              }
            }
          }
        });

      } catch (err) {
        console.error('Chart rendering error:', err);
        const chartContainer = document.getElementById('cost-trend-chart');
        if (chartContainer) {
          chartContainer.innerHTML = '<div class="chart-placeholder">Failed to load chart data</div>';
        }
      }
    }
  } catch (err) {
    console.error('Analytics load error:', err);
  }
}

function changePeriod(period) {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  
  const periodLabel = document.getElementById('hero-period-label');
  if (periodLabel) {
    const labels = {
      '24h': '24 Hours',
      'week': 'This Week',
      'month': 'This Month'
    };
    periodLabel.textContent = labels[period] || 'This Week';
  }
  
  loadAnalytics(period);
}
`

export const STYLES_CSS = `/* oh-im-broke WebUI Styles */
:root {
  /* Enhanced Dark Mode Palette */
  --bg-primary: #0a0e1a;
  --bg-secondary: #111827;
  --bg-card: #1a1f2e;
  --bg-elevated: #242b3d;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent: #8b5cf6;
  --accent-hover: #a78bfa;
  --accent-glow: rgba(139, 92, 246, 0.15);
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --border: #334155;
  --border-light: #475569;
  
  /* Provider Colors */
  --provider-anthropic: #ff9d00;
  --provider-copilot: #238636;
  --provider-openai: #10a37f;
  --provider-google: #4285f4;
  --provider-opencode: #6366f1;
  
  /* Chart Colors */
  --chart-line-1: #8b5cf6;
  --chart-line-2: #06b6d4;
  --chart-line-3: #10b981;
  --chart-line-4: #f59e0b;
  
  /* Tooltip Colors */
  --bg-tooltip: #1e293b;
  --text-tooltip: #f1f5f9;
}

/* Tooltip Styles */
.tooltip-trigger {
  cursor: help;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-muted);
  color: var(--bg-primary);
  font-size: 10px;
  font-weight: 600;
  margin-left: 6px;
  position: relative;
  transition: all 0.2s;
}

.tooltip-trigger:hover {
  background: var(--accent);
  color: white;
}

.tooltip-trigger::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 16px;
  background: var(--bg-tooltip);
  color: var(--text-tooltip);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  width: max-content;
  max-width: 320px;
  white-space: normal;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  pointer-events: none;
  text-align: left;
}

.tooltip-trigger:hover::after {
  opacity: 1;
  visibility: visible;
}

/* Prevent tooltip overflow on right edge */
.tooltip-trigger.right-edge::after {
  left: auto;
  right: 0;
  transform: translateX(0);
}

/* Prevent tooltip overflow on left edge */
.tooltip-trigger.left-edge::after {
  left: 0;
  transform: translateX(0);
}

/* Unified Dashboard Styles */
.dashboard-hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.hero-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.hero-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 20px var(--accent-glow);
}

.hero-card .label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.hero-card .value {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  margin-bottom: 4px;
}

.hero-card .sub-value {
  font-size: 13px;
  color: var(--text-secondary);
}

.hero-card .trend {
  font-size: 12px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.trend-up { color: var(--success); }
.trend-down { color: var(--error); }
.trend-neutral { color: var(--text-secondary); }

/* Period Selector */
.period-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: var(--bg-secondary);
  padding: 4px;
  border-radius: 8px;
  width: fit-content;
}

.period-btn {
  padding: 8px 20px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.period-btn:hover {
  color: var(--text-primary);
}

.period-btn.active {
  background: var(--accent);
  color: white;
}

/* Cost Trend Chart */
.chart-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.chart-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}

.cost-chart {
  height: auto;
  min-height: 200px;
  position: relative;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 16px;
  overflow: hidden;
}

.cost-breakdown-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cost-bar-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cost-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.cost-bar-value {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.cost-bar-track {
  height: 24px;
  background: var(--bg-primary);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.cost-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 11px;
  color: white;
  font-weight: 600;
}

.cost-bar-total {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  text-align: right;
  font-size: 14px;
  color: var(--text-secondary);
}

.cost-bar-total strong {
  color: var(--accent);
  font-size: 16px;
}

.chart-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 150px;
  color: var(--text-secondary);
  font-size: 14px;
}

/* Provider Breakdown */
.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.provider-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.provider-card:hover {
  border-color: var(--border-light);
}

.provider-card .provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.provider-card .provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-card .provider-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.provider-card .usage-bar {
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.provider-card .usage-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.provider-card .usage-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Session Stats */
.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.session-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.session-card .session-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.session-card .session-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Category Efficiency */
.category-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.category-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-name {
  flex: 0 0 140px;
  font-size: 13px;
  color: var(--text-primary);
}

.category-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  overflow: hidden;
}

.category-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.category-value {
  flex: 0 0 80px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

/* Footer Stats Bar */
.footer-stats {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  z-index: 100;
}

.footer-stats .stat-group {
  display: flex;
  gap: 24px;
}

.footer-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-stats .stat-label {
  color: var(--text-secondary);
}

.footer-stats .stat-value {
  color: var(--text-primary);
  font-weight: 600;
}

/* Provider-specific colors */
.provider-anthropic { color: var(--provider-anthropic); }
.provider-copilot { color: var(--provider-copilot); }
.provider-openai { color: var(--provider-openai); }
.provider-google { color: var(--provider-google); }
.provider-opencode { color: var(--provider-opencode); }

/* Progress bar colors */
.progress-green { background: linear-gradient(90deg, var(--success), #34d399); }
.progress-yellow { background: linear-gradient(90deg, var(--warning), #fbbf24); }
.progress-red { background: linear-gradient(90deg, var(--error), #f87171); }
.progress-purple { background: linear-gradient(90deg, var(--accent), var(--accent-hover)); }
.progress-blue { background: linear-gradient(90deg, var(--chart-line-2), #22d3ee); }
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
        <a href="/?tab=presets" class="tab-btn">Presets</a>
        <a href="/?tab=features" class="tab-btn">Features</a>
        <a href="/?tab=advanced" class="tab-btn">Config</a>
        <a href="/?tab=docs" class="tab-btn">Docs</a>
      </nav>
    </header>

    <main>
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px 0;">Usage & Budget Dashboard</h2>
        <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">Monitor your AI subscription usage, manage quota targets, and control automatic tier switching. Real-time data from Claude Max and GitHub Copilot APIs.</p>
      </div>

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
                    <div id="claude-quota-warning" style="display: none; margin-top: 8px; padding: 8px; background: rgba(244, 67, 54, 0.15); border: 1px solid var(--error); border-radius: 4px; font-size: 12px; color: var(--error);"></div>
                  </div>
                  <div class="quota-target" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                    <label style="font-size: 13px; display: block; margin-bottom: 6px;">Copilot Monthly</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <input type="range" id="copilot-quota-slider" min="0" max="100" value="80" oninput="updateQuotaDisplay('copilot')">
                      <span id="copilot-quota-value" style="min-width: 40px;">80%</span>
                    </div>
                    <div id="copilot-quota-warning" style="display: none; margin-top: 8px; padding: 8px; background: rgba(244, 67, 54, 0.15); border: 1px solid var(--error); border-radius: 4px; font-size: 12px; color: var(--error);"></div>
                  </div>
                </div>
                <button onclick="saveQuotaTargets()" style="margin-top: 12px;">Save Quota Targets</button>

                <!-- Quota Warning Banner (shown when exceeding targets) -->
                <div id="quota-warning-banner" style="display: none; margin-top: 16px; padding: 16px; background: rgba(244, 67, 54, 0.1); border: 1px solid var(--error); border-radius: 8px;">
                  <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <span style="font-size: 20px;">⚠️</span>
                    <div>
                      <div style="font-weight: 600; color: var(--error); margin-bottom: 8px;">Usage Exceeds Quota Targets</div>
                      <div id="quota-warning-details" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;"></div>
                      <div style="font-size: 13px; color: var(--text-primary);">
                        <strong>Recommendations:</strong>
                        <ul id="quota-recommendations" style="margin: 8px 0 0 0; padding-left: 20px;"></ul>
                      </div>
                    </div>
                  </div>
                </div>
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
              <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">Model Efficiency (Tokens/$1)</h4>
                <div id="model-efficiency" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                  <span style="color: var(--text-secondary); font-size: 13px;">Loading...</span>
                </div>
              </div>

              <!-- Provider Sources -->
              <div>
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">Cost by Provider Source</h4>
                <div id="provider-sources-breakdown" style="display: flex; flex-direction: column; gap: 8px;">
                  <span style="color: var(--text-secondary); font-size: 13px;">Loading...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Global Overrides Section -->
          <div class="controls-section" style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h3 style="margin: 0;">🛡️ Global Overrides</h3>
              <button onclick="toggleGlobalOverrides()" id="global-overrides-toggle" style="padding: 6px 12px; font-size: 13px;">Show</button>
            </div>
            <div id="global-overrides-content" style="display: none;">
              <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                Global overrides bypass normal model selection. Use these to prevent accidentally exhausting credits or to restrict usage to cheaper models.
              </p>

              <!-- Emergency Mode Banner -->
              <div id="emergency-mode-banner" style="display: none; margin-bottom: 16px; padding: 16px; background: rgba(244, 67, 54, 0.15); border: 2px solid var(--error); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 24px;">🚨</span>
                  <div>
                    <div style="font-weight: 600; color: var(--error);">EMERGENCY MODE ACTIVE</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">Only economy-tier models are allowed. All premium/standard requests will fallback to cheaper alternatives.</div>
                  </div>
                  <button onclick="setEmergencyMode(false)" style="margin-left: auto; background: var(--error); color: white;">Disable</button>
                </div>
              </div>

              <!-- Provider Toggles -->
              <div style="margin-bottom: 20px;">
                <div style="font-weight: 600; margin-bottom: 12px;">Provider Control</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                  <div class="provider-toggle" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div>
                        <div style="font-weight: 500;">Anthropic (Claude)</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Claude Max / API</div>
                      </div>
                      <label class="toggle-switch">
                        <input type="checkbox" id="provider-anthropic-toggle" checked onchange="toggleProvider('anthropic', this.checked)">
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div class="provider-toggle" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div>
                        <div style="font-weight: 500;">OpenAI</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">GPT-4, GPT-5, o1</div>
                      </div>
                      <label class="toggle-switch">
                        <input type="checkbox" id="provider-openai-toggle" checked onchange="toggleProvider('openai', this.checked)">
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div class="provider-toggle" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div>
                        <div style="font-weight: 500;">Google</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Gemini models</div>
                      </div>
                      <label class="toggle-switch">
                        <input type="checkbox" id="provider-google-toggle" checked onchange="toggleProvider('google', this.checked)">
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div class="provider-toggle" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div>
                        <div style="font-weight: 500;">OpenCode</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Free fallback models</div>
                      </div>
                      <label class="toggle-switch">
                        <input type="checkbox" id="provider-opencode-toggle" checked disabled title="OpenCode is always enabled as ultimate fallback">
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Max Tier Cap -->
              <div style="margin-bottom: 20px;">
                <div style="font-weight: 600; margin-bottom: 12px;">Maximum Tier Cap</div>
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                  <select id="max-tier-select" onchange="setMaxTierCap(this.value)" style="padding: 8px 12px; min-width: 150px;">
                    <option value="">No limit (use all tiers)</option>
                    <option value="premium">Premium (all models)</option>
                    <option value="standard">Standard (no premium)</option>
                    <option value="budget">Budget (standard & below)</option>
                    <option value="economy">Economy only (cheapest)</option>
                  </select>
                  <span id="max-tier-status" style="font-size: 13px; color: var(--text-secondary);"></span>
                </div>
              </div>

              <!-- Emergency Mode Toggle -->
              <div style="margin-bottom: 20px;">
                <div style="font-weight: 600; margin-bottom: 12px;">Emergency Mode</div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <div style="font-weight: 500;">Economy Tier Only</div>
                      <div style="font-size: 12px; color: var(--text-secondary);">Restrict all requests to economy-tier models. Use when close to exhausting premium quotas.</div>
                    </div>
                    <button id="emergency-mode-btn" onclick="toggleEmergencyMode()" style="padding: 8px 16px;">Enable</button>
                  </div>
                </div>
              </div>

              <!-- Auto-Disable on Quota -->
              <div style="margin-bottom: 20px;">
                <div style="font-weight: 600; margin-bottom: 12px;">Auto-Disable on Quota</div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div>
                      <div style="font-weight: 500;">Automatically disable providers at quota threshold</div>
                      <div style="font-size: 12px; color: var(--text-secondary);">Prevents accidentally blowing through remaining credits</div>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" id="auto-disable-quota-toggle" onchange="setAutoDisableQuota(this.checked)">
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                  <div style="display: flex; gap: 12px; align-items: center;">
                    <label style="font-size: 13px;">Threshold:</label>
                    <input type="range" id="auto-disable-threshold" min="50" max="100" value="95" oninput="updateThresholdDisplay()" style="flex: 1;">
                    <span id="auto-disable-threshold-value" style="min-width: 45px; font-size: 13px;">95%</span>
                  </div>
                </div>
              </div>

              <!-- Current Status -->
              <div id="global-override-status" style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 12px;">Current Override Status</div>
                <div id="override-status-content" style="font-size: 13px; color: var(--text-secondary);">Loading...</div>
              </div>

              <!-- Clear All Button -->
              <div style="display: flex; gap: 12px;">
                <button onclick="clearGlobalOverrides()" style="background: var(--error); color: white;">Clear All Overrides</button>
                <button onclick="loadGlobalOverrideStatus()">Refresh Status</button>
              </div>
            </div>
          </div>

          <!-- Routing Logs Section -->
          <div class="budget-card" style="margin-top: 30px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h3 style="margin: 0;">🔁 Auto-Routing System Logs</h3>
              <div style="display: flex; gap: 8px;">
                <button onclick="refreshRoutingLogs()" style="padding: 6px 12px; font-size: 13px;">Refresh</button>
                <button onclick="clearRoutingLogs()" style="padding: 6px 12px; font-size: 13px;">Clear Logs</button>
              </div>
            </div>

            <!-- Filter Controls -->
            <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 6px;">
                Level:
                <select id="log-level-filter" onchange="filterRoutingLogs()" style="padding: 4px 8px;">
                  <option value="">All</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="decision">Decision</option>
                </select>
              </label>
              <label style="display: flex; align-items: center; gap: 6px;">
                Category:
                <select id="log-category-filter" onchange="filterRoutingLogs()" style="padding: 4px 8px;">
                  <option value="">All</option>
                  <option value="tier_change">Tier Change</option>
                  <option value="upgrade_scheduled">Upgrade Scheduled</option>
                  <option value="downgrade_scheduled">Downgrade Scheduled</option>
                  <option value="upgrade_executed">Upgrade Executed</option>
                  <option value="downgrade_executed">Downgrade Executed</option>
                  <option value="budget_alert">Budget Alert</option>
                  <option value="override">Override</option>
                  <option value="adaptive">Adaptive Learning</option>
                </select>
              </label>
              <label style="display: flex; align-items: center; gap: 6px;">
                Limit:
                <select id="log-limit" onchange="refreshRoutingLogs()" style="padding: 4px 8px;">
                  <option value="50">50</option>
                  <option value="100" selected>100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                </select>
              </label>
            </div>

            <!-- Log Stats -->
            <div id="routing-log-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
              <div>
                <div style="font-size: 11px; color: var(--text-secondary);">Total Logs</div>
                <div id="log-stat-total" style="font-size: 18px; font-weight: 600; color: var(--text-primary);">0</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-secondary);">Last 24h</div>
                <div id="log-stat-24h" style="font-size: 18px; font-weight: 600; color: var(--text-primary);">0</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-secondary);">Warnings</div>
                <div id="log-stat-warnings" style="font-size: 18px; font-weight: 600; color: var(--warning);">0</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-secondary);">Errors</div>
                <div id="log-stat-errors" style="font-size: 18px; font-weight: 600; color: var(--error);">0</div>
              </div>
            </div>

            <!-- Log Entries -->
            <div id="routing-logs-container" style="max-height: 500px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-secondary);">
              <div style="padding: 16px; text-align: center; color: var(--text-secondary);">Loading routing logs...</div>
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
  refreshRoutingLogs();
  // Refresh every 60 seconds
  setInterval(loadDashboard, 60000);
  setInterval(loadQuickStatus, 60000);
  setInterval(refreshRoutingLogs, 60000);
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
    let claudeTarget = 70;
    let copilotTarget = 80;
    if (data.quotaTargets) {
      if (data.quotaTargets.claude_max_weekly_percent !== undefined) {
        claudeTarget = data.quotaTargets.claude_max_weekly_percent;
        document.getElementById('claude-quota-slider').value = claudeTarget;
        document.getElementById('claude-quota-value').textContent = claudeTarget + '%';
      }
      if (data.quotaTargets.copilot_monthly_percent !== undefined) {
        copilotTarget = data.quotaTargets.copilot_monthly_percent;
        document.getElementById('copilot-quota-slider').value = copilotTarget;
        document.getElementById('copilot-quota-value').textContent = copilotTarget + '%';
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

    // Check quota warnings after loading settings
    checkQuotaWarnings(claudeTarget, copilotTarget);
  } catch (err) {
    console.error('Load adaptive settings error:', err);
  }
}

// Check if current usage exceeds quota targets and show warnings
async function checkQuotaWarnings(claudeTarget, copilotTarget) {
  try {
    const [claudeRes, copilotRes] = await Promise.all([
      fetch(API_BASE + '/claude-max/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/copilot/usage').then(r => r.json()).catch(() => null),
    ]);

    let warnings = [];
    let recommendations = [];

    // Check Claude Max usage vs target
    const claudeWarningEl = document.getElementById('claude-quota-warning');
    if (claudeRes?.success && claudeRes.data?.allModels) {
      const claudeUsage = claudeRes.data.allModels.percentUsed || 0;
      if (claudeUsage > claudeTarget) {
        const overBy = (claudeUsage - claudeTarget).toFixed(0);
        claudeWarningEl.innerHTML = '⚠️ <strong>Over target!</strong> Current usage: ' + claudeUsage.toFixed(0) + '% (target: ' + claudeTarget + '%, over by ' + overBy + '%)';
        claudeWarningEl.style.display = 'block';
        warnings.push('Claude Max weekly usage (' + claudeUsage.toFixed(0) + '%) exceeds your target (' + claudeTarget + '%)');

        if (claudeUsage >= 90) {
          recommendations.push('Consider switching to Sonnet-only mode to preserve Opus quota');
          recommendations.push('Enable auto-downgrade to automatically use cheaper models');
        } else if (claudeUsage >= 80) {
          recommendations.push('Reduce usage of premium models (Opus) for non-critical tasks');
          recommendations.push('Use the "budget-conscious" or "speed-optimized" preset temporarily');
        } else {
          recommendations.push('Monitor usage closely - you may hit the limit before reset');
        }
      } else {
        claudeWarningEl.style.display = 'none';
      }
    }

    // Check Copilot usage vs target
    const copilotWarningEl = document.getElementById('copilot-quota-warning');
    if (copilotRes?.success && copilotRes.data) {
      const copilotUsage = copilotRes.data.percentUsed || 0;
      if (copilotUsage > copilotTarget) {
        const overBy = (copilotUsage - copilotTarget).toFixed(0);
        copilotWarningEl.innerHTML = '⚠️ <strong>Over target!</strong> Current usage: ' + copilotUsage.toFixed(0) + '% (target: ' + copilotTarget + '%, over by ' + overBy + '%)';
        copilotWarningEl.style.display = 'block';
        warnings.push('Copilot monthly usage (' + copilotUsage.toFixed(0) + '%) exceeds your target (' + copilotTarget + '%)');

        const daysLeft = copilotRes.data.daysUntilReset || 0;
        if (copilotUsage >= 95) {
          recommendations.push('Premium requests nearly exhausted - switch to non-Copilot models');
          recommendations.push('Wait for monthly reset (' + daysLeft + ' days) or use free-tier models');
        } else if (copilotUsage >= 80) {
          recommendations.push('Reduce Copilot premium model usage (o1, Claude via Copilot)');
          recommendations.push('Prefer direct API access for remaining critical work');
        } else {
          recommendations.push('Pace your Copilot usage - ' + daysLeft + ' days until reset');
        }
      } else {
        copilotWarningEl.style.display = 'none';
      }
    }

    // Show/hide the main warning banner
    const bannerEl = document.getElementById('quota-warning-banner');
    const detailsEl = document.getElementById('quota-warning-details');
    const recsEl = document.getElementById('quota-recommendations');

    if (warnings.length > 0) {
      bannerEl.style.display = 'block';
      detailsEl.innerHTML = warnings.join('<br>');
      recsEl.innerHTML = recommendations.map(r => '<li>' + r + '</li>').join('');
    } else {
      bannerEl.style.display = 'none';
    }
  } catch (err) {
    console.error('Check quota warnings error:', err);
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

  // Re-check warnings with new target values
  const claudeTarget = parseInt(document.getElementById('claude-quota-slider').value);
  const copilotTarget = parseInt(document.getElementById('copilot-quota-slider').value);
  checkQuotaWarnings(claudeTarget, copilotTarget);
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
    const [summaryRes, sessionsRes, categoryRes, efficiencyRes, claudeMaxRes, copilotRes, enhancedRes] = await Promise.all([
      fetch(API_BASE + '/stats/summary?period=' + period).then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/sessions').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/by-category').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/efficiency').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/claude-max/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/copilot/usage').then(r => r.json()).catch(() => null),
      fetch(API_BASE + '/stats/enhanced?period=' + period).then(r => r.json()).catch(() => null),
    ]);

    // Sessions
    if (sessionsRes?.success && sessionsRes.data) {
      const s = sessionsRes.data;
      const countEl = document.getElementById('session-count');
      const avgCostEl = document.getElementById('session-avg-cost');
      const avgDurEl = document.getElementById('session-avg-duration');
      const dailyAvgEl = document.getElementById('session-daily-avg');
      
      if (countEl) countEl.textContent = s.totalSessions || '--';
      if (avgCostEl) avgCostEl.textContent = '$' + (s.avgCostPerSession || 0).toFixed(2);
      if (avgDurEl) avgDurEl.textContent = (s.avgDurationMinutes || 0).toFixed(0) + ' min';
      
      // Calculate daily average
      if (dailyAvgEl && summaryRes?.success && summaryRes.data) {
        const avgDaily = summaryRes.data.avgDailySpend || 0;
        dailyAvgEl.textContent = '$' + avgDaily.toFixed(4);
      }
    }

    // Category Breakdown - update to use 'category-list' instead of 'category-breakdown'
    if (categoryRes?.success && categoryRes.data?.categories) {
      const cats = categoryRes.data.categories;
      const container = document.getElementById('category-list');
      if (container) {
        if (cats.length === 0) {
          container.innerHTML = '<span style="color: var(--text-secondary);">No API usage tracked yet.</span>';
        } else {
          container.innerHTML = cats.slice(0, 6).map(c => {
            const costDisplay = c.cost < 0.01 && c.cost > 0 
              ? '$' + c.cost.toFixed(4) 
              : '$' + c.cost.toFixed(2);
            return '<div class="category-item"><span class="cat-name">' + c.category + '</span><span class="cat-cost">' + costDisplay + '</span></div>';
          }).join('');
        }
      }
    }

    // Provider Breakdown - update to use 'provider-breakdown' instead of 'provider-sources-breakdown'
    if (enhancedRes?.success && enhancedRes.data?.byProviderSource) {
      const providerSources = enhancedRes.data.byProviderSource;
      const providersContainer = document.getElementById('provider-breakdown');
      
      const providersArray = Object.values(providerSources);
      
      if (providersContainer && providersArray.length > 0) {
        providersContainer.innerHTML = providersArray.map(p => {
          let displayName = p.providerSource || 'unknown';
          if (p.providerSource === 'github-copilot') {
            displayName = 'GitHub Copilot';
          } else if (p.providerSource === 'anthropic') {
            displayName = 'Claude Max (OAuth)';
          } else if (p.providerSource === 'openai') {
            displayName = 'OpenAI (Direct)';
          } else if (p.providerSource === 'google') {
            displayName = 'Google (Direct)';
          }
          
          const costDisplay = p.totalCost < 0.01 && p.totalCost > 0 
            ? '$' + p.totalCost.toFixed(4) 
            : '$' + p.totalCost.toFixed(2);
          
          return '<div class="provider-card"><div class="provider-name">' + displayName + '</div><div class="provider-cost">' + costDisplay + '</div></div>';
        }).join('');
      }
    }
    
    // Footer stats - calculate $/hr and %/hr for each provider
    if (claudeMaxRes?.success && claudeMaxRes.data?.allModels) {
      const percent = claudeMaxRes.data.allModels.percentUsed || 0;
      const weeklyLimit = 50;
      const cost = (percent / 100) * weeklyLimit;
      
      // Calculate hours since week start (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mondayStart = new Date(now);
      mondayStart.setDate(now.getDate() - daysFromMonday);
      mondayStart.setHours(0, 0, 0, 0);
      const hoursElapsed = (now - mondayStart) / (1000 * 60 * 60);
      
      const dph = hoursElapsed > 0 ? cost / hoursElapsed : 0;
      const pph = hoursElapsed > 0 ? percent / hoursElapsed : 0;
      
      const dphEl = document.getElementById('footer-claude-dph');
      const pphEl = document.getElementById('footer-claude-pph');
      if (dphEl) dphEl.textContent = '$' + dph.toFixed(4) + '/hr';
      if (pphEl) pphEl.textContent = pph.toFixed(2) + '%/hr';
    }
    
    if (copilotRes?.success && copilotRes.data) {
      const percent = copilotRes.data.percentUsed || 0;
      const monthlyCost = 39;
      const cost = (percent / 100) * monthlyCost;
      
      // Calculate hours since month start
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const hoursElapsed = (now - monthStart) / (1000 * 60 * 60);
      
      const dph = hoursElapsed > 0 ? cost / hoursElapsed : 0;
      const pph = hoursElapsed > 0 ? percent / hoursElapsed : 0;
      
      const dphEl = document.getElementById('footer-copilot-dph');
      const pphEl = document.getElementById('footer-copilot-pph');
      if (dphEl) dphEl.textContent = '$' + dph.toFixed(4) + '/hr';
      if (pphEl) pphEl.textContent = pph.toFixed(2) + '%/hr';
    }
    
    // Other providers cost/hr
    if (summaryRes?.success && summaryRes.data) {
      const totalCost = summaryRes.data.current?.totalCost || 0;
      // Subtract Claude Max and Copilot costs to get "other"
      let otherCost = totalCost;
      if (claudeMaxRes?.success && claudeMaxRes.data?.allModels) {
        const claudeCost = (claudeMaxRes.data.allModels.percentUsed / 100) * 50;
        otherCost -= claudeCost;
      }
      if (copilotRes?.success && copilotRes.data) {
        const copilotCost = (copilotRes.data.percentUsed / 100) * 39;
        otherCost -= copilotCost;
      }
      
      // Calculate hours based on period
      let hoursElapsed = 24; // default to 24h
      if (period === 'week') {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayStart = new Date(now);
        mondayStart.setDate(now.getDate() - daysFromMonday);
        mondayStart.setHours(0, 0, 0, 0);
        hoursElapsed = (now - mondayStart) / (1000 * 60 * 60);
      } else if (period === 'month') {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        hoursElapsed = (now - monthStart) / (1000 * 60 * 60);
      }
      
      const dph = hoursElapsed > 0 ? otherCost / hoursElapsed : 0;
      const dphEl = document.getElementById('footer-other-dph');
      if (dphEl) dphEl.textContent = '$' + dph.toFixed(4) + '/hr';
    }
  } catch (err) {
    console.error('Analytics load error:', err);
  }
}

function changePeriod(period) {
  // Update active button
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  
  // Update period label
  const periodLabel = document.getElementById('hero-period-label');
  if (periodLabel) {
    const labels = {
      '24h': '24 Hours',
      'week': 'This Week',
      'month': 'This Month'
    };
    periodLabel.textContent = labels[period] || 'This Week';
  }
  
  // Reload analytics with new period
  loadAnalytics(period);
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

// Routing Logs Functions
let routingLogsCache = [];

async function refreshRoutingLogs() {
  try {
    const limit = document.getElementById('log-limit').value;
    const level = document.getElementById('log-level-filter').value;
    const category = document.getElementById('log-category-filter').value;

    let url = API_BASE + '/routing-logs?limit=' + limit;
    if (level) url += '&level=' + level;
    if (category) url += '&category=' + category;

    const res = await fetch(url);
    const { success, data } = await res.json();

    if (!success || !data.logs) {
      document.getElementById('routing-logs-container').innerHTML =
        '<div style="padding: 16px; text-align: center; color: var(--error);">Failed to load routing logs</div>';
      return;
    }

    routingLogsCache = data.logs;
    renderRoutingLogs(data.logs);

    // Load stats
    const statsRes = await fetch(API_BASE + '/routing-logs/stats');
    const statsData = await statsRes.json();
    if (statsData.success) {
      renderRoutingLogStats(statsData.data);
    }
  } catch (err) {
    console.error('Routing logs load error:', err);
    document.getElementById('routing-logs-container').innerHTML =
      '<div style="padding: 16px; text-align: center; color: var(--error);">Error: ' + err.message + '</div>';
  }
}

function renderRoutingLogs(logs) {
  const container = document.getElementById('routing-logs-container');

  if (logs.length === 0) {
    container.innerHTML =
      '<div style="padding: 16px; text-align: center; color: var(--text-secondary);">No routing logs yet. Logs will appear when models are scheduled for upgrades/downgrades.</div>';
    return;
  }

  const levelColors = {
    info: 'var(--text-primary)',
    warning: 'var(--warning)',
    error: 'var(--error)',
    decision: 'var(--accent)'
  };

  const categoryIcons = {
    tier_change: '🔄',
    upgrade_scheduled: '⬆️',
    downgrade_scheduled: '⬇️',
    upgrade_executed: '✅',
    downgrade_executed: '↘️',
    budget_alert: '⚠️',
    override: '🔐',
    adaptive: '🧠'
  };

  container.innerHTML = logs.map(function(log) {
    const icon = categoryIcons[log.category] || '•';
    const color = levelColors[log.level] || 'var(--text-primary)';
    const timestamp = new Date(log.timestamp).toLocaleString();

    return '<div style="padding: 12px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: flex-start;">' +
      '<span style="font-size: 18px; flex-shrink: 0;">' + icon + '</span>' +
      '<div style="flex: 1;">' +
        '<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">' +
          '<span style="font-size: 11px; color: var(--text-secondary);">' + timestamp + '</span>' +
          '<span style="font-size: 10px; padding: 2px 6px; background: var(--bg-card); border-radius: 4px; color: ' + color + '; text-transform: uppercase;">' + log.level + '</span>' +
          '<span style="font-size: 10px; padding: 2px 6px; background: var(--bg-card); border-radius: 4px; color: var(--text-secondary);">' + log.category.replace(/_/g, ' ') + '</span>' +
        '</div>' +
        '<div style="color: ' + color + '; font-size: 14px;">' + log.message + '</div>' +
        (log.metadata ? '<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">' + JSON.stringify(log.metadata) + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function renderRoutingLogStats(stats) {
  document.getElementById('log-stat-total').textContent = stats.total || 0;
  document.getElementById('log-stat-24h').textContent = stats.last24h || 0;
  document.getElementById('log-stat-warnings').textContent = stats.byLevel?.warning || 0;
  document.getElementById('log-stat-errors').textContent = stats.byLevel?.error || 0;
}

function filterRoutingLogs() {
  const level = document.getElementById('log-level-filter').value;
  const category = document.getElementById('log-category-filter').value;

  let filtered = routingLogsCache;
  if (level) {
    filtered = filtered.filter(function(log) { return log.level === level; });
  }
  if (category) {
    filtered = filtered.filter(function(log) { return log.category === category; });
  }

  renderRoutingLogs(filtered);
}

async function clearRoutingLogs() {
  if (!confirm('Clear all routing logs? This cannot be undone.')) return;

  try {
    const res = await fetch(API_BASE + '/routing-logs/clear', { method: 'POST' });
    const result = await res.json();
    showToast(result.success ? result.message : result.error);
    if (result.success) {
      refreshRoutingLogs();
    }
  } catch (err) {
    showToast('Error: ' + err);
  }
}

// ============================================================================
// Global Overrides Functions
// ============================================================================

let globalOverridesExpanded = false;

function toggleGlobalOverrides() {
  globalOverridesExpanded = !globalOverridesExpanded;
  document.getElementById('global-overrides-content').style.display = globalOverridesExpanded ? 'block' : 'none';
  document.getElementById('global-overrides-toggle').textContent = globalOverridesExpanded ? 'Hide' : 'Show';
  if (globalOverridesExpanded) {
    loadGlobalOverrideStatus();
  }
}

async function loadGlobalOverrideStatus() {
  try {
    const res = await fetch(API_BASE + '/global-override');
    const { success, data, error } = await res.json();

    if (!success) {
      document.getElementById('override-status-content').innerHTML = '<span style="color: var(--error);">' + (error || 'Failed to load') + '</span>';
      return;
    }

    // Update provider toggles
    const disabledProviders = data.disabledProviders || [];
    document.getElementById('provider-anthropic-toggle').checked = !disabledProviders.includes('anthropic');
    document.getElementById('provider-openai-toggle').checked = !disabledProviders.includes('openai');
    document.getElementById('provider-google-toggle').checked = !disabledProviders.includes('google');

    // Update max tier cap
    const maxTierSelect = document.getElementById('max-tier-select');
    maxTierSelect.value = data.maxTierCap || '';
    updateMaxTierStatus(data.maxTierCap);

    // Update emergency mode
    const emergencyBanner = document.getElementById('emergency-mode-banner');
    const emergencyBtn = document.getElementById('emergency-mode-btn');
    if (data.emergencyMode) {
      emergencyBanner.style.display = 'block';
      emergencyBtn.textContent = 'Disable';
      emergencyBtn.style.background = 'var(--error)';
    } else {
      emergencyBanner.style.display = 'none';
      emergencyBtn.textContent = 'Enable';
      emergencyBtn.style.background = '';
    }

    // Update auto-disable settings
    if (data.autoDisableOnQuota !== undefined) {
      document.getElementById('auto-disable-quota-toggle').checked = data.autoDisableOnQuota;
    }
    if (data.autoDisableThreshold !== undefined) {
      document.getElementById('auto-disable-threshold').value = data.autoDisableThreshold;
      document.getElementById('auto-disable-threshold-value').textContent = data.autoDisableThreshold + '%';
    }

    // Build status summary
    let statusHtml = '';
    if (disabledProviders.length > 0) {
      statusHtml += '<div style="margin-bottom: 8px;"><strong style="color: var(--warning);">⚠️ Disabled Providers:</strong> ' + disabledProviders.join(', ') + '</div>';
    }
    if (data.maxTierCap) {
      statusHtml += '<div style="margin-bottom: 8px;"><strong>Max Tier:</strong> ' + data.maxTierCap + '</div>';
    }
    if (data.emergencyMode) {
      statusHtml += '<div style="margin-bottom: 8px;"><strong style="color: var(--error);">🚨 Emergency Mode:</strong> ACTIVE (economy only)</div>';
    }
    if (data.autoDisableOnQuota) {
      statusHtml += '<div style="margin-bottom: 8px;"><strong>Auto-Disable:</strong> Enabled at ' + (data.autoDisableThreshold || 95) + '% threshold</div>';
    }

    if (!statusHtml) {
      statusHtml = '<span style="color: var(--success);">✓ No overrides active - normal operation</span>';
    }

    document.getElementById('override-status-content').innerHTML = statusHtml;
  } catch (err) {
    console.error('Load global override status error:', err);
    document.getElementById('override-status-content').innerHTML = '<span style="color: var(--error);">Error: ' + err.message + '</span>';
  }
}

async function toggleProvider(provider, enabled) {
  try {
    const endpoint = enabled ? '/global-override/provider/enable' : '/global-override/provider/disable';
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider })
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message);
      loadGlobalOverrideStatus();
    } else {
      showToast('Error: ' + result.error);
      // Revert toggle
      document.getElementById('provider-' + provider + '-toggle').checked = !enabled;
    }
  } catch (err) {
    showToast('Error: ' + err.message);
    document.getElementById('provider-' + provider + '-toggle').checked = !enabled;
  }
}

async function setMaxTierCap(tier) {
  try {
    const res = await fetch(API_BASE + '/global-override/max-tier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: tier || null })
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message);
      updateMaxTierStatus(tier);
      loadGlobalOverrideStatus();
    } else {
      showToast('Error: ' + result.error);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

function updateMaxTierStatus(tier) {
  const statusEl = document.getElementById('max-tier-status');
  if (tier) {
    const tierColors = {
      premium: 'var(--accent)',
      standard: '#3a86ff',
      budget: 'var(--warning)',
      economy: 'var(--text-secondary)'
    };
    statusEl.innerHTML = 'Capped at <strong style="color: ' + (tierColors[tier] || 'inherit') + ';">' + tier + '</strong>';
  } else {
    statusEl.textContent = '';
  }
}

function toggleEmergencyMode() {
  const btn = document.getElementById('emergency-mode-btn');
  const isEnabled = btn.textContent === 'Disable';
  setEmergencyMode(!isEnabled);
}

async function setEmergencyMode(enabled) {
  try {
    const res = await fetch(API_BASE + '/global-override/emergency-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message);
      loadGlobalOverrideStatus();
    } else {
      showToast('Error: ' + result.error);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function setAutoDisableQuota(enabled) {
  const threshold = parseInt(document.getElementById('auto-disable-threshold').value) || 95;
  try {
    const res = await fetch(API_BASE + '/global-override/auto-disable-quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, threshold })
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message);
      loadGlobalOverrideStatus();
    } else {
      showToast('Error: ' + result.error);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

function updateThresholdDisplay() {
  const value = document.getElementById('auto-disable-threshold').value;
  document.getElementById('auto-disable-threshold-value').textContent = value + '%';
}

async function clearGlobalOverrides() {
  if (!confirm('Clear all global overrides? This will re-enable all providers and remove all restrictions.')) return;

  try {
    const res = await fetch(API_BASE + '/global-override/clear', { method: 'POST' });
    const result = await res.json();

    if (result.success) {
      showToast(result.message);
      loadGlobalOverrideStatus();
    } else {
      showToast('Error: ' + result.error);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}
`
