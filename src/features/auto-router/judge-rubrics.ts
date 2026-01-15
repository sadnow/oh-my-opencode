/**
 * LLM-as-Judge Rubrics
 * Defines quality evaluation rubrics with project-type-specific weights
 */

import type {
  ProjectType,
  JudgeRubric,
  RubricCategory,
  JudgeEvaluation,
  TaskClassification,
  BudgetTier,
} from "./types"
import { log } from "../../shared/logger"

// ============================================================================
// Rubric Definitions
// ============================================================================

export const JUDGE_RUBRICS: Record<RubricCategory, JudgeRubric> = {
  "code-architecture": {
    name: "Code Architecture",
    description: "Evaluates structural quality, separation of concerns, and maintainability",
    criteria: [
      {
        name: "Separation of Concerns",
        description: "Clear boundaries between components, single responsibility",
        weight: 0.25,
      },
      {
        name: "Dependency Management",
        description: "Proper dependency injection, avoiding circular dependencies",
        weight: 0.2,
      },
      {
        name: "Extensibility",
        description: "Easy to extend without modifying existing code (Open/Closed)",
        weight: 0.2,
      },
      {
        name: "Naming Clarity",
        description: "Descriptive, consistent naming for files, functions, variables",
        weight: 0.15,
      },
      {
        name: "Pattern Consistency",
        description: "Consistent use of patterns throughout codebase",
        weight: 0.2,
      },
    ],
    projectWeights: {
      game: 0.7,
      "web-app": 0.9,
      "api-server": 1.0,
      bot: 0.8,
      "indexer-crawler": 0.8,
      "data-pipeline": 0.9,
      cli: 0.8,
      "static-site": 0.5,
      library: 1.0,
      monorepo: 1.0,
      unknown: 0.7,
    },
  },

  "api-design": {
    name: "API Design",
    description: "Evaluates interface design, consistency, and usability",
    criteria: [
      {
        name: "Consistency",
        description: "Uniform naming, parameter ordering, return types",
        weight: 0.3,
      },
      {
        name: "Discoverability",
        description: "Intuitive API surface, predictable behavior",
        weight: 0.25,
      },
      {
        name: "Error Handling",
        description: "Clear error responses, appropriate status codes",
        weight: 0.25,
      },
      {
        name: "Versioning",
        description: "Backward compatibility consideration, deprecation strategy",
        weight: 0.2,
      },
    ],
    projectWeights: {
      game: 0.3,
      "web-app": 0.6,
      "api-server": 1.0,
      bot: 0.5,
      "indexer-crawler": 0.4,
      "data-pipeline": 0.6,
      cli: 0.7,
      "static-site": 0.2,
      library: 1.0,
      monorepo: 0.8,
      unknown: 0.5,
    },
  },

  "error-handling": {
    name: "Error Handling",
    description: "Evaluates robustness, recovery strategies, and failure modes",
    criteria: [
      {
        name: "Coverage",
        description: "All potential failure points have error handling",
        weight: 0.3,
      },
      {
        name: "Recovery Strategy",
        description: "Graceful degradation, retry logic, fallbacks",
        weight: 0.3,
      },
      {
        name: "Logging",
        description: "Appropriate error logging for debugging",
        weight: 0.2,
      },
      {
        name: "User Feedback",
        description: "Clear, actionable error messages for end users",
        weight: 0.2,
      },
    ],
    projectWeights: {
      game: 0.6,
      "web-app": 0.9,
      "api-server": 1.0,
      bot: 0.9,
      "indexer-crawler": 1.0,
      "data-pipeline": 1.0,
      cli: 0.8,
      "static-site": 0.4,
      library: 0.9,
      monorepo: 0.8,
      unknown: 0.7,
    },
  },

  "security-posture": {
    name: "Security Posture",
    description: "Evaluates security practices and vulnerability prevention",
    criteria: [
      {
        name: "Input Validation",
        description: "All external inputs validated and sanitized",
        weight: 0.3,
      },
      {
        name: "Secrets Management",
        description: "No hardcoded secrets, proper env var usage",
        weight: 0.25,
      },
      {
        name: "Authentication/Authorization",
        description: "Proper auth implementation where needed",
        weight: 0.25,
      },
      {
        name: "Data Protection",
        description: "Sensitive data encrypted, proper access controls",
        weight: 0.2,
      },
    ],
    projectWeights: {
      game: 0.4,
      "web-app": 1.0,
      "api-server": 1.0,
      bot: 0.7,
      "indexer-crawler": 0.6,
      "data-pipeline": 0.8,
      cli: 0.5,
      "static-site": 0.3,
      library: 0.6,
      monorepo: 0.8,
      unknown: 0.6,
    },
  },

  documentation: {
    name: "Documentation",
    description: "Evaluates code documentation and external docs quality",
    criteria: [
      {
        name: "Completeness",
        description: "All public APIs documented, README present",
        weight: 0.3,
      },
      {
        name: "Accuracy",
        description: "Documentation matches actual behavior",
        weight: 0.25,
      },
      {
        name: "Clarity",
        description: "Easy to understand, well-organized",
        weight: 0.25,
      },
      {
        name: "Examples",
        description: "Working examples for common use cases",
        weight: 0.2,
      },
    ],
    projectWeights: {
      game: 0.4,
      "web-app": 0.6,
      "api-server": 0.9,
      bot: 0.5,
      "indexer-crawler": 0.5,
      "data-pipeline": 0.7,
      cli: 0.8,
      "static-site": 0.6,
      library: 1.0,
      monorepo: 0.9,
      unknown: 0.5,
    },
  },

  "ux-ui-coherence": {
    name: "UX/UI Coherence",
    description: "Evaluates user experience and interface quality",
    criteria: [
      {
        name: "Visual Consistency",
        description: "Consistent styling, spacing, typography",
        weight: 0.25,
      },
      {
        name: "Interaction Patterns",
        description: "Predictable, intuitive interactions",
        weight: 0.25,
      },
      {
        name: "Responsiveness",
        description: "Works across screen sizes, fast feedback",
        weight: 0.25,
      },
      {
        name: "Accessibility",
        description: "Keyboard navigation, screen reader support, color contrast",
        weight: 0.25,
      },
    ],
    projectWeights: {
      game: 0.8,
      "web-app": 1.0,
      "api-server": 0.1,
      bot: 0.4,
      "indexer-crawler": 0.1,
      "data-pipeline": 0.2,
      cli: 0.6,
      "static-site": 0.9,
      library: 0.2,
      monorepo: 0.4,
      unknown: 0.5,
    },
  },
}

