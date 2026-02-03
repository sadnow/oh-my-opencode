#!/usr/bin/env bun

/**
 * Check current BYOK usage from HybridProviderTracker
 */

import { getHybridProviderTracker, initHybridProviderTracker } from "../src/features/budget-orchestrator/hybrid-tracker"

try {
  // Try to get existing tracker
  const tracker = getHybridProviderTracker()
  
  console.log("📊 Current BYOK Usage Status\n")
  console.log("=" .repeat(60))
  
  const allUsage = tracker.getAllUsage()
  
  if (Object.keys(allUsage).length === 0) {
    console.log("⚠️  No providers configured in hybrid tracker")
    console.log("\nTo enable tracking, add to your config:")
    console.log(`{
  "budget": {
    "hybrid_providers": {
      "openai": {
        "daily_free_tokens": 150000,
        "reset_time": "00:00 UTC",
        "enabled": true
      }
    }
  }
}`)
  } else {
    for (const [provider, usage] of Object.entries(allUsage)) {
      console.log(`\n${provider.toUpperCase()}:`)
      console.log(`  Tokens Used: ${usage.tokensUsedToday} / ${usage.dailyFreeTokens}`)
      console.log(`  Percentage: ${usage.percentUsed.toFixed(1)}%`)
      console.log(`  Status: ${usage.isExhausted ? '🔴 EXHAUSTED' : '🟢 Available'}`)
      console.log(`  Enabled: ${usage.enabled ? 'Yes' : 'No'}`)
    }
    
    const exhausted = tracker.getExhaustedProviders()
    if (exhausted.length > 0) {
      console.log(`\n🔴 Exhausted Providers: ${exhausted.join(', ')}`)
    } else {
      console.log(`\n🟢 All providers available`)
    }
  }
  
  console.log("\n" + "=".repeat(60))
  
} catch (error) {
  console.log("⚠️  Hybrid tracker not initialized")
  console.log("   This is normal if you haven't configured hybrid_providers yet")
}
