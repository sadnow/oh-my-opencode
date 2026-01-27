/**
 * Orchestration Presets
 * Predefined model configurations for different use cases
 *
 * Model IDs use OpenCode format from https://models.dev/api.json
 * Format: provider/model-id (e.g., "anthropic/claude-sonnet-4-5")
 */

import type { CategoriesConfig, OrchestrationPreset } from "../../config/schema"

/**
 * Model tiers with best options per tier.
 * Priority order within each tier matters.
 * Updated January 2026 with current models from models.dev registry.
 *
 * Pricing reference (per 1M tokens, input/output):
 * - Premium: $3-5 / $15-25 (Opus 4.5, o3, GPT-5.2-Codex)
 * - Standard: $1-3 / $5-15 (Sonnet 4.5, GPT-5.2, Gemini 3 Pro)
 * - Budget: $0.5-1 / $2-5 (Haiku 4.5, Gemini 3 Flash, GLM-4.7, Kimi K2)
 * - Economy: $0.05-0.25 / $0.4-1 (GPT-4.1-nano, Qwen3, Gemini Flash Lite)
 */
export const MODEL_TIERS = {
  premium: ["claude-opus-4-5", "o3", "gpt-5.2-codex", "gemini-3-pro-preview"],
  standard: ["claude-sonnet-4-5", "gpt-5.2", "o1", "gemini-3-pro", "gemini-2.5-pro"],
  budget: ["claude-haiku-4-5", "gemini-3-flash-preview", "gemini-2.5-flash", "glm-4.7", "kimi-k2-thinking"],
  economy: ["gpt-4.1-nano", "gemini-2.5-flash-lite", "glm-4.6", "qwen3-coder"],
} as const

/**
 * Role-based model recommendations based on benchmark research.
 * Each role has models ordered by suitability (best first).
 * Updated January 2026 with current models.
 *
 * Roles map to actual task requirements:
 * - orchestrator: Complex planning, delegation (needs high reasoning)
 * - explore: Fast codebase grep (needs speed, not deep reasoning)
 * - debug: Root cause analysis (needs strong reasoning)
 * - implement: Code writing (needs coding ability)
 * - review: Code analysis (needs attention to detail)
 * - quick: Simple queries (needs speed)
 */
export const ROLE_MODELS = {
  /** sisyphus - Complex orchestration and task delegation (needs high reasoning) */
  orchestrator: ["claude-opus-4-5", "claude-sonnet-4-5", "o3", "gpt-5.2-codex", "glm-4.7"],
  /** oracle - Strategic advisor, debugging (needs highest reasoning) */
  oracle: ["claude-opus-4-5", "o3", "gpt-5.2", "kimi-k2-thinking", "glm-4.7"],
  /** explore - Fast codebase search (needs SPEED, not deep reasoning) */
  explore: ["gemini-3-flash-preview", "gemini-2.5-flash", "gpt-4.1-nano", "claude-haiku-4-5"],
  /** librarian - Docs search, GitHub (needs moderate reasoning + tool use) */
  librarian: ["gemini-3-flash-preview", "gemini-2.5-flash", "claude-haiku-4-5", "glm-4.7-flash"],
  /** implement - Coding and implementation tasks */
  implement: ["claude-sonnet-4-5", "gpt-5.2-codex", "glm-4.7", "qwen3-coder"],
  /** review - Code analysis and review */
  review: ["claude-sonnet-4-5", "gpt-5.2", "kimi-k2-thinking", "glm-4.7"],
  /** debug - Reasoning and debugging (needs strong reasoning) */
  debug: ["kimi-k2-thinking", "claude-opus-4-5", "o3", "gpt-5.2", "glm-4.7"],
  /** quick - Fast responses, simple queries (needs SPEED) */
  quick: ["gemini-3-flash-preview", "gemini-2.5-flash", "gpt-4.1-nano", "claude-haiku-4-5"],
  /** ultrabrain - Deep reasoning and complex analysis */
  ultrabrain: ["claude-opus-4-5", "o3", "gpt-5.2", "kimi-k2-thinking", "claude-sonnet-4-5"],
  /** parallel-worker - Background agents (optimized for I/O-bound parallel tasks) */
  "parallel-worker": ["gemini-3-flash-preview", "gemini-2.5-flash", "gpt-4.1-nano", "glm-4.7-flash"],
  /** exploration - Breadth-first search and hypothesis generation */
  exploration: ["gemini-3-flash-preview", "gemini-2.5-flash", "gpt-4.1-nano", "glm-4.6"],
  /** analysis - Deep analysis before conclusions */
  analysis: ["kimi-k2-thinking", "claude-opus-4-5", "o3", "gpt-5.2", "glm-4.7"],
  /** synthesis - Final answer synthesis and conclusion generation */
  synthesis: ["claude-opus-4-5", "o3", "gpt-5.2", "claude-sonnet-4-5", "kimi-k2-thinking"],
} as const

