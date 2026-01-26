/**
 * Adaptive Budget Intelligence
 *
 * Learns spending patterns and makes smart predictions about budget usage.
 * Uses hourly allowance policies with accumulated credits for idle time.
 * Gradually improves estimates based on long-term observations.
 */

import { log } from "../../shared"
import type { ModelTier } from "../../config/schema"

// ============================================================================
// Types
// ============================================================================

export interface SessionPattern {
  startHour: number        // 0-23
  dayOfWeek: number        // 0-6 (Sunday = 0)
  durationMinutes: number
  cost: number
  tier: ModelTier
  timestamp: number        // Unix ms
}

export interface PredictionRecord {
  predictedCost: number
  actualCost: number
  predictedTier: ModelTier
  actualTier: ModelTier
  timestamp: number
  sessionDurationMinutes: number
}

export interface HourlyPattern {
  hour: number
  avgCost: number
  avgDuration: number
  sampleCount: number
}

export interface DailyPattern {
  dayOfWeek: number
  avgCost: number
  avgSessionCount: number
  sampleCount: number
}

export interface AdaptiveBudgetState {
  // Core timing
  lastActivityTimestamp: number    // Unix ms
  lastSessionStart: number | null  // Unix ms

  // Credit accumulation
  accumulatedCredits: number       // Dollars saved from idle time
  maxAccumulatedCredits: number    // Cap to prevent abuse (e.g., 2x daily budget)

  // Spending velocity (Exponential Moving Average)
  spendingVelocityPerHour: number  // Dollars per active hour
  velocityAlpha: number            // EMA smoothing factor (0.1 = slow learning, 0.3 = fast)
  velocitySampleCount: number

  // Session cost prediction
  avgSessionCost: number
  sessionCostStdDev: number
  sessionCostSampleCount: number

  // Pattern learning
  sessionPatterns: SessionPattern[]
  maxPatternHistory: number        // Keep last N sessions
  hourlyPatterns: HourlyPattern[]  // 24 entries
  dailyPatterns: DailyPattern[]    // 7 entries

  // Prediction accuracy tracking
  predictionAccuracy: number       // 0-1, higher = more accurate
  predictionHistory: PredictionRecord[]
  maxPredictionHistory: number

  // Tier transition smoothing
  currentRecommendedTier: ModelTier
  tierTransitionMomentum: number   // -1 to 1, negative = trending down, positive = trending up
  tierStabilityCounter: number     // How many checks at current tier
  minTierStabilityBeforeUpgrade: number  // Require stability before upgrading
}

export interface AdaptiveBudgetConfig {
  // Budget parameters
  totalBudget: number              // Total budget for period
  periodHours: number              // Hours in budget period (168 for weekly, 720 for monthly)

  // Credit accumulation
  creditAccumulationRate: number   // 0-1, how much of idle allowance to accumulate (0.8 = 80%)
  maxCreditMultiplier: number      // Max credits as multiple of daily budget (2 = 2 days worth)

  // Spending policy
  conservativeSpendingFactor: number  // 0-1, how conservative to be (0.7 = spend only 70% of available)
  burstAllowancePercent: number       // Max % of credits to spend in single session (0.3 = 30%)

  // Learning parameters
  velocityAlpha: number            // EMA alpha for velocity (0.2 default)
  minSamplesForPrediction: number  // Min samples before trusting predictions (10)
  patternDecayDays: number         // How old patterns become less relevant (30 days)

  // Tier management
  minTier: ModelTier
  tierUpgradeThreshold: number     // Headroom multiplier to consider upgrade (1.5)
  tierDowngradeThreshold: number   // Headroom multiplier to force downgrade (0.5)
  stabilityChecksBeforeUpgrade: number  // Consecutive stable checks before upgrading (3)
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveBudgetConfig = {
  totalBudget: 20,
  periodHours: 168, // Weekly

  creditAccumulationRate: 0.8,
  maxCreditMultiplier: 2,

  conservativeSpendingFactor: 0.7,
  burstAllowancePercent: 0.3,

  velocityAlpha: 0.2,
  minSamplesForPrediction: 10,
  patternDecayDays: 30,

  minTier: "budget",
  tierUpgradeThreshold: 1.5,
  tierDowngradeThreshold: 0.5,
  stabilityChecksBeforeUpgrade: 3,
}

// ============================================================================
// Adaptive Budget Manager
// ============================================================================

export class AdaptiveBudgetManager {
  private state: AdaptiveBudgetState
  private config: AdaptiveBudgetConfig
  private persistPath: string | null

