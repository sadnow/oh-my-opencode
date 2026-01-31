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
  }
}

export function CopilotUsage() {
  const [data, setData] = useState<CopilotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/copilot/usage')
      const usageData: CopilotData = await res.json()

      if (usageData.success) {
        setData(usageData)
      } else {
        setError(usageData.error || 'Failed to fetch Copilot usage')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
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
          border: '1px solid var(--color-status-info)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--spacing-2)' }}>
            <span style={{ fontSize: 'var(--font-size-lg)' }}>ℹ️</span>
            <div>
              <h4 style={{ margin: '0 0 var(--spacing-1) 0', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)' }}>
                Copilot Tracking Not Available
              </h4>
              <p style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {error}
              </p>
              <details style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                <summary style={{ cursor: 'pointer', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                  How to enable
                </summary>
                <ol style={{ margin: 'var(--spacing-1) 0 0 0', paddingLeft: 'var(--spacing-4)', lineHeight: 'var(--line-height-normal)' }}>
                  <li>Run: <code>gh auth login</code></li>
                  <li>Ensure you have GitHub Copilot Pro subscription</li>
                  <li>Restart the WebUI server</li>
                </ol>
              </details>
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
