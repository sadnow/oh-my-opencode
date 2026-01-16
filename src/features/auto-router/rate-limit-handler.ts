/**
 * Rate Limit Handler for Auto-Router
 *
 * Detects rate limit errors (429) and manages provider circuit breakers
 * with automatic fallback to alternative providers.
 *
 * Features:
 * - Rate limit detection from error responses
 * - Circuit breaker pattern (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Provider cooldown periods (5 min Anthropic, 1 min others)
 * - Persistent state across sessions (disk storage)
 * - Fallback provider chain
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { log } from "../../shared/logger"

// Circuit breaker states
export type CircuitState = "closed" | "open" | "half_open"

// Rate limit state for a single provider
export interface ProviderRateLimitState {
  provider: string
  circuitState: CircuitState
  lastHitAt: number // timestamp of last rate limit hit
  hitCount: number // number of hits in current window
  cooldownUntil: number // timestamp when cooldown expires
  consecutiveSuccesses: number // for half-open -> closed transition
}

// Global rate limit state
export interface RateLimitState {
  providers: Record<string, ProviderRateLimitState>
  lastUpdated: number
  version: number
}

// Cooldown periods in milliseconds
export const COOLDOWN_MS = {
  anthropic: 5 * 60 * 1000, // 5 minutes
  default: 1 * 60 * 1000, // 1 minute
} as const

// Half-open state: require N successes to close circuit
export const HALF_OPEN_SUCCESS_THRESHOLD = 3

// State file location
const STATE_DIR = join(homedir(), ".opencode")
const STATE_FILE = join(STATE_DIR, "rate-limit-state.json")

// Provider fallback chain (in order of preference)
export const PROVIDER_FALLBACK_CHAIN: string[] = [
  "github-copilot",
  "google",
  "opencode",
  "amazon-bedrock",
]

// Providers that are BLOCKED (should never be used directly)
export const BLOCKED_PROVIDERS = new Set(["anthropic"])

/**
 * Detect if an error is a rate limit error (429)
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error) return false

  // Check for 429 status code
  if (typeof error === "object") {
    const err = error as Record<string, unknown>

    // Direct status check
    if (err.status === 429 || err.statusCode === 429) {
      return true
    }

    // Check message for "429"
    if (typeof err.message === "string" && err.message.includes("429")) {
      return true
    }

    // Check for rate_limit_error type (Anthropic format)
    if (err.type === "error" && typeof err.error === "object") {
      const innerError = err.error as Record<string, unknown>
      if (innerError.type === "rate_limit_error") {
        return true
      }
    }

    // Check nested error object
    if (typeof err.error === "object") {
      const innerError = err.error as Record<string, unknown>
      if (innerError.type === "rate_limit_error") {
        return true
      }
    }
  }

  // Check string representation
  if (typeof error === "string") {
    return error.includes("429") || error.includes("rate_limit")
  }

  return false
}

/**
 * Extract provider ID from a model string
 * e.g., "github-copilot/claude-sonnet-4" -> "github-copilot"
 */
export function extractProvider(model: string): string {
  const parts = model.split("/")
  return parts[0] || model
}

/**
 * Get cooldown period for a provider
 */
export function getCooldownMs(provider: string): number {
  if (provider === "anthropic" || provider.includes("anthropic")) {
    return COOLDOWN_MS.anthropic
  }
  return COOLDOWN_MS.default
}

/**
 * Load rate limit state from disk
 */
export function loadRateLimitState(): RateLimitState {
  try {
    if (existsSync(STATE_FILE)) {
      const data = readFileSync(STATE_FILE, "utf-8")
      const state = JSON.parse(data) as RateLimitState

      // Clean up expired cooldowns
      const now = Date.now()
      for (const [provider, pState] of Object.entries(state.providers)) {
        if (pState.cooldownUntil < now && pState.circuitState === "open") {
          // Cooldown expired, transition to half_open
          state.providers[provider] = {
            ...pState,
            circuitState: "half_open",
            consecutiveSuccesses: 0,
          }
        }
      }

      return state
    }
  } catch (err) {
    log("[rate-limit] Failed to load state from disk:", err)
  }

  // Return empty state
  return {
    providers: {},
    lastUpdated: Date.now(),
    version: 1,
  }
}

