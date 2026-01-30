import { useState, useEffect } from 'react'

interface BudgetStatus {
  provider: string
  type: 'subscription' | 'api'
  metric_label: string
  remaining_pct: number
  severity: 'ok' | 'warn' | 'critical'
  recommendation?: 'upgrade' | 'downgrade' | 'limit' | 'none'
  details: {
    used: number
    total: number
    unit: string
  }
}

interface BudgetDashboardData {
  success: boolean
  data: {
    enabled: boolean
    providers: Array<{
      provider: string
      budget: number
      used: number
      percentage: number
      trend: "under" | "on-track" | "over"
      daysRemaining: number
      daysElapsed: number
      recommendedTier: string
      adaptive: {
        hourlyAllowance: number
        accumulatedCredits: number
        budgetHeadroom: number
        spendingVelocity: number
        learningProgress: number
        predictionAccuracy: number
        canAffordUpgrade: boolean
        shouldDowngrade: boolean
      } | null
      dailySpending: Array<{
        date: string
        amount: number
      }>
    }>
    subscriptions: BudgetStatus[]
    apis: BudgetStatus[]
    globalTier: string
    override: {
      forcedTier: string | null
      tierLocked: boolean
      expiresIn: string | null
      modifiedBy: string | null
    }
  }
}

export function BudgetDashboard() {
  const [data, setData] = useState<BudgetDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/budget/dashboard')
      const dashboardData: BudgetDashboardData = await res.json()
      
      if (dashboardData.success) {
        setData(dashboardData)
      } else {
        setError('Failed to fetch budget dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#dc3545'
    if (percentage >= 70) return '#ffc107'
    if (percentage >= 50) return '#17a2b8'
    return '#28a745'
  }

  const getSeverityColor = (severity: 'ok' | 'warn' | 'critical') => {
    switch (severity) {
      case 'critical': return '#dc3545'
      case 'warn': return '#ffc107'
      case 'ok': return '#28a745'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      'claude-max': 'Claude Max',
      'copilot': 'GitHub Copilot',
      'opencode-zen': 'OpenCode Zen'
    }
    return names[provider] || provider
  }

  if (!loading && !error && data && !data.data.enabled) {
    return (
      <div>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>Budget Overview</h2>
          <button onClick={fetchDashboard} className="button">⟳ Refresh</button>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Budget tracking is disabled.</p>
        </div>
      </div>
    )
  }

  const totalSpent = data?.data.providers.reduce((acc, p) => acc + p.used, 0) || 0
  const totalBudget = data?.data.providers.reduce((acc, p) => acc + p.budget, 0) || 0
  const overallUsagePercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
            Budget Overview
            <span className="tooltip-trigger" aria-label="Budget overview explanation">
              <span className="tooltip-icon">?</span>
              <span className="tooltip-content" role="tooltip">
                Track spending across all AI providers
              </span>
            </span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '5px' }}>Track spending across all providers</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="button"
        >
          ⟳ Refresh
        </button>
      </div>

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading budget data...</p>}

      {error && (
        <div className="card" style={{
          padding: '15px',
          background: 'var(--color-danger)',
          color: 'white',
          marginBottom: '15px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Overall Summary */}
          <div className="card-metric" style={{
            marginBottom: '30px',
            border: '2px solid ' + getUsageColor(overallUsagePercentage)
          }}>
            <div className="responsive-grid grid-3col" style={{ display: 'grid', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Total Spent</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  {formatCurrency(totalSpent)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Total Budget</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  {formatCurrency(totalBudget)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Overall Usage</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: getUsageColor(overallUsagePercentage) }}>
                  {overallUsagePercentage.toFixed(1)}%
                </div>
              </div>
            </div>
            <div style={{ marginTop: '15px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Current Global Tier: <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{data.data.globalTier}</span>
            </div>
          </div>

          {/* Subscriptions Section */}
          {data.data.subscriptions.length > 0 && (
            <>
              <h3 style={{ marginTop: '30px', marginBottom: '15px', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                Subscriptions
              </h3>
              <div className="responsive-grid" style={{ display: 'grid', gap: '15px' }}>
                {data.data.subscriptions.map((status) => (
                  <div
                    key={status.provider}
                    className="card"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                          {getProviderDisplayName(status.provider)}
                        </h4>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '5px' }}>
                          {status.metric_label}
                        </div>
                      </div>
                      <div className="status-badge" style={{
                        background: getSeverityColor(status.severity) + '20',
                        color: getSeverityColor(status.severity)
                      }}>
                        {status.remaining_pct.toFixed(0)}%
                      </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{
                          width: `${status.remaining_pct}%`,
                          background: getSeverityColor(status.severity)
                        }} />
                      </div>
                    </div>

                    <div className="grid-3col" style={{ display: 'grid', gap: '15px', fontSize: '13px' }}>
                      <div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Used
                        </div>
                        <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                          {status.details.used} {status.details.unit}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Total
                        </div>
                        <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                          {status.details.total} {status.details.unit}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Status
                        </div>
                        <div style={{ fontWeight: 'bold', color: getSeverityColor(status.severity), marginTop: '3px', textTransform: 'capitalize' }}>
                          {status.severity}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pay-per-use APIs Section */}
          {data.data.apis.length > 0 && (
            <>
              <h3 style={{ marginTop: '30px', marginBottom: '15px', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                Pay-per-use APIs
              </h3>
              <div className="responsive-grid" style={{ display: 'grid', gap: '15px' }}>
                {data.data.apis.map((status) => (
                  <div
                    key={status.provider}
                    className="card"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                          {getProviderDisplayName(status.provider)}
                        </h4>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '5px' }}>
                          {status.metric_label}
                        </div>
                      </div>
                      <div className="status-badge" style={{
                        background: getSeverityColor(status.severity) + '20',
                        color: getSeverityColor(status.severity)
                      }}>
                        {status.remaining_pct.toFixed(0)}%
                      </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{
                          width: `${status.remaining_pct}%`,
                          background: getSeverityColor(status.severity)
                        }} />
                      </div>
                    </div>

                    <div className="grid-3col" style={{ display: 'grid', gap: '15px', fontSize: '13px' }}>
                      <div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Used
                        </div>
                        <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                          {formatCurrency(status.details.used)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Budget
                        </div>
                        <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                          {formatCurrency(status.details.total)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Status
                        </div>
                        <div style={{ fontWeight: 'bold', color: getSeverityColor(status.severity), marginTop: '3px', textTransform: 'capitalize' }}>
                          {status.severity}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {data.data.subscriptions.length === 0 && data.data.apis.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No budget data available.</p>
          )}
        </>
      )}
    </div>
  )
}
