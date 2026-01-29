import { describe, test, expect } from 'bun:test'
import { renderWithProviders, screen } from '../test-utils'
import { PresetComparison } from './PresetComparison'

describe('PresetComparison', () => {
  test('renders all 9 presets', () => {
    renderWithProviders(<PresetComparison />)
    expect(screen.getByText('default')).toBeDefined()
    expect(screen.getByText('balanced')).toBeDefined()
  })
  
  test('shows category rows', () => {
    renderWithProviders(<PresetComparison />)
    expect(screen.getByText('ultrabrain')).toBeDefined()
    expect(screen.getByText('quick')).toBeDefined()
  })
  
  test('displays model names', () => {
    renderWithProviders(<PresetComparison />)
    expect(screen.getByText(/claude-opus-4-5/)).toBeDefined()
  })
})
