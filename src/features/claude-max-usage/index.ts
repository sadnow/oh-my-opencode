/**
 * Claude Max Usage Tracker
 * Tracks Claude Max subscription usage separately from API usage
 */

import * as fs from "fs"
import * as path from "path"
import { homedir } from "os"
import { log } from "../../shared"

// ============================================================================
// Types
// ============================================================================

export interface ClaudeMaxUsageData {
  // Overall usage
  allModels: {
    percentUsed: number
    resetDate: string // ISO date string
    resetTimezone: string
  }
  // Sonnet-specific usage (separate limit)
  sonnetOnly: {
    percentUsed: number
    resetDate: string
    resetTimezone: string
  }
  // Subscription info
  subscription: {
    tier: "free" | "pro" | "max" | "team" | "enterprise" | "unknown"
    isActive: boolean
  }
  // Local tracking from stats-cache
  localStats: {
    totalTokens: number
    totalSessions: number
    totalMessages: number
    lastUpdated: string
  }
  // Sync info
  lastSynced: string | null
  syncSource: "manual" | "auto" | "cli" | null
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
}

// ============================================================================
// Storage Path
// ============================================================================

function getStoragePath(): string {
  const configDir = process.env.OPENCODE_CONFIG_DIR ||
    path.join(homedir(), ".config", "opencode")
  return path.join(configDir, "claude-max-usage.json")
}

function getClaudeStatsPath(): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR ||
    path.join(homedir(), ".claude")
  return path.join(claudeDir, "stats-cache.json")
}

// ============================================================================
// Default Data
// ============================================================================

function getDefaultUsageData(): ClaudeMaxUsageData {
  return {
    allModels: {
      percentUsed: 0,
      resetDate: getNextSundayReset(),
      resetTimezone: "America/Denver",
    },
    sonnetOnly: {
      percentUsed: 0,
      resetDate: getNextMonthStart(),
      resetTimezone: "America/Denver",
    },
    subscription: {
      tier: "unknown",
      isActive: false,
    },
    localStats: {
      totalTokens: 0,
      totalSessions: 0,
      totalMessages: 0,
      lastUpdated: new Date().toISOString(),
    },
    lastSynced: null,
    syncSource: null,
  }
}

function getNextSundayReset(): string {
  const now = new Date()
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7
  const nextSunday = new Date(now)
  nextSunday.setDate(now.getDate() + daysUntilSunday)
  nextSunday.setHours(22, 59, 0, 0) // 10:59pm
  return nextSunday.toISOString()
}

function getNextMonthStart(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 13, 59, 0, 0)
  return nextMonth.toISOString()
}

// ============================================================================
// ClaudeMaxUsageTracker Class
// ============================================================================

export class ClaudeMaxUsageTracker {
  private data: ClaudeMaxUsageData
  private storagePath: string
  private statsPath: string

  constructor() {
    this.storagePath = getStoragePath()
    this.statsPath = getClaudeStatsPath()
    this.data = this.load()
    this.syncFromStats()
  }

  // --------------------------------------------------------------------------
  // Load / Save
  // --------------------------------------------------------------------------

  private load(): ClaudeMaxUsageData {
    try {
      if (fs.existsSync(this.storagePath)) {
        const content = fs.readFileSync(this.storagePath, "utf-8")
        const parsed = JSON.parse(content)
        return { ...getDefaultUsageData(), ...parsed }
      }
    } catch (err) {
      log("[claude-max-usage] Error loading data:", err)
    }
    return getDefaultUsageData()
  }

  private save(): void {
    try {
      const dir = path.dirname(this.storagePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(this.data, null, 2))
    } catch (err) {
      log("[claude-max-usage] Error saving data:", err)
    }
  }

  // --------------------------------------------------------------------------
  // Sync from Claude Stats
  // --------------------------------------------------------------------------

  syncFromStats(): void {
    try {
      if (!fs.existsSync(this.statsPath)) {
        log("[claude-max-usage] Stats cache not found:", this.statsPath)
        return
      }

      const content = fs.readFileSync(this.statsPath, "utf-8")
      const stats: ClaudeStatsCache = JSON.parse(content)

      // Calculate total tokens from model usage
      let totalTokens = 0
      for (const model of Object.values(stats.modelUsage || {})) {
        totalTokens += model.inputTokens + model.outputTokens
      }

      this.data.localStats = {
        totalTokens,
        totalSessions: stats.totalSessions || 0,
        totalMessages: stats.totalMessages || 0,
        lastUpdated: new Date().toISOString(),
      }

      // Check if subscription is active (has recent usage with Claude models)
      const hasRecentClaudeUsage = Object.keys(stats.modelUsage || {})
        .some(model => model.includes("claude"))

      if (hasRecentClaudeUsage && this.data.subscription.tier === "unknown") {
        // Assume Max if using Opus
        const hasOpusUsage = Object.keys(stats.modelUsage || {})
          .some(model => model.includes("opus"))
        this.data.subscription.tier = hasOpusUsage ? "max" : "pro"
        this.data.subscription.isActive = true
      }

      this.save()
      log("[claude-max-usage] Synced from stats:", this.data.localStats)
    } catch (err) {
      log("[claude-max-usage] Error syncing from stats:", err)
    }
  }

  // --------------------------------------------------------------------------
  // Manual Update Methods
  // --------------------------------------------------------------------------

