import { describe, it, expect, beforeEach } from 'bun:test'
import { ProviderWeightCalculator } from './provider-weight-calculator'
import type { WeightCandidate } from './provider-classification'

describe('Weighted Distribution Integration Tests', () => {
  let calculator: ProviderWeightCalculator

  beforeEach(() => {
    calculator = new ProviderWeightCalculator()
    calculator.reset()
  })

  /**
   * Helper function to run a simulation of N provider selections
   * and count the distribution of selections across candidates.
   */
  function runSimulation(
    candidates: Array<{
      model: string
      provider: string
      usagePercent: number
      daysUntilReset?: number
    }>,
    iterations: number
  ): Map<string, number> {
    const counts = new Map<string, number>()

    for (let i = 0; i < iterations; i++) {
      // Build candidates with weights
      const weightedCandidates = calculator.buildCandidates(
        candidates.map(c => c.model),
        Object.fromEntries(candidates.map(c => [c.provider, c.usagePercent])),
        candidates.some(c => c.daysUntilReset !== undefined)
          ? Object.fromEntries(
              candidates
                .filter(c => c.daysUntilReset !== undefined)
                .map(c => [c.provider, c.daysUntilReset!])
            )
          : undefined
      )

      // Select best provider
      const selected = calculator.selectBestProvider(weightedCandidates)

      if (selected) {
        counts.set(selected.model, (counts.get(selected.model) || 0) + 1)
      }
    }

    return counts
  }

  it('should distribute selections proportionally to weights with equal usage', () => {
    //#given two providers with equal usage
    const candidates = [
      { model: 'anthropic/claude-sonnet-4', provider: 'anthropic', usagePercent: 50 },
      { model: 'github-copilot/gpt-4-turbo', provider: 'github-copilot', usagePercent: 50 },
      { model: 'opencode/gpt-5-nano', provider: 'opencode', usagePercent: 50 },
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then subscriptions should get more selections than API budget
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0
    const copilotCount = counts.get('github-copilot/gpt-4-turbo') || 0
    const opencodeCount = counts.get('opencode/gpt-5-nano') || 0

    // Total weight: 2.0 + 2.0 + 0.5 = 4.5
    // Anthropic: 2.0/4.5 ≈ 44%
    // Copilot: 2.0/4.5 ≈ 44%
    // OpenCode: 0.5/4.5 ≈ 11%

    expect(anthropicCount).toBeGreaterThan(350) // ~44% ± 10%
    expect(anthropicCount).toBeLessThan(550)
    expect(copilotCount).toBeGreaterThan(350)
    expect(copilotCount).toBeLessThan(550)
    expect(opencodeCount).toBeLessThan(200) // ~11% ± 10%
  })

  it('should prioritize subscription providers over API budget providers', () => {
    //#given subscription and API providers with equal usage
    const candidates = [
      { model: 'anthropic/claude-sonnet-4', provider: 'anthropic', usagePercent: 50 },
      { model: 'opencode/gpt-5-nano', provider: 'opencode', usagePercent: 50 },
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then subscription should get ~80% of selections
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0
    const opencodeCount = counts.get('opencode/gpt-5-nano') || 0

    // Total weight: 2.0 + 0.5 = 2.5
    // Anthropic (subscription, 2.0x): 2.0/2.5 = 80%
    // OpenCode (api-budget, 0.5x): 0.5/2.5 = 20%

    expect(anthropicCount).toBeGreaterThan(700) // ~80% ± 10%
    expect(anthropicCount).toBeLessThan(900)
    expect(opencodeCount).toBeLessThan(300) // ~20% ± 10%
  })

  it('should avoid providers with high usage (>90%)', () => {
    //#given one provider at 90% usage and one at 20% usage
    const candidates = [
      { model: 'anthropic/claude-sonnet-4', provider: 'anthropic', usagePercent: 90 },
      { model: 'github-copilot/gpt-4-turbo', provider: 'github-copilot', usagePercent: 20 },
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then high-usage provider should get very few selections
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0
    const copilotCount = counts.get('github-copilot/gpt-4-turbo') || 0

    // Anthropic: (100-90)/100 * 2.0 = 0.10 * 2.0 = 0.2
    // Copilot: (100-20)/100 * 2.0 = 0.80 * 2.0 = 1.6
    // Total: 1.8
    // Anthropic: 0.2/1.8 ≈ 11%
    // Copilot: 1.6/1.8 ≈ 89%

    expect(anthropicCount).toBeLessThan(200) // <20%
    expect(copilotCount).toBeGreaterThan(800) // >80%
  })

  it('should block API budget provider when reserve is exceeded (>80% usage)', () => {
    //#given API provider above reserve threshold and subscription provider
    const candidates = [
      { model: 'opencode/gpt-5-nano', provider: 'opencode', usagePercent: 85 },
      { model: 'anthropic/claude-sonnet-4', provider: 'anthropic', usagePercent: 50 },
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then API provider should get 0 selections (reserve protection)
    const opencodeCount = counts.get('opencode/gpt-5-nano') || 0
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0

    // OpenCode weight: 0 (reserve exceeded at 80%)
    // Anthropic weight: 0.5 * 2.0 = 1.0
    // All selections should go to Anthropic

    expect(opencodeCount).toBe(0) // Reserve protection
    expect(anthropicCount).toBe(1000) // All selections
  })

  it('should boost providers resetting soon (≤2 days)', () => {
    //#given one provider resetting in 1 day and one in 7 days
    const candidates = [
      {
        model: 'anthropic/claude-sonnet-4',
        provider: 'anthropic',
        usagePercent: 60,
        daysUntilReset: 1, // Resetting soon
      },
      {
        model: 'github-copilot/gpt-4-turbo',
        provider: 'github-copilot',
        usagePercent: 60,
        daysUntilReset: 7, // Not resetting soon
      },
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then soon-resetting provider should get more selections
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0
    const copilotCount = counts.get('github-copilot/gpt-4-turbo') || 0

    // Anthropic: 0.4 * 2.0 * 1.3 (reset bonus) = 1.04
    // Copilot: 0.4 * 2.0 * 1.0 (no bonus) = 0.8
    // Total: 1.84
    // Anthropic: 1.04/1.84 ≈ 56.5%
    // Copilot: 0.8/1.84 ≈ 43.5%

    expect(anthropicCount).toBeGreaterThan(500) // >50%
    expect(copilotCount).toBeLessThan(500) // <50%

    // Verify the boost is meaningful
    expect(anthropicCount).toBeGreaterThan(copilotCount)
  })

  it('should handle edge case: all providers exhausted (fallback to least exhausted)', () => {
    //#given all providers at high usage
    const candidates = [
      { model: 'anthropic/claude-sonnet-4', provider: 'anthropic', usagePercent: 95 },
      { model: 'github-copilot/gpt-4-turbo', provider: 'github-copilot', usagePercent: 98 },
      { model: 'opencode/gpt-5-nano', provider: 'opencode', usagePercent: 85 }, // Above reserve
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then least exhausted provider should get most selections
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0
    const copilotCount = counts.get('github-copilot/gpt-4-turbo') || 0
    const opencodeCount = counts.get('opencode/gpt-5-nano') || 0

    // OpenCode: 0 (reserve exceeded)
    // Anthropic: 0.05 * 2.0 = 0.1
    // Copilot: 0.02 * 2.0 = 0.04
    // Anthropic should get most selections

    expect(opencodeCount).toBe(0) // Reserve protection
    expect(anthropicCount).toBeGreaterThan(copilotCount) // Least exhausted wins
  })

  it('should handle single candidate (always select it)', () => {
    //#given only one candidate
    const candidates = [
      { model: 'anthropic/claude-sonnet-4', provider: 'anthropic', usagePercent: 50 },
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then all selections go to the only candidate
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0

    expect(anthropicCount).toBe(1000)
  })

  it('should handle zero-weight candidates gracefully', () => {
    //#given all API providers above reserve threshold
    const candidates = [
      { model: 'opencode/gpt-5-nano', provider: 'opencode', usagePercent: 90 },
      { model: 'anthropic/claude-sonnet-4', provider: 'anthropic', usagePercent: 50 },
    ]

    //#when running 1000 selections
    const counts = runSimulation(candidates, 1000)

    //#then only the valid candidate gets selected
    const opencodeCount = counts.get('opencode/gpt-5-nano') || 0
    const anthropicCount = counts.get('anthropic/claude-sonnet-4') || 0

    expect(opencodeCount).toBe(0) // Zero weight
    expect(anthropicCount).toBe(1000) // All valid selections
  })
})
