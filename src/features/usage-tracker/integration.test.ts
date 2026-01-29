import { describe, beforeAll, afterAll, it, expect } from "bun:test"
import { UsageTracker } from "./tracker"
import { BudgetOrchestrator } from "../budget-orchestrator"
import { estimateTokens } from "./token-estimator"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

describe("Usage Tracking Integration", () => {
  const testStoragePath = path.join(os.tmpdir(), `usage-integration-test-${Date.now()}.json`)
  let usageTracker: UsageTracker
  let budgetOrchestrator: BudgetOrchestrator

  beforeAll(() => {
    // Initialize UsageTracker with a temporary storage path
    usageTracker = new UsageTracker({
      enabled: true,
      persist: true,
      storagePath: testStoragePath,
    })

    // Initialize BudgetOrchestrator with the usage tracker
    budgetOrchestrator = new BudgetOrchestrator(
      {
        enabled: true,
        target_percentage: 0.8,
        provider_budgets: {
          anthropic: 10.0, // $10 budget for testing
        },
        auto_downgrade: true,
        min_tier: "economy",
        auto_upgrade: false,
        routing_log_persist: false,
      },
      usageTracker,
      ["anthropic", "openai"]
    )
  })

  afterAll(() => {
    // Clean up
    usageTracker.shutdown()
    if (fs.existsSync(testStoragePath)) {
      fs.unlinkSync(testStoragePath)
    }
  })

  it("should track 10 synthetic messages and verify data consistency", async () => {
    const sessionId = "test-session-123"
    const provider = "anthropic"
    const model = "claude-sonnet-4-5"
    
    // 1. Create a mock OpenCode session (simulated by recording session start)
    budgetOrchestrator.recordSessionStart()

    // 2. Send 10 synthetic messages with known content for token estimation
    const messages = [
      { role: "user", content: "Hello, how are you?" }, // ~5 tokens
      { role: "assistant", content: "I am doing well, thank you! How can I help you today?" }, // ~14 tokens
      { role: "user", content: "Can you write a simple python function to add two numbers?" }, // ~13 tokens
      { role: "assistant", content: "```python\ndef add(a, b):\n    return a + b\n```" }, // ~12 tokens (code)
      { role: "user", content: "Great, now explain how it works." }, // ~7 tokens
      { role: "assistant", content: "The function `add` takes two arguments `a` and `b`, and returns their sum using the `+` operator." }, // ~20 tokens
      { role: "user", content: "What is the capital of France?" }, // ~7 tokens
      { role: "assistant", content: "The capital of France is Paris." }, // ~7 tokens
      { role: "user", content: "Tell me a joke." }, // ~4 tokens
      { role: "assistant", content: "Why did the programmer quit his job? Because he didn't get arrays." }, // ~14 tokens
    ]

    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (let i = 0; i < messages.length; i += 2) {
      const userMsg = messages[i]
      const assistantMsg = messages[i + 1]

      const inputTokens = estimateTokens(userMsg.content)
      const outputTokens = estimateTokens(assistantMsg.content)

      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens

      // Record usage
      const record = usageTracker.recordUsage({
        provider,
        model,
        inputTokens,
        outputTokens,
        taskType: "primary",
        sessionID: sessionId,
      })

      // Record in budget orchestrator too
      budgetOrchestrator.recordUsageDuringSession(record.estimatedCost, "standard")
    }

    budgetOrchestrator.recordSessionEnd(provider)

    // 3. Verify all 10 messages (5 pairs) are recorded
    const records = usageTracker.getAllRecords()
    const sessionRecords = records.filter(r => r.sessionID === sessionId)
    expect(sessionRecords.length).toBe(5) // 5 pairs of messages recorded as 5 usage events

    // 4. Verify token estimation accuracy (sum of estimated tokens)
    const recordedInputTokens = sessionRecords.reduce((sum, r) => sum + r.inputTokens, 0)
    const recordedOutputTokens = sessionRecords.reduce((sum, r) => sum + r.outputTokens, 0)
    
    expect(recordedInputTokens).toBe(totalInputTokens)
    expect(recordedOutputTokens).toBe(totalOutputTokens)

    // 5. Verify cost calculation
    // Pricing for claude-sonnet-4-5: inputPer1M: 3.0, outputPer1M: 15.0
    const expectedCost = (totalInputTokens / 1_000_000) * 3.0 + (totalOutputTokens / 1_000_000) * 15.0
    const actualCost = sessionRecords.reduce((sum, r) => sum + r.estimatedCost, 0)
    
    expect(actualCost).toBeCloseTo(expectedCost, 8)

    // 6. Verify budget orchestrator sees the data
    const budgetState = budgetOrchestrator.getBudgetState(provider)
    expect(budgetState).not.toBeNull()
    if (budgetState) {
      expect(budgetState.used).toBeCloseTo(actualCost, 8)
      expect(budgetState.totalBudget).toBe(10.0)
      expect(budgetState.remaining).toBeCloseTo(10.0 - actualCost, 8)
    }

    // Verify summary
    const summary = usageTracker.getProviderSummary(provider)
    expect(summary.callCount).toBe(5)
    expect(summary.totalCost).toBeCloseTo(actualCost, 8)
  })
})
