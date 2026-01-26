/**
 * Budget CLI Formatter
 * Formats budget data for terminal display using picocolors
 */

import pc from "picocolors"
import type { ModelTier } from "../../config/schema"
import type { SpendTrend } from "../../features/budget-orchestrator"
import type { ProviderBudgetDisplay, OverrideStatus } from "./types"

// ============================================================================
// Color Helpers
// ============================================================================

export function getTrendColor(trend: SpendTrend): (text: string) => string {
  switch (trend) {
    case "under":
      return pc.green
    case "on-track":
      return pc.cyan
    case "over":
      return pc.red
  }
}

export function getTrendIcon(trend: SpendTrend): string {
  switch (trend) {
    case "under":
      return pc.green("✓")
    case "on-track":
      return pc.cyan("~")
    case "over":
      return pc.red("!")
  }
}

export function getTierColor(tier: ModelTier): (text: string) => string {
  switch (tier) {
    case "premium":
      return pc.magenta
    case "standard":
      return pc.blue
    case "budget":
      return pc.yellow
    case "economy":
      return pc.gray
  }
}

export function getPercentageColor(percentage: number): (text: string) => string {
  if (percentage < 70) return pc.green
  if (percentage < 90) return pc.yellow
  return pc.red
}

// ============================================================================
// Progress Bar
// ============================================================================

export function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled
  const color = getPercentageColor(percentage)

  const filledBar = color("█".repeat(Math.max(0, filled)))
  const emptyBar = pc.dim("░".repeat(Math.max(0, empty)))

  return filledBar + emptyBar
}

// ============================================================================
// Box Drawing
// ============================================================================

const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  horizontalDown: "┬",
  horizontalUp: "┴",
  divider: "├",
  dividerRight: "┤",
}

export function createBox(lines: string[], width: number = 60): string {
  const output: string[] = []

  // Top border
  output.push(pc.dim(BOX.topLeft + BOX.horizontal.repeat(width - 2) + BOX.topRight))

  // Content lines
  for (const line of lines) {
    const stripped = stripAnsi(line)
    const padding = Math.max(0, width - 4 - stripped.length)
    output.push(pc.dim(BOX.vertical) + " " + line + " ".repeat(padding) + " " + pc.dim(BOX.vertical))
  }

  // Bottom border
  output.push(pc.dim(BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight))

  return output.join("\n")
}

export function createDivider(width: number = 60): string {
  return pc.dim(BOX.divider + BOX.horizontal.repeat(width - 2) + BOX.dividerRight)
}

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatTier(tier: ModelTier): string {
  const color = getTierColor(tier)
  return color(tier)
}

export function formatTrend(trend: SpendTrend): string {
  const icon = getTrendIcon(trend)
  const color = getTrendColor(trend)
  const label = {
    under: "Under budget",
    "on-track": "On track",
    over: "Over budget",
  }[trend]
  return `${icon} ${color(label)}`
}

export function padRight(text: string, length: number): string {
  const stripped = stripAnsi(text)
  const padding = Math.max(0, length - stripped.length)
  return text + " ".repeat(padding)
}

export function padLeft(text: string, length: number): string {
  const stripped = stripAnsi(text)
  const padding = Math.max(0, length - stripped.length)
  return " ".repeat(padding) + text
}

// ============================================================================
// ANSI Stripping
// ============================================================================

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "")
}

// ============================================================================
// Provider Budget Formatting
// ============================================================================

export function formatProviderBudget(provider: ProviderBudgetDisplay): string {
  const width = 60
  const lines: string[] = []

  // Header line
  const periodInfo = provider.periodType === "weekly"
    ? `Weekly, resets ${provider.resetDay}`
    : `Monthly, resets ${provider.resetDay}`
  lines.push(pc.bold(provider.provider.toUpperCase()) + pc.dim(` (${periodInfo})`))

  // Progress bar line
  const progressBar = createProgressBar(provider.percentage, 12)
  const percentColor = getPercentageColor(provider.percentage)
  const percentText = percentColor(formatPercentage(provider.percentage))
  const budgetText = `(${formatMoney(provider.used)} / ${formatMoney(provider.budget)})`
  lines.push(`${progressBar} ${percentText} ${pc.dim(budgetText)}`)

  // Daily spending info
  const dailyInfo = `Daily: ${formatMoney(provider.actualDaily)}/day (target: ${formatMoney(provider.targetDaily)})`
  const daysInfo = `${provider.daysRemaining} days remaining`
  lines.push(pc.dim(dailyInfo) + pc.dim(" • ") + pc.dim(daysInfo))

  // Trend line
  lines.push(`Trend: ${formatTrend(provider.trend)}`)

  // Adaptive section if available
  if (provider.adaptive) {
    lines.push("") // Divider
    lines.push(pc.bold("Adaptive Intelligence"))

    const credits = formatMoney(provider.adaptive.accumulatedCredits)
    const idleHours = Math.round(provider.adaptive.accumulatedCredits / provider.adaptive.hourlyAllowance)
    lines.push(`  Credits: ${pc.green("+" + credits)} (${idleHours} hours idle)`)

    const headroom = formatMoney(provider.adaptive.budgetHeadroom)
    const velocity = formatMoney(provider.adaptive.spendingVelocity)
    lines.push(`  Headroom: ${headroom} • Velocity: ${velocity}/hr`)

    const learningPct = formatPercentage(provider.adaptive.learningProgress * 100)
    const recTier = formatTier(provider.adaptive.recommendedTier)
    const canUpgrade = provider.adaptive.canAffordUpgrade ? pc.green("can upgrade") : ""
    const shouldDown = provider.adaptive.shouldDowngrade ? pc.yellow("should downgrade") : ""
    const action = canUpgrade || shouldDown || pc.dim("stable")
    lines.push(`  Learning: ${learningPct} • Recommended: ${recTier} ${pc.dim("→")} ${action}`)
  }

  return createBox(lines, width)
}

// ============================================================================
// Override Status Formatting
// ============================================================================

export function formatOverrideStatus(override: OverrideStatus): string {
  if (!override.forcedTier && !override.tierLocked) {
    return ""
  }

  const lines: string[] = []
  lines.push(pc.bold(pc.yellow("⚠ Override Active")))

  if (override.forcedTier) {
    lines.push(`  Forced tier: ${formatTier(override.forcedTier)}`)
  }

  if (override.tierLocked) {
    lines.push(`  Tier locked: ${pc.cyan("yes")}`)
  }

  if (override.expiresIn) {
    lines.push(`  Expires in: ${override.expiresIn}`)
  }

  if (override.modifiedBy) {
    lines.push(`  Set by: ${pc.dim(override.modifiedBy)}`)
  }

  return lines.join("\n")
}

// ============================================================================
// Summary Formatting
// ============================================================================

export function formatGlobalSummary(globalTier: ModelTier, providersCount: number): string {
  return [
    pc.bold("Global Status"),
    `  Recommended tier: ${formatTier(globalTier)}`,
    `  Providers tracked: ${pc.cyan(String(providersCount))}`,
  ].join("\n")
}
