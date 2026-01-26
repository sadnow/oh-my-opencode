/**
 * Model Tiers
 * Defines model tiers for budget-aware orchestration
 */

import type { ModelTier } from "../../config/schema"
import type { TierConfig, ModelRef } from "./types"

/**
 * Model tiers with models ordered by preference within each tier.
 * Cost estimates are rough averages for cost comparison.
 */
export const MODEL_TIERS: Record<ModelTier, TierConfig> = {
  premium: {
    models: [
      "anthropic/claude-opus-4-5",
      "openai/gpt-5.2-codex",
      "opencode/kimi-k2-thinking",
    ],
    avgCostPer1M: 45, // ~$15 input + $75 output average
  },
  standard: {
    models: [
      "anthropic/claude-sonnet-4-5",
      "opencode/glm-4.7",
      "openai/gpt-5.2",
    ],
    avgCostPer1M: 9, // ~$3 input + $15 output average
  },
  budget: {
    models: [
      "google/gemini-3-flash",
      "opencode/glm-4.6",
      "opencode/big-pickle",
    ],
    avgCostPer1M: 1.25, // ~$0.5 input + $2 output average
  },
  economy: {
    models: [
      "anthropic/claude-haiku-4-5",
      "openai/gpt-5-nano",
      "google/gemini-3-flash",
    ],
    avgCostPer1M: 0.75, // ~$0.25 input + $1.25 output average
  },
}

/**
 * Tier order from most expensive to least expensive.
 */
export const TIER_ORDER: ModelTier[] = ["premium", "standard", "budget", "economy"]

/**
 * Get the tier for a given model.
 */
export function getModelTier(model: ModelRef | string): ModelTier | null {
  const modelStr = typeof model === "string" ? model : `${model.providerID}/${model.modelID}`

  for (const [tier, config] of Object.entries(MODEL_TIERS)) {
    if (config.models.includes(modelStr)) {
      return tier as ModelTier
    }
  }

  // Try matching by model ID only (for flexibility)
  const modelID = typeof model === "string" ? model.split("/")[1] : model.modelID
  for (const [tier, config] of Object.entries(MODEL_TIERS)) {
    if (config.models.some((m) => m.endsWith(`/${modelID}`))) {
      return tier as ModelTier
    }
  }

  return null
}

/**
 * Get models available in a tier.
 */
export function getModelsInTier(tier: ModelTier): string[] {
  return MODEL_TIERS[tier].models
}

/**
 * Get the next lower tier.
 */
export function getNextLowerTier(currentTier: ModelTier): ModelTier | null {
  const currentIndex = TIER_ORDER.indexOf(currentTier)
  if (currentIndex === -1 || currentIndex >= TIER_ORDER.length - 1) {
    return null
  }
  return TIER_ORDER[currentIndex + 1]
}

/**
 * Get the next higher tier.
 */
export function getNextHigherTier(currentTier: ModelTier): ModelTier | null {
  const currentIndex = TIER_ORDER.indexOf(currentTier)
  if (currentIndex === -1 || currentIndex <= 0) {
    return null
  }
  return TIER_ORDER[currentIndex - 1]
}

/**
 * Get the best available model in a tier given available providers.
 */
export function getBestModelInTier(
  tier: ModelTier,
  availableProviders: string[]
): ModelRef | null {
  const models = MODEL_TIERS[tier].models

  for (const modelStr of models) {
    const [providerID, modelID] = modelStr.split("/")
    // OpenCode models are always available
    if (availableProviders.includes(providerID) || providerID === "opencode") {
      return { providerID, modelID }
    }
  }

  return null
}

/**
 * Find an equivalent or lower-tier model given available providers.
 */
export function findDowngradedModel(
  original: ModelRef,
  targetTier: ModelTier,
  availableProviders: string[]
): ModelRef | null {
  // First try the target tier
  let model = getBestModelInTier(targetTier, availableProviders)
  if (model) return model

  // Try lower tiers
  let tier = getNextLowerTier(targetTier)
  while (tier) {
    model = getBestModelInTier(tier, availableProviders)
    if (model) return model
    tier = getNextLowerTier(tier)
  }

  // Fallback to opencode/big-pickle
  return { providerID: "opencode", modelID: "big-pickle" }
}

/**
 * Find an equivalent or higher-tier model given available providers.
 * Used when budget headroom allows upgrading to a better model.
 */
export function findUpgradedModel(
  original: ModelRef,
  targetTier: ModelTier,
  availableProviders: string[]
): ModelRef | null {
  const currentTier = getModelTier(original)
  if (!currentTier) return null

  // If already at or above target tier, no upgrade needed
  const currentIndex = TIER_ORDER.indexOf(currentTier)
  const targetIndex = TIER_ORDER.indexOf(targetTier)
  if (currentIndex <= targetIndex) return null

  // First try the target tier
  let model = getBestModelInTier(targetTier, availableProviders)
  if (model) return model

  // Try higher tiers (going toward premium)
  let tier = getNextHigherTier(targetTier)
  while (tier) {
    // But don't go above premium
    if (TIER_ORDER.indexOf(tier) < 0) break

    model = getBestModelInTier(tier, availableProviders)
    if (model) return model
    tier = getNextHigherTier(tier)
  }

  // Try lower tiers if target tier not available
  tier = getNextLowerTier(targetTier)
  while (tier) {
    // But stay above current tier
    if (TIER_ORDER.indexOf(tier) >= currentIndex) break

    model = getBestModelInTier(tier, availableProviders)
    if (model) return model
    tier = getNextLowerTier(tier)
  }

  return null
}

/**
 * Check if model A is more expensive than model B.
 */
export function isMoreExpensive(modelA: ModelRef, modelB: ModelRef): boolean {
  const tierA = getModelTier(modelA)
  const tierB = getModelTier(modelB)

  if (!tierA || !tierB) return false

  const indexA = TIER_ORDER.indexOf(tierA)
  const indexB = TIER_ORDER.indexOf(tierB)

  return indexA < indexB
}

/**
 * Get all models at or below a minimum tier.
 */
export function getModelsAtOrBelowTier(minTier: ModelTier): string[] {
  const minIndex = TIER_ORDER.indexOf(minTier)
  const models: string[] = []

  for (let i = minIndex; i < TIER_ORDER.length; i++) {
    models.push(...MODEL_TIERS[TIER_ORDER[i]].models)
  }

  return models
}

/**
 * Parse a model string into a ModelRef.
 */
export function parseModelRef(model: string): ModelRef {
  const parts = model.split("/")
  if (parts.length === 2) {
    return { providerID: parts[0], modelID: parts[1] }
  }
  // Assume opencode provider if no prefix
  return { providerID: "opencode", modelID: model }
}

/**
 * Format a ModelRef as a string.
 */
export function formatModelRef(model: ModelRef): string {
  return `${model.providerID}/${model.modelID}`
}
