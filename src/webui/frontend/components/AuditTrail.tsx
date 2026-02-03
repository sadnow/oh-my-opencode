import { useState, useEffect } from 'react'
import { ExportButton } from './ExportButton'

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

type TimeRange = '1h' | '24h' | '7d' | 'all'

export function AuditTrail() {
  const [logs, setLogs] = useState<RoutingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const now = Date.now()
      let startTime: number | undefined
      
      switch (timeRange) {
        case '1h':
          startTime = now - 60 * 60 * 1000
          break
        case '24h':
          startTime = now - 24 * 60 * 60 * 1000
          break
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000
          break
        case 'all':
          startTime = undefined
          break
      }
      
      const params = new URLSearchParams({ limit: '100' })
      if (startTime) {
        params.append('startTime', startTime.toString())
      }
      
      const res = await fetch(`/api/routing-logs?${params.toString()}`)
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
  }, [timeRange])

  const filteredLogs = logs.filter(log => {
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

  const timeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case '1h': return 'Last 1 hour'
      case '24h': return 'Last 24 hours'
      case '7d': return 'Last 7 days'
      case 'all': return 'All time'
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="time-range-filter" style={{ marginRight: '8px', fontWeight: 'bold' }}>Time Range:</label>
          <select
            id="time-range-filter"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="category-filter" style={{ marginRight: '8px', fontWeight: 'bold' }}>Category:</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
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
            padding: '5px 15px', 
            background: '#0066cc', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⟳ Refresh
        </button>
        
        <ExportButton 
          endpoint="/api/export/routing-logs"
          label="Export"
          filename="audit-trail"
        />
        
        <span style={{ color: '#666', fontSize: '14px' }}>
          Showing {filteredLogs.length} of {logs.length} logs ({timeRangeLabel(timeRange)})
        </span>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading audit trail...</p>}
      
      {error && (
        <div style={{ 
          padding: '15px', 
          background: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && filteredLogs.length === 0 && (
        <p style={{ color: '#666', fontStyle: 'italic' }}>No routing logs found for the selected time range.</p>
      )}

      {!loading && !error && filteredLogs.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            fontSize: '14px',
            background: 'white'
          }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Timestamp</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Level</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Category</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Model</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Message</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => (
                <tr 
                  key={idx} 
                  style={{ 
                    borderBottom: '1px solid #dee2e6'
                  }}
                >
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: '12px', color: '#666' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '3px', 
                      background: levelColor(log.level) + '20',
                      color: levelColor(log.level),
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {log.level.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: '500' }}>{log.category}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {log.metadata?.model || '-'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>{log.message}</td>
                  <td style={{ padding: '10px 8px', color: '#666', fontSize: '13px' }}>
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