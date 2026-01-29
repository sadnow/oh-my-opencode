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
 * ARCHITECTURE:
 * 1. chat.message hook captures USER messages with parts → store inputTokens
 * 2. message.updated event triggers → fetch full session messages via SDK client
 * 3. Extract assistant message parts from fetched messages → calculate outputTokens
 * 4. Record complete usage (input + output tokens)
 * 
 * This approach works because client.session.messages() DOES return complete message
 * data with parts, even though hooks don't.
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

interface SessionMessage {
  info?: {
    id?: string
    role?: string
    sessionID?: string
    model?: { providerID: string; modelID: string }
  }
  parts?: MessagePart[]
}

/**
 * Create usage tracking hook.
 * 
 * STRATEGY:
 * - chat.message captures user input tokens immediately (parts are available)
 * - message.updated event triggers fetching full session via client.session.messages()
 * - Fetched messages include complete parts data for both user and assistant
 * - Extract assistant message from fetched data and calculate output tokens
 */
export function createUsageTrackingHook(
  ctx: PluginInput,
  usageTracker: UsageTracker | null
) {
  if (!usageTracker) {
    log("[usage-tracking] Tracker disabled, hook not registered")
    return null
  }

  log("[usage-tracking] Hook registered - using hybrid approach: chat.message + SDK client fetch")

  // Track pending sessions waiting for assistant response
  const pendingSessions = new Map<string, {
    inputTokens: number;
    model: { providerID: string; modelID: string };
    timestamp: number;
  }>()

  // Track already-processed assistant messages to prevent duplicates
  const processedMessages = new Set<string>()

  return {
    /**
     * chat.message - Capture USER input tokens
     * This fires for user messages and we CAN get parts here
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
        parts: MessagePart[]
      }
    ): Promise<void> => {
      try {
        const sessionId = input.sessionID
        const messageId = input.messageID
        const role = output.message?.role as string | undefined
        const modelInfo = input.model || { providerID: "unknown-provider", modelID: "unknown-model" }

        // Only capture USER messages here
        if (role === "user") {
          const inputTokens = estimateTokensFromParts(output.parts)
          
          pendingSessions.set(sessionId, {
            inputTokens,
            model: modelInfo,
            timestamp: Date.now()
          })
          
          log("[usage-tracking] ✅ Stored USER input tokens:", {
            sessionId,
            inputTokens,
            model: `${modelInfo.providerID}/${modelInfo.modelID}`,
            pendingSessions_size: pendingSessions.size
          })

          // Cleanup old pending sessions (older than 1 hour) to prevent memory leaks
          const oneHourAgo = Date.now() - 3600000
          for (const [sid, data] of pendingSessions.entries()) {
            if (data.timestamp < oneHourAgo) {
              pendingSessions.delete(sid)
            }
          }
        }
      } catch (error) {
        log("[usage-tracking] Error in chat.message handler:", error)
      }
    },

    /**
     * event - Trigger on message.updated to fetch complete messages via SDK
     * This is where we get ASSISTANT message data with parts
     */
    event: async (input: { event: { type: string; properties?: unknown } }) => {
      try {
        const { event } = input

        // Only process message.updated events for assistant messages
        if (event.type !== "message.updated") {
          return
        }

        const props = event.properties as Record<string, unknown> | undefined
        const info = props?.info as Record<string, unknown> | undefined

        if (!info) {
          return
        }

        const sessionID = info?.sessionID as string | undefined
        const role = info?.role as string | undefined
        const messageID = info?.id as string | undefined

        // Only process assistant messages
        if (role !== "assistant" || !sessionID) {
          return
        }

        // Skip if already processed
        if (messageID && processedMessages.has(messageID)) {
          return
        }

        // Look up pending session data
        const pendingData = pendingSessions.get(sessionID)
        if (!pendingData) {
          log("[usage-tracking] No pending session for assistant message:", {
            sessionID,
            messageID,
            available_sessions: Array.from(pendingSessions.keys())
          })
          return
        }

        // FETCH COMPLETE SESSION MESSAGES VIA SDK CLIENT
        // This is the key - client.session.messages() DOES return parts data!
        try {
          const messagesResp = await ctx.client.session.messages({ 
            path: { id: sessionID } 
          })
          
          const messages = (messagesResp.data ?? []) as SessionMessage[]

          // Find the assistant message we just received
          let assistantMessage: SessionMessage | undefined
          
          // Look for the most recent assistant message (should be last or near last)
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            if (msg.info?.role === "assistant") {
              // If we have a messageID, match it; otherwise use the most recent assistant
              if (!messageID || msg.info?.id === messageID) {
                assistantMessage = msg
                break
              }
            }
          }

          if (!assistantMessage || !assistantMessage.parts || assistantMessage.parts.length === 0) {
            log("[usage-tracking] Assistant message not found or has no parts in fetched messages:", {
              sessionID,
              messageID,
              totalMessages: messages.length
            })
            return
          }

          // Extract output tokens from assistant message parts
          const outputTokens = estimateTokensFromParts(assistantMessage.parts)
          if (outputTokens === 0) {
            log("[usage-tracking] Assistant message has zero tokens:", messageID)
            return
          }

          // Get model info (prefer from assistant message, fallback to pending data)
          const modelInfo = assistantMessage.info?.model || pendingData.model

          // Calculate cost
          const modelName = extractModelName(modelInfo.modelID)
          const pricing = MODEL_PRICING[modelName] || DEFAULT_PRICING
          const cost = estimateCost(modelName, pendingData.inputTokens, outputTokens, pricing)

          // Record usage
          await usageTracker.recordUsage({
            sessionID,
            inputTokens: pendingData.inputTokens,
            outputTokens,
            model: modelInfo.modelID,
            provider: modelInfo.providerID,
            taskType: "primary"
          })

          log("[usage-tracking] ✅ Successfully recorded usage!", {
            sessionID,
            inputTokens: pendingData.inputTokens,
            outputTokens,
            cost,
            model: modelInfo.modelID,
            source: "SDK client fetch"
          })

          // Mark as processed and clean up
          if (messageID) {
            processedMessages.add(messageID)
          }
          pendingSessions.delete(sessionID)

        } catch (fetchError) {
          log("[usage-tracking] Error fetching session messages:", fetchError)
        }

      } catch (error) {
        log("[usage-tracking] Error in event handler:", error)
      }
    },
  }
}
