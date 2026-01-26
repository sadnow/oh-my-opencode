/**
 * Claude Max Usage Routes
 * API endpoints for Claude Max subscription usage tracking
 */

import type { ClaudeMaxUsageTracker } from "../../features/claude-max-usage"

// ============================================================================
// Types
// ============================================================================

export interface ClaudeMaxRouteContext {
  claudeMaxTracker: ClaudeMaxUsageTracker | null
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/claude-max/usage
 * Get current Claude Max subscription usage
 */
export function handleGetClaudeMaxUsage(ctx: ClaudeMaxRouteContext): Response {
  if (!ctx.claudeMaxTracker) {
    return Response.json({
      success: false,
      error: "Claude Max tracking not available",
    }, { status: 503 })
  }

  const data = ctx.claudeMaxTracker.getData()
  const recommendation = ctx.claudeMaxTracker.getRecommendation()

  return Response.json({
    success: true,
    data: {
      allModels: {
        ...data.allModels,
        daysUntilReset: ctx.claudeMaxTracker.getDaysUntilReset("allModels"),
        formattedResetDate: ctx.claudeMaxTracker.formatResetDate("allModels"),
      },
      sonnetOnly: {
        ...data.sonnetOnly,
        daysUntilReset: ctx.claudeMaxTracker.getDaysUntilReset("sonnet"),
        formattedResetDate: ctx.claudeMaxTracker.formatResetDate("sonnet"),
      },
      subscription: data.subscription,
      localStats: data.localStats,
      lastSynced: data.lastSynced,
      syncSource: data.syncSource,
      recommendation,
      shouldDowngrade: ctx.claudeMaxTracker.shouldDowngrade(80),
    },
  })
}

/**
 * POST /api/claude-max/usage
 * Update Claude Max usage manually
 */
export async function handleUpdateClaudeMaxUsage(
  req: Request,
  ctx: ClaudeMaxRouteContext
): Promise<Response> {
  if (!ctx.claudeMaxTracker) {
    return Response.json({
      success: false,
      error: "Claude Max tracking not available",
    }, { status: 503 })
  }

  try {
    const body = await req.json() as {
      allModelsPercent?: number
      sonnetPercent?: number
      allModelsResetDate?: string
      sonnetResetDate?: string
      tier?: "free" | "pro" | "max" | "team" | "enterprise"
      usageText?: string
    }

    // If raw usage text is provided, try to parse it
    if (body.usageText) {
      const parsed = ctx.claudeMaxTracker.parseUsageText(body.usageText)
      if (!parsed) {
        return Response.json({
          success: false,
          error: "Could not parse usage text",
        }, { status: 400 })
      }
    } else {
      // Direct update
      ctx.claudeMaxTracker.updateUsage({
        allModelsPercent: body.allModelsPercent,
        sonnetPercent: body.sonnetPercent,
        allModelsResetDate: body.allModelsResetDate,
        sonnetResetDate: body.sonnetResetDate,
        tier: body.tier,
      })
    }

    return Response.json({
      success: true,
      data: ctx.claudeMaxTracker.getData(),
    })
  } catch (err) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 400 })
  }
}

/**
 * POST /api/claude-max/sync
 * Sync from Claude stats cache
 */
export function handleSyncClaudeMax(ctx: ClaudeMaxRouteContext): Response {
  if (!ctx.claudeMaxTracker) {
    return Response.json({
      success: false,
      error: "Claude Max tracking not available",
    }, { status: 503 })
  }

  ctx.claudeMaxTracker.syncFromStats()

  return Response.json({
    success: true,
    data: ctx.claudeMaxTracker.getLocalStats(),
  })
}
