/**
 * Anomaly API Routes
 * View detected spending anomalies
 */

import type { BudgetOrchestrator } from "../../features/budget-orchestrator"
import type { AnomalyRecord } from "../../features/budget-orchestrator/anomaly-detector"

export interface AnomalyRouteContext {
  budgetOrchestrator: BudgetOrchestrator | null
}

/**
 * GET /api/anomalies
 * Get detected spending anomalies with optional filters
 */
export function handleGetAnomalies(request: Request, ctx: AnomalyRouteContext): Response {
  if (!ctx.budgetOrchestrator) {
    return Response.json(
      { success: false, error: "Budget orchestration not enabled" },
      { status: 503 }
    )
  }

  const url = new URL(request.url)
  const provider = url.searchParams.get("provider")
  const type = url.searchParams.get("type")
  const since = url.searchParams.get("since")
  const limit = parseInt(url.searchParams.get("limit") || "100")

  // Get anomalies from all adaptive managers
  let allAnomalies: (AnomalyRecord & { provider: string })[] = []
  
  const providers = provider ? [provider] : ctx.budgetOrchestrator.getConfiguredProviders()
  
  for (const p of providers) {
    const anomalies = ctx.budgetOrchestrator.getAnomalies(p)
    allAnomalies.push(...anomalies.map(a => ({ ...a, provider: p })))
  }

  // Filter by type
  if (type) {
    allAnomalies = allAnomalies.filter(a => a.type === type)
  }

  // Filter by since (timestamp)
  if (since) {
    const sinceDate = new Date(parseInt(since))
    if (!isNaN(sinceDate.getTime())) {
      allAnomalies = allAnomalies.filter(a => new Date(a.timestamp).getTime() >= sinceDate.getTime())
    }
  }

  // Sort by timestamp descending
  allAnomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Apply limit
  const limitedAnomalies = allAnomalies.slice(0, limit)

  // Calculate stats
  const stats = {
    total: allAnomalies.length,
    byType: allAnomalies.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  return Response.json({
    success: true,
    data: {
      anomalies: limitedAnomalies,
      stats
    }
  })
}
