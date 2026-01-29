import { useState, useEffect } from 'react'

interface HealthCheckData {
  healthy: boolean
  warnings: string[]
  checks: {
    fileExists: boolean
    recentlyUpdated: boolean
    hasRecentRecords: boolean
    noZeroOutputTokens: boolean
    validCosts: boolean
  }
  stats?: {
    totalRecords: number
    recentRecords: number
    avgInputTokens: number
    avgOutputTokens: number
    avgCost: number
    lastUpdateAge: number
  }
}

interface HealthCheckResponse {
  success: boolean
  data?: HealthCheckData
  error?: string
}

export function HealthIndicator() {
  const [data, setData] = useState<HealthCheckData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/health-check')
      const healthData: HealthCheckResponse = await res.json()
      
      if (healthData.success && healthData.data) {
        setData(healthData.data)
      } else {
        setError(healthData.error || 'Failed to fetch health status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  const getStatusColor = () => {
    if (!data) return '#6c757d'
    if (!data.healthy) {
      // Check for critical warnings
      const hasCritical = data.warnings.some(w => w.includes('CRITICAL'))
      if (hasCritical) return '#dc3545' // red
      return '#ffc107' // yellow
    }
    return '#28a745' // green
  }

  const getStatusText = () => {
    if (!data) return 'Unknown'
    if (!data.healthy) {
      const hasCritical = data.warnings.some(w => w.includes('CRITICAL'))
      if (hasCritical) return 'Critical'
      return 'Warning'
    }
    return 'Healthy'
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatAge = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Health Status</h2>
          <p style={{ color: '#666', marginTop: '5px' }}>Usage tracking system health</p>
        </div>
        <button 
          onClick={fetchHealth}
          disabled={loading}
          style={{ 
            padding: '8px 16px', 
            background: loading ? '#ccc' : '#0066cc', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⟳ Refresh
        </button>
      </div>

      {loading && <p style={{ color: '#666' }}>Loading health status...</p>}
      
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

      {!loading && !error && data && (
        <>
          {/* Status Badge */}
          <div style={{ 
            padding: '20px', 
            background: '#f8f9fa', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '2px solid ' + getStatusColor()
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ 
                padding: '8px 16px', 
                borderRadius: '4px', 
                background: getStatusColor(),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                {getStatusText()}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {data.healthy ? 'All systems operational' : 'Issues detected'}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Warnings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.warnings.map((warning, index) => (
                  <div 
                    key={index}
                    style={{ 
                      padding: '12px', 
                      background: warning.includes('CRITICAL') ? '#f8d7da' : '#fff3cd',
                      color: warning.includes('CRITICAL') ? '#721c24' : '#856404',
                      borderRadius: '4px',
                      border: '1px solid ' + (warning.includes('CRITICAL') ? '#f5c6cb' : '#ffeeba')
                    }}
                  >
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health Checks */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Health Checks</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {Object.entries(data.checks).map(([check, passed]) => (
                <div 
                  key={check}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '8px',
                    background: 'white',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}
                >
                  <span style={{ 
                    fontSize: '18px',
                    color: passed ? '#28a745' : '#dc3545'
                  }}>
                    {passed ? '✓' : '✗'}
                  </span>
                  <span style={{ textTransform: 'capitalize' }}>
                    {check.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          {data.stats && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Statistics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                <div style={{ 
                  padding: '15px', 
                  background: 'white', 
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Records</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {formatNumber(data.stats.totalRecords)}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px', 
                  background: 'white', 
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Recent Records</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {formatNumber(data.stats.recentRecords)}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px', 
                  background: 'white', 
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Avg Input Tokens</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {formatNumber(data.stats.avgInputTokens)}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px', 
                  background: 'white', 
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Avg Output Tokens</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {formatNumber(data.stats.avgOutputTokens)}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px', 
                  background: 'white', 
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Avg Cost</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {formatCurrency(data.stats.avgCost)}
                  </div>
                </div>
                <div style={{ 
                  padding: '15px', 
                  background: 'white', 
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Last Update</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                    {formatAge(data.stats.lastUpdateAge)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}