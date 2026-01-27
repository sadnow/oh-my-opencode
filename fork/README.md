# Fork: sadnow/oh-my-opencode

This is a fork of [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) with stability fixes and enhanced features.

## What This Fork Adds

### Configuration Presets

Pre-configured model/agent presets optimized for different use cases and budgets.

**Available Presets:**

| Preset | Cost | Best For | Claude Usage |
|--------|------|----------|--------------|
| `balanced` | Moderate | Daily development, parallel agents | ~10% (oracle only) |
| `best` | High | Critical projects, production code | ~60% (heavy) |
| `free` | $0 | Learning, experimentation | 0% (Copilot + Antigravity only) |
| `maintainer-default` | High | Official recommended experience | ~50% |

**Switching Presets:**

```bash
# Linux/macOS/WSL
cd ~/.config/opencode/presets
./switch-preset.sh balanced

# Windows PowerShell
cd $env:USERPROFILE\.config\opencode\presets
.\switch-preset.ps1 balanced
```

Presets configure:
- **Categories**: Task domains with optimal model assignments (visual-engineering, artistry, writing, etc.)
- **Agents**: Specialized workers with tuned models (explore, debug, implement, oracle, sisyphus, etc.)
- **Background Concurrency**: Per-provider and per-model limits for parallel agents

See `~/.config/opencode/presets/README.md` for detailed documentation.

---

### Background Agent Deadlock Detection

**Problem**: When a background task reaches stability (3 polls with same message count) but the session status never becomes idle, the polling loop resets and continues indefinitely. This has been observed to iterate 18,000+ times, consuming resources and never completing.

**Solution**: Added `stabilityResets` counter that tracks consecutive stability resets. After `maxStabilityResets` (default: 10), the task is force-completed with a clear error.

```toml
# oh-my-opencode.toml
[background_task]
maxStabilityResets = 10  # Range: 1-100, default: 10
```

### Session Abort on Deadlock

When deadlock is detected, the session is now properly aborted with a `cancelled` status rather than just completing silently.

---

### Cross-Platform Binary Detection (WSL Fix)

**Problem**: Doctor checks and other binary lookups used hardcoded `which` command, which fails on Windows native (should use `where`).

**Solution**: Added `getBinaryLookupCommand()` in `src/shared/platform-detection.ts` that returns the correct command for each platform:
- Windows native: `where`
- Unix/Linux/WSL/macOS: `which`

Also added `isWSL()` and `getNativePlatform()` utilities for platform-specific behavior.

---

### Ralph Loop Verbosity Reduction

**Problem**: Continuation prompts repeated the full task on every iteration, wasting ~150 tokens per loop. Models also echoed iteration status unnecessarily.

**Solution**:
1. Condensed continuation prompt (no task re-injection)
2. Added explicit instruction to NOT mention iteration counts or time limits
3. Added `verbose_continuations` config option for legacy behavior if needed

```json
// oh-my-opencode.json
{
  "ralph_loop": {
    "enabled": true,
    "verbose_continuations": false  // Set true for old behavior
  }
}
```

---

### Deadlock Detection Enhancements

Added multiple layers of deadlock prevention:

1. **Completion Lock**: Prevents race conditions during task completion
   - `completionInProgress` flag guards against double-completion

2. **Absolute Maximum Runtime**: Tasks force-cancel after 25 minutes
   - Prevents runaway tasks that produce output but never complete

3. **Time-Based Escalation**: After 5 stability resets, threshold reduces to 60%
   - Speeds up deadlock detection for persistently stuck sessions

4. **Activity-Based Grace Period** (v1.x.x+): 30-second window for recent activity
   - If `task.progress.lastUpdate` is within 30s, stability resets are skipped
   - Prevents false deadlock detection for agents processing complex tasks
   - Agents in "busy" state with recent tool calls won't be terminated prematurely

**Recommended config for parallel agents:**

```json
{
  "background_task": {
    "staleTimeoutMs": 600000,
    "maxStabilityResets": 25
  }
}
```

