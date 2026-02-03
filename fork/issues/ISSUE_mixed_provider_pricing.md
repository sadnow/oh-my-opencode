# Issue: Mixed Provider Pricing Strategy

**Status**: Open
**Priority**: High
**Created**: 2026-02-02

## Context
We've added OpenAI and Google Gemini keys to the "bring your own key" section of opencode-zen. Both providers offer complex pricing structures:

- **OpenAI**: Free tier with daily token allowance (few hundred thousand tokens) under data-sharing agreement, then paid-per-token
- **Google Gemini**: Similar free tier deal with limits
- **OpenCode**: Always free
- **Anthropic Claude Max**: Subscription-based with monthly limits
- **GitHub Copilot**: Subscription-based with monthly limits

## Problem
Our current budget orchestrator treats all providers as either subscription-based or paid-per-token. We need to handle hybrid models:
- Free tier until daily/monthly limit reached
- Automatic fallback to paid tier or alternative providers when free tier exhausted
- Tracking of free tier usage to optimize provider selection
- Preference for free providers when available

## Requirements

### 1. Provider Classification
Extend provider types to support:
- `free`: Always free (opencode)
- `paid-per-token`: Traditional pay-as-you-go
- `subscription`: Monthly limit (Claude Max, Copilot)
- **NEW** `hybrid-free-then-paid`: Free tier until limit, then paid
- **NEW** `hybrid-free-daily`: Daily free reset

### 2. Free Tier Tracking
- [ ] Detect when daily/monthly limits are reached
- [ ] Track usage against free tier limits
- [ ] Reset counters at appropriate intervals (daily, monthly)
- [ ] Fallback logic when free tier exhausted

### 3. Provider Selection Strategy
Prioritize providers in this order:
1. **Free tier available** (opencode, openai/google within limits)
2. **Subscription with headroom** (Claude Max, Copilot below limits)
3. **Paid-per-token** (when budget allows)

### 4. Parallel Agent Optimization
- Leverage multiple providers with same models (e.g., GPT-4o via OpenAI and Azure)
- Enable more parallel agents by distributing across free tiers
- Example: 5 GPT-4o agents (3 via OpenAI free, 2 via Azure paid)

### 5. Daily Limit Detection
**Challenge**: OpenAI/Google don't provide programmatic limit status

Potential approaches:
- **Option A**: Parse error responses (429, quota exceeded messages)
- **Option B**: User-configured limits in config
- **Option C**: Heuristic tracking (assume X tokens daily, track usage)
- **Option D**: Combination of all above

### 6. Configuration Example
```jsonc
{
  "provider_tiers": {
    "openai": {
      "type": "hybrid-free-daily",
      "free_tier": {
        "daily_token_limit": 200000,  // User-configured estimate
        "reset_time": "00:00 UTC",    // Daily reset
        "models": ["gpt-4o", "gpt-4o-mini"]
      },
      "paid_tier": {
        "cost_per_1k_input": 0.0025,
        "cost_per_1k_output": 0.010
      }
    },
    "google": {
      "type": "hybrid-free-daily",
      "free_tier": {
        "daily_request_limit": 1500,
        "models": ["gemini-pro", "gemini-flash"]
      }
    }
  }
}
```

### 7. Files to Modify
- `src/features/budget-orchestrator/` - Tier selection logic
- `src/features/usage-tracker/` - Free tier tracking
- `src/config/schema.ts` - Add hybrid tier types
- `docs/` - Document free tier configuration

## Success Criteria
- [ ] System correctly identifies and uses free tiers before paid
- [ ] Automatic fallback when free tier exhausted
- [ ] Cost savings measurable (track free tier usage)
- [ ] More parallel agents possible via multi-provider distribution
- [ ] All tests pass
- [ ] Documentation updated

## Benefits
- Significant cost savings
- More aggressive parallel agent usage without budget concerns
- Better resource utilization across providers

## Notes
This would enable us to run more parallel agents while reducing costs by maximizing free tier usage across OpenAI and Google.
