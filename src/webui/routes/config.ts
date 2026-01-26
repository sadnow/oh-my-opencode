/**
 * Config API Routes
 * REST endpoints for configuration management
 */

import type { OhMyOpenCodeConfig } from "../../config/schema"
import type { HotConfigManager } from "../../features/hot-config"

export interface ConfigRouteContext {
  configManager: HotConfigManager
}

/**
 * GET /api/config
 * Get current configuration
 */
export function handleGetConfig(ctx: ConfigRouteContext): Response {
  const config = ctx.configManager.getConfig()

  return Response.json({
    success: true,
    data: config,
  })
}

/**
 * POST /api/config
 * Update configuration
 */
export async function handleUpdateConfig(
  request: Request,
  ctx: ConfigRouteContext
): Promise<Response> {
  try {
    const body = await request.json() as {
      changes: Partial<OhMyOpenCodeConfig>
      immediate?: boolean
      save?: boolean
    }

    if (!body.changes || typeof body.changes !== "object") {
      return Response.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      )
    }

    let config: OhMyOpenCodeConfig

    if (body.immediate) {
      config = ctx.configManager.applyImmediate(body.changes, "webui")
    } else {
      ctx.configManager.queueChange(body.changes, "webui")
      config = ctx.configManager.applyPendingChanges()
    }

    if (body.save) {
      ctx.configManager.saveConfig()
    }

    return Response.json({
      success: true,
      data: config,
      message: "Configuration updated",
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
 * POST /api/config/reload
 * Reload configuration from disk
 */
export function handleReloadConfig(ctx: ConfigRouteContext): Response {
  try {
    const config = ctx.configManager.reload()

    return Response.json({
      success: true,
      data: config,
      message: "Configuration reloaded from disk",
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
 * POST /api/config/save
 * Save current configuration to disk
 */
export function handleSaveConfig(ctx: ConfigRouteContext): Response {
  try {
    ctx.configManager.saveConfig()

    return Response.json({
      success: true,
      message: "Configuration saved to disk",
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
 * GET /api/config/pending
 * Get pending configuration changes
 */
export function handleGetPendingChanges(ctx: ConfigRouteContext): Response {
  const pending = ctx.configManager.getPendingChanges()

  return Response.json({
    success: true,
    data: {
      count: pending.length,
      changes: pending,
    },
  })
}

/**
 * POST /api/config/apply-pending
 * Apply all pending configuration changes
 */
export function handleApplyPending(ctx: ConfigRouteContext): Response {
  const config = ctx.configManager.applyPendingChanges()

  return Response.json({
    success: true,
    data: config,
    message: "Pending changes applied",
  })
}

/**
 * DELETE /api/config/pending/:id
 * Cancel a pending change
 */
export function handleCancelChange(
  changeId: string,
  ctx: ConfigRouteContext
): Response {
  const success = ctx.configManager.cancelChange(changeId)

  if (!success) {
    return Response.json(
      { success: false, error: "Change not found" },
      { status: 404 }
    )
  }

  return Response.json({
    success: true,
    message: "Change cancelled",
  })
}
