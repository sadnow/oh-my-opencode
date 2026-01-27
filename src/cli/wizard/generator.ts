/**
 * Config Generator
 * Generates oh-my-opencode configuration from wizard answers
 */

import * as fs from "fs"
import * as path from "path"
import type { OhMyOpenCodeConfig, BudgetConfig, AdaptiveConfig, LearningMode, QuotaTargets } from "../../config/schema"
import { getOpenCodeConfigDir } from "../../shared"
import type { WizardAnswers } from "./questions"
import { getPreset, findBestModelForRole } from "./presets"

export interface GeneratedConfig {
  config: OhMyOpenCodeConfig
  configPath: string
  preview: string
}

/**
 * Generate configuration from wizard answers.
 */
export function generateConfig(answers: WizardAnswers): GeneratedConfig {
  const config: OhMyOpenCodeConfig = {}

  // Get available providers
  const availableProviders: string[] = []
  if (answers.hasAnthropicOAuth) availableProviders.push("anthropic")
  if (answers.hasChatGPT) availableProviders.push("openai")
  if (answers.hasGemini) availableProviders.push("google")
  if (answers.hasCopilot) availableProviders.push("github-copilot")
  if (answers.hasOpencodeZen) availableProviders.push("opencode")

  // Apply preset or custom configuration
  if (answers.preset !== "custom") {
    const preset = getPreset(answers.preset)
    if (preset) {
      config.categories = { ...preset.categories }
    }
  } else {
    // Custom configuration - auto-assign best models
    config.categories = generateCustomCategories(availableProviders)
  }

  // Configure agent overrides based on subscriptions
  config.agents = generateAgentOverrides(answers, availableProviders)

  // Budget configuration
  if (answers.enableBudget) {
    config.budget = generateBudgetConfig(answers)
  }

  // Usage tracking (enabled by default)
  config.usage_tracking = {
    enabled: true,
    persist: true,
  }

  // Set orchestration preset
  config.orchestration_preset = answers.preset

  const configPath = getConfigPath()
  const preview = generatePreview(config)

  return { config, configPath, preview }
}

/**
 * Generate custom categories based on available providers.
 */
function generateCustomCategories(
  availableProviders: string[]
): OhMyOpenCodeConfig["categories"] {
  return {
    ultrabrain: {
      description: "Deep reasoning and complex analysis",
      model: findBestModelForRole("ultrabrain", availableProviders) ?? "opencode/big-pickle",
    },
    quick: {
      description: "Fast responses for simple queries",
      model: findBestModelForRole("quick", availableProviders) ?? "opencode/big-pickle",
    },
    "visual-engineering": {
      description: "Frontend and UI implementation",
      model: findBestModelForRole("implement", availableProviders) ?? "opencode/big-pickle",
    },
    artistry: {
      description: "Creative and design tasks",
      model: findBestModelForRole("implement", availableProviders) ?? "opencode/big-pickle",
    },
    writing: {
      description: "Documentation and content creation",
      model: findBestModelForRole("review", availableProviders) ?? "opencode/big-pickle",
    },
  }
}

/**
 * Copilot Pro+ agent models - premium models included in subscription (effectively FREE).
 * These should be prioritized for budget-conscious users who have Copilot.
 * 
 * Model multipliers (per GitHub Copilot docs):
 * - 0x: gpt-5-mini, gpt-4.1, raptor-mini (FREE!)
 * - 0.25x: grok-code-fast-1
 * - 0.33x: claude-haiku-4.5, gemini-3-flash, gpt-5.1-codex-mini
 * - 1x: claude-sonnet-4.5, gpt-5.2-codex, gpt-5.1-codex
 * - 3x: claude-opus-4.5
 */
const COPILOT_AGENT_MODELS = {
  orchestrator: "github-copilot/claude-sonnet-4.5",  // 1x multiplier, good reasoning
  oracle: "github-copilot/gpt-5.2-codex",            // 1x multiplier, best reasoning
  explore: "github-copilot/gpt-5-mini",              // 0x FREE! Fast for exploration
  librarian: "github-copilot/gpt-5-mini",            // 0x FREE! Fast for docs search
} as const

/**
 * Budget-tier agent models - optimized for cost-to-value ratio.
 * Used when Copilot is not available.
 *
 * Pricing reference:
 * - kimi-k2-thinking: $0.60/$2.50 - excellent reasoning
 * - glm-4.7: $0.60/$2.20 - strong coding/agentic
 * - gemini-2.5-flash: $0.50/$3.00 - blazing fast
 * - gpt-5-nano: $0.05/$0.40 - ultra cheap for simple tasks
 */
const BUDGET_AGENT_MODELS = {
  orchestrator: "opencode/glm-4.7",        // Needs reasoning + orchestration
  oracle: "opencode/kimi-k2-thinking",     // Needs deep reasoning (thinking model)
  explore: "google/gemini-2.5-flash",      // Needs SPEED, not deep reasoning
  librarian: "google/gemini-2.5-flash",    // Needs speed + tool use
} as const

