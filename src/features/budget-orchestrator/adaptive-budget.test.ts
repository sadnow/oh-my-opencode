import { describe, it, expect } from 'bun:test'
import { AdaptiveBudgetManager, DEFAULT_ADAPTIVE_CONFIG, validateAdaptiveConfig } from './adaptive-budget'

describe('adaptive-budget', () => {
  describe('validateAdaptiveConfig', () => {
    it('returns valid for empty config', () => {
      //#given
      const config = {}

      //#when
      const result = validateAdaptiveConfig(config)

      //#then
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('flags negative totalBudget as error', () => {
      //#given
      const config = { totalBudget: -1 }

      //#when
      const result = validateAdaptiveConfig(config)

      //#then
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('totalBudget cannot be negative')
    })

    it('warns when totalBudget is very low', () => {
      //#given
      const config = { totalBudget: 0.5 }

      //#when
      const result = validateAdaptiveConfig(config)

      //#then
      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('totalBudget is very low ($0.5), tier recommendations may be limited')
    })

    it('requires periodHours to be positive', () => {
      //#given
      const config = { periodHours: 0 }

      //#when
      const result = validateAdaptiveConfig(config)

      //#then
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('periodHours must be positive')
    })

    it('warns when periodHours is less than a day', () => {
      //#given
      const config = { periodHours: 12 }

      //#when
      const result = validateAdaptiveConfig(config)

      //#then
      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('periodHours less than 24 hours may cause erratic tier changes')
    })

    it('validates rate ranges and warnings', () => {
      //#given
      const config = {
        creditAccumulationRate: 1.2,
        conservativeSpendingFactor: 0.95,
        burstAllowancePercent: 0.6,
      }

      //#when
      const result = validateAdaptiveConfig(config)

      //#then
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('creditAccumulationRate must be between 0 and 1')
      expect(result.warnings).toContain('conservativeSpendingFactor > 0.9 may cause aggressive tier upgrades')
      expect(result.warnings).toContain('burstAllowancePercent > 0.5 may deplete credits too quickly')
    })

    it('errors when spending factors are out of range', () => {
      //#given
      const config = {
        conservativeSpendingFactor: -0.1,
        burstAllowancePercent: 2,
      }

      //#when
      const result = validateAdaptiveConfig(config)

      //#then
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('conservativeSpendingFactor must be between 0 and 1')
      expect(result.errors).toContain('burstAllowancePercent must be between 0 and 1')
    })
  })

  describe('AdaptiveBudgetManager construction', () => {
    it('initializes with defaults without persistence', () => {
      //#given
      const config = {}

      //#when
      const manager = new AdaptiveBudgetManager(config)

      //#then
      const currentConfig = manager.getConfig()
      const state = manager.getState()
      expect(currentConfig.totalBudget).toBe(DEFAULT_ADAPTIVE_CONFIG.totalBudget)
      expect(currentConfig.periodHours).toBe(DEFAULT_ADAPTIVE_CONFIG.periodHours)
      expect(currentConfig.creditAccumulationRate).toBe(DEFAULT_ADAPTIVE_CONFIG.creditAccumulationRate)
      expect(state.currentRecommendedTier).toBe('standard')
      expect(state.predictionAccuracy).toBe(0.5)
      expect(state.velocitySampleCount).toBe(0)
      expect(state.hourlyPatterns).toHaveLength(24)
      expect(state.dailyPatterns).toHaveLength(7)
    })

    it('throws when constructed with invalid config', () => {
      //#given
      const config = { creditAccumulationRate: 2 }

      //#when
      const create = () => new AdaptiveBudgetManager(config)

      //#then
      expect(create).toThrow('Invalid adaptive budget config: creditAccumulationRate must be between 0 and 1')
    })
  })
})
