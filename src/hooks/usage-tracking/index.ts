/**
 * Usage Tracking Hook
 * 
 * Intercepts chat messages to estimate token usage and record costs.
 * 
 * ⚠️ IMPORTANT LIMITATIONS:
 * 
 * This hook uses MESSAGE-BASED ESTIMATION, not actual token counts from API responses.
 * Accuracy: ±20-30% variance expected
 * 
 * WHY: OpenCode does not expose token counts in hook callbacks. We calculate rough
 * estimates based on character counts and heuristics.
 * 
 * TODO: FORK OPENCODE AND ADD TOKEN COUNT EXPOSURE
 * 
 * Once we fork OpenCode (planned):
 * 1. Add token count fields to chat.message.after event
 * 2. Expose usage metadata in PostToolUse hooks
 * 3. Replace estimation logic with actual API response data
 * 4. Update documentation to remove accuracy warnings
 * 
 * Tracking: https://github.com/sst/opencode/issues/XXXX
 * 
 * For now, this estimation is better than nothing for budget awareness.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { UsageTracker } from "../../features/usage-tracker"
import { log } from "../../shared"
import {
  estimateTokensFromParts,
  estimateCost,
  extractModelName,
  extractProvider,
} from "../../features/usage-tracker/token-estimator"

// Re-import pricing from tracker.ts (centralized)
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  // Anthropic
  "claude-opus-4-5": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-sonnet-4-5": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-haiku-4-5": { inputPer1M: 0.25, outputPer1M: 1.25 },
  // OpenAI
  "gpt-5.2": { inputPer1M: 10.0, outputPer1M: 30.0 },
  "gpt-5.2-codex": { inputPer1M: 15.0, outputPer1M: 60.0 },
  "gpt-5-nano": { inputPer1M: 0.15, outputPer1M: 0.60 },
  // Google Gemini
  "gemini-3-flash-preview": { inputPer1M: 0.075, outputPer1M: 0.30 },
  "gemini-3-pro": { inputPer1M: 1.25, outputPer1M: 5.0 },
  // OpenCode
  "big-pickle": { inputPer1M: 0.5, outputPer1M: 2.0 },
  // Kimi
  "kimi-k2-thinking": { inputPer1M: 5.0, outputPer1M: 20.0 },
  "kimi-k2-0905": { inputPer1M: 3.0, outputPer1M: 12.0 },
  // GLM
  "glm-4.6": { inputPer1M: 0.5, outputPer1M: 2.0 },
  "glm-4.7": { inputPer1M: 2.0, outputPer1M: 8.0 },
  // Qwen
  "qwen3-coder-480b": { inputPer1M: 4.0, outputPer1M: 16.0 },
}

const DEFAULT_PRICING = { inputPer1M: 5.0, outputPer1M: 20.0 }

interface MessagePart {
  type: string
  text?: string
  input?: unknown
  output?: unknown
  content?: unknown
  [key: string]: unknown
}

/**
 * Helper to retry an operation with exponential backoff.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        log(`[usage-tracking] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay due to:`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

/**
 * Create usage tracking hook.
 * 
 * This hook tracks conversations by subscribing to message events.
 * When a user sends a message, we immediately capture input tokens.
 * We then listen for the assistant's response to capture output tokens.
 */
