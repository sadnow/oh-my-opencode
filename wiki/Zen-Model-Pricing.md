# Zen Model Pricing Reference

**Last verified:** 2026-02-03  
**Source:** Codebase analysis of `tiers.ts`, `global-override.ts` (`OPENCODE_FREE_MODELS`), `test-zen-byok-models.ts`, and `presets.ts`

---

## TL;DR

**Don't assume a model is free just because it's "native" on Zen.** Native means it doesn't route through OpenAI/Google/Anthropic — but native does NOT mean free. Most native models still consume your Zen budget.

Only models with a `-free` suffix (or explicitly in the `OPENCODE_FREE_MODELS` set) are truly zero-cost.

---

## FREE Models (Zero Cost)

These models are in the `OPENCODE_FREE_MODELS` set in `src/features/budget-orchestrator/global-override.ts` and cost nothing to use.

| Model ID | Notes |
|----------|-------|
| `glm-4.7-free` | Free GLM variant. Fast, good for light tasks. |
| `kimi-k2.5-free` | Free Kimi variant. Capable for its tier. |
| `big-pickle` | Native Zen ultimate fallback. Always available. |
| `gpt-5-nano` | Sometimes-free, consumes daily Zen quota. Listed as free in code but has daily limits. |

### How to identify free models
- Has `-free` suffix in the model name, OR
- Is listed in the `OPENCODE_FREE_MODELS` constant

---

## CHEAP Native Models (Budget/Economy Tier — Still Costs Money)

These are **native** Zen models (they don't route through OpenAI/Google/Anthropic), but they **still consume your Zen credits**. They are NOT free.

| Model ID | Tier | Approx Cost (per 1M tokens) | Notes |
|----------|------|------------------------------|-------|
| `glm-4.7` | Standard | ~$0.60 input / $2.20 output | Good at agentic tasks. NOT the same as `glm-4.7-free`. |
| `kimi-k2-thinking` | Budget | ~$0.60 input / $2.50 output | Strong reasoning/thinking model. |
| `kimi-k2.5` | Standard | ~$0.60 input / $2.50 output | Capable general model. |
| `qwen3-coder` | Economy | Cheap (economy tier) | Code-specialized. |
| `glm-4.6` | Economy | Cheap (economy tier) | Budget/fast variant. |
| `glm-4.6v` | Economy | Cheap (economy tier) | Vision variant. |
| `kimi-k2` | Budget | ~$0.60 input / $2.50 output | Base Kimi model. |

### Common mistake
Labeling `kimi-k2-thinking` or `glm-4.7` as "FREE" in comments. They are cheap but not free. Use "CHEAP native" instead.

---

## BYOK Models (Your Own Key Through Zen Proxy)

These models route through Zen but consume tokens from the **underlying provider** (OpenAI, Google, etc.). They are NOT free — they burn your provider's token allocation.

| Model ID | Underlying Provider | Notes |
|----------|---------------------|-------|
| `gpt-5.2` | OpenAI | Consumes OpenAI tokens |
| `gpt-5.2-codex` | OpenAI | Consumes OpenAI tokens |
| `gpt-5.1-codex` | OpenAI | Consumes OpenAI tokens |
| `gpt-5` | OpenAI | Consumes OpenAI tokens |
| `gemini-3-flash` | Google | **BROKEN** — 500 errors on Zen proxy. See [Broken Zen Models](Broken-Zen-Models.md). |
| `gemini-3-pro` | Google | **BROKEN** — 500 errors on Zen proxy. See [Broken Zen Models](Broken-Zen-Models.md). |

### Detection logic
`src/features/budget-orchestrator/underlying-provider.ts` detects BYOK models:
- `opencode/gpt-*` -> underlying provider is `openai`
- `opencode/gemini-*` -> underlying provider is `google`
- Everything else (glm, kimi, qwen, big-pickle) -> native (no underlying provider)

---

## Authoritative Code References

| What | File | Line |
|------|------|------|
| Free model set | `src/features/budget-orchestrator/global-override.ts` | `OPENCODE_FREE_MODELS` (~line 270) |
| Broken model set | `src/features/budget-orchestrator/global-override.ts` | `ZEN_KNOWN_BROKEN_MODELS` (~line 282) |
| Tier definitions and pricing | `src/features/budget-orchestrator/tiers.ts` | `MODEL_TIERS` |
| Native detection | `src/features/budget-orchestrator/underlying-provider.ts` | `detectUnderlyingProvider()` |
| Zen API model list | `src/features/budget-orchestrator/zen-model-detection.ts` | `fetchZenAvailableModels()` |
| Test script | `scripts/test-zen-byok-models.ts` | Tests all models against live Zen API |
| Preset pricing | `src/cli/wizard/presets.ts` | Budget/Free tier presets with cost estimates |

---

## Intent vs Current State

**INTENT:** The `OPENCODE_FREE_MODELS` set should be the single source of truth for which models are free. All comments in fallback chains should accurately distinguish FREE (zero cost) from CHEAP native (budget/economy tier, still costs Zen credits).

**CURRENT STATE (2026-02-03):**
- `model-requirements.ts`: Comments FIXED — correctly labels FREE vs CHEAP native
- `global-override.ts` (`USE_CASE_FALLBACKS`): Comments still reference models by their purpose rather than free/cheap classification. The interleaving reorder is PENDING.
- `presets.ts` (Free Tier preset): Loosely calls all native models "free" — this is misleading since `kimi-k2-thinking` and `glm-4.7` cost money

See [Interleaving Strategy](Interleaving-Strategy.md) for how we mix free/cheap models with premium.

---

*Last updated: 2026-02-03*
