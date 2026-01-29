import { PRESETS } from '../../../cli/wizard/presets'
import type { PresetConfig } from '../../../cli/wizard/presets'

export function PresetComparison() {
  // Filter out null presets (custom) and convert to array with keys
  const presetEntries = Object.entries(PRESETS)
    .filter((entry): entry is [string, PresetConfig] => entry[1] !== null)
  
  if (presetEntries.length === 0) return null
  
  const categories = Object.keys(presetEntries[0][1].categories)
  
  return (
    <div className="preset-comparison">
      <h2>Preset Comparison</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            {presetEntries.map(([presetName]) => (
              <th key={presetName}>{presetName}</th>
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
        </tbody>
      </table>
    </div>
  )
}
