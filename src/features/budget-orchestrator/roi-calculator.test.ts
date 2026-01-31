import { describe, it, expect } from "bun:test"
import { calculateModelCost, calculateSavings, getRoiComparison } from "./roi-calculator"
import { MODEL_TIERS } from "./tiers"

describe("roi-calculator", () => {
  describe("calculateModelCost", () => {
    it("should calculate cost for a known model with known token counts", () => {
      // Premium tier avgCostPer1M is 20
      const model = "anthropic/claude-opus-4-5"
      const inputTokens = 500_000
      const outputTokens = 500_000
      // (1,000,000 * 20) / 1,000,000 = 20
      expect(calculateModelCost(model, inputTokens, outputTokens)).toBe(20)
    })

    it("should return 0 for an unknown model when strict mode is not used (actually getModelTier returns 'standard' by default)", () => {
      // getModelTier returns 'standard' for unknown models by default
      // Standard tier avgCostPer1M is 9
      const model = "unknown/model"
      const inputTokens = 1_000_000
      const outputTokens = 0
      expect(calculateModelCost(model, inputTokens, outputTokens)).toBe(9)
    })

    it("should return 0 when tokens are 0", () => {
      const model = "anthropic/claude-opus-4-5"
      expect(calculateModelCost(model, 0, 0)).toBe(0)
    })

    it("should handle large token counts (millions)", () => {
      const model = "anthropic/claude-opus-4-5"
      const inputTokens = 10_000_000
      const outputTokens = 10_000_000
      // (20,000,000 * 20) / 1,000,000 = 400
      expect(calculateModelCost(model, inputTokens, outputTokens)).toBe(400)
    })
  })

  describe("calculateSavings", () => {
    it("should calculate savings when switching to a cheaper model", () => {
      const currentModel = "anthropic/claude-opus-4-5" // Premium: 20
      const alternativeModel = "anthropic/claude-sonnet-4-5" // Standard: 9
      const inputTokens = 1_000_000
      const outputTokens = 0

      const result = calculateSavings(currentModel, alternativeModel, inputTokens, outputTokens)
      expect(result.currentCost).toBe(20)
      expect(result.alternativeCost).toBe(9)
      expect(result.savings).toBe(11)
      expect(result.savingsPercent).toBeCloseTo(55, 5)
    })

    it("should calculate negative savings when switching to a more expensive model", () => {
      const currentModel = "anthropic/claude-sonnet-4-5" // Standard: 9
      const alternativeModel = "anthropic/claude-opus-4-5" // Premium: 20
      const inputTokens = 1_000_000
      const outputTokens = 0

      const result = calculateSavings(currentModel, alternativeModel, inputTokens, outputTokens)
      expect(result.currentCost).toBe(9)
      expect(result.alternativeCost).toBe(20)
      expect(result.savings).toBe(-11)
      expect(result.savingsPercent).toBeCloseTo(-122.22, 2)
    })

    it("should return 0 savings for the same model", () => {
      const model = "anthropic/claude-opus-4-5"
      const result = calculateSavings(model, model, 1_000_000, 0)
      expect(result.savings).toBe(0)
      expect(result.savingsPercent).toBe(0)
    })

    it("should handle unknown models (defaults to standard tier)", () => {
      const currentModel = "anthropic/claude-opus-4-5" // Premium: 20
      const alternativeModel = "unknown/model" // Standard: 9
      const result = calculateSavings(currentModel, alternativeModel, 1_000_000, 0)
      expect(result.alternativeCost).toBe(9)
      expect(result.savings).toBe(11)
    })
  })

  describe("getRoiComparison", () => {
    it("should return correct alternatives sorted by savings", () => {
      const currentModel = "anthropic/claude-opus-4-5" // Premium: 20
      const result = getRoiComparison(currentModel, 1_000_000, 0)

      expect(result.currentModel).toBe(currentModel)
      expect(result.alternatives.length).toBeGreaterThan(0)
      
      // Check sorting: first alternative should be from economy tier (highest savings)
      const firstAlt = result.alternatives[0]
      const lastAlt = result.alternatives[result.alternatives.length - 1]
      
      expect(firstAlt.savings).toBeGreaterThanOrEqual(lastAlt.savings)
      expect(firstAlt.tier).toBe("economy")
    })

    it("should exclude current model from alternatives", () => {
      const currentModel = "anthropic/claude-opus-4-5"
      const result = getRoiComparison(currentModel, 1_000_000, 0)
      
      const found = result.alternatives.find(a => a.model.toLowerCase() === currentModel.toLowerCase())
      expect(found).toBeUndefined()
    })

    it("should handle current model not in MODEL_TIERS (defaults to standard)", () => {
      const currentModel = "unknown/model" // Standard: 9
      const result = getRoiComparison(currentModel, 1_000_000, 0)
      
      expect(result.currentCost).toBe(9)
      // Should have alternatives from premium (negative savings) and budget/economy (positive savings)
      const premiumAlt = result.alternatives.find(a => a.tier === "premium")
      const economyAlt = result.alternatives.find(a => a.tier === "economy")
      
      expect(premiumAlt!.savings).toBeLessThan(0)
      expect(economyAlt!.savings).toBeGreaterThan(0)
    })
  })

  describe("Edge Cases", () => {
    it("should prevent division by zero in savingsPercent", () => {
      const currentModel = "anthropic/claude-opus-4-5"
      const alternativeModel = "anthropic/claude-sonnet-4-5"
      
      // currentCost will be 0
      const result = calculateSavings(currentModel, alternativeModel, 0, 0)
      expect(result.currentCost).toBe(0)
      expect(result.savingsPercent).toBe(0)
    })
  })
})
