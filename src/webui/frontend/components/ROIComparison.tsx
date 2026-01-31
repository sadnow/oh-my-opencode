import { useMemo } from 'react'

// ============================================================================
// Types
// ============================================================================

interface Alternative {
  model: string
  tier: string
  estimatedCost: number
  savings: number
  savingsPercent: number
}

interface ROIComparisonProps {
  currentModel: string
  currentCost: number
  alternatives: Alternative[]
  inputTokens: number
  outputTokens: number
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

const formatPercent = (value: number): string => {
  return value.toFixed(1) + '%'
}

const getSavingsColor = (savings: number): string => {
  if (savings > 0) return 'var(--color-success, #28a745)'
  if (savings < 0) return 'var(--color-danger, #dc3545)'
  return 'var(--color-text-secondary, #888)'
}

const getTierColor = (tier: string): string => {
  const colors: Record<string, string> = {
    'premium': 'var(--color-accent, #646cff)',
    'standard': 'var(--color-info, #17a2b8)',
    'economy': 'var(--color-success, #28a745)',
    'budget': 'var(--color-warning, #ffc107)'
  }
  return colors[tier.toLowerCase()] || 'var(--color-text-secondary, #888)'
}

// ============================================================================
// Components
// ============================================================================

const CurrentModelCard = ({ currentModel, currentCost, inputTokens, outputTokens }: {
  currentModel: string
  currentCost: number
  inputTokens: number
  outputTokens: number
}) => {
  const totalTokens = inputTokens + outputTokens
  const tokensPerDollar = currentCost > 0 ? totalTokens / currentCost : 0

  return (
    <div style={{
      background: 'var(--color-bg-primary, #1a1a1a)',
      border: '1px solid var(--color-border, #333)',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        marginBottom: '16px',
        color: 'var(--color-text-primary, #fff)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '20px' }}>📊</span>
        Current Model Usage
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Model
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {currentModel}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Total Cost
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-accent, #646cff)' }}>
            {formatCurrency(currentCost)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Total Tokens
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {formatNumber(totalTokens)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Efficiency (Tokens/$)
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-success, #28a745)' }}>
            {formatNumber(tokensPerDollar)}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid var(--color-border, #333)',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        fontSize: '12px'
      }}>
        <div>
          <span style={{ color: 'var(--color-text-secondary, #888)' }}>Input Tokens: </span>
          <span style={{ color: 'var(--color-text-primary, #fff)', fontWeight: 600 }}>
            {formatNumber(inputTokens)}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-secondary, #888)' }}>Output Tokens: </span>
          <span style={{ color: 'var(--color-text-primary, #fff)', fontWeight: 600 }}>
            {formatNumber(outputTokens)}
          </span>
        </div>
      </div>
    </div>
  )
}

const AlternativeRow = ({ alternative, isRecommended, index }: {
  alternative: Alternative
  isRecommended: boolean
  index: number
}) => {
  const rowStyle = isRecommended
    ? {
        background: 'var(--color-success, #28a745)10',
        borderLeft: '3px solid var(--color-success, #28a745)'
      }
    : {
        background: index % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary, #2a2a2a)20'
      }

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border, #333)', ...rowStyle }}>
      <td style={{ padding: '12px', color: 'var(--color-text-primary, #fff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRecommended && (
            <span style={{
              background: 'var(--color-success, #28a745)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '3px',
              textTransform: 'uppercase'
            }}>
              Recommended
            </span>
          )}
          <span>{alternative.model}</span>
        </div>
      </td>
      <td style={{ padding: '12px', textAlign: 'right' }}>
        <span style={{
          color: getTierColor(alternative.tier),
          fontWeight: 600,
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '4px',
          background: `${getTierColor(alternative.tier)}20`
        }}>
          {alternative.tier}
        </span>
      </td>
      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--color-text-primary, #fff)' }}>
        {formatCurrency(alternative.estimatedCost)}
      </td>
      <td style={{ padding: '12px', textAlign: 'right', color: getSavingsColor(alternative.savings), fontWeight: 600 }}>
        {alternative.savings > 0 ? '-' : '+'}{formatCurrency(Math.abs(alternative.savings))}
      </td>
      <td style={{ padding: '12px', textAlign: 'right', color: getSavingsColor(alternative.savings), fontWeight: 600 }}>
        {alternative.savings > 0 ? '-' : '+'}{formatPercent(Math.abs(alternative.savingsPercent))}
      </td>
    </tr>
  )
}

const ComparisonTable = ({ alternatives }: { alternatives: Alternative[] }) => {
  if (!alternatives || alternatives.length === 0) {
    return (
      <div style={{ color: 'var(--color-text-secondary, #888)', padding: '20px', textAlign: 'center' }}>
        No alternative models available
      </div>
    )
  }

  // Find the best alternative (highest savings)
  const bestAlternative = alternatives.reduce((best, alt) =>
    alt.savings > best.savings ? alt : best
  , alternatives[0])

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border, #333)' }}>
          <th style={{ textAlign: 'left', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>
            Model
          </th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>
            Tier
          </th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>
            Est. Cost
          </th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>
            Savings
          </th>
          <th style={{ textAlign: 'right', padding: '12px', color: 'var(--color-text-secondary, #888)', fontWeight: 600 }}>
            Savings %
          </th>
        </tr>
      </thead>
      <tbody>
        {alternatives.map((alt, index) => (
          <AlternativeRow
            key={alt.model}
            alternative={alt}
            isRecommended={alt.model === bestAlternative.model}
            index={index}
          />
        ))}
      </tbody>
    </table>
  )
}

const SummaryCard = ({ alternatives }: { alternatives: Alternative[] }) => {
  if (!alternatives || alternatives.length === 0) {
    return null
  }

  const bestAlternative = alternatives.reduce((best, alt) =>
    alt.savings > best.savings ? alt : best
  , alternatives[0])

  const totalSavings = alternatives
    .filter(alt => alt.savings > 0)
    .reduce((sum, alt) => sum + alt.savings, 0)

  const avgSavingsPercent = alternatives.length > 0
    ? alternatives.reduce((sum, alt) => sum + alt.savingsPercent, 0) / alternatives.length
    : 0

  return (
    <div style={{
      background: 'var(--color-bg-primary, #1a1a1a)',
      border: '1px solid var(--color-border, #333)',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        marginBottom: '16px',
        color: 'var(--color-text-primary, #fff)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '20px' }}>💡</span>
        ROI Summary
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Best Alternative
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-success, #28a745)' }}>
            {bestAlternative.model}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #888)', marginTop: '2px' }}>
            {bestAlternative.tier}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Max Savings
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-success, #28a745)' }}>
            {formatCurrency(bestAlternative.savings)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #888)', marginTop: '2px' }}>
            {formatPercent(bestAlternative.savingsPercent)} discount
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Alternatives Analyzed
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary, #fff)' }}>
            {alternatives.length}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginBottom: '4px' }}>
            Avg Savings
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: avgSavingsPercent > 0 ? 'var(--color-success, #28a745)' : 'var(--color-text-secondary, #888)' }}>
            {avgSavingsPercent > 0 ? '-' : '+'}{formatPercent(Math.abs(avgSavingsPercent))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ROIComparison({
  currentModel,
  currentCost,
  alternatives,
  inputTokens,
  outputTokens
}: ROIComparisonProps) {
  // Sort alternatives by savings (highest first)
  const sortedAlternatives = useMemo(() => {
    return [...alternatives].sort((a, b) => b.savings - a.savings)
  }, [alternatives])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary, #fff)' }}>
          ROI Comparison
        </h2>
        <p style={{ color: 'var(--color-text-secondary, #888)', marginTop: '4px', fontSize: '14px' }}>
          Model cost efficiency analysis and savings potential
        </p>
      </div>

      {/* Current Model Card */}
      <CurrentModelCard
        currentModel={currentModel}
        currentCost={currentCost}
        inputTokens={inputTokens}
        outputTokens={outputTokens}
      />

      {/* Summary Card */}
      <SummaryCard alternatives={sortedAlternatives} />

      {/* Comparison Table */}
      <div style={{
        background: 'var(--color-bg-primary, #1a1a1a)',
        border: '1px solid var(--color-border, #333)',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: '16px',
          color: 'var(--color-text-primary, #fff)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>📈</span>
          Alternative Models
        </h3>
        <ComparisonTable alternatives={sortedAlternatives} />
      </div>
    </div>
  )
}