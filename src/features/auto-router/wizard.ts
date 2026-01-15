/**
 * Auto-Router Wizard
 * Interactive configuration flow for the auto-router
 *
 * Provides a "wizard-esque" interface where users can provide minimal input
 * and the system determines optimal models, techniques, and budget settings.
 */

import type {
  BudgetTier,
  TechniqueCombo,
  ProjectType,
  AutoRouterConfig,
  TaskClassification,
  ComplexityTier,
} from "./types"
import { BUDGET_TIERS, DEFAULT_AUTO_ROUTER_CONFIG, TECHNIQUE_SELECTION_MATRIX, BUDGET_TIER_PRIORITY } from "./constants"

// ============================================================================
// Wizard Types
// ============================================================================

/**
 * User's answers from the wizard flow
 */
export interface WizardAnswers {
  /** Type of project being worked on */
  projectType: ProjectType | "auto"

  /** How critical is this task */
  criticality: "quick" | "standard" | "production" | "critical"

  /** Should the system run without interruption */
  fullAutonomy: boolean

  /** Budget preference */
  budgetPreference: "free-only" | "start-free" | "best-models"
}

/**
 * Result of the wizard configuration
 */
export interface WizardResult {
  /** The configured auto-router settings */
  config: AutoRouterConfig

  /** Selected technique based on answers */
  technique: TechniqueCombo

  /** Starting budget tier */
  startingBudget: BudgetTier

  /** Maximum budget the system can escalate to */
  maxBudget: BudgetTier

  /** Quality threshold for success */
  qualityThreshold: number

  /** Human-readable summary of the configuration */
  summary: string
}

/**
 * A single wizard question
 */
export interface WizardQuestion {
  id: string
  question: string
  header: string
  options: {
    value: string
    label: string
    description: string
  }[]
  default?: string
}

// ============================================================================
// Wizard Questions
// ============================================================================

/**
 * Get the wizard questions to ask the user
 */
export function getWizardQuestions(): WizardQuestion[] {
  return [
    {
      id: "projectType",
      question: "What type of project is this?",
      header: "Project Type",
      options: [
        { value: "auto", label: "Auto-detect (Recommended)", description: "Let the system analyze your codebase" },
        { value: "web-app", label: "Web App", description: "React, Vue, Angular, or similar frontend" },
        { value: "api-server", label: "API/Backend", description: "REST API, GraphQL, or backend service" },
        { value: "cli", label: "CLI Tool", description: "Command-line application" },
        { value: "game", label: "Game", description: "Game or interactive application" },
        { value: "library", label: "Library", description: "Reusable package or module" },
      ],
      default: "auto",
    },
    {
      id: "criticality",
      question: "How critical is this task?",
      header: "Criticality",
      options: [
        { value: "quick", label: "Quick fix/prototype", description: "Fast execution, lower quality bar" },
        { value: "standard", label: "Standard development", description: "Balanced speed and quality" },
        { value: "production", label: "Production-critical", description: "Thorough testing, higher quality bar" },
        { value: "critical", label: "Security/Financial", description: "Maximum scrutiny, all checks enabled" },
      ],
      default: "standard",
    },
    {
      id: "fullAutonomy",
      question: "Do you want full autonomy?",
      header: "Autonomy",
      options: [
        { value: "true", label: "Yes - run until done (Recommended)", description: "System runs without interruption" },
        { value: "false", label: "No - check in periodically", description: "Pause after major steps for review" },
      ],
      default: "true",
    },
    {
      id: "budgetPreference",
      question: "Budget preference?",
      header: "Budget",
      options: [
        { value: "start-free", label: "Start free, escalate if needed (Recommended)", description: "Balance cost savings with quality" },
        { value: "free-only", label: "Free models only", description: "Slower, but $0 cost" },
        { value: "best-models", label: "Use best models immediately", description: "Fastest, highest cost" },
      ],
      default: "start-free",
    },
  ]
}

// ============================================================================
// Configuration Builder
// ============================================================================

/**
 * Build configuration from wizard answers
 */
