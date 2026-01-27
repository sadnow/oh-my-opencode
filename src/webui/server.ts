/**
 * WebUI Server
 * HTTP server using Bun.serve for configuration management
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BunServer = any
import { log } from "../shared"
import type { HotConfigManager } from "../features/hot-config"
import type { UsageTracker } from "../features/usage-tracker"
import type { BudgetOrchestrator } from "../features/budget-orchestrator"

import {
  handleGetConfig,
  handleUpdateConfig,
  handleReloadConfig,
  handleSaveConfig,
  handleGetPendingChanges,
  handleApplyPending,
  handleCancelChange,
  type ConfigRouteContext,
} from "./routes/config"

import {
  handleGetUsage,
  handleGetProviderUsage,
  handleGetBudget,
  handleGetProviderBudget,
  handleClearUsage,
  handleClearProviderUsage,
  type UsageRouteContext,
} from "./routes/usage"

import {
  handleGetPresets,
  handleGetPreset,
  handleApplyPreset,
  handleWizard,
  handleGetFeatures,
  handleToggleFeature,
  type WizardRouteContext,
} from "./routes/wizard"

import {
  handleGetTiers,
  handleGetModelTier,
  handleCheckDowngrade,
  handleGetRecommendations,
  handleGetStatus,
  type OrchestrationRouteContext,
} from "./routes/orchestration"

import {
  handleGetDashboard,
  handleGetTrends,
  handleSetOverride,
  type BudgetDashboardContext,
} from "./routes/budget-dashboard"

import {
  handleGetClaudeMaxUsage,
  handleRefreshClaudeMax,
  handleGetClaudeMaxHistory,
  type ClaudeMaxRouteContext,
} from "./routes/claude-max"

import {
  handleGetCopilotUsage,
  handleRefreshCopilot,
  handleGetCopilotHistory,
  type CopilotRouteContext,
} from "./routes/copilot"

import {
  handleGetStatsSummary,
  handleGetStatsByCategory,
  handleGetStatsEfficiency,
  handleGetStatsTrends,
  handleGetStatsSessions,
  handleGetStatsAllProviders,
  type StatsRouteContext,
} from "./routes/stats"

import {
  handleGetAdaptiveSettings,
  handleUpdateAdaptiveSettings,
  handleSetLearningMode,
  handleSetAutoUpgrade,
  handleSetAutoDowngrade,
  handleSetQuotaTargets,
  handleResetLearning,
  handleGetConfigLabels,
  type AdaptiveSettingsRouteContext,
} from "./routes/adaptive-settings"

import {
  handleGetRoutingLogs,
  handleGetRoutingLogStats,
  handleClearRoutingLogs,
  handleGetRoutingLogsSince,
} from "./routes/routing-logs"

import {
  handleGetGlobalOverride,
  handleGetFallbacks,
  handleGetBestModel,
  handleDisableProvider,
  handleEnableProvider,
  handleSetMaxTier,
  handleSetEmergencyMode,
  handleSetAutoDisableQuota,
  handleClearGlobalOverrides,
  type GlobalOverrideRouteContext,
} from "./routes/global-override"

import { handleGetLearningModes } from "./routes/wizard"

import type { ClaudeMaxUsageTracker } from "../features/claude-max-usage"
import type { CopilotUsageTracker } from "../features/copilot-usage"

import { INDEX_HTML, APP_JS, STYLES_CSS, BUDGET_DASHBOARD_HTML, BUDGET_DASHBOARD_JS } from "./static-files"

export interface WebUIOptions {
  port: number
  bind: "localhost" | "0.0.0.0"
  configManager: HotConfigManager
  usageTracker: UsageTracker | null
  budgetOrchestrator: BudgetOrchestrator | null
  claudeMaxTracker?: ClaudeMaxUsageTracker | null
  copilotTracker?: CopilotUsageTracker | null
}

/**
 * Start the WebUI server.
 */
