# Claude Code Guidelines for oh-my-opencode (Fork)

This document provides critical guidance for AI models working on this codebase.
**Keep this file < 200 lines.** For detailed API docs, see @docs/claude-max-api.md and @docs/copilot-api.md.

## Project Overview

oh-my-opencode is a Claude Code plugin that adds:
- Multi-provider orchestration (Claude, OpenAI, Google, Copilot, etc.)
- Budget tracking and adaptive tier management
- Real-time Claude Max and GitHub Copilot usage tracking
- WebUI dashboard for configuration and monitoring
- Agent-aware deadlock detection for background tasks

**Fork**: https://github.com/sadnow/oh-my-opencode

## Background Task Deadlock Detection

**Context:** Background agents (explore, librarian) legitimately spend 2-5 minutes reading/analyzing large codebases.

**Solution:** Agent-aware timeout thresholds
- **Exploration agents** (explore, librarian): 50 stability resets (~12.5 min) by default
- **Other agents**: 10 stability resets (~2.5 min) by default

**Configuration:**
```json
{
  "background_task": {
    "maxStabilityResets": 10,              // Default for most agents
    "explorationMaxStabilityResets": 50    // For explore/librarian agents
  }
}
```

## Fork Constraints (CRITICAL)

| Constraint | Rule |
|------------|------|
| Push target | `origin` (sadnow/oh-my-opencode) only, **NEVER** upstream |
| GitHub issues | Create on `sadnow/oh-my-opencode` (our fork), **NEVER** on `code-yeongyu/oh-my-opencode` (upstream = spam) |
| Test files | Fix code, not tests - **NEVER** delete/modify tests to pass builds |
| Ultimate fallback | `opencode/big-pickle` - always keep last in fallback lists |
| Free provider | `opencode` provider always available (no API key required) |
| Copilot auth | `github-copilot` models require Copilot Pro+ subscription |
| Model priority | Quality > Cost > Parallel Load for placement decisions |
| State mutation | Deep copy arrays in DEFAULT_GLOBAL_OVERRIDE_STATE (mutation bug) |

## Git Workflow

- **Commit frequently**: One logical change per commit (atomic)
- **Push regularly**: Keep origin/dev up to date
- **Never commit secrets**: .env, credentials.json, API keys
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- **Verify before push**: `bun run typecheck && bun test`

## Anti-Regression Rules

### NEVER Remove or Modify

**Claude Max Tracking:**
1. OAuth API endpoint: `https://api.anthropic.com/api/oauth/usage`
2. Beta header: `anthropic-beta: oauth-2025-04-20`
3. Credentials path: `~/.claude/.credentials.json`

**Copilot Tracking:**
4. API endpoint: `https://api.github.com/copilot_internal/user`
5. Token via: `execSync("gh auth token")`
6. Usage calc: `percentUsed = 100 - percent_remaining` (can be negative!)

**Budget System:**
7. Tier thresholds: 50% caution, 70% reduce, 90% critical
8. Stability window: 5 minutes minimum between tier changes

### Verify Before Committing

```bash
# Run anti-regression tests
bun test src/features/claude-max-usage/index.test.ts
bun test src/features/copilot-usage/index.test.ts
bun test src/features/budget-orchestrator/index.test.ts

# Full verification
bun run typecheck && bun test
```

For API debugging commands, see @docs/claude-max-api.md and @docs/copilot-api.md.

## Budget Orchestration

Tier system (highest to lowest):
1. **Premium**: Opus, GPT-4.5, Gemini Ultra
2. **Standard**: Sonnet, GPT-4o, Gemini Pro
3. **Budget**: Haiku, GPT-4o-mini, Gemini Flash
4. **Economy**: Cheapest available models

Key functions:
- `BudgetOrchestrator.getRecommendedTier()` - Based on spending %
- `BudgetOrchestrator.getSmartTierChange()` - Adaptive with stability

**DO NOT** allow aggressive tier switching - the adaptive system requires stability windows.

## WebUI Server

Default port: 3847

**Route Order Matters:**
```typescript
// Specific routes BEFORE catch-all routes
if (pathname === "/budget/dashboard") ...  // FIRST
if (pathname === "/budget/trends") ...     // SECOND
if (pathname.startsWith("/budget/")) ...   // LAST (catch-all)
```

## File Structure

```
src/features/
├── budget-orchestrator/     # Tier management, global overrides
├── claude-max-usage/        # Anthropic OAuth API integration
├── copilot-usage/           # GitHub Copilot API integration
├── usage-tracker/           # Per-provider spending tracking
└── background-agent/        # Background task management

src/webui/
├── server.ts                # Bun.serve HTTP server
└── routes/                  # API route handlers
```

## Common Mistakes to Avoid

| Category | Don't | Do |
|----------|-------|-----|
| Claude Max | Estimate usage from tokens | Use OAuth API |
| Claude Max | Skip beta header | Include `anthropic-beta` header |
| Copilot | Use `@githubnext/github-copilot-cli` | Use `gh auth token` |
| Copilot | Assume positive percentages | Handle negative `percent_remaining` |
| Routes | Add catch-all before specific | Specific routes first |
| Async | Skip await in API handlers | Always await fetch calls |

## Test Pollution Prevention (CRITICAL)

**Bun's `mock.module()` is GLOBAL and PERMANENT** - `mock.restore()` does NOT undo it.

| Don't | Do |
|-------|-----|
| `mock.module("../../shared/x")` at module level | Use real module with `_resetForTesting()` |
| Mock shared modules (system-directive, session-state) | Import real module, use setup/teardown functions |
| Assume test isolation | Add `_resetForTesting()` to `beforeEach` |

**If you MUST mock a shared module**: Ensure ALL exports are provided, not just the ones your test needs.

## Adding New Features

When adding budget-related features:
1. Check if `BudgetOrchestrator` already provides the data
2. Use `UsageTracker` for cost tracking, not token counting
3. Add anti-regression tests documenting expected behavior
4. Update fork/README.md changelog section

When modifying usage tracking:
1. **NEVER** change API endpoints or headers without verifying
2. Test with actual subscriptions
3. Verify data matches official UI output
4. Add test cases for any new response fields

## Troubleshooting

### Claude Max 401 "Token expired" Error

OAuth tokens expire after ~8 hours. The tracker auto-refreshes using:
- Endpoint: `https://api.anthropic.com/v1/oauth/token`
- Client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`

If refresh fails:
1. Check `~/.claude/.credentials.json` has valid `refreshToken`
2. Refresh tokens are **single-use** - if you test with curl, you must save the new tokens
3. Manual refresh: `curl -X POST "https://api.anthropic.com/v1/oauth/token" -H "Content-Type: application/x-www-form-urlencoded" -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e"`
4. Update credentials file with new `accessToken`, `refreshToken`, and `expiresAt` (Date.now() + expires_in * 1000)

## OpenCode Zen Manual Usage

- Zen = `opencode` + `google` + `openai` costs. Manual override: `budget.quota_targets.zen_manual_usage_dollars`
- API: `/api/budget/zen-usage`. Test: use `opencode/glm-4.7` models (visual-engineering category)

## Reference Documentation

- **API Details**: @docs/claude-max-api.md, @docs/copilot-api.md
- **Fork Changes**: @fork/README.md
- **Architecture**: @AGENTS.md
