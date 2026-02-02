/**
 * WebUI Integration Tests
 *
 * Tests the complete WebUI server with all routes and features.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { startWebUI } from "./index"
import { createServer } from "node:net"
import { UsageTracker } from "../features/usage-tracker"
import { BudgetOrchestrator } from "../features/budget-orchestrator"
import { initHotConfigManager } from "../features/hot-config"
import { loadPluginConfig } from "../plugin-config"

/** Type for API responses in tests */
interface ApiResponse {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const tempServer = createServer()
    tempServer.unref()
    tempServer.on("error", reject)
    tempServer.listen(0, "127.0.0.1", () => {
      const address = tempServer.address()
      if (!address || typeof address === "string") {
        tempServer.close(() => {
          reject(new Error("Failed to acquire an available port"))
        })
        return
      }
      tempServer.close((err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(address.port)
      })
    })
  })
}

async function waitForServerReady(url: string, attempts = 10, delayMs = 250): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url).catch(() => null)
    if (response?.ok) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  return false
}

describe("WebUI Integration", () => {
  let server: any
  let baseURL: string
  beforeAll(async () => {
    const config = loadPluginConfig(process.cwd(), null)
    const usageTracker = new UsageTracker({
      enabled: true,
      persist: false,
    })
    usageTracker.recordUsage({
      provider: "anthropic",
      model: "claude-3-opus",
      inputTokens: 100,
      outputTokens: 50,
      taskType: "primary",
    })

    const budgetOrchestrator = new BudgetOrchestrator(
      {
        enabled: true,
        provider_budgets: {
          anthropic: 20,
          openai: 50,
        },
        target_percentage: 0.7,
        auto_downgrade: true,
        auto_upgrade: true,
        min_tier: "budget",
        routing_log_persist: false,
      },
      usageTracker,
      ["anthropic", "openai"],
      undefined // No subscription trackers in test
    )

    const hotConfigManager = initHotConfigManager({
      directory: process.cwd(),
      initialConfig: config,
      watchFiles: false,
    })

    const maxAttempts = 5
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const port = await getAvailablePort()
        baseURL = `http://127.0.0.1:${port}`
        server = startWebUI({
          port,
          bind: "0.0.0.0",
          configManager: hotConfigManager,
          usageTracker,
          budgetOrchestrator,
        })

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000))

        const ready = await waitForServerReady(`${baseURL}/api/config`)
        if (ready) {
          return
        }

        server?.stop()
        if (attempt === maxAttempts) {
          throw new Error(`WebUI server failed to respond at ${baseURL}`)
        }
      } catch (err) {
        server?.stop()
        const errorCode = typeof err === "object" && err !== null && "code" in err ? (err as { code?: string }).code : undefined
        const errorMessage = err instanceof Error ? err.message : String(err)
        const isAddressInUse = errorCode === "EADDRINUSE" || errorMessage.includes("EADDRINUSE")
        if (isAddressInUse && attempt < maxAttempts) {
          continue
        }
        throw err
      }
    }
  })

  afterAll(() => {
    server?.stop()
  })

  describe("Stats API", () => {
    it("should return weekly summary", async () => {
      const response = await fetch(`${baseURL}/api/stats/summary?period=weekly`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty("success")
      expect(data).toHaveProperty("data")
    })

    it("should return monthly summary", async () => {
      const response = await fetch(`${baseURL}/api/stats/summary?period=monthly`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty("success")
    })

    it("should return category breakdown", async () => {
      const response = await fetch(`${baseURL}/api/stats/by-category`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("categories")
    })

    it("should return efficiency metrics", async () => {
      const response = await fetch(`${baseURL}/api/stats/efficiency`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("byTier")
    })

    it("should return provider trends", async () => {
      const response = await fetch(`${baseURL}/api/stats/trends/anthropic?range=7d`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("dataPoints")
      expect(data.data).toHaveProperty("totalCost")
      expect(data.data).toHaveProperty("avgDailyCost")
    })

    it("should return session statistics", async () => {
      const response = await fetch(`${baseURL}/api/stats/sessions`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("totalSessions")
    })
  })

  describe("Adaptive Settings API", () => {
    it("should return current adaptive settings", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/settings`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("autoUpgrade")
      expect(data.data).toHaveProperty("autoDowngrade")
    })

    it("should update adaptive settings", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoUpgrade: false,
          autoDowngrade: true,
        }),
      })
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
    })

    it("should set learning mode", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/learning-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "balanced" }),
      })
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
    })

    it("should reject invalid learning mode", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/learning-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "invalid" }),
      })
      expect(response.status).toBe(400)
    })

    it("should update quota targets", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotaTargets: {
            claude_max_weekly_percent: 75,
            copilot_monthly_percent: 80,
          },
        }),
      })
      expect(response.status).toBe(200)
    })
  })

  describe("Budget Dashboard", () => {
    it("should return dashboard HTML", async () => {
      const response = await fetch(`${baseURL}/budget-dashboard`)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      const html = await response.text()
      expect(html).toContain("Budget Dashboard")
      expect(html).toContain("Tier Management")
      expect(html).toContain("Analytics")
    })
  })

  describe("Wizard API", () => {
    it("should handle wizard submission", async () => {
      const response = await fetch(`${baseURL}/api/wizard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: {
            hasAnthropicOAuth: true,
            preset: "parallel-agent-optimized",
            learningMode: "balanced",
            autoUpgrade: true,
            autoDowngrade: true,
            claudeMaxWeeklyTarget: 70,
            copilotMonthlyTarget: 80,
          },
        }),
      })
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("config")
    })

    it("should return available presets", async () => {
      const response = await fetch(`${baseURL}/api/presets`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
      expect((data.data as unknown as any[]).length).toBeGreaterThan(0)
    })

    it("should return learning modes", async () => {
      const response = await fetch(`${baseURL}/api/learning-modes`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty("modes")
    })
  })

  describe("Export API", () => {
    it("should export usage as JSON", async () => {
      const response = await fetch(`${baseURL}/api/export/usage?format=json`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data as any)).toBe(true)
    })

    it("should export usage as CSV", async () => {
      const response = await fetch(`${baseURL}/api/export/usage?format=csv`)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("text/csv")
      const text = await response.text()
      expect(text).toContain("timestamp")
    })

    it("should export config as JSON", async () => {
      const response = await fetch(`${baseURL}/api/export/config`)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("application/json")
      const data = await response.json()
      expect(data).not.toBeNull()
      expect(typeof data).toBe("object")
    })

    it("should export presets as CSV", async () => {
      const response = await fetch(`${baseURL}/api/export/presets?format=csv`)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("text/csv")
      const text = await response.text()
      expect(text).toContain("name,description")
    })

    it("should export routing logs as JSON", async () => {
      const response = await fetch(`${baseURL}/api/export/routing-logs?format=json`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe("Routing Logs API", () => {
    it("should return routing logs", async () => {
      const response = await fetch(`${baseURL}/api/routing-logs`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty("logs")
    })

    it("should return routing log stats", async () => {
      const response = await fetch(`${baseURL}/api/routing-logs/stats`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
    })
  })

  describe("Health Check API", () => {
    it("should return health status", async () => {
      const response = await fetch(`${baseURL}/api/health-check`)
      expect(response.status).toBe(200)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty("healthy")
    })
  })

  describe("Error Handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await fetch(`${baseURL}/api/unknown-route`)
      expect(response.status).toBe(404)
    })

    it("should handle malformed JSON", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      })
      // JSON parse errors return 500 (could be improved to 400)
      expect(response.status).toBe(500)
      const data = await response.json() as ApiResponse
      expect(data.success).toBe(false)
      expect(data).toHaveProperty("error")
    })
  })
})
