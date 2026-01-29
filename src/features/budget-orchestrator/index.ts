/**
 * Budget Orchestrator Module
 * Budget-aware model orchestration with automatic tier selection
 * Now with adaptive learning and smart upgrade/downgrade decisions
 */

import { log } from "../../shared"
import type { BudgetConfig, ModelTier, LearningMode, AdaptiveConfig, QuotaTargets } from "../../config/schema"
import { LEARNING_MODE_PRESETS } from "../../cli/wizard/generator"
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
import type { ClaudeMaxUsageTracker } from "../claude-max-usage"
import type { CopilotUsageTracker } from "../copilot-usage"
import {
  calculateBudgetState,
  selectTier,
  shouldDowngrade,
  getDowngradedModel,
  getRecommendedModels,
  getBudgetStatusMessage,
} from "./algorithm"
import { formatModelRef, parseModelRef, getModelTier, TIER_ORDER, findUpgradedModel, findDowngradedModel } from "./tiers"
import { AdaptiveBudgetManager, type AdaptiveBudgetConfig } from "./adaptive-budget"
import { BudgetOverrideManager, getOverrideManager } from "./override"
import { GlobalOverrideManager, getGlobalOverrideManager, type UseCase } from "./global-override"
import { getRoutingLogger } from "./routing-logger"
import { join } from "path"
import { homedir } from "os"

export class BudgetOrchestrator {
  private config: BudgetOrchestratorConfig
  private usageTracker: UsageTracker | null
  private budgetStateCache: Map<string, { state: BudgetState; timestamp: number }>
  private availableProviders: string[]

  // Adaptive budget managers per provider
  private adaptiveManagers: Map<string, AdaptiveBudgetManager>

  // Override manager for manual tier control
  private overrideManager: BudgetOverrideManager
  
  // Global override manager for provider-level control
  private globalOverrideManager: GlobalOverrideManager

  // Track current session for learning
  private currentSessionStart: number | null = null
  private currentSessionCost: number = 0
  private currentSessionTier: ModelTier = "standard"

  // Auto-upgrade/downgrade settings (runtime configurable)
  private autoUpgrade: boolean = true
  private autoDowngrade: boolean = true
  private learningMode: LearningMode = "balanced"
  private quotaTargets: QuotaTargets = {}

  // Subscription usage trackers (optional)
  private claudeMaxTracker?: ClaudeMaxUsageTracker
  private copilotTracker?: CopilotUsageTracker

  // Cache timeout in milliseconds (5 minutes)
  private readonly CACHE_TIMEOUT_MS = 5 * 60 * 1000

