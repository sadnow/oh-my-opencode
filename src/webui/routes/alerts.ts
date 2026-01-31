/**
 * Alerts API Routes
 * Specifically for budget alerts and notifications
 */

import { getRoutingLogger } from "../../features/budget-orchestrator/routing-logger"

/**
 * GET /api/alerts
 * Get budget alerts with optional filters
 */
export function handleGetAlerts(request: Request): Response {
  const logger = getRoutingLogger()
  const url = new URL(request.url)

  const limit = parseInt(url.searchParams.get("limit") || "50")
  const level = url.searchParams.get("level") as any
  const category = (url.searchParams.get("category") || "budget_alert") as any
  
  const alerts = logger.getLogs(limit, level, category)
  const stats = logger.getStats()

  return Response.json({
    success: true,
    data: {
      alerts,
      stats,
    },
  })
}