/**
 * Save rate limit state to disk
 */
export function saveRateLimitState(state: RateLimitState): void {
  try {
    // Ensure directory exists
    if (!existsSync(STATE_DIR)) {
      mkdirSync(STATE_DIR, { recursive: true })
    }

    state.lastUpdated = Date.now()
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8")
  } catch (err) {
    log("[rate-limit] Failed to save state to disk:", err)
  }
}

/**
 * Record a rate limit hit for a provider
 */
export function recordRateLimitHit(
  state: RateLimitState,
  provider: string
): RateLimitState {
  const now = Date.now()
  const cooldownMs = getCooldownMs(provider)

  const existing = state.providers[provider]
  const newProviderState: ProviderRateLimitState = {
    provider,
    circuitState: "open",
    lastHitAt: now,
    hitCount: (existing?.hitCount ?? 0) + 1,
    cooldownUntil: now + cooldownMs,
    consecutiveSuccesses: 0,
  }

  log("[rate-limit] Circuit OPEN for provider", {
    provider,
    cooldownMs,
    cooldownUntil: new Date(newProviderState.cooldownUntil).toISOString(),
    hitCount: newProviderState.hitCount,
  })

  const newState = {
    ...state,
    providers: {
      ...state.providers,
      [provider]: newProviderState,
    },
    lastUpdated: now,
  }

  // Persist to disk
  saveRateLimitState(newState)

  return newState
}

/**
 * Record a successful request for a provider (for half_open recovery)
 */
export function recordSuccess(
  state: RateLimitState,
  provider: string
): RateLimitState {
  const existing = state.providers[provider]
  if (!existing) return state

  if (existing.circuitState === "half_open") {
    const newSuccesses = existing.consecutiveSuccesses + 1

    if (newSuccesses >= HALF_OPEN_SUCCESS_THRESHOLD) {
      // Transition to CLOSED
      log("[rate-limit] Circuit CLOSED for provider after recovery", {
        provider,
        successes: newSuccesses,
      })

      const newState = {
        ...state,
        providers: {
          ...state.providers,
          [provider]: {
            ...existing,
            circuitState: "closed" as CircuitState,
            consecutiveSuccesses: 0,
            hitCount: 0,
          },
        },
        lastUpdated: Date.now(),
      }

      saveRateLimitState(newState)
      return newState
    }

    // Still in half_open, increment success count
    const newState = {
      ...state,
      providers: {
        ...state.providers,
        [provider]: {
          ...existing,
          consecutiveSuccesses: newSuccesses,
        },
      },
    }

    return newState
  }

  return state
}

/**
 * Check if a provider is available (not rate limited)
 */
export function isProviderAvailable(
  state: RateLimitState,
  provider: string
): boolean {
  // Blocked providers are never available
  if (BLOCKED_PROVIDERS.has(provider)) {
    return false
  }

  const pState = state.providers[provider]
  if (!pState) return true // No state = never rate limited

  const now = Date.now()

  switch (pState.circuitState) {
    case "closed":
      return true

    case "open":
      // Check if cooldown expired
      if (now >= pState.cooldownUntil) {
        // Transition to half_open (will be done on next load)
        return true // Allow trial request
      }
      return false

    case "half_open":
      return true // Allow trial requests

    default:
      return true
  }
}

/**
 * Get the next available fallback provider
 */
export function getFallbackProvider(
  state: RateLimitState,
  excludeProvider?: string
): string | null {
  for (const provider of PROVIDER_FALLBACK_CHAIN) {
    if (provider === excludeProvider) continue
    if (isProviderAvailable(state, provider)) {
      return provider
    }
  }
  return null
}

