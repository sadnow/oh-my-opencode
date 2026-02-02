import { describe, it, expect, beforeEach } from 'bun:test'
import { BudgetOrchestrator } from './index'
import { AdaptiveBudgetManager } from './adaptive-budget'
import { ProviderWeightCalculator } from './provider-weight-calculator'
import type { BudgetConfig } from '../../config/schema'
import type { UsageTracker } from '../usage-tracker'

/**
 * End-to-End Integration Test: Velocity-Based Weight Adjustment
 * 
 * Verifies that velocity data flows correctly from AdaptiveBudgetManager
 * through calculateVelocityByProvider() to buildCandidates() and finally
 * affects model selection via calculateWeight().
 */
describe('Velocity Integration End-to-End', () => {
  let orchestrator: BudgetOrchestrator
  let mockUsageTracker: UsageTracker

  beforeEach(() => {
    // Create mock usage tracker
    mockUsageTracker = {
      getProviderUsage: () => ({
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        modelBreakdown: {},
      }),
      getAllProviderUsage: () => ({}),
      getProviderSummary: () => ({
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
      }),
      recordUsage: () => {},
      reset: () => {},
      getUsageByModel: () => ({
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
      }),
      getAllModelUsage: () => ({}),
    } as any

    // Create budget config with multiple providers
    const budgetConfig: Partial<BudgetConfig> = {
      enabled: true,
      target_percentage: 0.7,
      provider_budgets: {
        anthropic: 100,
        'github-copilot': 100,
        opencode: 50,
      },
      auto_downgrade: true,
      min_tier: 'budget',
    }

    orchestrator = new BudgetOrchestrator(
      budgetConfig as BudgetConfig,
      mockUsageTracker,
      ['anthropic', 'github-copilot', 'opencode']
    )
  })

  it('applies velocity penalty in realistic multi-provider scenario', () => {
    //#given - Multiple providers with different velocities
    // Provider A (anthropic): High velocity (5%/day, should be penalized)
    // Provider B (github-copilot): Low velocity (0.5%/day, should be boosted)
    // Provider C (opencode): Zero velocity (should get max boost)

    // Simulate velocity data by injecting state into adaptive managers
    const anthropicManager = (orchestrator as any).adaptiveManagers.get('anthropic') as AdaptiveBudgetManager
    const copilotManager = (orchestrator as any).adaptiveManagers.get('github-copilot') as AdaptiveBudgetManager
    const opencodeManager = (orchestrator as any).adaptiveManagers.get('opencode') as AdaptiveBudgetManager

    // Set high velocity for anthropic (5% per day = 5/24 = 0.208% per hour)
    // With 100 budget: 0.208% * 100 = $0.208/hour
    ;(anthropicManager as any).state = {
      ...anthropicManager.getState(),
      spendingVelocityPerHour: 0.208, // $0.208/hour
      velocitySampleCount: 10, // Enough samples for prediction
    }

    // Set low velocity for copilot (0.5% per day = 0.5/24 = 0.0208% per hour)
    // With 100 budget: 0.0208% * 100 = $0.0208/hour
    ;(copilotManager as any).state = {
      ...copilotManager.getState(),
      spendingVelocityPerHour: 0.0208, // $0.0208/hour
      velocitySampleCount: 10,
    }

    // Set zero velocity for opencode
    ;(opencodeManager as any).state = {
      ...opencodeManager.getState(),
      spendingVelocityPerHour: 0, // $0/hour
      velocitySampleCount: 10,
    }

    //#when - Calculate velocity by provider
    const velocityByProvider = (orchestrator as any).calculateVelocityByProvider()

    //#then - Verify velocity data is calculated correctly
    expect(velocityByProvider.anthropic).toBeCloseTo(5.0, 1) // 5%/day
    expect(velocityByProvider['github-copilot']).toBeCloseTo(0.5, 1) // 0.5%/day
    expect(velocityByProvider.opencode).toBeCloseTo(0, 1) // 0%/day

    //#and - Verify velocity affects weight calculation
    const calculator = new ProviderWeightCalculator()
    const models = [
      'anthropic/claude-sonnet-4',
      'github-copilot/gpt-4-turbo',
      'opencode/gpt-5-nano',
    ]
    const usagePercentByProvider = {
      anthropic: 50,
      'github-copilot': 50,
      opencode: 50,
    }
    const daysUntilResetByProvider = {
      anthropic: 7,
      'github-copilot': 30,
      opencode: 30,
    }

    const candidates = calculator.buildCandidates(
      models,
      usagePercentByProvider,
      daysUntilResetByProvider,
      velocityByProvider
    )

    //#then - High velocity provider should have lower weight
    const anthropicCandidate = candidates.find(c => c.provider === 'anthropic')!
    const copilotCandidate = candidates.find(c => c.provider === 'github-copilot')!
    const opencodeCandidate = candidates.find(c => c.provider === 'opencode')!

    // Anthropic: high velocity (5%/day) with 7 days remaining
    // Expected velocity: 50% / 7 days = 7.14%/day
    // Velocity ratio: 5.0 / 7.14 = 0.7 (burning slower than expected)
    // Velocity penalty: 1 / 0.7 = 1.43 (boost)
    // Weight: 0.5 * 2.0 * 1.0 * 1.43 ≈ 1.43

    // Copilot: low velocity (0.5%/day) with 30 days remaining
    // Expected velocity: 50% / 30 days = 1.67%/day
    // Velocity ratio: 0.5 / 1.67 = 0.3 (burning much slower)
    // Velocity penalty: 1 / 0.3 = 3.33, clamped to 1.5 (max boost)
    // Weight: 0.5 * 2.0 * 1.0 * 1.5 = 1.5

    // OpenCode: zero velocity (0%/day)
    // Velocity penalty: max boost (1.5)
    // Weight: 0.5 * 0.5 * 1.0 * 1.5 = 0.375 (but API budget has lower priority)

    expect(copilotCandidate.weight).toBeGreaterThan(anthropicCandidate.weight)
    expect(anthropicCandidate.weight).toBeGreaterThan(opencodeCandidate.weight)

    //#and - Verify selection favors low-velocity provider
    const selections: Record<string, number> = {
      anthropic: 0,
      'github-copilot': 0,
      opencode: 0,
    }

    for (let i = 0; i < 1000; i++) {
      const selected = calculator.selectBestProvider(candidates)
      if (selected) {
        selections[selected.provider]++
      }
    }

    // Copilot should get most selections due to lowest velocity
    expect(selections['github-copilot']).toBeGreaterThan(selections.anthropic)
    expect(selections['github-copilot']).toBeGreaterThan(selections.opencode)
  })

  it('handles edge case: zero velocity (idle provider)', () => {
    //#given - Provider with zero velocity
    const anthropicManager = (orchestrator as any).adaptiveManagers.get('anthropic') as AdaptiveBudgetManager
    ;(anthropicManager as any).state = {
      ...anthropicManager.getState(),
      spendingVelocityPerHour: 0,
      velocitySampleCount: 10,
    }

    //#when - Calculate velocity
    const velocityByProvider = (orchestrator as any).calculateVelocityByProvider()

    //#then - Zero velocity should be handled gracefully
    expect(velocityByProvider.anthropic).toBe(0)

    //#and - Weight calculation should apply max boost
    const calculator = new ProviderWeightCalculator()
    const weight = calculator.calculateWeight('anthropic', 50, 7, 0)

    // Zero velocity → max boost (1.5)
    // Weight: 0.5 * 2.0 * 1.0 * 1.5 = 1.5
    expect(weight).toBeCloseTo(1.5, 2)
  })

  it('handles edge case: negative velocity (impossible but defensive)', () => {
    //#given - Provider with negative velocity (defensive check)
    const anthropicManager = (orchestrator as any).adaptiveManagers.get('anthropic') as AdaptiveBudgetManager
    ;(anthropicManager as any).state = {
      ...anthropicManager.getState(),
      spendingVelocityPerHour: -0.1, // Negative (shouldn't happen)
      velocitySampleCount: 10,
    }

    //#when - Calculate velocity
    const velocityByProvider = (orchestrator as any).calculateVelocityByProvider()

    //#then - Negative velocity should be passed through
    expect(velocityByProvider.anthropic).toBeLessThan(0)

    //#and - Weight calculation should apply min penalty (safety clamp)
    const calculator = new ProviderWeightCalculator()
    const weight = calculator.calculateWeight('anthropic', 50, 7, velocityByProvider.anthropic)

    // Negative velocity → min penalty (0.3)
    // Weight: 0.5 * 2.0 * 1.0 * 0.3 = 0.3
    expect(weight).toBeCloseTo(0.3, 2)
  })

  it('handles edge case: undefined velocity (no data yet)', () => {
    //#given - Provider without velocity data (insufficient samples)
    const anthropicManager = (orchestrator as any).adaptiveManagers.get('anthropic') as AdaptiveBudgetManager
    ;(anthropicManager as any).state = {
      ...anthropicManager.getState(),
      spendingVelocityPerHour: 0.1,
      velocitySampleCount: 2, // Below minSamplesForPrediction (default 5)
    }

    //#when - Calculate velocity
    const velocityByProvider = (orchestrator as any).calculateVelocityByProvider()

    //#then - Provider should not be included (insufficient samples)
    expect(velocityByProvider.anthropic).toBeUndefined()

    //#and - Weight calculation should work without velocity data
    const calculator = new ProviderWeightCalculator()
    const weight = calculator.calculateWeight('anthropic', 50, 7, undefined)

    // No velocity data → no penalty (1.0)
    // Weight: 0.5 * 2.0 * 1.0 * 1.0 = 1.0
    expect(weight).toBeCloseTo(1.0, 2)
  })

  it('verifies velocity data flows through complete routing pipeline', () => {
    //#given - Realistic scenario with mixed velocities
    const anthropicManager = (orchestrator as any).adaptiveManagers.get('anthropic') as AdaptiveBudgetManager
    const copilotManager = (orchestrator as any).adaptiveManagers.get('github-copilot') as AdaptiveBudgetManager

    // Anthropic: burning fast (10%/day)
    ;(anthropicManager as any).state = {
      ...anthropicManager.getState(),
      spendingVelocityPerHour: 0.417, // 10%/day = 10/24 = 0.417%/hour, 100 budget → $0.417/hour
      velocitySampleCount: 10,
    }

    // Copilot: burning slow (1%/day)
    ;(copilotManager as any).state = {
      ...copilotManager.getState(),
      spendingVelocityPerHour: 0.0417, // 1%/day = 1/24 = 0.0417%/hour, 100 budget → $0.0417/hour
      velocitySampleCount: 10,
    }

    //#when - Get usage percentages and velocity
    const usagePercentByProvider = (orchestrator as any).calculateUsagePercentages()
    const velocityByProvider = (orchestrator as any).calculateVelocityByProvider()

    //#then - Velocity data should be present
    expect(velocityByProvider.anthropic).toBeCloseTo(10.0, 1)
    expect(velocityByProvider['github-copilot']).toBeCloseTo(1.0, 1)

    //#and - Build candidates with velocity
    const calculator = new ProviderWeightCalculator()
    const models = ['anthropic/claude-sonnet-4', 'github-copilot/gpt-4-turbo']
    const candidates = calculator.buildCandidates(
      models,
      usagePercentByProvider,
      undefined,
      velocityByProvider
    )

    //#then - Candidates should have different weights due to velocity
    const anthropicCandidate = candidates.find(c => c.provider === 'anthropic')!
    const copilotCandidate = candidates.find(c => c.provider === 'github-copilot')!

    // Both at 0% usage, so remainingFraction = 1.0
    // Both subscription providers, so priorityMultiplier = 2.0
    // No reset bonus
    // Anthropic: velocity 10%/day, expected ~1.43%/day (100% / 70 days), ratio = 7.0, penalty = 1/7.0 = 0.14, clamped to 0.3
    // Copilot: velocity 1%/day, expected ~1.43%/day, ratio = 0.7, penalty = 1/0.7 = 1.43
    expect(copilotCandidate.weight).toBeGreaterThan(anthropicCandidate.weight)

    //#and - Selection should favor low-velocity provider
    const selections: Record<string, number> = { anthropic: 0, 'github-copilot': 0 }
    for (let i = 0; i < 100; i++) {
      const selected = calculator.selectBestProvider(candidates)
      if (selected) {
        selections[selected.provider]++
      }
    }

    expect(selections['github-copilot']).toBeGreaterThan(selections.anthropic)
  })

  it('verifies velocity penalty scales correctly with different velocities', () => {
    //#given - Three providers with low, medium, high velocity
    const anthropicManager = (orchestrator as any).adaptiveManagers.get('anthropic') as AdaptiveBudgetManager
    const copilotManager = (orchestrator as any).adaptiveManagers.get('github-copilot') as AdaptiveBudgetManager
    const opencodeManager = (orchestrator as any).adaptiveManagers.get('opencode') as AdaptiveBudgetManager

    // Low velocity: 1%/day
    ;(anthropicManager as any).state = {
      ...anthropicManager.getState(),
      spendingVelocityPerHour: 0.0417,
      velocitySampleCount: 10,
    }

    // Medium velocity: 5%/day
    ;(copilotManager as any).state = {
      ...copilotManager.getState(),
      spendingVelocityPerHour: 0.208,
      velocitySampleCount: 10,
    }

    // High velocity: 15%/day
    ;(opencodeManager as any).state = {
      ...opencodeManager.getState(),
      spendingVelocityPerHour: 0.3125, // 15%/day = 15/24 = 0.625%/hour, 50 budget → $0.3125/hour
      velocitySampleCount: 10,
    }

    //#when - Calculate velocities
    const velocityByProvider = (orchestrator as any).calculateVelocityByProvider()

    //#then - Velocities should be correct
    expect(velocityByProvider.anthropic).toBeCloseTo(1.0, 1)
    expect(velocityByProvider['github-copilot']).toBeCloseTo(5.0, 1)
    expect(velocityByProvider.opencode).toBeCloseTo(15.0, 1) // 0.3125 / 50 * 100 * 24 = 15%/day

    //#and - Calculate weights with same usage and days remaining
    const calculator = new ProviderWeightCalculator()
    const usagePercent = 50
    const daysUntilReset = 30

    const weightLow = calculator.calculateWeight('anthropic', usagePercent, daysUntilReset, 1.0)
    const weightMed = calculator.calculateWeight('github-copilot', usagePercent, daysUntilReset, 5.0)
    const weightHigh = calculator.calculateWeight('opencode', usagePercent, daysUntilReset, 15.0)

    //#then - Lower velocity should have higher weight
    expect(weightLow).toBeGreaterThan(weightMed)
    expect(weightMed).toBeGreaterThan(weightHigh)

    //#and - Verify penalty is applied correctly
    // Expected velocity: 50% / 30 days = 1.67%/day
    // Low (1.0): ratio = 1.0/1.67 = 0.6, penalty = 1/0.6 = 1.67, clamped to 1.5
    // Med (5.0): ratio = 5.0/1.67 = 3.0, penalty = 1/3.0 = 0.33
    // High (15.0): ratio = 15.0/1.67 = 9.0, penalty = 1/9.0 = 0.11, clamped to 0.3

    // Low: 0.5 * 2.0 * 1.0 * 1.5 = 1.5
    expect(weightLow).toBeCloseTo(1.5, 1)

    // Med: 0.5 * 2.0 * 1.0 * 0.33 = 0.33
    expect(weightMed).toBeCloseTo(0.33, 1)

    // High: 0.5 * 0.5 * 1.0 * 0.3 = 0.075 (API budget has lower priority)
    expect(weightHigh).toBeCloseTo(0.075, 2)
  })

  it('verifies velocity adjustment improves exhaustion timing balance', () => {
    //#given - Two providers with different velocities but same usage
    const calculator = new ProviderWeightCalculator()
    const models = ['providerA/model-a', 'providerB/model-b']

    // Provider A: fast (10%/day), Provider B: slow (2%/day)
    const usagePercentByProvider = { providerA: 50, providerB: 50 }
    const daysUntilResetByProvider = { providerA: 30, providerB: 30 }
    const velocityByProvider = { providerA: 10.0, providerB: 2.0 }

    //#when - Run simulation
    const selections: Record<string, number> = { providerA: 0, providerB: 0 }

    for (let i = 0; i < 1000; i++) {
      const candidates = calculator.buildCandidates(
        models,
        usagePercentByProvider,
        daysUntilResetByProvider,
        velocityByProvider
      )
      const selected = calculator.selectBestProvider(candidates)
      if (selected) {
        selections[selected.provider]++
      }
    }

    //#then - Provider B should get more load (velocity-adjusted)
    const providerBPercent = (selections.providerB / 1000) * 100
    expect(providerBPercent).toBeGreaterThan(60)
    expect(providerBPercent).toBeLessThan(85)

    //#and - Calculate days to exhaustion
    const providerALoad = selections.providerA / 1000
    const providerBLoad = selections.providerB / 1000

    const daysToExhaustA = 50 / (10.0 * providerALoad)
    const daysToExhaustB = 50 / (2.0 * providerBLoad)

    //#then - Exhaustion timing should be more balanced
    const mean = (daysToExhaustA + daysToExhaustB) / 2
    const variance =
      (Math.pow(daysToExhaustA - mean, 2) + Math.pow(daysToExhaustB - mean, 2)) / 2
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = stdDev / mean

    // Coefficient of variation should be < 0.3 (balanced exhaustion)
    expect(coefficientOfVariation).toBeLessThan(0.3)
  })
})
