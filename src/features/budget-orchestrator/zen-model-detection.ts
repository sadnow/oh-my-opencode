/**
 * Zen API Model Detection
 * Queries OpenCode Zen API to get available models for the user.
 * 
 * API: GET https://opencode.ai/zen/v1/models
 * Auth: Authorization: Bearer <ZEN_API_KEY>
 */

import { log } from "../../shared"

// Cache for Zen models
interface ZenModelCache {
  models: string[]
  fetchedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let zenModelCache: ZenModelCache | null = null

/**
 * Zen model metadata from API response
 */
export interface ZenModelInfo {
  id: string
  name?: string
  provider?: string
  endpoint?: string
  enabled?: boolean
}

/**
 * Fetch available models from Zen API.
 * Returns array of model IDs that are available to the user.
 * 
 * @param apiKey - Zen API key (from environment or config)
 * @param forceRefresh - Skip cache and fetch fresh data
 * @returns Array of available model IDs (e.g., ["gpt-5.2", "claude-opus-4.5"])
 */
export async function fetchZenAvailableModels(
  apiKey?: string,
  forceRefresh: boolean = false
): Promise<string[]> {
  // Check cache first
  if (!forceRefresh && zenModelCache) {
    const age = Date.now() - zenModelCache.fetchedAt
    if (age < CACHE_TTL_MS) {
      log("[zen-model-detection] Using cached models", { 
        count: zenModelCache.models.length,
        ageMs: age 
      })
      return zenModelCache.models
    }
  }

  // Get API key from environment if not provided
  const key = apiKey ?? process.env.OPENCODE_ZEN_API_KEY ?? process.env.ZEN_API_KEY
  
  if (!key) {
    log("[zen-model-detection] No Zen API key available, skipping detection")
    return []
  }

  try {
    log("[zen-model-detection] Fetching models from Zen API")
    
    const response = await fetch("https://opencode.ai/zen/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      log("[zen-model-detection] API error", { 
        status: response.status, 
        statusText: response.statusText 
      })
      return zenModelCache?.models ?? []
    }

    const data = await response.json() as ZenModelInfo[] | { models?: ZenModelInfo[] }
    
    // Handle both array response and object with models property
    const modelList = Array.isArray(data) ? data : (data.models ?? [])
    
    // Extract model IDs, filtering out disabled models if the API provides that info
    const models = modelList
      .filter(m => m.enabled !== false) // Keep if enabled is true or undefined
      .map(m => m.id)
      .filter(Boolean)

    // Update cache
    zenModelCache = {
      models,
      fetchedAt: Date.now(),
    }

    log("[zen-model-detection] Fetched models", { count: models.length, models: models.slice(0, 10) })
    
    return models
  } catch (error) {
    log("[zen-model-detection] Failed to fetch models", { error: String(error) })
    // Return cached data if available, otherwise empty
    return zenModelCache?.models ?? []
  }
}

/**
 * Check if a specific model is available via Zen.
 * 
 * @param modelId - Model ID to check (e.g., "gpt-5.2", "claude-opus-4.5")
 * @param apiKey - Optional Zen API key
 * @returns true if model is available
 */
export async function isZenModelAvailable(
  modelId: string,
  apiKey?: string
): Promise<boolean> {
  const availableModels = await fetchZenAvailableModels(apiKey)
  
  // Normalize model ID for comparison (remove provider prefix if present)
  const normalizedModelId = modelId.replace(/^[^/]+\//, '').toLowerCase()
  
  return availableModels.some(m => {
    const normalizedAvailable = m.replace(/^[^/]+\//, '').toLowerCase()
    return normalizedAvailable === normalizedModelId || m.toLowerCase() === modelId.toLowerCase()
  })
}

/**
 * Clear the Zen model cache.
 * Useful for testing or when user changes API key.
 */
export function clearZenModelCache(): void {
  zenModelCache = null
  log("[zen-model-detection] Cache cleared")
}

/**
 * Get cache status for debugging.
 */
export function getZenCacheStatus(): { cached: boolean; ageMs: number | null; modelCount: number } {
  if (!zenModelCache) {
    return { cached: false, ageMs: null, modelCount: 0 }
  }
  return {
    cached: true,
    ageMs: Date.now() - zenModelCache.fetchedAt,
    modelCount: zenModelCache.models.length,
  }
}

/**
 * SYNC check if a model is available in the Zen cache.
 * Returns true if:
 * - Cache is not populated (we don't block, assume available)
 * - Model is in the cache
 * 
 * Returns false only if cache is populated AND model is NOT in it.
 * This is a non-blocking check for use in sync functions like isModelAllowed().
 * 
 * @param modelId - Model ID to check (e.g., "gpt-5.2", "claude-opus-4.5")
 * @returns true if model is available (or cache not ready), false if confirmed unavailable
 */
export function isZenModelInCache(modelId: string): boolean {
  // If no cache, don't block - assume available
  if (!zenModelCache) {
    return true
  }
  
  // Check if cache is stale (expired) - if so, don't block
  const age = Date.now() - zenModelCache.fetchedAt
  if (age > CACHE_TTL_MS) {
    return true
  }
  
  // Normalize model ID for comparison
  const normalizedModelId = modelId.replace(/^[^/]+\//, '').toLowerCase()
  
  return zenModelCache.models.some(m => {
    const normalizedAvailable = m.replace(/^[^/]+\//, '').toLowerCase()
    return normalizedAvailable === normalizedModelId || m.toLowerCase() === modelId.toLowerCase()
  })
}

/**
 * Check if Zen cache is populated and valid.
 */
export function hasZenCacheData(): boolean {
  if (!zenModelCache) return false
  const age = Date.now() - zenModelCache.fetchedAt
  return age < CACHE_TTL_MS
}

// For testing - reset module state
export function __resetZenModelDetection(): void {
  zenModelCache = null
}
