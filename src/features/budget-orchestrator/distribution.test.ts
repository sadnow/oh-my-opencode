import { describe, it, expect } from 'bun:test'
import { simulateRequests } from './simulator'

const DEFAULT_USE_CASE = 'chat'

function buildRequests(count: number, durationSteps = 1) {
  return Array.from({ length: count }, () => ({ useCase: DEFAULT_USE_CASE, durationSteps }))
}

describe('Budget Orchestrator Distribution Properties', () => {
  it('prioritizes subscription providers over API budget providers', () => {
    //#given subscription and api-budget providers with equal usage
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 2000, usagePercent: 30 },
      { provider: 'opencode', model: 'opencode/gpt-5-nano', quotaTarget: 2000, usagePercent: 30 },
    ]
    const requests = buildRequests(1200)

    //#when simulating with deterministic p2c
    const result = simulateRequests({ algorithm: 'p2c', seed: 11, providers, requests })

    //#then subscription provider is selected more often
    const anthropic = result.distribution.anthropic
    const opencode = result.distribution.opencode

    expect(anthropic.count).toBeGreaterThan(opencode.count)
    expect(anthropic.percent).toBeGreaterThan(65)
    expect(opencode.percent).toBeLessThan(35)
  })

  it('tracks distribution roughly proportional to remaining weight', () => {
    //#given providers with varied usage-based weights
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 5000, usagePercent: 20 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 5000, usagePercent: 60 },
      { provider: 'opencode', model: 'opencode/gpt-5-nano', quotaTarget: 5000, usagePercent: 20 },
    ]
    const requests = buildRequests(2000)

    //#when simulating with smooth weighted RR
    const result = simulateRequests({ algorithm: 'swrr', providers, requests })

    //#then shares stay within wide proportional bounds
    const anthropic = result.distribution.anthropic
    const copilot = result.distribution['github-copilot']
    const opencode = result.distribution.opencode

    expect(anthropic.percent).toBeGreaterThan(50)
    expect(anthropic.percent).toBeLessThan(70)
    expect(copilot.percent).toBeGreaterThan(22)
    expect(copilot.percent).toBeLessThan(40)
    expect(opencode.percent).toBeGreaterThan(8)
    expect(opencode.percent).toBeLessThan(20)
  })

  it('keeps selections within quota targets in a quota-limited scenario', () => {
    //#given conservative quota targets relative to expected share
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 800, usagePercent: 10 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 600, usagePercent: 50 },
      { provider: 'opencode', model: 'opencode/gpt-5-nano', quotaTarget: 200, usagePercent: 30 },
    ]
    const requests = buildRequests(1000)

    //#when simulating with deterministic p2c
    const result = simulateRequests({ algorithm: 'p2c', seed: 99, providers, requests })

    //#then no provider exceeds its quota target
    expect(result.distribution.anthropic.count).toBeLessThanOrEqual(800)
    expect(result.distribution['github-copilot'].count).toBeLessThanOrEqual(600)
    expect(result.distribution.opencode.count).toBeLessThanOrEqual(200)
  })

  it('maintains fairness index above 0.8 in a stable mix', () => {
    //#given a balanced mix with steady usage
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 5000, usagePercent: 25 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 5000, usagePercent: 25 },
      { provider: 'opencode', model: 'opencode/gpt-5-nano', quotaTarget: 5000, usagePercent: 25 },
    ]
    const requests = buildRequests(2000, 2)

    //#when simulating with deterministic p2c
    const result = simulateRequests({ algorithm: 'p2c', seed: 202, providers, requests })

    //#then fairness index stays high
    expect(result.fairnessIndex).toBeGreaterThan(0.8)
  })

  it('keeps copilot share between 40-60% when paired with anthropic', () => {
    //#given two subscription providers with equal usage
    const providers = [
      { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5', quotaTarget: 3000, usagePercent: 40 },
      { provider: 'github-copilot', model: 'github-copilot/gpt-4-turbo', quotaTarget: 3000, usagePercent: 40 },
    ]
    const requests = buildRequests(1500)

    //#when simulating with deterministic p2c
    const result = simulateRequests({ algorithm: 'p2c', seed: 7, providers, requests })

    //#then copilot stays in the expected range
    const copilot = result.distribution['github-copilot']
    expect(copilot.percent).toBeGreaterThan(40)
    expect(copilot.percent).toBeLessThan(60)
  })
})
