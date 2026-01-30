/**
 * Budget Orchestrator Types
 * TypeScript interfaces for budget-aware model orchestration
 */

import type { ModelTier, BudgetConfig } from "../../config/schema"

export type SpendTrend = "under" | "on-track" | "over"

export interface BudgetState {
  /** Provider ID */
  provider: string
  /** Amount spent in current period (USD) */
  used: number
  /** Amount remaining in budget (USD) */
  remaining: number
  /** Daily budget based on remaining days (USD) */
  dailyBudget: number
  /** Total budget for the period (USD) */
  totalBudget: number
  /** Spending trend compared to target */
  trend: SpendTrend
  /** Target daily spend (USD) */
  targetDaily: number
  /** Actual daily spend (USD) */
  actualDaily: number
  /** Days elapsed in current period */
  daysElapsed: number
  /** Days remaining until reset */
  daysRemaining: number
}

export interface ModelRef {
  providerID: string
  modelID: string
}

export interface TierConfig {
  /** Models available in this tier, ordered by preference */
  models: string[]
  /** Estimated cost per 1M tokens (average of input/output) */
  avgCostPer1M: number
}

export interface BudgetOrchestratorConfig {
  /** Enable budget-aware orchestration */
  enabled: boolean
  /** Target percentage of budget to use (default: 0.7 = 70%) */
  targetPercentage: number
  /** Provider-specific budgets in USD */
  providerBudgets: Record<string, number>
  /** Auto-downgrade when over budget */
  autoDowngrade: boolean
  /** Minimum tier to downgrade to */
  minTier: ModelTier
  /** Daily target override (USD) */
  dailyTarget?: number
}

export interface DowngradeResult {
  /** Original model */
  original: ModelRef
  /** Downgraded model (null if no downgrade available) */
  downgraded: ModelRef | null
  /** Reason for downgrade */
  reason: string
  /** New tier */
  tier: ModelTier
}

export type TierChangeDirection = "upgrade" | "downgrade" | "none"

export interface TierChangeResult {
  /** Original model */
  original: ModelRef
  /** New model (null if no change) */
  newModel: ModelRef | null
  /** Direction of change */
  direction: TierChangeDirection
  /** Reason for change */
  reason: string
  /** Original tier */
  originalTier: ModelTier
  /** Target tier */
  targetTier: ModelTier
  /** Confidence in this recommendation (0-1) */
  confidence: number
}

export interface AdaptiveBudgetSummary {
  /** Base hourly allowance (budget / hours in period) */
  hourlyAllowance: number
  /** Credits accumulated from idle time */
  accumulatedCredits: number
  /** Current budget headroom (how much we can safely spend) */
  budgetHeadroom: number
  /** Maximum recommended spend in a single burst */
  maxBurstSpend: number
  /** Current spending velocity ($/hour when active) */
  spendingVelocity: number
  /** Predicted future spend for remaining period */
  predictedFutureSpend: number
  /** Recommended tier based on adaptive analysis */
  recommendedTier: ModelTier
  /** Prediction accuracy (0-1) */
  predictionAccuracy: number
  /** Learning progress (0-1, 1 = fully trained) */
  learningProgress: number
  /** Can afford upgrade from current tier */
  canAffordUpgrade: boolean
  /** Should downgrade from current tier */
  shouldDowngrade: boolean
}

export type BudgetType = 'subscription' | 'api'

export interface BudgetStatus {
  provider: string
  type: BudgetType
  metric_label: string // "% used", "requests remaining", "$ used"
  remaining_pct: number // 0-100
  severity: 'ok' | 'warn' | 'critical'
  recommendation?: 'upgrade' | 'downgrade' | 'limit' | 'none'
  details: {
    used: number
    total: number
    unit: string // "%", "requests", "$"
  }
}
