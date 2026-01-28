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