export function buildConfigFromAnswers(answers: WizardAnswers): WizardResult {
  // Determine budget settings based on preference
  let startingBudget: BudgetTier
  let maxBudget: BudgetTier
  let autoEscalate: boolean

  switch (answers.budgetPreference) {
    case "free-only":
      startingBudget = "free"
      maxBudget = "free"
      autoEscalate = false
      break
    case "start-free":
      startingBudget = "free"
      maxBudget = "expensive"
      autoEscalate = true
      break
    case "best-models":
      startingBudget = "expensive"
      maxBudget = "maximum"
      autoEscalate = true
      break
    default:
      startingBudget = "free"
      maxBudget = "expensive"
      autoEscalate = true
  }

  // Determine quality threshold based on criticality
  let qualityThreshold: number
  let requireTests: boolean
  let requireCleanDiagnostics: boolean
  let requireBuildPass: boolean
  let requireJudgePass: boolean

  switch (answers.criticality) {
    case "quick":
      qualityThreshold = 0.5
      requireTests = false
      requireCleanDiagnostics = false
      requireBuildPass = false
      requireJudgePass = false
      break
    case "standard":
      qualityThreshold = 0.7
      requireTests = false
      requireCleanDiagnostics = true
      requireBuildPass = true
      requireJudgePass = false
      break
    case "production":
      qualityThreshold = 0.8
      requireTests = true
      requireCleanDiagnostics = true
      requireBuildPass = true
      requireJudgePass = true
      break
    case "critical":
      qualityThreshold = 0.9
      requireTests = true
      requireCleanDiagnostics = true
      requireBuildPass = true
      requireJudgePass = true
      // Critical tasks use maximum budget
      if (startingBudget === "free") startingBudget = "moderate"
      maxBudget = "maximum"
      break
    default:
      qualityThreshold = 0.7
      requireTests = false
      requireCleanDiagnostics = true
      requireBuildPass = true
      requireJudgePass = false
  }

  // Determine technique based on criticality and autonomy
  let technique: TechniqueCombo
  if (answers.criticality === "quick") {
    technique = "direct"
  } else if (answers.criticality === "critical") {
    technique = "triple" // Full orchestration for critical tasks
  } else if (answers.fullAutonomy) {
    technique = "ulw+ralph" // Parallel + persistence for autonomous mode
  } else {
    technique = "ulw" // Parallel without ralph for supervised mode
  }

  // Build the config
  const config: AutoRouterConfig = {
    enabled: true,
    defaultBudget: startingBudget,
    autoEscalate,
    maxEscalations: answers.criticality === "critical" ? 5 : 3,
    enableJudge: requireJudgePass || answers.criticality !== "quick",
    qualityThreshold,
    projectTypeOverride: answers.projectType !== "auto" ? answers.projectType : undefined,
    wizardMode: false, // Already ran wizard
    fullAutonomy: answers.fullAutonomy,
    productionReadyChecks: {
      requireTests,
      requireCleanDiagnostics,
      requireBuildPass,
      requireJudgePass,
    },
  }

  // Generate summary
  const summary = generateSummary(answers, config, technique, startingBudget, maxBudget)

  return {
    config,
    technique,
    startingBudget,
    maxBudget,
    qualityThreshold,
    summary,
  }
}

/**
 * Generate human-readable summary of the configuration
 */
function generateSummary(
  answers: WizardAnswers,
  config: AutoRouterConfig,
  technique: TechniqueCombo,
  startingBudget: BudgetTier,
  maxBudget: BudgetTier
): string {
  const lines: string[] = []

  lines.push("🧙 AUTO-ROUTER WIZARD CONFIGURATION")
  lines.push("═".repeat(40))
  lines.push("")

  // Project
  const projectLabel = answers.projectType === "auto"
    ? "Auto-detect"
    : answers.projectType.charAt(0).toUpperCase() + answers.projectType.slice(1)
  lines.push(`📁 Project: ${projectLabel}`)

  // Technique
  const techniqueLabels: Record<TechniqueCombo, string> = {
    direct: "Direct execution",
    ulw: "Ultrawork (parallel agents)",
    ultrathink: "Ultrathink (deep reasoning)",
    ralph: "Ralph loop (persistence)",
    "ulw+ralph": "Ultrawork + Ralph (parallel + persistence)",
    "ultrathink+ulw": "Ultrathink + Ultrawork",
    "ultrathink+ralph": "Ultrathink + Ralph",
    triple: "Full orchestration (all techniques)",
  }
  lines.push(`🎯 Technique: ${techniqueLabels[technique]}`)

  // Budget
  const budgetConfig = BUDGET_TIERS[startingBudget]
  lines.push(`💰 Budget: ${startingBudget} → ${maxBudget}`)
  lines.push(`   Primary model: ${budgetConfig.models.primary}`)

  // Autonomy
  lines.push(`🤖 Autonomy: ${answers.fullAutonomy ? "Full (run until done)" : "Supervised (check in periodically)"}`)

  // Quality
  lines.push(`📊 Quality threshold: ${(config.qualityThreshold * 100).toFixed(0)}%`)

  // Production checks
  const checks = config.productionReadyChecks
  if (checks) {
    const enabledChecks: string[] = []
    if (checks.requireBuildPass) enabledChecks.push("build")
    if (checks.requireCleanDiagnostics) enabledChecks.push("diagnostics")
    if (checks.requireTests) enabledChecks.push("tests")
    if (checks.requireJudgePass) enabledChecks.push("judge")
    lines.push(`✅ Required checks: ${enabledChecks.length > 0 ? enabledChecks.join(", ") : "none"}`)
  }

  lines.push("")
  lines.push("═".repeat(40))

  return lines.join("\n")
}