/**
 * Get model with fallback provider
 * If the original model's provider is rate limited, swap to fallback
 */
export function getModelWithFallback(
  state: RateLimitState,
  originalModel: string
): { model: string; provider: string; didFallback: boolean } {
  const provider = extractProvider(originalModel)

  // Check if original provider is available
  if (isProviderAvailable(state, provider)) {
    return { model: originalModel, provider, didFallback: false }
  }

  // Find fallback provider
  const fallbackProvider = getFallbackProvider(state, provider)
  if (!fallbackProvider) {
    // No fallback available, use original anyway
    log("[rate-limit] No fallback available, using rate-limited provider", {
      provider,
    })
    return { model: originalModel, provider, didFallback: false }
  }

  // Map model to fallback provider
  const modelName = originalModel.split("/").slice(1).join("/")
  const fallbackModel = mapModelToProvider(modelName, fallbackProvider)

  log("[rate-limit] Using fallback provider", {
    original: originalModel,
    fallback: fallbackModel,
    fallbackProvider,
  })

  return { model: fallbackModel, provider: fallbackProvider, didFallback: true }
}

/**
 * Map a model name to a different provider
 */
function mapModelToProvider(modelName: string, provider: string): string {
  // Model equivalents across providers
  const modelMappings: Record<string, Record<string, string>> = {
    "github-copilot": {
      "claude-opus-4-5": "claude-opus-4-5",
      "claude-sonnet-4": "claude-sonnet-4",
      "gpt-4o": "gpt-4o",
      "gpt-4o-mini": "gpt-4o-mini",
    },
    google: {
      // Map to Antigravity models
      "claude-opus-4-5": "antigravity-gemini-3-pro-high",
      "claude-sonnet-4": "antigravity-gemini-3-flash",
      "gpt-4o": "antigravity-gemini-3-pro-high",
      "gpt-4o-mini": "antigravity-gemini-3-flash",
    },
    opencode: {
      // Map to free models
      "claude-opus-4-5": "glm-4.7-free",
      "claude-sonnet-4": "glm-4.7-free",
      "gpt-4o": "grok-code",
      "gpt-4o-mini": "glm-4.7-free",
    },
    "amazon-bedrock": {
      "claude-opus-4-5": "anthropic.claude-opus-4-5",
      "claude-sonnet-4": "anthropic.claude-sonnet-4",
    },
  }

  const providerMappings = modelMappings[provider]
  if (providerMappings && providerMappings[modelName]) {
    return `${provider}/${providerMappings[modelName]}`
  }

  // No mapping found, use a safe default for this provider
  const defaultModels: Record<string, string> = {
    "github-copilot": "gpt-4o-mini",
    google: "antigravity-gemini-3-flash",
    opencode: "glm-4.7-free",
    "amazon-bedrock": "anthropic.claude-sonnet-4",
  }

  return `${provider}/${defaultModels[provider] || "gpt-4o-mini"}`
}

/**
 * Get a summary of current rate limit state
 */
export function getRateLimitSummary(state: RateLimitState): string {
  const now = Date.now()
  const lines: string[] = []

  for (const [provider, pState] of Object.entries(state.providers)) {
    const timeLeft = Math.max(0, pState.cooldownUntil - now)
    const timeLeftStr =
      timeLeft > 0
        ? `${Math.ceil(timeLeft / 1000 / 60)}m ${Math.ceil(
            (timeLeft / 1000) % 60
          )}s`
        : "expired"

    lines.push(
      `  ${provider}: ${pState.circuitState} (hits: ${pState.hitCount}, cooldown: ${timeLeftStr})`
    )
  }

  if (lines.length === 0) {
    return "No rate limits active"
  }

  return `Rate limit state:\n${lines.join("\n")}`
}
