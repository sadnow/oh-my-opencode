/**
 * Wizard API Routes
 * REST endpoints for the orchestration wizard
 */

import type { OhMyOpenCodeConfig, OrchestrationPreset } from "../../config/schema"
import type { HotConfigManager } from "../../features/hot-config"
import { generateConfig, type WizardAnswers } from "../../cli/wizard"
import { getAllPresets, getPreset } from "../../cli/wizard/presets"

export interface WizardRouteContext {
  configManager: HotConfigManager
}

/**
 * GET /api/presets
 * Get all available orchestration presets
 */
export function handleGetPresets(): Response {
  const presets = getAllPresets()

  return Response.json({
    success: true,
    data: presets.map((p) => ({
      name: p.name,
      description: p.description,
      requiredProviders: p.requiredProviders,
    })),
  })
}

/**
 * GET /api/preset/:name
 * Get a specific preset configuration
 */
export function handleGetPreset(name: string): Response {
  const preset = getPreset(name as OrchestrationPreset)

  if (!preset) {
    return Response.json(
      { success: false, error: `Preset not found: ${name}` },
      { status: 404 }
    )
  }

  return Response.json({
    success: true,
    data: {
      name: preset.name,
      description: preset.description,
      requiredProviders: preset.requiredProviders,
      categories: preset.categories,
    },
  })
}

/**
 * POST /api/preset/:name
 * Apply a preset to the current configuration
 */
export async function handleApplyPreset(
  name: string,
  ctx: WizardRouteContext
): Promise<Response> {
  const preset = getPreset(name as OrchestrationPreset)

  if (!preset) {
    return Response.json(
      { success: false, error: `Preset not found: ${name}` },
      { status: 404 }
    )
  }

  const change: Partial<OhMyOpenCodeConfig> = {
    categories: preset.categories,
    orchestration_preset: preset.name,
  }

  ctx.configManager.queueChange(change, "webui-preset")
  const config = ctx.configManager.applyPendingChanges()

  return Response.json({
    success: true,
    data: config,
    message: `Preset "${name}" applied`,
  })
}

/**
 * POST /api/wizard
 * Generate configuration from wizard answers
 */
export async function handleWizard(
  request: Request,
  ctx: WizardRouteContext
): Promise<Response> {
  try {
    const body = await request.json() as {
      answers: WizardAnswers
      apply?: boolean
      save?: boolean
    }

    if (!body.answers) {
      return Response.json(
        { success: false, error: "Missing wizard answers" },
        { status: 400 }
      )
    }

    const { config, preview } = generateConfig(body.answers)

    if (body.apply) {
      ctx.configManager.queueChange(config, "webui-wizard")
      ctx.configManager.applyPendingChanges()

      if (body.save) {
        ctx.configManager.saveConfig()
      }

      return Response.json({
        success: true,
        data: {
          config,
          applied: true,
          saved: body.save ?? false,
        },
        message: "Wizard configuration applied",
      })
    }

    return Response.json({
      success: true,
      data: {
        config,
        preview,
        applied: false,
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
 * GET /api/features
 * Get list of toggle-able features
 */
export function handleGetFeatures(ctx: WizardRouteContext): Response {
  const config = ctx.configManager.getConfig()

  const features = [
    {
      name: "usage_tracking",
      label: "Usage Tracking",
      description: "Track API usage and costs",
      enabled: config.usage_tracking?.enabled ?? true,
    },
    {
      name: "budget",
      label: "Budget Orchestration",
      description: "Auto-adjust models based on budget",
      enabled: config.budget?.enabled ?? false,
    },
    {
      name: "webui",
      label: "WebUI",
      description: "Web-based configuration interface",
      enabled: config.webui?.enabled ?? false,
    },
    {
      name: "ralph_loop",
      label: "Ralph Loop",
      description: "Iterative task completion",
      enabled: config.ralph_loop?.enabled ?? false,
    },
    {
      name: "tmux",
      label: "Tmux Integration",
      description: "Background agents in tmux panes",
      enabled: config.tmux?.enabled ?? false,
    },
  ]

  return Response.json({
    success: true,
    data: features,
  })
}

/**
 * POST /api/features/:name
 * Enable or disable a feature
 */
export async function handleToggleFeature(
  name: string,
  request: Request,
  ctx: WizardRouteContext
): Promise<Response> {
  try {
    const body = await request.json() as { enabled: boolean }

    if (typeof body.enabled !== "boolean") {
      return Response.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      )
    }

    const change: Partial<OhMyOpenCodeConfig> = {}

    switch (name) {
      case "usage_tracking":
        change.usage_tracking = { enabled: body.enabled, persist: true } as OhMyOpenCodeConfig["usage_tracking"]
        break
      case "budget":
        change.budget = { enabled: body.enabled } as OhMyOpenCodeConfig["budget"]
        break
      case "webui":
        change.webui = { enabled: body.enabled } as OhMyOpenCodeConfig["webui"]
        break
      case "ralph_loop":
        change.ralph_loop = { enabled: body.enabled } as OhMyOpenCodeConfig["ralph_loop"]
        break
      case "tmux":
        change.tmux = { enabled: body.enabled } as OhMyOpenCodeConfig["tmux"]
        break
      default:
        return Response.json(
          { success: false, error: `Unknown feature: ${name}` },
          { status: 404 }
        )
    }

    ctx.configManager.queueChange(change, "webui-feature")
    const config = ctx.configManager.applyPendingChanges()

    return Response.json({
      success: true,
      data: config,
      message: `Feature "${name}" ${body.enabled ? "enabled" : "disabled"}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
