import type { RalphLoopConfig, CompletionJudgeConfig } from "../../config"
import type { LLMInvoker } from "../../features/auto-router/judge-invoker"

export interface RalphLoopState {
  active: boolean
  iteration: number
  max_iterations: number
  completion_promise: string
  started_at: string
  prompt: string
  session_id?: string
}

export interface RalphLoopOptions {
  config?: RalphLoopConfig
  getTranscriptPath?: (sessionId: string) => string
  apiTimeout?: number
  checkSessionExists?: (sessionId: string) => Promise<boolean>
  /** LLM invoker for completion criteria judge */
  llmInvoker?: LLMInvoker
  /** Completion judge configuration */
  completionJudgeConfig?: Partial<CompletionJudgeConfig>
}

export type { LLMInvoker }
