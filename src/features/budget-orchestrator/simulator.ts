import { ProviderWeightCalculator } from './provider-weight-calculator'
import type { WeightCandidate } from './provider-classification'
import { WeightedLeastConnections } from './algorithms/weighted-least-connections'
import { PowerOfTwoChoices } from './algorithms/p2c'

export type SimulationAlgorithm = 'swrr' | 'wlc' | 'p2c'

export interface SimulationRequest {
  useCase: string
  preferredModel?: string
  durationSteps?: number
  costUnits?: number
}

export interface SimulationProviderConfig {
  provider: string
  model: string
  quotaTarget: number
  usagePercent?: number
  daysUntilReset?: number
  velocityPerDay?: number
}

export interface SimulationOverrides {
  quotaTargets?: Record<string, number>
  usagePercents?: Record<string, number>
  daysUntilReset?: Record<string, number>
  velocityByProvider?: Record<string, number>
}

export interface SimulationInput {
  algorithm: SimulationAlgorithm
  providers: SimulationProviderConfig[]
  requests: SimulationRequest[]
  seed?: number
  overrides?: SimulationOverrides
  initialActiveRequests?: Record<string, number>
}

export interface SimulationSelection {
  step: number
  provider: string
  model: string
}

export interface SimulationDistributionEntry {
  count: number
  percent: number
}

export interface SimulationQuotaExhaustion {
  step: number
  timestamp: number
}

export interface SimulationResult {
  selections: SimulationSelection[]
  distribution: Record<string, SimulationDistributionEntry>
  quotaExhaustion: Record<string, SimulationQuotaExhaustion | null>
  fairnessIndex: number
}

interface ActiveRequestState {
  provider: string
  remainingSteps: number
}

export function simulateRequests(input: SimulationInput): SimulationResult {
  const { algorithm, providers, requests, seed, overrides, initialActiveRequests } = input
  const calculator = new ProviderWeightCalculator()
  const wlc = algorithm === 'wlc' ? new WeightedLeastConnections() : null
  const p2c = algorithm === 'p2c' ? new PowerOfTwoChoices({ seed }) : null
  const activeRequests: ActiveRequestState[] = []

  if (initialActiveRequests) {
    for (const [provider, count] of Object.entries(initialActiveRequests)) {
      const times = Math.max(0, Math.floor(count))
      for (let i = 0; i < times; i += 1) {
        if (wlc) wlc.acquire(provider)
        if (p2c) p2c.acquire(provider)
      }
    }
  }

  const providerConfigs = providers.map(provider => ({
    ...provider,
    quotaTarget: overrides?.quotaTargets?.[provider.provider] ?? provider.quotaTarget,
    usagePercent: overrides?.usagePercents?.[provider.provider] ?? provider.usagePercent ?? 0,
    daysUntilReset: overrides?.daysUntilReset?.[provider.provider] ?? provider.daysUntilReset,
    velocityPerDay: overrides?.velocityByProvider?.[provider.provider] ?? provider.velocityPerDay,
  }))

  const counts = new Map<string, number>()
  const usageByProvider = new Map<string, number>()
  const quotaExhaustion: Record<string, SimulationQuotaExhaustion | null> = Object.fromEntries(
    providerConfigs.map(config => [config.provider, null])
  )
  const selections: SimulationSelection[] = []

  for (let step = 1; step <= requests.length; step += 1) {
    const request = requests[step - 1]
    const candidates = buildCandidates(calculator, providerConfigs)
    const selected = selectCandidate({
      algorithm,
      candidates,
      calculator,
      wlc,
      p2c,
    })

    if (!selected) {
      continue
    }

    selections.push({ step, provider: selected.provider, model: selected.model })
    counts.set(selected.provider, (counts.get(selected.provider) ?? 0) + 1)
    usageByProvider.set(selected.provider, (usageByProvider.get(selected.provider) ?? 0) + 1)

    if (!quotaExhaustion[selected.provider]) {
      const quotaTarget = providerConfigs.find(config => config.provider === selected.provider)?.quotaTarget ?? 0
      if (usageByProvider.get(selected.provider)! >= quotaTarget && quotaTarget > 0) {
        quotaExhaustion[selected.provider] = { step, timestamp: step }
      }
    }

    const duration = request?.durationSteps ?? 1
    if (duration > 1) {
      activeRequests.push({ provider: selected.provider, remainingSteps: duration - 1 })
      if (wlc) wlc.acquire(selected.provider)
      if (p2c) p2c.acquire(selected.provider)
    }

    for (let index = activeRequests.length - 1; index >= 0; index -= 1) {
      const active = activeRequests[index]
      active.remainingSteps -= 1
      if (active.remainingSteps <= 0) {
        if (wlc) wlc.release(active.provider)
        if (p2c) p2c.release(active.provider)
        activeRequests.splice(index, 1)
      }
    }
  }

  const totalSelections = selections.length || 1
  const distribution: Record<string, SimulationDistributionEntry> = {}
  for (const config of providerConfigs) {
    const count = counts.get(config.provider) ?? 0
    distribution[config.provider] = {
      count,
      percent: (count / totalSelections) * 100,
    }
  }

  const fairnessIndex = calculateFairnessIndex(
    providerConfigs.map(config => ({
      provider: config.provider,
      weight: calculator.calculateWeight(
        config.provider,
        config.usagePercent ?? 0,
        config.daysUntilReset
      ),
    })),
    distribution
  )

  return {
    selections,
    distribution,
    quotaExhaustion,
    fairnessIndex,
  }
}

function buildCandidates(
  calculator: ProviderWeightCalculator,
  providerConfigs: SimulationProviderConfig[]
): WeightCandidate[] {
  return calculator.buildCandidates(
    providerConfigs.map(config => config.model),
    Object.fromEntries(providerConfigs.map(config => [config.provider, config.usagePercent ?? 0])),
    providerConfigs.some(config => config.daysUntilReset !== undefined)
      ? Object.fromEntries(
          providerConfigs
            .filter(config => config.daysUntilReset !== undefined)
            .map(config => [config.provider, config.daysUntilReset!])
        )
      : undefined,
    providerConfigs.some(config => config.velocityPerDay !== undefined)
      ? Object.fromEntries(
          providerConfigs
            .filter(config => config.velocityPerDay !== undefined)
            .map(config => [config.provider, config.velocityPerDay!])
        )
      : undefined
  )
}

function selectCandidate(options: {
  algorithm: SimulationAlgorithm
  candidates: WeightCandidate[]
  calculator: ProviderWeightCalculator
  wlc: WeightedLeastConnections | null
  p2c: PowerOfTwoChoices | null
}): WeightCandidate | null {
  const { algorithm, candidates, calculator, wlc, p2c } = options
  if (algorithm === 'wlc' && wlc) {
    return wlc.selectBestProvider(candidates)
  }
  if (algorithm === 'p2c' && p2c) {
    return p2c.selectBestProvider(candidates)
  }
  return calculator.selectBestProvider(candidates)
}

function calculateFairnessIndex(
  weights: Array<{ provider: string; weight: number }>,
  distribution: Record<string, SimulationDistributionEntry>
): number {
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight <= 0) {
    return 1
  }

  let totalDeviation = 0
  for (const entry of weights) {
    const expected = entry.weight / totalWeight
    const actual = (distribution[entry.provider]?.percent ?? 0) / 100
    totalDeviation += Math.abs(expected - actual)
  }

  const normalizedDeviation = totalDeviation / weights.length
  return Math.max(0, 1 - normalizedDeviation)
}
