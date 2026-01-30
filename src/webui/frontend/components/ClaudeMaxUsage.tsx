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
            Real-time from Anthropic API
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
                {error}
              </p>
              <details style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: '500' }}>
                  How to enable
                </summary>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
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
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Current Session (5 hours) • Resets {data.data.formatted.currentSessionReset}
            </div>
            <div style={{
              height: '8px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.currentSession.percentUsed, 100)}%`,
                background: getUsageColor(data.data.currentSession.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: getUsageColor(data.data.currentSession.percentUsed), marginTop: '8px' }}>
              {data.data.currentSession.percentUsed.toFixed(1)}% used
            </div>
          </div>

          {/* Weekly All Models */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Current Week (All Models) • Resets {data.data.formatted.allModelsReset}
            </div>
            <div style={{
              height: '8px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.allModels.percentUsed, 100)}%`,
                background: getUsageColor(data.data.allModels.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: getUsageColor(data.data.allModels.percentUsed), marginTop: '8px' }}>
              {data.data.allModels.percentUsed.toFixed(1)}% used
            </div>
          </div>

          {/* Sonnet Only */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Current Week (Sonnet Only) • Resets {data.data.formatted.sonnetOnlyReset}
            </div>
            <div style={{
              height: '8px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(data.data.sonnetOnly.percentUsed, 100)}%`,
                background: getUsageColor(data.data.sonnetOnly.percentUsed),
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: getUsageColor(data.data.sonnetOnly.percentUsed), marginTop: '8px' }}>
              {data.data.sonnetOnly.percentUsed.toFixed(1)}% used
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '12px' }}>
            Last updated: {new Date(data.data.lastUpdated).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  )
}
