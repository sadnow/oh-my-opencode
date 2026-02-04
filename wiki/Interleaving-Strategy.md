# Model Interleaving Strategy

**Last updated:** 2026-02-03

---

## Philosophy

> "Free models are not supposed to be the last resort — they are supposed to be used alongside premium models and/or alternated between them to ensure that we make our premium credits LAST. We are NOT trying to use up all our premium credits just to be stuck with lower intelligence free models for x remaining days."

---

## How It Works

Instead of putting all free/cheap models at the bottom of fallback chains (positions 11-14 out of 14), we **interleave** them between premium providers:

### Before (bad — free models are last resort):
```
1. anthropic/claude-opus-4-5      <- premium
2. openai/gpt-5.2                 <- premium
3. google/gemini-3-pro            <- premium
4. github-copilot/claude-sonnet   <- premium
5. github-copilot/gpt-5.2-codex  <- premium
...
11. opencode/kimi-k2-thinking     <- cheap (only used when ALL premium exhausted)
12. opencode/glm-4.7-free         <- free
13. opencode/big-pickle           <- fallback
```

### After (good — free/cheap models interleaved):
```
1. anthropic/claude-opus-4-5      <- premium
2. opencode/kimi-k2-thinking      <- CHEAP native (gets used when #1 is down)
3. openai/gpt-5.2                 <- premium
4. opencode/glm-4.7               <- CHEAP native (gets used when #3 is down)
5. google/gemini-3-pro            <- premium
6. opencode/big-pickle            <- fallback
```

---

## Rules by Task Weight

### Heavy tasks (sisyphus, oracle, prometheus, atlas, etc.)
- Premium model first
- **Cheap native** (kimi-k2-thinking) at position 2
- Second premium
- **Cheap native** (glm-4.7) at position 4
- Remaining premium
- big-pickle as ultimate fallback

### Light tasks (explore, quick, writing, unspecified-low)
- **FREE model first** (glm-4.7-free) — zero cost, good enough
- First premium (haiku/flash tier)
- **FREE model** (kimi-k2.5-free) interleaved
- Second premium
- big-pickle as ultimate fallback

### Medium tasks (visual-engineering, ultrabrain, artistry, unspecified-high)
- Premium model first
- **Cheap native** after first premium
- Second premium
- **Cheap native** after second premium
- Remaining premium
- big-pickle as ultimate fallback

---

## Affected Files

| File | What it controls | Status |
|------|-----------------|--------|
| `src/shared/model-requirements.ts` | Agent and category fallback chains (used by model resolver) | DONE - interleaved with correct FREE/CHEAP labels |
| `src/features/budget-orchestrator/global-override.ts` | `USE_CASE_FALLBACKS` (used by budget orchestrator's `getBestAvailableModel()`) | PENDING - free models still at the bottom |

---

## Intent vs Current State

**INTENT:** Both `model-requirements.ts` and `USE_CASE_FALLBACKS` should have interleaved free/cheap models.

**CURRENT STATE (2026-02-03):**
- `model-requirements.ts` (agent/category chains): DONE. Free models (glm-4.7-free, kimi-k2.5-free) placed first for light tasks. Cheap native models (kimi-k2-thinking, glm-4.7) interleaved between premium for heavy tasks. Comments correctly distinguish FREE vs CHEAP native.
- `global-override.ts` (`USE_CASE_FALLBACKS`): NOT YET UPDATED. Free models still at positions 11-13 out of 14 in most use cases. This is the next task to fix.

---

## Model Classification Quick Reference

| Label in code | Meaning | Examples | Cost |
|---------------|---------|----------|------|
| `// FREE` | Zero cost, in `OPENCODE_FREE_MODELS` | glm-4.7-free, kimi-k2.5-free, big-pickle | $0 |
| `// CHEAP native` | Low cost, native Zen, NOT free | kimi-k2-thinking, glm-4.7, qwen3-coder | ~$0.60/1M |
| (no label) | Premium/standard provider model | claude-opus-4-5, gpt-5.2, gemini-3-pro | $3-25/1M |

See [Zen Model Pricing](Zen-Model-Pricing.md) for full pricing details.

---

*Last updated: 2026-02-03*
