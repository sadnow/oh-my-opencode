/**
 * Claude Max Usage Tracker
 * Automatically tracks Claude Max subscription usage from local stats
 */

import * as fs from "fs"
import * as path from "path"
import { homedir } from "os"
import { log } from "../../shared"

// ============================================================================
// Types
// ============================================================================

export interface ClaudeMaxUsageData {
  // Overall usage (estimated from tokens)
  allModels: {
    percentUsed: number
    tokensUsed: number
    estimatedLimit: number
    resetDate: string
  }
  // Model breakdown
  modelBreakdown: {
    opus: { tokens: number; percent: number }
    sonnet: { tokens: number; percent: number }
    haiku: { tokens: number; percent: number }
    other: { tokens: number; percent: number }
  }
  // Subscription info
  subscription: {
    tier: "free" | "pro" | "max-5x" | "max-20x" | "team" | "enterprise" | "unknown"
    isActive: boolean
  }
  // Activity stats
  activity: {
    messagesThisWeek: number
    sessionsThisWeek: number
    toolCallsThisWeek: number
  }
  // Period info
  periodStart: string
  periodEnd: string
  daysRemaining: number
  lastUpdated: string
}

export interface ClaudeStatsCache {
  version: number
  lastComputedDate: string
  dailyActivity: Array<{
    date: string
    messageCount: number
    sessionCount: number
    toolCallCount: number
  }>
  dailyModelTokens: Array<{
    date: string
    tokensByModel: Record<string, number>
  }>
  modelUsage: Record<string, {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheCreationInputTokens: number
    costUSD: number
  }>
  totalSessions: number
  totalMessages: number
  firstSessionDate?: string
}

// ============================================================================
// Constants - Estimated Weekly Limits
// ============================================================================

