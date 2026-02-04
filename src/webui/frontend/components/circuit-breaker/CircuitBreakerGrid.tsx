import React, { useState, useMemo } from 'react'
import { useCircuitStatus, type ProviderStatus, type ModelStatus } from './useCircuitStatus'
import { ProviderModelCell } from './ProviderModelCell'

interface CircuitBreakerGridProps {
  onModelClick?: (provider: string, modelId: string, status: ModelStatus) => void
}

/**
 * CircuitBreakerGrid - Main circuit breaker visualization dashboard.
 * Bloomberg Terminal aesthetic: compact, information-dense, professional.
 * 
 * Displays all providers as sections with their models as cells.
 * Features: summary stats, filter toggle, loading/error states, auto-refresh.
 */
export const CircuitBreakerGrid: React.FC<CircuitBreakerGridProps> = ({ onModelClick }) => {
  const { providers, isLoading, error, lastUpdated, refresh } = useCircuitStatus()
  const [filter, setFilter] = useState<'all' | 'unhealthy'>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Compute summary statistics
  const stats = useMemo(() => {
    if (!providers) {
      return { total: 0, healthy: 0, degraded: 0, failed: 0, unavailable: 0 }
    }

    let total = 0
    let healthy = 0
    let degraded = 0
    let failed = 0
    let unavailable = 0

    Object.values(providers).forEach((provider: ProviderStatus) => {
      Object.values(provider.models).forEach((model: ModelStatus) => {
        total++

        if (!model.available || !model.inCache) {
          unavailable++
        } else if (model.circuit.state === 'open') {
          failed++
        } else if (model.circuit.state === 'half_open') {
          degraded++
        } else {
          healthy++
        }
      })
    })

    return { total, healthy, degraded, failed, unavailable }
  }, [providers])

  // Filter providers/models based on filter setting
  const filteredProviders = useMemo(() => {
    if (!providers || filter === 'all') {
      return providers
    }

    // Filter out healthy models
    const filtered: Record<string, ProviderStatus> = {}
    Object.entries(providers).forEach(([providerName, provider]: [string, ProviderStatus]) => {
      const unhealthyModels = Object.entries(provider.models).filter(
        ([_, model]: [string, ModelStatus]) =>
          !model.available ||
          !model.inCache ||
          model.circuit.state === 'open' ||
          model.circuit.state === 'half_open'
      )

      if (unhealthyModels.length > 0) {
        filtered[providerName] = {
          ...provider,
          models: Object.fromEntries(unhealthyModels),
        }
      }
    })

    return filtered
  }, [providers, filter])

  // Format relative time
  const formatRelativeTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never'
    const now = Date.now()
    const seconds = Math.floor((now - timestamp) / 1000)

    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  // Handle refresh with UI feedback
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      // Keep spinner visible for minimum duration
      setTimeout(() => setIsRefreshing(false), 300)
    }
  }

  // Loading state
  if (isLoading && !providers) {
    return (
      <div
        style={{
          padding: 'var(--spacing-4)',
          backgroundColor: 'var(--color-bg-primary)',
          minHeight: '100vh',
          fontFamily: 'var(--font-family-mono)',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid var(--color-border-default)',
              borderTopColor: 'var(--color-accent-primary)',
              borderRadius: '50%',
              margin: '0 auto var(--spacing-2)',
              animation: 'spin 1s linear infinite',
            }}
          />
          Loading circuit breaker status...
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          padding: 'var(--spacing-4)',
          backgroundColor: 'var(--color-bg-primary)',
          minHeight: '100vh',
          fontFamily: 'var(--font-family-mono)',
          color: 'var(--color-status-error)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-2)' }}>
            ⚠ Error Loading Circuit Status
          </div>
          <div style={{ marginBottom: 'var(--spacing-3)', color: 'var(--color-text-secondary)' }}>
            {error}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              padding: 'var(--spacing-2) var(--spacing-3)',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-mono)',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (!filteredProviders || Object.keys(filteredProviders).length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-4)',
          backgroundColor: 'var(--color-bg-primary)',
          minHeight: '100vh',
          fontFamily: 'var(--font-family-mono)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-3)',
            paddingBottom: 'var(--spacing-2)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <h1
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              CIRCUIT BREAKER STATUS
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Last: {formatRelativeTime(lastUpdated)}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: 'var(--spacing-1) var(--spacing-2)',
                backgroundColor: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-mono)',
                opacity: isRefreshing ? 0.5 : 1,
              }}
              title="Refresh status"
            >
              {isRefreshing ? '⟳' : '↻'}
            </button>
          </div>
        </div>

        {/* Empty message */}
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-4)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {filter === 'unhealthy'
            ? 'No unhealthy models detected. All systems operational.'
            : 'No circuit breaker data available.'}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 'var(--spacing-4)',
        backgroundColor: 'var(--color-bg-primary)',
        minHeight: '100vh',
        fontFamily: 'var(--font-family-mono)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-3)',
          paddingBottom: 'var(--spacing-2)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            CIRCUIT BREAKER STATUS
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Last: {formatRelativeTime(lastUpdated)}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: 'var(--spacing-1) var(--spacing-2)',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-primary)',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-mono)',
              opacity: isRefreshing ? 0.5 : 1,
              transition: 'opacity var(--transition-fast)',
            }}
            title="Refresh status"
          >
            {isRefreshing ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-3)',
          marginBottom: 'var(--spacing-3)',
          padding: 'var(--spacing-2)',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-text-secondary)',
            }}
          />
          <span style={{ color: 'var(--color-text-primary)' }}>{stats.total} models</span>
        </div>

        <div
          style={{
            width: '1px',
            height: '12px',
            backgroundColor: 'var(--color-border-default)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-success)',
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)' }}>{stats.healthy} healthy</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-warning)',
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)' }}>{stats.degraded} degraded</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-error)',
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)' }}>{stats.failed} failed</span>
        </div>

        {stats.unavailable > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-status-info)',
              }}
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {stats.unavailable} unavailable
            </span>
          </div>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'unhealthy')}
            style={{
              padding: 'var(--spacing-1) var(--spacing-2)',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-family-mono)',
              cursor: 'pointer',
            }}
          >
            <option value="all">Show All</option>
            <option value="unhealthy">Show Unhealthy Only</option>
          </select>
        </div>
      </div>

      {/* Provider Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        {Object.entries(filteredProviders)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([providerName, provider]: [string, ProviderStatus]) => {
            const modelCount = Object.keys(provider.models).length
            const connectionStatus = provider.connected
              ? 'var(--color-status-success)'
              : 'var(--color-status-error)'

            return (
              <div key={providerName}>
                {/* Provider Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    marginBottom: 'var(--spacing-2)',
                    paddingBottom: 'var(--spacing-1)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: connectionStatus,
                      flexShrink: 0,
                    }}
                    title={provider.connected ? 'Connected' : 'Disconnected'}
                  />
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {providerName}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-dim)',
                    }}
                  >
                    {modelCount} model{modelCount !== 1 ? 's' : ''}
                  </span>
                  {provider.autoDisabled && (
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-status-warning)',
                        padding: '2px var(--spacing-1)',
                        backgroundColor: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      title="Provider auto-disabled due to quota/errors"
                    >
                      AUTO-DISABLED
                    </span>
                  )}
                  {provider.quotaTarget !== null && (
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      Usage: {provider.usagePercent.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Model Grid */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-2)',
                  }}
                >
                  {Object.entries(provider.models)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([modelId, modelStatus]: [string, ModelStatus]) => (
                      <ProviderModelCell
                        key={modelId}
                        modelId={modelId}
                        provider={providerName}
                        status={modelStatus}
                        onClick={
                          onModelClick
                            ? () => onModelClick(providerName, modelId, modelStatus)
                            : undefined
                        }
                      />
                    ))}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

export default CircuitBreakerGrid
