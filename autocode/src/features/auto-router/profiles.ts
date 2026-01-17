/**
 * Auto-Router Configuration Profiles
 *
 * Pre-configured profiles for different use cases, optimized based on:
 * - Community best practices from AI coding assistant forums
 * - Cost/quality tradeoffs research
 * - Real-world usage patterns from OpenCode users
 *
 * Profiles are designed to be opinionated defaults that users can select
 * from the autocode_setup.py wizard for quick configuration.
 */

import type { BudgetTier, TechniqueCombo } from "./types"

// ============================================================================
// Profile Type Definitions
// ============================================================================

export interface ProviderPriority {
  /** Provider ID (e.g., "github-copilot", "opencode") */
  provider: string
  /** Priority rank (1 = highest) */
  priority: number
  /** Whether this provider is enabled in this profile */
  enabled: boolean
}

export interface BudgetTierOverride {
  /** Primary model override for this tier */
  primary?: string
  /** Thinking model override */
  thinking?: string
  /** Judge model override */
  judge?: string
  /** Max iterations override */
  maxIterations?: number
  /** Timeout override in ms */
  timeoutMs?: number
}

export interface LoggingConfig {
  /** Enable verbose model selection logging */
  verboseModels: boolean
  /** Log technique selection reasoning */
  logTechniqueSelection: boolean
  /** Log escalation decisions */
  logEscalation: boolean
  /** Log rate limit events */
  logRateLimits: boolean
  /** Log spending milestones */
  logSpending: boolean
  /** Spending milestone interval in dollars */
  spendingMilestoneInterval: number
}

export interface EscalationConfig {
  /** Enable automatic escalation */
  autoEscalate: boolean
  /** Maximum escalations allowed */
  maxEscalations: number
  /** Quality threshold for escalation */
  qualityThreshold: number
  /** Consecutive failures before escalation */
  failuresBeforeEscalation: number
  /** Maximum budget tier to escalate to */
  maxBudgetTier: BudgetTier
}

export interface ConfigProfile {
  /** Unique profile ID */
  id: string
  /** Human-readable name */
  name: string
  /** Short description */
  description: string
  /** Detailed explanation for the wizard */
  longDescription: string
  /** Target use case tags */
  tags: string[]

  // === Budget Configuration ===
  /** Default starting budget tier */
  defaultBudget: BudgetTier
  /** Budget tier overrides (optional) */
  budgetOverrides?: Partial<Record<BudgetTier, BudgetTierOverride>>

  // === Provider Configuration ===
  /** Provider priority order (highest priority first) */
  providerPriorities: ProviderPriority[]
  /** Fallback chain order */
  fallbackChain: string[]

  // === Technique Configuration ===
  /** Default technique for simple tasks */
  defaultTechnique: TechniqueCombo
  /** Force ralph loop for all tasks */
  forceRalphLoop: boolean
  /** Force ultrathink for all tasks */
  forceUltrathink: boolean

  // === Escalation Configuration ===
  escalation: EscalationConfig

  // === Logging Configuration ===
  logging: LoggingConfig

  // === Cost Estimates (for display) ===
  /** Estimated cost per task in USD (rough average) */
  estimatedCostPerTask: {
    simple: number
    moderate: number
    complex: number
  }
}

// ============================================================================
// Profile Definitions
// ============================================================================

/**
 * ULTRA-FRUGAL: For users who cannot spend any money
 *
 * Research basis:
 * - OpenCode free models (GLM-4.7, Grok) provide reasonable quality for simple tasks
 * - Antigravity OAuth gives free access to Gemini
 * - No escalation to paid tiers prevents unexpected charges
 */
