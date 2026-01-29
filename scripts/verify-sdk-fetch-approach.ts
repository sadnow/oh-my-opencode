#!/usr/bin/env bun
/**
 * Verification Script for SDK Fetch Approach
 * 
 * This script simulates what will happen when OpenCode reloads the plugin:
 * 1. Creates a mock context with SDK client that returns message data
 * 2. Fires the usage tracking hook with user and assistant messages
 * 3. Verifies the hook successfully extracts tokens from SDK-fetched messages
 */

import { createUsageTrackingHook } from "../src/hooks/usage-tracking";
import type { PluginInput } from "@opencode-ai/plugin";
import type { UsageTracker } from "../src/features/usage-tracker";

// Mock message data that the SDK client.session.messages() would return
const mockSessionMessages = [
  {
    info: {
      id: "msg_user_123",
      role: "user",
      sessionID: "test-session-123",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4.5" }
    },
    parts: [
      { type: "text", text: "Hello, this is a test user message." }
    ]
  },
  {
    info: {
      id: "msg_assistant_456",
      role: "assistant",
      sessionID: "test-session-123",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4.5" }
    },
    parts: [
      { type: "text", text: "Hello! I'm an assistant. This is my response with some text content." },
      { type: "reasoning", text: "Here is some reasoning content as well." }
    ]
  }
];

// Create mock context
const mockContext = {
  client: {
    session: {
      messages: async ({ path }: { path: { id: string } }) => {
        console.log(`[MOCK SDK] Fetching session messages for: ${path.id}`);
        return { data: mockSessionMessages };
      },
      prompt: async () => ({ data: {} })
    }
  }
} as any as PluginInput;

// Create mock usage tracker
let recordedUsage: any = null;
const mockUsageTracker = {
  recordUsage: async (data: any) => {
    console.log(`[MOCK TRACKER] Recording usage:`, data);
    recordedUsage = data;
    return {
      id: "test-usage-id",
      timestamp: new Date().toISOString(),
      provider: data.provider,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      estimatedCost: 0,
      taskType: data.taskType,
      sessionID: data.sessionID,
    };
  },
  getSummary: async () => ({ summaries: {}, totalCost: 0 }),
  getProviderSummary: async () => ({
    provider: "test",
    periodStart: new Date().toISOString(),
    nextReset: new Date().toISOString(),
    resetType: "monthly" as const,
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    callCount: 0,
  }),
  exportData: async () => "",
  importData: async () => {},
  resetPeriod: async () => {},
} as any as UsageTracker;

async function runVerification() {
  console.log("=".repeat(80));
  console.log("SDK FETCH APPROACH VERIFICATION");
  console.log("=".repeat(80));
  console.log();

  // Create the hook
  console.log("1. Creating usage tracking hook...");
  const hook = createUsageTrackingHook(mockContext, mockUsageTracker);
  
  if (!hook) {
    console.error("❌ FAILED: Hook creation returned null");
    process.exit(1);
  }
  console.log("✅ Hook created successfully");
  console.log();

  // Simulate USER message
  console.log("2. Simulating USER message (chat.message)...");
  await hook["chat.message"]?.(
    {
      sessionID: "test-session-123",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4.5" },
      messageID: "msg_user_123"
    },
    {
      message: { role: "user" },
      parts: [{ type: "text", text: "Hello, this is a test user message." }]
    } as any
  );
  console.log("✅ USER message processed");
  console.log();

  // Small delay to simulate message processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate ASSISTANT message via event (message.updated)
  console.log("3. Simulating ASSISTANT message (message.updated event)...");
  await hook.event?.({
    event: {
      type: "message.updated",
      properties: {
        info: {
          id: "msg_assistant_456",
          role: "assistant",
          sessionID: "test-session-123",
          model: { providerID: "anthropic", modelID: "claude-sonnet-4.5" }
        }
      }
    }
  });
  console.log("✅ ASSISTANT message event processed");
  console.log();

  // Small delay for async processing
  await new Promise(resolve => setTimeout(resolve, 200));

  // Verify results
  console.log("4. Verifying results...");
  console.log();

  if (!recordedUsage) {
    console.error("❌ FAILED: No usage was recorded");
    process.exit(1);
  }

  console.log("Recorded Usage Data:");
  console.log(JSON.stringify(recordedUsage, null, 2));
  console.log();

  // Validate recorded data
  const checks = [
    { name: "Has sessionID", pass: !!recordedUsage.sessionID },
    { name: "Has inputTokens > 0", pass: recordedUsage.inputTokens > 0 },
    { name: "Has outputTokens > 0", pass: recordedUsage.outputTokens > 0 },
    { name: "Has provider", pass: !!recordedUsage.provider },
    { name: "Has model", pass: !!recordedUsage.model },
  ];

  console.log("Validation Checks:");
  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? "✅" : "❌";
    console.log(`  ${icon} ${check.name}`);
    if (!check.pass) allPassed = false;
  }
  console.log();

  if (!allPassed) {
    console.error("❌ VERIFICATION FAILED: Some checks did not pass");
    process.exit(1);
  }

  console.log("=".repeat(80));
  console.log("✅ ALL CHECKS PASSED!");
  console.log("=".repeat(80));
  console.log();
  console.log("Summary:");
  console.log(`  - Input Tokens:  ${recordedUsage.inputTokens}`);
  console.log(`  - Output Tokens: ${recordedUsage.outputTokens}`);
  console.log(`  - Model:         ${recordedUsage.provider}/${recordedUsage.model}`);
  console.log(`  - Source:        SDK client fetch (ctx.client.session.messages)`);
  console.log();
  console.log("The SDK fetch approach is working correctly!");
  console.log("When OpenCode reloads the plugin, usage tracking will work as expected.");
  console.log();
}

// Run verification
runVerification().catch((error) => {
  console.error("❌ VERIFICATION ERROR:", error);
  process.exit(1);
});
