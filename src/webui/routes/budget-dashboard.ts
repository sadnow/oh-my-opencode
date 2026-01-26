/**
 * Budget Dashboard API Routes
 * Full dashboard data, trends, and override controls
 */

import type { BudgetOrchestrator } from "../../features/budget-orchestrator"
import type { UsageTracker } from "../../features/usage-tracker"
import type { ModelTier } from "../../config/schema"

// ============================================================================
// Types
// ============================================================================

export interface BudgetDashboardContext {
  budgetOrchestrator: BudgetOrchestrator | null
  usageTracker: UsageTracker | null
}

interface DailySpending {
  date: string
  amount: number
}

interface ProviderDashboardData {
  provider: string
  budget: number
  used: number
  percentage: number
  trend: "under" | "on-track" | "over"
  daysRemaining: number
  daysElapsed: number
  recommendedTier: ModelTier
  adaptive: {
    hourlyAllowance: number
    accumulatedCredits: number
    budgetHeadroom: number
    spendingVelocity: number
    learningProgress: number
    predictionAccuracy: number
    canAffordUpgrade: boolean
    shouldDowngrade: boolean
  } | null
  dailySpending: DailySpending[]
}

interface DashboardResponse {
  enabled: boolean
  providers: ProviderDashboardData[]
  globalTier: ModelTier
  override: {
    forcedTier: ModelTier | null
    tierLocked: boolean
    expiresIn: string | null
    modifiedBy: string | null
  }
}

interface TrendDataPoint {
  date: string
  [provider: string]: string | number // date is string, amounts are numbers
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPeriodType(provider: string): "weekly" | "monthly" {
  return provider === "anthropic" ? "weekly" : "monthly"
}

function generateDailySpending(
  provider: string,
  usageTracker: UsageTracker | null,
  daysElapsed: number
): DailySpending[] {
  // Generate last 7 days of spending data
  // In a real implementation, this would pull from usage tracker history
  const spending: DailySpending[] = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split("T")[0]

    // Use usage tracker if available, otherwise generate placeholder
    let amount = 0
    if (usageTracker) {
      const summary = usageTracker.getProviderSummary(provider)
      // Estimate daily average
      if (daysElapsed > 0) {
        amount = summary.totalCost / Math.max(1, daysElapsed) * (0.8 + Math.random() * 0.4)
      }
    }

    spending.push({ date: dateStr, amount: Math.max(0, amount) })
  }

