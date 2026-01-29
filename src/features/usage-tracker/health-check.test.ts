import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { checkUsageTracking } from "./health-check"
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("usage-tracker health-check", () => {
  let testFile: string

  beforeEach(() => {
    testFile = join(tmpdir(), `test-health-${Date.now()}.json`)
  })

  afterEach(() => {
    try {
      unlinkSync(testFile)
    } catch {
      // Ignore cleanup errors
    }
  })

  test("Healthy system with valid recent records", async () => {
    // #given: Storage with recent valid records
    const storage = {
      lastUpdated: new Date().toISOString(),
      records: [
        {
          timestamp: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          sessionID: "test-session",
          inputTokens: 100,
          outputTokens: 200,
          cost: 0.005,
          modelName: "gpt-5.2",
          provider: "openai",
        },
        {
          timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          sessionID: "test-session-2",
          inputTokens: 150,
          outputTokens: 300,
          cost: 0.0075,
          modelName: "claude-sonnet-4-5",
          provider: "anthropic",
        },
      ],
    }
    writeFileSync(testFile, JSON.stringify(storage, null, 2))

    // #when: Run health check
    const health = await checkUsageTracking(testFile)

    // #then: System is healthy
    expect(health.healthy).toBe(true)
    expect(health.warnings.length).toBe(0)
    expect(health.checks.fileExists).toBe(true)
    expect(health.checks.hasRecentRecords).toBe(true)
    expect(health.checks.noZeroOutputTokens).toBe(true)
    expect(health.checks.validCosts).toBe(true)
    expect(health.stats?.recentRecords).toBe(2)
    expect(health.stats?.avgOutputTokens).toBe(250)
  })

  test("REGRESSION DETECTION: Warns when outputTokens=0 exceeds threshold", async () => {
    // #given: Storage with many zero-output records (regression!)
    const records = []
    for (let i = 0; i < 10; i++) {
      records.push({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        sessionID: `session-${i}`,
        inputTokens: 100,
        outputTokens: i < 7 ? 0 : 200, // 70% have zero output
        cost: 0.001,
      })
    }

    const storage = {
      lastUpdated: new Date().toISOString(),
      records,
    }
    writeFileSync(testFile, JSON.stringify(storage, null, 2))

    // #when: Run health check
    const health = await checkUsageTracking(testFile)

    // #then: System detects regression
    expect(health.healthy).toBe(false)
    expect(health.checks.noZeroOutputTokens).toBe(false)
    expect(health.warnings.some((w) => w.includes("CRITICAL"))).toBe(true)
    expect(health.warnings.some((w) => w.includes("outputTokens=0"))).toBe(true)
    expect(health.warnings.some((w) => w.includes("regressed"))).toBe(true)
  })

  test("Detects invalid costs", async () => {
    // #given: Records with tokens but zero cost
    const storage = {
      lastUpdated: new Date().toISOString(),
      records: [
        {
          timestamp: new Date().toISOString(),
          sessionID: "test",
          inputTokens: 100,
          outputTokens: 200,
          cost: 0, // Invalid!
        },
      ],
    }
    writeFileSync(testFile, JSON.stringify(storage, null, 2))

    // #when: Run health check
    const health = await checkUsageTracking(testFile)

    // #then: Detects invalid cost
    expect(health.healthy).toBe(false)
    expect(health.checks.validCosts).toBe(false)
    expect(health.warnings.some((w) => w.includes("zero/negative cost"))).toBe(true)
  })

  test("File not found returns unhealthy", async () => {
    // #when: Check non-existent file
    const health = await checkUsageTracking("/nonexistent/path/storage.json")

    // #then: Unhealthy with warning
    expect(health.healthy).toBe(false)
    expect(health.checks.fileExists).toBe(false)
    expect(health.warnings.some((w) => w.includes("not found"))).toBe(true)
  })

  test("No recent records triggers warning", async () => {
    // #given: Old records only
    const storage = {
      lastUpdated: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      records: [
        {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          sessionID: "old-session",
          inputTokens: 50,
          outputTokens: 100,
          cost: 0.001,
        },
      ],
    }
    writeFileSync(testFile, JSON.stringify(storage, null, 2))

    // #when: Run health check
    const health = await checkUsageTracking(testFile)

    // #then: Warning about no recent records (but still healthy if no regressions)
    expect(health.checks.hasRecentRecords).toBe(false)
    expect(health.warnings.some((w) => w.includes("No recent records"))).toBe(true)
  })

  test("Empty records array is valid but unhealthy state", async () => {
    // #given: Empty but valid storage
    const storage = {
      lastUpdated: new Date().toISOString(),
      records: [],
    }
    writeFileSync(testFile, JSON.stringify(storage, null, 2))

    // #when: Run health check
    const health = await checkUsageTracking(testFile)

    // #then: File exists, checks pass, but no data
    expect(health.checks.fileExists).toBe(true)
    expect(health.stats?.totalRecords).toBe(0)
  })

  test("Malformed JSON returns unhealthy", async () => {
    // #given: Invalid JSON
    writeFileSync(testFile, "{ invalid json }")

    // #when: Run health check
    const health = await checkUsageTracking(testFile)

    // #then: Unhealthy with error
    expect(health.healthy).toBe(false)
    expect(health.warnings.some((w) => w.includes("Error reading"))).toBe(true)
  })
})
