/**
 * Stats API Routes
 * REST endpoints for analytics and statistics
 */

import type { UsageTracker } from "../../features/usage-tracker"
import type { BudgetOrchestrator } from "../../features/budget-orchestrator"

export interface StatsRouteContext {
  usageTracker: UsageTracker | null
  budgetOrchestrator: BudgetOrchestrator | null
}

/**
 * GET /api/stats/summary?period=weekly|monthly
 * Get period totals with previous period comparison
 */
export function handleGetStatsSummary(
  period: string,
  ctx: StatsRouteContext
): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  try {
    const summary = period === "monthly"
      ? ctx.usageTracker.getMonthlySummary()
      : ctx.usageTracker.getWeeklySummary()

    return Response.json({
      success: true,
      data: {
        period: period === "monthly" ? "monthly" : "weekly",
        ...summary,
      },
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stats/by-category
 * Get cost breakdown by task category
 */
export function handleGetStatsByCategory(ctx: StatsRouteContext): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  try {
    const categories = ctx.usageTracker.getByCategory()

    // Sort by cost descending
    const sorted = Object.entries(categories)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .map(([category, data]) => ({ category, ...data }))

    const totalCost = sorted.reduce((sum, c) => sum + c.cost, 0)

    return Response.json({
      success: true,
      data: {
        categories: sorted,
        totalCost,
      },
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stats/efficiency
 * Get model cost/quality metrics
 */
export function handleGetStatsEfficiency(ctx: StatsRouteContext): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  try {
    const efficiency = ctx.usageTracker.getEfficiency()

    // Sort models by efficiency (tokens per $1, descending)
    const sortedModels = Object.values(efficiency.byModel)
      .sort((a, b) => b.tokensPer$1 - a.tokensPer$1)

    return Response.json({
      success: true,
      data: {
        byModel: sortedModels,
        byTier: efficiency.byTier,
      },
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stats/trends/:provider?range=7d|30d
 * Get provider-specific trends
 */
export function handleGetStatsTrends(
  provider: string,
  range: string,
  ctx: StatsRouteContext
): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  try {
    const rangeDays = range === "30d" ? 30 : 7
    const trends = ctx.usageTracker.getProviderTrends(provider, rangeDays)

    return Response.json({
      success: true,
      data: {
        ...trends,
        rangeDays,
      },
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stats/sessions
 * Get session analytics (duration, cost distribution)
 */
export function handleGetStatsSessions(ctx: StatsRouteContext): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  try {
    const sessionStats = ctx.usageTracker.getSessionStats()

    return Response.json({
      success: true,
      data: sessionStats,
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stats/all-providers?range=7d|30d
 * Get trends for all providers at once
 */
export function handleGetStatsAllProviders(
  range: string,
  ctx: StatsRouteContext
): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  try {
    const rangeDays = range === "30d" ? 30 : 7
    const summaries = ctx.usageTracker.getAllSummaries()
    const providers = Object.keys(summaries)

    const trends: Record<string, ReturnType<typeof ctx.usageTracker.getProviderTrends>> = {}
    for (const provider of providers) {
      trends[provider] = ctx.usageTracker.getProviderTrends(provider, rangeDays)
    }

    return Response.json({
      success: true,
      data: {
        providers,
        trends,
        rangeDays,
      },
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
