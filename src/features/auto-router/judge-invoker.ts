/**
 * Judge Invoker
 * Integrates LLM-as-judge evaluation into the execution flow
 */

import type {
  TaskClassification,
  JudgeEvaluation,
  RubricCategory,
  BudgetTier,
} from "./types"
import {
  generateJudgePrompt,
  parseJudgeResponse,
  getQualityThreshold,
  passesQualityGate,
  getApplicableRubrics,
} from "./judge-rubrics"
import { BUDGET_TIERS } from "./constants"
import { log } from "../../shared/logger"

// ============================================================================
// Types
// ============================================================================

export interface JudgeInvocationResult {
  invoked: boolean
  /**
   * Pass/fail result.
   * - true: Passed quality gate
   * - false: Failed quality gate OR error occurred
   * - null: Not evaluated (disabled, skipped, no invoker)
   */
  passed: boolean | null
  /** True if judge was skipped (disabled, no invoker) */
  skipped?: boolean
  /** True if an error occurred during evaluation */
  error?: boolean
  evaluation?: JudgeEvaluation
  prompt?: string
  rawResponse?: string
  threshold: number
  reason: string
}

export interface JudgeInvokerOptions {
  enabled: boolean
  budgetTier: BudgetTier
  customThreshold?: number
  focusRubrics?: RubricCategory[]
  strictMode?: boolean
}

/**
 * Function signature for the actual LLM call
 * This should be provided by the consumer (e.g., the hook)
 */
export type LLMInvoker = (prompt: string, model: string) => Promise<string>

// ============================================================================
// Judge Invocation
// ============================================================================

/**
 * Invoke the LLM judge to evaluate code quality
 *
 * @param classification - Task classification result
 * @param taskDescription - Original task description
 * @param codeOutput - The code/output to evaluate
 * @param options - Judge invocation options
 * @param llmInvoker - Function to call the LLM (provided by consumer)
 */
