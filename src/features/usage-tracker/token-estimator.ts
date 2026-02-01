/**
 * Token Estimation Utility
 * 
 * IMPORTANT: This is a ROUGH ESTIMATION based on character/word counts.
 * Actual token counts require access to model-specific tokenizers.
 * 
 * TODO: Once we fork OpenCode, integrate with actual token counts from API responses.
 * See: https://github.com/sst/opencode/issues/XXXX
 * 
 * Estimation Strategy:
 * - English text: ~4 characters per token (OpenAI's rule of thumb)
 * - Code: ~3.5 characters per token (code is more token-dense)
 * - JSON/structured: ~3 characters per token (brackets, quotes, etc.)
 * 
 * These are conservative estimates to avoid underestimating costs.
 */

import { TokenizerAdapter } from '../../shared/tokenizer-adapter'
import { normalizeModelID } from '../../shared/model-normalizer'

const tokenizerAdapter = new TokenizerAdapter()

/**
 * Estimate token count from text content.
 * This is a ROUGH approximation and will deviate from actual token counts.
 */
export function estimateTokens(text: string, provider: string = 'unknown', model: string = 'unknown'): number {
  if (!text) return 0

  return tokenizerAdapter.countTokens(provider, model, text)
}

/**
 * Estimate token count from message parts.
 * Handles text, tool_use, and tool_result parts.
 */
export function estimateTokensFromParts(parts: unknown[], provider: string = 'unknown', model: string = 'unknown'): number {
  if (!Array.isArray(parts)) return 0

  let totalTokens = 0

  for (const part of parts) {
    if (typeof part !== 'object' || part === null) continue

    const p = part as { type?: string; text?: string; input?: unknown; output?: unknown; content?: unknown }

    if (p.type === 'text' && typeof p.text === 'string') {
      totalTokens += estimateTokens(p.text, provider, model)
    } else if (p.type === 'tool_use' && p.input) {
      // Tool input is structured data
      const inputStr = typeof p.input === 'string' ? p.input : JSON.stringify(p.input)
      totalTokens += estimateTokens(inputStr, provider, model)
    } else if (p.type === 'tool_result') {
      // Tool output can be text or structured
      const output = p.output ?? p.content
      if (output) {
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output)
        totalTokens += estimateTokens(outputStr, provider, model)
      }
    }
  }

  return totalTokens
}

/**
 * Estimate cost based on model pricing and token counts.
 * Returns cost in USD.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  pricing: { inputPer1M: number; outputPer1M: number }
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M
  return inputCost + outputCost
}

/**
 * Extract model name from various model string formats.
 * Examples:
 * - "anthropic/claude-opus-4-5" -> "claude-opus-4-5"
 * - "openai/gpt-5.2" -> "gpt-5.2"
 * - "claude-sonnet-4-5" -> "claude-sonnet-4-5"
 */
export function extractModelName(modelStr: string): string {
  if (!modelStr) return 'unknown'
  
  // Remove provider prefix if present
  const parts = modelStr.split('/')
  return normalizeModelID(parts[parts.length - 1])
}

/**
 * Determine provider from model string or agent name.
 */
export function extractProvider(modelStr: string): string {
  const lower = modelStr.toLowerCase()
  
  // 1. Handle explicit provider prefixes (e.g., "github-copilot/claude-sonnet-4.5")
  if (lower.includes('/')) {
    const prefix = lower.split('/')[0]
    if (prefix === 'github-copilot') {
      // For github-copilot, we need to check the model name to find the actual provider
      if (lower.includes('gpt')) return 'openai'
      if (lower.includes('claude')) return 'anthropic'
      return 'github-copilot'
    }
    if (prefix === 'anthropic') return 'anthropic'
    if (prefix === 'openai') return 'openai'
    if (prefix === 'google') return 'google'
    // Fall through for other prefixes to check keywords below
  }

  // 2. Keyword-based detection for common models and providers
  if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic'
  if (lower.includes('gpt') || lower.includes('openai')) return 'openai'
  if (lower.includes('gemini') || lower.includes('google')) return 'google'
  if (lower.includes('kimi') || lower.includes('moonshot')) return 'moonshot'
  if (lower.includes('glm') || lower.includes('zhipu')) return 'zhipu'
  if (lower.includes('qwen') || lower.includes('alibaba')) return 'alibaba'
  if (lower.includes('opencode')) return 'opencode'
  
  return 'unknown'
}