  constructor(config: Partial<AdaptiveBudgetConfig> = {}, persistPath?: string) {
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config }
    this.persistPath = persistPath ?? null
    this.state = this.loadState() ?? this.createInitialState()

    log("[adaptive-budget] Initialized:", {
      totalBudget: this.config.totalBudget,
      periodHours: this.config.periodHours,
      hourlyAllowance: this.getHourlyAllowance().toFixed(4),
      accumulatedCredits: this.state.accumulatedCredits.toFixed(4),
    })
  }

  // --------------------------------------------------------------------------
  // Core Calculations
  // --------------------------------------------------------------------------

  /**
   * Get the base hourly allowance (budget / hours in period)
   */
  getHourlyAllowance(): number {
    return this.config.totalBudget / this.config.periodHours
  }

  /**
   * Calculate accumulated credits from idle time since last activity.
   * Credits accumulate when the system isn't being used.
   */
  calculateAccumulatedCredits(): number {
    const now = Date.now()
    const hoursSinceLastActivity = (now - this.state.lastActivityTimestamp) / (1000 * 60 * 60)

    if (hoursSinceLastActivity <= 0) return this.state.accumulatedCredits

    const hourlyAllowance = this.getHourlyAllowance()
    const potentialCredits = hoursSinceLastActivity * hourlyAllowance * this.config.creditAccumulationRate

    // Calculate max credits (cap at N days worth)
    const dailyBudget = this.config.totalBudget / (this.config.periodHours / 24)
    const maxCredits = dailyBudget * this.config.maxCreditMultiplier

    // Add potential credits but cap at max
    const newCredits = Math.min(
      this.state.accumulatedCredits + potentialCredits,
      maxCredits
    )

    return newCredits
  }

  /**
   * Get the current "budget headroom" - how much we can safely spend.
   * This considers accumulated credits, current spend rate, and predictions.
   */
  getBudgetHeadroom(currentUsed: number, daysRemaining: number): number {
    const accumulatedCredits = this.calculateAccumulatedCredits()
    const remainingBudget = this.config.totalBudget - currentUsed

    // Base headroom = remaining budget + accumulated credits
    let headroom = remainingBudget + accumulatedCredits

    // Apply conservative factor
    headroom *= this.config.conservativeSpendingFactor

    // If we have spending velocity data, predict future needs
    if (this.state.velocitySampleCount >= this.config.minSamplesForPrediction) {
      const hoursRemaining = daysRemaining * 24
      const predictedFutureSpend = this.predictFutureSpend(hoursRemaining)

      // Reserve enough for predicted future spend
      const reserveForFuture = predictedFutureSpend * 0.5 // Keep 50% buffer
      headroom = Math.max(0, headroom - reserveForFuture)
    }

    return headroom
  }

  /**
   * Predict how much we'll spend in the given number of hours.
   * Uses learned patterns and spending velocity.
   */
  predictFutureSpend(hoursAhead: number): number {
    // If no data, use conservative estimate
    if (this.state.velocitySampleCount < this.config.minSamplesForPrediction) {
      return hoursAhead * this.getHourlyAllowance()
    }

    // Base prediction on spending velocity
    let prediction = this.state.spendingVelocityPerHour * hoursAhead

    // Adjust based on time-of-day patterns if we have enough data
    const now = new Date()
    const currentHour = now.getHours()

    const relevantHourlyPatterns = this.state.hourlyPatterns.filter(p => p.sampleCount >= 3)
    if (relevantHourlyPatterns.length >= 12) {
      // We have reasonable hourly pattern data
      let patternAdjustment = 0
      for (let h = 0; h < Math.min(hoursAhead, 24); h++) {
        const hour = (currentHour + h) % 24
        const pattern = this.state.hourlyPatterns[hour]
        if (pattern && pattern.sampleCount >= 3) {
          patternAdjustment += pattern.avgCost
        } else {
          patternAdjustment += this.state.spendingVelocityPerHour
        }
      }
      // Blend pattern-based prediction with velocity-based
      prediction = prediction * 0.6 + patternAdjustment * 0.4
    }

    // Apply prediction accuracy factor (if we've been over-predicting, reduce)
    prediction *= (0.5 + this.state.predictionAccuracy * 0.5)

    return prediction
  }

  /**
   * Get the maximum we should spend in a single session/burst.
   * Prevents blowing all accumulated credits at once.
   */
  getMaxBurstSpend(): number {
    const accumulatedCredits = this.calculateAccumulatedCredits()
    const hourlyAllowance = this.getHourlyAllowance()

    // Base burst = hourly allowance (what we'd normally spend in an hour)
    let maxBurst = hourlyAllowance

    // Add portion of accumulated credits
    const creditBurst = accumulatedCredits * this.config.burstAllowancePercent
    maxBurst += creditBurst

    // But never more than a day's worth in one burst
    const dailyBudget = this.config.totalBudget / (this.config.periodHours / 24)
    maxBurst = Math.min(maxBurst, dailyBudget)

    return maxBurst
  }

