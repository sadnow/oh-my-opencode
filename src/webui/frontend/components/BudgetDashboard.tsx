import { useState, useEffect } from 'react'

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
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

          {/* Provider Breakdown */}
          <h3 style={{ marginTop: '30px', marginBottom: '15px', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Provider Breakdown</h3>
          <div className="responsive-grid" style={{ display: 'grid', gap: '15px' }}>
            {data.data.providers.map((provider) => (
              <div
                key={provider.provider}
                className="card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                      {provider.provider}
                    </h4>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '5px' }}>
                      <span className="tooltip-trigger" aria-label="Current tier explanation">
                        Current: <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{data.data.globalTier}</span>
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-content" role="tooltip">
                          Your current subscription tier
                        </span>
                      </span>
                      {provider.recommendedTier !== data.data.globalTier && (
                        <>
                          {' → '}
                          <span className="tooltip-trigger" aria-label="Recommended tier explanation">
                            Recommended: <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>{provider.recommendedTier}</span>
                            <span className="tooltip-icon">?</span>
                            <span className="tooltip-content" role="tooltip">
                              Suggested tier based on your usage
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="status-badge" style={{
                    background: getUsageColor(provider.percentage) + '20',
                    color: getUsageColor(provider.percentage)
                  }}>
                    {provider.percentage.toFixed(1)}%
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{
                      width: `${Math.min(provider.percentage, 100)}%`,
                      background: getUsageColor(provider.percentage)
                    }} />
                  </div>
                </div>

                <div className="grid-3col" style={{ display: 'grid', gap: '15px', fontSize: '13px' }}>
                  <div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="tooltip-trigger" aria-label="Spent explanation">
                        Spent
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-content" role="tooltip">
                          Total amount spent this period
                        </span>
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                      {formatCurrency(provider.used)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="tooltip-trigger" aria-label="Budget explanation">
                        Budget
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-content" role="tooltip">
                          Your spending limit for this period
                        </span>
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                      {formatCurrency(provider.budget)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="tooltip-trigger" aria-label="Trend explanation">
                        Trend
                        <span className="tooltip-icon">?</span>
                        <span className="tooltip-content" role="tooltip">
                          Spending trend relative to budget
                        </span>
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px', textTransform: 'capitalize' }}>
                      {provider.trend}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.data.providers.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No provider data available.</p>
          )}
        </>
      )}
    </div>
  )
}
