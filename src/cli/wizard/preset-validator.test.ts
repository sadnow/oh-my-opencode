import { describe, test, expect } from 'bun:test'
import { validatePreset, validateAllPresets } from './preset-validator'
import { DEFAULT_PRESET } from './presets'

describe('validatePreset', () => {
  test('validates default preset successfully', () => {
    const result = validatePreset(DEFAULT_PRESET)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
  
  test('catches unknown model', () => {
    const invalid = {
      ...DEFAULT_PRESET,
      categories: {
        ...DEFAULT_PRESET.categories,
        ultrabrain: { description: 'test', model: 'fake/nonexistent' }
      }
    }
    const result = validatePreset(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Unknown model'))).toBe(true)
  })
  
  test('warns about duplicate models', () => {
    const duplicate = {
      ...DEFAULT_PRESET,
      categories: {
        ultrabrain: { description: 'test', model: 'anthropic/claude-opus-4-5' },
        quick: { description: 'test', model: 'anthropic/claude-opus-4-5' }
      }
    }
    const result = validatePreset(duplicate)
    expect(result.warnings.some(w => w.includes('Duplicate'))).toBe(true)
  })
})

describe('validateAllPresets', () => {
  test('validates all 9 presets', () => {
    const results = validateAllPresets()
    // We expect 9 presets based on the requirements (excluding 'custom' which is null)
    const validPresetsCount = Object.keys(results).length
    expect(validPresetsCount).toBe(9)
    
    // All should be valid (or document issues)
    for (const [name, result] of Object.entries(results)) {
      if (!result.valid) {
        console.log(`${name} validation issues:`, result.errors)
      }
      expect(result.valid).toBe(true)
    }
  })
})
