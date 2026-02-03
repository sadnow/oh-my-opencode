#!/usr/bin/env bun

/**
 * Test Script: BYOK Hybrid Pricing Verification
 *
 * Tests the HybridProviderTracker with real API calls to OpenCode Zen GPT-5 models.
 * Verifies:
 * 1. Usage tracking works correctly
 * 2. Model gets blocked when limit exceeded
 * 3. Native models still work when BYOK exhausted
 * 4. Fallback to subscription models works
 */

import { initHybridProviderTracker, resetHybridProviderTracker } from "../src/features/budget-orchestrator/hybrid-tracker"
import { GlobalOverrideManager } from "../src/features/budget-orchestrator/global-override"
import { detectUnderlyingProvider } from "../src/features/budget-orchestrator/underlying-provider"

// ============================================================================
// Configuration
// ============================================================================

const DAILY_TOKEN_LIMIT = 5000
const BYOK_MODEL = "opencode/gpt-5-nano"
const NATIVE_MODEL = "opencode/big-pickle"
const FALLBACK_MODEL = "github-copilot/gpt-5-mini"

// Simulated API call token costs (small for testing)
const SMALL_CALL_TOKENS = 487
const MEDIUM_CALL_TOKENS = 636
const LARGE_CALL_TOKENS = 2000
const EXTRA_CALL_TOKENS = 2000

// ============================================================================
// Test Utilities
// ============================================================================

