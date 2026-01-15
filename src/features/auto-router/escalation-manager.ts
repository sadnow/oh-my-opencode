/**
 * Escalation Manager
 * Handles budget tier escalation based on task progress and failures
 */

import type {
  BudgetTier,
  BudgetTierConfig,
  EscalationDecision,
  EscalationSignal,
  AttemptResult,
  AttemptHistory,
} from "./types"
import { BUDGET_TIERS, ESCALATION_RULES, BUDGET_TIER_PRIORITY } from "./constants"

/**
 * Escalation Manager class
 * Tracks attempt history and determines when to escalate budget tiers
 */
export class EscalationManager {
  private currentTier: BudgetTierConfig
  private history: AttemptHistory[]
  private escalationCount: number
  private maxEscalations: number
  private maxBudget: BudgetTier
  private qualityThreshold: number
  private isEscalating: boolean = false
  private stuckThreshold: number

  constructor(
    initialTier: BudgetTier = "cheap",
    options?: {
      maxEscalations?: number
      qualityThreshold?: number
      stuckThreshold?: number
      maxBudget?: BudgetTier
    }
  ) {
    this.currentTier = BUDGET_TIERS[initialTier]
    this.history = []
    this.escalationCount = 0
    this.maxEscalations = options?.maxEscalations ?? 3
    this.maxBudget = options?.maxBudget ?? "maximum"
    this.qualityThreshold = options?.qualityThreshold ?? 0.7
    this.stuckThreshold = options?.stuckThreshold ?? 2 // Minimum consecutive identical to be "stuck"
  }

  /**
   * Get the maximum budget tier allowed
   */
  getMaxBudget(): BudgetTier {
    return this.maxBudget
  }

  /**
   * Get current tier configuration (returns immutable copy)
   */
  getCurrentTier(): Readonly<BudgetTierConfig> {
    return Object.freeze({ ...this.currentTier })
  }

  /**
   * Get current tier name
   */
  getCurrentTierName(): BudgetTier {
    return this.currentTier.name
  }

  /**
   * Record an attempt result
   */
  recordAttempt(result: AttemptResult): void {
    this.history.push({
      ...result,
      timestamp: new Date(),
      tier: this.currentTier.name,
      iteration: this.history.length + 1,
    })
  }

  /**
   * Check if escalation is needed
   * Protected against race conditions with isEscalating flag
   * Note: Currently synchronous but returns Promise for API compatibility
   */
  async shouldEscalate(): Promise<EscalationDecision> {
    // Prevent concurrent escalation checks/operations
    if (this.isEscalating) {
      return {
        shouldEscalate: false,
        reason: "Escalation check already in progress",
      }
    }

    // Set flag to prevent concurrent access during check
    this.isEscalating = true
    try {
      // Check if we've already escalated too many times
      if (this.escalationCount >= this.maxEscalations) {
        return {
          shouldEscalate: false,
          reason: `Maximum escalations (${this.maxEscalations}) reached`,
        }
      }

      // Check if already at maximum tier
      if (this.currentTier.name === "maximum") {
        return {
          shouldEscalate: false,
          reason: "Already at maximum tier",
        }
      }

      // Collect signals
      const signals = this.collectSignals()

      // Check each escalation rule
      for (const rule of ESCALATION_RULES) {
        if (rule.fromTier !== this.currentTier.name) continue

        // Validate rule has valid tier transition
        // Skip invalid rules: same tier (no-op) or non-existent toTier
        if (rule.fromTier === rule.toTier) continue
        if (!(rule.toTier in BUDGET_TIERS)) continue

        // Check if target tier exceeds max budget
        if (BUDGET_TIER_PRIORITY[rule.toTier] > BUDGET_TIER_PRIORITY[this.maxBudget]) {
          // Cannot escalate beyond max budget - cap at maxBudget if not already there
          if (this.currentTier.name === this.maxBudget) continue

          if (this.evaluateCondition(rule.condition, signals)) {
            return {
              shouldEscalate: true,
              fromTier: this.currentTier.name,
              toTier: this.maxBudget, // Cap at max budget
              reason: this.formatEscalationReason(rule.condition, signals) + ` (capped at ${this.maxBudget})`,
              signals: rule.signals,
            }
          }
          continue
        }

        if (this.evaluateCondition(rule.condition, signals)) {
          return {
            shouldEscalate: true,
            fromTier: this.currentTier.name,
            toTier: rule.toTier,
            reason: this.formatEscalationReason(rule.condition, signals),
            signals: rule.signals,
          }
        }
      }

      return { shouldEscalate: false }
    } finally {
      this.isEscalating = false
    }
  }

