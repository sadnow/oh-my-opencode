/**
 * Orchestration Presets
 * Predefined model configurations for different use cases
 */

import type { CategoriesConfig, OrchestrationPreset } from "../../config/schema"

/**
 * Model tiers with best options per tier.
 * Priority order within each tier matters.
 */
export const MODEL_TIERS = {
  premium: ["claude-opus-4-5", "gpt-5.2-codex", "kimi-k2-thinking"],
  standard: ["claude-sonnet-4-5", "glm-4.7", "gpt-5.2"],
  budget: ["gemini-3-flash", "glm-4.6", "big-pickle"],
  economy: ["claude-haiku-4-5", "gpt-5-nano", "gemini-3-flash"],
} as const

/**
 * Role-based model recommendations based on benchmark research.
 * Each role has models ordered by suitability.
 */
export const ROLE_MODELS = {
  /** sisyphus/oracle - Complex orchestration and task delegation */
  orchestrator: ["claude-opus-4-5", "gpt-5.2-codex", "glm-4.7"],
  /** explore - Fast codebase search and navigation */
  explore: ["gemini-3-flash", "claude-haiku-4-5", "gpt-5-nano"],
  /** implement - Coding and implementation tasks */
  implement: ["claude-sonnet-4-5", "glm-4.7", "gpt-5.2-codex"],
  /** review - Code analysis and review */
  review: ["gpt-5.2", "kimi-k2-thinking", "claude-opus-4-5"],
  /** debug - Reasoning and debugging */
  debug: ["kimi-k2-thinking", "glm-4.7", "claude-opus-4-5"],
  /** quick - Fast responses, simple queries */
  quick: ["gemini-3-flash", "claude-haiku-4-5", "gpt-5-nano"],
  /** ultrabrain - Deep reasoning and complex analysis */
  ultrabrain: ["claude-opus-4-5", "gpt-5.2", "kimi-k2-thinking"],
  /** parallel-worker - Background agents and subagents (optimized for I/O-bound parallel tasks) */
  "parallel-worker": ["gemini-3-flash", "claude-haiku-4-5", "gpt-5-nano"],
  /** exploration - Breadth-first search and hypothesis generation */
  exploration: ["gemini-3-flash", "claude-haiku-4-5", "gpt-5-nano"],
  /** analysis - Deep analysis before conclusions */
  analysis: ["kimi-k2-thinking", "gpt-5.2", "claude-opus-4-5"],
  /** synthesis - Final answer synthesis and conclusion generation */
  synthesis: ["claude-opus-4-5", "gpt-5.2", "kimi-k2-thinking"],
} as const

/**
 * Provider prefixes for model resolution.
 */
export const PROVIDER_PREFIXES: Record<string, string> = {
  "claude-opus-4-5": "anthropic",
  "claude-sonnet-4-5": "anthropic",
  "claude-haiku-4-5": "anthropic",
  "gpt-5.2": "openai",
  "gpt-5.2-codex": "openai",
  "gpt-5-nano": "openai",
  "gemini-3-flash": "google",
  "gemini-3-pro": "google",
  "kimi-k2-thinking": "opencode",
  "kimi-k2-0905": "opencode",
  "glm-4.6": "opencode",
  "glm-4.7": "opencode",
  "big-pickle": "opencode",
  "qwen3-coder-480b": "opencode",
}

export interface PresetConfig {
  name: OrchestrationPreset
  description: string
  categories: CategoriesConfig
  /** Providers required for this preset */
  requiredProviders: string[]
}

/**
 * Balanced preset - Good mix of quality and cost.
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
 * Claude-heavy preset - Maximize Claude usage.
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
 * Budget-conscious preset - Minimize costs.
 */
export const BUDGET_CONSCIOUS_PRESET: PresetConfig = {
  name: "budget-conscious",
  description: "Minimize costs with cheaper models where possible",
  requiredProviders: [],
  categories: {
    ultrabrain: {
      description: "Deep reasoning and complex analysis",
      model: "opencode/big-pickle",
    },
    quick: {
      description: "Fast responses for simple queries",
      model: "opencode/big-pickle",
    },
    "visual-engineering": {
      description: "Frontend and UI implementation",
      model: "opencode/big-pickle",
    },
    artistry: {
      description: "Creative and design tasks",
      model: "opencode/big-pickle",
    },
    writing: {
      description: "Documentation and content creation",
      model: "opencode/big-pickle",
    },
  },
}

