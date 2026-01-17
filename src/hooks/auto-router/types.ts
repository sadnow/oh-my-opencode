/**
 * Auto-Router Hook Types
 */

import type {
  BudgetTier,
  TechniqueCombo,
  TaskClassification,
} from "../../features/auto-router/types"

/**
 * Task intent categories - what the user wants to DO (not just complexity)
 * These override project artifact signals when present in user prompt
 */
export type TaskIntent =
  | "test"      // test, play, verify, check, validate, e2e
  | "deploy"    // deploy, publish, release, ship
  | "build"     // build, create, make, implement
  | "fix"       // fix, debug, repair, resolve
  | "explore"   // explore, investigate, understand, learn
  | "refactor"  // refactor, clean, optimize, improve
  | "unknown"   // no clear intent detected

/**
 * Session context preserved between /auto commands
 * Prevents loss of focus when running sequential tasks
 */
export interface AutoRouterSessionContext {
  /** Previous task description for context */
  previousTask?: string
  /** Detected domain from previous task */
  previousDomain?: string
  /** Preserved task intents from user prompts (NOT project artifacts) */
  preservedIntents: TaskIntent[]
  /** Tools explicitly requested by user (playwright, cypress, etc.) */
  requiredTools: string[]
  /** Timestamp of last /auto command */
  lastCommandAt?: string
}

export interface AutoRouterState {
  active: boolean
  sessionId: string
  taskDescription: string
  classification: TaskClassification
  selectedTechnique: TechniqueCombo
  currentBudget: BudgetTier
  iteration: number
  maxIterations: number
  consecutiveFailures: number
  startedAt: string
  lastAttemptAt?: string
  /** v3.6.3: Detected task intent from USER PROMPT only */
  taskIntent?: TaskIntent
  /** v3.6.3: Required tools explicitly mentioned by user */
  requiredTools?: string[]
}

export interface AutoRouterHookInput {
  sessionID: string
  messageID?: string
  agent?: string
  model?: { providerID: string; modelID: string }
  variant?: string
}

export interface AutoRouterHookOutput {
  parts: Array<{ type: string; text?: string }>
}

/**
 * Background manager interface for parallel agent spawning
 */
export interface BackgroundManagerLike {
  launch(input: {
    description: string
    prompt: string
    agent: string
    parentSessionID: string
    parentMessageID?: string
    /** Model to use for the subagent (v3.7.0) */
    model?: { providerID: string; modelID: string; variant?: string }
  }): Promise<{ id: string; sessionID?: string }>
}

/**
 * Subagent execution info for tracking spawned subagents (v3.7.0)
 * Used to track subagents spawned for Tier 2-3 tasks
 */
export interface SubagentExecutionInfo {
  /** Link to parent analytics execution record */
  executionId: string
  /** Intended model for this subagent */
  intendedModel: string
  /** Subagent session ID */
  sessionId: string
  /** Agent name (e.g., "auto-expensive") */
  agentName: string
  /** Start timestamp for duration calculation */
  startTime: number
  /** Whether this was spawned due to escalation */
  isEscalation: boolean
  /** Budget tier escalated from (if isEscalation) */
  escalatedFrom?: BudgetTier
  /** Budget tier for this subagent */
  budgetTier: BudgetTier
  /** Complexity tier of the task */
  complexityTier: 1 | 2 | 3
  /** Parent session ID (orchestrator) */
  parentSessionId: string
  /** Task description */
  taskDescription: string
  /** v3.8.2: Completion status for ralph loop tracking */
  completed?: boolean
  completedAt?: number
  failed?: boolean
  failedAt?: number
}

export interface AutoRouterHookOptions {
  directory: string
  /** Optional background manager for spawning parallel agents */
  backgroundManager?: BackgroundManagerLike
  config?: {
    enabled?: boolean
    default_budget?: BudgetTier
    auto_escalate?: boolean
    max_escalations?: number
    enable_judge?: boolean
    quality_threshold?: number
    project_type_override?: string
    technique_override?: TechniqueCombo
    budget_override?: BudgetTier
    // v3.5.0: Parallel agent config
    parallel_agents?: {
      enabled?: boolean
      max_concurrent?: number
      agents_for_tier3?: string[]
    }
    full_autonomy?: boolean
    wizard_mode?: boolean
    /** Show detailed classification and routing information (v3.6.2) */
    verbose?: boolean
    // v3.7.0: Subagent auto-spawn config
    auto_spawn_subagents?: {
      enabled?: boolean
      tier_threshold?: number
      verify_models?: boolean
      spawn_for_ralph?: boolean
    }
  }
}
