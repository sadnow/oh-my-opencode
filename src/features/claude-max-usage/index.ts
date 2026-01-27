/**
 * Claude Max Usage Tracker
 * Fetches real-time subscription usage from Anthropic's OAuth API
 * Includes 24-hour history tracking with automatic polling
 */

import * as fs from "fs"
import * as path from "path"
import { homedir } from "os"
import { log } from "../../shared"

// ============================================================================
// Types
// ============================================================================

export interface UsageHistoryPoint {
  timestamp: string
  sessionPercent: number
  allModelsPercent: number
  sonnetPercent: number
}

export interface UsageHistory {
  points: UsageHistoryPoint[]
  lastUpdated: string
}

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

interface OAuthRefreshResponse {
  token_type: string
  access_token: string
  expires_in: number
  refresh_token: string
  scope: string
}

// Claude Code OAuth client ID (official)
const CLAUDE_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
const CLAUDE_OAUTH_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token"

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

function saveCredentials(creds: ClaudeCredentials): void {
  try {
    const credPath = getCredentialsPath()
    fs.writeFileSync(credPath, JSON.stringify(creds, null, 2))
    log("[claude-max-usage] Credentials saved successfully")
  } catch (err) {
    log("[claude-max-usage] Error saving credentials:", err)
  }
}

function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false
  // Consider expired if less than 5 minutes remaining
  const bufferMs = 5 * 60 * 1000
  return Date.now() + bufferMs >= expiresAt
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: number
} | null> {
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLAUDE_OAUTH_CLIENT_ID,
    })

    const response = await fetch(CLAUDE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log("[claude-max-usage] Token refresh failed:", { status: response.status, error: errorText })
      return null
    }

    const data = await response.json() as OAuthRefreshResponse

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
  } catch (err) {
    log("[claude-max-usage] Error refreshing token:", err)
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

function getHistoryPath(): string {
  const configDir = path.join(homedir(), ".config", "opencode")
  return path.join(configDir, "claude-max-history.json")
}

// ============================================================================
// ClaudeMaxUsageTracker Class
// ============================================================================

export class ClaudeMaxUsageTracker {
  private cachedData: ClaudeMaxUsageData | null = null
  private lastRefresh: number = 0
  private refreshInterval: number = 60000 // 1 minute cache
  private history: UsageHistory = { points: [], lastUpdated: new Date().toISOString() }
  private historyInterval: ReturnType<typeof setInterval> | null = null
  private readonly HISTORY_POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_HISTORY_POINTS = 288 // 24 hours at 5-min intervals

  constructor() {
    this.loadHistory()
    this.startHistoryPolling()
  }

  /**
   * Load history from disk
   */
  private loadHistory(): void {
    try {
      const historyPath = getHistoryPath()
      if (fs.existsSync(historyPath)) {
        const content = fs.readFileSync(historyPath, "utf-8")
        const loaded = JSON.parse(content) as UsageHistory
        // Filter to only keep last 24 hours
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        this.history = {
          points: loaded.points.filter(p => new Date(p.timestamp).getTime() > cutoff),
          lastUpdated: loaded.lastUpdated,
        }
      }
    } catch (err) {
      log("[claude-max-usage] Error loading history:", err)
    }
  }

  /**
   * Save history to disk
   */
  private saveHistory(): void {
    try {
      const historyPath = getHistoryPath()
      const dir = path.dirname(historyPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(historyPath, JSON.stringify(this.history, null, 2))
    } catch (err) {
      log("[claude-max-usage] Error saving history:", err)
    }
  }

  /**
   * Start automatic history polling
   */
  private startHistoryPolling(): void {
    // Record initial point
    this.recordHistoryPoint()

    // Poll every 5 minutes
    this.historyInterval = setInterval(() => {
      this.recordHistoryPoint()
    }, this.HISTORY_POLL_INTERVAL)
  }

  /**
   * Stop history polling (for cleanup)
   */
  stopHistoryPolling(): void {
    if (this.historyInterval) {
      clearInterval(this.historyInterval)
      this.historyInterval = null
    }
  }

  /**
   * Record a history point from current data
   */
  private async recordHistoryPoint(): Promise<void> {
    try {
      const data = await this.getDataAsync()
      if (data.error) return // Don't record errors

      const point: UsageHistoryPoint = {
        timestamp: new Date().toISOString(),
        sessionPercent: data.currentSession.percentUsed,
        allModelsPercent: data.allModels.percentUsed,
        sonnetPercent: data.sonnetOnly.percentUsed,
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
      log("[claude-max-usage] Error recording history point:", err)
    }
  }

  /**
   * Get usage history for the last 24 hours
   */
  getHistory(): UsageHistory {
    // Filter to only last 24 hours
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
      let creds = loadCredentials()
      if (!creds?.claudeAiOauth?.accessToken) {
        return {
          ...defaultData,
          error: "No OAuth credentials found",
        }
      }

      // Check if token is expired and refresh if needed
      if (isTokenExpired(creds.claudeAiOauth.expiresAt) && creds.claudeAiOauth.refreshToken) {
        log("[claude-max-usage] Token expired, refreshing...")
        const refreshed = await refreshAccessToken(creds.claudeAiOauth.refreshToken)
        if (refreshed) {
          // Update credentials with new tokens
          creds.claudeAiOauth.accessToken = refreshed.accessToken
          creds.claudeAiOauth.refreshToken = refreshed.refreshToken
          creds.claudeAiOauth.expiresAt = refreshed.expiresAt
          saveCredentials(creds)
          log("[claude-max-usage] Token refreshed successfully")
        } else {
          log("[claude-max-usage] Token refresh failed")
          return {
            ...defaultData,
            error: "Token expired and refresh failed. Please re-authenticate with Claude.",
          }
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
        
        // If 401, token might have expired between check and use - try refresh once more
        if (response.status === 401 && creds.claudeAiOauth.refreshToken) {
          log("[claude-max-usage] Got 401, attempting token refresh...")
          const refreshed = await refreshAccessToken(creds.claudeAiOauth.refreshToken)
          if (refreshed) {
            creds.claudeAiOauth.accessToken = refreshed.accessToken
            creds.claudeAiOauth.refreshToken = refreshed.refreshToken
            creds.claudeAiOauth.expiresAt = refreshed.expiresAt
            saveCredentials(creds)
            // Retry the API call
            const retryResponse = await fetch("https://api.anthropic.com/api/oauth/usage", {
              headers: {
                "Authorization": `Bearer ${refreshed.accessToken}`,
                "anthropic-beta": "oauth-2025-04-20",
              },
            })
            if (retryResponse.ok) {
              const data = await retryResponse.json() as OAuthUsageResponse
              return this.parseUsageResponse(data, tier)
            }
          }
        }
        
        return {
          ...defaultData,
          subscription: { tier, isActive: true, extraUsageEnabled: false },
          error: `API error: ${response.status}`,
        }
      }

      const data = await response.json() as OAuthUsageResponse
      return this.parseUsageResponse(data, tier)
    } catch (err) {
      log("[claude-max-usage] Error fetching usage:", err)
      return {
        ...defaultData,
        error: String(err),
      }
    }
  }

  /**
   * Parse the OAuth usage response into our data structure
   */
  private parseUsageResponse(
    data: OAuthUsageResponse,
    tier: ClaudeMaxUsageData["subscription"]["tier"]
  ): ClaudeMaxUsageData {
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
