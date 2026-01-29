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
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Level:</label>
          <select 
            value={levelFilter} 
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Category:</label>
          <select 
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
        
        <span style={{ color: '#666', fontSize: '14px' }}>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading routing logs...</p>}
      
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
        <p style={{ color: '#666', fontStyle: 'italic' }}>No routing logs found.</p>
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
