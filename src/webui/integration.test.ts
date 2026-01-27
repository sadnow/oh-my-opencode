/**
 * WebUI Integration Tests
 *
 * Tests the complete WebUI server with all routes and features.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { startWebUI } from "./index"
import { UsageTracker } from "../features/usage-tracker"
import { BudgetOrchestrator } from "../features/budget-orchestrator"
import { initHotConfigManager } from "../features/hot-config"
import { loadPluginConfig } from "../plugin-config"

describe("WebUI Integration", () => {
  let server: any
  let baseURL: string

  beforeAll(async () => {
    const config = loadPluginConfig(process.cwd(), null)
    const usageTracker = new UsageTracker({
      enabled: true,
      persist: false,
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
      },
      usageTracker,
      ["anthropic", "openai"]
    )

    const hotConfigManager = initHotConfigManager({
      directory: process.cwd(),
      initialConfig: config,
      watchFiles: false,
    })

    const port = 3848 // Use different port for testing
    baseURL = `http://localhost:${port}`

    server = startWebUI({
      port,
      bind: "localhost",
      configManager: hotConfigManager,
      usageTracker,
      budgetOrchestrator,
    })

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 500))
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
      const data = await response.json()
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("categories")
    })

    it("should return efficiency metrics", async () => {
      const response = await fetch(`${baseURL}/api/stats/efficiency`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("byTier")
    })

    it("should return provider trends", async () => {
      const response = await fetch(`${baseURL}/api/stats/trends/anthropic?range=7d`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("dataPoints")
      expect(data.data).toHaveProperty("totalCost")
      expect(data.data).toHaveProperty("avgDailyCost")
    })

    it("should return session statistics", async () => {
      const response = await fetch(`${baseURL}/api/stats/sessions`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("totalSessions")
    })
  })

  describe("Adaptive Settings API", () => {
    it("should return current adaptive settings", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/settings`)
      expect(response.status).toBe(200)
      const data = await response.json()
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
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it("should set learning mode", async () => {
      const response = await fetch(`${baseURL}/api/adaptive/learning-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "balanced" }),
      })
      expect(response.status).toBe(200)
      const data = await response.json()
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
      const data = await response.json()
      expect(data).toHaveProperty("success")
      expect(data.data).toHaveProperty("config")
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
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data).toHaveProperty("error")
    })
  })
})