With `maxStabilityResets: 25`, the escalated threshold becomes 15 (vs 6 with default 10), giving agents ~90-120 seconds of processing time instead of ~30-60 seconds.

---

### Ralph Loop Opt-In Config

Ralph loop now requires explicit opt-in (upstream only checks `disabled_hooks`):

```toml
# oh-my-opencode.toml
[ralph_loop]
enabled = true  # Required to enable ralph loop
```

---

### Budget-Aware Auto-Orchestration

**Problem**: Users with multiple AI subscriptions (Claude Max, OpenAI, Google, etc.) have no way to intelligently balance usage across providers based on spending and subscription limits.

**Solution**: Added adaptive budget orchestration with real-time usage tracking.

**Features:**
- **Budget Orchestrator**: Tracks spending per provider, recommends tier downgrades when limits approach
- **Adaptive Learning**: Learns spending patterns, accumulates credits during idle time
- **Model Tiers**: Premium → Standard → Budget → Economy with automatic fallback
- **CLI Dashboard**: `bunx oh-my-opencode budget` shows status and allows overrides
- **WebUI Dashboard**: Visual budget tracking at `http://localhost:3847/budget-dashboard`

```toml
# oh-my-opencode.toml
[budget]
enabled = true

[budget.anthropic]
period = "weekly"
limit = 20.0
reset_day = "sunday"

[budget.openai]
period = "monthly"
limit = 50.0
```

---

### Claude Max Real-Time Usage Tracking

**Problem**: Claude Max subscription usage (visible via `/usage` command) was not accessible programmatically for budget orchestration.

**Solution**: Discovered and integrated Anthropic's OAuth usage API endpoint.

**API Endpoint:**
```
GET https://api.anthropic.com/api/oauth/usage
Headers:
  Authorization: Bearer {oauth_token}
  anthropic-beta: oauth-2025-04-20
```

**Response:**
```json
{
  "five_hour": {"utilization": 30, "resets_at": "2026-01-26T22:59:59Z"},
  "seven_day": {"utilization": 77, "resets_at": "2026-01-30T05:59:59Z"},
  "seven_day_sonnet": {"utilization": 0, "resets_at": "2026-02-01T20:59:59Z"}
}
```

**Dashboard Shows:**
- Current session usage (5-hour window)
- Weekly all-models usage with exact reset date
- Weekly Sonnet-only usage with exact reset date
- Subscription tier (Pro, Max 5x, Max 20x) auto-detected from credentials

**IMPORTANT**: This uses the OAuth token from `~/.claude/.credentials.json` - the same token Claude Code uses for authentication. The usage data is real-time from Anthropic's servers.

---

### GitHub Copilot Real-Time Usage Tracking

**Problem**: GitHub Copilot Pro subscribers have premium request limits (1500/month) but no programmatic way to track usage for budget orchestration.

**Solution**: Discovered and integrated GitHub's internal Copilot API endpoint.

**API Endpoint:**
```
GET https://api.github.com/copilot_internal/user
Headers:
  Authorization: Bearer {gh_token}  # From `gh auth token`
  Accept: application/json
```

**Response:**
```json
{
  "copilot_plan": "individual_pro",
  "quota_reset_date_utc": "2026-02-01T00:00:00.000Z",
  "quota_snapshots": {
    "premium_interactions": {
      "percent_remaining": -0.64,  // Negative = over limit
      "entitlement": 1500,
      "remaining": -9
    }
  }
}
```

**Usage Calculation:**
- `percentUsed = 100 - percent_remaining` → `100 - (-0.64) = 100.64%`

**Features:**
- Live refresh every 60 seconds (configurable)
- 24-hour usage history with charting
- Plan detection (free/pro/business/enterprise)
- Premium request count tracking (used/limit)
- Recommendation system (normal/caution/reduce/critical)

**Copilot CLI Integration:**
The real Copilot CLI is installed by VS Code at `~/.copilot/pkg/`:
```bash
# Run Copilot CLI prompt
node ~/.copilot/pkg/win32-x64/0.0.394/index.js -p "your prompt" --allow-all-tools -s --model gpt-5
```

