/**
 * Auto-Router - Intelligent Task Router for Oh-My-OpenCode
 *
 * Automatically analyzes task descriptions and routes them to the optimal
 * technique combination (direct/ulw/ultrathink/ralph/combinations) with
 * adaptive budget escalation.
 */

// Export types
export type {
  ProjectType,
  TechniqueCombo,
  BudgetTier,
  BudgetTierConfig,
  TaskClassification,
  JudgeRubric,
  JudgeEvaluation,
  RubricCategory,
  EscalationDecision,
  AttemptResult,
  AttemptHistory,
  DomainSignal,
  ComplexityTier,
  NoveltyLevel,
  ProjectContext,
  DetectionResult,
  AutoRouterConfig,
} from "./types"

// Export constants
export {
  PROJECT_DETECTION_PATTERNS,
  DOMAIN_SIGNAL_KEYWORDS,
  TECHNIQUE_SELECTION_MATRIX,
  DOMAIN_TECHNIQUE_OVERRIDES,
  BUDGET_TIERS,
  ESCALATION_RULES,
  TECHNIQUE_INSTRUCTIONS,
  AUTO_ROUTER_INJECTION_TEMPLATE,
  COMPLEXITY_DESCRIPTIONS,
  DEFAULT_AUTO_ROUTER_CONFIG,
  MAGIC_KEYWORDS,
  DEVELOPMENT_PRESETS,
  type DevelopmentPreset,
  // Model config helpers (for chat.params hook)
  getBudgetTierModelConfig,
  parseModelString,
  type ModelConfig,
  // Agent-based model switching (v3.5.0)
  BUDGET_TIER_AGENTS,
  getAgentForBudgetTier,
  // Parallel agent config (v3.5.0, enhanced v3.8.0)
  DEFAULT_PARALLEL_AGENTS,
  DEFAULT_MAX_PARALLEL_AGENTS,
  DEFAULT_PARALLEL_AGENT_CONFIG,
  type ParallelAgentConfig,
  // v3.8.0: Provider-aware parallel agent selection
  AGENTS_PER_PROVIDER,
  AGENT_PROVIDER_MAPPINGS,
  type AgentProviderMapping,
  selectAgentsForTask,
  getMaxAgentsForTier,
  calculateMaxConcurrentAgents,
  getProviderAgentAllocation,
  // Orchestrator & subagent delegation (v3.7.0)
  ORCHESTRATOR_MODEL_RECOMMENDATION,
  SUBAGENT_DELEGATION_TEMPLATE,
  NO_DELEGATION_TEMPLATE,
  // Model ID validation (v3.8.0)
  validateModelId,
  KNOWN_MODELS,
  type ModelValidationResult,
} from "./constants"

// Export classifier functions
export {
  classifyTask,
  classifyTaskWithIntent,
  extractComplexitySignals,
  calculateComplexityScore,
  scoreToTier,
  estimateStepCount,
  assessNovelty,
  determineNeedsLlmJudge,
  assessParallelization,
  assessContextRisk,
  extractDomainSignals,
  extractTaskIntent,
  filterDomainSignalsByIntent,
  mergeIntents,
  type TaskIntentResult,
  type IntentAwareClassification,
} from "./classifier"

// Export project detector functions
export {
  detectProjectType,
  buildProjectContext,
  detectVerificationCapabilities,
  detectProjectMaturity,
} from "./project-detector"

// Export technique selector functions
export {
  selectTechnique,
  getTechniqueDescription,
  getTechniqueCostLevel,
  techniqueIncludes,
} from "./technique-selector"

// Export escalation manager
export { EscalationManager, createEscalationManager } from "./escalation-manager"

// Export judge rubrics
export {
  JUDGE_RUBRICS,
  getApplicableRubrics,
  getWeightedRubrics,
  generateJudgePrompt,
  parseJudgeResponse,
  getQualityThreshold,
  passesQualityGate,
  generateRubricSummary,
  generateCompactRubricList,
  type ParseJudgeResult,
} from "./judge-rubrics"

