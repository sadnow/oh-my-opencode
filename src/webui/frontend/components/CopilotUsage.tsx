import { useState, useEffect } from 'react'

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
    history?: { date: string; usage: number }[]
  }
}

export function CopilotUsage() {
  const [data, setData] = useState<CopilotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUnauthenticated, setIsUnauthenticated] = useState(false)

  const fetchUsage = async () => {
    setLoading(true)
    setError(null)
    setIsUnauthenticated(false)

    try {
      const res = await fetch('/api/copilot/usage')
      const usageData: CopilotData = await res.json()

      if (usageData.success) {
        setData(usageData)
      } else {
        if (res.status === 401 || usageData.error?.toLowerCase().includes('auth') || usageData.error?.toLowerCase().includes('login')) {
          setIsUnauthenticated(true)
        }
        setError(usageData.error || 'Failed to fetch Copilot usage')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthFlow = () => {
    window.open('/api/auth/github', '_blank')
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#dc3545'
    if (percentage >= 70) return '#fd7e14'
    if (percentage >= 50) return '#ffc107'
    return '#28a745'
  }

  return (
    <div style={{
      padding: 'var(--spacing-3)',
      background: 'var(--color-bg-primary)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border-subtle)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-3)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            GitHub Copilot Monthly Usage
          </h3>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: 'var(--spacing-1)' }}>
            Real-time from GitHub API
          </div>
        </div>
        <button
          onClick={fetchUsage}
          disabled={loading}
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
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

      {loading && <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Loading Copilot usage...</p>}

      {error && (
        <div style={{
          padding: 'var(--spacing-3)',
          background: 'var(--color-bg-tertiary)',
          border: `1px solid ${isUnauthenticated ? 'var(--color-accent-primary)' : 'var(--color-status-info)'}`,
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-2)' }}>
            <span style={{ fontSize: 'var(--font-size-lg)' }}>{isUnauthenticated ? '🔑' : 'ℹ️'}</span>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 var(--spacing-1) 0', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)' }}>
                {isUnauthenticated ? 'GitHub Connection Required' : 'Copilot Tracking Not Available'}
              </h4>
              <p style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 'var(--line-height-normal)' }}>
                {isUnauthenticated 
                  ? 'Connect your GitHub account to track your Copilot usage and quota in real-time.' 
                  : error.includes('rate limit') 
                    ? 'GitHub API rate limit reached. Please try again in a few minutes.'
                    : 'We encountered an issue fetching your usage data. Please ensure your subscription is active.'}
              </p>
              
              {isUnauthenticated ? (
                <button
                  onClick={handleOAuthFlow}
                  style={{
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    background: 'var(--color-accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: 'var(--font-size-sm)',
                    marginTop: 'var(--spacing-1)'
                  }}
                >
                  Connect GitHub Copilot
                </button>
              ) : (
                <details style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  <summary style={{ cursor: 'pointer', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                    Troubleshooting
                  </summary>
                  <ol style={{ margin: 'var(--spacing-1) 0 0 0', paddingLeft: 'var(--spacing-4)', lineHeight: 'var(--line-height-normal)' }}>
                    <li>Run: <code>gh auth login</code></li>
                    <li>Ensure you have GitHub Copilot Pro subscription</li>
                    <li>Check your internet connection</li>
                  </ol>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div style={{ marginBottom: 'var(--spacing-3)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-1)' }}>
              Premium Requests • Resets {data.data.formatted.resetDate} ({data.data.daysUntilReset} days)
            </div>
            <div style={{
              height: '6px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.percentUsed, 100)}%`,
                background: getUsageColor(data.data.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: getUsageColor(data.data.percentUsed), marginTop: 'var(--spacing-1)' }}>
              {data.data.percentUsed.toFixed(1)}% used
            </div>
          </div>

          {data.data.history && data.data.history.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Usage History (Last {data.data.history.length} days)
              </div>
              <div style={{ height: '60px', width: '100%', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="var(--color-border-subtle)" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-border-subtle)" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="var(--color-border-subtle)" strokeWidth="0.5" strokeDasharray="2,2" />
                  
                  {/* Area under the curve */}
                  <path
                    d={`M 0 100 ${data.data.history.map((h, i) => 
                      `L ${(i / (data.data.history!.length - 1)) * 100} ${100 - h.usage}`
                    ).join(' ')} L 100 100 Z`}
                    fill="var(--color-accent-primary)"
                    fillOpacity="0.1"
                  />
                  
                  {/* Line chart */}
                  <path
                    d={data.data.history.map((h, i) => 
                      `${i === 0 ? 'M' : 'L'} ${(i / (data.data.history!.length - 1)) * 100} ${100 - h.usage}`
                    ).join(' ')}
                    fill="none"
                    stroke="var(--color-accent-primary)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  
                  {/* Data points */}
                  {data.data.history.map((h, i) => (
                    <circle
                      key={i}
                      cx={(i / (data.data.history!.length - 1)) * 100}
                      cy={100 - h.usage}
                      r="1.5"
                      fill="var(--color-accent-primary)"
                    />
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--spacing-1)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
                  <span>{data.data.history[0].date}</span>
                  <span>{data.data.history[data.data.history.length - 1].date}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Premium Requests Used</div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: 'var(--spacing-1)' }}>
                {data.data.premiumRequestsUsed.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Monthly Limit</div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: 'var(--spacing-1)' }}>
                {data.data.premiumRequestsLimit.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Plan</div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: 'var(--spacing-1)', textTransform: 'uppercase' }}>
                {data.data.plan}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Status</div>
              <div style={{ 
                fontWeight: 'bold', 
                color: data.data.isOverLimit ? 'var(--color-status-error)' : 'var(--color-status-success)', 
                marginTop: 'var(--spacing-1)' 
              }}>
                {data.data.isOverLimit ? 'OVER LIMIT' : 'OK'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-2)' }}>
            Last updated: {new Date(data.data.lastUpdated).toLocaleTimeString()} • Method: {data.data.fetchMethod}
          </div>
        </>
      )}
    </div>
  )
}
