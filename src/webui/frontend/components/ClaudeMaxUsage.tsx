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
            Claude Max Weekly Usage
          </h3>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: 'var(--spacing-1)' }}>
            Real-time from Anthropic API
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

      {loading && <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Loading Claude Max usage...</p>}

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
                Claude Max Tracking Not Available
              </h4>
              <p style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {error}
              </p>
              <details style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                <summary style={{ cursor: 'pointer', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                  How to enable
                </summary>
                <ol style={{ margin: 'var(--spacing-1) 0 0 0', paddingLeft: 'var(--spacing-4)', lineHeight: 'var(--line-height-normal)' }}>
                  <li>Ensure you have Claude Max subscription</li>
                  <li>OAuth credentials are stored in ~/.claude/.credentials.json</li>
                  <li>This is the same token Claude Code uses</li>
                </ol>
              </details>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Current Session */}
          <div style={{ marginBottom: 'var(--spacing-3)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-1)' }}>
              Current Session (5 hours) • Resets {data.data.formatted.currentSessionReset}
            </div>
            <div style={{
              height: '6px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.currentSession.percentUsed, 100)}%`,
                background: getUsageColor(data.data.currentSession.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: getUsageColor(data.data.currentSession.percentUsed), marginTop: 'var(--spacing-1)' }}>
              {data.data.currentSession.percentUsed.toFixed(1)}% used
            </div>
          </div>

          {/* Weekly All Models */}
          <div style={{ marginBottom: 'var(--spacing-3)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-1)' }}>
              Current Week (All Models) • Resets {data.data.formatted.allModelsReset}
            </div>
            <div style={{
              height: '6px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.allModels.percentUsed, 100)}%`,
                background: getUsageColor(data.data.allModels.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: getUsageColor(data.data.allModels.percentUsed), marginTop: 'var(--spacing-1)' }}>
              {data.data.allModels.percentUsed.toFixed(1)}% used
            </div>
          </div>

          {/* Sonnet Only */}
          <div style={{ marginBottom: 'var(--spacing-3)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-1)' }}>
              Current Week (Sonnet Only) • Resets {data.data.formatted.sonnetOnlyReset}
            </div>
            <div style={{
              height: '6px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.sonnetOnly.percentUsed, 100)}%`,
                background: getUsageColor(data.data.sonnetOnly.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', color: getUsageColor(data.data.sonnetOnly.percentUsed), marginTop: 'var(--spacing-1)' }}>
              {data.data.sonnetOnly.percentUsed.toFixed(1)}% used
            </div>
          </div>

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-2)' }}>
            Last updated: {new Date(data.data.lastUpdated).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  )
}