// Export analytics
export {
  recordExecution,
  updateExecution,
  getTechniqueStats,
  getAnalyticsSummary,
  getRecommendedTechnique,
  clearAnalytics,
  exportAnalytics,
  importAnalytics,
  // Subagent analytics (v3.7.0)
  recordSubagentExecution,
  updateSubagentExecution,
  getSubagentExecution,
  getSubagentStats,
  formatSubagentAnalytics,
  clearSubagentAnalytics,
  exportSubagentAnalytics,
  importSubagentAnalytics,
  // Spending tracking (v3.8.0)
  recordModelUsage,
  checkSpendingMilestone,
  getSpendingSummary,
  formatSpendingSummary,
  resetSpendingTracker,
  PROVIDER_COST_RATES,
  type SpendingMilestone,
  type ExecutionRecord,
  type TechniqueStats,
  type AnalyticsSummary,
  type SubagentExecutionRecord,
  type SubagentAnalyticsSummary,
} from "./analytics"

// Export preset selector
export {
  selectPreset,
  getAvailablePresets,
  getPreset,
  applyPresetAdjustments,
  matchesPresetCriteria,
  type PresetSelection,
} from "./preset-selector"

// Export judge invoker
export {
  invokeJudge,
  shouldInvokeJudge,
  formatJudgeResult,
  getJudgeRubrics,
  type JudgeInvocationResult,
  type JudgeInvokerOptions,
  type LLMInvoker,
} from "./judge-invoker"

// Export semantic search (skeleton for future implementation)
export {
  searchCodeContext,
  findDefinitions,
  findUsageExamples,
  findRelatedCode,
  enhanceClassificationWithContext,
  initializeSemanticSearch,
  getSemanticSearchStatus,
  setSemanticSearchProvider,
  getSemanticSearchProvider,
  type SemanticSearchResult,
  type SemanticSearchQuery,
  type EnhancedClassification,
  type CodePattern,
  type SemanticSearchProvider,
  type ProviderStatus,
} from "./semantic-search"

// Export wizard
export {
  getWizardQuestions,
  buildConfigFromAnswers,
  createQuickConfig,
  parseWizardFlags,
  mergeWithDefaults,
  createWizardState,
  processWizardAnswer,
  getCurrentQuestion,
  finalizeWizard,
  // v3.3.0: Complexity-aware wizard functions
  shouldEnableRalphLoop,
  selectTechniqueFromClassification,
  getMinBudgetForComplexity,
  buildConfigFromAnswersWithClassification,
  type WizardAnswers,
  type WizardResult,
  type WizardQuestion,
  type WizardState,
} from "./wizard"

// Export production-ready checklist
export {
  verifyProductionReady,
  isProductionReady,
  formatChecklistReport,
  getChecksFromConfig,
  DEFAULT_PRODUCTION_CHECKS,
  type ProductionReadyChecks,
  type CheckResult,
  type ChecklistResult,
  type CheckContext,
} from "./production-ready"

// Export configuration profiles (v3.8.1)
export {
  CONFIG_PROFILES,
  DEFAULT_PROFILE_ID,
  getProfile,
  getProfilesSortedByCost,
  getProfilesByTag,
  recommendProfile,
  PROFILE_CLASSIC,
  PROFILE_CLASSIC_FREE,
  PROFILE_CLASSIC_COPILOT_MAX,
  PROFILE_ULTRA_FRUGAL,
  PROFILE_BUDGET_CONSCIOUS,
  PROFILE_BALANCED,
  PROFILE_QUALITY_FIRST,
  PROFILE_SPEED_DEMON,
  PROFILE_ENTERPRISE,
  PROFILE_GAME_DEV,
  PROFILE_RESEARCH,
  type ConfigProfile,
  type ProviderPriority,
  type BudgetTierOverride,
  type LoggingConfig,
  type EscalationConfig,
} from "./profiles"

// ============================================================================
// Main Auto-Router Interface
// ============================================================================

import type {
  TaskClassification,
  TechniqueCombo,
  BudgetTier,
  AutoRouterConfig,
} from "./types"
import type { AutoRouterSessionContext } from "../../hooks/auto-router/types"
import { classifyTask, classifyTaskWithIntent, type IntentAwareClassification } from "./classifier"
import { selectTechnique, getTechniqueDescription, techniqueIncludes } from "./technique-selector"
import { createEscalationManager, EscalationManager } from "./escalation-manager"
import {
  BUDGET_TIERS,
  TECHNIQUE_INSTRUCTIONS,
  AUTO_ROUTER_INJECTION_TEMPLATE,
  COMPLEXITY_DESCRIPTIONS,
  DEFAULT_AUTO_ROUTER_CONFIG,
  BUDGET_TIER_PRIORITY,
} from "./constants"
import { generateCompactRubricList } from "./judge-rubrics"
import { selectPreset, applyPresetAdjustments, type PresetSelection } from "./preset-selector"
import { getMinBudgetForComplexity } from "./wizard"
import { getRecommendedTechnique } from "./analytics"
import { log } from "../../shared/logger"

