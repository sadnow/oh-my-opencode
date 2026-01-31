import { useState, useEffect, useRef } from 'react'

// ============================================================================
// Types
// ============================================================================

interface BudgetStatus {
  provider: string
  type: 'subscription' | 'api'
  metric_label: string
  remaining_pct: number
  severity: 'ok' | 'warn' | 'critical'
  recommendation?: 'upgrade' | 'downgrade' | 'limit' | 'none'
  details: {
    used: number
    total: number
    unit: string
  }
}

interface ProviderDashboardData {
  provider: string
  budget: number
  used: number
  percentage: number
  trend: "under" | "on-track" | "over"
  daysRemaining: number
  daysElapsed: number
  recommendedTier: string
  adaptive: {
    hourlyAllowance: number
    accumulatedCredits: number
    budgetHeadroom: number
    spendingVelocity: number
    learningProgress: number
    predictionAccuracy: number
    canAffordUpgrade: boolean
    shouldDowngrade: boolean
  } | null
  dailySpending: Array<{ date: string; amount: number }>
}

interface BudgetDashboardData {
  success: boolean
  data: {
    enabled: boolean
    providers: ProviderDashboardData[]
    subscriptions: BudgetStatus[]
    apis: BudgetStatus[]
    globalTier: string
    override: {
      forcedTier: string | null
      tierLocked: boolean
      expiresIn: string | null
      modifiedBy: string | null
    }
  }
}

interface ClaudeMaxUsage {
  currentSession: { percentUsed: number; resetDate: string }
  sonnetOnly: { percentUsed: number; resetDate: string } | null
  allModels: { percentUsed: number; resetDate: string }
  opusOnly?: { percentUsed: number; resetDate: string } | null
}

interface CopilotUsage {
  percentUsed: number
  premiumRequestsUsed: number
  premiumRequestsLimit: number
  percentRemaining: number
  daysRemaining: number
  resetDate: string
}

interface UsageData {
  summaries: Record<string, { totalCost: number; totalInputTokens: number; totalOutputTokens: number; callCount: number }>
  totalCost: number
}

interface TrendDataPoint {
  date: string
  [provider: string]: string | number
}

type TimePeriod = '1H' | '24H' | '1W' | '1M' | 'ALL'

// ============================================================================
// Helper Functions
// ============================================================================

const getUsageColor = (percentage: number): string => {
  if (percentage >= 90) return 'var(--color-danger, #dc3545)'
  if (percentage >= 70) return 'var(--color-warning, #ffc107)'
  if (percentage >= 50) return 'var(--color-info, #17a2b8)'
  return 'var(--color-success, #28a745)'
}

const getSeverityColor = (severity: 'ok' | 'warn' | 'critical'): string => {
  switch (severity) {
    case 'critical': return 'var(--color-danger, #dc3545)'
    case 'warn': return 'var(--color-warning, #ffc107)'
    case 'ok': return 'var(--color-success, #28a745)'
  }
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toFixed(0)
}

const getProviderDisplayName = (provider: string): string => {
  const names: Record<string, string> = {
    'claude-max': 'Claude Max',
    'copilot': 'GitHub Copilot',
    'opencode-zen': 'OpenCode Zen',
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google'
  }
  return names[provider] || provider
}

const getProviderIcon = (provider: string): string => {
  const icons: Record<string, string> = {
    'claude-max': '🤖',
    'copilot': '⚡',
    'opencode-zen': '🧘',
    'anthropic': '🔮',
    'openai': '🧠',
    'google': '🔍'
  }
  return icons[provider] || '📊'
}

const formatTimeRemaining = (resetDate: string): string => {
  try {
    const now = new Date()
    const reset = new Date(resetDate)
    const diff = reset.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  } catch {
    return 'Unknown'
  }
}

