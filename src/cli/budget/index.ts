/**
 * Budget CLI Command
 * View budget status and manage tier overrides
 */

import pc from "picocolors"
import type { BudgetCommandOptions } from "./types"
import type { ModelTier } from "../../config/schema"
import { loadPluginConfig } from "../../plugin-config"
import { UsageTracker } from "../../features/usage-tracker"
import { BudgetOrchestrator, getOverrideManager } from "../../features/budget-orchestrator"
import { buildBudgetDisplayData, filterByProvider } from "./display"
import {
  formatProviderBudget,
  formatOverrideStatus,
  formatGlobalSummary,
  formatTier,
} from "./formatter"

// ============================================================================
// Validate Tier Input
// ============================================================================

const VALID_TIERS: ModelTier[] = ["premium", "standard", "budget", "economy"]

function isValidTier(tier: string): tier is ModelTier {
  return VALID_TIERS.includes(tier as ModelTier)
}

// ============================================================================
// Main Command Handler
// ============================================================================

export async function budget(options: BudgetCommandOptions): Promise<number> {
  const directory = process.cwd()

  // Load config and initialize services (null ctx for CLI context)
  const pluginConfig = loadPluginConfig(directory, null)

  // Check if budget is enabled
  if (!pluginConfig.budget?.enabled) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: "Budget tracking is not enabled" }))
    } else {
      console.log(pc.yellow("Budget tracking is not enabled."))
      console.log(pc.dim("Enable it in your oh-im-broke.json:"))
      console.log(pc.dim('  "budget": { "enabled": true, "provider_budgets": { "anthropic": 20 } }'))
    }
    return 1
  }

  // Initialize usage tracker
  const usageTracker = new UsageTracker({
    enabled: pluginConfig.usage_tracking?.enabled ?? true,
    persist: pluginConfig.usage_tracking?.persist ?? true,
  })

  // Initialize budget orchestrator
  const budgetOrchestrator = new BudgetOrchestrator(
    pluginConfig.budget,
    usageTracker,
    ["anthropic", "openai", "google", "opencode"],
    undefined // CLI doesn't need subscription trackers
  )

  const overrideManager = getOverrideManager()

  // Handle override commands
  if (options.unlockTier) {
    overrideManager.unlockTier()
    if (options.json) {
      console.log(JSON.stringify({ success: true, message: "Tier unlocked" }))
    } else {
      console.log(pc.green("✓ Tier unlocked"))
    }
    return 0
  }

  if (options.lockTier) {
    const durationMs = options.duration ? options.duration * 60 * 1000 : undefined
    overrideManager.lockTier({ durationMs, source: "cli" })
    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        message: "Tier locked",
        duration: durationMs ? `${options.duration} minutes` : "indefinitely",
      }))
    } else {
      const durationText = durationMs ? ` for ${options.duration} minutes` : ""
      console.log(pc.green(`✓ Tier locked${durationText}`))
    }
    return 0
  }

  if (options.forceTier) {
    if (!isValidTier(options.forceTier)) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: `Invalid tier: ${options.forceTier}. Valid tiers: ${VALID_TIERS.join(", ")}`,
        }))
      } else {
        console.log(pc.red(`Invalid tier: ${options.forceTier}`))
        console.log(pc.dim(`Valid tiers: ${VALID_TIERS.join(", ")}`))
      }
      return 1
    }

    const durationMs = options.duration ? options.duration * 60 * 1000 : undefined
    overrideManager.forceTier(options.forceTier, { durationMs, source: "cli" })
    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        message: `Tier forced to ${options.forceTier}`,
        duration: durationMs ? `${options.duration} minutes` : "indefinitely",
      }))
    } else {
      const durationText = durationMs ? ` for ${options.duration} minutes` : ""
      console.log(pc.green(`✓ Tier forced to ${formatTier(options.forceTier)}${durationText}`))
    }
    return 0
  }

  if (options.resetLearning !== undefined) {
    const provider = typeof options.resetLearning === "string" ? options.resetLearning : undefined
    budgetOrchestrator.resetAdaptiveLearning(provider)
    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        message: provider ? `Reset learning for ${provider}` : "Reset all adaptive learning",
      }))
    } else {
      const target = provider ? `for ${provider}` : "for all providers"
      console.log(pc.green(`✓ Reset adaptive learning ${target}`))
    }
    return 0
  }

  // Build display data
  let displayData = buildBudgetDisplayData(budgetOrchestrator)

  // Filter by provider if specified
  if (options.provider) {
    displayData = filterByProvider(displayData, options.provider)
    if (displayData.providers.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: `No budget configured for provider: ${options.provider}`,
        }))
      } else {
        console.log(pc.yellow(`No budget configured for provider: ${options.provider}`))
      }
      return 1
    }
  }

  // Output
  if (options.json) {
    console.log(JSON.stringify({
      success: true,
      data: displayData,
    }, null, 2))
  } else {
    printBudgetDisplay(displayData)
  }

  return 0
}

// ============================================================================
// Print Display
// ============================================================================

function printBudgetDisplay(data: ReturnType<typeof buildBudgetDisplayData>): void {
  console.log()

  // Override status (if active)
  const overrideStatus = formatOverrideStatus(data.override)
  if (overrideStatus) {
    console.log(overrideStatus)
    console.log()
  }

  // Provider budgets
  if (data.providers.length === 0) {
    console.log(pc.yellow("No providers configured with budgets."))
    console.log()
  } else {
    for (const provider of data.providers) {
      console.log(formatProviderBudget(provider))
      console.log()
    }
  }

  // Global summary
  console.log(formatGlobalSummary(data.globalTier, data.providers.length))
  console.log()
}

export default budget