export function createUsageTrackingHook(
  ctx: PluginInput,
  usageTracker: UsageTracker | null
) {
  if (!usageTracker) {
    log("[usage-tracking] Tracker disabled, hook not registered")
    return null
  }

  log("[usage-tracking] Hook registered - using EVENT-DRIVEN ESTIMATION (±20-30% accuracy)")

  // Track pending sessions waiting for assistant response
  const pendingSessions = new Map<string, {
    inputTokens: number;
    model: { providerID: string; modelID: string };
    timestamp: number;
  }>()

  // Track already-processed assistant messages to prevent duplicates
  const processedMessages = new Set<string>()

  return {
    "chat.message": async (
      input: {
        sessionID: string
        agent?: string
        model?: { providerID: string; modelID: string }
        messageID?: string
      },
      output: {
        message: Record<string, unknown>
        parts: MessagePart[]
      }
    ): Promise<void> => {
      try {
        // DIAGNOSTIC: Log ALL input/output structure
        log("[usage-tracking] chat.message CALLED - Full structure:", {
          input_keys: Object.keys(input),
          sessionID: input.sessionID,
          agent: input.agent,
          messageID: input.messageID,
          has_model: !!input.model,
          model_keys: input.model ? Object.keys(input.model) : [],
          model_providerID: input.model?.providerID,
          model_modelID: input.model?.modelID,
          output_keys: Object.keys(output),
          message_keys: Object.keys(output.message || {}),
          parts_length: output.parts?.length || 0,
          parts_sample: output.parts?.[0] ? { type: output.parts[0].type, has_text: 'text' in output.parts[0] } : null
        })

        const sessionId = input.sessionID
        const messageId = input.messageID
        
        // CHANGED: Don't return early - store with placeholder if needed
        const modelInfo = input.model || { providerID: "unknown-provider", modelID: "unknown-model" }
        const effectiveMessageId = messageId || `generated-${sessionId}-${Date.now()}`

        // Immediate synchronous capture of input tokens
        const inputTokens = estimateTokensFromParts(output.parts)
        
        log("[usage-tracking] Storing pending session (even if missing model/ID):", {
          sessionId,
          messageId: effectiveMessageId,
          model: `${modelInfo.providerID}/${modelInfo.modelID}`,
          inputTokens,
          pendingSessionsSize: pendingSessions.size
        })

        pendingSessions.set(sessionId, {
          inputTokens,
          model: modelInfo,
          timestamp: Date.now()
        })

        log("[usage-tracking] pendingSessions after set:", {
          size: pendingSessions.size,
          keys: Array.from(pendingSessions.keys())
        })

        // Cleanup old pending sessions (older than 1 hour) to prevent memory leaks
        const oneHourAgo = Date.now() - 3600000
        for (const [sid, data] of pendingSessions.entries()) {
          if (data.timestamp < oneHourAgo) {
            pendingSessions.delete(sid)
          }
        }

      } catch (error) {
        log("[usage-tracking] Error in chat.message hook:", error)
      }
    },

    event: async (input: { event: { type: string; properties?: unknown } }) => {
      try {
        const { event } = input

        // INSTRUMENTATION: Log FULL event structure at entry
        if (event.properties && typeof event.properties === "object") {
          const props = event.properties as Record<string, any>;
          if (props.info) {
          }
        }

        // Console.error for ALL events so we can see if hook is being called
        if (event.type.startsWith("message.")) {
        }

        // Skip streaming updates - only process final message.updated
        if (event.type === "message.part.updated") {
          return
        }

        // Process BOTH message.updated AND message.created
        if (event.type !== "message.updated" && event.type !== "message.created") {
          return
        }

        const props = event.properties as Record<string, unknown> | undefined
        const info = props?.info as Record<string, unknown> | undefined

        if (!info) {
          log("[usage-tracking] message event missing info", { 
            event_type: event.type,
            props_keys: props ? Object.keys(props) : []
          })
          return
        }

        const sessionID = info?.sessionID as string | undefined
        const role = info?.role as string | undefined
        const messageID = info?.messageID as string | undefined
        const model = info?.model as { providerID: string; modelID: string } | undefined
        const parts = info?.parts as MessagePart[] | undefined


        // ✅ NEW: Capture USER messages here (since chat.message doesn't fire)
        if (role === "user" && sessionID) {
          const inputTokens = estimateTokensFromParts(parts || [])
          
          if (inputTokens > 0) {
            const modelInfo = model || { providerID: "unknown-provider", modelID: "unknown-model" }
            
            pendingSessions.set(sessionID, {
              inputTokens,
              model: modelInfo,
              timestamp: Date.now()
            })
            
            log("[usage-tracking] Stored user input in pending sessions:", {
              sessionID,
              inputTokens,
              model: `${modelInfo.providerID}/${modelInfo.modelID}`,
              pendingSessions_size: pendingSessions.size
            })
          }
          return
        }

        // ✅ Handle ASSISTANT messages
        if (role !== "assistant") {
          return
        }

        // Skip if already processed
        if (messageID && processedMessages.has(messageID)) {
          log("[usage-tracking] Skipping already processed message:", messageID)
          return
        }

        // Look up pending session data
        const pendingData = sessionID ? pendingSessions.get(sessionID) : undefined

        if (!pendingData) {
          log("[usage-tracking] No pending session for assistant message:", { 
            sessionID, 
            messageID,
            available_sessions: Array.from(pendingSessions.keys()),
            pendingSessions_size: pendingSessions.size
          })
          return
        }


        // Get message parts for token estimation
        if (!parts || parts.length === 0) {
          log("[usage-tracking] Assistant message has no parts, skipping:", messageID)
          return
        }

        // Estimate output tokens
        const outputTokens = estimateTokensFromParts(parts)

        // Skip if zero tokens (still streaming or empty)
        if (outputTokens === 0) {
          log("[usage-tracking] Assistant message has zero tokens, skipping:", messageID)
          return
        }

        // Calculate cost
        const modelName = extractModelName(model?.modelID || pendingData.model.modelID)
        const pricing = MODEL_PRICING[modelName] || DEFAULT_PRICING
        const cost = estimateCost(modelName, pendingData.inputTokens, outputTokens, pricing)


        // Record usage
        await usageTracker.recordUsage({
          sessionID: sessionID!,
          inputTokens: pendingData.inputTokens,
          outputTokens,
          model: model?.modelID || pendingData.model.modelID,
          provider: model?.providerID || pendingData.model.providerID,
          taskType: "primary"
        })

        
        log("[usage-tracking] ✅ Successfully recorded usage!", {
          sessionID,
          inputTokens: pendingData.inputTokens,
          outputTokens,
          cost,
          model: model?.modelID || pendingData.model.modelID
        })

        // Mark as processed
        if (messageID) {
          processedMessages.add(messageID)
        }

        // Clean up pending session
        pendingSessions.delete(sessionID!)

      } catch (error) {
        log("[usage-tracking] Error in event handler:", error)
      }
    },
  }
}