const calculateTrend = (dailySpending: Array<{ date: string; amount: number }>): { value: number; direction: 'up' | 'down' } => {
  if (!dailySpending || dailySpending.length < 2) {
    return { value: 0, direction: 'up' }
  }
  // Compare last 3 days vs previous 3 days (or available data)
  const recent = dailySpending.slice(-3)
  const older = dailySpending.slice(-6, -3)
  if (older.length === 0) return { value: 0, direction: 'up' }

  const recentAvg = recent.reduce((sum, d) => sum + d.amount, 0) / recent.length
  const olderAvg = older.reduce((sum, d) => sum + d.amount, 0) / older.length

  if (olderAvg === 0) return { value: 0, direction: 'up' }
  const change = ((recentAvg - olderAvg) / olderAvg) * 100
  return { value: Math.abs(change), direction: change >= 0 ? 'up' : 'down' }
}

const calculateOverallTrend = (providers: ProviderDashboardData[]): { value: number; direction: 'up' | 'down' } => {
  if (!providers || providers.length === 0) {
    return { value: 0, direction: 'up' }
  }

  // Aggregate all daily spending across providers
  const allDailySpending: Array<{ date: string; amount: number }> = []
  providers.forEach(provider => {
    provider.dailySpending.forEach(spending => {
      const existing = allDailySpending.find(d => d.date === spending.date)
      if (existing) {
        existing.amount += spending.amount
      } else {
        allDailySpending.push({ date: spending.date, amount: spending.amount })
      }
    })
  })

  // Sort by date
  allDailySpending.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return calculateTrend(allDailySpending)
}

// ============================================================================
// Components
// ============================================================================

// Ticker Item Component
const TickerItem = ({ name, value, color, trend }: { name: string; value: string; color: string; trend?: { value: number; direction: 'up' | 'down' | 'flat' } }) => (
  <div className="ticker-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
    <span style={{ fontWeight: 600, fontSize: '13px' }}>{name}</span>
    <span style={{ color, fontWeight: 700, fontSize: '14px' }}>{value}</span>
    {trend && trend.direction !== 'flat' && (
      <span style={{ color: trend.direction === 'up' ? 'var(--color-danger, #dc3545)' : 'var(--color-success, #28a745)', fontSize: '12px' }}>
        {trend.direction === 'up' ? '▲' : '▼'}{trend.value.toFixed(0)}%
      </span>
    )}
  </div>
)

