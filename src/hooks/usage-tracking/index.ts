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

interface MessageInfo {
  role: "user" | "assistant"
  agent?: string
  model?: string
}

interface MessagePart {
  type: string
  text?: string
  input?: unknown
  output?: unknown
  content?: unknown
  [key: string]: unknown
}

/**
 * Create usage tracking hook.
 * 
 * This hook tracks conversations by polling message history after user input.
 * When a user sends a message, we wait briefly then fetch the conversation
 * history to capture the assistant's response with token estimates.
 */
export function createUsageTrackingHook(
  ctx: PluginInput,
  usageTracker: UsageTracker | null
) {
  if (!usageTracker) {
    log("[usage-tracking] Tracker disabled, hook not registered")
    return null
  }

  log("[usage-tracking] Hook registered - using MESSAGE-BASED ESTIMATION (±20-30% accuracy)")
  log("[usage-tracking] TODO: Fork OpenCode to expose actual token counts from API")

  // Track which messages we've already processed
  const processedMessages = new Set<string>()
  
  // Track pending sessions waiting for assistant response
  const pendingSessions = new Map<string, { userMessageId: string; timestamp: number }>()

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
        
        if (!messageId) {
          return
        }

        // This fires for USER messages only
        // Schedule a check for the assistant response after a delay
        pendingSessions.set(sessionId, {
          userMessageId: messageId,
          timestamp: Date.now()
        })

        // Wait for assistant to respond (poll after 2 seconds)
        setTimeout(async () => {
          try {
            const pending = pendingSessions.get(sessionId)
            if (!pending) return

            // Fetch messages from the session
            const response = await ctx.client.session.messages({
              path: { id: sessionId }
            })

            const messages = response.data || []
            
            // Find the user message and the following assistant response
            const userMsgIndex = messages.findIndex((m: any) => m.info.id === pending.userMessageId)
            if (userMsgIndex === -1) return

            // Look for assistant message after the user message
            for (let i = userMsgIndex + 1; i < messages.length; i++) {
              const msg = messages[i]
              if (msg.info.role === "assistant") {
                const msgId = msg.info.id
                
                // Skip if already processed
                if (processedMessages.has(msgId)) continue
                processedMessages.add(msgId)

                // Get user message for input token estimation
                const userMsg = messages[userMsgIndex]
                const inputTokens = estimateTokensFromParts(userMsg.parts)
                const outputTokens = estimateTokensFromParts(msg.parts)

                // Extract model and provider from info
                const modelInfo = (msg.info as any).model
                let modelStr = "unknown"
                if (modelInfo?.providerID && modelInfo?.modelID) {
                  modelStr = `${modelInfo.providerID}/${modelInfo.modelID}`
                } else if (input.agent) {
                  modelStr = input.agent
                }
                
                const modelName = extractModelName(modelStr)
                const provider = extractProvider(modelStr)

                // Get pricing and calculate cost
                const pricing = MODEL_PRICING[modelName] ?? DEFAULT_PRICING
                const cost = estimateCost(modelName, inputTokens, outputTokens, pricing)

                // Record usage
                usageTracker.recordUsage({
                  provider,
                  model: modelName,
                  inputTokens,
                  outputTokens,
                  taskType: "primary",
                  sessionID: sessionId,
                })

                log("[usage-tracking] Recorded estimated usage:", {
                  provider,
                  model: modelName,
                  inputTokens,
                  outputTokens,
                  cost: `$${cost.toFixed(4)}`,
                  warning: "ESTIMATED - actual may vary ±20-30%",
                })

                // Found and processed the assistant response
                break
              }
            }

            // Clean up pending session
            pendingSessions.delete(sessionId)
          } catch (error) {
            log("[usage-tracking] Error polling messages:", error)
          }
        }, 2000) // Wait 2 seconds for assistant response

      } catch (error) {
        log("[usage-tracking] Error in hook:", error)
      }
    },
  }
}
