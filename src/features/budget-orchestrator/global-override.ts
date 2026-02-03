/**
 * Global Override Manager
 * Manages provider-level overrides that take precedence over all other settings.
 * 
 * Features:
 * - Disable/enable entire providers
 * - Set maximum tier caps
 * - Auto-disable providers when quota exceeded
 * - Preserve percentage for critical tasks
 * - Fallback model selection when providers unavailable
 */

import { log } from "../../shared"
import { getCopilotUsageTracker } from "../copilot-usage"
import type { ModelTier } from "../../config/schema"
import { join } from "path"
import { homedir } from "os"
import { getRoutingLogger } from "./routing-logger"
import { CircuitBreaker } from "./circuit-breaker"
import { getWeightCalculator } from "./provider-weight-calculator"
import type { WeightCandidate } from "./provider-classification"
import { isModelFailed, isModelFailedByProvider } from "./model-failure-cache"
import { isZenModelInCache, hasZenCacheData } from "./zen-model-detection"
import { detectUnderlyingProvider } from "./underlying-provider"
import { getHybridProviderTracker } from "./hybrid-tracker"

// ============================================================================
// Use-Case Specific Model Fallback Lists
// ============================================================================

/**
 * Fallback model lists ordered from BEST to WORST for each use case.
 * These are used when a preferred provider is disabled or unavailable.
 * 
 * Format: "provider/model"
 * 
 * Criteria for ranking:
 * - librarian: Needs good tool use, context handling, documentation understanding
 * - explorer: Needs SPEED, not deep reasoning (codebase grep)
 * - oracle: Needs BEST reasoning for debugging, architecture decisions
 * - orchestrator: Needs planning, delegation, complex reasoning
 * - implementation: Needs coding ability
 * - quick: Needs SPEED for simple queries
 */
