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
        const sessionId = input.sessionID
        const messageId = input.messageID
        
        if (!messageId || !input.model) {
          log("[usage-tracking] chat.message missing ID or model info", { sessionId, messageId, hasModel: !!input.model })
          return
        }

        // Immediate synchronous capture of input tokens
        const inputTokens = estimateTokensFromParts(output.parts)
        
        log("[usage-tracking] Synchronous input capture:", {
          sessionId,
          messageId,
          model: `${input.model.providerID}/${input.model.modelID}`,
          inputTokens
        })

        pendingSessions.set(sessionId, {
          inputTokens,
          model: input.model,
          timestamp: Date.now()
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

        // Only process message.updated events
        if (event.type !== "message.updated") {
          return
        }

        const props = event.properties as Record<string, unknown> | undefined
        const info = props?.info as Record<string, unknown> | undefined

        if (!info) {
          log("[usage-tracking] message.updated event missing info")
          return
        }

        const sessionID = info?.sessionID as string | undefined
        const role = info?.role as string | undefined
        const messageID = info?.messageID as string | undefined
        const model = info?.model as { providerID: string; modelID: string } | undefined

        // Only process assistant messages
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
          log("[usage-tracking] No pending session for assistant message:", { sessionID, messageID })
          return
        }

        // Get message parts for token estimation
        const parts = info?.parts as MessagePart[] | undefined
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
        const modelName = extractModelName(model?.modelID || "")
        const pricing = MODEL_PRICING[modelName] || DEFAULT_PRICING
        const cost = estimateCost(modelName, pendingData.inputTokens, outputTokens, pricing)

        log("[usage-tracking] Captured assistant message:", {
          sessionID,
          messageID,
          model: `${model?.providerID}/${model?.modelID}`,
          outputTokens,
          cost
        })

        // Record usage
        await usageTracker.recordUsage({
          sessionID: sessionID!,
          inputTokens: pendingData.inputTokens,
          outputTokens,
          model: model?.modelID || "",
          provider: model?.providerID || "",
          taskType: "primary"
        })

        log("[usage-tracking] Recorded usage:", {
          sessionID,
          inputTokens: pendingData.inputTokens,
          outputTokens,
          cost,
          model: model?.modelID
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