// ============================================================================
// Rubric Selection
// ============================================================================

/**
 * Get applicable rubrics for a project type
 */
export function getApplicableRubrics(
  projectType: ProjectType,
  minWeight: number = 0.5
): RubricCategory[] {
  const applicable: RubricCategory[] = []

  for (const [category, rubric] of Object.entries(JUDGE_RUBRICS)) {
    const weight = rubric.projectWeights[projectType]
    if (weight >= minWeight) {
      applicable.push(category as RubricCategory)
    }
  }

  return applicable
}

/**
 * Get weighted rubrics for evaluation
 */
export function getWeightedRubrics(
  projectType: ProjectType
): Array<{ category: RubricCategory; rubric: JudgeRubric; weight: number }> {
  return Object.entries(JUDGE_RUBRICS)
    .map(([category, rubric]) => ({
      category: category as RubricCategory,
      rubric,
      weight: rubric.projectWeights[projectType],
    }))
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}

// ============================================================================
// Judge Prompt Generation
// ============================================================================

/**
 * Generate LLM judge prompt for quality evaluation
 */
export function generateJudgePrompt(
  classification: TaskClassification,
  taskDescription: string,
  codeOutput: string,
  options?: {
    focusRubrics?: RubricCategory[]
    strictMode?: boolean
  }
): string {
  const applicableRubrics = options?.focusRubrics ?? getApplicableRubrics(classification.projectType)
  const strictMode = options?.strictMode ?? false

  const rubricSections = applicableRubrics.map((category) => {
    const rubric = JUDGE_RUBRICS[category]
    const weight = rubric.projectWeights[classification.projectType]
    const criteriaList = rubric.criteria
      .map((c) => `  - ${c.name} (${Math.round(c.weight * 100)}%): ${c.description}`)
      .join("\n")

    return `### ${rubric.name} (Weight: ${Math.round(weight * 100)}%)
${rubric.description}

Criteria:
${criteriaList}`
  }).join("\n\n")

  return `You are an expert code quality evaluator. Assess the following code output against the specified rubrics.

## Task Context
**Project Type**: ${classification.projectType}
**Complexity Tier**: ${classification.complexityTier}
**Domain Signals**: ${classification.domainSignals.join(", ") || "none"}

## Original Task
${taskDescription}

## Code Output to Evaluate
\`\`\`
${codeOutput}
\`\`\`

## Evaluation Rubrics
${rubricSections}

## Instructions
1. Score each applicable rubric criterion from 0.0 to 1.0
2. Provide specific evidence for each score
3. Calculate weighted totals per rubric
4. Determine overall pass/fail recommendation

${strictMode ? "STRICT MODE: Any criterion scoring below 0.6 is an automatic fail." : ""}

## Required Output Format
Respond with ONLY valid JSON in this exact format:
{
  "rubricScores": {
    "<rubric-name>": {
      "criteriaScores": {
        "<criterion-name>": {
          "score": <0.0-1.0>,
          "evidence": "<specific evidence>"
        }
      },
      "total": <weighted-total>,
      "issues": ["<issue1>", "<issue2>"]
    }
  },
  "overallScore": <0.0-1.0>,
  "passRecommendation": <true|false>,
  "criticalIssues": ["<issue1>", "<issue2>"],
  "suggestions": ["<suggestion1>", "<suggestion2>"]
}`
}