// ============================================================================
// Quick Configuration Helpers
// ============================================================================

/**
 * Create a quick configuration for common scenarios
 */
export function createQuickConfig(
  scenario: "quick-fix" | "standard" | "production" | "free-only" | "full-power"
): WizardResult {
  switch (scenario) {
    case "quick-fix":
      return buildConfigFromAnswers({
        projectType: "auto",
        criticality: "quick",
        fullAutonomy: true,
        budgetPreference: "start-free",
      })

    case "standard":
      return buildConfigFromAnswers({
        projectType: "auto",
        criticality: "standard",
        fullAutonomy: true,
        budgetPreference: "start-free",
      })

    case "production":
      return buildConfigFromAnswers({
        projectType: "auto",
        criticality: "production",
        fullAutonomy: true,
        budgetPreference: "start-free",
      })

    case "free-only":
      return buildConfigFromAnswers({
        projectType: "auto",
        criticality: "standard",
        fullAutonomy: true,
        budgetPreference: "free-only",
      })

    case "full-power":
      return buildConfigFromAnswers({
        projectType: "auto",
        criticality: "critical",
        fullAutonomy: true,
        budgetPreference: "best-models",
      })

    default:
      return buildConfigFromAnswers({
        projectType: "auto",
        criticality: "standard",
        fullAutonomy: true,
        budgetPreference: "start-free",
      })
  }
}

/**
 * Parse command-line flags into wizard answers
 */
export function parseWizardFlags(flags: string[]): Partial<WizardAnswers> {
  const answers: Partial<WizardAnswers> = {}

  for (const flag of flags) {
    const lower = flag.toLowerCase()

    // Budget flags
    if (lower === "--free" || lower === "-f") {
      answers.budgetPreference = "free-only"
    } else if (lower === "--best" || lower === "-b") {
      answers.budgetPreference = "best-models"
    }

    // Criticality flags
    if (lower === "--quick" || lower === "-q") {
      answers.criticality = "quick"
    } else if (lower === "--production" || lower === "-p") {
      answers.criticality = "production"
    } else if (lower === "--critical" || lower === "-c") {
      answers.criticality = "critical"
    }

    // Autonomy flags
    if (lower === "--supervised" || lower === "-s") {
      answers.fullAutonomy = false
    }

    // Project type flags
    if (lower.startsWith("--type=")) {
      const type = lower.replace("--type=", "") as ProjectType
      if (["game", "web-app", "cli", "api-server", "bot", "library"].includes(type)) {
        answers.projectType = type
      }
    }
  }

  return answers
}

/**
 * Merge partial answers with defaults
 */
export function mergeWithDefaults(partial: Partial<WizardAnswers>): WizardAnswers {
  return {
    projectType: partial.projectType ?? "auto",
    criticality: partial.criticality ?? "standard",
    fullAutonomy: partial.fullAutonomy ?? true,
    budgetPreference: partial.budgetPreference ?? "start-free",
  }
}

// ============================================================================
// Wizard State Machine
// ============================================================================

/**
 * Wizard state for tracking progress through questions
 */
export interface WizardState {
  currentStep: number
  totalSteps: number
  answers: Partial<WizardAnswers>
  isComplete: boolean
}

/**
 * Create initial wizard state
 */
export function createWizardState(): WizardState {
  const questions = getWizardQuestions()
  return {
    currentStep: 0,
    totalSteps: questions.length,
    answers: {},
    isComplete: false,
  }
}

/**
 * Process an answer and advance the wizard
 */
