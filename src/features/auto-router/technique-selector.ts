/**
 * Technique Selector
 * Determines optimal technique combination based on task classification
 */

import type {
  TaskClassification,
  TechniqueCombo,
  DomainSignal,
} from "./types"
import {
  TECHNIQUE_SELECTION_MATRIX,
  DOMAIN_TECHNIQUE_OVERRIDES,
  TECHNIQUES_WITH_ULTRATHINK,
  TECHNIQUES_WITH_ULW,
  TECHNIQUES_WITH_RALPH,
} from "./constants"
import { log } from "../../shared/logger"

/**
 * Select optimal technique based on classification
 */
export function selectTechnique(classification: TaskClassification): TechniqueCombo {
  // Build selection key for matrix lookup
  const key = buildSelectionKey(classification)

  // Get base technique from matrix or default
  let baseTechnique =
    TECHNIQUE_SELECTION_MATRIX[key as keyof typeof TECHNIQUE_SELECTION_MATRIX] ||
    getDefaultTechnique(classification)

  // Check for domain-specific overrides (can upgrade the base technique)
  for (const signal of classification.domainSignals) {
    const override = DOMAIN_TECHNIQUE_OVERRIDES[signal]
    if (override) {
      // Use override if it's more capable than current base
      baseTechnique = selectMoreCapable(baseTechnique, override)
    }
  }

  // Apply additional domain modifiers for signals not in overrides
  return applyDomainModifiers(baseTechnique, classification)
}

/**
 * Select the more capable of two techniques
 */
function selectMoreCapable(a: TechniqueCombo, b: TechniqueCombo): TechniqueCombo {
  const ranking: Record<TechniqueCombo, number> = {
    direct: 1,
    ulw: 2,
    ultrathink: 2,
    ralph: 2,
    "ulw+ralph": 3,
    "ultrathink+ulw": 3,
    "ultrathink+ralph": 3,
    triple: 4,
  }
  return ranking[a] >= ranking[b] ? a : b
}

/**
 * Build selection key from classification
 */
function buildSelectionKey(classification: TaskClassification): string {
  const tier = `tier${classification.complexityTier}`
  const novelty = classification.noveltyLevel
  const tests = classification.hasTests ? "tests" : "notests"

  return `${tier}-${novelty}-${tests}`
}

/**
 * Get default technique based on complexity
 */
function getDefaultTechnique(classification: TaskClassification): TechniqueCombo {
  switch (classification.complexityTier) {
    case 1:
      return classification.hasTests ? "direct" : "ulw"
    case 2:
      return classification.hasTests ? "ulw" : "ulw+ralph"
    case 3:
      return "triple"
    default:
      return "ulw"
  }
}

/**
 * Apply domain-specific modifiers to technique selection
 * v3.3.0: Now includes intelligent ralph loop determination based on complexity
 */
function applyDomainModifiers(
  base: TechniqueCombo,
  classification: TaskClassification
): TechniqueCombo {
  let result = base

  // ============================================================================
  // v3.3.0: Intelligent Ralph Loop Determination
  // Ralph loop should only be enabled when the task truly needs persistence
  // ============================================================================

  // Tier 3 complex tasks ALWAYS need ralph loop for persistence
  if (classification.complexityTier === 3) {
    result = upgradeToIncludeRalph(result)
  }

  // Tier 2 novel tasks benefit from ralph loop (exploration may take multiple tries)
  if (classification.complexityTier === 2 && classification.noveltyLevel === "novel") {
    result = upgradeToIncludeRalph(result)
  }

  // High-risk domains always need ralph loop regardless of complexity
  if (classification.domainSignals.includes("crypto-trading")) {
    result = upgradeToIncludeRalph(result)
  }

  // ============================================================================
  // Domain-specific modifiers
  // ============================================================================

  // Real-time systems benefit from ultrathink (careful reasoning)
  if (classification.domainSignals.includes("real-time")) {
    result = upgradeToIncludeUltrathink(result)
  }

  // UI-heavy tasks benefit from parallel exploration
  if (classification.domainSignals.includes("ui-heavy")) {
    result = upgradeToIncludeUlw(result)
  }

  // Data aggregation needs persistence
  if (classification.domainSignals.includes("data-aggregation")) {
    result = upgradeToIncludeRalph(result)
  }

  // Security-sensitive tasks need deep reasoning
  if (classification.domainSignals.includes("security-sensitive")) {
    result = upgradeToIncludeUltrathink(result)
  }

  // Performance-critical tasks need analysis
  if (classification.domainSignals.includes("performance-critical")) {
    result = upgradeToIncludeUltrathink(result)
  }

  // High context exhaustion risk needs Ralph
  if (classification.contextExhaustionRisk === "high") {
    result = upgradeToIncludeRalph(result)
  }

  // High parallelization potential benefits from ulw
  if (classification.parallelizationPotential === "high") {
    result = upgradeToIncludeUlw(result)
  }

  return result
}