// ============================================================================
// Evaluation Parsing
// ============================================================================

/**
 * Result type for judge response parsing
 */
export interface ParseJudgeResult {
  success: boolean
  evaluation?: JudgeEvaluation
  error?: {
    type: "json_parse" | "validation" | "extraction"
    message: string
    rawResponse?: string
  }
}

/**
 * Parse LLM judge response into structured evaluation
 * Returns structured result with error details for debugging
 */
export function parseJudgeResponse(response: string): ParseJudgeResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    // Attempt to parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr.trim())
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
      log("[JudgeRubrics] Failed to parse judge response JSON", {
        error: errorMessage,
        responseLength: response.length,
        responsePreview: response.substring(0, 200),
      })
      return {
        success: false,
        error: {
          type: "json_parse",
          message: `JSON parse failed: ${errorMessage}`,
          rawResponse: response.substring(0, 500),
        },
      }
    }

    // Type guard for parsed object
    if (!parsed || typeof parsed !== "object") {
      log("[JudgeRubrics] Invalid judge response structure", {
        type: typeof parsed,
      })
      return {
        success: false,
        error: {
          type: "validation",
          message: "Response is not an object",
        },
      }
    }

    const parsedObj = parsed as Record<string, unknown>

    // Validate required fields
    if (
      typeof parsedObj.overallScore !== "number" ||
      typeof parsedObj.passRecommendation !== "boolean"
    ) {
      log("[JudgeRubrics] Missing required fields in judge response", {
        hasOverallScore: "overallScore" in parsedObj,
        hasPassRecommendation: "passRecommendation" in parsedObj,
        overallScoreType: typeof parsedObj.overallScore,
        passRecommendationType: typeof parsedObj.passRecommendation,
      })
      return {
        success: false,
        error: {
          type: "validation",
          message: "Missing or invalid required fields (overallScore, passRecommendation)",
        },
      }
    }

    return {
      success: true,
      evaluation: {
        rubricScores: (parsedObj.rubricScores as JudgeEvaluation["rubricScores"]) || {},
        overallScore: Math.max(0, Math.min(1, parsedObj.overallScore)),
        passRecommendation: parsedObj.passRecommendation,
        criticalIssues: (parsedObj.criticalIssues as string[]) || [],
        suggestions: (parsedObj.suggestions as string[]) || [],
        timestamp: new Date(),
      },
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log("[JudgeRubrics] Unexpected error parsing judge response", {
      error: errorMessage,
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 3).join("\n") : undefined,
    })
    return {
      success: false,
      error: {
        type: "extraction",
        message: `Unexpected error: ${errorMessage}`,
      },
    }
  }
}