export const USE_CASE_FALLBACKS = {
  /** Librarian - docs search, GitHub, needs moderate reasoning + tool use */
  librarian: [
    "anthropic/claude-sonnet-4-5",       // Best overall for tool use
    "openai/gpt-5.2",                    // Strong tool use
    "github-copilot/claude-sonnet-4.5",  // Good tool use, free with subscription
    "github-copilot/gpt-5.1-codex",      // Strong alternative, free (1x)
    "google/gemini-3-flash-preview",     // Fast with good tool use
    "opencode/gpt-5.2",                  // BYOK OpenAI through Zen
    "opencode/gemini-3-flash",           // BYOK Google through Zen
    "opencode/glm-4.7",                  // Good at agentic tasks
    "opencode/kimi-k2-thinking",         // Thinking model, good at analysis
    "anthropic/claude-haiku-4-5",        // Fast Claude
    "github-copilot/gpt-5-mini",         // Budget copilot option (0x FREE!)
    "github-copilot/gpt-4.1",            // Budget copilot (0x FREE!)
    "google/gemini-2.5-flash",           // Previous gen flash
    "opencode/big-pickle",               // Ultimate fallback
  ],
  
  /** Explorer - fast codebase search, needs SPEED not deep reasoning */
  explorer: [
    "google/gemini-3-flash-preview",     // Fastest current gen
    "opencode/gemini-3-flash",           // BYOK Google through Zen (fast)
    "opencode/gpt-5-nano",               // BYOK OpenAI through Zen (fast + cheap)
    "github-copilot/gpt-5-mini",         // Fast + free with subscription (0x FREE!)
    "github-copilot/gpt-4.1",            // Fast + free (0x FREE!)
    "google/gemini-2.5-flash",           // Fast previous gen
    "github-copilot/gemini-3-flash",     // Fast via Copilot (0.33x)
    "github-copilot/grok-code-fast-1",   // Very fast via Copilot (0.25x)
    "openai/gpt-4.1-nano",               // Very fast
    "anthropic/claude-haiku-4-5",        // Fast Claude
    "github-copilot/claude-haiku-4.5",   // Fast Claude via Copilot (0.33x)
    "opencode/glm-4.7-free",             // Free GLM (Zen)
    "opencode/glm-4.6",                  // Budget GLM
    "opencode/kimi-k2.5-free",           // Free Kimi (Zen)
    "opencode/big-pickle",               // Ultimate fallback
  ],
  
  /** Oracle - debugging, architecture, needs BEST reasoning */
  oracle: [
    "anthropic/claude-opus-4-5",         // Best reasoning overall
    "openai/o1-pro",                     // Strong reasoning
    "openai/gpt-5.2",                    // Very strong
    "opencode/gpt-5.2",                  // BYOK OpenAI through Zen
    "opencode/gemini-3-pro",             // BYOK Google through Zen
    "github-copilot/gpt-5.2-codex",      // Premium copilot reasoning, free
    "opencode/kimi-k2-thinking",         // Great thinking model
    "anthropic/claude-sonnet-4-5",       // Good reasoning
    "github-copilot/claude-sonnet-4.5",  // Good reasoning, free fallback
    "google/gemini-3-pro-preview",       // Strong Gemini
    "opencode/glm-4.7",                  // Capable
    "opencode/big-pickle",               // Ultimate fallback
  ],
  
  /** Orchestrator - planning, delegation, complex reasoning */
  orchestrator: [
    "anthropic/claude-opus-4-5",         // Best for orchestration
    "anthropic/claude-sonnet-4-5",       // Good alternative
    "openai/gpt-5.2-codex",              // Strong coding orchestration
    "opencode/gpt-5.2-codex",            // BYOK OpenAI through Zen
    "opencode/gpt-5.2",                  // BYOK OpenAI through Zen
    "opencode/gemini-3-pro",             // BYOK Google through Zen
    "github-copilot/claude-opus-4.5",    // Best via Copilot (3x but free with sub)
    "github-copilot/claude-sonnet-4.5",  // Good orchestration, free (1x)
    "github-copilot/gpt-5.2-codex",      // Strong via Copilot (1x)
    "openai/o1-pro",                     // Good reasoning
    "opencode/kimi-k2-thinking",         // Good for planning
    "opencode/glm-4.7",                  // Capable at agentic tasks
    "google/gemini-3-pro-preview",       // Strong Gemini
    "opencode/big-pickle",               // Ultimate fallback
  ],
  
  /** Implementation - code writing, needs coding ability */
  implementation: [
    "anthropic/claude-sonnet-4-5",       // Best coding
    "openai/gpt-5.2-codex",              // Strong coding
    "opencode/gpt-5.2-codex",            // BYOK OpenAI through Zen
    "opencode/gpt-5.1-codex",            // BYOK OpenAI through Zen
    "opencode/gemini-3-flash",           // BYOK Google through Zen (fast coding)
    "github-copilot/claude-sonnet-4.5",  // Strong coding, free (1x)
    "github-copilot/gpt-5.2-codex",      // Strong coding via Copilot (1x)
    "github-copilot/gpt-5.1-codex",      // Good coding via Copilot (1x)
    "anthropic/claude-opus-4-5",         // Premium quality
    "opencode/glm-4.7",                  // Good at coding
    "opencode/qwen3-coder",              // Specialized for code
    "google/gemini-3-flash-preview",     // Fast coding
    "github-copilot/gpt-5-mini",         // Budget coding, free (0x FREE!)
    "github-copilot/gpt-5.1-codex-mini", // Budget coding (0.33x)
    "opencode/kimi-k2-thinking",         // Can code well
    "opencode/big-pickle",               // Ultimate fallback
  ],
  
  /** Quick - fast responses for simple queries */
  quick: [
    "google/gemini-3-flash-preview",     // Fastest
    "opencode/gemini-3-flash",           // BYOK Google through Zen (fastest)
    "opencode/gpt-5-nano",               // BYOK OpenAI through Zen (fast + cheap)
    "github-copilot/gpt-5-mini",         // Fast + free (0x FREE!)
    "github-copilot/gpt-4.1",            // Fast + free (0x FREE!)
    "google/gemini-2.5-flash",           // Fast
    "github-copilot/gemini-3-flash",     // Fast via Copilot (0.33x)
    "github-copilot/grok-code-fast-1",   // Very fast via Copilot (0.25x)
    "github-copilot/claude-haiku-4.5",   // Fast Claude via Copilot (0.33x)
    "anthropic/claude-haiku-4-5",        // Fast Claude
    "openai/gpt-4.1-nano",               // Very fast
    "opencode/glm-4.6",                  // Fast budget
    "opencode/glm-4.7-free",             // Free GLM (Zen)
    "opencode/kimi-k2.5-free",           // Free Kimi (Zen)
    "opencode/big-pickle",               // Ultimate fallback
  ],
  
  /** Ultrabrain - deep reasoning and complex analysis */
  ultrabrain: [
    "anthropic/claude-opus-4-5",         // Best reasoning overall
    "openai/o1-pro",                     // Strong reasoning
    "openai/gpt-5.2",                    // Very strong
    "github-copilot/gpt-5.2-codex",      // Premium copilot reasoning, free
    "opencode/kimi-k2-thinking",         // Great thinking model
    "anthropic/claude-sonnet-4-5",       // Good reasoning
    "github-copilot/claude-sonnet-4.5",  // Good reasoning, free fallback
    "google/gemini-3-pro-preview",       // Strong Gemini
    "opencode/glm-4.7",                  // Capable
    "opencode/big-pickle",               // Ultimate fallback
  ],
  
  /** Parallel Worker - tasks that run in parallel, optimize for load distribution */
  "parallel-worker": [
    "github-copilot/gpt-5-mini",         // Fast + free (0x FREE! optimal for parallel)
    "github-copilot/gpt-4.1",            // Fast + free (0x FREE!)
    "google/gemini-3-flash-preview",     // Fast
    "github-copilot/gemini-3-flash",     // Fast via Copilot (0.33x)
    "github-copilot/grok-code-fast-1",   // Very fast via Copilot (0.25x)
    "google/gemini-2.5-flash",           // Fast
    "github-copilot/claude-haiku-4.5",   // Fast Claude via Copilot (0.33x)
    "anthropic/claude-haiku-4-5",        // Fast Claude
    "opencode/glm-4.7-free",             // Free GLM (Zen)
    "opencode/glm-4.6",                  // Budget
    "opencode/big-pickle",               // Ultimate fallback
  ],
} as const

