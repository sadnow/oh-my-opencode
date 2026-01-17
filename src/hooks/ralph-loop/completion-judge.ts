/**
 * Completion Criteria Judge
 *
 * An LLM-as-judge that verifies the original prompt requirements
 * against the claimed completion message BEFORE allowing ralph-loop exit.
 *
 * This prevents premature "DONE" claims when requirements aren't met.
 */

import { log } from "../../shared/logger"
import type { LLMInvoker } from "../../features/auto-router/judge-invoker"
import type { CompletionJudgeConfig } from "../../config"

// ============================================================================
// Types
// ============================================================================

export interface RequirementStatus {
  requirement: string
  status: "met" | "unmet" | "unclear"
  evidence: string
}

export interface CompletionJudgeResult {
  isComplete: boolean
  requirements: RequirementStatus[]
  unmetCriteria: string[]
  contradictions: string[]
  confidence: number  // 0-1, require >0.8 to pass
  reasoning: string
  rawResponse?: string
}

// Re-export for convenience
export type { CompletionJudgeConfig }

export const DEFAULT_COMPLETION_JUDGE_CONFIG: CompletionJudgeConfig = {
  enabled: true,  // Enabled by default - uses fallback models if primary fails
  min_confidence: 0.8,
  model: "github-copilot/gpt-4o",       // Primary model (gpt-4o-mini not available via Copilot)
  fallback_models: [
    "google/antigravity-gemini-3-flash",  // Free via Antigravity OAuth (AI Studio)
    "openai/gpt-4o-mini",                 // Cheap via OpenAI API
    "opencode/glm-4.7-free",              // Always free fallback
  ],
  timeout_ms: 60000,  // 60 second timeout (increased from 30s for complex tasks)
}

// ============================================================================
// Prompt Template
// ============================================================================

const JUDGE_PROMPT_TEMPLATE = `You are a SKEPTICAL completion verifier. Your job is to determine if a task is TRULY complete.

## Original User Request:
{{ORIGINAL_PROMPT}}

## Claimed Completion Message (last assistant output):
{{COMPLETION_MESSAGE}}

## Instructions:
1. Extract ALL explicit and implicit requirements from the original request
2. For EACH requirement, verify if it was actually completed based on the completion message
3. Look for CONTRADICTIONS in the completion message like:
   - Claims "complete" but mentions "remaining work"
   - Says "done" but admits "need to add X"
   - States "production ready" but lists "TODO items"
   - Says "success" but describes "missing features"
4. Be SKEPTICAL - assume incomplete unless there's clear evidence of completion
5. Pay attention to quantities (e.g., "5 levels" means exactly 5, not 1)

## Required Output (JSON only, no markdown):
{
  "requirements": [
    { "requirement": "description of requirement", "status": "met|unmet|unclear", "evidence": "quote or reasoning" }
  ],
  "contradictions": ["quote any contradictory statements found"],
  "isComplete": true or false,
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of your verdict"
}

CRITICAL RULES:
- Return isComplete=true ONLY if ALL requirements are met
- Return isComplete=false if ANY requirement is unmet or unclear
- Return isComplete=false if ANY contradictions are found
- Confidence should reflect certainty about completion status
- If the completion message is vague about what was done, assume incomplete`

// ============================================================================
// Judge Implementation
// ============================================================================

/**
 * Verify completion criteria by having an LLM judge evaluate
 * whether the original requirements were met.
 */
