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

  // ============================================================================
  // Analytics Methods
  // ============================================================================

  /**
   * Get weekly summary with comparison to previous period.
   */
  getWeeklySummary(): {
    current: { totalCost: number; totalCalls: number; totalInputTokens: number; totalOutputTokens: number }
    previous: { totalCost: number; totalCalls: number; totalInputTokens: number; totalOutputTokens: number }
    change: { costPercent: number; callsPercent: number }
    avgDailySpend: number
  } {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const currentWeekRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= oneWeekAgo && recordDate <= now
    })

    const previousWeekRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= twoWeeksAgo && recordDate < oneWeekAgo
    })

    const sumRecords = (records: UsageRecord[]) => ({
      totalCost: records.reduce((sum, r) => sum + r.estimatedCost, 0),
      totalCalls: records.length,
      totalInputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
    })

    const current = sumRecords(currentWeekRecords)
    const previous = sumRecords(previousWeekRecords)

    return {
      current,
      previous,
      change: {
        costPercent: previous.totalCost > 0 ? ((current.totalCost - previous.totalCost) / previous.totalCost) * 100 : 0,
        callsPercent: previous.totalCalls > 0 ? ((current.totalCalls - previous.totalCalls) / previous.totalCalls) * 100 : 0,
      },
      avgDailySpend: current.totalCost / 7,
    }
  }

  /**
   * Get monthly summary with comparison to previous period.
   */
  getMonthlySummary(): {
    current: { totalCost: number; totalCalls: number; totalInputTokens: number; totalOutputTokens: number }
    previous: { totalCost: number; totalCalls: number; totalInputTokens: number; totalOutputTokens: number }
    change: { costPercent: number; callsPercent: number }
    avgDailySpend: number
  } {
    const now = new Date()
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const twoMonthsAgo = new Date(now)
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    const currentMonthRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= oneMonthAgo && recordDate <= now
    })

    const previousMonthRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= twoMonthsAgo && recordDate < oneMonthAgo
    })

    const sumRecords = (records: UsageRecord[]) => ({
      totalCost: records.reduce((sum, r) => sum + r.estimatedCost, 0),
      totalCalls: records.length,
      totalInputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
    })

    const current = sumRecords(currentMonthRecords)
    const previous = sumRecords(previousMonthRecords)
    const daysInPeriod = Math.ceil((now.getTime() - oneMonthAgo.getTime()) / (24 * 60 * 60 * 1000))

    return {
      current,
      previous,
      change: {
        costPercent: previous.totalCost > 0 ? ((current.totalCost - previous.totalCost) / previous.totalCost) * 100 : 0,
        callsPercent: previous.totalCalls > 0 ? ((current.totalCalls - previous.totalCalls) / previous.totalCalls) * 100 : 0,
      },
      avgDailySpend: current.totalCost / daysInPeriod,
    }
  }

  /**
   * Get cost breakdown by task category.
   */
  getByCategory(): Record<string, { cost: number; calls: number; percentage: number }> {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const recentRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= oneWeekAgo
    })

    const categoryTotals: Record<string, { cost: number; calls: number }> = {}
    let totalCost = 0

    for (const record of recentRecords) {
      const category = record.taskType || "unspecified"
      if (!categoryTotals[category]) {
        categoryTotals[category] = { cost: 0, calls: 0 }
      }
      categoryTotals[category].cost += record.estimatedCost
      categoryTotals[category].calls += 1
      totalCost += record.estimatedCost
    }

    const result: Record<string, { cost: number; calls: number; percentage: number }> = {}
    for (const [category, data] of Object.entries(categoryTotals)) {
      result[category] = {
        ...data,
        percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      }
    }

    return result
  }

  /**
   * Get model efficiency metrics (cost per 1K tokens, tokens per dollar).
   */
  getEfficiency(): {
    byModel: Record<string, { model: string; avgCostPer1kTokens: number; tokensPer$1: number; totalCalls: number }>
    byTier: Record<string, { tier: string; avgCostPer1kTokens: number; tokensPer$1: number }>
  } {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const recentRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= oneWeekAgo
    })

    // Group by model
    const modelStats: Record<string, { totalCost: number; totalTokens: number; calls: number }> = {}
    for (const record of recentRecords) {
      if (!modelStats[record.model]) {
        modelStats[record.model] = { totalCost: 0, totalTokens: 0, calls: 0 }
      }
      modelStats[record.model].totalCost += record.estimatedCost
      modelStats[record.model].totalTokens += record.inputTokens + record.outputTokens
      modelStats[record.model].calls += 1
    }

    const byModel: Record<string, { model: string; avgCostPer1kTokens: number; tokensPer$1: number; totalCalls: number }> = {}
    for (const [model, stats] of Object.entries(modelStats)) {
      const avgCostPer1kTokens = stats.totalTokens > 0 ? (stats.totalCost / stats.totalTokens) * 1000 : 0
      const tokensPer$1 = stats.totalCost > 0 ? stats.totalTokens / stats.totalCost : 0
      byModel[model] = {
        model,
        avgCostPer1kTokens,
        tokensPer$1,
        totalCalls: stats.calls,
      }
    }

    // Group by tier (simple heuristic based on model name)
    const tierMap: Record<string, string> = {
      "opus": "premium",
      "sonnet": "standard",
      "haiku": "budget",
      "gpt-5.2": "premium",
      "gpt-5-nano": "budget",
      "gemini-3-flash": "budget",
      "gemini-3-pro": "standard",
      "kimi-k2-thinking": "premium",
      "big-pickle": "budget",
    }

    const tierStats: Record<string, { totalCost: number; totalTokens: number }> = {
      premium: { totalCost: 0, totalTokens: 0 },
      standard: { totalCost: 0, totalTokens: 0 },
      budget: { totalCost: 0, totalTokens: 0 },
      economy: { totalCost: 0, totalTokens: 0 },
    }

    for (const record of recentRecords) {
      let tier = "standard"
      for (const [key, t] of Object.entries(tierMap)) {
        if (record.model.includes(key)) {
          tier = t
          break
        }
      }
      tierStats[tier].totalCost += record.estimatedCost
      tierStats[tier].totalTokens += record.inputTokens + record.outputTokens
    }

    const byTier: Record<string, { tier: string; avgCostPer1kTokens: number; tokensPer$1: number }> = {}
    for (const [tier, stats] of Object.entries(tierStats)) {
      if (stats.totalTokens > 0) {
        byTier[tier] = {
          tier,
          avgCostPer1kTokens: (stats.totalCost / stats.totalTokens) * 1000,
          tokensPer$1: stats.totalCost > 0 ? stats.totalTokens / stats.totalCost : 0,
        }
      }
    }

    return { byModel, byTier }
  }

  /**
   * Get provider-specific trends over time.
   */
  getProviderTrends(provider: string, rangeDays: number = 7): {
    provider: string
    dataPoints: { date: string; cost: number; calls: number }[]
    totalCost: number
    avgDailyCost: number
  } {
    const now = new Date()
    const startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000)

    const providerRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return r.provider === provider && recordDate >= startDate && recordDate <= now
    })

    // Group by date
    const dailyData: Record<string, { cost: number; calls: number }> = {}
    for (let i = 0; i < rangeDays; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split("T")[0]
      dailyData[dateKey] = { cost: 0, calls: 0 }
    }

    for (const record of providerRecords) {
      const dateKey = new Date(record.timestamp).toISOString().split("T")[0]
      if (dailyData[dateKey]) {
        dailyData[dateKey].cost += record.estimatedCost
        dailyData[dateKey].calls += 1
      }
    }

    const dataPoints = Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }))

    const totalCost = dataPoints.reduce((sum, d) => sum + d.cost, 0)

    return {
      provider,
      dataPoints,
      totalCost,
      avgDailyCost: totalCost / rangeDays,
    }
  }

  /**
   * Get session statistics (duration, cost distribution).
   */
  getSessionStats(): {
    totalSessions: number
    avgSessionCost: number
    avgSessionDuration: number // Approximated from call patterns
    costDistribution: { range: string; count: number; percentage: number }[]
  } {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const recentRecords = this.storage.records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= oneWeekAgo
    })

    // Group by session ID
    const sessions: Record<string, { cost: number; calls: number; firstCall: Date; lastCall: Date }> = {}
    for (const record of recentRecords) {
      const sessionId = record.sessionID || "default"
      if (!sessions[sessionId]) {
        sessions[sessionId] = { cost: 0, calls: 0, firstCall: new Date(record.timestamp), lastCall: new Date(record.timestamp) }
      }
      sessions[sessionId].cost += record.estimatedCost
      sessions[sessionId].calls += 1
      const recordDate = new Date(record.timestamp)
      if (recordDate < sessions[sessionId].firstCall) sessions[sessionId].firstCall = recordDate
      if (recordDate > sessions[sessionId].lastCall) sessions[sessionId].lastCall = recordDate
    }

    const sessionList = Object.values(sessions)
    const totalSessions = sessionList.length
    const avgSessionCost = totalSessions > 0 ? sessionList.reduce((sum, s) => sum + s.cost, 0) / totalSessions : 0

    // Calculate average duration in minutes
    const durations = sessionList.map(s => (s.lastCall.getTime() - s.firstCall.getTime()) / (1000 * 60))
    const avgSessionDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

    // Cost distribution
    const ranges = [
      { min: 0, max: 0.01, label: "$0-$0.01" },
      { min: 0.01, max: 0.10, label: "$0.01-$0.10" },
      { min: 0.10, max: 0.50, label: "$0.10-$0.50" },
      { min: 0.50, max: 1.00, label: "$0.50-$1.00" },
      { min: 1.00, max: 5.00, label: "$1.00-$5.00" },
      { min: 5.00, max: Infinity, label: "$5.00+" },
    ]

    const costDistribution = ranges.map(range => {
      const count = sessionList.filter(s => s.cost >= range.min && s.cost < range.max).length
      return {
        range: range.label,
        count,
        percentage: totalSessions > 0 ? (count / totalSessions) * 100 : 0,
      }
    })

    return {
      totalSessions,
      avgSessionCost,
      avgSessionDuration,
      costDistribution,
    }
  }

  /**
   * Get all raw records (for API responses).
   */
  getAllRecords(): UsageRecord[] {
    return [...this.storage.records]
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
