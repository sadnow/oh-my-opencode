import { describe, it, expect, vi } from 'bun:test'
import { SubscriptionBudgetManager } from './subscription-manager'
import type { ClaudeMaxUsageTracker } from '../claude-max-usage'
import type { CopilotUsageTracker } from '../copilot-usage'

describe('SubscriptionBudgetManager', () => {
  const mockClaudeData = {
    allModels: { percentUsed: 50, resetDate: '2026-02-01T00:00:00Z' },
    currentSession: { percentUsed: 10, resetDate: '2026-01-30T15:00:00Z' },
    sonnetOnly: { percentUsed: 40, resetDate: '2026-02-01T00:00:00Z' },
    subscription: { tier: 'pro', isActive: true, extraUsageEnabled: false },
    lastUpdated: '2026-01-30T10:00:00Z'
  }

  const mockCopilotData = {
    percentUsed: 60,
    premiumRequestsUsed: 1200,
    premiumRequestsLimit: 2000,
    resetDate: '2026-02-15T00:00:00Z',
    daysUntilReset: 16,
    plan: 'pro',
    isOverLimit: false,
    lastUpdated: '2026-01-30T10:00:00Z',
    fetchMethod: 'api'
  }

  it('should return empty array when no trackers provided', () => {
    const manager = new SubscriptionBudgetManager()
    expect(manager.getStatuses()).toEqual([])
  })

  it('should map Claude Max data correctly', () => {
    const mockTracker = {
      getData: vi.fn().mockReturnValue(mockClaudeData)
    } as unknown as ClaudeMaxUsageTracker

    const manager = new SubscriptionBudgetManager(mockTracker)
    const statuses = manager.getStatuses()

    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toEqual({
      provider: 'claude-max',
      type: 'subscription',
      metric_label: '% used (weekly)',
      remaining_pct: 50,
      severity: 'ok',
      recommendation: 'none',
      details: {
        used: 50,
        total: 100,
        unit: '%'
      }
    })
  })

  it('should map Copilot data correctly', () => {
    const mockTracker = {
      getData: vi.fn().mockReturnValue(mockCopilotData)
    } as unknown as CopilotUsageTracker

    const manager = new SubscriptionBudgetManager(undefined, mockTracker)
    const statuses = manager.getStatuses()

    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toEqual({
      provider: 'copilot',
      type: 'subscription',
      metric_label: 'requests used (monthly)',
      remaining_pct: 40,
      severity: 'ok',
      recommendation: 'none',
      details: {
        used: 1200,
        total: 2000,
        unit: 'requests'
      }
    })
  })

  it('should handle critical severity (>= 90%)', () => {
    const mockTracker = {
      getData: vi.fn().mockReturnValue({
        ...mockClaudeData,
        allModels: { percentUsed: 95, resetDate: '...' }
      })
    } as unknown as ClaudeMaxUsageTracker

    const manager = new SubscriptionBudgetManager(mockTracker)
    const statuses = manager.getStatuses()

    expect(statuses[0].severity).toBe('critical')
    expect(statuses[0].recommendation).toBe('downgrade')
  })

  it('should handle warn severity (>= 70%)', () => {
    const mockTracker = {
      getData: vi.fn().mockReturnValue({
        ...mockClaudeData,
        allModels: { percentUsed: 75, resetDate: '...' }
      })
    } as unknown as ClaudeMaxUsageTracker

    const manager = new SubscriptionBudgetManager(mockTracker)
    const statuses = manager.getStatuses()

    expect(statuses[0].severity).toBe('warn')
    expect(statuses[0].recommendation).toBe('downgrade')
  })

  it('should handle both trackers simultaneously', () => {
    const claudeTracker = {
      getData: vi.fn().mockReturnValue(mockClaudeData)
    } as unknown as ClaudeMaxUsageTracker
    const copilotTracker = {
      getData: vi.fn().mockReturnValue(mockCopilotData)
    } as unknown as CopilotUsageTracker

    const manager = new SubscriptionBudgetManager(claudeTracker, copilotTracker)
    const statuses = manager.getStatuses()

    expect(statuses).toHaveLength(2)
    expect(statuses.map(s => s.provider)).toContain('claude-max')
    expect(statuses.map(s => s.provider)).toContain('copilot')
  })
})
