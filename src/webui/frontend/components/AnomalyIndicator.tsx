import type { AnomalyRecord } from '../../../features/budget-orchestrator/anomaly-detector'

interface AnomalyIndicatorProps {
  anomalies: AnomalyRecord[]
  onDismiss?: (id: string) => void
}

export function AnomalyIndicator({ anomalies, onDismiss }: AnomalyIndicatorProps) {
  const activeAnomalies = anomalies.filter(a => !a.dismissed)

  const getAnomalyColor = (type: AnomalyRecord['type']) => {
    switch (type) {
      case 'spike':
        return 'var(--color-danger, #dc3545)'
      case 'sustained_high':
        return 'var(--color-warning, #ffc107)'
      case 'sudden_drop':
        return 'var(--color-info, #17a2b8)'
      default:
        return 'var(--color-info, #17a2b8)'
    }
  }

  const getAnomalyIcon = (type: AnomalyRecord['type']) => {
    switch (type) {
      case 'spike':
        return '⚡'
      case 'sustained_high':
        return '📈'
      case 'sudden_drop':
        return '📉'
      default:
        return '⚠️'
    }
  }

  const getAnomalyLabel = (type: AnomalyRecord['type']) => {
    switch (type) {
      case 'spike':
        return 'Spike'
      case 'sustained_high':
        return 'Sustained High'
      case 'sudden_drop':
        return 'Sudden Drop'
      default:
        return 'Unknown'
    }
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num)
  }

  if (activeAnomalies.length === 0) {
    return null
  }

  return (
    <div style={{
      background: 'var(--bg-secondary, #1a1a1a)',
      border: '1px solid var(--border-color, #333)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-color, #333)'
      }}>
        <span style={{
          fontSize: '18px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>🔔</span>
        <span style={{
          color: 'var(--text-primary, #e0e0e0)',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          {activeAnomalies.length} Anomaly{activeAnomalies.length > 1 ? 'ies' : ''} Detected
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeAnomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            style={{
              background: 'var(--bg-tertiary, #252525)',
              border: `1px solid ${getAnomalyColor(anomaly.type)}40`,
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              position: 'relative'
            }}
          >
            {/* Pulsing indicator dot */}
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: getAnomalyColor(anomaly.type),
              marginTop: '6px',
              animation: 'pulse 1.5s ease-in-out infinite',
              boxShadow: `0 0 8px ${getAnomalyColor(anomaly.type)}`
            }} />

            {/* Content */}
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{ fontSize: '16px' }}>{getAnomalyIcon(anomaly.type)}</span>
                <span style={{
                  color: getAnomalyColor(anomaly.type),
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {getAnomalyLabel(anomaly.type)}
                </span>
                <span style={{
                  color: 'var(--text-secondary, #888)',
                  fontSize: '11px'
                }}>
                  • {formatTimestamp(anomaly.timestamp)}
                </span>
              </div>

              <div style={{
                color: 'var(--text-primary, #e0e0e0)',
                fontSize: '12px',
                lineHeight: '1.5'
              }}>
                <div>
                  <strong>Z-Score:</strong> {formatNumber(anomaly.zScore)}{' '}
                  <span style={{ color: 'var(--text-secondary, #888)' }}>
                    (threshold: {formatNumber(anomaly.threshold)})
                  </span>
                </div>
                <div>
                  <strong>Value:</strong> {formatNumber(anomaly.value)}{' '}
                  <span style={{ color: 'var(--text-secondary, #888)' }}>
                    vs baseline: {formatNumber(anomaly.baseline)}
                  </span>
                </div>
              </div>
            </div>

            {/* Dismiss button */}
            {onDismiss && (
              <button
                onClick={() => onDismiss(anomaly.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary, #888)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover, #333)'
                  e.currentTarget.style.color = 'var(--text-primary, #e0e0e0)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary, #888)'
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}