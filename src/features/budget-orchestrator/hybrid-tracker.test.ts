import { describe, test, expect, beforeEach } from "bun:test"
import {
  HybridProviderTracker,
  getHybridProviderTracker,
  initHybridProviderTracker,
  resetHybridProviderTracker,
  type HybridTrackerConfig,
} from "./hybrid-tracker"

describe("HybridProviderTracker", () => {
  const baseConfig: HybridTrackerConfig = {
    providers: {
      openai: { daily_free_tokens: 10000, reset_time: "00:00", enabled: true },
      google: { daily_free_tokens: 8000, reset_time: "00:00", enabled: true },
    },
  }

  beforeEach(() => {
    resetHybridProviderTracker()
  })

  describe("recordUsage", () => {
    test("tracks openai usage from opencode/gpt-4o", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 5000)

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.tokensUsedToday).toBe(5000)
    })

    test("tracks google usage from opencode/gemini-pro", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gemini-pro", 3000)

      const usage = tracker.getProviderUsage("google")
      expect(usage?.tokensUsedToday).toBe(3000)
    })

    test("ignores native opencode models (big-pickle)", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/big-pickle", 5000)

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.tokensUsedToday).toBe(0)
    })

    test("ignores non-opencode models", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("anthropic/claude-opus", 5000)

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.tokensUsedToday).toBe(0)
    })

    test("accumulates multiple recordings", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 2000)
      tracker.recordUsage("opencode/gpt-4o", 3000)

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.tokensUsedToday).toBe(5000)
    })
  })

  describe("getProviderUsage", () => {
    test("returns usage data with correct percentUsed", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 2500)

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.percentUsed).toBe(25)
    })

    test("returns null for unconfigured provider", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      const usage = tracker.getProviderUsage("anthropic")
      expect(usage).toBeNull()
    })

    test("percentUsed can exceed 100", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 25000)

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.percentUsed).toBe(250)
    })
  })

  describe("isExhausted", () => {
    test("returns false when under limit", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 9999)
      expect(tracker.isExhausted("openai")).toBe(false)
    })

    test("returns true when at limit", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 10000)
      expect(tracker.isExhausted("openai")).toBe(true)
    })

    test("returns true when over limit", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 15000)
      expect(tracker.isExhausted("openai")).toBe(true)
    })

    test("returns false for unconfigured provider", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      expect(tracker.isExhausted("anthropic")).toBe(false)
    })
  })

  describe("checkAndReset", () => {
    test("resets counters when date changes", () => {
      let now = new Date("2026-02-01T10:00:00.000Z")
      const tracker = new HybridProviderTracker(baseConfig, { getNow: () => now })
      tracker.recordUsage("opencode/gpt-4o", 5000)

      now = new Date("2026-02-02T00:00:00.000Z")
      tracker.checkAndReset()

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.tokensUsedToday).toBe(0)
    })

    test("does not reset on same day", () => {
      let now = new Date("2026-02-01T10:00:00.000Z")
      const tracker = new HybridProviderTracker(baseConfig, { getNow: () => now })
      tracker.recordUsage("opencode/gpt-4o", 5000)

      now = new Date("2026-02-01T23:59:59.000Z")
      tracker.checkAndReset()

      const usage = tracker.getProviderUsage("openai")
      expect(usage?.tokensUsedToday).toBe(5000)
    })

    test("resets all providers independently", () => {
      let now = new Date("2026-02-01T10:00:00.000Z")
      const tracker = new HybridProviderTracker(baseConfig, { getNow: () => now })
      tracker.recordUsage("opencode/gpt-4o", 5000)
      tracker.recordUsage("opencode/gemini-pro", 4000)

      now = new Date("2026-02-02T00:00:00.000Z")
      tracker.checkAndReset()

      const openaiUsage = tracker.getProviderUsage("openai")
      const googleUsage = tracker.getProviderUsage("google")
      expect(openaiUsage?.tokensUsedToday).toBe(0)
      expect(googleUsage?.tokensUsedToday).toBe(0)
    })
  })

  describe("getExhaustedProviders", () => {
    test("returns empty array when none exhausted", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 5000)
      expect(tracker.getExhaustedProviders()).toEqual([])
    })

    test("returns only exhausted providers", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      tracker.recordUsage("opencode/gpt-4o", 15000)
      tracker.recordUsage("opencode/gemini-pro", 2000)

      expect(tracker.getExhaustedProviders()).toEqual(["openai"])
    })
  })

  describe("getAllUsage", () => {
    test("returns data for all configured providers", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      const usage = tracker.getAllUsage()

      expect(Object.keys(usage)).toEqual(["openai", "google"])
    })

    test("includes providers with zero usage", () => {
      const tracker = new HybridProviderTracker(baseConfig)
      const usage = tracker.getAllUsage()

      expect(usage.openai.tokensUsedToday).toBe(0)
      expect(usage.google.tokensUsedToday).toBe(0)
    })
  })

  describe("singleton", () => {
    test("getHybridProviderTracker returns same instance", () => {
      const first = getHybridProviderTracker()
      const second = getHybridProviderTracker()
      expect(first).toBe(second)
    })

    test("initHybridProviderTracker creates new instance with config", () => {
      const first = getHybridProviderTracker()
      const second = initHybridProviderTracker(baseConfig)
      expect(first).not.toBe(second)
      expect(second.getProviderUsage("openai")).not.toBeNull()
    })

    test("resetHybridProviderTracker clears instance", () => {
      const first = getHybridProviderTracker()
      resetHybridProviderTracker()
      const second = getHybridProviderTracker()
      expect(first).not.toBe(second)
    })
  })
})
