import React, { useEffect, useCallback } from 'react'
import type { ModelStatus } from './useCircuitStatus'

// ============================================================================
// Types
// ============================================================================

interface CircuitDetailModalProps {
  isOpen: boolean
  onClose: () => void
  modelId: string
  provider: string
  status: ModelStatus
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format timestamp as relative time (e.g., "2m ago", "1h ago", "Never")
 */
function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Never'

  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  if (seconds > 5) return `${seconds}s ago`
  return 'Just now'
}

/**
 * Get color for circuit state badge
 */
function getStateColor(state: string): string {
  switch (state.toUpperCase()) {
    case 'CLOSED':
      return 'var(--color-status-success)'
    case 'HALF_OPEN':
      return 'var(--color-status-warning)'
    case 'OPEN':
      return 'var(--color-status-error)'
    default:
      return 'var(--color-text-secondary)'
  }
}

/**
 * Get status dot color based on circuit state
 */
function getStatusDotColor(state: string): string {
  switch (state.toUpperCase()) {
    case 'CLOSED':
      return '#4caf50'
    case 'HALF_OPEN':
      return '#ff9800'
    case 'OPEN':
      return '#f44336'
    default:
      return '#666666'
  }
}

// ============================================================================
// Component
// ============================================================================

export const CircuitDetailModal: React.FC<CircuitDetailModalProps> = ({
  isOpen,
  onClose,
  modelId,
  provider,
  status,
}) => {
  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    },
    [isOpen, onClose]
  )

  // Attach/detach keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  // Don't render if not open
  if (!isOpen) return null

  const circuitState = status.circuit.state.toUpperCase()
  const stateColor = getStateColor(circuitState)
  const dotColor = getStatusDotColor(circuitState)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 'var(--z-modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-4)',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="circuit-modal-title"
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal content */}
      <div
        style={{
          position: 'relative',
          zIndex: 'var(--z-modal)',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          maxWidth: '440px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          fontFamily: 'var(--font-family-sans)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
        role="document"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          {/* Status dot */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: dotColor,
              flexShrink: 0,
            }}
            aria-hidden="true"
          />

          {/* Model name */}
          <div
            id="circuit-modal-title"
            style={{
              flex: 1,
              fontSize: 'var(--font-size-base)',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {provider} / {modelId}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-lg)',
              cursor: 'pointer',
              lineHeight: 1,
              transition: 'color var(--transition-fast)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)'
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 'var(--spacing-4)',
          }}
        >
          {/* Circuit State Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-4)',
              marginBottom: 'var(--spacing-3)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                width: '110px',
                flexShrink: 0,
              }}
            >
              Circuit State
            </span>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: `${stateColor}22`,
                color: stateColor,
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                fontFamily: 'var(--font-family-mono)',
                letterSpacing: '0.5px',
              }}
            >
              {circuitState}
            </span>
          </div>

          {/* Metrics rows */}
          <MetricRow label="Available" value={status.available ? 'Yes' : 'No'} />
          <MetricRow label="In Cache" value={status.inCache ? 'Yes' : 'No'} />

          {/* Section divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              margin: 'var(--spacing-4) 0 var(--spacing-3)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
              }}
            >
              Metrics
            </span>
            <div
              style={{
                flex: 1,
                height: '1px',
                backgroundColor: 'var(--color-border-subtle)',
              }}
            />
          </div>

          <MetricRow label="Failure Count" value={status.circuit.failureCount.toString()} />
          <MetricRow
            label="Last Latency"
            value={status.circuit.lastLatencyMs ? `${status.circuit.lastLatencyMs}ms` : 'N/A'}
          />
          <MetricRow
            label="Last Success"
            value={formatRelativeTime(status.circuit.lastSuccessAt)}
          />
          <MetricRow
            label="Last Failure"
            value={formatRelativeTime(status.circuit.lastFailureAt)}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Metric Row Component
// ============================================================================

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--spacing-4)',
      marginBottom: 'var(--spacing-2)',
    }}
  >
    <span
      style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        width: '110px',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family-mono)',
      }}
    >
      {value}
    </span>
  </div>
)