**IMPORTANT**:
- Uses `gh auth token` for authentication (must run `gh auth login` first)
- The `@githubnext/github-copilot-cli` npm package is DEPRECATED and calls dead API endpoints
- Use the VS Code-installed CLI at `~/.copilot/pkg/` instead

---

### Copilot Model Integration in Orchestration

**Problem**: GitHub Copilot Pro+ subscribers have access to multiple free models (GPT-4o, Claude 3.5 Sonnet, o1, etc.) but the orchestration system didn't leverage them for load distribution or as fallbacks.

**Solution**: Integrated Copilot models throughout the orchestration stack:

**USE_CASE_FALLBACKS (global-override.ts):**
Copilot models added to all use-case fallback lists with strategic positioning:

| Use Case | Copilot Position | Rationale |
|----------|------------------|-----------|
| `explorer` | High (2nd) | Speed + load distribution |
| `quick` | High (2nd) | Speed + load distribution |
| `parallel-worker` | **Primary** (1st) | Optimal for parallel tasks |
| `librarian` | Medium (3rd-4th) | Good tool use |
| `implementation` | Medium (3rd-5th) | Strong coding |
| `orchestrator` | Medium (4th-6th) | Good orchestration |
| `oracle` | Lower (4th+) | Quality reasoning first |
| `ultrabrain` | Lower (4th+) | Premium models prioritized |

**Presets Updated:**
All major presets now include `parallel-worker` category with Copilot models:

| Preset | parallel-worker Model | Benefit |
|--------|----------------------|---------|
| `default` | `github-copilot/gpt-4o-mini` | Free load distribution |
| `balanced` | `github-copilot/gpt-4o-mini` | Free load distribution |
| `budget-conscious` | `github-copilot/gpt-4o-mini` | Zero-cost parallel tasks |
| `speed-optimized` | `github-copilot/gpt-4o-mini` | Fast + free |
| `parallel-agent-optimized` | `github-copilot/gpt-4o-mini` | Maximum parallel throughput |
| `claude-heavy` | `github-copilot/claude-3.5-sonnet` | Quality + free |

**Available Copilot Models:**
```typescript
// Premium tier (included in Pro+ subscription)
"github-copilot/o1"              // Premium reasoning
"github-copilot/claude-3.5-sonnet" // Quality coding

// Standard tier
"github-copilot/gpt-4o"          // General purpose

// Budget tier
"github-copilot/gpt-4o-mini"     // Fast, optimal for parallel
"github-copilot/o1-mini"         // Budget reasoning
```

**Key Files Modified:**
- `src/features/budget-orchestrator/global-override.ts` - USE_CASE_FALLBACKS
- `src/cli/wizard/presets.ts` - All preset configurations

**Bug Fix:** Fixed shallow copy mutation in `GlobalOverrideManager` that caused state pollution between instances. The `disabledProviders` array was being shared due to JavaScript's shallow spread operator.

---

### WebUI Enhanced Dashboard

**New Features Added to Budget Dashboard:**

**Tier Management Section:**
- **Auto-Upgrade/Auto-Downgrade Toggles**: Control automatic tier switching with visual toggle switches
- **Learning Mode Selector**: Choose from Conservative (slow learning, high stability), Balanced (default), or Aggressive (fast learning)
- **Quota Target Sliders**: Set target usage percentages for Claude Max (weekly) and Copilot (monthly)
- **Stability Status Display**: Shows upgrade readiness per provider (e.g., "anthropic: 2 of 3 checks")

**Analytics Section:**
- **Period Summary**: Total cost, % change vs previous period, daily average with Weekly/Monthly selector
- **Sessions Card**: Session count, average cost per session, average duration
- **Cost by Category**: Visual breakdown of spending by task category (ultrabrain, quick, etc.)
- **Model Efficiency**: Tokens per dollar by model for cost optimization