export function startWebUI(options: WebUIOptions): BunServer {
  const { port, bind, configManager, usageTracker, budgetOrchestrator, claudeMaxTracker, copilotTracker } = options

  const configCtx: ConfigRouteContext = { configManager }
  const usageCtx: UsageRouteContext = { usageTracker, budgetOrchestrator }
  const wizardCtx: WizardRouteContext = { configManager }
  const orchCtx: OrchestrationRouteContext = { budgetOrchestrator }
  const budgetDashCtx: BudgetDashboardContext = { budgetOrchestrator, usageTracker }
  const claudeMaxCtx: ClaudeMaxRouteContext = { claudeMaxTracker: claudeMaxTracker ?? null }
  const copilotCtx: CopilotRouteContext = { copilotTracker: copilotTracker ?? null }
  const statsCtx: StatsRouteContext = { usageTracker, budgetOrchestrator }
  const adaptiveCtx: AdaptiveSettingsRouteContext = { budgetOrchestrator }
  const globalOverrideCtx: GlobalOverrideRouteContext = { budgetOrchestrator }

  const server = Bun.serve({
    port,
    hostname: bind,
    async fetch(req) {
      const url = new URL(req.url)
      const method = req.method
      const pathname = url.pathname

      // CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }

      // Handle CORS preflight
      if (method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders })
      }

      // Wrap response with CORS headers
      const respond = (response: Response): Response => {
        const newHeaders = new Headers(response.headers)
        for (const [key, value] of Object.entries(corsHeaders)) {
          newHeaders.set(key, value)
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        })
      }

      // API routes
      if (pathname.startsWith("/api/")) {
        const apiResponse = await handleAPI(req, url, {
          configCtx,
          usageCtx,
          wizardCtx,
          orchCtx,
          budgetDashCtx,
          claudeMaxCtx,
          copilotCtx,
          statsCtx,
          adaptiveCtx,
          globalOverrideCtx,
        })
        return respond(apiResponse)
      }

      // Static files
      return respond(serveStatic(pathname))
    },
  })

  log("[webui] Server started:", { port, bind, url: `http://${bind}:${port}` })

  return server
}

interface APIContexts {
  configCtx: ConfigRouteContext
  usageCtx: UsageRouteContext
  wizardCtx: WizardRouteContext
  orchCtx: OrchestrationRouteContext
  budgetDashCtx: BudgetDashboardContext
  claudeMaxCtx: ClaudeMaxRouteContext
  copilotCtx: CopilotRouteContext
  statsCtx: StatsRouteContext
  adaptiveCtx: AdaptiveSettingsRouteContext
  globalOverrideCtx: GlobalOverrideRouteContext
}

/**
 * Handle API requests.
 */
