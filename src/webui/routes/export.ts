/**
 * Export API Routes
 * REST endpoints for exporting usage, config, and presets
 */

import type { UsageTracker } from "../../features/usage-tracker"
import type { HotConfigManager } from "../../features/hot-config"
import { getAllPresets } from "../../cli/wizard/presets"
import { toCSV } from "../utils/csv"

export interface ExportRouteContext {
  usageTracker: UsageTracker | null
  configManager: HotConfigManager
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
