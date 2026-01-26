/**
 * Claude Max Usage Tracker
 * Fetches real-time subscription usage from Anthropic's OAuth API
 */

import * as fs from "fs"
import * as path from "path"
import { homedir } from "os"
import { log } from "../../shared"

// ============================================================================
// Types
// ============================================================================

export interface ClaudeMaxUsageData {
  // Current session (5-hour window)
  currentSession: {
    percentUsed: number
    resetDate: string
  }
  // Weekly usage (all models)
  allModels: {
    percentUsed: number
    resetDate: string
  }
  // Sonnet-only weekly usage
  sonnetOnly: {
    percentUsed: number
    resetDate: string
  }
  // Opus-only weekly usage (if available)
  opusOnly: {
    percentUsed: number
    resetDate: string
  } | null
  // Subscription info
  subscription: {
    tier: "free" | "pro" | "max-5x" | "max-20x" | "team" | "enterprise" | "unknown"
    isActive: boolean
    extraUsageEnabled: boolean
  }
  // Last update time
  lastUpdated: string
  // Error if failed to fetch
  error?: string
}

interface OAuthUsageResponse {
  five_hour?: {
    utilization: number
    resets_at: string
  }
  seven_day?: {
    utilization: number
    resets_at: string
  }
  seven_day_sonnet?: {
    utilization: number
    resets_at: string
  } | null
  seven_day_opus?: {
    utilization: number
    resets_at: string
  } | null
  seven_day_oauth_apps?: unknown
  seven_day_cowork?: unknown
  iguana_necktie?: unknown
  extra_usage?: {
    is_enabled: boolean
    monthly_limit: number | null
    used_credits: number | null
    utilization: number | null
  }
}

interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken: string
    refreshToken: string
    expiresAt: number
    scopes: string[]
    subscriptionType?: string
    rateLimitTier?: string
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCredentialsPath(): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR ||
    path.join(homedir(), ".claude")
  return path.join(claudeDir, ".credentials.json")
}

function loadCredentials(): ClaudeCredentials | null {
  try {
    const credPath = getCredentialsPath()
    if (!fs.existsSync(credPath)) {
      return null
    }
    const content = fs.readFileSync(credPath, "utf-8")
    return JSON.parse(content)
  } catch (err) {
    log("[claude-max-usage] Error loading credentials:", err)
    return null
  }
}

function detectTierFromCredentials(creds: ClaudeCredentials): ClaudeMaxUsageData["subscription"]["tier"] {
  const rateLimitTier = creds.claudeAiOauth?.rateLimitTier || ""
  const subscriptionType = creds.claudeAiOauth?.subscriptionType || ""

  if (rateLimitTier.includes("max_20x") || rateLimitTier.includes("max-20x")) {
    return "max-20x"
  }
  if (rateLimitTier.includes("max_5x") || rateLimitTier.includes("max-5x")) {
    return "max-5x"
  }
  if (subscriptionType === "max") {
    // Default to max-5x if not specified
    return "max-5x"
  }
  if (subscriptionType === "pro" || rateLimitTier.includes("pro")) {
    return "pro"
  }
  if (subscriptionType === "team") {
    return "team"
  }
  if (subscriptionType === "enterprise") {
    return "enterprise"
  }

  return "unknown"
}

function formatResetDate(isoDate: string, timezone?: string): string {
  try {
    const date = new Date(isoDate)
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    })
  } catch {
    return isoDate
  }
}

// ============================================================================
// ClaudeMaxUsageTracker Class
// ============================================================================

export class ClaudeMaxUsageTracker {
  private cachedData: ClaudeMaxUsageData | null = null
  private lastRefresh: number = 0
  private refreshInterval: number = 60000 // 1 minute cache

  constructor() {
    // Initialize
  }

  /**
   * Get usage data, refreshing from API if needed
   */
  async getDataAsync(): Promise<ClaudeMaxUsageData> {
    const now = Date.now()
    if (!this.cachedData || now - this.lastRefresh > this.refreshInterval) {
      await this.refreshAsync()
    }
    return this.cachedData!
  }

