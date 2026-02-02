/**
 * Model Failure Cache
 * Caches model failures to avoid repeatedly selecting models that are unavailable.
 * 
 * When a model fails with "not supported" or similar errors, we cache that failure
 * and skip the model in future selections until the cache expires.
 * 
 * This is particularly useful for GitHub Copilot where there's no API to query
 * which models a user has enabled in their settings.
 */

import { log } from "../../shared"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { homedir } from "os"

// Cache entry for a failed model
interface ModelFailureEntry {
  /** Full model ID (e.g., "github-copilot/claude-opus-4.5") */
  model: string
  /** Error message from the failure */
  errorMessage: string
  /** Timestamp when the failure occurred */
  failedAt: number
  /** Number of consecutive failures */
  failureCount: number
}

// In-memory cache
interface ModelFailureCache {
  failures: Record<string, ModelFailureEntry>
  updatedAt: number
}

// Cache TTL - 24 hours (user might re-enable models)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Minimum failures before caching (avoid caching transient errors)
const MIN_FAILURES_TO_CACHE = 1

// Error patterns that indicate a model is not available (not transient errors)
const MODEL_UNAVAILABLE_PATTERNS = [
  /model.*not.*supported/i,
  /model.*not.*available/i,
  /model.*not.*enabled/i,
  /model.*not.*found/i,
  /requested.*model.*not/i,
  /invalid.*model/i,
  /unknown.*model/i,
  /access.*denied.*model/i,
  /model.*disabled/i,
]

let failureCache: ModelFailureCache | null = null
let persistPath: string | null = null

/**
 * Initialize the failure cache with optional persistence path.
 */
export function initModelFailureCache(customPath?: string): void {
  persistPath = customPath ?? join(
    homedir(),
    ".config",
    "opencode",
    "oh-my-opencode-model-failures.json"
  )
  
  failureCache = loadCache()
  log("[model-failure-cache] Initialized", { 
    failureCount: Object.keys(failureCache.failures).length,
    persistPath 
  })
}

/**
 * Load cache from disk.
 */
function loadCache(): ModelFailureCache {
  if (!persistPath) {
    return { failures: {}, updatedAt: Date.now() }
  }

  try {
    if (existsSync(persistPath)) {
      const content = readFileSync(persistPath, "utf-8")
      const data = JSON.parse(content) as ModelFailureCache
      
      // Clean expired entries
      const now = Date.now()
      const validFailures: Record<string, ModelFailureEntry> = {}
      
      for (const [model, entry] of Object.entries(data.failures)) {
        if (now - entry.failedAt < CACHE_TTL_MS) {
          validFailures[model] = entry
        }
      }
      
      return { failures: validFailures, updatedAt: data.updatedAt }
    }
  } catch (error) {
    log("[model-failure-cache] Failed to load cache", { error: String(error) })
  }
  
  return { failures: {}, updatedAt: Date.now() }
}

/**
 * Save cache to disk.
 */
