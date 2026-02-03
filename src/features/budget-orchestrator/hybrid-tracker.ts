import { detectUnderlyingProvider } from "./underlying-provider"

export interface HybridProviderUsageData {
  /** Underlying provider ID (e.g., "openai", "google") */
  provider: string
  /** Tokens used today */
  tokensUsedToday: number
  /** Daily free token limit from config */
  dailyFreeTokens: number
  /** Percentage of daily free tier used (can exceed 100) */
  percentUsed: number
  /** Whether free tier is exhausted (percentUsed >= 100) */
  isExhausted: boolean
  /** When the daily counter resets (UTC time string) */
  resetTime: string
  /** ISO timestamp of last reset */
  lastResetDate: string
  /** ISO timestamp of last update */
  lastUpdated: string
  /** Whether this provider config is enabled */
  enabled: boolean
}

export interface HybridTrackerConfig {
  /** Config per underlying provider */
  providers: Record<string, {
    daily_free_tokens: number
    reset_time: string
    enabled: boolean
  }>
}

type UsageEntry = { tokensUsed: number; lastResetDate: string }

export class HybridProviderTracker {
  private usage: Map<string, UsageEntry>
  private config: HybridTrackerConfig
  private readonly getNow: () => Date

  constructor(config: HybridTrackerConfig, options?: { getNow?: () => Date }) {
    this.usage = new Map()
    this.config = config
    this.getNow = options?.getNow ?? (() => new Date())
  }

  /** Record token usage for a model. Detects underlying provider automatically. */
  recordUsage(modelId: string, tokens: number): void {
    const provider = detectUnderlyingProvider(modelId)
    if (!provider) return

    const providerConfig = this.config.providers[provider]
    if (!providerConfig || !providerConfig.enabled) return

    this.checkAndReset()

    const entry = this.getUsageEntry(provider)
    entry.tokensUsed += tokens
  }

  /** Get usage data for a specific underlying provider */
  getProviderUsage(provider: string): HybridProviderUsageData | null {
    const providerConfig = this.config.providers[provider]
    if (!providerConfig) return null

    this.checkAndReset()

    const nowIso = this.getNow().toISOString()
    const entry = this.getUsageEntry(provider)
    const dailyFreeTokens = providerConfig.daily_free_tokens
    const percentUsed = dailyFreeTokens > 0
      ? (entry.tokensUsed / dailyFreeTokens) * 100
      : 0
    const isExhausted = providerConfig.enabled && percentUsed >= 100

    return {
      provider,
      tokensUsedToday: entry.tokensUsed,
      dailyFreeTokens,
      percentUsed,
      isExhausted,
      resetTime: providerConfig.reset_time,
      lastResetDate: entry.lastResetDate,
      lastUpdated: nowIso,
      enabled: providerConfig.enabled,
    }
  }

  /** Get usage data for all configured providers */
  getAllUsage(): Record<string, HybridProviderUsageData> {
    this.checkAndReset()
    const nowIso = this.getNow().toISOString()
    const providers = Object.keys(this.config.providers)
    const usage: Record<string, HybridProviderUsageData> = {}

    for (const provider of providers) {
      const providerConfig = this.config.providers[provider]
      const entry = this.getUsageEntry(provider)
      const dailyFreeTokens = providerConfig.daily_free_tokens
      const percentUsed = dailyFreeTokens > 0
        ? (entry.tokensUsed / dailyFreeTokens) * 100
        : 0
      const isExhausted = providerConfig.enabled && percentUsed >= 100

      usage[provider] = {
        provider,
        tokensUsedToday: entry.tokensUsed,
        dailyFreeTokens,
        percentUsed,
        isExhausted,
        resetTime: providerConfig.reset_time,
        lastResetDate: entry.lastResetDate,
        lastUpdated: nowIso,
        enabled: providerConfig.enabled,
      }
    }

    return usage
  }

  /** Check if a provider's free tier is exhausted */
  isExhausted(provider: string): boolean {
    const usage = this.getProviderUsage(provider)
    return usage ? usage.isExhausted : false
  }

  /** Check and perform daily reset if needed (UTC midnight) */
  checkAndReset(): void {
    const currentDate = this.getCurrentDateString()
    const providers = Object.keys(this.config.providers)

    for (const provider of providers) {
      const entry = this.usage.get(provider)
      if (!entry) {
        this.usage.set(provider, { tokensUsed: 0, lastResetDate: currentDate })
        continue
      }

      if (entry.lastResetDate !== currentDate) {
        entry.tokensUsed = 0
        entry.lastResetDate = currentDate
      }
    }
  }

  /** Get list of exhausted providers */
  getExhaustedProviders(): string[] {
    const allUsage = this.getAllUsage()
    return Object.values(allUsage)
      .filter(usage => usage.isExhausted)
      .map(usage => usage.provider)
  }

  /** Reset usage for testing */
  _resetForTesting(): void {
    this.usage.clear()
  }

  private getUsageEntry(provider: string): UsageEntry {
    const existing = this.usage.get(provider)
    if (existing) return existing

    const entry = { tokensUsed: 0, lastResetDate: this.getCurrentDateString() }
    this.usage.set(provider, entry)
    return entry
  }

  private getCurrentDateString(): string {
    return this.getNow().toISOString().split("T")[0]
  }
}

let instance: HybridProviderTracker | null = null

export function getHybridProviderTracker(): HybridProviderTracker {
  if (!instance) {
    instance = new HybridProviderTracker({ providers: {} })
  }
  return instance
}

export function initHybridProviderTracker(config: HybridTrackerConfig): HybridProviderTracker {
  instance = new HybridProviderTracker(config)
  return instance
}

export function resetHybridProviderTracker(): void {
  instance = null
}
