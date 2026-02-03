# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Hybrid provider pricing for tracking BYOK free tier usage
  - Track daily free token usage for OpenAI and Google providers accessed through OpenCode Zen BYOK
  - Auto-disable BYOK models when daily limits exhausted
  - Fallback to subscription providers (Anthropic, Copilot) when free tier depleted
  - Native OpenCode models (big-pickle, qwen, deepseek, glm, kimi) remain always free
  
  Configuration example:
  ```json
  {
    "budget": {
      "hybrid_providers": {
        "openai": {
          "daily_free_tokens": 150000,
          "reset_time": "00:00 UTC",
          "enabled": true
        },
        "google": {
          "daily_free_tokens": 150000,
          "reset_time": "00:00 UTC",
          "enabled": true
        }
      }
    }
  }
  ```

  Behavior:
  - Daily reset at UTC midnight
  - BYOK models (opencode/gpt-4o, opencode/gemini-pro) blocked when exhausted
  - Native models (opencode/big-pickle, opencode/qwen-2.5-coder) always available
  - Automatic fallback to subscription providers

### Changed
- Budget orchestration now supports hybrid provider tracking
- Model selection logic considers provider exhaustion state

### Technical Details
- Files added:
  - `src/features/budget-orchestrator/underlying-provider.ts` - Provider detection logic
  - `src/features/budget-orchestrator/hybrid-tracker.ts` - Usage tracking implementation
  - Tests: `underlying-provider.test.ts`, `hybrid-tracker.test.ts`, `global-override.test.ts`, `hybrid-provider-integration.test.ts`
- Files modified:
  - `src/config/schema.ts` - Added `hybridProviders` config schema
  - `src/features/budget-orchestrator/global-override.ts` - Model selection integration