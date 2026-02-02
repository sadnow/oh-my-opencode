import type { WeightCandidate } from '../provider-classification'

export class WeightedLeastConnections {
  private activeRequests = new Map<string, number>()

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

    const validCandidates = candidates.filter(candidate => candidate.weight > 0)
    if (validCandidates.length === 0) {
      return candidates[0] ?? null
    }

    let bestCandidate: WeightCandidate | null = null
    let bestScore = Number.POSITIVE_INFINITY
    let bestWeight = -Infinity

    for (const candidate of validCandidates) {
      const active = this.getActiveRequests(candidate.provider)
      const score = active / candidate.weight

      if (score < bestScore || (score === bestScore && candidate.weight > bestWeight)) {
        bestScore = score
        bestCandidate = candidate
        bestWeight = candidate.weight
      }
    }

    return bestCandidate
  }
}
