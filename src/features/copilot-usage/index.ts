/**
 * Copilot Usage Tracker
 * Fetches GitHub Copilot usage from internal API using gh CLI authentication
 * Includes 24-hour history tracking with caching
 */

import * as fs from "fs"
import * as path from "path"
import { homedir } from "os"
import { execSync } from "child_process"
import { log } from "../../shared"

// ============================================================================
// Types
// ============================================================================

export interface CopilotUsageData {
  // Current month usage
  percentUsed: number              // e.g., 100.6
  premiumRequestsUsed: number | null
  premiumRequestsLimit: number | null

  // Reset info
  resetDate: string               // From API quota_reset_date_utc
  daysUntilReset: number

  // Subscription info
  plan: "free" | "pro" | "business" | "enterprise" | "unknown"
  copilotPlan?: string            // Raw plan from API (e.g., "individual_pro")
  isOverLimit: boolean

  // Metadata
  lastUpdated: string
  error?: string
  needsAuth?: boolean
  fetchMethod: "api" | "cached" | "none"
}

export interface CopilotHistoryPoint {
  timestamp: string
  percentUsed: number
}

export interface CopilotHistory {
  points: CopilotHistoryPoint[]
  lastUpdated: string
}

interface GitHubCopilotAPIResponse {
  copilot_plan?: string
  quota_reset_date_utc?: string
  quota_snapshots?: {
    premium_interactions?: {
      percent_remaining?: number
      entitlement?: number
      remaining?: number
    }
  }
}

interface CopilotFetchResult {
  percentUsed: number
  resetDate?: string
  plan?: string
  premiumRequestsUsed?: number
  premiumRequestsLimit?: number
  error?: string
  needsAuth?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCachePath(): string {
  const configDir = path.join(homedir(), ".config", "opencode")
  return path.join(configDir, "copilot-usage-cache.json")
}

function getHistoryPath(): string {
  const configDir = path.join(homedir(), ".config", "opencode")
  return path.join(configDir, "copilot-usage-history.json")
}

function ensureConfigDir(): void {
  const configDir = path.join(homedir(), ".config", "opencode")
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
}

/**
 * Calculate days until a given reset date
 */
function getDaysUntilReset(resetDateStr: string): number {
  const now = new Date()
  const resetDate = new Date(resetDateStr)
  const msUntilReset = resetDate.getTime() - now.getTime()
  return Math.ceil(msUntilReset / (1000 * 60 * 60 * 24))
}

/**
 * Calculate next monthly reset date (1st of next month at 00:00:00 UTC)
 * Used as fallback if API doesn't provide reset date
 */
function getNextMonthlyReset(): { resetDate: string; daysUntilReset: number } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()

  // First of next month
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  const resetDate = new Date(Date.UTC(nextYear, nextMonth, 1, 0, 0, 0, 0))

  // Calculate days until reset
  const msUntilReset = resetDate.getTime() - now.getTime()
  const daysUntilReset = Math.ceil(msUntilReset / (1000 * 60 * 60 * 24))

  return {
    resetDate: resetDate.toISOString(),
    daysUntilReset,
  }
}

/**
 * Format reset date for display
 */
export function formatResetDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })
  } catch {
    return isoDate
  }
}

/**
 * Map API plan name to our plan type
 */
function mapPlanType(apiPlan?: string): "free" | "pro" | "business" | "enterprise" | "unknown" {
  if (!apiPlan) return "unknown"
  const plan = apiPlan.toLowerCase()
  if (plan.includes("enterprise")) return "enterprise"
  if (plan.includes("business")) return "business"
  if (plan.includes("pro") || plan.includes("individual")) return "pro"
  if (plan.includes("free")) return "free"
  return "unknown"
}

// ============================================================================
// API Fetch Function
// ============================================================================

/**
 * Fetch Copilot usage from GitHub internal API
 */
