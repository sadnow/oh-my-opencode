/**
 * Budget Notification Types
 */

import type { ModelTier } from "../../config/schema"

export type NotificationType =
  | "tier-upgrade"
  | "tier-downgrade"
  | "budget-warning"
  | "budget-exceeded"
  | "pace-warning"
  | "idle-credit"

export type NotificationSeverity = "success" | "info" | "warning" | "error"

export interface BudgetNotification {
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  provider?: string
  tier?: ModelTier
  percentage?: number
  timestamp: number
}

export interface BudgetNotificationConfig {
  /** Enable budget notifications (default: true) */
  enabled: boolean
  /** Budget percentage thresholds that trigger warnings */
  warningThresholds: number[]
  /** Days ahead to predict for pace warnings */
  paceWarningDays: number
  /** Hours of idle time before showing idle credit notification */
  idleCreditHours: number
  /** Show notifications for tier changes (default: true) */
  showTierChanges: boolean
  /** Debounce time for notifications in ms (default: 30000 = 30 seconds) */
  debounceMs: number
}

export interface NotificationState {
  /** Last notification time per type per provider */
  lastNotificationTime: Map<string, number>
  /** Thresholds already notified for current period */
  notifiedThresholds: Map<string, Set<number>>
  /** Last known tier per provider */
  lastKnownTier: Map<string, ModelTier>
  /** Last idle credit notification time */
  lastIdleCreditTime: number
}
