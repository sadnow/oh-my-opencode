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
 * This hook tracks every assistant message and estimates token usage.
 * It fires during chat.message, tracking both user and assistant messages.
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

  // Track last user message tokens per session (for input estimation)
  const sessionInputTokens = new Map<string, number>()

  return {
    "chat.message": async (
      input: {
        sessionID: string
        agent?: string
        model?: { providerID: string; modelID: string }
        messageID?: string
      },
      output: {
        message: Record<string, unknown> & { info?: MessageInfo }
        parts: MessagePart[]
      }
    ): Promise<void> => {
      try {
        const sessionId = input.sessionID
        
        // Extract role from message info or infer from parts
        const messageInfo = output.message.info
        const role = messageInfo?.role
        
        // Skip if we can't determine role
        if (!role) {
          return
        }

        // Estimate tokens from message parts
        const messageTokens = estimateTokensFromParts(output.parts)

        if (role === "user") {
          // Store user input tokens for the next assistant response
          sessionInputTokens.set(sessionId, messageTokens)
          return
        }

        if (role === "assistant") {
          // Get stored input tokens (default to message tokens if not found)
          const inputTokens = sessionInputTokens.get(sessionId) ?? messageTokens
          const outputTokens = messageTokens

          // Clear stored input tokens
          sessionInputTokens.delete(sessionId)

          // Extract model and provider info
          const modelStr = messageInfo?.model ?? messageInfo?.agent ?? input.agent ?? "unknown"
          const modelName = extractModelName(modelStr)
          const provider = extractProvider(modelStr)

          // Get pricing
          const pricing = MODEL_PRICING[modelName] ?? DEFAULT_PRICING

          // Calculate cost
          const cost = estimateCost(modelName, inputTokens, outputTokens, pricing)

          // Record usage
          usageTracker.recordUsage({
            provider,
            model: modelName,
            inputTokens,
            outputTokens,
            taskType: "primary", // Main session tasks
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
        }
      } catch (error) {
        log("[usage-tracking] Error in hook:", error)
      }
    },
  }
}
