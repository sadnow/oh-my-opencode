/**
 * Budget CLI Display Logic
 * Builds display data from budget orchestrator
 */

import type { BudgetOrchestrator } from "../../features/budget-orchestrator"
import type { BudgetDisplayData, ProviderBudgetDisplay } from "./types"

// ============================================================================
// Period Calculation
// ============================================================================

function getPeriodType(provider: string): "weekly" | "monthly" {
  return provider === "anthropic" ? "weekly" : "monthly"
}

function getResetDay(provider: string): string {
  const now = new Date()
  const periodType = getPeriodType(provider)

  if (periodType === "weekly") {
    // Anthropic resets on Sunday
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7
    const resetDate = new Date(now)
    resetDate.setDate(now.getDate() + daysUntilSunday)
    return resetDate.toLocaleDateString("en-US", { weekday: "long" })
  } else {
    // Monthly reset on 1st
    return "1st"
  }
}

// ============================================================================
// Build Display Data
// ============================================================================

export function buildBudgetDisplayData(
  orchestrator: BudgetOrchestrator | null
): BudgetDisplayData {
  if (!orchestrator || !orchestrator.isEnabled()) {
    return {
      enabled: false,
      providers: [],
      globalTier: "standard",
      override: {
        forcedTier: null,
        tierLocked: false,
        expiresIn: null,
        modifiedBy: null,
      },
    }
  }

  const providers: ProviderBudgetDisplay[] = []
  const budgetStates = orchestrator.getAllBudgetStates()

  for (const [provider, state] of Object.entries(budgetStates)) {
    const adaptive = orchestrator.getAdaptiveSummary(provider)

    providers.push({
      provider,
      budget: state.totalBudget,
      used: state.used,
      remaining: state.remaining,
      percentage: (state.used / state.totalBudget) * 100,
      dailyBudget: state.dailyBudget,
      actualDaily: state.actualDaily,
      targetDaily: state.targetDaily,
      trend: state.trend,
      daysElapsed: state.daysElapsed,
      daysRemaining: state.daysRemaining,
      periodType: getPeriodType(provider),
      resetDay: getResetDay(provider),
      adaptive: adaptive ?? null,
    })
  }

  const overrideManager = orchestrator.getOverrideManager()
  const overrideSummary = overrideManager.getSummary()

  return {
    enabled: true,
    providers,
    globalTier: orchestrator.getRecommendedTier(),
    override: {
      forcedTier: overrideSummary.forcedTier,
      tierLocked: overrideSummary.tierLocked,
      expiresIn: overrideSummary.expiresIn,
      modifiedBy: overrideSummary.modifiedBy,
    },
  }
}

// ============================================================================
// Filter by Provider
// ============================================================================

export function filterByProvider(
  data: BudgetDisplayData,
  provider: string
): BudgetDisplayData {
  return {
    ...data,
    providers: data.providers.filter(
      p => p.provider.toLowerCase() === provider.toLowerCase()
    ),
  }
}