  /**
   * Perform escalation to next tier
   * Protected against concurrent escalation
   */
  escalate(toTier: BudgetTier): boolean {
    // Prevent concurrent escalation
    if (this.isEscalating) {
      return false
    }

    this.isEscalating = true
    try {
      this.currentTier = BUDGET_TIERS[toTier]
      this.escalationCount++
      return true
    } finally {
      this.isEscalating = false
    }
  }

  /**
   * Reset the manager for a new task
   */
  reset(initialTier: BudgetTier = "cheap"): void {
    this.currentTier = BUDGET_TIERS[initialTier]
    this.history = []
    this.escalationCount = 0
  }

  /**
   * Get attempt history
   */
  getHistory(): AttemptHistory[] {
    return [...this.history]
  }

  /**
   * Get escalation count
   */
  getEscalationCount(): number {
    return this.escalationCount
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private collectSignals(): CollectedSignals {
    const recentAttempts = this.history.slice(-5)
    const consecutiveFailures = this.countConsecutiveFailures()
    const averageQualityScore = this.calculateAverageQuality(recentAttempts)
    const totalTime = this.calculateTotalTime()
    const isStuck = this.detectStuckPattern()

    return {
      consecutiveFailures,
      averageQualityScore,
      totalTime,
      isStuck,
      recentAttempts,
    }
  }

  private countConsecutiveFailures(): number {
    let count = 0
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (!this.history[i].success) {
        count++
      } else {
        break
      }
    }
    return count
  }

  /**
   * Calculate average quality score from attempts
   * Returns undefined if no scores exist (fail-safe approach)
   */
  private calculateAverageQuality(attempts: AttemptHistory[]): number | undefined {
    const withScores = attempts.filter((a) => a.qualityScore !== undefined)
    if (withScores.length === 0) return undefined // No scores = unknown quality

    const sum = withScores.reduce((s, a) => s + (a.qualityScore ?? 0), 0)
    return sum / withScores.length
  }

  private calculateTotalTime(): number {
    return this.history.reduce((sum, a) => sum + a.duration, 0)
  }

  /**
   * Detect stuck pattern: N consecutive identical error messages or output hashes
   * Uses configurable threshold (default: 2 consecutive)
   *
   * Boundary behavior:
   * - Need at least `stuckThreshold` attempts to detect a pattern
   * - When length == threshold, we check exactly threshold recent items
   * - When length > threshold, we check only the most recent threshold items
   */
  private detectStuckPattern(): boolean {
    // Need at least threshold attempts to detect a pattern
    if (this.history.length < this.stuckThreshold) return false

    // Get exactly the last N attempts where N = stuckThreshold
    const recentAttempts = this.history.slice(-this.stuckThreshold)

    // Check for repeated error messages (all N must have same non-empty error)
    // Use === for strict equality: we need exactly threshold items all matching
    const errorMessages = recentAttempts
      .map((a) => a.errorMessage)
      .filter((e): e is string => e !== undefined && e !== '')
    if (errorMessages.length === this.stuckThreshold) {
      const allSame = errorMessages.every((e) => e === errorMessages[0])
      if (allSame) return true
    }

    // Check for repeated output hashes (all N must have same non-empty hash)
    // Use === for strict equality: we need exactly threshold items all matching
    const hashes = recentAttempts
      .map((a) => a.outputHash)
      .filter((h): h is string => h !== undefined && h !== '')
    if (hashes.length === this.stuckThreshold) {
      const allSame = hashes.every((h) => h === hashes[0])
      if (allSame) return true
    }

    // Check combination: same error AND same hash across recent attempts
    if (errorMessages.length > 0 && hashes.length > 0) {
      const sameErrors = errorMessages.every((e) => e === errorMessages[0])
      const sameHashes = hashes.every((h) => h === hashes[0])
      if (sameErrors && sameHashes) return true
    }

    return false
  }

