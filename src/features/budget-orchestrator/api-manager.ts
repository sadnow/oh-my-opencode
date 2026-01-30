import type { BudgetStatus } from './types'
import type { UsageTracker } from '../usage-tracker'

export interface APIBudgetConfig {
  opencode_zen?: {
    weekly_limit?: number
  }
}

export class APIBudgetManager {
  constructor(
    private usageTracker: UsageTracker | null,
    private apiConfig?: APIBudgetConfig
  ) {}

  getStatuses(): BudgetStatus[] {
    const statuses: BudgetStatus[] = []
    
    if (this.apiConfig?.opencode_zen?.weekly_limit && this.usageTracker) {
      const summary = this.usageTracker.getProviderSummary('opencode')
      const limit = this.apiConfig.opencode_zen.weekly_limit
      const percentUsed = (summary.totalCost / limit) * 100
      
      statuses.push({
        provider: 'opencode-zen',
        type: 'api',
        metric_label: '$ used (weekly)',
        remaining_pct: Math.max(0, 100 - percentUsed),
        severity: this.getSeverity(percentUsed),
        recommendation: this.getRecommendation(percentUsed),
        details: {
          used: summary.totalCost,
          total: limit,
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