export type UseCase = keyof typeof USE_CASE_FALLBACKS

// ============================================================================
// Types
// ============================================================================

export interface GlobalOverrideState {
  /** Disabled providers (model selection will fallback to alternatives) */
  disabledProviders: string[]
  
  /** Disabled models per provider from config */
  disabledModels: Record<string, string[]>
  
  /** Maximum tier cap (no models above this tier will be used) */
  maxTierCap: ModelTier | null
  
  /** Auto-disable provider when quota percentage exceeded */
  autoDisableOnQuota: {
    enabled: boolean
    /** Threshold percentage (e.g., 90 = disable at 90% usage) */
    threshold: number
    /** Providers that have been auto-disabled */
    autoDisabledProviders: string[]
  }
  
  /** Preserve percentage of quota for specific use cases */
  preserveForCritical: {
    enabled: boolean
    /** Percentage to preserve (e.g., 20 = reserve 20% for critical) */
    percentage: number
    /** Use cases considered critical */
    criticalUseCases: UseCase[]
  }
  
  /** Emergency mode - use only economy tier */
  emergencyMode: boolean
  
  /** Timestamp of last modification */
  modifiedAt: number | null
  
  /** Source of last modification */
  modifiedBy: "cli" | "webui" | "api" | "auto" | null
}

export interface GlobalOverrideOptions {
  source?: "cli" | "webui" | "api" | "auto"
}

export type CopilotUsageProvider = () => { percentUsed: number; error?: string } | null

export type HybridUsageProvider = () => { exhaustedProviders: string[] } | null

export interface GlobalOverrideManagerOptions {
  copilotUsageProvider?: CopilotUsageProvider
  hybridUsageProvider?: HybridUsageProvider
  circuitBreaker?: CircuitBreaker
}

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_GLOBAL_OVERRIDE_STATE: GlobalOverrideState = {
  disabledProviders: [],
  disabledModels: {},
  maxTierCap: null,
  autoDisableOnQuota: {
    enabled: true,
    threshold: 95,
    autoDisabledProviders: [],
  },
  preserveForCritical: {
    enabled: false,
    percentage: 20,
    criticalUseCases: ["oracle", "orchestrator"],
  },
  emergencyMode: false,
  modifiedAt: null,
  modifiedBy: null,
}

const COPILOT_AUTO_DISABLE_THRESHOLD = 100
const COPILOT_FREE_MODELS = new Set([
  "gpt-5-mini",
  "gpt-4.1",
])

// OpenCode free models - these should be prioritized when available
const OPENCODE_FREE_MODELS = new Set([
  "big-pickle",
  "glm-4.7-free",
  "kimi-k2.5-free",
  "minimax-m2.1-free",
  "gpt-5-nano",
])

// ============================================================================
// Global Override Manager
// ============================================================================

export class GlobalOverrideManager {
  private state: GlobalOverrideState
  private persistPath: string
  private copilotUsageProvider: CopilotUsageProvider
  private hybridUsageProvider: HybridUsageProvider
  private circuitBreaker: CircuitBreaker
  
  constructor(persistPath?: string, options: GlobalOverrideManagerOptions = {}) {
    this.persistPath = persistPath ?? join(
      homedir(),
      ".config",
      "opencode",
      "oh-my-opencode-global-override.json"
    )

    this.copilotUsageProvider = options.copilotUsageProvider ?? (() => {
      try {
        return getCopilotUsageTracker().getData()
      } catch (error) {
        log("[global-override] Failed to read Copilot usage:", error)
        return null
      }
    })

    this.hybridUsageProvider = options.hybridUsageProvider ?? (() => {
      try {
        const tracker = getHybridProviderTracker()
        tracker.checkAndReset()
        return { exhaustedProviders: tracker.getExhaustedProviders() }
      } catch {
        return null
      }
    })

    this.circuitBreaker = options.circuitBreaker ?? new CircuitBreaker()
    
    // Deep copy to avoid mutating DEFAULT_GLOBAL_OVERRIDE_STATE
    this.state = this.loadState() ?? {
      disabledProviders: [...DEFAULT_GLOBAL_OVERRIDE_STATE.disabledProviders],
      disabledModels: { ...DEFAULT_GLOBAL_OVERRIDE_STATE.disabledModels },
      maxTierCap: DEFAULT_GLOBAL_OVERRIDE_STATE.maxTierCap,
      autoDisableOnQuota: {
        ...DEFAULT_GLOBAL_OVERRIDE_STATE.autoDisableOnQuota,
        autoDisabledProviders: [...DEFAULT_GLOBAL_OVERRIDE_STATE.autoDisableOnQuota.autoDisabledProviders],
      },
      preserveForCritical: {
        ...DEFAULT_GLOBAL_OVERRIDE_STATE.preserveForCritical,
        criticalUseCases: [...DEFAULT_GLOBAL_OVERRIDE_STATE.preserveForCritical.criticalUseCases],
      },
      emergencyMode: DEFAULT_GLOBAL_OVERRIDE_STATE.emergencyMode,
      modifiedAt: DEFAULT_GLOBAL_OVERRIDE_STATE.modifiedAt,
      modifiedBy: DEFAULT_GLOBAL_OVERRIDE_STATE.modifiedBy,
    }
    
    log("[global-override] Initialized:", {
      disabledProviders: this.state.disabledProviders,
      maxTierCap: this.state.maxTierCap,
      autoDisableOnQuota: this.state.autoDisableOnQuota.enabled,
      emergencyMode: this.state.emergencyMode,
    })
  }
  