  private evaluateCondition(
    condition: string,
    signals: CollectedSignals
  ): boolean {
    // Parse and evaluate conditions
    // Format: "consecutive-failures >= 2" or "quality-score < 0.6" or "stuck-pattern AND quality-score < 0.7"

    // Handle AND conditions
    if (condition.includes(" AND ")) {
      const parts = condition.split(" AND ")
      return parts.every((part) => this.evaluateSingleCondition(part.trim(), signals))
    }

    // Handle OR conditions
    if (condition.includes(" OR ")) {
      const parts = condition.split(" OR ")
      return parts.some((part) => this.evaluateSingleCondition(part.trim(), signals))
    }

    return this.evaluateSingleCondition(condition, signals)
  }

  private evaluateSingleCondition(
    condition: string,
    signals: CollectedSignals
  ): boolean {
    // Parse: "consecutive-failures >= 2"
    const match = condition.match(/^([\w-]+)\s*(>=|<=|>|<|==)\s*(\d+\.?\d*)$/)

    if (!match) {
      // Handle boolean conditions
      if (condition === "stuck-pattern" || condition === "stuck-pattern-detected") {
        return signals.isStuck
      }
      if (condition === "timeout-exceeded") {
        return signals.totalTime > this.currentTier.timeoutMs
      }
      return false
    }

    const [, variable, operator, valueStr] = match
    const value = parseFloat(valueStr)

    let actual: number | undefined
    switch (variable) {
      case "consecutive-failures":
        actual = signals.consecutiveFailures
        break
      case "quality-score":
        // If no quality scores available, can't evaluate this condition
        if (signals.averageQualityScore === undefined) {
          return false
        }
        actual = signals.averageQualityScore
        break
      case "total-time":
        actual = signals.totalTime
        break
      default:
        return false
    }

    // Safety check for undefined (shouldn't happen for non-quality-score variables)
    if (actual === undefined) {
      return false
    }

    switch (operator) {
      case ">=":
        return actual >= value
      case "<=":
        return actual <= value
      case ">":
        return actual > value
      case "<":
        return actual < value
      case "==":
        return actual === value
      default:
        return false
    }
  }

  private formatEscalationReason(
    condition: string,
    signals: CollectedSignals
  ): string {
    const reasons: string[] = []

    if (signals.consecutiveFailures >= 2) {
      reasons.push(`${signals.consecutiveFailures} consecutive failures`)
    }

    // Only check quality score if we have one (undefined = no scores available)
    if (
      signals.averageQualityScore !== undefined &&
      signals.averageQualityScore < this.qualityThreshold
    ) {
      reasons.push(
        `quality score ${signals.averageQualityScore.toFixed(2)} below threshold`
      )
    }

    if (signals.isStuck) {
      reasons.push("stuck pattern detected (repeated identical outputs)")
    }

    if (signals.totalTime > this.currentTier.timeoutMs) {
      reasons.push("timeout exceeded")
    }

    return reasons.length > 0 ? reasons.join(", ") : condition
  }
}

interface CollectedSignals {
  consecutiveFailures: number
  averageQualityScore: number | undefined // undefined = no scores available
  totalTime: number
  isStuck: boolean
  recentAttempts: AttemptHistory[]
}

/**
 * Create a new escalation manager with default settings
 */
export function createEscalationManager(
  initialTier: BudgetTier = "cheap",
  options?: {
    maxEscalations?: number
    qualityThreshold?: number
    stuckThreshold?: number
    maxBudget?: BudgetTier
  }
): EscalationManager {
  return new EscalationManager(initialTier, options)
}