// ============================================================================
// Quality Thresholds
// ============================================================================

/**
 * Get quality threshold for a given context
 *
 * Algorithm:
 * 1. Start with base threshold for budget tier
 * 2. Calculate domain-based minimum threshold
 * 3. Calculate complexity adjustment
 * 4. Apply minimum (domain) and maximum (complexity) bounds ONCE at end
 *
 * This prevents unexpected interactions from sequential Math.max/Math.min calls
 */
export function getQualityThreshold(
  classification: TaskClassification,
  budgetTier: BudgetTier
): number {
  // Base threshold by budget tier
  const baseThresholds: Record<BudgetTier, number> = {
    free: 0.5,      // Lower threshold for free models
    cheap: 0.6,
    moderate: 0.7,
    expensive: 0.8,
    maximum: 0.85,
  }

  const baseThreshold = baseThresholds[budgetTier]

  // Calculate domain-based minimum threshold
  let domainMinimum = 0
  if (classification.domainSignals.includes("security-sensitive")) {
    domainMinimum = Math.max(domainMinimum, 0.8)
  }
  if (classification.domainSignals.includes("crypto-trading")) {
    domainMinimum = Math.max(domainMinimum, 0.85)
  }

  // Calculate complexity adjustment (additive)
  let complexityAdjustment = 0
  if (classification.complexityTier === 3) {
    complexityAdjustment = 0.05
  }

  // Compute final threshold:
  // Start with base, apply complexity adjustment, then enforce domain minimum
  let threshold = baseThreshold + complexityAdjustment

  // Enforce domain minimum (high-risk domains have higher floor)
  threshold = Math.max(threshold, domainMinimum)

  // Apply absolute bounds (never below 0.5, never above 0.95)
  threshold = Math.max(0.5, Math.min(0.95, threshold))

  return threshold
}

/**
 * Determine if evaluation passes quality gate
 */
export function passesQualityGate(
  evaluation: JudgeEvaluation,
  threshold: number,
  options?: {
    requireAllRubrics?: boolean
    minRubricScore?: number
  }
): boolean {
  // Check overall score
  if (evaluation.overallScore < threshold) {
    return false
  }

  // Check individual rubric scores if required
  if (options?.requireAllRubrics && options?.minRubricScore) {
    for (const rubricData of Object.values(evaluation.rubricScores)) {
      if (rubricData.total < options.minRubricScore) {
        return false
      }
    }
  }

  // Check critical issues
  if (evaluation.criticalIssues.length > 0) {
    return false
  }

  return evaluation.passRecommendation
}

// ============================================================================
// Rubric Summary Generation
// ============================================================================

/**
 * Generate human-readable summary of applicable rubrics
 */
export function generateRubricSummary(projectType: ProjectType): string {
  const weighted = getWeightedRubrics(projectType)
  const lines = weighted
    .filter((r) => r.weight >= 0.5)
    .map((r) => `- **${r.rubric.name}** (${Math.round(r.weight * 100)}%): ${r.rubric.description}`)

  return lines.join("\n")
}

/**
 * Generate compact rubric list for injection template
 */
export function generateCompactRubricList(projectType: ProjectType): string {
  const weighted = getWeightedRubrics(projectType)
  return weighted
    .filter((r) => r.weight >= 0.5)
    .map((r) => `${r.rubric.name} (${Math.round(r.weight * 100)}%)`)
    .join(", ")
}