  return spending
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/budget/dashboard
 * Full dashboard data for all providers
 */
export function handleGetDashboard(ctx: BudgetDashboardContext): Response {
  const { budgetOrchestrator, usageTracker } = ctx

  if (!budgetOrchestrator || !budgetOrchestrator.isEnabled()) {
    return Response.json({
      success: true,
      data: {
        enabled: false,
        providers: [],
        globalTier: "standard",
        override: {
          forcedTier: null,
          tierLocked: false,
          expiresIn: null,
          modifiedBy: null,
        },
      } satisfies DashboardResponse,
    })
  }

  const providers: ProviderDashboardData[] = []
  const budgetStates = budgetOrchestrator.getAllBudgetStates()

  for (const [provider, state] of Object.entries(budgetStates)) {
    const adaptiveSummary = budgetOrchestrator.getAdaptiveSummary(provider)
    const dailySpending = generateDailySpending(provider, usageTracker, state.daysElapsed)

    providers.push({
      provider,
      budget: state.totalBudget,
      used: state.used,
      percentage: (state.used / state.totalBudget) * 100,
      trend: state.trend,
      daysRemaining: state.daysRemaining,
      daysElapsed: state.daysElapsed,
      recommendedTier: adaptiveSummary?.recommendedTier ?? "standard",
      adaptive: adaptiveSummary ? {
        hourlyAllowance: adaptiveSummary.hourlyAllowance,
        accumulatedCredits: adaptiveSummary.accumulatedCredits,
        budgetHeadroom: adaptiveSummary.budgetHeadroom,
        spendingVelocity: adaptiveSummary.spendingVelocity,
        learningProgress: adaptiveSummary.learningProgress,
        predictionAccuracy: adaptiveSummary.predictionAccuracy,
        canAffordUpgrade: adaptiveSummary.canAffordUpgrade,
        shouldDowngrade: adaptiveSummary.shouldDowngrade,
      } : null,
      dailySpending,
    })
  }

  const overrideManager = budgetOrchestrator.getOverrideManager()
  const overrideSummary = overrideManager.getSummary()

  const response: DashboardResponse = {
    enabled: true,
    providers,
    globalTier: budgetOrchestrator.getRecommendedTier(),
    override: {
      forcedTier: overrideSummary.forcedTier,
      tierLocked: overrideSummary.tierLocked,
      expiresIn: overrideSummary.expiresIn,
      modifiedBy: overrideSummary.modifiedBy,
    },
  }

  return Response.json({ success: true, data: response })
}

/**
 * GET /api/budget/trends
 * Spending trends for charts
 */
export function handleGetTrends(ctx: BudgetDashboardContext): Response {
  const { budgetOrchestrator, usageTracker } = ctx

  if (!budgetOrchestrator || !budgetOrchestrator.isEnabled()) {
    return Response.json({
      success: true,
      data: { trends: [], providers: [] },
    })
  }

  const providers = budgetOrchestrator.getConfiguredProviders()
  const trends: TrendDataPoint[] = []
  const now = new Date()

  // Generate 14 days of trend data
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split("T")[0]

    const point: TrendDataPoint = { date: dateStr }

    for (const provider of providers) {
      const state = budgetOrchestrator.getBudgetState(provider)
      if (state && state.daysElapsed > 0) {
        // Estimate daily spending
        const dailyAvg = state.used / state.daysElapsed
        point[provider] = dailyAvg * (0.7 + Math.random() * 0.6)
      } else {
        point[provider] = 0
      }
    }

    trends.push(point)
  }

  return Response.json({
    success: true,
    data: { trends, providers },
  })
}

/**
 * POST /api/budget/override
 * Set tier override via WebUI
 */
export async function handleSetOverride(
  req: Request,
  ctx: BudgetDashboardContext
): Promise<Response> {
  const { budgetOrchestrator } = ctx

  if (!budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestrator not available" },
      { status: 400 }
    )
  }

  try {
    const body = await req.json() as {
      action: "force-tier" | "lock-tier" | "unlock-tier" | "clear" | "reset-learning"
      tier?: ModelTier
      durationMinutes?: number
      provider?: string
    }

    const overrideManager = budgetOrchestrator.getOverrideManager()
    const durationMs = body.durationMinutes ? body.durationMinutes * 60 * 1000 : undefined

    switch (body.action) {
      case "force-tier":
        if (!body.tier) {
          return Response.json(
            { success: false, error: "Tier is required for force-tier action" },
            { status: 400 }
          )
        }
        overrideManager.forceTier(body.tier, { durationMs, source: "webui" })
        return Response.json({
          success: true,
          message: `Tier forced to ${body.tier}`,
        })

      case "lock-tier":
        overrideManager.lockTier({ durationMs, source: "webui" })
        return Response.json({
          success: true,
          message: "Tier locked",
        })

      case "unlock-tier":
        overrideManager.unlockTier()
        return Response.json({
          success: true,
          message: "Tier unlocked",
        })

      case "clear":
        overrideManager.clearOverrides()
        return Response.json({
          success: true,
          message: "Overrides cleared",
        })

      case "reset-learning":
        budgetOrchestrator.resetAdaptiveLearning(body.provider)
        return Response.json({
          success: true,
          message: body.provider
            ? `Reset learning for ${body.provider}`
            : "Reset all adaptive learning",
        })

      default:
        return Response.json(
          { success: false, error: `Unknown action: ${body.action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