  constructor(
    config: BudgetConfig | undefined,
    usageTracker: UsageTracker | null,
    availableProviders: string[] = [],
    subscriptionTrackers?: {
      claudeMaxTracker?: ClaudeMaxUsageTracker
      copilotTracker?: CopilotUsageTracker
    }
  ) {
    this.usageTracker = usageTracker
    this.budgetStateCache = new Map()
    this.availableProviders = availableProviders
    this.adaptiveManagers = new Map()

    // Store subscription trackers if provided
    this.claudeMaxTracker = subscriptionTrackers?.claudeMaxTracker
    this.copilotTracker = subscriptionTrackers?.copilotTracker

    this.config = {
      enabled: config?.enabled ?? false,
      targetPercentage: config?.target_percentage ?? 0.7,
      providerBudgets: config?.provider_budgets ?? {},
      autoDowngrade: config?.auto_downgrade ?? true,
      minTier: config?.min_tier ?? "budget",
      dailyTarget: config?.daily_target,
    }

    // Initialize runtime settings from config
    this.autoUpgrade = config?.auto_upgrade ?? true
    this.autoDowngrade = config?.auto_downgrade ?? true
    this.learningMode = config?.learning_mode ?? "balanced"
    this.quotaTargets = config?.quota_targets ?? {}

    // Initialize override manager
    this.overrideManager = getOverrideManager()
    
    // Initialize global override manager
    this.globalOverrideManager = getGlobalOverrideManager()

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

    // Check for budget alerts
    const percentUsed = (state.used / state.totalBudget) * 100
    const logger = getRoutingLogger()

    if (percentUsed >= 90) {
      logger.logBudgetAlert(provider, percentUsed, 90, "CRITICAL: Switch to economy tier immediately")
    } else if (percentUsed >= 70) {
      logger.logBudgetAlert(provider, percentUsed, 70, "WARNING: Consider downgrading to budget tier")
    } else if (percentUsed >= 50) {
      logger.logBudgetAlert(provider, percentUsed, 50, "CAUTION: Monitor spending closely")
    }

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
   * - Respects forced tier and tier lock overrides
   */
  getSmartTierChange(model: ModelRef | string): TierChangeResult {
    const modelRef = typeof model === "string" ? parseModelRef(model) : model
    const originalTier = getModelTier(modelRef) ?? "standard"

    // Check if tier changes are blocked (tier locked)
    if (this.overrideManager.shouldBlockTierChange()) {
      log("[budget-orchestrator] Tier change blocked by lock")
      const logger = getRoutingLogger()
      logger.logOverride("lock", originalTier, "auto")
      return {
        original: modelRef,
        newModel: null,
        direction: "none",
        reason: "Tier changes are locked",
        originalTier,
        targetTier: originalTier,
        confidence: 1.0,
      }
    }

    // Check for forced tier override
    const forcedTier = this.overrideManager.getForcedTier()
    if (forcedTier && forcedTier !== originalTier) {
      const logger = getRoutingLogger()

      // Return forced tier change
      const targetTierIndex = TIER_ORDER.indexOf(forcedTier)
      const originalTierIndex = TIER_ORDER.indexOf(originalTier)
      const direction: TierChangeDirection = targetTierIndex < originalTierIndex ? "upgrade" : "downgrade"

      if (direction === "upgrade") {
        const upgradedModel = findUpgradedModel(modelRef, forcedTier, this.availableProviders)
        if (upgradedModel) {
          logger.logOverride("force", forcedTier, "user")
          logger.logUpgradeScheduled(
            modelRef.providerID,
            originalTier,
            forcedTier,
            1.0,
            `Forced tier override by user`
          )
          return {
            original: modelRef,
            newModel: upgradedModel,
            direction: "upgrade",
            reason: `Forced tier override: ${forcedTier}`,
            originalTier,
            targetTier: forcedTier,
            confidence: 1.0,
          }
        }
      } else {
        // For forced downgrade, bypass budget checks and directly find the model
        const downgradedModel = findDowngradedModel(modelRef, forcedTier, this.availableProviders)
        if (downgradedModel) {
          logger.logOverride("force", forcedTier, "user")
          logger.logDowngradeScheduled(
            modelRef.providerID,
            originalTier,
            forcedTier,
            1.0,
            `Forced tier override by user`
          )
          return {
            original: modelRef,
            newModel: downgradedModel,
            direction: "downgrade",
            reason: `Forced tier override: ${forcedTier}`,
            originalTier,
            targetTier: forcedTier,
            confidence: 1.0,
          }
        } else {
          // No suitable model found for forced downgrade
          logger.logOverride("force", forcedTier, "user")
          return {
            original: modelRef,
            newModel: null,
            direction: "none",
            reason: `Forced tier override to ${forcedTier} requested, but no suitable model found in available providers`,
            originalTier,
            targetTier: forcedTier,
            confidence: 1.0,
          }
        }
      }
    }

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
      // Check if auto-upgrade is disabled
      if (!this.autoUpgrade) {
        log("[budget-orchestrator] Upgrade blocked - auto_upgrade is disabled")
        return {
          original: modelRef,
          newModel: null,
          direction: "none",
          reason: "Auto-upgrade is disabled in budget configuration",
          originalTier,
          targetTier: originalTier,
          confidence,
        }
      }

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

        // Log the scheduled upgrade
        const logger = getRoutingLogger()
        logger.logUpgradeScheduled(
          modelRef.providerID,
          originalTier,
          targetTier,
          confidence,
          reason
        )

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
      // Check if auto-downgrade is disabled
      if (!this.autoDowngrade) {
        log("[budget-orchestrator] Downgrade blocked - auto_downgrade is disabled")
        return {
          original: modelRef,
          newModel: null,
          direction: "none",
          reason: "Auto-downgrade is disabled in budget configuration",
          originalTier,
          targetTier: originalTier,
          confidence,
        }
      }

      const result = getDowngradedModel(modelRef, budgetState, this.config, this.availableProviders)

      if (result.downgraded) {
        log("[budget-orchestrator] DOWNGRADE:", {
          from: formatModelRef(modelRef),
          to: formatModelRef(result.downgraded),
          reason: result.reason,
        })

        // Log the scheduled downgrade
        const logger = getRoutingLogger()
        logger.logDowngradeScheduled(
          modelRef.providerID,
          originalTier,
          result.tier,
          confidence,
          result.reason
        )

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
   * Respects forced tier override if set.
   * Also considers subscription quotas (Claude Max, Copilot).
   */
  getRecommendedTier(): ModelTier {
    // Check for forced tier override
    const forcedTier = this.overrideManager.getForcedTier()
    if (forcedTier) {
      log("[budget-orchestrator] Using forced tier:", forcedTier)
      return forcedTier
    }

    if (!this.isEnabled()) {
      return "standard"
    }

    const states = this.getAllBudgetStates()
    if (Object.keys(states).length === 0) {
      // No usage data yet - return conservative default
      return "budget"
    }

    // Find the most constrained tier from API budgets
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

    // Check subscription quotas (Claude Max, Copilot)
    const subscriptionTier = this.getSubscriptionConstrainedTier()
    const subscriptionTierIndex = tierOrder.indexOf(subscriptionTier)
    const currentTierIndex = tierOrder.indexOf(lowestTier)
    
    if (subscriptionTierIndex > currentTierIndex) {
      log("[budget-orchestrator] Subscription quota constraint:", {
        budgetTier: lowestTier,
        subscriptionTier,
        using: subscriptionTier
      })
      lowestTier = subscriptionTier
    }

    return lowestTier
  }

  /**
   * Get tier constraint based on subscription quota usage.
   * Returns the most restrictive tier needed based on quota consumption.
   * 
   * Logic:
   * - Usage >= 100%: economy (critical - over quota)
   * - Usage >= target (default 90%): budget (warning - approaching limit)
   * - Usage >= target * 0.8 (default 72%): standard (caution)
   * - Usage < 72%: premium (healthy)
   * 
   * Returns the MOST restrictive tier across all active subscriptions.
   */
  private getSubscriptionConstrainedTier(): ModelTier {
    let mostRestrictiveTier: ModelTier = "premium"
    const tierOrder: ModelTier[] = ["premium", "standard", "budget", "economy"]
    
    const getTierIndex = (tier: ModelTier): number => tierOrder.indexOf(tier)
    
    const compareTiers = (current: ModelTier, candidate: ModelTier): ModelTier => {
      return getTierIndex(candidate) > getTierIndex(current) ? candidate : current
    }

    // Check Claude Max subscription quota
    if (this.claudeMaxTracker) {
      try {
        const data = this.claudeMaxTracker.getData()
        if (!data.error) {
          const usage = data.allModels.percentUsed
          const target = this.quotaTargets.claude_max_weekly_percent ?? 90
          
          let constraintTier: ModelTier = "premium"
          
          if (usage >= 100) {
            constraintTier = "economy"
            log(`[budget-orchestrator] Claude Max constraint: ${usage.toFixed(1)}% >= 100% → economy tier`)
          } else if (usage >= target) {
            constraintTier = "budget"
            log(`[budget-orchestrator] Claude Max constraint: ${usage.toFixed(1)}% >= ${target}% → budget tier`)
          } else if (usage >= target * 0.8) {
            constraintTier = "standard"
            log(`[budget-orchestrator] Claude Max constraint: ${usage.toFixed(1)}% >= ${(target * 0.8).toFixed(1)}% → standard tier`)
          } else {
            log(`[budget-orchestrator] Claude Max constraint: ${usage.toFixed(1)}% < ${(target * 0.8).toFixed(1)}% → premium tier`)
          }
          
          mostRestrictiveTier = compareTiers(mostRestrictiveTier, constraintTier)
        } else {
          log(`[budget-orchestrator] Claude Max constraint: error fetching data - ${data.error}`)
        }
      } catch (error) {
        log(`[budget-orchestrator] Claude Max constraint: error - ${error}`)
      }
    }

    // Check Copilot subscription quota
    if (this.copilotTracker) {
      try {
        const data = this.copilotTracker.getData()
        if (!data.error) {
          const usage = data.percentUsed
          const target = this.quotaTargets.copilot_monthly_percent ?? 90
          
          let constraintTier: ModelTier = "premium"
          
          if (usage >= 100) {
            constraintTier = "economy"
            log(`[budget-orchestrator] Copilot constraint: ${usage.toFixed(1)}% >= 100% → economy tier`)
          } else if (usage >= target) {
            constraintTier = "budget"
            log(`[budget-orchestrator] Copilot constraint: ${usage.toFixed(1)}% >= ${target}% → budget tier`)
          } else if (usage >= target * 0.8) {
            constraintTier = "standard"
            log(`[budget-orchestrator] Copilot constraint: ${usage.toFixed(1)}% >= ${(target * 0.8).toFixed(1)}% → standard tier`)
          } else {
            log(`[budget-orchestrator] Copilot constraint: ${usage.toFixed(1)}% < ${(target * 0.8).toFixed(1)}% → premium tier`)
          }
          
          mostRestrictiveTier = compareTiers(mostRestrictiveTier, constraintTier)
        } else {
          log(`[budget-orchestrator] Copilot constraint: error fetching data - ${data.error}`)
        }
      } catch (error) {
        log(`[budget-orchestrator] Copilot constraint: error - ${error}`)
      }
    }

    log(`[budget-orchestrator] Final subscription-constrained tier: ${mostRestrictiveTier}`)
    return mostRestrictiveTier
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

  /**
   * Get the override manager for manual tier control.
   */
  getOverrideManager(): BudgetOverrideManager {
    return this.overrideManager
  }

  /**
   * Reset adaptive learning for a specific provider or all providers.
   * @param provider Optional provider to reset, or undefined for all
   */
  resetAdaptiveLearning(provider?: string): void {
    if (provider) {
      const manager = this.adaptiveManagers.get(provider)
      if (manager) {
        // Delete the persist file to reset learning
        const persistPath = join(
          homedir(),
          ".config",
          "opencode",
          `oh-my-opencode-adaptive-${provider}.json`
        )
        try {
          const fs = require("fs")
          if (fs.existsSync(persistPath)) {
            fs.unlinkSync(persistPath)
          }
          // Recreate the manager
          const budget = this.config.providerBudgets[provider]
          if (budget) {
            const periodHours = this.getProviderPeriodHours(provider)
            const adaptiveConfig: Partial<AdaptiveBudgetConfig> = {
              totalBudget: budget,
              periodHours,
              minTier: this.config.minTier,
              conservativeSpendingFactor: this.config.targetPercentage,
            }
            this.adaptiveManagers.set(provider, new AdaptiveBudgetManager(adaptiveConfig, persistPath))
          }
          log("[budget-orchestrator] Reset adaptive learning for provider:", provider)
        } catch (error) {
          log("[budget-orchestrator] Failed to reset learning:", error)
        }
      }
    } else {
      // Reset all providers
      for (const p of this.adaptiveManagers.keys()) {
        this.resetAdaptiveLearning(p)
      }
    }

    this.overrideManager.recordLearningReset()
  }

  /**
   * Get configured provider names.
   */
  getConfiguredProviders(): string[] {
    return Object.keys(this.config.providerBudgets)
  }

  /**
   * Get provider budget configuration.
   */
  getProviderBudgetConfig(provider: string): number | undefined {
    return this.config.providerBudgets[provider]
  }

  // ============================================
  // Runtime Configuration Update Methods
  // ============================================

  /**
   * Enable or disable auto-upgrade.
   * When enabled, the system will automatically upgrade to higher-quality models
   * when budget headroom allows.
   */
  setAutoUpgrade(enabled: boolean): void {
    this.autoUpgrade = enabled
    log("[budget-orchestrator] Auto-upgrade set to:", enabled)
  }

  /**
   * Get current auto-upgrade setting.
   */
  getAutoUpgrade(): boolean {
    return this.autoUpgrade
  }

  /**
   * Enable or disable auto-downgrade.
   * When enabled, the system will automatically downgrade to cheaper models
   * when approaching budget limits.
   */
  setAutoDowngrade(enabled: boolean): void {
    this.autoDowngrade = enabled
    this.config.autoDowngrade = enabled
    log("[budget-orchestrator] Auto-downgrade set to:", enabled)
  }

  /**
   * Get current auto-downgrade setting.
   */
  getAutoDowngrade(): boolean {
    return this.autoDowngrade
  }

  /**
   * Set the learning mode, which controls how quickly the system adapts.
   * - conservative: Slow learning, high stability
   * - balanced: Default settings
   * - aggressive: Fast learning, quick adjustments
   */
  setLearningMode(mode: LearningMode): void {
    this.learningMode = mode

    // Apply learning mode preset to all adaptive managers
    const preset = LEARNING_MODE_PRESETS[mode]
    if (preset) {
      this.updateAdaptiveConfig(preset)
    }

    log("[budget-orchestrator] Learning mode set to:", mode)
    const logger = getRoutingLogger()
    logger.logInfo("adaptive", `Learning mode changed to ${mode.toUpperCase()}`, { mode, preset })
  }

  /**
   * Get current learning mode.
   */
  getLearningMode(): LearningMode {
    return this.learningMode
  }

  /**
   * Update adaptive configuration for all providers.
   * This allows fine-grained control over the adaptive algorithm.
   */
  updateAdaptiveConfig(config: AdaptiveConfig): void {
    for (const [provider, manager] of this.adaptiveManagers) {
      // Update manager configuration
      if (config.velocity_alpha !== undefined) {
        manager.updateConfig({ velocityAlpha: config.velocity_alpha })
      }
      if (config.min_samples_for_prediction !== undefined) {
        manager.updateConfig({ minSamplesForPrediction: config.min_samples_for_prediction })
      }
      if (config.stability_checks_before_upgrade !== undefined) {
        manager.updateConfig({ stabilityChecksBeforeUpgrade: config.stability_checks_before_upgrade })
      }
      if (config.tier_upgrade_threshold !== undefined) {
        manager.updateConfig({ tierUpgradeThreshold: config.tier_upgrade_threshold })
      }
      if (config.tier_downgrade_threshold !== undefined) {
        manager.updateConfig({ tierDowngradeThreshold: config.tier_downgrade_threshold })
      }
    }

    log("[budget-orchestrator] Adaptive config updated:", config)
  }

  /**
   * Set quota targets for different providers.
   */
  setQuotaTargets(targets: QuotaTargets): void {
    this.quotaTargets = { ...this.quotaTargets, ...targets }
    log("[budget-orchestrator] Quota targets updated:", this.quotaTargets)
  }

  /**
   * Get current quota targets.
   */
  getQuotaTargets(): QuotaTargets {
    return { ...this.quotaTargets }
  }

  /**
   * Get adaptive settings summary for API/UI.
   */
  getAdaptiveSettings(): {
    autoUpgrade: boolean
    autoDowngrade: boolean
    learningMode: LearningMode
    quotaTargets: QuotaTargets
    adaptiveConfig: AdaptiveConfig
  } {
    // Get current adaptive config from learning mode
    const adaptiveConfig = LEARNING_MODE_PRESETS[this.learningMode] ?? LEARNING_MODE_PRESETS.balanced

    return {
      autoUpgrade: this.autoUpgrade,
      autoDowngrade: this.autoDowngrade,
      learningMode: this.learningMode,
      quotaTargets: this.quotaTargets,
      adaptiveConfig,
    }
  }

  /**
   * Apply settings from API/UI update.
   */
  applyAdaptiveSettings(settings: {
    autoUpgrade?: boolean
    autoDowngrade?: boolean
    learningMode?: LearningMode
    quotaTargets?: QuotaTargets
    adaptiveConfig?: AdaptiveConfig
  }): void {
    if (settings.autoUpgrade !== undefined) {
      this.setAutoUpgrade(settings.autoUpgrade)
    }
    if (settings.autoDowngrade !== undefined) {
      this.setAutoDowngrade(settings.autoDowngrade)
    }
    if (settings.learningMode !== undefined) {
      this.setLearningMode(settings.learningMode)
    }
    if (settings.quotaTargets !== undefined) {
      this.setQuotaTargets(settings.quotaTargets)
    }
    if (settings.adaptiveConfig !== undefined) {
      this.updateAdaptiveConfig(settings.adaptiveConfig)
    }
  }

  /**
   * Get stability status for tier changes.
   * Returns the current stability counter and requirement.
   */
  getStabilityStatus(provider: string): { current: number; required: number } | null {
    const manager = this.adaptiveManagers.get(provider)
    if (!manager) return null

    return manager.getStabilityStatus()
  }
  
  // ============================================
  // Global Override Management
  // ============================================
  
  /**
   * Get the global override manager.
   */
  getGlobalOverrideManager(): GlobalOverrideManager {
    return this.globalOverrideManager
  }
  
  /**
   * Disable a provider entirely.
   * All model requests for this provider will fallback to alternatives.
   */
  disableProvider(provider: string, source: "cli" | "webui" | "api" = "api"): void {
    this.globalOverrideManager.disableProvider(provider, { source })
  }
  
  /**
   * Enable a previously disabled provider.
   */
  enableProvider(provider: string, source: "cli" | "webui" | "api" = "api"): void {
    this.globalOverrideManager.enableProvider(provider, { source })
  }
  
  /**
   * Check if a provider is disabled.
   */
  isProviderDisabled(provider: string): boolean {
    return this.globalOverrideManager.isProviderDisabled(provider)
  }
  
  /**
   * Set maximum tier cap.
   */
  setMaxTierCap(tier: ModelTier | null, source: "cli" | "webui" | "api" = "api"): void {
    this.globalOverrideManager.setMaxTierCap(tier, { source })
  }
  
  /**
   * Enable/disable emergency mode (economy tier only).
   */
  setEmergencyMode(enabled: boolean, source: "cli" | "webui" | "api" = "api"): void {
    this.globalOverrideManager.setEmergencyMode(enabled, { source })
  }
  
  /**
   * Get best available model for a use case, respecting all overrides.
   * This is the primary method for selecting models with fallback logic.
   * 
   * Now also considers:
   * - quotaTargets: Provider-specific usage limits
   * - preserveForCritical: Reserve premium models for critical use cases
   */
  getBestModelForUseCase(
    useCase: UseCase,
    preferredModel?: string
  ): string {
    // Calculate current usage percentage for quota checks
    const usagePercentByProvider = this.calculateUsagePercentages()
    
    return this.globalOverrideManager.getBestAvailableModel(
      useCase,
      preferredModel,
      this.availableProviders,
      usagePercentByProvider,
      this.quotaTargets
    )
  }
  
  /**
   * Calculate usage percentages for all configured providers.
   * Returns a map of provider -> usage percentage (0-100).
   */
  private calculateUsagePercentages(): Record<string, number> {
    const result: Record<string, number> = {}
    
    for (const provider of Object.keys(this.config.providerBudgets)) {
      const state = this.getBudgetState(provider)
      if (state && state.totalBudget > 0) {
        result[provider] = (state.used / state.totalBudget) * 100
      }
    }
    
    return result
  }
  
  /**
   * Check quota and auto-disable provider if threshold exceeded.
   * Call this after updating usage.
   */
  checkAndAutoDisableProvider(provider: string, usagePercent: number): boolean {
    return this.globalOverrideManager.checkQuotaAndAutoDisable(provider, usagePercent)
  }
  
  /**
   * Get global override summary for API/UI.
   */
  getGlobalOverrideSummary(): ReturnType<GlobalOverrideManager["getSummary"]> {
    return this.globalOverrideManager.getSummary()
  }
  
  /**
   * Clear all global overrides.
   */
  clearGlobalOverrides(source: "cli" | "webui" | "api" = "api"): void {
    this.globalOverrideManager.clearAll({ source })
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

export {
  BudgetOverrideManager,
  getOverrideManager,
  resetOverrideManager,
  type BudgetOverrideState,
  type OverrideOptions,
} from "./override"

export {
  GlobalOverrideManager,
  getGlobalOverrideManager,
  resetGlobalOverrideManager,
  USE_CASE_FALLBACKS,
  type GlobalOverrideState,
  type GlobalOverrideOptions,
  type UseCase,
} from "./global-override"
