import { useState, useEffect } from 'react'

interface ClaudeMaxData {
  success: boolean
  error?: string
  data: {
    usage: {
      requests_this_week: number
      weekly_limit: number
      usage_percentage: number
      reset_date: string
      estimated_cost: number
    }
  }
}

export function ClaudeMaxUsage() {
  const [data, setData] = useState<ClaudeMaxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/claude-max/usage')
      const usageData: ClaudeMaxData = await res.json()

      if (usageData.success) {
        setData(usageData)
      } else {
        setError(usageData.error || 'Failed to fetch Claude Max usage')
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
      background: 'var(--color-bg-primary)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 3px var(--color-shadow)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            Claude Max Weekly Usage
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '5px' }}>
            {data ? (
              <span className="tooltip-trigger" aria-label="Weekly reset explanation">
                {formatResetDate(data.data.usage.reset_date)}
                <span className="tooltip-icon">?</span>
                <span className="tooltip-content" role="tooltip">
                  Weekly limit resets every Monday
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

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading Claude Max usage...</p>}

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
                Claude Max Tracking Not Available
              </h4>
              <p style={{ margin: '0 0 12px 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                This feature requires Claude Max subscription tracking to be configured.
              </p>
              <details style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: '500' }}>
                  How to enable
                </summary>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
                  <li>Configure <code>claudeMaxTracker</code> in your oh-im-broke config</li>
                  <li>Provide your Anthropic API credentials</li>
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
              background: 'var(--color-bg-tertiary)',
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
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <span className="tooltip-trigger" aria-label="Requests explanation">
                  Requests This Week
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Total API requests made this week
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                {data.data.usage.requests_this_week.toLocaleString()} / {data.data.usage.weekly_limit.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <span className="tooltip-trigger" aria-label="Usage percentage explanation">
                  Usage Percentage
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Percentage of weekly limit used
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: getUsageColor(data.data.usage.usage_percentage), marginTop: '3px' }}>
                {data.data.usage.usage_percentage.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <span className="tooltip-trigger" aria-label="Estimated cost explanation">
                  Estimated Cost
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Approximate cost based on usage
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                {formatCurrency(data.data.usage.estimated_cost)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <span className="tooltip-trigger" aria-label="Weekly limit explanation">
                  Weekly Limit
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-content" role="tooltip">
                    Maximum requests allowed per week
                  </span>
                </span>
              </div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                {data.data.usage.weekly_limit.toLocaleString()} requests
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}