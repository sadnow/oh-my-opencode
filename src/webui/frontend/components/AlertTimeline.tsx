import { useState, useEffect } from 'react'

interface Alert {
  timestamp: string
  level: 'error' | 'warning' | 'info'
  message: string
}

interface AlertsResponse {
  success: boolean
  data: {
    alerts: Alert[]
  }
}

const LEVEL_OPTIONS = [
  { value: 'all', label: 'All Levels' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' }
]

const getLevelColor = (level: string): string => {
  switch (level) {
    case 'error': return 'var(--color-status-error, #f44336)'
    case 'warning': return 'var(--color-status-warning, #ff9800)'
    case 'info': return 'var(--color-status-info, #17a2b8)'
    default: return 'var(--color-text-secondary, #6c757d)'
  }
}

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  return date.toLocaleDateString()
}

export function AlertTimeline() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<string>('all')

  const fetchAlerts = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/alerts')
      const data: AlertsResponse = await res.json()

      if (data.success) {
        // Sort by timestamp (newest first)
        const sortedAlerts = data.data.alerts.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        setAlerts(sortedAlerts)
      } else {
        setError('Failed to fetch alerts')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()

    const interval = setInterval(() => {
      fetchAlerts()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const filteredAlerts = alerts.filter(alert => {
    if (levelFilter !== 'all' && alert.level !== levelFilter) return false
    return true
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-4, 16px)'
    }}>
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-3, 12px)',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: 'var(--spacing-4, 16px)',
        background: 'var(--color-bg-secondary, #111111)',
        borderRadius: 'var(--radius-lg, 8px)',
        border: '1px solid var(--color-border, #2d2d44)'
      }}>
        <div>
          <label
            htmlFor="level-filter"
            style={{
              marginRight: 'var(--spacing-2, 8px)',
              fontWeight: '600',
              color: 'var(--color-text-primary, #e0e0e0)',
              fontSize: 'var(--font-size-sm, 12px)'
            }}>Level:</label>
          <select
            id="level-filter"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              padding: 'var(--spacing-1, 4px) var(--spacing-3, 12px)',
              borderRadius: 'var(--radius-md, 6px)',
              border: '1px solid var(--color-border, #2d2d44)',
              background: 'var(--color-bg-primary, #0a0a0a)',
              color: 'var(--color-text-primary, #e0e0e0)',
              fontSize: 'var(--font-size-sm, 12px)',
              cursor: 'pointer'
            }}
          >
            {LEVEL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchAlerts}
          style={{
            padding: 'var(--spacing-1, 4px) var(--spacing-3, 12px)',
            background: 'var(--color-accent-primary, #00bcd4)',
            color: 'var(--color-text-primary, #e0e0e0)',
            border: 'none',
            borderRadius: 'var(--radius-md, 6px)',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: 'var(--font-size-sm, 12px)'
          }}
        >
          ⟳ Refresh
        </button>

        <span style={{
          color: 'var(--color-text-secondary, #a0a0a0)',
          fontSize: 'var(--font-size-xs, 11px)',
          marginLeft: 'auto'
        }}>
          Showing {filteredAlerts.length} of {alerts.length} alerts
        </span>
      </div>

      {loading && (
        <div style={{
          padding: 'var(--spacing-4, 16px)',
          textAlign: 'center',
          color: 'var(--color-text-secondary, #a0a0a0)',
          fontSize: 'var(--font-size-base, 14px)'
        }}>
          Loading alerts...
        </div>
      )}

      {error && (
        <div style={{
          padding: 'var(--spacing-3, 12px)',
          background: 'var(--color-status-error, #f44336)20',
          color: 'var(--color-status-error, #f44336)',
          borderRadius: 'var(--radius-md, 6px)',
          borderLeft: '3px solid var(--color-status-error, #f44336)',
          fontSize: 'var(--font-size-sm, 12px)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && filteredAlerts.length === 0 && (
        <div style={{
          padding: 'var(--spacing-4, 16px)',
          textAlign: 'center',
          color: 'var(--color-text-secondary, #a0a0a0)',
          fontSize: 'var(--font-size-base, 14px)',
          fontStyle: 'italic'
        }}>
          No alerts to display
        </div>
      )}

      {!loading && !error && filteredAlerts.length > 0 && (
        <div style={{
          position: 'relative',
          paddingLeft: 'var(--spacing-4, 16px)'
        }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            left: 'var(--spacing-2, 8px)',
            top: 0,
            bottom: 0,
            width: '2px',
            background: 'var(--color-border, #2d2d44)'
          }} />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-3, 12px)'
          }}>
            {filteredAlerts.map((alert, idx) => {
              const levelColor = getLevelColor(alert.level)
              const isLast = idx === filteredAlerts.length - 1
              
              return (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    gap: 'var(--spacing-3, 12px)',
                    alignItems: 'flex-start'
                  }}
                >
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: `calc(-1 * var(--spacing-4, 16px) - 4px)`,
                    top: 'var(--spacing-2, 8px)',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: levelColor,
                    border: `2px solid var(--color-bg-primary, #0a0a0a)`,
                    zIndex: 1
                  }} />

                  {/* Timeline content */}
                  <div style={{
                    flex: 1,
                    padding: 'var(--spacing-3, 12px)',
                    background: 'var(--color-bg-secondary, #111111)',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: `1px solid var(--color-border, #2d2d44)`,
                    fontSize: 'var(--font-size-sm, 12px)'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: 'var(--spacing-2, 8px)',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-2, 8px)',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        padding: '2px var(--spacing-2, 8px)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        background: `${levelColor}20`,
                        color: levelColor,
                        fontWeight: '600',
                        fontSize: 'var(--font-size-xs, 11px)',
                        textTransform: 'uppercase'
                      }}>
                        {alert.level}
                      </span>

                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: 'var(--font-size-xs, 11px)',
                        color: 'var(--color-text-secondary, #a0a0a0)'
                      }}>
                        {formatRelativeTime(alert.timestamp)}
                      </span>
                    </div>

                    <div style={{
                      color: 'var(--color-text-primary, #e0e0e0)',
                      lineHeight: '1.4'
                    }}>
                      {alert.message}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
