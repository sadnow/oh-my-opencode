import { useState } from 'react'
import { PRESETS } from '../../../cli/wizard/presets'
import type { PresetConfig } from '../../../cli/wizard/presets'

export function PresetComparison() {
  const [searchQuery, setSearchQuery] = useState('')
  // Filter out null presets (custom) and convert to array with keys
  const presetEntries = Object.entries(PRESETS)
    .filter((entry): entry is [string, PresetConfig] => entry[1] !== null)
  
  if (presetEntries.length === 0) return null
  
  // Collect all unique categories from all presets
  const categoriesSet = new Set<string>()
  presetEntries.forEach(([_, preset]) => {
    Object.keys(preset.categories).forEach(cat => categoriesSet.add(cat))
  })
  const categories = Array.from(categoriesSet).sort()
  
  // Filter categories based on search query (case-insensitive)
  const filteredCategories = categories.filter(cat =>
    cat.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // Find the most cost-effective preset (lowest cost per hour)
  const cheapestPreset = presetEntries.reduce((min, entry) => {
    const cost = entry[1].metadata?.estimatedCostPerHour ?? Infinity
    const minCost = min[1].metadata?.estimatedCostPerHour ?? Infinity
    return cost < minCost ? entry : min
  }, presetEntries[0] as [string, PresetConfig])
  
  return (
    <div className="preset-comparison">
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-sm)' }}>
        Preset Comparison
      </h2>
      <p className="cost-disclaimer" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
        <small>💰 Cost estimates based on typical usage patterns. Actual costs may vary.</small>
      </p>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-lg)' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          className="search-input"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 'var(--space-md)',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-lg)',
              padding: '0',
              lineHeight: '1'
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
        <thead>
          <tr>
            <th>Category</th>
            {presetEntries.map(([presetName]) => (
              <th key={presetName} className={presetName === cheapestPreset[0] ? 'recommended' : ''}>
                {presetName}
                {presetName === cheapestPreset[0] && (
                  <span className="tooltip-trigger" aria-label="Best value explanation">
                    <span className="recommended-badge">⭐ Best Value</span>
                    <span className="tooltip-icon">?</span>
                    <span className="tooltip-content" role="tooltip">
                      Lowest estimated cost per hour
                    </span>
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredCategories.length === 0 ? (
            <tr>
              <td colSpan={presetEntries.length + 1} style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                No categories match your search
              </td>
            </tr>
          ) : (
            filteredCategories.map(cat => (
              <tr key={cat}>
                <td>{cat}</td>
                {presetEntries.map(([presetName, preset]) => {
                  const rationale = preset.categoryRationale?.[cat]?.whyThisModel
                  return (
                    <td key={presetName}>
                      {rationale ? (
                        <span className="tooltip-trigger" aria-label={`Model rationale for ${cat}`}>
                          {preset.categories[cat]?.model || 'N/A'}
                          <span className="tooltip-icon">ℹ️</span>
                          <span className="tooltip-content" role="tooltip">
                            {rationale}
                          </span>
                        </span>
                      ) : (
                        preset.categories[cat]?.model || 'N/A'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
          <tr className="cost-row">
            <td>
              <span className="tooltip-trigger" aria-label="Cost estimate explanation">
                <strong>Est. Cost/Hour</strong>
                <span className="tooltip-icon">?</span>
                <span className="tooltip-content" role="tooltip">
                  Based on typical usage patterns
                </span>
              </span>
            </td>
            {presetEntries.map(([presetName, preset]) => {
              const cost = preset.metadata?.estimatedCostPerHour
              return (
                <td key={presetName} className={presetName === cheapestPreset[0] ? 'recommended' : ''}>
                  {cost !== undefined && cost !== null
                    ? cost === 0
                      ? 'Free'
                      : `~$${cost.toFixed(2)}/hr`
                    : 'N/A'}
                </td>
              )
            })}
          </tr>
          <tr className="cost-row">
            <td><strong>Est. Cost/Day</strong></td>
            {presetEntries.map(([presetName, preset]) => {
              const cost = preset.metadata?.estimatedCostPerHour
              return (
                <td key={presetName} className={presetName === cheapestPreset[0] ? 'recommended' : ''}>
                  {cost !== undefined && cost !== null
                    ? cost === 0
                      ? 'Free'
                      : `~$${(cost * 8).toFixed(2)}/day`
                    : 'N/A'}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  )
}