/**
 * Provider prefixes for model resolution.
 * Maps model short names to their provider.
 * Updated January 2026 with current model names.
 */
export const PROVIDER_PREFIXES: Record<string, string> = {
  // Anthropic models (2026)
  "claude-opus-4-5": "anthropic",
  "claude-sonnet-4-5": "anthropic",
  "claude-haiku-4-5": "anthropic",
  "claude-3-7-sonnet-latest": "anthropic",
  "claude-3-5-haiku-latest": "anthropic",
  // OpenAI models (2026)
  "gpt-5.2": "openai",
  "gpt-5.2-codex": "openai",
  "gpt-5.1": "openai",
  "gpt-5.1-codex": "openai",
  "gpt-4.1-nano": "openai",
  "gpt-4.1-mini": "openai",
  "o1": "openai",
  "o1-mini": "openai",
  "o3": "openai",
  "o3-mini": "openai",
  "o4-mini": "openai",
  // Google models (2026) - Gemini 3.x is current
  "gemini-3-pro-preview": "google",
  "gemini-3-pro": "google",
  "gemini-3-flash-preview": "google",
  "gemini-3-flash": "google",
  "gemini-2.5-pro": "google",
  "gemini-2.5-flash": "google",
  "gemini-2.5-flash-lite": "google",
  // GitHub Copilot models (included in Pro+ subscription - effectively FREE)
  "copilot-gpt-4o": "github-copilot",
  "copilot-gpt-4o-mini": "github-copilot",
  "copilot-claude-sonnet": "github-copilot",
  "copilot-claude-haiku": "github-copilot",
  "copilot-o1-mini": "github-copilot",
  "copilot-o1": "github-copilot",
  // OpenCode (always available, no auth required)
  "kimi-k2-thinking": "opencode",
  "kimi-k2-thinking-turbo": "opencode",
  "kimi-k2.5": "opencode",
  "kimi-k2-0905": "opencode",
  "glm-4.6": "opencode",
  "glm-4.7": "opencode",
  "glm-4.7-flash": "opencode",
  "glm-4.7-free": "opencode",
  "big-pickle": "opencode",
  "qwen3-coder": "opencode",
  "qwen3-coder-flash": "opencode",
}

/**
 * Models available through GitHub Copilot Pro+ subscription.
 * These are "free" (included in subscription) and should be preferred for budget users.
 */
export const COPILOT_MODELS = {
  premium: ["github-copilot/o1", "github-copilot/claude-3.5-sonnet"],
  standard: ["github-copilot/gpt-4o", "github-copilot/claude-3.5-sonnet"],
  budget: ["github-copilot/gpt-4o-mini", "github-copilot/o1-mini"],
} as const

export interface PresetConfig {
  name: OrchestrationPreset
  description: string
  categories: CategoriesConfig
  /** Providers required for this preset */
  requiredProviders: string[]
}

/**
 * DEFAULT preset - oh-my-opencode maintainer's recommended defaults.
 *
 * Philosophy: Maximize quality with intelligent cost optimization.
 * - Premium reasoning for orchestration (Opus 4.5)
 * - Fast models for exploration/parallel work (Gemini 3 Flash)
 * - Strong coding models for implementation (Sonnet 4.5)
 * - Thinking models for analysis (Kimi K2)
 * - Leverages provider diversity for resilience
 */