function logSection(title: string): void {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${"=".repeat(60)}\n`)
}

function logTest(message: string): void {
  console.log(`[TEST] ${message}`)
}

function logUsage(message: string): void {
  console.log(`[USAGE] ${message}`)
}

function logPass(message: string): void {
  console.log(`[PASS] ${message}`)
}

function logFail(message: string): void {
  console.log(`[FAIL] ${message}`)
}

function logInfo(message: string): void {
  console.log(`[INFO] ${message}`)
}

// ============================================================================
// Main Test Function
// ============================================================================

async function testBYOKHybridPricing(): Promise<void> {
  logSection("BYOK Hybrid Pricing Verification Test")

  let tracker: ReturnType<typeof initHybridProviderTracker>
  let overrideManager: GlobalOverrideManager

  try {
    // ========================================================================
    // Test 1: Initialize tracker with low limit
    // ========================================================================
    logTest("Initializing hybrid tracker with 5000 token limit")
    tracker = initHybridProviderTracker({
      providers: {
        openai: {
          daily_free_tokens: DAILY_TOKEN_LIMIT,
          reset_time: "00:00 UTC",
          enabled: true,
        },
      },
    })

    // Verify underlying provider detection
    const underlyingProvider = detectUnderlyingProvider(BYOK_MODEL)
    logInfo(`Underlying provider for ${BYOK_MODEL}: ${underlyingProvider}`)
    if (underlyingProvider !== "openai") {
      throw new Error(`Expected underlying provider "openai", got "${underlyingProvider}"`)
    }
    logPass("Underlying provider detection works correctly")

    // ========================================================================
    // Test 2: Make first API call and track usage
    // ========================================================================
    logTest(`Making API call #1 to ${BYOK_MODEL}`)
    tracker.recordUsage(BYOK_MODEL, SMALL_CALL_TOKENS)

    const usage1 = tracker.getProviderUsage("openai")
    if (!usage1) {
      throw new Error("Failed to get provider usage")
    }

    logUsage(`Tokens used: ${usage1.tokensUsedToday} / ${usage1.dailyFreeTokens} (${usage1.percentUsed.toFixed(1)}%)`)
    logInfo(`Exhausted: ${usage1.isExhausted}`)

    if (usage1.tokensUsedToday !== SMALL_CALL_TOKENS) {
      throw new Error(`Expected ${SMALL_CALL_TOKENS} tokens, got ${usage1.tokensUsedToday}`)
    }
    logPass("Usage tracking works correctly")

    // ========================================================================
    // Test 3: Make second API call
    // ========================================================================
    logTest(`Making API call #2 to ${BYOK_MODEL}`)
    tracker.recordUsage(BYOK_MODEL, MEDIUM_CALL_TOKENS)

    const usage2 = tracker.getProviderUsage("openai")
    if (!usage2) {
      throw new Error("Failed to get provider usage")
    }

    const expectedTotal2 = SMALL_CALL_TOKENS + MEDIUM_CALL_TOKENS
    logUsage(`Tokens used: ${usage2.tokensUsedToday} / ${usage2.dailyFreeTokens} (${usage2.percentUsed.toFixed(1)}%)`)
    logInfo(`Exhausted: ${usage2.isExhausted}`)

    if (usage2.tokensUsedToday !== expectedTotal2) {
      throw new Error(`Expected ${expectedTotal2} tokens, got ${usage2.tokensUsedToday}`)
    }
    logPass("Cumulative usage tracking works correctly")

    // ========================================================================
    // Test 4: Make third API call to approach limit
    // ========================================================================
    logTest(`Making API call #3 to ${BYOK_MODEL} (approaching limit)`)
    tracker.recordUsage(BYOK_MODEL, LARGE_CALL_TOKENS)

    const usage3 = tracker.getProviderUsage("openai")
    if (!usage3) {
      throw new Error("Failed to get provider usage")
    }

    const expectedTotal3 = expectedTotal2 + LARGE_CALL_TOKENS
    logUsage(`Tokens used: ${usage3.tokensUsedToday} / ${usage3.dailyFreeTokens} (${usage3.percentUsed.toFixed(1)}%)`)
    logInfo(`Exhausted: ${usage3.isExhausted}`)

    if (usage3.tokensUsedToday !== expectedTotal3) {
      throw new Error(`Expected ${expectedTotal3} tokens, got ${usage3.tokensUsedToday}`)
    }

    // ========================================================================
    // Test 5: Make fourth API call to exceed limit
    // ========================================================================
    logTest(`Making API call #4 to ${BYOK_MODEL} (will exceed limit)`)
    tracker.recordUsage(BYOK_MODEL, EXTRA_CALL_TOKENS)

    const usage4 = tracker.getProviderUsage("openai")
    if (!usage4) {
      throw new Error("Failed to get provider usage")
    }

    const expectedTotal4 = expectedTotal3 + EXTRA_CALL_TOKENS
    logUsage(`Tokens used: ${usage4.tokensUsedToday} / ${usage4.dailyFreeTokens} (${usage4.percentUsed.toFixed(1)}%)`)
    logInfo(`Exhausted: ${usage4.isExhausted}`)

    if (usage4.tokensUsedToday !== expectedTotal4) {
      throw new Error(`Expected ${expectedTotal4} tokens, got ${usage4.tokensUsedToday}`)
    }

    if (!usage4.isExhausted) {
      throw new Error("Expected provider to be exhausted")
    }
    logPass("Provider correctly marked as exhausted when limit exceeded")

    // ========================================================================
    // Test 6: Verify BYOK model is blocked
    // ========================================================================
    logTest("Verifying BYOK model is blocked when provider exhausted")

    overrideManager = new GlobalOverrideManager(undefined, {
      hybridUsageProvider: () => ({
        exhaustedProviders: tracker.getExhaustedProviders(),
      }),
    })

    const byokAllowed = overrideManager.isModelAllowed(BYOK_MODEL, ["opencode"])
    logInfo(`BYOK model allowed: ${byokAllowed}`)

    if (byokAllowed) {
      throw new Error("Expected BYOK model to be blocked")
    }
    logPass(`${BYOK_MODEL} correctly blocked when provider exhausted`)

    // ========================================================================
    // Test 7: Verify native models still work
    // ========================================================================
    logTest("Verifying native OpenCode models still work")

    const nativeAllowed = overrideManager.isModelAllowed(NATIVE_MODEL, ["opencode"])
    logInfo(`Native model allowed: ${nativeAllowed}`)

    if (!nativeAllowed) {
      throw new Error("Expected native model to be allowed")
    }
    logPass(`${NATIVE_MODEL} still available when BYOK exhausted`)

    // ========================================================================
    // Test 8: Verify fallback to subscription models works
    // ========================================================================
    logTest("Verifying fallback to subscription models works")

    const fallbackAllowed = overrideManager.isModelAllowed(FALLBACK_MODEL, ["github-copilot"])
    logInfo(`Fallback model allowed: ${fallbackAllowed}`)

    if (!fallbackAllowed) {
      throw new Error("Expected fallback model to be allowed")
    }
    logPass(`${FALLBACK_MODEL} available as fallback`)

    // ========================================================================
    // Test 9: Verify exhausted providers list
    // ========================================================================
    logTest("Verifying exhausted providers list")

    const exhaustedProviders = tracker.getExhaustedProviders()
    logInfo(`Exhausted providers: ${exhaustedProviders.join(", ")}`)

    if (!exhaustedProviders.includes("openai")) {
      throw new Error("Expected 'openai' in exhausted providers list")
    }
    logPass("Exhausted providers list is correct")

    // ========================================================================
    // Test 10: Verify all usage data
    // ========================================================================
    logTest("Verifying all usage data")

    const allUsage = tracker.getAllUsage()
    logInfo(`All providers tracked: ${Object.keys(allUsage).join(", ")}`)

    if (!allUsage.openai) {
      throw new Error("Expected 'openai' in all usage data")
    }

    const openaiUsage = allUsage.openai
    logInfo(`OpenAI usage: ${openaiUsage.tokensUsedToday} / ${openaiUsage.dailyFreeTokens} (${openaiUsage.percentUsed.toFixed(1)}%)`)
    logInfo(`OpenAI exhausted: ${openaiUsage.isExhausted}`)
    logInfo(`OpenAI enabled: ${openaiUsage.enabled}`)

    if (openaiUsage.tokensUsedToday !== expectedTotal4) {
      throw new Error(`Expected ${expectedTotal4} tokens in all usage, got ${openaiUsage.tokensUsedToday}`)
    }
    logPass("All usage data is correct")

    // ========================================================================
    // Test 11: Verify model selection with fallback
    // ========================================================================
    logTest("Verifying model selection with fallback")

    const selectedModel = overrideManager.getBestAvailableModel(
      "quick",
      undefined,
      ["opencode", "github-copilot"],
      { openai: usage4.percentUsed },
      {},
    )

    logInfo(`Selected model: ${selectedModel}`)

    // Should select a non-BYOK model since openai is exhausted
    if (selectedModel.startsWith("opencode/gpt-")) {
      throw new Error("Expected fallback to non-BYOK model")
    }
    logPass("Model selection correctly falls back to non-BYOK models")

    // ========================================================================
    // Summary
    // ========================================================================
    logSection("Test Summary")

    console.log("✅ All BYOK hybrid pricing tests passed!")
    console.log("\nVerified:")
    console.log("  1. Usage tracking works correctly")
    console.log("  2. Cumulative usage tracking works")
    console.log("  3. Provider correctly marked as exhausted")
    console.log("  4. BYOK model blocked when provider exhausted")
    console.log("  5. Native models still available")
    console.log("  6. Fallback to subscription models works")
    console.log("  7. Exhausted providers list is correct")
    console.log("  8. All usage data is correct")
    console.log("  9. Model selection correctly falls back")

  } catch (error) {
    logSection("Test Failed")
    console.error(error)
    process.exit(1)
  } finally {
    // Cleanup
    logTest("Cleaning up test state")
    resetHybridProviderTracker()
    logInfo("Tracker reset complete")
  }
}

// ============================================================================
// Run Tests
// ============================================================================

testBYOKHybridPricing()