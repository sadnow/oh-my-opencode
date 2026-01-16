/**
 * Tests for Rate Limit Handler
 */

import { describe, it, expect, beforeEach } from "bun:test"
import {
  isRateLimitError,
  extractProvider,
  getCooldownMs,
  recordRateLimitHit,
  recordSuccess,
  isProviderAvailable,
  getFallbackProvider,
  getModelWithFallback,
  COOLDOWN_MS,
  HALF_OPEN_SUCCESS_THRESHOLD,
  BLOCKED_PROVIDERS,
  PROVIDER_FALLBACK_CHAIN,
  type RateLimitState,
} from "./rate-limit-handler"

describe("rate-limit-handler", () => {
  let emptyState: RateLimitState

  beforeEach(() => {
    emptyState = {
      providers: {},
      lastUpdated: Date.now(),
      version: 1,
    }
  })

  describe("isRateLimitError", () => {
    it("should detect 429 status code", () => {
      expect(isRateLimitError({ status: 429 })).toBe(true)
      expect(isRateLimitError({ statusCode: 429 })).toBe(true)
    })

    it("should detect 429 in message", () => {
      expect(isRateLimitError({ message: "Error: 429 Too Many Requests" })).toBe(true)
    })

    it("should detect Anthropic rate_limit_error format", () => {
      const anthropicError = {
        type: "error",
        error: {
          type: "rate_limit_error",
          message: "This request would exceed your account's rate limit.",
        },
      }
      expect(isRateLimitError(anthropicError)).toBe(true)
    })

    it("should detect nested rate_limit_error", () => {
      const nestedError = {
        error: {
          type: "rate_limit_error",
        },
      }
      expect(isRateLimitError(nestedError)).toBe(true)
    })

    it("should detect rate_limit in string", () => {
      expect(isRateLimitError("rate_limit exceeded")).toBe(true)
      expect(isRateLimitError("429")).toBe(true)
    })

    it("should return false for non-rate-limit errors", () => {
      expect(isRateLimitError({ status: 500 })).toBe(false)
      expect(isRateLimitError({ message: "Internal Server Error" })).toBe(false)
      expect(isRateLimitError(null)).toBe(false)
      expect(isRateLimitError(undefined)).toBe(false)
    })
  })

  describe("extractProvider", () => {
    it("should extract provider from model string", () => {
      expect(extractProvider("github-copilot/claude-sonnet-4")).toBe("github-copilot")
      expect(extractProvider("google/antigravity-gemini-3-flash")).toBe("google")
      expect(extractProvider("opencode/glm-4.7-free")).toBe("opencode")
    })

    it("should handle single-part model names", () => {
      expect(extractProvider("claude-sonnet")).toBe("claude-sonnet")
    })
  })

  describe("getCooldownMs", () => {
    it("should return 5 minutes for Anthropic", () => {
      expect(getCooldownMs("anthropic")).toBe(COOLDOWN_MS.anthropic)
      expect(getCooldownMs("anthropic-beta")).toBe(COOLDOWN_MS.anthropic)
    })

    it("should return 1 minute for other providers", () => {
      expect(getCooldownMs("github-copilot")).toBe(COOLDOWN_MS.default)
      expect(getCooldownMs("google")).toBe(COOLDOWN_MS.default)
      expect(getCooldownMs("opencode")).toBe(COOLDOWN_MS.default)
    })
  })

  describe("recordRateLimitHit", () => {
    it("should create open circuit for new provider", () => {
      const newState = recordRateLimitHit(emptyState, "github-copilot")

      expect(newState.providers["github-copilot"]).toBeDefined()
      expect(newState.providers["github-copilot"].circuitState).toBe("open")
      expect(newState.providers["github-copilot"].hitCount).toBe(1)
    })

    it("should increment hit count for existing provider", () => {
      let state = recordRateLimitHit(emptyState, "github-copilot")
      state = recordRateLimitHit(state, "github-copilot")

      expect(state.providers["github-copilot"].hitCount).toBe(2)
    })

    it("should set correct cooldown for Anthropic", () => {
      const state = recordRateLimitHit(emptyState, "anthropic")
      const now = Date.now()

      expect(state.providers["anthropic"].cooldownUntil).toBeGreaterThan(
        now + COOLDOWN_MS.anthropic - 1000
      )
    })
  })

  describe("recordSuccess", () => {
    it("should increment consecutive successes in half_open state", () => {
      const state: RateLimitState = {
        ...emptyState,
        providers: {
          "github-copilot": {
            provider: "github-copilot",
            circuitState: "half_open",
            lastHitAt: Date.now() - 60000,
            hitCount: 1,
            cooldownUntil: Date.now() - 1000,
            consecutiveSuccesses: 0,
          },
        },
      }

      const newState = recordSuccess(state, "github-copilot")
      expect(newState.providers["github-copilot"].consecutiveSuccesses).toBe(1)
    })

    it("should transition to closed after threshold successes", () => {
      const state: RateLimitState = {
        ...emptyState,
        providers: {
          "github-copilot": {
            provider: "github-copilot",
            circuitState: "half_open",
            lastHitAt: Date.now() - 60000,
            hitCount: 1,
            cooldownUntil: Date.now() - 1000,
            consecutiveSuccesses: HALF_OPEN_SUCCESS_THRESHOLD - 1,
          },
        },
      }

      const newState = recordSuccess(state, "github-copilot")
      expect(newState.providers["github-copilot"].circuitState).toBe("closed")
    })
  })

  describe("isProviderAvailable", () => {
    it("should return true for unknown providers", () => {
      expect(isProviderAvailable(emptyState, "github-copilot")).toBe(true)
    })

    it("should return false for blocked providers", () => {
      expect(isProviderAvailable(emptyState, "anthropic")).toBe(false)
    })

    it("should return false for open circuit", () => {
      const state: RateLimitState = {
        ...emptyState,
        providers: {
          "github-copilot": {
            provider: "github-copilot",
            circuitState: "open",
            lastHitAt: Date.now(),
            hitCount: 1,
            cooldownUntil: Date.now() + 60000,
            consecutiveSuccesses: 0,
          },
        },
      }

      expect(isProviderAvailable(state, "github-copilot")).toBe(false)
    })

    it("should return true for closed circuit", () => {
      const state: RateLimitState = {
        ...emptyState,
        providers: {
          "github-copilot": {
            provider: "github-copilot",
            circuitState: "closed",
            lastHitAt: Date.now() - 60000,
            hitCount: 0,
            cooldownUntil: Date.now() - 1000,
            consecutiveSuccesses: 0,
          },
        },
      }

      expect(isProviderAvailable(state, "github-copilot")).toBe(true)
    })

    it("should return true when cooldown expired", () => {
      const state: RateLimitState = {
        ...emptyState,
        providers: {
          "github-copilot": {
            provider: "github-copilot",
            circuitState: "open",
            lastHitAt: Date.now() - 120000,
            hitCount: 1,
            cooldownUntil: Date.now() - 1000, // expired
            consecutiveSuccesses: 0,
          },
        },
      }

      expect(isProviderAvailable(state, "github-copilot")).toBe(true)
    })
  })

  describe("getFallbackProvider", () => {
    it("should return first available provider", () => {
      expect(getFallbackProvider(emptyState)).toBe(PROVIDER_FALLBACK_CHAIN[0])
    })

    it("should skip rate-limited providers", () => {
      const state: RateLimitState = {
        ...emptyState,
        providers: {
          "github-copilot": {
            provider: "github-copilot",
            circuitState: "open",
            lastHitAt: Date.now(),
            hitCount: 1,
            cooldownUntil: Date.now() + 60000,
            consecutiveSuccesses: 0,
          },
        },
      }

      const fallback = getFallbackProvider(state, "github-copilot")
      expect(fallback).not.toBe("github-copilot")
      expect(fallback).toBe("google") // Next in chain
    })

    it("should skip excluded provider", () => {
      const fallback = getFallbackProvider(emptyState, "github-copilot")
      expect(fallback).not.toBe("github-copilot")
    })
  })

  describe("getModelWithFallback", () => {
    it("should return original model if provider available", () => {
      const result = getModelWithFallback(emptyState, "github-copilot/claude-sonnet-4")

      expect(result.model).toBe("github-copilot/claude-sonnet-4")
      expect(result.didFallback).toBe(false)
    })

    it("should fallback when provider is rate limited", () => {
      const state: RateLimitState = {
        ...emptyState,
        providers: {
          "github-copilot": {
            provider: "github-copilot",
            circuitState: "open",
            lastHitAt: Date.now(),
            hitCount: 1,
            cooldownUntil: Date.now() + 60000,
            consecutiveSuccesses: 0,
          },
        },
      }

      const result = getModelWithFallback(state, "github-copilot/claude-sonnet-4")

      expect(result.didFallback).toBe(true)
      expect(result.provider).toBe("google")
    })

    it("should always fallback for blocked providers", () => {
      const result = getModelWithFallback(emptyState, "anthropic/claude-opus-4-5")

      expect(result.didFallback).toBe(true)
      expect(result.provider).not.toBe("anthropic")
    })
  })

  describe("BLOCKED_PROVIDERS", () => {
    it("should include anthropic", () => {
      expect(BLOCKED_PROVIDERS.has("anthropic")).toBe(true)
    })
  })

  describe("PROVIDER_FALLBACK_CHAIN", () => {
    it("should have github-copilot first", () => {
      expect(PROVIDER_FALLBACK_CHAIN[0]).toBe("github-copilot")
    })

    it("should include all main providers", () => {
      expect(PROVIDER_FALLBACK_CHAIN).toContain("github-copilot")
      expect(PROVIDER_FALLBACK_CHAIN).toContain("google")
      expect(PROVIDER_FALLBACK_CHAIN).toContain("opencode")
    })

    it("should NOT include anthropic (blocked)", () => {
      expect(PROVIDER_FALLBACK_CHAIN).not.toContain("anthropic")
    })
  })
})
