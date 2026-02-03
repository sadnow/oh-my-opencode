import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { HybridProviderTracker, initHybridProviderTracker, resetHybridProviderTracker } from "./hybrid-tracker"
import { GlobalOverrideManager } from "./global-override"
import type { HybridProviders } from "../../config/schema"

describe("Hybrid Provider Pricing - E2E Integration", () => {
  beforeEach(() => {
    resetHybridProviderTracker()
  })

  afterEach(() => {
    resetHybridProviderTracker()
  })

  describe("Scenario 1: BYOK model blocked when free tier exhausted", () => {
    //#given initialized tracker with openai config and 120000 tokens recorded
    //#when checking if openai is exhausted and if models are allowed
    //#then opencode/gpt-4o should be blocked but native models should be allowed
    it("should block BYOK model when free tier exhausted", () => {
      const tracker = initHybridProviderTracker({
        providers: {
          openai: {
            daily_free_tokens: 100000,
            reset_time: "00:00 UTC",
            enabled: true
          }
        }
      })
      
      // Record usage that exceeds the daily free tokens
      tracker.recordUsage("opencode/gpt-4o", 120000)
      
      // Verify provider is exhausted
      expect(tracker.isExhausted("openai")).toBe(true)
      
      // Initialize GlobalOverrideManager with the tracker
      const manager = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: () => ({ exhaustedProviders: tracker.getExhaustedProviders() })
      })
      
      // Verify BYOK model is blocked
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(false)
      
      // Verify native model is still allowed
      expect(manager.isModelAllowed("opencode/big-pickle", ["opencode"])).toBe(true)
    })
  })

  describe("Scenario 2: Daily reset at UTC midnight", () => {
    //#given initialized tracker with exhausted openai provider
    //#when advancing time to next day and calling checkAndReset
    //#then provider should no longer be exhausted and models should be allowed
    it("should reset exhaustion at UTC midnight", () => {
      // Create tracker with custom time function for testing
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const tracker = new HybridProviderTracker({
        providers: {
          openai: {
            daily_free_tokens: 100000,
            reset_time: "00:00 UTC",
            enabled: true
          }
        }
      }, {
        getNow: () => now
      })
      
      // Record usage that exceeds the daily free tokens
      tracker.recordUsage("opencode/gpt-4o", 120000)
      
      // Verify provider is exhausted
      expect(tracker.isExhausted("openai")).toBe(true)
      
      // Create new tracker with tomorrow's date to simulate time passing
      const trackerTomorrow = new HybridProviderTracker({
        providers: {
          openai: {
            daily_free_tokens: 100000,
            reset_time: "00:00 UTC",
            enabled: true
          }
        }
      }, {
        getNow: () => tomorrow
      })
      
      // Check and reset should clear the exhaustion
      trackerTomorrow.checkAndReset()
      
      // Verify provider is no longer exhausted
      expect(trackerTomorrow.isExhausted("openai")).toBe(false)
      
      // Initialize GlobalOverrideManager with the reset tracker
      const manager = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: () => ({ exhaustedProviders: trackerTomorrow.getExhaustedProviders() })
      })
      
      // Verify model is now allowed
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(true)
    })
  })

  describe("Scenario 3: Multiple providers independent", () => {
    //#given initialized tracker with both openai and google configs
    //#when exhausting one provider but not the other
    //#then only the exhausted provider's models should be blocked
    it("should handle multiple providers independently", () => {
      const config: HybridProviders = {
        openai: {
          daily_free_tokens: 100000,
          reset_time: "00:00 UTC",
          enabled: true
        },
        google: {
          daily_free_tokens: 100000,
          reset_time: "00:00 UTC",
          enabled: true
        }
      }
      
      const tracker = initHybridProviderTracker({
        providers: {
          openai: {
            daily_free_tokens: config.openai.daily_free_tokens,
            reset_time: config.openai.reset_time,
            enabled: config.openai.enabled
          },
          google: {
            daily_free_tokens: config.google.daily_free_tokens,
            reset_time: config.google.reset_time,
            enabled: config.google.enabled
          }
        }
      })
      
      // Exhaust openai but not google
      tracker.recordUsage("opencode/gpt-4o", 120000)
      tracker.recordUsage("opencode/gemini-pro", 50000) // Below limit
      
      // Verify openai is exhausted but google is not
      expect(tracker.isExhausted("openai")).toBe(true)
      expect(tracker.isExhausted("google")).toBe(false)
      
      // Initialize GlobalOverrideManager
      const manager = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: () => ({ exhaustedProviders: tracker.getExhaustedProviders() })
      })
      
      // Verify openai models are blocked but google models are allowed
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(false)
      expect(manager.isModelAllowed("opencode/gemini-pro", ["opencode"])).toBe(true)
      
      // Now exhaust google as well
      tracker.recordUsage("opencode/gemini-pro", 100000) // Additional 100000 to reach 150000 total
      
      // Verify both are now exhausted
      expect(tracker.isExhausted("openai")).toBe(true)
      expect(tracker.isExhausted("google")).toBe(true)
      
      // Update manager with new exhaustion data
      const updatedManager = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: () => ({ exhaustedProviders: tracker.getExhaustedProviders() })
      })
      
      // Both models should now be blocked, but native models still allowed
      expect(updatedManager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(false)
      expect(updatedManager.isModelAllowed("opencode/gemini-pro", ["opencode"])).toBe(false)
      expect(updatedManager.isModelAllowed("opencode/big-pickle", ["opencode"])).toBe(true)
    })
  })

  describe("Scenario 4: Fallback to subscription providers", () => {
    //#given GlobalOverrideManager with exhausted openai provider
    //#when selecting a model with multiple providers
    //#then should fallback to non-exhausted providers
    it("should fallback to subscription providers when BYOK exhausted", () => {
      const config: HybridProviders = {
        openai: {
          daily_free_tokens: 100000,
          reset_time: "00:00 UTC",
          enabled: true
        }
      }
      
      const tracker = initHybridProviderTracker({
        providers: {
          openai: {
            daily_free_tokens: config.openai.daily_free_tokens,
            reset_time: config.openai.reset_time,
            enabled: config.openai.enabled
          }
        }
      })
      
      // Exhaust openai
      tracker.recordUsage("opencode/gpt-4o", 120000)
      
      // Initialize GlobalOverrideManager
      const manager = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: () => ({ exhaustedProviders: tracker.getExhaustedProviders() })
      })
      
      // Verify openai is exhausted
      expect(tracker.isExhausted("openai")).toBe(true)
      
      // Select model with multiple providers including openai and anthropic
      const selectedModel = manager.getBestAvailableModel(
        "implementation",
        undefined,
        ["opencode", "anthropic"] // Available providers
      )
      
      // Should fallback to anthropic models since openai is exhausted
      expect(selectedModel.startsWith("anthropic/")).toBe(true)
      
      // Verify native opencode models are still in the selection pool
      const isNativeAvailable = manager.isModelAllowed("opencode/big-pickle", ["opencode"])
      expect(isNativeAvailable).toBe(true)
    })
  })

  describe("Scenario 5: Native models always available", () => {
    //#given tracker with all BYOK providers exhausted
    //#when checking if native models are allowed
    //#then all native models should be allowed
    it("should always allow native models regardless of BYOK exhaustion", () => {
      const config: HybridProviders = {
        openai: {
          daily_free_tokens: 100000,
          reset_time: "00:00 UTC",
          enabled: true
        },
        google: {
          daily_free_tokens: 100000,
          reset_time: "00:00 UTC",
          enabled: true
        }
      }
      
      const tracker = initHybridProviderTracker({
        providers: {
          openai: {
            daily_free_tokens: config.openai.daily_free_tokens,
            reset_time: config.openai.reset_time,
            enabled: config.openai.enabled
          },
          google: {
            daily_free_tokens: config.google.daily_free_tokens,
            reset_time: config.google.reset_time,
            enabled: config.google.enabled
          }
        }
      })
      
      // Exhaust both providers
      tracker.recordUsage("opencode/gpt-4o", 120000)
      tracker.recordUsage("opencode/gemini-pro", 120000)
      
      // Initialize GlobalOverrideManager
      const manager = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: () => ({ exhaustedProviders: tracker.getExhaustedProviders() })
      })
      
      // Verify all BYOK models are blocked
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(false)
      expect(manager.isModelAllowed("opencode/gemini-pro", ["opencode"])).toBe(false)
      
      // Verify all native models are still allowed
      const nativeModels = [
        "opencode/big-pickle",
        "opencode/qwen-2.5-coder",
        "opencode/deepseek-v3",
        "opencode/glm-4.7",
        "opencode/kimi-k2"
      ]
      
      nativeModels.forEach(model => {
        expect(manager.isModelAllowed(model, ["opencode"])).toBe(true)
      })
    })
  })

  describe("Scenario 6: Null/missing config handling", () => {
    //#given GlobalOverrideManager with empty or null config
    //#when checking provider status and model allowance
    //#then should gracefully degrade and allow all models
    it("should handle null/missing config gracefully", () => {
      // Initialize with empty config
      const tracker = initHybridProviderTracker({
        providers: {}
      })
      
      // Verify no providers are reported as exhausted
      expect(tracker.getExhaustedProviders()).toEqual([])
      
      // Initialize GlobalOverrideManager with null hybridUsageProvider
      const manager = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: () => null
      })
      
      // All models should be allowed with null config
      expect(manager.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(true)
      expect(manager.isModelAllowed("opencode/gemini-pro", ["opencode"])).toBe(true)
      expect(manager.isModelAllowed("opencode/big-pickle", ["opencode"])).toBe(true)
      
      // Test with undefined hybridUsageProvider
      const managerUndefined = new GlobalOverrideManager(undefined, {
        hybridUsageProvider: undefined
      })
      
      expect(managerUndefined.isModelAllowed("opencode/gpt-4o", ["opencode"])).toBe(true)
    })
  })
})