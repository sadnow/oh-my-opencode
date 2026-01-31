import { useState, useEffect, useMemo, useCallback } from 'react'

// ============================================================================
// Types
// ============================================================================

interface SummaryStats {
  period: 'weekly' | 'monthly'
  totalCost: number
  totalTokens: number
  totalCalls: number
  avgCostPerCall: number
  avgTokensPerCall: number
  previousPeriodCost: number
  costChange: number
  costChangeDirection: 'up' | 'down' | 'flat'
}

interface CategoryStats {
  category: string
  cost: number
  tokens: number
  calls: number
  percentage: number
}

interface EfficiencyStats {
  model: string
  tokensPerDollar: number
  costPerToken: number
  avgCostPerCall: number
  qualityScore?: number
}

interface ProviderTrend {
  provider: string
  current: number
  previous: number
  change: number
  changeDirection: 'up' | 'down' | 'flat'
  trendData: Array<{ date: string; value: number }>
}

interface SessionStats {
  totalSessions: number
  avgDuration: number
  totalDuration: number
  costDistribution: {
    low: number
    medium: number
    high: number
  }
  avgCostPerSession: number
}

interface StatsDashboardData {
  summary: SummaryStats
  categories: CategoryStats[]
  efficiency: EfficiencyStats[]
  providerTrends: ProviderTrend[]
  sessions: SessionStats
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toFixed(0)
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

const getTrendColor = (direction: 'up' | 'down' | 'flat'): string => {
  switch (direction) {
    case 'up': return 'var(--color-danger, #dc3545)'
    case 'down': return 'var(--color-success, #28a745)'
    case 'flat': return 'var(--color-text-secondary, #888)'
  }
}

const getProviderDisplayName = (provider: string): string => {
  const names: Record<string, string> = {
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google',
    'claude-max': 'Claude Max',
    'copilot': 'GitHub Copilot'
  }
  return names[provider] || provider
}

const getProviderIcon = (provider: string): string => {
  const icons: Record<string, string> = {
    'anthropic': '🔮',
    'openai': '🧠',
    'google': '🔍',
    'claude-max': '🤖',
    'copilot': '⚡'
  }
  return icons[provider] || '📊'
}

// ============================================================================
// Components
// ============================================================================

// KPI Card
const KPICard = ({ label, value, trend, color, unit }: {
  label: string
  value: string | number
  trend?: { value: number; direction: 'up' | 'down' | 'flat' }
  color?: string
  unit?: string
}) => (
  <div className="kpi-card" style={{
    background: 'var(--color-bg-primary, #1a1a1a)',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '8px',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden'
  }}>
    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: color || 'var(--color-text-primary, #fff)' }}>
      {typeof value === 'number' ? value.toFixed(2) : value}{unit}
    </div>
    {trend && (
      <div style={{
        fontSize: '12px',
        color: getTrendColor(trend.direction),
        marginTop: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {trend.direction === 'up' && '▲'}
        {trend.direction === 'down' && '▼'}
        {trend.direction !== 'flat' && `${trend.value.toFixed(1)}%`}
        {trend.direction === 'flat' && '→'}
        <span style={{ color: 'var(--color-text-secondary, #888)', marginLeft: '4px' }}>vs prev</span>
      </div>
    )}
  </div>
)

// Sparkline Component (CSS-based)
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Category Breakdown Table
const CategoryBreakdownTable = ({ categories }: { categories: CategoryStats[] }) => {
  if (!categories || categories.length === 0) {
    return <div style={{ color: 'var(--color-text-secondary, #888)', padding: '20px', textAlign: 'center' }}>No category data available</div>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
          <th style={{ textAlign: 'left', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Category</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Calls</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Tokens</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Cost</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Share</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((cat) => (
          <tr key={cat.category} style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
            <td style={{ padding: '12px', color: 'var(--color-text-primary, #fff)' }}>{cat.category}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatNumber(cat.calls)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatNumber(cat.tokens)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatCurrency(cat.cost)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{cat.percentage.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Efficiency Metrics Table
const EfficiencyMetricsTable = ({ efficiency }: { efficiency: EfficiencyStats[] }) => {
  if (!efficiency || efficiency.length === 0) {
    return <div style={{ color: 'var(--color-text-secondary, #888)', padding: '20px', textAlign: 'center' }}>No efficiency data available</div>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
          <th style={{ textAlign: 'left', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Model</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Tokens/$</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Cost/Token</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Avg/Call</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Quality</th>
        </tr>
      </thead>
      <tbody>
        {efficiency.map((eff) => (
          <tr key={eff.model} style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
            <td style={{ padding: '12px', color: 'var(--color-text-primary, #fff)' }}>{eff.model}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatNumber(eff.tokensPerDollar)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>${eff.costPerToken.toFixed(6)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatCurrency(eff.avgCostPerCall)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: eff.qualityScore && eff.qualityScore >= 80 ? 'var(--color-success, #28a745)' : eff.qualityScore && eff.qualityScore >= 60 ? 'var(--color-warning, #ffc107)' : 'var(--color-text-secondary, #888)' }}>
              {eff.qualityScore ? `${eff.qualityScore.toFixed(0)}` : 'N/A'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Provider Trend Card
const ProviderTrendCard = ({ trend }: { trend: ProviderTrend }) => {
  const displayName = getProviderDisplayName(trend.provider)
  const icon = getProviderIcon(trend.provider)
  const color = getTrendColor(trend.changeDirection)

  return (
    <div className="provider-trend-card" style={{
      background: 'var(--color-bg-primary, #1a1a1a)',
      border: `1px solid ${color}40`,
      borderRadius: '8px',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Status indicator bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: color
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{icon}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {displayName}
          </span>
        </div>
        <div style={{
          fontSize: '12px',
          color,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {trend.changeDirection === 'up' && '▲'}
          {trend.changeDirection === 'down' && '▼'}
          {trend.changeDirection !== 'flat' && `${trend.change.toFixed(1)}%`}
          {trend.changeDirection === 'flat' && '→'}
        </div>
      </div>

      {/* Values */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
        <div>
          <div style={{ color: 'var(--color-text-secondary, #888)', marginBottom: '2px' }}>Current</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {formatCurrency(trend.current)}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-secondary, #888)', marginBottom: '2px' }}>Previous</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-secondary, #888)' }}>
            {formatCurrency(trend.previous)}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ height: '30px', marginTop: '12px' }}>
        <Sparkline data={trend.trendData.map(d => d.value)} color={color} />
      </div>
    </div>
  )
}

// Session Analytics Card
const SessionAnalyticsCard = ({ sessions }: { sessions: SessionStats }) => {
  const total = sessions.costDistribution.low + sessions.costDistribution.medium + sessions.costDistribution.high

  return (
    <div className="session-analytics-card" style={{
      background: 'var(--color-bg-primary, #1a1a1a)',
      border: '1px solid var(--color-border, #333)',
      borderRadius: '8px',
      padding: '20px'
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
        Session Analytics
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>Total Sessions</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {formatNumber(sessions.totalSessions)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>Avg Duration</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {formatDuration(sessions.avgDuration)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>Avg Cost/Session</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {formatCurrency(sessions.avgCostPerSession)}
          </div>
        </div>
      </div>

      {/* Cost Distribution */}
      <div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '8px' }}>
          Cost Distribution
        </div>
        <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${(sessions.costDistribution.low / total) * 100}%`,
              background: 'var(--color-success, #28a745)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#fff'
            }}
          >
            {total > 0 && `${((sessions.costDistribution.low / total) * 100).toFixed(0)}%`}
          </div>
          <div
            style={{
              width: `${(sessions.costDistribution.medium / total) * 100}%`,
              background: 'var(--color-warning, #ffc107)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#000'
            }}
          >
            {total > 0 && `${((sessions.costDistribution.medium / total) * 100).toFixed(0)}%`}
          </div>
          <div
            style={{
              width: `${(sessions.costDistribution.high / total) * 100}%`,
              background: 'var(--color-danger, #dc3545)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#fff'
            }}
          >
            {total > 0 && `${((sessions.costDistribution.high / total) * 100).toFixed(0)}%`}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--color-text-secondary, #888)' }}>
          <span>Low (&lt;$0.10)</span>
          <span>Medium ($0.10-$1.00)</span>
          <span>High (&gt;$1.00)</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function StatsDashboard() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [range, setRange] = useState<'7d' | '30d'>('7d')
  const [data, setData] = useState<StatsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [summaryRes, categoryRes, efficiencyRes, trendsRes, sessionsRes] = await Promise.all([
        fetch(`/api/stats/summary?period=${period}`),
        fetch('/api/stats/by-category'),
        fetch('/api/stats/efficiency'),
        fetch(`/api/stats/all-providers?range=${range}`),
        fetch('/api/stats/sessions')
      ])

      const [summaryData, categoryData, efficiencyData, trendsData, sessionsData] = await Promise.all([
        summaryRes.json(),
        categoryRes.json(),
        efficiencyRes.json(),
        trendsRes.json(),
        sessionsRes.json()
      ])

      if (summaryData.success && categoryData.success && efficiencyData.success && trendsData.success && sessionsData.success) {
        setData({
          summary: summaryData.data,
          categories: categoryData.data,
          efficiency: efficiencyData.data,
          providerTrends: trendsData.data,
          sessions: sessionsData.data
        })
      } else {
        setError('Failed to fetch stats data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [period, range])

  useEffect(() => {
    fetchStats()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary, #fff)' }}>
            Stats Dashboard
          </h2>
          <p style={{ color: 'var(--color-text-secondary, #888)', marginTop: '4px', fontSize: '14px' }}>
            Comprehensive analytics and performance metrics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'weekly' | 'monthly')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #333)',
              background: 'var(--color-bg-secondary, #2a2a2a)',
              color: 'var(--color-text-primary, #fff)',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as '7d' | '30d')}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #333)',
              background: 'var(--color-bg-secondary, #2a2a2a)',
              color: 'var(--color-text-primary, #fff)',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
          </select>
          <button
            onClick={fetchStats}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #333)',
              background: 'var(--color-bg-secondary, #2a2a2a)',
              color: 'var(--color-text-primary, #fff)',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      {loading && <div style={{ color: 'var(--color-text-secondary, #888)', padding: '40px', textAlign: 'center' }}>Loading stats data...</div>}

      {error && (
        <div style={{
          padding: '15px',
          background: 'var(--color-danger, #dc3545)20',
          border: '1px solid var(--color-danger, #dc3545)',
          color: 'var(--color-danger, #dc3545)',
          marginBottom: '20px',
          borderRadius: '8px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary Cards */}
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
            Summary
          </h3>
          <div className="responsive-grid" style={{ marginBottom: '24px' }}>
            <KPICard
              label="Total Cost"
              value={data.summary.totalCost}
              unit=""
              color="var(--color-accent, #646cff)"
              trend={{ value: data.summary.costChange, direction: data.summary.costChangeDirection }}
            />
            <KPICard
              label="Total Tokens"
              value={data.summary.totalTokens}
              unit=""
              color="var(--color-info, #17a2b8)"
            />
            <KPICard
              label="Total Calls"
              value={data.summary.totalCalls}
              unit=""
              color="var(--color-success, #28a745)"
            />
            <KPICard
              label="Avg Cost/Call"
              value={data.summary.avgCostPerCall}
              unit=""
              color="var(--color-warning, #ffc107)"
            />
          </div>

          {/* Category Breakdown */}
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
            Category Breakdown
          </h3>
          <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
            <CategoryBreakdownTable categories={data.categories} />
          </div>

          {/* Efficiency Metrics */}
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
            Efficiency Metrics
          </h3>
          <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
            <EfficiencyMetricsTable efficiency={data.efficiency} />
          </div>

          {/* Provider Trends */}
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
            Provider Trends
          </h3>
          <div className="responsive-grid" style={{ marginBottom: '24px' }}>
            {data.providerTrends.map((trend) => (
              <ProviderTrendCard key={trend.provider} trend={trend} />
            ))}
          </div>

          {/* Session Analytics */}
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
            Session Analytics
          </h3>
          <SessionAnalyticsCard sessions={data.sessions} />
        </>
      )}
    </div>
  )
}