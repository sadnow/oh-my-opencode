/**
 * Budget Orchestrator Module
 * Budget-aware model orchestration with automatic tier selection
 * Now with adaptive learning and smart upgrade/downgrade decisions
 */

import { log } from "../../shared"
import type { BudgetConfig, ModelTier } from "../../config/schema"
import type {
  BudgetState,
  BudgetOrchestratorConfig,
  ModelRef,
  DowngradeResult,
  TierChangeResult,
  TierChangeDirection,
  AdaptiveBudgetSummary,
} from "./types"
import type { UsageTracker, ProviderUsageSummary } from "../usage-tracker"
import {
  calculateBudgetState,
  selectTier,
  shouldDowngrade,
  getDowngradedModel,
  getRecommendedModels,
  getBudgetStatusMessage,
} from "./algorithm"
import { formatModelRef, parseModelRef, getModelTier, TIER_ORDER, findUpgradedModel } from "./tiers"
import { AdaptiveBudgetManager, type AdaptiveBudgetConfig } from "./adaptive-budget"
import { join } from "path"
import { homedir } from "os"

export class BudgetOrchestrator {
  private config: BudgetOrchestratorConfig
  private usageTracker: UsageTracker | null
  private budgetStateCache: Map<string, { state: BudgetState; timestamp: number }>
  private availableProviders: string[]

  // Adaptive budget managers per provider
  private adaptiveManagers: Map<string, AdaptiveBudgetManager>

  // Track current session for learning
  private currentSessionStart: number | null = null
  private currentSessionCost: number = 0
  private currentSessionTier: ModelTier = "standard"

  // Cache timeout in milliseconds (5 minutes)
  private readonly CACHE_TIMEOUT_MS = 5 * 60 * 1000

  constructor(
    config: BudgetConfig | undefined,
    usageTracker: UsageTracker | null,
    availableProviders: string[] = []
  ) {
    this.usageTracker = usageTracker
    this.budgetStateCache = new Map()
    this.availableProviders = availableProviders
    this.adaptiveManagers = new Map()

    this.config = {
      enabled: config?.enabled ?? false,
      targetPercentage: config?.target_percentage ?? 0.7,
      providerBudgets: config?.provider_budgets ?? {},
      autoDowngrade: config?.auto_downgrade ?? true,
      minTier: config?.min_tier ?? "budget",
      dailyTarget: config?.daily_target,
    }

    // Initialize adaptive budget managers for each provider
    for (const [provider, budget] of Object.entries(this.config.providerBudgets)) {
      const periodHours = this.getProviderPeriodHours(provider)
      const persistPath = join(
        homedir(),
        ".config",
        "opencode",
        `oh-my-opencode-adaptive-${provider}.json`
      )

      const adaptiveConfig: Partial<AdaptiveBudgetConfig> = {
        totalBudget: budget,
        periodHours,
        minTier: this.config.minTier,
        conservativeSpendingFactor: this.config.targetPercentage,
      }

      this.adaptiveManagers.set(provider, new AdaptiveBudgetManager(adaptiveConfig, persistPath))
    }

    log("[budget-orchestrator] Initialized with adaptive learning:", {
      enabled: this.config.enabled,
      providers: Object.keys(this.config.providerBudgets),
      adaptiveManagerCount: this.adaptiveManagers.size,
    })
  }

  /**
   * Get period hours for a provider (weekly = 168, monthly = ~720)
   */
  private getProviderPeriodHours(provider: string): number {
    // Anthropic is weekly, others are monthly
    if (provider === "anthropic") {
      return 168 // 7 days
    }
    return 720 // ~30 days
  }

  /**
   * Record the start of a session/activity.
   * Call this when a task or conversation begins.
   */
  recordSessionStart(): void {
    this.currentSessionStart = Date.now()
    this.currentSessionCost = 0

    // Notify all adaptive managers
    for (const manager of this.adaptiveManagers.values()) {
      manager.recordSessionStart()
    }

    log("[budget-orchestrator] Session started")
  }

