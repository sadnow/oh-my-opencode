/**
 * Notification Formatting Helpers
 *
 * Provides formatted notification content for verbose mode in auto-router.
 * All output is automatically sanitized via the sanitize module.
 *
 * @module oh-my-autocode/shared/notifications
 */

import type {
  TaskClassification,
  BudgetTier,
  TechniqueCombo,
  EscalationSignal,
} from "../features/auto-router/types"

// ============================================================================
// Types
// ============================================================================

export interface VerboseNotification {
  title: string
  lines: string[]
  variant: "info" | "success" | "warning" | "error"
  duration?: number
}

export interface PresetAdjustments {
  fromTechnique?: TechniqueCombo
  toTechnique?: TechniqueCombo
  fromBudget?: BudgetTier
  toBudget?: BudgetTier
}

// ============================================================================
// Budget Tier Display Names
// ============================================================================

const BUDGET_DISPLAY_NAMES: Record<BudgetTier, string> = {
  free: "Free",
  cheap: "Cheap",
  moderate: "Moderate",
  expensive: "Expensive",
  maximum: "Maximum",
}

const TECHNIQUE_DISPLAY_NAMES: Record<TechniqueCombo, string> = {
  direct: "Direct",
  ulw: "Ultrawork",
  ultrathink: "Ultrathink",
  ralph: "Ralph Loop",
  "ulw+ralph": "Ultrawork + Ralph",
  "ultrathink+ulw": "Ultrathink + Ultrawork",
  "ultrathink+ralph": "Ultrathink + Ralph",
  triple: "Triple (All Techniques)",
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format the initial classification toast
 */
export function formatClassificationToast(
  classification: TaskClassification,
  technique: TechniqueCombo,
  budget: BudgetTier,
  model: string,
  qualityThreshold: number
): VerboseNotification {
  const lines: string[] = []

  // Complexity line
  const complexityText = `Tier ${classification.complexityTier} (${getBudgetDescription(budget)})`
  lines.push(`Complexity: ${complexityText} | Novelty: ${classification.noveltyLevel}`)

  // Technique + Budget + Model line
  const techniqueText = TECHNIQUE_DISPLAY_NAMES[technique] || technique
  const modelShort = model.includes("/") ? model.split("/").pop() : model
  lines.push(`Technique: ${techniqueText} | Budget: ${BUDGET_DISPLAY_NAMES[budget]} → ${modelShort}`)

  // Features line
  const features: string[] = []
  if (technique.includes("ralph")) features.push("Ralph Loop enabled")
  if (technique.includes("ulw")) features.push("Parallel agents")
  if (technique.includes("ultrathink")) features.push("Deep reasoning")
  if (features.length > 0) {
    lines.push(features.join(" | ") + ` | Quality threshold: ${qualityThreshold}`)
  }

  return {
    title: "Auto-Router Active",
    lines,
    variant: "info",
    duration: 5000,
  }
}

/**
 * Format verbose classification details toast
 */
export function formatClassificationDetailsToast(
  classification: TaskClassification
): VerboseNotification {
  const lines: string[] = []

  // Project info
  const testIndicator = classification.hasTests ? "✓" : "✗"
  const buildIndicator = classification.hasBuildGates ? "✓" : "✗"
  lines.push(`Project: ${classification.projectType} | Has tests ${testIndicator} | Build gates ${buildIndicator}`)

  // Domain signals
  if (classification.domainSignals.length > 0) {
    lines.push(`Domain: ${classification.domainSignals.join(", ")}`)
  }

  // Estimated complexity
  const parallelPotential = classification.parallelizationPotential !== "none"
    ? ` | Parallel: ${classification.parallelizationPotential}`
    : ""
  lines.push(`Estimated steps: ${classification.estimatedSteps}${parallelPotential}`)

  return {
    title: "Classification Details",
    lines,
    variant: "info",
    duration: 4000,
  }
}

/**
 * Format model selection toast
 */
export function formatModelSelectionToast(
  model: string,
  tier: BudgetTier
): VerboseNotification {
  const tierLabel = BUDGET_DISPLAY_NAMES[tier] || tier

  return {
    title: "Model Selected",
    lines: [`${model} (${tierLabel} tier)`],
    variant: "info",
    duration: 3000,
  }
}

/**
 * Format budget escalation toast
 */
export function formatEscalationToast(
  fromTier: BudgetTier,
  toTier: BudgetTier,
  reason: string,
  escalationCount: number,
  maxEscalations: number,
  newModel?: string,
  qualityScore?: number,
  qualityThreshold?: number
): VerboseNotification {
  const lines: string[] = []

  // Escalation direction
  const fromLabel = BUDGET_DISPLAY_NAMES[fromTier] || fromTier
  const toLabel = BUDGET_DISPLAY_NAMES[toTier] || toTier
  lines.push(`${fromLabel} → ${toLabel} | Reason: ${reason}`)

  // Model + quality if available
  if (newModel) {
    const modelShort = newModel.includes("/") ? newModel.split("/").pop() : newModel
    let qualityLine = `Model: ${modelShort}`
    if (qualityScore !== undefined && qualityThreshold !== undefined) {
      qualityLine += ` | Quality: ${qualityScore.toFixed(2)} < ${qualityThreshold} threshold`
    }
    lines.push(qualityLine)
  }

  return {
    title: `Budget Escalated (${escalationCount}/${maxEscalations})`,
    lines,
    variant: "warning",
    duration: 5000,
  }
}

/**
 * Format preset application toast
 */
export function formatPresetToast(
  presetName: string,
  adjustments: PresetAdjustments
): VerboseNotification {
  const lines: string[] = []

  if (adjustments.fromTechnique && adjustments.toTechnique) {
    const fromLabel = TECHNIQUE_DISPLAY_NAMES[adjustments.fromTechnique] || adjustments.fromTechnique
    const toLabel = TECHNIQUE_DISPLAY_NAMES[adjustments.toTechnique] || adjustments.toTechnique
    lines.push(`Technique: ${fromLabel} → ${toLabel}`)
  }

  if (adjustments.fromBudget && adjustments.toBudget) {
    const fromLabel = BUDGET_DISPLAY_NAMES[adjustments.fromBudget] || adjustments.fromBudget
    const toLabel = BUDGET_DISPLAY_NAMES[adjustments.toBudget] || adjustments.toBudget
    lines.push(`Budget: ${fromLabel} → ${toLabel}`)
  }

  return {
    title: `Preset Applied: ${presetName}`,
    lines,
    variant: "info",
    duration: 4000,
  }
}

/**
 * Format technique adjustment toast (for magic keywords)
 */
export function formatMagicKeywordToast(
  keyword: string,
  technique: TechniqueCombo,
  budget: BudgetTier
): VerboseNotification {
  const techniqueLabel = TECHNIQUE_DISPLAY_NAMES[technique] || technique
  const budgetLabel = BUDGET_DISPLAY_NAMES[budget] || budget

  return {
    title: `Magic Keyword: ${keyword}`,
    lines: [`Technique: ${techniqueLabel} | Budget: ${budgetLabel}`],
    variant: "info",
    duration: 3000,
  }
}

/**
 * Format quality check result toast
 */
export function formatQualityCheckToast(
  passed: boolean,
  score: number,
  threshold: number,
  criticalIssues: string[]
): VerboseNotification {
  const lines: string[] = []

  lines.push(`Score: ${score.toFixed(2)} / ${threshold} threshold | ${passed ? "PASSED" : "FAILED"}`)

  if (criticalIssues.length > 0 && criticalIssues.length <= 2) {
    lines.push(`Issues: ${criticalIssues.join(", ")}`)
  } else if (criticalIssues.length > 2) {
    lines.push(`${criticalIssues.length} critical issues found`)
  }

  return {
    title: "Quality Check",
    lines,
    variant: passed ? "success" : "warning",
    duration: 4000,
  }
}

/**
 * Format iteration progress toast
 */
export function formatIterationToast(
  iteration: number,
  maxIterations: number,
  technique: TechniqueCombo,
  status: "running" | "completed" | "failed"
): VerboseNotification {
  const techniqueLabel = TECHNIQUE_DISPLAY_NAMES[technique] || technique

  const statusText = status === "running" ? "in progress"
    : status === "completed" ? "complete"
    : "failed"

  return {
    title: `Iteration ${iteration}/${maxIterations}`,
    lines: [`${techniqueLabel} ${statusText}`],
    variant: status === "failed" ? "error" : status === "completed" ? "success" : "info",
    duration: 3000,
  }
}

/**
 * Format parallel agent spawn toast
 */
export function formatParallelAgentToast(
  agentCount: number,
  agentNames: string[]
): VerboseNotification {
  return {
    title: `Parallel Agents Spawned`,
    lines: [`${agentCount} agent${agentCount > 1 ? "s" : ""}: ${agentNames.join(", ")}`],
    variant: "info",
    duration: 3000,
  }
}

/**
 * Format provider switch toast (v3.6.7)
 */
export function formatProviderSwitchToast(
  originalProvider: string,
  originalModel: string,
  newProvider: string,
  newModel: string,
  reason: "rate_limit" | "fallback" | "preference"
): VerboseNotification {
  const reasonText = reason === "rate_limit"
    ? "Rate limited"
    : reason === "fallback"
    ? "Fallback"
    : "User preference"

  return {
    title: `Provider Switch: ${reasonText}`,
    lines: [
      `From: ${originalProvider}/${originalModel}`,
      `To: ${newProvider}/${newModel}`,
    ],
    variant: reason === "rate_limit" ? "warning" : "info",
    duration: 5000,
  }
}

/**
 * Format rate limit warning toast (v3.6.7)
 */
export function formatRateLimitToast(
  provider: string,
  cooldownMinutes: number,
  fallbackProvider?: string
): VerboseNotification {
  const lines = [
    `Provider "${provider}" rate limited`,
    `Cooldown: ${cooldownMinutes} minute${cooldownMinutes > 1 ? "s" : ""}`,
  ]

  if (fallbackProvider) {
    lines.push(`Fallback: ${fallbackProvider}`)
  }

  return {
    title: "Rate Limit Detected",
    lines,
    variant: "warning",
    duration: 6000,
  }
}

/**
 * Format model usage toast - shows exactly which model is being used (v3.6.7)
 */
export function formatModelUsageToast(
  provider: string,
  model: string,
  tier: BudgetTier,
  isBlocked: boolean,
  isFallback: boolean
): VerboseNotification {
  const tierLabel = BUDGET_DISPLAY_NAMES[tier] || tier
  const lines = [`Provider: ${provider}`, `Model: ${model}`, `Tier: ${tierLabel}`]

  if (isBlocked) {
    lines.push("Status: BLOCKED - using fallback")
  } else if (isFallback) {
    lines.push("Status: Fallback provider")
  } else {
    lines.push("Status: Primary provider")
  }

  return {
    title: "Model in Use",
    lines,
    variant: isBlocked ? "warning" : "info",
    duration: 4000,
  }
}

/**
 * Format provider status toast - shows all providers and their status (v3.6.7)
 */
export function formatProviderStatusToast(
  providers: Array<{ name: string; status: "available" | "rate_limited" | "blocked"; cooldownLeft?: number }>
): VerboseNotification {
  const lines = providers.map(p => {
    if (p.status === "blocked") {
      return `${p.name}: BLOCKED`
    } else if (p.status === "rate_limited") {
      return `${p.name}: Rate limited (${p.cooldownLeft}m left)`
    } else {
      return `${p.name}: Available`
    }
  })

  return {
    title: "Provider Status",
    lines,
    variant: "info",
    duration: 5000,
  }
}

/**
 * Format model deployment toast - shows when an agent is spawned with specific model (v3.8.0)
 */
export function formatModelDeploymentToast(info: {
  agent: string
  model: string
  provider: string
  purpose: string
  budgetTier: BudgetTier
}): VerboseNotification {
  const tierLabel = BUDGET_DISPLAY_NAMES[info.budgetTier] || info.budgetTier

  return {
    title: `Agent Deployed: ${info.agent}`,
    lines: [
      `Model: ${info.model}`,
      `Provider: ${info.provider} | Tier: ${tierLabel}`,
      `Purpose: ${info.purpose}`,
    ],
    variant: "info",
    duration: 4000,
  }
}

/**
 * Format parallel agent deployment toast - shows when multiple agents are spawned (v3.8.0)
 */
export function formatParallelAgentDeploymentToast(info: {
  agents: string[]
  model: string
  purpose: string
}): VerboseNotification {
  return {
    title: `Parallel Agents: ${info.agents.length} Deployed`,
    lines: [
      `Agents: ${info.agents.join(", ")}`,
      `Model: ${info.model}`,
      `Purpose: ${info.purpose}`,
    ],
    variant: "info",
    duration: 4000,
  }
}

/**
 * Format spending milestone toast - shows when spending crosses a $1 threshold (v3.8.0)
 */
export function formatSpendingMilestoneToast(info: {
  totalSpent: number
  currentIncrement: number
  mainModel: string
  breakdown: Record<string, number>
}): VerboseNotification {
  // Get top 2 contributors
  const sorted = Object.entries(info.breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
  const breakdownText = sorted
    .map(([model, cost]) => `${model.split("/").pop()}: $${cost.toFixed(2)}`)
    .join(" | ")

  return {
    title: `Spending: $${info.totalSpent.toFixed(0)}+ (est.)`,
    lines: [
      `This milestone: +$${info.currentIncrement.toFixed(2)}`,
      `Top models: ${breakdownText}`,
      `Note: Estimated based on avg token usage`,
    ],
    variant: "warning",
    duration: 6000,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getBudgetDescription(tier: BudgetTier): string {
  switch (tier) {
    case "free":
      return "minimal"
    case "cheap":
      return "basic"
    case "moderate":
      return "standard"
    case "expensive":
      return "advanced"
    case "maximum":
      return "full"
    default:
      return tier
  }
}

/**
 * Convert notification to simple toast format (title + message)
 */
export function toSimpleToast(notification: VerboseNotification): { title: string; message: string } {
  return {
    title: notification.title,
    message: notification.lines.join(" | "),
  }
}

/**
 * Convert notification lines to multi-line string
 */
export function toMultilineString(notification: VerboseNotification): string {
  return `${notification.title}\n${notification.lines.join("\n")}`
}