export const DEFAULT_PRESET: PresetConfig = {
  name: "default",
  description: "oh-my-opencode maintainer's recommended defaults - quality with smart cost optimization",
  requiredProviders: [],
  categories: {
    ultrabrain: {
      description: "Deep reasoning - premium orchestration",
      model: "anthropic/claude-opus-4-5",
    },
    quick: {
      description: "Fast responses - Gemini 3 Flash for speed",
      model: "google/gemini-3-flash-preview",
    },
    "visual-engineering": {
      description: "Frontend - Sonnet for quality UI/UX",
      model: "anthropic/claude-sonnet-4-5",
    },
    artistry: {
      description: "Creative - balanced quality",
      model: "anthropic/claude-sonnet-4-5",
    },
    writing: {
      description: "Documentation - GPT-5.2 excels at prose",
      model: "openai/gpt-5.2",
    },
    "unspecified-low": {
      description: "Simple tasks - fast and cheap",
      model: "google/gemini-3-flash-preview",
    },
    "unspecified-high": {
      description: "Complex tasks - strong reasoning",
      model: "opencode/kimi-k2-thinking",
    },
    "parallel-worker": {
      description: "Background agents - fast parallel execution",
      model: "google/gemini-3-flash-preview",
    },
    exploration: {
      description: "Codebase exploration - speed matters",
      model: "google/gemini-3-flash-preview",
    },
    analysis: {
      description: "Deep analysis - thinking model",
      model: "opencode/kimi-k2-thinking",
    },
    synthesis: {
      description: "Final synthesis - premium quality",
      model: "anthropic/claude-opus-4-5",
    },
  },
}

/**
 * Balanced preset - Good mix of quality and cost.
 * Uses Sonnet for most tasks, Haiku for speed, Opus only for complex reasoning.
 */
export const BALANCED_PRESET: PresetConfig = {
  name: "balanced",
  description: "Balanced mix of quality and cost - good for most use cases",
  requiredProviders: ["anthropic"],
  categories: {
    ultrabrain: {
      description: "Deep reasoning and complex analysis",
      model: "anthropic/claude-opus-4-5",
    },
    quick: {
      description: "Fast responses for simple queries",
      model: "anthropic/claude-haiku-4-5",
    },
    "visual-engineering": {
      description: "Frontend and UI implementation",
      model: "anthropic/claude-sonnet-4-5",
    },
    artistry: {
      description: "Creative and design tasks",
      model: "anthropic/claude-sonnet-4-5",
    },
    writing: {
      description: "Documentation and content creation",
      model: "anthropic/claude-sonnet-4-5",
    },
  },
}

/**
 * Claude-heavy preset - Maximize Claude usage for highest quality.
 */
export const CLAUDE_HEAVY_PRESET: PresetConfig = {
  name: "claude-heavy",
  description: "Maximize Claude usage for highest quality output",
  requiredProviders: ["anthropic"],
  categories: {
    ultrabrain: {
      description: "Deep reasoning and complex analysis",
      model: "anthropic/claude-opus-4-5",
    },
    quick: {
      description: "Fast responses for simple queries",
      model: "anthropic/claude-sonnet-4-5",
    },
    "visual-engineering": {
      description: "Frontend and UI implementation",
      model: "anthropic/claude-opus-4-5",
    },
    artistry: {
      description: "Creative and design tasks",
      model: "anthropic/claude-opus-4-5",
    },
    writing: {
      description: "Documentation and content creation",
      model: "anthropic/claude-sonnet-4-5",
    },
  },
}

/**
 * Budget-conscious preset - Optimize cost-to-value ratio.
 *
 * Strategy: Use budget-tier models that still deliver quality.
 * - Gemini 3 Flash ($0.50/$3) for speed tasks - blazing fast, current gen
 * - GLM-4.7 ($0.60/$2.20) for coding - strong at agentic tasks
 * - Kimi K2 ($0.60/$2.50) for reasoning - thinking model, great for analysis
 * - Qwen3 Coder for economy coding tasks
 *
 * NOT "free tier" - intelligent cost optimization with quality models.
 */
