import { describe, it, expect } from 'bun:test'
import { simulateRequests, type SimulationDistributionEntry } from './simulator'
import { ProviderWeightCalculator } from './provider-weight-calculator'

describe('Budget Orchestrator Simulator', () => {
  it('replays deterministically with a fixed seed', () => {
    //#given a fixed request sequence and seed
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 100 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 100 },
    ]
    const requests = Array.from({ length: 50 }, () => ({ useCase: 'chat', durationSteps: 2 }))

    //#when running the simulator twice with the same seed
    const first = simulateRequests({ algorithm: 'p2c', seed: 123, providers, requests })
    const second = simulateRequests({ algorithm: 'p2c', seed: 123, providers, requests })

    //#then selections and metrics are identical
    expect(first.selections).toEqual(second.selections)
    expect(first.fairnessIndex).toBeCloseTo(second.fairnessIndex, 10)
  })

  it('reports distribution percentages that sum to 100%', () => {
    //#given a basic request sequence
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 100 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 100 },
      { provider: 'opencode', model: 'opencode/gpt-5-nano', quotaTarget: 100 },
    ]
    const requests = Array.from({ length: 120 }, () => ({ useCase: 'chat' }))

    //#when simulating with SWRR
    const result = simulateRequests({ algorithm: 'swrr', providers, requests })
    const entries = Object.values(result.distribution) as SimulationDistributionEntry[]
    const total = entries.reduce((sum, entry) => sum + entry.percent, 0)

    //#then percentages add up to 100
    expect(total).toBeCloseTo(100, 6)
  })

  it('changes selection behavior when switching algorithms', () => {
    //#given an imbalanced active request state
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 100 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 100 },
    ]
    const requests = Array.from({ length: 5 }, () => ({ useCase: 'chat' }))

    //#when using SWRR vs WLC
    const swrr = simulateRequests({
      algorithm: 'swrr',
      providers,
      requests,
      initialActiveRequests: { anthropic: 10 },
    })
    const wlc = simulateRequests({
      algorithm: 'wlc',
      providers,
      requests,
      initialActiveRequests: { anthropic: 10 },
    })

    //#then the first selection differs
    expect(swrr.selections[0]?.provider).toBe('anthropic')
    expect(wlc.selections[0]?.provider).toBe('github-copilot')
  })

  it('reports the step where quota is exhausted', () => {
    //#given a single provider with a small quota target
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 3 },
    ]
    const requests = Array.from({ length: 5 }, () => ({ useCase: 'chat' }))

    //#when simulating
    const result = simulateRequests({ algorithm: 'swrr', providers, requests })

    //#then exhaustion is recorded at the correct step
    expect(result.quotaExhaustion.anthropic?.step).toBe(3)
  })

  it('keeps fairness index stable across deterministic replays', () => {
    //#given a fixed request sequence
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 100 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 100 },
      { provider: 'opencode', model: 'opencode/gpt-5-nano', quotaTarget: 100 },
    ]
    const requests = Array.from({ length: 80 }, () => ({ useCase: 'chat', durationSteps: 2 }))

    //#when replaying with the same seed
    const first = simulateRequests({ algorithm: 'p2c', seed: 42, providers, requests })
    const second = simulateRequests({ algorithm: 'p2c', seed: 42, providers, requests })

    //#then fairness index is identical
    expect(first.fairnessIndex).toBeCloseTo(second.fairnessIndex, 10)
  })

  describe('Velocity-based exhaustion balancing', () => {
    it('balances provider exhaustion timing with velocity adjustment', () => {
      //#given two providers with same usage but different velocities
      const calculator = new ProviderWeightCalculator()

      // Provider A: fast (10%/day), Provider B: slow (2%/day)
      const providerKeys = ['providerA', 'providerB'] as const
      type ProviderKey = (typeof providerKeys)[number]
      const models = ['providerA/model-a', 'providerB/model-b']
      let usageA = 50
      let usageB = 50
      const velocityA = 10.0
      const velocityB = 2.0

      //#when simulating 30 days
      const selections: Record<ProviderKey, number> = { providerA: 0, providerB: 0 }

      for (let day = 0; day < 30; day++) {
        for (let i = 0; i < 100; i++) {
          const candidates = calculator.buildCandidates(
            models,
            { providerA: usageA, providerB: usageB },
            { providerA: 30 - day, providerB: 30 - day },
            { providerA: velocityA, providerB: velocityB }
          )
          const selected = calculator.selectBestProvider(candidates)
          if (selected && providerKeys.includes(selected.provider as ProviderKey)) {
            selections[selected.provider as ProviderKey]++
          }
        }

        // Update usage based on load distribution
        const loadA = selections.providerA / ((day + 1) * 100)
        const loadB = selections.providerB / ((day + 1) * 100)
        usageA = Math.min(100, usageA + velocityA * loadA)
        usageB = Math.min(100, usageB + velocityB * loadB)
      }

      //#then calculate days to exhaustion
      const daysA =
        usageA >= 100
          ? 30
          : 30 + (100 - usageA) / (velocityA * selections.providerA / 3000)
      const daysB =
        usageB >= 100
          ? 30
          : 30 + (100 - usageB) / (velocityB * selections.providerB / 3000)

      //#and coefficient of variation should be < 0.3
      const mean = (daysA + daysB) / 2
      const cv =
        Math.sqrt((Math.pow(daysA - mean, 2) + Math.pow(daysB - mean, 2)) / 2) /
        mean
      expect(cv).toBeLessThan(0.3)
    })
  })
})