**New API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stats/summary` | GET | Period totals with comparison |
| `/api/stats/by-category` | GET | Cost breakdown by category |
| `/api/stats/efficiency` | GET | Model cost/quality metrics |
| `/api/stats/trends/:provider` | GET | Provider-specific daily trends |
| `/api/stats/sessions` | GET | Session analytics |
| `/api/stats/all-providers` | GET | All provider trends |
| `/api/adaptive/settings` | GET/POST | Full adaptive configuration |
| `/api/adaptive/learning-mode` | POST | Quick learning mode switch |
| `/api/adaptive/auto-upgrade` | POST | Toggle auto-upgrade |
| `/api/adaptive/auto-downgrade` | POST | Toggle auto-downgrade |
| `/api/adaptive/quota-targets` | POST | Update quota targets |
| `/api/adaptive/reset-learning` | POST | Reset adaptive learning |
| `/api/adaptive/config-labels` | GET | UI-friendly labels with tooltips |
| `/api/learning-modes` | GET | Available learning mode presets |

**New Orchestration Presets:**

| Preset | Description | Best For |
|--------|-------------|----------|
| `parallel-agent-optimized` | Sonnet orchestration + Gemini Flash workers | Launching many parallel agents |
| `hybrid-reasoning` | Cheap exploration + premium synthesis | Multi-stage reasoning tasks |

**New Task Categories:**
- `parallel-worker`: Background agents and subagents (Gemini Flash)
- `exploration`: Breadth-first search, hypothesis generation (Gemini Flash)
- `analysis`: Deep analysis before conclusions (Kimi K2 Thinking)
- `synthesis`: Final answer synthesis (Claude Opus)

---

## Syncing with Upstream

```bash
git fetch upstream
git merge upstream/dev
```

---

## Changelog (Fork vs Upstream)

This section tracks all changes made in this fork for anti-regression purposes.

### Files Added

| File | Purpose | Tests |
|------|---------|-------|
| `src/shared/platform-detection.ts` | Cross-platform binary detection | `src/shared/platform-detection.test.ts` |
| `src/features/budget-orchestrator/` | Budget tracking and tier orchestration | `src/features/budget-orchestrator/index.test.ts` |
| `src/features/claude-max-usage/` | Claude Max real-time usage from Anthropic API | `src/features/claude-max-usage/index.test.ts` |
| `src/features/copilot-usage/` | GitHub Copilot real-time usage from GitHub API | `src/features/copilot-usage/index.test.ts` |
| `src/features/usage-tracker/` | Per-provider usage tracking with persistence | `src/features/usage-tracker/index.test.ts` |
| `src/features/hot-config/` | Hot-reload config with pending changes | `src/features/hot-config/index.test.ts` |
| `src/webui/` | WebUI server and budget dashboard | `src/webui/server.test.ts` |
| `src/cli/budget/` | CLI budget command | `src/cli/budget/index.test.ts` |
| `src/hooks/budget-notification/` | In-session budget toast notifications | N/A |
| `src/webui/routes/stats.ts` | Stats API endpoints for analytics dashboard | N/A |
| `src/webui/routes/adaptive-settings.ts` | Adaptive budget settings API endpoints | N/A |
| `src/shared/test-utils.ts` | Test utilities including `createMockToolContext()` | N/A |
| `src/features/budget-orchestrator/global-override.test.ts` | Tests for global override system + copilot integration | `bun test global-override.test.ts` |

### Files Modified

| File | Change | Anti-Regression Test |
|------|--------|---------------------|
| `src/cli/doctor/checks/dependencies.ts` | Use `getBinaryLookupCommand()` instead of `"which"` | `src/shared/platform-detection.test.ts` |
| `src/cli/doctor/checks/gh.ts` | Use `getBinaryLookupCommand()` instead of `"which"` | `src/cli/doctor/checks/gh.test.ts` |
| `src/hooks/ralph-loop/index.ts` | Condensed continuation prompt, no task re-injection | `src/hooks/ralph-loop/index.test.ts` |
| `src/features/builtin-commands/templates/ralph-loop.ts` | Added "DO NOT mention iteration" instruction | `src/hooks/ralph-loop/index.test.ts` |
| `src/config/schema.ts` | Added `verbose_continuations` option | `src/config/schema.test.ts` |
| `src/features/background-agent/manager.ts` | Deadlock detection: `stabilityResets`, completion lock, max runtime, activity grace period | `src/features/background-agent/manager.test.ts` |
| `src/features/background-agent/types.ts` | Added `completionInProgress`, `stabilityResets` fields | N/A (type definitions) |
| `src/shared/index.ts` | Export platform-detection utilities | N/A (re-exports) |
| `src/config/schema.ts` | Added LearningModeSchema, AdaptiveConfigSchema, QuotaTargetsSchema; Extended BudgetConfigSchema | N/A |
| `src/cli/wizard/presets.ts` | Added parallel-agent-optimized and hybrid-reasoning presets with badges | N/A |
| `src/cli/wizard/questions.ts` | Extended WizardAnswers with quota targets and learning mode | N/A |
| `src/cli/wizard/generator.ts` | Added LEARNING_MODE_PRESETS, generateAdaptiveConfig(), generateQuotaTargets() | N/A |
| `src/features/budget-orchestrator/index.ts` | Added runtime config methods: setAutoUpgrade, setLearningMode, setQuotaTargets, etc. | `src/features/budget-orchestrator/index.test.ts` |
| `src/features/budget-orchestrator/adaptive-budget.ts` | Added updateConfig(), getStabilityStatus() methods | N/A |
| `src/features/usage-tracker/tracker.ts` | Added analytics methods: getWeeklySummary, getByCategory, getEfficiency, etc. | N/A |
| `src/webui/server.ts` | Registered stats and adaptive settings routes | N/A |
| `src/webui/routes/wizard.ts` | Added handleGetLearningModes, PRESET_BADGES in responses | N/A |
| `src/webui/static-files.ts` | Added Tier Management and Analytics UI sections with interactive controls | N/A |
| `src/features/budget-orchestrator/global-override.ts` | Added copilot models to USE_CASE_FALLBACKS, fixed shallow copy mutation bug | `global-override.test.ts` |
| `src/cli/wizard/presets.ts` | Added `parallel-worker` category with copilot models to all presets | N/A |
| `src/tools/session-manager/tools.test.ts` | Updated to use `createMockToolContext()` | N/A |
| `src/tools/skill-mcp/tools.test.ts` | Updated to use `createMockToolContext()` | N/A |
| `src/tools/skill/tools.test.ts` | Updated to use `createMockToolContext()` | N/A |
| `src/webui/integration.test.ts` | Added `ApiResponse` type for proper typing | N/A |

### Configuration Additions

| Config Key | File | Default | Purpose |
|------------|------|---------|---------|
| `background_task.maxStabilityResets` | `schema.ts` | 10 | Max stability resets before force-cancel |
| `ralph_loop.enabled` | `schema.ts` | false | Explicit opt-in required |
| `ralph_loop.verbose_continuations` | `schema.ts` | false | Use full prompt in continuations |
| `budget.enabled` | `schema.ts` | false | Enable budget tracking |
| `budget.<provider>.period` | `schema.ts` | "monthly" | Budget period: daily/weekly/monthly |
| `budget.<provider>.limit` | `schema.ts` | N/A | Spending limit in USD |
| `budget.<provider>.reset_day` | `schema.ts` | N/A | Reset day for weekly budgets |
| `usage_tracking.enabled` | `schema.ts` | true | Enable usage tracking |
| `usage_tracking.persist` | `schema.ts` | true | Persist usage to disk |
| `webui.enabled` | `schema.ts` | true | Enable WebUI server |
| `webui.port` | `schema.ts` | 3847 | WebUI server port |
| `webui.bind` | `schema.ts` | "localhost" | WebUI bind address |
| `budget.auto_upgrade` | `schema.ts` | true | Auto-upgrade to premium when budget allows |
| `budget.learning_mode` | `schema.ts` | "balanced" | Learning preset: conservative, balanced, aggressive |
| `budget.adaptive_config.velocity_alpha` | `schema.ts` | 0.2 | Learning speed (0.05-0.5) |
| `budget.adaptive_config.min_samples_for_prediction` | `schema.ts` | 10 | Min samples before predictions (3-50) |
| `budget.adaptive_config.stability_checks_before_upgrade` | `schema.ts` | 3 | Stable checks required for upgrade (1-10) |
| `budget.adaptive_config.tier_upgrade_threshold` | `schema.ts` | 1.5 | Headroom multiplier for upgrades (1.0-3.0) |
| `budget.adaptive_config.tier_downgrade_threshold` | `schema.ts` | 0.5 | Headroom threshold for downgrades (0.2-1.0) |
| `budget.quota_targets.claude_max_weekly_percent` | `schema.ts` | 70 | Claude Max weekly usage target (0-100%) |
| `budget.quota_targets.copilot_monthly_percent` | `schema.ts` | 80 | Copilot monthly usage target (0-100%) |
| `budget.quota_targets.zen_monthly_dollars` | `schema.ts` | N/A | Zen/API monthly dollar target |

---

## Running Anti-Regression Tests

```bash
# Run all tests
bun test