/**
 * Free-tier agent models - OpenCode only, no API keys required.
 */
const FREE_AGENT_MODELS = {
  orchestrator: "opencode/glm-4.7",
  oracle: "opencode/kimi-k2-thinking",
  explore: "opencode/glm-4.6",
  librarian: "opencode/glm-4.6",
} as const

/**
 * Generate agent overrides based on subscriptions and preset.
 *
 * Model selection priority for budget-conscious:
 * 1. Copilot Pro+ models (if available) - premium models, included in subscription
 * 2. Budget-tier models (GLM, Kimi, Gemini Flash) - good cost-to-value
 * 3. OpenCode models - always available fallback
 */
function generateAgentOverrides(
  answers: WizardAnswers,
  availableProviders: string[]
): OhMyOpenCodeConfig["agents"] {
  const agents: OhMyOpenCodeConfig["agents"] = {}
  const preset = answers.preset
  const hasCopilot = answers.hasCopilot && answers.copilotPlan !== "free"

  // Determine model selection strategy based on preset
  const isBudgetConscious = preset === "budget-conscious"
  const isFreeTier = preset === "free-tier"

  // For budget-conscious users with Copilot Pro+, use Copilot models (included in subscription)
  const useCopilotForBudget = isBudgetConscious && hasCopilot

  // Sisyphus (orchestrator) - needs orchestration + reasoning capability
  const orchestratorModel = isFreeTier
    ? FREE_AGENT_MODELS.orchestrator
    : useCopilotForBudget
      ? COPILOT_AGENT_MODELS.orchestrator
      : isBudgetConscious
        ? BUDGET_AGENT_MODELS.orchestrator
        : findBestModelForRole("orchestrator", availableProviders)
  if (orchestratorModel) {
    agents.sisyphus = { model: orchestratorModel }
  }

  // Oracle - needs highest reasoning capability (thinking models excel here)
  const oracleModel = isFreeTier
    ? FREE_AGENT_MODELS.oracle
    : useCopilotForBudget
      ? COPILOT_AGENT_MODELS.oracle
      : isBudgetConscious
        ? BUDGET_AGENT_MODELS.oracle
        : findBestModelForRole("oracle", availableProviders)
  if (oracleModel) {
    agents.oracle = { model: oracleModel }
  }

  // Explore - needs SPEED, not deep reasoning (fast models are better)
  const exploreModel = isFreeTier
    ? FREE_AGENT_MODELS.explore
    : useCopilotForBudget
      ? COPILOT_AGENT_MODELS.explore
      : isBudgetConscious
        ? BUDGET_AGENT_MODELS.explore
        : findBestModelForRole("explore", availableProviders)
  if (exploreModel) {
    agents.explore = { model: exploreModel }
  }

  // Librarian - needs speed + tool use for docs/GitHub search
  const librarianModel = isFreeTier
    ? FREE_AGENT_MODELS.librarian
    : useCopilotForBudget
      ? COPILOT_AGENT_MODELS.librarian
      : isBudgetConscious
        ? BUDGET_AGENT_MODELS.librarian
        : findBestModelForRole("librarian", availableProviders)
  if (librarianModel) {
    agents.librarian = { model: librarianModel }
  }

  return agents
}

/**
 * Learning mode presets for adaptive configuration.
 * These map learning modes to specific adaptive config values.
 */
export const LEARNING_MODE_PRESETS: Record<LearningMode, AdaptiveConfig> = {
  conservative: {
    velocity_alpha: 0.1,
    min_samples_for_prediction: 20,
    stability_checks_before_upgrade: 5,
    tier_upgrade_threshold: 2.0,
    tier_downgrade_threshold: 0.3,
  },
  balanced: {
    velocity_alpha: 0.2,
    min_samples_for_prediction: 10,
    stability_checks_before_upgrade: 3,
    tier_upgrade_threshold: 1.5,
    tier_downgrade_threshold: 0.5,
  },
  aggressive: {
    velocity_alpha: 0.4,
    min_samples_for_prediction: 5,
    stability_checks_before_upgrade: 1,
    tier_upgrade_threshold: 1.2,
    tier_downgrade_threshold: 0.7,
  },
}

/**
 * Generate adaptive configuration from wizard answers.
 * Combines learning mode preset with any custom overrides.
 */
