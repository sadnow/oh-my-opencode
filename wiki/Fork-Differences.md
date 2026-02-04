# Fork Differences: oh-im-broke vs upstream

**Last updated:** 2026-02-03

---

## What is oh-im-broke?

A budget-focused fork of [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode). The name is a playful take on "oh-my-opencode" that reflects our philosophy: **vibe code without breaking the bank.**

Fork repo: [sadnow/oh-my-opencode](https://github.com/sadnow/oh-my-opencode)

---

## Key Additions Over Upstream

### 1. Budget Orchestrator
Full budget-aware model routing system. See [Budget Orchestrator Architecture](Budget-Orchestrator-Architecture.md).
- `GlobalOverrideManager` — central routing brain
- Weighted fair-share balancing across providers
- Per-provider quota targets and auto-disable on threshold
- Emergency mode (economy-only)
- Critical use case preservation (reserve premium for oracle/orchestrator)

### 2. Circuit Breaker
Tracks provider failures and auto-disables failing providers. Prevents wasting tokens on providers that are down.

### 3. Free/Cheap Model Interleaving
**INTENT:** Free and cheap native Zen models are interleaved between premium providers in fallback chains, not dumped at the bottom. This spreads premium credit usage across the billing period.

**CURRENT STATE:** `model-requirements.ts` (agent/category chains) is DONE. `USE_CASE_FALLBACKS` in `global-override.ts` is PENDING — free models still at the bottom there.

See [Interleaving Strategy](Interleaving-Strategy.md).

### 4. BYOK Budget Leak Prevention
Discovered that silent fallback to Zen BYOK models (e.g., `opencode/gpt-5.2`) was burning real OpenAI tokens without the user knowing. Fixed by:
- Excluding BYOK models from default fallback chains
- `underlying-provider.ts` detects which Zen models route through paid providers
- `HybridTracker` detects when provider free tiers are exhausted

### 5. Zen Model Availability Detection
- API-based detection: `fetchZenAvailableModels()` queries `https://opencode.ai/zen/v1/models`
- Static blocklist: `ZEN_KNOWN_BROKEN_MODELS` for models that consistently 500
- See [Broken Zen Models](Broken-Zen-Models.md) and [Zen Model Pricing](Zen-Model-Pricing.md)

### 6. Hybrid Provider Tracking
Detects when a provider's free tier is exhausted and blocks BYOK models that would consume paid tokens from that provider.

### 7. WebUI Dashboard
Bloomberg-terminal-style dark theme dashboard for real-time budget monitoring. See [WebUI Dashboard](WebUI-Dashboard.md).
- Circuit breaker status grid
- Budget usage charts (recharts)
- Provider health matrix
- WebSocket real-time updates

### 8. Copilot Usage Tracking
Tracks GitHub Copilot usage percentage and auto-disables the provider when quota is exceeded. Free Copilot models (gpt-5-mini, gpt-4.1) are still allowed even when provider is disabled.

### 9. Deadlock Detection
Background agent deadlock detection — force-terminates stuck agents after stability resets.

---

## Philosophy

> "Free models should be INTERLEAVED with premium, not last resort. The goal is proportionate usage so premium credits LAST the entire billing period. We are NOT trying to exhaust premium first and get stuck with low-quality free models for x remaining days."

---

## What We Don't Change

- Core plugin architecture (hooks, tools, agents, MCPs)
- Claude Code compatibility layer
- Skill system
- CLI installer/doctor
- Upstream agent definitions (sisyphus, oracle, librarian, etc.)

We ADD budget awareness on top of the existing system.

---

*Last updated: 2026-02-03*
