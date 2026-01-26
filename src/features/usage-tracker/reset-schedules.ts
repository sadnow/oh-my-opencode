/**
 * Provider Reset Schedules
 * Logic for calculating billing period boundaries per provider
 */

import type { ResetType } from "./types"

export interface ResetSchedule {
  type: ResetType
  /** Day of week (0=Sunday) for weekly, or day of month (1-31) for monthly */
  day: number
}

/**
 * Default reset schedules for known providers.
 * These can be overridden via configuration.
 */
export const DEFAULT_RESET_SCHEDULES: Record<string, ResetSchedule> = {
  // Anthropic resets weekly on Sunday
  anthropic: { type: "weekly", day: 0 },
  // GitHub Copilot resets monthly on the 1st
  "github-copilot": { type: "monthly", day: 1 },
  // OpenCode Zen resets monthly on the 1st
  opencode: { type: "monthly", day: 1 },
  // OpenAI resets monthly on the 1st
  openai: { type: "monthly", day: 1 },
  // Google/Gemini resets monthly on the 1st
  google: { type: "monthly", day: 1 },
  // Z.ai resets monthly on the 1st
  "zai-coding-plan": { type: "monthly", day: 1 },
}

/**
 * Get the reset schedule for a provider.
 * Falls back to monthly on the 1st if not specified.
 */
export function getResetSchedule(provider: string): ResetSchedule {
  return DEFAULT_RESET_SCHEDULES[provider] ?? { type: "monthly", day: 1 }
}

/**
 * Calculate the start of the current billing period for a provider.
 */
export function calculatePeriodStart(provider: string, now: Date = new Date()): Date {
  const schedule = getResetSchedule(provider)
  const result = new Date(now)
  result.setHours(0, 0, 0, 0)

  if (schedule.type === "weekly") {
    // Find the most recent occurrence of the reset day
    const currentDay = result.getDay()
    const daysSinceReset = (currentDay - schedule.day + 7) % 7
    result.setDate(result.getDate() - daysSinceReset)
  } else {
    // Monthly: find the most recent occurrence of the reset day
    if (result.getDate() < schedule.day) {
      // We're before the reset day this month, so go back to last month
      result.setMonth(result.getMonth() - 1)
    }
    result.setDate(schedule.day)
  }

  return result
}

/**
 * Calculate the next reset date for a provider.
 */
export function calculateNextReset(provider: string, now: Date = new Date()): Date {
  const schedule = getResetSchedule(provider)
  const periodStart = calculatePeriodStart(provider, now)
  const nextReset = new Date(periodStart)

  if (schedule.type === "weekly") {
    nextReset.setDate(nextReset.getDate() + 7)
  } else {
    nextReset.setMonth(nextReset.getMonth() + 1)
  }

  return nextReset
}

/**
 * Calculate the total number of days in the current billing period.
 */
export function getDaysInPeriod(provider: string, now: Date = new Date()): number {
  const periodStart = calculatePeriodStart(provider, now)
  const nextReset = calculateNextReset(provider, now)
  const diffMs = nextReset.getTime() - periodStart.getTime()
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

/**
 * Calculate days remaining until the next reset.
 */
export function getDaysRemaining(provider: string, now: Date = new Date()): number {
  const nextReset = calculateNextReset(provider, now)
  const diffMs = nextReset.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}

/**
 * Calculate days elapsed since the period started.
 */
export function getDaysElapsed(provider: string, now: Date = new Date()): number {
  const periodStart = calculatePeriodStart(provider, now)
  const diffMs = now.getTime() - periodStart.getTime()
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}