  /**
   * Record usage during a session.
   * Call this after each API call to track costs.
   */
  recordUsageDuringSession(cost: number, tier: ModelTier): void {
    this.currentSessionCost += cost
    this.currentSessionTier = tier
  }

  /**
   * Record the end of a session.
   * Call this when a task or conversation ends.
   */
  recordSessionEnd(provider: string): void {
    if (this.currentSessionStart === null) return

    const durationMinutes = (Date.now() - this.currentSessionStart) / (1000 * 60)
    const manager = this.adaptiveManagers.get(provider)

    if (manager) {
      manager.recordSession(
        this.currentSessionCost,
        durationMinutes,
        this.currentSessionTier
      )
    }

    log("[budget-orchestrator] Session ended:", {
      provider,
      cost: this.currentSessionCost.toFixed(4),
      durationMinutes: durationMinutes.toFixed(1),
      tier: this.currentSessionTier,
    })

    this.currentSessionStart = null
    this.currentSessionCost = 0
  }

  /**
   * Get adaptive budget summary for a provider.
   */
  getAdaptiveSummary(provider: string): AdaptiveBudgetSummary | null {
    const manager = this.adaptiveManagers.get(provider)
    if (!manager) return null

    const budgetState = this.getBudgetState(provider)
    if (!budgetState) return null

    const summary = manager.getSummary(budgetState.used, budgetState.daysRemaining)

    // Determine if we can afford an upgrade or should downgrade
    const currentTierIndex = TIER_ORDER.indexOf(this.currentSessionTier)
    const recommendedTierIndex = TIER_ORDER.indexOf(summary.recommendedTier)

    return {
      ...summary,
      canAffordUpgrade: recommendedTierIndex < currentTierIndex,
      shouldDowngrade: recommendedTierIndex > currentTierIndex,
    }
  }

  /**
   * Check if budget orchestration is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled && this.usageTracker !== null
  }

  /**
   * Get budget state for a provider.
   */
  getBudgetState(provider: string): BudgetState | null {
    if (!this.isEnabled() || !this.usageTracker) {
      return null
    }

    const budget = this.config.providerBudgets[provider]
    if (!budget) {
      return null
    }

    // Check cache
    const cached = this.budgetStateCache.get(provider)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TIMEOUT_MS) {
      return cached.state
    }

    // Calculate fresh state
    const usage = this.usageTracker.getProviderSummary(provider)
    const state = calculateBudgetState(usage, budget, this.config)

    // Update cache
    this.budgetStateCache.set(provider, { state, timestamp: Date.now() })

