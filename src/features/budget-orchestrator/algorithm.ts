/**
 * Budget Algorithm
 * Core budget calculation and tier selection logic
 */

import type { ModelTier } from "../../config/schema"
import type {
  BudgetState,
  BudgetOrchestratorConfig,
  ModelRef,
  DowngradeResult,
  SpendTrend,
} from "./types"
import type { ProviderUsageSummary } from "../usage-tracker"
import {
  getDaysInPeriod,
  getDaysRemaining,
  getDaysElapsed,
} from "../usage-tracker"
import {
  getModelTier,
  findDowngradedModel,
  TIER_ORDER,
  formatModelRef,
} from "./tiers"

/**
 * Calculate budget state for a provider.
 */
export function calculateBudgetState(
  usage: ProviderUsageSummary,
  budget: number,
  config: BudgetOrchestratorConfig
): BudgetState {
  const provider = usage.provider
  const now = new Date()

  const used = usage.totalCost
  const remaining = Math.max(0, budget - used)
  const daysRemaining = getDaysRemaining(provider, now)
  const daysElapsed = getDaysElapsed(provider, now)
  const totalDays = getDaysInPeriod(provider, now)

  // Daily budget based on remaining time
  const dailyBudget = daysRemaining > 0 ? remaining / daysRemaining : 0

  // Target daily spend (even distribution)
  const targetDaily = budget / totalDays

  // Actual daily spend
  const actualDaily = daysElapsed > 0 ? used / daysElapsed : 0

  // Apply daily target override if configured
  const effectiveTargetDaily = config.dailyTarget ?? targetDaily

  // Determine spending trend
  const trend: SpendTrend =
    actualDaily > effectiveTargetDaily * 1.1
      ? "over"
      : actualDaily < effectiveTargetDaily * 0.9
        ? "under"
        : "on-track"

  return {
    provider,
    used,
    remaining,
    dailyBudget,
    totalBudget: budget,
    trend,
    targetDaily: effectiveTargetDaily,
    actualDaily,
    daysElapsed,
    daysRemaining,
  }
}

/**
 * Select the appropriate tier based on budget state.
 */
export function selectTier(
  budgetState: BudgetState,
  config: BudgetOrchestratorConfig
): ModelTier {
  const budget = budgetState.totalBudget
  const targetPercentage = config.targetPercentage

  // Calculate target remaining (buffer to keep)
  const targetRemaining = budget * (1 - targetPercentage)
  const headroom = budgetState.remaining - targetRemaining

  // If over budget (negative headroom), use minimum tier
  if (headroom <= 0) {
    return config.minTier
  }

  // Calculate flex factor: how many days of budget we have as headroom
  const flexFactor =
    budgetState.dailyBudget > 0 ? headroom / budgetState.dailyBudget : 0

  // Select tier based on flex factor
  if (flexFactor > 2) {
    return "premium"
  } else if (flexFactor > 1) {
    return "standard"
  } else if (flexFactor > 0.5) {
    return "budget"
  }

  return config.minTier
}

/**
 * Check if a model should be downgraded based on budget state.
 */
export function shouldDowngrade(
  model: ModelRef,
  budgetState: BudgetState,
  config: BudgetOrchestratorConfig
): boolean {
  if (!config.autoDowngrade) {
    return false
  }

  // Check if over budget
  if (budgetState.trend === "over") {
    return true
  }

  // Check if current model tier is above selected tier
  const currentTier = getModelTier(model)
  if (!currentTier) {
    return false
  }

  const selectedTier = selectTier(budgetState, config)
  const currentTierIndex = TIER_ORDER.indexOf(currentTier)
  const selectedTierIndex = TIER_ORDER.indexOf(selectedTier)

  return currentTierIndex < selectedTierIndex
}

/**
 * Get a downgraded model if needed.
 */
