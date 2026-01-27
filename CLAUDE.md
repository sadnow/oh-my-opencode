# Claude Code Guidelines for oh-my-opencode

This document provides critical guidance for AI models working on this codebase.

## Project Overview

oh-my-opencode is a Claude Code plugin that adds:
- Multi-provider orchestration (Claude, OpenAI, Google, etc.)
- Budget tracking and adaptive tier management
- Real-time Claude Max subscription usage tracking
- Real-time GitHub Copilot usage tracking
- WebUI dashboard for configuration and monitoring

## Critical Implementation Details

### Claude Max Usage Tracking

**DO NOT CHANGE** the following implementation details:

```typescript
// API Endpoint (discovered, not documented publicly)
const ENDPOINT = "https://api.anthropic.com/api/oauth/usage"

// Required headers
const headers = {
  "Authorization": `Bearer ${oauth_token}`,
  "anthropic-beta": "oauth-2025-04-20"  // CRITICAL: Without this, API returns 404
}

// Response structure
interface OAuthUsageResponse {
  five_hour: { utilization: number, resets_at: string }      // -> currentSession
  seven_day: { utilization: number, resets_at: string }      // -> allModels
  seven_day_sonnet: { utilization: number, resets_at: string } // -> sonnetOnly
}
```

**Why this matters:**
- The `utilization` field returns the exact percentage shown by `/usage` command
- Reset dates are authoritative from Anthropic's servers
- Local token estimation was removed because it was inaccurate

**Credentials location:**
```
~/.claude/.credentials.json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "rateLimitTier": "default_claude_max_20x",  // Tier detection
    "subscriptionType": "max"
  }
}
```

### GitHub Copilot Usage Tracking

**DO NOT CHANGE** the following implementation details:

```typescript
// API Endpoint (internal, not documented publicly)
const ENDPOINT = "https://api.github.com/copilot_internal/user"

// Required headers
const headers = {
  "Authorization": `Bearer ${gh_token}`,  // From `gh auth token`
  "Accept": "application/json"
}

// Response structure
interface GitHubCopilotAPIResponse {
  copilot_plan: string                    // "individual_pro"
  quota_reset_date_utc: string            // "2026-02-01T00:00:00.000Z"
  quota_snapshots: {
    premium_interactions: {
      percent_remaining: number           // Can be NEGATIVE when over limit
      entitlement: number                 // 1500 for Pro
      remaining: number                   // Negative = over limit
    }
  }
}

// Usage calculation
const percentUsed = 100 - percent_remaining  // e.g., 100 - (-0.64) = 100.64%
```

**Why this matters:**
- `percent_remaining` can be NEGATIVE when user exceeds their limit
- `entitlement` is the total monthly limit (1500 for Pro)
- `remaining` shows exact requests left (negative = over limit)
- Reset date is authoritative from GitHub's servers

**Token acquisition:**
```typescript
import { execSync } from "child_process"
const token = execSync("gh auth token", { encoding: "utf-8" }).trim()
```

**IMPORTANT**:
- The `@githubnext/github-copilot-cli` npm package is DEPRECATED and calls dead endpoints
- The real Copilot CLI is at `~/.copilot/pkg/` (installed by VS Code)
- Live refresh runs every 60 seconds to track usage in real-time

### Budget Orchestration

The budget system has these tiers:
1. **Premium**: Opus, GPT-4.5, Gemini Ultra
2. **Standard**: Sonnet, GPT-4o, Gemini Pro
3. **Budget**: Haiku, GPT-4o-mini, Gemini Flash
4. **Economy**: Cheapest available models

Tier changes are controlled by:
- `BudgetOrchestrator.getRecommendedTier()` - Based on spending %
- `BudgetOrchestrator.getSmartTierChange()` - Adaptive with stability

**DO NOT** allow aggressive tier switching - the adaptive system requires stability windows.

### WebUI Server

The WebUI runs on port 3847 by default:
- `/` - Settings dashboard
- `/budget-dashboard` - Budget and usage visualization
- `/api/*` - REST API endpoints

**Route Order Matters:**
```typescript
// Specific routes BEFORE catch-all routes
if (pathname === "/budget/dashboard") ...  // FIRST
if (pathname === "/budget/trends") ...     // SECOND
if (pathname.startsWith("/budget/")) ...   // LAST (catch-all)
```

### File Structure

