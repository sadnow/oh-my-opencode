import { useState, useEffect } from 'react'

interface BudgetDashboardData {
  success: boolean
  data: {
    providers: Record<string, {
      spent: number
      budget: number
      usage_percentage: number
      recommended_tier: string
      current_tier: string
      daily_rate: number
    }>
    total_spent: number
    total_budget: number
    overall_usage_percentage: number
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

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Budget Overview</h2>
          <p style={{ color: '#666', marginTop: '5px' }}>Track spending across all providers</p>
        </div>
        <button 
          onClick={fetchDashboard}
          style={{ 
            padding: '8px 16px', 
            background: '#0066cc', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⟳ Refresh
        </button>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading budget data...</p>}
      
      {error && (
        <div style={{ 
          padding: '15px', 
          background: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Overall Summary */}
          <div style={{ 
            padding: '20px', 
            background: '#f8f9fa', 
            borderRadius: '8px', 
            marginBottom: '30px',
            border: '2px solid ' + getUsageColor(data.data.overall_usage_percentage)
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Total Spent</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                  {formatCurrency(data.data.total_spent)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Total Budget</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                  {formatCurrency(data.data.total_budget)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Overall Usage</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: getUsageColor(data.data.overall_usage_percentage) }}>
                  {data.data.overall_usage_percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Provider Breakdown */}
          <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Provider Breakdown</h3>
          <div style={{ display: 'grid', gap: '15px' }}>
            {Object.entries(data.data.providers).map(([provider, stats]) => (
              <div 
                key={provider} 
                style={{ 
                  padding: '20px', 
                  background: 'white', 
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                      {provider}
                    </h4>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                      Current: <span style={{ fontWeight: 'bold', color: '#333' }}>{stats.current_tier}</span>
                      {stats.recommended_tier !== stats.current_tier && (
                        <> → Recommended: <span style={{ fontWeight: 'bold', color: '#0066cc' }}>{stats.recommended_tier}</span></>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '5px 12px', 
                    borderRadius: '4px', 
                    background: getUsageColor(stats.usage_percentage) + '20',
                    color: getUsageColor(stats.usage_percentage),
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {stats.usage_percentage.toFixed(1)}%
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <div style={{ 
                    height: '8px', 
                    background: '#e9ecef', 
                    borderRadius: '4px', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(stats.usage_percentage, 100)}%`,
                      background: getUsageColor(stats.usage_percentage),
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', fontSize: '13px' }}>
                  <div>
                    <div style={{ color: '#666' }}>Spent</div>
                    <div style={{ fontWeight: 'bold', color: '#333', marginTop: '3px' }}>
                      {formatCurrency(stats.spent)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666' }}>Budget</div>
                    <div style={{ fontWeight: 'bold', color: '#333', marginTop: '3px' }}>
                      {formatCurrency(stats.budget)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666' }}>Daily Rate</div>
                    <div style={{ fontWeight: 'bold', color: '#333', marginTop: '3px' }}>
                      {formatCurrency(stats.daily_rate)}/day
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {Object.keys(data.data.providers).length === 0 && (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No provider data available.</p>
          )}
        </>
      )}
    </div>
  )
}
