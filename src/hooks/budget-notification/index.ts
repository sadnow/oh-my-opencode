/**
 * Budget Notification Hook
 * In-session toast notifications for budget events
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { ModelTier } from "../../config/schema"
import type { BudgetOrchestrator } from "../../features/budget-orchestrator"
import type {
  BudgetNotificationConfig,
  NotificationState,
  NotificationSeverity,
} from "./types"
import {
  DEFAULT_NOTIFICATION_CONFIG,
  crossedThreshold,
  getThresholdMessage,
  getTierChangeMessage,
  getIdleCreditMessage,
  getPaceWarningMessage,
} from "./thresholds"
import { log } from "../../shared"

// ============================================================================
// Types
// ============================================================================

interface BudgetNotificationHookOptions {
  budgetOrchestrator: BudgetOrchestrator | null
  config?: Partial<BudgetNotificationConfig>
}

interface ToastOptions {
  title: string
  message: string
  variant: NotificationSeverity
  duration?: number
}

// ============================================================================
// Toast Helper
// ============================================================================

function showToast(ctx: PluginInput, options: ToastOptions): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tuiClient = ctx.client as any
  if (!tuiClient.tui?.showToast) {
    log("[budget-notification] Toast API not available")
    return
  }

  tuiClient.tui.showToast({
    body: {
      title: options.title,
      message: options.message,
      variant: options.variant,
      duration: options.duration ?? 5000,
    },
  }).catch(() => {
    log("[budget-notification] Failed to show toast")
  })
}

// ============================================================================
// Hook Factory
// ============================================================================

export function createBudgetNotificationHook(
  ctx: PluginInput,
  options: BudgetNotificationHookOptions
) {
  const { budgetOrchestrator } = options
  const config: BudgetNotificationConfig = {
    ...DEFAULT_NOTIFICATION_CONFIG,
    ...options.config,
  }

  if (!budgetOrchestrator || !config.enabled) {
    return {
      event: async () => {},
    }
  }

  // Type assertion since we've validated it's not null above
  const orchestrator = budgetOrchestrator

  // Notification state tracking
  const state: NotificationState = {
    lastNotificationTime: new Map(),
    notifiedThresholds: new Map(),
    lastKnownTier: new Map(),
    lastIdleCreditTime: 0,
  }

  // Previous budget percentages for threshold crossing detection
  const previousPercentages: Map<string, number> = new Map()

  /**
   * Check if we should debounce this notification
   */
  function shouldDebounce(key: string): boolean {
    const lastTime = state.lastNotificationTime.get(key)
    if (!lastTime) return false
    return Date.now() - lastTime < config.debounceMs
  }

  /**
   * Mark notification as sent
   */
  function markNotificationSent(key: string): void {
    state.lastNotificationTime.set(key, Date.now())
  }

  /**
   * Check budget thresholds and show warnings
   */
  function checkBudgetThresholds(provider: string): void {
    const budgetState = orchestrator.getBudgetState(provider)
    if (!budgetState) return

    const currentPercent = (budgetState.used / budgetState.totalBudget) * 100
    const previousPercent = previousPercentages.get(provider) ?? 0

    // Initialize notified thresholds set for this provider
    if (!state.notifiedThresholds.has(provider)) {
      state.notifiedThresholds.set(provider, new Set())
    }
    const notified = state.notifiedThresholds.get(provider)!

    // Check each threshold
    for (const threshold of config.warningThresholds) {
      // Skip if already notified for this threshold
      if (notified.has(threshold)) continue

      // Check if threshold was crossed
      if (crossedThreshold(previousPercent, currentPercent, threshold)) {
        const debounceKey = `threshold-${provider}-${threshold}`
        if (shouldDebounce(debounceKey)) continue

        const { title, message } = getThresholdMessage(threshold, provider)
        const severity: NotificationSeverity = threshold >= 100 ? "error" : threshold >= 90 ? "warning" : "info"

        showToast(ctx, { title, message, variant: severity })
        markNotificationSent(debounceKey)
        notified.add(threshold)

        log("[budget-notification] Threshold notification:", { provider, threshold, currentPercent })
      }
    }

    // Update previous percentage
    previousPercentages.set(provider, currentPercent)
  }

  /**
   * Check for tier changes and show notifications
   */
  function checkTierChanges(provider: string): void {
    if (!config.showTierChanges) return

    const adaptiveSummary = orchestrator.getAdaptiveSummary(provider)
    if (!adaptiveSummary) return

    const lastKnownTier = state.lastKnownTier.get(provider)
    const currentTier = adaptiveSummary.recommendedTier

    if (lastKnownTier && lastKnownTier !== currentTier) {
      const debounceKey = `tier-${provider}`
      if (shouldDebounce(debounceKey)) {
        state.lastKnownTier.set(provider, currentTier)
        return
      }

      const tierOrder: ModelTier[] = ["premium", "standard", "budget", "economy"]
      const lastIndex = tierOrder.indexOf(lastKnownTier)
      const currentIndex = tierOrder.indexOf(currentTier)
      const direction = currentIndex < lastIndex ? "upgrade" : "downgrade"

      const { title, message } = getTierChangeMessage(
        direction,
        lastKnownTier,
        currentTier,
        direction === "upgrade"
          ? `Budget headroom: $${adaptiveSummary.budgetHeadroom.toFixed(2)}`
          : undefined
      )

      const severity: NotificationSeverity = direction === "upgrade" ? "success" : "info"
      showToast(ctx, { title, message, variant: severity })
      markNotificationSent(debounceKey)

      log("[budget-notification] Tier change notification:", {
        provider,
        from: lastKnownTier,
        to: currentTier,
        direction,
      })
    }

    state.lastKnownTier.set(provider, currentTier)
  }

  /**
   * Check for idle credits and show notification
   */
  function checkIdleCredits(provider: string): void {
    const adaptiveSummary = orchestrator.getAdaptiveSummary(provider)
    if (!adaptiveSummary) return

    const credits = adaptiveSummary.accumulatedCredits
    const hourlyAllowance = adaptiveSummary.hourlyAllowance
    if (hourlyAllowance <= 0) return

    const idleHours = credits / hourlyAllowance

    // Only notify if significant idle time and credits
    if (idleHours >= config.idleCreditHours && credits > hourlyAllowance * 2) {
      const debounceKey = `idle-${provider}`
      // Use longer debounce for idle notifications (4 hours)
      const lastTime = state.lastNotificationTime.get(debounceKey)
      if (lastTime && Date.now() - lastTime < 4 * 60 * 60 * 1000) return

      // Only show if we can actually upgrade
      if (adaptiveSummary.canAffordUpgrade) {
        const { title, message } = getIdleCreditMessage(credits, idleHours, provider)
        showToast(ctx, { title, message, variant: "success", duration: 7000 })
        markNotificationSent(debounceKey)

        log("[budget-notification] Idle credit notification:", {
          provider,
          credits,
          idleHours,
        })
      }
    }
  }

  /**
   * Check spending pace and warn if will exceed budget
   */
  function checkPaceWarning(provider: string): void {
    const budgetState = orchestrator.getBudgetState(provider)
    const adaptiveSummary = orchestrator.getAdaptiveSummary(provider)
    if (!budgetState || !adaptiveSummary) return

    const currentPercent = (budgetState.used / budgetState.totalBudget) * 100
    const daysRemaining = budgetState.daysRemaining
    const velocity = adaptiveSummary.spendingVelocity // $/hour

    if (velocity <= 0 || daysRemaining <= 0) return

    // Predict when we'll exceed 100%
    const remainingBudget = budgetState.remaining
    const hoursUntilExceed = remainingBudget / velocity
    const daysUntilExceed = hoursUntilExceed / 24

    // Warn if we'll exceed before period end
    if (daysUntilExceed < daysRemaining && daysUntilExceed <= config.paceWarningDays) {
      const debounceKey = `pace-${provider}`
      // Use longer debounce for pace warnings (1 hour)
      const lastTime = state.lastNotificationTime.get(debounceKey)
      if (lastTime && Date.now() - lastTime < 60 * 60 * 1000) return

      const { title, message } = getPaceWarningMessage(
        provider,
        currentPercent,
        daysRemaining,
        daysUntilExceed
      )
      showToast(ctx, { title, message, variant: "warning", duration: 8000 })
      markNotificationSent(debounceKey)

      log("[budget-notification] Pace warning:", {
        provider,
        daysUntilExceed,
        daysRemaining,
        currentPercent,
      })
    }
  }

  /**
   * Reset threshold notifications at period start
   */
  function checkPeriodReset(provider: string): void {
    const budgetState = orchestrator.getBudgetState(provider)
    if (!budgetState) return

    // Reset if at start of new period (less than 1 day elapsed)
    if (budgetState.daysElapsed < 1) {
      state.notifiedThresholds.set(provider, new Set())
      previousPercentages.set(provider, 0)
    }
  }

  /**
   * Run all checks for a provider
   */
  function runChecks(): void {
    const providers = orchestrator.getConfiguredProviders()

    for (const provider of providers) {
      checkPeriodReset(provider)
      checkBudgetThresholds(provider)
      checkTierChanges(provider)
      checkIdleCredits(provider)
      checkPaceWarning(provider)
    }
  }

  // Event handler
  return {
    event: async (input: { event: { type: string; properties?: unknown } }) => {
      const { event } = input

      // Run checks on relevant events
      if (
        event.type === "session.idle" ||
        event.type === "tool.execute.after" ||
        event.type === "message.updated"
      ) {
        // Don't run on every event, use periodic checking
        const lastCheck = state.lastNotificationTime.get("_last_check") ?? 0
        const checkInterval = 60000 // 1 minute

        if (Date.now() - lastCheck >= checkInterval) {
          runChecks()
          state.lastNotificationTime.set("_last_check", Date.now())
        }
      }

      // Always run checks on session.idle for timely notifications
      if (event.type === "session.idle") {
        runChecks()
      }
    },
  }
}

export type { BudgetNotificationConfig, NotificationState } from "./types"
export {
  DEFAULT_NOTIFICATION_CONFIG,
  crossedThreshold,
  getThresholdMessage,
  getTierChangeMessage,
  getIdleCreditMessage,
  getPaceWarningMessage,
} from "./thresholds"