/**
 * Upgrade technique to include ultrathink
 */
function upgradeToIncludeUltrathink(current: TechniqueCombo): TechniqueCombo {
  switch (current) {
    case "direct":
      return "ultrathink"
    case "ulw":
      return "ultrathink+ulw"
    case "ralph":
      return "ultrathink+ralph"
    case "ulw+ralph":
      return "triple"
    case "ultrathink":
    case "ultrathink+ulw":
    case "ultrathink+ralph":
    case "triple":
      return current // Already has ultrathink
    default:
      // Log warning for unexpected technique value
      log("[TechniqueSelector] Unknown technique in upgradeToIncludeUltrathink", { technique: current })
      return current
  }
}

/**
 * Upgrade technique to include ulw
 */
function upgradeToIncludeUlw(current: TechniqueCombo): TechniqueCombo {
  switch (current) {
    case "direct":
      return "ulw"
    case "ultrathink":
      return "ultrathink+ulw"
    case "ralph":
      return "ulw+ralph"
    case "ultrathink+ralph":
      return "triple"
    case "ulw":
    case "ulw+ralph":
    case "ultrathink+ulw":
    case "triple":
      return current // Already has ulw
    default:
      // Log warning for unexpected technique value
      log("[TechniqueSelector] Unknown technique in upgradeToIncludeUlw", { technique: current })
      return current
  }
}

/**
 * Upgrade technique to include ralph
 */
function upgradeToIncludeRalph(current: TechniqueCombo): TechniqueCombo {
  switch (current) {
    case "direct":
      return "ralph"
    case "ulw":
      return "ulw+ralph"
    case "ultrathink":
      return "ultrathink+ralph"
    case "ultrathink+ulw":
      return "triple"
    case "ralph":
    case "ulw+ralph":
    case "ultrathink+ralph":
    case "triple":
      return current // Already has ralph
    default:
      // Log warning for unexpected technique value
      log("[TechniqueSelector] Unknown technique in upgradeToIncludeRalph", { technique: current })
      return current
  }
}

/**
 * Get technique description for user display
 */
export function getTechniqueDescription(technique: TechniqueCombo): string {
  switch (technique) {
    case "direct":
      return "Direct execution (simple task, no orchestration needed)"
    case "ulw":
      return "Ultrawork mode (parallel agents + TDD verification)"
    case "ultrathink":
      return "Ultrathink mode (deep reasoning before action)"
    case "ralph":
      return "Ralph loop (persistent execution until completion)"
    case "ulw+ralph":
      return "Ultrawork + Ralph (parallel exploration with persistence)"
    case "ultrathink+ulw":
      return "Ultrathink + Ultrawork (deep reasoning + parallel execution)"
    case "ultrathink+ralph":
      return "Ultrathink + Ralph (deep reasoning with persistence)"
    case "triple":
      return "Full orchestration (ultrathink + ultrawork + ralph loop)"
    default:
      return "Unknown technique"
  }
}

/**
 * Get estimated cost level for technique
 */
export function getTechniqueCostLevel(
  technique: TechniqueCombo
): "low" | "medium" | "high" | "very-high" {
  switch (technique) {
    case "direct":
      return "low"
    case "ulw":
    case "ultrathink":
    case "ralph":
      return "medium"
    case "ulw+ralph":
    case "ultrathink+ulw":
    case "ultrathink+ralph":
      return "high"
    case "triple":
      return "very-high"
    default:
      return "medium"
  }
}

/**
 * Check if technique includes a specific capability
 */
export function techniqueIncludes(
  technique: TechniqueCombo,
  capability: "ultrathink" | "ulw" | "ralph"
): boolean {
  switch (capability) {
    case "ultrathink":
      return TECHNIQUES_WITH_ULTRATHINK.includes(technique)
    case "ulw":
      return TECHNIQUES_WITH_ULW.includes(technique)
    case "ralph":
      return TECHNIQUES_WITH_RALPH.includes(technique)
    default:
      return false
  }
}
