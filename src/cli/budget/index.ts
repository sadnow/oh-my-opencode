/**
 * Budget CLI Command
 * View budget status and manage tier overrides
 */

import pc from "picocolors"
import { logger } from "../../shared/logger"
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
      logger.error("Budget tracking is not enabled")
    } else {
      logger.warn("Budget tracking is not enabled.")
      logger.info("Enable it in your oh-my-opencode.json: \"budget\": { \"enabled\": true, \"provider_budgets\": { \"anthropic\": 20 } }")
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
      logger.info("Tier unlocked")
    } else {
      logger.info("✓ Tier unlocked")
    }
    return 0
  }

  if (options.lockTier) {
    const durationMs = options.duration ? options.duration * 60 * 1000 : undefined
    overrideManager.lockTier({ durationMs, source: "cli" })
    if (options.json) {
      logger.info("Tier locked", { duration: durationMs ? `${options.duration} minutes` : "indefinitely" })
    } else {
      const durationText = durationMs ? ` for ${options.duration} minutes` : ""
      logger.info(`✓ Tier locked${durationText}`)
    }
    return 0
  }

  if (options.forceTier) {
    if (!isValidTier(options.forceTier)) {
      if (options.json) {
        logger.error("Invalid tier", { tier: options.forceTier, validTiers: VALID_TIERS })
      } else {
        logger.error(`Invalid tier: ${options.forceTier}`)
        logger.info(`Valid tiers: ${VALID_TIERS.join(", ")}`)
      }
      return 1
    }

    const durationMs = options.duration ? options.duration * 60 * 1000 : undefined
    overrideManager.forceTier(options.forceTier, { durationMs, source: "cli" })
    if (options.json) {
      logger.info(`Tier forced to ${options.forceTier}`, { duration: durationMs ? `${options.duration} minutes` : "indefinitely" })
    } else {
      const durationText = durationMs ? ` for ${options.duration} minutes` : ""
      logger.info(`✓ Tier forced to ${formatTier(options.forceTier)}${durationText}`)
    }
    return 0
  }

  if (options.resetLearning !== undefined) {
    const provider = typeof options.resetLearning === "string" ? options.resetLearning : undefined
    budgetOrchestrator.resetAdaptiveLearning(provider)
    if (options.json) {
      logger.info(provider ? `Reset learning for ${provider}` : "Reset all adaptive learning")
    } else {
      const target = provider ? `for ${provider}` : "for all providers"
      logger.info(`✓ Reset adaptive learning ${target}`)
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
        logger.error("No budget configured for provider", { provider: options.provider })
      } else {
        logger.warn(`No budget configured for provider: ${options.provider}`)
      }
      return 1
    }
  }

  // Output
  if (options.json) {
    logger.info("Budget data", { data: displayData })
  } else {
    printBudgetDisplay(displayData)
  }

  return 0
}

// ============================================================================
// Print Display
// ============================================================================

function printBudgetDisplay(data: ReturnType<typeof buildBudgetDisplayData>): void {
  logger.info("")

  // Override status (if active)
  const overrideStatus = formatOverrideStatus(data.override)
  if (overrideStatus) {
    logger.info(overrideStatus)
    logger.info("")
  }

  // Provider budgets
  if (data.providers.length === 0) {
    logger.warn("No providers configured with budgets.")
    logger.info("")
  } else {
    for (const provider of data.providers) {
      logger.info(formatProviderBudget(provider))
      logger.info("")
    }
  }

  // Global summary
  logger.info(formatGlobalSummary(data.globalTier, data.providers.length))
  logger.info("")
}

export default budget
