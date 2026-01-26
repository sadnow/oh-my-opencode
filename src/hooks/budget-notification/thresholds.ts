/**
 * Budget Notification Thresholds
 * Configuration for when notifications should be triggered
 */

import type { BudgetNotificationConfig } from "./types"

export const DEFAULT_NOTIFICATION_CONFIG: BudgetNotificationConfig = {
  enabled: true,
  warningThresholds: [80, 90, 100],
  paceWarningDays: 3,
  idleCreditHours: 12,
  showTierChanges: true,
  debounceMs: 30000, // 30 seconds
}

/**
 * Check if a threshold was crossed
 * @param previousPercent Previous budget percentage
 * @param currentPercent Current budget percentage
 * @param threshold Threshold to check
 */
export function crossedThreshold(
  previousPercent: number,
  currentPercent: number,
  threshold: number
): boolean {
  return previousPercent < threshold && currentPercent >= threshold
}

/**
 * Get notification message for budget threshold
 */
export function getThresholdMessage(threshold: number, provider: string): { title: string; message: string } {
  if (threshold >= 100) {
    return {
      title: `Budget Exceeded`,
      message: `${provider} budget has been exceeded. Automatic tier downgrades may occur.`,
    }
  }

  if (threshold >= 90) {
    return {
      title: `Budget Critical`,
      message: `${provider} budget is at ${threshold}%. Consider reducing usage or upgrading your plan.`,
    }
  }

  return {
    title: `Budget Warning`,
    message: `${provider} budget has reached ${threshold}%. Monitoring recommended.`,
  }
}

/**
 * Get notification message for tier change
 */
export function getTierChangeMessage(
  direction: "upgrade" | "downgrade",
  fromTier: string,
  toTier: string,
  reason?: string
): { title: string; message: string } {
  if (direction === "upgrade") {
    return {
      title: `Upgrading to ${toTier}`,
      message: reason || `Budget headroom available for ${toTier} tier models.`,
    }
  }

  return {
    title: `Downgrading to ${toTier}`,
    message: reason || `Budget constraints require switching to ${toTier} tier.`,
  }
}

/**
 * Get notification message for idle credit
 */
export function getIdleCreditMessage(
  credits: number,
  idleHours: number,
  provider: string
): { title: string; message: string } {
  return {
    title: `Idle Credits Earned`,
    message: `+$${credits.toFixed(2)} accumulated from ${Math.round(idleHours)} hours idle on ${provider}. Premium tier may be affordable.`,
  }
}

/**
 * Get notification message for pace warning
 */
export function getPaceWarningMessage(
  provider: string,
  currentPercent: number,
  daysRemaining: number,
  predictedExceed: number
): { title: string; message: string } {
  return {
    title: `Spending Pace Warning`,
    message: `At current rate, ${provider} budget will exceed 100% in ${predictedExceed.toFixed(1)} days (${daysRemaining} days remaining, ${currentPercent.toFixed(0)}% used).`,
  }
}
