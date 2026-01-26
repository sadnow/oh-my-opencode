/**
 * Usage Tracker
 * Core logic for tracking API usage and costs
 */

import { log } from "../../shared"
import type {
  UsageRecord,
  ProviderUsageSummary,
  UsageTrackerConfig,
  RecordUsageInput,
  UsageStorage,
  ModelPricing,
} from "./types"
import {
  loadUsageStorage,
  saveUsageStorage,
  addRecord,
  updateSummary,
  getRecordsForProvider,
  pruneOldRecords,
  createEmptyStorage,
} from "./storage"
import {
  calculatePeriodStart,
  calculateNextReset,
  getResetSchedule,
} from "./reset-schedules"

/**
 * Known model pricing (cost per 1M tokens in USD).
 * These are approximate and may need updates.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-5": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-sonnet-4-5": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5": { inputPer1M: 0.25, outputPer1M: 1.25 },
  // OpenAI (approximate)
  "gpt-5.2": { inputPer1M: 10.0, outputPer1M: 30.0 },
  "gpt-5.2-codex": { inputPer1M: 15.0, outputPer1M: 60.0 },
  "gpt-5-nano": { inputPer1M: 0.15, outputPer1M: 0.60 },
  // Google Gemini (approximate)
  "gemini-3-flash": { inputPer1M: 0.075, outputPer1M: 0.30 },
  "gemini-3-pro": { inputPer1M: 1.25, outputPer1M: 5.0 },
  // OpenCode models via providers
  "big-pickle": { inputPer1M: 0.5, outputPer1M: 2.0 },
  // Kimi
  "kimi-k2-thinking": { inputPer1M: 5.0, outputPer1M: 20.0 },
  "kimi-k2-0905": { inputPer1M: 3.0, outputPer1M: 12.0 },
  // GLM
  "glm-4.6": { inputPer1M: 0.5, outputPer1M: 2.0 },
  "glm-4.7": { inputPer1M: 2.0, outputPer1M: 8.0 },
  // Qwen
  "qwen3-coder-480b": { inputPer1M: 4.0, outputPer1M: 16.0 },
}

/**
 * Default pricing for unknown models.
 */
const DEFAULT_PRICING: ModelPricing = { inputPer1M: 5.0, outputPer1M: 20.0 }

export class UsageTracker {
  private config: UsageTrackerConfig
  private storage: UsageStorage
  private dirty = false
  private saveTimeout?: ReturnType<typeof setTimeout>

  constructor(config?: Partial<UsageTrackerConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      persist: config?.persist ?? true,
      storagePath: config?.storagePath,
    }

