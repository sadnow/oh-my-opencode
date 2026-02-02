import { describe, test, expect } from 'bun:test'
import { renderWithProviders } from '../test-utils'
import { PresetComparison } from './PresetComparison'

describe('PresetComparison', () => {
  test('renders all 9 presets', () => {
    const { getByText } = renderWithProviders(<PresetComparison />)
    expect(getByText('default')).toBeDefined()
    expect(getByText('balanced')).toBeDefined()
  })
  
  test('shows category rows', () => {
    const { getByText } = renderWithProviders(<PresetComparison />)
    expect(getByText('ultrabrain')).toBeDefined()
    expect(getByText('quick')).toBeDefined()
  })
  
  test('displays model names', () => {
    const { container } = renderWithProviders(<PresetComparison />)
    // Model names are displayed with provider prefix (e.g., anthropic/claude-opus-4-5)
    expect(container.textContent).toContain('claude-opus-4-5')
  })
})
