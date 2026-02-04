import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// Types
// ============================================================================

interface CircuitState {
  state: 'closed' | 'open' | 'half_open'
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  lastLatencyMs: number | null
}

interface ModelStatus {
  circuit: CircuitState
  available: boolean
  inCache: boolean
}

interface ProviderStatus {
  connected: boolean
  usagePercent: number
  quotaTarget: number | null
  autoDisabled: boolean
  models: Record<string, ModelStatus>
}

interface CircuitStatusData {
  timestamp: number
  providers: Record<string, ProviderStatus>
}

interface ProviderDashboardData {
  provider: string
  budget: number
  used: number
  percentage: number
  trend: "under" | "on-track" | "over"
}

interface BudgetDashboardData {
  success: boolean
  data: {
    enabled: boolean
    providers: ProviderDashboardData[]
  }
}

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

interface ProviderHealth {
  name: string
  status: HealthStatus
  budgetPercent: number
  modelsUp: number
  modelsTotal: number
  avgLatencyMs: number | null
  autoDisabled: boolean
}

// ============================================================================
// Component
// ============================================================================

export const ProviderHealthMatrix: React.FC = () => {
  const [providers, setProviders] = useState<ProviderHealth[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealthData = useCallback(async () => {
    try {
      setError(null)

      // Fetch circuit status and budget data in parallel
      const [circuitResponse, budgetResponse] = await Promise.all([
        fetch('/api/orchestration/circuit-status'),
        fetch('/api/budget/dashboard')
      ])

      if (!circuitResponse.ok || !budgetResponse.ok) {
        throw new Error('Failed to fetch provider health data')
      }

      const circuitData: { success: boolean; data: CircuitStatusData } = await circuitResponse.json()
      const budgetData: BudgetDashboardData = await budgetResponse.json()

      if (!circuitData.success || !budgetData.success) {
        throw new Error('Invalid health data response')
      }

      // Build budget lookup
      const budgetMap = new Map<string, number>()
      budgetData.data.providers.forEach(p => {
        budgetMap.set(p.provider, p.percentage)
      })

      // Compute provider health
      const healthData: ProviderHealth[] = Object.entries(circuitData.data.providers).map(
        ([providerName, providerStatus]) => {
          const models = Object.values(providerStatus.models)
          const modelsTotal = models.length
          const modelsUp = models.filter(m => m.available && m.circuit.state === 'closed').length

          // Calculate average latency from models with recent data
          const latencies = models
            .map(m => m.circuit.lastLatencyMs)
            .filter((lat): lat is number => lat !== null && lat > 0)
          const avgLatencyMs = latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : null

          const budgetPercent = budgetMap.get(providerName) ?? 0

          // Determine health status
          let status: HealthStatus = 'unknown'
          const hasOpenCircuit = models.some(m => m.circuit.state === 'open')
          const hasHalfOpenCircuit = models.some(m => m.circuit.state === 'half_open')
          const hasUnavailableModel = models.some(m => !m.available)

          if (hasOpenCircuit || budgetPercent > 90) {
            status = 'critical'
          } else if (hasHalfOpenCircuit || budgetPercent > 70 || hasUnavailableModel) {
            status = 'warning'
          } else if (modelsTotal > 0) {
            status = 'healthy'
          }

          return {
            name: providerName,
            status,
            budgetPercent,
            modelsUp,
            modelsTotal,
            avgLatencyMs,
            autoDisabled: providerStatus.autoDisabled
          }
        }
      )

      // Sort: critical first, then warning, then healthy, then by name
      healthData.sort((a, b) => {
        const statusOrder = { critical: 0, warning: 1, healthy: 2, unknown: 3 }
        const orderDiff = statusOrder[a.status] - statusOrder[b.status]
        return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name)
      })

      setProviders(healthData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Provider health fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchHealthData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchHealthData()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchHealthData])

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const getHealthColor = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return 'var(--color-status-success)'
      case 'warning':
        return 'var(--color-status-warning)'
      case 'critical':
        return 'var(--color-status-error)'
      case 'unknown':
        return 'var(--color-text-muted)'
    }
  }

  const getHealthLabel = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return 'HEALTHY'
      case 'warning':
        return 'WARNING'
      case 'critical':
        return 'CRITICAL'
      case 'unknown':
        return 'UNKNOWN'
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>PROVIDER HEALTH</h2>
        </div>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <span style={styles.loadingText}>Loading provider health data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>PROVIDER HEALTH</h2>
        </div>
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠</span>
          <span style={styles.errorText}>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>PROVIDER HEALTH</h2>
        <span style={styles.subtitle}>{providers.length} PROVIDERS</span>
      </div>

      <div style={styles.grid}>
        {providers.map(provider => (
          <div
            key={provider.name}
            style={{
              ...styles.card,
              borderLeftColor: getHealthColor(provider.status),
              opacity: provider.autoDisabled ? 0.5 : 1
            }}
          >
            {/* Provider name */}
            <div style={styles.cardHeader}>
              <span style={styles.providerName}>{provider.name}</span>
              {provider.autoDisabled && (
                <span style={styles.disabledBadge}>AUTO-DISABLED</span>
              )}
            </div>

            {/* Health status badge */}
            <div
              style={{
                ...styles.healthBadge,
                backgroundColor: getHealthColor(provider.status) + '20',
                color: getHealthColor(provider.status)
              }}
            >
              <span style={styles.healthDot}>●</span>
              <span style={styles.healthLabel}>{getHealthLabel(provider.status)}</span>
            </div>

            {/* Metrics */}
            <div style={styles.metrics}>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Budget:</span>
                <span
                  style={{
                    ...styles.metricValue,
                    color:
                      provider.budgetPercent > 90
                        ? 'var(--color-status-error)'
                        : provider.budgetPercent > 70
                        ? 'var(--color-status-warning)'
                        : 'var(--color-text-primary)'
                  }}
                >
                  {provider.budgetPercent.toFixed(0)}%
                </span>
              </div>

              <div style={styles.metric}>
                <span style={styles.metricLabel}>Models:</span>
                <span style={styles.metricValue}>
                  {provider.modelsUp}/{provider.modelsTotal} up
                </span>
              </div>

              <div style={styles.metric}>
                <span style={styles.metricLabel}>Avg:</span>
                <span style={styles.metricValue}>
                  {provider.avgLatencyMs !== null ? `${provider.avgLatencyMs}ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-4)',
    fontFamily: 'var(--font-family-sans)'
  },

  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-4)',
    paddingBottom: 'var(--spacing-2)',
    borderBottom: '1px solid var(--color-border-subtle)'
  },

  title: {
    margin: 0,
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },

  subtitle: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-mono)',
    letterSpacing: '0.5px'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 'var(--spacing-3)'
  },

  card: {
    background: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border-subtle)',
    borderLeft: '3px solid var(--color-border-default)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--spacing-3)',
    transition: 'all var(--transition-fast)',
    cursor: 'default'
  },

  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-2)',
    gap: 'var(--spacing-2)'
  },

  providerName: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family-mono)',
    textTransform: 'lowercase',
    letterSpacing: '-0.5px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },

  disabledBadge: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-status-error)',
    fontFamily: 'var(--font-family-mono)',
    letterSpacing: '0.3px',
    flexShrink: 0
  },

  healthBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 'var(--spacing-3)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-mono)',
    letterSpacing: '0.5px'
  },

  healthDot: {
    fontSize: '8px',
    lineHeight: '8px'
  },

  healthLabel: {
    lineHeight: 1
  },

  metrics: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-2)'
  },

  metric: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 'var(--font-size-xs)',
    fontFamily: 'var(--font-family-mono)'
  },

  metricLabel: {
    color: 'var(--color-text-secondary)',
    letterSpacing: '0.3px'
  },

  metricValue: {
    color: 'var(--color-text-primary)',
    fontWeight: 600,
    letterSpacing: '-0.3px'
  },

  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-4)',
    gap: 'var(--spacing-3)'
  },

  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--color-border-subtle)',
    borderTop: '3px solid var(--color-accent-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },

  loadingText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-mono)'
  },

  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-4)',
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid var(--color-status-error)',
    borderRadius: 'var(--radius-sm)'
  },

  errorIcon: {
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-status-error)'
  },

  errorText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-status-error)',
    fontFamily: 'var(--font-family-mono)'
  }
}

// Inject keyframes for spinner animation
const styleSheet = document.styleSheets[0]
if (styleSheet) {
  try {
    styleSheet.insertRule(`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `, styleSheet.cssRules.length)
  } catch (e) {
    // Ignore if already exists
  }
}
