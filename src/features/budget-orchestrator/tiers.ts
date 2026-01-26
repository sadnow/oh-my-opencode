/**
 * Model Tiers
 * Defines model tiers for budget-aware orchestration
 */

import type { ModelTier } from "../../config/schema"
import type { TierConfig, ModelRef } from "./types"

/**
 * Model tiers with models ordered by preference within each tier.
 * Cost estimates are rough averages for cost comparison.
 *
 * Models are listed in priority order - first available model is used.
 * Includes both current and legacy model names for compatibility.
 */
export const MODEL_TIERS: Record<ModelTier, TierConfig> = {
  premium: {
    models: [
      // Anthropic premium
      "anthropic/claude-opus-4-5",
      "anthropic/claude-4-opus",
      "anthropic/claude-3-opus",
      // OpenAI premium
      "openai/gpt-5.2-codex",
      "openai/gpt-4.5",
      "openai/gpt-4-turbo",
      "openai/o1",
      "openai/o1-preview",
      // OpenCode premium
      "opencode/kimi-k2-thinking",
      "opencode/qwen3-coder-480b",
      // Google premium
      "google/gemini-2-pro",
      "google/gemini-ultra",
    ],
    avgCostPer1M: 45, // ~$15 input + $75 output average
  },
  standard: {
    models: [
      // Anthropic standard
      "anthropic/claude-sonnet-4-5",
      "anthropic/claude-4-sonnet",
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3-sonnet",
      // OpenCode standard
      "opencode/glm-4.7",
      "opencode/kimi-k2-0905",
      // OpenAI standard
      "openai/gpt-5.2",
      "openai/gpt-4o",
      "openai/gpt-4",
      // Google standard
      "google/gemini-2-flash",
      "google/gemini-1.5-pro",
    ],
    avgCostPer1M: 9, // ~$3 input + $15 output average
  },
  budget: {
    models: [
      // Google budget
      "google/gemini-3-flash",
      "google/gemini-1.5-flash",
      // OpenCode budget
      "opencode/glm-4.6",
      "opencode/big-pickle",
      // OpenAI budget
      "openai/gpt-4o-mini",
      "openai/gpt-3.5-turbo",
    ],
    avgCostPer1M: 1.25, // ~$0.5 input + $2 output average
  },
  economy: {
    models: [
      // Anthropic economy
      "anthropic/claude-haiku-4-5",
      "anthropic/claude-4-haiku",
      "anthropic/claude-3.5-haiku",
      "anthropic/claude-3-haiku",
      // OpenAI economy
      "openai/gpt-5-nano",
      "openai/gpt-4o-mini",
      // Google economy
      "google/gemini-3-flash",
      "google/gemini-flash",
    ],
    avgCostPer1M: 0.75, // ~$0.25 input + $1.25 output average
  },
}

/**
 * Fallback tier for unknown models.
 * If a model isn't in MODEL_TIERS, we assume it's standard tier.
 */
export const DEFAULT_TIER: ModelTier = "standard"

/**
 * Tier order from most expensive to least expensive.
 */
export const TIER_ORDER: ModelTier[] = ["premium", "standard", "budget", "economy"]

/**
 * Get the tier for a given model.
 * Returns DEFAULT_TIER ("standard") for unknown models rather than null.
 *
 * @param model - Model reference or string in "provider/model" format
 * @param strict - If true, returns null for unknown models instead of default
 */
export function getModelTier(model: ModelRef | string, strict: boolean = false): ModelTier | null {
  const modelStr = typeof model === "string" ? model : `${model.providerID}/${model.modelID}`
  const normalizedStr = modelStr.toLowerCase()

  for (const [tier, config] of Object.entries(MODEL_TIERS)) {
    // Case-insensitive exact match
    if (config.models.some(m => m.toLowerCase() === normalizedStr)) {
      return tier as ModelTier
    }
  }

  // Try matching by model ID only (for flexibility)
  const modelID = typeof model === "string" ? model.split("/")[1] : model.modelID
  if (modelID) {
    const normalizedID = modelID.toLowerCase()
    for (const [tier, config] of Object.entries(MODEL_TIERS)) {
      if (config.models.some((m) => m.toLowerCase().endsWith(`/${normalizedID}`))) {
        return tier as ModelTier
      }
    }

    // Partial match on model ID (e.g., "claude-sonnet" matches "claude-4-sonnet")
    for (const [tier, config] of Object.entries(MODEL_TIERS)) {
      if (config.models.some((m) => {
        const tierModelID = m.split("/")[1]?.toLowerCase() ?? ""
        return tierModelID.includes(normalizedID) || normalizedID.includes(tierModelID)
      })) {
        return tier as ModelTier
      }
    }
  }

  // Return default tier for unknown models (unless strict mode)
  return strict ? null : DEFAULT_TIER
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
