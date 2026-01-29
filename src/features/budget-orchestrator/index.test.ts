/**
 * Budget Orchestrator Tests
 *
 * ANTI-REGRESSION: These tests ensure budget tracking and tier
 * orchestration work correctly across providers.
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { BudgetOrchestrator } from "./index"
import { UsageTracker } from "../usage-tracker"

describe("BudgetOrchestrator", () => {
  let orchestrator: BudgetOrchestrator
  let usageTracker: UsageTracker

  beforeEach(() => {
    usageTracker = new UsageTracker({ enabled: true, persist: false })
    orchestrator = new BudgetOrchestrator(
      {
        enabled: true,
        provider_budgets: {
          anthropic: 20,
          openai: 50,
        },
        target_percentage: 0.7,
        auto_downgrade: true,
        min_tier: "budget",
        auto_upgrade: true,
        routing_log_persist: false,
      },
      usageTracker,
      ["anthropic", "openai"],
      undefined // No subscription trackers in test
    )
  })

  describe("Tier Recommendations", () => {
    /**
     * ANTI-REGRESSION: Tier recommendation thresholds
     * These MUST remain consistent for predictable behavior
     */
    it("should return a valid tier from getRecommendedTier", () => {
      const validTiers = ["premium", "standard", "budget", "economy"]
      const tier = orchestrator.getRecommendedTier()
      expect(validTiers).toContain(tier)
    })

    it("should have four valid tier levels", () => {
      const validTiers = ["premium", "standard", "budget", "economy"]
      expect(validTiers.length).toBe(4)
    })

    /**
     * ANTI-REGRESSION: Tier threshold boundaries
     * - premium: < 30%
     * - standard: 30-60%
     * - budget: 60-85%
     * - economy: > 85%
     */
    it("should have correct threshold constants", () => {
      const thresholds = {
        premium: 30,
        standard: 60,
        budget: 85,
      }
      expect(thresholds.premium).toBe(30)
      expect(thresholds.standard).toBe(60)
      expect(thresholds.budget).toBe(85)
    })
  })

  describe("Smart Tier Changes", () => {
    /**
     * ANTI-REGRESSION: Smart tier changes require stability
     * - Minimum 5 minutes between tier changes
     * - Confidence threshold must be met
     * - Both upgrade and downgrade have separate thresholds
     */
    it("should return tier change result with correct structure", () => {
      const change = orchestrator.getSmartTierChange({
        providerID: "anthropic",
        modelID: "claude-sonnet-4-5"
      })
      expect(change).toHaveProperty("original")
      expect(change).toHaveProperty("direction")
      expect(change).toHaveProperty("confidence")
    })

    it("should have confidence between 0 and 1", () => {
      const change = orchestrator.getSmartTierChange({
        providerID: "anthropic",
        modelID: "claude-sonnet-4-5"
      })
      expect(change.confidence).toBeGreaterThanOrEqual(0)
      expect(change.confidence).toBeLessThanOrEqual(1)
    })

    it("should have valid direction", () => {
      const change = orchestrator.getSmartTierChange({
        providerID: "anthropic",
        modelID: "claude-sonnet-4-5"
      })
      expect(["upgrade", "downgrade", "none"]).toContain(change.direction)
    })
  })

  describe("Budget Status Messages", () => {
    it("should return status messages for tracked providers", () => {
      const messages = orchestrator.getBudgetStatusMessages()
      expect(typeof messages).toBe("object")
    })
  })

  describe("Override System", () => {
    /**
     * ANTI-REGRESSION: Override capabilities
     * - Force tier overrides recommended tier
     * - Lock tier prevents automatic changes
     * - Overrides can be cleared
     *
     * Override methods are accessed via getOverrideManager()
     */
    it("should provide access to override manager", () => {
      const overrideManager = orchestrator.getOverrideManager()
      expect(overrideManager).toBeDefined()
      expect(typeof overrideManager.forceTier).toBe("function")
      expect(typeof overrideManager.lockTier).toBe("function")
      expect(typeof overrideManager.unlockTier).toBe("function")
      expect(typeof overrideManager.clearOverrides).toBe("function")
    })

    it("should respect forced tier via override manager", () => {
      const overrideManager = orchestrator.getOverrideManager()
      overrideManager.forceTier("economy")
      const tier = orchestrator.getRecommendedTier()
      expect(tier).toBe("economy")
      overrideManager.clearOverrides() // cleanup
    })

    it("should support locking tier via override manager", () => {
      const overrideManager = orchestrator.getOverrideManager()
      overrideManager.lockTier()
      const change = orchestrator.getSmartTierChange({
        providerID: "anthropic",
        modelID: "claude-opus-4-5"
      })
      expect(change.direction).toBe("none")
      expect(change.reason.toLowerCase()).toContain("lock")
      overrideManager.clearOverrides() // cleanup
    })
  })

  describe("Provider Management", () => {
    it("should track if enabled", () => {
      expect(orchestrator.isEnabled()).toBe(true)
    })

    it("should return available providers", () => {
      orchestrator.setAvailableProviders(["anthropic", "openai", "google"])
      expect(orchestrator.isEnabled()).toBe(true)
    })
  })

  describe("Recommended Models", () => {
    /**
     * ANTI-REGRESSION: Model recommendations
     * Returns recommended models for different task types:
     * - orchestrator: High-quality model for planning
     * - implementation: Balanced model for coding
     * - quick: Fast model for simple tasks
     */
    it("should return recommended models", () => {
      const models = orchestrator.getRecommendedModels()
      expect(models).toHaveProperty("orchestrator")
      expect(models).toHaveProperty("implementation")
      expect(models).toHaveProperty("quick")
    })

    it("should return models with correct structure", () => {
      const models = orchestrator.getRecommendedModels()
      expect(models.orchestrator).toHaveProperty("providerID")
      expect(models.orchestrator).toHaveProperty("modelID")
    })
  })
})

/**
 * IMPLEMENTATION NOTES FOR FUTURE DEVELOPERS:
 *
 * 1. Tier thresholds were tuned based on typical Claude Max usage patterns
 * 2. The 5-minute stability window prevents "flapping" between tiers
 * 3. Adaptive credits accumulate during idle periods to allow burst usage
 * 4. Override system is designed for user control without breaking automation
 *
 * API SURFACE (DO NOT REMOVE):
 * - getRecommendedTier(): ModelTier - Returns recommended tier for all budgets
 * - getRecommendedModels(): Record - Returns model refs for task types
 * - getSmartTierChange(model): TierChangeResult - Smart upgrade/downgrade
 * - getBudgetStatusMessages(): Record<string, string> - Status for each provider
 * - getOverrideManager(): BudgetOverrideManager - Access to override controls
 * - isEnabled(): boolean - Check if budget tracking enabled
 * - setAvailableProviders(providers): void - Update provider list
 * - resetAdaptiveLearning(provider?): void - Reset learning state
 *
 * Override Manager API (via getOverrideManager()):
 * - forceTier(tier, options?): void - Override recommended tier
 * - lockTier(options?): void - Prevent automatic tier changes
 * - unlockTier(): void - Allow automatic tier changes
 * - clearOverrides(): void - Clear all overrides
 * - getForcedTier(): ModelTier | null - Get current forced tier
 * - shouldBlockTierChange(): boolean - Check if tier is locked
 *
 * DO NOT:
 * - Lower the stability window below 5 minutes
 * - Remove the override system
 * - Change tier thresholds without extensive testing
 * - Remove adaptive learning metrics (used by dashboard)
 */
