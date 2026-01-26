/**
 * Start WebUI Server (for testing)
 */

import { startWebUI } from "./src/webui"
import { initHotConfigManager } from "./src/features/hot-config"
import { UsageTracker } from "./src/features/usage-tracker"
import { BudgetOrchestrator } from "./src/features/budget-orchestrator"
import { getClaudeMaxUsageTracker } from "./src/features/claude-max-usage"
import { loadPluginConfig } from "./src/plugin-config"

console.log("Starting WebUI Server...")

// Load config
const pluginConfig = loadPluginConfig(process.cwd(), null)

// Initialize components
const usageTracker = new UsageTracker({
  enabled: pluginConfig.usage_tracking?.enabled ?? true,
  persist: pluginConfig.usage_tracking?.persist ?? true,
})

const budgetOrchestrator = pluginConfig.budget?.enabled
  ? new BudgetOrchestrator(
      pluginConfig.budget,
      usageTracker,
      ["anthropic", "openai", "google", "opencode"]
    )
  : null

const hotConfigManager = initHotConfigManager({
  directory: process.cwd(),
  initialConfig: pluginConfig,
  watchFiles: true,
})

// Initialize Claude Max tracker
const claudeMaxTracker = getClaudeMaxUsageTracker()

// Start server
const port = pluginConfig.webui?.port ?? 3847
const bind = pluginConfig.webui?.bind ?? "localhost"

const server = startWebUI({
  port,
  bind,
  configManager: hotConfigManager,
  usageTracker,
  budgetOrchestrator,
  claudeMaxTracker,
})

console.log(`WebUI running at http://${bind}:${port}`)
console.log(`Budget Dashboard: http://${bind}:${port}/budget-dashboard`)
console.log("\nPress Ctrl+C to stop\n")

// Keep running
process.on("SIGINT", () => {
  console.log("\nShutting down...")
  server.stop()
  hotConfigManager.shutdown()
  process.exit(0)
})
