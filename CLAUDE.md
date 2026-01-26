# Claude Code Guidelines for oh-my-opencode

This document provides critical guidance for AI models working on this codebase.

## Project Overview

oh-my-opencode is a Claude Code plugin that adds:
- Multi-provider orchestration (Claude, OpenAI, Google, etc.)
- Budget tracking and adaptive tier management
- Real-time Claude Max subscription usage tracking
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
├── usage-tracker/           # Per-provider spending tracking
├── hot-config/              # Runtime config reloading
└── background-agent/        # Background task management

src/webui/
├── server.ts                # Bun.serve HTTP server
├── routes/                  # API route handlers
└── static-files.ts          # Embedded HTML/JS/CSS

src/cli/
└── budget/                  # CLI budget command
```

## Anti-Regression Rules

### Never Remove or Modify

1. **OAuth API endpoint** - `https://api.anthropic.com/api/oauth/usage`
2. **Beta header** - `anthropic-beta: oauth-2025-04-20`
3. **Credentials path** - `~/.claude/.credentials.json`
4. **Tier threshold values** - 50% caution, 70% reduce, 90% critical
5. **Adaptive stability window** - 5 minutes minimum between tier changes

### Always Verify

Before committing changes to budget/usage tracking:

```bash
# Check API still works
curl -H "Authorization: Bearer $(cat ~/.claude/.credentials.json | jq -r '.claudeAiOauth.accessToken')" \
     -H "anthropic-beta: oauth-2025-04-20" \
     "https://api.anthropic.com/api/oauth/usage"

# Run anti-regression tests
bun test src/features/claude-max-usage/index.test.ts
bun test src/features/budget-orchestrator/index.test.ts
```

### Test Before Pushing

```bash
bunx tsc --noEmit                    # Type check
bun test                             # Run all tests
bun run start-webui.ts &             # Start WebUI
curl http://localhost:3847/api/claude-max/usage  # Verify API
```

## Common Mistakes to Avoid

1. **Don't estimate Claude Max usage from tokens** - Use the OAuth API
2. **Don't hardcode reset dates** - They come from Anthropic's servers
3. **Don't skip the beta header** - API returns 404 without it
4. **Don't change route order without testing** - Catch-all routes break specific routes
5. **Don't remove async/await from API handlers** - Fetch is asynchronous

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

## Contact

This fork is maintained at: https://github.com/sadnow/oh-my-opencode