export const BUDGET_CONSCIOUS_PRESET: PresetConfig = {
  name: "budget-conscious",
  description: "Optimized cost-to-value ratio with budget-tier models that still deliver quality",
  requiredProviders: [],
  categories: {
    ultrabrain: {
      description: "Deep reasoning - Kimi thinking model excels here",
      model: "opencode/kimi-k2-thinking",
    },
    quick: {
      description: "Fast responses - Gemini 3 Flash is blazing fast",
      model: "google/gemini-3-flash-preview",
    },
    "visual-engineering": {
      description: "Frontend implementation - GLM strong at coding",
      model: "opencode/glm-4.7",
    },
    artistry: {
      description: "Creative tasks - GLM handles creative well",
      model: "opencode/glm-4.7",
    },
    writing: {
      description: "Documentation - GLM good at writing",
      model: "opencode/glm-4.7",
    },
    "unspecified-low": {
      description: "Simple tasks - economy tier",
      model: "google/gemini-2.5-flash-lite",
    },
    "unspecified-high": {
      description: "Complex tasks - budget reasoning",
      model: "opencode/kimi-k2-thinking",
    },
  },
}

/**
 * Free tier preset - OpenCode models only (no API keys required).
 * For users who want to try without any paid API access.
 */
export const FREE_TIER_PRESET: PresetConfig = {
  name: "free-tier",
  description: "OpenCode models only - no API keys required, completely free",
  requiredProviders: [],
  categories: {
    ultrabrain: {
      description: "Deep reasoning - Kimi thinking model",
      model: "opencode/kimi-k2-thinking",
    },
    quick: {
      description: "Fast responses",
      model: "opencode/glm-4.6",
    },
    "visual-engineering": {
      description: "Frontend implementation",
      model: "opencode/glm-4.7",
    },
    artistry: {
      description: "Creative tasks",
      model: "opencode/glm-4.7",
    },
    writing: {
      description: "Documentation",
      model: "opencode/glm-4.6",
    },
    "unspecified-low": {
      description: "Simple tasks",
      model: "opencode/glm-4.6",
    },
    "unspecified-high": {
      description: "Complex tasks",
      model: "opencode/kimi-k2-thinking",
    },
  },
}

/**
 * Speed-optimized preset - Fastest models for rapid iteration.
 * Uses Gemini 3 Flash family for maximum speed (2026 current gen).
 */
export const SPEED_OPTIMIZED_PRESET: PresetConfig = {
  name: "speed-optimized",
  description: "Fastest models for quick iteration cycles",
  requiredProviders: ["google"],
  categories: {
    ultrabrain: {
      description: "Deep reasoning when needed",
      model: "anthropic/claude-sonnet-4-5",
    },
    quick: {
      description: "Fast responses - Gemini 3 Flash",
      model: "google/gemini-3-flash-preview",
    },
    "visual-engineering": {
      description: "Fast UI implementation",
      model: "google/gemini-3-flash-preview",
    },
    artistry: {
      description: "Quick creative tasks",
      model: "google/gemini-3-flash-preview",
    },
    writing: {
      description: "Fast documentation",
      model: "google/gemini-3-flash-preview",
    },
    "parallel-worker": {
      description: "Parallel background tasks",
      model: "google/gemini-2.5-flash-lite",
    },
  },
}

/**
 * Quality-first preset - Best models regardless of cost.
 * Premium tier across the board.
 */
export const QUALITY_FIRST_PRESET: PresetConfig = {
  name: "quality-first",
  description: "Best models for highest quality, regardless of cost",
  requiredProviders: ["anthropic", "openai"],
  categories: {
    ultrabrain: {
      description: "Deep reasoning - Opus is the best",
      model: "anthropic/claude-opus-4-5",
    },
    quick: {
      description: "Quality even for simple queries",
      model: "anthropic/claude-sonnet-4-5",
    },
    "visual-engineering": {
      description: "Premium UI implementation",
      model: "anthropic/claude-opus-4-5",
    },
    artistry: {
      description: "Premium creative tasks",
      model: "anthropic/claude-opus-4-5",
    },
    writing: {
      description: "Premium documentation - GPT excels at writing",
      model: "openai/gpt-5.2",
    },
  },
}

/**
 * Parallel-agent-optimized preset - For heavy parallel workloads.
 * Uses fast models for workers, quality for orchestration.
 */
