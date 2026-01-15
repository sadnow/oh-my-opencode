/**
 * Task Classifier
 * Analyzes task descriptions to determine complexity and requirements
 */

import type {
  TaskClassification,
  ProjectContext,
  ComplexityTier,
  NoveltyLevel,
  DomainSignal,
  ComplexitySignals,
  ParallelizationPotential,
  RiskLevel,
} from "./types"
import {
  DOMAIN_SIGNAL_KEYWORDS,
  COMPLEXITY_STEP_INDICATORS,
  COMPLEXITY_CONDITIONAL_WORDS,
  COMPLEXITY_INTEGRATION_KEYWORDS,
  COMPLEXITY_RESEARCH_KEYWORDS,
  COMPLEXITY_ARCHITECTURE_KEYWORDS,
} from "./constants"
import {
  detectProjectType,
  buildProjectContext,
  detectVerificationCapabilities,
  detectProjectMaturity,
} from "./project-detector"

/**
 * Main classification function
 */
export async function classifyTask(
  taskDescription: string,
  directory: string
): Promise<TaskClassification> {
  // Build project context
  const context = await buildProjectContext(directory)

  // Detect project type
  const { projectType } = await detectProjectType(directory)

  // Detect project maturity
  const projectMaturity = detectProjectMaturity(context)

  // Assess complexity (pass length for length-based boost)
  const complexitySignals = extractComplexitySignals(taskDescription)
  const complexityScore = calculateComplexityScore(complexitySignals, taskDescription.length)
  const complexityTier = scoreToTier(complexityScore)
  const estimatedSteps = estimateStepCount(taskDescription)

  // Assess novelty
  const noveltyLevel = assessNovelty(taskDescription, context)

  // Detect verification capabilities
  const verificationCaps = detectVerificationCapabilities(context)
  const needsLlmJudge = determineNeedsLlmJudge(taskDescription, verificationCaps)

  // Assess resource requirements
  const parallelizationPotential = assessParallelization(taskDescription)
  const contextExhaustionRisk = assessContextRisk(taskDescription, complexityTier)

  // Extract domain signals
  const domainSignals = extractDomainSignals(taskDescription)

  return {
    projectType,
    projectMaturity,
    complexityTier,
    estimatedSteps,
    noveltyLevel,
    ...verificationCaps,
    needsLlmJudge,
    parallelizationPotential,
    contextExhaustionRisk,
    domainSignals,
    complexityScore,
  }
}

/**
 * Extract complexity signals from task description
 */
export function extractComplexitySignals(taskDescription: string): ComplexitySignals {
  // Guard against null/undefined input
  if (!taskDescription) {
    return {
      stepIndicators: 0,
      conditionalWords: 0,
      integrationKeywords: 0,
      mentionedFiles: 0,
      mentionedModules: 0,
      mentionedExternalServices: 0,
      requiresResearch: false,
      requiresArchitecturalDecisions: false,
      hasPerformanceConstraints: false,
      hasSecurityImplications: false,
    }
  }
  const lowerText = taskDescription.toLowerCase()

  // Count step indicators
  const stepIndicators = COMPLEXITY_STEP_INDICATORS.reduce(
    (count, word) => count + countOccurrences(lowerText, word),
    0
  )

  // Count conditional words
  const conditionalWords = COMPLEXITY_CONDITIONAL_WORDS.reduce(
    (count, word) => count + countOccurrences(lowerText, word),
    0
  )

  // Count integration keywords
  const integrationKeywords = COMPLEXITY_INTEGRATION_KEYWORDS.reduce(
    (count, word) => count + countOccurrences(lowerText, word),
    0
  )

  // Estimate mentioned files/modules/services
  const mentionedFiles = countFileReferences(taskDescription)
  const mentionedModules = countModuleReferences(taskDescription)
  const mentionedExternalServices = countExternalServices(taskDescription)

  // Check domain complexity flags
  const requiresResearch = COMPLEXITY_RESEARCH_KEYWORDS.some((w) =>
    lowerText.includes(w)
  )
  const requiresArchitecturalDecisions = COMPLEXITY_ARCHITECTURE_KEYWORDS.some(
    (w) => lowerText.includes(w)
  )
  const hasPerformanceConstraints =
    lowerText.includes("performance") ||
    lowerText.includes("optimize") ||
    lowerText.includes("fast") ||
    lowerText.includes("efficient")
  const hasSecurityImplications =
    lowerText.includes("security") ||
    lowerText.includes("auth") ||
    lowerText.includes("permission") ||
    lowerText.includes("encrypt")

  return {
    stepIndicators,
    conditionalWords,
    integrationKeywords,
    mentionedFiles,
    mentionedModules,
    mentionedExternalServices,
    requiresResearch,
    requiresArchitecturalDecisions,
    hasPerformanceConstraints,
    hasSecurityImplications,
  }
}