  // --------------------------------------------------------------------------
  // Tier Recommendation
  // --------------------------------------------------------------------------

  /**
   * Get the recommended tier based on current budget state and predictions.
   * Uses momentum and stability to prevent rapid tier oscillation.
   */
  getRecommendedTier(currentUsed: number, daysRemaining: number): ModelTier {
    const headroom = this.getBudgetHeadroom(currentUsed, daysRemaining)
    const maxBurst = this.getMaxBurstSpend()

    // Tier costs (rough estimates per request)
    const tierCosts: Record<ModelTier, number> = {
      premium: 0.50,    // ~$0.50 per complex request
      standard: 0.15,   // ~$0.15 per request
      budget: 0.05,     // ~$0.05 per request
      economy: 0.02,    // ~$0.02 per request
    }

    // Calculate how many requests we can afford at each tier
    const affordableRequests: Record<ModelTier, number> = {
      premium: headroom / tierCosts.premium,
      standard: headroom / tierCosts.standard,
      budget: headroom / tierCosts.budget,
      economy: headroom / tierCosts.economy,
    }

    // Determine target tier based on affordability
    let targetTier: ModelTier

    if (affordableRequests.premium >= 10 && maxBurst >= tierCosts.premium * 3) {
      targetTier = "premium"
    } else if (affordableRequests.standard >= 20 && maxBurst >= tierCosts.standard * 3) {
      targetTier = "standard"
    } else if (affordableRequests.budget >= 30 && maxBurst >= tierCosts.budget * 3) {
      targetTier = "budget"
    } else {
      targetTier = "economy"
    }

    // Apply min tier constraint
    const tierOrder: ModelTier[] = ["economy", "budget", "standard", "premium"]
    const targetIndex = tierOrder.indexOf(targetTier)
    const minIndex = tierOrder.indexOf(this.config.minTier)
    if (targetIndex < minIndex) {
      targetTier = this.config.minTier
    }

    // Apply tier transition smoothing
    const currentIndex = tierOrder.indexOf(this.state.currentRecommendedTier)
    const newIndex = tierOrder.indexOf(targetTier)

    if (newIndex > currentIndex) {
      // Upgrading - require stability
      this.state.tierTransitionMomentum = Math.min(1, this.state.tierTransitionMomentum + 0.3)
      this.state.tierStabilityCounter++

      if (this.state.tierStabilityCounter < this.config.stabilityChecksBeforeUpgrade) {
        // Not stable enough yet, stay at current tier
        log("[adaptive-budget] Upgrade pending, stability:", {
          current: this.state.currentRecommendedTier,
          target: targetTier,
          stabilityCounter: this.state.tierStabilityCounter,
          required: this.config.stabilityChecksBeforeUpgrade,
        })
        return this.state.currentRecommendedTier
      }
    } else if (newIndex < currentIndex) {
      // Downgrading - apply immediately but track momentum
      this.state.tierTransitionMomentum = Math.max(-1, this.state.tierTransitionMomentum - 0.5)
      this.state.tierStabilityCounter = 0
    } else {
      // Same tier - increase stability
      this.state.tierStabilityCounter++
    }

    // Update current tier
    if (targetTier !== this.state.currentRecommendedTier) {
      log("[adaptive-budget] Tier change:", {
        from: this.state.currentRecommendedTier,
        to: targetTier,
        headroom: headroom.toFixed(4),
        maxBurst: maxBurst.toFixed(4),
        momentum: this.state.tierTransitionMomentum.toFixed(2),
      })
      this.state.currentRecommendedTier = targetTier
      this.state.tierStabilityCounter = 0
    }

    return targetTier
  }

  // --------------------------------------------------------------------------
  // Learning & Recording
  // --------------------------------------------------------------------------

  /**
   * Record the start of a session/activity.
   */
  recordSessionStart(): void {
    // Update accumulated credits before resetting timestamp
    this.state.accumulatedCredits = this.calculateAccumulatedCredits()
    this.state.lastSessionStart = Date.now()
    this.state.lastActivityTimestamp = Date.now()

    this.saveState()
  }

