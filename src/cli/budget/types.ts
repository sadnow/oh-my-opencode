/**
 * Budget CLI Types
 */

import type { ModelTier } from "../../config/schema"
import type { SpendTrend, AdaptiveBudgetSummary } from "../../features/budget-orchestrator"

export interface BudgetCommandOptions {
  /** Output in JSON format */
  json?: boolean
  /** Filter by provider */
  provider?: string
  /** Force a specific tier */
  forceTier?: ModelTier
  /** Lock the current tier */
  lockTier?: boolean
  /** Unlock the tier */
  unlockTier?: boolean
  /** Reset adaptive learning (optional provider) */
  resetLearning?: string | boolean
  /** Duration for force/lock in minutes */
  duration?: number
}

export interface ProviderBudgetDisplay {
  provider: string
  budget: number
  used: number
  remaining: number
  percentage: number
  dailyBudget: number
  actualDaily: number
  targetDaily: number
  trend: SpendTrend
  daysElapsed: number
  daysRemaining: number
  periodType: "weekly" | "monthly"
  resetDay: string
  adaptive: AdaptiveBudgetSummary | null
}

export interface OverrideStatus {
  forcedTier: ModelTier | null
  tierLocked: boolean
  expiresIn: string | null
  modifiedBy: string | null
}

export interface BudgetDisplayData {
  enabled: boolean
  providers: ProviderBudgetDisplay[]
  globalTier: ModelTier
  override: OverrideStatus
}
