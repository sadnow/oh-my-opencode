import { useState, useEffect } from 'react'

// ============================================================================
// Types
// ============================================================================

interface ModelEfficiency {
  tokensPerDollar: number
  costPerToken: number
  avgCostPerCall: number
}

interface EfficiencyData {
  [modelName: string]: ModelEfficiency
}

interface EfficiencyResponse {
  success: boolean
  data: EfficiencyData
}

interface RankedModel {
  name: string
  rank: number
  tokensPerDollar: number
  costPerToken: number
  avgCostPerCall: number
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toFixed(0)
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const getRankBadge = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇'
    case 2: return '🥈'
    case 3: return '🥉'
    default: return `#${rank}`
  }
}

const getRankColor = (rank: number): string => {
  switch (rank) {
    case 1: return 'var(--color-warning, #ffc107)'
    case 2: return 'var(--color-text-secondary, #888)'
    case 3: return 'var(--color-danger, #cd7f32)'
    default: return 'var(--color-text-secondary, #888)'
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ModelLeaderboard() {
  const [data, setData] = useState<RankedModel[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEfficiency = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/stats/efficiency')
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`)
        }

        const result: EfficiencyResponse = await response.json()

        if (result.success && result.data) {
          // Convert to array and sort by tokensPerDollar (descending)
          const rankedModels: RankedModel[] = Object.entries(result.data)
            .map(([name, metrics]) => ({
              name,
              tokensPerDollar: metrics.tokensPerDollar,
              costPerToken: metrics.costPerToken,
              avgCostPerCall: metrics.avgCostPerCall
            }))
            .sort((a, b) => b.tokensPerDollar - a.tokensPerDollar)
            .map((model, index) => ({
              ...model,
              rank: index + 1
            }))

          setData(rankedModels)
        } else {
          setError('Failed to fetch efficiency data')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchEfficiency()
    // Refresh every 60 seconds
    const interval = setInterval(fetchEfficiency, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-4, 16px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg, 18px)', fontWeight: 700, color: 'var(--color-text-primary, #fff)' }}>
            Model Efficiency Leaderboard
          </h2>
          <p style={{ color: 'var(--color-text-secondary, #888)', marginTop: 'var(--spacing-1, 4px)', fontSize: 'var(--font-size-sm, 12px)' }}>
            Models ranked by tokens per dollar (ROI)
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ color: 'var(--color-text-secondary, #888)', padding: 'var(--spacing-4, 16px)', textAlign: 'center' }}>
          Loading efficiency data...
        </div>
      )}

      {error && (
        <div style={{
          padding: 'var(--spacing-3, 12px)',
          background: 'var(--color-danger, #dc3545)20',
          border: '1px solid var(--color-danger, #dc3545)',
          color: 'var(--color-danger, #dc3545)',
          marginBottom: 'var(--spacing-4, 16px)',
          borderRadius: 'var(--radius-lg, 8px)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="card" style={{ padding: 'var(--spacing-4, 16px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm, 12px)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Rank</th>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Model</th>
                <th style={{ textAlign: 'right', padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Tokens/$</th>
                <th style={{ textAlign: 'right', padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Cost/Token</th>
                <th style={{ textAlign: 'right', padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Avg/Call</th>
              </tr>
            </thead>
            <tbody>
              {data.map((model) => (
                <tr 
                  key={model.name} 
                  style={{ 
                    borderBottom: '1px solid var(--color-border, #333)',
                    background: model.rank <= 3 ? 'var(--color-bg-secondary, #2a2a2a)' : 'transparent'
                  }}
                >
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: getRankColor(model.rank), fontWeight: 600 }}>
                    {getRankBadge(model.rank)}
                  </td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', color: 'var(--color-text-primary, #fff)', fontWeight: model.rank <= 3 ? 600 : 400 }}>
                    {model.name}
                  </td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>
                    {formatNumber(model.tokensPerDollar)}
                  </td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>
                    ${model.costPerToken.toFixed(6)}
                  </td>
                  <td style={{ padding: 'var(--spacing-2, 8px) var(--spacing-1, 4px)', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>
                    {formatCurrency(model.avgCostPerCall)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && data && data.length === 0 && (
        <div style={{ color: 'var(--color-text-secondary, #888)', padding: 'var(--spacing-4, 16px)', textAlign: 'center' }}>
          No efficiency data available
        </div>
      )}
    </div>
  )
}