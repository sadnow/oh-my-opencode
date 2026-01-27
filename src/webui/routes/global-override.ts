/**
 * Global Override API Routes
 * REST endpoints for managing provider-level overrides
 */

import type { BudgetOrchestrator } from "../../features/budget-orchestrator"
import type { ModelTier } from "../../config/schema"
import type { UseCase } from "../../features/budget-orchestrator/global-override"
import { USE_CASE_FALLBACKS } from "../../features/budget-orchestrator/global-override"

export interface GlobalOverrideRouteContext {
  budgetOrchestrator: BudgetOrchestrator | null
}

// ============================================================================
// GET Endpoints
// ============================================================================

/**
 * GET /api/global-override
 * Get current global override state
 */
export function handleGetGlobalOverride(
  ctx: GlobalOverrideRouteContext
): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const summary = ctx.budgetOrchestrator.getGlobalOverrideSummary()
    
    return Response.json({
      success: true,
      data: {
        ...summary,
        availableUseCases: Object.keys(USE_CASE_FALLBACKS),
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
 * GET /api/global-override/fallbacks
 * Get the fallback model lists for each use case
 */
export function handleGetFallbacks(): Response {
  return Response.json({
    success: true,
    data: {
      useCases: Object.keys(USE_CASE_FALLBACKS),
      fallbacks: USE_CASE_FALLBACKS,
    },
  })
}

/**
 * GET /api/global-override/best-model/:useCase
 * Get the best available model for a specific use case
 */
export function handleGetBestModel(
  ctx: GlobalOverrideRouteContext,
  useCase: string,
  preferredModel?: string
): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  const validUseCases = Object.keys(USE_CASE_FALLBACKS)
  if (!validUseCases.includes(useCase)) {
    return Response.json(
      { success: false, error: `Invalid use case. Must be one of: ${validUseCases.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const bestModel = ctx.budgetOrchestrator.getBestModelForUseCase(
      useCase as UseCase,
      preferredModel
    )
    
    return Response.json({
      success: true,
      data: {
        useCase,
        preferredModel: preferredModel ?? null,
        selectedModel: bestModel,
        fallbackList: USE_CASE_FALLBACKS[useCase as UseCase],
      },
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// ============================================================================
// Provider Control
// ============================================================================

/**
 * POST /api/global-override/provider/disable
 * Disable a provider
 */
export async function handleDisableProvider(
  request: Request,
  ctx: GlobalOverrideRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { provider: string }
    
    if (!body.provider || typeof body.provider !== "string") {
      return Response.json(
        { success: false, error: "Provider name is required" },
        { status: 400 }
      )
    }

    ctx.budgetOrchestrator.disableProvider(body.provider, "webui")
    
    return Response.json({
      success: true,
      message: `Provider ${body.provider} has been disabled`,
      data: ctx.budgetOrchestrator.getGlobalOverrideSummary(),
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/global-override/provider/enable
 * Enable a previously disabled provider
 */
export async function handleEnableProvider(
  request: Request,
  ctx: GlobalOverrideRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { provider: string }
    
    if (!body.provider || typeof body.provider !== "string") {
      return Response.json(
        { success: false, error: "Provider name is required" },
        { status: 400 }
      )
    }

    ctx.budgetOrchestrator.enableProvider(body.provider, "webui")
    
    return Response.json({
      success: true,
      message: `Provider ${body.provider} has been enabled`,
      data: ctx.budgetOrchestrator.getGlobalOverrideSummary(),
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// ============================================================================
// Tier Control
// ============================================================================

/**
 * POST /api/global-override/max-tier
 * Set maximum tier cap
 */
export async function handleSetMaxTier(
  request: Request,
  ctx: GlobalOverrideRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { tier: ModelTier | null }
    
    const validTiers: (ModelTier | null)[] = ["premium", "standard", "budget", "economy", null]
    if (!validTiers.includes(body.tier)) {
      return Response.json(
        { success: false, error: "Invalid tier. Must be: premium, standard, budget, economy, or null" },
        { status: 400 }
      )
    }

    ctx.budgetOrchestrator.setMaxTierCap(body.tier, "webui")
    
    return Response.json({
      success: true,
      message: body.tier ? `Max tier cap set to ${body.tier}` : "Max tier cap removed",
      data: ctx.budgetOrchestrator.getGlobalOverrideSummary(),
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// ============================================================================
// Emergency Mode
// ============================================================================

/**
 * POST /api/global-override/emergency-mode
 * Enable or disable emergency mode (economy tier only)
 */
export async function handleSetEmergencyMode(
  request: Request,
  ctx: GlobalOverrideRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { enabled: boolean }
    
    if (typeof body.enabled !== "boolean") {
      return Response.json(
        { success: false, error: "'enabled' must be a boolean" },
        { status: 400 }
      )
    }

    ctx.budgetOrchestrator.setEmergencyMode(body.enabled, "webui")
    
    return Response.json({
      success: true,
      message: body.enabled ? "Emergency mode ENABLED - economy tier only" : "Emergency mode disabled",
      data: ctx.budgetOrchestrator.getGlobalOverrideSummary(),
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// ============================================================================
// Auto-Disable on Quota
// ============================================================================

/**
 * POST /api/global-override/auto-disable-quota
 * Configure auto-disable when quota exceeded
 */
export async function handleSetAutoDisableQuota(
  request: Request,
  ctx: GlobalOverrideRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { enabled: boolean; threshold?: number }
    
    if (typeof body.enabled !== "boolean") {
      return Response.json(
        { success: false, error: "'enabled' must be a boolean" },
        { status: 400 }
      )
    }
    
    if (body.threshold !== undefined) {
      if (typeof body.threshold !== "number" || body.threshold < 0 || body.threshold > 100) {
        return Response.json(
          { success: false, error: "'threshold' must be a number between 0 and 100" },
          { status: 400 }
        )
      }
    }

    const globalManager = ctx.budgetOrchestrator.getGlobalOverrideManager()
    globalManager.setAutoDisableOnQuota(body.enabled, body.threshold, { source: "webui" })
    
    return Response.json({
      success: true,
      message: body.enabled 
        ? `Auto-disable on quota enabled at ${body.threshold ?? 95}% threshold`
        : "Auto-disable on quota disabled",
      data: ctx.budgetOrchestrator.getGlobalOverrideSummary(),
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// ============================================================================
// Clear All
// ============================================================================

/**
 * POST /api/global-override/clear
 * Clear all global overrides
 */
export async function handleClearGlobalOverrides(
  ctx: GlobalOverrideRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    ctx.budgetOrchestrator.clearGlobalOverrides("webui")
    
    return Response.json({
      success: true,
      message: "All global overrides cleared",
      data: ctx.budgetOrchestrator.getGlobalOverrideSummary(),
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
