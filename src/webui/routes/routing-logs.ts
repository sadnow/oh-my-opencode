/**
 * Routing Logs API Routes
 * View model routing decisions and tier changes
 */

import { getRoutingLogger } from "../../features/budget-orchestrator/routing-logger"

/**
 * GET /api/routing-logs
 * Get routing logs with optional filters
 */
export function handleGetRoutingLogs(request: Request): Response {
  const logger = getRoutingLogger()
  const url = new URL(request.url)

  const limit = parseInt(url.searchParams.get("limit") || "100")
  const level = url.searchParams.get("level") as any
  const category = url.searchParams.get("category") as any

  const logs = logger.getLogs(limit, level, category)

  return Response.json({
    success: true,
    data: {
      logs,
      total: logs.length,
    },
  })
}

/**
 * GET /api/routing-logs/stats
 * Get routing log statistics
 */
export function handleGetRoutingLogStats(): Response {
  const logger = getRoutingLogger()
  const stats = logger.getStats()

  return Response.json({
    success: true,
    data: stats,
  })
}

/**
 * POST /api/routing-logs/clear
 * Clear all routing logs
 */
export function handleClearRoutingLogs(): Response {
  const logger = getRoutingLogger()
  logger.clearLogs()

  return Response.json({
    success: true,
    message: "Routing logs cleared",
  })
}

/**
 * GET /api/routing-logs/since/:timestamp
 * Get logs since a certain timestamp
 */
export function handleGetRoutingLogsSince(timestamp: string): Response {
  const logger = getRoutingLogger()
  const since = new Date(parseInt(timestamp))

  if (isNaN(since.getTime())) {
    return Response.json(
      { success: false, error: "Invalid timestamp" },
      { status: 400 }
    )
  }

  const logs = logger.getLogsSince(since)

  return Response.json({
    success: true,
    data: {
      logs,
      since: since.toISOString(),
    },
  })
}
