/**
 * Auto-Router Analytics
 * Tracks technique effectiveness and provides learning insights
 */

import type {
  TechniqueCombo,
  BudgetTier,
  ProjectType,
  DomainSignal,
  ComplexityTier,
} from "./types"
import { log } from "../../shared/logger"

// ============================================================================
// Types
// ============================================================================

export interface ExecutionRecord {
  id: string
  timestamp: number
  taskDescription: string
  projectType: ProjectType
  complexityTier: ComplexityTier
  domainSignals: DomainSignal[]
  technique: TechniqueCombo
  startingBudget: BudgetTier
  finalBudget: BudgetTier
  escalationCount: number
  success: boolean
  qualityScore?: number
  duration: number
  errorMessage?: string
  // Subagent tracking fields (v3.7.0)
  /** Task ID linking to subagent execution */
  taskId?: string
  /** Session ID of the parent orchestrator */
  sessionId?: string
  /** Name of the subagent used */
  agentName?: string
  /** Intended model for subagent */
  intendedModel?: string
  /** Actual model used by subagent (verified from session) */
  actualModel?: string
  /** Whether intended and actual models matched */
  modelMatch?: boolean
  /** Duration in milliseconds */
  durationMs?: number
  /** Whether this was an escalation from a lower tier */
  isEscalation?: boolean
  /** Budget tier escalated from (if isEscalation) */
  escalatedFrom?: BudgetTier
}

/**
 * Subagent execution info for tracking spawned subagents
 */
export interface SubagentExecutionRecord {
  executionId: string       // Link to parent analytics record
  taskId: string            // Background task ID
  sessionId: string         // Subagent session ID
  agentName: string         // e.g., "auto-expensive"
  intendedModel: string     // e.g., "github-copilot/claude-sonnet-4"
  actualModel?: string      // Verified from session messages
  modelMatch?: boolean      // true if intended === actual
  startTime: number         // For duration calculation
  endTime?: number          // When task completed
  durationMs?: number       // Calculated duration
  isEscalation: boolean
  escalatedFrom?: BudgetTier
  parentSessionId: string   // Parent orchestrator session
  complexityTier: ComplexityTier
  budgetTier: BudgetTier
  success?: boolean
  errorMessage?: string
}

export interface TechniqueStats {
  technique: TechniqueCombo
  totalExecutions: number
  successCount: number
  avgQualityScore: number
  avgDuration: number
  avgEscalations: number
  successRate: number
  byProjectType: Record<ProjectType, { count: number; successRate: number }>
  byComplexity: Record<ComplexityTier, { count: number; successRate: number }>
}

export interface AnalyticsSummary {
  totalExecutions: number
  overallSuccessRate: number
  avgQualityScore: number
  avgEscalations: number
  techniqueStats: TechniqueStats[]
  recommendations: string[]
  costSavingsEstimate: number
}

// ============================================================================
// Provider Cost Rates (per 1M tokens)
// ============================================================================

/**
 * Provider-specific cost rates for accurate cost tracking.
 * Rates are per 1M tokens for input/output.
 * Free models (Antigravity, Copilot free tier, OpenCode free) have $0 rates.
 */
export const PROVIDER_COST_RATES: Record<string, { input: number; output: number }> = {
  // OpenAI (paid via API key)
  "openai/gpt-5.2": { input: 2.50, output: 10.00 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.60 },
  "openai/gpt-4o": { input: 2.50, output: 10.00 },

  // Google Antigravity (FREE via AI Studio)
  "google/antigravity-gemini-3-flash": { input: 0.00, output: 0.00 },
  "google/antigravity-gemini-3-pro-high": { input: 0.00, output: 0.00 },
  "google/antigravity-gemini-3-pro-low": { input: 0.00, output: 0.00 },

  // GitHub Copilot (FREE via Copilot CLI free tier)
  "github-copilot/gpt-4o-mini": { input: 0.00, output: 0.00 },
  "github-copilot/gpt-4o": { input: 0.00, output: 0.00 },

  // OpenCode free models
  "opencode/glm-4.7-free": { input: 0.00, output: 0.00 },
  "opencode/grok-code": { input: 0.00, output: 0.00 },

  // Anthropic (DISABLED - OAuth banned for OpenCode)
  // "anthropic/claude-opus-4-5": { input: 15.00, output: 75.00 },
  // "anthropic/claude-sonnet-4-5": { input: 3.00, output: 15.00 },
}

