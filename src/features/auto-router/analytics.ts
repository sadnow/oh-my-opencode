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
