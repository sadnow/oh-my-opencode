import { describe, it, expect } from 'bun:test'
import { simulateRequests, type SimulationDistributionEntry } from './simulator'

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
})