  /**
   * Get cached data synchronously (for route handlers)
   */
  getData(): ClaudeMaxUsageData {
    if (!this.cachedData) {
      // Return default data, trigger async refresh
      this.refreshAsync().catch(err => log("[claude-max-usage] Async refresh error:", err))
      return this.getDefaultData()
    }

    // Check if cache is stale and trigger background refresh
    const now = Date.now()
    if (now - this.lastRefresh > this.refreshInterval) {
      this.refreshAsync().catch(err => log("[claude-max-usage] Background refresh error:", err))
    }

    return this.cachedData
  }

  /**
   * Force refresh from Anthropic's OAuth API
   */
  async refreshAsync(): Promise<void> {
    this.cachedData = await this.fetchUsageFromAPI()
    this.lastRefresh = Date.now()
  }

  /**
   * Synchronous refresh (triggers async in background)
   */
  refresh(): void {
    this.refreshAsync().catch(err => log("[claude-max-usage] Refresh error:", err))
  }

  /**
   * Fetch usage data from Anthropic's OAuth API
   */
  private async fetchUsageFromAPI(): Promise<ClaudeMaxUsageData> {
    const defaultData = this.getDefaultData()

    try {
      const creds = loadCredentials()
      if (!creds?.claudeAiOauth?.accessToken) {
        return {
          ...defaultData,
          error: "No OAuth credentials found",
        }
      }

      const token = creds.claudeAiOauth.accessToken
      const tier = detectTierFromCredentials(creds)

      // Call Anthropic's OAuth usage endpoint
      const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "anthropic-beta": "oauth-2025-04-20",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        log("[claude-max-usage] API error:", { status: response.status, error: errorText })
        return {
          ...defaultData,
          subscription: { tier, isActive: true, extraUsageEnabled: false },
          error: `API error: ${response.status}`,
        }
      }

      const data = await response.json() as OAuthUsageResponse

      return {
        currentSession: {
          percentUsed: data.five_hour?.utilization ?? 0,
          resetDate: data.five_hour?.resets_at ?? new Date().toISOString(),
        },
        allModels: {
          percentUsed: data.seven_day?.utilization ?? 0,
          resetDate: data.seven_day?.resets_at ?? new Date().toISOString(),
        },
        sonnetOnly: {
          percentUsed: data.seven_day_sonnet?.utilization ?? 0,
          resetDate: data.seven_day_sonnet?.resets_at ?? new Date().toISOString(),
        },
        opusOnly: data.seven_day_opus ? {
          percentUsed: data.seven_day_opus.utilization,
          resetDate: data.seven_day_opus.resets_at,
        } : null,
        subscription: {
          tier,
          isActive: true,
          extraUsageEnabled: data.extra_usage?.is_enabled ?? false,
        },
        lastUpdated: new Date().toISOString(),
      }
    } catch (err) {
      log("[claude-max-usage] Error fetching usage:", err)
      return {
        ...defaultData,
        error: String(err),
      }
    }
  }

  /**
   * Get default/empty usage data
   */
  private getDefaultData(): ClaudeMaxUsageData {
    return {
      currentSession: {
        percentUsed: 0,
        resetDate: new Date().toISOString(),
      },
      allModels: {
        percentUsed: 0,
        resetDate: new Date().toISOString(),
      },
      sonnetOnly: {
        percentUsed: 0,
        resetDate: new Date().toISOString(),
      },
      opusOnly: null,
      subscription: {
        tier: "unknown",
        isActive: false,
        extraUsageEnabled: false,
      },
      lastUpdated: new Date().toISOString(),
    }
  }

  /**
   * Get usage recommendation based on current usage
   */
  getRecommendation(): "normal" | "caution" | "reduce" | "critical" {
    const data = this.getData()
    const sessionPercent = data.currentSession.percentUsed
    const weeklyPercent = data.allModels.percentUsed

    // Check session first (more immediate concern)
    if (sessionPercent >= 90) return "critical"
    if (sessionPercent >= 70) return "reduce"

    // Check weekly
    if (weeklyPercent >= 90) return "critical"
    if (weeklyPercent >= 70) return "reduce"
    if (weeklyPercent >= 50) return "caution"

    return "normal"
  }

  /**
   * Check if should recommend model downgrade
   */
  shouldDowngrade(): boolean {
    const data = this.getData()
    // Downgrade if weekly usage is high or session usage is very high
    return data.allModels.percentUsed >= 80 || data.currentSession.percentUsed >= 85
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
