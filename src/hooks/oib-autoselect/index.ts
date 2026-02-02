import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"
import type { BudgetOrchestrator as ActualBudgetOrchestrator } from "../../features/budget-orchestrator"

/**
 * BudgetOrchestrator interface - compatible with actual implementation
 */
export type BudgetOrchestrator = ActualBudgetOrchestrator

const VIRTUAL_MODEL_ID = "oh-im-broke/oib-autoselect"
const VIRTUAL_PROVIDER_ID = "oh-im-broke"
const DEFAULT_FALLBACK_MODEL = "opencode/gpt-4o-mini"

// Track sessions that should use budget routing
// Key: sessionID, Value: true (session is using budget routing)
// Once a session starts with oib-autoselect, it continues budget routing for all subsequent messages
const oibSessionState = new Map<string, boolean>()

/**
 * OIB Autoselect Hook
 * 
 * Automatically selects the most cost-effective model based on budget and task complexity.
 * When a user selects "oh-im-broke/oib-autoselect", this hook intercepts it and substitutes
 * the best available model from BudgetOrchestrator.
 * 
 * IMPORTANT: Once a session starts with oib-autoselect, ALL subsequent messages in that
 * session will use budget-aware routing, even though the UI may show a different model.
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
      const isVirtualModel = modelStr === VIRTUAL_MODEL_ID
      const isTrackedSession = oibSessionState.has(input.sessionID)
      
      log("[oib-autoselect] Intercepted message", {
        sessionID: input.sessionID,
        currentModel: modelStr,
        isVirtualModel,
        isTrackedSession,
        trackedSessions: Array.from(oibSessionState.keys())
      })
      
      // Determine if this session should use budget routing
      if (isVirtualModel || isTrackedSession) {
        if (isVirtualModel) {
          // User explicitly selected oib-autoselect - enable budget routing for this session
          oibSessionState.set(input.sessionID, true)
          log("[oib-autoselect] Virtual model selected, enabling budget routing", { sessionID: input.sessionID })
        } else {
          log("[oib-autoselect] Continuing budget routing for tracked session", { sessionID: input.sessionID })
        }
      } else {
        // Not a virtual model and not a tracked session - do nothing
        log("[oib-autoselect] Skipping (not virtual, not tracked)", { sessionID: input.sessionID, model: modelStr })
        return
      }

      try {
        // Get the best model for orchestrator use case
        log("[oib-autoselect] Calling getBestModelForUseCase...", { sessionID: input.sessionID })
        const selectedModel = budgetOrchestrator.getBestModelForUseCase("orchestrator", undefined)
        log("[oib-autoselect] BudgetOrchestrator returned", { sessionID: input.sessionID, selectedModel })
        
        // Defensive parsing and validation
        if (!selectedModel || typeof selectedModel !== "string" || !selectedModel.includes("/")) {
          log("[oib-autoselect] Invalid model format from BudgetOrchestrator, using fallback", {
            sessionID: input.sessionID,
            selectedModel,
            fallback: DEFAULT_FALLBACK_MODEL,
          })
          const [fallbackProvider, fallbackModel] = DEFAULT_FALLBACK_MODEL.split("/")
          output.message.model = { providerID: fallbackProvider, modelID: fallbackModel }
          return
        }

        const parts = selectedModel.split("/")
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          log("[oib-autoselect] Model split produced invalid parts, using fallback", {
            sessionID: input.sessionID,
            selectedModel,
            parts,
            fallback: DEFAULT_FALLBACK_MODEL,
          })
          const [fallbackProvider, fallbackModel] = DEFAULT_FALLBACK_MODEL.split("/")
          output.message.model = { providerID: fallbackProvider, modelID: fallbackModel }
          return
        }

        const [providerID, modelID] = parts
        
        // Substitute the model - must be an object with providerID and modelID
        log(`[oib-autoselect] Model substitution completed`, {
          sessionID: input.sessionID,
          from: modelStr,
          to: selectedModel,
          providerID,
          modelID
        })
        output.message.model = { providerID, modelID }
      } catch (error) {
        log("[oib-autoselect] Error selecting model, using fallback", {
          error: error instanceof Error ? error.message : String(error),
          fallback: DEFAULT_FALLBACK_MODEL,
        })
        const [fallbackProvider, fallbackModel] = DEFAULT_FALLBACK_MODEL.split("/")
        // Model must be an object with providerID and modelID
        output.message.model = { providerID: fallbackProvider, modelID: fallbackModel }
      }
    },

    /**
     * event - Handle session events for cleanup
     */
    event: async (input: { event: { type: string; properties?: unknown } }): Promise<void> => {
      // Clean up session tracking when session is deleted
      if (input.event.type === "session.deleted") {
        const props = input.event.properties as { info?: { id?: string } } | undefined
        const sessionID = props?.info?.id
        if (sessionID && oibSessionState.has(sessionID)) {
          oibSessionState.delete(sessionID)
          log("[oib-autoselect] Session removed from budget routing (deleted)", { sessionID })
        }
      }
    },
  }
}

/** @internal For testing only */
export function _resetOibSessionStateForTesting(): void {
  oibSessionState.clear()
}
