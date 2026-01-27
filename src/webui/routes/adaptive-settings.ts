/**
 * Adaptive Settings API Routes
 * REST endpoints for managing adaptive budget configuration
 */

import type { BudgetOrchestrator } from "../../features/budget-orchestrator"
import type { LearningMode, AdaptiveConfig, QuotaTargets } from "../../config/schema"
import { LEARNING_MODE_PRESETS } from "../../cli/wizard/generator"

export interface AdaptiveSettingsRouteContext {
  budgetOrchestrator: BudgetOrchestrator | null
}

/**
 * GET /api/adaptive/settings
 * Get current adaptive settings
 */
export function handleGetAdaptiveSettings(
  ctx: AdaptiveSettingsRouteContext
): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const settings = ctx.budgetOrchestrator.getAdaptiveSettings()

    // Get stability status for each configured provider
    const stabilityStatus: Record<string, { current: number; required: number }> = {}
    for (const provider of ctx.budgetOrchestrator.getConfiguredProviders()) {
      const status = ctx.budgetOrchestrator.getStabilityStatus(provider)
      if (status) {
        stabilityStatus[provider] = status
      }
    }

    // Get adaptive summaries for each provider
    const adaptiveSummaries: Record<string, ReturnType<typeof ctx.budgetOrchestrator.getAdaptiveSummary>> = {}
    for (const provider of ctx.budgetOrchestrator.getConfiguredProviders()) {
      const summary = ctx.budgetOrchestrator.getAdaptiveSummary(provider)
      if (summary) {
        adaptiveSummaries[provider] = summary
      }
    }

    return Response.json({
      success: true,
      data: {
        ...settings,
        stabilityStatus,
        adaptiveSummaries,
        learningModePresets: LEARNING_MODE_PRESETS,
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
 * POST /api/adaptive/settings
 * Update adaptive settings
 */
export async function handleUpdateAdaptiveSettings(
  request: Request,
  ctx: AdaptiveSettingsRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as {
      autoUpgrade?: boolean
      autoDowngrade?: boolean
      learningMode?: LearningMode
      quotaTargets?: QuotaTargets
      adaptiveConfig?: AdaptiveConfig
    }

    // Validate learning mode if provided
    if (body.learningMode && !["conservative", "balanced", "aggressive"].includes(body.learningMode)) {
      return Response.json(
        { success: false, error: "Invalid learning mode. Must be: conservative, balanced, or aggressive" },
        { status: 400 }
      )
    }

    // Apply settings
    ctx.budgetOrchestrator.applyAdaptiveSettings(body)

    // Return updated settings
    const settings = ctx.budgetOrchestrator.getAdaptiveSettings()

    return Response.json({
      success: true,
      message: "Adaptive settings updated",
      data: settings,
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/adaptive/learning-mode
 * Quick set learning mode (convenience endpoint)
 */
export async function handleSetLearningMode(
  request: Request,
  ctx: AdaptiveSettingsRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { mode: LearningMode }

    if (!body.mode || !["conservative", "balanced", "aggressive"].includes(body.mode)) {
      return Response.json(
        { success: false, error: "Invalid mode. Must be: conservative, balanced, or aggressive" },
        { status: 400 }
      )
    }

    ctx.budgetOrchestrator.setLearningMode(body.mode)

    // Get the preset config that was applied
    const preset = LEARNING_MODE_PRESETS[body.mode]

    return Response.json({
      success: true,
      message: `Learning mode set to: ${body.mode}`,
      data: {
        mode: body.mode,
        appliedConfig: preset,
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
 * POST /api/adaptive/auto-upgrade
 * Toggle auto-upgrade setting
 */
export async function handleSetAutoUpgrade(
  request: Request,
  ctx: AdaptiveSettingsRouteContext
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
        { success: false, error: "Invalid value. 'enabled' must be a boolean" },
        { status: 400 }
      )
    }

    ctx.budgetOrchestrator.setAutoUpgrade(body.enabled)

    return Response.json({
      success: true,
      message: `Auto-upgrade ${body.enabled ? "enabled" : "disabled"}`,
      data: {
        autoUpgrade: body.enabled,
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
 * POST /api/adaptive/auto-downgrade
 * Toggle auto-downgrade setting
 */
export async function handleSetAutoDowngrade(
  request: Request,
  ctx: AdaptiveSettingsRouteContext
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
        { success: false, error: "Invalid value. 'enabled' must be a boolean" },
        { status: 400 }
      )
    }

    ctx.budgetOrchestrator.setAutoDowngrade(body.enabled)

    return Response.json({
      success: true,
      message: `Auto-downgrade ${body.enabled ? "enabled" : "disabled"}`,
      data: {
        autoDowngrade: body.enabled,
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
 * POST /api/adaptive/quota-targets
 * Update quota targets
 */
export async function handleSetQuotaTargets(
  request: Request,
  ctx: AdaptiveSettingsRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as QuotaTargets

    // Validate targets
    if (body.claude_max_weekly_percent !== undefined) {
      if (body.claude_max_weekly_percent < 0 || body.claude_max_weekly_percent > 100) {
        return Response.json(
          { success: false, error: "claude_max_weekly_percent must be between 0 and 100" },
          { status: 400 }
        )
      }
    }

    if (body.copilot_monthly_percent !== undefined) {
      if (body.copilot_monthly_percent < 0 || body.copilot_monthly_percent > 100) {
        return Response.json(
          { success: false, error: "copilot_monthly_percent must be between 0 and 100" },
          { status: 400 }
        )
      }
    }

    if (body.zen_monthly_dollars !== undefined) {
      if (body.zen_monthly_dollars < 0) {
        return Response.json(
          { success: false, error: "zen_monthly_dollars must be positive" },
          { status: 400 }
        )
      }
    }

    ctx.budgetOrchestrator.setQuotaTargets(body)

    return Response.json({
      success: true,
      message: "Quota targets updated",
      data: ctx.budgetOrchestrator.getQuotaTargets(),
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/adaptive/reset-learning
 * Reset adaptive learning for a provider or all providers
 */
export async function handleResetLearning(
  request: Request,
  ctx: AdaptiveSettingsRouteContext
): Promise<Response> {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as { provider?: string }

    ctx.budgetOrchestrator.resetAdaptiveLearning(body.provider)

    return Response.json({
      success: true,
      message: body.provider
        ? `Adaptive learning reset for ${body.provider}`
        : "Adaptive learning reset for all providers",
    })
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Label mappings for UI-friendly display of config keys
 */
export const CONFIG_LABELS: Record<string, { label: string; tooltip: string }> = {
  velocity_alpha: {
    label: "Learning Speed",
    tooltip: "How quickly the system adapts to new spending patterns. Lower = more stable.",
  },
  min_samples_for_prediction: {
    label: "Minimum Data Points",
    tooltip: "How many usage samples needed before trusting predictions.",
  },
  stability_checks_before_upgrade: {
    label: "Upgrade Stability Requirement",
    tooltip: "How many consecutive stable checks required before allowing an upgrade.",
  },
  tier_upgrade_threshold: {
    label: "Upgrade Headroom Multiplier",
    tooltip: "How much budget headroom needed to trigger an upgrade (1.5 = 50% more than needed).",
  },
  tier_downgrade_threshold: {
    label: "Downgrade Trigger",
    tooltip: "How low headroom must go to trigger a downgrade (0.5 = 50% of needed).",
  },
  auto_upgrade: {
    label: "Automatic Upgrade",
    tooltip: "Automatically switch to higher-quality models when budget headroom allows.",
  },
  auto_downgrade: {
    label: "Automatic Downgrade",
    tooltip: "Automatically switch to cheaper models when approaching budget limits.",
  },
}

/**
 * GET /api/adaptive/config-labels
 * Get UI-friendly labels for config keys
 */
export function handleGetConfigLabels(): Response {
  return Response.json({
    success: true,
    data: CONFIG_LABELS,
  })
}
