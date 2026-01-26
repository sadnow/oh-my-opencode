/**
 * Usage Tracker Types
 * TypeScript interfaces for tracking API usage and costs
 */

export type TaskType = "primary" | "background-task" | "subagent"

export type ResetType = "weekly" | "monthly"

export interface UsageRecord {
  /** Unique identifier for this usage record */
  id: string
  /** When the usage occurred */
  timestamp: Date
  /** Provider ID (e.g., "anthropic", "openai", "github-copilot") */
  provider: string
  /** Model ID (e.g., "claude-opus-4-5", "gpt-5.2") */
  model: string
  /** Number of input tokens */
  inputTokens: number
  /** Number of output tokens */
  outputTokens: number
  /** Estimated cost in USD */
  estimatedCost: number
  /** Type of task that generated this usage */
  taskType: TaskType
  /** Optional session ID for tracking */
  sessionID?: string
}

export interface ProviderUsageSummary {
  /** Provider ID */
  provider: string
  /** Start of the current billing period */
  periodStart: Date
  /** When the usage resets */
  nextReset: Date
  /** Type of reset schedule */
  resetType: ResetType
  /** Total cost in USD for the current period */
  totalCost: number
  /** Total input tokens for the current period */
  totalInputTokens: number
  /** Total output tokens for the current period */
  totalOutputTokens: number
  /** Number of API calls in the current period */
  callCount: number
}

export interface UsageStorage {
  /** Version for future migrations */
  version: number
  /** When this data was last updated */
  lastUpdated: Date
  /** Individual usage records */
  records: UsageRecord[]
  /** Cached summaries per provider */
  summaries: Record<string, ProviderUsageSummary>
}

export interface UsageTrackerConfig {
  /** Enable usage tracking */
  enabled: boolean
  /** Persist usage data to disk */
  persist: boolean
  /** Custom storage path (optional) */
  storagePath?: string
}

export interface ModelPricing {
  /** Cost per 1M input tokens in USD */
  inputPer1M: number
  /** Cost per 1M output tokens in USD */
  outputPer1M: number
}

export interface RecordUsageInput {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  taskType: TaskType
  sessionID?: string
}