  /**
   * Update usage percentages manually (from user input or CLI)
   */
  updateUsage(input: {
    allModelsPercent?: number
    sonnetPercent?: number
    allModelsResetDate?: string
    sonnetResetDate?: string
    tier?: ClaudeMaxUsageData["subscription"]["tier"]
  }): void {
    if (input.allModelsPercent !== undefined) {
      this.data.allModels.percentUsed = Math.max(0, Math.min(100, input.allModelsPercent))
    }
    if (input.sonnetPercent !== undefined) {
      this.data.sonnetOnly.percentUsed = Math.max(0, Math.min(100, input.sonnetPercent))
    }
    if (input.allModelsResetDate) {
      this.data.allModels.resetDate = input.allModelsResetDate
    }
    if (input.sonnetResetDate) {
      this.data.sonnetOnly.resetDate = input.sonnetResetDate
    }
    if (input.tier) {
      this.data.subscription.tier = input.tier
      this.data.subscription.isActive = input.tier !== "free" && input.tier !== "unknown"
    }

    this.data.lastSynced = new Date().toISOString()
    this.data.syncSource = "manual"
    this.save()
  }

  /**
   * Parse usage from text (e.g., from /usage command output)
   */
  parseUsageText(text: string): boolean {
    try {
      // Pattern: "76% used" or "76 % used"
      const allModelsMatch = text.match(/all models\)?[\s\S]*?(\d+)\s*%\s*used/i)
      const sonnetMatch = text.match(/sonnet only\)?[\s\S]*?(\d+)\s*%\s*used/i)

      // Pattern: "Resets Jan 29, 10:59pm"
      const allModelsResetMatch = text.match(/all models\)?[\s\S]*?Resets\s+([A-Za-z]+\s+\d+,?\s*\d*:?\d*\s*(?:am|pm)?)/i)
      const sonnetResetMatch = text.match(/sonnet only\)?[\s\S]*?Resets\s+([A-Za-z]+\s+\d+,?\s*\d*:?\d*\s*(?:am|pm)?)/i)

      let updated = false

      if (allModelsMatch) {
        this.data.allModels.percentUsed = parseInt(allModelsMatch[1], 10)
        updated = true
      }

      if (sonnetMatch) {
        this.data.sonnetOnly.percentUsed = parseInt(sonnetMatch[1], 10)
        updated = true
      }

      if (allModelsResetMatch) {
        this.data.allModels.resetDate = this.parseResetDate(allModelsResetMatch[1])
      }

      if (sonnetResetMatch) {
        this.data.sonnetOnly.resetDate = this.parseResetDate(sonnetResetMatch[1])
      }

      if (updated) {
        this.data.lastSynced = new Date().toISOString()
        this.data.syncSource = "cli"
        this.save()
        log("[claude-max-usage] Parsed usage text:", {
          allModels: this.data.allModels.percentUsed,
          sonnet: this.data.sonnetOnly.percentUsed,
        })
      }

      return updated
    } catch (err) {
      log("[claude-max-usage] Error parsing usage text:", err)
      return false
    }
  }

  private parseResetDate(dateStr: string): string {
    try {
      // Handle "Jan 29, 10:59pm" format
      const now = new Date()
      const year = now.getFullYear()
      const parsed = new Date(`${dateStr} ${year}`)
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
    } catch {
      // Ignore parse errors
    }
    return dateStr
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  getData(): ClaudeMaxUsageData {
    return { ...this.data }
  }

  getAllModelsUsage(): { percent: number; resetDate: string } {
    return {
      percent: this.data.allModels.percentUsed,
      resetDate: this.data.allModels.resetDate,
    }
  }

  getSonnetUsage(): { percent: number; resetDate: string } {
    return {
      percent: this.data.sonnetOnly.percentUsed,
      resetDate: this.data.sonnetOnly.resetDate,
    }
  }

  getSubscriptionTier(): ClaudeMaxUsageData["subscription"]["tier"] {
    return this.data.subscription.tier
  }

  isSubscriptionActive(): boolean {
    return this.data.subscription.isActive
  }

  getLocalStats(): ClaudeMaxUsageData["localStats"] {
    return { ...this.data.localStats }
  }

  /**
   * Check if usage is near limit and should trigger downgrade
   */
  shouldDowngrade(threshold: number = 80): boolean {
    return this.data.allModels.percentUsed >= threshold
  }

  /**
   * Get recommended action based on usage
   */
  getRecommendation(): "normal" | "caution" | "reduce" | "critical" {
    const percent = this.data.allModels.percentUsed
    if (percent >= 95) return "critical"
    if (percent >= 85) return "reduce"
    if (percent >= 70) return "caution"
    return "normal"
  }

  /**
   * Format reset date for display
   */
  formatResetDate(type: "allModels" | "sonnet" = "allModels"): string {
    const data = type === "allModels" ? this.data.allModels : this.data.sonnetOnly
    try {
      const date = new Date(data.resetDate)
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    } catch {
      return data.resetDate
    }
  }

  /**
   * Get days until reset
   */
  getDaysUntilReset(type: "allModels" | "sonnet" = "allModels"): number {
    const data = type === "allModels" ? this.data.allModels : this.data.sonnetOnly
    try {
      const resetDate = new Date(data.resetDate)
      const now = new Date()
      const diff = resetDate.getTime() - now.getTime()
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    } catch {
      return 0
    }
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
