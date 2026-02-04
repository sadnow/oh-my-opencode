import { describe, expect, test } from "bun:test"
import { selectTier, shouldDowngrade } from "./algorithm"
import type { BudgetOrchestratorConfig, BudgetState, ModelRef } from "./types"

const baseConfig: BudgetOrchestratorConfig = {
  enabled: true,
  targetPercentage: 0.7,
  providerBudgets: { anthropic: 20 },
  autoDowngrade: true,
  minTier: "economy",
}

const baseBudgetState: BudgetState = {
  provider: "anthropic",
  used: 10,
  remaining: 10,
  dailyBudget: 2,
  totalBudget: 20,
  trend: "on-track",
  targetDaily: 2,
  actualDaily: 2,
  daysElapsed: 5,
  daysRemaining: 5,
}

const premiumModel: ModelRef = {
  providerID: "anthropic",
  modelID: "claude-opus-4-5",
}

const budgetModel: ModelRef = {
  providerID: "anthropic",
  modelID: "claude-haiku-4-5",
}

const makeBudgetState = (overrides: Partial<BudgetState> = {}): BudgetState => ({
  ...baseBudgetState,
  ...overrides,
})

describe("selectTier", () => {
  test("returns minTier when headroom is zero or negative", () => {
    //#given
    const budgetState = makeBudgetState({ remaining: 5, dailyBudget: 2 })

    //#when
    const tier = selectTier(budgetState, baseConfig)

    //#then
    expect(tier).toBe("economy")
  })

  test("selects premium when flex factor is high", () => {
    //#given
    const budgetState = makeBudgetState({ remaining: 12, dailyBudget: 2 })

    //#when
    const tier = selectTier(budgetState, baseConfig)

    //#then
    expect(tier).toBe("premium")
  })

  test("selects standard when flex factor is medium", () => {
    //#given
    const budgetState = makeBudgetState({ remaining: 9, dailyBudget: 2 })

    //#when
    const tier = selectTier(budgetState, baseConfig)

    //#then
    expect(tier).toBe("standard")
  })

  test("selects budget when flex factor is low", () => {
    //#given
    const budgetState = makeBudgetState({ remaining: 9, dailyBudget: 4 })

    //#when
    const tier = selectTier(budgetState, baseConfig)

    //#then
    expect(tier).toBe("budget")
  })

  test("returns minTier when flex factor does not clear budget threshold", () => {
    //#given
    const budgetState = makeBudgetState({ remaining: 8, dailyBudget: 4 })

    //#when
    const tier = selectTier(budgetState, baseConfig)

    //#then
    expect(tier).toBe("economy")
  })
})

describe("shouldDowngrade", () => {
  test("returns false when autoDowngrade is disabled", () => {
    //#given
    const budgetState = makeBudgetState({ trend: "over" })
    const config = { ...baseConfig, autoDowngrade: false }

    //#when
    const result = shouldDowngrade(premiumModel, budgetState, config)

    //#then
    expect(result).toBe(false)
  })

  test("returns true when trend is over", () => {
    //#given
    const budgetState = makeBudgetState({ trend: "over" })

    //#when
    const result = shouldDowngrade(budgetModel, budgetState, baseConfig)

    //#then
    expect(result).toBe(true)
  })

  test("returns true when current tier is above selected tier", () => {
    //#given
    const budgetState = makeBudgetState({ remaining: 9, dailyBudget: 4 })

    //#when
    const result = shouldDowngrade(premiumModel, budgetState, baseConfig)

    //#then
    expect(result).toBe(true)
  })

  test("returns false when current tier is at or below selected tier", () => {
    //#given
    const budgetState = makeBudgetState({ remaining: 9, dailyBudget: 2 })

    //#when
    const result = shouldDowngrade(budgetModel, budgetState, baseConfig)

    //#then
    expect(result).toBe(false)
  })
})
