/**
 * Quick check script to verify usage tracking is working
 * Run this AFTER having a conversation in OpenCode
 */

const WEBUI_PORT = 3847
const API_URL = `http://localhost:${WEBUI_PORT}/api/usage`

console.log("Checking usage tracking status...\n")

try {
  const response = await fetch(API_URL)
  
  if (!response.ok) {
    console.error(`❌ WebUI API error: ${response.status} ${response.statusText}`)
    console.error("Make sure WebUI is running on port", WEBUI_PORT)
    process.exit(1)
  }

  const json = await response.json()
  
  if (!json.success) {
    console.error("❌ API returned unsuccessful response:", json)
    process.exit(1)
  }

  const { summaries, totalCost } = json.data
  const providers = Object.keys(summaries)

  console.log("=" .repeat(80))
  console.log("USAGE TRACKING STATUS")
  console.log("=".repeat(80))
  
  if (providers.length === 0) {
    console.log("\n⚠️  NO USAGE DATA YET")
    console.log("\nThis could mean:")
    console.log("  1. You haven't restarted OpenCode after rebuilding the plugin")
    console.log("  2. You haven't sent any messages yet")
    console.log("  3. The hook needs 2-3 seconds after a message to record data")
    console.log("\nTo test:")
    console.log("  1. Restart OpenCode")
    console.log("  2. Send a simple message like: 'Hello, how are you?'")
    console.log("  3. Wait 3 seconds")
    console.log("  4. Run this script again: bun run scripts/check-usage-after-conversation.ts")
  } else {
    console.log("\n✅ USAGE DATA FOUND!")
    console.log(`\nTotal Cost: $${totalCost.toFixed(4)}`)
    console.log(`\nProviders (${providers.length}):`)
    
    for (const provider of providers) {
      const summary = summaries[provider]
      console.log(`\n  ${provider}:`)
      console.log(`    - Total Cost: $${summary.totalCost.toFixed(4)}`)
      console.log(`    - Input Tokens: ${summary.totalInputTokens.toLocaleString()}`)
      console.log(`    - Output Tokens: ${summary.totalOutputTokens.toLocaleString()}`)
      console.log(`    - API Calls: ${summary.callCount}`)
      console.log(`    - Period: ${new Date(summary.periodStart).toLocaleDateString()} - ${new Date(summary.nextReset).toLocaleDateString()}`)
    }
    
    console.log("\n✅ Usage tracking is working!")
    console.log("   Check the dashboard at: http://localhost:3847")
  }
  
  console.log("=".repeat(80))
  
} catch (error) {
  console.error("\n❌ Error checking usage:")
  console.error(error)
  console.error("\nMake sure:")
  console.error("  1. OpenCode is running")
  console.error("  2. WebUI is enabled in config")
  console.error("  3. Port 3847 is not blocked")
  process.exit(1)
}
