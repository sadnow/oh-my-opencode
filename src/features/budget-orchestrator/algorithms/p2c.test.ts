import { describe, it, expect, beforeEach } from 'bun:test'
import type { WeightCandidate } from '../provider-classification'

type P2CConstructor = new (options?: {
  rng?: { nextFloat(): number }
  seed?: number
}) => {
  startRequest(provider: string): void
  endRequest(provider: string): void
  acquire(provider: string): void
  release(provider: string): void
  getActiveRequests(provider: string): number
  selectBestProvider(candidates: WeightCandidate[]): WeightCandidate | null
  reset(): void
}

describe('Power of Two Choices', () => {
  let Algorithm: P2CConstructor
  let createSeededRng: (seed: number) => { nextFloat(): number }

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
    const mod = await import('./p2c')
    Algorithm = mod.PowerOfTwoChoices as P2CConstructor
    createSeededRng = mod.createSeededRng as (seed: number) => { nextFloat(): number }
  })

  it('samples exactly two candidates and uses rng twice', () => {
    //#given deterministic rng and five candidates
    const rngValues = [0.1, 0.6]
    let rngCalls = 0
    const rng = {
      nextFloat: (): number => {
        const value = rngValues[rngCalls] ?? 0
        rngCalls += 1
        return value
      },
    }
    const algorithm = new Algorithm({ rng })
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
      { model: 'github-copilot/gpt-5-mini', provider: 'github-copilot', weight: 1 },
      { model: 'google/gemini-3-flash', provider: 'google', weight: 1 },
      { model: 'openai/gpt-4.1', provider: 'openai', weight: 1 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 10 },
    ])
    algorithm.startRequest('anthropic')
    algorithm.startRequest('anthropic')

    //#when selecting best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then only sampled candidates influence selection
    expect(rngCalls).toBe(2)
    expect(selected?.provider).toBe('openai')
  })

  it('avoids scanning the full candidate list', () => {
    //#given a candidate array that throws on index 2 access
    const rngValues = [0.4, 0.9]
    let rngCalls = 0
    const rng = {
      nextFloat: (): number => {
        const value = rngValues[rngCalls] ?? 0
        rngCalls += 1
        return value
      },
    }
    const algorithm = new Algorithm({ rng })
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
      { model: 'github-copilot/gpt-5-mini', provider: 'github-copilot', weight: 1 },
      { model: 'google/gemini-3-flash', provider: 'google', weight: 1 },
    ])
    const accessCounts = { 0: 0, 1: 0, 2: 0 }
    const proxyCandidates = new Proxy(candidates, {
      get(target, prop, receiver) {
        if (prop === '0' || prop === '1' || prop === '2') {
          accessCounts[Number(prop) as 0 | 1 | 2] += 1
        }
        return Reflect.get(target, prop, receiver)
      },
    }) as WeightCandidate[]

    //#when selecting best provider
    algorithm.selectBestProvider(proxyCandidates)

    //#then only sampled indices are accessed
    expect(accessCounts[0]).toBe(0)
    expect(accessCounts[1]).toBeGreaterThan(0)
    expect(accessCounts[2]).toBeGreaterThan(0)
    expect(rngCalls).toBe(2)
  })

  it('balances selections with deterministic seed', () => {
    //#given equal candidates and a seeded rng
    const rng = createSeededRng(42)
    const algorithm = new Algorithm({ rng })
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
      { model: 'github-copilot/gpt-5-mini', provider: 'github-copilot', weight: 1 },
      { model: 'google/gemini-3-flash', provider: 'google', weight: 1 },
    ])
    const counts: Record<string, number> = { anthropic: 0, 'github-copilot': 0, google: 0 }

    //#when selecting repeatedly
    for (let i = 0; i < 1200; i++) {
      const selected = algorithm.selectBestProvider(candidates)
      if (selected) counts[selected.provider] += 1
    }

    //#then distribution stays roughly balanced
    expect(counts.anthropic).toBeGreaterThan(300)
    expect(counts['github-copilot']).toBeGreaterThan(300)
    expect(counts.google).toBeGreaterThan(300)
    expect(counts.anthropic).toBeLessThan(500)
    expect(counts['github-copilot']).toBeLessThan(500)
    expect(counts.google).toBeLessThan(500)
  })

  it('handles empty candidate list', () => {
    //#given no candidates
    const algorithm = new Algorithm()

    //#when selecting best provider
    const selected = algorithm.selectBestProvider([])

    //#then no provider is selected
    expect(selected).toBeNull()
  })

  it('returns the only candidate even with zero weight', () => {
    //#given a single zero-weight candidate
    const algorithm = new Algorithm()
    const candidates = makeCandidates([
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 0 },
    ])

    //#when selecting best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then the only candidate is returned
    expect(selected?.provider).toBe('opencode')
  })

  it('prefers positive weight over zero weight', () => {
    //#given one zero-weight and one positive-weight candidate
    const algorithm = new Algorithm({ rng: { nextFloat: () => 0 } })
    const candidates = makeCandidates([
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 0 },
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 1 },
    ])

    //#when selecting best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then positive weight candidate is chosen
    expect(selected?.provider).toBe('anthropic')
  })

  it('falls back deterministically when both weights are zero', () => {
    //#given two zero-weight candidates
    const algorithm = new Algorithm({ rng: { nextFloat: () => 0 } })
    const candidates = makeCandidates([
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 0 },
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 0 },
    ])

    //#when selecting best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then the first sampled candidate is used
    expect(selected?.provider).toBe('opencode')
  })

  it('selects lower active/weight ratio between sampled candidates', () => {
    //#given two candidates with different ratios
    const algorithm = new Algorithm({ rng: { nextFloat: () => 0 } })
    const candidates = makeCandidates([
      { model: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', weight: 2 },
      { model: 'opencode/glm-4.7', provider: 'opencode', weight: 1 },
    ])
    algorithm.startRequest('anthropic')
    algorithm.startRequest('anthropic')

    //#when selecting best provider
    const selected = algorithm.selectBestProvider(candidates)

    //#then lower ratio wins
    expect(selected?.provider).toBe('opencode')
  })

  it('tracks active requests per provider', () => {
    //#given multiple active requests
    const algorithm = new Algorithm()
    algorithm.startRequest('anthropic')
    algorithm.startRequest('anthropic')
    algorithm.startRequest('opencode')

    //#then counts are tracked independently
    expect(algorithm.getActiveRequests('anthropic')).toBe(2)
    expect(algorithm.getActiveRequests('opencode')).toBe(1)
    expect(algorithm.getActiveRequests('google')).toBe(0)
  })

  it('updates counts on start/end', () => {
    //#given an active request
    const algorithm = new Algorithm()
    algorithm.startRequest('anthropic')

    //#when request ends
    algorithm.endRequest('anthropic')

    //#then count returns to zero
    expect(algorithm.getActiveRequests('anthropic')).toBe(0)
  })
})
