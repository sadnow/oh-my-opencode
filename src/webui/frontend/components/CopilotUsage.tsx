import { useState, useEffect } from 'react'

interface CopilotData {
  success: boolean
  error?: string
  data: {
    usage: {
      requests_this_month: number
      monthly_limit: number
      usage_percentage: number
      reset_date: string
      estimated_cost: number
    }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatResetDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return 'Resets today'
    if (diffDays === 0) return 'Resets today'
    if (diffDays === 1) return 'Resets tomorrow'
    if (diffDays <= 7) return `Resets in ${diffDays} days`

    return `Resets ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  return (
    <div style={{
      padding: '20px',
      background: 'white',
      borderRadius: '8px',
      border: '1px solid #dee2e6',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
            Copilot Monthly Usage
          </h3>
          <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '5px' }}>
            {data ? (
              <span className="tooltip-trigger" aria-label="Monthly reset explanation">
                {formatResetDate(data.data.usage.reset_date)}
                <span className="tooltip-icon">?</span>
                <span className="tooltip-content" role="tooltip">
                  Monthly limit resets on the 1st
                </span>
              </span>
            ) : (
              'Loading...'
            )}
          </div>
        </div>
        <button
          onClick={fetchUsage}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: '#0066cc',
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

      {loading && <p style={{ color: '#666' }}>Loading Copilot usage...</p>}

      {error && (
        <div style={{
          padding: '20px',
          background: '#f8f9fa',
          border: '2px solid #17a2b8',
          borderRadius: '8px',
          marginBottom: '15px'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>ℹ️</span>
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>
                Copilot Tracking Not Available
              </h4>
              <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: '14px' }}>
                This feature requires GitHub Copilot usage tracking to be configured.
              </p>
              <details style={{ fontSize: '13px', color: '#666' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: '500' }}>
                  How to enable
                </summary>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
                  <li>Configure <code>copilotTracker</code> in your oh-im-broke config</li>
                  <li>Provide your GitHub Copilot credentials</li>
                  <li>Restart the WebUI server</li>
                </ol>
              </details>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <div style={{
              height: '8px',
              background: '#e9ecef',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.usage.usage_percentage, 100)}%`,
                background: getUsageColor(data.data.usage.usage_percentage),
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          <div className="grid-2col" style={{ display: 'grid', gap: '15px', fontSize: '14px' }}>
            <div>
              <div style={{ color: '#666' }}>
                <span className="tooltip-trigger" aria-label="Requests explanation">
                  Requests This Month
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Total API requests made this month
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: '#333', marginTop: '3px' }}>
                {data.data.usage.requests_this_month.toLocaleString()} / {data.data.usage.monthly_limit.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: '#666' }}>
                <span className="tooltip-trigger" aria-label="Usage percentage explanation">
                  Usage Percentage
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Percentage of monthly limit used
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: getUsageColor(data.data.usage.usage_percentage), marginTop: '3px' }}>
                {data.data.usage.usage_percentage.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ color: '#666' }}>
                <span className="tooltip-trigger" aria-label="Estimated cost explanation">
                  Estimated Cost
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Approximate cost based on usage
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: '#333', marginTop: '3px' }}>
                {formatCurrency(data.data.usage.estimated_cost)}
              </div>
            </div>
            <div>
              <div style={{ color: '#666' }}>
                <span className="tooltip-trigger" aria-label="Monthly limit explanation">
                  Monthly Limit
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Maximum requests allowed per month
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: '#333', marginTop: '3px' }}>
                {data.data.usage.monthly_limit.toLocaleString()} requests
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}