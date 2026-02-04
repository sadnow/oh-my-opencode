/**
 * Provider Weight Calculator for Weighted Fair-Share Balancing
 * 
 * Implements Smooth Weighted Round-Robin (WRR) algorithm to distribute
 * load across providers proportionally to their remaining quota.
 * 
 * Based on gRPC, Temporal, and Envoy load balancing patterns.
 */

import { getRoutingLogger } from './routing-logger'
import { toCanonicalProviderId } from './provider-id-mapping'
import {
  type ProviderType,
  type WeightCandidate,
  getProviderType,
  isSubscriptionProvider,
  PROVIDER_PRIORITY_MULTIPLIERS,
  API_BUDGET_RESERVE_PERCENT,
  RESET_BONUS_THRESHOLD_DAYS,
  RESET_BONUS_MULTIPLIER,
  shouldApplyResetBonus,
  VELOCITY_PENALTY_MIN,
  VELOCITY_PENALTY_MAX,
  VELOCITY_PENALTY_ENABLED,
} from './provider-classification'

// ============================================================================
// Types
// ============================================================================

export interface ProviderWeightConfig {
  /** Priority multipliers by provider type. Defaults to PROVIDER_PRIORITY_MULTIPLIERS */
  priorityMultipliers?: Record<ProviderType, number>
  /** Reserve percentage for API budget providers. Defaults to API_BUDGET_RESERVE_PERCENT */
  apiReservePercent?: number
  /** Reset bonus multiplier. Defaults to RESET_BONUS_MULTIPLIER */
  resetBonusMultiplier?: number
  /** Days threshold for reset bonus. Defaults to RESET_BONUS_THRESHOLD_DAYS */
  resetBonusThresholdDays?: number
}

export interface CandidateWeight {
  model: string
  provider: string
  weight: number
  currentWeight: number  // For Smooth WRR
}

// ============================================================================
// Provider Weight Calculator
// ============================================================================

export class ProviderWeightCalculator {
  private priorityMultipliers: Record<ProviderType, number>
  private apiReservePercent: number
  private resetBonusMultiplier: number
  private resetBonusThresholdDays: number
  
  /** Track current weights for Smooth WRR */
  private currentWeights: Map<string, number> = new Map()
  

  constructor(config?: ProviderWeightConfig) {
    this.priorityMultipliers = config?.priorityMultipliers ?? PROVIDER_PRIORITY_MULTIPLIERS
    this.apiReservePercent = config?.apiReservePercent ?? API_BUDGET_RESERVE_PERCENT
    this.resetBonusMultiplier = config?.resetBonusMultiplier ?? RESET_BONUS_MULTIPLIER
    this.resetBonusThresholdDays = config?.resetBonusThresholdDays ?? RESET_BONUS_THRESHOLD_DAYS
  }

