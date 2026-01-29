import { PRESETS, MODEL_TIERS, PROVIDER_PREFIXES, COPILOT_MODELS } from './presets'
import type { PresetConfig } from './presets'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validatePreset(preset: PresetConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check 1: All models exist
  for (const [category, config] of Object.entries(preset.categories)) {
    const model = config?.model
    if (!model) continue

    const [provider, modelId] = model.split('/')
    
    const isKnownModelId = Object.values(MODEL_TIERS).some(tierModels => 
      (tierModels as readonly string[]).includes(modelId)
    ) || Object.values(COPILOT_MODELS).some(tierModels => 
      (tierModels as readonly string[]).some(m => m.split('/')[1] === modelId)
    )
    const isKnownProvider = PROVIDER_PREFIXES[modelId] === provider || 
                           PROVIDER_PREFIXES[provider] !== undefined ||
                           provider === 'github-copilot'
    
    if (!isKnownModelId && !isKnownProvider) {
      errors.push(`Unknown model in ${category}: ${model}`)
    }
  }
  
  // Check 2: Required providers accurate
  const usedProviders = new Set(
    Object.values(preset.categories)
      .map(c => c?.model?.split('/')[0])
      .filter((p): p is string => !!p)
  )
  const missing = preset.requiredProviders.filter(p => !usedProviders.has(p))
  const extra = [...usedProviders].filter(p => !preset.requiredProviders.includes(p))
  
  if (missing.length) warnings.push(`Required providers not used: ${missing.join(', ')}`)
  if (extra.length) warnings.push(`Used providers not in required list: ${extra.join(', ')}`)
  
  // Check 3: No duplicate models
  const models = Object.values(preset.categories)
    .map(c => c?.model)
    .filter((m): m is string => !!m)
  const duplicates = models.filter((m, i) => models.indexOf(m) !== i)
  if (duplicates.length) {
    warnings.push(`Duplicate models: ${[...new Set(duplicates)].join(', ')}`)
  }
  
  // Check 4: Cost estimates reasonable
  if (preset.metadata?.estimatedCostPerHour) {
    const cost = preset.metadata.estimatedCostPerHour
    if (cost < 0 || cost > 100) {
      warnings.push(`Unusual cost estimate: $${cost}/hour`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateAllPresets() {
  const results: Record<string, ValidationResult> = {}
  
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (preset) {
      results[name] = validatePreset(preset)
    }
  }
  
  return results
}
