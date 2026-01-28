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

// Initialize Claude Max tracker
const claudeMaxTracker = getClaudeMaxUsageTracker()

// Initialize Copilot tracker
const copilotTracker = getCopilotUsageTracker()
copilotTracker.startLiveRefresh()

const budgetOrchestrator = pluginConfig.budget?.enabled
  ? new BudgetOrchestrator(
      pluginConfig.budget,
      usageTracker,
      ["anthropic", "openai", "google", "opencode"],
      {
        claudeMaxTracker,
        copilotTracker,
      }
    )
  : null

const hotConfigManager = initHotConfigManager({
  directory: projectRoot,
  initialConfig: pluginConfig,
  watchFiles: true,
})

// Start server
const port = process.env.WEBUI_PORT ? parseInt(process.env.WEBUI_PORT) : (pluginConfig.webui?.port ?? 3847)
const bind = pluginConfig.webui?.bind ?? "localhost"

let server
try {
  server = startWebUI({
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
} catch (error: any) {
  if (error?.code === "EADDRINUSE") {
    console.error(`\nERROR: Port ${port} is already in use.`)
    console.error(`\nTo fix this, either:`)
    console.error(`  1. Stop the existing server on port ${port}`)
    console.error(`  2. Use a different port: python run.py --port <PORT>`)
    console.error(`\nTo find the process using port ${port}:`)
    console.error(`  Windows: netstat -ano | findstr :${port}`)
    console.error(`  Then kill it: taskkill /PID <PID> /F\n`)
    process.exit(1)
  }
  throw error
}

// Keep running
process.on("SIGINT", () => {
  console.log("\nShutting down...")
  if (server) {
    server.stop()
  }
  hotConfigManager.shutdown()
  process.exit(0)
})
