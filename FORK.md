# oh-im-broke

**A budget-focused fork of [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)**

## Why "oh-im-broke"?

A playful take on "oh-my-opencode" that reflects the fork's main philosophy: **vibe code without breaking the bank.**

This fork prioritizes cost-efficiency while maintaining the power of multi-model orchestration. Perfect for developers who want professional-grade AI coding assistance on a budget.

## Key Changes from Upstream

### 1. Deadlock Detection for Background Agents

Robust deadlock detection prevents stuck sessions from wasting tokens and blocking concurrency slots:

- **Stability-based completion**: Tasks complete after 3 consecutive polls show stable message count + idle session status
- **Deadlock detection**: When stability reached but session NOT idle, increment `stabilityResets` counter
- **Force-cancel protection**: After `maxStabilityResets` (default: 10, configurable):
  - Sets task status to `cancelled` with detailed error message
  - Releases concurrency slot (prevents resource leaks)
  - Aborts server-side session (stops token consumption)
  - Notifies parent session
- **Smart reset**: Counter resets when session becomes idle OR message count changes (activity detected)
- **Stale timeout**: 3-minute inactivity limit as additional safety (configurable via `staleTimeoutMs`)
- **Task TTL**: 30-minute absolute timeout prevents infinite hangs

**Configuration:**
```jsonc
{
  "background_task": {
    "maxStabilityResets": 10,        // How many stability cycles before force-cancel (default: 10)
    "staleTimeoutMs": 180000,         // Inactivity timeout in ms (default: 180000 = 3 min)
    "defaultConcurrency": 3,          // Concurrent tasks per provider (default: 3)
    "providerConcurrency": { ... },   // Per-provider overrides
    "modelConcurrency": { ... }       // Per-model overrides
  }
}
```

See `src/features/background-agent/manager.ts` for implementation details.

### 2. Budget Orchestration

Integrated cost management system (foundation for future cost-aware model selection):

- **UsageTracker**: Tracks token usage across all providers
- **BudgetOrchestrator**: Central cost management coordinator
- **Subscription tracking**: 
  - ClaudeMaxTracker: Monitors Claude Pro/Max usage
  - CopilotTracker: Monitors GitHub Copilot usage with live refresh
- **Ready for auto-downgrade**: Infrastructure prepared for automatic model downgrading when budget thresholds exceeded

**Configuration:**
```jsonc
{
  "budget": {
    "enabled": true,                   // Enable budget orchestration (default: false)
    // Future: budget limits, auto-downgrade rules, cost alerts
  },
  "usage_tracking": {
    "enabled": true,                   // Track token usage (default: true)
    "persist": true                    // Persist usage data (default: true)
  }
}
```

See `src/features/budget-orchestrator/` and `src/features/usage-tracker/` for details.

### 2.1 Budget-Aware Model Downgrading

**Automatic model downgrading when budget thresholds exceeded.**

When you use `delegate_task(category="...")`, the system now checks your budget status BEFORE launching the subagent. If budget limits are exceeded, it automatically downgrades to a cheaper model within the same provider.

**How it works:**
1. `delegate_task` resolves the model from category configuration
2. Queries `BudgetOrchestrator.getSmartTierChange(model)` for budget status
3. If downgrade recommended (budget threshold exceeded), switches to cheaper model
4. Shows toast notification: `"opus-4-5 → sonnet-4-5: Budget exceeded at 95%"`
5. Task continues seamlessly with the downgraded model

**Example scenario:**
- Category configured: `ultrabrain: { model: "anthropic/claude-opus-4-5" }`
- Budget status: Anthropic at 95% of monthly limit
- Result: Task automatically runs with `claude-sonnet-4-5` instead
- User sees: Toast notification explaining the downgrade

**Configuration:**
```jsonc
{
  "budget": {
    "enabled": true,                      // Enable budget orchestration (default: false)
    "auto_downgrade": true,               // Enable auto-downgrade (default: true)
    "tier_downgrade_threshold": 0.5,      // Headroom multiplier (default: 0.5)
    "min_tier": "budget"                  // Don't downgrade below this tier (default: "budget")
  }
}
```

**Downgrade tiers:**
- **premium** → reasoning → high → medium → budget
- **reasoning** → high → medium → budget  
- **high** → medium → budget
- **medium** → budget
- **budget** → (no further downgrade)

