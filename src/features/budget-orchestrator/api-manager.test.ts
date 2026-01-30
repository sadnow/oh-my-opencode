import { describe, it, expect, vi } from 'bun:test'
import { APIBudgetManager } from './api-manager'
import type { UsageTracker } from '../usage-tracker'

describe('APIBudgetManager', () => {
  const mockUsageTracker = {
    getProviderSummary: vi.fn()
  } as unknown as UsageTracker

  it('should return empty array if config is missing', () => {
    const manager = new APIBudgetManager(mockUsageTracker, {})
    expect(manager.getStatuses()).toEqual([])
  })

  it('should return empty array if usageTracker is missing', () => {
    const manager = new APIBudgetManager(null, { opencode_zen: { weekly_limit: 10 } })
    expect(manager.getStatuses()).toEqual([])
  })

  it('should return status for opencode-zen when configured', () => {
    (mockUsageTracker.getProviderSummary as any).mockReturnValue({
      totalCost: 5,
      provider: 'opencode',
      periodStart: new Date(),
      nextReset: new Date(),
      resetType: 'weekly',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      callCount: 0
    })

    const manager = new APIBudgetManager(mockUsageTracker, {
      opencode_zen: { weekly_limit: 10 }
    })

    const statuses = manager.getStatuses()
    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toMatchObject({
      provider: 'opencode-zen',
      type: 'api',
      metric_label: '$ used (weekly)',
      remaining_pct: 50,
      severity: 'ok',
      recommendation: 'none',
      details: {
        used: 5,
        total: 10,
        unit: '$'
      }
    })
  })

  it('should return warn severity and downgrade recommendation when usage >= 70%', () => {
    (mockUsageTracker.getProviderSummary as any).mockReturnValue({
      totalCost: 7.5,
      provider: 'opencode',
      periodStart: new Date(),
      nextReset: new Date(),
      resetType: 'weekly',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      callCount: 0
    })

    const manager = new APIBudgetManager(mockUsageTracker, {
      opencode_zen: { weekly_limit: 10 }
    })

    const statuses = manager.getStatuses()
    expect(statuses[0].severity).toBe('warn')
    expect(statuses[0].recommendation).toBe('downgrade')
  })

  it('should return critical severity when usage >= 90%', () => {
    (mockUsageTracker.getProviderSummary as any).mockReturnValue({
      totalCost: 9.5,
      provider: 'opencode',
      periodStart: new Date(),
      nextReset: new Date(),
      resetType: 'weekly',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      callCount: 0
    })

    const manager = new APIBudgetManager(mockUsageTracker, {
      opencode_zen: { weekly_limit: 10 }
    })

    const statuses = manager.getStatuses()
    expect(statuses[0].severity).toBe('critical')
  })
})