/**
 * Calculate complexity score from signals
 *
 * Scoring algorithm:
 * 1. Add base points for step/scope/domain complexity
 * 2. Add length-based complexity (long prompts = complex tasks)
 * 3. Calculate a SINGLE combined multiplier from domain flags
 * 4. Apply multiplier once to avoid exponential inflation
 *
 * Tier boundaries: <5 = Tier 1, 5-15 = Tier 2, >15 = Tier 3
 */
export function calculateComplexityScore(
  signals: ComplexitySignals,
  taskDescriptionLength?: number
): number {
  let score = 0

  // Step complexity (0-10 points typical)
  score += Math.min(signals.stepIndicators, 5)      // Max 5 points
  score += signals.conditionalWords * 0.5           // 0.5 per conditional
  score += signals.integrationKeywords * 2          // 2 per integration keyword

  // Scope complexity (0-15 points typical)
  score += Math.min(signals.mentionedFiles, 10) * 0.3  // Max 3 points
  score += signals.mentionedModules * 1.5              // 1.5 per module
  score += signals.mentionedExternalServices * 3       // 3 per external service

  // LENGTH-BASED COMPLEXITY BOOST (v3.5.1)
  // Long, detailed prompts indicate complex tasks
  // Short prompts (<100 chars): no boost
  // Medium prompts (100-500 chars): +2-5 points
  // Long prompts (500-1500 chars): +5-10 points
  // Very long prompts (>1500 chars): +10-15 points (auto Tier 3)
  if (taskDescriptionLength) {
    if (taskDescriptionLength > 1500) {
      score += 15  // Very long = definitely complex
    } else if (taskDescriptionLength > 500) {
      score += 5 + Math.floor((taskDescriptionLength - 500) / 200)  // 5-10 points
    } else if (taskDescriptionLength > 100) {
      score += Math.floor((taskDescriptionLength - 100) / 100)  // 0-4 points
    }
  }

  // Domain complexity - add base points for each flag
  if (signals.requiresResearch) score += 3
  if (signals.requiresArchitecturalDecisions) score += 5
  if (signals.hasPerformanceConstraints) score += 2
  if (signals.hasSecurityImplications) score += 3

  // Calculate SINGLE combined multiplier (additive bonuses, not multiplicative)
  // Each flag adds to the multiplier: base 1.0 + 0.15 per flag
  // Max multiplier with all 4 flags: 1.0 + (4 * 0.15) = 1.6x
  let multiplier = 1.0
  if (signals.requiresResearch) multiplier += 0.15
  if (signals.requiresArchitecturalDecisions) multiplier += 0.2
  if (signals.hasPerformanceConstraints) multiplier += 0.1
  if (signals.hasSecurityImplications) multiplier += 0.15

  // Apply the single combined multiplier
  score *= multiplier

  // Cap score at reasonable maximum to prevent tier boundary issues
  // Maximum expected: ~45 points base + 1.6x multiplier = ~72
  // Cap at 75 to handle edge cases but prevent extreme outliers
  return Math.max(0, Math.min(score, 75))
}

/**
 * Convert complexity score to tier
 *
 * Tier boundaries rationale:
 * - Tier 1 (score < 5): Simple tasks - single file changes, bug fixes, small features.
 *   Typically 1-2 step indicators, no external services, no special domain concerns.
 *   Can use "direct" execution or basic "ulw" mode.
 *
 * - Tier 2 (score 5-15): Moderate tasks - multi-file changes, feature implementation.
 *   Multiple step indicators, may involve 1-2 modules or external services.
 *   Benefits from "ulw" parallel exploration and TDD workflow.
 *
 * - Tier 3 (score >= 15): Complex tasks - architectural changes, full feature suites.
 *   Many steps, multiple modules/services, domain complexity flags.
 *   Requires full orchestration ("triple" mode) with ultrathink + ulw + ralph.
 *
 * Score composition (see calculateComplexityScore):
 * - Step indicators: up to 5 points
 * - Conditional words: 0.5 per word
 * - Integration keywords: 2 per keyword
 * - File references: 0.3 per file (max 3 points)
 * - Module references: 1.5 per module
 * - External services: 3 per service
 * - Domain flags: 2-5 points each + 10-60% multiplier
 *
 * Future: Consider making thresholds configurable via AutoRouterConfig.
 */
export function scoreToTier(score: number): ComplexityTier {
  if (score < 5) return 1
  if (score < 15) return 2
  return 3
}

/**
 * Estimate number of steps in the task
 */
export function estimateStepCount(taskDescription: string): number {
  const lowerText = taskDescription.toLowerCase()

  // Count explicit step indicators
  let steps = 1 // At least one step

  // Count "and" conjunctions that might indicate separate tasks
  steps += countOccurrences(lowerText, " and ")

  // Count bullet points or numbered items
  const bulletMatches = taskDescription.match(/^[-*•]\s/gm)
  if (bulletMatches) steps += bulletMatches.length

  const numberMatches = taskDescription.match(/^\d+[.)]\s/gm)
  if (numberMatches) steps += numberMatches.length

  // Count step-related words
  for (const word of COMPLEXITY_STEP_INDICATORS) {
    if (lowerText.includes(word)) steps++
  }

  return Math.min(steps, 20) // Cap at reasonable number
}

