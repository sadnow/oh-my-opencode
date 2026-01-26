/**
 * Config Generator
 * Generates oh-my-opencode configuration from wizard answers
 */

import * as fs from "fs"
import * as path from "path"
import type { OhMyOpenCodeConfig, BudgetConfig } from "../../config/schema"
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
  if (answers.enableBudget && answers.monthlyBudget) {
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
 * Generate agent overrides based on subscriptions.
 */
function generateAgentOverrides(
  answers: WizardAnswers,
  availableProviders: string[]
): OhMyOpenCodeConfig["agents"] {
  const agents: OhMyOpenCodeConfig["agents"] = {}

  // Sisyphus (orchestrator) - needs best orchestration model
  const orchestratorModel = findBestModelForRole("orchestrator", availableProviders)
  if (orchestratorModel) {
    agents.sisyphus = { model: orchestratorModel }
  }

  // Oracle - needs best debugging/reasoning model
  const debugModel = findBestModelForRole("debug", availableProviders)
  if (debugModel) {
    agents.oracle = { model: debugModel }
  }

  // Explore - needs fast search model
  const exploreModel = findBestModelForRole("explore", availableProviders)
  if (exploreModel) {
    agents.explore = { model: exploreModel }
  }

  // Librarian - use review model
  const reviewModel = findBestModelForRole("review", availableProviders)
  if (reviewModel) {
    agents.librarian = { model: reviewModel }
  }

  return agents
}

/**
 * Generate budget configuration.
 */
function generateBudgetConfig(answers: WizardAnswers): BudgetConfig {
  const budget: BudgetConfig = {
    enabled: true,
    target_percentage: 0.7, // Use 70% of budget
    auto_downgrade: answers.autoDowngrade ?? true,
    min_tier: "budget",
  }

  // Calculate provider-specific budgets
  if (answers.monthlyBudget) {
    const providerBudgets: Record<string, number> = {}
    const providers: string[] = []

    if (answers.hasAnthropicOAuth) providers.push("anthropic")
    if (answers.hasChatGPT) providers.push("openai")
    if (answers.hasGemini) providers.push("google")
    if (answers.hasCopilot) providers.push("github-copilot")

    // For OAuth providers, estimate based on plan
    if (answers.hasAnthropicOAuth) {
      // Claude Pro = ~$20/mo worth, Max = ~$200/mo worth
      providerBudgets.anthropic = answers.claudePlan === "max" ? 200 : 20
    }
    if (answers.hasCopilot) {
      providerBudgets["github-copilot"] = answers.copilotPlan === "enterprise" ? 100 : 45
    }

    // Zen budget
    if (answers.hasOpencodeZen && answers.zenBudget) {
      providerBudgets.opencode = answers.zenBudget
    }

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