/**
 * Calculate estimated cost for a model invocation
 * @param model - Model identifier (e.g., "openai/gpt-5.2")
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Estimated cost in USD
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = PROVIDER_COST_RATES[model]
  if (!rates) {
    // Unknown model - assume moderate cost
    return (inputTokens / 1_000_000) * 0.50 + (outputTokens / 1_000_000) * 2.00
  }
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output
}

/**
 * Check if a model is free (zero cost)
 */
export function isModelFree(model: string): boolean {
  const rates = PROVIDER_COST_RATES[model]
  return rates ? (rates.input === 0 && rates.output === 0) : false
}

// ============================================================================
// In-Memory Storage (Session-scoped)
// ============================================================================

const MAX_RECORDS = 1000
const executionHistory: ExecutionRecord[] = []

// ============================================================================
// Recording Functions
// ============================================================================

/**
 * Record an execution for analytics
 */
export function recordExecution(record: Omit<ExecutionRecord, "id" | "timestamp">): string {
  const id = generateId()
  const fullRecord: ExecutionRecord = {
    ...record,
    id,
    timestamp: Date.now(),
  }

  executionHistory.push(fullRecord)

  // Maintain max size
  if (executionHistory.length > MAX_RECORDS) {
    executionHistory.shift()
  }

  log("[Analytics] Execution recorded", {
    id,
    technique: record.technique,
    success: record.success,
    escalations: record.escalationCount,
  })

  return id
}

/**
 * Update an existing execution record (e.g., when quality score is determined later)
 */