/**
 * Assess novelty level
 */
export function assessNovelty(
  taskDescription: string,
  context: ProjectContext
): NoveltyLevel {
  const lowerText = taskDescription.toLowerCase()

  // Check for novel/research indicators
  const novelIndicators = [
    "new",
    "create",
    "build",
    "implement",
    "design",
    "invent",
    "novel",
    "custom",
    "unique",
  ]
  const novelCount = novelIndicators.filter((w) => lowerText.includes(w)).length

  // Check for familiar indicators
  const familiarIndicators = [
    "fix",
    "update",
    "change",
    "modify",
    "add",
    "remove",
    "refactor",
    "improve",
  ]
  const familiarCount = familiarIndicators.filter((w) =>
    lowerText.includes(w)
  ).length

  // Check for known indicators
  const knownIndicators = [
    "like",
    "similar to",
    "same as",
    "standard",
    "common",
    "typical",
    "usual",
  ]
  const knownCount = knownIndicators.filter((w) => lowerText.includes(w)).length

  // Determine based on counts
  if (knownCount > novelCount && knownCount > familiarCount) return "known"
  if (familiarCount > novelCount) return "familiar"
  return "novel"
}

/**
 * Determine if LLM judge is needed
 */
export function determineNeedsLlmJudge(
  taskDescription: string,
  verificationCaps: ReturnType<typeof detectVerificationCapabilities>
): boolean {
  const lowerText = taskDescription.toLowerCase()

  // If no tests and no build, probably need LLM judge
  if (!verificationCaps.hasTests && !verificationCaps.hasBuildGates) {
    return true
  }

  // Check for subjective quality indicators
  const subjectiveIndicators = [
    "quality",
    "clean",
    "readable",
    "maintainable",
    "elegant",
    "good",
    "better",
    "improve",
    "polish",
    "beautiful",
    "nice",
    "professional",
  ]

  return subjectiveIndicators.some((w) => lowerText.includes(w))
}

/**
 * Assess parallelization potential
 */
export function assessParallelization(
  taskDescription: string
): ParallelizationPotential {
  const lowerText = taskDescription.toLowerCase()

  // High potential indicators
  const highIndicators = [
    "multiple",
    "several",
    "various",
    "different",
    "each",
    "all",
    "every",
    "both",
  ]
  const highCount = highIndicators.filter((w) => lowerText.includes(w)).length

  // Low potential indicators
  const lowIndicators = [
    "sequential",
    "step by step",
    "one at a time",
    "depends on",
    "after",
    "then",
  ]
  const lowCount = lowIndicators.filter((w) => lowerText.includes(w)).length

  if (highCount > lowCount + 1) return "high"
  if (highCount > 0) return "low"
  return "none"
}

/**
 * Assess context exhaustion risk
 */
export function assessContextRisk(
  taskDescription: string,
  complexityTier: ComplexityTier
): RiskLevel {
  const length = taskDescription.length

  // Long descriptions = higher risk
  if (length > 2000) return "high"
  if (length > 500 && complexityTier >= 2) return "high"
  if (length > 200 && complexityTier === 3) return "high"
  if (complexityTier === 3) return "medium"
  if (complexityTier === 2) return "low"
  return "low"
}

/**
 * Extract domain signals from task description
 */
export function extractDomainSignals(taskDescription: string): DomainSignal[] {
  const lowerText = taskDescription.toLowerCase()
  const signals: DomainSignal[] = []

  for (const [signal, keywords] of Object.entries(DOMAIN_SIGNAL_KEYWORDS)) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      signals.push(signal as DomainSignal)
    }
  }

  return signals
}

// ============================================================================
// Helper Functions
// ============================================================================

function countOccurrences(text: string, word: string): number {
  const regex = new RegExp(word, "gi")
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function countFileReferences(text: string): number {
  // Count file extensions mentioned
  const fileExtensions = text.match(/\.[a-z]{2,4}\b/gi)
  return fileExtensions ? fileExtensions.length : 0
}

function countModuleReferences(text: string): number {
  // Count potential module/component names (PascalCase or path-like)
  const pascalCase = text.match(/\b[A-Z][a-z]+[A-Z][a-zA-Z]*/g)
  const pathLike = text.match(/\b[a-z]+\/[a-z]+/gi)
  return (pascalCase?.length || 0) + (pathLike?.length || 0)
}

function countExternalServices(text: string): number {
  const services = [
    "api",
    "database",
    "redis",
    "postgres",
    "mysql",
    "mongodb",
    "firebase",
    "supabase",
    "aws",
    "gcp",
    "azure",
    "stripe",
    "twilio",
    "sendgrid",
    "oauth",
    "openai",
    "anthropic",
    "cloudflare",
  ]
  const lowerText = text.toLowerCase()
  return services.filter((s) => lowerText.includes(s)).length
}
