/**
 * Start WebUI Server
 * Fork-specific WebUI launcher with usage monitoring
 */

import { dirname, join } from "path"
import { startWebUI } from "../src/webui"
import { initHotConfigManager } from "../src/features/hot-config"
import { UsageTracker } from "../src/features/usage-tracker"
import { BudgetOrchestrator } from "../src/features/budget-orchestrator"
import { getClaudeMaxUsageTracker } from "../src/features/claude-max-usage"
import { getCopilotUsageTracker } from "../src/features/copilot-usage"
import { loadPluginConfig } from "../src/plugin-config"

// Get project root (parent of fork/)
const projectRoot = dirname(__dirname)

console.log("Starting WebUI Server...")
console.log(`Project root: ${projectRoot}`)

// Load config from project root
const pluginConfig = loadPluginConfig(projectRoot, null)

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
  directory: projectRoot,
  initialConfig: pluginConfig,
  watchFiles: true,
})

// Initialize Claude Max tracker
const claudeMaxTracker = getClaudeMaxUsageTracker()

// Initialize Copilot tracker with live refresh
const copilotTracker = getCopilotUsageTracker()
copilotTracker.startLiveRefresh() // Refresh usage from API every 60 seconds

// Start server
const port = process.env.WEBUI_PORT ? parseInt(process.env.WEBUI_PORT) : (pluginConfig.webui?.port ?? 3847)
const bind = pluginConfig.webui?.bind ?? "localhost"

const server = startWebUI({
  port,
  bind,
  configManager: hotConfigManager,
  usageTracker,
  budgetOrchestrator,
  claudeMaxTracker,
  copilotTracker,
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
