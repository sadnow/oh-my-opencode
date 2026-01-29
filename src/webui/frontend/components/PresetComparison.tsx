import { PRESETS } from '../../../cli/wizard/presets'
import type { PresetConfig } from '../../../cli/wizard/presets'

export function PresetComparison() {
  // Filter out null presets (custom) and convert to array with keys
  const presetEntries = Object.entries(PRESETS)
    .filter((entry): entry is [string, PresetConfig] => entry[1] !== null)
  
  if (presetEntries.length === 0) return null
  
  const categories = Object.keys(presetEntries[0][1].categories)
  
  // Find the most cost-effective preset (lowest cost per hour)
  const cheapestPreset = presetEntries.reduce((min, entry) => {
    const cost = entry[1].metadata?.estimatedCostPerHour ?? Infinity
    const minCost = min[1].metadata?.estimatedCostPerHour ?? Infinity
    return cost < minCost ? entry : min
  }, presetEntries[0] as [string, PresetConfig])
  
  return (
    <div className="preset-comparison">
      <h2>Preset Comparison</h2>
      <p className="cost-disclaimer">
        <small>💰 Cost estimates based on typical usage patterns. Actual costs may vary.</small>
      </p>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            {presetEntries.map(([presetName]) => (
              <th key={presetName} className={presetName === cheapestPreset[0] ? 'recommended' : ''}>
                {presetName}
                {presetName === cheapestPreset[0] && <span className="recommended-badge">⭐ Best Value</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => (
            <tr key={cat}>
              <td>{cat}</td>
              {presetEntries.map(([presetName, preset]) => (
                <td key={presetName} title={preset.categoryRationale?.[cat]?.whyThisModel}>
                  {preset.categories[cat]?.model || 'N/A'}
                </td>
              ))}
            </tr>
          ))}
          <tr className="cost-row">
            <td><strong>Est. Cost/Hour</strong></td>
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
  )
}
