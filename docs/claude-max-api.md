# Claude Max Usage API Reference

This document contains detailed API information for Claude Max usage tracking. For critical constraints, see the main [CLAUDE.md](../CLAUDE.md).

## API Endpoint

```
https://api.anthropic.com/api/oauth/usage
```

**CRITICAL**: This endpoint is undocumented. Do not change without verification.

## Required Headers

```typescript
const headers = {
  "Authorization": `Bearer ${oauth_token}`,
  "anthropic-beta": "oauth-2025-04-20"  // CRITICAL: Without this, API returns 404
}
```

## Response Structure

```typescript
interface OAuthUsageResponse {
  five_hour: { utilization: number, resets_at: string }      // -> currentSession
  seven_day: { utilization: number, resets_at: string }      // -> allModels
  seven_day_sonnet: { utilization: number, resets_at: string } // -> sonnetOnly
}
```

**Key Details:**
- `utilization` returns exact percentage shown by `/usage` command
- Reset dates are authoritative from Anthropic's servers
- Local token estimation was removed because it was inaccurate

## Credentials Location

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

Override with: `CLAUDE_CONFIG_DIR` environment variable

## Debugging

### Enable Debug Logging
```bash
DEBUG=claude-max-usage bun run start-webui.ts
```

### Check Credentials
```bash
cat ~/.claude/.credentials.json | jq '.claudeAiOauth.rateLimitTier'
```

### Test API Directly
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "anthropic-beta: oauth-2025-04-20" \
     "https://api.anthropic.com/api/oauth/usage" | jq
```

### Verify Before Committing
```bash
# Check API still works
curl -H "Authorization: Bearer $(cat ~/.claude/.credentials.json | jq -r '.claudeAiOauth.accessToken')" \
     -H "anthropic-beta: oauth-2025-04-20" \
     "https://api.anthropic.com/api/oauth/usage"

# Run anti-regression tests
bun test src/features/claude-max-usage/index.test.ts
```

## Common Mistakes

1. **Don't estimate Claude Max usage from tokens** - Use the OAuth API
2. **Don't hardcode reset dates** - They come from Anthropic's servers
3. **Don't skip the beta header** - API returns 404 without it

## File Structure

```
src/features/claude-max-usage/
├── index.ts        # Main implementation
└── index.test.ts   # Tests
```
