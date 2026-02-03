# BYOK Hybrid Provider Testing Guide

## Overview

The BYOK hybrid provider pricing feature tracks free tier usage for OpenAI and Google models accessed through OpenCode Zen BYOK. This guide explains how to test it.

## Important: How It Works

**oh-im-broke is a PLUGIN**, not a standalone application. It doesn't make API calls itself - it tracks API calls made by the OpenCode client.

The flow is:
1. User makes API call through OpenCode client → `opencode/gpt-5-nano`
2. OpenCode client executes the call
3. OpenCode client calls our plugin's usage tracker
4. Our `UsageTracker.recordUsage()` is called (line 108-116 in tracker.ts)
5. We detect it's an opencode model and call `HybridProviderTracker.recordUsage()`
6. Usage is accumulated and checked against limits
7. On next model selection, `GlobalOverrideManager.isModelAllowed()` checks if exhausted

## Testing Steps

### 1. Configure Hybrid Provider Tracking

Edit `~/.config/opencode/oh-im-broke.json`:

```json
{
  "budget": {
    "hybrid_providers": {
      "openai": {
        "daily_free_tokens": 5000,
        "reset_time": "00:00 UTC",
        "enabled": true
      }
    }
  }
}
```

**Note:** Set to 5000 for quick testing, or 150000 for production.

### 2. Restart OpenCode Client

```bash
# Restart your OpenCode client to load the new config
```

### 3. Check Initial State

```bash
bun run scripts/check-byok-usage.ts
```

Should show 0 usage initially.

### 4. Make BYOK API Calls

In your OpenCode client, make several API calls to BYOK models:
- `opencode/gpt-5-nano` (cheapest)
- `opencode/gpt-5`
- `opencode/gpt-5.2`

Example prompts:
- "Say hello in 5 words"
- "Count to 10"
- "What is 2+2?"
- "Name a color"

### 5. Check Usage After Each Call

```bash
bun run scripts/check-byok-usage.ts
```

You should see usage increasing:
```
OPENAI:
  Tokens Used: 2473 / 5000
  Percentage: 49.5%
  Status: 🟢 Available
```

### 6. Exceed the Limit

Keep making calls until you exceed 5000 tokens:

```bash
bun run scripts/check-byok-usage.ts
```

Should show:
```
OPENAI:
  Tokens Used: 5234 / 5000
  Percentage: 104.7%
  Status: 🔴 EXHAUSTED

🔴 Exhausted Providers: openai
```

### 7. Verify Blocking

Try to make another call to `opencode/gpt-5-nano`. 

**Expected behavior:**
- The model should be automatically blocked
- OpenCode should fall back to:
  - Native models (opencode/big-pickle, opencode/qwen-2.5-coder)
  - Subscription providers (github-copilot, anthropic)

**How to verify:**
- Check OpenCode Zen dashboard - no more gpt-5-nano calls should appear
- Check OpenCode client logs - should show fallback to other models

## Verification Checklist

- [ ] Config file created with hybrid_providers
- [ ] OpenCode client restarted
- [ ] Initial usage shows 0 tokens
- [ ] After API calls, usage increases correctly
- [ ] Token counts match OpenCode Zen dashboard
- [ ] When limit exceeded, status shows EXHAUSTED
- [ ] BYOK models blocked after exhaustion
- [ ] Native models still work after exhaustion
- [ ] Fallback to subscription providers works

## Troubleshooting

### Usage not increasing

**Problem:** Making API calls but `check-byok-usage.ts` shows 0 usage.

**Solutions:**
1. Verify config file exists and is valid JSON
2. Restart OpenCode client
3. Check you're calling BYOK models (opencode/gpt-5-nano, not github-copilot/gpt-5-mini)
4. Check OpenCode client logs for errors

### Models not blocked

**Problem:** Usage exceeded but BYOK models still work.

**Solutions:**
1. Verify `check-byok-usage.ts` shows EXHAUSTED status
2. Restart OpenCode client to reload model selection logic
3. Check GlobalOverrideManager is using hybrid tracker (should be automatic)

### Usage resets unexpectedly

**Problem:** Usage resets before UTC midnight.

**Solutions:**
1. Check system time is correct
2. Verify reset_time is "00:00 UTC" in config
3. Check for multiple config files overriding each other

## Files Involved

- `src/features/usage-tracker/tracker.ts` - Records usage, calls hybrid tracker
- `src/features/budget-orchestrator/hybrid-tracker.ts` - Tracks BYOK usage
- `src/features/budget-orchestrator/global-override.ts` - Blocks exhausted models
- `src/features/budget-orchestrator/underlying-provider.ts` - Detects BYOK vs native
- `~/.config/opencode/oh-im-broke.json` - User configuration

## Expected OpenCode Zen Dashboard

When testing, your OpenCode Zen usage dashboard should show:

**Before limit:**
```
Feb 3, 5:27 AM  gpt-5-nano  2473  25  $0.0000
Feb 3, 5:28 AM  gpt-5-nano  1234  30  $0.0000
Feb 3, 5:29 AM  gpt-5-nano  1523  28  $0.0000
```

**After limit (no more gpt-5-nano):**
```
Feb 3, 5:30 AM  big-pickle  1234  45  $0.0000
Feb 3, 5:31 AM  qwen-2.5-coder  2345  50  $0.0000
```

The key indicator: **gpt-5-nano calls stop appearing once limit is hit**.
