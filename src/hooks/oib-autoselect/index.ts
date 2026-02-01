import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"
import type { BudgetOrchestrator as ActualBudgetOrchestrator } from "../../features/budget-orchestrator"

/**
 * BudgetOrchestrator interface - compatible with actual implementation
 */
export type BudgetOrchestrator = ActualBudgetOrchestrator

const VIRTUAL_MODEL_ID = "oh-im-broke/oib-autoselect"
const DEFAULT_FALLBACK_MODEL = "opencode/gpt-4o-mini"

/**
 * OIB Autoselect Hook
 * 
 * Automatically selects the most cost-effective model based on budget and task complexity.
 * When a user selects "oh-im-broke/oib-autoselect", this hook intercepts it and substitutes
 * the best available model from BudgetOrchestrator.
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
     * chat.message - Intercept messages to substitute oib-autoselect with actual model
     */
    "chat.message": async (
      input: {
        sessionID: string
        agent?: string
        model?: { providerID: string; modelID: string }
        messageID?: string
      },
      output: {
        message: Record<string, unknown>
        parts: unknown[]
      }
    ): Promise<void> => {
      // Check if virtual model is being used
      if (!input.model) {
        return
      }

      const modelStr = `${input.model.providerID}/${input.model.modelID}`
      
      if (modelStr !== VIRTUAL_MODEL_ID) {
        return
      }

      try {
        // Get the best model for orchestrator use case
        const selectedModel = budgetOrchestrator.getBestModelForUseCase("orchestrator", undefined)
        
        // Parse the selected model
        const [providerID, modelID] = selectedModel.split("/")
        
        if (!providerID || !modelID) {
          log("[oib-autoselect] Invalid model format from BudgetOrchestrator, using fallback", {
            selectedModel,
            fallback: DEFAULT_FALLBACK_MODEL,
          })
          const [fallbackProvider, fallbackModel] = DEFAULT_FALLBACK_MODEL.split("/")
          output.message.model = fallbackProvider
          ;(output.message as { modelID?: string }).modelID = fallbackModel
        } else {
          // Substitute the model
          log(`[oib-autoselect] Substituting model: ${VIRTUAL_MODEL_ID} -> ${selectedModel}`)
          output.message.model = providerID
          ;(output.message as { modelID?: string }).modelID = modelID
        }
      } catch (error) {
        log("[oib-autoselect] Error selecting model, using fallback", {
          error: error instanceof Error ? error.message : String(error),
          fallback: DEFAULT_FALLBACK_MODEL,
        })
        const [fallbackProvider, fallbackModel] = DEFAULT_FALLBACK_MODEL.split("/")
        output.message.model = fallbackProvider
        ;(output.message as { modelID?: string }).modelID = fallbackModel
      }
    },

    /**
     * event - Handle session events (no-op for now)
     */
    event: async (_input: { event: { type: string; properties?: unknown } }): Promise<void> => {
      // No-op: reserved for future session-level logic
    },
  }
}
