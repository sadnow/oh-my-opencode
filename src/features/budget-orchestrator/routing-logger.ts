/**
 * Routing Logger
 *
 * Captures all model routing decisions, tier changes, and budget events
 * for display in the WebUI.
 */

import * as fs from "fs"
import * as path from "path"

export interface RoutingLogEntry {
  timestamp: string
  level: "info" | "warning" | "error" | "decision"
  category: "tier_change" | "upgrade_scheduled" | "downgrade_scheduled" | "upgrade_executed" | "downgrade_executed" | "budget_alert" | "override" | "adaptive"
  message: string
  metadata?: Record<string, any>
}

export class RoutingLogger {
  private logs: RoutingLogEntry[] = []
  private maxLogs = 1000  // Keep last 1000 entries
  private persist = false
  private logFilePath = "oh-my-opencode-routing-logs.json"

  /**
   * Enable or disable persistence
   */
  setPersist(enabled: boolean) {
    this.persist = enabled
    if (enabled) {
      this.loadLogs()
    }
  }

  /**
   * Load logs from file
   */
  private loadLogs() {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const content = fs.readFileSync(this.logFilePath, "utf-8")
        const loadedLogs = JSON.parse(content)
        if (Array.isArray(loadedLogs)) {
          this.logs = loadedLogs
          // Ensure we don't exceed maxLogs on load
          if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs)
          }
        }
      }
    } catch (error) {
      console.error("[routing-logger] Failed to load logs:", error)
    }
  }

  /**
   * Save logs to file
   */
  private saveLogs() {
    if (!this.persist) return

    try {
      fs.writeFileSync(this.logFilePath, JSON.stringify(this.logs, null, 2), "utf-8")
    } catch (error) {
      console.error("[routing-logger] Failed to save logs:", error)
    }
  }

  /**
   * Log a tier change event
   */
  logTierChange(from: string, to: string, reason: string, metadata?: Record<string, any>) {
    this.addLog({
      level: "info",
      category: "tier_change",
      message: `Tier changed: ${from.toUpperCase()} → ${to.toUpperCase()} (${reason})`,
      metadata: { from, to, reason, ...metadata },
    })
  }

  /**
   * Log an upgrade being scheduled
   */
  logUpgradeScheduled(provider: string, from: string, to: string, confidence: number, reason: string) {
    this.addLog({
      level: "decision",
      category: "upgrade_scheduled",
      message: `Upgrade scheduled for ${provider}: ${from} → ${to} (confidence: ${(confidence * 100).toFixed(0)}%)`,
      metadata: { provider, from, to, confidence, reason },
    })
  }

  /**
   * Log a downgrade being scheduled
   */
  logDowngradeScheduled(provider: string, from: string, to: string, confidence: number, reason: string) {
    this.addLog({
      level: "warning",
      category: "downgrade_scheduled",
      message: `Downgrade scheduled for ${provider}: ${from} → ${to} (confidence: ${(confidence * 100).toFixed(0)}%)`,
      metadata: { provider, from, to, confidence, reason },
    })
  }

  /**
   * Log an upgrade being executed
   */
  logUpgradeExecuted(provider: string, model: string, tier: string) {
    this.addLog({
      level: "info",
      category: "upgrade_executed",
      message: `✓ Upgraded ${provider} to ${tier.toUpperCase()} tier (now using ${model})`,
      metadata: { provider, model, tier },
    })
  }

  /**
   * Log a downgrade being executed
   */
  logDowngradeExecuted(provider: string, model: string, tier: string) {
    this.addLog({
      level: "warning",
      category: "downgrade_executed",
      message: `↓ Downgraded ${provider} to ${tier.toUpperCase()} tier (now using ${model})`,
      metadata: { provider, model, tier },
    })
  }

  /**
   * Log a budget alert
   */
  logBudgetAlert(provider: string, percentUsed: number, threshold: number, action: string) {
    this.addLog({
      level: percentUsed >= 90 ? "error" : "warning",
      category: "budget_alert",
      message: `Budget alert for ${provider}: ${percentUsed.toFixed(1)}% used (threshold: ${threshold}%) - ${action}`,
      metadata: { provider, percentUsed, threshold, action },
    })
  }

  /**
   * Log a tier override
   */
  logOverride(type: "force" | "lock" | "unlock" | "clear", tier?: string, source?: string) {
    const actions = {
      force: `Tier forced to ${tier?.toUpperCase()}`,
      lock: "Tier locked (auto-routing disabled)",
      unlock: "Tier unlocked (auto-routing re-enabled)",
      clear: "All overrides cleared",
    }

    this.addLog({
      level: "info",
      category: "override",
      message: `Override: ${actions[type]}${source ? ` by ${source}` : ""}`,
      metadata: { type, tier, source },
    })
  }

  /**
   * Log adaptive learning events
   */
  logAdaptive(provider: string, metric: string, value: number, interpretation: string) {
    this.addLog({
      level: "info",
      category: "adaptive",
      message: `Adaptive learning (${provider}): ${metric} = ${value.toFixed(3)} - ${interpretation}`,
      metadata: { provider, metric, value, interpretation },
    })
  }

  /**
   * Log general info
   */
  logInfo(category: RoutingLogEntry["category"], message: string, metadata?: Record<string, any>) {
    this.addLog({
      level: "info",
      category,
      message,
      metadata,
    })
  }

  /**
   * Log warning
   */
  logWarning(category: RoutingLogEntry["category"], message: string, metadata?: Record<string, any>) {
    this.addLog({
      level: "warning",
      category,
      message,
      metadata,
    })
  }

  /**
   * Log error
   */
  logError(category: RoutingLogEntry["category"], message: string, metadata?: Record<string, any>) {
    this.addLog({
      level: "error",
      category,
      message,
      metadata,
    })
  }

  /**
   * Get all logs
   */
  getLogs(limit?: number, level?: RoutingLogEntry["level"], category?: RoutingLogEntry["category"]): RoutingLogEntry[] {
    let filtered = [...this.logs]

    if (level) {
      filtered = filtered.filter(log => log.level === level)
    }

    if (category) {
      filtered = filtered.filter(log => log.category === category)
    }

    if (limit) {
      filtered = filtered.slice(-limit)
    }

    return filtered.reverse()  // Most recent first
  }

  /**
   * Get logs since a certain time
   */
  getLogsSince(since: Date): RoutingLogEntry[] {
    const sinceTime = since.getTime()
    return this.logs.filter(log => new Date(log.timestamp).getTime() >= sinceTime).reverse()
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = []
    this.saveLogs()
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number
    byLevel: Record<string, number>
    byCategory: Record<string, number>
    last24h: number
  } {
    const now = Date.now()
    const last24h = this.logs.filter(log => now - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000).length

    const byLevel: Record<string, number> = {}
    const byCategory: Record<string, number> = {}

    for (const log of this.logs) {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1
      byCategory[log.category] = (byCategory[log.category] || 0) + 1
    }

    return {
      total: this.logs.length,
      byLevel,
      byCategory,
      last24h,
    }
  }

  /**
   * Internal: Add log entry
   */
  private addLog(entry: Omit<RoutingLogEntry, "timestamp">) {
    this.logs.push({
      ...entry,
      timestamp: new Date().toISOString(),
    })

    // Trim to max size
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    this.saveLogs()
  }
}

// Singleton instance
let instance: RoutingLogger | null = null

export function getRoutingLogger(): RoutingLogger {
  if (!instance) {
    instance = new RoutingLogger()
  }
  return instance
}