  /**
   * Record a completed session with its cost.
   * This is the main learning entry point.
   */
  recordSession(cost: number, durationMinutes: number, tier: ModelTier): void {
    const now = Date.now()
    const sessionStart = this.state.lastSessionStart ?? now - durationMinutes * 60 * 1000
    const startDate = new Date(sessionStart)

    // Create session pattern
    const pattern: SessionPattern = {
      startHour: startDate.getHours(),
      dayOfWeek: startDate.getDay(),
      durationMinutes,
      cost,
      tier,
      timestamp: now,
    }

    // Add to pattern history (FIFO)
    this.state.sessionPatterns.push(pattern)
    if (this.state.sessionPatterns.length > this.state.maxPatternHistory) {
      this.state.sessionPatterns.shift()
    }

    // Update spending velocity (EMA)
    const hoursActive = durationMinutes / 60
    if (hoursActive > 0) {
      const sessionVelocity = cost / hoursActive

      if (this.state.velocitySampleCount === 0) {
        this.state.spendingVelocityPerHour = sessionVelocity
      } else {
        const alpha = this.state.velocityAlpha
        this.state.spendingVelocityPerHour =
          alpha * sessionVelocity + (1 - alpha) * this.state.spendingVelocityPerHour
      }
      this.state.velocitySampleCount++
    }

    // Update session cost statistics
    this.updateSessionCostStats(cost)

    // Update hourly pattern
    this.updateHourlyPattern(pattern)

    // Update daily pattern
    this.updateDailyPattern(pattern)

    // Spend from accumulated credits
    this.state.accumulatedCredits = Math.max(0, this.state.accumulatedCredits - cost)
    this.state.lastActivityTimestamp = now
    this.state.lastSessionStart = null

    log("[adaptive-budget] Session recorded:", {
      cost: cost.toFixed(4),
      durationMinutes,
      tier,
      newVelocity: this.state.spendingVelocityPerHour.toFixed(4),
      remainingCredits: this.state.accumulatedCredits.toFixed(4),
    })

    this.saveState()
  }

  /**
   * Record a prediction for later accuracy tracking.
   */
  recordPrediction(predictedCost: number, predictedTier: ModelTier): void {
    // Store prediction to compare with actual later
    const record: PredictionRecord = {
      predictedCost,
      actualCost: 0, // Will be updated when session ends
      predictedTier,
      actualTier: predictedTier, // Will be updated
      timestamp: Date.now(),
      sessionDurationMinutes: 0,
    }

    this.state.predictionHistory.push(record)
    if (this.state.predictionHistory.length > this.state.maxPredictionHistory) {
      this.state.predictionHistory.shift()
    }
  }

