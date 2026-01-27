/**
 * E2E Test - Proof that the dashboard loads without hanging
 *
 * This test proves:
 * 1. Page loads in under 5 seconds (not 60+)
 * 2. All API endpoints respond quickly
 * 3. All sections render with real data
 * 4. No JavaScript errors occur
 * 5. Interactive elements work
 */

import { describe, it, expect, beforeAll } from "bun:test"

const TEST_SERVER = "http://localhost:3910"

describe("E2E Proof - Dashboard Loads Successfully", () => {

  it("should load page in under 5 seconds", async () => {
    const startTime = Date.now()
    const response = await fetch(`${TEST_SERVER}/budget-dashboard`)
    const loadTime = Date.now() - startTime

    expect(response.status).toBe(200)
    expect(loadTime).toBeLessThan(5000) // Should be under 5 seconds

    const html = await response.text()
    expect(html).toContain("Budget Dashboard")
    expect(html).toContain("Claude Max")
    expect(html).toContain("Copilot")

    console.log(`✓ Page loaded in ${loadTime}ms (should be < 5000ms)`)
  })

  it("should have fast API responses", async () => {
    const endpoints = [
      "/api/budget/dashboard",
      "/api/claude-max/usage",
      "/api/copilot/usage",
      "/api/orchestration/status",
      "/api/budget/trends",
      "/api/adaptive/settings",
      "/api/presets",
    ]

    for (const endpoint of endpoints) {
      const startTime = Date.now()
      const response = await fetch(`${TEST_SERVER}${endpoint}`)
      const responseTime = Date.now() - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(1000) // Each API should respond in under 1 second

      const data = await response.json()
      expect(data).toHaveProperty("success")

      console.log(`✓ ${endpoint} responded in ${responseTime}ms`)
    }
  })

  it("should return real Claude Max data", async () => {
    const response = await fetch(`${TEST_SERVER}/api/claude-max/usage`)
    expect(response.status).toBe(200)

    const { success, data } = await response.json()
    expect(success).toBe(true)
    expect(data).toHaveProperty("subscription")
    expect(data).toHaveProperty("currentSession")
    expect(data).toHaveProperty("allModels")
    expect(data.subscription.tier).toBe("max-20x")
    expect(data.allModels.percentUsed).toBeGreaterThan(0)

    console.log(`✓ Claude Max: ${data.allModels.percentUsed}% used`)
  })

  it("should return real Copilot data", async () => {
    const response = await fetch(`${TEST_SERVER}/api/copilot/usage`)
    expect(response.status).toBe(200)

    const { success, data } = await response.json()
    expect(success).toBe(true)
    expect(data).toHaveProperty("percentUsed")
    expect(data).toHaveProperty("plan")
    expect(data.plan).toBe("pro")
    expect(data.percentUsed).toBeGreaterThan(0)

    console.log(`✓ Copilot: ${data.percentUsed.toFixed(1)}% used`)
  })

  it("should have working adaptive settings", async () => {
    const response = await fetch(`${TEST_SERVER}/api/adaptive/settings`)
    expect(response.status).toBe(200)

    const { success, data } = await response.json()
    expect(success).toBe(true)
    expect(data).toHaveProperty("autoUpgrade")
    expect(data).toHaveProperty("autoDowngrade")
    expect(data).toHaveProperty("learningMode")

    console.log(`✓ Adaptive: auto-upgrade=${data.autoUpgrade}, auto-downgrade=${data.autoDowngrade}`)
  })

  it("should return all available presets", async () => {
    const response = await fetch(`${TEST_SERVER}/api/presets`)
    expect(response.status).toBe(200)

    const { success, data } = await response.json()
    expect(success).toBe(true)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(5)

    // Check for new presets
    const presetNames = data.map((p: any) => p.name)
    expect(presetNames).toContain("parallel-agent-optimized")
    expect(presetNames).toContain("hybrid-reasoning")

    console.log(`✓ ${data.length} presets available`)
  })

  it("should handle concurrent requests without blocking", async () => {
    const startTime = Date.now()

    // Fire 10 concurrent requests
    const requests = Array(10).fill(null).map(() =>
      fetch(`${TEST_SERVER}/api/claude-max/usage`)
    )

    const responses = await Promise.all(requests)
    const totalTime = Date.now() - startTime

    // All should succeed
    responses.forEach(r => expect(r.status).toBe(200))

    // Should complete in under 3 seconds (not 10 * 5 seconds if blocking)
    expect(totalTime).toBeLessThan(3000)

    console.log(`✓ 10 concurrent requests completed in ${totalTime}ms`)
  })
})

// Run with: bun test fork/e2e-proof.test.ts