export function getDowngradedModel(
  model: ModelRef,
  budgetState: BudgetState,
  config: BudgetOrchestratorConfig,
  availableProviders: string[]
): DowngradeResult {
  if (!shouldDowngrade(model, budgetState, config)) {
    const tier = getModelTier(model) ?? "standard"
    return {
      original: model,
      downgraded: null,
      reason: "No downgrade needed",
      tier,
    }
  }

  const selectedTier = selectTier(budgetState, config)
  const downgraded = findDowngradedModel(model, selectedTier, availableProviders)

  // Ensure we don't downgrade below minimum tier
  const downgradedTier = downgraded ? getModelTier(downgraded) : null
  const minTierIndex = TIER_ORDER.indexOf(config.minTier)
  const downgradedTierIndex = downgradedTier
    ? TIER_ORDER.indexOf(downgradedTier)
    : minTierIndex

  // If downgraded tier is below minimum, stick with minimum
  let finalModel = downgraded
  let finalTier = downgradedTier ?? config.minTier

  if (downgradedTierIndex > minTierIndex) {
    const minTierModel = findDowngradedModel(model, config.minTier, availableProviders)
    if (minTierModel) {
      finalModel = minTierModel
      finalTier = config.minTier
    }
  }

  const reason =
    budgetState.trend === "over"
      ? `Over budget: spending $${budgetState.actualDaily.toFixed(2)}/day vs target $${budgetState.targetDaily.toFixed(2)}/day`
      : `Budget optimization: tier ${selectedTier} selected based on remaining budget`

  return {
    original: model,
    downgraded: finalModel,
    reason,
    tier: finalTier,
  }
}

/**
 * Get recommended models for different task types based on budget.
 */
export function getRecommendedModels(
  budgetStates: Record<string, BudgetState>,
  config: BudgetOrchestratorConfig,
  availableProviders: string[]
): Record<string, ModelRef> {
  // Find the most constrained provider
  let lowestTier: ModelTier = "premium"
  for (const budgetState of Object.values(budgetStates)) {
    const tier = selectTier(budgetState, config)
    const tierIndex = TIER_ORDER.indexOf(tier)
    const lowestIndex = TIER_ORDER.indexOf(lowestTier)
    if (tierIndex > lowestIndex) {
      lowestTier = tier
    }
  }

  // Get models for the constrained tier
  const orchModel = findDowngradedModel(
    { providerID: "anthropic", modelID: "claude-opus-4-5" },
    lowestTier,
    availableProviders
  )

  const implModel = findDowngradedModel(
    { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
    lowestTier,
    availableProviders
  )

  const quickModel = findDowngradedModel(
    { providerID: "anthropic", modelID: "claude-haiku-4-5" },
    lowestTier === "premium" ? "standard" : lowestTier,
    availableProviders
  )

  return {
    orchestrator: orchModel ?? { providerID: "opencode", modelID: "big-pickle" },
    implementation: implModel ?? { providerID: "opencode", modelID: "big-pickle" },
    quick: quickModel ?? { providerID: "opencode", modelID: "big-pickle" },
  }
}

/**
 * Estimate remaining budget duration at current spend rate.
 */
export function estimateRemainingDuration(budgetState: BudgetState): {
  days: number
  sustainable: boolean
} {
  if (budgetState.actualDaily <= 0) {
    return { days: budgetState.daysRemaining, sustainable: true }
  }

  const daysAtCurrentRate = budgetState.remaining / budgetState.actualDaily
  const sustainable = daysAtCurrentRate >= budgetState.daysRemaining

  return {
    days: Math.floor(daysAtCurrentRate),
    sustainable,
  }
}

/**
 * Get budget status message.
 */
export function getBudgetStatusMessage(budgetState: BudgetState): string {
  const percentUsed =
    budgetState.totalBudget > 0
      ? ((budgetState.used / budgetState.totalBudget) * 100).toFixed(1)
      : "0"

  const estimate = estimateRemainingDuration(budgetState)

  if (budgetState.trend === "over") {
    return `Over budget! ${percentUsed}% used, only ${estimate.days} days remaining at current rate`
  } else if (budgetState.trend === "under") {
    return `Under budget: ${percentUsed}% used, ${budgetState.daysRemaining} days remaining`
  }
  return `On track: ${percentUsed}% used, budget sustainable for ${budgetState.daysRemaining} days`
}