# Run fork-specific tests
bun test src/shared/platform-detection.test.ts
bun test src/hooks/ralph-loop/index.test.ts
bun test src/features/background-agent/manager.test.ts

# Type check
bun run typecheck
```

### Key Test Cases to Verify

1. **Platform Detection** (`platform-detection.test.ts`)
   - `getBinaryLookupCommand()` returns `"where"` on Windows, `"which"` elsewhere
   - `isWSL()` correctly detects WSL environment
   - `getNativePlatform()` distinguishes WSL from native Linux

2. **Ralph Loop Verbosity** (`ralph-loop/index.test.ts`)
   - Condensed continuation prompt does NOT include original task
   - `verbose_continuations: true` DOES include original task
   - Continuation includes "DO NOT mention iteration" instruction

3. **Deadlock Detection** (`background-agent/manager.test.ts`)
   - `stabilityResets` increments on each stability reset
   - Task force-cancels after `maxStabilityResets`
   - `completionInProgress` prevents double-completion
   - Tasks force-cancel after 25 minutes max runtime
   - Activity grace period skips stability resets if `lastUpdate` is within 30s

4. **Budget Orchestration** (`budget-orchestrator/index.test.ts`)
   - Tier recommendations based on spending percentage
   - Adaptive credits accumulate during idle time
   - Smart tier changes respect stability requirements
   - Override system (force tier, lock tier) works correctly

5. **Claude Max Usage** (`claude-max-usage/index.test.ts`)
   - API endpoint returns valid usage data structure
   - Tier detection from credentials works correctly
   - Recommendation logic: normal < 50%, caution 50-70%, reduce 70-90%, critical > 90%
   - OAuth token is read from `~/.claude/.credentials.json`
   - **CRITICAL**: Must use `https://api.anthropic.com/api/oauth/usage` endpoint
   - **CRITICAL**: Must include `anthropic-beta: oauth-2025-04-20` header