async function fetchFromGitHubAPI(): Promise<CopilotFetchResult> {
  // Get gh token
  let token: string
  try {
    token = execSync("gh auth token", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim()
  } catch (err) {
    log("[copilot-usage] Failed to get gh token: " + String(err))
    return {
      percentUsed: 0,
      needsAuth: true,
      error: "GitHub CLI not authenticated. Run 'gh auth login' to authenticate.",
    }
  }

  if (!token) {
    return {
      percentUsed: 0,
      needsAuth: true,
      error: "No GitHub token found. Run 'gh auth login' to authenticate.",
    }
  }

  try {
    const response = await fetch("https://api.github.com/copilot_internal/user", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "User-Agent": "oh-im-broke",
      },
    })

    if (response.status === 401) {
      return {
        percentUsed: 0,
        needsAuth: true,
        error: "GitHub token expired. Run 'gh auth login' to re-authenticate.",
      }
    }

    if (!response.ok) {
      return {
        percentUsed: 0,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      }
    }

    const data = await response.json() as GitHubCopilotAPIResponse

    const premium = data.quota_snapshots?.premium_interactions
    const percentRemaining = premium?.percent_remaining ?? 100

    // Calculate percentUsed: 100 - percent_remaining
    // Note: percent_remaining can be negative when over limit (e.g., -0.6 means 100.6% used)
    const percentUsed = 100 - percentRemaining

    // Calculate requests used/limit from entitlement and remaining
    let premiumRequestsUsed: number | undefined
    let premiumRequestsLimit: number | undefined
    if (premium?.entitlement !== undefined && premium?.remaining !== undefined) {
      premiumRequestsLimit = premium.entitlement
      premiumRequestsUsed = premium.entitlement - premium.remaining
    }

    return {
      percentUsed,
      resetDate: data.quota_reset_date_utc,
      plan: data.copilot_plan,
      premiumRequestsUsed,
      premiumRequestsLimit,
    }
  } catch (err) {
    log("[copilot-usage] API fetch error: " + String(err))
    return {
      percentUsed: 0,
      error: "Failed to fetch from GitHub API: " + String(err),
    }
  }
}

// ============================================================================
// CopilotUsageTracker Class
// ============================================================================

export class CopilotUsageTracker {
  private cachedData: CopilotUsageData | null = null
  private history: CopilotHistory = { points: [], lastUpdated: new Date().toISOString() }
  private historyInterval: ReturnType<typeof setInterval> | null = null
  private liveRefreshInterval: ReturnType<typeof setInterval> | null = null
  private isRefreshing: boolean = false

  // Configuration
  private readonly HISTORY_POLL_INTERVAL = 15 * 60 * 1000 // 15 minutes for history recording
  private readonly LIVE_REFRESH_INTERVAL = 60 * 1000 // 60 seconds for live API refresh
  private readonly MAX_HISTORY_POINTS = 96 // 24 hours at 15-min intervals
  private readonly CACHE_MAX_AGE = 60 * 60 * 1000 // 1 hour cache validity

  constructor() {
    this.loadCache()
    this.loadHistory()
  }

  /**
   * Start automatic history polling
   */
  startHistoryPolling(): void {
    if (this.historyInterval) return // Already polling

    log("[copilot-usage] Starting history polling")
    this.historyInterval = setInterval(() => {
      this.recordHistoryPoint()
    }, this.HISTORY_POLL_INTERVAL)
  }

  /**
   * Start live refresh polling (fetches from API every 60 seconds)
   */
  startLiveRefresh(): void {
    if (this.liveRefreshInterval) return // Already polling

    log("[copilot-usage] Starting live refresh (every 60s)")
    // Do an initial refresh
    this.refreshAsync().catch(err => log("[copilot-usage] Initial refresh error:", err))

    this.liveRefreshInterval = setInterval(() => {
      this.refreshAsync().catch(err => log("[copilot-usage] Live refresh error:", err))
    }, this.LIVE_REFRESH_INTERVAL)
  }

  /**
   * Stop live refresh polling
   */
  stopLiveRefresh(): void {
    if (this.liveRefreshInterval) {
      clearInterval(this.liveRefreshInterval)
      this.liveRefreshInterval = null
      log("[copilot-usage] Stopped live refresh")
    }
  }

