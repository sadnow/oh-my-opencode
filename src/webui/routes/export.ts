/**
 * Export API Routes
 * REST endpoints for exporting usage, config, and presets
 */

import type { UsageTracker } from "../../features/usage-tracker"
import type { HotConfigManager } from "../../features/hot-config"
import type { RoutingLogger } from "../../features/budget-orchestrator/routing-logger"
import { getAllPresets } from "../../cli/wizard/presets"
import { toCSV } from "../utils/csv"

export interface ExportRouteContext {
  usageTracker: UsageTracker | null
  configManager: HotConfigManager
  routingLogger: RoutingLogger
}

/**
 * GET /api/export/usage
 * Export usage records as CSV or JSON
 */
export function handleExportUsage(request: Request, ctx: ExportRouteContext): Response {
  if (!ctx.usageTracker) {
    return Response.json(
      { success: false, error: "Usage tracking not enabled" },
      { status: 503 }
    )
  }

  const url = new URL(request.url)
  const format = url.searchParams.get("format") || "json"
  const records = ctx.usageTracker.getAllRecords()

  if (format === "csv") {
    const csv = toCSV(records)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="usage-export.csv"',
      },
    })
  }

  return Response.json({
    success: true,
    data: records,
  })
}

/**
 * GET /api/export/config
 * Export current configuration as JSON
 */
export function handleExportConfig(ctx: ExportRouteContext): Response {
  const config = ctx.configManager.getConfig()

  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="config-export.json"',
    },
  })
}

/**
 * GET /api/export/presets
 * Export preset comparison as CSV or JSON
 */
export function handleExportPresets(request: Request): Response {
  const url = new URL(request.url)
  const format = url.searchParams.get("format") || "json"
  const presets = getAllPresets()

  const exportData = presets.map((p) => ({
    name: p.name,
    description: p.description,
    requiredProviders: p.requiredProviders.join(", "),
  }))

  if (format === "csv") {
    const csv = toCSV(exportData)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="presets-export.csv"',
      },
    })
  }

  return Response.json({
    success: true,
    data: exportData,
  })
}

/**
 * GET /api/export/routing-logs
 * Export routing logs as CSV or JSON
 */
export async function handleExportRoutingLogs(
  req: Request,
  ctx: ExportRouteContext
): Promise<Response> {
  const url = new URL(req.url)
  const format = url.searchParams.get("format") || "json"
  const since = url.searchParams.get("since") // ISO timestamp
  const until = url.searchParams.get("until") // ISO timestamp

  // Get logs from routing logger
  const logs = ctx.routingLogger.getLogs()

  // Filter by date range if provided
  const filtered = logs.filter((log) => {
    if (since && new Date(log.timestamp) < new Date(since)) return false
    if (until && new Date(log.timestamp) > new Date(until)) return false
    return true
  })

  if (format === "csv") {
    const csv = toCSV(
      filtered.map((log) => ({
        timestamp: log.timestamp,
        level: log.level,
        category: log.category,
        message: log.message,
        model: log.metadata?.model || "",
        reason: log.metadata?.reason || "",
      }))
    )
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="routing-logs-${Date.now()}.csv"`,
      },
    })
  }

  return Response.json(filtered)
}
