/**
 * Development Preset Selector
 * Automatically applies development presets based on project type and context
 */

import type {
  ProjectType,
  DomainSignal,
  ComplexityTier,
  TechniqueCombo,
  BudgetTier,
} from "./types"
import { DEVELOPMENT_PRESETS, BUDGET_TIER_PRIORITY, type DevelopmentPreset } from "./constants"
import { log } from "../../shared/logger"

// ============================================================================
// Preset Mapping
// ============================================================================

/**
 * Maps project types to their default development presets.
 * Can be overridden by domain signals or explicit user choice.
 */
const PROJECT_TYPE_PRESET_MAP: Partial<Record<ProjectType, string>> = {
  game: "game-prototype",
  "web-app": "production-app",
  "api-server": "production-app",
  cli: "quick-fix",
  library: "production-app",
  bot: "quick-fix",
  "indexer-crawler": "exploration",
  "data-pipeline": "production-app",
  "static-site": "quick-fix",
  monorepo: "production-app",
}

/**
 * Domain signals that override the project type preset
 */
const DOMAIN_PRESET_OVERRIDES: Partial<Record<DomainSignal, string>> = {
  "crypto-trading": "security-audit",
  "security-sensitive": "security-audit",
  "performance-critical": "production-app",
  "research-analysis": "exploration",
}

// ============================================================================
// Selection Functions
// ============================================================================

export interface PresetSelection {
  preset: DevelopmentPreset
  presetName: string
  reason: string
  overrideSource?: "domain" | "project-type" | "default"
}

/**
 * Select the appropriate development preset based on context
 */
export function selectPreset(
  projectType: ProjectType,
  domainSignals: DomainSignal[],
  complexityTier: ComplexityTier,
  explicitPreset?: string
): PresetSelection {
  // Explicit preset takes highest priority
  if (explicitPreset && DEVELOPMENT_PRESETS[explicitPreset]) {
    return {
      preset: DEVELOPMENT_PRESETS[explicitPreset],
      presetName: explicitPreset,
      reason: `Explicitly requested preset "${explicitPreset}"`,
      overrideSource: undefined,
    }
  }

  // Check domain signal overrides (security/crypto take priority)
  for (const signal of domainSignals) {
    const presetName = DOMAIN_PRESET_OVERRIDES[signal]
    if (presetName && DEVELOPMENT_PRESETS[presetName]) {
      return {
        preset: DEVELOPMENT_PRESETS[presetName],
        presetName,
        reason: `Domain signal "${signal}" requires ${presetName} preset`,
        overrideSource: "domain",
      }
    }
  }

  // Check project type mapping
  const projectPresetName = PROJECT_TYPE_PRESET_MAP[projectType]
  if (projectPresetName && DEVELOPMENT_PRESETS[projectPresetName]) {
    return {
      preset: DEVELOPMENT_PRESETS[projectPresetName],
      presetName: projectPresetName,
      reason: `Project type "${projectType}" defaults to ${projectPresetName}`,
      overrideSource: "project-type",
    }
  }

  // Fall back to complexity-based selection
  const complexityPreset = selectPresetByComplexity(complexityTier)
  return {
    preset: DEVELOPMENT_PRESETS[complexityPreset],
    presetName: complexityPreset,
    reason: `Complexity tier ${complexityTier} defaults to ${complexityPreset}`,
    overrideSource: "default",
  }
}

/**
 * Select preset based on complexity tier alone
 */
function selectPresetByComplexity(tier: ComplexityTier): string {
  switch (tier) {
    case 1:
      return "quick-fix"
    case 2:
      return "production-app"
    case 3:
      return "production-app"
    default:
      return "production-app"
  }
}

/**
 * Get all available preset names
 */
export function getAvailablePresets(): string[] {
  return Object.keys(DEVELOPMENT_PRESETS)
}

/**
 * Get a preset by name
 */
export function getPreset(name: string): DevelopmentPreset | undefined {
  return DEVELOPMENT_PRESETS[name]
}

/**
 * Apply preset adjustments to technique and budget selections
 * Returns the adjusted values based on preset configuration
 */
export function applyPresetAdjustments(
  baseSelection: {
    technique: TechniqueCombo
    budget: BudgetTier
    qualityThreshold: number
  },
  preset: DevelopmentPreset
): {
  technique: TechniqueCombo
  budget: BudgetTier
  maxBudget: BudgetTier
  qualityThreshold: number
  adjusted: boolean
  adjustments: string[]
} {
  const adjustments: string[] = []
  let adjusted = false

  let technique = baseSelection.technique
  let budget = baseSelection.budget
  let qualityThreshold = baseSelection.qualityThreshold

  // Apply technique from preset if it's more capable than base selection
  const techniquePriority: Record<TechniqueCombo, number> = {
    direct: 1,
    ulw: 2,
    ultrathink: 2,
    ralph: 2,
    "ulw+ralph": 3,
    "ultrathink+ulw": 3,
    "ultrathink+ralph": 3,
    triple: 4,
  }

  if (techniquePriority[preset.defaultTechnique] > techniquePriority[technique]) {
    technique = preset.defaultTechnique
    adjustments.push(`Technique upgraded to ${technique} (preset default)`)
    adjusted = true
  }

  // Apply budget floor from preset
  if (BUDGET_TIER_PRIORITY[preset.startingBudget] > BUDGET_TIER_PRIORITY[budget]) {
    budget = preset.startingBudget
    adjustments.push(`Budget raised to ${budget} (preset minimum)`)
    adjusted = true
  }

  // Apply quality threshold from preset if stricter
  if (preset.qualityThreshold > qualityThreshold) {
    qualityThreshold = preset.qualityThreshold
    adjustments.push(`Quality threshold raised to ${qualityThreshold} (preset requirement)`)
    adjusted = true
  }

  if (adjusted) {
    log("[PresetSelector] Applied preset adjustments", {
      preset: preset.name,
      adjustments,
    })
  }

  return {
    technique,
    budget,
    maxBudget: preset.maxBudget,
    qualityThreshold,
    adjusted,
    adjustments,
  }
}

/**
 * Check if a task matches a specific preset's criteria
 */
export function matchesPresetCriteria(
  presetName: string,
  projectType: ProjectType,
  domainSignals: DomainSignal[]
): boolean {
  // Check domain overrides
  for (const signal of domainSignals) {
    if (DOMAIN_PRESET_OVERRIDES[signal] === presetName) {
      return true
    }
  }

  // Check project type mapping
  return PROJECT_TYPE_PRESET_MAP[projectType] === presetName
}