6. **Copilot Usage** (`copilot-usage/index.test.ts`)
   - API endpoint returns valid usage data structure
   - Token acquired via `gh auth token` (execSync)
   - Usage calculation: `percentUsed = 100 - percent_remaining`
   - Handles negative percent_remaining (over limit)
   - Premium request tracking from `quota_snapshots.premium_interactions`
   - Reset date from `quota_reset_date_utc`
   - Live refresh polling (60 seconds default)
   - **CRITICAL**: Must use `https://api.github.com/copilot_internal/user` endpoint
   - **CRITICAL**: Must use Bearer token auth from `gh auth token`

7. **WebUI Server** (`webui/server.test.ts`)
   - Static files served correctly (index.html, budget-dashboard.html)
   - API routes respond with correct JSON structure
   - CORS headers present on all responses

---

## Syncing with Upstream

```bash
git fetch upstream
git merge upstream/dev
# Resolve conflicts, prioritizing fork changes for files listed above
bun test  # Verify anti-regression tests pass
```

## Contributing Back

These fixes should be contributed upstream via PR:
- [ ] Platform detection utilities (PR ready)
- [ ] Ralph loop verbosity reduction (PR ready)
- [ ] Deadlock detection enhancements (PR ready)
- [ ] Configuration presets (documentation only)
