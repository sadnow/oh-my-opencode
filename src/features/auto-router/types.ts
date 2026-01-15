/**
 * Auto-Router Type Definitions
 * Intelligent task routing for oh-my-opencode
 */

// ============================================================================
// Project Types
// ============================================================================

export type ProjectType =
  | "game"
  | "web-app"
  | "cli"
  | "api-server"
  | "bot"
  | "indexer-crawler"
  | "data-pipeline"
  | "static-site"
  | "library"
  | "monorepo"
  | "unknown"

// ============================================================================
// Technique Types
// ============================================================================

export type TechniqueCombo =
  | "direct"           // No special technique
  | "ulw"              // Ultrawork alone (parallel agents + TDD)
  | "ultrathink"       // Deep reasoning alone
  | "ralph"            // Ralph loop alone (persistence)
  | "ulw+ralph"        // Ultrawork with Ralph loop
  | "ultrathink+ulw"   // Deep reasoning + parallel execution
  | "ultrathink+ralph" // Deep reasoning + persistence
  | "triple"           // All three: ultrathink + ulw + ralph

// ============================================================================
// Budget Types
// ============================================================================

export type BudgetTier = "free" | "cheap" | "moderate" | "expensive" | "maximum"

export interface ModelConfig {
  primary: string
  thinking: string
  judge: string
}

export interface BudgetTierConfig {
  name: BudgetTier
  models: ModelConfig
  maxIterations: number
  timeoutMs: number
}

// ============================================================================
// Classification Types
// ============================================================================

export type NoveltyLevel = "known" | "familiar" | "novel"
export type ParallelizationPotential = "none" | "low" | "high"
export type RiskLevel = "low" | "medium" | "high"
export type ComplexityTier = 1 | 2 | 3

export type DomainSignal =
  | "crypto-trading"
  | "real-time"
  | "data-aggregation"
  | "research-analysis"
  | "ui-heavy"
  | "backend-logic"
  | "infrastructure"
  | "documentation"
  | "testing"
  | "security-sensitive"
  | "performance-critical"

export interface TaskClassification {
  // Project analysis
  projectType: ProjectType
  projectMaturity: "greenfield" | "established" | "legacy"

  // Complexity assessment
  complexityTier: ComplexityTier
  estimatedSteps: number
  noveltyLevel: NoveltyLevel

  // Verification capability
  hasTests: boolean
  hasBuildGates: boolean
  hasTypeChecking: boolean
  hasLinting: boolean
  needsLlmJudge: boolean

  // Resource requirements
  parallelizationPotential: ParallelizationPotential
  contextExhaustionRisk: RiskLevel

  // Domain signals
  domainSignals: DomainSignal[]

  // Raw scores for debugging
  complexityScore: number
}

export interface ProjectContext {
  directory: string
  hasPackageJson: boolean
  packageJson?: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
    exports?: unknown // Used for library detection
  }
  filePatterns: string[]
  configFiles: string[]
}

// ============================================================================
// Escalation Types
// ============================================================================

export type EscalationSignal =
  | "consecutive-failures"
  | "quality-below-threshold"
  | "timeout-exceeded"
  | "stuck-pattern"
  | "complexity-underestimated"
  | "user-requested"

export interface EscalationTrigger {
  condition: string
  fromTier: BudgetTier
  toTier: BudgetTier
  signals: EscalationSignal[]
}

export interface EscalationDecision {
  shouldEscalate: boolean
  fromTier?: BudgetTier
  toTier?: BudgetTier
  reason?: string
  signals?: EscalationSignal[]
}

export interface AttemptResult {
  success: boolean
  qualityScore?: number
  errorMessage?: string
  outputHash?: string // For stuck detection
  duration: number
}

export interface AttemptHistory extends AttemptResult {
  timestamp: Date
  tier: BudgetTier
  iteration: number
}

// ============================================================================
// LLM Judge Types
// ============================================================================

export type RubricCategory =
  | "code-architecture"
  | "api-design"
  | "error-handling"
  | "security-posture"
  | "documentation"
  | "ux-ui-coherence"

export interface RubricCriterion {
  name: string
  description: string
  weight: number
}

export interface JudgeRubric {
  name: string
  description: string
  criteria: RubricCriterion[]
  projectWeights: Record<ProjectType, number>
}

export interface CriterionScore {
  score: number
  evidence: string
}

export interface RubricScoreData {
  criteriaScores: Record<string, CriterionScore>
  total: number
  issues: string[]
}

export interface JudgeEvaluation {
  rubricScores: Record<string, RubricScoreData>
  overallScore: number
  passRecommendation: boolean
  criticalIssues: string[]
  suggestions: string[]
  timestamp: Date
}

// ============================================================================
// Auto-Router Output Types
// ============================================================================

export interface AutoRouterDecision {
  classification: TaskClassification
  technique: TechniqueCombo
  budgetTier: BudgetTier
  models: ModelConfig
  maxIterations: number
  applicableRubrics: string[]
  injectionPrompt: string
}

export interface AutoRouterOptions {
  budgetOverride?: BudgetTier
  techniqueOverride?: TechniqueCombo
  projectTypeOverride?: ProjectType
  skipClassification?: boolean
}

// ============================================================================
// Project Detection Types
// ============================================================================

export interface DetectionPattern {
  filePatterns: string[]
  packageSignals: string[]
  configFiles: string[]
  directoryPatterns?: string[]
}

export interface DetectionResult {
  projectType: ProjectType
  confidence: number
  matchedPatterns: string[]
}

// ============================================================================
// Complexity Signal Types
// ============================================================================

export interface ComplexitySignals {
  // Text analysis
  stepIndicators: number
  conditionalWords: number
  integrationKeywords: number

  // Scope analysis
  mentionedFiles: number
  mentionedModules: number
  mentionedExternalServices: number

  // Domain complexity
  requiresResearch: boolean
  requiresArchitecturalDecisions: boolean
  hasPerformanceConstraints: boolean
  hasSecurityImplications: boolean
}

// ============================================================================
// Config Types
// ============================================================================

export interface AutoRouterConfig {
  enabled: boolean
  defaultBudget: BudgetTier
  autoEscalate: boolean
  maxEscalations: number
  enableJudge: boolean
  qualityThreshold: number
  projectTypeOverride?: ProjectType
  /** Enable wizard prompts before execution */
  wizardMode?: boolean
  /** Run without interruption until complete */
  fullAutonomy?: boolean
  /** Production-ready completion checks */
  productionReadyChecks?: {
    /** Require tests to exist and pass */
    requireTests: boolean
    /** Require no LSP errors/warnings */
    requireCleanDiagnostics: boolean
    /** Require build to succeed */
    requireBuildPass: boolean
    /** Require LLM judge approval */
    requireJudgePass: boolean
  }
}
