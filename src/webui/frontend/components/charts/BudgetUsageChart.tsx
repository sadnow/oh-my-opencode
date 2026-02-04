import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

// ============================================================================
// Types
// ============================================================================

interface BudgetUsageChartProps {
  height?: number
}

interface TrendDataPoint {
  date: string
  [provider: string]: string | number
}

interface TrendsResponse {
  success: boolean
  data: {
    trends: TrendDataPoint[]
    providers: string[]
  }
}

// ============================================================================
// Provider Colors - Professional, Distinct Palette
// ============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#00bcd4', // cyan - Claude
  openai: '#4caf50', // green - GPT
  google: '#ff9800', // orange - Gemini
  'github-copilot': '#9c27b0', // purple - Copilot
  opencode: '#2196f3', // blue - OpenCode
  xai: '#e91e63', // pink - Grok
  openrouter: '#ffeb3b', // yellow
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface TooltipPayload {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !label) return null

  return (
    <div
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--spacing-2)',
        fontFamily: 'var(--font-family-mono)',
        fontSize: 'var(--font-size-xs)',
      }}
    >
      <p style={{ color: 'var(--color-text-secondary)', margin: 0, marginBottom: '4px' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          style={{
            color: entry.color,
            margin: '2px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--spacing-3)',
          }}
        >
          <span>{entry.name}:</span>
          <span style={{ fontWeight: 600 }}>${entry.value?.toFixed(2)}</span>
        </p>
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export const BudgetUsageChart: React.FC<BudgetUsageChartProps> = ({ height = 300 }) => {
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [providers, setProviders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/budget/trends')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result: TrendsResponse = await response.json()

        if (!result.success) {
          throw new Error('API returned unsuccessful response')
        }

        setData(result.data.trends)
        setProviders(result.data.providers)
      } catch (err) {
        console.error('Failed to fetch budget trends:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  // ============================================================================
  // Render States
  // ============================================================================

  if (loading) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        Loading chart data...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-status-error)',
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-sm)',
          gap: 'var(--spacing-2)',
        }}
      >
        <div>⚠ Error loading chart</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {error}
        </div>
      </div>
    )
  }

  if (data.length === 0 || providers.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        No spending data available
      </div>
    )
  }

  // ============================================================================
  // Chart Render
  // ============================================================================

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border-subtle)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{
            fill: 'var(--color-text-muted)',
            fontSize: 11,
            fontFamily: 'var(--font-family-mono)',
          }}
          tickLine={{ stroke: 'var(--color-border-default)' }}
          axisLine={{ stroke: 'var(--color-border-default)' }}
          tickFormatter={(value) => {
            // Format date as MM/DD
            const date = new Date(value)
            return `${date.getMonth() + 1}/${date.getDate()}`
          }}
        />
        <YAxis
          tick={{
            fill: 'var(--color-text-muted)',
            fontSize: 11,
            fontFamily: 'var(--font-family-mono)',
          }}
          tickLine={{ stroke: 'var(--color-border-default)' }}
          axisLine={{ stroke: 'var(--color-border-default)' }}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{
            paddingTop: '12px',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family-mono)',
          }}
          iconType="line"
        />
        {providers.map((provider) => (
          <Line
            key={provider}
            type="monotone"
            dataKey={provider}
            name={provider}
            stroke={PROVIDER_COLORS[provider] || 'var(--color-accent-info)'}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
