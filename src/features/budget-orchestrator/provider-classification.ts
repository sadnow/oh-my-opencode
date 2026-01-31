/**
 * Provider Classification for Weighted Fair-Share Balancing
 * 
 * Classifies providers into subscription (free with sub) vs API budget (paid per use),
 * with priority multipliers for load balancing.
 */

// ============================================================================
// Types
// ============================================================================

export type ProviderType = 'subscription' | 'api-budget'

export interface ProviderInfo {
  type: ProviderType
  /** Human-readable name */
  displayName: string
  /** Reset period: 'weekly', 'monthly', or 'none' (for API budgets) */
  resetPeriod: 'weekly' | 'monthly' | 'none'
}

export interface WeightCandidate {
  model: string
  provider: string
  weight: number
  usagePercent: number
  daysUntilReset?: number
}

// ============================================================================
// Provider Classification
// ============================================================================

/**
 * Classification of providers by type.
 * 
 * Subscription providers are free with subscription and should be prioritized.
 * API budget providers cost money per use and should be preserved.
 */
export const PROVIDER_CLASSIFICATION: Record<string, ProviderInfo> = {
  // Subscription providers (free with subscription, reset periodically)
  'anthropic': {
    type: 'subscription',
    displayName: 'Claude Max (Anthropic)',
    resetPeriod: 'weekly',
  },
  'github-copilot': {
    type: 'subscription',
    displayName: 'GitHub Copilot',
    resetPeriod: 'monthly',
  },
  'google': {
    type: 'subscription',
    displayName: 'Google (OAuth/Antigrav)',
    resetPeriod: 'monthly',
  },
  'openai': {
    type: 'subscription',
    displayName: 'OpenAI (ChatGPT Plus OAuth)',
    resetPeriod: 'monthly',
  },
  
  // API budget providers (paid per use, no reset)
  'opencode': {
    type: 'api-budget',
    displayName: 'OpenCode Zen',
    resetPeriod: 'none', // Billing cycle but doesn't "reset" like subscriptions
  },
} as const

/**
 * Get provider type for a provider ID.
 * Defaults to 'api-budget' for unknown providers (safer assumption).
 */
export function getProviderType(provider: string): ProviderType {
  return PROVIDER_CLASSIFICATION[provider]?.type ?? 'api-budget'
}

/**
 * Get provider info for a provider ID.
 */
export function getProviderInfo(provider: string): ProviderInfo | null {
  return PROVIDER_CLASSIFICATION[provider] ?? null
}

/**
 * Check if a provider is a subscription type (free with subscription).
 */
export function isSubscriptionProvider(provider: string): boolean {
  return getProviderType(provider) === 'subscription'
}

// ============================================================================
// Priority Multipliers
// ============================================================================

/**
 * Priority multipliers for provider types.
 * 
 * Higher multiplier = more likely to be selected.
 * 
 * Subscription: 2.0x - Strongly prefer (they're free with subscription!)
 * API Budget: 0.5x - Discourage (preserve for emergencies)
 */
export const PROVIDER_PRIORITY_MULTIPLIERS: Record<ProviderType, number> = {
  'subscription': 2.0,  // 2x priority for free-with-subscription
  'api-budget': 0.5,    // 0.5x priority for paid API
} as const

/**
 * Reserve percentage for API budget providers.
 * When usage exceeds (100 - reserve)%, the provider is blocked.
 * This ensures we always have emergency API capacity.
 */
export const API_BUDGET_RESERVE_PERCENT = 20

/**
 * Bonus multiplier for providers resetting soon.
 * If provider resets within this many days, apply bonus.
 */
export const RESET_BONUS_THRESHOLD_DAYS = 2
export const RESET_BONUS_MULTIPLIER = 1.3

// ============================================================================
// Reset Time Utilities
// ============================================================================

/**
 * Calculate days until a reset date.
 * 
 * @param resetDateString ISO date string or Date object
 * @returns Number of days until reset (0 if already reset, negative if past)
 */
export function getDaysUntilReset(resetDateString: string | Date): number {
  const resetDate = typeof resetDateString === 'string' 
    ? new Date(resetDateString) 
    : resetDateString
  
  const now = new Date()
  const diffMs = resetDate.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  
  return Math.ceil(diffDays)
}

/**
 * Get reset info for a provider from tracker data.
 * 
 * @param provider Provider ID
 * @param trackerData Optional tracker data with resetDate
 * @returns Days until reset, or null if unknown
 */
export function getProviderResetDays(
  provider: string,
  trackerData?: { resetDate?: string | Date }
): number | null {
  if (!trackerData?.resetDate) {
    return null
  }
  
  return getDaysUntilReset(trackerData.resetDate)
}

/**
 * Check if a provider should get the reset bonus.
 * 
 * @param daysUntilReset Days until provider quota resets
 * @returns True if should get reset bonus
 */
export function shouldApplyResetBonus(daysUntilReset: number | null): boolean {
  if (daysUntilReset === null) {
    return false
  }
  return daysUntilReset >= 0 && daysUntilReset <= RESET_BONUS_THRESHOLD_DAYS
}
