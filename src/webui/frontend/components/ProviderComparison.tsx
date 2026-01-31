import { useState, useEffect } from 'react'

// ============================================================================
// Types
// ============================================================================

interface ProviderStats {
  provider: string
  cost: number
  tokens: number
  calls: number
  efficiency: number // tokens per dollar
}

interface UsageResponse {
  success: boolean
  data: {
    providers: {
      [key: string]: {
        cost: number
        tokens: number
        calls: number
      }
    }
  }
}

interface StatsResponse {
  success: boolean
  data: {
    [key: string]: {
      tokensPerDollar: number
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toLocaleString()
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(amount)
}

// ============================================================================
// Main Component
// ============================================================================

export function ProviderComparison() {
  const [stats, setStats] = useState<ProviderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const [usageRes, statsRes] = await Promise.all([
          fetch('/api/usage'),
          fetch('/api/stats/all-providers')
        ])

        if (!usageRes.ok || !statsRes.ok) {
          throw new Error('Failed to fetch provider data')
        }

        const usageData: UsageResponse = await usageRes.json()
        const statsData: StatsResponse = await statsRes.json()

        if (usageData.success && statsData.success) {
          const combined: ProviderStats[] = Object.entries(usageData.data.providers).map(([name, usage]) => ({
            provider: name,
            cost: usage.cost,
            tokens: usage.tokens,
            calls: usage.calls,
            efficiency: statsData.data[name]?.tokensPerDollar || 0
          }))
          setStats(combined)
        } else {
          setError('API returned unsuccessful response')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Analyzing provider metrics...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        padding: 'var(--spacing-3)', 
        background: 'rgba(244, 67, 54, 0.1)', 
        border: '1px solid var(--color-accent-error)',
        color: 'var(--color-accent-error)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--font-size-sm)'
      }}>
        <strong>Error:</strong> {error}
      </div>
    )
  }

  // Find best/worst for highlighting
  const getExtremes = (key: keyof ProviderStats) => {
    if (stats.length === 0) return { min: 0, max: 0 }
    const values = stats.map(s => s[key] as number)
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    }
  }

  const costExtremes = getExtremes('cost')
  const efficiencyExtremes = getExtremes('efficiency')
  const callsExtremes = getExtremes('calls')
  const tokensExtremes = getExtremes('tokens')

  const getHighlightStyle = (value: number, extremes: { min: number, max: number }, inverse = false) => {
    if (extremes.min === extremes.max) return {}
    
    const isBest = inverse ? value === extremes.min : value === extremes.max
    const isWorst = inverse ? value === extremes.max : value === extremes.min

    if (isBest) return { color: 'var(--color-status-success)', fontWeight: 'bold' }
    if (isWorst) return { color: 'var(--color-status-error)' }
    return {}
  }

  return (
    <div className="provider-comparison">
      <div style={{ marginBottom: 'var(--spacing-3)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
          Provider Performance Matrix
        </h3>
        <p style={{ margin: 'var(--spacing-1) 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          Side-by-side efficiency and usage comparison
        </p>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <th style={{ textAlign: 'left', padding: 'var(--spacing-2)', color: 'var(--color-text-muted)' }}>Provider</th>
              <th style={{ textAlign: 'right', padding: 'var(--spacing-2)', color: 'var(--color-text-muted)' }}>Cost</th>
              <th style={{ textAlign: 'right', padding: 'var(--spacing-2)', color: 'var(--color-text-muted)' }}>Tokens</th>
              <th style={{ textAlign: 'right', padding: 'var(--spacing-2)', color: 'var(--color-text-muted)' }}>Calls</th>
              <th style={{ textAlign: 'right', padding: 'var(--spacing-2)', color: 'var(--color-text-muted)' }}>Tokens/$</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.provider} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: 'var(--spacing-2)', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                  {s.provider}
                </td>
                <td style={{ 
                  padding: 'var(--spacing-2)', 
                  textAlign: 'right',
                  ...getHighlightStyle(s.cost, costExtremes, true)
                }}>
                  {formatCurrency(s.cost)}
                </td>
                <td style={{ 
                  padding: 'var(--spacing-2)', 
                  textAlign: 'right',
                  ...getHighlightStyle(s.tokens, tokensExtremes)
                }}>
                  {formatNumber(s.tokens)}
                </td>
                <td style={{ 
                  padding: 'var(--spacing-2)', 
                  textAlign: 'right',
                  ...getHighlightStyle(s.calls, callsExtremes)
                }}>
                  {formatNumber(s.calls)}
                </td>
                <td style={{ 
                  padding: 'var(--spacing-2)', 
                  textAlign: 'right',
                  ...getHighlightStyle(s.efficiency, efficiencyExtremes)
                }}>
                  {formatNumber(Math.round(s.efficiency))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .provider-comparison tr:hover {
          background: var(--color-bg-tertiary);
        }
      `}} />
    </div>
  )
}