  /**
   * Stop history polling (for cleanup)
   */
  stopHistoryPolling(): void {
    if (this.historyInterval) {
      clearInterval(this.historyInterval)
      this.historyInterval = null
      log("[copilot-usage] Stopped history polling")
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopHistoryPolling()
    this.stopLiveRefresh()
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  private loadCache(): void {
    try {
      const cachePath = getCachePath()
      if (fs.existsSync(cachePath)) {
        const content = fs.readFileSync(cachePath, "utf-8")
        const loaded = JSON.parse(content) as CopilotUsageData

        // Check if cache is still valid (within max age)
        const cacheAge = Date.now() - new Date(loaded.lastUpdated).getTime()
        if (cacheAge < this.CACHE_MAX_AGE) {
          this.cachedData = {
            ...loaded,
            fetchMethod: "cached",
          }
          log("[copilot-usage] Loaded valid cache, age: " + Math.round(cacheAge / 60000) + " minutes")
        } else {
          log("[copilot-usage] Cache expired, age: " + Math.round(cacheAge / 60000) + " minutes")
        }
      }
    } catch (err) {
      log("[copilot-usage] Error loading cache:", err)
    }
  }

  private saveCache(): void {
    try {
      ensureConfigDir()
      const cachePath = getCachePath()
      fs.writeFileSync(cachePath, JSON.stringify(this.cachedData, null, 2))
    } catch (err) {
      log("[copilot-usage] Error saving cache:", err)
    }
  }

  // --------------------------------------------------------------------------
  // History Management
  // --------------------------------------------------------------------------

  private loadHistory(): void {
    try {
      const historyPath = getHistoryPath()
      if (fs.existsSync(historyPath)) {
        const content = fs.readFileSync(historyPath, "utf-8")
        const loaded = JSON.parse(content) as CopilotHistory

        // Filter to only keep last 24 hours
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        this.history = {
          points: loaded.points.filter(p => new Date(p.timestamp).getTime() > cutoff),
          lastUpdated: loaded.lastUpdated,
        }
        log("[copilot-usage] Loaded history with " + this.history.points.length + " points")
      }
    } catch (err) {
      log("[copilot-usage] Error loading history:", err)
    }
  }

  private saveHistory(): void {
    try {
      ensureConfigDir()
      const historyPath = getHistoryPath()
      fs.writeFileSync(historyPath, JSON.stringify(this.history, null, 2))
    } catch (err) {
      log("[copilot-usage] Error saving history:", err)
    }
  }

  private async recordHistoryPoint(): Promise<void> {
    // Only record if we have cached data
    if (!this.cachedData || this.cachedData.error) return

    try {
      const point: CopilotHistoryPoint = {
        timestamp: new Date().toISOString(),
        percentUsed: this.cachedData.percentUsed,
      }

      this.history.points.push(point)
      this.history.lastUpdated = point.timestamp

      // Trim to max points (keep last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      this.history.points = this.history.points.filter(
        p => new Date(p.timestamp).getTime() > cutoff
      )

      // Also enforce max points limit
      if (this.history.points.length > this.MAX_HISTORY_POINTS) {
        this.history.points = this.history.points.slice(-this.MAX_HISTORY_POINTS)
      }

      this.saveHistory()
    } catch (err) {
      log("[copilot-usage] Error recording history point:", err)
    }
  }

  /**
   * Get usage history for the last 24 hours
   */
  getHistory(): CopilotHistory {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return {
      points: this.history.points.filter(p => new Date(p.timestamp).getTime() > cutoff),
      lastUpdated: this.history.lastUpdated,
    }
  }

  /**
   * Force record a history point now
   */
  async recordNow(): Promise<void> {
    await this.recordHistoryPoint()
  }

  // --------------------------------------------------------------------------
  // Data Access
  // --------------------------------------------------------------------------

  /**
   * Get usage data asynchronously (fetches fresh if needed)
   */
  async getDataAsync(): Promise<CopilotUsageData> {
    // If no cached data or cache is stale, try to refresh
    if (!this.cachedData) {
      return this.getDefaultData("No cached data available. Click Refresh to fetch from GitHub.")
    }

    return this.cachedData
  }

  /**
   * Get cached data synchronously (for quick access)
   */
  getData(): CopilotUsageData {
    if (!this.cachedData) {
      return this.getDefaultData("No cached data available. Click Refresh to fetch from GitHub.")
    }
    return this.cachedData
  }

  /**
   * Force refresh from GitHub API
   * Returns the fetched data or error
   */
  async refreshAsync(): Promise<CopilotUsageData> {
    if (this.isRefreshing) {
      log("[copilot-usage] Refresh already in progress, returning cached data")
      return this.cachedData || this.getDefaultData("Refresh in progress...")
    }

    this.isRefreshing = true

    try {
      log("[copilot-usage] Starting API fetch...")
      const result = await fetchFromGitHubAPI()

      if (result.needsAuth) {
        const data = this.getDefaultData(result.error || "Please authenticate with GitHub CLI")
        data.needsAuth = true
        this.cachedData = data
        this.saveCache()
        return data
      }

      if (result.error) {
        const data = this.getDefaultData(result.error)
        data.percentUsed = result.percentUsed || 0
        this.cachedData = data
        this.saveCache()
        return data
      }

      // Success - build full data
      // Use reset date from API, or fall back to calculated
      let resetDate: string
      let daysUntilReset: number

      if (result.resetDate) {
        resetDate = result.resetDate
        daysUntilReset = getDaysUntilReset(resetDate)
      } else {
        const fallback = getNextMonthlyReset()
        resetDate = fallback.resetDate
        daysUntilReset = fallback.daysUntilReset
      }

      const data: CopilotUsageData = {
        percentUsed: result.percentUsed,
        premiumRequestsUsed: result.premiumRequestsUsed ?? null,
        premiumRequestsLimit: result.premiumRequestsLimit ?? null,
        resetDate,
        daysUntilReset,
        plan: mapPlanType(result.plan),
        copilotPlan: result.plan,
        isOverLimit: result.percentUsed >= 100,
        lastUpdated: new Date().toISOString(),
        fetchMethod: "api",
      }

      this.cachedData = data
      this.saveCache()

      // Record to history
      await this.recordHistoryPoint()

      log("[copilot-usage] Fetch successful, usage: " + result.percentUsed.toFixed(2) + "%")
      return data
    } catch (err) {
      log("[copilot-usage] Refresh error: " + String(err))
      const data = this.getDefaultData(String(err))
      this.cachedData = data
      return data
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Get default/empty usage data
   */
  private getDefaultData(error?: string): CopilotUsageData {
    const { resetDate, daysUntilReset } = getNextMonthlyReset()

    return {
      percentUsed: 0,
      premiumRequestsUsed: null,
      premiumRequestsLimit: null,
      resetDate,
      daysUntilReset,
      plan: "unknown",
      isOverLimit: false,
      lastUpdated: new Date().toISOString(),
      error,
      needsAuth: false,
      fetchMethod: "none",
    }
  }

  // --------------------------------------------------------------------------
  // Recommendations
  // --------------------------------------------------------------------------

  /**
   * Get usage recommendation based on current usage
   */
  getRecommendation(): "normal" | "caution" | "reduce" | "critical" {
    const data = this.getData()
    const percent = data.percentUsed

    if (percent >= 100) return "critical"
    if (percent >= 80) return "reduce"
    if (percent >= 60) return "caution"
    return "normal"
  }

  /**
   * Check if should recommend reducing Copilot usage
   */
  shouldReduceUsage(): boolean {
    const data = this.getData()
    return data.percentUsed >= 80 || data.isOverLimit
  }

  /**
   * Format reset date for display
   */
  formatResetDate(isoDate: string): string {
    return formatResetDate(isoDate)
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: CopilotUsageTracker | null = null

export function getCopilotUsageTracker(): CopilotUsageTracker {
  if (!instance) {
    instance = new CopilotUsageTracker()
  }
  return instance
}

export async function resetCopilotUsageTracker(): Promise<void> {
  if (instance) {
    await instance.cleanup()
  }
  instance = null
}
