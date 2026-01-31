import { describe, it, expect, beforeEach } from 'bun:test'
import { ProviderWeightCalculator, getWeightCalculator, resetWeightCalculator } from './provider-weight-calculator'
import { API_BUDGET_RESERVE_PERCENT } from './provider-classification'

describe('ProviderWeightCalculator', () => {
  let calculator: ProviderWeightCalculator

  beforeEach(() => {
    calculator = new ProviderWeightCalculator()
    calculator.reset()
  })

  describe('calculateWeight', () => {
    it('returns higher weight for subscription providers than API providers', () => {
      //#given same usage percentage
      const usagePercent = 50

      //#when calculating weights
      const subscriptionWeight = calculator.calculateWeight('anthropic', usagePercent)
      const apiWeight = calculator.calculateWeight('opencode', usagePercent)

      //#then subscription should have higher weight
      expect(subscriptionWeight).toBeGreaterThan(apiWeight)
      // Subscription: 0.5 * 2.0 = 1.0
      // API: 0.5 * 0.5 = 0.25
      expect(subscriptionWeight).toBeCloseTo(1.0, 2)
      expect(apiWeight).toBeCloseTo(0.25, 2)
    })

    it('returns 0 when API budget reserve is exceeded', () => {
      //#given API provider at or above reserve threshold
      const reserveThreshold = 100 - API_BUDGET_RESERVE_PERCENT // 80%

      //#when calculating weight at threshold
      const weightAtThreshold = calculator.calculateWeight('opencode', reserveThreshold)
      const weightAboveThreshold = calculator.calculateWeight('opencode', reserveThreshold + 5)

      //#then weight should be 0 (reserve protection)
      expect(weightAtThreshold).toBe(0)
      expect(weightAboveThreshold).toBe(0)
    })

    it('returns positive weight for API budget below reserve', () => {
      //#given API provider below reserve threshold
      const belowThreshold = 100 - API_BUDGET_RESERVE_PERCENT - 10 // 70%

      //#when calculating weight
      const weight = calculator.calculateWeight('opencode', belowThreshold)

      //#then weight should be positive
      expect(weight).toBeGreaterThan(0)
    })

    it('applies reset bonus for providers resetting within threshold', () => {
      //#given provider resetting in 1 day vs 7 days
      const usagePercent = 50

      //#when calculating weights
      const weightResettingSoon = calculator.calculateWeight('anthropic', usagePercent, 1)
      const weightResettingLater = calculator.calculateWeight('anthropic', usagePercent, 7)

      //#then soon-resetting provider should have higher weight
      expect(weightResettingSoon).toBeGreaterThan(weightResettingLater)
      // With reset bonus: 0.5 * 2.0 * 1.3 = 1.3
      // Without bonus: 0.5 * 2.0 * 1.0 = 1.0
      expect(weightResettingSoon).toBeCloseTo(1.3, 2)
      expect(weightResettingLater).toBeCloseTo(1.0, 2)
    })

    it('returns higher weight for providers with lower usage', () => {
      //#given same provider type with different usage
      const lowUsage = 20
      const highUsage = 80

      //#when calculating weights
      const weightLowUsage = calculator.calculateWeight('anthropic', lowUsage)
      const weightHighUsage = calculator.calculateWeight('anthropic', highUsage)

      //#then lower usage should have higher weight
      expect(weightLowUsage).toBeGreaterThan(weightHighUsage)
    })

    it('returns 0 for 100% usage', () => {
      //#given provider at 100% usage
      const fullUsage = 100

      //#when calculating weight
      const weight = calculator.calculateWeight('anthropic', fullUsage)

      //#then weight should be 0
      expect(weight).toBe(0)
    })
  })

  describe('selectBestProvider', () => {
    it('selects candidate with highest weight', () => {
      //#given candidates with different weights
      const candidates = [
        { model: 'opencode/glm-4.7', provider: 'opencode', weight: 0.25, usagePercent: 50 },
        { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1.0, usagePercent: 50 },
        { model: 'google/gemini-3-flash', provider: 'google', weight: 0.8, usagePercent: 60 },
      ]

      //#when selecting
      const selected = calculator.selectBestProvider(candidates)

      //#then highest weight wins
      expect(selected?.model).toBe('anthropic/claude-sonnet-4-5')
    })

    it('returns null for empty candidates', () => {
      //#given no candidates
      const candidates: any[] = []

      //#when selecting
      const selected = calculator.selectBestProvider(candidates)

      //#then returns null
      expect(selected).toBeNull()
    })

    it('returns null when all candidates have 0 weight', () => {
      //#given all zero-weight candidates
      const candidates = [
        { model: 'opencode/glm-4.7', provider: 'opencode', weight: 0, usagePercent: 100 },
        { model: 'anthropic/claude', provider: 'anthropic', weight: 0, usagePercent: 100 },
      ]

      //#when selecting
      const selected = calculator.selectBestProvider(candidates)

      //#then returns null
      expect(selected).toBeNull()
    })

    it('distributes selections proportionally to weights over many calls', () => {
      //#given candidates with 2:1 weight ratio
      const candidates = [
        { model: 'a/model-a', provider: 'a', weight: 2.0, usagePercent: 0 },
        { model: 'b/model-b', provider: 'b', weight: 1.0, usagePercent: 0 },
      ]

      //#when making many selections
      const selections: Record<string, number> = { 'a/model-a': 0, 'b/model-b': 0 }
      for (let i = 0; i < 300; i++) {
        const selected = calculator.selectBestProvider(candidates)
        if (selected) {
          selections[selected.model]++
        }
      }

      //#then selections should be roughly 2:1
      const ratio = selections['a/model-a'] / selections['b/model-b']
      // Allow some variance but should be close to 2:1
      expect(ratio).toBeGreaterThan(1.5)
      expect(ratio).toBeLessThan(2.5)
    })
  })

  describe('buildCandidates', () => {
    it('builds candidates with calculated weights', () => {
      //#given models and usage data
      const models = ['anthropic/claude-sonnet-4-5', 'opencode/glm-4.7']
      const usagePercent = { anthropic: 50, opencode: 50 }

      //#when building candidates
      const candidates = calculator.buildCandidates(models, usagePercent)

      //#then weights are calculated correctly
      expect(candidates).toHaveLength(2)
      expect(candidates[0].model).toBe('anthropic/claude-sonnet-4-5')
      expect(candidates[0].weight).toBeCloseTo(1.0, 2) // subscription: 0.5 * 2.0
      expect(candidates[1].model).toBe('opencode/glm-4.7')
      expect(candidates[1].weight).toBeCloseTo(0.25, 2) // api: 0.5 * 0.5
    })

    it('defaults to 0 usage for unknown providers', () => {
      //#given models with no usage data
      const models = ['unknown/model']
      const usagePercent = {}

      //#when building candidates
      const candidates = calculator.buildCandidates(models, usagePercent)

      //#then assumes 0% usage (full weight available)
      expect(candidates[0].usagePercent).toBe(0)
      expect(candidates[0].weight).toBeGreaterThan(0)
    })
  })

  describe('selectBestModel', () => {
    it('selects model with highest effective weight', () => {
      //#given models and usage where subscription has more headroom
      const models = ['anthropic/claude-sonnet-4-5', 'opencode/glm-4.7']
      const usagePercent = { anthropic: 30, opencode: 70 }

      //#when selecting
      const selected = calculator.selectBestModel(models, usagePercent)

      //#then subscription with lower usage wins
      expect(selected).toBe('anthropic/claude-sonnet-4-5')
    })

    it('falls back to first model when all weights are 0', () => {
      //#given all providers at 100% usage
      const models = ['anthropic/claude', 'opencode/glm']
      const usagePercent = { anthropic: 100, opencode: 100 }

      //#when selecting
      const selected = calculator.selectBestModel(models, usagePercent)

      //#then falls back to first model
      expect(selected).toBe('anthropic/claude')
    })

    it('throws for empty model list', () => {
      //#given empty model list
      const models: string[] = []

      //#then throws
      expect(() => calculator.selectBestModel(models, {})).toThrow()
    })
  })

  describe('singleton', () => {
    it('returns same instance', () => {
      resetWeightCalculator()
      const instance1 = getWeightCalculator()
      const instance2 = getWeightCalculator()
      expect(instance1).toBe(instance2)
    })

    it('resets instance', () => {
      const instance1 = getWeightCalculator()
      resetWeightCalculator()
      const instance2 = getWeightCalculator()
      expect(instance1).not.toBe(instance2)
    })
  })
})