    if (this.config.enabled && this.config.persist) {
      this.storage = loadUsageStorage(this.config.storagePath)
      this.pruneOldRecords()
    } else {
      this.storage = createEmptyStorage()
    }
  }

  /**
   * Record a usage event.
   */
  recordUsage(input: RecordUsageInput): UsageRecord {
    if (!this.config.enabled) {
      return this.createRecord(input)
    }

    const record = this.createRecord(input)
    this.storage = addRecord(this.storage, record)
    this.updateProviderSummary(input.provider)
    this.scheduleSave()

    log("[usage-tracker] Recorded usage:", {
      provider: input.provider,
      model: input.model,
      cost: record.estimatedCost,
    })

    return record
  }

  /**
   * Get usage summary for a specific provider.
   */
  getProviderSummary(provider: string): ProviderUsageSummary {
    // Check if cached summary is still valid (same billing period)
    const cached = this.storage.summaries[provider]
    const now = new Date()
    const currentPeriodStart = calculatePeriodStart(provider, now)

    if (cached && new Date(cached.periodStart).getTime() === currentPeriodStart.getTime()) {
      return cached
    }

    // Recalculate summary
    return this.calculateProviderSummary(provider)
  }

  /**
   * Get usage summaries for all providers.
   */
  getAllSummaries(): Record<string, ProviderUsageSummary> {
    const providers = new Set<string>()
    for (const record of this.storage.records) {
      providers.add(record.provider)
    }

    const summaries: Record<string, ProviderUsageSummary> = {}
    for (const provider of providers) {
      summaries[provider] = this.getProviderSummary(provider)
    }

    return summaries
  }

  /**
   * Get total cost across all providers.
   */
  getTotalCost(): number {
    const summaries = this.getAllSummaries()
    return Object.values(summaries).reduce((sum, s) => sum + s.totalCost, 0)
  }

  /**
   * Get all records for a provider in the current billing period.
   */
  getRecordsForCurrentPeriod(provider: string): UsageRecord[] {
    const periodStart = calculatePeriodStart(provider)
    return getRecordsForProvider(this.storage, provider, periodStart)
  }

  /**
   * Estimate the cost for a given usage.
   */
  estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.getModelPricing(model)
    return (
      (inputTokens / 1_000_000) * pricing.inputPer1M +
      (outputTokens / 1_000_000) * pricing.outputPer1M
    )
  }

  /**
   * Get pricing for a specific model.
   */
  getModelPricing(model: string): ModelPricing {
    // Try exact match first
    if (MODEL_PRICING[model]) {
      return MODEL_PRICING[model]
    }

    // Try to match by base model name (without version suffixes)
    const baseModel = model.replace(/-\d+$/, "").replace(/-latest$/, "")
    if (MODEL_PRICING[baseModel]) {
      return MODEL_PRICING[baseModel]
    }

    return DEFAULT_PRICING
  }

  /**
   * Clear all usage data.
   */
  clearAll(): void {
    this.storage = createEmptyStorage()
    this.scheduleSave()
  }

  /**
   * Clear usage data for a specific provider.
   */
  clearProvider(provider: string): void {
    this.storage = {
      ...this.storage,
      records: this.storage.records.filter((r) => r.provider !== provider),
      summaries: Object.fromEntries(
        Object.entries(this.storage.summaries).filter(([key]) => key !== provider)
      ),
    }
    this.scheduleSave()
  }

  /**
   * Force save to disk.
   */
  flush(): void {
    if (this.dirty && this.config.persist) {
      saveUsageStorage(this.storage, this.config.storagePath)
      this.dirty = false
    }
  }

  /**
   * Shutdown the tracker, saving any pending data.
   */
  shutdown(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = undefined
    }
    this.flush()
  }

  private createRecord(input: RecordUsageInput): UsageRecord {
    const estimatedCost = this.estimateCost(
      input.provider,
      input.model,
      input.inputTokens,
      input.outputTokens
    )

    return {
      id: `usage_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date(),
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCost,
      taskType: input.taskType,
      sessionID: input.sessionID,
    }
  }

  private updateProviderSummary(provider: string): void {
    const summary = this.calculateProviderSummary(provider)
    this.storage = updateSummary(this.storage, summary)
  }

  private calculateProviderSummary(provider: string): ProviderUsageSummary {
    const now = new Date()
    const periodStart = calculatePeriodStart(provider, now)
    const nextReset = calculateNextReset(provider, now)
    const schedule = getResetSchedule(provider)

    const records = getRecordsForProvider(this.storage, provider, periodStart, now)

    let totalCost = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const record of records) {
      totalCost += record.estimatedCost
      totalInputTokens += record.inputTokens
      totalOutputTokens += record.outputTokens
    }

    return {
      provider,
      periodStart,
      nextReset,
      resetType: schedule.type,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      callCount: records.length,
    }
  }

  private scheduleSave(): void {
    this.dirty = true

    if (!this.config.persist) return

    // Debounce saves to avoid excessive disk writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(() => {
      this.flush()
    }, 5000) // Save after 5 seconds of inactivity
  }

  private pruneOldRecords(): void {
    // Keep at least 2 months of data for reporting
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
    twoMonthsAgo.setDate(1)
    twoMonthsAgo.setHours(0, 0, 0, 0)

    const originalCount = this.storage.records.length
    this.storage = pruneOldRecords(this.storage, twoMonthsAgo)

    if (this.storage.records.length < originalCount) {
      log("[usage-tracker] Pruned old records:", {
        removed: originalCount - this.storage.records.length,
      })
      this.scheduleSave()
    }
  }
}
