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
      padding: '20px',
      background: 'var(--color-bg-primary)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 3px var(--color-shadow)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            GitHub Copilot Monthly Usage
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '5px' }}>
            Real-time from GitHub API
          </div>
        </div>
        <button
          onClick={fetchUsage}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            opacity: loading ? 0.6 : 1
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading Copilot usage...</p>}

      {error && (
        <div style={{
          padding: '20px',
          background: 'var(--color-bg-tertiary)',
          border: '2px solid var(--color-info)',
          borderRadius: 'var(--border-radius-md)',
          marginBottom: '15px'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>ℹ️</span>
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
                Copilot Tracking Not Available
              </h4>
              <p style={{ margin: '0 0 12px 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                {error}
              </p>
              <details style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: '500' }}>
                  How to enable
                </summary>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
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
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Premium Requests • Resets {data.data.formatted.resetDate} ({data.data.daysUntilReset} days)
            </div>
            <div style={{
              height: '8px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.percentUsed, 100)}%`,
                background: getUsageColor(data.data.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: getUsageColor(data.data.percentUsed), marginTop: '8px' }}>
              {data.data.percentUsed.toFixed(1)}% used
            </div>
          </div>

          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', fontSize: '14px' }}>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Premium Requests Used</div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                {data.data.premiumRequestsUsed.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Monthly Limit</div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                {data.data.premiumRequestsLimit.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Plan</div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px', textTransform: 'uppercase' }}>
                {data.data.plan}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Status</div>
              <div style={{ 
                fontWeight: 'bold', 
                color: data.data.isOverLimit ? '#dc3545' : '#28a745', 
                marginTop: '3px' 
              }}>
                {data.data.isOverLimit ? 'OVER LIMIT' : 'OK'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '12px' }}>
            Last updated: {new Date(data.data.lastUpdated).toLocaleTimeString()} • Method: {data.data.fetchMethod}
          </div>
        </>
      )}
    </div>
  )
}
