export type FallbackEntry = {
  providers: string[]
  model: string
  variant?: string // Entry-specific variant (e.g., GPT→high, Opus→max)
}

export type ModelRequirement = {
  fallbackChain: FallbackEntry[]
  variant?: string // Default variant (used when entry doesn't specify one)
}

// IMPORTANT: "opencode" provider routes through Zen BYOK which consumes daily free token
// allocations and bills at standard rates when exceeded.
//
// Rules for including "opencode" in fallback chains:
// - INCLUDE for native Zen models (big-pickle, glm-*, kimi-*, qwen-*) — these don't consume
//   OpenAI/Google/Anthropic tokens
// - EXCLUDE for OpenAI-underlying models (gpt-*, o1, o3, codex-*) — these consume OpenAI tokens
// - EXCLUDE for Google-underlying models (gemini-*) — these consume Google tokens
// - EXCLUDE for Anthropic-underlying models (claude-*) — these consume Anthropic tokens
//
// Users who want Zen BYOK should explicitly configure it in their oh-my-opencode.json.
// Silent fallback to paid BYOK models is a budget leak.

export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  sisyphus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2-codex", variant: "medium" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  oracle: {
    fallbackChain: [
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
   librarian: {
     fallbackChain: [
       { providers: ["zai-coding-plan"], model: "glm-4.7" },
       { providers: ["opencode"], model: "big-pickle" },
       { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
     ],
   },
  explore: {
    fallbackChain: [
      { providers: ["anthropic"], model: "claude-haiku-4-5" },
      { providers: ["github-copilot"], model: "gpt-5-mini" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  "multimodal-looker": {
    fallbackChain: [
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["zai-coding-plan"], model: "glm-4.6v" },
      { providers: ["anthropic", "github-copilot"], model: "claude-haiku-4-5" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  prometheus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  metis: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro", variant: "max" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  momus: {
    fallbackChain: [
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "medium" },
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro", variant: "max" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  atlas: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
}

export const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  "visual-engineering": {
    fallbackChain: [
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  ultrabrain: {
    fallbackChain: [
      { providers: ["openai", "github-copilot"], model: "gpt-5.2-codex", variant: "xhigh" },
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  artistry: {
    fallbackChain: [
      { providers: ["google", "github-copilot"], model: "gemini-3-pro", variant: "max" },
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  quick: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-haiku-4-5" },
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  "unspecified-low": {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2-codex", variant: "medium" },
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  "unspecified-high": {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  writing: {
    fallbackChain: [
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
}
