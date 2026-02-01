import { describe, it, expect, beforeEach } from "bun:test"
import { toCanonicalProviderId } from "./provider-id-mapping"
import { ProviderWeightCalculator, resetWeightCalculator } from "./provider-weight-calculator"

describe("Subscription Priority Integration", () => {
  beforeEach(() => {
    resetWeightCalculator()
  })

  describe("provider ID mapping", () => {
    //#given legacy subscription tracker keys
    //#when converting to canonical IDs
    //#then returns provider IDs matching model prefixes
    it("maps claude-max to anthropic", () => {
      expect(toCanonicalProviderId("claude-max")).toBe("anthropic")
    })

    it("maps copilot to github-copilot", () => {
      expect(toCanonicalProviderId("copilot")).toBe("github-copilot")
    })
  })

  describe("weight calculation favors subscriptions", () => {
    //#given subscription and API providers with equal usage
    //#when calculating weights
    //#then subscription provider has higher weight
    it("subscription provider gets 4x weight over API at equal usage", () => {
      const calculator = new ProviderWeightCalculator()
      
      // Both at 0% usage
      const subscriptionWeight = calculator.calculateWeight("anthropic", 0)
      const apiWeight = calculator.calculateWeight("opencode", 0)
      
      // Subscription: 1.0 * 2.0 = 2.0
      // API: 1.0 * 0.5 = 0.5
      expect(subscriptionWeight).toBe(2.0)
      expect(apiWeight).toBe(0.5)
      expect(subscriptionWeight / apiWeight).toBe(4)
    })
  })

  describe("weighted selection prefers subscription", () => {
    //#given both subscription and API providers available
    //#when subscription at 50% and API at 0%
    //#then subscription is still selected due to priority multiplier
    it("selects subscription even at higher usage due to priority", () => {
      const calculator = new ProviderWeightCalculator()
      
      const candidates = calculator.buildCandidates(
        ["anthropic/claude-opus-4-5", "opencode/claude-opus-4-5"],
        { anthropic: 50, opencode: 0 }  // Subscription at 50%, API at 0%
      )
      
      const selected = calculator.selectBestProvider(candidates)
      
      // Subscription: 0.5 * 2.0 = 1.0
      // API: 1.0 * 0.5 = 0.5
      // Subscription still wins!
      expect(selected?.provider).toBe("anthropic")
    })
  })
})
