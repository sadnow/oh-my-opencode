/**
 * Model Tiers
 * Defines model tiers for budget-aware orchestration
 */

import type { ModelTier } from "../../config/schema"
import type { TierConfig, ModelRef } from "./types"
import { normalizeModelID } from "../../shared/model-normalizer"

/**
 * Model tiers with models ordered by preference within each tier.
 * Cost estimates are rough averages for cost comparison.
 *
 * Models are listed in priority order - first available model is used.
 * Updated January 2026 with current model names from models.dev registry.
 *
 * Pricing reference (per 1M tokens, input/output):
 * - Premium: $3-5 / $15-25 (Opus 4.5, GPT-5.2-Codex, o3)
 * - Standard: $1-3 / $5-15 (Sonnet 4.5, GPT-5.2, Gemini 3 Pro)
 * - Budget: $0.5-1 / $2-5 (Haiku 4.5, Gemini 3 Flash, GLM-4.7, Kimi K2)
 * - Economy: $0.05-0.25 / $0.4-1 (GPT-4.1-nano, Qwen3, Gemini Flash Lite)
 */
export const MODEL_TIERS: Record<ModelTier, TierConfig> = {
  premium: {
    models: [
      // Anthropic premium ($5/$25) - Latest 2026 models
      "anthropic/claude-opus-4-5",
      "anthropic/claude-opus-4-5-20251101",
      "anthropic/claude-opus-4-1",
      "anthropic/claude-opus-4-0",
      // OpenAI premium - o-series and GPT-5.2
      "openai/o1-pro",
      "openai/gpt-5.2-codex",
      "openai/gpt-5.2-pro",
      // Google premium - Gemini 3 Pro
      "google/gemini-3-pro-preview",
      "google/gemini-3-pro",
      "google/gemini-2.5-pro",
      // GitHub Copilot premium (included in Pro+ subscription)
      // Per https://docs.github.com/en/copilot/reference/ai-models/supported-models
      "github-copilot/claude-opus-4.5",     // 3x multiplier but best reasoning
      "github-copilot/gpt-5.2-codex",       // 1x multiplier
      "github-copilot/claude-sonnet-4.5",   // 1x multiplier
      "github-copilot/gpt-5.2",             // 1x multiplier
    ],
    avgCostPer1M: 20, // ~$5 input + $25 output average
  },
  standard: {
    models: [
      // Anthropic standard ($3/$15)
      "anthropic/claude-sonnet-4-5",
      "anthropic/claude-sonnet-4-5-20250929",
      "anthropic/claude-sonnet-4-0",
      "anthropic/claude-3-7-sonnet-latest",
      // OpenAI standard
      "openai/gpt-5.2",
      "openai/gpt-5.1",
      "openai/gpt-5.1-codex",
      "openai/o1",
      "openai/o1-mini",
      // Google standard - Gemini 2.5/3 Pro
      "google/gemini-2.5-pro-preview-06-05",
      "google/gemini-2.5-pro",
      // OpenCode standard
      "opencode/glm-4.7",
      "opencode/kimi-k2.5",
      "opencode/kimi-k2-0905",
      // GitHub Copilot standard (included in Pro+ subscription, 1x multiplier)
      "github-copilot/gpt-5.1-codex",
      "github-copilot/claude-sonnet-4",
      "github-copilot/gemini-2.5-pro",
      "github-copilot/gpt-5.1",
    ],
    avgCostPer1M: 9, // ~$3 input + $15 output average
  },
  budget: {
    models: [
      // Anthropic budget ($1/$5)
      "anthropic/claude-haiku-4-5",
      "anthropic/claude-haiku-4-5-20251001",
      "anthropic/claude-3-5-haiku-latest",
      // Google budget - Gemini 3/2.5 Flash ($0.50/$3)
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      // OpenCode budget ($0.60/$2.20)
      "opencode/kimi-k2.5-free",
      "opencode/glm-4.7-free",
      "opencode/glm-4.6",
      "opencode/kimi-k2-thinking",
      "opencode/kimi-k2-thinking-turbo",
      "opencode/big-pickle",
      // OpenAI budget
      "openai/gpt-4.1-mini",
      "openai/o4-mini",
      // GitHub Copilot budget (included in Pro+ subscription)
      // 0x multiplier = FREE!
      "github-copilot/gpt-5-mini",
      "github-copilot/gpt-4.1",
      // 0.25x-0.33x multiplier = very cheap
      "github-copilot/gpt-5.1-codex-mini",
      "github-copilot/claude-haiku-4.5",
      "github-copilot/gemini-3-flash",
      "github-copilot/grok-code-fast-1",
    ],
    avgCostPer1M: 2.5, // ~$0.5 input + $3 output average
  },
  economy: {
    models: [
      // OpenAI economy ($0.05/$0.40)
      "openai/gpt-4.1-nano",
      "openai/gpt-5-nano",
      // Google economy - Flash Lite
      "google/gemini-2.5-flash-lite",
      "google/gemini-2.5-flash-lite-preview-09-2025",
      // OpenCode economy - Qwen3 Coder
      "opencode/qwen3-coder",
      "opencode/minimax-m2.1-free",
      "opencode/qwen3-coder-30b-a3b",
      "opencode/qwen3-coder-480b-a35b-instruct",
      "opencode/glm-4.5-flash",
    ],
    avgCostPer1M: 0.5, // ~$0.1 input + $0.5 output average
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
    return { providerID: parts[0], modelID: normalizeModelID(parts[1]) }
  }
  // Assume opencode provider if no prefix
  return { providerID: "opencode", modelID: normalizeModelID(model) }
}

/**
 * Format a ModelRef as a string.
 */
export function formatModelRef(model: ModelRef): string {
  return `${model.providerID}/${model.modelID}`
}
