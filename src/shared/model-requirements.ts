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
//
// INTERLEAVING STRATEGY: Free and cheap native Zen models are INTERLEAVED with premium
// models, not dumped at the bottom. This preserves premium credits across the billing period.
//
// FREE (zero cost): glm-4.7-free, kimi-k2.5-free, big-pickle
// CHEAP native (budget/economy, still costs Zen credits): kimi-k2-thinking (~$0.60/1M),
//   glm-4.7 (~$0.60/1M), qwen3-coder (economy tier)
//
// Light tasks get free models FIRST; heavy tasks get cheap native models interleaved
// between premium options to spread premium credit usage across the billing period.

export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  // Heavy agents: premium first, but cheap native models interleaved BETWEEN premium
  // providers so they get exposure when any one premium provider is temporarily unavailable
  sisyphus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved early
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2-codex", variant: "medium" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — after second premium
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  oracle: {
    fallbackChain: [
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — strong reasoning
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — after second premium
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  librarian: {
    fallbackChain: [
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
      { providers: ["opencode"], model: "qwen3-coder" },       // CHEAP native — good for code search
      { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  // Light agents: free/cheap models FIRST — these tasks don't need premium quality
  explore: {
    fallbackChain: [
      { providers: ["opencode"], model: "glm-4.7-free" },      // FREE FIRST — fast, saves credits
      { providers: ["anthropic"], model: "claude-haiku-4-5" },
      { providers: ["opencode"], model: "kimi-k2.5-free" },    // FREE — interleaved
      { providers: ["github-copilot"], model: "gpt-5-mini" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  "multimodal-looker": {
    fallbackChain: [
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — after first premium
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["zai-coding-plan"], model: "glm-4.6v" },
      { providers: ["anthropic", "github-copilot"], model: "claude-haiku-4-5" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  prometheus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved early
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — after second premium
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  metis: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved early
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — after second premium
      { providers: ["google", "github-copilot"], model: "gemini-3-pro", variant: "max" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  momus: {
    fallbackChain: [
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "medium" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved early
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — after second premium
      { providers: ["google", "github-copilot"], model: "gemini-3-pro", variant: "max" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  atlas: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved early
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — after second premium
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
}

export const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  "visual-engineering": {
    fallbackChain: [
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — after first premium
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — interleaved
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  ultrabrain: {
    fallbackChain: [
      { providers: ["openai", "github-copilot"], model: "gpt-5.2-codex", variant: "xhigh" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — strong reasoning
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — interleaved
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  artistry: {
    fallbackChain: [
      { providers: ["google", "github-copilot"], model: "gemini-3-pro", variant: "max" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — interleaved
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  // Light categories: free/cheap models EARLY — these don't need premium quality
  quick: {
    fallbackChain: [
      { providers: ["opencode"], model: "glm-4.7-free" },      // FREE FIRST — fast, zero cost
      { providers: ["anthropic", "github-copilot"], model: "claude-haiku-4-5" },
      { providers: ["opencode"], model: "kimi-k2.5-free" },    // FREE — interleaved
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  "unspecified-low": {
    fallbackChain: [
      { providers: ["opencode"], model: "glm-4.7-free" },      // FREE FIRST — save premium
      { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
      { providers: ["opencode"], model: "kimi-k2.5-free" },    // FREE — interleaved
      { providers: ["openai", "github-copilot"], model: "gpt-5.2-codex", variant: "medium" },
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  "unspecified-high": {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot"], model: "claude-opus-4-5", variant: "max" },
      { providers: ["opencode"], model: "kimi-k2-thinking" },  // CHEAP native — interleaved early
      { providers: ["openai", "github-copilot"], model: "gpt-5.2", variant: "high" },
      { providers: ["opencode"], model: "glm-4.7" },           // CHEAP native — interleaved
      { providers: ["google", "github-copilot"], model: "gemini-3-pro" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
  writing: {
    fallbackChain: [
      { providers: ["opencode"], model: "glm-4.7-free" },      // FREE FIRST — good enough for writing
      { providers: ["google", "github-copilot"], model: "gemini-3-flash" },
      { providers: ["opencode"], model: "kimi-k2.5-free" },    // FREE — interleaved
      { providers: ["anthropic", "github-copilot"], model: "claude-sonnet-4-5" },
      { providers: ["zai-coding-plan"], model: "glm-4.7" },
      { providers: ["openai", "github-copilot"], model: "gpt-5.2" },
      { providers: ["opencode"], model: "big-pickle" },
    ],
  },
}