export const PROFILE_ULTRA_FRUGAL: ConfigProfile = {
  id: "ultra-frugal",
  name: "Ultra Frugal",
  description: "Free models only - no paid API usage",
  longDescription: `For users who cannot afford any API costs. Uses only free models
from OpenCode (GLM-4.7, Grok) and Google Antigravity (Gemini).
Will NEVER escalate to paid tiers. Quality may be lower for complex tasks,
but this ensures zero unexpected charges.`,
  tags: ["free", "budget", "no-cost"],

  defaultBudget: "free",
  budgetOverrides: {
    // Override all tiers to use free models
    cheap: {
      primary: "opencode/grok-code",
      thinking: "opencode/glm-4.7-free",
      judge: "opencode/glm-4.7-free",
    },
    moderate: {
      primary: "google/antigravity-gemini-3-flash",
      thinking: "opencode/grok-code",
      judge: "opencode/glm-4.7-free",
    },
    expensive: {
      primary: "google/antigravity-gemini-3-pro-high",
      thinking: "google/antigravity-gemini-3-flash",
      judge: "opencode/glm-4.7-free",
    },
    maximum: {
      primary: "google/antigravity-gemini-3-pro-high",
      thinking: "google/antigravity-gemini-3-flash",
      judge: "opencode/glm-4.7-free",
    },
  },

  providerPriorities: [
    { provider: "opencode", priority: 1, enabled: true },
    { provider: "google", priority: 2, enabled: true },
    { provider: "github-copilot", priority: 3, enabled: false },
    { provider: "openai", priority: 4, enabled: false },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["opencode", "google"],

  defaultTechnique: "direct",
  forceRalphLoop: false,
  forceUltrathink: false,

  escalation: {
    autoEscalate: false, // Never escalate to paid
    maxEscalations: 0,
    qualityThreshold: 0.5, // Lower threshold for free models
    failuresBeforeEscalation: 999, // Effectively disabled
    maxBudgetTier: "free",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: false,
    logEscalation: false, // No escalation to log
    logRateLimits: true,
    logSpending: false, // No spending to log
    spendingMilestoneInterval: 0,
  },

  estimatedCostPerTask: {
    simple: 0,
    moderate: 0,
    complex: 0,
  },
}

/**
 * BUDGET-CONSCIOUS: Minimize spending while allowing some paid usage
 *
 * Research basis:
 * - Most tasks can be completed with cheap models (GPT-4o-mini)
 * - Escalation only when truly necessary (2+ failures)
 * - Heavy use of free models for thinking/judging
 */
export const PROFILE_BUDGET_CONSCIOUS: ConfigProfile = {
  id: "budget-conscious",
  name: "Budget Conscious",
  description: "Minimize costs - escalate only when necessary",
  longDescription: `For users who need to watch their spending carefully.
Starts with free models and only escalates to cheap tier when quality issues
arise. Uses free models for thinking/judging to minimize costs.
Good for regular development work where occasional quality trade-offs are acceptable.`,
  tags: ["budget", "cost-effective", "economical"],

  defaultBudget: "free",
  budgetOverrides: {
    cheap: {
      primary: "opencode/glm-4.7-free",         // Use free model (gpt-4o-mini not available via Copilot)
      thinking: "opencode/grok-code",
      judge: "opencode/glm-4.7-free",
    },
    moderate: {
      primary: "github-copilot/gpt-4o",
      thinking: "opencode/grok-code",
      judge: "opencode/glm-4.7-free",
    },
  },

  providerPriorities: [
    { provider: "opencode", priority: 1, enabled: true },
    { provider: "google", priority: 2, enabled: true },
    { provider: "github-copilot", priority: 3, enabled: true },
    { provider: "openai", priority: 4, enabled: false },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["opencode", "google", "github-copilot"],

  defaultTechnique: "direct",
  forceRalphLoop: false,
  forceUltrathink: false,

  escalation: {
    autoEscalate: true,
    maxEscalations: 2,
    qualityThreshold: 0.6,
    failuresBeforeEscalation: 3,
    maxBudgetTier: "moderate",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: false,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 0.50, // Alert at $0.50 increments
  },

  estimatedCostPerTask: {
    simple: 0.001,
    moderate: 0.01,
    complex: 0.05,
  },
}

/**
 * BALANCED: Good default for most users
 *
 * Research basis:
 * - Claude Sonnet 4 offers best quality/cost ratio for coding tasks
 * - GPT-4o-mini excellent for thinking/judging (lower cost, good quality)
 * - Standard escalation rules work well for most projects
 */
export const PROFILE_BALANCED: ConfigProfile = {
  id: "balanced",
  name: "Balanced",
  description: "Good balance of cost and quality - recommended for most users",
  longDescription: `The recommended default for most developers.
Starts with cheap tier (GPT-4o) and escalates to moderate (Claude Sonnet 4)
when needed. Provides good quality without excessive costs.
Suitable for everyday development, bug fixes, and moderate feature work.`,
  tags: ["default", "recommended", "balanced"],

  defaultBudget: "cheap",

  providerPriorities: [
    { provider: "github-copilot", priority: 1, enabled: true },
    { provider: "google", priority: 2, enabled: true },
    { provider: "opencode", priority: 3, enabled: true },
    { provider: "openai", priority: 4, enabled: true },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["github-copilot", "openai", "google", "opencode"],

  defaultTechnique: "direct",
  forceRalphLoop: false,
  forceUltrathink: false,

  escalation: {
    autoEscalate: true,
    maxEscalations: 3,
    qualityThreshold: 0.7,
    failuresBeforeEscalation: 2,
    maxBudgetTier: "expensive",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 1.00,
  },

  estimatedCostPerTask: {
    simple: 0.01,
    moderate: 0.05,
    complex: 0.20,
  },
}

/**
 * QUALITY-FIRST: Production-quality code focus
 *
 * Research basis:
 * - GPT-5.2 and Claude Opus 4.5 produce highest quality code
 * - Higher quality thresholds catch more issues
 * - More iterations allow for thorough completion
 */
export const PROFILE_QUALITY_FIRST: ConfigProfile = {
  id: "quality-first",
  name: "Quality First",
  description: "Maximum quality for production code",
  longDescription: `For users who prioritize code quality over cost.
Starts with moderate tier and uses premium models (GPT-5.2, Claude Opus).
Higher quality thresholds ensure thorough verification.
Ideal for production code, security-sensitive work, and critical systems.`,
  tags: ["quality", "production", "premium"],

  defaultBudget: "moderate",

  providerPriorities: [
    { provider: "github-copilot", priority: 1, enabled: true },
    { provider: "openai", priority: 2, enabled: true },
    { provider: "google", priority: 3, enabled: true },
    { provider: "amazon-bedrock", priority: 4, enabled: true },
    { provider: "opencode", priority: 5, enabled: true },
  ],
  fallbackChain: ["github-copilot", "openai", "google", "amazon-bedrock", "opencode"],

  defaultTechnique: "ulw",
  forceRalphLoop: false,
  forceUltrathink: true,

  escalation: {
    autoEscalate: true,
    maxEscalations: 4,
    qualityThreshold: 0.8,
    failuresBeforeEscalation: 2,
    maxBudgetTier: "maximum",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 2.00,
  },

  estimatedCostPerTask: {
    simple: 0.05,
    moderate: 0.20,
    complex: 1.00,
  },
}

/**
 * SPEED-DEMON: Fast iteration for prototyping
 *
 * Research basis:
 * - Lower quality thresholds acceptable for prototypes
 * - Faster models (GPT-4o-mini, Gemini Flash) reduce latency
 * - Fewer iterations means faster completion
 */
export const PROFILE_SPEED_DEMON: ConfigProfile = {
  id: "speed-demon",
  name: "Speed Demon",
  description: "Fast iteration - optimized for rapid prototyping",
  longDescription: `For users who need fast iteration cycles.
Uses faster models with shorter timeouts and fewer iterations.
Lower quality thresholds to avoid getting stuck on perfectionism.
Perfect for hackathons, prototypes, and exploratory development.`,
  tags: ["fast", "prototype", "hackathon"],

  defaultBudget: "cheap",
  budgetOverrides: {
    cheap: { maxIterations: 2, timeoutMs: 20000 },
    moderate: { maxIterations: 3, timeoutMs: 30000 },
    expensive: { maxIterations: 5, timeoutMs: 60000 },
  },

  providerPriorities: [
    { provider: "github-copilot", priority: 1, enabled: true },
    { provider: "google", priority: 2, enabled: true },
    { provider: "opencode", priority: 3, enabled: true },
    { provider: "openai", priority: 4, enabled: false },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["github-copilot", "google", "opencode"],

  defaultTechnique: "direct",
  forceRalphLoop: false,
  forceUltrathink: false,

  escalation: {
    autoEscalate: true,
    maxEscalations: 2,
    qualityThreshold: 0.5,
    failuresBeforeEscalation: 3,
    maxBudgetTier: "moderate",
  },

  logging: {
    verboseModels: false,
    logTechniqueSelection: false,
    logEscalation: false,
    logRateLimits: false,
    logSpending: false,
    spendingMilestoneInterval: 0,
  },

  estimatedCostPerTask: {
    simple: 0.005,
    moderate: 0.02,
    complex: 0.10,
  },
}

/**
 * ENTERPRISE: Maximum reliability and security
 *
 * Research basis:
 * - Enterprise customers need predictable, secure behavior
 * - Amazon Bedrock provides enterprise SLAs
 * - Full logging for audit trails
 */
export const PROFILE_ENTERPRISE: ConfigProfile = {
  id: "enterprise",
  name: "Enterprise",
  description: "Maximum reliability for enterprise deployments",
  longDescription: `For enterprise teams with strict requirements.
Uses enterprise-grade providers (Bedrock) with full audit logging.
Higher quality thresholds and security-focused configuration.
Ideal for regulated industries, compliance-sensitive work, and large teams.`,
  tags: ["enterprise", "security", "compliance"],

  defaultBudget: "expensive",

  providerPriorities: [
    { provider: "amazon-bedrock", priority: 1, enabled: true },
    { provider: "github-copilot", priority: 2, enabled: true },
    { provider: "openai", priority: 3, enabled: true },
    { provider: "google", priority: 4, enabled: false },
    { provider: "opencode", priority: 5, enabled: false },
  ],
  fallbackChain: ["amazon-bedrock", "github-copilot", "openai"],

  defaultTechnique: "ultrathink+ulw",
  forceRalphLoop: false,
  forceUltrathink: true,

  escalation: {
    autoEscalate: true,
    maxEscalations: 3,
    qualityThreshold: 0.85,
    failuresBeforeEscalation: 2,
    maxBudgetTier: "maximum",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 5.00,
  },

  estimatedCostPerTask: {
    simple: 0.10,
    moderate: 0.50,
    complex: 2.00,
  },
}

/**
 * GAME-DEV: Optimized for game development
 *
 * Research basis:
 * - Game dev often requires persistent iteration (ralph loop)
 * - UI/frontend agents important for game assets
 * - Moderate quality acceptable for game prototypes
 */
export const PROFILE_GAME_DEV: ConfigProfile = {
  id: "game-dev",
  name: "Game Development",
  description: "Optimized for game development workflows",
  longDescription: `For game developers building games with Phaser, Unity, etc.
Ralph loop enabled by default for persistent task completion.
Moderate quality thresholds balance iteration speed with quality.
Includes game-specific agent prioritization.`,
  tags: ["game", "gamedev", "phaser", "unity"],

  defaultBudget: "moderate",

  providerPriorities: [
    { provider: "github-copilot", priority: 1, enabled: true },
    { provider: "google", priority: 2, enabled: true },
    { provider: "opencode", priority: 3, enabled: true },
    { provider: "openai", priority: 4, enabled: true },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["github-copilot", "google", "openai", "opencode"],

  defaultTechnique: "ulw+ralph",
  forceRalphLoop: true,
  forceUltrathink: false,

  escalation: {
    autoEscalate: true,
    maxEscalations: 3,
    qualityThreshold: 0.6,
    failuresBeforeEscalation: 2,
    maxBudgetTier: "expensive",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 1.00,
  },

  estimatedCostPerTask: {
    simple: 0.02,
    moderate: 0.15,
    complex: 0.50,
  },
}

/**
 * RESEARCH: Deep exploration and analysis
 *
 * Research basis:
 * - Research tasks benefit from ultrathink mode
 * - More iterations for thorough exploration
 * - Higher timeouts for complex analysis
 */
export const PROFILE_RESEARCH: ConfigProfile = {
  id: "research",
  name: "Research & Exploration",
  description: "Deep thinking for research and analysis tasks",
  longDescription: `For research, analysis, and exploratory development.
Ultrathink enabled by default for deep reasoning.
More iterations and longer timeouts for thorough exploration.
Ideal for architecture decisions, code audits, and learning new codebases.`,
  tags: ["research", "analysis", "exploration"],

  defaultBudget: "moderate",
  budgetOverrides: {
    moderate: { maxIterations: 8, timeoutMs: 120000 },
    expensive: { maxIterations: 15, timeoutMs: 300000 },
    maximum: { maxIterations: 30, timeoutMs: 900000 },
  },

  providerPriorities: [
    { provider: "github-copilot", priority: 1, enabled: true },
    { provider: "openai", priority: 2, enabled: true },
    { provider: "google", priority: 3, enabled: true },
    { provider: "opencode", priority: 4, enabled: true },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["github-copilot", "openai", "google", "opencode"],

  defaultTechnique: "ultrathink",
  forceRalphLoop: false,
  forceUltrathink: true,

  escalation: {
    autoEscalate: true,
    maxEscalations: 4,
    qualityThreshold: 0.65,
    failuresBeforeEscalation: 3,
    maxBudgetTier: "maximum",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 2.00,
  },

  estimatedCostPerTask: {
    simple: 0.05,
    moderate: 0.25,
    complex: 1.50,
  },
}

/**
 * CLASSIC: Original oh-my-opencode behavior
 *
 * Research basis:
 * - Replicates the original oh-my-opencode plugin behavior as closely as possible
 * - Uses standard Copilot-first routing that the original plugin relied on
 * - Simple escalation logic without complex technique orchestration
 * - Direct technique by default, auto-router selects advanced techniques when needed
 *
 * This profile is for users who:
 * - Prefer the "if it ain't broke, don't fix it" approach
 * - Want predictable, battle-tested behavior
 * - Are migrating from original oh-my-opencode
 */
export const PROFILE_CLASSIC: ConfigProfile = {
  id: "classic",
  name: "Classic (Original oh-my-opencode)",
  description: "Original oh-my-opencode behavior - Copilot-first, standard escalation",
  longDescription: `Replicates the original oh-my-opencode plugin behavior.
Uses GitHub Copilot as the primary provider with standard escalation rules.
Technique selection is automatic based on task classification, not forced.
Best for users who want the familiar, proven behavior of the original plugin
while still benefiting from the auto-router's intelligent task routing.`,
  tags: ["classic", "original", "stable", "copilot"],

  defaultBudget: "cheap",

  providerPriorities: [
    { provider: "github-copilot", priority: 1, enabled: true },
    { provider: "openai", priority: 2, enabled: true },
    { provider: "google", priority: 3, enabled: true },
    { provider: "opencode", priority: 4, enabled: true },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["github-copilot", "openai", "google", "opencode"],

  defaultTechnique: "direct",
  forceRalphLoop: false,
  forceUltrathink: false,

  escalation: {
    autoEscalate: true,
    maxEscalations: 3,
    qualityThreshold: 0.7,
    failuresBeforeEscalation: 2,
    maxBudgetTier: "expensive",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 1.00,
  },

  estimatedCostPerTask: {
    simple: 0.01,
    moderate: 0.08,
    complex: 0.30,
  },
}

/**
 * CLASSIC-FREE: Original behavior but cost-free
 *
 * For users who loved the original oh-my-opencode simplicity but need
 * zero-cost operation. Uses free models exclusively while maintaining
 * the same escalation and routing logic patterns.
 */
export const PROFILE_CLASSIC_FREE: ConfigProfile = {
  id: "classic-free",
  name: "Classic Free (Zero-Cost Original Behavior)",
  description: "Original oh-my-opencode feel with free models only",
  longDescription: `Same behavior patterns as the original oh-my-opencode plugin,
but uses only free models (OpenCode GLM/Grok, Google Antigravity).
Great for users who want the classic feel without any API costs.
Maintains familiar escalation patterns but within free tier limits.`,
  tags: ["classic", "free", "original", "no-cost"],

  defaultBudget: "free",
  budgetOverrides: {
    cheap: {
      primary: "opencode/grok-code",
      thinking: "opencode/glm-4.7-free",
      judge: "opencode/glm-4.7-free",
    },
    moderate: {
      primary: "google/antigravity-gemini-3-flash",
      thinking: "opencode/grok-code",
      judge: "opencode/glm-4.7-free",
    },
    expensive: {
      primary: "google/antigravity-gemini-3-pro-high",
      thinking: "google/antigravity-gemini-3-flash",
      judge: "opencode/grok-code",
    },
    maximum: {
      primary: "google/antigravity-gemini-3-pro-high",
      thinking: "google/antigravity-gemini-3-flash",
      judge: "opencode/grok-code",
    },
  },

  providerPriorities: [
    { provider: "opencode", priority: 1, enabled: true },
    { provider: "google", priority: 2, enabled: true },
    { provider: "github-copilot", priority: 3, enabled: false },
    { provider: "openai", priority: 4, enabled: false },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["opencode", "google"],

  defaultTechnique: "direct",
  forceRalphLoop: false,
  forceUltrathink: false,

  escalation: {
    autoEscalate: true,
    maxEscalations: 3,
    qualityThreshold: 0.6, // Slightly lower for free models
    failuresBeforeEscalation: 2,
    maxBudgetTier: "maximum", // Escalation within free models
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: false, // No spending to log
    spendingMilestoneInterval: 0,
  },

  estimatedCostPerTask: {
    simple: 0,
    moderate: 0,
    complex: 0,
  },
}

/**
 * CLASSIC-COPILOT-MAX: Original behavior with maximum Copilot utilization
 *
 * For users with full Copilot access who want to maximize their subscription value.
 * Uses Copilot for everything, escalates aggressively within Copilot tier.
 */
export const PROFILE_CLASSIC_COPILOT_MAX: ConfigProfile = {
  id: "classic-copilot-max",
  name: "Classic Copilot Max",
  description: "Maximize GitHub Copilot subscription - aggressive Copilot-only routing",
  longDescription: `For users with unlimited GitHub Copilot access who want to
get maximum value from their subscription. Uses Copilot models exclusively
with aggressive escalation. Falls back to direct OpenAI API only if Copilot
is completely unavailable. Perfect for enterprise Copilot subscribers.`,
  tags: ["classic", "copilot", "subscription", "enterprise"],

  defaultBudget: "moderate",

  providerPriorities: [
    { provider: "github-copilot", priority: 1, enabled: true },
    { provider: "openai", priority: 2, enabled: true },
    { provider: "google", priority: 3, enabled: false },
    { provider: "opencode", priority: 4, enabled: false },
    { provider: "amazon-bedrock", priority: 5, enabled: false },
  ],
  fallbackChain: ["github-copilot", "openai"],

  defaultTechnique: "direct",
  forceRalphLoop: false,
  forceUltrathink: false,

  escalation: {
    autoEscalate: true,
    maxEscalations: 4,
    qualityThreshold: 0.7,
    failuresBeforeEscalation: 1, // Aggressive escalation - use full Copilot power
    maxBudgetTier: "maximum",
  },

  logging: {
    verboseModels: true,
    logTechniqueSelection: true,
    logEscalation: true,
    logRateLimits: true,
    logSpending: true,
    spendingMilestoneInterval: 2.00,
  },

  estimatedCostPerTask: {
    simple: 0.02,
    moderate: 0.10,
    complex: 0.40,
  },
}

// ============================================================================
// Profile Registry
// ============================================================================

export const CONFIG_PROFILES: Record<string, ConfigProfile> = {
  // Classic profiles (original oh-my-opencode behavior)
  "classic": PROFILE_CLASSIC,
  "classic-free": PROFILE_CLASSIC_FREE,
  "classic-copilot-max": PROFILE_CLASSIC_COPILOT_MAX,
  // Modern profiles
  "ultra-frugal": PROFILE_ULTRA_FRUGAL,
  "budget-conscious": PROFILE_BUDGET_CONSCIOUS,
  "balanced": PROFILE_BALANCED,
  "quality-first": PROFILE_QUALITY_FIRST,
  "speed-demon": PROFILE_SPEED_DEMON,
  "enterprise": PROFILE_ENTERPRISE,
  "game-dev": PROFILE_GAME_DEV,
  "research": PROFILE_RESEARCH,
}

export const DEFAULT_PROFILE_ID = "balanced"

/**
 * Get a profile by ID
 */
export function getProfile(id: string): ConfigProfile | undefined {
  return CONFIG_PROFILES[id]
}

/**
 * Get all profiles sorted by estimated cost
 */
export function getProfilesSortedByCost(): ConfigProfile[] {
  return Object.values(CONFIG_PROFILES).sort(
    (a, b) => a.estimatedCostPerTask.moderate - b.estimatedCostPerTask.moderate
  )
}

/**
 * Get profiles matching a tag
 */
export function getProfilesByTag(tag: string): ConfigProfile[] {
  return Object.values(CONFIG_PROFILES).filter(p => p.tags.includes(tag))
}

/**
 * Get recommended profile based on constraints
 */
export function recommendProfile(constraints: {
  maxCostPerTask?: number
  needsHighQuality?: boolean
  needsFastIteration?: boolean
  isEnterprise?: boolean
  isGameDev?: boolean
}): ConfigProfile {
  if (constraints.isEnterprise) return PROFILE_ENTERPRISE
  if (constraints.isGameDev) return PROFILE_GAME_DEV
  if (constraints.needsFastIteration) return PROFILE_SPEED_DEMON
  if (constraints.needsHighQuality) return PROFILE_QUALITY_FIRST

  if (constraints.maxCostPerTask !== undefined) {
    if (constraints.maxCostPerTask === 0) return PROFILE_ULTRA_FRUGAL
    if (constraints.maxCostPerTask < 0.05) return PROFILE_BUDGET_CONSCIOUS
    if (constraints.maxCostPerTask < 0.20) return PROFILE_BALANCED
    return PROFILE_QUALITY_FIRST
  }

  return PROFILE_BALANCED
}
