/**
 * Copilot Usage Routes
 * API endpoints for GitHub Copilot usage tracking
 */

import type { CopilotUsageTracker } from "../../features/copilot-usage"

// ============================================================================
// Types
// ============================================================================

export interface CopilotRouteContext {
  copilotTracker: CopilotUsageTracker | null
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/copilot/usage
 * Get current Copilot usage (from cache or fresh fetch)
 */
export async function handleGetCopilotUsage(ctx: CopilotRouteContext): Promise<Response> {
  if (!ctx.copilotTracker) {
    return Response.json({
      success: false,
      error: "Copilot usage tracking not available",
    }, { status: 503 })
  }

  try {
    // Use cached data for instant response (live refresh handles background updates)
    const data = ctx.copilotTracker.getData()
    const recommendation = ctx.copilotTracker.getRecommendation()
    const shouldReduceUsage = ctx.copilotTracker.shouldReduceUsage()

    // Format reset date for display
    const formatDate = (isoDate: string) => {
      try {
        const date = new Date(isoDate)
        return date.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
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
          resetDate: formatDate(data.resetDate),
        },
        recommendation,
        shouldReduceUsage,
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
 * POST /api/copilot/refresh
 * Force refresh usage data via browser automation
 */
export async function handleRefreshCopilot(ctx: CopilotRouteContext): Promise<Response> {
  if (!ctx.copilotTracker) {
    return Response.json({
      success: false,
      error: "Copilot usage tracking not available",
    }, { status: 503 })
  }

  try {
    const data = await ctx.copilotTracker.refreshAsync()

    if (data.error) {
      return Response.json({
        success: true,
        message: "Refresh attempted but encountered error",
        data: {
          error: data.error,
          percentUsed: data.percentUsed,
          fetchMethod: data.fetchMethod,
        },
      })
    }

    return Response.json({
      success: true,
      message: "Usage data refreshed from GitHub",
      data: {
        percentUsed: data.percentUsed,
        fetchMethod: data.fetchMethod,
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
 * GET /api/copilot/history
 * Get 24-hour usage history for charting
 */
export function handleGetCopilotHistory(ctx: CopilotRouteContext): Response {
  if (!ctx.copilotTracker) {
    return Response.json({
      success: false,
      error: "Copilot usage tracking not available",
    }, { status: 503 })
  }

  try {
    const history = ctx.copilotTracker.getHistory()

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

