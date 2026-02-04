/**
 * Orchestration API Routes
 * REST endpoints for model orchestration
 */

import type { BudgetOrchestrator } from "../../features/budget-orchestrator"
import { MODEL_TIERS, TIER_ORDER, getModelTier } from "../../features/budget-orchestrator"
import { CircuitBreaker } from "../../features/budget-orchestrator/circuit-breaker"
import { USE_CASE_FALLBACKS } from "../../features/budget-orchestrator/global-override"
import { hasZenCacheData, isZenModelInCache } from "../../features/budget-orchestrator/zen-model-detection"

export interface OrchestrationRouteContext {
  budgetOrchestrator: BudgetOrchestrator | null
}

/**
 * GET /api/orchestration/tiers
 * Get model tier definitions
 */
export function handleGetTiers(): Response {
  const tiers = TIER_ORDER.map((tier) => ({
    name: tier,
    models: MODEL_TIERS[tier].models,
    avgCostPer1M: MODEL_TIERS[tier].avgCostPer1M,
  }))

  return Response.json({
    success: true,
    data: tiers,
  })
}

/**
 * GET /api/orchestration/model/:model/tier
 * Get the tier for a specific model
 */
export function handleGetModelTier(model: string): Response {
  // Handle URL-encoded slashes
  const decodedModel = decodeURIComponent(model)
  const tier = getModelTier(decodedModel)

  if (!tier) {
    return Response.json({
      success: true,
      data: {
        model: decodedModel,
        tier: null,
        message: "Model not found in tier definitions",
      },
    })
  }

  return Response.json({
    success: true,
    data: {
      model: decodedModel,
      tier,
    },
  })
}

/**
 * POST /api/orchestration/check-downgrade
 * Check if a model should be downgraded based on current budget
 */
export async function handleCheckDowngrade(
  request: Request,
  ctx: OrchestrationRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { model: string }

    if (!body.model) {
      return Response.json(
        { success: false, error: "Missing model parameter" },
        { status: 400 }
      )
    }

    const result = ctx.budgetOrchestrator.getDowngradedModel(body.model)

    return Response.json({
      success: true,
      data: {
        original: result.original,
        downgraded: result.downgraded,
        shouldDowngrade: result.downgraded !== null,
        reason: result.reason,
        tier: result.tier,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orchestration/recommendations
 * Get recommended models based on current budget
 */
export function handleGetRecommendations(ctx: OrchestrationRouteContext): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  const tier = ctx.budgetOrchestrator.getRecommendedTier()
  const models = ctx.budgetOrchestrator.getRecommendedModels()

  return Response.json({
    success: true,
    data: {
      recommendedTier: tier,
      models,
    },
  })
}

/**
 * GET /api/orchestration/status
 * Get overall orchestration status
 */
export function handleGetStatus(ctx: OrchestrationRouteContext): Response {
  const isEnabled = ctx.budgetOrchestrator?.isEnabled() ?? false

  if (!isEnabled) {
    return Response.json({
      success: true,
      data: {
        enabled: false,
        message: "Budget-aware orchestration is disabled",
      },
    })
  }

  const states = ctx.budgetOrchestrator!.getAllBudgetStates()
  const tier = ctx.budgetOrchestrator!.getRecommendedTier()
  const messages = ctx.budgetOrchestrator!.getBudgetStatusMessages()

  const providersOverBudget = Object.entries(states)
    .filter(([_, state]) => state.trend === "over")
    .map(([provider]) => provider)

  return Response.json({
    success: true,
    data: {
      enabled: true,
      currentTier: tier,
      providersOverBudget,
      statusMessages: messages,
      summary:
        providersOverBudget.length > 0
          ? `Warning: ${providersOverBudget.length} provider(s) over budget`
          : `All providers within budget (tier: ${tier})`,
    },
  })
}

/**
 * GET /api/orchestration/circuit-status
 * Get circuit breaker status for all providers and models
 */
export function handleGetCircuitStatus(ctx: OrchestrationRouteContext): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  const budgetStates = ctx.budgetOrchestrator.getAllBudgetStates()
  const usagePercentages = ctx.budgetOrchestrator.getUsagePercentages()
  const quotaTargets = ctx.budgetOrchestrator.getQuotaTargets()
  const overrideSummary = ctx.budgetOrchestrator.getGlobalOverrideSummary()
  const configuredProviders = ctx.budgetOrchestrator.getConfiguredProviders()
  const globalOverrideManager = ctx.budgetOrchestrator.getGlobalOverrideManager()

  const allModels = new Set<string>()
  for (const tier of TIER_ORDER) {
    for (const model of MODEL_TIERS[tier].models) {
      allModels.add(model)
    }
  }
  for (const models of Object.values(USE_CASE_FALLBACKS)) {
    for (const model of models) {
      allModels.add(model)
    }
  }

  const providers = new Set<string>([...configuredProviders, ...Object.keys(budgetStates)])
  for (const model of allModels) {
    const [provider] = model.split("/")
    if (provider) {
      providers.add(provider)
    }
  }

  const circuitBreaker = new CircuitBreaker()
  const providersResponse: Record<string, {
    connected: boolean
    usagePercent: number
    quotaTarget: number | null
    autoDisabled: boolean
    models: Record<string, {
      circuit: {
        state: "closed" | "open" | "half_open"
        failureCount: number
        lastFailureAt: number | null
        lastSuccessAt: number | null
        lastLatencyMs: number | null
      }
      available: boolean
      inCache: boolean
    }>
  }> = {}

  const sortedProviders = Array.from(providers).sort()
  for (const provider of sortedProviders) {
    const providerState = circuitBreaker.getProviderState(provider)
    const providerModels = Array.from(allModels)
      .filter((model) => model.startsWith(`${provider}/`))
      .sort()

    const models: Record<string, {
      circuit: {
        state: "closed" | "open" | "half_open"
        failureCount: number
        lastFailureAt: number | null
        lastSuccessAt: number | null
        lastLatencyMs: number | null
      }
      available: boolean
      inCache: boolean
    }> = {}

    for (const model of providerModels) {
      const modelId = model.split("/")[1] ?? model
      const inCache = (provider === "opencode" || provider === "opencode-zen")
        ? (hasZenCacheData() ? isZenModelInCache(modelId) : false)
        : true
      const available = globalOverrideManager.isModelAllowed(model, configuredProviders)

      models[modelId] = {
        circuit: {
          state: providerState.state,
          failureCount: providerState.failureCount,
          lastFailureAt: providerState.lastFailureAt,
          lastSuccessAt: providerState.lastSuccessAt,
          lastLatencyMs: providerState.lastLatencyMs,
        },
        available,
        inCache,
      }
    }

    const usageFromState = budgetStates[provider]
      ? (budgetStates[provider].used / budgetStates[provider].totalBudget) * 100
      : 0
    const usagePercent = usagePercentages[provider] ?? usageFromState

    providersResponse[provider] = {
      connected: configuredProviders.includes(provider) || provider in budgetStates,
      usagePercent,
      quotaTarget: quotaTargets[provider] ?? null,
      autoDisabled: overrideSummary.autoDisabledProviders.includes(provider),
      models,
    }
  }

  return Response.json({
    success: true,
    data: {
      timestamp: Date.now(),
      providers: providersResponse,
    },
  })
}