  /**
   * Update a prediction with actual results.
   */
  updatePredictionWithActual(actualCost: number, actualTier: ModelTier, durationMinutes: number): void {
    const lastPrediction = this.state.predictionHistory[this.state.predictionHistory.length - 1]
    if (!lastPrediction) return

    lastPrediction.actualCost = actualCost
    lastPrediction.actualTier = actualTier
    lastPrediction.sessionDurationMinutes = durationMinutes

    // Update prediction accuracy
    this.updatePredictionAccuracy()
    this.saveState()
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private updateSessionCostStats(cost: number): void {
    const n = this.state.sessionCostSampleCount
    const oldMean = this.state.avgSessionCost

    // Online mean update
    this.state.avgSessionCost = oldMean + (cost - oldMean) / (n + 1)

    // Online variance update (Welford's algorithm)
    if (n > 0) {
      const delta = cost - oldMean
      const delta2 = cost - this.state.avgSessionCost
      const oldVar = this.state.sessionCostStdDev ** 2
      const newVar = (oldVar * n + delta * delta2) / (n + 1)
      this.state.sessionCostStdDev = Math.sqrt(Math.max(0, newVar))
    }

    this.state.sessionCostSampleCount++
  }

  private updateHourlyPattern(pattern: SessionPattern): void {
    const hp = this.state.hourlyPatterns[pattern.startHour]
    if (!hp) {
      this.state.hourlyPatterns[pattern.startHour] = {
        hour: pattern.startHour,
        avgCost: pattern.cost,
        avgDuration: pattern.durationMinutes,
        sampleCount: 1,
      }
    } else {
      const n = hp.sampleCount
      hp.avgCost = (hp.avgCost * n + pattern.cost) / (n + 1)
      hp.avgDuration = (hp.avgDuration * n + pattern.durationMinutes) / (n + 1)
      hp.sampleCount++
    }
  }

  private updateDailyPattern(pattern: SessionPattern): void {
    const dp = this.state.dailyPatterns[pattern.dayOfWeek]
    if (!dp) {
      this.state.dailyPatterns[pattern.dayOfWeek] = {
        dayOfWeek: pattern.dayOfWeek,
        avgCost: pattern.cost,
        avgSessionCount: 1,
        sampleCount: 1,
      }
    } else {
      const n = dp.sampleCount
      dp.avgCost = (dp.avgCost * n + pattern.cost) / (n + 1)
      dp.sampleCount++
      // avgSessionCount is per-day, tracked separately
    }
  }

  private updatePredictionAccuracy(): void {
    const recentPredictions = this.state.predictionHistory
      .filter(p => p.actualCost > 0) // Only completed predictions
      .slice(-20) // Last 20

    if (recentPredictions.length < 5) return

    let totalError = 0
    for (const p of recentPredictions) {
      const error = Math.abs(p.predictedCost - p.actualCost) / Math.max(0.01, p.actualCost)
      totalError += Math.min(1, error) // Cap individual errors at 100%
    }

    const avgError = totalError / recentPredictions.length
    this.state.predictionAccuracy = Math.max(0, 1 - avgError)

    log("[adaptive-budget] Prediction accuracy updated:", {
      accuracy: (this.state.predictionAccuracy * 100).toFixed(1) + "%",
      sampleCount: recentPredictions.length,
    })
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  private createInitialState(): AdaptiveBudgetState {
    return {
      lastActivityTimestamp: Date.now(),
      lastSessionStart: null,

      accumulatedCredits: 0,
      maxAccumulatedCredits: this.config.totalBudget * this.config.maxCreditMultiplier / (this.config.periodHours / 24),

      spendingVelocityPerHour: this.getHourlyAllowance(),
      velocityAlpha: this.config.velocityAlpha,
      velocitySampleCount: 0,

      avgSessionCost: 0,
      sessionCostStdDev: 0,
      sessionCostSampleCount: 0,

      sessionPatterns: [],
      maxPatternHistory: 100,
      hourlyPatterns: Array(24).fill(null).map((_, i) => ({
        hour: i,
        avgCost: 0,
        avgDuration: 0,
        sampleCount: 0,
      })),
      dailyPatterns: Array(7).fill(null).map((_, i) => ({
        dayOfWeek: i,
        avgCost: 0,
        avgSessionCount: 0,
        sampleCount: 0,
      })),

      predictionAccuracy: 0.5, // Start at 50% confidence
      predictionHistory: [],
      maxPredictionHistory: 50,

      currentRecommendedTier: "standard",
      tierTransitionMomentum: 0,
      tierStabilityCounter: 0,
      minTierStabilityBeforeUpgrade: this.config.stabilityChecksBeforeUpgrade,
    }
  }

  private loadState(): AdaptiveBudgetState | null {
    if (!this.persistPath) return null

    try {
      const fs = require("fs")
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, "utf-8"))
        log("[adaptive-budget] Loaded state from:", this.persistPath)
        return data
      }
    } catch (error) {
      log("[adaptive-budget] Failed to load state:", error)
    }

    return null
  }

  private saveState(): void {
    if (!this.persistPath) return

    try {
      const fs = require("fs")
      const path = require("path")
      const dir = path.dirname(this.persistPath)

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(this.persistPath, JSON.stringify(this.state, null, 2))
    } catch (error) {
      log("[adaptive-budget] Failed to save state:", error)
    }
  }

  // --------------------------------------------------------------------------
  // Public Getters
  // --------------------------------------------------------------------------

  getState(): Readonly<AdaptiveBudgetState> {
    return { ...this.state }
  }

  getConfig(): Readonly<AdaptiveBudgetConfig> {
    return { ...this.config }
  }

  /**
   * Get a summary of the current budget intelligence state.
   */
  getSummary(currentUsed: number, daysRemaining: number): {
    hourlyAllowance: number
    accumulatedCredits: number
    budgetHeadroom: number
    maxBurstSpend: number
    spendingVelocity: number
    predictedFutureSpend: number
    recommendedTier: ModelTier
    predictionAccuracy: number
    learningProgress: number
  } {
    const hoursRemaining = daysRemaining * 24

    return {
      hourlyAllowance: this.getHourlyAllowance(),
      accumulatedCredits: this.calculateAccumulatedCredits(),
      budgetHeadroom: this.getBudgetHeadroom(currentUsed, daysRemaining),
      maxBurstSpend: this.getMaxBurstSpend(),
      spendingVelocity: this.state.spendingVelocityPerHour,
      predictedFutureSpend: this.predictFutureSpend(hoursRemaining),
      recommendedTier: this.getRecommendedTier(currentUsed, daysRemaining),
      predictionAccuracy: this.state.predictionAccuracy,
      learningProgress: Math.min(1, this.state.velocitySampleCount / this.config.minSamplesForPrediction),
    }
  }
}