describe('Provider Distribution Integration', () => {
  let calculator: ProviderWeightCalculator

  beforeEach(() => {
    calculator = new ProviderWeightCalculator()
    calculator.reset()
  })

  it('subscription providers get ~80% of selections when equally available', () => {
    //#given subscription and API providers with equal usage
    const models = [
      'anthropic/claude-sonnet-4-5',   // subscription
      'github-copilot/gpt-5-mini',     // subscription
      'opencode/glm-4.7',              // API
    ]
    const usagePercent = { anthropic: 0, 'github-copilot': 0, opencode: 0 }

    //#when making many selections
    let subscriptionSelections = 0
    let apiSelections = 0
    
    for (let i = 0; i < 1000; i++) {
      const selected = calculator.selectBestModel(models, usagePercent)
      const provider = selected.split('/')[0]
      if (provider === 'opencode') {
        apiSelections++
      } else {
        subscriptionSelections++
      }
    }

    //#then subscriptions should dominate (due to 2.0x vs 0.5x multipliers)
    const subscriptionRatio = subscriptionSelections / (subscriptionSelections + apiSelections)
    // With 2.0 + 2.0 + 0.5 = 4.5 total weight, subscriptions have 4.0/4.5 = 88%
    expect(subscriptionRatio).toBeGreaterThan(0.75)
  })

  it('provider at 90% usage gets <10% of selections', () => {
    //#given one provider near exhaustion
    const models = [
      'anthropic/claude-sonnet-4-5',
      'google/gemini-3-flash',
    ]
    const usagePercent = { anthropic: 90, google: 10 }

    //#when making many selections
    let anthropicCount = 0
    let googleCount = 0
    
    for (let i = 0; i < 1000; i++) {
      const selected = calculator.selectBestModel(models, usagePercent)
      if (selected.startsWith('anthropic')) {
        anthropicCount++
      } else {
        googleCount++
      }
    }

    //#then exhausted provider gets minimal selections
    const anthropicRatio = anthropicCount / (anthropicCount + googleCount)
    // anthropic: 0.1 * 2.0 = 0.2, google: 0.9 * 2.0 = 1.8
    // anthropic should get ~10% (0.2 / 2.0 = 10%)
    expect(anthropicRatio).toBeLessThan(0.15)
  })

  it('API provider at reserve threshold gets 0 selections', () => {
    //#given API provider at reserve threshold (80%)
    const models = [
      'anthropic/claude-sonnet-4-5',
      'opencode/glm-4.7',
    ]
    const usagePercent = { anthropic: 50, opencode: 80 } // 80% = reserve threshold

    //#when making many selections
    let opencodeCount = 0
    
    for (let i = 0; i < 100; i++) {
      const selected = calculator.selectBestModel(models, usagePercent)
      if (selected.startsWith('opencode')) {
        opencodeCount++
      }
    }

    //#then API at reserve gets 0 selections
    expect(opencodeCount).toBe(0)
  })

  it('provider resetting in 1 day gets more selections than one resetting in 7 days', () => {
    //#given two subscription providers with different reset times
    const models = [
      'anthropic/claude-sonnet-4-5',
      'google/gemini-3-flash',
    ]
    const usagePercent = { anthropic: 50, google: 50 }
    const daysUntilReset = { anthropic: 1, google: 7 }

    //#when making many selections
    let anthropicCount = 0
    let googleCount = 0
    
    for (let i = 0; i < 1000; i++) {
      const candidates = calculator.buildCandidates(models, usagePercent, daysUntilReset)
      const selected = calculator.selectBestProvider(candidates)
      if (selected?.model.startsWith('anthropic')) {
        anthropicCount++
      } else {
        googleCount++
      }
    }

    //#then soon-resetting provider gets more selections
    // anthropic: 0.5 * 2.0 * 1.3 = 1.3, google: 0.5 * 2.0 * 1.0 = 1.0
    // anthropic should get ~56.5% (1.3 / 2.3)
    const anthropicRatio = anthropicCount / (anthropicCount + googleCount)
    expect(anthropicRatio).toBeGreaterThan(0.5)
    expect(anthropicRatio).toBeLessThan(0.7)
  })
})
