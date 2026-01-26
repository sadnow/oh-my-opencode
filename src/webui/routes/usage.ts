/**
 * Usage API Routes
 * REST endpoints for usage tracking
 */

import type { UsageTracker } from "../../features/usage-tracker"
import type { BudgetOrchestrator } from "../../features/budget-orchestrator"

export interface UsageRouteContext {
  usageTracker: UsageTracker | null
  budgetOrchestrator: BudgetOrchestrator | null
}

/**
 * GET /api/usage
 * Get usage statistics
 */
export function handleGetUsage(ctx: UsageRouteContext): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  const summaries = ctx.usageTracker.getAllSummaries()
  const totalCost = ctx.usageTracker.getTotalCost()

  return Response.json({
    success: true,
    data: {
      summaries,
      totalCost,
    },
  })
}

/**
 * GET /api/usage/:provider
 * Get usage for a specific provider
 */
export function handleGetProviderUsage(
  provider: string,
  ctx: UsageRouteContext
): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  const summary = ctx.usageTracker.getProviderSummary(provider)
  const records = ctx.usageTracker.getRecordsForCurrentPeriod(provider)

  return Response.json({
    success: true,
    data: {
      summary,
      records,
    },
  })
}

/**
 * GET /api/budget
 * Get budget state for all providers
 */
export function handleGetBudget(ctx: UsageRouteContext): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  const states = ctx.budgetOrchestrator.getAllBudgetStates()
  const recommendedTier = ctx.budgetOrchestrator.getRecommendedTier()
  const recommendedModels = ctx.budgetOrchestrator.getRecommendedModels()
  const statusMessages = ctx.budgetOrchestrator.getBudgetStatusMessages()

  return Response.json({
    success: true,
    data: {
      enabled: ctx.budgetOrchestrator.isEnabled(),
      states,
      recommendedTier,
      recommendedModels,
      statusMessages,
    },
  })
}

/**
 * GET /api/budget/:provider
 * Get budget state for a specific provider
 */
export function handleGetProviderBudget(
  provider: string,
  ctx: UsageRouteContext
): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  const state = ctx.budgetOrchestrator.getBudgetState(provider)

  if (!state) {
    return Response.json(
      { success: false, error: `No budget configured for provider: ${provider}` },
      { status: 404 }
    )
  }

  return Response.json({
    success: true,
    data: state,
  })
}

/**
 * DELETE /api/usage
 * Clear all usage data
 */
export function handleClearUsage(ctx: UsageRouteContext): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  ctx.usageTracker.clearAll()

  return Response.json({
    success: true,
    message: "Usage data cleared",
  })
}

/**
 * DELETE /api/usage/:provider
 * Clear usage data for a specific provider
 */
export function handleClearProviderUsage(
  provider: string,
  ctx: UsageRouteContext
): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  ctx.usageTracker.clearProvider(provider)

  return Response.json({
    success: true,
    message: `Usage data cleared for ${provider}`,
  })
}