  // --------------------------------------------------------------------------
  // Provider Control
  // --------------------------------------------------------------------------
  
  /**
   * Disable a provider entirely.
   * All model requests for this provider will fallback to alternatives.
   */
  disableProvider(provider: string, options: GlobalOverrideOptions = {}): void {
    const { source = "cli" } = options
    
    if (!this.state.disabledProviders.includes(provider)) {
      this.state.disabledProviders.push(provider)
      this.state.modifiedAt = Date.now()
      this.state.modifiedBy = source
      
      log("[global-override] Provider disabled:", provider)
      
      const logger = getRoutingLogger()
      logger.logInfo("override", `Provider ${provider} DISABLED`, { provider, source })
      
      this.saveState()
    }
  }
  
  /**
   * Enable a previously disabled provider.
   */
  enableProvider(provider: string, options: GlobalOverrideOptions = {}): void {
    const { source = "cli" } = options
    const index = this.state.disabledProviders.indexOf(provider)
    
    if (index !== -1) {
      this.state.disabledProviders.splice(index, 1)
      this.state.modifiedAt = Date.now()
      this.state.modifiedBy = source
      
      // Also remove from auto-disabled if present
      const autoIndex = this.state.autoDisableOnQuota.autoDisabledProviders.indexOf(provider)
      if (autoIndex !== -1) {
        this.state.autoDisableOnQuota.autoDisabledProviders.splice(autoIndex, 1)
      }
      
      log("[global-override] Provider enabled:", provider)
      
      const logger = getRoutingLogger()
      logger.logInfo("override", `Provider ${provider} ENABLED`, { provider, source })
      
      this.saveState()
    }
  }

  /**
   * Set disabled models from config.
   * These models will be filtered out during selection.
   */
  setDisabledModels(disabledModels: Record<string, string[]>): void {
    this.state.disabledModels = disabledModels
    log("[global-override] Disabled models set:", disabledModels)
  }

