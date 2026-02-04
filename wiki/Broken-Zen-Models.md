# Broken Zen Models

**Last verified:** 2026-02-03

---

## Purpose

Defense-in-depth blocklist for Zen proxy models that consistently return HTTP 500 errors. These are blocked in `ZEN_KNOWN_BROKEN_MODELS` in `global-override.ts` and checked in `isModelAllowed()`.

The models themselves are likely fine — it's the **Zen proxy** that fails to parse their responses.

---

## Currently Broken

| Model ID | Error | Notes |
|----------|-------|-------|
| `gemini-3-flash` | 500: "Cannot read properties of undefined (reading 'promptTokenCount')" | Zen proxy parsing bug. The model works fine via Google directly. |
| `gemini-3-pro` | 500: Same Zen proxy parsing error | Same root cause as gemini-3-flash. |
| `minimax-m2.1-free` | 500 on all endpoints | Only the FREE variant is broken. The paid `minimax-m2.1` works fine. |

---

## Where They're Blocked

| Location | What |
|----------|------|
| `src/features/budget-orchestrator/global-override.ts` | `ZEN_KNOWN_BROKEN_MODELS` set (~line 282) — static blocklist checked in `isModelAllowed()` |
| `src/features/budget-orchestrator/global-override.ts` | `OPENCODE_FREE_MODELS` set (~line 270) — `minimax-m2.1-free` excluded with comment |
| `src/features/budget-orchestrator/tiers.ts` | Comments noting exclusions in budget and economy tiers |
| `src/shared/model-requirements.ts` | Not included in any fallback chain |
| `src/features/budget-orchestrator/global-override.ts` | `USE_CASE_FALLBACKS` — not included in any use case list |

---

## How to Test

Run the Zen model test script against the live API:

```bash
bun run scripts/test-zen-byok-models.ts
```

This script:
1. Lists all available models from `https://opencode.ai/zen/v1/models`
2. Sends a test prompt ("Reply with only the word 'hello'") to each model
3. Reports which models succeed and which fail with error details
4. Compares results against hardcoded model lists

---

## Intent

These models should be **re-enabled when the Zen proxy fixes its parsing**. The models themselves are fine — it's the proxy that's broken. Check periodically by running the test script.

---

## How to Update

If a model starts working again:

1. **Remove from blocklist**: Delete the entry from `ZEN_KNOWN_BROKEN_MODELS` in `global-override.ts`
2. **Add to free models** (if applicable): Add to `OPENCODE_FREE_MODELS` if it's a free model
3. **Add to fallback chains**: Add to relevant `USE_CASE_FALLBACKS` entries and `model-requirements.ts` chains
4. **Add to tiers**: Uncomment or add the entry in `tiers.ts`
5. **Update this wiki page**: Remove from the broken list, note the date it was fixed

If a new model breaks:

1. **Add to blocklist**: Add to `ZEN_KNOWN_BROKEN_MODELS` with a comment describing the error
2. **Remove from fallback chains**: Remove from `USE_CASE_FALLBACKS` and `model-requirements.ts`
3. **Update this wiki page**: Add to the broken list with error details and date

---

*Last verified: 2026-02-03*