/**
 * Auto-Router result containing all routing decisions
 */
export interface AutoRouterResult {
  classification: TaskClassification
  selectedTechnique: TechniqueCombo
  techniqueDescription: string
  startingBudget: BudgetTier
  maxBudget: BudgetTier
  qualityThreshold: number
  injectedPrompt: string
  escalationManager: EscalationManager
  presetApplied: PresetSelection | null
  analyticsRecommendation: TechniqueCombo | null
  /** v3.6.4: Intent-aware classification with task intent and filtered signals */
  intentAwareClassification?: IntentAwareClassification
}

/**
 * Create an auto-router instance and analyze a task
 *
 * @param taskDescription - The task description from /auto command
 * @param directory - Project directory for context detection
 * @param config - Optional auto-router configuration
 * @param sessionContext - v3.6.4: Session context for preserving intents across commands
 */
export async function createAutoRouter(
  taskDescription: string,
  directory: string,
  config?: Partial<AutoRouterConfig>,
  sessionContext?: AutoRouterSessionContext
): Promise<AutoRouterResult> {
  const mergedConfig = { ...DEFAULT_AUTO_ROUTER_CONFIG, ...config }

  // Step 1: Classify the task with intent preservation (v3.6.4)
  // Use classifyTaskWithIntent which merges preserved context
  const enhancedClassification = await classifyTaskWithIntent(
    taskDescription,
    directory,
    sessionContext
  )
  const classification = enhancedClassification as TaskClassification

  // v3.6.4: Log if session context was used
  if (sessionContext?.previousTask) {
    log("[AutoRouter] Using preserved session context", {
      previousTask: sessionContext.previousTask.substring(0, 50),
      preservedIntents: sessionContext.preservedIntents,
      preservedTools: sessionContext.requiredTools,
    })
  }

  // Step 2: Select development preset based on project type and domain
  const presetSelection = selectPreset(
    classification.projectType,
    classification.domainSignals,
    classification.complexityTier
  )

  // Step 3: Select base technique
  let selectedTechnique = selectTechnique(classification)

  // Step 4: Check analytics for historical recommendations
  const analyticsRecommendation = getRecommendedTechnique(
    classification.projectType,
    classification.complexityTier,
    classification.domainSignals
  )

  // Step 5: Determine starting budget
  let startingBudget = determineStartingBudget(classification, mergedConfig.defaultBudget)

  // Step 6: Apply preset adjustments (may upgrade technique/budget)
  const presetAdjustments = applyPresetAdjustments(
    {
      technique: selectedTechnique,
      budget: startingBudget,
      qualityThreshold: mergedConfig.qualityThreshold,
    },
    presetSelection.preset
  )

  // Apply adjustments
  selectedTechnique = presetAdjustments.technique
  startingBudget = presetAdjustments.budget
  const maxBudget = presetAdjustments.maxBudget
  const qualityThreshold = presetAdjustments.qualityThreshold

  // Log if analytics recommendation differs from selected
  if (analyticsRecommendation && analyticsRecommendation !== selectedTechnique) {
    log("[AutoRouter] Analytics suggests different technique", {
      selected: selectedTechnique,
      analyticsRecommends: analyticsRecommendation,
    })
  }

  const techniqueDescription = getTechniqueDescription(selectedTechnique)

  // Step 7: Create escalation manager with max budget cap
  const escalationManager = createEscalationManager(startingBudget, {
    maxEscalations: mergedConfig.maxEscalations,
    qualityThreshold,
    maxBudget,
  })

  // Step 8: Generate injected prompt
  const injectedPrompt = generateInjectedPrompt(
    taskDescription,
    classification,
    selectedTechnique,
    startingBudget,
    { ...mergedConfig, qualityThreshold }
  )

  return {
    classification,
    selectedTechnique,
    techniqueDescription,
    startingBudget,
    maxBudget,
    qualityThreshold,
    injectedPrompt,
    escalationManager,
    presetApplied: presetAdjustments.adjusted ? presetSelection : null,
    analyticsRecommendation,
    intentAwareClassification: enhancedClassification, // v3.6.4: Include intent-aware classification
  }
}

