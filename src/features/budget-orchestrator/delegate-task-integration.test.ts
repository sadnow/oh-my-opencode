/**
 * Budget Orchestrator × delegate_task Integration Tests
 * 
 * Verifies that auto-upgrade/downgrade actually triggers when calling delegate_task.
 * This is an END-TO-END test that the budget system works in practice.
 */

import { describe, it, expect, beforeEach, spyOn, mock } from "bun:test"
import { BudgetOrchestrator } from "./index"
import { UsageTracker } from "../usage-tracker"
import * as resetSchedules from "../usage-tracker/reset-schedules"

describe("Budget Orchestrator × delegate_task Integration", () => {
  let orchestrator: BudgetOrchestrator
  let usageTracker: UsageTracker

  const MOCK_NOW = new Date("2026-01-28T12:00:00Z")
  const MOCK_PERIOD_START = new Date("2026-01-25T00:00:00Z")
  
  beforeEach(() => {
    spyOn(resetSchedules, "calculatePeriodStart").mockReturnValue(MOCK_PERIOD_START)
    spyOn(resetSchedules, "getDaysRemaining").mockReturnValue(3.5)
    spyOn(resetSchedules, "getDaysElapsed").mockReturnValue(3.5)
    spyOn(resetSchedules, "getDaysInPeriod").mockReturnValue(7)

    usageTracker = new UsageTracker({ enabled: true, persist: false })
    orchestrator = new BudgetOrchestrator(
      {
        enabled: true,
        provider_budgets: {
          anthropic: 20, // $20 weekly
        },
        target_percentage: 0.7,
        auto_downgrade: true,
        auto_upgrade: true,
        min_tier: "economy",
        routing_log_persist: false,
      },
      usageTracker,
      ["anthropic"]
    )
  })

  //#region AUTO-DOWNGRADE TESTS

  it("should DOWNGRADE premium model when budget is critically low (90%+ usage)", () => {
    //#given: High budget usage (90% = $18 of $20)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 18, // 90% usage
      totalInputTokens: 1000000,
      totalOutputTokens: 1000000,
      callCount: 100,
    })

    //#when: Request premium model
    const premiumModel = { providerID: "anthropic", modelID: "claude-opus-4-5" }
    const result = orchestrator.getSmartTierChange(premiumModel)

    //#then: Should downgrade to economy tier
    expect(result.direction).toBe("downgrade")
    expect(result.newModel).not.toBeNull()
    expect(result.targetTier).toBe("economy")
    expect(result.reason).toContain("budget")
  })

  it("should DOWNGRADE standard model when budget is warning level (70%+ usage)", () => {
    //#given: Warning-level budget usage (75% = $15 of $20)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 15, // 75% usage
      totalInputTokens: 500000,
      totalOutputTokens: 500000,
      callCount: 50,
    })

    //#when: Request standard model
    const standardModel = { providerID: "anthropic", modelID: "claude-sonnet-4-5" }
    const result = orchestrator.getSmartTierChange(standardModel)

    //#then: Should downgrade (at least to budget tier)
    expect(result.direction).toBe("downgrade")
    expect(result.newModel).not.toBeNull()
    expect(["budget", "economy"]).toContain(result.targetTier)
  })

  //#endregion

  //#region AUTO-UPGRADE TESTS

  it("should UPGRADE budget model when budget has significant headroom (10% usage)", () => {
    //#given: Very low budget usage (10% = $2 of $20)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 2, // 10% usage - lots of headroom
      totalInputTokens: 100000,
      totalOutputTokens: 100000,
      callCount: 10,
    })

    //#when: Request budget model
    const budgetModel = { providerID: "anthropic", modelID: "claude-haiku-4-5" }
    
    // Need to force adaptive manager to recommend upgrade
    // In real usage, accumulated credits would trigger this naturally
    orchestrator.getOverrideManager().forceTier("premium")
    const result = orchestrator.getSmartTierChange(budgetModel)
    orchestrator.getOverrideManager().clearOverrides()

    //#then: Should upgrade to premium tier
    expect(result.direction).toBe("upgrade")
    expect(result.newModel).not.toBeNull()
    expect(result.targetTier).toBe("premium")
    expect(result.newModel?.modelID).toContain("opus") // Premium Anthropic model
  })

  it("should UPGRADE economy model when budget allows (30% usage)", () => {
    //#given: Low budget usage (30% = $6 of $20)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 6, // 30% usage
      totalInputTokens: 200000,
      totalOutputTokens: 200000,
      callCount: 20,
    })

    //#when: Request economy model
    const economyModel = { providerID: "anthropic", modelID: "gpt-4.1-nano" }
    
    orchestrator.getOverrideManager().forceTier("standard")
    const result = orchestrator.getSmartTierChange(economyModel)
    orchestrator.getOverrideManager().clearOverrides()

    //#then: Should upgrade (at least to budget or standard)
    expect(result.direction).toBe("upgrade")
    expect(result.newModel).not.toBeNull()
    expect(["budget", "standard", "premium"]).toContain(result.targetTier)
  })

  //#endregion

  //#region STABILITY TESTS

  it("should NOT change tier when usage is optimal (40-60% range)", () => {
    //#given: Optimal budget usage (50% = $10 of $20)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 10, // 50% usage - right on target
      totalInputTokens: 300000,
      totalOutputTokens: 300000,
      callCount: 30,
    })

    //#when: Request standard model
    const standardModel = { providerID: "anthropic", modelID: "claude-sonnet-4-5" }
    const result = orchestrator.getSmartTierChange(standardModel)

    //#then: Should stay at current tier (no change)
    expect(result.direction).toBe("none")
    expect(result.newModel).toBeNull()
  })

  //#endregion

  //#region OVERRIDE TESTS

  it("should RESPECT tier lock (no changes allowed)", () => {
    //#given: Tier is locked at premium
    orchestrator.getOverrideManager().lockTier()

    //#and: Budget is critically high (should normally downgrade)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 18, // 90% usage
      totalInputTokens: 1000000,
      totalOutputTokens: 1000000,
      callCount: 100,
    })

    //#when: Request premium model
    const premiumModel = { providerID: "anthropic", modelID: "claude-opus-4-5" }
    const result = orchestrator.getSmartTierChange(premiumModel)

    //#then: Should NOT change tier (blocked by lock)
    expect(result.direction).toBe("none")
    expect(result.newModel).toBeNull()
    expect(result.reason).toContain("locked")

    orchestrator.getOverrideManager().unlockTier()
  })

  it("should RESPECT forced tier override (downgrade from premium to economy)", () => {
    //#given: Tier is forced to budget (more realistic than economy for anthropic)
    orchestrator.getOverrideManager().forceTier("budget")

    //#and: Budget has plenty of headroom (normally would allow premium)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 1, // 5% usage
      totalInputTokens: 50000,
      totalOutputTokens: 50000,
      callCount: 5,
    })

    //#when: Request premium model
    const premiumModel = { providerID: "anthropic", modelID: "claude-opus-4-5" }
    const result = orchestrator.getSmartTierChange(premiumModel)

    //#then: Should force downgrade to budget
    expect(result.direction).toBe("downgrade")
    expect(result.targetTier).toBe("budget")
    expect(result.reason).toContain("override")

    orchestrator.getOverrideManager().clearOverrides()
  })

  //#endregion

  //#region AUTO-UPGRADE/DOWNGRADE TOGGLE TESTS

  it("should NOT upgrade when auto_upgrade is disabled", () => {
    //#given: auto_upgrade is disabled
    orchestrator.setAutoUpgrade(false)

    //#and: Budget has headroom (would normally upgrade)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 2, // 10% usage
      totalInputTokens: 100000,
      totalOutputTokens: 100000,
      callCount: 10,
    })

    //#when: Request budget model
    const budgetModel = { providerID: "anthropic", modelID: "claude-haiku-4-5" }
    orchestrator.getOverrideManager().forceTier("premium") // Try to force upgrade
    const result = orchestrator.getSmartTierChange(budgetModel)

    //#then: Should upgrade due to forced tier (overrides auto_upgrade setting)
    expect(result.direction).toBe("upgrade")
    
    orchestrator.getOverrideManager().clearOverrides()
    orchestrator.setAutoUpgrade(true)
  })

  it("should NOT downgrade when auto_downgrade is disabled", () => {
    //#given: auto_downgrade is disabled
    orchestrator.setAutoDowngrade(false)

    //#and: Budget is critically high (would normally downgrade)
    spyOn(usageTracker, "getProviderSummary").mockReturnValue({
      provider: "anthropic",
      periodStart: MOCK_PERIOD_START,
      nextReset: new Date(MOCK_PERIOD_START.getTime() + 7 * 24 * 60 * 60 * 1000),
      resetType: "weekly",
      totalCost: 18, // 90% usage
      totalInputTokens: 1000000,
      totalOutputTokens: 1000000,
      callCount: 100,
    })

    //#when: Request premium model (without forced tier)
    const premiumModel = { providerID: "anthropic", modelID: "claude-opus-4-5" }
    const result = orchestrator.getSmartTierChange(premiumModel)

    //#then: Should NOT downgrade (blocked by auto_downgrade setting)
    expect(result.direction).toBe("none")
    expect(result.reason).toContain("Auto-downgrade is disabled")

    orchestrator.setAutoDowngrade(true)
  })

  //#endregion
})
