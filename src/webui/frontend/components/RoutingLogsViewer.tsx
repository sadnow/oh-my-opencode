import { useState, useEffect } from 'react'

interface RoutingLog {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  category: string
  message: string
  metadata?: {
    model?: string
    reason?: string
  }
}

interface RoutingLogsResponse {
  success: boolean
  data: {
    logs: RoutingLog[]
    total: number
  }
}

export function RoutingLogsViewer() {
  const [logs, setLogs] = useState<RoutingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/routing-logs?limit=100')
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
  }, [])

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false
    return true
  })

  const categories = Array.from(new Set(logs.map(log => log.category)))

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return '#dc3545'
      case 'warn': return '#ffc107'
      case 'info': return '#17a2b8'
      default: return '#6c757d'
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-4, 16px)', display: 'flex', gap: 'var(--spacing-3, 12px)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ marginRight: 'var(--spacing-2, 8px)', fontWeight: 'bold' }}>Level:</label>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{ padding: 'var(--spacing-1, 4px) var(--spacing-2, 8px)', borderRadius: 'var(--radius-sm, 4px)', border: '1px solid var(--color-border-default, #333)', background: 'var(--color-bg-secondary, #111)', color: 'var(--color-text-primary, #e0e0e0)', fontSize: 'var(--font-size-sm, 12px)' }}
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div>
          <label style={{ marginRight: 'var(--spacing-2, 8px)', fontWeight: 'bold' }}>Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: 'var(--spacing-1, 4px) var(--spacing-2, 8px)', borderRadius: 'var(--radius-sm, 4px)', border: '1px solid var(--color-border-default, #333)', background: 'var(--color-bg-secondary, #111)', color: 'var(--color-text-primary, #e0e0e0)', fontSize: 'var(--font-size-sm, 12px)' }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchLogs}
          style={{
            padding: 'var(--spacing-1, 4px) var(--spacing-3, 12px)',
            background: 'var(--color-accent-info, #2196f3)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm, 4px)',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 'var(--font-size-sm, 12px)'
          }}
        >
          ⟳ Refresh
        </button>

        <span style={{ color: 'var(--color-text-secondary, #a0a0a0)', fontSize: 'var(--font-size-sm, 12px)' }}>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
      </div>

      {loading && <p style={{ color: 'var(--color-text-secondary, #a0a0a0)', fontSize: 'var(--font-size-sm, 12px)' }}>Loading routing logs...</p>}

      {error && (
        <div style={{
          padding: 'var(--spacing-3, 12px)',
          background: 'var(--color-status-error, #f44336)20',
          color: 'var(--color-status-error, #f44336)',
          borderRadius: 'var(--radius-sm, 4px)',
          marginBottom: 'var(--spacing-3, 12px)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && filteredLogs.length === 0 && (
        <p style={{ color: 'var(--color-text-secondary, #a0a0a0)', fontStyle: 'italic', fontSize: 'var(--font-size-sm, 12px)' }}>No routing logs found.</p>
      )}

      {!loading && !error && filteredLogs.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--font-size-sm, 12px)',
            background: 'var(--color-bg-primary, #0a0a0a)'
          }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-secondary, #111)', borderBottom: '2px solid var(--color-border-default, #333)' }}>
                <th style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'left', fontWeight: 'bold', fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #a0a0a0)' }}>Timestamp</th>
                <th style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'left', fontWeight: 'bold', fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #a0a0a0)' }}>Level</th>
                <th style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'left', fontWeight: 'bold', fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #a0a0a0)' }}>Category</th>
                <th style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'left', fontWeight: 'bold', fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #a0a0a0)' }}>Model</th>
                <th style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'left', fontWeight: 'bold', fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #a0a0a0)' }}>Message</th>
                <th style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'left', fontWeight: 'bold', fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-secondary, #a0a0a0)' }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle, #2a2a2a)'
                  }}
                >
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs, 11px)', color: 'var(--color-text-muted, #666)' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)' }}>
                    <span style={{
                      padding: 'var(--spacing-1, 4px) var(--spacing-2, 8px)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      background: levelColor(log.level) + '20',
                      color: levelColor(log.level),
                      fontWeight: 'bold',
                      fontSize: 'var(--font-size-xs, 11px)'
                    }}>
                      {log.level.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', fontWeight: '500' }}>{log.category}</td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs, 11px)' }}>
                    {log.metadata?.model || '-'}
                  </td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)' }}>{log.message}</td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: 'var(--color-text-muted, #666)', fontSize: 'var(--font-size-xs, 11px)' }}>
                    {log.metadata?.reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
