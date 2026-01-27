# Understanding Tier Recommendations

## Two Separate Tracking Systems

The dashboard tracks **two different types of usage**:

### 1. Claude Max Subscription Usage (88%)
- **What it tracks**: Your Claude.ai subscription quota
- **Reset period**: Weekly (resets every 7 days)
- **Data source**: Anthropic OAuth API
- **Where it shows**: "Claude Max Subscription" card
- **Recommendation**: "Consider downgrading to Sonnet" (when at 88%)

### 2. API Usage Tracking ($0.00)
- **What it tracks**: Actual API calls made through the plugin
- **Reset period**: Monthly budget cycle
- **Data source**: Plugin's UsageTracker
- **Where it shows**: "Analytics" section, budget tier badge
- **Recommendation**: "PREMIUM" tier (when no API costs yet)

## Why They Don't Match

**Current Status**:
- ❌ Claude Max: 88% used → Should downgrade
- ✅ API Usage: $0.00 spent → Can use premium tier

**Why this happens**:
- You've used 88% of your Claude Max subscription quota
- But you haven't made any tracked API calls through this plugin yet
- The tier system only looks at **API costs**, not subscription usage

## What the Tier Means

The tier badge (PREMIUM/STANDARD/BUDGET/ECONOMY) recommends which **API models** to use based on your **API budget**, not your Claude Max subscription.

| Tier | Meaning |
|------|---------|
| **PREMIUM** | You have plenty of API budget headroom (can afford Opus, GPT-4.5) |
| **STANDARD** | Moderate budget remaining (use Sonnet, GPT-4o) |
| **BUDGET** | Limited budget (use Haiku, GPT-4o-mini) |
| **ECONOMY** | Very low budget (use cheapest models) |

## When Tiers Update

The tier will change from PREMIUM once you start making API calls:
- After spending $0 - $6: **PREMIUM**
- After spending $6 - $14: **STANDARD**
- After spending $14 - $17: **BUDGET**
- After spending $17+: **ECONOMY**

(Based on $20/month Anthropic budget with 70% target)

## The Mismatch Explained

Your dashboard shows:
- **Tier: PREMIUM** ← Based on $0 API spending
- **Claude: 88%** ← Based on subscription quota usage

These are **independent recommendations**:
1. **API tier** says: "You can afford premium API models"
2. **Claude Max** says: "You're close to your subscription quota"

Both are correct for what they measure.

## Future Enhancement

Ideally, the tier system should consider Claude Max subscription usage too:
- If Claude Max > 85% → Force tier to BUDGET or lower
- If Copilot > 90% → Warn and suggest cheaper models
- Integrate subscription quotas into tier decisions

This would require connecting ClaudeMaxUsageTracker with BudgetOrchestrator.

## What You Should Do

With 88% Claude Max usage:
1. ✅ Manually switch to cheaper models (Haiku, Sonnet)
2. ✅ Use the "Force Tier" override to set BUDGET tier
3. ✅ Enable auto-downgrade in Tier Management
4. ⚠️ Ignore the PREMIUM tier badge until you make API calls

## How to Override

In the dashboard, go to **Tier Management** → **Force Tier Override**:
1. Select "BUDGET" or "ECONOMY"
2. The tier will stay locked at that level
3. This prevents using expensive models despite the PREMIUM recommendation

