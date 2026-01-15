/**
 * Auto-Router Hook Types
 */

import type {
  BudgetTier,
  TechniqueCombo,
  TaskClassification,
} from "../../features/auto-router/types"

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
  }): Promise<{ id: string }>
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
  }
}
