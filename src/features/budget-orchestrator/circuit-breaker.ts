import { log } from "../../shared"
import { join } from "path"
import { homedir } from "os"
import { getRoutingLogger } from "./routing-logger"

export type CircuitState = "closed" | "open" | "half_open"

export interface CircuitBreakerProviderState {
  state: CircuitState
  failureCount: number
  lastFailureAt: number | null
  openedAt: number | null
  halfOpenSince: number | null
  lastSuccessAt: number | null
  lastLatencyMs: number | null
}

export interface CircuitBreakerState {
  providers: Record<string, CircuitBreakerProviderState>
}

export interface CircuitBreakerOptions {
  failureThreshold: number
  openTimeoutMs: number
  now?: () => number
  persistPath?: string
}

const DEFAULT_STATE: CircuitBreakerState = {
  providers: {},
}

function createProviderState(): CircuitBreakerProviderState {
  return {
    state: "closed",
    failureCount: 0,
    lastFailureAt: null,
    openedAt: null,
    halfOpenSince: null,
    lastSuccessAt: null,
    lastLatencyMs: null,
  }
}

export class CircuitBreaker {
  private readonly failureThreshold: number
  private readonly openTimeoutMs: number
  private readonly now: () => number
  private readonly persistPath: string
  private state: CircuitBreakerState

  constructor(persistPath?: string, options: CircuitBreakerOptions = { failureThreshold: 3, openTimeoutMs: 30000 }) {
    const resolvedPath = persistPath ?? options.persistPath ?? join(
      homedir(),
      ".config",
      "opencode",
      "oh-my-opencode-circuit-breaker.json"
    )

    this.persistPath = resolvedPath
    this.failureThreshold = options.failureThreshold ?? 3
    this.openTimeoutMs = options.openTimeoutMs ?? 30000
    this.now = options.now ?? (() => Date.now())

    this.state = this.loadState() ?? { ...DEFAULT_STATE, providers: {} }
  }

  shouldAllow(provider: string): boolean {
    const providerState = this.getOrCreateProviderState(provider)
    if (providerState.state === "open") {
      const openedAt = providerState.openedAt ?? 0
      if (this.now() - openedAt >= this.openTimeoutMs) {
        this.transitionToHalfOpen(provider, providerState)
        this.saveState()
        return true
      }
      return false
    }

    return true
  }

  recordSuccess(provider: string, latencyMs?: number): void {
    const providerState = this.getOrCreateProviderState(provider)
    providerState.lastSuccessAt = this.now()
    providerState.lastLatencyMs = latencyMs ?? providerState.lastLatencyMs

    if (providerState.state === "half_open" || providerState.state === "open") {
      providerState.state = "closed"
      providerState.failureCount = 0
      providerState.openedAt = null
      providerState.halfOpenSince = null
      this.logTransition(provider, "closed", "success")
    } else {
      providerState.failureCount = 0
    }

    this.saveState()
  }

  recordFailure(provider: string, error?: unknown, latencyMs?: number): void {
    const providerState = this.getOrCreateProviderState(provider)
    providerState.failureCount += 1
    providerState.lastFailureAt = this.now()
    providerState.lastLatencyMs = latencyMs ?? providerState.lastLatencyMs

    if (providerState.state === "half_open") {
      this.transitionToOpen(provider, providerState, "half_open_failure")
    } else if (providerState.failureCount >= this.failureThreshold) {
      this.transitionToOpen(provider, providerState, "failure_threshold")
    }

    this.saveState()
  }

  getProviderState(provider: string): CircuitBreakerProviderState {
    return { ...this.getOrCreateProviderState(provider) }
  }

  resetProvider(provider: string): void {
    this.state.providers[provider] = createProviderState()
    this.saveState()
  }

  private getOrCreateProviderState(provider: string): CircuitBreakerProviderState {
    if (!this.state.providers[provider]) {
      this.state.providers[provider] = createProviderState()
    }
    return this.state.providers[provider]
  }

  private transitionToOpen(provider: string, providerState: CircuitBreakerProviderState, reason: string): void {
    providerState.state = "open"
    providerState.openedAt = this.now()
    providerState.halfOpenSince = null
    this.logTransition(provider, "open", reason)
  }

  private transitionToHalfOpen(provider: string, providerState: CircuitBreakerProviderState): void {
    providerState.state = "half_open"
    providerState.halfOpenSince = this.now()
    this.logTransition(provider, "half_open", "timeout")
  }

  private logTransition(provider: string, state: CircuitState, reason: string): void {
    const logger = getRoutingLogger()
    logger.logDebug("routing_decision", "Circuit breaker transition", {
      provider,
      state,
      reason,
      timestamp: new Date(this.now()).toISOString(),
    })
  }

  private loadState(): CircuitBreakerState | null {
    try {
      const fs = require("fs")
      if (fs.existsSync(this.persistPath)) {
        const content = fs.readFileSync(this.persistPath, "utf-8")
        const data = JSON.parse(content)
        if (typeof data === "object" && data !== null && typeof data.providers === "object") {
          const providers: Record<string, CircuitBreakerProviderState> = {}
          for (const [key, value] of Object.entries(data.providers)) {
            if (typeof value === "object" && value !== null) {
              const entry = value as Partial<CircuitBreakerProviderState>
              providers[key] = {
                state: entry.state ?? "closed",
                failureCount: entry.failureCount ?? 0,
                lastFailureAt: entry.lastFailureAt ?? null,
                openedAt: entry.openedAt ?? null,
                halfOpenSince: entry.halfOpenSince ?? null,
                lastSuccessAt: entry.lastSuccessAt ?? null,
                lastLatencyMs: entry.lastLatencyMs ?? null,
              }
            }
          }
          return { providers }
        }
      }
    } catch (error) {
      log("[circuit-breaker] Failed to load state:", error)
    }
    return null
  }

  private saveState(): void {
    try {
      const fs = require("fs")
      const path = require("path")
      const dir = path.dirname(this.persistPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const tempPath = `${this.persistPath}.tmp`
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2))
      fs.renameSync(tempPath, this.persistPath)
    } catch (error) {
      log("[circuit-breaker] Failed to save state:", error)
    }
  }
}
