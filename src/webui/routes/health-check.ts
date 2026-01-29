/**
 * Health Check API Routes
 * Provides usage tracking health status for the WebUI
 */

import type { UsageTracker } from "../../features/usage-tracker"
import { checkUsageTracking } from "../../features/usage-tracker/health-check"
import { getDefaultStoragePath } from "../../features/usage-tracker/storage"

export interface HealthCheckRouteContext {
  usageTracker: UsageTracker | null
}

/**
 * GET /api/health-check
 * Returns health status of usage tracking system
 */
export async function handleGetHealthCheck(ctx: HealthCheckRouteContext): Promise<Response> {
  const { usageTracker } = ctx

  if (!usageTracker) {
    return Response.json({
      success: false,
      error: "Usage tracker not available",
    }, { status: 503 })
  }

  try {
    const storagePath = getDefaultStoragePath()
    const health = await checkUsageTracking(storagePath)

    return Response.json({
      success: true,
      data: health,
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}