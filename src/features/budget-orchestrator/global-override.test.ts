/**
 * Global Override Manager Tests
 *
 * Tests for the global override system including copilot model integration.
 */

import { describe, it, expect } from "bun:test"
import {
  GlobalOverrideManager,
  USE_CASE_FALLBACKS,
  type UseCase,
} from "./global-override"
import { CircuitBreaker } from "./circuit-breaker"
import { join } from "path"
import { tmpdir } from "os"

// Helper to create a fresh manager instance for each test
function createFreshManager(options?: ConstructorParameters<typeof GlobalOverrideManager>[1]): GlobalOverrideManager {
  const uniquePath = join(tmpdir(), `omo-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  return new GlobalOverrideManager(uniquePath, {
    circuitBreaker: new CircuitBreaker(join(tmpdir(), `omo-circuit-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`), {
      failureThreshold: 2,
      openTimeoutMs: 1000,
    }),
    ...options,
  })
}

describe("USE_CASE_FALLBACKS", () => {
  describe("copilot model integration", () => {
    it("includes github-copilot models in librarian fallbacks", () => {
      expect(USE_CASE_FALLBACKS.librarian).toContain("github-copilot/claude-sonnet-4.5")
      expect(USE_CASE_FALLBACKS.librarian).toContain("github-copilot/gpt-5.1-codex")
      expect(USE_CASE_FALLBACKS.librarian).toContain("github-copilot/gpt-5-mini")
    })

    it("includes github-copilot models in explorer fallbacks (high priority)", () => {
      const explorerFallbacks = USE_CASE_FALLBACKS.explorer
      expect(explorerFallbacks).toContain("github-copilot/gpt-5-mini")
      expect(explorerFallbacks).toContain("github-copilot/gpt-4.1")
      // copilot models should be positioned early for load distribution
      const miniIndex = explorerFallbacks.indexOf("github-copilot/gpt-5-mini")
      expect(miniIndex).toBeLessThan(5) // Should be in top 5
    })

    it("includes github-copilot models in quick fallbacks (high priority)", () => {
      const quickFallbacks = USE_CASE_FALLBACKS.quick
      expect(quickFallbacks).toContain("github-copilot/gpt-5-mini")
      expect(quickFallbacks).toContain("github-copilot/gpt-4.1")
      // copilot models should be positioned early for load distribution
      const miniIndex = quickFallbacks.indexOf("github-copilot/gpt-5-mini")
      expect(miniIndex).toBeLessThan(4) // Should be in top 4
    })

    it("includes github-copilot reasoning models in oracle fallbacks (lower priority)", () => {
      const oracleFallbacks = USE_CASE_FALLBACKS.oracle
      expect(oracleFallbacks).toContain("github-copilot/gpt-5.2-codex")
      expect(oracleFallbacks).toContain("github-copilot/claude-sonnet-4.5")
      // codex should come after premium models (quality first)
      const codexIndex = oracleFallbacks.indexOf("github-copilot/gpt-5.2-codex")
      const opusIndex = oracleFallbacks.indexOf("anthropic/claude-opus-4-5")
      expect(codexIndex).toBeGreaterThan(opusIndex)
    })

    it("includes github-copilot models in ultrabrain fallbacks (lower priority)", () => {
      const ultrabrainFallbacks = USE_CASE_FALLBACKS.ultrabrain
      expect(ultrabrainFallbacks).toContain("github-copilot/gpt-5.2-codex")
      expect(ultrabrainFallbacks).toContain("github-copilot/claude-sonnet-4.5")
      // copilot should come after premium quality models
      const codexIndex = ultrabrainFallbacks.indexOf("github-copilot/gpt-5.2-codex")
      const opusIndex = ultrabrainFallbacks.indexOf("anthropic/claude-opus-4-5")
      expect(codexIndex).toBeGreaterThan(opusIndex)
    })

    it("includes github-copilot models in implementation fallbacks", () => {
      expect(USE_CASE_FALLBACKS.implementation).toContain("github-copilot/claude-sonnet-4.5")
      expect(USE_CASE_FALLBACKS.implementation).toContain("github-copilot/gpt-5.2-codex")
      expect(USE_CASE_FALLBACKS.implementation).toContain("github-copilot/gpt-5-mini")
    })

    it("includes github-copilot models in orchestrator fallbacks", () => {
      expect(USE_CASE_FALLBACKS.orchestrator).toContain("github-copilot/claude-sonnet-4.5")
      expect(USE_CASE_FALLBACKS.orchestrator).toContain("github-copilot/gpt-5.2-codex")
    })

    it("has parallel-worker use case optimized for copilot", () => {
      const parallelWorker = USE_CASE_FALLBACKS["parallel-worker"]
      expect(parallelWorker).toBeDefined()
      expect(parallelWorker).toContain("github-copilot/gpt-5-mini")
      expect(parallelWorker).toContain("github-copilot/gpt-4.1")
      // copilot should be first for parallel-worker (optimal load distribution)
      expect(parallelWorker[0]).toBe("github-copilot/gpt-5-mini")
    })

    it("always has opencode/big-pickle as ultimate fallback", () => {
      const useCases = Object.keys(USE_CASE_FALLBACKS) as UseCase[]
      for (const useCase of useCases) {
        const fallbacks = USE_CASE_FALLBACKS[useCase]
        expect(fallbacks[fallbacks.length - 1]).toBe("opencode/big-pickle")
      }
    })
  })
})

describe("GlobalOverrideManager", () => {
  describe("getBestAvailableModel", () => {
    it("returns preferred model if allowed", () => {
      const manager = createFreshManager()
      const result = manager.getBestAvailableModel(
        "librarian",
        "anthropic/claude-sonnet-4-5",
        ["anthropic"]
      )
      expect(result).toBe("anthropic/claude-sonnet-4-5")
    })

    it("falls back to copilot model when primary provider disabled", () => {
      const manager = createFreshManager()
      manager.disableProvider("anthropic")
      manager.disableProvider("openai")
      manager.disableProvider("google")

      const result = manager.getBestAvailableModel(
        "librarian",
        "anthropic/claude-sonnet-4-5",
        ["github-copilot"]
      )
      expect(result).toBe("github-copilot/claude-sonnet-4.5")
    })

    it("returns an opencode model when all other providers disabled", () => {
      const manager = createFreshManager()
      manager.disableProvider("anthropic")
      manager.disableProvider("openai")
      manager.disableProvider("google")
      manager.disableProvider("github-copilot")

      const result = manager.getBestAvailableModel(
        "librarian",
        "anthropic/claude-sonnet-4-5",
        []
      )
      // Should return an opencode model since all others are disabled
      expect(result.startsWith("opencode/")).toBe(true)
    })

    it("respects available providers for copilot models", () => {
      const manager = createFreshManager()
      // github-copilot not in available providers
      const result = manager.getBestAvailableModel(
        "parallel-worker",
        undefined,
        ["google"]
      )
      // Should skip copilot (not available) and use either google or opencode
      expect(result.startsWith("github-copilot/")).toBe(false)
    })

    it("uses copilot when it is in available providers", () => {
      const manager = createFreshManager()
      const result = manager.getBestAvailableModel(
        "parallel-worker",
        undefined,
        ["github-copilot", "google"]
      )
      // Should use copilot since it's first in fallback list for parallel-worker
      expect(["github-copilot/gpt-5-mini", "github-copilot/gpt-4.1"]).toContain(result)
    })
  })

  describe("isModelAllowed", () => {
    it("allows github-copilot models when provider available", () => {
      const manager = createFreshManager()
      const result = manager.isModelAllowed(
        "github-copilot/gpt-5-mini",
        ["github-copilot"]
      )
      expect(result).toBe(true)
    })

    it("disallows github-copilot models when provider not available", () => {
      const manager = createFreshManager()
      const result = manager.isModelAllowed(
        "github-copilot/gpt-5-mini",
        ["anthropic", "google"]
      )
      expect(result).toBe(false)
    })

    it("disallows github-copilot models when provider disabled", () => {
      const manager = createFreshManager()
      manager.disableProvider("github-copilot")
      const result = manager.isModelAllowed(
        "github-copilot/gpt-5-mini",
        ["github-copilot"]
      )
      expect(result).toBe(false)
    })

    it("always allows opencode provider (no API key needed)", () => {
      const manager = createFreshManager()
      const result = manager.isModelAllowed(
        "opencode/big-pickle",
        [] // No providers available
      )
      expect(result).toBe(true)
    })
  })

  describe("provider control", () => {
    it("can disable and enable github-copilot provider", () => {
      const manager = createFreshManager()
      expect(manager.isProviderDisabled("github-copilot")).toBe(false)

      manager.disableProvider("github-copilot")
      expect(manager.isProviderDisabled("github-copilot")).toBe(true)

      manager.enableProvider("github-copilot")
      expect(manager.isProviderDisabled("github-copilot")).toBe(false)
    })

    it("tracks disabled providers in state", () => {
      const manager = createFreshManager()
      manager.disableProvider("github-copilot")
      manager.disableProvider("anthropic")

      const disabled = manager.getDisabledProviders()
      expect(disabled).toContain("github-copilot")
      expect(disabled).toContain("anthropic")
    })
  })

  describe("copilot auto-disable", () => {
    it("treats github-copilot as disabled when usage exceeds 100%", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 101 })
      })

      expect(manager.isProviderDisabled("github-copilot")).toBe(true)
      expect(manager.getDisabledProviders()).toContain("github-copilot")
    })

    it("allows github-copilot when usage is at or below 100%", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 100 })
      })

      expect(manager.isProviderDisabled("github-copilot")).toBe(false)
    })

    it("allows free copilot model when usage exceeds 100%", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 150 })
      })

      const result = manager.isModelAllowed(
        "github-copilot/gpt-5-mini",
        ["github-copilot"]
      )

      expect(result).toBe(true)
    })

    it("blocks paid copilot model when usage exceeds 100%", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 150 })
      })

      const result = manager.isModelAllowed(
        "github-copilot/gpt-5.2",
        ["github-copilot"]
      )

      expect(result).toBe(false)
    })

    it("selects free copilot models during selection when auto-disabled", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 200 })
      })

      const result = manager.getBestAvailableModel(
        "parallel-worker",
        undefined,
        ["github-copilot", "google"]
      )

      expect(["github-copilot/gpt-5-mini", "github-copilot/gpt-4.1"]).toContain(result)
    })

    it("allows free copilot models at exactly 100% usage", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 100 })
      })

      const result = manager.isModelAllowed(
        "github-copilot/gpt-5-mini",
        ["github-copilot"]
      )

      expect(result).toBe(true)
    })
  })

  describe("emergency mode", () => {
    it("blocks non-economy models in emergency mode", () => {
      const manager = createFreshManager()
      manager.setEmergencyMode(true)

      // Non-economy models should be blocked
      // Note: opencode provider is always available
      expect(manager.isModelAllowed("opencode/glm-4.7", [])).toBe(false) // no economy pattern
      expect(manager.isModelAllowed("opencode/kimi-k2-thinking", [])).toBe(false) // no economy pattern

      // Economy tier models should be allowed (have economy patterns)
      expect(manager.isModelAllowed("opencode/big-pickle", [])).toBe(true) // explicit economy
      expect(manager.isModelAllowed("opencode/qwen3-coder-flash", [])).toBe(true) // has "flash"
      expect(manager.isModelAllowed("opencode/glm-4.7-flash", [])).toBe(true) // has "flash"
    })
  })

  describe("BYOK hybrid provider integration", () => {
    it("blocks opencode/gpt-4o when openai free tier exhausted", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => ({ exhaustedProviders: ["openai"] }),
      })
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(false)
    })

    it("allows opencode/gpt-5-nano when openai free tier exhausted", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => ({ exhaustedProviders: ["openai"] }),
      })
      expect(manager.isModelAllowed("opencode/gpt-5-nano", ["opencode"])).toBe(true)
    })

    it("allows opencode/big-pickle when openai exhausted (native model)", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => ({ exhaustedProviders: ["openai"] }),
      })
      expect(manager.isModelAllowed("opencode/big-pickle", ["opencode"])).toBe(true)
    })

    it("allows opencode/gpt-4o when NOT exhausted", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => ({ exhaustedProviders: [] }),
      })
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(true)
    })

    it("blocks opencode/gemini-pro when google exhausted", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => ({ exhaustedProviders: ["google"] }),
      })
      expect(manager.isModelAllowed("opencode/gemini-pro", ["opencode"])).toBe(false)
    })

    it("allows opencode/gpt-4o when only google exhausted", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => ({ exhaustedProviders: ["google"] }),
      })
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(true)
    })

    it("allows native models when all BYOK exhausted", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => ({ exhaustedProviders: ["openai", "google"] }),
      })
      expect(manager.isModelAllowed("opencode/qwen-2.5-coder", ["opencode"])).toBe(true)
    })

    it("handles null hybridUsageProvider gracefully", () => {
      const manager = createFreshManager({
        copilotUsageProvider: () => ({ percentUsed: 0 }),
        hybridUsageProvider: () => null,
      })
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(true)
    })
  })
})
