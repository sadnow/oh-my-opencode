import { useState, useEffect } from 'react'

interface RoutingLogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'decision'
  category: 'tier_change' | 'upgrade_scheduled' | 'downgrade_scheduled' | 'upgrade_executed' | 'downgrade_executed' | 'budget_alert' | 'override' | 'adaptive'
  message: string
  metadata?: Record<string, any>
}

interface RoutingLogsResponse {
  success: boolean
  data: {
    logs: RoutingLogEntry[]
    stats: Record<string, any>
  }
}

const LEVEL_OPTIONS = [
  { value: 'all', label: 'All Levels' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'decision', label: 'Decision' }
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'tier_change', label: 'Tier Change' },
  { value: 'upgrade_scheduled', label: 'Upgrade Scheduled' },
  { value: 'downgrade_scheduled', label: 'Downgrade Scheduled' },
  { value: 'upgrade_executed', label: 'Upgrade Executed' },
  { value: 'downgrade_executed', label: 'Downgrade Executed' },
  { value: 'budget_alert', label: 'Budget Alert' },
  { value: 'override', label: 'Override' },
  { value: 'adaptive', label: 'Adaptive' }
]

const getLevelColor = (level: string): string => {
  switch (level) {
    case 'error': return 'var(--color-danger, #dc3545)'
    case 'warning': return 'var(--color-warning, #ffc107)'
    case 'info': return 'var(--color-info, #17a2b8)'
    case 'decision': return 'var(--color-success, #28a745)'
    default: return 'var(--color-text-secondary, #6c757d)'
  }
}

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString()
}

export function LoggedAlertsPanel() {
  const [logs, setLogs] = useState<RoutingLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/routing-logs?limit=50')
      const data: RoutingLogsResponse = await res.json()

      if (data.success) {
        setLogs(data.data.logs)
      } else {
        setError('Failed to fetch routing logs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()

    const interval = setInterval(() => {
      fetchLogs()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false
    return true
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '16px',
        background: 'var(--color-surface-secondary, #1a1a2e)',
        borderRadius: '8px',
        border: '1px solid var(--color-border, #2d2d44)'
      }}>
        <div>
          <label
            htmlFor="level-filter"
            style={{
              marginRight: '8px',
              fontWeight: '600',
              color: 'var(--color-text-primary, #fff)',
              fontSize: '13px'
            }}>Level:</label>
          <select
            id="level-filter"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid var(--color-border, #2d2d44)',
              background: 'var(--color-surface-primary, #0f0f1a)',
              color: 'var(--color-text-primary, #fff)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {LEVEL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="category-filter"
            style={{
              marginRight: '8px',
              fontWeight: '600',
              color: 'var(--color-text-primary, #fff)',
              fontSize: '13px'
            }}>Category:</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid var(--color-border, #2d2d44)',
              background: 'var(--color-surface-primary, #0f0f1a)',
              color: 'var(--color-text-primary, #fff)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchLogs}
          style={{
            padding: '6px 16px',
            background: 'var(--color-primary, #0066cc)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '13px'
          }}
        >
          ⟳ Refresh
        </button>

        <span style={{
          color: 'var(--color-text-secondary, #6c757d)',
          fontSize: '12px',
          marginLeft: 'auto'
        }}>
          Showing {filteredLogs.length} of {logs.length} alerts
        </span>
      </div>

      {loading && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--color-text-secondary, #6c757d)',
          fontSize: '14px'
        }}>
          Loading alerts...
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px',
          background: 'var(--color-danger, #dc3545)20',
          color: 'var(--color-danger, #dc3545)',
          borderRadius: '6px',
          borderLeft: '3px solid var(--color-danger, #dc3545)',
          fontSize: '13px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && filteredLogs.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--color-text-secondary, #6c757d)',
          fontSize: '14px',
          fontStyle: 'italic'
        }}>
          No alerts to display
        </div>
      )}

      {!loading && !error && filteredLogs.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {filteredLogs.map((log, idx) => {
            const levelColor = getLevelColor(log.level)
            return (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  borderRadius: '6px',
                  background: 'var(--color-surface-secondary, #1a1a2e)',
                  borderLeft: `3px solid ${levelColor}`,
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  fontSize: '13px'
                }}
              >
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: 'var(--color-text-secondary, #6c757d)',
                  minWidth: '160px',
                  paddingTop: '2px'
                }}>
                  {formatTimestamp(log.timestamp)}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  flex: 1
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '3px',
                      background: `${levelColor}20`,
                      color: levelColor,
                      fontWeight: '600',
                      fontSize: '11px',
                      textTransform: 'uppercase'
                    }}>
                      {log.level}
                    </span>

                    <span style={{
                      color: 'var(--color-text-secondary, #6c757d)',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {log.category}
                    </span>
                  </div>

                  <div style={{
                    color: 'var(--color-text-primary, #fff)',
                    lineHeight: '1.4'
                  }}>
                    {log.message}
                  </div>

                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div style={{
                      marginTop: '4px',
                      padding: '8px',
                      background: 'var(--color-surface-primary, #0f0f1a)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: 'var(--color-text-secondary, #6c757d)',
                      overflowX: 'auto'
                    }}>
                      {JSON.stringify(log.metadata, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}