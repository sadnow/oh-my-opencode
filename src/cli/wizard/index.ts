/**
 * Orchestration Stack Wizard
 * Interactive CLI wizard for configuring oh-my-opencode orchestration
 */

import * as p from "@clack/prompts"
import color from "picocolors"
import {
  askSubscriptions,
  askPlanTiers,
  askZenModels,
  askPreset,
  askBudgetConfig,
  showSummary,
  type WizardAnswers,
} from "./questions"
import { generateConfig, writeConfig, backupConfig } from "./generator"
import packageJson from "../../../package.json" with { type: "json" }

const VERSION = packageJson.version

export interface WizardOptions {
  /** Skip confirmation prompts */
  yes?: boolean
  /** Output format */
  format?: "json" | "text"
}

/**
 * Run the orchestration stack wizard.
 */
export async function runWizard(options: WizardOptions = {}): Promise<number> {
  p.intro(color.bgMagenta(color.white(" Orchestration Stack Wizard ")))

  p.log.info(`oh-my-opencode v${VERSION}`)
  p.log.message(
    color.dim("Configure your AI model orchestration stack for optimal performance.")
  )

  // Check authentication status
  const authWarning = await checkAuthStatus()
  if (authWarning) {
    p.log.warn(authWarning)
  }

  // Step 1: Subscriptions
  p.log.step("Provider Subscriptions")
  const subscriptions = await askSubscriptions()
  if (!subscriptions) {
    p.cancel("Wizard cancelled.")
    return 1
  }

  // Step 2: Plan tiers
  p.log.step("Plan Configuration")
  const planTiers = await askPlanTiers(subscriptions)
  if (!planTiers) {
    p.cancel("Wizard cancelled.")
    return 1
  }

  // Step 3: Zen models (if applicable)
  if (subscriptions.hasOpencodeZen) {
    p.log.step("OpenCode Zen Models")
    const zenModels = await askZenModels(planTiers)
    if (!zenModels) {
      p.cancel("Wizard cancelled.")
      return 1
    }
    Object.assign(planTiers, zenModels)
  }

  // Step 4: Preset selection
  p.log.step("Orchestration Preset")
  const preset = await askPreset(planTiers)
  if (!preset) {
    p.cancel("Wizard cancelled.")
    return 1
  }

  // Step 5: Budget configuration
  p.log.step("Budget Configuration")
  const budget = await askBudgetConfig(preset)
  if (!budget) {
    p.cancel("Wizard cancelled.")
    return 1
  }

  const answers = budget as WizardAnswers

  // Generate configuration
  const { config, configPath, preview } = generateConfig(answers)

  // Show summary
  console.log()
  p.note(showSummary(answers), "Configuration Summary")

  // Show config preview
  if (options.format === "json") {
    console.log(preview)
    return 0
  }

  console.log()
  p.log.message(color.dim("Generated configuration:"))
  console.log(color.dim(preview.split("\n").map(l => "  " + l).join("\n")))
  console.log()

  // Confirm and write
  if (!options.yes) {
    const confirm = await p.confirm({
      message: `Write configuration to ${color.cyan(configPath)}?`,
      initialValue: true,
    })

    if (p.isCancel(confirm) || !confirm) {
      p.cancel("Wizard cancelled. No changes were made.")
      return 1
    }
  }

  // Backup existing config
  const s = p.spinner()
  s.start("Writing configuration")

  const backupPath = backupConfig(configPath)
  if (backupPath) {
    p.log.info(`Backed up existing config to ${color.dim(backupPath)}`)
  }

  // Write new config
  writeConfig(config, configPath)
  s.stop(`Configuration written to ${color.cyan(configPath)}`)

  // Success
  p.outro(color.green("Orchestration stack configured successfully!"))

  // Next steps
  console.log()
  console.log(color.bold("Next steps:"))
  console.log(`  1. Run ${color.cyan("opencode auth login")} to authenticate providers`)
  console.log(`  2. Run ${color.cyan("opencode")} to start using your configured stack`)
  console.log()

  if (answers.enableBudget) {
    console.log(color.dim("Budget tracking is enabled. Usage will be tracked in:"))
    console.log(color.dim("  ~/.config/opencode/oh-my-opencode-usage.json"))
    console.log()
  }

  return 0
}

/**
 * Check authentication status and return warning if needed.
 */
async function checkAuthStatus(): Promise<string | null> {
  // This is a placeholder - in a real implementation,
  // we would check actual auth status via opencode CLI
  return null
}

export { generateConfig, writeConfig } from "./generator"
export { getPreset, getAllPresets, MODEL_TIERS, ROLE_MODELS } from "./presets"
export type { WizardAnswers } from "./questions"