export function updateExecution(id: string, updates: Partial<ExecutionRecord>): boolean {
  const record = executionHistory.find(r => r.id === id)
  if (!record) return false

  Object.assign(record, updates)
  return true
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Get statistics for a specific technique
 */
export function getTechniqueStats(technique: TechniqueCombo): TechniqueStats | null {
  const records = executionHistory.filter(r => r.technique === technique)
  if (records.length === 0) return null

  const successRecords = records.filter(r => r.success)
  const qualityScores = records.filter(r => r.qualityScore !== undefined).map(r => r.qualityScore!)

  // By project type
  const byProjectType: TechniqueStats["byProjectType"] = {} as TechniqueStats["byProjectType"]
  for (const record of records) {
    if (!byProjectType[record.projectType]) {
      byProjectType[record.projectType] = { count: 0, successRate: 0 }
    }
    byProjectType[record.projectType].count++
  }
  for (const projectType of Object.keys(byProjectType) as ProjectType[]) {
    const typeRecords = records.filter(r => r.projectType === projectType)
    const typeSuccess = typeRecords.filter(r => r.success).length
    byProjectType[projectType].successRate = typeSuccess / typeRecords.length
  }

  // By complexity
  const byComplexity: TechniqueStats["byComplexity"] = {} as TechniqueStats["byComplexity"]
  for (const record of records) {
    if (!byComplexity[record.complexityTier]) {
      byComplexity[record.complexityTier] = { count: 0, successRate: 0 }
    }
    byComplexity[record.complexityTier].count++
  }
  for (const tier of Object.keys(byComplexity) as unknown as ComplexityTier[]) {
    const tierRecords = records.filter(r => r.complexityTier === tier)
    const tierSuccess = tierRecords.filter(r => r.success).length
    byComplexity[tier].successRate = tierSuccess / tierRecords.length
  }

  return {
    technique,
    totalExecutions: records.length,
    successCount: successRecords.length,
    avgQualityScore: qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0,
    avgDuration: records.reduce((sum, r) => sum + r.duration, 0) / records.length,
    avgEscalations: records.reduce((sum, r) => sum + r.escalationCount, 0) / records.length,
    successRate: successRecords.length / records.length,
    byProjectType,
    byComplexity,
  }
}

/**
 * Get full analytics summary
 */
export function getAnalyticsSummary(): AnalyticsSummary {
  const techniques: TechniqueCombo[] = [
    "direct", "ulw", "ultrathink", "ralph",
    "ulw+ralph", "ultrathink+ulw", "ultrathink+ralph", "triple"
  ]

  const techniqueStats = techniques
    .map(t => getTechniqueStats(t))
    .filter((s): s is TechniqueStats => s !== null)

  const successRecords = executionHistory.filter(r => r.success)
  const qualityScores = executionHistory
    .filter(r => r.qualityScore !== undefined)
    .map(r => r.qualityScore!)

  // Calculate cost savings estimate
  // Assumes: free=$0.00, cheap=$0.01, moderate=$0.05, expensive=$0.20, maximum=$1.00 per call
  const costMap: Record<BudgetTier, number> = {
    free: 0.00,
    cheap: 0.01,
    moderate: 0.05,
    expensive: 0.20,
    maximum: 1.00,
  }
  let actualCost = 0
  let naiveCost = 0
  for (const record of executionHistory) {
    actualCost += costMap[record.finalBudget]
    naiveCost += costMap.maximum // If always used maximum
  }
  const costSavingsEstimate = naiveCost > 0 ? (naiveCost - actualCost) / naiveCost : 0

  // Generate recommendations
  const recommendations: string[] = []

  // Find best technique for each complexity tier
  for (const tier of [1, 2, 3] as ComplexityTier[]) {
    const tierStats = techniqueStats
      .filter(s => s.byComplexity[tier]?.count > 2)
      .sort((a, b) => (b.byComplexity[tier]?.successRate || 0) - (a.byComplexity[tier]?.successRate || 0))

    if (tierStats.length > 0 && tierStats[0].byComplexity[tier]?.successRate > 0.8) {
      recommendations.push(
        `Tier ${tier} tasks: "${tierStats[0].technique}" has ${Math.round(tierStats[0].byComplexity[tier].successRate * 100)}% success rate`
      )
    }
  }

  // Check for over-escalation
  const avgEscalations = executionHistory.length > 0
    ? executionHistory.reduce((sum, r) => sum + r.escalationCount, 0) / executionHistory.length
    : 0
  if (avgEscalations > 1.5) {
    recommendations.push(
      `High escalation rate (${avgEscalations.toFixed(1)} avg). Consider starting at higher budget tier.`
    )
  }

  // Check for underutilized techniques
  const underutilized = techniqueStats.filter(s => s.totalExecutions < 3 && s.successRate > 0.5)
  if (underutilized.length > 0) {
    recommendations.push(
      `Underutilized techniques with good success: ${underutilized.map(s => s.technique).join(", ")}`
    )
  }

  return {
    totalExecutions: executionHistory.length,
    overallSuccessRate: executionHistory.length > 0
      ? successRecords.length / executionHistory.length
      : 0,
    avgQualityScore: qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0,
    avgEscalations,
    techniqueStats,
    recommendations,
    costSavingsEstimate,
  }
}

/**
 * Get recommended technique based on historical performance
 */
export function getRecommendedTechnique(
  projectType: ProjectType,
  complexityTier: ComplexityTier,
  domainSignals: DomainSignal[]
): TechniqueCombo | null {
  // Need at least 5 records to make recommendations
  if (executionHistory.length < 5) return null

  // Find similar past executions
  const similar = executionHistory.filter(r =>
    r.projectType === projectType &&
    r.complexityTier === complexityTier &&
    r.success
  )

  if (similar.length < 3) return null

  // Count technique success rates
  const techniqueSuccess: Record<string, { success: number; total: number }> = {}
  for (const record of similar) {
    if (!techniqueSuccess[record.technique]) {
      techniqueSuccess[record.technique] = { success: 0, total: 0 }
    }
    techniqueSuccess[record.technique].total++
    if (record.success) {
      techniqueSuccess[record.technique].success++
    }
  }

  // Find best technique
  let bestTechnique: TechniqueCombo | null = null
  let bestRate = 0
  for (const [technique, stats] of Object.entries(techniqueSuccess)) {
    const rate = stats.success / stats.total
    if (rate > bestRate && stats.total >= 2) {
      bestRate = rate
      bestTechnique = technique as TechniqueCombo
    }
  }

  return bestTechnique
}

/**
 * Clear all analytics data
 */
export function clearAnalytics(): void {
  executionHistory.length = 0
  log("[Analytics] Cleared all execution history")
}

/**
 * Export analytics data for persistence
 */
export function exportAnalytics(): ExecutionRecord[] {
  return [...executionHistory]
}

/**
 * Import analytics data (e.g., from persistent storage)
 */
export function importAnalytics(records: ExecutionRecord[]): void {
  executionHistory.length = 0
  executionHistory.push(...records.slice(-MAX_RECORDS))
  log("[Analytics] Imported execution history", { count: executionHistory.length })
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================================
// Subagent Analytics (v3.7.0)
// ============================================================================

/**
 * In-memory storage for subagent executions
 */
const subagentExecutions = new Map<string, SubagentExecutionRecord>()
const MAX_SUBAGENT_RECORDS = 500

/**
 * Record a subagent execution start
 */
export function recordSubagentExecution(record: Omit<SubagentExecutionRecord, "startTime">): string {
  const fullRecord: SubagentExecutionRecord = {
    ...record,
    startTime: Date.now(),
  }

  subagentExecutions.set(record.taskId, fullRecord)

  // Maintain max size
  if (subagentExecutions.size > MAX_SUBAGENT_RECORDS) {
    const oldest = subagentExecutions.keys().next().value
    if (oldest) subagentExecutions.delete(oldest)
  }

  log("[Analytics] Subagent execution recorded", {
    taskId: record.taskId,
    agentName: record.agentName,
    intendedModel: record.intendedModel,
    budgetTier: record.budgetTier,
    isEscalation: record.isEscalation,
  })

  return record.executionId
}

/**
 * Update subagent execution with completion info
 */
export function updateSubagentExecution(
  taskId: string,
  updates: Partial<SubagentExecutionRecord>
): boolean {
  const record = subagentExecutions.get(taskId)
  if (!record) return false

  Object.assign(record, updates)

  // Calculate duration if endTime is set
  if (updates.endTime && !record.durationMs) {
    record.durationMs = updates.endTime - record.startTime
  }

  // Check model match if both models are known
  if (record.actualModel && record.intendedModel) {
    record.modelMatch = record.actualModel === record.intendedModel
  }

  log("[Analytics] Subagent execution updated", {
    taskId,
    actualModel: record.actualModel,
    modelMatch: record.modelMatch,
    durationMs: record.durationMs,
    success: record.success,
  })

  return true
}

/**
 * Get subagent execution record by task ID
 */
export function getSubagentExecution(taskId: string): SubagentExecutionRecord | undefined {
  return subagentExecutions.get(taskId)
}

/**
 * Subagent analytics summary
 */
export interface SubagentAnalyticsSummary {
  totalSpawns: number
  modelMatchRate: number
  matchCount: number
  mismatchCount: number
  mismatches: Array<{
    taskId: string
    intendedModel: string
    actualModel: string
  }>
  byTier: Record<ComplexityTier, {
    spawns: number
    matchRate: number
  }>
  byBudget: Record<BudgetTier, {
    spawns: number
    avgDurationMs: number
  }>
  escalationCount: number
  escalationRate: number
  escalationPaths: Record<string, number> // e.g., "cheap→moderate": 3
}

/**
 * Get subagent analytics summary
 */
export function getSubagentStats(): SubagentAnalyticsSummary {
  const records = Array.from(subagentExecutions.values())
  const completedRecords = records.filter(r => r.endTime !== undefined)

  // Model match stats
  const withModelInfo = completedRecords.filter(r => r.actualModel !== undefined)
  const matches = withModelInfo.filter(r => r.modelMatch === true)
  const mismatches = withModelInfo.filter(r => r.modelMatch === false)

  // By tier
  const byTier: SubagentAnalyticsSummary["byTier"] = {
    1: { spawns: 0, matchRate: 0 },
    2: { spawns: 0, matchRate: 0 },
    3: { spawns: 0, matchRate: 0 },
  }
  for (const tier of [1, 2, 3] as ComplexityTier[]) {
    const tierRecords = completedRecords.filter(r => r.complexityTier === tier)
    const tierWithModel = tierRecords.filter(r => r.actualModel !== undefined)
    const tierMatches = tierWithModel.filter(r => r.modelMatch === true)
    byTier[tier] = {
      spawns: tierRecords.length,
      matchRate: tierWithModel.length > 0 ? tierMatches.length / tierWithModel.length : 0,
    }
  }

  // By budget
  const byBudget: SubagentAnalyticsSummary["byBudget"] = {
    free: { spawns: 0, avgDurationMs: 0 },
    cheap: { spawns: 0, avgDurationMs: 0 },
    moderate: { spawns: 0, avgDurationMs: 0 },
    expensive: { spawns: 0, avgDurationMs: 0 },
    maximum: { spawns: 0, avgDurationMs: 0 },
  }
  for (const budget of ["free", "cheap", "moderate", "expensive", "maximum"] as BudgetTier[]) {
    const budgetRecords = completedRecords.filter(r => r.budgetTier === budget)
    const durations = budgetRecords.filter(r => r.durationMs).map(r => r.durationMs!)
    byBudget[budget] = {
      spawns: budgetRecords.length,
      avgDurationMs: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
    }
  }

  // Escalation stats
  const escalations = completedRecords.filter(r => r.isEscalation)
  const escalationPaths: Record<string, number> = {}
  for (const esc of escalations) {
    if (esc.escalatedFrom) {
      const path = `${esc.escalatedFrom}→${esc.budgetTier}`
      escalationPaths[path] = (escalationPaths[path] || 0) + 1
    }
  }

  return {
    totalSpawns: records.length,
    modelMatchRate: withModelInfo.length > 0 ? matches.length / withModelInfo.length : 0,
    matchCount: matches.length,
    mismatchCount: mismatches.length,
    mismatches: mismatches.map(r => ({
      taskId: r.taskId,
      intendedModel: r.intendedModel,
      actualModel: r.actualModel || "unknown",
    })),
    byTier,
    byBudget,
    escalationCount: escalations.length,
    escalationRate: completedRecords.length > 0 ? escalations.length / completedRecords.length : 0,
    escalationPaths,
  }
}

/**
 * Format subagent analytics summary for console output
 */
export function formatSubagentAnalytics(): string {
  const stats = getSubagentStats()

  let output = `
========================================
[AUTO-ROUTER] SUBAGENT ANALYTICS
========================================
Total Subagent Spawns: ${stats.totalSpawns}
Model Match Rate: ${(stats.modelMatchRate * 100).toFixed(1)}% (${stats.matchCount}/${stats.matchCount + stats.mismatchCount})
Mismatches: ${stats.mismatchCount}`

  if (stats.mismatches.length > 0) {
    output += "\n  " + stats.mismatches.map(m =>
      `- Task ${m.taskId}: intended ${m.intendedModel}, got ${m.actualModel}`
    ).join("\n  ")
  }

  output += `

By Tier:`
  for (const tier of [1, 2, 3] as ComplexityTier[]) {
    const tierStats = stats.byTier[tier]
    output += `\n  Tier ${tier}: ${tierStats.spawns} spawns, ${(tierStats.matchRate * 100).toFixed(1)}% match`
  }

  output += `

By Budget:`
  for (const budget of ["free", "cheap", "moderate", "expensive", "maximum"] as BudgetTier[]) {
    const budgetStats = stats.byBudget[budget]
    if (budgetStats.spawns > 0) {
      output += `\n  ${budget}: ${budgetStats.spawns} spawns, avg ${Math.round(budgetStats.avgDurationMs / 1000)}s`
    }
  }

  output += `

Escalations: ${stats.escalationCount} (${(stats.escalationRate * 100).toFixed(1)}%)`
  if (Object.keys(stats.escalationPaths).length > 0) {
    for (const [path, count] of Object.entries(stats.escalationPaths)) {
      output += `\n  ${path}: ${count}`
    }
  }

  output += `
========================================`

  return output
}

/**
 * Clear subagent analytics data
 */
export function clearSubagentAnalytics(): void {
  subagentExecutions.clear()
  log("[Analytics] Cleared all subagent execution history")
}

/**
 * Export subagent analytics data for persistence
 */
export function exportSubagentAnalytics(): SubagentExecutionRecord[] {
  return Array.from(subagentExecutions.values())
}

/**
 * Import subagent analytics data
 */
export function importSubagentAnalytics(records: SubagentExecutionRecord[]): void {
  subagentExecutions.clear()
  for (const record of records.slice(-MAX_SUBAGENT_RECORDS)) {
    subagentExecutions.set(record.taskId, record)
  }
  log("[Analytics] Imported subagent execution history", { count: subagentExecutions.size })
}

// ============================================================================
// Spending Tracker (v3.8.0)
// ============================================================================

// Average tokens per request for cost estimation
// Based on typical coding assistant patterns
const AVG_INPUT_TOKENS = 2000   // Average prompt size
const AVG_OUTPUT_TOKENS = 1500  // Average response size

/**
 * Spending tracker state - tracks cumulative estimated costs
 */
interface SpendingState {
  totalEstimatedCost: number
  lastMilestoneNotified: number  // 0, 1, 2, 3... (dollars)
  requestCount: number
  costByModel: Record<string, number>
  costByProvider: Record<string, number>
  sessionStart: number
}

const spendingState: SpendingState = {
  totalEstimatedCost: 0,
  lastMilestoneNotified: 0,
  requestCount: 0,
  costByModel: {},
  costByProvider: {},
  sessionStart: Date.now(),
}

/**
 * Record model usage and calculate estimated cost
 * Call this each time a model is invoked
 */
export function recordModelUsage(model: string): number {
  const rates = PROVIDER_COST_RATES[model] ?? { input: 0.50, output: 2.00 }
  const estimatedCost = (AVG_INPUT_TOKENS * rates.input + AVG_OUTPUT_TOKENS * rates.output) / 1_000_000

  spendingState.totalEstimatedCost += estimatedCost
  spendingState.requestCount++
  spendingState.costByModel[model] = (spendingState.costByModel[model] ?? 0) + estimatedCost

  // Track by provider
  const provider = model.split("/")[0] || "unknown"
  spendingState.costByProvider[provider] = (spendingState.costByProvider[provider] ?? 0) + estimatedCost

  log("[Spending] Model usage recorded", {
    model,
    estimatedCost: estimatedCost.toFixed(4),
    totalEstimated: spendingState.totalEstimatedCost.toFixed(2),
    requestCount: spendingState.requestCount,
  })

  return estimatedCost
}

/**
 * Result of checking for spending milestone
 */
export interface SpendingMilestone {
  reached: boolean
  amount: number
  mainContributor: string
  breakdown: Record<string, number>
}

/**
 * Check if we've hit a new $1 milestone
 * Returns milestone info if threshold crossed, null otherwise
 */
export function checkSpendingMilestone(): SpendingMilestone | null {
  const currentMilestone = Math.floor(spendingState.totalEstimatedCost)

  if (currentMilestone > spendingState.lastMilestoneNotified) {
    spendingState.lastMilestoneNotified = currentMilestone

    // Find main contributing model
    const mainModel = Object.entries(spendingState.costByModel)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "unknown"

    log("[Spending] Milestone reached", {
      milestone: currentMilestone,
      totalEstimated: spendingState.totalEstimatedCost.toFixed(2),
      mainContributor: mainModel,
    })

    return {
      reached: true,
      amount: currentMilestone,
      mainContributor: mainModel,
      breakdown: { ...spendingState.costByModel },
    }
  }

  return null
}

/**
 * Get current spending summary
 */
export function getSpendingSummary(): {
  totalEstimated: number
  requestCount: number
  byModel: Record<string, number>
  byProvider: Record<string, number>
  sessionDurationMinutes: number
} {
  return {
    totalEstimated: spendingState.totalEstimatedCost,
    requestCount: spendingState.requestCount,
    byModel: { ...spendingState.costByModel },
    byProvider: { ...spendingState.costByProvider },
    sessionDurationMinutes: Math.round((Date.now() - spendingState.sessionStart) / 60000),
  }
}

/**
 * Format spending summary for console output
 */
export function formatSpendingSummary(): string {
  const summary = getSpendingSummary()

  let output = `
========================================
[AUTO-ROUTER] SPENDING SUMMARY (Estimated)
========================================
Total: $${summary.totalEstimated.toFixed(2)} (${summary.requestCount} requests)
Session Duration: ${summary.sessionDurationMinutes} minutes
----------------------------------------`

  // Top models by cost
  const sortedModels = Object.entries(summary.byModel)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  output += "\n\nTop Models by Cost:"
  for (const [model, cost] of sortedModels) {
    const modelShort = model.split("/").pop() || model
    output += `\n  ${modelShort}: $${cost.toFixed(2)}`
  }

  // By provider
  output += "\n\nBy Provider:"
  for (const [provider, cost] of Object.entries(summary.byProvider)) {
    output += `\n  ${provider}: $${cost.toFixed(2)}`
  }

  output += "\n\n(Note: Estimates based on avg token usage)"
  output += "\n========================================"

  return output
}

/**
 * Reset spending tracker (e.g., for new session)
 */
export function resetSpendingTracker(): void {
  spendingState.totalEstimatedCost = 0
  spendingState.lastMilestoneNotified = 0
  spendingState.requestCount = 0
  spendingState.costByModel = {}
  spendingState.costByProvider = {}
  spendingState.sessionStart = Date.now()
  log("[Spending] Tracker reset")
}