export async function verifyCompletionCriteria(
  originalPrompt: string,
  completionMessage: string,
  llmInvoker: LLMInvoker,
  config: Partial<CompletionJudgeConfig> = {}
): Promise<CompletionJudgeResult> {
  const finalConfig = { ...DEFAULT_COMPLETION_JUDGE_CONFIG, ...config }

  if (!finalConfig.enabled) {
    log("[completion-judge] Disabled, returning pass")
    return {
      isComplete: true,
      requirements: [],
      unmetCriteria: [],
      contradictions: [],
      confidence: 1.0,
      reasoning: "Judge disabled - auto-pass",
    }
  }

  // Build the prompt
  const prompt = JUDGE_PROMPT_TEMPLATE
    .replace("{{ORIGINAL_PROMPT}}", originalPrompt)
    .replace("{{COMPLETION_MESSAGE}}", completionMessage)

  try {
    // Call LLM with timeout
    const responsePromise = llmInvoker(prompt, finalConfig.model)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Judge timeout")), finalConfig.timeout_ms)
    )

    const rawResponse = await Promise.race([responsePromise, timeoutPromise])

    // Parse the response
    const result = parseJudgeResponse(rawResponse)
    result.rawResponse = rawResponse

    log("[completion-judge] Evaluation complete", {
      isComplete: result.isComplete,
      confidence: result.confidence,
      unmetCount: result.unmetCriteria.length,
      contradictionCount: result.contradictions.length,
    })

    return result
  } catch (error) {
    log("[completion-judge] Error during evaluation", { error: String(error) })

    // On timeout or error, return INCOMPLETE to force retry
    // v3.8.1: Changed from isComplete: true to isComplete: false
    // This prevents premature "DONE" acceptance when judge can't verify
    const isTimeout = String(error).includes("timeout") || String(error).includes("Timeout")
    return {
      isComplete: false,  // Changed: Don't auto-pass on errors
      requirements: [],
      unmetCriteria: [
        isTimeout
          ? "Judge evaluation timed out - unable to verify completion"
          : `Judge evaluation failed: ${String(error).substring(0, 100)}`
      ],
      contradictions: [],
      confidence: 0.0,  // Changed: No confidence when evaluation failed
      reasoning: isTimeout
        ? `Judge timed out after ${finalConfig.timeout_ms / 1000}s. Retry needed.`
        : `Judge evaluation error: ${error}. Task marked incomplete for retry.`,
    }
  }
}

/**
 * Parse the LLM's JSON response into a structured result
 */
function parseJudgeResponse(response: string): CompletionJudgeResult {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    log("[completion-judge] No JSON found in response")
    return createFailedParseResult("No JSON found in judge response")
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    // Validate required fields
    const requirements: RequirementStatus[] = Array.isArray(parsed.requirements)
      ? parsed.requirements.map((r: unknown) => {
          const req = r as Record<string, unknown>
          return {
            requirement: String(req.requirement ?? ""),
            status: (req.status === "met" || req.status === "unmet" || req.status === "unclear")
              ? req.status
              : "unclear",
            evidence: String(req.evidence ?? ""),
          }
        })
      : []

    const contradictions: string[] = Array.isArray(parsed.contradictions)
      ? parsed.contradictions.map(String)
      : []

    const isComplete = parsed.isComplete === true
    const confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5
    const reasoning = String(parsed.reasoning ?? "No reasoning provided")

    // Extract unmet criteria from requirements
    const unmetCriteria = requirements
      .filter(r => r.status === "unmet" || r.status === "unclear")
      .map(r => r.requirement)

    return {
      isComplete,
      requirements,
      unmetCriteria,
      contradictions,
      confidence,
      reasoning,
    }
  } catch (parseError) {
    log("[completion-judge] JSON parse error", { error: String(parseError) })
    return createFailedParseResult(`JSON parse error: ${parseError}`)
  }
}

/**
 * Create a result for when parsing fails
 * v3.8.1: Changed to return isComplete: false to force retry instead of auto-pass
 */
function createFailedParseResult(reason: string): CompletionJudgeResult {
  return {
    isComplete: false,  // Changed: Don't auto-pass on parse errors
    requirements: [],
    unmetCriteria: [`Judge response parse failed: ${reason}`],
    contradictions: [],
    confidence: 0.0,  // Changed: No confidence when parsing failed
    reasoning: `Parse failure: ${reason}. Task marked incomplete for retry.`,
  }
}

/**
 * Check if the judge result indicates true completion
 * Uses both isComplete flag and confidence threshold
 */
export function judgePassed(
  result: CompletionJudgeResult,
  minConfidence: number = 0.8
): boolean {
  // Must be marked complete
  if (!result.isComplete) {
    return false
  }

  // Must have sufficient confidence
  if (result.confidence < minConfidence) {
    return false
  }

  // Must have no contradictions
  if (result.contradictions.length > 0) {
    return false
  }

  // Must have no unmet criteria
  if (result.unmetCriteria.length > 0) {
    return false
  }

  return true
}