export function processWizardAnswer(
  state: WizardState,
  answer: string
): WizardState {
  const questions = getWizardQuestions()
  const currentQuestion = questions[state.currentStep]

  if (!currentQuestion) {
    return { ...state, isComplete: true }
  }

  // Store the answer
  const newAnswers = { ...state.answers }
  switch (currentQuestion.id) {
    case "projectType":
      newAnswers.projectType = answer as ProjectType | "auto"
      break
    case "criticality":
      newAnswers.criticality = answer as WizardAnswers["criticality"]
      break
    case "fullAutonomy":
      newAnswers.fullAutonomy = answer === "true"
      break
    case "budgetPreference":
      newAnswers.budgetPreference = answer as WizardAnswers["budgetPreference"]
      break
  }

  const nextStep = state.currentStep + 1
  const isComplete = nextStep >= state.totalSteps

  return {
    currentStep: nextStep,
    totalSteps: state.totalSteps,
    answers: newAnswers,
    isComplete,
  }
}

/**
 * Get the current question for the wizard state
 */
export function getCurrentQuestion(state: WizardState): WizardQuestion | null {
  if (state.isComplete) return null
  const questions = getWizardQuestions()
  return questions[state.currentStep] ?? null
}

/**
 * Finalize the wizard and get the result
 */
export function finalizeWizard(state: WizardState): WizardResult {
  const fullAnswers = mergeWithDefaults(state.answers)
  return buildConfigFromAnswers(fullAnswers)
}

// ============================================================================
// Complexity-Aware Helpers
// ============================================================================

/**
 * Determine if ralph loop is truly needed based on classification
 * Ralph loop should only be enabled for tasks that actually need persistence
 *
 * Ralph loop IS needed when:
 * - Complexity Tier 2+ with novel content
 * - Complexity Tier 3 (always needs persistence for complex multi-step tasks)
 * - Domain signals indicate high-risk (crypto-trading, security-sensitive)
 *
 * Ralph loop is NOT needed when:
 * - Simple Tier 1 tasks (should complete in 1-2 iterations)
 * - Tier 2 with known/familiar patterns (predictable execution)
 */
export function shouldEnableRalphLoop(
  complexityTier: ComplexityTier,
  noveltyLevel: "known" | "familiar" | "novel",
  domainSignals: string[] = [],
  fullAutonomy: boolean = true
): boolean {
  // If not in full autonomy mode, don't auto-enable ralph
  if (!fullAutonomy) return false

  // High-risk domains always benefit from persistence
  if (domainSignals.includes("crypto-trading") || domainSignals.includes("security-sensitive")) {
    return true
  }

  // Tier 3 complex tasks always need persistence
  if (complexityTier === 3) return true

  // Tier 2 novel tasks benefit from persistence
  if (complexityTier === 2 && noveltyLevel === "novel") return true

  // Tier 1 and Tier 2 known/familiar don't need ralph
  return false
}

/**
 * Select technique based on classification (complexity-aware)
 * Uses the technique selection matrix from constants
 */
export function selectTechniqueFromClassification(
  classification: TaskClassification,
  fullAutonomy: boolean = true
): TechniqueCombo {
  const { complexityTier, noveltyLevel, hasTests, domainSignals } = classification

  // Build the matrix key
  const testsKey = hasTests ? "tests" : "notests"
  const matrixKey = `tier${complexityTier}-${noveltyLevel}-${testsKey}` as keyof typeof TECHNIQUE_SELECTION_MATRIX

  // Get base technique from matrix
  let technique = TECHNIQUE_SELECTION_MATRIX[matrixKey]

  // Check if ralph loop should be added (if not already included)
  const needsRalph = shouldEnableRalphLoop(complexityTier, noveltyLevel, domainSignals, fullAutonomy)

  if (needsRalph && !technique.includes("ralph") && technique !== "triple") {
    // Add ralph to the technique
    if (technique === "direct") {
      technique = "ralph"
    } else if (technique === "ulw") {
      technique = "ulw+ralph"
    } else if (technique === "ultrathink") {
      technique = "ultrathink+ralph"
    } else if (technique === "ultrathink+ulw") {
      technique = "triple"
    }
  }

  return technique
}

/**
 * Get minimum budget for complexity (used by wizard)
 */
export function getMinBudgetForComplexity(
  complexityTier: ComplexityTier,
  noveltyLevel: "known" | "familiar" | "novel"
): BudgetTier {
  if (complexityTier === 1) return "free"
  if (complexityTier === 2) return noveltyLevel === "novel" ? "moderate" : "cheap"
  return noveltyLevel === "novel" ? "expensive" : "moderate"
}

