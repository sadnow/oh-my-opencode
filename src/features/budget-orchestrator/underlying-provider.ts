/**
 * Underlying Provider Detection for OpenCode BYOK Models
 * 
 * Detects the actual provider behind OpenCode Zen BYOK model IDs.
 * e.g., opencode/gpt-4o → openai, opencode/gemini-pro → google
 * 
 * Native OpenCode models (qwen, deepseek, glm, kimi, big-pickle) return null.
 */

export const UNDERLYING_PROVIDER_PATTERNS: Record<string, RegExp> = {
  openai: /^opencode\/(gpt|o[0-9]|chatgpt|dall-e)/i,
  google: /^opencode\/(gemini|palm|bard)/i,
}

/**
 * Detect the underlying provider for an OpenCode BYOK model.
 * Returns null for native OpenCode models or non-opencode providers.
 */
export function detectUnderlyingProvider(modelId: string): string | null {
  if (!modelId || !modelId.toLowerCase().startsWith('opencode/')) return null
  
  for (const [provider, pattern] of Object.entries(UNDERLYING_PROVIDER_PATTERNS)) {
    if (pattern.test(modelId)) return provider
  }
  
  return null
}

/**
 * Check if a model is a native OpenCode model (always free, not BYOK).
 * Native models include: big-pickle, qwen, deepseek, glm, kimi, etc.
 */
export function isNativeOpenCodeModel(modelId: string): boolean {
  if (!modelId || !modelId.toLowerCase().startsWith('opencode/')) return false
  return detectUnderlyingProvider(modelId) === null
}