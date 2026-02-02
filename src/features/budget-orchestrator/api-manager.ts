import type { BudgetStatus } from './types'
import type { UsageTracker } from '../usage-tracker'
import type { QuotaTargets } from '../../config/schema'

export interface APIBudgetConfig {
  opencode_zen?: {
    weekly_limit?: number
  }
}

export class APIBudgetManager {
  private manualZenUsage: number | null = null

  constructor(
    private usageTracker: UsageTracker | null,
    private apiConfig?: APIBudgetConfig,
    private quotaTargets?: QuotaTargets
  ) {}

  /**
   * Update quota targets (called when settings are changed)
   */
  setQuotaTargets(targets: QuotaTargets): void {
    this.quotaTargets = targets
  }

  /**
   * Set manual Zen usage override (from actual billing)
   * @param amount The actual amount from billing, or null to use tracked usage
   */
  setManualZenUsage(amount: number | null): void {
    this.manualZenUsage = amount
  }

  /**
   * Get the current manual Zen usage override
   */
  getManualZenUsage(): number | null {
    return this.manualZenUsage
  }

  /**
   * Get the tracked Zen usage from usage tracker
   */
  getTrackedZenUsage(): number {
    if (!this.usageTracker) return 0

    const opencodeUsage = this.usageTracker.getProviderSummary('opencode')
    return opencodeUsage.totalCost
  }

  /**
   * Get the effective Zen usage (manual override if set, otherwise tracked)
   */
  getEffectiveZenUsage(): number {
    return this.manualZenUsage ?? this.getTrackedZenUsage()
  }

  getStatuses(): BudgetStatus[] {
    const statuses: BudgetStatus[] = []

    if (!this.usageTracker) return statuses
    
    // Priority: quota_targets.zen_monthly_dollars > apis.opencode_zen.weekly_limit
    const monthlyLimit = this.quotaTargets?.zen_monthly_dollars
    const weeklyLimit = this.apiConfig?.opencode_zen?.weekly_limit
    
    if (monthlyLimit === undefined && weeklyLimit === undefined) {
      return statuses
    }

    const usageSummary = this.usageTracker.getProviderSummary('opencode')
    const resetType = usageSummary.resetType
    const isWeekly = resetType === 'weekly'
    const hasWeeklyLimit = typeof weeklyLimit === 'number'
    const hasMonthlyLimit = typeof monthlyLimit === 'number'

    const effectiveTotal = isWeekly
      ? (hasWeeklyLimit ? weeklyLimit : hasMonthlyLimit ? monthlyLimit / 4 : undefined)
      : (hasMonthlyLimit ? monthlyLimit : hasWeeklyLimit ? weeklyLimit * 4 : undefined)

    if (effectiveTotal) {
      const totalZenUsage = this.getEffectiveZenUsage()
      const percentUsed = (totalZenUsage / effectiveTotal) * 100
      const isManual = this.manualZenUsage !== null
      const labelPeriod = resetType === 'weekly' ? 'weekly' : 'monthly'
      const isEstimated = isWeekly ? !hasWeeklyLimit && hasMonthlyLimit : !hasMonthlyLimit && hasWeeklyLimit
      const labelSuffix = isEstimated ? ` (${labelPeriod}, estimated)` : ` (${labelPeriod})`

      statuses.push({
        provider: 'opencode-zen',
        type: 'api',
        metric_label: isManual ? `$ used${labelSuffix}, manual` : `$ used${labelSuffix}`,
        remaining_pct: Math.max(0, 100 - percentUsed),
        severity: this.getSeverity(percentUsed),
        recommendation: this.getRecommendation(percentUsed),
        details: {
          used: totalZenUsage,
          total: effectiveTotal,
          unit: '$'
        }
      })
    }
    
    return statuses
  }
  
  private getSeverity(percentUsed: number): 'ok' | 'warn' | 'critical' {
    if (percentUsed >= 90) return 'critical'
    if (percentUsed >= 70) return 'warn'
    return 'ok'
  }
  
  private getRecommendation(percentUsed: number): 'downgrade' | 'none' {
    return percentUsed >= 70 ? 'downgrade' : 'none'
  }
}
