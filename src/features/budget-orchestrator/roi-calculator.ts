/**
 * ROI Calculator Utility
 * Calculates savings and ROI for model cost comparison
 */

import { MODEL_TIERS, getModelTier } from "./tiers"

export interface SavingsResult {
  currentCost: number
  alternativeCost: number
  savings: number
  savingsPercent: number
}

export interface RoiComparison {
  currentModel: string
  currentCost: number
  alternatives: Array<{
    model: string
    tier: string
    estimatedCost: number
    savings: number
    savingsPercent: number
  }>
}

/**
 * Calculate cost for a given model and token counts.
 * Cost = (inputTokens * inputCostPer1M + outputTokens * outputCostPer1M) / 1,000,000
 * 
 * Note: MODEL_TIERS provides avgCostPer1M which is a combined average.
 * We use this for the total tokens to maintain consistency with the tier system.
 */
export function calculateModelCost(model: string, inputTokens: number, outputTokens: number): number {
  const tier = getModelTier(model)
  if (!tier) return 0

  const tierConfig = MODEL_TIERS[tier]
  const totalTokens = inputTokens + outputTokens
  return (totalTokens * tierConfig.avgCostPer1M) / 1_000_000
}

/**
 * Calculate savings between two models.
 */
export function calculateSavings(
  currentModel: string,
  alternativeModel: string,
  inputTokens: number,
  outputTokens: number
): SavingsResult {
  const currentCost = calculateModelCost(currentModel, inputTokens, outputTokens)
  const alternativeCost = calculateModelCost(alternativeModel, inputTokens, outputTokens)
  const savings = currentCost - alternativeCost
  const savingsPercent = currentCost > 0 ? (savings / currentCost) * 100 : 0

  return {
    currentCost,
    alternativeCost,
    savings,
    savingsPercent
  }
}

/**
 * Get ROI comparison for a model against all alternatives in MODEL_TIERS.
 */
export function getRoiComparison(
  currentModel: string,
  inputTokens: number,
  outputTokens: number
): RoiComparison {
  const currentCost = calculateModelCost(currentModel, inputTokens, outputTokens)
  const alternatives: RoiComparison["alternatives"] = []

  for (const [tierName, config] of Object.entries(MODEL_TIERS)) {
    for (const model of config.models) {
      if (model.toLowerCase() === currentModel.toLowerCase()) continue

      const estimatedCost = calculateModelCost(model, inputTokens, outputTokens)
      const savings = currentCost - estimatedCost
      const savingsPercent = currentCost > 0 ? (savings / currentCost) * 100 : 0

      alternatives.push({
        model,
        tier: tierName,
        estimatedCost,
        savings,
        savingsPercent
      })
    }
  }

  // Sort by savings (highest first)
  alternatives.sort((a, b) => b.savings - a.savings)

  return {
    currentModel,
    currentCost,
    alternatives
  }
}