export const PARALLEL_AGENT_PRESET: PresetConfig = {
  name: "parallel-agent-optimized",
  description: "Optimized for parallel agents - fast workers with quality orchestration",
  requiredProviders: ["anthropic", "google"],
  categories: {
    ultrabrain: {
      description: "Orchestrator decisions need quality",
      model: "anthropic/claude-sonnet-4-5",
    },
    quick: {
      description: "Fast parallel workers",
      model: "google/gemini-3-flash-preview",
    },
    "visual-engineering": {
      description: "Efficient UI tasks",
      model: "google/gemini-3-flash-preview",
    },
    artistry: {
      description: "Cost-effective creative",
      model: "opencode/glm-4.7",
    },
    writing: {
      description: "Efficient documentation",
      model: "opencode/glm-4.7",
    },
    "parallel-worker": {
      description: "Background agents - optimized for I/O-bound parallel tasks",
      model: "google/gemini-3-flash-preview",
    },
  },
}

/**
 * Hybrid-reasoning preset - Different models for different reasoning stages.
 * Cheap exploration -> deep analysis -> premium synthesis.
 */
export const HYBRID_REASONING_PRESET: PresetConfig = {
  name: "hybrid-reasoning",
  description: "Multi-stage reasoning - cheap exploration, premium synthesis",
  requiredProviders: ["anthropic", "google"],
  categories: {
    ultrabrain: {
      description: "Final synthesis - needs best reasoning",
      model: "anthropic/claude-opus-4-5",
    },
    quick: {
      description: "Initial exploration - needs speed",
      model: "google/gemini-3-flash-preview",
    },
    "visual-engineering": {
      description: "UI implementation with quality",
      model: "anthropic/claude-sonnet-4-5",
    },
    artistry: {
      description: "Creative with analysis",
      model: "opencode/kimi-k2-thinking",
    },
    writing: {
      description: "Documentation polish",
      model: "anthropic/claude-sonnet-4-5",
    },
    exploration: {
      description: "Breadth-first search - needs speed",
      model: "google/gemini-3-flash-preview",
    },
    analysis: {
      description: "Deep analysis - thinking model",
      model: "opencode/kimi-k2-thinking",
    },
    synthesis: {
      description: "Final synthesis - premium",
      model: "anthropic/claude-opus-4-5",
    },
  },
}

/**
 * All presets indexed by name.
 */
export const PRESETS: Record<OrchestrationPreset, PresetConfig | null> = {
  default: DEFAULT_PRESET,
  balanced: BALANCED_PRESET,
  "claude-heavy": CLAUDE_HEAVY_PRESET,
  "budget-conscious": BUDGET_CONSCIOUS_PRESET,
  "free-tier": FREE_TIER_PRESET,
  "speed-optimized": SPEED_OPTIMIZED_PRESET,
  "quality-first": QUALITY_FIRST_PRESET,
  "parallel-agent-optimized": PARALLEL_AGENT_PRESET,
  "hybrid-reasoning": HYBRID_REASONING_PRESET,
  custom: null, // Custom means user-defined
}

/**
 * Preset badges for UI display
 */
export const PRESET_BADGES: Record<OrchestrationPreset, string[]> = {
  default: ["Maintainer's Choice", "Recommended"],
  balanced: ["Anthropic-Focused"],
  "claude-heavy": ["High Quality", "Anthropic-Only"],
  "budget-conscious": ["Budget-Friendly", "Cost-Optimized"],
  "free-tier": ["Free", "No API Keys"],
  "speed-optimized": ["Fast", "Low Latency"],
  "quality-first": ["Premium", "Best Quality"],
  "parallel-agent-optimized": ["Parallel-Optimized", "Hybrid"],
  "hybrid-reasoning": ["Hybrid", "Multi-Stage"],
  custom: ["Custom"],
}

/**
 * Get a preset by name.
 */
export function getPreset(name: OrchestrationPreset): PresetConfig | null {
  return PRESETS[name]
}

/**
 * Get all available presets.
 */
export function getAllPresets(): PresetConfig[] {
  return Object.values(PRESETS).filter((p): p is PresetConfig => p !== null)
}

/**
 * Find the best model for a role given available providers.
 */
export function findBestModelForRole(
  role: keyof typeof ROLE_MODELS,
  availableProviders: string[]
): string | null {
  const candidates = ROLE_MODELS[role]

  for (const model of candidates) {
    const provider = PROVIDER_PREFIXES[model]
    if (availableProviders.includes(provider) || provider === "opencode") {
      return `${provider}/${model}`
    }
  }

  // Fallback to opencode/big-pickle
  return "opencode/big-pickle"
}