export function generateAdaptiveConfig(answers: WizardAnswers): AdaptiveConfig | undefined {
  // Start with learning mode preset if specified
  const learningMode = answers.learningMode ?? "balanced"
  const baseConfig = { ...LEARNING_MODE_PRESETS[learningMode] }

  // Apply custom overrides if any
  if (answers.velocityAlpha !== undefined) {
    baseConfig.velocity_alpha = answers.velocityAlpha
  }
  if (answers.minSamplesForPrediction !== undefined) {
    baseConfig.min_samples_for_prediction = answers.minSamplesForPrediction
  }
  if (answers.stabilityChecksBeforeUpgrade !== undefined) {
    baseConfig.stability_checks_before_upgrade = answers.stabilityChecksBeforeUpgrade
  }
  if (answers.tierUpgradeThreshold !== undefined) {
    baseConfig.tier_upgrade_threshold = answers.tierUpgradeThreshold
  }
  if (answers.tierDowngradeThreshold !== undefined) {
    baseConfig.tier_downgrade_threshold = answers.tierDowngradeThreshold
  }

  return baseConfig
}

/**
 * Generate quota targets from wizard answers.
 */
export function generateQuotaTargets(answers: WizardAnswers): QuotaTargets | undefined {
  const targets: QuotaTargets = {}
  let hasTargets = false

  if (answers.claudeMaxWeeklyTarget !== undefined) {
    targets.claude_max_weekly_percent = answers.claudeMaxWeeklyTarget
    hasTargets = true
  }
  if (answers.copilotMonthlyTarget !== undefined) {
    targets.copilot_monthly_percent = answers.copilotMonthlyTarget
    hasTargets = true
  }
  if (answers.zenMonthlyTarget !== undefined) {
    targets.zen_monthly_dollars = answers.zenMonthlyTarget
    hasTargets = true
  }

  return hasTargets ? targets : undefined
}

/**
 * Generate budget configuration.
 */
function generateBudgetConfig(answers: WizardAnswers): BudgetConfig {
  const budget: BudgetConfig = {
    enabled: true,
    target_percentage: 0.7, // Use 70% of budget
    auto_downgrade: answers.autoDowngrade ?? true,
    auto_upgrade: answers.autoUpgrade ?? true,
    min_tier: "budget",
  }

  // Learning mode
  if (answers.learningMode) {
    budget.learning_mode = answers.learningMode
  }

  // Adaptive config (combines learning mode with custom overrides)
  const adaptiveConfig = generateAdaptiveConfig(answers)
  if (adaptiveConfig) {
    budget.adaptive_config = adaptiveConfig
  }

  // Quota targets
  const quotaTargets = generateQuotaTargets(answers)
  if (quotaTargets) {
    budget.quota_targets = quotaTargets
  }

  // Calculate provider-specific budgets
  const providerBudgets: Record<string, number> = {}

  // For OAuth providers, estimate based on plan
  if (answers.hasAnthropicOAuth) {
    // Claude Pro = ~$20/mo worth, Max 5x = ~$100/mo, Max 20x = ~$200/mo worth
    providerBudgets.anthropic = answers.claudePlan === "max-20x" ? 200 :
                                 answers.claudePlan === "max-5x" ? 100 : 20
  }
  if (answers.hasCopilot) {
    // Copilot Free = $0, Pro = $10/mo, Enterprise = $39/mo
    providerBudgets["github-copilot"] = answers.copilotPlan === "enterprise" ? 39 :
                                         answers.copilotPlan === "pro" ? 10 : 0
  }

  // Zen budget
  if (answers.hasOpencodeZen && answers.zenBudget) {
    providerBudgets.opencode = answers.zenBudget
  }

  // Monthly budget override
  if (answers.monthlyBudget) {
    budget.daily_target = answers.monthlyBudget / 30
  }

  if (Object.keys(providerBudgets).length > 0) {
    budget.provider_budgets = providerBudgets
  }

  return budget
}

/**
 * Get the config file path.
 */
function getConfigPath(): string {
  const configDir = getOpenCodeConfigDir({ binary: "opencode" })
  return path.join(configDir, "oh-my-opencode.json")
}

/**
 * Generate a preview of the configuration.
 */
function generatePreview(config: OhMyOpenCodeConfig): string {
  return JSON.stringify(config, null, 2)
}

/**
 * Write the configuration to disk.
 */
export function writeConfig(config: OhMyOpenCodeConfig, configPath: string): void {
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Preserve existing config and merge
  let existingConfig: OhMyOpenCodeConfig = {}
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8")
      existingConfig = JSON.parse(content)
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  const mergedConfig = {
    ...existingConfig,
    ...config,
    // Deep merge specific fields
    categories: {
      ...existingConfig.categories,
      ...config.categories,
    },
    agents: {
      ...existingConfig.agents,
      ...config.agents,
    },
  }

  fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2), "utf-8")
}

/**
 * Backup existing configuration.
 */
export function backupConfig(configPath: string): string | null {
  if (!fs.existsSync(configPath)) {
    return null
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = configPath.replace(".json", `.backup-${timestamp}.json`)

  fs.copyFileSync(configPath, backupPath)
  return backupPath
}
