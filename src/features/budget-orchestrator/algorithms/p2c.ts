import type { WeightCandidate } from '../provider-classification'

export interface P2cRng {
  nextFloat(): number
}

export interface PowerOfTwoChoicesOptions {
  rng?: P2cRng
  seed?: number
}

const DEFAULT_SEED = 123456789

export function createSeededRng(seed: number): P2cRng {
  let state = seed >>> 0
  return {
    nextFloat: () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 0x100000000
    },
  }
}

export class PowerOfTwoChoices {
  private activeRequests = new Map<string, number>()
  private rng: P2cRng

  constructor(options?: PowerOfTwoChoicesOptions) {
    if (options?.rng) {
      this.rng = options.rng
    } else {
      const seed = options?.seed ?? DEFAULT_SEED
      this.rng = createSeededRng(seed)
    }
  }

  acquire(provider: string): void {
    const current = this.activeRequests.get(provider) ?? 0
    this.activeRequests.set(provider, current + 1)
  }

  release(provider: string): void {
    const current = this.activeRequests.get(provider) ?? 0
    const next = current - 1
    if (next <= 0) {
      this.activeRequests.delete(provider)
      return
    }
    this.activeRequests.set(provider, next)
  }

  startRequest(provider: string): void {
    this.acquire(provider)
  }

  endRequest(provider: string): void {
    this.release(provider)
  }

  getActiveRequests(provider: string): number {
    return this.activeRequests.get(provider) ?? 0
  }

  reset(): void {
    this.activeRequests.clear()
  }

  selectBestProvider(candidates: WeightCandidate[]): WeightCandidate | null {
    if (candidates.length === 0) {
      return null
    }

    if (candidates.length === 1) {
      return candidates[0] ?? null
    }

    const firstIndex = this.sampleIndex(candidates.length)
    let secondIndex = this.sampleIndex(candidates.length)
    if (secondIndex === firstIndex) {
      secondIndex = (firstIndex + 1) % candidates.length
    }

    const first = candidates[firstIndex]
    const second = candidates[secondIndex]

    if (!first || !second) {
      return candidates[0] ?? null
    }

    const firstWeight = first.weight
    const secondWeight = second.weight

    const firstScore = this.scoreCandidate(first, firstWeight)
    const secondScore = this.scoreCandidate(second, secondWeight)

    if (firstWeight <= 0 && secondWeight > 0) {
      return second
    }

    if (secondWeight <= 0 && firstWeight > 0) {
      return first
    }

    if (firstScore < secondScore) {
      return first
    }

    if (secondScore < firstScore) {
      return second
    }

    if (firstWeight > secondWeight) {
      return first
    }

    if (secondWeight > firstWeight) {
      return second
    }

    return first
  }

  private scoreCandidate(candidate: WeightCandidate, weight: number): number {
    if (weight <= 0) {
      return Number.POSITIVE_INFINITY
    }
    const active = this.getActiveRequests(candidate.provider)
    return active / weight
  }

  private sampleIndex(length: number): number {
    const value = this.rng.nextFloat()
    const normalized = Number.isFinite(value) ? value : 0
    const clamped = Math.min(Math.max(normalized, 0), 0.999999999)
    return Math.floor(clamped * length)
  }
}
