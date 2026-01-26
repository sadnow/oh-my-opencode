/**
 * Claude Max Usage Routes
 * API endpoints for Claude Max subscription usage (real-time from Anthropic API)
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
 * Get current Claude Max subscription usage (real-time from Anthropic API)
 */
export async function handleGetClaudeMaxUsage(ctx: ClaudeMaxRouteContext): Promise<Response> {
  if (!ctx.claudeMaxTracker) {
    return Response.json({
      success: false,
      error: "Claude Max tracking not available",
    }, { status: 503 })
  }

  try {
    // Use async method for fresh data
    const data = await ctx.claudeMaxTracker.getDataAsync()
    const recommendation = ctx.claudeMaxTracker.getRecommendation()
    const shouldDowngrade = ctx.claudeMaxTracker.shouldDowngrade()

    // Format reset dates for display
    const formatDate = (isoDate: string) => {
      try {
        const date = new Date(isoDate)
        return date.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      } catch {
        return isoDate
      }
    }

    return Response.json({
      success: true,
      data: {
        ...data,
        formatted: {
          currentSessionReset: formatDate(data.currentSession.resetDate),
          allModelsReset: formatDate(data.allModels.resetDate),
          sonnetOnlyReset: formatDate(data.sonnetOnly.resetDate),
          opusOnlyReset: data.opusOnly ? formatDate(data.opusOnly.resetDate) : null,
        },
        recommendation,
        shouldDowngrade,
      },
    })
  } catch (err) {
    return Response.json({
      success: false,
      error: String(err),
    }, { status: 500 })
  }
}

/**
 * POST /api/claude-max/refresh
 * Force refresh usage data from Anthropic API
 */
export async function handleRefreshClaudeMax(ctx: ClaudeMaxRouteContext): Promise<Response> {
  if (!ctx.claudeMaxTracker) {
    return Response.json({
      success: false,
      error: "Claude Max tracking not available",
    }, { status: 503 })
  }

  try {
    await ctx.claudeMaxTracker.refreshAsync()
    // Also record a history point
    await ctx.claudeMaxTracker.recordNow()
    return Response.json({
      success: true,
      message: "Usage data refreshed from Anthropic API",
    })
  } catch (err) {
    return Response.json({
      success: false,
      error: String(err),
    }, { status: 500 })
  }
}

/**
 * GET /api/claude-max/history
 * Get 24-hour usage history for charting
 */
export function handleGetClaudeMaxHistory(ctx: ClaudeMaxRouteContext): Response {
  if (!ctx.claudeMaxTracker) {
    return Response.json({
      success: false,
      error: "Claude Max tracking not available",
    }, { status: 503 })
  }

  try {
    const history = ctx.claudeMaxTracker.getHistory()

    // Format timestamps for display
    const formattedPoints = history.points.map(point => {
      const date = new Date(point.timestamp)
      return {
        ...point,
        formattedTime: date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        formattedDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      }
    })

    return Response.json({
      success: true,
      data: {
        points: formattedPoints,
        lastUpdated: history.lastUpdated,
        pointCount: history.points.length,
      },
    })
  } catch (err) {
    return Response.json({
      success: false,
      error: String(err),
    }, { status: 500 })
  }
}
