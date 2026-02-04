import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ============================================================================
// Types
// ============================================================================

interface ModelDistributionChartProps {
  height?: number
}

interface ModelDistributionData {
  name: string
  value: number
}

interface EfficiencyResponse {
  success: boolean
  data: {
    byModel: Record<string, {
      model: string
      avgCostPer1kTokens: number
      tokensPer$1: number
      totalCalls: number
    }>
    byTier: Record<string, {
      tier: string
      avgCostPer1kTokens: number
      tokensPer$1: number
    }>
  }
}

// ============================================================================
// Color Palette - Professional, Distinct
// ============================================================================

const COLORS = [
  '#00bcd4', // cyan - Claude
  '#4caf50', // green - GPT
  '#ff9800', // orange - Gemini
  '#9c27b0', // purple
  '#2196f3', // blue
  '#e91e63', // pink
  '#ffeb3b', // yellow
  '#795548', // brown
  '#607d8b', // blue-grey
  '#ff5722', // deep orange
]

// ============================================================================
// Custom Label for Pie Slices
// ============================================================================

interface LabelProps {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
  index?: number
}

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: LabelProps) => {
  if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent) return null
  if (percent < 0.05) return null // Skip slices < 5%

  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="var(--color-text-primary)"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontFamily="var(--font-family-mono)"
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface TooltipPayload {
  name: string
  value: number
  payload: ModelDistributionData
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0]
  const total = payload.reduce((sum, entry) => sum + entry.value, 0)
  const percent = total > 0 ? (data.value / total) * 100 : 0

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
      <p style={{ color: 'var(--color-text-primary)', margin: 0, marginBottom: '4px', fontWeight: 600 }}>
        {data.name}
      </p>
      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
        Calls: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{data.value}</span>
      </p>
      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
        Share: <span style={{ color: 'var(--color-accent-info)', fontWeight: 600 }}>{percent.toFixed(1)}%</span>
      </p>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export const ModelDistributionChart: React.FC<ModelDistributionChartProps> = ({ height = 300 }) => {
  const [data, setData] = useState<ModelDistributionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/stats/efficiency')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result: EfficiencyResponse = await response.json()

        if (!result.success) {
          throw new Error('API returned unsuccessful response')
        }

        // Transform efficiency data into pie chart format
        const modelData = Object.values(result.data.byModel)
          .filter(m => m.totalCalls > 0)
          .map(m => ({
            name: m.model,
            value: m.totalCalls,
          }))
          .sort((a, b) => b.value - a.value)

        setData(modelData)
      } catch (err) {
        console.error('Failed to fetch model distribution:', err)
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

  if (data.length === 0) {
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
        No model usage data available
      </div>
    )
  }

  // ============================================================================
  // Chart Render
  // ============================================================================

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={renderCustomLabel}
          labelLine={false}
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell key={`cell-${entry.name}`} fill={COLORS[data.indexOf(entry) % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{
            paddingTop: '12px',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family-mono)',
          }}
          iconType="circle"
          formatter={(value: string) => {
            // Truncate long model names
            if (value.length > 30) {
              return value.substring(0, 27) + '...'
            }
            return value
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