/**
 * Compare budget tiers and return the higher one
 */
function maxBudget(a: BudgetTier, b: BudgetTier): BudgetTier {
  return BUDGET_TIER_PRIORITY[a] >= BUDGET_TIER_PRIORITY[b] ? a : b
}

/**
 * Determine optimal starting budget based on classification
 * Now proactively assigns higher budgets for complex tasks
 */
function determineStartingBudget(
  classification: TaskClassification,
  defaultBudget: BudgetTier
): BudgetTier {
  // Step 1: Get minimum budget based on complexity tier
  const minBudget = getMinBudgetForComplexity(
    classification.complexityTier,
    classification.noveltyLevel
  )

  // Step 2: Check domain signal overrides (take the higher of domain or complexity)
  let domainBudget: BudgetTier = "free"

  if (classification.domainSignals.includes("crypto-trading")) {
    domainBudget = "expensive" // Financial risk requires high capability
  } else if (classification.domainSignals.includes("security-sensitive")) {
    domainBudget = "moderate" // Security needs careful analysis
  } else if (classification.domainSignals.includes("performance-critical")) {
    domainBudget = "moderate" // Performance optimization needs good reasoning
  }

  // Step 3: Return the highest of: default, complexity-based, or domain-based
  return maxBudget(maxBudget(defaultBudget, minBudget), domainBudget)
}

/**
 * Generate the full injected prompt with all router decisions
 */
function generateInjectedPrompt(
  taskDescription: string,
  classification: TaskClassification,
  technique: TechniqueCombo,
  budget: BudgetTier,
  config: AutoRouterConfig
): string {
  const budgetConfig = BUDGET_TIERS[budget]
  const techniqueInstructions = TECHNIQUE_INSTRUCTIONS[technique]
    .replace(/\{\{MAX_ITERATIONS\}\}/g, String(budgetConfig.maxIterations))

  const complexityDesc = COMPLEXITY_DESCRIPTIONS[classification.complexityTier]
  const rubricList = generateCompactRubricList(classification.projectType)

  // Build execution directives based on technique
  const executionDirectives = buildExecutionDirectives(technique, classification, config)

  // Fill in template
  // Subagent delegation info depends on context - use placeholder that hook will replace
  const subagentDelegationInfo = "Direct execution mode - subagent delegation determined at runtime."

  let prompt = AUTO_ROUTER_INJECTION_TEMPLATE
    .replace("{{PROJECT_TYPE}}", classification.projectType)
    .replace("{{COMPLEXITY_TIER}}", String(classification.complexityTier))
    .replace("{{COMPLEXITY_DESCRIPTION}}", complexityDesc)
    .replace("{{NOVELTY_LEVEL}}", classification.noveltyLevel)
    .replace("{{DOMAIN_SIGNALS}}", classification.domainSignals.join(", ") || "none detected")
    .replace("{{HAS_TESTS}}", classification.hasTests ? "Yes" : "No")
    .replace("{{HAS_BUILD_GATES}}", classification.hasBuildGates ? "Yes" : "No")
    .replace("{{HAS_TYPE_CHECKING}}", classification.hasTypeChecking ? "Yes" : "No")
    .replace("{{NEEDS_LLM_JUDGE}}", classification.needsLlmJudge ? "Yes" : "No")
    .replace("{{TECHNIQUE_COMBO}}", technique)
    .replace("{{TECHNIQUE_INSTRUCTIONS}}", techniqueInstructions)
    .replace("{{STARTING_TIER}}", budget)
    .replace("{{MODEL}}", budgetConfig.models.primary)
    .replace("{{MAX_ITERATIONS}}", String(budgetConfig.maxIterations))
    .replace("{{SUBAGENT_DELEGATION_INFO}}", subagentDelegationInfo)
    .replace("{{APPLICABLE_RUBRICS}}", rubricList)
    .replace("{{EXECUTION_DIRECTIVES}}", executionDirectives)
    .replace("{{TASK_DESCRIPTION}}", taskDescription)

  // Validate all placeholders were replaced - log warning if any found
  const unreplacedMatch = prompt.match(/\{\{[A-Z_]+\}\}/g)
  if (unreplacedMatch) {
    // Note: Using console.warn as this is a template error that should be visible
    // even if logger is not configured for this severity level
    console.warn(`[AutoRouter] Unreplaced placeholders: ${unreplacedMatch.join(", ")}`)
  }

  return prompt
}

