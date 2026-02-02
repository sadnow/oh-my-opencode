import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import {
  recordModelFailure,
  isModelFailed,
  isModelFailedByProvider,
  getFailedModelsForProvider,
  clearModelFailure,
  clearProviderFailures,
  clearAllFailures,
  getFailureCacheStats,
  isModelUnavailableError,
  __resetModelFailureCache,
} from "./model-failure-cache"

describe("model-failure-cache", () => {
  beforeEach(() => {
    __resetModelFailureCache()
    // Also clear any persisted data
    clearAllFailures()
  })

  afterEach(() => {
    clearAllFailures()
    __resetModelFailureCache()
  })

  describe("isModelUnavailableError", () => {
    it("should detect 'model not supported' errors", () => {
      expect(isModelUnavailableError("The requested model is not supported")).toBe(true)
      expect(isModelUnavailableError("Model not supported for this account")).toBe(true)
    })

    it("should detect 'model not available' errors", () => {
      expect(isModelUnavailableError("Model is not available")).toBe(true)
      expect(isModelUnavailableError("The model is not available in your region")).toBe(true)
    })

    it("should detect 'model not enabled' errors", () => {
      expect(isModelUnavailableError("Model not enabled for this workspace")).toBe(true)
    })

    it("should detect 'model disabled' errors", () => {
      expect(isModelUnavailableError("This model has been disabled")).toBe(true)
    })

    it("should NOT detect transient errors", () => {
      expect(isModelUnavailableError("Connection timeout")).toBe(false)
      expect(isModelUnavailableError("Rate limit exceeded")).toBe(false)
      expect(isModelUnavailableError("Internal server error")).toBe(false)
      expect(isModelUnavailableError("Network error")).toBe(false)
    })
  })

  describe("recordModelFailure", () => {
    it("should record model unavailable errors", () => {
      const result = recordModelFailure(
        "github-copilot/claude-opus-4.5",
        "The requested model is not supported"
      )
      expect(result).toBe(true)
      expect(isModelFailed("github-copilot/claude-opus-4.5")).toBe(true)
    })

    it("should NOT record transient errors", () => {
      const result = recordModelFailure(
        "github-copilot/claude-opus-4.5",
        "Connection timeout"
      )
      expect(result).toBe(false)
      expect(isModelFailed("github-copilot/claude-opus-4.5")).toBe(false)
    })

    it("should increment failure count on repeated failures", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      
      const stats = getFailureCacheStats()
      expect(stats.totalFailures).toBe(1) // Still one model, but count incremented
    })
  })

  describe("isModelFailed", () => {
    it("should return false for models not in cache", () => {
      expect(isModelFailed("github-copilot/gpt-5.2")).toBe(false)
    })

    it("should return true for failed models", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      expect(isModelFailed("github-copilot/claude-opus-4.5")).toBe(true)
    })
  })

  describe("isModelFailedByProvider", () => {
    it("should check failure by provider and model ID", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      
      expect(isModelFailedByProvider("github-copilot", "claude-opus-4.5")).toBe(true)
      expect(isModelFailedByProvider("github-copilot", "gpt-5.2")).toBe(false)
      expect(isModelFailedByProvider("anthropic", "claude-opus-4.5")).toBe(false)
    })
  })

  describe("getFailedModelsForProvider", () => {
    it("should return failed models for a specific provider", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      recordModelFailure("github-copilot/gpt-5.2-codex", "Model not available")
      recordModelFailure("anthropic/claude-opus-4.5", "Model disabled")
      
      const copilotFailures = getFailedModelsForProvider("github-copilot")
      expect(copilotFailures).toContain("claude-opus-4.5")
      expect(copilotFailures).toContain("gpt-5.2-codex")
      expect(copilotFailures).not.toContain("anthropic/claude-opus-4.5")
      
      const anthropicFailures = getFailedModelsForProvider("anthropic")
      expect(anthropicFailures).toContain("claude-opus-4.5")
      expect(anthropicFailures.length).toBe(1)
    })

    it("should return empty array for provider with no failures", () => {
      const failures = getFailedModelsForProvider("opencode-zen")
      expect(failures).toEqual([])
    })
  })

  describe("clearModelFailure", () => {
    it("should clear a specific model failure", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      expect(isModelFailed("github-copilot/claude-opus-4.5")).toBe(true)
      
      clearModelFailure("github-copilot/claude-opus-4.5")
      expect(isModelFailed("github-copilot/claude-opus-4.5")).toBe(false)
    })
  })

  describe("clearProviderFailures", () => {
    it("should clear all failures for a provider", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      recordModelFailure("github-copilot/gpt-5.2-codex", "Model not available")
      recordModelFailure("anthropic/claude-opus-4.5", "Model disabled")
      
      clearProviderFailures("github-copilot")
      
      expect(isModelFailed("github-copilot/claude-opus-4.5")).toBe(false)
      expect(isModelFailed("github-copilot/gpt-5.2-codex")).toBe(false)
      expect(isModelFailed("anthropic/claude-opus-4.5")).toBe(true) // Not cleared
    })
  })

  describe("clearAllFailures", () => {
    it("should clear all failures", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      recordModelFailure("anthropic/claude-opus-4.5", "Model disabled")
      
      clearAllFailures()
      
      expect(isModelFailed("github-copilot/claude-opus-4.5")).toBe(false)
      expect(isModelFailed("anthropic/claude-opus-4.5")).toBe(false)
      
      const stats = getFailureCacheStats()
      expect(stats.totalFailures).toBe(0)
    })
  })

  describe("getFailureCacheStats", () => {
    it("should return correct statistics", () => {
      recordModelFailure("github-copilot/claude-opus-4.5", "Model not supported")
      recordModelFailure("github-copilot/gpt-5.2-codex", "Model not available")
      recordModelFailure("anthropic/claude-opus-4.5", "Model disabled")
      
      const stats = getFailureCacheStats()
      
      expect(stats.totalFailures).toBe(3)
      expect(stats.failuresByProvider["github-copilot"]).toBe(2)
      expect(stats.failuresByProvider["anthropic"]).toBe(1)
      expect(stats.oldestFailure).toBeDefined()
      expect(stats.newestFailure).toBeDefined()
    })

    it("should return empty stats when no failures", () => {
      const stats = getFailureCacheStats()
      
      expect(stats.totalFailures).toBe(0)
      expect(stats.failuresByProvider).toEqual({})
      expect(stats.oldestFailure).toBeNull()
      expect(stats.newestFailure).toBeNull()
    })
  })
})