function saveCache(): void {
  if (!persistPath || !failureCache) return

  try {
    const dir = dirname(persistPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    failureCache.updatedAt = Date.now()
    writeFileSync(persistPath, JSON.stringify(failureCache, null, 2))
  } catch (error) {
    log("[model-failure-cache] Failed to save cache", { error: String(error) })
  }
}

/**
 * Check if an error message indicates a model is unavailable (not a transient error).
 */
export function isModelUnavailableError(errorMessage: string): boolean {
  return MODEL_UNAVAILABLE_PATTERNS.some(pattern => pattern.test(errorMessage))
}

/**
 * Record a model failure.
 * Only caches if the error indicates the model is unavailable (not transient).
 * 
 * @param model - Full model ID (e.g., "github-copilot/claude-opus-4.5")
 * @param errorMessage - Error message from the failure
 * @returns true if the failure was cached
 */
export function recordModelFailure(model: string, errorMessage: string): boolean {
  // Initialize cache if needed
  if (!failureCache) {
    initModelFailureCache()
  }

  // Only cache if error indicates model is unavailable
  if (!isModelUnavailableError(errorMessage)) {
    log("[model-failure-cache] Ignoring transient error", { model, errorMessage })
    return false
  }

  const existing = failureCache!.failures[model]
  
  if (existing) {
    existing.failureCount++
    existing.failedAt = Date.now()
    existing.errorMessage = errorMessage
  } else {
    failureCache!.failures[model] = {
      model,
      errorMessage,
      failedAt: Date.now(),
      failureCount: 1,
    }
  }

  log("[model-failure-cache] Recorded failure", { 
    model, 
    failureCount: failureCache!.failures[model].failureCount 
  })
  
  saveCache()
  return true
}

/**
 * Check if a model is in the failure cache.
 * 
 * @param model - Full model ID (e.g., "github-copilot/claude-opus-4.5")
 * @returns true if the model has failed and should be skipped
 */
export function isModelFailed(model: string): boolean {
  if (!failureCache) {
    initModelFailureCache()
  }

  const entry = failureCache!.failures[model]
  
  if (!entry) {
    return false
  }

  // Check if entry has expired
  if (Date.now() - entry.failedAt >= CACHE_TTL_MS) {
    delete failureCache!.failures[model]
    saveCache()
    return false
  }

  // Check if enough failures to consider it cached
  if (entry.failureCount < MIN_FAILURES_TO_CACHE) {
    return false
  }

  return true
}

/**
 * Check if a model is failed by provider and model ID separately.
 * Handles both "provider/model" format and separate provider + modelId.
 */
export function isModelFailedByProvider(provider: string, modelId: string): boolean {
  const fullModel = `${provider}/${modelId}`
  return isModelFailed(fullModel)
}

/**
 * Get all failed models for a specific provider.
 * 
 * @param provider - Provider name (e.g., "github-copilot")
 * @returns Array of model IDs that have failed for this provider
 */
export function getFailedModelsForProvider(provider: string): string[] {
  if (!failureCache) {
    initModelFailureCache()
  }

  const prefix = `${provider}/`
  const now = Date.now()
  
  return Object.entries(failureCache!.failures)
    .filter(([model, entry]) => {
      if (!model.startsWith(prefix)) return false
      if (now - entry.failedAt >= CACHE_TTL_MS) return false
      if (entry.failureCount < MIN_FAILURES_TO_CACHE) return false
      return true
    })
    .map(([model]) => model.slice(prefix.length))
}

/**
 * Clear a specific model from the failure cache.
 * Useful when user explicitly wants to retry a model.
 */
export function clearModelFailure(model: string): void {
  if (!failureCache) return
  
  if (failureCache.failures[model]) {
    delete failureCache.failures[model]
    saveCache()
    log("[model-failure-cache] Cleared failure", { model })
  }
}

/**
 * Clear all failures for a provider.
 */
export function clearProviderFailures(provider: string): void {
  if (!failureCache) return
  
  const prefix = `${provider}/`
  let cleared = 0
  
  for (const model of Object.keys(failureCache.failures)) {
    if (model.startsWith(prefix)) {
      delete failureCache.failures[model]
      cleared++
    }
  }
  
  if (cleared > 0) {
    saveCache()
    log("[model-failure-cache] Cleared provider failures", { provider, cleared })
  }
}

/**
 * Clear the entire failure cache.
 */
export function clearAllFailures(): void {
  if (!failureCache) return
  
  failureCache.failures = {}
  saveCache()
  log("[model-failure-cache] Cleared all failures")
}

/**
 * Get cache statistics for debugging.
 */
export function getFailureCacheStats(): {
  totalFailures: number
  failuresByProvider: Record<string, number>
  oldestFailure: number | null
  newestFailure: number | null
} {
  if (!failureCache) {
    initModelFailureCache()
  }

  const entries = Object.values(failureCache!.failures)
  const byProvider: Record<string, number> = {}
  
  let oldest: number | null = null
  let newest: number | null = null
  
  for (const entry of entries) {
    const [provider] = entry.model.split("/")
    byProvider[provider] = (byProvider[provider] ?? 0) + 1
    
    if (oldest === null || entry.failedAt < oldest) {
      oldest = entry.failedAt
    }
    if (newest === null || entry.failedAt > newest) {
      newest = entry.failedAt
    }
  }

  return {
    totalFailures: entries.length,
    failuresByProvider: byProvider,
    oldestFailure: oldest,
    newestFailure: newest,
  }
}

// For testing - reset module state
export function __resetModelFailureCache(): void {
  failureCache = null
  persistPath = null
}