**When downgrade triggers:**
- Budget percentage ≥ threshold (e.g., 90%)
- Spending velocity predicts overspend (pace warning active)
- Manual tier lock not set (respects `--lock-tier` CLI flag)

**Features:**
- ✅ Transparent to caller - tasks continue without code changes
- ✅ User visibility via toast notifications
- ✅ Respects category configuration for model selection
- ✅ Per-provider budget tracking (anthropic, openai, google, etc.)
- ✅ Graceful fallback if budget check fails
- ✅ Logged for debugging: `[delegate_task] Budget downgrade triggered`

**Related tools:**
- **CLI**: `bunx oh-im-broke budget` - View budget status, manage tier locks
- **Cost alerts**: Already active via `budget-notification` hook (see section 2.0)
- **Usage dashboard**: WebUI at `/api/budget/dashboard` with real-time charts

**Implementation:**
- Integration point: `src/tools/delegate-task/tools.ts` (lines 585-641)
- Budget API: `src/features/budget-orchestrator/index.ts`
- Wiring: `src/index.ts` (line 353)

#### 2.1.1 Emergency Tier Downgrade (v3.1.7)

**Critical budget protection at 90%+ usage.**

The adaptive budget manager now includes an emergency override that forces minimum tier when budget usage exceeds 90%, regardless of other factors like accumulated credits or hourly allowance.

**Why this is needed:**
- Previous behavior: At 95% budget usage, adaptive manager could still recommend "standard" tier if headroom calculation showed 20+ affordable requests
- Problem: This led to continued high-cost usage even when budget was critically low
- Solution: Hard cutoff at 90% forces immediate downgrade to minimum tier

**How it works:**
1. Before normal tier selection, checks `currentUsed / totalBudget >= 0.90`
2. If true, immediately returns `config.minTier` (typically "budget")
3. Resets tier stability counter (prevents upgrade oscillation)
4. Logs emergency event with budget details

**Example:**
```
Budget: $100 (anthropic/weekly)
Current usage: $95 (95%)
Adaptive calculation: Headroom $3.50, can afford 23 requests at $0.15
Previous behavior: → Recommends "standard" tier ❌
New behavior: → Forces "budget" tier immediately ✅
```

**Test coverage:**
- ✅ 46/46 comprehensive budget tests passing
- ✅ Progressive consumption (10% → 99%)
- ✅ Multiple providers (anthropic, openai, google)
- ✅ Tier transitions (premium → standard → budget)
- ✅ Boundary conditions (69.9%, 70%, 70.1%, 0%, 100%)
- ✅ Realistic 30-day usage patterns

**Commit:** `2c3e537` - fix(budget): add emergency tier downgrade at 90% budget usage

### 3. Upstream Sync History

**Latest merge: v3.1.6 (2026-01-28)**
- Merged 102 commits from upstream oh-my-opencode
- Restored all fork-specific features post-merge
- Test improvements: +8 passing tests, -8 failing tests
- Commits:
  - `e6f089c`: Merge upstream/dev (v3.1.6)
  - `682aa43`: Restore fork features (deadlock detection, budget orchestration, usage tracking)

**Previous merges:**
- Initial fork from oh-my-opencode v3.1.5

## Installation

```bash
# Install from this fork
bunx oh-im-broke install

# Or add to existing OpenCode installation
cd ~/.config/opencode
bun add oh-im-broke
```

## Configuration

Same as upstream oh-my-opencode. See [README.md](README.md) for full configuration docs.

Config file locations:
- User: `~/.config/opencode/oh-im-broke.json`
- Project: `.opencode/oh-im-broke.json`

## Upstream Sync

This fork tracks upstream oh-my-opencode and incorporates updates regularly. If you want bleeding-edge features without stability testing, use the original project.

## Contributing

Bug reports and pull requests welcome! Please include:
- Clear reproduction steps
- Expected vs actual behavior
- Relevant logs (check `~/.tmp/oh-im-broke.log`)

## License

Same as upstream: [SUL-1.0](LICENSE.md)

## Attribution

Full credit to [@code-yeongyu](https://github.com/code-yeongyu) and the oh-my-opencode community for creating this incredible plugin. This fork exists to experiment with budget-focused features while staying compatible with the upstream project.
