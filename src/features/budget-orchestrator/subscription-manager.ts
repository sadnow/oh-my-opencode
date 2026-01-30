import type { BudgetStatus } from './types'
import type { ClaudeMaxUsageTracker } from '../claude-max-usage'
import type { CopilotUsageTracker } from '../copilot-usage'
import type { QuotaTargets } from '../../config/schema'

export class SubscriptionBudgetManager {
  constructor(
    private claudeMaxTracker?: ClaudeMaxUsageTracker,
    private copilotTracker?: CopilotUsageTracker,
    private quotaTargets?: QuotaTargets
  ) {}

  getStatuses(): BudgetStatus[] {
    const statuses: BudgetStatus[] = []
    
    if (this.claudeMaxTracker) {
      const data = this.claudeMaxTracker.getData()
      statuses.push({
        provider: 'claude-max',
        type: 'subscription',
        metric_label: '% used (weekly)',
        remaining_pct: 100 - data.allModels.percentUsed,
        severity: this.getSeverity(data.allModels.percentUsed),
        recommendation: this.getRecommendation(data.allModels.percentUsed, 70),
        details: {
          used: data.allModels.percentUsed,
          total: 100,
          unit: '%'
        }
      })
    }
    
    if (this.copilotTracker) {
      const data = this.copilotTracker.getData()
      statuses.push({
        provider: 'copilot',
        type: 'subscription',
        metric_label: 'requests used (monthly)',
        remaining_pct: 100 - data.percentUsed,
        severity: this.getSeverity(data.percentUsed),
        recommendation: this.getRecommendation(data.percentUsed, 80),
        details: {
          used: data.premiumRequestsUsed ?? 0,
          total: data.premiumRequestsLimit ?? 0,
          unit: 'requests'
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
  
  private getRecommendation(percentUsed: number, threshold: number): 'downgrade' | 'none' {
    return percentUsed >= threshold ? 'downgrade' : 'none'
  }
}