    return state
  }

  /**
   * Get budget states for all configured providers.
   */
  getAllBudgetStates(): Record<string, BudgetState> {
    const states: Record<string, BudgetState> = {}

    for (const provider of Object.keys(this.config.providerBudgets)) {
      const state = this.getBudgetState(provider)
      if (state) {
        states[provider] = state
      }
    }

    return states
  }

  /**
   * Check if a model should be downgraded.
   */
  shouldDowngradeModel(model: ModelRef | string): boolean {
    if (!this.isEnabled()) {
      return false
    }

    const modelRef = typeof model === "string" ? parseModelRef(model) : model
    const budgetState = this.getBudgetState(modelRef.providerID)

    if (!budgetState) {
      return false
    }

    return shouldDowngrade(modelRef, budgetState, this.config)
  }

  /**
   * Get a downgraded model if budget constraints require it.
   */
  getDowngradedModel(model: ModelRef | string): DowngradeResult {
    const modelRef = typeof model === "string" ? parseModelRef(model) : model

    if (!this.isEnabled()) {
      const tier = getModelTier(modelRef) ?? "standard"
      return {
        original: modelRef,
        downgraded: null,
        reason: "Budget orchestration not enabled",
        tier,
      }
    }

    const budgetState = this.getBudgetState(modelRef.providerID)
    if (!budgetState) {
      const tier = getModelTier(modelRef) ?? "standard"
      return {
        original: modelRef,
        downgraded: null,
        reason: `No budget configured for provider ${modelRef.providerID}`,
        tier,
      }
    }

    return getDowngradedModel(modelRef, budgetState, this.config, this.availableProviders)
  }

  /**
   * SMART TIER CHANGE: Get recommended model change (upgrade OR downgrade).
   *
   * This uses adaptive budget intelligence to make smart decisions:
   * - Considers accumulated credits from idle time
   * - Learns from spending patterns
   * - Smoothly transitions between tiers (no rapid oscillation)
   * - Can UPGRADE when budget headroom allows
   * - Can DOWNGRADE when overspending predicted
   */
  getSmartTierChange(model: ModelRef | string): TierChangeResult {
    const modelRef = typeof model === "string" ? parseModelRef(model) : model
    const originalTier = getModelTier(modelRef) ?? "standard"

    if (!this.isEnabled()) {
      return {
        original: modelRef,
        newModel: null,
        direction: "none",
        reason: "Budget orchestration not enabled",
        originalTier,
        targetTier: originalTier,
        confidence: 1.0,
      }
    }

    const budgetState = this.getBudgetState(modelRef.providerID)
    if (!budgetState) {
      return {
        original: modelRef,
        newModel: null,
        direction: "none",
        reason: `No budget configured for provider ${modelRef.providerID}`,
        originalTier,
        targetTier: originalTier,
        confidence: 1.0,
      }
    }

    // Get adaptive budget recommendation
    const adaptiveManager = this.adaptiveManagers.get(modelRef.providerID)
    let targetTier: ModelTier
    let confidence: number

    if (adaptiveManager) {
      const summary = adaptiveManager.getSummary(budgetState.used, budgetState.daysRemaining)
      targetTier = summary.recommendedTier
      confidence = summary.predictionAccuracy

      log("[budget-orchestrator] Adaptive analysis:", {
        provider: modelRef.providerID,
        hourlyAllowance: summary.hourlyAllowance.toFixed(4),
        accumulatedCredits: summary.accumulatedCredits.toFixed(4),
        budgetHeadroom: summary.budgetHeadroom.toFixed(4),
        maxBurstSpend: summary.maxBurstSpend.toFixed(4),
        recommendedTier: summary.recommendedTier,
        learningProgress: (summary.learningProgress * 100).toFixed(0) + "%",
      })
    } else {
      // Fall back to simple tier selection
      targetTier = selectTier(budgetState, this.config)
      confidence = 0.5
    }

    const originalTierIndex = TIER_ORDER.indexOf(originalTier)
    const targetTierIndex = TIER_ORDER.indexOf(targetTier)

    // No change needed
    if (originalTierIndex === targetTierIndex) {
      return {
        original: modelRef,
        newModel: null,
        direction: "none",
        reason: `Current tier (${originalTier}) matches recommended tier`,
        originalTier,
        targetTier,
        confidence,
      }
    }

    // UPGRADE: Current tier is lower (cheaper) than recommended
    if (originalTierIndex > targetTierIndex) {
      const upgradedModel = findUpgradedModel(modelRef, targetTier, this.availableProviders)

      if (upgradedModel) {
        const reason = adaptiveManager
          ? `Budget headroom allows upgrade: ${budgetState.remaining.toFixed(2)} remaining, ` +
            `accumulated credits: ${adaptiveManager.getSummary(budgetState.used, budgetState.daysRemaining).accumulatedCredits.toFixed(2)}`
          : `Budget headroom allows upgrade to ${targetTier} tier`

        log("[budget-orchestrator] UPGRADE:", {
          from: formatModelRef(modelRef),
          to: formatModelRef(upgradedModel),
          reason,
        })

        return {
          original: modelRef,
          newModel: upgradedModel,
          direction: "upgrade",
          reason,
          originalTier,
          targetTier,
          confidence,
        }
      }
    }

    // DOWNGRADE: Current tier is higher (more expensive) than recommended
    if (originalTierIndex < targetTierIndex) {
      const result = getDowngradedModel(modelRef, budgetState, this.config, this.availableProviders)

      if (result.downgraded) {
        log("[budget-orchestrator] DOWNGRADE:", {
          from: formatModelRef(modelRef),
          to: formatModelRef(result.downgraded),
          reason: result.reason,
        })

        return {
          original: modelRef,
          newModel: result.downgraded,
          direction: "downgrade",
          reason: result.reason,
          originalTier,
          targetTier: result.tier,
          confidence,
        }
      }
    }

    // No suitable model found for tier change
    return {
      original: modelRef,
      newModel: null,
      direction: "none",
      reason: `No suitable model found for tier change to ${targetTier}`,
      originalTier,
      targetTier,
      confidence,
    }
  }

  /**
   * Get the recommended tier based on all budget states.
   */
  getRecommendedTier(): ModelTier {
    if (!this.isEnabled()) {
      return "standard"
    }

    const states = this.getAllBudgetStates()
    if (Object.keys(states).length === 0) {
      return "standard"
    }

    // Find the most constrained tier
    let lowestTier: ModelTier = "premium"
    const tierOrder: ModelTier[] = ["premium", "standard", "budget", "economy"]

    for (const state of Object.values(states)) {
      const tier = selectTier(state, this.config)
      const tierIndex = tierOrder.indexOf(tier)
      const lowestIndex = tierOrder.indexOf(lowestTier)
      if (tierIndex > lowestIndex) {
        lowestTier = tier
      }
    }

    return lowestTier
  }

  /**
   * Get recommended models for different task types.
   */
  getRecommendedModels(): Record<string, ModelRef> {
    if (!this.isEnabled()) {
      return {
        orchestrator: { providerID: "anthropic", modelID: "claude-opus-4-5" },
        implementation: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
        quick: { providerID: "anthropic", modelID: "claude-haiku-4-5" },
      }
    }

    const states = this.getAllBudgetStates()
    return getRecommendedModels(states, this.config, this.availableProviders)
  }

  /**
   * Get budget status messages for all providers.
   */
  getBudgetStatusMessages(): Record<string, string> {
    const messages: Record<string, string> = {}
    const states = this.getAllBudgetStates()

    for (const [provider, state] of Object.entries(states)) {
      messages[provider] = getBudgetStatusMessage(state)
    }

    return messages
  }

  /**
   * Update available providers list.
   */
  setAvailableProviders(providers: string[]): void {
    this.availableProviders = providers
  }

  /**
   * Clear the budget state cache.
   */
  clearCache(): void {
    this.budgetStateCache.clear()
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<BudgetOrchestratorConfig>): void {
    this.config = { ...this.config, ...config }
    this.clearCache()
    log("[budget-orchestrator] Config updated:", this.config)
  }
}

// Re-export types and utilities
export type {
  BudgetState,
  BudgetOrchestratorConfig,
  ModelRef,
  DowngradeResult,
  TierChangeResult,
  TierChangeDirection,
  AdaptiveBudgetSummary,
  SpendTrend,
  TierConfig,
} from "./types"

export {
  calculateBudgetState,
  selectTier,
  shouldDowngrade,
  getDowngradedModel,
  getRecommendedModels,
  getBudgetStatusMessage,
  estimateRemainingDuration,
} from "./algorithm"

export {
  AdaptiveBudgetManager,
  type AdaptiveBudgetConfig,
  type AdaptiveBudgetState,
} from "./adaptive-budget"

export {
  MODEL_TIERS,
  TIER_ORDER,
  getModelTier,
  getModelsInTier,
  getNextLowerTier,
  getNextHigherTier,
  getBestModelInTier,
  findDowngradedModel,
  findUpgradedModel,
  isMoreExpensive,
  parseModelRef,
  formatModelRef,
} from "./tiers"