/**
 * Build configuration from answers WITH classification data
 * This is the complexity-aware version that integrates with the classifier
 */
export function buildConfigFromAnswersWithClassification(
  answers: WizardAnswers,
  classification: TaskClassification
): WizardResult {
  // Get base config from regular wizard
  const baseResult = buildConfigFromAnswers(answers)

  // Override technique with complexity-aware selection
  const technique = selectTechniqueFromClassification(classification, answers.fullAutonomy)

  // Get minimum budget based on complexity
  const minBudget = getMinBudgetForComplexity(classification.complexityTier, classification.noveltyLevel)

  // Compare budgets and use the higher one
  const startingBudget = BUDGET_TIER_PRIORITY[minBudget] > BUDGET_TIER_PRIORITY[baseResult.startingBudget]
    ? minBudget
    : baseResult.startingBudget

  // Generate updated summary
  const summary = generateComplexityAwareSummary(answers, baseResult.config, technique, startingBudget, baseResult.maxBudget, classification)

  return {
    ...baseResult,
    technique,
    startingBudget,
    summary,
  }
}

/**
 * Generate summary that includes complexity information
 */
function generateComplexityAwareSummary(
  answers: WizardAnswers,
  config: AutoRouterConfig,
  technique: TechniqueCombo,
  startingBudget: BudgetTier,
  maxBudget: BudgetTier,
  classification: TaskClassification
): string {
  const lines: string[] = []

  lines.push("🧙 AUTO-ROUTER WIZARD CONFIGURATION")
  lines.push("═".repeat(40))
  lines.push("")

  // Project
  const projectLabel = classification.projectType.charAt(0).toUpperCase() + classification.projectType.slice(1)
  lines.push(`📁 Project: ${projectLabel}`)

  // Complexity (NEW)
  const tierDescriptions: Record<ComplexityTier, string> = {
    1: "Simple (1-2 steps)",
    2: "Moderate (multi-step)",
    3: "Complex (full orchestration)",
  }
  lines.push(`📊 Complexity: Tier ${classification.complexityTier} - ${tierDescriptions[classification.complexityTier]}`)
  lines.push(`🔬 Novelty: ${classification.noveltyLevel}`)

  // Technique
  const techniqueLabels: Record<TechniqueCombo, string> = {
    direct: "Direct execution",
    ulw: "Ultrawork (parallel agents)",
    ultrathink: "Ultrathink (deep reasoning)",
    ralph: "Ralph loop (persistence)",
    "ulw+ralph": "Ultrawork + Ralph (parallel + persistence)",
    "ultrathink+ulw": "Ultrathink + Ultrawork",
    "ultrathink+ralph": "Ultrathink + Ralph",
    triple: "Full orchestration (all techniques)",
  }
  lines.push(`🎯 Technique: ${techniqueLabels[technique]}`)

  // Ralph loop status
  const hasRalph = technique.includes("ralph") || technique === "triple"
  lines.push(`🔄 Ralph Loop: ${hasRalph ? "ENABLED (persistent until complete)" : "Disabled (quick task)"}`)

  // Budget
  const budgetConfig = BUDGET_TIERS[startingBudget]
  lines.push(`💰 Budget: ${startingBudget} → ${maxBudget}`)
  lines.push(`   Primary model: ${budgetConfig.models.primary}`)

  // Autonomy
  lines.push(`🤖 Autonomy: ${answers.fullAutonomy ? "Full (run until done)" : "Supervised (check in periodically)"}`)

  // Quality
  lines.push(`📊 Quality threshold: ${(config.qualityThreshold * 100).toFixed(0)}%`)

  // Production checks
  const checks = config.productionReadyChecks
  if (checks) {
    const enabledChecks: string[] = []
    if (checks.requireBuildPass) enabledChecks.push("build")
    if (checks.requireCleanDiagnostics) enabledChecks.push("diagnostics")
    if (checks.requireTests) enabledChecks.push("tests")
    if (checks.requireJudgePass) enabledChecks.push("judge")
    lines.push(`✅ Required checks: ${enabledChecks.length > 0 ? enabledChecks.join(", ") : "none"}`)
  }

  lines.push("")
  lines.push("═".repeat(40))

  return lines.join("\n")
}

// ============================================================================
// Exports
// ============================================================================

export {
  getWizardQuestions as getQuestions,
  buildConfigFromAnswers as buildConfig,
}
