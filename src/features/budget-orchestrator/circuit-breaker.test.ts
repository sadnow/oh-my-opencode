import { describe, it, expect } from "bun:test"
import { CircuitBreaker } from "./circuit-breaker"
import { join } from "path"
import { tmpdir } from "os"

function createBreaker(
  overrides: Partial<ConstructorParameters<typeof CircuitBreaker>[1]> = {},
  fixedPath?: string
) {
  let now = 0
  const persistPath = fixedPath ?? join(
    tmpdir(),
    `omo-circuit-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  )

  const breaker = new CircuitBreaker(persistPath, {
    failureThreshold: 2,
    openTimeoutMs: 1000,
    now: () => now,
    ...overrides,
  })

  return {
    breaker,
    advance: (ms: number) => { now += ms },
    persistPath,
    getNow: () => now,
  }
}

describe("CircuitBreaker", () => {
  it("opens after consecutive failures", () => {
    //#given
    const { breaker } = createBreaker({ failureThreshold: 2 })

    //#when
    breaker.recordFailure("anthropic")
    breaker.recordFailure("anthropic")

    //#then
    const state = breaker.getProviderState("anthropic")
    expect(state.state).toBe("open")
    expect(breaker.shouldAllow("anthropic")).toBe(false)
  })

  it("moves to half-open after timeout", () => {
    //#given
    const { breaker, advance } = createBreaker({ failureThreshold: 1, openTimeoutMs: 500 })
    breaker.recordFailure("openai")

    //#when
    advance(600)
    const allowed = breaker.shouldAllow("openai")

    //#then
    const state = breaker.getProviderState("openai")
    expect(allowed).toBe(true)
    expect(state.state).toBe("half_open")
  })

  it("closes on half-open success", () => {
    //#given
    const { breaker, advance } = createBreaker({ failureThreshold: 1, openTimeoutMs: 200 })
    breaker.recordFailure("google")
    advance(250)
    breaker.shouldAllow("google")

    //#when
    breaker.recordSuccess("google")

    //#then
    const state = breaker.getProviderState("google")
    expect(state.state).toBe("closed")
    expect(state.failureCount).toBe(0)
  })

  it("reopens on half-open failure", () => {
    //#given
    const { breaker, advance } = createBreaker({ failureThreshold: 1, openTimeoutMs: 200 })
    breaker.recordFailure("github-copilot")
    advance(250)
    breaker.shouldAllow("github-copilot")

    //#when
    breaker.recordFailure("github-copilot")

    //#then
    const state = breaker.getProviderState("github-copilot")
    expect(state.state).toBe("open")
    expect(breaker.shouldAllow("github-copilot")).toBe(false)
  })

  it("persists state across restarts", () => {
    //#given
    const { breaker, persistPath } = createBreaker({ failureThreshold: 1, openTimeoutMs: 300 })
    breaker.recordFailure("anthropic")

    //#when
    const restored = new CircuitBreaker(persistPath, {
      failureThreshold: 1,
      openTimeoutMs: 300,
      now: () => 0,
    })

    //#then
    const state = restored.getProviderState("anthropic")
    expect(state.state).toBe("open")
    expect(restored.shouldAllow("anthropic")).toBe(false)

    const recovered = new CircuitBreaker(persistPath, {
      failureThreshold: 1,
      openTimeoutMs: 300,
      now: () => 400,
    })
    expect(recovered.shouldAllow("anthropic")).toBe(true)
    expect(recovered.getProviderState("anthropic").state).toBe("half_open")
  })
})