// Based on research: Max 5x ~140-280 Sonnet hours/week, Max 20x ~240-480 hours
// Converting to approximate token limits (conservative estimates)
const WEEKLY_LIMITS = {
  "max-5x": {
    // ~200 Sonnet hours = ~43M tokens at 60 tok/sec
    totalTokens: 40_000_000,
    opusTokens: 5_000_000,   // Opus is more limited (~40 hours)
    sonnetTokens: 35_000_000,
    haikuTokens: 100_000_000,
  },
  "max-20x": {
    // ~400 Sonnet hours = ~86M tokens
    totalTokens: 80_000_000,
    opusTokens: 15_000_000,
    sonnetTokens: 70_000_000,
    haikuTokens: 200_000_000,
  },
  "pro": {
    totalTokens: 8_000_000,
    opusTokens: 1_000_000,
    sonnetTokens: 7_000_000,
    haikuTokens: 20_000_000,
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

function getClaudeStatsPath(): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR ||
    path.join(homedir(), ".claude")
  return path.join(claudeDir, "stats-cache.json")
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day // Sunday = 0
  const weekStart = new Date(now)
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

function getWeekEnd(): Date {
  const weekStart = getWeekStart()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

function getDaysRemaining(): number {
  const now = new Date()
  const weekEnd = getWeekEnd()
  const diff = weekEnd.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function isInCurrentWeek(dateStr: string): boolean {
  const date = new Date(dateStr)
  const weekStart = getWeekStart()
  const weekEnd = getWeekEnd()
  return date >= weekStart && date <= weekEnd
}

function categorizeModel(modelName: string): "opus" | "sonnet" | "haiku" | "other" {
  const lower = modelName.toLowerCase()
  if (lower.includes("opus")) return "opus"
  if (lower.includes("sonnet")) return "sonnet"
  if (lower.includes("haiku")) return "haiku"
  return "other"
}

// ============================================================================
// ClaudeMaxUsageTracker Class
// ============================================================================

export class ClaudeMaxUsageTracker {
  private statsPath: string
  private cachedData: ClaudeMaxUsageData | null = null
  private lastRefresh: number = 0
  private refreshInterval: number = 30000 // 30 seconds

  constructor() {
    this.statsPath = getClaudeStatsPath()
  }

  /**
   * Get usage data, refreshing from stats if needed
   */
  getData(): ClaudeMaxUsageData {
    const now = Date.now()
    if (!this.cachedData || now - this.lastRefresh > this.refreshInterval) {
      this.refresh()
    }
    return this.cachedData!
  }

  /**
   * Force refresh from stats cache
   */
  refresh(): void {
    this.cachedData = this.calculateUsage()
    this.lastRefresh = Date.now()
  }

  /**
   * Calculate usage from Claude's stats-cache.json
   */
  private calculateUsage(): ClaudeMaxUsageData {
    const defaultData: ClaudeMaxUsageData = {
      allModels: {
        percentUsed: 0,
        tokensUsed: 0,
        estimatedLimit: WEEKLY_LIMITS["max-5x"].totalTokens,
        resetDate: getWeekEnd().toISOString(),
      },
      modelBreakdown: {
        opus: { tokens: 0, percent: 0 },
        sonnet: { tokens: 0, percent: 0 },
        haiku: { tokens: 0, percent: 0 },
        other: { tokens: 0, percent: 0 },
      },
      subscription: {
        tier: "unknown",
        isActive: false,
      },
      activity: {
        messagesThisWeek: 0,
        sessionsThisWeek: 0,
        toolCallsThisWeek: 0,
      },
      periodStart: getWeekStart().toISOString(),
      periodEnd: getWeekEnd().toISOString(),
      daysRemaining: getDaysRemaining(),
      lastUpdated: new Date().toISOString(),
    }

    try {
      if (!fs.existsSync(this.statsPath)) {
        log("[claude-max-usage] Stats cache not found:", this.statsPath)
        return defaultData
      }

      const content = fs.readFileSync(this.statsPath, "utf-8")
      const stats: ClaudeStatsCache = JSON.parse(content)

      // Calculate weekly tokens by model category
      const weeklyTokens = {
        opus: 0,
        sonnet: 0,
        haiku: 0,
        other: 0,
      }

      // Sum tokens from daily data for current week
      for (const day of stats.dailyModelTokens || []) {
        if (isInCurrentWeek(day.date)) {
          for (const [model, tokens] of Object.entries(day.tokensByModel)) {
            const category = categorizeModel(model)
            weeklyTokens[category] += tokens
          }
        }
      }

      // Also add from modelUsage (cumulative) if no daily data
      if (stats.dailyModelTokens?.length === 0) {
        for (const [model, usage] of Object.entries(stats.modelUsage || {})) {
          const category = categorizeModel(model)
          weeklyTokens[category] += usage.inputTokens + usage.outputTokens
        }
      }

      // Calculate activity for current week
      let messagesThisWeek = 0
      let sessionsThisWeek = 0
      let toolCallsThisWeek = 0

      for (const day of stats.dailyActivity || []) {
        if (isInCurrentWeek(day.date)) {
          messagesThisWeek += day.messageCount
          sessionsThisWeek += day.sessionCount
          toolCallsThisWeek += day.toolCallCount
        }
      }

      // Detect subscription tier based on usage patterns
      const hasOpusUsage = weeklyTokens.opus > 0
      const hasSonnetUsage = weeklyTokens.sonnet > 0
      const totalTokens = weeklyTokens.opus + weeklyTokens.sonnet + weeklyTokens.haiku + weeklyTokens.other

      let tier: ClaudeMaxUsageData["subscription"]["tier"] = "unknown"
      let limits = WEEKLY_LIMITS["max-5x"]

      // Heuristic: If using Opus heavily, likely Max subscription
      if (hasOpusUsage) {
        tier = "max-5x" // Assume Max 5x, could be 20x
        limits = WEEKLY_LIMITS["max-5x"]
      } else if (hasSonnetUsage) {
        tier = "pro"
        limits = WEEKLY_LIMITS["pro"]
      }

      // Calculate percentages
      const totalPercent = Math.min(100, (totalTokens / limits.totalTokens) * 100)
      const opusPercent = limits.opusTokens > 0 ? Math.min(100, (weeklyTokens.opus / limits.opusTokens) * 100) : 0
      const sonnetPercent = limits.sonnetTokens > 0 ? Math.min(100, (weeklyTokens.sonnet / limits.sonnetTokens) * 100) : 0
      const haikuPercent = limits.haikuTokens > 0 ? Math.min(100, (weeklyTokens.haiku / limits.haikuTokens) * 100) : 0

      return {
        allModels: {
          percentUsed: Math.round(totalPercent * 10) / 10,
          tokensUsed: totalTokens,
          estimatedLimit: limits.totalTokens,
          resetDate: getWeekEnd().toISOString(),
        },
        modelBreakdown: {
          opus: { tokens: weeklyTokens.opus, percent: Math.round(opusPercent * 10) / 10 },
          sonnet: { tokens: weeklyTokens.sonnet, percent: Math.round(sonnetPercent * 10) / 10 },
          haiku: { tokens: weeklyTokens.haiku, percent: Math.round(haikuPercent * 10) / 10 },
          other: { tokens: weeklyTokens.other, percent: 0 },
        },
        subscription: {
          tier,
          isActive: hasOpusUsage || hasSonnetUsage,
        },
        activity: {
          messagesThisWeek,
          sessionsThisWeek,
          toolCallsThisWeek,
        },
        periodStart: getWeekStart().toISOString(),
        periodEnd: getWeekEnd().toISOString(),
        daysRemaining: getDaysRemaining(),
        lastUpdated: new Date().toISOString(),
      }
    } catch (err) {
      log("[claude-max-usage] Error reading stats:", err)
      return defaultData
    }
  }

  /**
   * Get usage recommendation based on current usage
   */
  getRecommendation(): "normal" | "caution" | "reduce" | "critical" {
    const data = this.getData()
    const percent = data.allModels.percentUsed
    const daysRemaining = data.daysRemaining

    // Factor in days remaining
    const expectedPercent = ((7 - daysRemaining) / 7) * 100
    const burnRate = percent / Math.max(1, 7 - daysRemaining)

    if (percent >= 90 || burnRate > 20) return "critical"
    if (percent >= 70 || burnRate > 15) return "reduce"
    if (percent >= 50 || burnRate > 12) return "caution"
    return "normal"
  }

  /**
   * Check if should recommend model downgrade
   */
  shouldDowngrade(): boolean {
    const data = this.getData()
    // Downgrade if Opus usage is high relative to limit
    return data.modelBreakdown.opus.percent >= 70
  }

  /**
   * Format tokens for display
   */
  formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
      return (tokens / 1_000_000).toFixed(1) + "M"
    }
    if (tokens >= 1_000) {
      return (tokens / 1_000).toFixed(1) + "K"
    }
    return tokens.toString()
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ClaudeMaxUsageTracker | null = null

export function getClaudeMaxUsageTracker(): ClaudeMaxUsageTracker {
  if (!instance) {
    instance = new ClaudeMaxUsageTracker()
  }
  return instance
}

export function resetClaudeMaxUsageTracker(): void {
  instance = null
}