async function handleAPI(
  req: Request,
  url: URL,
  ctx: APIContexts
): Promise<Response> {
  const method = req.method
  const pathname = url.pathname.replace(/^\/api/, "")

  // Config routes
  if (pathname === "/config" && method === "GET") {
    return handleGetConfig(ctx.configCtx)
  }
  if (pathname === "/config" && method === "POST") {
    return handleUpdateConfig(req, ctx.configCtx)
  }
  if (pathname === "/config/reload" && method === "POST") {
    return handleReloadConfig(ctx.configCtx)
  }
  if (pathname === "/config/save" && method === "POST") {
    return handleSaveConfig(ctx.configCtx)
  }
  if (pathname === "/config/pending" && method === "GET") {
    return handleGetPendingChanges(ctx.configCtx)
  }
  if (pathname === "/config/apply-pending" && method === "POST") {
    return handleApplyPending(ctx.configCtx)
  }
  if (pathname.startsWith("/config/pending/") && method === "DELETE") {
    const changeId = pathname.replace("/config/pending/", "")
    return handleCancelChange(changeId, ctx.configCtx)
  }

  // Usage routes
  if (pathname === "/usage" && method === "GET") {
    return handleGetUsage(ctx.usageCtx)
  }
  if (pathname === "/usage" && method === "DELETE") {
    return handleClearUsage(ctx.usageCtx)
  }
  if (pathname.startsWith("/usage/") && method === "GET") {
    const provider = pathname.replace("/usage/", "")
    return handleGetProviderUsage(provider, ctx.usageCtx)
  }
  if (pathname.startsWith("/usage/") && method === "DELETE") {
    const provider = pathname.replace("/usage/", "")
    return handleClearProviderUsage(provider, ctx.usageCtx)
  }
  if (pathname === "/budget" && method === "GET") {
    return handleGetBudget(ctx.usageCtx)
  }
  // Budget dashboard routes (before /budget/:provider to avoid conflicts)
  if (pathname === "/budget/dashboard" && method === "GET") {
    return handleGetDashboard(ctx.budgetDashCtx)
  }
  if (pathname === "/budget/trends" && method === "GET") {
    return handleGetTrends(ctx.budgetDashCtx)
  }
  if (pathname === "/budget/override" && method === "POST") {
    return handleSetOverride(req, ctx.budgetDashCtx)
  }
  // Provider-specific budget routes
  if (pathname.startsWith("/budget/") && method === "GET") {
    const provider = pathname.replace("/budget/", "")
    return handleGetProviderBudget(provider, ctx.usageCtx)
  }

  // Wizard routes
  if (pathname === "/presets" && method === "GET") {
    return handleGetPresets()
  }
  if (pathname.startsWith("/preset/") && method === "GET") {
    const name = pathname.replace("/preset/", "")
    return handleGetPreset(name)
  }
  if (pathname.startsWith("/preset/") && method === "POST") {
    const name = pathname.replace("/preset/", "")
    return handleApplyPreset(name, ctx.wizardCtx)
  }
  if (pathname === "/wizard" && method === "POST") {
    return handleWizard(req, ctx.wizardCtx)
  }
  if (pathname === "/features" && method === "GET") {
    return handleGetFeatures(ctx.wizardCtx)
  }
  if (pathname.startsWith("/features/") && method === "POST") {
    const name = pathname.replace("/features/", "")
    return handleToggleFeature(name, req, ctx.wizardCtx)
  }

  // Orchestration routes
  if (pathname === "/orchestration/tiers" && method === "GET") {
    return handleGetTiers()
  }
  if (pathname.startsWith("/orchestration/model/") && pathname.endsWith("/tier") && method === "GET") {
    const model = pathname.replace("/orchestration/model/", "").replace("/tier", "")
    return handleGetModelTier(model)
  }
  if (pathname === "/orchestration/check-downgrade" && method === "POST") {
    return handleCheckDowngrade(req, ctx.orchCtx)
  }
  if (pathname === "/orchestration/recommendations" && method === "GET") {
    return handleGetRecommendations(ctx.orchCtx)
  }
  if (pathname === "/orchestration/status" && method === "GET") {
    return handleGetStatus(ctx.orchCtx)
  }

  // Claude Max routes
  if (pathname === "/claude-max/usage" && method === "GET") {
    return handleGetClaudeMaxUsage(ctx.claudeMaxCtx)
  }
  if (pathname === "/claude-max/history" && method === "GET") {
    return handleGetClaudeMaxHistory(ctx.claudeMaxCtx)
  }
  if (pathname === "/claude-max/refresh" && method === "POST") {
    return handleRefreshClaudeMax(ctx.claudeMaxCtx)
  }

  // Copilot routes
  if (pathname === "/copilot/usage" && method === "GET") {
    return handleGetCopilotUsage(ctx.copilotCtx)
  }
  if (pathname === "/copilot/history" && method === "GET") {
    return handleGetCopilotHistory(ctx.copilotCtx)
  }
  if (pathname === "/copilot/refresh" && method === "POST") {
    return handleRefreshCopilot(ctx.copilotCtx)
  }

  // Stats routes
  if (pathname === "/stats/summary" && method === "GET") {
    const period = url.searchParams.get("period") || "weekly"
    return handleGetStatsSummary(period, ctx.statsCtx)
  }
  if (pathname === "/stats/by-category" && method === "GET") {
    return handleGetStatsByCategory(ctx.statsCtx)
  }
  if (pathname === "/stats/efficiency" && method === "GET") {
    return handleGetStatsEfficiency(ctx.statsCtx)
  }
  if (pathname === "/stats/sessions" && method === "GET") {
    return handleGetStatsSessions(ctx.statsCtx)
  }
  if (pathname === "/stats/all-providers" && method === "GET") {
    const range = url.searchParams.get("range") || "7d"
    return handleGetStatsAllProviders(range, ctx.statsCtx)
  }
  if (pathname.startsWith("/stats/trends/") && method === "GET") {
    const provider = pathname.replace("/stats/trends/", "")
    const range = url.searchParams.get("range") || "7d"
    return handleGetStatsTrends(provider, range, ctx.statsCtx)
  }

  // Adaptive settings routes
  if (pathname === "/adaptive/settings" && method === "GET") {
    return handleGetAdaptiveSettings(ctx.adaptiveCtx)
  }
  if (pathname === "/adaptive/settings" && method === "POST") {
    return handleUpdateAdaptiveSettings(req, ctx.adaptiveCtx)
  }
  if (pathname === "/adaptive/learning-mode" && method === "POST") {
    return handleSetLearningMode(req, ctx.adaptiveCtx)
  }
  if (pathname === "/adaptive/auto-upgrade" && method === "POST") {
    return handleSetAutoUpgrade(req, ctx.adaptiveCtx)
  }
  if (pathname === "/adaptive/auto-downgrade" && method === "POST") {
    return handleSetAutoDowngrade(req, ctx.adaptiveCtx)
  }
  if (pathname === "/adaptive/quota-targets" && method === "POST") {
    return handleSetQuotaTargets(req, ctx.adaptiveCtx)
  }
  if (pathname === "/adaptive/reset-learning" && method === "POST") {
    return handleResetLearning(req, ctx.adaptiveCtx)
  }
  if (pathname === "/adaptive/config-labels" && method === "GET") {
    return handleGetConfigLabels()
  }

  // Learning modes route (from wizard.ts)
  if (pathname === "/learning-modes" && method === "GET") {
    return handleGetLearningModes()
  }

  // Routing logs routes
  if (pathname === "/routing-logs" && method === "GET") {
    return handleGetRoutingLogs(req)
  }
  if (pathname === "/routing-logs/stats" && method === "GET") {
    return handleGetRoutingLogStats()
  }
  if (pathname === "/routing-logs/clear" && method === "POST") {
    return handleClearRoutingLogs()
  }
  if (pathname.startsWith("/routing-logs/since/") && method === "GET") {
    const timestamp = pathname.replace("/routing-logs/since/", "")
    return handleGetRoutingLogsSince(timestamp)
  }

  // Global override routes
  if (pathname === "/global-override" && method === "GET") {
    return handleGetGlobalOverride(ctx.globalOverrideCtx)
  }
  if (pathname === "/global-override/fallbacks" && method === "GET") {
    return handleGetFallbacks()
  }
  if (pathname.startsWith("/global-override/best-model/") && method === "GET") {
    const useCase = pathname.replace("/global-override/best-model/", "")
    const preferredModel = new URL(req.url).searchParams.get("preferred") ?? undefined
    return handleGetBestModel(ctx.globalOverrideCtx, useCase, preferredModel)
  }
  if (pathname === "/global-override/provider/disable" && method === "POST") {
    return handleDisableProvider(req, ctx.globalOverrideCtx)
  }
  if (pathname === "/global-override/provider/enable" && method === "POST") {
    return handleEnableProvider(req, ctx.globalOverrideCtx)
  }
  if (pathname === "/global-override/max-tier" && method === "POST") {
    return handleSetMaxTier(req, ctx.globalOverrideCtx)
  }
  if (pathname === "/global-override/emergency-mode" && method === "POST") {
    return handleSetEmergencyMode(req, ctx.globalOverrideCtx)
  }
  if (pathname === "/global-override/auto-disable-quota" && method === "POST") {
    return handleSetAutoDisableQuota(req, ctx.globalOverrideCtx)
  }
  if (pathname === "/global-override/clear" && method === "POST") {
    return handleClearGlobalOverrides(ctx.globalOverrideCtx)
  }

  // 404
  return Response.json(
    { success: false, error: `Not found: ${method} ${pathname}` },
    { status: 404 }
  )
}

/**
 * Serve static files.
 */
function serveStatic(pathname: string): Response {
  if (pathname === "/" || pathname === "/index.html") {
    return new Response(INDEX_HTML, {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (pathname === "/budget-dashboard" || pathname === "/budget-dashboard.html") {
    return new Response(BUDGET_DASHBOARD_HTML, {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (pathname === "/app.js") {
    return new Response(APP_JS, {
      headers: { "Content-Type": "application/javascript" },
    })
  }

  if (pathname === "/budget-dashboard.js") {
    return new Response(BUDGET_DASHBOARD_JS, {
      headers: { "Content-Type": "application/javascript" },
    })
  }

  if (pathname === "/styles.css") {
    return new Response(STYLES_CSS, {
      headers: { "Content-Type": "text/css" },
    })
  }

  // Default to index.html for SPA routing
  return new Response(INDEX_HTML, {
    headers: { "Content-Type": "text/html" },
  })
}

/**
 * Stop the WebUI server.
 */
export function stopWebUI(server: BunServer): void {
  server.stop()
  log("[webui] Server stopped")
}
