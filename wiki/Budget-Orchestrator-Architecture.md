# Budget Orchestrator Architecture

**Last updated:** 2026-02-03

---

## Overview

The budget orchestrator routes model requests to the best available model considering cost, availability, circuit breaker state, provider quotas, and the interleaving strategy. It sits between the agent/category model requirements and the actual API calls.

---

## Key Components

### GlobalOverrideManager (`global-override.ts`)
The central routing brain. Manages:
- **Disabled providers**: Manually or auto-disabled providers
- **Tier caps**: Maximum model tier allowed (premium/standard/budget/economy)
- **Emergency mode**: Economy-only when budget is critical
- **Quota auto-disable**: Auto-disables providers when usage exceeds threshold (default 95%)
- **Critical preservation**: Reserves premium models for critical use cases (oracle, orchestrator)
- **`getBestAvailableModel()`**: The main routing function — selects the best model for a use case

### USE_CASE_FALLBACKS (`global-override.ts`)
Per-use-case model priority lists. 8 use cases:
- `librarian` — docs search, needs moderate reasoning + tool use
- `explorer` — fast codebase search, needs SPEED
- `oracle` — debugging/architecture, needs BEST reasoning
- `orchestrator` — planning/delegation, complex reasoning
- `implementation` — code writing
- `quick` — fast responses for simple queries
- `ultrabrain` — deep reasoning and complex analysis
- `parallel-worker` — background tasks, optimize for load distribution

**INTENT:** Free/cheap models should be interleaved throughout these lists.  
**CURRENT STATE:** Free models are still at the bottom (positions 11-13). Fix is pending.

### CircuitBreaker (`circuit-breaker.ts`)
Tracks provider failures using the circuit breaker pattern:
- **Closed** (green): Provider is healthy, requests flow normally
- **Open** (red): Provider has failed too many times, requests are blocked
- **Half-open** (yellow): Testing if provider has recovered

### WeightCalculator (`provider-weight-calculator.ts`)
Weighted fair-share balancing across providers:
- Subscription providers (Claude Max, Copilot) get 2.0x priority
- API budget providers (OpenCode Zen) get 0.5x priority
- Providers with lower usage get higher priority
- Providers resetting soon get a 1.3x bonus

### HybridTracker (`hybrid-tracker.ts`)
Tracks BYOK free tier exhaustion per provider. When OpenAI's free tier is exhausted, blocks `opencode/gpt-*` models (which route through OpenAI) but allows native models like `opencode/glm-4.7`.

### UnderlyingProviderDetection (`underlying-provider.ts`)
Detects if an `opencode/*` model is BYOK (routes through OpenAI/Google) vs native:
- `opencode/gpt-*` -> underlying provider is `openai`
- `opencode/gemini-*` -> underlying provider is `google`
- `opencode/glm-*`, `opencode/kimi-*`, `opencode/qwen-*`, `opencode/big-pickle` -> native (null)

### Model Tiers (`tiers.ts`)
Four tiers with pricing estimates:
- **Premium** (~$20/1M): claude-opus-4-5, gpt-5.2-codex, o1-pro, gemini-3-pro
- **Standard** (~$9/1M): claude-sonnet-4-5, gpt-5.2, glm-4.7, kimi-k2.5
- **Budget** (~$2.5/1M): claude-haiku-4-5, gemini-3-flash, kimi-k2-thinking, glm-4.7-free
- **Economy** (~$0.5/1M): gpt-4.1-nano, qwen3-coder, glm-4.5-flash

---

## Routing Flow

When `getBestAvailableModel(useCase, preferredModel, ...)` is called:

```
1. Get fallback list for use case (USE_CASE_FALLBACKS[useCase])
2. Calculate overall usage for premium reservation check
3. If preferred model provided and allowed → return it
4. Filter fallback list to allowed models:
   a. Is provider disabled? (manual, auto-quota, circuit breaker)
   b. Is provider available? (authenticated)
   c. Is specific model disabled? (config)
   d. Is model known broken on Zen? (ZEN_KNOWN_BROKEN_MODELS)
   e. Has model failed previously? (runtime failure cache)
   f. Is model available in Zen API? (cache check)
   g. Is emergency mode on? (economy only)
   h. Is model under tier cap?
   i. Is provider over quota target?
   j. Should premium be reserved for critical use cases?
5. If no allowed models → fallback to opencode/big-pickle
6. If one allowed model → return it
7. Use WeightCalculator for load balancing:
   a. Build candidates with weights based on usage, subscription type, reset timing
   b. Select highest-weight candidate
8. Return selected model
```

---

## Free Model Handling

Free models get special treatment in `isModelAllowed()`:
- **Copilot free models** (gpt-5-mini, gpt-4.1): Allowed even when github-copilot provider is runtime-disabled
- **OpenCode free models** (glm-4.7-free, kimi-k2.5-free, big-pickle, gpt-5-nano): Allowed even when opencode provider is runtime-disabled
- Free models bypass BYOK exhaustion checks

See [Zen Model Pricing](Zen-Model-Pricing.md) for which models are actually free.

---

## Two Fallback Systems

There are TWO separate fallback chain systems that serve different purposes:

| System | File | Used By |
|--------|------|---------|
| `AGENT_MODEL_REQUIREMENTS` / `CATEGORY_MODEL_REQUIREMENTS` | `src/shared/model-requirements.ts` | Model resolver (initial model selection) |
| `USE_CASE_FALLBACKS` | `src/features/budget-orchestrator/global-override.ts` | Budget orchestrator (`getBestAvailableModel()`) |

**INTENT:** Both should have interleaved free/cheap models.  
**CURRENT STATE:** `model-requirements.ts` is DONE. `USE_CASE_FALLBACKS` is PENDING.

---

## Persistence

Global override state is persisted to `~/.config/opencode/oh-my-opencode-global-override.json` and survives restarts. Includes disabled providers, tier caps, auto-disable state, and emergency mode.

---

*Last updated: 2026-02-03*
