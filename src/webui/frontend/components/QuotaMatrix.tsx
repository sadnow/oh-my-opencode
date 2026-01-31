import { useState, useEffect } from 'react'

interface ClaudeMaxData {
  success: boolean
  error?: string
  data: {
    currentSession: {
      percentUsed: number
      resetDate: string
    }
    allModels: {
      percentUsed: number
      resetDate: string
    }
    sonnetOnly: {
      percentUsed: number
      resetDate: string
    }
    opusOnly: {
      percentUsed: number
      resetDate: string
    } | null
    subscription: {
      tier: string
      isActive: boolean
      extraUsageEnabled: boolean
    }
    lastUpdated: string
    formatted: {
      currentSessionReset: string
      allModelsReset: string
      sonnetOnlyReset: string
      opusOnlyReset: string | null
    }
    recommendation: string
    shouldDowngrade: boolean
  }
}

interface CopilotData {
  success: boolean
  error?: string
  data: {
    percentUsed: number
    premiumRequestsUsed: number
    premiumRequestsLimit: number
    resetDate: string
    daysUntilReset: number
    plan: string
    copilotPlan: string
    isOverLimit: boolean
    lastUpdated: string
    fetchMethod: string
    formatted: {
      resetDate: string
    }
    recommendation: string
    shouldReduceUsage: boolean
  }
}

interface BudgetData {
  success: boolean
  error?: string
  data: {
    states: Array<{
      provider: string
      used: number
      budget: number
      percentage: number
      currency?: string
      period?: string
    }>
    lastUpdated: string
  }
}

interface QuotaCard {
  id: string
  name: string
  used: number
  total: number
  percentage: number
  color: string
  subtitle?: string
  resetInfo?: string
}

export function QuotaMatrix() {
  const [quotas, setQuotas] = useState<QuotaCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--color-status-error)'
    if (percentage >= 70) return 'var(--color-status-warning)'
    if (percentage >= 50) return 'var(--color-accent-warning)'
    return 'var(--color-status-success)'
  }

  const fetchAllQuotas = async () => {
    setLoading(true)
    setError(null)

    try {
      const [claudeMaxRes, copilotRes, budgetRes] = await Promise.all([
        fetch('/api/claude-max/usage'),
        fetch('/api/copilot/usage'),
        fetch('/api/budget')
      ])

      const claudeMaxData: ClaudeMaxData = await claudeMaxRes.json()
      const copilotData: CopilotData = await copilotRes.json()
      const budgetData: BudgetData = await budgetRes.json()

      const cards: QuotaCard[] = []

      // Claude Max quotas
      if (claudeMaxData.success && claudeMaxData.data) {
        const cm = claudeMaxData.data
        cards.push({
          id: 'claude-max-session',
          name: 'Claude Max Session',
          used: cm.currentSession.percentUsed,
          total: 100,
          percentage: cm.currentSession.percentUsed,
          color: getUsageColor(cm.currentSession.percentUsed),
          subtitle: '5-hour rolling window',
          resetInfo: `Resets ${cm.formatted.currentSessionReset}`
        })
        cards.push({
          id: 'claude-max-weekly',
          name: 'Claude Max Weekly',
          used: cm.allModels.percentUsed,
          total: 100,
          percentage: cm.allModels.percentUsed,
          color: getUsageColor(cm.allModels.percentUsed),
          subtitle: 'All models',
          resetInfo: `Resets ${cm.formatted.allModelsReset}`
        })
      }

      // Copilot quota
      if (copilotData.success && copilotData.data) {
        const cp = copilotData.data
        cards.push({
          id: 'copilot-monthly',
          name: 'GitHub Copilot',
          used: cp.premiumRequestsUsed,
          total: cp.premiumRequestsLimit,
          percentage: cp.percentUsed,
          color: getUsageColor(cp.percentUsed),
          subtitle: 'Premium requests',
          resetInfo: `Resets ${cp.formatted.resetDate} (${cp.daysUntilReset} days)`
        })
      }

      // Budget quotas
      if (budgetData.success && budgetData.data) {
        budgetData.data.states.forEach((state, idx) => {
          cards.push({
            id: `budget-${idx}`,
            name: state.provider,
            used: state.used,
            total: state.budget,
            percentage: state.percentage,
            color: getUsageColor(state.percentage),
            subtitle: state.period || 'Monthly',
            resetInfo: `${state.currency || '$'}${state.used.toFixed(2)} / ${state.currency || '$'}${state.budget.toFixed(2)}`
          })
        })
      }

      setQuotas(cards)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllQuotas()
    const interval = setInterval(fetchAllQuotas, 30000) // Auto-refresh every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      padding: 'var(--spacing-4)',
      background: 'var(--color-bg-primary)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-subtle)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            Quota Matrix
          </h2>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-1)' }}>
            Unified view of all quota limits
          </div>
        </div>
        <button
          onClick={fetchAllQuotas}
          disabled={loading}
          style={{
            padding: 'var(--spacing-2) var(--spacing-3)',
            background: 'var(--color-accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: 'var(--font-size-sm)',
            opacity: loading ? 0.6 : 1
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Loading quotas...
        </div>
      )}

      {error && (
        <div style={{
          padding: 'var(--spacing-3)',
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-status-error)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-3)'
        }}>
          <div style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && quotas.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--spacing-3)'
        }}>
          {quotas.map((quota) => (
            <div
              key={quota.id}
              style={{
                padding: 'var(--spacing-3)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  {quota.name}
                </div>
                {quota.subtitle && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-1)' }}>
                    {quota.subtitle}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <div style={{
                  height: '6px',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(quota.percentage, 100)}%`,
                    background: quota.color,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: quota.color }}>
                  {quota.percentage.toFixed(1)}%
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {quota.used.toLocaleString()} / {quota.total.toLocaleString()}
                </div>
              </div>

              {quota.resetInfo && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-1)' }}>
                  {quota.resetInfo}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && quotas.length === 0 && (
        <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          No quota data available
        </div>
      )}
    </div>
  )
}