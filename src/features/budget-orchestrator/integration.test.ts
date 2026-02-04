/**
 * Budget Orchestrator Integration Tests
 *
 * End-to-end routing flow checks (preference → weighted selection → provider choice)
 * with circuit breaker gating and routing decision logging.
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { resolveModelWithFallback } from "../../shared/model-resolver"
import { getRoutingLogger } from "./routing-logger"
import { resetWeightCalculator } from "./provider-weight-calculator"
import { GlobalOverrideManager } from "./global-override"
import { CircuitBreaker } from "./circuit-breaker"
import { join } from "path"
import { tmpdir } from "os"

function createTempCircuitBreaker(nowRef: { value: number }) {
  const persistPath = join(
    tmpdir(),
    `omo-circuit-integration-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  )
  const breaker = new CircuitBreaker(persistPath, {
    failureThreshold: 1,
    openTimeoutMs: 1000,
    now: () => nowRef.value,
  })
  return { breaker, persistPath }
}

function createTempOverrideManager(nowRef: { value: number }) {
  const { breaker, persistPath } = createTempCircuitBreaker(nowRef)
  const overridePersistPath = join(
    tmpdir(),
    `omo-global-override-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  )
  const manager = new GlobalOverrideManager(overridePersistPath, {
    circuitBreaker: breaker,
    copilotUsageProvider: () => null,
  })
  return { manager, breaker, persistPath }
}

describe("Budget Orchestrator Integration", () => {
  beforeEach(() => {
    getRoutingLogger().clearLogs()
    resetWeightCalculator()
  })

  it("allows copilot selection even with anthropic preference", () => {
    //#given: Multiple providers match the preferred model
    const availableModels = new Set([
      "github-copilot/claude-opus-4.5",
      "anthropic/claude-opus-4-5",
    ])

    //#when: Resolve with an Anthropic preference
    const result = resolveModelWithFallback({
      preferredModel: "anthropic/claude-opus-4-5",
      availableModels,
      systemDefaultModel: "opencode/big-pickle",
    })

    //#then: Copilot can still be chosen (preference is not a hard lock)
    expect(result?.model).toBe("github-copilot/claude-opus-4.5")
    expect(result?.source).toBe("provider-fallback")
  })

  it("excludes open providers and re-allows after half-open success", () => {
    //#given: Circuit breaker with deterministic time
    const nowRef = { value: 0 }
    const { manager, breaker } = createTempOverrideManager(nowRef)

    expect(manager.isProviderDisabled("anthropic")).toBe(false)

    //#when: Failure opens the circuit
    manager.recordProviderFailure("anthropic")

    //#then: Provider is excluded while open
    expect(breaker.getProviderState("anthropic").state).toBe("open")
    expect(manager.isProviderDisabled("anthropic")).toBe(true)

    //#when: Timeout elapses and circuit moves to half-open
    nowRef.value += 1000
    const allowedAfterTimeout = manager.isProviderDisabled("anthropic")

    //#then: Provider becomes eligible again in half-open
    expect(allowedAfterTimeout).toBe(false)
    expect(breaker.getProviderState("anthropic").state).toBe("half_open")

    //#when: Successful call closes the circuit
    manager.recordProviderSuccess("anthropic")

    //#then: Provider is eligible again
    expect(breaker.getProviderState("anthropic").state).toBe("closed")
    expect(manager.isProviderDisabled("anthropic")).toBe(false)
  })

  it("logs routing decisions with required fields without secrets", () => {
    //#given: Weighted selection path with a secret in preference
    const availableModels = new Set([
      "github-copilot/claude-opus-4.5",
      "anthropic/claude-opus-4-5",
    ])
    const secret = "sk-test-123"

    //#when: Resolve through weighted selection
    const result = resolveModelWithFallback({
      preferredModel: `anthropic/claude-opus-4-5?api_key=${secret}`,
      fallbackChain: [{ providers: ["github-copilot", "anthropic"], model: "claude-opus-4-5" }],
      availableModels,
      systemDefaultModel: "opencode/big-pickle",
    })

    //#then: Routing log includes expected metadata fields
    expect(result).toBeTruthy()
    const logs = getRoutingLogger().getLogs()
    const decisionLog = logs.find(log => log.category === "routing_decision")
    expect(decisionLog).toBeTruthy()

    const metadata = decisionLog?.metadata as Record<string, unknown>
    expect(typeof metadata.timestamp).toBe("string")
    expect(metadata.use_case).toBeDefined()
    expect(Array.isArray(metadata.candidates)).toBe(true)
    expect(typeof metadata.weights).toBe("object")
    expect(typeof metadata.selected).toBe("string")
    expect(typeof metadata.reason).toBe("string")

    //#then: Secret never appears in routing logs
    expect(JSON.stringify(logs)).not.toContain(secret)
  })

  it("uses weighted selection in multiple routing entry points", () => {
    //#given: Two routing paths (model-resolver + global override)
    const nowRef = { value: 0 }
    const { manager } = createTempOverrideManager(nowRef)
    const availableModels = new Set([
      "github-copilot/claude-opus-4.5",
      "anthropic/claude-opus-4-5",
    ])

    //#when: delegate_task-style resolution (model-resolver)
    resolveModelWithFallback({
      fallbackChain: [{ providers: ["github-copilot", "anthropic"], model: "claude-opus-4-5" }],
      availableModels,
      systemDefaultModel: "opencode/big-pickle",
    })

    //#when: main orchestrator routing (global override)
    manager.getBestAvailableModel(
      "implementation",
      undefined,
      ["anthropic", "github-copilot"],
      { anthropic: 10, "github-copilot": 10 },
      {}
    )

    //#then: Both paths produce weighted-selection markers (shared helper proxy)
    const logs = getRoutingLogger().getLogs()
    const weightedLogs = logs.filter(log => log.metadata && (log.metadata as Record<string, unknown>).weights)
    expect(weightedLogs.length).toBeGreaterThanOrEqual(2)
  })

  it("never returns broken Zen models from getBestAvailableModel", () => {
    //#given: Only opencode provider available with known broken models
    const nowRef = { value: 0 }
    const { manager } = createTempOverrideManager(nowRef)
    const brokenModels = [
      "opencode/gemini-3-pro",
      "opencode/gemini-3-flash",
      "opencode/minimax-m2.1-free",
    ]
    const useCases = [
      "implementation",
      "oracle",
      "librarian",
      "explorer",
      "quick",
      "orchestrator",
      "ultrabrain",
    ]

    //#when: Resolve best available model per use case
    for (const useCase of useCases) {
      const result = manager.getBestAvailableModel(
        useCase as any,
        undefined,
        ["opencode"],
        { opencode: 0 },
        {}
      )

      //#then: Broken Zen models are never returned
      if (result) {
        expect(brokenModels).not.toContain(result)
      }
    }
  })
})