/**
 * Speed-optimized preset - Fastest models.
 */
export const SPEED_OPTIMIZED_PRESET: PresetConfig = {
  name: "speed-optimized",
  description: "Fastest models for quick iteration cycles",
  requiredProviders: ["google"],
  categories: {
    ultrabrain: {
      description: "Deep reasoning and complex analysis",
      model: "anthropic/claude-sonnet-4-5",
    },
    quick: {
      description: "Fast responses for simple queries",
      model: "google/gemini-3-flash",
    },
    "visual-engineering": {
      description: "Frontend and UI implementation",
      model: "google/gemini-3-flash",
    },
    artistry: {
      description: "Creative and design tasks",
      model: "google/gemini-3-flash",
    },
    writing: {
      description: "Documentation and content creation",
      model: "google/gemini-3-flash",
    },
  },
}

/**
 * Quality-first preset - Best models regardless of cost.
 */
export const QUALITY_FIRST_PRESET: PresetConfig = {
  name: "quality-first",
  description: "Best models for highest quality, regardless of cost",
  requiredProviders: ["anthropic", "openai"],
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
      model: "openai/gpt-5.2",
    },
  },
}

/**
 * Parallel-agent-optimized preset - Optimized for launching many parallel agents.
 * Uses Sonnet for orchestration (preserves quality for critical decisions)
 * while agents use fast models (Gemini Flash excels at parallel I/O-bound tasks).
 */
export const PARALLEL_AGENT_PRESET: PresetConfig = {
  name: "parallel-agent-optimized",
  description: "Optimized for parallel agents - fast workers with quality orchestration",
  requiredProviders: ["anthropic", "google"],
  categories: {
    ultrabrain: {
      description: "Reserved for orchestrator decisions",
      model: "anthropic/claude-sonnet-4-5",
    },
    quick: {
      description: "Fast parallel workers",
      model: "google/gemini-3-flash",
    },
    "visual-engineering": {
      description: "Efficient UI tasks",
      model: "google/gemini-3-flash",
    },
    artistry: {
      description: "Cost-effective creative tasks",
      model: "opencode/big-pickle",
    },
    writing: {
      description: "Cheap documentation",
      model: "opencode/big-pickle",
    },
    "parallel-worker": {
      description: "Background agents and subagents - optimized for I/O-bound parallel tasks",
      model: "google/gemini-3-flash",
    },
  },
}

/**
 * Hybrid-reasoning preset - Different models for different reasoning stages.
 * Cheap exploration -> deep analysis -> premium synthesis.
 * Research: Multi-stage reasoning benefits from different model strengths.
 */
export const HYBRID_REASONING_PRESET: PresetConfig = {
  name: "hybrid-reasoning",
  description: "Multi-stage reasoning - cheap exploration, premium synthesis",
  requiredProviders: ["anthropic", "google", "opencode"],
  categories: {
    ultrabrain: {
      description: "Final synthesis and conclusions",
      model: "anthropic/claude-opus-4-5",
    },
    quick: {
      description: "Initial exploration",
      model: "google/gemini-3-flash",
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
      description: "Breadth-first search and hypothesis generation",
      model: "google/gemini-3-flash",
    },
    analysis: {
      description: "Deep analysis before conclusions",
      model: "opencode/kimi-k2-thinking",
    },
    synthesis: {
      description: "Final answer synthesis",
      model: "anthropic/claude-opus-4-5",
    },
  },
}

/**
 * All presets indexed by name.
 */
export const PRESETS: Record<OrchestrationPreset, PresetConfig | null> = {
  balanced: BALANCED_PRESET,
  "claude-heavy": CLAUDE_HEAVY_PRESET,
  "budget-conscious": BUDGET_CONSCIOUS_PRESET,
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
  balanced: ["Recommended"],
  "claude-heavy": ["High Quality"],
  "budget-conscious": ["Budget-Friendly"],
  "speed-optimized": ["Fast"],
  "quality-first": ["Premium"],
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
