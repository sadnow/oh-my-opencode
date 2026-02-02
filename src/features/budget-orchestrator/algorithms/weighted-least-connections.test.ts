import { describe, it, expect, beforeEach } from 'bun:test'
import { ProviderWeightCalculator } from '../provider-weight-calculator'
import type { WeightCandidate } from '../provider-classification'

type WeightedLeastConnectionsConstructor = new () => {
  startRequest(provider: string): void
  endRequest(provider: string): void
  acquire(provider: string): void
  release(provider: string): void
  getActiveRequests(provider: string): number
  selectBestProvider(candidates: WeightCandidate[]): WeightCandidate | null
  reset(): void
}

describe('Weighted Least Connections', () => {
  let Algorithm: WeightedLeastConnectionsConstructor
  let algorithm: InstanceType<WeightedLeastConnectionsConstructor>

  const addActive = (provider: string, count: number): void => {
    for (let i = 0; i < count; i++) {
      algorithm.startRequest(provider)
    }
  }

  const makeCandidates = (
    entries: Array<{ model: string; provider: string; weight: number; usagePercent?: number }>
  ): WeightCandidate[] =>
    entries.map(entry => ({
      model: entry.model,
      provider: entry.provider,
      weight: entry.weight,
      usagePercent: entry.usagePercent ?? 0,
    }))

  beforeEach(async () => {
    const modulePath = './weighted-least-connections'
    const mod = await import(modulePath)
    Algorithm = mod.WeightedLeastConnections as WeightedLeastConnectionsConstructor
    algorithm = new Algorithm()
  })

  it('selects provider with lowest (active / weight) ratio', () => {
    //#given candidates with different active/weight ratios
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 2 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 1 },
    ])
    addActive('anthropic', 4) // 4 / 2 = 2
    addActive('opencode', 1) // 1 / 1 = 1

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then lowest ratio wins
    expect(selected?.provider).toBe('opencode')
  })

  it('handles 0 active requests (prefers higher weight)', () => {
    //#given all providers idle
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 2 },
      { model: 'github-copilot/gpt-5-mini', provider: 'github-copilot', weight: 3 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 1 },
    ])

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then higher weight breaks the tie
    expect(selected?.provider).toBe('github-copilot')
  })

  it('selects higher weight even with slightly higher active count', () => {
    //#given weights that overcome a small active difference
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 3 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 1 },
    ])
    addActive('anthropic', 2) // 2 / 3 = 0.67
    addActive('opencode', 1) // 1 / 1 = 1

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then higher weight still wins despite higher active count
    expect(selected?.provider).toBe('anthropic')
  })

  it('tracks active request count per provider', () => {
    //#given multiple active requests per provider
    addActive('anthropic', 2)
    addActive('opencode', 1)

    //#then counts should be tracked independently
    expect(algorithm.getActiveRequests('anthropic')).toBe(2)
    expect(algorithm.getActiveRequests('opencode')).toBe(1)
    expect(algorithm.getActiveRequests('google')).toBe(0)
  })

  it('updates active count on request start/end', () => {
    //#given an active request started
    algorithm.startRequest('anthropic')

    //#when the request ends
    algorithm.endRequest('anthropic')

    //#then active count should return to zero
    expect(algorithm.getActiveRequests('anthropic')).toBe(0)
  })

  it('supports acquire/release for nested requests', () => {
    //#given nested acquires
    algorithm.acquire('anthropic')
    algorithm.acquire('anthropic')

    //#when releasing one level
    algorithm.release('anthropic')

    //#then active count should decrement but remain positive
    expect(algorithm.getActiveRequests('anthropic')).toBe(1)

    //#when releasing final level
    algorithm.release('anthropic')

    //#then active count should return to zero
    expect(algorithm.getActiveRequests('anthropic')).toBe(0)
  })

  it('never drops active count below zero', () => {
    //#given releases without matching acquires
    algorithm.release('anthropic')
    algorithm.release('anthropic')

    //#when reading the active count
    const active = algorithm.getActiveRequests('anthropic')

    //#then it should stay at zero
    expect(active).toBe(0)
  })

  it('handles tied scores (uses weight as tiebreaker)', () => {
    //#given tied ratios but different weights
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 2 },
    ])
    addActive('anthropic', 1) // 1 / 1 = 1
    addActive('opencode', 2) // 2 / 2 = 1

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then higher weight breaks tie
    expect(selected?.provider).toBe('opencode')
  })

  it('integrates with ProviderWeightCalculator', () => {
    //#given candidates built from ProviderWeightCalculator
    const calculator = new ProviderWeightCalculator()
    const models = ['anthropic/claude-sonnet-4-5', 'opencode/glm-4.7']
    const usagePercent = { anthropic: 10, opencode: 10 }
    const candidates = calculator.buildCandidates(models, usagePercent)
    addActive('anthropic', 1)
    addActive('opencode', 1)

    //#when selecting using weighted least connections
    const selected = algorithm.selectBestProvider(candidates)

    //#then higher calculated weight should win
    expect(selected?.provider).toBe('anthropic')
  })

  it('handles provider with 0 weight', () => {
    //#given a provider with zero weight
    const candidates = makeCandidates([
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 0 },
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
    ])
    addActive('anthropic', 3)

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then zero-weight provider should not be selected
    expect(selected?.provider).toBe('anthropic')
  })

  it('falls back deterministically when all weights are 0', () => {
    //#given all zero-weight candidates
    const candidates = makeCandidates([
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 0 },
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 0 },
    ])

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then first candidate is used as deterministic fallback
    expect(selected?.provider).toBe('opencode')
  })

  it('distributes load under uneven active requests', () => {
    //#given uneven active load across providers
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
      { model: 'github-copilot/gpt-5-mini', provider: 'github-copilot', weight: 1 },
      { model: 'google/gemini-3-flash', provider: 'google', weight: 1 },
    ])
    addActive('anthropic', 3)
    addActive('github-copilot', 1)
    addActive('google', 0)

    //#when selecting repeatedly with updated active counts
    const first = algorithm.selectBestProvider(candidates)
    if (first) algorithm.startRequest(first.provider)
    const second = algorithm.selectBestProvider(candidates)

    //#then selections should favor least-loaded providers
    expect(first?.provider).toBe('google')
    expect(second?.provider).toBe('github-copilot')
  })

  it('prefers idle provider over loaded one', () => {
    //#given one idle provider and one loaded provider
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 1 },
    ])
    addActive('opencode', 2)

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then idle provider should be preferred
    expect(selected?.provider).toBe('anthropic')
  })

  it('works with single provider', () => {
    //#given only one candidate
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
    ])
    addActive('anthropic', 2)

    //#when selecting the best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then the only provider should be selected
    expect(selected?.provider).toBe('anthropic')
  })

  it('retains stable order for tied scores', () => {
    //#given identical weights and active counts
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 1 },
    ])

    //#when selecting the best provider repeatedly
    const first = algorithm.selectBestProvider(candidates)
    const second = algorithm.selectBestProvider(candidates)

    //#then selection is deterministic and stable
    expect(first?.provider).toBe('anthropic')
    expect(second?.provider).toBe('anthropic')
  })

  it('resets active state between selections when requested', () => {
    //#given active requests tracked
    addActive('anthropic', 2)

    //#when reset is called
    algorithm.reset()

    //#then active counts should clear
    expect(algorithm.getActiveRequests('anthropic')).toBe(0)
  })
})
