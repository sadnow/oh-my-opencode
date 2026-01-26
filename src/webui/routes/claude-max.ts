/**
 * Claude Max Usage Routes
 * API endpoints for Claude Max subscription usage tracking (auto-detected)
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
 * Get current Claude Max subscription usage (auto-calculated from stats)
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
  const shouldDowngrade = ctx.claudeMaxTracker.shouldDowngrade()

  // Format reset date for display
  const resetDate = new Date(data.allModels.resetDate)
  const formattedResetDate = resetDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  return Response.json({
    success: true,
    data: {
      ...data,
      formattedResetDate,
      recommendation,
      shouldDowngrade,
      formattedTokens: {
        total: ctx.claudeMaxTracker.formatTokens(data.allModels.tokensUsed),
        limit: ctx.claudeMaxTracker.formatTokens(data.allModels.estimatedLimit),
        opus: ctx.claudeMaxTracker.formatTokens(data.modelBreakdown.opus.tokens),
        sonnet: ctx.claudeMaxTracker.formatTokens(data.modelBreakdown.sonnet.tokens),
        haiku: ctx.claudeMaxTracker.formatTokens(data.modelBreakdown.haiku.tokens),
      },
    },
  })
}

/**
 * POST /api/claude-max/refresh
 * Force refresh usage data from stats cache
 */
export function handleRefreshClaudeMax(ctx: ClaudeMaxRouteContext): Response {
  if (!ctx.claudeMaxTracker) {
    return Response.json({
      success: false,
      error: "Claude Max tracking not available",
    }, { status: 503 })
  }

  ctx.claudeMaxTracker.refresh()

  return Response.json({
    success: true,
    message: "Usage data refreshed from stats",
  })
}
