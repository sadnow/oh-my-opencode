import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"

/**
 * BudgetOrchestrator interface stub
 */
export interface BudgetOrchestrator {
  // Will be expanded in Task 4
  [key: string]: unknown
}

/**
 * OIB Autoselect Hook
 * 
 * Automatically selects the most cost-effective model based on budget and task complexity.
 */
export function createOibAutoselectHook(
  _ctx: PluginInput,
  budgetOrchestrator: BudgetOrchestrator | null
) {
  if (!budgetOrchestrator) {
    log("[oib-autoselect] BudgetOrchestrator disabled, hook not registered")
    return null
  }

  log("[oib-autoselect] Hook registered")

  return {
    /**
     * chat.message - Intercept messages to potentially override model selection
     */
    "chat.message": async (
      _input: {
        sessionID: string
        agent?: string
        model?: { providerID: string; modelID: string }
        messageID?: string
      },
      _output: {
        message: Record<string, unknown>
        parts: unknown[]
      }
    ): Promise<void> => {
      // Stub implementation for Task 2
    },

    /**
     * event - Handle session events
     */
    event: async (_input: { event: { type: string; properties?: unknown } }): Promise<void> => {
      // Stub implementation for Task 2
    },
  }
}
