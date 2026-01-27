# GitHub Copilot Usage API Reference

This document contains detailed API information for GitHub Copilot usage tracking. For critical constraints, see the main [CLAUDE.md](../CLAUDE.md).

## API Endpoint

```
https://api.github.com/copilot_internal/user
```

**CRITICAL**: This is an internal endpoint, not publicly documented. Do not change without verification.

## Required Headers

```typescript
const headers = {
  "Authorization": `Bearer ${gh_token}`,  // From `gh auth token`
  "Accept": "application/json"
}
```

## Response Structure

```typescript
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
```

**Key Details:**
- `percent_remaining` can be **NEGATIVE** when user exceeds their limit
- `entitlement` is the total monthly limit (1500 for Pro)
- `remaining` shows exact requests left (negative = over limit)
- Reset date is authoritative from GitHub's servers

## Usage Calculation

```typescript
// e.g., 100 - (-0.64) = 100.64% when over limit
const percentUsed = 100 - percent_remaining
```

## Token Acquisition

```typescript
import { execSync } from "child_process"
const token = execSync("gh auth token", { encoding: "utf-8" }).trim()
```

**IMPORTANT**:
- The `@githubnext/github-copilot-cli` npm package is **DEPRECATED** and calls dead endpoints
- The real Copilot CLI is at `~/.copilot/pkg/` (installed by VS Code)
- Live refresh runs every 60 seconds to track usage in real-time

## Debugging

### Enable Debug Logging
```bash
DEBUG=copilot-usage bun run start-webui.ts
```

### Check gh Authentication
```bash
gh auth status
```

### Test API Directly
```bash
curl -s -H "Authorization: Bearer $(gh auth token)" \
     -H "Accept: application/json" \
     "https://api.github.com/copilot_internal/user" | jq
```

### Run Copilot CLI (VS Code installed)
```bash
node ~/.copilot/pkg/win32-x64/*/index.js -p "test" --allow-all-tools -s
```

### Verify Before Committing
```bash
# Check API still works
curl -H "Authorization: Bearer $(gh auth token)" \
     -H "Accept: application/json" \
     "https://api.github.com/copilot_internal/user"

# Run anti-regression tests
bun test src/features/copilot-usage/index.test.ts
```

## Common Mistakes

1. **Don't use `@githubnext/github-copilot-cli`** - It's deprecated and calls dead endpoints
2. **Don't forget negative percent_remaining** - Over-limit users have negative values
3. **Don't hardcode token** - Use `execSync("gh auth token")` for fresh tokens

## File Structure

```
src/features/copilot-usage/
├── index.ts        # Main implementation
└── index.test.ts   # Tests
```
