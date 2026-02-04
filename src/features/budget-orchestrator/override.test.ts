/**
 * Budget Override Manager Tests
 */

import { describe, it, expect } from "bun:test"
import { join } from "path"
import { tmpdir } from "os"
import { BudgetOverrideManager } from "./override"

const createTempPath = () =>
  join(
    tmpdir(),
    `omo-test-override-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  )

const createManager = (persistPath = createTempPath()) => new BudgetOverrideManager(persistPath)

describe("BudgetOverrideManager", () => {
  it("starts with default state", () => {
    //#given a fresh manager
    const manager = createManager()

    //#when querying state
    const state = manager.getState()
    const summary = manager.getSummary()

    //#then no overrides are active
    expect(state.forcedTier).toBeNull()
    expect(state.tierLocked).toBe(false)
    expect(state.lockExpiry).toBeNull()
    expect(manager.hasActiveOverride()).toBe(false)
    expect(summary.expiresIn).toBeNull()
    expect(summary.modifiedBy).toBeNull()
  })

  it("forces a tier and persists it", () => {
    //#given a manager with a temp path
    const persistPath = createTempPath()
    const manager = createManager(persistPath)

    //#when forcing a tier with expiry
    manager.forceTier("standard", { durationMs: 60_000, source: "cli" })

    //#then state reflects the forced tier
    expect(manager.getForcedTier()).toBe("standard")
    expect(manager.hasActiveOverride()).toBe(true)
    expect(manager.getTimeUntilExpiry()).not.toBeNull()

    //#and a new instance loads persisted state
    const reloaded = createManager(persistPath)
    expect(reloaded.getForcedTier()).toBe("standard")
  })

  it("locks and unlocks tier changes", () => {
    //#given a fresh manager
    const manager = createManager()

    //#when locking the tier
    manager.lockTier({ source: "webui" })

    //#then tier changes should be blocked
    expect(manager.shouldBlockTierChange()).toBe(true)

    //#when unlocking
    manager.unlockTier()

    //#then tier changes should no longer be blocked
    expect(manager.shouldBlockTierChange()).toBe(false)
    expect(manager.getState().modifiedBy).toBeNull()
  })

  it("clears overrides while preserving learning reset", () => {
    //#given a manager with a learning reset
    const manager = createManager()
    manager.recordLearningReset()
    const lastReset = manager.getState().lastLearningReset

    //#when overrides are set and then cleared
    manager.forceTier("budget", { source: "api" })
    manager.lockTier()
    manager.clearOverrides()

    //#then overrides are cleared but learning reset remains
    const state = manager.getState()
    expect(state.forcedTier).toBeNull()
    expect(state.tierLocked).toBe(false)
    expect(state.lastLearningReset).toBe(lastReset)
  })

  it("expires overrides after duration", async () => {
    //#given a manager with a short-lived override
    const manager = createManager()
    manager.forceTier("premium", { durationMs: 5, source: "cli" })

    //#when time passes beyond expiry
    await new Promise((resolve) => setTimeout(resolve, 10))

    //#then overrides are cleared
    expect(manager.getForcedTier()).toBeNull()
    expect(manager.hasActiveOverride()).toBe(false)
    expect(manager.shouldBlockTierChange()).toBe(false)
  })

  it("clears expired overrides on load", () => {
    //#given a persisted expired override
    const persistPath = createTempPath()
    const manager = createManager(persistPath)
    manager.forceTier("standard", { durationMs: 1, source: "cli" })

    //#when reloading after expiry
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const reloaded = createManager(persistPath)

        //#then overrides are cleared on init
        expect(reloaded.getForcedTier()).toBeNull()
        expect(reloaded.hasActiveOverride()).toBe(false)
        resolve()
      }, 10)
    })
  })
})
