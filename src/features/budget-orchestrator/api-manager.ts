import type { BudgetStatus } from './types'
import type { UsageTracker } from '../usage-tracker'
import type { QuotaTargets } from '../../config/schema'

export interface APIBudgetConfig {
  opencode_zen?: {
    weekly_limit?: number
  }
}

export class APIBudgetManager {
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

  getStatuses(): BudgetStatus[] {
    const statuses: BudgetStatus[] = []
    
    // Priority: quota_targets.zen_monthly_dollars > apis.opencode_zen.weekly_limit
    const monthlyLimit = this.quotaTargets?.zen_monthly_dollars
    const weeklyLimit = this.apiConfig?.opencode_zen?.weekly_limit
    
    // Use monthly limit from quota_targets, or fallback to weekly * 4
    const effectiveMonthlyLimit = monthlyLimit ?? (weeklyLimit ? weeklyLimit * 4 : undefined)
    
    if (effectiveMonthlyLimit && this.usageTracker) {
      // Sum all pay-per-use API providers for Zen usage
      const opencodeUsage = this.usageTracker.getProviderSummary('opencode')
      const googleUsage = this.usageTracker.getProviderSummary('google')
      const openaiUsage = this.usageTracker.getProviderSummary('openai')
      
      // Total Zen usage = opencode + google + openai (all pay-per-use APIs)
      const totalZenUsage = opencodeUsage.totalCost + googleUsage.totalCost + openaiUsage.totalCost
      const percentUsed = (totalZenUsage / effectiveMonthlyLimit) * 100
      
      statuses.push({
        provider: 'opencode-zen',
        type: 'api',
        metric_label: '$ used (monthly)',
        remaining_pct: Math.max(0, 100 - percentUsed),
        severity: this.getSeverity(percentUsed),
        recommendation: this.getRecommendation(percentUsed),
        details: {
          used: totalZenUsage,
          total: effectiveMonthlyLimit,
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