  /**
   * Calculate effective weight for a provider.
   * 
   * Formula:
   * - remainingFraction = (100 - usagePercent) / 100
   * - priorityMultiplier = multiplier for provider type (subscription: 2.0, api: 0.5)
   * - resetBonus = 1.3 if resetting within threshold days, else 1.0
   * - velocityPenalty = max(0.3, min(1.5, 1 / velocityRatio)) if velocity data available
   * - weight = remainingFraction * priorityMultiplier * resetBonus * velocityPenalty
   * 
   * For API budget providers, returns 0 if usage exceeds (100 - reserve)%
   * 
   * @param provider Provider ID (e.g., 'anthropic', 'opencode')
   * @param usagePercent Current usage percentage (0-100)
   * @param daysUntilReset Optional days until quota resets
   * @param velocityPerDay Optional actual spending velocity in %/day
   * @returns Effective weight (0 to ~3.9 typically with velocity adjustment)
   */
  calculateWeight(
    provider: string,
    usagePercent: number,
    daysUntilReset?: number | null,
    velocityPerDay?: number
  ): number {
    const usage = Number.isFinite(usagePercent) ? Math.min(100, Math.max(0, usagePercent)) : 0
    const providerType = getProviderType(provider)
    
    // Check API budget reserve
    if (providerType === 'api-budget') {
      const reserveThreshold = 100 - this.apiReservePercent
      if (usage >= reserveThreshold) {
        // Reserve exceeded, weight = 0 (block this provider)
        return 0
      }
    }
    
    // Base: remaining fraction (1.0 = empty, 0.0 = full)
    const remainingFraction = Math.max(0, (100 - usage) / 100)
    
    // Priority multiplier based on provider type
    const priorityMultiplier = this.priorityMultipliers[providerType] ?? 1.0
    
    // Reset bonus for providers resetting soon
    const hasResetDays = Number.isFinite(daysUntilReset)
    const resetBonus = (
      hasResetDays && 
      daysUntilReset! >= 0 && 
      daysUntilReset! <= this.resetBonusThresholdDays
    ) ? this.resetBonusMultiplier : 1.0
    
    // Velocity penalty: penalize providers burning budget faster than expected
    let velocityPenalty = 1.0 // default (no effect)
    
    if (VELOCITY_PENALTY_ENABLED && velocityPerDay !== undefined) {
      // Expected velocity: remaining budget should last until reset
      // If daysUntilReset not provided, assume remaining budget should last as many days as usage percent
      // (e.g., 50% used → assume 50 days remaining, so expectedVelocity = 50% / 50 days = 1.0%/day)
      const daysRemaining = (hasResetDays && daysUntilReset! >= 0) ? daysUntilReset! : (100 - usage)
      
      if (daysRemaining > 0) {
        const expectedVelocity = (100 - usage) / daysRemaining
        
        if (expectedVelocity > 0) {
          // Velocity ratio: actual / expected
          // > 1.0 = burning too fast (penalize)
          // < 1.0 = burning slowly (boost)
          const velocityRatio = velocityPerDay / expectedVelocity
          
          // Inverse ratio: high velocity → low penalty (< 1.0), low velocity → high penalty (> 1.0)
          let rawPenalty: number
          if (velocityPerDay === 0) {
            rawPenalty = VELOCITY_PENALTY_MAX
          } else if (velocityPerDay < 0) {
            rawPenalty = VELOCITY_PENALTY_MIN
          } else {
            rawPenalty = 1 / velocityRatio
          }
          
          // Clamp to safety bounds [0.3, 1.5]
          velocityPenalty = Math.max(
            VELOCITY_PENALTY_MIN,
            Math.min(VELOCITY_PENALTY_MAX, rawPenalty)
          )
        }
      }
    }
    
    return remainingFraction * priorityMultiplier * resetBonus * velocityPenalty
  }

  /**
   * Select the best provider from candidates using Smooth Weighted Round-Robin.
   * 
   * Algorithm (from Nginx/gRPC):
   * 1. Add effective weight to current weight for each candidate
   * 2. Select candidate with highest current weight
   * 3. Subtract total weight from selected candidate's current weight
   * 
   * This ensures smooth distribution proportional to weights.
   * 
   * @param candidates Array of { model, provider, weight, usagePercent, daysUntilReset? }
   * @returns Selected candidate, or null if no valid candidates
   */
  selectBestProvider(candidates: WeightCandidate[]): WeightCandidate | null {
    // Filter to candidates with positive weight
    const validCandidates = candidates.filter(c => c.weight > 0)
    
    if (validCandidates.length === 0) {
      return null
    }
    
    if (validCandidates.length === 1) {
      return validCandidates[0]
    }
    
    // Smooth Weighted Round-Robin
    let totalWeight = 0
    let maxWeight = -Infinity
    let selected: WeightCandidate | null = null
    
    // Phase 1: Add effective weight and find max
    for (const candidate of validCandidates) {
      const key = `${candidate.provider}/${candidate.model}`
      const currentWeight = (this.currentWeights.get(key) ?? 0) + candidate.weight
      this.currentWeights.set(key, currentWeight)
      totalWeight += candidate.weight
      
      if (currentWeight > maxWeight) {
        maxWeight = currentWeight
        selected = candidate
      }
    }
    
    // Phase 2: Subtract total weight from selected
    if (selected) {
      const key = `${selected.provider}/${selected.model}`
      const newWeight = (this.currentWeights.get(key) ?? 0) - totalWeight
      this.currentWeights.set(key, newWeight)

      // Log the routing decision
      getRoutingLogger().logDebug(
        "routing_decision",
        `[SmoothWRR] Selected ${selected.model} (weight=${selected.weight.toFixed(2)})`,
        {
          timestamp: new Date().toISOString(),
          use_case: "weighted_selection",
          candidates: validCandidates.map(c => c.model),
          weights: Object.fromEntries(validCandidates.map(c => [c.model, c.weight])),
          velocities: Object.fromEntries(validCandidates.map(c => [c.model, (c as any).velocityPerDay ?? null])),
          selected: selected.model,
          reason: "smooth weighted round-robin",
        }
      )
    }
    
    return selected
  }