  /**
   * Check if a specific model is disabled.
   */
  isModelDisabled(provider: string, modelId: string): boolean {
    const disabledForProvider = this.state.disabledModels[provider] ?? []
    // Check both exact match and normalized match (with/without provider prefix)
    const normalizedModelId = modelId.replace(/^[^/]+\//, "") // Remove provider prefix if present
    return disabledForProvider.some(disabled => {
      const normalizedDisabled = disabled.replace(/^[^/]+\//, "")
      return normalizedDisabled === normalizedModelId || disabled === modelId
    })
  }
  
  /**
   * Check if a provider is disabled.
   */
  isProviderDisabled(provider: string): boolean {
    if (this.state.disabledProviders.includes(provider)) {
      return true
    }

    const allowedByCircuit = this.circuitBreaker.shouldAllow(provider)
    if (!allowedByCircuit) {
      return true
    }

    return this.getRuntimeDisabledProviders().includes(provider)
  }
  
  /**
   * Get list of disabled providers.
   */
  getDisabledProviders(): string[] {
    const runtimeDisabled = this.getRuntimeDisabledProviders()
    return Array.from(new Set([...this.state.disabledProviders, ...runtimeDisabled]))
  }

  recordProviderSuccess(provider: string, latencyMs?: number): void {
    this.circuitBreaker.recordSuccess(provider, latencyMs)
  }

  recordProviderFailure(provider: string, error?: unknown, latencyMs?: number): void {
    this.circuitBreaker.recordFailure(provider, error, latencyMs)
  }
  
  // --------------------------------------------------------------------------
  // Tier Cap Control
  // --------------------------------------------------------------------------
  
  /**
   * Set maximum tier cap.
   * No models above this tier will be selected.
   */
  setMaxTierCap(tier: ModelTier | null, options: GlobalOverrideOptions = {}): void {
    const { source = "cli" } = options
    
    this.state.maxTierCap = tier
    this.state.modifiedAt = Date.now()
    this.state.modifiedBy = source
    
    log("[global-override] Max tier cap set:", tier)
    
    const logger = getRoutingLogger()
    if (tier) {
      logger.logInfo("override", `Max tier cap set to ${tier.toUpperCase()}`, { tier, source })
    } else {
      logger.logInfo("override", "Max tier cap removed", { source })
    }
    
    this.saveState()
  }
  
  /**
   * Get current max tier cap.
   */
  getMaxTierCap(): ModelTier | null {
    return this.state.maxTierCap
  }
  
  // --------------------------------------------------------------------------
  // Auto-Disable on Quota
  // --------------------------------------------------------------------------
  
  /**
   * Configure auto-disable on quota exceeded.
   */
  setAutoDisableOnQuota(enabled: boolean, threshold?: number, options: GlobalOverrideOptions = {}): void {
    const { source = "cli" } = options
    
    this.state.autoDisableOnQuota.enabled = enabled
    if (threshold !== undefined) {
      this.state.autoDisableOnQuota.threshold = threshold
    }
    this.state.modifiedAt = Date.now()
    this.state.modifiedBy = source
    
    log("[global-override] Auto-disable on quota:", {
      enabled,
      threshold: this.state.autoDisableOnQuota.threshold,
    })
    
    this.saveState()
  }
  
  /**
   * Check quota and auto-disable provider if threshold exceeded.
   * Call this when usage is updated.
   */
  checkQuotaAndAutoDisable(provider: string, usagePercent: number): boolean {
    if (!this.state.autoDisableOnQuota.enabled) {
      return false
    }
    
    if (usagePercent >= this.state.autoDisableOnQuota.threshold) {
      if (!this.state.disabledProviders.includes(provider)) {
        this.state.disabledProviders.push(provider)
        this.state.autoDisableOnQuota.autoDisabledProviders.push(provider)
        this.state.modifiedAt = Date.now()
        this.state.modifiedBy = "auto"
        
        log("[global-override] Provider auto-disabled due to quota:", {
          provider,
          usagePercent,
          threshold: this.state.autoDisableOnQuota.threshold,
        })
        
        const logger = getRoutingLogger()
        logger.logWarning(
          "budget_alert",
          `Provider ${provider} AUTO-DISABLED: ${usagePercent.toFixed(0)}% usage exceeded ${this.state.autoDisableOnQuota.threshold}% threshold`,
          { provider, usagePercent, threshold: this.state.autoDisableOnQuota.threshold }
        )
        
        this.saveState()
        return true
      }
    }
    
    return false
  }
  
  /**
   * Check if a provider was auto-disabled (vs manually disabled).
   */
  wasAutoDisabled(provider: string): boolean {
    return this.state.autoDisableOnQuota.autoDisabledProviders.includes(provider)
  }
  
  // --------------------------------------------------------------------------
  // Emergency Mode
  // --------------------------------------------------------------------------
  
  /**
   * Enable emergency mode - only economy tier models allowed.
   */
  setEmergencyMode(enabled: boolean, options: GlobalOverrideOptions = {}): void {
    const { source = "cli" } = options
    
    this.state.emergencyMode = enabled
    this.state.modifiedAt = Date.now()
    this.state.modifiedBy = source
    
    log("[global-override] Emergency mode:", enabled)
    
    const logger = getRoutingLogger()
    if (enabled) {
      logger.logWarning("override", "EMERGENCY MODE ENABLED - Economy tier only", { source })
    } else {
      logger.logInfo("override", "Emergency mode disabled", { source })
    }
    
    this.saveState()
  }
  
  /**
   * Check if emergency mode is active.
   */
  isEmergencyMode(): boolean {
    return this.state.emergencyMode
  }
  
  // --------------------------------------------------------------------------
  // Critical Preservation
  // --------------------------------------------------------------------------
  
  /**
   * Configure quota preservation for critical use cases.
   */
  setPreserveForCritical(
    enabled: boolean,
    percentage?: number,
    criticalUseCases?: UseCase[],
    options: GlobalOverrideOptions = {}
  ): void {
    const { source = "cli" } = options
    
    this.state.preserveForCritical.enabled = enabled
    if (percentage !== undefined) {
      this.state.preserveForCritical.percentage = percentage
    }
    if (criticalUseCases !== undefined) {
      this.state.preserveForCritical.criticalUseCases = criticalUseCases
    }
    this.state.modifiedAt = Date.now()
    this.state.modifiedBy = source
    
    log("[global-override] Preserve for critical:", this.state.preserveForCritical)
    
    this.saveState()
  }
  
  /**
   * Check if a use case is considered critical.
   */
  isCriticalUseCase(useCase: UseCase): boolean {
    return this.state.preserveForCritical.criticalUseCases.includes(useCase)
  }
  
  /**
   * Check if premium models should be reserved for critical use cases.
   * Returns true if non-critical use case and quota is running low.
   */
  shouldReservePremium(useCase: UseCase, usagePercent: number): boolean {
    if (!this.state.preserveForCritical.enabled) {
      return false
    }
    
    const reserveThreshold = 100 - this.state.preserveForCritical.percentage
    return usagePercent >= reserveThreshold && !this.isCriticalUseCase(useCase)
  }
  
  // --------------------------------------------------------------------------
  // Model Fallback Selection
  // --------------------------------------------------------------------------
  
  /**
   * Get the best available model for a use case, respecting global overrides.
   * 
   * Uses Weighted Fair-Share balancing to distribute load across providers:
   * - Subscription providers (Claude Max, Copilot) get 2.0x priority
   * - API budget providers (OpenCode Zen) get 0.5x priority
   * - Providers with lower usage get higher priority
   * - Providers resetting soon get a 1.3x bonus
   * 
   * @param useCase The use case (librarian, explorer, oracle, etc.)
   * @param preferredModel Optional preferred model to try first
   * @param availableProviders List of providers that are authenticated
   * @param usagePercentByProvider Map of provider -> current usage percentage (0-100)
   * @param quotaTargets Provider-specific quota targets from config
   * @param daysUntilResetByProvider Optional map of provider -> days until quota resets
   * @returns The best available model string ("provider/model")
   */
  getBestAvailableModel(
    useCase: UseCase,
    preferredModel?: string,
    availableProviders: string[] = [],
    usagePercentByProvider: Record<string, number> = {},
    quotaTargets: Record<string, number> = {},
    daysUntilResetByProvider?: Record<string, number>,
    velocityByProvider?: Record<string, number>
  ): string {
    const fallbackList = USE_CASE_FALLBACKS[useCase]
    
    // Calculate overall usage for premium reservation check
    const overallUsage = this.calculateOverallUsage(usagePercentByProvider)
    
    // Check if we should reserve premium models for critical use cases
    const shouldBlockPremium = this.shouldReservePremium(useCase, overallUsage)
    
    // Try preferred model first if provided and valid
    if (preferredModel) {
      const [provider] = preferredModel.split("/")
      if (this.isModelAllowedForUseCase(
        preferredModel,
        availableProviders,
        usagePercentByProvider,
        quotaTargets,
        shouldBlockPremium
      )) {
        return preferredModel
      }
    }
    
    // Filter to allowed models
    const allowedModels = fallbackList.filter(model =>
      this.isModelAllowedForUseCase(
        model,
        availableProviders,
        usagePercentByProvider,
        quotaTargets,
        shouldBlockPremium
      )
    )
    
    // Edge case: no allowed models
    if (allowedModels.length === 0) {
      log("[global-override] No allowed models, falling back to big-pickle")
      return "opencode/big-pickle"
    }
    
    // Edge case: only one allowed model
    if (allowedModels.length === 1) {
      return allowedModels[0]
    }
    
    // Use weighted selection for load balancing
    const calculator = getWeightCalculator()
    const candidates = calculator.buildCandidates(
      allowedModels,
      usagePercentByProvider,
      daysUntilResetByProvider,
      velocityByProvider
    )
    
    const selected = calculator.selectBestProvider(candidates)
    
    if (selected) {
      // Log the routing decision with weights for debugging
      const logger = getRoutingLogger()
      const topCandidates = candidates
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map(c => `${c.model}(w=${c.weight.toFixed(2)},u=${c.usagePercent.toFixed(0)}%)`)
      
      logger.logDebug(
        "weighted_selection",
        `[${useCase}] Selected ${selected.model} (weight=${selected.weight.toFixed(2)})`,
        {
          timestamp: new Date().toISOString(),
          use_case: useCase,
          candidates: candidates.map(c => c.model),
          weights: Object.fromEntries(candidates.map(c => [c.model, c.weight])),
          selected: selected.model,
          reason: "highest weight",
          usagePercent: selected.usagePercent,
          topCandidates,
          totalCandidates: candidates.length,
        }
      )
      
      return selected.model
    }
    
    // Fallback if weighted selection fails (all weights 0)
    log("[global-override] All weights 0, falling back to first allowed model")
    return allowedModels[0]
  }
  
  /**
   * Calculate overall usage percentage across all providers.
   * Uses the maximum usage among all providers.
   */
  private calculateOverallUsage(usagePercentByProvider: Record<string, number>): number {
    const values = Object.values(usagePercentByProvider)
    return values.length > 0 ? Math.max(...values) : 0
  }
  
  /**
   * Check if a model is allowed for a specific use case, considering quota targets.
   */
  private isModelAllowedForUseCase(
    model: string,
    availableProviders: string[],
    usagePercentByProvider: Record<string, number>,
    quotaTargets: Record<string, number>,
    shouldBlockPremium: boolean
  ): boolean {
    // First check basic allowance
    if (!this.isModelAllowed(model, availableProviders)) {
      return false
    }
    
    const [provider, modelId] = model.split("/")
    
    // Check provider-specific quota target
    const providerUsage = usagePercentByProvider[provider] ?? 0
    const providerQuotaTarget = quotaTargets[provider]
    
    if (providerQuotaTarget !== undefined && providerUsage >= providerQuotaTarget) {
      log("[global-override] Model blocked by quota target:", {
        model,
        provider,
        usage: providerUsage.toFixed(1),
        quotaTarget: providerQuotaTarget,
      })
      return false
    }
    
    // Check if premium models are reserved for critical use cases
    if (shouldBlockPremium && this.isPremiumModel(modelId)) {
      log("[global-override] Premium model reserved for critical use cases:", { model })
      return false
    }
    
    return true
  }
  
  /**
   * Check if a model is a premium tier model.
   */
  private isPremiumModel(modelId: string): boolean {
    const premiumPatterns = ["opus", "o3", "gpt-5.2-codex", "gpt-5.2-pro", "gemini-3-pro"]
    const lowerModel = modelId.toLowerCase()
    return premiumPatterns.some(p => lowerModel.includes(p))
  }

  private isCopilotFreeModel(modelId: string): boolean {
    return COPILOT_FREE_MODELS.has(modelId.toLowerCase())
  }

  private isOpencodeFreeModel(modelId: string): boolean {
    return OPENCODE_FREE_MODELS.has(modelId.toLowerCase())
  }

  /**
   * Check if a model is a free model (Copilot or OpenCode free).
   * Free models should be prioritized and allowed even when provider is at quota.
   */
  isFreeModel(model: string): boolean {
    const [provider, modelId] = model.split("/")
    if (provider === "github-copilot") {
      return this.isCopilotFreeModel(modelId)
    }
    if (provider === "opencode") {
      return this.isOpencodeFreeModel(modelId)
    }
    return false
  }
  
  /**
   * Check if a model is allowed given current overrides.
   */
  isModelAllowed(model: string, availableProviders: string[] = []): boolean {
    const [provider, modelId] = model.split("/")
    
    // Check if provider is disabled
    if (this.state.disabledProviders.includes(provider)) {
      return false
    }

    const isRuntimeDisabled = this.getRuntimeDisabledProviders().includes(provider)
    if (isRuntimeDisabled) {
      // Allow free models even when provider is runtime-disabled
      const isAllowedFree = (provider === "github-copilot" && this.isCopilotFreeModel(modelId)) ||
                            (provider === "opencode" && this.isOpencodeFreeModel(modelId))
      if (!isAllowedFree) {
        return false
      }
    }

    // Check if this is a BYOK model whose underlying provider's free tier is exhausted
    if (provider === "opencode" && this.isOpencodeFreeModel(modelId)) {
      // Free OpenCode models bypass BYOK exhaustion check
      // gpt-5-nano is free on Zen even though it's an OpenAI model
      // Don't block it when OpenAI free tier is exhausted
    } else if (provider === "opencode") {
      const underlyingProvider = detectUnderlyingProvider(model)
      if (underlyingProvider) {
        // This is a BYOK model - check if underlying provider exhausted
        const hybridData = this.hybridUsageProvider()
        if (hybridData?.exhaustedProviders.includes(underlyingProvider)) {
          log("[global-override] BYOK model blocked - underlying provider free tier exhausted", {
            model, underlyingProvider
          })
          return false
        }
      }
      // Native OpenCode models (null underlyingProvider) always pass this check
    }

    // Check if provider is available (opencode is always available)
    if (provider !== "opencode" && !availableProviders.includes(provider)) {
      return false
    }

    // Check if specific model is disabled via config
    if (this.isModelDisabled(provider, modelId)) {
      return false
    }

    // Check if model has failed previously (runtime failure cache)
    if (isModelFailedByProvider(provider, modelId)) {
      log("[global-override] Model skipped due to previous failure", { provider, modelId })
      return false
    }

    // Check Zen API model availability (TIER 2: API-based detection)
    // Only applies to opencode/opencode-zen providers when we have cache data
    if ((provider === "opencode" || provider === "opencode-zen") && hasZenCacheData()) {
      if (!isZenModelInCache(modelId)) {
        log("[global-override] Model skipped - not available in Zen API", { provider, modelId })
        return false
      }
    }
    
    // Check emergency mode - only economy tier allowed
    if (this.state.emergencyMode) {
      // Simple tier check based on model name patterns
      const isEconomy = this.isEconomyTierModel(modelId)
      if (!isEconomy) {
        return false
      }
    }
    
    // Check max tier cap
    if (this.state.maxTierCap) {
      const isUnderCap = this.isModelUnderTierCap(modelId, this.state.maxTierCap)
      if (!isUnderCap) {
        return false
      }
    }
    
    return true
  }
  
  /**
   * Simple check if model is economy tier (based on name patterns).
   */
  private isEconomyTierModel(modelId: string): boolean {
    const economyPatterns = [
      "nano", "lite", "flash", "mini", "haiku",
      "glm-4.6", "qwen3-coder", "big-pickle",
    ]
    const lowerModel = modelId.toLowerCase()
    return economyPatterns.some(p => lowerModel.includes(p))
  }
  
  /**
   * Check if model is at or below the tier cap.
   */
  private isModelUnderTierCap(modelId: string, cap: ModelTier): boolean {
    const tierOrder: ModelTier[] = ["premium", "standard", "budget", "economy"]
    const capIndex = tierOrder.indexOf(cap)
    
    // Premium models
    const premiumPatterns = ["opus", "o3", "gpt-5.2-codex", "gpt-5.2-pro", "gemini-3-pro"]
    // Standard models
    const standardPatterns = ["sonnet", "gpt-5.2", "gpt-5.1", "o1", "gemini-2.5-pro", "glm-4.7", "kimi-k2.5"]
    // Budget models
    const budgetPatterns = ["haiku", "flash", "glm-4.7-free", "kimi-k2-thinking", "mini"]
    // Economy is everything else
    
    const lowerModel = modelId.toLowerCase()
    
    let modelTierIndex: number
    if (premiumPatterns.some(p => lowerModel.includes(p))) {
      modelTierIndex = 0 // premium
    } else if (standardPatterns.some(p => lowerModel.includes(p))) {
      modelTierIndex = 1 // standard
    } else if (budgetPatterns.some(p => lowerModel.includes(p))) {
      modelTierIndex = 2 // budget
    } else {
      modelTierIndex = 3 // economy
    }
    
    return modelTierIndex >= capIndex
  }
  
  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------
  
  /**
   * Get full state (read-only).
   */
  getState(): Readonly<GlobalOverrideState> {
    return { ...this.state }
  }
  
  /**
   * Get summary for API/UI.
   */
  getSummary(): {
    disabledProviders: string[]
    autoDisabledProviders: string[]
    maxTierCap: ModelTier | null
    autoDisableOnQuota: { enabled: boolean; threshold: number }
    preserveForCritical: { enabled: boolean; percentage: number; useCases: UseCase[] }
    emergencyMode: boolean
    modifiedBy: string | null
  } {
    const runtimeDisabled = this.getRuntimeDisabledProviders()
    return {
      disabledProviders: Array.from(new Set([...this.state.disabledProviders, ...runtimeDisabled])),
      autoDisabledProviders: this.state.autoDisableOnQuota.autoDisabledProviders,
      maxTierCap: this.state.maxTierCap,
      autoDisableOnQuota: {
        enabled: this.state.autoDisableOnQuota.enabled,
        threshold: this.state.autoDisableOnQuota.threshold,
      },
      preserveForCritical: {
        enabled: this.state.preserveForCritical.enabled,
        percentage: this.state.preserveForCritical.percentage,
        useCases: this.state.preserveForCritical.criticalUseCases,
      },
      emergencyMode: this.state.emergencyMode,
      modifiedBy: this.state.modifiedBy,
    }
  }

  private getRuntimeDisabledProviders(): string[] {
    const data = this.copilotUsageProvider()
    if (!data || data.error) {
      return []
    }

    if (data.percentUsed > COPILOT_AUTO_DISABLE_THRESHOLD) {
      return ["github-copilot"]
    }

    return []
  }
  
  /**
   * Clear all overrides.
   */
  clearAll(options: GlobalOverrideOptions = {}): void {
    const { source = "cli" } = options
    
    // Deep copy to avoid mutating DEFAULT_GLOBAL_OVERRIDE_STATE
    this.state = {
      disabledProviders: [...DEFAULT_GLOBAL_OVERRIDE_STATE.disabledProviders],
      disabledModels: { ...DEFAULT_GLOBAL_OVERRIDE_STATE.disabledModels },
      maxTierCap: DEFAULT_GLOBAL_OVERRIDE_STATE.maxTierCap,
      autoDisableOnQuota: {
        ...DEFAULT_GLOBAL_OVERRIDE_STATE.autoDisableOnQuota,
        autoDisabledProviders: [...DEFAULT_GLOBAL_OVERRIDE_STATE.autoDisableOnQuota.autoDisabledProviders],
      },
      preserveForCritical: {
        ...DEFAULT_GLOBAL_OVERRIDE_STATE.preserveForCritical,
        criticalUseCases: [...DEFAULT_GLOBAL_OVERRIDE_STATE.preserveForCritical.criticalUseCases],
      },
      emergencyMode: DEFAULT_GLOBAL_OVERRIDE_STATE.emergencyMode,
      modifiedAt: Date.now(),
      modifiedBy: source,
    }
    
    log("[global-override] All overrides cleared")
    
    const logger = getRoutingLogger()
    logger.logInfo("override", "All global overrides cleared", { source })
    
    this.saveState()
  }
  
  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------
  
  private loadState(): GlobalOverrideState | null {
    try {
      const fs = require("fs")
      if (fs.existsSync(this.persistPath)) {
        const content = fs.readFileSync(this.persistPath, "utf-8")
        const data = JSON.parse(content)
        
        // Validate and merge with defaults
        return {
          disabledProviders: Array.isArray(data.disabledProviders) ? data.disabledProviders : [],
          disabledModels: data.disabledModels ?? {},
          maxTierCap: data.maxTierCap ?? null,
          autoDisableOnQuota: {
            enabled: data.autoDisableOnQuota?.enabled ?? true,
            threshold: data.autoDisableOnQuota?.threshold ?? 95,
            autoDisabledProviders: data.autoDisableOnQuota?.autoDisabledProviders ?? [],
          },
          preserveForCritical: {
            enabled: data.preserveForCritical?.enabled ?? false,
            percentage: data.preserveForCritical?.percentage ?? 20,
            criticalUseCases: data.preserveForCritical?.criticalUseCases ?? ["oracle", "orchestrator"],
          },
          emergencyMode: data.emergencyMode ?? false,
          modifiedAt: data.modifiedAt ?? null,
          modifiedBy: data.modifiedBy ?? null,
        }
      }
    } catch (error) {
      log("[global-override] Failed to load state:", error)
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
      log("[global-override] Failed to save state:", error)
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalOverrideManagerInstance: GlobalOverrideManager | null = null

/**
 * Get the global override manager instance.
 */
export function getGlobalOverrideManager(options?: GlobalOverrideManagerOptions): GlobalOverrideManager {
  if (!globalOverrideManagerInstance) {
    globalOverrideManagerInstance = new GlobalOverrideManager(undefined, options)
    return globalOverrideManagerInstance
  }

  if (options?.circuitBreaker || options?.copilotUsageProvider) {
    return new GlobalOverrideManager(undefined, options)
  }

  return globalOverrideManagerInstance
}

/**
 * Reset the global override manager (for testing).
 */
export function resetGlobalOverrideManager(): void {
  globalOverrideManagerInstance = null
}