/**
 * Build execution directives based on selected technique
 */
function buildExecutionDirectives(
  technique: TechniqueCombo,
  classification: TaskClassification,
  config: AutoRouterConfig
): string {
  const directives: string[] = []

  // Add technique-specific directives
  if (techniqueIncludes(technique, "ulw")) {
    directives.push("- Fire parallel exploration agents for context gathering")
    directives.push("- Use TDD workflow if tests are available")
    directives.push("- Track ALL steps with TODO items")
  }

  if (techniqueIncludes(technique, "ultrathink")) {
    directives.push("- Think through the problem deeply before implementation")
    directives.push("- Consider edge cases and failure modes")
    directives.push("- Validate reasoning at each major checkpoint")
  }

  if (techniqueIncludes(technique, "ralph")) {
    directives.push("- Continue working until task is FULLY complete")
    directives.push("- Only output <promise>DONE</promise> when truly finished")
    directives.push("- Try different approaches if stuck before giving up")
  }

  // Add verification directives
  if (classification.hasTests) {
    directives.push("- Run tests after each significant change")
    directives.push("- All tests must pass before completion")
  }

  if (classification.hasBuildGates) {
    directives.push("- Verify build passes before completion")
  }

  if (classification.hasTypeChecking) {
    directives.push("- Ensure no TypeScript errors")
  }

  if (classification.needsLlmJudge && config.enableJudge) {
    directives.push("- Request LLM-judge evaluation at completion")
    directives.push(`- Quality threshold: ${config.qualityThreshold}`)
  }

  // Add domain-specific directives
  if (classification.domainSignals.includes("security-sensitive")) {
    directives.push("- Extra scrutiny on security implications")
    directives.push("- Validate all inputs, sanitize outputs")
  }

  if (classification.domainSignals.includes("crypto-trading")) {
    directives.push("- MAXIMUM CAUTION: Financial implications")
    directives.push("- Double-verify all calculations and logic")
    directives.push("- Test edge cases extensively")
  }

  if (classification.domainSignals.includes("real-time")) {
    directives.push("- Consider latency and throughput implications")
    directives.push("- Handle connection failures gracefully")
  }

  return directives.join("\n")
}

/**
 * Quick analyze function for simpler use cases
 */
export async function analyzeTask(
  taskDescription: string,
  directory: string
): Promise<{
  technique: TechniqueCombo
  budget: BudgetTier
  complexity: 1 | 2 | 3
  projectType: string
}> {
  const result = await createAutoRouter(taskDescription, directory)

  return {
    technique: result.selectedTechnique,
    budget: result.startingBudget,
    complexity: result.classification.complexityTier,
    projectType: result.classification.projectType,
  }
}

/**
 * Get a summary of routing decisions for display
 */
export function getRoutingSummary(result: AutoRouterResult): string {
  const { classification, selectedTechnique, startingBudget } = result
  const budgetConfig = BUDGET_TIERS[startingBudget]

  return `
Auto-Router Decision Summary
============================
Project Type: ${classification.projectType}
Complexity: Tier ${classification.complexityTier} (${COMPLEXITY_DESCRIPTIONS[classification.complexityTier]})
Novelty: ${classification.noveltyLevel}
Domain Signals: ${classification.domainSignals.join(", ") || "none"}

Selected Technique: ${selectedTechnique}
${result.techniqueDescription}

Starting Budget: ${startingBudget}
- Model: ${budgetConfig.models.primary}
- Max Iterations: ${budgetConfig.maxIterations}
- Timeout: ${budgetConfig.timeoutMs / 1000}s

Verification:
- Tests: ${classification.hasTests ? "Available" : "Not found"}
- Build Gates: ${classification.hasBuildGates ? "Available" : "Not found"}
- Type Checking: ${classification.hasTypeChecking ? "Available" : "Not found"}
- LLM Judge: ${classification.needsLlmJudge ? "Required" : "Optional"}
`.trim()
}
