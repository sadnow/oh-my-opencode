/**
 * Usage Tracking Health Check
 * 
 * Monitors usage tracking system health and detects anomalies that could
 * indicate the outputTokens=0 bug has regressed.
 * 
 * USAGE:
 *   import { checkUsageTracking } from './health-check'
 *   const health = await checkUsageTracking('/path/to/storage.json')
 *   if (!health.healthy) {
 *     console.warn('Usage tracking issues detected:', health.warnings)
 *   }
 */

import { existsSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { log } from "../../shared"

export interface HealthCheckResult {
  healthy: boolean
  warnings: string[]
  checks: {
    fileExists: boolean
    recentlyUpdated: boolean
    hasRecentRecords: boolean
    noZeroOutputTokens: boolean
    validCosts: boolean
  }
  stats?: {
    totalRecords: number
    recentRecords: number
    avgInputTokens: number
    avgOutputTokens: number
    avgCost: number
    lastUpdateAge: number // milliseconds
  }
}

export interface UsageRecord {
  timestamp: string
  sessionID: string
  inputTokens: number
  outputTokens: number
  cost: number
  modelName?: string
  provider?: string
}

export interface UsageStorage {
  lastUpdated: string
  records: UsageRecord[]
}

const HEALTH_CHECK_OPTIONS = {
  /** Maximum age for "recently updated" check (5 minutes) */
  MAX_UPDATE_AGE_MS: 5 * 60 * 1000,
  /** Minimum number of records to expect in recent window */
  MIN_RECENT_RECORDS: 1,
  /** Time window for "recent records" check (1 hour) */
  RECENT_WINDOW_MS: 60 * 60 * 1000,
  /** Maximum percentage of records with outputTokens=0 before warning (10%) */
  MAX_ZERO_OUTPUT_PERCENTAGE: 0.1,
}

/**
 * Check health of usage tracking system
 * 
 * @param storagePath - Path to usage storage JSON file
 * @returns Health check result with warnings
 */
export async function checkUsageTracking(storagePath: string): Promise<HealthCheckResult> {
  const warnings: string[] = []
  const checks = {
    fileExists: false,
    recentlyUpdated: false,
    hasRecentRecords: false,
    noZeroOutputTokens: false,
    validCosts: false,
  }

  // Check 1: File exists
  if (!existsSync(storagePath)) {
    warnings.push(`Storage file not found: ${storagePath}`)
    return { healthy: false, warnings, checks }
  }
  checks.fileExists = true

  try {
    // Check 2: File recently updated
    const fileStats = statSync(storagePath)
    const updateAge = Date.now() - fileStats.mtimeMs
    checks.recentlyUpdated = updateAge < HEALTH_CHECK_OPTIONS.MAX_UPDATE_AGE_MS

    if (!checks.recentlyUpdated) {
      warnings.push(
        `Storage file not updated in ${Math.round(updateAge / 60000)} minutes (threshold: ${HEALTH_CHECK_OPTIONS.MAX_UPDATE_AGE_MS / 60000}m)`
      )
    }

    // Read storage data
    const content = readFileSync(storagePath, "utf-8")
    const storage: UsageStorage = JSON.parse(content)

    if (!storage.records || !Array.isArray(storage.records)) {
      warnings.push("Storage file missing 'records' array")
      return { healthy: false, warnings, checks }
    }

    // Check 3: Has recent records
    const now = Date.now()
    const recentRecords = storage.records.filter((r) => {
      const recordTime = new Date(r.timestamp).getTime()
      return now - recordTime < HEALTH_CHECK_OPTIONS.RECENT_WINDOW_MS
    })

    checks.hasRecentRecords = recentRecords.length >= HEALTH_CHECK_OPTIONS.MIN_RECENT_RECORDS

    if (!checks.hasRecentRecords && storage.records.length > 0) {
      const lastRecordTime = new Date(storage.records[storage.records.length - 1].timestamp)
      const lastRecordAge = Math.round((now - lastRecordTime.getTime()) / 60000)
      warnings.push(
        `No recent records found (last record: ${lastRecordAge}m ago, threshold: ${HEALTH_CHECK_OPTIONS.RECENT_WINDOW_MS / 60000}m)`
      )
    }

    // Check 4: No excessive zero outputTokens (CRITICAL REGRESSION CHECK)
    const zeroOutputRecords = recentRecords.filter((r) => r.outputTokens === 0)
    const zeroPercentage = recentRecords.length > 0 ? zeroOutputRecords.length / recentRecords.length : 0

    checks.noZeroOutputTokens = zeroPercentage <= HEALTH_CHECK_OPTIONS.MAX_ZERO_OUTPUT_PERCENTAGE

    if (!checks.noZeroOutputTokens) {
      warnings.push(
        `⚠️ CRITICAL: ${Math.round(zeroPercentage * 100)}% of recent records have outputTokens=0 (${zeroOutputRecords.length}/${recentRecords.length})`
      )
      warnings.push("This may indicate the outputTokens bug has regressed!")
    }

    // Check 5: Valid costs (should be > 0 for records with tokens)
    const invalidCostRecords = recentRecords.filter(
      (r) => (r.inputTokens > 0 || r.outputTokens > 0) && r.cost <= 0
    )
    checks.validCosts = invalidCostRecords.length === 0

    if (!checks.validCosts) {
      warnings.push(
        `Found ${invalidCostRecords.length} records with tokens but zero/negative cost`
      )
    }

    // Calculate stats
    const healthStats = calculateStats(storage.records, recentRecords, updateAge)

    const healthy =
      checks.fileExists &&
      checks.noZeroOutputTokens &&
      checks.validCosts

    return {
      healthy,
      warnings,
      checks,
      stats: healthStats,
    }
  } catch (error) {
    warnings.push(`Error reading storage file: ${error instanceof Error ? error.message : String(error)}`)
    return { healthy: false, warnings, checks }
  }
}

function calculateStats(
  allRecords: UsageRecord[],
  recentRecords: UsageRecord[],
  lastUpdateAge: number
): HealthCheckResult["stats"] {
  if (allRecords.length === 0) {
    return {
      totalRecords: 0,
      recentRecords: 0,
      avgInputTokens: 0,
      avgOutputTokens: 0,
      avgCost: 0,
      lastUpdateAge,
    }
  }

  const avgInputTokens =
    recentRecords.reduce((sum, r) => sum + r.inputTokens, 0) / recentRecords.length || 0
  const avgOutputTokens =
    recentRecords.reduce((sum, r) => sum + r.outputTokens, 0) / recentRecords.length || 0
  const avgCost = recentRecords.reduce((sum, r) => sum + r.cost, 0) / recentRecords.length || 0

  return {
    totalRecords: allRecords.length,
    recentRecords: recentRecords.length,
    avgInputTokens: Math.round(avgInputTokens),
    avgOutputTokens: Math.round(avgOutputTokens),
    avgCost: Math.round(avgCost * 100000) / 100000, // 5 decimal places
    lastUpdateAge,
  }
}

/**
 * Run health check and log results to console
 * 
 * @param storagePath - Path to usage storage JSON file
 */
export async function runHealthCheck(storagePath?: string): Promise<void> {
  const path = storagePath || join(process.env.HOME || "~", ".config/opencode/oh-my-opencode-usage.json")

  log("Running health check...")

  const health = await checkUsageTracking(path)

  if (health.healthy) {
    log("✅ Usage tracking is healthy")
  } else {
    log("❌ Usage tracking health issues detected")
  }

  if (health.stats) {
    log(`Stats: ${health.stats.totalRecords} total records, ${health.stats.recentRecords} recent`)
    log(`Recent averages: ${health.stats.avgInputTokens} input tokens, ${health.stats.avgOutputTokens} output tokens, $${health.stats.avgCost.toFixed(5)} cost`)
  }

  if (health.warnings.length > 0) {
    log("Warnings:")
    health.warnings.forEach((w) => log(`  - ${w}`))
  }

  log("Health checks:")
  Object.entries(health.checks).forEach(([check, passed]) => {
    log(`  ${passed ? "✅" : "❌"} ${check}`)
  })
}
