import { useMemo } from 'react'

interface ForecastWidgetProps {
  predicted24h: number
  predicted7d: number
  predicted30d: number
  predictionAccuracy: number
  learningProgress: number
  spendingVelocity: number
  hourlyAllowance: number
  budget: number
  used: number
  daysRemaining: number
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const getConfidenceColor = (accuracy: number): string => {
  if (accuracy >= 0.8) return 'var(--color-success, #28a745)'
  if (accuracy >= 0.5) return 'var(--color-warning, #ffc107)'
  return 'var(--color-danger, #dc3545)'
}

const getTrendDirection = (velocity: number, allowance: number): 'up' | 'down' | 'flat' => {
  if (velocity > allowance) return 'up'
  if (velocity < allowance * 0.5) return 'down'
  return 'flat'
}

const getTrendColor = (direction: 'up' | 'down' | 'flat'): string => {
  switch (direction) {
    case 'up': return 'var(--color-danger, #dc3545)'
    case 'down': return 'var(--color-success, #28a745)'
    case 'flat': return 'var(--color-text-secondary, #888)'
  }
}

export function ForecastWidget({
  predicted24h,
  predicted7d,
  predicted30d,
  predictionAccuracy,
  learningProgress,
  spendingVelocity,
  hourlyAllowance,
  budget,
  used,
  daysRemaining
}: ForecastWidgetProps) {
  const confidenceColor = getConfidenceColor(predictionAccuracy)
  const confidencePercent = Math.round(predictionAccuracy * 100)
  const trendDirection = getTrendDirection(spendingVelocity, hourlyAllowance)
  const trendColor = getTrendColor(trendDirection)

  const daysUntilExhausted = useMemo(() => {
    if (spendingVelocity <= 0) return Infinity
    return (budget - used) / (spendingVelocity * 24)
  }, [budget, used, spendingVelocity])

  const confidenceBandData = useMemo(() => {
    const points = 10
    const data: Array<{ x: number; y: number; bandWidth: number }> = []
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1)
      const value = predicted24h * (1 + t * 0.5)
      const bandWidth = (1 - predictionAccuracy) * value * 0.5
      data.push({ x: t * 200, y: 60 - (value / predicted24h) * 30, bandWidth })
    }
    return data
  }, [predicted24h, predictionAccuracy])

  const bandPath = useMemo(() => {
    if (confidenceBandData.length === 0) return ''
    const topPath = confidenceBandData.map((d, i) => {
      const x = d.x
      const y = d.y - d.bandWidth
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
    const bottomPath = confidenceBandData.map((d, i) => {
      const x = d.x
      const y = d.y + d.bandWidth
      return `${i === 0 ? 'L' : 'L'} ${x} ${y}`
    }).reverse().join(' ')
    return `${topPath} ${bottomPath} Z`
  }, [confidenceBandData])

  const linePath = useMemo(() => {
    if (confidenceBandData.length === 0) return ''
    return confidenceBandData.map((d, i) => {
      return `${i === 0 ? 'M' : 'L'} ${d.x} ${d.y}`
    }).join(' ')
  }, [confidenceBandData])

  return (
    <div className="forecast-widget" style={{
      background: 'var(--color-surface-primary, #0f0f1a)',
      border: '1px solid var(--color-border, #2d2d44)',
      borderRadius: '8px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary, #fff)', marginBottom: '16px' }}>
        Forecast
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6c757d)', marginBottom: '4px' }}>24h</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary, #fff)' }}>
            {formatCurrency(predicted24h)}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6c757d)', marginBottom: '4px' }}>7d</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary, #fff)' }}>
            {formatCurrency(predicted7d)}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6c757d)', marginBottom: '4px' }}>30d</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary, #fff)' }}>
            {formatCurrency(predicted30d)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--color-text-secondary, #6c757d)' }}>Confidence</span>
          <span style={{ color: confidenceColor, fontWeight: 600 }}>{confidencePercent}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {trendDirection === 'up' && <span style={{ color: trendColor }}>▲</span>}
          {trendDirection === 'down' && <span style={{ color: trendColor }}>▼</span>}
          {trendDirection === 'flat' && <span style={{ color: trendColor }}>→</span>}
          <span style={{ color: 'var(--color-text-secondary, #6c757d)' }}>
            {trendDirection === 'up' ? 'Over' : trendDirection === 'down' ? 'Under' : 'On track'}
          </span>
        </div>
      </div>

      <div style={{ height: '60px', marginBottom: '12px' }}>
        <svg width="200" height="60" viewBox="0 0 200 60" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <path d={bandPath} fill="var(--color-info, #17a2b8)" opacity="0.2" />
          <path d={linePath} stroke="var(--color-info, #17a2b8)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary, #6c757d)', marginBottom: '4px' }}>
          <span>Learning Progress</span>
          <span>{Math.round(learningProgress * 100)}%</span>
        </div>
        <div style={{ height: '4px', background: 'var(--color-surface-secondary, #1a1a2e)', borderRadius: '2px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${learningProgress * 100}%`,
              height: '100%',
              background: 'var(--color-accent, #646cff)',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6c757d)', textAlign: 'center' }}>
        {daysUntilExhausted === Infinity
          ? 'Budget never exhausted'
          : `${Math.round(daysUntilExhausted)} days until budget exhausted`}
      </div>
    </div>
  )
}