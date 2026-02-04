import React from 'react'
import type { ModelStatus } from './useCircuitStatus'

interface ProviderModelCellProps {
  modelId: string
  provider: string
  status: ModelStatus
  onClick?: () => void
}

/**
 * ProviderModelCell - Display a single model's circuit breaker status.
 * Bloomberg Terminal aesthetic: compact, information-dense, status light indicators.
 */
export const ProviderModelCell: React.FC<ProviderModelCellProps> = ({
  modelId,
  status,
  onClick,
}) => {
  // Status light color logic
  const getStatusColor = (): string => {
    // BLUE: unavailable or not in cache
    if (!status.available || !status.inCache) {
      return 'var(--color-status-info)'
    }

    // RED: circuit open (failed)
    if (status.circuit.state === 'open') {
      return 'var(--color-status-error)'
    }

    // YELLOW: half_open (degraded, testing)
    if (status.circuit.state === 'half_open') {
      return 'var(--color-status-warning)'
    }

    // GREEN: closed and healthy
    return 'var(--color-status-success)'
  }

  const statusColor = getStatusColor()
  const isHealthy = status.circuit.state === 'closed' && status.available && status.inCache

  // Format latency
  const formatLatency = (latency: number | null): string => {
    if (latency === null) return '—'
    if (latency < 1000) return `${Math.round(latency)}ms`
    return `${(latency / 1000).toFixed(1)}s`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className="provider-model-cell"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        width: '160px',
        padding: 'var(--spacing-2)',
        backgroundColor: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-sm)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
        fontFamily: 'var(--font-family-mono)',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'
          e.currentTarget.style.borderColor = 'var(--color-border-default)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
        e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
      }}
    >
      {/* Status dot + model name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-1)',
          marginBottom: 'var(--spacing-1)',
        }}
      >
        {/* Status light dot with pulse/glow for non-healthy states */}
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            flexShrink: 0,
            boxShadow: isHealthy
              ? 'none'
              : `0 0 6px ${statusColor}, 0 0 3px ${statusColor}`,
            animation: isHealthy ? 'none' : 'pulse-glow 2s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 'var(--line-height-tight)',
          }}
          title={modelId}
        >
          {modelId}
        </span>
      </div>

      {/* Metrics: latency + failure count */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          lineHeight: 'var(--line-height-tight)',
        }}
      >
        <span>{formatLatency(status.circuit.lastLatencyMs)}</span>
        <span>
          {status.circuit.failureCount} fail{status.circuit.failureCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Inline keyframe animation for pulse/glow */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  )
}

export default ProviderModelCell