  /**
   * Build candidates with calculated weights.
   * 
   * @param models Array of model strings (e.g., ['anthropic/claude-sonnet-4-5', 'opencode/glm-4.7'])
   * @param usagePercentByProvider Map of provider -> usage percentage
   * @param daysUntilResetByProvider Optional map of provider -> days until reset
   * @param velocityByProvider Optional map of provider -> spending velocity in %/day
   * @returns Array of candidates with weights
   */
  buildCandidates(
    models: string[],
    usagePercentByProvider: Record<string, number>,
    daysUntilResetByProvider?: Record<string, number>,
    velocityByProvider?: Record<string, number>
  ): WeightCandidate[] {
    return models.map(model => {
      const [provider] = model.split('/')
      const canonical = toCanonicalProviderId(provider)
      const usagePercent = usagePercentByProvider[provider] ?? usagePercentByProvider[canonical] ?? 0
      const daysUntilReset = daysUntilResetByProvider?.[provider] ?? daysUntilResetByProvider?.[canonical]
      const velocityPerDay = velocityByProvider?.[provider] ?? velocityByProvider?.[canonical]
      const weight = this.calculateWeight(provider, usagePercent, daysUntilReset, velocityPerDay)
      
      return {
        model,
        provider,
        weight,
        usagePercent,
        daysUntilReset,
      }
    })
  }

  /**
   * Convenience method: Select best model from a list.
   * 
   * @param models Array of model strings
   * @param usagePercentByProvider Map of provider -> usage percentage
   * @param daysUntilResetByProvider Optional map of provider -> days until reset
   * @param velocityByProvider Optional map of provider -> spending velocity in %/day
   * @returns Selected model string, or first model if all weights are 0
   */
  selectBestModel(
    models: string[],
    usagePercentByProvider: Record<string, number>,
    daysUntilResetByProvider?: Record<string, number>,
    velocityByProvider?: Record<string, number>
  ): string {
    if (models.length === 0) {
      // Graceful fallback instead of crash - log warning and return safe default
      const logger = getRoutingLogger()
      logger.logDebug(
        "routing_decision",
        "[selectBestModel] No models provided, falling back to opencode/big-pickle",
        { timestamp: new Date().toISOString(), reason: "empty model list" }
      )
      return "opencode/big-pickle"
    }
    
    const candidates = this.buildCandidates(models, usagePercentByProvider, daysUntilResetByProvider, velocityByProvider)
    const selected = this.selectBestProvider(candidates)
    
    // Fallback to first model if no valid selection (all weights 0)
    return selected?.model ?? models[0]
  }

  /**
   * Reset internal state (useful for testing).
   */
  reset(): void {
    this.currentWeights.clear()
  }

  /**
   * Get current internal weights for debugging.
   */
  getDebugState(): { currentWeights: Record<string, number> } {
    return {
      currentWeights: Object.fromEntries(this.currentWeights),
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _calculatorInstance: ProviderWeightCalculator | null = null

/**
 * Get the singleton ProviderWeightCalculator instance.
 */
export function getWeightCalculator(): ProviderWeightCalculator {
  if (!_calculatorInstance) {
    _calculatorInstance = new ProviderWeightCalculator()
  }
  return _calculatorInstance
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetWeightCalculator(): void {
  _calculatorInstance = null
}
