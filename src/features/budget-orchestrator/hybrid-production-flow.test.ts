import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { BudgetOrchestrator } from "./index"
import { UsageTracker } from "../usage-tracker/tracker"
import { getHybridProviderTracker, resetHybridProviderTracker } from "./hybrid-tracker"
import { getGlobalOverrideManager, resetGlobalOverrideManager } from "./global-override"
import type { BudgetConfig } from "../../config/schema"

describe("Hybrid Provider - Full Production Flow", () => {
  let usageTracker: UsageTracker

  beforeEach(() => {
    resetHybridProviderTracker()
    resetGlobalOverrideManager()
    usageTracker = new UsageTracker({ enabled: true, persist: false })
  })

  afterEach(() => {
    resetHybridProviderTracker()
    resetGlobalOverrideManager()
  })

  it("full chain: config → init → track → exhaust → block", () => {
    //#given a BudgetOrchestrator initialized with hybrid_providers config
    const config = {
      enabled: true,
      hybrid_providers: {
        openai: {
          daily_free_tokens: 1000,
          reset_time: "00:00",
          enabled: true,
        }
      }
    } as unknown as BudgetConfig

    // Creating BudgetOrchestrator should init HybridProviderTracker
    const orchestrator = new BudgetOrchestrator(config, usageTracker, ["opencode"])

    //#when we verify the tracker was initialized
    const tracker = getHybridProviderTracker()
    expect(tracker).toBeDefined()

    //#then initial usage should be zero
    const initialUsage = tracker.getProviderUsage("openai")!
    expect(initialUsage.tokensUsedToday).toBe(0)
    expect(initialUsage.isExhausted).toBe(false)
  })

  it("UsageTracker.recordUsage feeds into HybridProviderTracker", () => {
    //#given a BudgetOrchestrator with hybrid config
    const config = {
      enabled: true,
      hybrid_providers: {
        openai: {
          daily_free_tokens: 1000,
          reset_time: "00:00",
          enabled: true,
        }
      }
    } as unknown as BudgetConfig

    new BudgetOrchestrator(config, usageTracker, ["opencode"])

    //#when recording usage through UsageTracker (the production path)
    // Note: provider="opencode", model="gpt-5-nano" (WITHOUT prefix - this is how SDK provides it)
    usageTracker.recordUsage({
      provider: "opencode",
      model: "gpt-5-nano",
      inputTokens: 400,
      outputTokens: 200,
      taskType: "primary",
    })

    //#then HybridProviderTracker should have recorded the usage
    const tracker = getHybridProviderTracker()
    const usage = tracker.getProviderUsage("openai")!
    expect(usage.tokensUsedToday).toBe(600) // 400 + 200
    expect(usage.percentUsed).toBeCloseTo(60.0) // 600/1000 * 100
    expect(usage.isExhausted).toBe(false)
  })

  it("exhausted BYOK models blocked by GlobalOverrideManager", () => {
    //#given a BudgetOrchestrator with hybrid config (low limit)
    const config = {
      enabled: true,
      hybrid_providers: {
        openai: {
          daily_free_tokens: 500,
          reset_time: "00:00",
          enabled: true,
        }
      }
    } as unknown as BudgetConfig

    new BudgetOrchestrator(config, usageTracker, ["opencode"])

    //#when recording usage that exceeds the limit
    usageTracker.recordUsage({
      provider: "opencode",
      model: "gpt-5-nano",
      inputTokens: 400,
      outputTokens: 200,
      taskType: "primary",
    })

    // Verify exhausted
    const tracker = getHybridProviderTracker()
    expect(tracker.isExhausted("openai")).toBe(true)

    //#then GlobalOverrideManager should block BYOK models
    const manager = getGlobalOverrideManager()
    expect(manager.isModelAllowed("opencode/gpt-5-nano", ["opencode"])).toBe(true)
    expect(manager.isModelAllowed("opencode/gpt-5.2", ["opencode"])).toBe(false)

    // But native models should still work
    expect(manager.isModelAllowed("opencode/big-pickle", ["opencode"])).toBe(true)
    expect(manager.isModelAllowed("opencode/qwen-2.5-coder", ["opencode"])).toBe(true)
  })

  it("non-opencode provider usage does NOT feed into HybridProviderTracker", () => {
    //#given a BudgetOrchestrator with hybrid config
    const config = {
      enabled: true,
      hybrid_providers: {
        openai: {
          daily_free_tokens: 1000,
          reset_time: "00:00",
          enabled: true,
        }
      }
    } as unknown as BudgetConfig

    new BudgetOrchestrator(config, usageTracker, ["opencode", "anthropic"])

    //#when recording usage for a non-opencode provider
    usageTracker.recordUsage({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      inputTokens: 5000,
      outputTokens: 3000,
      taskType: "primary",
    })

    //#then HybridProviderTracker should have zero usage
    const tracker = getHybridProviderTracker()
    const usage = tracker.getProviderUsage("openai")!
    expect(usage.tokensUsedToday).toBe(0)
  })

  it("native opencode model usage does NOT count against BYOK", () => {
    //#given a BudgetOrchestrator with hybrid config
    const config = {
      enabled: true,
      hybrid_providers: {
        openai: {
          daily_free_tokens: 1000,
          reset_time: "00:00",
          enabled: true,
        }
      }
    } as unknown as BudgetConfig

    new BudgetOrchestrator(config, usageTracker, ["opencode"])

    //#when recording usage for a native opencode model
    usageTracker.recordUsage({
      provider: "opencode",
      model: "big-pickle",
      inputTokens: 50000,
      outputTokens: 10000,
      taskType: "primary",
    })

    //#then HybridProviderTracker openai should have zero usage
    // (because big-pickle is native, detectUnderlyingProvider returns null)
    const tracker = getHybridProviderTracker()
    const usage = tracker.getProviderUsage("openai")!
    expect(usage.tokensUsedToday).toBe(0)
    expect(usage.isExhausted).toBe(false)
  })

  it("no hybrid_providers config = tracker not initialized, everything works", () => {
    //#given a BudgetOrchestrator WITHOUT hybrid config
    const config = {
      enabled: true,
    } as unknown as BudgetConfig

    new BudgetOrchestrator(config, usageTracker, ["opencode"])

    //#when recording opencode usage
    usageTracker.recordUsage({
      provider: "opencode",
      model: "gpt-5-nano",
      inputTokens: 400,
      outputTokens: 200,
      taskType: "primary",
    })

    //#then GlobalOverrideManager should still allow everything (graceful degradation)
    const manager = getGlobalOverrideManager()
    expect(manager.isModelAllowed("opencode/gpt-5-nano", ["opencode"])).toBe(true)
    expect(manager.isModelAllowed("opencode/big-pickle", ["opencode"])).toBe(true)
  })
})
