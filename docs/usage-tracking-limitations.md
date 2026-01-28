# Usage Tracking Implementation & Limitations

## Overview

The usage tracking feature in oh-my-opencode provides **estimated** token usage and cost tracking for all chat interactions. This data populates the analytics dashboard available at `http://localhost:3847/budget-dashboard` when the WebUI is enabled.

## Current Implementation: Message-Based Estimation

### How It Works

The usage tracking hook intercepts every `chat.message` event and:

1. **Estimates tokens from message content** using character-based heuristics:
   - Natural language: ~4 characters per token
   - Code/structured data: ~3.5 characters per token
   - Detection based on bracket/symbol density

2. **Tracks input/output pairs** per session:
   - Stores user message token estimates
   - Associates them with the next assistant response
   - Records both input and output tokens

3. **Calculates costs** using hardcoded pricing for each model:
   - Anthropic (Claude Opus 4.5, Sonnet 4.5, Haiku 4.5)
   - OpenAI (GPT-5.2, GPT-5.2-codex, GPT-5-nano)
   - Google Gemini (3 Flash Preview, 3 Pro)
   - Others (Kimi, GLM, Qwen, OpenCode big-pickle)

4. **Records to UsageTracker** which persists data to:
   - `~/.config/opencode/oh-my-opencode-usage.json`

### Accuracy

**Expected Variance: ±20-30%**

This is NOT actual token usage from API responses. It's a rough estimate based on character counts and heuristics.

**Why the variance?**
- Different tokenizers per model
- Special tokens (BOS, EOS, etc.)
- Multi-byte characters (emoji, non-ASCII)
- Tokenizer updates between model versions
- Cached vs. non-cached calls (not detected)

## Limitations

### 1. **No Actual Token Counts**

OpenCode's plugin API does not expose:
- Token counts from API responses
- Usage metadata in hook callbacks
- Cached token counts (prompt caching)
- Detailed cost breakdowns

### 2. **Cannot Distinguish Cached Calls**

Anthropic's prompt caching can reduce costs by 90% for cached tokens, but we cannot detect:
- Which portions of input are cached
- Cache hit rates
- Actual savings from caching

### 3. **Model-Specific Tokenizers**

Each model family uses different tokenizers:
- GPT models: `tiktoken`
- Claude models: Claude tokenizer
- Gemini models: SentencePiece variants

Our estimation uses a universal heuristic, so accuracy varies by model.

### 4. **No Real-Time Validation**

We cannot validate estimates against actual usage because:
- API responses don't include token counts in hook callbacks
- No way to query usage from provider APIs synchronously
- Background agents run without hook visibility

## Future: OpenCode Fork

**PLANNED:** Fork OpenCode to add token count exposure

Once we fork OpenCode (or if upstream adds this):

### Required Changes to OpenCode Core:

1. **Add `usage` field to hook events:**
   ```typescript
   "chat.message": async (
     input: { sessionID: string; agent?: string },
     output: { 
       message: Message; 
       parts: MessagePart[];
       usage?: {  // NEW FIELD
         inputTokens: number;
         outputTokens: number;
         cachedInputTokens?: number;
       }
     }
   ) => { ... }
   ```

2. **Expose usage in PostToolUse:**
   ```typescript
   "tool.execute.after": async (
     input: { sessionID: string; tool: string },
     output: {
       output: string;
       usage?: {  // NEW FIELD
         inputTokens: number;
         outputTokens: number;
       }
     }
   ) => { ... }
   ```

3. **Surface usage from HTTP clients:**
   - Parse `usage` from API responses
   - Store in message metadata
   - Pass through hook callbacks

### Once Implemented:

- Replace `token-estimator.ts` with actual token counts
- Remove accuracy warnings from logs
- Update analytics dashboard to show "Actual" instead of "Estimated"
- Add cache hit rate metrics
- Provide per-model accuracy comparison

## Using the Current Implementation

### Enable Usage Tracking

In your `oh-my-opencode.json`:

```jsonc
{
  "usage_tracking": {
    "enabled": true,  // Default: true
    "persist": true   // Default: true
  },
  "webui": {
    "enabled": true,
    "port": 3847
  }
}
```

### View Analytics

1. Start OpenCode with oh-my-opencode plugin
2. Open browser: `http://localhost:3847/budget-dashboard`
3. Send some chat messages
4. Refresh dashboard to see estimated usage

### Interpreting the Data

**What the numbers mean:**

- **Total Cost:** Estimated total spend (±20-30% variance)
- **Provider Breakdown:** Shows which providers you're using most
- **Model Efficiency:** Cost per message by model
- **Daily Spending:** Trend over time (estimated)
- **Session Stats:** Average cost per session

**How to use it:**

✅ **Good for:**
- Relative comparisons (Model A vs Model B)
- Budget awareness (rough order of magnitude)
- Identifying expensive sessions
- Trend analysis over time

❌ **NOT good for:**
- Exact billing reconciliation
- Detailed cost attribution
- Comparing to provider invoices
- Precise budget enforcement

## Disabling Usage Tracking

If you don't want estimation at all:

```jsonc
{
  "disabled_hooks": ["usage-tracking"],
  // OR
  "usage_tracking": {
    "enabled": false
  }
}
```

## Contributing

Want to help improve accuracy?

1. **Add your tokenizer tests:**
   - Test estimation against actual token counts
   - Share variance data for your models

2. **Help fork OpenCode:**
   - Implement token count exposure
   - Test with production workloads
   - Submit PRs to OpenCode upstream

3. **Improve heuristics:**
   - Better code detection
   - Language-specific tuning
   - Model-specific adjustments

## See Also

- [Usage Tracker Implementation](../src/features/usage-tracker/)
- [Token Estimator](../src/features/usage-tracker/token-estimator.ts)
- [Usage Tracking Hook](../src/hooks/usage-tracking/)
- [Budget Dashboard](../src/webui/)

## Tracking Issues

- OpenCode token count exposure: TBD (create GitHub issue)
- Fork planning: TBD
- Accuracy improvements: TBD

---

**TL;DR:** Usage tracking works but estimates tokens (±20-30% accuracy). Better than nothing for budget awareness. Real token counts require forking OpenCode to expose API response metadata. We'll do it eventually, but for now, use this with appropriate caution.