// Live Ticker Strip
const LiveTicker = ({ providers, totalSpend }: { providers: ProviderDashboardData[]; totalSpend: number }) => {
  const tickerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition(prev => (prev + 1) % 1000)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  const tickerItems = providers.map(p => ({
    name: getProviderDisplayName(p.provider),
    value: formatCurrency(p.used),
    color: getUsageColor(p.percentage),
    trend: calculateTrend(p.dailySpending)
  }))

  return (
    <div className="ticker-strip" style={{
      background: 'var(--color-bg-secondary, #1a1a1a)',
      borderBottom: '1px solid var(--color-border, #333)',
      padding: '12px 0',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div
        ref={tickerRef}
        className="ticker-content"
        style={{
          display: 'flex',
          gap: '40px',
          position: 'absolute',
          left: `-${position}px`,
          whiteSpace: 'nowrap',
          animation: 'ticker 30s linear infinite'
        }}
      >
        {[...tickerItems, ...tickerItems, ...tickerItems].map((item, idx) => (
          <TickerItem key={`${item.name}-${idx}`} {...item} />
        ))}
        <TickerItem name="TOTAL" value={formatCurrency(totalSpend)} color="var(--color-text-primary, #fff)" />
      </div>
    </div>
  )
}

// Time Period Selector
const TimePeriodSelector = ({ selected, onSelect }: { selected: TimePeriod; onSelect: (period: TimePeriod) => void }) => {
  const periods: TimePeriod[] = ['1H', '24H', '1W', '1M', 'ALL']

  return (
    <div className="time-period-selector" style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '24px'
    }}>
      {periods.map(period => (
        <button
          key={period}
          onClick={() => onSelect(period)}
          className={`period-button ${selected === period ? 'active' : ''}`}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid var(--color-border, #333)',
            background: selected === period ? 'var(--color-accent, #646cff)' : 'var(--color-bg-secondary, #2a2a2a)',
            color: selected === period ? '#fff' : 'var(--color-text-primary, #fff)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          {period}
        </button>
      ))}
    </div>
  )
}

// KPI Card
const KPICard = ({ label, value, trend, color, unit }: { label: string; value: string | number; trend?: { value: number; direction: 'up' | 'down' | 'flat' }; color?: string; unit?: string }) => (
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
        color: trend.direction === 'up' ? 'var(--color-danger, #dc3545)' : trend.direction === 'down' ? 'var(--color-success, #28a745)' : 'var(--color-text-secondary, #888)',
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

// Provider Card
const ProviderCard = ({ provider, data, claudeMaxData, copilotData }: {
  provider: string
  data: ProviderDashboardData
  claudeMaxData?: ClaudeMaxUsage
  copilotData?: CopilotUsage
}) => {
  const displayName = getProviderDisplayName(provider)
  const icon = getProviderIcon(provider)
  const color = getUsageColor(data.percentage)
  const severity = data.percentage >= 90 ? 'critical' : data.percentage >= 70 ? 'warn' : 'ok'

  // Generate sparkline data from daily spending
  const sparklineData = data.dailySpending.slice(-24).map(d => d.amount)

  return (
    <div className="provider-card" style={{
      background: 'var(--color-bg-primary, #1a1a1a)',
      border: `1px solid ${color}40`,
      borderRadius: '8px',
      padding: '20px',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>{icon}</span>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
              {displayName}
            </div>
<div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)' }}>
          Pay-per-use
        </div>
          </div>
        </div>
        <div className="status-badge" style={{
          background: `${getSeverityColor(severity)}20`,
          color: getSeverityColor(severity),
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase'
        }}>
          {severity}
        </div>
      </div>

      {/* Main percentage display */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '48px', fontWeight: 700, color, lineHeight: 1 }}>
          {data.percentage.toFixed(0)}%
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #888)' }}>
          {formatCurrency(data.used)} of {formatCurrency(data.budget)}
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ height: '40px', marginBottom: '16px' }}>
        <Sparkline data={sparklineData} color={color} />
      </div>

      {/* Metrics grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        fontSize: '12px'
      }}>
        <div>
          <div style={{ color: 'var(--color-text-secondary, #888)', marginBottom: '2px' }}>Burn Rate</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {data.adaptive?.spendingVelocity ? formatCurrency(data.adaptive.spendingVelocity) + '/hr' : 'N/A'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-secondary, #888)', marginBottom: '2px' }}>Days Left</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {data.daysRemaining}d
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-secondary, #888)', marginBottom: '2px' }}>Trend</div>
          <div style={{ fontWeight: 600, color: getUsageColor(data.trend === 'over' ? 90 : data.trend === 'on-track' ? 60 : 30) }}>
            {data.trend === 'over' ? '▲ Over' : data.trend === 'on-track' ? '→ On Track' : '▼ Under'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-secondary, #888)', marginBottom: '2px' }}>Reset</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {formatTimeRemaining(data.daysRemaining > 0 ? new Date(Date.now() + data.daysRemaining * 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString())}
          </div>
        </div>
      </div>

      {/* Claude Max specific */}
      {provider === 'claude-max' && claudeMaxData && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-border, #333)',
          fontSize: '11px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary, #888)' }}>Current Session</span>
            <span style={{ color: getUsageColor(claudeMaxData.currentSession.percentUsed), fontWeight: 600 }}>
              {claudeMaxData.currentSession.percentUsed}%
            </span>
          </div>
          {claudeMaxData.sonnetOnly && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #888)' }}>Sonnet Only</span>
              <span style={{ color: getUsageColor(claudeMaxData.sonnetOnly.percentUsed), fontWeight: 600 }}>
                {claudeMaxData.sonnetOnly.percentUsed}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Copilot specific */}
      {provider === 'copilot' && copilotData && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-border, #333)',
          fontSize: '11px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary, #888)' }}>Premium Requests</span>
            <span style={{ color: 'var(--color-text-primary, #fff)', fontWeight: 600 }}>
              {copilotData.premiumRequestsUsed} / {copilotData.premiumRequestsLimit}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #888)' }}>Days Remaining</span>
            <span style={{ color: 'var(--color-text-primary, #fff)', fontWeight: 600 }}>
              {copilotData.daysRemaining}d
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple Line Chart (CSS-based)
const SimpleLineChart = ({ data, providers, height = 200 }: { data: TrendDataPoint[]; providers: string[]; height?: number }) => {
  if (!data || data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary, #888)' }}>No data available</div>

  const colors = ['#646cff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#e83e8c']
  const maxValue = Math.max(...data.flatMap(d => providers.map(p => typeof d[p] === 'number' ? d[p] as number : 0)))

  return (
    <div style={{ height, position: 'relative' }}>
      <svg viewBox={`0 0 ${data.length * 40} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <line
            key={i}
            x1={0}
            y1={height * (1 - ratio)}
            x2={data.length * 40}
            y2={height * (1 - ratio)}
            stroke="var(--color-border, #333)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Provider lines */}
        {providers.map((provider, pi) => {
          const points = data.map((d, i) => {
            const x = i * 40
            const y = height - ((typeof d[provider] === 'number' ? d[provider] as number : 0) / maxValue) * height
            return `${x},${y}`
          }).join(' ')

          return (
            <polyline
              key={provider}
              points={points}
              fill="none"
              stroke={colors[pi % colors.length]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}
      </svg>

      {/* X-axis labels */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: 'var(--color-text-secondary, #888)',
        padding: '0 4px'
      }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((d, i) => (
          <span key={i}>{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        ))}
      </div>
    </div>
  )
}

// Model Breakdown Table
const ModelBreakdownTable = ({ usageData }: { usageData: UsageData | null }) => {
  if (!usageData || !usageData.summaries) {
    return <div style={{ color: 'var(--color-text-secondary, #888)', padding: '20px', textAlign: 'center' }}>No usage data available</div>
  }

  const models = Object.entries(usageData.summaries).map(([model, data]) => ({
    model,
    ...data,
    avgCostPerCall: data.callCount > 0 ? data.totalCost / data.callCount : 0
  })).sort((a, b) => b.totalCost - a.totalCost)

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
          <th style={{ textAlign: 'left', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Model</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Calls</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Tokens</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Cost</th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>Avg/Call</th>
        </tr>
      </thead>
      <tbody>
        {models.map((m) => (
          <tr key={m.model} style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
            <td style={{ padding: '12px', color: 'var(--color-text-primary, #fff)' }}>{m.model}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatNumber(m.callCount)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatNumber(m.totalInputTokens + m.totalOutputTokens)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatCurrency(m.totalCost)}</td>
            <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>{formatCurrency(m.avgCostPerCall)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Alerts Panel
const AlertsPanel = ({ data, claudeMaxData, copilotData }: {
  data: BudgetDashboardData['data']
  claudeMaxData?: ClaudeMaxUsage
  copilotData?: CopilotUsage
}) => {
  const alerts: Array<{ type: 'warning' | 'info' | 'success'; message: string }> = []

  // Check for critical usage
  data.subscriptions?.forEach(s => {
    if (s.severity === 'critical') {
      alerts.push({ type: 'warning', message: `${getProviderDisplayName(s.provider)} is over quota (${s.remaining_pct.toFixed(0)}% remaining)` })
    } else if (s.severity === 'warn') {
      alerts.push({ type: 'info', message: `${getProviderDisplayName(s.provider)} approaching limit (${s.remaining_pct.toFixed(0)}% remaining)` })
    }
  })

  // Claude Max alerts
  if (claudeMaxData && claudeMaxData.currentSession?.percentUsed >= 90) {
    alerts.push({ type: 'warning', message: `Claude Max current session at ${claudeMaxData.currentSession.percentUsed}% - consider taking a break` })
  }

  // Copilot alerts
  if (copilotData && copilotData.percentUsed >= 90) {
    alerts.push({ type: 'warning', message: `GitHub Copilot at ${copilotData.percentUsed}% - reduce usage to avoid overage` })
  }

  // Budget recommendations
  data.providers?.forEach(p => {
    if (p.adaptive?.shouldDowngrade) {
      alerts.push({ type: 'info', message: `Consider downgrading ${getProviderDisplayName(p.provider)} tier to save costs` })
    }
    if (p.adaptive?.canAffordUpgrade && p.percentage < 50) {
      alerts.push({ type: 'success', message: `${getProviderDisplayName(p.provider)} has headroom for tier upgrade` })
    }
  })

  if (alerts.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--color-success, #28a745)',
        fontSize: '14px'
      }}>
        ✓ All systems operating within normal parameters
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {alerts.map((alert, i) => (
        <div
          key={i}
          style={{
            padding: '12px',
            borderRadius: '6px',
            background: alert.type === 'warning' ? 'var(--color-danger, #dc3545)20' :
                     alert.type === 'success' ? 'var(--color-success, #28a745)20' :
                     'var(--color-info, #17a2b8)20',
            borderLeft: `3px solid ${alert.type === 'warning' ? 'var(--color-danger, #dc3545)' :
                                      alert.type === 'success' ? 'var(--color-success, #28a745)' :
                                      'var(--color-info, #17a2b8)'}`,
            fontSize: '13px',
            color: 'var(--color-text-primary, #fff)'
          }}
        >
          {alert.type === 'warning' && '⚠️ '}
          {alert.type === 'info' && 'ℹ️ '}
          {alert.type === 'success' && '✓ '}
          {alert.message}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetDashboard() {
  const [data, setData] = useState<BudgetDashboardData | null>(null)
  const [claudeMaxData, setClaudeMaxData] = useState<ClaudeMaxUsage | null>(null)
  const [copilotData, setCopilotData] = useState<CopilotUsage | null>(null)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [trendsData, setTrendsData] = useState<{ trends: TrendDataPoint[]; providers: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24H')

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)

    try {
      const [dashboardRes, claudeMaxRes, copilotRes, usageRes, trendsRes] = await Promise.all([
        fetch('/api/budget/dashboard'),
        fetch('/api/claude-max/usage'),
        fetch('/api/copilot/usage'),
        fetch('/api/usage'),
        fetch('/api/budget/trends')
      ])

      const [dashboardData, claudeData, copilotResult, usageResult, trendsResult] = await Promise.all([
        dashboardRes.json(),
        claudeMaxRes.json(),
        copilotRes.json(),
        usageRes.json(),
        trendsRes.json()
      ])

      if (dashboardData.success) {
        setData(dashboardData)
      } else {
        setError('Failed to fetch budget dashboard')
      }

      if (claudeData.success && claudeData.data) {
        setClaudeMaxData(claudeData.data)
      }

      if (copilotResult.success && copilotResult.data) {
        setCopilotData(copilotResult.data)
      }

      if (usageResult.success && usageResult.data) {
        setUsageData(usageResult.data)
      }

      if (trendsResult.success && trendsResult.data) {
        setTrendsData(trendsResult.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboard, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!loading && !error && data && !data.data.enabled) {
    return (
      <div>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>Budget Dashboard</h2>
          <button onClick={fetchDashboard} className="button">⟳ Refresh</button>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Budget tracking is disabled.</p>
        </div>
      </div>
    )
  }

  const totalSpent = data?.data.providers.reduce((acc, p) => acc + p.used, 0) || 0
  const totalBudget = data?.data.providers.reduce((acc, p) => acc + p.budget, 0) || 0
  const overallUsagePercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  // Calculate KPIs
  const avgDailySpend = data?.data.providers.reduce((acc, p) => {
    const dailyAvg = p.daysElapsed > 0 ? p.used / p.daysElapsed : 0
    return acc + dailyAvg
  }, 0) || 0

  const burnRate = avgDailySpend / 24 // per hour
  const daysRemainingAtCurrentRate = burnRate > 0 ? (totalBudget - totalSpent) / (burnRate * 24) : 0
  const activeProviders = data?.data.providers.length || 0
  const healthyProviders = data?.data.providers.filter(p => p.percentage < 70).length || 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary, #fff)' }}>
            Budget Dashboard
          </h2>
          <p style={{ color: 'var(--color-text-secondary, #888)', marginTop: '4px', fontSize: '14px' }}>
            Real-time spending analytics across all AI providers
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="button"
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

      {loading && <div style={{ color: 'var(--color-text-secondary, #888)', padding: '40px', textAlign: 'center' }}>Loading dashboard data...</div>}

      {error && (
        <div className="card" style={{
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
          {/* Live Ticker */}
          <LiveTicker providers={data.data.providers} totalSpend={totalSpent} />

          {/* Time Period Selector */}
          <TimePeriodSelector selected={timePeriod} onSelect={setTimePeriod} />

          {/* KPI Cards */}
          <div className="responsive-grid" style={{ marginBottom: '24px' }}>
            <KPICard
              label="Total Spend"
              value={totalSpent}
              unit=""
              color={getUsageColor(overallUsagePercentage)}
              trend={calculateOverallTrend(data.data.providers)}
            />
            <KPICard
              label="Burn Rate"
              value={burnRate}
              unit="/hr"
              color={burnRate > 1 ? 'var(--color-warning, #ffc107)' : 'var(--color-success, #28a745)'}
            />
            <KPICard
              label="Budget Remaining"
              value={daysRemainingAtCurrentRate}
              unit=" days"
              color={daysRemainingAtCurrentRate < 7 ? 'var(--color-danger, #dc3545)' : daysRemainingAtCurrentRate < 14 ? 'var(--color-warning, #ffc107)' : 'var(--color-success, #28a745)'}
            />
            <KPICard
              label="Active Providers"
              value={`${healthyProviders}/${activeProviders}`}
              color={healthyProviders === activeProviders ? 'var(--color-success, #28a745)' : 'var(--color-warning, #ffc107)'}
            />
          </div>

          {/* Provider Cards Grid */}
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
            Provider Status
          </h3>
          <div className="responsive-grid" style={{ marginBottom: '24px' }}>
            {data.data.providers.map(provider => (
              <ProviderCard
                key={provider.provider}
                provider={provider.provider}
                data={provider}
                claudeMaxData={claudeMaxData || undefined}
                copilotData={copilotData || undefined}
              />
            ))}
          </div>

          {/* Usage Chart */}
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
            Spending Trends
          </h3>
          <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
            {trendsData ? (
              <SimpleLineChart data={trendsData.trends} providers={trendsData.providers} />
            ) : (
              <div style={{ color: 'var(--color-text-secondary, #888)', padding: '40px', textAlign: 'center' }}>
                Loading trend data...
              </div>
            )}
          </div>

          {/* Two-column layout for Model Breakdown and Alerts */}
          <div className="responsive-grid" style={{ marginBottom: '24px' }}>
            {/* Model Breakdown */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
                Model Breakdown
              </h3>
              <ModelBreakdownTable usageData={usageData} />
            </div>

            {/* Alerts */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
                Alerts & Recommendations
              </h3>
              <AlertsPanel data={data.data} claudeMaxData={claudeMaxData || undefined} copilotData={copilotData || undefined} />
            </div>
          </div>

          {/* Session Insights */}
          {claudeMaxData && (
            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary, #fff)' }}>
                Session Insights
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>Current Session Usage</div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: getUsageColor(claudeMaxData.currentSession.percentUsed) }}>
                    {claudeMaxData.currentSession.percentUsed}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>All Models Usage</div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: getUsageColor(claudeMaxData.allModels.percentUsed) }}>
                    {claudeMaxData.allModels.percentUsed}%
                  </div>
                </div>
                {claudeMaxData.sonnetOnly && (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>Sonnet Only Usage</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: getUsageColor(claudeMaxData.sonnetOnly.percentUsed) }}>
                      {claudeMaxData.sonnetOnly.percentUsed}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}