```
src/features/
├── budget-orchestrator/     # Tier management and adaptive learning
├── claude-max-usage/        # Anthropic OAuth API integration
├── copilot-usage/           # GitHub Copilot API integration
├── usage-tracker/           # Per-provider spending tracking
├── hot-config/              # Runtime config reloading
└── background-agent/        # Background task management

src/webui/
├── server.ts                # Bun.serve HTTP server
├── routes/                  # API route handlers
│   ├── claude-max.ts        # Claude Max usage endpoints
│   └── copilot.ts           # Copilot usage endpoints
└── static-files.ts          # Embedded HTML/JS/CSS

src/cli/
└── budget/                  # CLI budget command
```

## Anti-Regression Rules

### Never Remove or Modify

**Claude Max Tracking:**
1. **OAuth API endpoint** - `https://api.anthropic.com/api/oauth/usage`
2. **Beta header** - `anthropic-beta: oauth-2025-04-20`
3. **Credentials path** - `~/.claude/.credentials.json`

**Copilot Tracking:**
4. **Copilot API endpoint** - `https://api.github.com/copilot_internal/user`
5. **Token acquisition** - `execSync("gh auth token")`
6. **Usage calculation** - `percentUsed = 100 - percent_remaining`

**Budget System:**
7. **Tier threshold values** - 50% caution, 70% reduce, 90% critical
8. **Adaptive stability window** - 5 minutes minimum between tier changes

### Always Verify

Before committing changes to budget/usage tracking:

```bash
# Check Claude Max API still works
curl -H "Authorization: Bearer $(cat ~/.claude/.credentials.json | jq -r '.claudeAiOauth.accessToken')" \
     -H "anthropic-beta: oauth-2025-04-20" \
     "https://api.anthropic.com/api/oauth/usage"

# Check Copilot API still works
curl -H "Authorization: Bearer $(gh auth token)" \
     -H "Accept: application/json" \
     "https://api.github.com/copilot_internal/user"

# Run anti-regression tests
bun test src/features/claude-max-usage/index.test.ts
bun test src/features/copilot-usage/index.test.ts
bun test src/features/budget-orchestrator/index.test.ts
```

### Test Before Pushing

```bash
bunx tsc --noEmit                    # Type check
bun test                             # Run all tests
bun run start-webui.ts &             # Start WebUI
curl http://localhost:3847/api/claude-max/usage  # Verify Claude Max API
curl http://localhost:3847/api/copilot/usage     # Verify Copilot API
```

## Common Mistakes to Avoid

**Claude Max:**
1. **Don't estimate Claude Max usage from tokens** - Use the OAuth API
2. **Don't hardcode reset dates** - They come from Anthropic's servers
3. **Don't skip the beta header** - API returns 404 without it

**Copilot:**
4. **Don't use `@githubnext/github-copilot-cli`** - It's deprecated and calls dead endpoints
5. **Don't forget negative percent_remaining** - Over-limit users have negative values
6. **Don't hardcode token** - Use `execSync("gh auth token")` for fresh tokens

**General:**
7. **Don't change route order without testing** - Catch-all routes break specific routes
8. **Don't remove async/await from API handlers** - Fetch is asynchronous

## Adding New Features

When adding budget-related features:

1. Check if `BudgetOrchestrator` already provides the data
2. Use `UsageTracker` for cost tracking, not token counting
3. Add anti-regression tests documenting the expected behavior
4. Update FORK.md changelog section

When modifying Claude Max tracking:

1. **NEVER** change the API endpoint or headers without verifying
2. Test with actual Claude Max subscription
3. Verify data matches `/usage` command output
4. Add test cases for any new response fields

## Debugging

### Claude Max
```bash
# Enable debug logging
DEBUG=claude-max-usage bun run start-webui.ts

# Check credentials
cat ~/.claude/.credentials.json | jq '.claudeAiOauth.rateLimitTier'

# Test API directly
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "anthropic-beta: oauth-2025-04-20" \
     "https://api.anthropic.com/api/oauth/usage" | jq
```

### Copilot
```bash
# Enable debug logging
DEBUG=copilot-usage bun run start-webui.ts

# Check gh authentication
gh auth status

# Test API directly
curl -s -H "Authorization: Bearer $(gh auth token)" \
     -H "Accept: application/json" \
     "https://api.github.com/copilot_internal/user" | jq

# Run Copilot CLI (VS Code installed)
node ~/.copilot/pkg/win32-x64/*/index.js -p "test" --allow-all-tools -s
```

## Contact

This fork is maintained at: https://github.com/sadnow/oh-my-opencode