export async function invokeJudge(
  classification: TaskClassification,
  taskDescription: string,
  codeOutput: string,
  options: JudgeInvokerOptions,
  llmInvoker?: LLMInvoker
): Promise<JudgeInvocationResult> {
  // Check if judge should be invoked
  if (!options.enabled) {
    return {
      invoked: false,
      passed: null,  // Not evaluated, NOT fake success
      skipped: true,
      threshold: 0,
      reason: "Judge disabled in options",
    }
  }

  // Determine threshold
  const threshold = options.customThreshold ?? getQualityThreshold(
    classification,
    options.budgetTier
  )

  // If no LLM invoker provided, we can only generate the prompt
  if (!llmInvoker) {
    const prompt = generateJudgePrompt(
      classification,
      taskDescription,
      codeOutput,
      {
        focusRubrics: options.focusRubrics,
        strictMode: options.strictMode,
      }
    )

    return {
      invoked: false,
      passed: null,  // Not evaluated, NOT fake success
      skipped: true,
      prompt,
      threshold,
      reason: "No LLM invoker provided - prompt generated for manual evaluation",
    }
  }

  // Determine which model to use for judging
  const budgetConfig = BUDGET_TIERS[options.budgetTier]
  const judgeModel = budgetConfig.models.judge

  // Generate the judge prompt
  const prompt = generateJudgePrompt(
    classification,
    taskDescription,
    codeOutput,
    {
      focusRubrics: options.focusRubrics,
      strictMode: options.strictMode,
    }
  )

  log("[JudgeInvoker] Invoking LLM judge", {
    model: judgeModel,
    projectType: classification.projectType,
    strictMode: options.strictMode,
  })

  try {
    // Call the LLM
    const rawResponse = await llmInvoker(prompt, judgeModel)

    // Parse the response
    const parseResult = parseJudgeResponse(rawResponse)

    if (!parseResult.success || !parseResult.evaluation) {
      log("[JudgeInvoker] Failed to parse judge response", {
        error: parseResult.error?.message,
      })

      return {
        invoked: true,
        passed: false,  // Parse error = FAIL, not fake success
        error: true,
        prompt,
        rawResponse,
        threshold,
        reason: `Judge response parse error: ${parseResult.error?.message ?? "unknown"}`,
      }
    }

    const evaluation = parseResult.evaluation

    // Check if passes quality gate
    const passed = passesQualityGate(evaluation, threshold)

    log("[JudgeInvoker] Judge evaluation complete", {
      overallScore: evaluation.overallScore,
      threshold,
      passed,
    })

    return {
      invoked: true,
      passed,
      evaluation,
      prompt,
      rawResponse,
      threshold,
      reason: passed
        ? `Quality score ${evaluation.overallScore.toFixed(2)} >= threshold ${threshold}`
        : `Quality score ${evaluation.overallScore.toFixed(2)} < threshold ${threshold}`,
    }
  } catch (err) {
    log("[JudgeInvoker] Error invoking judge", {
      error: err instanceof Error ? err.message : String(err),
    })

    return {
      invoked: true,
      passed: false,  // Error = FAIL, not fake success
      error: true,
      prompt,
      threshold,
      reason: `Judge invocation error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Check if judge should be invoked based on classification
 */
export function shouldInvokeJudge(
  classification: TaskClassification,
  hasTests: boolean,
  hasBuildGates: boolean
): { shouldInvoke: boolean; reason: string } {
  // Always invoke for security-sensitive or crypto tasks
  if (classification.domainSignals.includes("security-sensitive")) {
    return {
      shouldInvoke: true,
      reason: "Security-sensitive domain requires quality verification",
    }
  }

  if (classification.domainSignals.includes("crypto-trading")) {
    return {
      shouldInvoke: true,
      reason: "Crypto-trading domain requires maximum quality verification",
    }
  }

  // Invoke if classification says so
  if (classification.needsLlmJudge) {
    return {
      shouldInvoke: true,
      reason: "Task classification indicates LLM judge needed",
    }
  }

  // Don't invoke if we have good automated verification
  if (hasTests && hasBuildGates) {
    return {
      shouldInvoke: false,
      reason: "Automated verification (tests + build) available",
    }
  }

  // Invoke for complex tasks without full verification
  if (classification.complexityTier >= 2 && !hasTests) {
    return {
      shouldInvoke: true,
      reason: "Complex task without test coverage",
    }
  }

  return {
    shouldInvoke: false,
    reason: "Standard task with adequate verification",
  }
}

/**
 * Create a summary of the judge evaluation for display
 */
export function formatJudgeResult(result: JudgeInvocationResult): string {
  if (!result.invoked || result.skipped) {
    return `Judge: Skipped (${result.reason})`
  }

  if (result.error) {
    return `Judge: ❌ ERROR (${result.reason})`
  }

  if (!result.evaluation) {
    return `Judge: ❌ No evaluation (${result.reason})`
  }

  const { evaluation, threshold } = result
  const status = result.passed === true ? "✅ PASSED" : "❌ FAILED"

  let output = `Judge Evaluation: ${status}
Overall Score: ${evaluation.overallScore.toFixed(2)} / ${threshold.toFixed(2)} threshold
`

  if (Object.keys(evaluation.rubricScores).length > 0) {
    output += "\nRubric Scores:\n"
    for (const [rubric, data] of Object.entries(evaluation.rubricScores)) {
      output += `  - ${rubric}: ${data.total.toFixed(2)}\n`
    }
  }

  if (evaluation.criticalIssues.length > 0) {
    output += "\nCritical Issues:\n"
    for (const issue of evaluation.criticalIssues) {
      output += `  - ${issue}\n`
    }
  }

  if (evaluation.suggestions.length > 0) {
    output += "\nSuggestions:\n"
    for (const suggestion of evaluation.suggestions) {
      output += `  - ${suggestion}\n`
    }
  }

  return output.trim()
}

/**
 * Get the rubrics that will be used for a given project type
 */
export function getJudgeRubrics(projectType: string): RubricCategory[] {
  return getApplicableRubrics(projectType as any)
}
