#!/usr/bin/env bun

/**
 * Comprehensive usage tracking diagnostic
 * 
 * This script helps diagnose why usage tracking might not be working correctly.
 */

console.log("=" .repeat(80))
console.log("USAGE TRACKING DIAGNOSTIC")
console.log("=".repeat(80))

// Check 1: Plugin loaded and rebuilt
console.log("\n📦 1. Checking plugin build...")
const distExists = await Bun.file("dist/index.js").exists()
if (distExists) {
  const distStat = await Bun.file("dist/index.js").stat()
  const ageMinutes = Math.floor((Date.now() - distStat.mtime.getTime()) / 1000 / 60)
  console.log(`   ✅ Plugin built ${ageMinutes} minutes ago`)
  if (ageMinutes > 10) {
    console.log(`   ⚠️  Build is ${ageMinutes} minutes old - consider rebuilding: bun run build`)
  }
} else {
  console.log("   ❌ Plugin not built - run: bun run build")
  process.exit(1)
}

// Check 2: Usage tracking enabled
console.log("\n⚙️  2. Checking configuration...")
const configPath = `${process.env.HOME || process.env.USERPROFILE}/.config/opencode/oh-my-opencode.json`
try {
  const config = await Bun.file(configPath).json()
  const disabled = config.disabled_hooks || []
  if (disabled.includes("usage-tracking")) {
    console.log("   ❌ usage-tracking hook is DISABLED")
    console.log("      Remove 'usage-tracking' from disabled_hooks in:", configPath)
    process.exit(1)
  } else {
    console.log("   ✅ usage-tracking hook is enabled")
  }
} catch (e) {
  console.log("   ⚠️  No config file found (using defaults)")
}

// Check 3: WebUI running
console.log("\n🌐 3. Checking WebUI...")
try {
  const response = await fetch("http://localhost:3847/api/usage")
  if (response.ok) {
    console.log("   ✅ WebUI is running on port 3847")
  } else {
    console.log(`   ⚠️  WebUI responded with status: ${response.status}`)
  }
} catch (e) {
  console.log("   ❌ WebUI is not running")
  console.log("      Make sure webui.enabled = true in config")
  process.exit(1)
}

// Check 4: Usage data exists
console.log("\n📊 4. Checking usage data...")
const usageFilePath = `${process.env.HOME || process.env.USERPROFILE}/.config/opencode/oh-my-opencode-usage.json`
try {
  const usageData = await Bun.file(usageFilePath).json()
  const recordCount = usageData.records.length
  
  console.log(`   ✅ Found ${recordCount} usage record(s)`)
  
  if (recordCount > 0) {
    const latest = usageData.records[recordCount - 1]
    const ageMinutes = Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / 1000 / 60)
    
    console.log(`\n   Latest record (${ageMinutes} minutes ago):`)
    console.log(`   - Provider: ${latest.provider}`)
    console.log(`   - Model: ${latest.model}`)
    console.log(`   - Input tokens: ${latest.inputTokens}`)
    console.log(`   - Output tokens: ${latest.outputTokens}`)
    console.log(`   - Cost: $${latest.estimatedCost.toFixed(6)}`)
    
    if (latest.outputTokens === 0) {
      console.log(`\n   ⚠️  OUTPUT TOKENS ARE ZERO!`)
      console.log(`      This means the assistant response wasn't captured.`)
      console.log(`      Possible causes:`)
      console.log(`      - Assistant was still responding when hook polled`)
      console.log(`      - Assistant message has no text (only tool calls)`)
      console.log(`      - Hook timing issue`)
    }
    
    if (latest.provider === "unknown") {
      console.log(`\n   ⚠️  PROVIDER IS 'unknown'!`)
      console.log(`      Model info not available in message structure.`)
      console.log(`      Agent name '${latest.model}' doesn't map to a provider.`)
    }
  }
} catch (e) {
  console.log("   ❌ No usage data file found")
  console.log("      This means no conversations have been tracked yet")
}

// Check 5: Test instructions
console.log("\n" + "=".repeat(80))
console.log("NEXT STEPS:")
console.log("=".repeat(80))

console.log(`
1. RESTART OPENCODE
   - Close OpenCode completely
   - Start it again to load the updated plugin
   - Look for log: "[usage-tracking] Hook registered"

2. SEND A TEST MESSAGE
   - Open a conversation
   - Send: "Hello, please respond with a short test message"
   - Wait for the full response to complete

3. WAIT 6 SECONDS
   - The hook polls 5 seconds after your message
   - Give it time to fetch and process the assistant response

4. RUN THIS DIAGNOSTIC AGAIN
   - bun run scripts/diagnostic.ts
   - Check if output tokens are recorded
   - Check if provider is identified

5. CHECK LOGS (if available)
   - Look for "[usage-tracking]" in OpenCode output
   - Debug logs will show message polling details

If issues persist after following these steps, the hook may need
a different approach (e.g., using tool.execute.after instead of
polling session messages).
`)

console.log("=".repeat(80))
